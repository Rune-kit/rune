/**
 * `rune serve setup | start | stop | status | doctor | connect`
 *
 * One command from "nothing" to "every agent connected":
 *
 *   rune serve setup                      interactive wizard (TTY)
 *   rune serve setup --yes [--json]       same, no questions — what an agent runs over SSH
 *
 * Steps: detect the machine (PC vs VPS/headless) → Pro/Business roots → server
 * key (printed ONCE, only its hash is stored) → exposure (local / Cloudflare
 * quick tunnel / your domain behind Caddy / Tailscale Funnel) → keep it running
 * (systemd user service or a background process) → MCP health check →
 * copy-paste connect instructions per client.
 *
 * Every step is a plain function with injectable deps so it can be tested
 * without a network, systemd or cloudflared.
 */

import { spawn, spawnSync } from 'node:child_process';
import dns from 'node:dns/promises';
import { chmodSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { isIP } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { detectTiers } from '../commands/setup.js';
import { defaultConfigPath, ensureKey, readServeConfig, rotateKey, writeServeConfig } from './auth.js';
import { installService } from './install.js';
import { whichSync } from './runner.js';
import { findCloudflared } from './tunnel.js';

export const EXPOSE_MODES = ['local', 'tunnel', 'domain', 'tailscale'];
export const CLIENTS = ['grok-bot', 'claude', 'grok', 'codex', 'cursor', 'gemini', 'antigravity'];
const KEY_PLACEHOLDER = '$RUNE_KEY';
// PowerShell reads environment variables as $env:NAME ($RUNE_KEY would be an empty PS variable).
const KEY_PLACEHOLDER_PS = '$env:RUNE_KEY';

/** Where a new key goes when it must not be printed (non-TTY stdout, agents, logs). */
export function defaultKeyOutPath(configPath = defaultConfigPath()) {
  return path.join(path.dirname(configPath), 'serve.key');
}

/** Write a key to a 0600 file (created or replaced). Returns the absolute path. */
export function writeKeyFile(file, key) {
  const abs = path.resolve(file);
  mkdirSync(path.dirname(abs), { recursive: true, mode: 0o700 });
  writeFileSync(abs, `${key}\n`, { mode: 0o600 });
  safe(() => chmodSync(abs, 0o600));
  return abs;
}

/** How to set RUNE_KEY in the user's shell, per OS. */
export function keyEnvHint(platform = process.platform) {
  return platform === 'win32'
    ? 'In PowerShell, first: $env:RUNE_KEY = "rune_sk_…"   (all new windows: setx RUNE_KEY "rune_sk_…")'
    : 'In a terminal, first: export RUNE_KEY=rune_sk_…';
}
// Cursor expands ${env:NAME} inside mcp.json, so the key stays out of the file.
// biome-ignore lint/suspicious/noTemplateCurlyInString: literal Cursor interpolation syntax
const CURSOR_KEY_REF = 'Bearer ${env:RUNE_KEY}';

// ─── state file (written by the running server) ───

export function statePathFor(configPath = defaultConfigPath()) {
  return path.join(path.dirname(configPath), 'serve-state.json');
}

export function readState(configPath) {
  try {
    const s = JSON.parse(readFileSync(statePathFor(configPath), 'utf-8'));
    return s && typeof s === 'object' ? s : null;
  } catch {
    return null;
  }
}

export function writeState(state, configPath) {
  const file = statePathFor(configPath);
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

/** Remove the state file, but only if it still describes `pid`. */
export function clearState(configPath, pid = process.pid) {
  const s = readState(configPath);
  if (s && s.pid === pid) rmSync(statePathFor(configPath), { force: true });
}

export function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

// ─── environment ───

/**
 * @returns {{ kind: 'vps'|'local', platform: string, arch: string, ssh: boolean, headless: boolean,
 *   systemdUser: boolean, cloudflared: string|null, tailscale: string|null, caddy: string|null,
 *   npx: boolean, node: string }}
 */
export function detectEnvironment({
  env = process.env,
  platform = process.platform,
  arch = process.arch,
  runeRoot = '',
  which = (c) => whichSync(c, env.PATH || ''),
  systemdCheck = () => spawnSync('systemctl', ['--user', 'show-environment'], { stdio: 'ignore' }).status === 0,
} = {}) {
  const ssh = Boolean(env.SSH_CONNECTION || env.SSH_TTY);
  const headless = platform === 'linux' && !env.DISPLAY && !env.WAYLAND_DISPLAY;
  const systemdUser = platform === 'linux' && Boolean(which('systemctl')) && safe(systemdCheck, false);
  return {
    kind: ssh || headless ? 'vps' : 'local',
    platform,
    arch,
    ssh,
    headless,
    systemdUser,
    cloudflared: findCloudflared(env),
    tailscale: which('tailscale'),
    caddy: which('caddy'),
    npx: /[\\/]_npx[\\/]/.test(runeRoot),
    node: process.version,
  };
}

function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

// ─── cloudflared (user-space download) ───

const CLOUDFLARED_BASE = 'https://github.com/cloudflare/cloudflared/releases/latest/download/';

/** Release asset for this OS/CPU, or null if Cloudflare ships none. */
export function cloudflaredAsset(platform = process.platform, arch = process.arch) {
  const cpu = { x64: 'amd64', arm64: 'arm64', arm: 'arm', ia32: '386' }[arch];
  if (!cpu) return null;
  if (platform === 'linux') return { name: `cloudflared-linux-${cpu}`, archive: false };
  if (platform === 'darwin' && (cpu === 'amd64' || cpu === 'arm64'))
    return { name: `cloudflared-darwin-${cpu}.tgz`, archive: true };
  if (platform === 'win32')
    return { name: `cloudflared-windows-${cpu === '386' ? '386' : 'amd64'}.exe`, archive: false };
  return null;
}

/**
 * Return a cloudflared path, downloading the official release into ~/.rune/bin
 * when it is missing (no sudo, no package manager).
 */
export async function ensureCloudflared({
  env = process.env,
  home = os.homedir(),
  platform = process.platform,
  arch = process.arch,
  fetchImpl = globalThis.fetch,
  allowDownload = true,
  log = () => {},
} = {}) {
  const existing = findCloudflared({ ...env, HOME: home, USERPROFILE: home });
  if (existing) return { path: existing, downloaded: false };
  if (!allowDownload) throw new Error('cloudflared is not installed and --no-download was given');
  const asset = cloudflaredAsset(platform, arch);
  if (!asset)
    throw new Error(`No cloudflared build for ${platform}/${arch} — install it yourself or pick another exposure`);
  const binDir = path.join(home, '.rune', 'bin');
  mkdirSync(binDir, { recursive: true, mode: 0o700 });
  const target = path.join(binDir, platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
  const url = CLOUDFLARED_BASE + asset.name;
  log(`Downloading cloudflared (${asset.name}) from GitHub → ${target}`);
  const res = await fetchImpl(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} for ${url}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 1_000_000) throw new Error(`Download looks wrong (${bytes.length} bytes) from ${url}`);
  const tmp = `${target}.download`;
  writeFileSync(tmp, bytes, { mode: 0o755 });
  if (asset.archive) {
    const r = spawnSync('tar', ['-xzf', tmp, '-C', binDir], { stdio: 'ignore' });
    rmSync(tmp, { force: true });
    if (r.status !== 0 || !existsSync(target)) throw new Error('Could not unpack cloudflared .tgz (needs `tar`)');
  } else {
    renameSync(tmp, target);
  }
  safe(() => chmodSync(target, 0o755));
  return { path: target, downloaded: true };
}

// ─── exposure helpers ───

export function caddySnippet(domain, port = 8787) {
  return `${domain} {\n\treverse_proxy 127.0.0.1:${port}\n}\n`;
}

/** Tailscale Funnel: start it in the background and return the public https URL. */
export function startTailscaleFunnel({ port, run = spawnSync, bin = 'tailscale' } = {}) {
  const funnel = run(bin, ['funnel', '--bg', String(port)], { encoding: 'utf-8', timeout: 30_000 });
  if (funnel.status !== 0) {
    const why = String(funnel.stderr || funnel.stdout || '')
      .trim()
      .split('\n')[0];
    throw new Error(
      `tailscale funnel failed${why ? `: ${why}` : ''} (enable Funnel for this node in the admin console)`,
    );
  }
  const st = run(bin, ['status', '--json'], { encoding: 'utf-8', timeout: 15_000 });
  const dns = safe(() => JSON.parse(st.stdout).Self.DNSName, '');
  if (!dns)
    throw new Error('tailscale funnel is on, but `tailscale status --json` did not report this node’s DNS name');
  return `https://${dns.replace(/\.$/, '')}`;
}

/** The `rune serve` flags implied by a setup profile. */
export function serveArgsFromProfile(p, { configPath, defaultConfig = defaultConfigPath() } = {}) {
  const a = { port: String(p.port ?? 8787) };
  if (p.host && p.host !== '127.0.0.1') a.host = p.host;
  if (p.noTiers) a['no-tiers'] = true;
  else {
    if (p.proRoot) a['pro-root'] = p.proRoot;
    if (p.businessRoot) a['business-root'] = p.businessRoot;
  }
  if (p.skillsDir) a['skills-dir'] = p.skillsDir;
  if (p.expose === 'tunnel') a.tunnel = true;
  if (p.expose !== 'local') a['trust-proxy'] = true; // only the local proxy can reach 127.0.0.1
  if (configPath && path.resolve(configPath) !== path.resolve(defaultConfig)) a.config = configPath;
  return a;
}

export function argsToArgv(a) {
  const argv = [];
  for (const [k, v] of Object.entries(a)) {
    if (v === undefined || v === false) continue;
    argv.push(`--${k}`);
    if (v !== true) argv.push(String(v));
  }
  return argv;
}

// ─── health check ───

async function fetchWithTimeout(fetchImpl, url, init = {}, timeoutMs = 10_000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function rpc(fetchImpl, url, key, method, params, id, timeoutMs) {
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'mcp-protocol-version': '2025-03-26',
  };
  if (key) headers.authorization = `Bearer ${key}`;
  const res = await fetchWithTimeout(
    fetchImpl,
    url,
    { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) },
    timeoutMs,
  );
  const text = await res.text();
  let body = null;
  const json = text.trim().startsWith('{') ? text : (text.match(/^data: (.*)$/m) || [])[1];
  body = safe(() => JSON.parse(json), null);
  return { status: res.status, body };
}

/**
 * Wait until a public hostname exists in DNS — asking the resolver directly (dns.resolve4),
 * NOT the OS cache. A brand-new trycloudflare.com name does not resolve for a few seconds, and on
 * macOS (mDNSResponder) one early lookup of a missing name is cached as "not found" for minutes, so
 * probing it with fetch() too soon makes the URL look dead on that Mac. Best effort: never throws.
 */
export async function waitForDns(host, { timeoutMs = 30_000, resolver = dns.resolve4 } = {}) {
  if (!host || isIP(host) || host === 'localhost') return true;
  const until = Date.now() + timeoutMs;
  for (;;) {
    try {
      if ((await resolver(host)).length) return true;
    } catch {
      /* not there yet */
    }
    if (Date.now() >= until) return false;
    await sleep(1000);
  }
}

/**
 * Probe an endpoint: /health (public), auth is enforced (401 without key), and —
 * when a key is available — a real MCP initialize + tools/list handshake.
 */
export async function checkEndpoint(
  url,
  { key = null, fetchImpl = globalThis.fetch, timeoutMs = 10_000, retries = 0 } = {},
) {
  const out = { url, reachable: false, health: null, authEnforced: null, handshake: null, error: null };
  const base = url.replace(/\/mcp\/?(\?.*)?$/, '');
  if (retries > 0 && fetchImpl === globalThis.fetch) await waitForDns(safe(() => new URL(url).hostname, ''));
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(fetchImpl, `${base}/health`, {}, timeoutMs);
      if (res.ok) {
        out.health = await res.json();
        out.reachable = true;
        out.error = null;
        break;
      }
      out.error = `/health returned HTTP ${res.status}`;
    } catch (err) {
      out.error = err.name === 'AbortError' ? `timed out after ${timeoutMs / 1000}s` : err.cause?.code || err.message;
    }
    if (attempt < retries) await new Promise((r) => setTimeout(r, 2000));
  }
  if (!out.reachable) return out;
  try {
    const anon = await rpc(fetchImpl, url, null, 'initialize', initParams(), 1, timeoutMs);
    out.authEnforced = anon.status === 401;
    if (key) {
      const init = await rpc(fetchImpl, url, key, 'initialize', initParams(), 1, timeoutMs);
      if (init.status !== 200 || !init.body?.result) {
        out.handshake = { ok: false, status: init.status, error: init.body?.error?.message || `HTTP ${init.status}` };
      } else {
        const tools = await rpc(fetchImpl, url, key, 'tools/list', {}, 2, timeoutMs);
        out.handshake = {
          ok: true,
          server: init.body.result.serverInfo?.name,
          version: init.body.result.serverInfo?.version,
          tools: (tools.body?.result?.tools || []).map((t) => t.name),
        };
      }
    }
  } catch (err) {
    out.error = err.message;
  }
  return out;
}

