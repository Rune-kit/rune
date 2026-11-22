import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as antigravity from '../adapters/hooks/antigravity.js';
import { dispatchHook } from '../commands/hook-dispatch.js';
import { installHooks } from '../commands/hooks/install.js';
import { WIRED_SKILLS } from '../commands/hooks/presets.js';
import { hookStatus } from '../commands/hooks/status.js';
import { uninstallHooks } from '../commands/hooks/uninstall.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNE_ROOT = path.resolve(__dirname, '..', '..');
const HOOKS = '.agents/hooks.json';

let tmpRoot;
const read = async () => JSON.parse(await readFile(path.join(tmpRoot, HOOKS), 'utf-8'));

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(tmpdir(), 'rune-antigravity-'));
});

afterEach(async () => {
  if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
});

function io(stdinData) {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let out = '';
  let err = '';
  stdout.on('data', (c) => {
    out += c;
  });
  stderr.on('data', (c) => {
    err += c;
  });
  stdin.end(stdinData);
  return { stdin, stdout, stderr, cwd: tmpRoot, out: () => out, err: () => err };
}

// antigravity.google/docs/hooks (checked 2026-11-22)
const EVENTS = new Set(['SessionStart', 'PreToolUse', 'PostToolUse', 'PreInvocation', 'PostInvocation', 'Stop']);

describe('antigravity hooks adapter (.agents/hooks.json)', () => {
  test('detect(): .antigravity/ or .agents/hooks.json, but not a bare .agents/ (shared with Codex)', async () => {
    await mkdir(path.join(tmpRoot, '.agents', 'skills'), { recursive: true });
    assert.strictEqual(antigravity.detect(tmpRoot), false);
    await mkdir(path.join(tmpRoot, '.antigravity'), { recursive: true });
    assert.strictEqual(antigravity.detect(tmpRoot), true);
  });

  test('preset: one rune-<skill> hook per wired skill, documented events and shapes', () => {
    const cfg = antigravity.buildAntigravityPreset('gentle');
    assert.deepStrictEqual(Object.keys(cfg).sort(), WIRED_SKILLS.map((s) => `rune-${s}`).sort());
    for (const def of Object.values(cfg)) {
      for (const [event, list] of Object.entries(def)) {
        assert.ok(EVENTS.has(event), `undocumented event ${event}`);
        const handlers =
          event === 'PreToolUse' || event === 'PostToolUse'
            ? list.flatMap((g) => {
                assert.strictEqual(typeof g.matcher, 'string');
                return g.hooks;
              })
            : list;
        for (const h of handlers) {
          assert.strictEqual(h.type, 'command');
          assert.strictEqual(h.timeout, 30);
          assert.match(
            h.command,
            new RegExp(`@rune-kit/rune@\\S+ hook-dispatch \\S+ --format antigravity --event ${event} --gentle$`),
          );
        }
      }
    }
    assert.strictEqual(cfg['rune-sentinel'].PreToolUse[0].matcher, 'run_command');
  });

  test('install merges, preserves user hooks, is idempotent', async () => {
    await mkdir(path.join(tmpRoot, '.agents'), { recursive: true });
    await writeFile(path.join(tmpRoot, HOOKS), JSON.stringify({ 'my-lint': { PostToolUse: [] } }), 'utf-8');
    await installHooks(tmpRoot, { preset: 'strict', platform: 'antigravity' });
    const first = await readFile(path.join(tmpRoot, HOOKS), 'utf-8');
    const cfg = JSON.parse(first);
    assert.ok(cfg['my-lint']);
    assert.ok(cfg['rune-preflight']);
    await installHooks(tmpRoot, { preset: 'strict', platform: 'antigravity' });
    assert.strictEqual(await readFile(path.join(tmpRoot, HOOKS), 'utf-8'), first);
  });

  test('install migrates old .antigravity/rules stand-ins away', async () => {
    const legacy = path.join(tmpRoot, '.antigravity', 'rules');
    await mkdir(legacy, { recursive: true });
    await writeFile(path.join(legacy, 'rune-preflight.md'), '---\nrune-managed: true\n---\n', 'utf-8');
    await writeFile(path.join(legacy, 'mine.md'), '# mine\n', 'utf-8');
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'antigravity' });
    assert.deepStrictEqual(await readdir(legacy), ['mine.md']);
  });

  test('uninstall removes only rune-* hooks', async () => {
    await mkdir(path.join(tmpRoot, '.agents'), { recursive: true });
    await writeFile(path.join(tmpRoot, HOOKS), JSON.stringify({ 'my-lint': {} }), 'utf-8');
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'antigravity' });
    await uninstallHooks(tmpRoot, { platform: 'antigravity' });
    assert.deepStrictEqual(await read(), { 'my-lint': {} });
  });

  test('uninstall deletes hooks.json when only Rune hooks were in it', async () => {
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'antigravity' });
    await uninstallHooks(tmpRoot, { platform: 'antigravity' });
    assert.ok(!existsSync(path.join(tmpRoot, HOOKS)));
  });

  test('status reports wired skills and preset', async () => {
    await installHooks(tmpRoot, { preset: 'strict', platform: 'antigravity' });
    const r = (await hookStatus(tmpRoot, RUNE_ROOT, { platform: 'antigravity' })).results.find(
      (x) => x.platform === 'antigravity',
    );
    assert.strictEqual(r.installed, true);
    assert.strictEqual(r.preset, 'strict');
    assert.deepStrictEqual(r.missing, []);
  });

  test('emit() rejects invalid preset', async () => {
    await assert.rejects(antigravity.emit({ preset: 'weird', projectRoot: tmpRoot }), /invalid preset/);
  });
});

