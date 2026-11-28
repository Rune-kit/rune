#!/usr/bin/env node
/**
 * End-to-end test of `rune serve`, the way a user runs it — on a throw-away
 * machine (GitHub Actions runner) or on your own PC. No VPS needed.
 *
 *   node scripts/e2e-serve.mjs [--expose local|tunnel] [--service] [--port 18787] [--keep] [--json]
 *
 *   local   (default)  background process on 127.0.0.1
 *   tunnel             Cloudflare quick tunnel; every MCP check runs through the PUBLIC https URL
 *   --service          also run it as a systemd *user* service (Linux): restart-on-crash, stop/start.
 *                      Uses the real $HOME (systemd only reads ~/.config/systemd/user), so it refuses
 *                      to run outside CI when ~/.rune/serve.json already exists. Set RUNE_E2E_FORCE=1
 *                      to override.
 *
 * What it does: `npm pack` → install the tarball into a temp prefix (so the PUBLISHED shape is
 * tested) → `rune serve setup --yes --json` → real MCP client (the official SDK) over HTTP →
 * auth failures → `key rotate` → `stop` / `start` → `doctor` / `status` / `connect` → cleanup.
 * The key is only ever kept in files / memory and scrubbed from every line this script prints.
 *
 * Exit code 0 = every check passed. Pass --json for a machine-readable summary on stdout.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};

const EXPOSE = opt('expose', 'local');
const SERVICE = flag('service');
const PORT = Number.parseInt(opt('port', '18787'), 10);
const KEEP = flag('keep');
const JSON_OUT = flag('json');
const IS_WIN = process.platform === 'win32';
const IS_CI = Boolean(process.env.CI);

if (!['local', 'tunnel'].includes(EXPOSE)) {
  console.error(`--expose must be local or tunnel (got ${EXPOSE}). domain/tailscale need real infrastructure.`);
  process.exit(2);
}
if (SERVICE && process.platform !== 'linux') {
  console.error('--service needs Linux + systemd --user');
  process.exit(2);
}

// ─── reporting (secrets are scrubbed from everything printed) ───

const secrets = new Set();
const scrub = (s) => {
  let out = String(s);
  for (const k of secrets) out = out.split(k).join('rune_sk_«redacted»');
  return out.replace(/rune_sk_[A-Za-z0-9_-]{20,}/g, 'rune_sk_«redacted»');
};
const results = [];
const log = (...a) => (JSON_OUT ? console.error : console.log)(scrub(a.join(' ')));

async function check(name, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ name, pass: true, detail: detail ? scrub(detail) : '', ms: Date.now() - t0 });
    log(`  ✓ ${name}${detail ? `  — ${detail}` : ''}`);
    return true;
  } catch (err) {
    results.push({ name, pass: false, detail: scrub(err.message), ms: Date.now() - t0 });
    log(`  ✗ ${name}\n      ${scrub(err.message).split('\n').join('\n      ')}`);
    return false;
  }
}
const section = (t) => log(`\n${t}`);
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(fn, { timeoutMs = 30_000, everyMs = 1000, what = 'condition' } = {}) {
  const end = Date.now() + timeoutMs;
  let last;
  for (;;) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (err) {
      last = err;
    }
    if (Date.now() > end)
      throw new Error(`timed out after ${timeoutMs / 1000}s waiting for ${what}${last ? ` (${last.message})` : ''}`);
    await sleep(everyMs);
  }
}

// ─── sandbox + install ───

const tmp = mkdtempSync(path.join(os.tmpdir(), 'rune-e2e-'));
const realHome = os.homedir();
const HOME = SERVICE ? realHome : path.join(tmp, 'home');
mkdirSync(HOME, { recursive: true });
const env = { ...process.env, HOME, USERPROFILE: HOME, NO_COLOR: '1' };
delete env.RUNE_SERVE_KEY;
delete env.RUNE_SERVE_CONFIG;
const configPath = path.join(HOME, '.rune', 'serve.json');

if (SERVICE && existsSync(configPath) && !IS_CI && !process.env.RUNE_E2E_FORCE) {
  console.error(`Refusing: ${configPath} exists and --service uses your real home. Set RUNE_E2E_FORCE=1 to override.`);
  process.exit(2);
}

function run(args, { input, timeoutMs = 120_000, cwd } = {}) {
  const r = spawnSync(process.execPath, [runeBin, ...args], { env, encoding: 'utf-8', timeout: timeoutMs, input, cwd });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}
const sh = (cmd, args, o = {}) => spawnSync(cmd, args, { env, encoding: 'utf-8', timeout: 60_000, ...o });
const npm = IS_WIN ? 'npm.cmd' : 'npm';

let runeBin = '';
const keyFile = path.join(tmp, 'key1.txt');
let key = '';
let mcpUrl = '';
let baseUrl = '';
let sdk = null;

function readKey(file) {
  const k = readFileSync(file, 'utf-8').trim();
  assert(/^rune_sk_[A-Za-z0-9_-]{20,}$/.test(k), `key file ${file} does not hold a rune_sk_ key`);
  secrets.add(k);
  return k;
}

const modeBits = (f) => statSync(f).mode & 0o777;

// ─── MCP / HTTP helpers ───

async function http(method, url, { headers = {}, body } = {}) {
  let res;
  try {
    res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(20_000) });
  } catch (err) {
    throw new Error(
      `${method} ${url.replace(/\?.*/, '')}: ${err.message}${err.cause ? ` (${err.cause.code || err.cause.message})` : ''}`,
    );
  }
  const text = await res.text();
  return { status: res.status, text, headers: res.headers };
}
const initBody = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'rune-e2e', version: '1' } },
});
const mcpHeaders = (k) => ({
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
  ...(k ? { authorization: `Bearer ${k}` } : {}),
});

async function withClient(k, url, fn) {
  const client = new sdk.Client({ name: 'rune-e2e', version: '1' });
  const transport = new sdk.Transport(new URL(url), { requestInit: { headers: { authorization: `Bearer ${k}` } } });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}
const text = (r) => (r.content || []).map((c) => c.text || '').join('\n');

async function mcpSuite(k, url, label) {
  await check(`${label}: real MCP client handshake + 4 tools`, () =>
    withClient(k, url, async (c) => {
      const { tools } = await c.listTools();
      const names = tools.map((t) => t.name).sort();
      assert(
        ['get_reference', 'get_skill', 'list_skills', 'run_skill'].every((n) => names.includes(n)),
        `tools: ${names}`,
      );
      return `tools: ${names.join(', ')}`;
    }),
  );
  await check(`${label}: list_skills (compact) and detail:"full"`, () =>
    withClient(k, url, async (c) => {
      const compact = text(await c.callTool({ name: 'list_skills', arguments: {} }));
      const full = text(await c.callTool({ name: 'list_skills', arguments: { detail: 'full' } }));
      assert(/cook/.test(compact), 'compact list has no "cook"');
      assert(full.length > compact.length, `full (${full.length}B) should be larger than compact (${compact.length}B)`);
      const filtered = text(await c.callTool({ name: 'list_skills', arguments: { filter: 'debug' } }));
      assert(/debug/.test(filtered), 'filter=debug found nothing');
      return `compact ${compact.length}B / full ${full.length}B`;
    }),
  );
  await check(`${label}: get_skill + get_reference`, () =>
    withClient(k, url, async (c) => {
      const s = text(await c.callTool({ name: 'get_skill', arguments: { name: 'cook' } }));
      assert(/skill: .*cook/.test(s) && s.length > 2000, `get_skill cook too short (${s.length}B)`);
      const ref = (s.match(/^- (references\/\S+\.md)$/m) || [])[1];
      assert(ref, 'get_skill listed no reference file for cook');
      const r = await c.callTool({ name: 'get_reference', arguments: { skill: 'cook', path: ref } });
      assert(!r.isError && text(r).length > 100, `get_reference ${ref} failed: ${text(r).slice(0, 120)}`);
      return `cook SKILL.md ${s.length}B, ${ref} ${text(r).length}B`;
    }),
  );
  await check(`${label}: run_skill returns the skill framed around the input`, () =>
    withClient(k, url, async (c) => {
      const r = await c.callTool({
        name: 'run_skill',
        arguments: { name: 'cook', input: 'E2E-MARKER-add-a-login-button' },
      });
      const t = text(r);
      assert(!r.isError && t.includes('E2E-MARKER-add-a-login-button'), 'input not echoed into the instructions');
      return `${t.length}B`;
    }),
  );
  await check(`${label}: unknown skill → clean isError (not a crash)`, () =>
    withClient(k, url, async (c) => {
      const r = await c.callTool({ name: 'get_skill', arguments: { name: 'no-such-skill-xyz' } });
      assert(r.isError === true, 'expected isError');
      const ok = await c.callTool({ name: 'list_skills', arguments: {} });
      assert(!ok.isError, 'server unhealthy after an error');
    }),
  );
  await check(`${label}: path traversal in get_reference is refused`, () =>
    withClient(k, url, async (c) => {
      for (const p of ['../../package.json', '../../../etc/passwd', '..\\..\\package.json', '/etc/passwd']) {
        const r = await c.callTool({ name: 'get_reference', arguments: { skill: 'cook', path: p } });
        assert(r.isError === true, `traversal ${p} was NOT refused: ${text(r).slice(0, 80)}`);
      }
    }),
  );
}

async function authSuite(k, url, label) {
  const base = url.replace(/\/mcp$/, '');
  await check(`${label}: /health is public and reports skills`, async () => {
    const r = await http('GET', `${base}/health`);
    assert(r.status === 200, `HTTP ${r.status}`);
    const j = JSON.parse(r.text);
    assert(j.ok === true && j.skills > 50, r.text);
    return `v${j.version}, ${j.skills} skills`;
  });
  await check(`${label}: no key → 401`, async () => {
    const r = await http('POST', url, { headers: mcpHeaders(null), body: initBody });
    assert(r.status === 401, `HTTP ${r.status}`);
  });
  await check(`${label}: wrong key → 401`, async () => {
    const r = await http('POST', url, {
      headers: mcpHeaders('rune_sk_wrongwrongwrongwrongwrongwrongwrong1234'),
      body: initBody,
    });
    assert(r.status === 401, `HTTP ${r.status}`);
  });
  await check(`${label}: ?key= in the URL is rejected by default`, async () => {
    const r = await http('POST', `${url}?key=${encodeURIComponent(k)}`, { headers: mcpHeaders(null), body: initBody });
    assert(r.status === 401, `HTTP ${r.status} (query keys leak into logs; must be opt-in)`);
  });
  await check(`${label}: X-Rune-Key header works`, async () => {
    const r = await http('POST', url, { headers: { ...mcpHeaders(null), 'x-rune-key': k }, body: initBody });
    assert(r.status === 200, `HTTP ${r.status}`);
  });
  await check(`${label}: oversized body is refused`, async () => {
    const r = await http('POST', url, { headers: mcpHeaders(k), body: 'x'.repeat(2_000_000) });
    assert([400, 413].includes(r.status), `HTTP ${r.status}`);
  });
}

async function diagnose(url) {
  const host = new URL(url).hostname;
  const lines = [`diagnostics for ${host}:`];
  try {
    const dns = await import('node:dns/promises');
    lines.push(`  node dns.resolve4: ${(await dns.resolve4(host)).join(', ')}`);
  } catch (e) {
    lines.push(`  node dns.resolve4: ${e.code || e.message}`);
  }
  try {
    const dns = await import('node:dns/promises');
    lines.push(`  node dns.lookup:   ${JSON.stringify(await dns.lookup(host, { all: true }))}`);
  } catch (e) {
    lines.push(`  node dns.lookup:   ${e.code || e.message}`);
  }
  const c = sh('curl', [
    '-sS',
    '-m',
    '15',
    '-o',
    '/dev/null',
    '-w',
    'curl http=%{http_code} ip=%{remote_ip}',
    `${url}/health`,
  ]);
  lines.push(`  ${(c.stdout || '').trim()} ${(c.stderr || '').trim()}`);
  return lines.join('\n');
}

// ─── cli helpers ───

const jsonOf = (r, what) => {
  try {
    return JSON.parse(r.stdout);
  } catch {
    throw new Error(
      `${what}: stdout is not JSON (exit ${r.code})\n${r.stdout.slice(0, 400)}\n${r.stderr.slice(0, 400)}`,
    );
  }
};
function status() {
  return jsonOf(run(['serve', 'status', '--json']), 'status --json');
}
const activeUrl = () => {
  const s = status();
  return EXPOSE === 'tunnel' ? s.publicUrl : s.localUrl;
};
const systemctl = (...a) => sh('systemctl', ['--user', ...a]);

// ─── the run ───

async function main() {
  log(
    `rune serve e2e — ${process.platform}/${process.arch}, node ${process.version}, expose=${EXPOSE}${SERVICE ? ', systemd service' : ''}`,
  );
  log(`sandbox ${tmp}${SERVICE ? ' (real $HOME for systemd)' : ''}`);

  section('1. Install the packed CLI (what npm users get)');
  await check('npm pack + install into a temp prefix', () => {
    const pack = spawnSync(npm, ['pack', '--silent', '--pack-destination', tmp], {
      cwd: ROOT,
      encoding: 'utf-8',
      shell: IS_WIN,
    });
    assert(pack.status === 0, `npm pack failed: ${pack.stderr}`);
    const tgz = path.join(tmp, pack.stdout.trim().split('\n').pop());
    const prefix = path.join(tmp, 'prefix');
    const inst = spawnSync(npm, ['install', '--prefix', prefix, tgz, '--silent', '--no-audit', '--no-fund'], {
      encoding: 'utf-8',
      shell: IS_WIN,
      timeout: 240_000,
    });
    assert(inst.status === 0, `npm install failed: ${inst.stderr}`);
    const pkgDir = path.join(prefix, 'node_modules', '@rune-kit', 'rune');
    runeBin = path.join(pkgDir, 'compiler', 'bin', 'rune.js');
    assert(existsSync(runeBin), `no ${runeBin}`);
    return `@rune-kit/rune ${JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf-8')).version}`;
  });
  if (!runeBin) return;
  const sdkDir = path.join(
    path.dirname(path.dirname(path.dirname(runeBin))),
    'node_modules',
    '@modelcontextprotocol',
    'sdk',
  );
  const sdkAlt = path.join(tmp, 'prefix', 'node_modules', '@modelcontextprotocol', 'sdk');
  const dir = existsSync(sdkDir) ? sdkDir : sdkAlt;
  const clientMod = await import(pathToFileURL(path.join(dir, 'dist', 'esm', 'client', 'index.js')).href);
  const httpMod = await import(pathToFileURL(path.join(dir, 'dist', 'esm', 'client', 'streamableHttp.js')).href);
  sdk = { Client: clientMod.Client, Transport: httpMod.StreamableHTTPClientTransport };

  section('2. Help never has side effects; non-TTY refuses without --yes');
  await check('serve --help / setup --help do nothing', () => {
    for (const a of [
      ['serve', '--help'],
      ['serve', 'setup', '--help'],
      ['serve', 'stop', '--help'],
    ]) {
      const r = run(a);
      assert(r.code === 0 && /rune serve/.test(r.stdout + r.stderr), `${a.join(' ')} exit ${r.code}`);
    }
    assert(!existsSync(configPath), 'help created a config file');
  });
  await check('setup without --yes on a non-TTY refuses (exit ≠ 0, nothing written)', () => {
    const r = run(['serve', 'setup', '--expose', 'local', '--port', String(PORT)], { input: '' });
    assert(r.code !== 0, 'should refuse');
    assert(!existsSync(configPath), 'wrote config despite refusing');
  });

  section(`3. rune serve setup --yes --json --expose ${EXPOSE}${SERVICE ? ' --service' : ' --no-service'}`);
  let report = null;
  await check('setup succeeds and reports JSON', () => {
    const args = [
      'serve',
      'setup',
      '--yes',
      '--json',
      '--expose',
      EXPOSE,
      '--port',
      String(PORT),
      '--key-out',
      keyFile,
      SERVICE ? '--service' : '--no-service',
      '--no-tiers',
    ];
    const r = run(args, { timeoutMs: 240_000 });
    report = jsonOf(r, 'setup');
    assert(r.code === 0 && report.ok === true, `exit ${r.code}, ok=${report.ok}\n${r.stderr.slice(-600)}`);
    key = readKey(keyFile);
    assert(!r.stdout.includes(key) && !r.stderr.includes(key), 'KEY LEAKED to stdout/stderr');
    mcpUrl = EXPOSE === 'tunnel' ? report.exposure.publicUrl : report.exposure.localUrl;
    assert(mcpUrl, 'no URL in the report');
    assert(
      EXPOSE !== 'tunnel' || /^https:\/\/[a-z0-9-]+\.trycloudflare\.com\/mcp$/.test(mcpUrl),
      `public URL looks wrong: ${mcpUrl}`,
    );
    baseUrl = mcpUrl.replace(/\/mcp$/, '');
    return `${mcpUrl} (${report.service?.mode}, pid ${report.service?.pid})`;
  });
  if (!key) return;
  await check('key file is 0600 and the key is NOT stored in serve.json (hash only)', () => {
    if (!IS_WIN) {
      assert(modeBits(keyFile) === 0o600, `key file mode ${modeBits(keyFile).toString(8)}`);
      assert(modeBits(configPath) === 0o600, `serve.json mode ${modeBits(configPath).toString(8)}`);
    }
    const raw = readFileSync(configPath, 'utf-8');
    assert(!raw.includes(key), 'serve.json contains the plaintext key');
    assert(/"keyHash":\s*"[a-f0-9]{64}"/.test(raw), 'no sha256 keyHash');
  });
  await check('setup report itself contains no key / connect text has no key', () => {
    const blob = JSON.stringify(report);
    assert(!blob.includes(key), 'key in report');
    assert(/RUNE_KEY/.test(blob), 'connect text should reference $RUNE_KEY');
  });
  if (SERVICE) {
    await check('service is systemd-user, linger on, unit active', () => {
      assert(
        report.service?.mode === 'systemd-user',
        `service mode ${report.service?.mode} — ${JSON.stringify(report.warnings)}`,
      );
      const a = systemctl('is-active', 'rune-serve');
      assert(a.stdout.trim() === 'active', `is-active: ${a.stdout}${a.stderr}`);
      const e = systemctl('is-enabled', 'rune-serve');
      assert(e.stdout.trim() === 'enabled', `is-enabled: ${e.stdout}${e.stderr}`);
      return `linger=${report.service.linger}`;
    });
  }
  if (EXPOSE === 'tunnel') {
    await check('public URL becomes reachable (DNS + edge propagation)', () =>
      until(async () => (await http('GET', `${baseUrl}/health`)).status === 200, {
        timeoutMs: 90_000,
        what: 'tunnel /health',
      }),
    );
  }

  section(`4. Real MCP client against ${EXPOSE === 'tunnel' ? 'the PUBLIC URL' : 'localhost'}`);
  await mcpSuite(key, mcpUrl, EXPOSE);
  await authSuite(key, mcpUrl, EXPOSE);
  if (EXPOSE === 'tunnel') {
    await check('local port still answers behind the tunnel', async () => {
      const r = await http('GET', `http://127.0.0.1:${PORT}/health`);
      assert(r.status === 200, `HTTP ${r.status}`);
    });
  }

  section('5. status / doctor / connect');
  await check('status --json: running, URLs match', () => {
    const s = status();
    assert(s.running === true && s.pid, `running=${s.running}`);
    assert(EXPOSE !== 'tunnel' || s.publicUrl === mcpUrl, `publicUrl ${s.publicUrl} ≠ ${mcpUrl}`);
    assert(s.problems.length === 0, `problems: ${s.problems}`);
    return `pid ${s.pid}, ${s.skills} skills`;
  });
  await check('doctor --json with RUNE_KEY: full handshake on every URL', () => {
    const prev = env.RUNE_KEY;
    env.RUNE_KEY = key;
    const r = run(['serve', 'doctor', '--json']);
    if (prev === undefined) delete env.RUNE_KEY;
    const d = jsonOf(r, 'doctor');
    assert(r.code === 0, `exit ${r.code}`);
    assert(d.health?.local?.handshake?.ok, 'local handshake failed');
    if (EXPOSE === 'tunnel')
      assert(d.health?.public?.handshake?.ok, `public handshake failed: ${JSON.stringify(d.health?.public)}`);
    assert(d.health.local.authEnforced === true, 'auth not enforced');
    assert(!r.stdout.includes(key), 'key leaked by doctor');
  });
  await check('connect all: 7 clients, never prints the key', () => {
    const r = run(['serve', 'connect', 'all']);
    assert(r.code === 0, `exit ${r.code}`);
    const out = r.stdout + r.stderr;
    for (const c of ['Grok Bot', 'Claude Code', 'Grok Build', 'Codex', 'Cursor', 'Gemini', 'Antigravity'])
      assert(out.includes(c), `missing ${c}`);
    assert(!out.includes(key), 'key leaked');
    if (EXPOSE === 'tunnel') assert(out.includes(mcpUrl), 'connect does not use the public URL');
  });
  await check('connect <bad client> fails cleanly', () => {
    const r = run(['serve', 'connect', 'nope']);
    assert(r.code !== 0, 'expected non-zero');
  });

  section('6. key rotate (old key dies without a restart)');
  const keyFile2 = path.join(tmp, 'key2.txt');
  let key2 = '';
  await check('rotate → 0600 key file, old key 401, new key works', async () => {
    const r = run(['serve', 'key', 'rotate', '--key-out', keyFile2]);
    assert(r.code === 0, `exit ${r.code}\n${r.stderr}`);
    key2 = readKey(keyFile2);
    assert(key2 !== key, 'same key');
    assert(!(r.stdout + r.stderr).includes(key2), 'new key printed to a non-TTY');
    if (!IS_WIN) assert(modeBits(keyFile2) === 0o600, 'key file not 0600');
    const old = await http('POST', mcpUrl, { headers: mcpHeaders(key), body: initBody });
    assert(old.status === 401, `old key still works (HTTP ${old.status})`);
    await withClient(key2, mcpUrl, (c) => c.listTools());
  });
  if (!key2) return;

  section('7. stop → start');
  await check('stop: unreachable, state cleared, status says not running', async () => {
    const r = run(['serve', 'stop']);
    assert(r.code === 0, `exit ${r.code}`);
    await until(
      async () =>
        await fetch(`http://127.0.0.1:${PORT}/health`, { signal: AbortSignal.timeout(3000) }).then(
          () => false,
          () => true,
        ),
      { timeoutMs: 20_000, what: 'port to close' },
    );
    const s = status();
    assert(s.running === false, 'status still running');
    if (EXPOSE === 'tunnel') {
      const pub = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(10_000) }).then(
        (x) => x.status,
        () => 'unreachable',
      );
      assert(pub !== 200, `public URL still serves after stop (HTTP ${pub})`);
    }
    if (SERVICE)
      assert(systemctl('is-active', 'rune-serve').stdout.trim() !== 'active', 'unit still active after stop');
  });
  await check('start: back up with the same (rotated) key', async () => {
    const r = run(['serve', 'start'], { timeoutMs: 180_000 });
    assert(r.code === 0, `exit ${r.code}\n${r.stderr.slice(-500)}`);
    mcpUrl = await until(() => activeUrl(), { timeoutMs: 60_000, what: 'status URL' });
    baseUrl = mcpUrl.replace(/\/mcp$/, '');
    if (EXPOSE === 'tunnel')
      await until(async () => (await http('GET', `${baseUrl}/health`)).status === 200, {
        timeoutMs: 90_000,
        what: 'tunnel /health after restart',
      });
    await withClient(key2, mcpUrl, (c) => c.listTools());
    const old = await http('POST', mcpUrl, { headers: mcpHeaders(key), body: initBody });
    assert(old.status === 401, 'old key works after restart');
    return mcpUrl;
  });
  await mcpSuite(key2, mcpUrl, `${EXPOSE} after restart`);

  if (SERVICE) {
    section('8. systemd: crash recovery');
    await check('kill -9 the server → systemd restarts it (Restart=on-failure)', async () => {
      const pid1 = Number(systemctl('show', '-p', 'MainPID', '--value', 'rune-serve').stdout.trim());
      assert(pid1 > 1, `no MainPID (${pid1})`);
      process.kill(pid1, 'SIGKILL');
      const pid2 = await until(
        () => {
          const p = Number(systemctl('show', '-p', 'MainPID', '--value', 'rune-serve').stdout.trim());
          return p > 1 && p !== pid1 && systemctl('is-active', 'rune-serve').stdout.trim() === 'active' ? p : 0;
        },
        { timeoutMs: 60_000, what: 'systemd restart' },
      );
      mcpUrl = await until(() => activeUrl(), { timeoutMs: 60_000, what: 'status URL after crash' });
      baseUrl = mcpUrl.replace(/\/mcp$/, '');
      if (EXPOSE === 'tunnel')
        await until(async () => (await http('GET', `${baseUrl}/health`)).status === 200, {
          timeoutMs: 90_000,
          what: 'tunnel after crash',
        });
      await withClient(key2, mcpUrl, (c) => c.listTools());
      return `pid ${pid1} → ${pid2}`;
    });
    await check('journal has no key', () => {
      const j = sh('journalctl', ['--user', '-u', 'rune-serve', '--no-pager', '-n', '200']);
      assert(!(j.stdout || '').includes(key2) && !(j.stdout || '').includes(key), 'key in journal');
    });
  }

  section('9. Cleanup leaves nothing exposed');
  await check('stop → port closed, no tunnel process left', async () => {
    run(['serve', 'stop']);
    await until(
      async () =>
        await fetch(`http://127.0.0.1:${PORT}/health`, { signal: AbortSignal.timeout(3000) }).then(
          () => false,
          () => true,
        ),
      { timeoutMs: 20_000, what: 'port to close' },
    );
    if (EXPOSE === 'tunnel') {
      await sleep(1500);
      const p = IS_WIN
        ? sh('tasklist', ['/FI', 'IMAGENAME eq cloudflared.exe', '/FO', 'CSV', '/NH'])
        : sh('pgrep', ['-af', `cloudflared.*127.0.0.1:${PORT}`]);
      const out = (p.stdout || '').trim();
      assert(IS_WIN ? !/cloudflared/i.test(out) : !out, `cloudflared still running:\n${out}`);
    }
  });
}

