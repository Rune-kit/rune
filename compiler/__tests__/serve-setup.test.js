import assert from 'node:assert';
import { execFile } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { platform as osPlatform, tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { readServeConfig } from '../serve/auth.js';
import { deliverKey, startServe, USAGE, wantsHelp } from '../serve/index.js';
import {
  CLIENTS,
  caddySnippet,
  checkEndpoint,
  cloudflaredAsset,
  connectInstructions,
  defaultKeyOutPath,
  detectEnvironment,
  ensureCloudflared,
  formatConnect,
  keyEnvHint,
  resolveProfile,
  runSetup,
  serveArgsFromProfile,
  serveStatus,
  waitForDns,
} from '../serve/setup.js';

const RUNE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUNE_BIN = path.join(RUNE_ROOT, 'compiler', 'bin', 'rune.js');
const run = promisify(execFile);
const KEY_RE = /rune_sk_[A-Za-z0-9_-]{20,}/;
const isWin = osPlatform() === 'win32';

const VPS = { kind: 'vps', platform: 'linux', arch: 'x64', systemdUser: false, tailscale: null, npx: false };

function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

async function cli(args, env) {
  try {
    const r = await run(process.execPath, [RUNE_BIN, 'serve', ...args], { env, timeout: 120_000 });
    return { code: 0, stdout: r.stdout, stderr: r.stderr };
  } catch (err) {
    return { code: err.code, stdout: err.stdout, stderr: err.stderr };
  }
}

describe('serve setup: building blocks', () => {
  test('picks the official cloudflared asset per OS/CPU', () => {
    assert.deepStrictEqual(cloudflaredAsset('linux', 'x64'), { name: 'cloudflared-linux-amd64', archive: false });
    assert.deepStrictEqual(cloudflaredAsset('linux', 'arm64'), { name: 'cloudflared-linux-arm64', archive: false });
    assert.deepStrictEqual(cloudflaredAsset('darwin', 'arm64'), {
      name: 'cloudflared-darwin-arm64.tgz',
      archive: true,
    });
    assert.strictEqual(cloudflaredAsset('win32', 'x64').name, 'cloudflared-windows-amd64.exe');
    assert.strictEqual(cloudflaredAsset('aix', 'ppc64'), null);
  });

  test('downloads cloudflared into ~/.rune/bin once, user-space only', { skip: isWin }, async () => {
    const home = await mkdtemp(path.join(tmpdir(), 'rune-cf-'));
    try {
      const urls = [];
      const fetchImpl = async (url) => {
        urls.push(url);
        return { ok: true, status: 200, arrayBuffer: async () => Buffer.alloc(2_000_000, 1) };
      };
      const env = { PATH: '' };
      const first = await ensureCloudflared({ env, home, platform: 'linux', arch: 'x64', fetchImpl });
      assert.strictEqual(first.path, path.join(home, '.rune', 'bin', 'cloudflared'));
      assert.ok(first.downloaded);
      assert.match(urls[0], /^https:\/\/github\.com\/cloudflare\/cloudflared\/releases\/latest\/download\//);
      assert.ok(statSync(first.path).mode & 0o100, 'executable');
      const second = await ensureCloudflared({ env, home, platform: 'linux', arch: 'x64', fetchImpl });
      assert.strictEqual(second.downloaded, false);
      assert.strictEqual(urls.length, 1);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  test('refuses a truncated download and honours --no-download', async () => {
    const home = await mkdtemp(path.join(tmpdir(), 'rune-cf-'));
    try {
      const tiny = async () => ({ ok: true, status: 200, arrayBuffer: async () => Buffer.from('<html>') });
      await assert.rejects(
        ensureCloudflared({ env: { PATH: '' }, home, platform: 'linux', arch: 'x64', fetchImpl: tiny }),
        /looks wrong/,
      );
      await assert.rejects(
        ensureCloudflared({ env: { PATH: '' }, home, allowDownload: false, fetchImpl: tiny }),
        /--no-download/,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  test('detects a VPS from SSH / no display', () => {
    const which = () => null;
    assert.strictEqual(detectEnvironment({ env: { SSH_CONNECTION: '1 2 3 4' }, platform: 'linux', which }).kind, 'vps');
    assert.strictEqual(detectEnvironment({ env: { DISPLAY: ':0' }, platform: 'linux', which }).kind, 'local');
    assert.strictEqual(detectEnvironment({ env: {}, platform: 'darwin', which }).kind, 'local');
  });

  test('profile → serve flags: proxy modes trust the proxy, local does not', () => {
    const tunnel = serveArgsFromProfile({ port: 9000, expose: 'tunnel', proRoot: '/srv/pro' });
    assert.deepStrictEqual(tunnel, { port: '9000', 'pro-root': '/srv/pro', tunnel: true, 'trust-proxy': true });
    const local = serveArgsFromProfile({ port: 8787, expose: 'local', noTiers: true, proRoot: '/x' });
    assert.deepStrictEqual(local, { port: '8787', 'no-tiers': true });
    const custom = serveArgsFromProfile(
      { port: 1, expose: 'domain' },
      { configPath: '/a/b.json', defaultConfig: '/c' },
    );
    assert.strictEqual(custom.config, '/a/b.json');
  });

  test('profile validation: domain, tailscale, unknown mode', async () => {
    const base = { args: {}, envInfo: VPS, projectRoot: tmpdir(), detect: () => ({}) };
    assert.strictEqual((await resolveProfile(base)).expose, 'tunnel', 'VPS defaults to a public tunnel');
    assert.strictEqual(
      (await resolveProfile({ ...base, envInfo: { ...VPS, kind: 'local' } })).expose,
      'local',
      'desktop defaults to local',
    );
    await assert.rejects(resolveProfile({ ...base, args: { expose: 'domain' } }), /--domain/);
    await assert.rejects(resolveProfile({ ...base, args: { expose: 'tailscale' } }), /tailscale/);
    await assert.rejects(resolveProfile({ ...base, args: { expose: 'ngrok' } }), /--expose must be/);
    const d = await resolveProfile({ ...base, args: { expose: 'domain', domain: 'https://rune.example.com/' } });
    assert.strictEqual(d.domain, 'rune.example.com');
  });

  test('caddy snippet reverse-proxies to the local port', () => {
    assert.strictEqual(
      caddySnippet('rune.example.com', 9000),
      'rune.example.com {\n\treverse_proxy 127.0.0.1:9000\n}\n',
    );
  });
});

describe('serve connect instructions', () => {
  const url = 'https://quiet-river.trycloudflare.com/mcp';

  test('every client gets the URL and a key placeholder, never a key', () => {
    for (const c of CLIENTS) {
      const i = connectInstructions(c, url);
      assert.ok(i.text.includes(url), c);
      assert.doesNotMatch(i.text, KEY_RE, c);
    }
    assert.match(connectInstructions('claude', url).text, /^claude mcp add --transport http --scope user rune https:/);
    assert.match(
      connectInstructions('grok', url).text,
      /^grok mcp add rune https:\S+ -H "Authorization: Bearer \$RUNE_KEY"/,
    );
    assert.match(connectInstructions('codex', url).text, /--bearer-token-env-var RUNE_KEY/);
    assert.match(connectInstructions('grok-bot', url).text, /secure form/);
    const cursor = JSON.parse(connectInstructions('cursor', url).text.split('\n').slice(1).join('\n'));
    assert.match(cursor.mcpServers.rune.headers.Authorization, /^Bearer \$\{env:RUNE_KEY\}$/);
    assert.throws(() => connectInstructions('nope', url), /Unknown client/);
  });

  test('Grok Bot is told it cannot reach a localhost URL', () => {
    const text = formatConnect('http://127.0.0.1:8787/mcp', ['grok-bot', 'claude']);
    assert.match(text, /Grok Bot runs in the cloud and cannot reach/);
    assert.match(text, /claude mcp add/);
  });
});

describe('serve health check (real server)', () => {
  let tmp;
  let running;
  before(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), 'rune-check-'));
    running = await startServe({
      runeRoot: RUNE_ROOT,
      projectRoot: tmp,
      args: { port: '0', config: path.join(tmp, 'serve.json'), 'no-tiers': true },
      out: () => {},
    });
  });
  after(async () => {
    await running.close();
    await rm(tmp, { recursive: true, force: true });
  });

  test('without a key: /health + auth enforced, no handshake', async () => {
    const r = await checkEndpoint(running.url);
    assert.strictEqual(r.reachable, true);
    assert.ok(r.health.skills > 50);
    assert.strictEqual(r.authEnforced, true);
    assert.strictEqual(r.handshake, null);
  });

  test('with the key: full MCP initialize + tools/list', async () => {
    const r = await checkEndpoint(running.url, { key: running.key });
    assert.strictEqual(r.handshake.ok, true);
    assert.strictEqual(r.handshake.server, 'rune');
    assert.deepStrictEqual(r.handshake.tools.sort(), ['get_reference', 'get_skill', 'list_skills', 'run_skill']);
  });

  test('wrong key fails the handshake; dead port is unreachable', async () => {
    const bad = await checkEndpoint(running.url, { key: 'rune_sk_wrong' });
    assert.strictEqual(bad.handshake.ok, false);
    assert.strictEqual(bad.handshake.status, 401);
    const dead = await checkEndpoint(`http://127.0.0.1:${await freePort()}/mcp`, { timeoutMs: 2000 });
    assert.strictEqual(dead.reachable, false);
    assert.ok(dead.error);
  });
});

describe('runSetup (non-interactive, stubbed side effects)', () => {
  let tmp;
  before(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), 'rune-setup-'));
  });
  after(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  const deps = (calls) => ({
    envInfo: VPS,
    detect: () => ({}),
    stopServer: async () => [],
    startBackground: async (o) => {
      calls.push(o);
      return { mode: 'background', pid: 4242, state: { ready: true, pid: 4242 } };
    },
    checkEndpoint: async (url) => ({ url, reachable: url.startsWith('http://'), authEnforced: true, error: 'dns' }),
  });

  test('domain mode: Caddyfile, public URL, key shown once and only its hash stored', async () => {
    const config = path.join(tmp, 'a', 'serve.json');
    const calls = [];
    const r = await runSetup({
      runeRoot: RUNE_ROOT,
      args: { yes: true, config, expose: 'domain', domain: 'rune.example.com', port: '9100' },
      deps: deps(calls),
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.exposure.publicUrl, 'https://rune.example.com/mcp');
    assert.match(r.exposure.caddyfile, /reverse_proxy 127\.0\.0\.1:9100/);
    assert.match(r.key.value, KEY_RE);
    assert.strictEqual(calls[0].serveArgs['trust-proxy'], true);
    assert.strictEqual(r.connectUrl, 'https://rune.example.com/mcp');
    assert.ok(r.warnings.some((w) => /not reachable yet/.test(w)));
    const raw = await readFile(config, 'utf-8');
    assert.doesNotMatch(raw, KEY_RE, 'plaintext key never on disk');
    assert.strictEqual(readServeConfig(config).setup.expose, 'domain');
    if (!isWin) assert.strictEqual(statSync(config).mode & 0o777, 0o600);
    for (const c of Object.values(r.connect)) assert.doesNotMatch(c.text, KEY_RE);

    // Re-run: same key, never re-printed.
    const again = await runSetup({
      runeRoot: RUNE_ROOT,
      args: { yes: true, config, expose: 'domain', domain: 'rune.example.com' },
      deps: deps([]),
    });
    assert.strictEqual(again.key.created, false);
    assert.strictEqual(again.key.value, undefined);
    assert.doesNotMatch(JSON.stringify(again), KEY_RE);
    assert.strictEqual(again.profile.port, 9100, 'remembers the saved port');
  });

  test('--key-out writes the key to a 0600 file and keeps it out of the report', async () => {
    const config = path.join(tmp, 'b', 'serve.json');
    const keyOut = path.join(tmp, 'b', 'key.txt');
    const r = await runSetup({
      runeRoot: RUNE_ROOT,
      args: { yes: true, config, expose: 'local', 'key-out': keyOut },
      deps: deps([]),
    });
    assert.strictEqual(r.key.file, keyOut);
    assert.doesNotMatch(JSON.stringify(r), KEY_RE);
    assert.match(await readFile(keyOut, 'utf-8'), KEY_RE);
    if (!isWin) assert.strictEqual(statSync(keyOut).mode & 0o777, 0o600);
  });

  test('--no-start only configures and says how to start', async () => {
    const config = path.join(tmp, 'c', 'serve.json');
    const calls = [];
    const r = await runSetup({
      runeRoot: RUNE_ROOT,
      args: { yes: true, config, expose: 'local', 'no-start': true },
      deps: deps(calls),
    });
    assert.strictEqual(calls.length, 0);
    assert.strictEqual(r.ok, true);
    assert.ok(r.next.some((n) => n.includes('rune serve start')));
  });

  test('status reports "not set up" for a fresh config', async () => {
    const st = await serveStatus({ configPath: path.join(tmp, 'none', 'serve.json') });
    assert.strictEqual(st.configured, false);
    assert.match(st.problems[0], /rune serve setup/);
  });
});

describe('serve setup CLI end-to-end (background server)', { skip: isWin }, () => {
  let home;
  let env;
  before(async () => {
    home = await mkdtemp(path.join(tmpdir(), 'rune-e2e-'));
    env = { ...process.env, HOME: home, USERPROFILE: home, PATH: path.dirname(process.execPath) };
    delete env.RUNE_SERVE_KEY;
    delete env.RUNE_SERVE_CONFIG;
    delete env.RUNE_KEY;
  });
  after(async () => {
    await cli(['stop'], env);
    await rm(home, { recursive: true, force: true });
  });

  test('setup --yes --json → running, handshake OK; status/doctor/connect never leak the key', async () => {
    const port = await freePort();
    const r = await cli(['setup', '--yes', '--json', '--expose', 'local', '--no-tiers', '--port', String(port)], env);
    assert.strictEqual(r.code, 0, r.stderr);
    const rep = JSON.parse(r.stdout);
    assert.strictEqual(rep.ok, true);
    // stdout is a pipe here (non-TTY): the key goes to ~/.rune/serve.key, never into the output.
    assert.strictEqual(rep.key.value, undefined);
    assert.strictEqual(rep.key.file, path.join(home, '.rune', 'serve.key'));
    assert.doesNotMatch(r.stdout + r.stderr, KEY_RE);
    assert.strictEqual(rep.service.mode, 'background');
    assert.strictEqual(rep.health.local.handshake.ok, true);
    const key = (await readFile(rep.key.file, 'utf-8')).trim();
    assert.match(key, KEY_RE);

    const st = JSON.parse((await cli(['status', '--json'], env)).stdout);
    assert.strictEqual(st.running, true);
    assert.strictEqual(st.localUrl, `http://127.0.0.1:${port}/mcp`);

    const doc = await cli(['doctor'], { ...env, RUNE_KEY: key });
    assert.strictEqual(doc.code, 0, doc.stdout + doc.stderr);
    assert.match(doc.stdout, /handshake ✓ \(4 tools\)/);

    const conn = await cli(['connect', 'all'], env);
    assert.match(
      conn.stdout,
      new RegExp(`claude mcp add --transport http --scope user rune http://127\\.0\\.0\\.1:${port}/mcp`),
    );
    for (const out of [conn.stdout, conn.stderr, doc.stdout, JSON.stringify(st)]) assert.ok(!out.includes(key));
    assert.ok(!(await readFile(path.join(home, '.rune', 'serve.log'), 'utf-8')).includes(key), 'key not in the log');

    const stop = await cli(['stop'], env);
    assert.match(stop.stdout, /Stopped/);
    const after = await cli(['doctor', '--json'], env);
    assert.strictEqual(after.code, 1);
    assert.strictEqual(JSON.parse(after.stdout).running, false);
  });

  test('tunnel mode uses ~/.rune/bin/cloudflared and publishes its URL', async () => {
    const bin = path.join(home, '.rune', 'bin');
    await mkdir(bin, { recursive: true });
    const fake = path.join(bin, 'cloudflared');
    await writeFile(
      fake,
      `#!${process.execPath}\nprocess.stderr.write('INF |  https://fake-e2e-1.trycloudflare.com  |\\n'); setTimeout(() => process.stderr.write('INF Registered tunnel connection connIndex=0\\n'), 50);\nsetInterval(() => {}, 1000);\n`,
    );
    await chmod(fake, 0o755);
    const port = await freePort();
    const r = await cli(['setup', '--yes', '--json', '--expose', 'tunnel', '--no-tiers', '--port', String(port)], env);
    const rep = JSON.parse(r.stdout);
    assert.strictEqual(rep.ok, true, r.stderr);
    assert.strictEqual(rep.exposure.cloudflared, fake);
    assert.strictEqual(rep.exposure.cloudflaredDownloaded, false);
    assert.strictEqual(rep.exposure.publicUrl, 'https://fake-e2e-1.trycloudflare.com/mcp');
    assert.strictEqual(rep.key.created, false, 'existing key kept');
    assert.match(rep.serveCommand, /--tunnel --trust-proxy/);
    const conn = await cli(['connect', 'grok-bot'], env);
    assert.match(conn.stdout, /URL https:\/\/fake-e2e-1\.trycloudflare\.com\/mcp/);
    await cli(['stop'], env);
  });
});

describe('serve CLI: help, non-TTY safety, Windows hints', () => {
  let home;
  let env;
  before(async () => {
    home = await mkdtemp(path.join(tmpdir(), 'rune-nontty-'));
    env = { ...process.env, HOME: home, USERPROFILE: home };
    delete env.RUNE_SERVE_KEY;
    delete env.RUNE_SERVE_CONFIG;
    delete env.RUNE_KEY;
  });
  after(async () => {
    await cli(['stop'], env);
    await rm(home, { recursive: true, force: true });
  });

  const helpCases = [
    ['--help'],
    ['-h'],
    ['help'],
    ['setup', '--help'],
    ['setup', '-h'],
    ['setup', '--yes', '--json', '--help'],
    ['start', '--help'],
    ['stop', '-h'],
    ['status', '--help'],
    ['doctor', '-h'],
    ['connect', '--help'],
    ['connect', 'claude', '-h'],
    ['install', '--help'],
    ['key', 'rotate', '--help'],
    ['key', 'path', '-h'],
    ['--stdio', '--help'],
    ['--tunnel', '-h'],
  ];
  for (const args of helpCases) {
    test(`rune serve ${args.join(' ')} prints help and does nothing else`, async () => {
      const r = await cli(args, env);
      assert.strictEqual(r.code, 0, r.stderr);
      assert.ok(r.stdout.includes(USAGE.trim().split('\n')[0].trim()), 'usage on stdout');
      assert.match(r.stdout, /rune serve setup/);
      assert.strictEqual(r.stderr, '');
      assert.doesNotMatch(r.stdout, KEY_RE);
      assert.ok(!existsSync(path.join(home, '.rune')), 'no config, key, state or log written');
    });
  }

  test('wantsHelp recognises --help, -h and help anywhere after `serve`', () => {
    assert.strictEqual(wantsHelp({ help: true }, ['serve', 'setup']), true);
    assert.strictEqual(wantsHelp({ help: '--yes' }, ['serve']), true);
    assert.strictEqual(wantsHelp({}, ['serve', 'key', 'rotate', '-h']), true);
    assert.strictEqual(wantsHelp({}, ['serve', 'help']), true);
    assert.strictEqual(wantsHelp({ yes: true }, ['serve', 'setup']), false);
  });

  test('non-TTY setup without --yes refuses (exit 2) and changes nothing', async () => {
    const r = await cli(['setup', '--expose', 'local', '--no-tiers'], env);
    assert.strictEqual(r.code, 2);
    assert.match(r.stderr, /not an interactive terminal/);
    assert.match(r.stderr, /--yes/);
    assert.doesNotMatch(r.stdout + r.stderr, KEY_RE);
    assert.ok(!existsSync(path.join(home, '.rune')), 'nothing written');

    const j = await cli(['setup', '--json'], env);
    assert.strictEqual(j.code, 2);
    assert.deepStrictEqual(JSON.parse(j.stdout), { ok: false, error: 'non-interactive: pass --yes' });
    assert.ok(!existsSync(path.join(home, '.rune')), 'nothing written');
  });

  test('non-TTY setup --yes writes the new key to ~/.rune/serve.key (0600) and never prints it', async () => {
    const r = await cli(['setup', '--yes', '--expose', 'local', '--no-tiers', '--no-start'], env);
    assert.strictEqual(r.code, 0, r.stderr);
    const file = path.join(home, '.rune', 'serve.key');
    assert.doesNotMatch(r.stdout + r.stderr, KEY_RE);
    assert.match(r.stdout, /stdout is not a terminal, so the new key is NOT printed/);
    assert.ok(r.stdout.includes(file), 'prints the path');
    assert.match(await readFile(file, 'utf-8'), KEY_RE);
    if (!isWin) assert.strictEqual(statSync(file).mode & 0o777, 0o600);
  });

  test('non-TTY key rotate writes the key to a file (or --key-out) and never prints it', async () => {
    const r = await cli(['key', 'rotate'], env);
    assert.strictEqual(r.code ?? 0, 0, r.stderr);
    assert.doesNotMatch(r.stdout + r.stderr, KEY_RE);
    const file = path.join(home, '.rune', 'serve.key');
    assert.ok(r.stderr.includes(file));
    assert.match(await readFile(file, 'utf-8'), KEY_RE);

    const custom = path.join(home, 'k', 'rotated.key');
    const c = await cli(['key', 'rotate', '--key-out', custom], env);
    assert.doesNotMatch(c.stdout + c.stderr, KEY_RE);
    assert.match(await readFile(custom, 'utf-8'), KEY_RE);
    if (!isWin) assert.strictEqual(statSync(custom).mode & 0o777, 0o600);
  });

  test('runSetup({ printKey: false }) defaults the key file next to the config', async () => {
    const config = path.join(home, 'p', 'serve.json');
    const r = await runSetup({
      runeRoot: RUNE_ROOT,
      args: { yes: true, config, expose: 'local', 'no-tiers': true, 'no-start': true },
      deps: { envInfo: VPS },
      printKey: false,
    });
    assert.strictEqual(r.key.file, defaultKeyOutPath(config));
    assert.strictEqual(r.key.value, undefined);
    assert.doesNotMatch(JSON.stringify(r), KEY_RE);
  });

  test('deliverKey prints on a TTY, files it otherwise', async () => {
    const lines = [];
    const config = path.join(home, 'd', 'serve.json');
    const res = deliverKey('rune_sk_TESTTESTTESTTESTTESTTEST', {
      configPath: config,
      isTTY: false,
      out: (l) => lines.push(l),
    });
    assert.strictEqual(res.file, defaultKeyOutPath(config));
    assert.doesNotMatch(lines.join('\n'), KEY_RE);
  });

  test('Windows connect hints use PowerShell ($env:RUNE_KEY), others use export', () => {
    const url = 'https://quiet-river.trycloudflare.com/mcp';
    const win = formatConnect(url, CLIENTS, { platform: 'win32' });
    assert.match(win, /\$env:RUNE_KEY = "rune_sk_…"/);
    assert.match(win, /setx RUNE_KEY/);
    assert.doesNotMatch(win, /export RUNE_KEY/);
    assert.doesNotMatch(win, /Bearer \$RUNE_KEY/);
    assert.match(
      connectInstructions('claude', url, { platform: 'win32' }).text,
      /"Authorization: Bearer \$env:RUNE_KEY"/,
    );
    assert.match(connectInstructions('codex', url, { platform: 'win32' }).text, /setx RUNE_KEY/);
    const nix = formatConnect(url, CLIENTS, { platform: 'linux' });
    assert.match(nix, /export RUNE_KEY=rune_sk_…/);
    assert.doesNotMatch(nix, /\$env:/);
    assert.match(keyEnvHint('win32'), /PowerShell/);
    assert.match(keyEnvHint('darwin'), /export/);
  });
});

describe('waitForDns (a new tunnel name must exist in DNS before the OS is asked)', () => {
  test('IPs and localhost need no lookup', async () => {
    const never = async () => {
      throw new Error('should not resolve');
    };
    assert.strictEqual(await waitForDns('127.0.0.1', { resolver: never }), true);
    assert.strictEqual(await waitForDns('localhost', { resolver: never }), true);
  });

  test('polls the resolver until the name appears', async () => {
    let calls = 0;
    const resolver = async () => {
      calls++;
      if (calls < 3) throw Object.assign(new Error('nx'), { code: 'ENOTFOUND' });
      return ['104.16.0.1'];
    };
    assert.strictEqual(await waitForDns('fresh-name.trycloudflare.com', { resolver, timeoutMs: 10_000 }), true);
    assert.strictEqual(calls, 3);
  });

  test('gives up (false, no throw) when it never resolves', async () => {
    const resolver = async () => {
      throw new Error('nx');
    };
    assert.strictEqual(await waitForDns('never.trycloudflare.com', { resolver, timeoutMs: 50 }), false);
  });
});