describe('hook-dispatch --format antigravity', () => {
  test('PreToolUse pass → {"decision":"allow"}', async () => {
    const x = io(JSON.stringify({ toolCall: { name: 'view_file', args: { AbsolutePath: '/w/src/a.ts' } } }));
    const code = await dispatchHook(['preflight', '--format', 'antigravity', '--event', 'PreToolUse'], x);
    assert.strictEqual(code, 0);
    assert.deepStrictEqual(JSON.parse(x.out()), { decision: 'allow' });
  });

  test('PreToolUse strict block → {"decision":"deny","reason"}', async () => {
    const x = io(JSON.stringify({ toolCall: { name: 'view_file', args: { AbsolutePath: '/w/.ssh/id_rsa' } } }));
    const code = await dispatchHook(['preflight', '--format', 'antigravity', '--event', 'PreToolUse'], x);
    assert.strictEqual(code, 0, 'decision travels on stdout');
    const out = JSON.parse(x.out());
    assert.strictEqual(out.decision, 'deny');
    assert.match(out.reason, /BLOCKED/);
    assert.match(x.err(), /BLOCK/);
  });

  test('PreToolUse gentle → allow + advisory', async () => {
    const x = io(JSON.stringify({ toolCall: { name: 'view_file', args: { AbsolutePath: '/w/.ssh/id_rsa' } } }));
    await dispatchHook(['preflight', '--format', 'antigravity', '--event', 'PreToolUse', '--gentle'], x);
    assert.deepStrictEqual(JSON.parse(x.out()), { decision: 'allow' });
    assert.match(x.err(), /would block/);
  });

  test('PostToolUse → {} ; Stop → {"decision":"allow"} (never "continue")', async () => {
    const post = io(JSON.stringify({ toolCall: { name: 'write_to_file', args: { TargetFile: '/w/package.json' } } }));
    await dispatchHook(['dependency-doctor', '--format', 'antigravity', '--event', 'PostToolUse'], post);
    assert.deepStrictEqual(JSON.parse(post.out()), {});
    assert.match(post.err(), /package\.json changed/);
    const stop = io(JSON.stringify({ terminationReason: 'model_stop', fullyIdle: true }));
    await dispatchHook(['completion-gate', '--format', 'antigravity', '--event', 'Stop'], stop);
    assert.deepStrictEqual(JSON.parse(stop.out()), { decision: 'allow' });
  });

  test('--event value is not mistaken for the skill name', async () => {
    const x = io('{}');
    const code = await dispatchHook(['--event', 'PreToolUse', 'sentinel', '--format', 'antigravity'], x);
    assert.strictEqual(code, 0);
    assert.match(x.err(), /rune-hook: sentinel/);
  });
});