async function cleanup() {
  try {
    if (runeBin) run(['serve', 'stop'], { timeoutMs: 30_000 });
    if (SERVICE) {
      systemctl('disable', '--now', 'rune-serve');
      rmSync(path.join(HOME, '.config', 'systemd', 'user', 'rune-serve.service'), { force: true });
      systemctl('daemon-reload');
    }
    if (SERVICE) {
      for (const f of ['serve.json', 'serve-state.json', 'serve.log'])
        rmSync(path.join(HOME, '.rune', f), { force: true });
    }
  } catch {
    /* best effort */
  }
  if (!KEEP) rmSync(tmp, { recursive: true, force: true });
}

try {
  await main();
} catch (err) {
  results.push({ name: 'harness', pass: false, detail: scrub(err.stack || err.message), ms: 0 });
  log(`\n  ✗ harness crashed: ${scrub(err.stack || err.message)}`);
}
if (!results.every((r) => r.pass) && existsSync(path.join(HOME, '.rune', 'serve.log'))) {
  log(
    `\n── serve.log (last 25 lines) ──\n${readFileSync(path.join(HOME, '.rune', 'serve.log'), 'utf-8')
      .split('\n')
      .slice(-25)
      .join('\n')}`,
  );
}
await cleanup();

const failed = results.filter((r) => !r.pass);
log(
  `\n${failed.length === 0 ? '✓ PASS' : '✗ FAIL'} — ${results.length - failed.length}/${results.length} checks passed`,
);
if (JSON_OUT)
  console.log(
    JSON.stringify(
      { ok: failed.length === 0, expose: EXPOSE, service: SERVICE, platform: process.platform, results },
      null,
      2,
    ),
  );
process.exit(failed.length === 0 ? 0 : 1);
