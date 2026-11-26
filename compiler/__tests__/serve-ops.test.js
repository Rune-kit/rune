import assert from 'node:assert';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { platform as osPlatform, tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { startServe } from '../serve/index.js';
import { buildUnit, installService, systemdQuote } from '../serve/install.js';
import { parseTunnelUrl, startTunnel } from '../serve/tunnel.js';

const RUNE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('serve install (experimental systemd unit)', () => {
  let tmp;
  before(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), 'rune-install-'));
  });
  after(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  test('quotes ExecStart words for systemd and refuses newlines', () => {
    assert.strictEqual(systemdQuote('/usr/bin/node'), '/usr/bin/node');
    assert.strictEqual(systemdQuote('a b'), '"a b"');
    assert.strictEqual(systemdQuote('$HOME'), '"$$HOME"');
    assert.strictEqual(systemdQuote('50%'), '"50%%"');
    assert.throws(() => systemdQuote('a\nExecStartPre=rm -rf /'), /newline/);
  });

  test('forwards serve flags and tier env, nothing else', () => {
    const unit = buildUnit({
      nodePath: '/usr/bin/node',
      runeBin: '/opt/rune/compiler/bin/rune.js',
      args: { port: '9000', 'trust-proxy': true, 'pro-root': '/srv/pro', print: true, bogus: 'x' },
      env: { RUNE_PRO_ROOT: '/srv/pro', HOME: '/home/x', SECRET: 'nope' },
    });
    assert.match(
      unit,
      /^ExecStart=\/usr\/bin\/node \/opt\/rune\/compiler\/bin\/rune\.js serve --port 9000 --pro-root \/srv\/pro --trust-proxy$/m,
    );
    assert.match(unit, /^Environment=RUNE_PRO_ROOT=\/srv\/pro$/m);
    assert.doesNotMatch(unit, /bogus|SECRET|--print/);
    assert.match(unit, /WantedBy=default\.target/);
  });

  test('writes a user unit, or prints one with --print', async () => {
    const res = installService({ nodePath: '/n', runeBin: '/r', args: {}, homedir: tmp, env: {} });
    assert.strictEqual(res.unitPath, path.join(tmp, '.config', 'systemd', 'user', 'rune-serve.service'));
    assert.match(await readFile(res.unitPath, 'utf-8'), /ExecStart=\/n \/r serve/);
    assert.ok(res.next.some((l) => l.includes('systemctl --user')));
    const printed = installService({ nodePath: '/n', runeBin: '/r', args: { print: true }, homedir: tmp, env: {} });
    assert.strictEqual(printed.unitPath, null);
    assert.match(printed.unit, /WantedBy=multi-user\.target/);
  });
});

describe('serve --tunnel (experimental cloudflared)', () => {
  let tmp;
  before(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), 'rune-tunnel-'));
  });
  after(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  test('parses the quick-tunnel URL from cloudflared logs', () => {
    const log =
      '2026-11-26T10:00:00Z INF |  https://quiet-river-abc-123.trycloudflare.com                    |\nINF Registered';
    assert.strictEqual(parseTunnelUrl(log), 'https://quiet-river-abc-123.trycloudflare.com');
    assert.strictEqual(parseTunnelUrl('no url here'), null);
  });

  test('fails clearly when cloudflared is missing', async () => {
    await assert.rejects(startTunnel({ target: 'http://127.0.0.1:1', env: { PATH: tmp } }), /cloudflared` not found/);
  });

  test('starts a (fake) cloudflared and returns its URL', { skip: osPlatform() === 'win32' }, async () => {
    const fake = path.join(tmp, 'cloudflared');
    await writeFile(
      fake,
      `#!${process.execPath}\nprocess.stderr.write('INF Requesting new quick Tunnel\\nINF |  https://fake-tunnel-1.trycloudflare.com  |\\n'); setTimeout(() => process.stderr.write('INF Registered tunnel connection connIndex=0\\n'), 100);\nsetInterval(() => {}, 1000);\n`,
    );
    await chmod(fake, 0o755);
    const t = await startTunnel({ target: 'http://127.0.0.1:1', env: { ...process.env, PATH: tmp } });
    assert.strictEqual(t.publicUrl, 'https://fake-tunnel-1.trycloudflare.com');
    t.stop();
  });

  test('reports a URL that never reaches the edge instead of printing a dead link', {
    skip: osPlatform() === 'win32',
  }, async () => {
    const fake = path.join(tmp, 'cloudflared');
    await writeFile(
      fake,
      `#!${process.execPath}\nprocess.stderr.write('INF |  https://dead-1.trycloudflare.com  |\\nERR Unable to establish connection with Cloudflare edge error="TLS handshake"\\n');\nsetInterval(() => {}, 1000);\n`,
    );
    await chmod(fake, 0o755);
    await assert.rejects(
      startTunnel({ target: 'http://127.0.0.1:1', timeoutMs: 400, env: { ...process.env, PATH: tmp } }),
      /never connected.*TLS handshake/,
    );
  });

  test('startServe keeps serving when the tunnel fails', async () => {
    const lines = [];
    const running = await startServe({
      runeRoot: RUNE_ROOT,
      projectRoot: tmp,
      args: { port: '0', config: path.join(tmp, 'serve.json'), 'no-tiers': true, tunnel: true },
      out: (l) => lines.push(l),
      startTunnel: () => Promise.reject(new Error('boom')),
    });
    try {
      assert.strictEqual(running.publicUrl, null);
      assert.ok(lines.some((l) => l.includes('--tunnel: boom')));
      const res = await fetch(running.url.replace('/mcp', '/health'));
      assert.strictEqual(res.status, 200);
    } finally {
      await running.close();
    }
  });
});
