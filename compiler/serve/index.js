/**
 * `rune serve` — host this machine's Rune skills for any MCP client.
 *
 *   rune serve [--port 8787] [--host 127.0.0.1] [--skills-dir a,b]
 *              [--pro-root <dir>] [--business-root <dir>] [--no-tiers]
 *              [--rate-limit 120] [--max-bytes 262144] [--allow-query-key]
 *              [--trust-proxy] [--config <file>]
 *   rune serve --stdio            MCP over stdin/stdout (local / via ssh), no key
 *   rune serve key rotate         mint a new key (prints it once)
 *   rune serve key path           show where the key hash is stored
 */

import './polyfill.js';
import { statSync } from 'node:fs';
import path from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { detectTiers } from '../commands/setup.js';
import { defaultConfigPath, ensureKey, readServeConfig, rotateKey } from './auth.js';
import { createCatalog, DEFAULT_MAX_BYTES } from './catalog.js';
import { createHttpHandler, listen } from './http.js';
import { installService } from './install.js';
import { createRuneMcpServer } from './mcp.js';
import { createRunner } from './runner.js';
import { clearState, cmdServeSetup, defaultKeyOutPath, statePathFor, writeKeyFile, writeState } from './setup.js';
import { startTunnel } from './tunnel.js';

/**
 * Work out which roots to serve.
 * @returns {Array<{ root: string, tier: string, source: string }>}
 */
export function resolveServeRoots({ runeRoot, projectRoot, args = {}, detect = detectTiers }) {
  const roots = [{ root: runeRoot, tier: 'free', source: 'rune package' }];
  if (!args['no-tiers']) {
    const detected = detect(projectRoot);
    for (const tier of ['pro', 'business']) {
      const explicit = args[`${tier}-root`];
      if (typeof explicit === 'string') {
        roots.push({ root: path.resolve(projectRoot, explicit), tier, source: `--${tier}-root` });
      } else if (detected?.[tier]?.path) {
        roots.push({ root: path.dirname(path.dirname(detected[tier].path)), tier, source: detected[tier].source });
      }
    }
  }
  const extra = args['skills-dir'];
  if (typeof extra === 'string') {
    for (const d of extra
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)) {
      roots.push({ root: path.resolve(projectRoot, d), tier: 'custom', source: '--skills-dir' });
    }
  }
  return roots;
}

function intFlag(v, def, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (v === undefined || v === true) return def;
  const n = Number.parseInt(String(v), 10);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`Invalid number: ${v}`);
  return n;
}

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);

/**
 * Programmatic start (used by the CLI and tests).
 * @returns {Promise<{ url: string, port: number, host: string, catalog: object, key?: string, close: () => Promise<void> }>}
 */
