/**
 * Streamable HTTP front door for `rune serve`.
 *
 *   GET  /health   → { ok, name, version, skills }   (no auth, no skill data)
 *   POST /mcp      → MCP Streamable HTTP (stateless; bearer key required)
 *   GET/DELETE /mcp → 405 (stateless server has no sessions / SSE stream)
 *
 * Guards: bearer key (constant-time), per-IP rate limit, separate limit on
 * failed auth, 1 MB request body cap. No shell execution happens here.
 */

import './polyfill.js';
import http from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { extractKey, verifyKey } from './auth.js';

export const DEFAULT_BODY_LIMIT = 1024 * 1024;

/** Fixed-window per-key counter. */
export function createRateLimiter({ limit, windowMs = 60_000, now = () => Date.now() }) {
  const buckets = new Map();
  return {
    /** @returns {{ ok: boolean, retryAfter: number }} */
    hit(key) {
      const t = now();
      let b = buckets.get(key);
      if (!b || t - b.start >= windowMs) {
        b = { start: t, count: 0 };
        buckets.set(key, b);
      }
      b.count += 1;
      if (buckets.size > 10_000) {
        for (const [k, v] of buckets) if (t - v.start >= windowMs) buckets.delete(k);
      }
      return { ok: b.count <= limit, retryAfter: Math.ceil((b.start + windowMs - t) / 1000) };
    },
  };
}

function sendJson(res, status, body, headers = {}) {
  if (res.headersSent) return;
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}

function rpcError(res, status, code, message, headers) {
  sendJson(res, status, { jsonrpc: '2.0', error: { code, message }, id: null }, headers);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const tooLarge = () => Object.assign(new Error('Request body too large'), { status: 413 });
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit) {
      req.resume(); // discard
      reject(tooLarge());
      return;
    }
    let size = 0;
    let over = false;
    const chunks = [];
    req.on('data', (c) => {
      if (over) return;
      size += c.length;
      if (size > limit) {
        over = true;
        chunks.length = 0;
        reject(tooLarge());
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!over) resolve(Buffer.concat(chunks).toString('utf-8'));
    });
    req.on('error', reject);
  });
}

function clientIp(req, trustProxy) {
  if (trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
    const cf = req.headers['cf-connecting-ip'];
    if (typeof cf === 'string' && cf) return cf;
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * @param {{
 *   createServer: () => import('@modelcontextprotocol/sdk/server/mcp.js').McpServer,
 *   keyHash: string | (() => string),
 *   info: () => object,
 *   rateLimit?: number,
 *   bodyLimit?: number,
 *   allowQueryKey?: boolean,
 *   trustProxy?: boolean,
 *   log?: (line: string) => void,
 * }} opts
 */
export function createHttpHandler({
  createServer,
  keyHash,
  info,
  rateLimit = 120,
  bodyLimit = DEFAULT_BODY_LIMIT,
  allowQueryKey = false,
  trustProxy = false,
  log = () => {},
}) {
  const limiter = createRateLimiter({ limit: rateLimit });
  const authFailLimiter = createRateLimiter({ limit: 10 });

  return async function handle(req, res) {
    const url = new URL(req.url || '/', 'http://localhost');
    const ip = clientIp(req, trustProxy);

    if (url.pathname === '/health' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, ...info() });
    }
    if (url.pathname !== '/mcp') {
      return sendJson(res, 404, { error: 'Not found. The MCP endpoint is /mcp' });
    }

    const rl = limiter.hit(ip);
    if (!rl.ok) {
      return rpcError(res, 429, -32000, 'Rate limit exceeded', { 'retry-after': String(rl.retryAfter) });
    }

    const presented = extractKey(req, { allowQueryKey });
    const expected = typeof keyHash === 'function' ? keyHash() : keyHash;
    if (!verifyKey(presented, expected)) {
      const fl = authFailLimiter.hit(ip);
      log(`auth failed from ${ip}`);
      if (!fl.ok) {
        return rpcError(res, 429, -32000, 'Too many failed auth attempts', { 'retry-after': String(fl.retryAfter) });
      }
      return rpcError(res, 401, -32001, 'Unauthorized: send "Authorization: Bearer <rune serve key>"', {
        'www-authenticate': 'Bearer realm="rune"',
      });
    }

    if (req.method !== 'POST') {
      return rpcError(res, 405, -32000, 'Method not allowed (stateless server: use POST)', { allow: 'POST' });
    }

    let parsed;
    try {
      const raw = await readBody(req, bodyLimit);
      parsed = raw ? JSON.parse(raw) : undefined;
    } catch (err) {
      if (err.status === 413) {
        return rpcError(res, 413, -32000, `Request body exceeds ${bodyLimit} bytes`, { connection: 'close' });
      }
      return rpcError(res, 400, -32700, 'Parse error');
    }

    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, parsed);
    } catch (err) {
      log(`request error: ${err.message}`);
      rpcError(res, 500, -32603, 'Internal error');
    }
  };
}

/**
 * Start listening. Resolves with the bound address once ready.
 * @returns {Promise<{ server: http.Server, port: number, host: string, close: () => Promise<void> }>}
 */
export function listen(handler, { port = 8787, host = '127.0.0.1' } = {}) {
  const srv = http.createServer((req, res) => {
    handler(req, res).catch(() => rpcError(res, 500, -32603, 'Internal error'));
  });
  srv.headersTimeout = 30_000;
  srv.requestTimeout = 15 * 60_000; // runner calls can take minutes
  return new Promise((resolve, reject) => {
    srv.once('error', reject);
    srv.listen(port, host, () => {
      const addr = srv.address();
      resolve({
        server: srv,
        port: typeof addr === 'object' && addr ? addr.port : port,
        host,
        close: () =>
          new Promise((r) => {
            srv.closeAllConnections?.();
            srv.close(() => r());
          }),
      });
    });
  });
}