function initParams() {
  return { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'rune-serve-doctor', version: '1' } };
}

// ─── connect instructions (never contain the key) ───

/**
 * @returns {{ id: string, name: string, needsPublic: boolean, text: string }}
 */
export function connectInstructions(client, url, { platform = process.platform } = {}) {
  const win = platform === 'win32';
  const k = win ? KEY_PLACEHOLDER_PS : KEY_PLACEHOLDER;
  const map = {
    'grok-bot': {
      name: 'Grok Bot',
      needsPublic: true,
      text: [
        'Say this to Grok Bot (in any chat, phone included):',
        `  "Add an MCP connector named rune: URL ${url}, header Authorization: Bearer <my rune key>.`,
        '   Ask me for the key with a secure form."',
        'Paste the key ONLY into the secure form Grok Bot opens — never into the chat.',
      ].join('\n'),
    },
    claude: {
      name: 'Claude Code',
      needsPublic: false,
      text: `claude mcp add --transport http --scope user rune ${url} --header "Authorization: Bearer ${k}"\nclaude mcp list    # rune: ✓ Connected`,
    },
    grok: {
      name: 'Grok Build',
      needsPublic: false,
      text: `grok mcp add rune ${url} -H "Authorization: Bearer ${k}"\ngrok mcp doctor rune    # ✓ handshake OK`,
    },
    codex: {
      name: 'OpenAI Codex',
      needsPublic: false,
      text: `codex mcp add rune --url ${url} --bearer-token-env-var RUNE_KEY\n${
        win
          ? '# run once: setx RUNE_KEY "rune_sk_…"  then open a new terminal — Codex reads it at start'
          : '# keep "export RUNE_KEY=…" in your shell profile — Codex reads it at start'
      }`,
    },
    cursor: {
      name: 'Cursor',
      needsPublic: false,
      text: `# ${win ? '%USERPROFILE%\\.cursor\\mcp.json  (setx RUNE_KEY "rune_sk_…", then restart Cursor)' : '~/.cursor/mcp.json  (RUNE_KEY must be set in the environment Cursor starts from)'}\n${JSON.stringify(
        { mcpServers: { rune: { url, headers: { Authorization: CURSOR_KEY_REF } } } },
        null,
        2,
      )}`,
    },
    gemini: {
      name: 'Gemini CLI',
      needsPublic: false,
      text: `gemini mcp add --transport http --scope user rune ${url} -H "Authorization: Bearer ${k}"`,
    },
    antigravity: {
      name: 'Antigravity',
      needsPublic: false,
      text: `Settings → MCP servers → add remote server\n  URL:    ${url}\n  Header: Authorization: Bearer <your rune key>`,
    },
  };
  const c = map[client];
  if (!c) throw new Error(`Unknown client "${client}". One of: ${CLIENTS.join(', ')}`);
  return { id: client, ...c };
}