export async function startServe({
  runeRoot,
  projectRoot = process.cwd(),
  args = {},
  version = '0.0.0',
  out = (line) => process.stderr.write(`${line}\n`),
  detect,
  runner = null,
  ...opts
}) {
  if (!runner && typeof args.runner === 'string') {
    runner = createRunner({
      name: args.runner,
      timeoutMs: intFlag(args['runner-timeout'], 600, { min: 5, max: 3600 }) * 1000,
      concurrency: intFlag(args['runner-concurrency'], 2, { min: 1, max: 16 }),
    });
  }
  const roots = resolveServeRoots({ runeRoot, projectRoot, args, detect });
  const catalog = createCatalog({ roots, maxBytes: intFlag(args['max-bytes'], DEFAULT_MAX_BYTES, { min: 1024 }) });
  const serverName = typeof args.name === 'string' ? args.name : 'rune';
  const makeServer = () => {
    catalog.refreshIfStale();
    return createRuneMcpServer({ catalog, version, serverName, runner });
  };

  if (args.stdio) {
    const server = makeServer();
    await server.connect(new StdioServerTransport());
    out(`rune serve: stdio MCP ready — ${catalog.size} skills (${fmtCounts(catalog.counts())})`);
    return { url: 'stdio', port: 0, host: 'stdio', catalog, close: () => server.close() };
  }

  const configPath = typeof args.config === 'string' ? path.resolve(args.config) : defaultConfigPath();
  const keyInfo = ensureKey(configPath);
  // Re-read the key hash when the config file changes, so `rune serve key rotate`
  // takes effect without a restart.
  let liveHash = keyInfo.keyHash;
  let seenMtime = keyInfo.source === 'env' ? null : mtimeOf(configPath);
  const currentKeyHash = () => {
    if (keyInfo.source === 'env') return liveHash;
    const m = mtimeOf(configPath);
    if (m !== seenMtime) {
      seenMtime = m;
      const cfg = readServeConfig(configPath);
      if (cfg && typeof cfg.keyHash === 'string' && /^[a-f0-9]{64}$/.test(cfg.keyHash)) liveHash = cfg.keyHash;
    }
    return liveHash;
  };
  const host = typeof args.host === 'string' ? args.host : '127.0.0.1';
  const port = intFlag(args.port, 8787, { min: 0, max: 65535 });

  const handler = createHttpHandler({
    createServer: makeServer,
    keyHash: currentKeyHash,
    info: () => ({ name: serverName, version, skills: catalog.size }),
    rateLimit: intFlag(args['rate-limit'], 120, { min: 1 }),
    allowQueryKey: Boolean(args['allow-query-key']),
    trustProxy: Boolean(args['trust-proxy']),
    log: (l) => out(`rune serve: ${l}`),
  });
  const bound = await listen(handler, { port, host });
  const shownHost = host.includes(':') ? `[${host}]` : host;
  const url = `http://${shownHost}:${bound.port}/mcp`;

  let tunnel = null;
  let tunnelError = null;
  if (args.tunnel) {
    const target = `http://${host === '0.0.0.0' || host === '::' ? '127.0.0.1' : shownHost}:${bound.port}`;
    try {
      tunnel = await (opts.startTunnel || startTunnel)({ target });
    } catch (err) {
      tunnelError = err.message;
      out(`  ⚠ --tunnel: ${err.message}`);
    }
  }

  out('');
  out(`  Rune skill server — ${catalog.size} skills (${fmtCounts(catalog.counts())})`);
  for (const r of roots) out(`    · ${r.tier.padEnd(8)} ${r.root}  (${r.source})`);
  out(`  MCP endpoint: ${url}`);
  if (tunnel)
    out(`  Public HTTPS (Cloudflare quick tunnel, EXPERIMENTAL — changes each start): ${tunnel.publicUrl}/mcp`);
  if (keyInfo.created) {
    out('');
    out('  New server key (shown ONCE — store it in your password manager):');
    out(`    ${keyInfo.key}`);
    out(`  Hash saved to ${keyInfo.configPath} (0600). Lost it? \`rune serve key rotate\`.`);
  } else {
    out(
      `  Key: ${keyInfo.source === 'env' ? '$RUNE_SERVE_KEY' : `${keyInfo.keyHint || 'stored'} (hash in ${keyInfo.configPath})`}`,
    );
  }
  out('');
  out(
    `  Connect: claude mcp add --transport http rune ${tunnel ? `${tunnel.publicUrl}/mcp` : url} --header "Authorization: Bearer <key>"`,
  );
  if (!LOOPBACK.has(host)) {
    out('  ⚠ Listening beyond localhost over plain HTTP — put it behind HTTPS (Caddy/nginx/Cloudflare Tunnel).');
  }
  if (runner) {
    out(`  ⚠ EXPERIMENTAL runner: run_skill(mode "execute") runs ${runner.name} on this server (${runner.command}).`);
    out('    Anyone holding the key can make it work in ~/.rune/serve-runs/ with edit permissions.');
  }
  if (args['allow-query-key']) out('  ⚠ ?key= in the URL is accepted — URLs end up in logs; prefer the header.');
  out('');

  const close = async () => {
    tunnel?.stop();
    await bound.close();
  };
  return {
    url,
    publicUrl: tunnel ? `${tunnel.publicUrl}/mcp` : null,
    tunnelError,
    port: bound.port,
    host,
    catalog,
    key: keyInfo.key,
    close,
    httpServer: bound.server,
  };
}

function mtimeOf(file) {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return null;
  }
}

function fmtCounts(c) {
  return Object.entries(c)
    .map(([t, n]) => `${t} ${n}`)
    .join(', ');
}

/** True for `--help`, `-h` or `help` anywhere after `rune serve` — help never runs anything. */
export function wantsHelp(args = {}, positional = []) {
  if (args.help !== undefined || args.h !== undefined) return true;
  return positional.slice(1).some((p) => p === '-h' || p === '-?' || p === '/?' || p === 'help');
}

/**
 * Hand a freshly minted key to the operator. On a terminal it is printed once; when stdout is
 * not a TTY (agents, CI, logs capture it) it goes to a 0600 file and only the path is printed.
 */
export function deliverKey(key, { configPath, args = {}, isTTY = Boolean(process.stdout.isTTY), out }) {
  if (typeof args['key-out'] === 'string' || !isTTY) {
    const file = writeKeyFile(
      typeof args['key-out'] === 'string' ? args['key-out'] : defaultKeyOutPath(configPath),
      key,
    );
    if (!isTTY) out('  stdout is not a terminal, so the key is NOT printed.');
    out(`  New key written to ${file} (0600). Move it to your password manager, then delete the file.`);
    return { file };
  }
  out('  New Rune server key (shown ONCE — store it in your password manager):');
  process.stdout.write(`  ${key}\n`);
  return { printed: true };
}