export function isPublicUrl(url) {
  return /^https:\/\//.test(url || '') && !/\/\/(127\.|localhost|\[::1\])/.test(url);
}

export function formatConnect(url, clients = CLIENTS, { platform = process.platform } = {}) {
  const lines = [
    'Your key is the rune_sk_… value from setup (password manager). Lost it? `rune serve key rotate`',
    `then update each client. ${keyEnvHint(platform)}`,
    '',
  ];
  for (const id of clients) {
    const c = connectInstructions(id, url, { platform });
    lines.push(`── ${c.name} ${'─'.repeat(Math.max(2, 50 - c.name.length))}`);
    if (c.needsPublic && !isPublicUrl(url)) {
      lines.push(`  ⚠ ${c.name} runs in the cloud and cannot reach ${url}.`);
      lines.push('    Re-run: rune serve setup --expose tunnel   (or --expose domain / tailscale)');
    } else {
      lines.push(...c.text.split('\n').map((l) => `  ${l}`));
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ─── running the server in the background / as a service ───

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Wait until the server (pid, or any pid when null) has written a ready state. */
export async function waitForState(configPath, { pid = null, timeoutMs = 60_000, isRunning = () => true } = {}) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const s = readState(configPath);
    if (s?.ready && (pid === null || s.pid === pid) && isAlive(s.pid)) return s;
    if (!isRunning()) return null;
    await sleep(250);
  }
  return null;
}

function tailFile(file, n = 8) {
  return safe(() => readFileSync(file, 'utf-8').trim().split('\n').slice(-n).join('\n'), '');
}

export function logPathFor(configPath) {
  return path.join(path.dirname(configPath), 'serve.log');
}

/** Spawn `rune serve …` detached, logging to ~/.rune/serve.log. */
export async function startBackground({ runeBin, serveArgs, configPath, timeoutMs = 75_000, env = process.env }) {
  const logFile = logPathFor(configPath);
  mkdirSync(path.dirname(logFile), { recursive: true, mode: 0o700 });
  const fd = openSync(logFile, 'a', 0o600);
  const child = spawn(process.execPath, [runeBin, 'serve', ...argsToArgv(serveArgs)], {
    detached: true,
    stdio: ['ignore', fd, fd],
    env,
    windowsHide: true,
  });
  let exited = false;
  child.on('exit', () => {
    exited = true;
  });
  child.unref();
  const state = await waitForState(configPath, { pid: child.pid, timeoutMs, isRunning: () => !exited });
  if (!state) {
    if (!exited) safe(() => process.kill(child.pid, 'SIGTERM'));
    throw new Error(`rune serve did not come up. Last log lines (${logFile}):\n${tailFile(logFile)}`);
  }
  return { mode: 'background', pid: child.pid, log: logFile, state };
}

function systemctl(args, run = spawnSync) {
  const r = run('systemctl', ['--user', ...args], { encoding: 'utf-8', timeout: 30_000 });
  return { ok: r.status === 0, out: String(r.stderr || r.stdout || '').trim() };
}

export async function startSystemd({ runeBin, serveArgs, configPath, timeoutMs = 75_000, run = spawnSync }) {
  const res = installService({ nodePath: process.execPath, runeBin, args: serveArgs });
  const steps = [
    systemctl(['daemon-reload'], run),
    systemctl(['enable', 'rune-serve'], run),
    systemctl(['restart', 'rune-serve'], run),
  ];
  const failed = steps.find((s) => !s.ok);
  if (failed) throw new Error(`systemctl --user failed: ${failed.out}`);
  const linger = run('loginctl', ['enable-linger', os.userInfo().username], { encoding: 'utf-8', timeout: 15_000 });
  const state = await waitForState(configPath, { timeoutMs });
  if (!state) throw new Error('rune-serve.service started but never reported ready — journalctl --user -u rune-serve');
  return { mode: 'systemd-user', unitPath: res.unitPath, linger: linger.status === 0, pid: state.pid, state };
}

/** Stop whatever this config's server is: the systemd unit and/or the background pid. */
export async function stopServer(configPath, { run = spawnSync } = {}) {
  const stopped = [];
  const unit = path.join(os.homedir(), '.config', 'systemd', 'user', 'rune-serve.service');
  if (process.platform === 'linux' && existsSync(unit)) {
    const r = systemctl(['stop', 'rune-serve'], run);
    if (r.ok) stopped.push('systemd');
  }
  const s = readState(configPath);
  if (s && isAlive(s.pid)) {
    safe(() => process.kill(s.pid, 'SIGTERM'));
    for (let i = 0; i < 40 && isAlive(s.pid); i++) await sleep(125);
    stopped.push(`pid ${s.pid}`);
  }
  rmSync(statePathFor(configPath), { force: true });
  return stopped;
}

// ─── prompts ───

async function ask(rl, question, def) {
  const a = (await rl.question(`  ${question}${def !== undefined && def !== '' ? ` [${def}]` : ''}: `)).trim();
  return a === '' ? def : a;
}

async function choose(rl, question, options, def) {
  process.stderr.write(`\n  ${question}\n`);
  options.forEach((o, i) => {
    process.stderr.write(`    ${i + 1}) ${o.label}${o.value === def ? '  (default)' : ''}\n`);
  });
  for (;;) {
    const a = await ask(rl, 'Choose', String(options.findIndex((o) => o.value === def) + 1));
    const n = Number.parseInt(a, 10);
    if (n >= 1 && n <= options.length) return options[n - 1].value;
    const byName = options.find((o) => o.value === a);
    if (byName) return byName.value;
  }
}

async function confirm(rl, question, def = true) {
  const a = String(await ask(rl, `${question} (${def ? 'Y/n' : 'y/N'})`, '')).toLowerCase();
  return a === '' ? def : a.startsWith('y');
}

// ─── the wizard ───

function tierRoot(detected) {
  return detected?.path ? path.dirname(path.dirname(detected.path)) : null;
}

/**
 * Build the setup profile from flags (+ answers when interactive).
 */
export async function resolveProfile({ args, envInfo, projectRoot, previous = {}, rl = null, detect = detectTiers }) {
  const tiers = args['no-tiers'] ? { pro: null, business: null } : safe(() => detect(projectRoot), {});
  const p = {
    port: Number.parseInt(args.port ?? previous.port ?? 8787, 10),
    host: typeof args.host === 'string' ? args.host : previous.host || '127.0.0.1',
    noTiers: Boolean(args['no-tiers']),
    proRoot: typeof args['pro-root'] === 'string' ? path.resolve(args['pro-root']) : tierRoot(tiers?.pro),
    businessRoot:
      typeof args['business-root'] === 'string' ? path.resolve(args['business-root']) : tierRoot(tiers?.business),
    skillsDir: typeof args['skills-dir'] === 'string' ? args['skills-dir'] : previous.skillsDir || null,
    expose: typeof args.expose === 'string' ? args.expose : null,
    domain: typeof args.domain === 'string' ? args.domain : previous.domain || null,
    service: args.service === true ? true : args['no-service'] ? false : null,
    start: !args['no-start'],
  };
  if (!Number.isInteger(p.port) || p.port < 1 || p.port > 65535) throw new Error(`Invalid --port ${args.port}`);
  if (args.tailscale === true && !p.expose) p.expose = 'tailscale';
  if (args.tunnel === true && !p.expose) p.expose = 'tunnel';

  if (rl) {
    if (!p.noTiers) {
      for (const tier of ['pro', 'business']) {
        const key = `${tier}Root`;
        const label = tier === 'pro' ? 'Rune Pro' : 'Rune Business';
        if (p[key]) {
          if (!(await confirm(rl, `Serve ${label} from ${p[key]}?`, true))) p[key] = null;
        } else {
          const ans = await ask(rl, `${label} folder (git clone of rune-${tier}; Enter to skip)`, '');
          if (ans) p[key] = path.resolve(ans.replace(/^~(?=$|[\\/])/, os.homedir()));
        }
      }
    }
    if (!p.expose) {
      const opts = [
        {
          value: 'tunnel',
          label: 'Cloudflare quick tunnel — public HTTPS in 10 s, no domain (URL changes on restart)',
        },
        { value: 'local', label: 'Local only — agents on THIS machine (http://127.0.0.1)' },
        { value: 'domain', label: 'My own domain — I run Caddy/nginx (prints a Caddyfile)' },
      ];
      if (envInfo.tailscale) opts.push({ value: 'tailscale', label: 'Tailscale Funnel — https://<machine>.ts.net' });
      p.expose = await choose(
        rl,
        'How should agents reach it? (Grok Bot needs public HTTPS)',
        opts,
        envInfo.kind === 'vps' ? 'tunnel' : 'local',
      );
    }
    if (p.expose === 'domain' && !p.domain) p.domain = await ask(rl, 'Domain (e.g. rune.example.com)', '');
    if (p.service === null && envInfo.systemdUser && p.start)
      p.service = await confirm(rl, 'Install as a systemd user service (survives reboots)?', envInfo.kind === 'vps');
  }

  if (!p.expose) p.expose = previous.expose || (envInfo.kind === 'vps' ? 'tunnel' : 'local');
  if (!EXPOSE_MODES.includes(p.expose)) throw new Error(`--expose must be one of ${EXPOSE_MODES.join(', ')}`);
  if (p.expose === 'domain' && !p.domain) throw new Error('--expose domain needs --domain <host>');
  if (p.expose === 'tailscale' && !envInfo.tailscale) throw new Error('--expose tailscale: `tailscale` is not on PATH');
  if (p.domain) p.domain = p.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (p.service === null) p.service = envInfo.systemdUser && envInfo.kind === 'vps' && !envInfo.npx;
  if (p.service && !envInfo.systemdUser) p.service = false;
  return p;
}

/**
 * Run the whole setup. Returns a JSON-able report; `report.key.value` is set
 * only when a key was minted now and not written to --key-out.
 */
export async function runSetup({
  runeRoot,
  projectRoot = process.cwd(),
  args = {},
  log = () => {},
  rl = null,
  deps = {},
  printKey = true,
}) {
  const configPath = typeof args.config === 'string' ? path.resolve(args.config) : defaultConfigPath();
  const runeBin = path.join(runeRoot, 'compiler', 'bin', 'rune.js');
  const envInfo = deps.envInfo || detectEnvironment({ runeRoot });
  const previous = readServeConfig(configPath)?.setup || {};
  const report = { ok: false, configPath, environment: envInfo, warnings: [], next: [] };

  log(
    `Environment: ${envInfo.kind === 'vps' ? 'server / headless (VPS)' : 'desktop'} · ${envInfo.platform}/${envInfo.arch}`,
  );
  const profile = await resolveProfile({ args, envInfo, projectRoot, previous, rl, detect: deps.detect });
  report.profile = profile;
  if (envInfo.npx && profile.service)
    report.warnings.push('Running from the npx cache — install globally (npm i -g @rune-kit/rune) for a service.');
  log(`Tiers: Pro ${profile.proRoot || '—'} · Business ${profile.businessRoot || '—'}`);

  // Key
  let keyInfo;
  if (args['rotate-key']) {
    const { key } = rotateKey(configPath);
    keyInfo = { created: true, key, source: 'rotated' };
  } else {
    keyInfo = ensureKey(configPath);
  }
  const cfg = readServeConfig(configPath) || {};
  report.key = { created: keyInfo.created, source: keyInfo.source, hint: cfg.keyHint || null, hashFile: configPath };
  if (keyInfo.created) {
    if (typeof args['key-out'] === 'string') {
      report.key.file = writeKeyFile(args['key-out'], keyInfo.key);
    } else if (!printKey) {
      // stdout is not a terminal (agent, CI, log capture): never print the raw key.
      report.key.file = writeKeyFile(defaultKeyOutPath(configPath), keyInfo.key);
      report.key.fileReason = 'stdout is not a terminal';
    } else {
      report.key.value = keyInfo.key;
    }
  }
  writeServeConfig({ ...cfg, setup: { ...profile, updatedAt: new Date().toISOString() } }, configPath);

  // Exposure prerequisites
  const exposure = { mode: profile.expose, localUrl: `http://127.0.0.1:${profile.port}/mcp`, publicUrl: null };
  report.exposure = exposure;
  if (profile.expose === 'tunnel') {
    const cf = await (deps.ensureCloudflared || ensureCloudflared)({ allowDownload: !args['no-download'], log });
    exposure.cloudflared = cf.path;
    exposure.cloudflaredDownloaded = cf.downloaded;
  }
  if (profile.expose === 'domain') {
    exposure.publicUrl = `https://${profile.domain}/mcp`;
    exposure.caddyfile = caddySnippet(profile.domain, profile.port);
    report.next.push(
      `Point DNS for ${profile.domain} at this server, add the Caddyfile block (/etc/caddy/Caddyfile) and run: sudo systemctl reload caddy`,
    );
  }

  // Start
  const serveArgs = serveArgsFromProfile(profile, { configPath });
  report.serveCommand = `rune serve ${argsToArgv(serveArgs).join(' ')}`;
  if (profile.start) {
    await (deps.stopServer || stopServer)(configPath);
    const starter = profile.service ? deps.startSystemd || startSystemd : deps.startBackground || startBackground;
    log(profile.service ? 'Starting systemd user service rune-serve…' : 'Starting rune serve in the background…');
    const started = await starter({ runeBin, serveArgs, configPath });
    report.service = {
      mode: started.mode,
      pid: started.pid,
      unitPath: started.unitPath,
      log: started.log,
      linger: started.linger,
    };
    if (started.mode === 'systemd-user' && !started.linger)
      report.next.push(`sudo loginctl enable-linger ${os.userInfo().username}   # keep it running after you log out`);
    if (started.state?.publicUrl) exposure.publicUrl = started.state.publicUrl;
    if (profile.expose === 'tunnel' && !started.state?.publicUrl)
      report.warnings.push(`Tunnel did not come up: ${started.state?.tunnelError || 'unknown error'} — see the log`);
    if (profile.expose === 'tunnel')
      report.warnings.push(
        'Quick-tunnel URLs change when the server restarts. After a restart run `rune serve connect grok-bot` and update the connector — or use --expose domain for a fixed URL.',
      );
    if (profile.expose === 'tailscale') {
      try {
        exposure.publicUrl = `${(deps.startTailscaleFunnel || startTailscaleFunnel)({ port: profile.port, bin: envInfo.tailscale })}/mcp`;
      } catch (err) {
        report.warnings.push(err.message);
      }
    }
    if (!profile.service && envInfo.platform === 'linux' && !envInfo.systemdUser)
      report.next.push('No systemd user session: after a reboot run `rune serve start` (or add it to cron @reboot).');
    if (!profile.service && envInfo.platform !== 'linux')
      report.next.push(
        envInfo.platform === 'win32'
          ? 'To start at login: Task Scheduler → Create Task → At log on → Action: rune serve start'
          : 'To start at login: add `rune serve start` to a LaunchAgent (or run it after each reboot).',
      );

    // Health
    log('Checking the endpoint (MCP initialize handshake)…');
    const check = deps.checkEndpoint || checkEndpoint;
    report.health = { local: await check(exposure.localUrl, { key: keyInfo.key || process.env.RUNE_KEY || null }) };
    if (exposure.publicUrl)
      report.health.public = await check(exposure.publicUrl, {
        key: keyInfo.key || process.env.RUNE_KEY || null,
        retries: profile.expose === 'domain' ? 0 : 5,
      });
    if (!report.health.local.reachable)
      report.warnings.push(`Local endpoint unreachable: ${report.health.local.error}`);
    if (report.health.public && !report.health.public.reachable)
      report.warnings.push(
        `Public URL not reachable yet (${report.health.public.error}). Run \`rune serve doctor\` later.`,
      );
  } else {
    report.next.push(`Start it: ${report.serveCommand}   (or: rune serve start)`);
  }

  const url = exposure.publicUrl || exposure.localUrl;
  report.connectUrl = url;
  report.connect = Object.fromEntries(CLIENTS.map((c) => [c, connectInstructions(c, url)]));
  report.ok = !profile.start || Boolean(report.health?.local?.reachable);
  return report;
}

// ─── status / doctor ───

export async function serveStatus({ configPath, deep = false, deps = {} }) {
  const cfg = readServeConfig(configPath);
  const state = readState(configPath);
  const running = Boolean(state && isAlive(state.pid));
  const unitPath = path.join(os.homedir(), '.config', 'systemd', 'user', 'rune-serve.service');
  const st = {
    configured: Boolean(cfg?.keyHash) || Boolean(process.env.RUNE_SERVE_KEY),
    configPath,
    keyHint: cfg?.keyHint || (process.env.RUNE_SERVE_KEY ? '$RUNE_SERVE_KEY' : null),
    profile: cfg?.setup || null,
    running,
    pid: running ? state.pid : null,
    startedAt: running ? state.startedAt : null,
    version: running ? state.version : null,
    skills: running ? state.skills : null,
    localUrl: running ? state.url : null,
    publicUrl: running ? state.publicUrl || null : null,
    tunnelError: running ? state.tunnelError || null : null,
    service: existsSync(unitPath) ? unitPath : null,
    problems: [],
    hints: [],
  };
  if (!st.publicUrl && st.profile?.expose === 'domain' && st.profile.domain)
    st.publicUrl = `https://${st.profile.domain}/mcp`;
  if (!st.configured) st.problems.push('Not set up yet — run: rune serve setup');
  else if (!running) st.problems.push('Server is not running — run: rune serve start');
  if (running && st.profile?.expose === 'tunnel' && !st.publicUrl)
    st.problems.push(`Tunnel is down: ${st.tunnelError || 'no public URL'} — run: rune serve start`);
  if (deep && running) {
    const check = deps.checkEndpoint || checkEndpoint;
    const key = process.env.RUNE_KEY || process.env.RUNE_SERVE_KEY || null;
    st.health = { local: await check(st.localUrl, { key }) };
    if (st.publicUrl) st.health.public = await check(st.publicUrl, { key });
    for (const [where, h] of Object.entries(st.health)) {
      if (!h.reachable) st.problems.push(`${where} endpoint unreachable (${h.url}): ${h.error}`);
      else if (h.authEnforced === false) st.problems.push(`${where} endpoint answered without a key — check the proxy`);
      else if (h.handshake && !h.handshake.ok) st.problems.push(`${where} handshake failed: ${h.handshake.error}`);
    }
    if (!key)
      st.hints.push(
        `Set RUNE_KEY before \`rune serve doctor\` to also test a full MCP handshake (${
          process.platform === 'win32' ? '$env:RUNE_KEY = "rune_sk_…"' : 'export RUNE_KEY=rune_sk_…'
        }).`,
      );
  }
  return st;
}

function printStatus(st, out, { doctor }) {
  const ok = (b) => (b ? '✓' : '✗');
  out('');
  out(`  ${ok(st.configured)} key        ${st.keyHint || '—'}  (hash in ${st.configPath})`);
  out(
    `  ${ok(st.running)} server     ${st.running ? `pid ${st.pid} · v${st.version} · ${st.skills} skills · since ${st.startedAt}` : 'not running'}`,
  );
  if (st.localUrl) out(`    local      ${st.localUrl}`);
  if (st.publicUrl) out(`    public     ${st.publicUrl}`);
  if (st.profile) out(`    exposure   ${st.profile.expose}${st.service ? ' · systemd user service' : ''}`);
  if (st.health) {
    for (const [where, h] of Object.entries(st.health)) {
      const hs = h.handshake
        ? h.handshake.ok
          ? `handshake ✓ (${h.handshake.tools.length} tools)`
          : `handshake ✗ ${h.handshake.error}`
        : 'handshake skipped (no RUNE_KEY)';
      out(
        `  ${ok(h.reachable && h.authEnforced !== false)} ${where.padEnd(10)} ${h.reachable ? `health ✓ · auth ${h.authEnforced ? '✓ enforced' : '✗ NOT enforced'} · ${hs}` : `✗ ${h.error}`}`,
      );
    }
  }
  for (const p of st.problems) out(`  ✗ ${p}`);
  if (doctor) for (const h of st.hints) out(`  · ${h}`);
  if (!st.problems.length && st.running)
    out('  Connect a client: rune serve connect <client>   (grok-bot, claude, grok, codex, cursor, …)');
  out('');
}

// ─── CLI ───

export const NON_TTY_SETUP_MESSAGE = [
  '✗ rune serve setup asks questions, but this shell is not an interactive terminal',
  '  (an agent, CI job, ssh without -t, or a pipe). Nothing was changed.',
  '  Re-run with --yes to accept the defaults, e.g.:',
  '    rune serve setup --yes --expose tunnel      (or local | domain --domain <host> | tailscale)',
  '  Without a terminal the new key is written to a 0600 file (default ~/.rune/serve.key,',
  '  or --key-out <file>) and only its path is printed — never the key itself.',
].join('\n');

export async function cmdServeSetup({
  sub,
  runeRoot,
  projectRoot,
  args,
  positional,
  configPath,
  tty = { stdin: Boolean(process.stdin.isTTY), stdout: Boolean(process.stdout.isTTY) },
  platform = process.platform,
}) {
  const json = Boolean(args.json);
  const write = (s) => process.stdout.write(s);
  const out = (l) => (json ? process.stderr : process.stdout).write(`${l}\n`);

  if (sub === 'status' || sub === 'doctor') {
    const st = await serveStatus({ configPath, deep: sub === 'doctor' });
    if (json) write(`${JSON.stringify(st, null, 2)}\n`);
    else printStatus(st, out, { doctor: sub === 'doctor' });
    if (sub === 'doctor' && st.problems.length) process.exitCode = 1;
    return;
  }

  if (sub === 'connect') {
    const client = positional[2] || 'all';
    const st = await serveStatus({ configPath });
    const url = typeof args.url === 'string' ? args.url : st.publicUrl || st.localUrl;
    if (!url) {
      out('  ✗ No URL known — the server is not running. Run `rune serve start` (or pass --url).');
      process.exitCode = 1;
      return;
    }
    const clients = client === 'all' ? CLIENTS : [client];
    if (!clients.every((c) => CLIENTS.includes(c))) {
      out(`  ✗ Unknown client "${client}". One of: all, ${CLIENTS.join(', ')}`);
      process.exitCode = 1;
      return;
    }
    if (json)
      write(
        `${JSON.stringify({ url, clients: clients.map((c) => connectInstructions(c, url, { platform })) }, null, 2)}\n`,
      );
    else out(`\n  Rune MCP URL: ${url}\n\n${formatConnect(url, clients, { platform }).replace(/^(?=.)/gm, '  ')}`);
    return;
  }

  if (sub === 'stop') {
    const stopped = await stopServer(configPath);
    if (json) write(`${JSON.stringify({ stopped }, null, 2)}\n`);
    else out(stopped.length ? `  ✓ Stopped (${stopped.join(', ')})` : '  Nothing was running.');
    return;
  }

  if (sub === 'start') {
    const cfg = readServeConfig(configPath);
    if (!cfg?.setup) {
      out('  ✗ Not set up yet — run: rune serve setup');
      process.exitCode = 1;
      return;
    }
    // `start` = re-run setup with the saved profile, no questions, key untouched.
    args = { ...args, yes: true, expose: cfg.setup.expose, domain: cfg.setup.domain ?? undefined };
    if (cfg.setup.proRoot) args['pro-root'] ??= cfg.setup.proRoot;
    if (cfg.setup.businessRoot) args['business-root'] ??= cfg.setup.businessRoot;
    if (cfg.setup.noTiers) args['no-tiers'] = true;
    if (cfg.setup.service === true) args.service = true;
    else args['no-service'] = true;
  }

  // Non-interactive shells must opt in to the defaults: setup starts a server, may download
  // cloudflared and mints a key, so it never runs "by accident" (e.g. a flag it did not know).
  if (sub === 'setup' && !args.yes && !(tty.stdin && tty.stdout)) {
    if (json) write(`${JSON.stringify({ ok: false, error: 'non-interactive: pass --yes' }, null, 2)}\n`);
    process.stderr.write(`${NON_TTY_SETUP_MESSAGE}\n`);
    process.exitCode = 2;
    return;
  }
  const interactive = !args.yes && !json && sub !== 'start' && tty.stdin && tty.stdout;
  const rl = interactive ? createInterface({ input: process.stdin, output: process.stderr }) : null;
  if (interactive) out('\n  Rune serve setup — Enter accepts the [default]. Ctrl+C to quit.');
  let report;
  try {
    report = await runSetup({ runeRoot, projectRoot, args, rl, printKey: tty.stdout, log: (l) => out(`  · ${l}`) });
  } catch (err) {
    if (json) write(`${JSON.stringify({ ok: false, error: err.message }, null, 2)}\n`);
    else out(`  ✗ ${err.message}`);
    process.exitCode = 1;
    return;
  } finally {
    rl?.close();
  }
  if (json) {
    write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    printReport(report, out, { platform });
  }
  if (!report.ok) process.exitCode = 1;
}

function printReport(r, out, { platform = process.platform } = {}) {
  const e = r.exposure;
  out('');
  out(
    `  ${r.ok ? '✓' : '✗'} Rune serve is ${r.service ? `running (${r.service.mode}, pid ${r.service.pid})` : 'configured'}`,
  );
  out(`    local   ${e.localUrl}`);
  if (e.publicUrl) out(`    public  ${e.publicUrl}`);
  const h = r.health?.public || r.health?.local;
  if (h?.handshake?.ok) out(`    ✓ MCP handshake OK — ${h.handshake.tools.length} tools, ${h.health?.skills} skills`);
  else if (h?.reachable)
    out(`    ✓ /health OK — ${h.health?.skills} skills · auth ${h.authEnforced ? 'enforced' : 'NOT enforced'}`);
  if (r.key.value) {
    out('');
    out('  ┌─ Your server key — shown ONCE. Save it in your password manager now. ─┐');
    out(`    ${r.key.value}`);
    out('  └────────────────────────────────────────────────────────────────────────┘');
  } else if (r.key.file) {
    if (r.key.fileReason) out(`\n  ${r.key.fileReason}, so the new key is NOT printed.`);
    out(`\n  New key written to ${r.key.file} (0600). Move it to your password manager, then delete the file.`);
  } else {
    out(`\n  Key: unchanged (${r.key.hint || 'stored'}). Lost it? rune serve key rotate`);
  }
  if (e.caddyfile) out(`\n  Caddyfile:\n${e.caddyfile.replace(/^(?=.)/gm, '    ')}`);
  for (const w of r.warnings) out(`\n  ⚠ ${w}`);
  out('\n  Connect your agents:\n');
  out(formatConnect(r.connectUrl, CLIENTS, { platform }).replace(/^(?=.)/gm, '  '));
  if (r.next.length) {
    out('  Next:');
    for (const n of r.next) out(`    ${n}`);
    out('');
  }
  out('  Later: rune serve status · rune serve doctor · rune serve connect <client> · rune serve stop');
  out('');
}