/** CLI entry: `rune serve ...` */
export async function cmdServe({ runeRoot, projectRoot, args, positional = [], version }) {
  const sub = positional[1];
  const out = (line) => process.stderr.write(`${line}\n`);
  const configPath = typeof args.config === 'string' ? path.resolve(args.config) : defaultConfigPath();

  // Help first: `rune serve <anything> --help` must print usage and do nothing else.
  if (wantsHelp(args, positional)) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }

  if (sub === 'key') {
    const action = positional[2];
    if (action === 'rotate') {
      const { key } = rotateKey(configPath);
      out('');
      out('  Key rotated. The old key stops working on the next request.');
      deliverKey(key, { configPath, args, out });
      out(`  Hash saved to ${configPath}. A running \`rune serve\` picks it up on the next request.`);
      out('');
      return;
    }
    if (action === 'path') {
      process.stdout.write(`${configPath}\n`);
      return;
    }
    out('  Usage: rune serve key rotate | rune serve key path');
    process.exitCode = 1;
    return;
  }
  if (sub === 'install') {
    // Mint the key HERE, in the operator's terminal, so it never lands in the journal.
    const keyInfo = ensureKey(configPath);
    const res = installService({
      nodePath: process.execPath,
      runeBin: path.join(runeRoot, 'compiler', 'bin', 'rune.js'),
      args,
    });
    if (/[\\/]_npx[\\/]/.test(runeRoot)) {
      out(
        '  ⚠ Running from the npx cache, which gets cleaned up. Install first: npm i -g @rune-kit/rune && rune serve install',
      );
    }
    if (res.unitPath) out(`\n  ✓ Wrote ${res.unitPath} (EXPERIMENTAL)`);
    else process.stdout.write(res.unit);
    if (keyInfo.created) {
      out('');
      deliverKey(keyInfo.key, { configPath, args, out });
    }
    out('\n  Next:');
    for (const line of res.next) out(`    ${line}`);
    out('');
    return;
  }
  if (['setup', 'start', 'stop', 'status', 'doctor', 'connect'].includes(sub)) {
    await cmdServeSetup({ sub, runeRoot, projectRoot, args, positional, configPath });
    return;
  }
  if (sub) {
    out(`  ✗ Unknown serve subcommand: ${sub}\n${USAGE}`);
    process.exitCode = 1;
    return;
  }

  const running = await startServe({ runeRoot, projectRoot, args, version, out });
  if (running.url === 'stdio') return; // transport keeps the process alive

  // Let `rune serve status|connect|setup` find this server (and its tunnel URL).
  const writeRunState = () =>
    writeState(
      {
        ready: true,
        pid: process.pid,
        url: running.url,
        publicUrl: running.publicUrl,
        tunnelError: running.tunnelError,
        version,
        skills: running.catalog.size,
        startedAt: new Date().toISOString(),
      },
      configPath,
    );
  try {
    writeRunState();
  } catch (err) {
    out(`  ⚠ could not write ${statePathFor(configPath)}: ${err.message}`);
  }
  const shutdown = () => {
    try {
      clearState(configPath);
    } catch {
      /* best effort */
    }
    running.close().then(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export const USAGE = `
  rune serve — host this machine's Rune skills over MCP

  rune serve [--port 8787] [--host 127.0.0.1]     Streamable HTTP at /mcp (bearer key)
             [--skills-dir <dir>[,<dir>]]         extra skill folders (tier "custom")
             [--pro-root <dir>] [--business-root <dir>] [--no-tiers]
             [--rate-limit 120]                   requests / minute / IP
             [--max-bytes 262144]                 max bytes returned per file
             [--trust-proxy]                      rate-limit by X-Forwarded-For
             [--allow-query-key]                  accept ?key= (clients without headers)
             [--runner claude|codex|grok]         EXPERIMENTAL: run_skill mode "execute" runs the
                                                  skill on this server via that CLI
             [--runner-timeout 600] [--runner-concurrency 2]
             [--config <file>]                    key file (default ~/.rune/serve.json)
  rune serve --stdio                              MCP over stdio (local or via ssh)
             [--tunnel]                           EXPERIMENTAL: public https via cloudflared quick tunnel
  rune serve setup                                guided setup: key, HTTPS, service, health check, connect
             [--yes] [--json]                     no questions (agents / scripts), JSON report
             [--expose local|tunnel|domain|tailscale] [--domain <host>]
             [--service|--no-service] [--no-start] [--rotate-key] [--key-out <file>] [--no-download]
                                                  no terminal (agent/CI/pipe)? --yes is required, and a new
                                                  key goes to ~/.rune/serve.key (0600), never to stdout
  rune serve start | stop                         start (background or service) / stop with the saved setup
  rune serve status | doctor [--json]             running? URLs, skills; doctor also probes local + public
  rune serve connect [client|all] [--url <url>]   copy-paste connect steps: grok-bot claude grok codex
                                                  cursor gemini antigravity (never prints the key)
  rune serve install [--print] [serve flags]      EXPERIMENTAL: systemd unit (user unit, or --print)
  rune serve key rotate [--key-out <file>]        mint a new key, print it once (to a 0600 file when
                                                  stdout is not a terminal)
  rune serve key path                             where the key hash lives

  Every subcommand accepts --help / -h (prints this, does nothing else).
  Docs: docs/SERVE.md
`;
