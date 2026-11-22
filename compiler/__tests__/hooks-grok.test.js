import assert from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { HOOK_TIMEOUT_SECONDS } from '../adapters/hooks/grok.js';
import { installHooks } from '../commands/hooks/install.js';
import { hookStatus } from '../commands/hooks/status.js';
import { uninstallHooks } from '../commands/hooks/uninstall.js';

let tmpRoot;
const hooksPath = (root) => path.join(root, '.grok', 'hooks', 'rune.json');

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(tmpdir(), 'rune-grok-hooks-'));
  await mkdir(path.join(tmpRoot, '.grok'), { recursive: true });
});

afterEach(async () => {
  if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
});

// Schema per docs.x.ai/build/features/hooks: project hooks in .grok/hooks/*.json,
// { hooks: { Event: [{ matcher?, hooks: [{ type, command, timeout }] }] } }.
const DOCUMENTED_HOOK_KEYS = new Set(['type', 'command', 'url', 'timeout']);
const GROK_EVENTS = new Set([
  'SessionStart',
  'SessionEnd',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PermissionDenied',
  'Stop',
  'StopFailure',
  'Notification',
  'SubagentStart',
  'SubagentStop',
  'PreCompact',
  'PostCompact',
]);

describe('Grok Build hooks adapter', () => {
  test('auto-detects .grok/ and writes .grok/hooks/rune.json with documented keys only', async () => {
    const result = await installHooks(tmpRoot, { preset: 'gentle' });
    assert.deepStrictEqual(result.platforms, ['grok']);
    const config = JSON.parse(await readFile(hooksPath(tmpRoot), 'utf-8'));
    assert.deepStrictEqual(Object.keys(config), ['hooks']);
    for (const [event, groups] of Object.entries(config.hooks)) {
      assert.ok(GROK_EVENTS.has(event), `undocumented event ${event}`);
      for (const group of groups) {
        for (const hook of group.hooks) {
          for (const k of Object.keys(hook)) assert.ok(DOCUMENTED_HOOK_KEYS.has(k), `undocumented key ${k}`);
          assert.strictEqual(hook.type, 'command');
          assert.strictEqual(hook.timeout, HOOK_TIMEOUT_SECONDS);
        }
      }
    }
    assert.ok(config.hooks.PreToolUse && config.hooks.PostToolUse && config.hooks.Stop);
    assert.strictEqual('matcher' in config.hooks.Stop[0], false);
    assert.ok(result.results[0].notes.some((n) => n.includes('/hooks-trust')));
  });

  test('strict preset drops --gentle', async () => {
    await installHooks(tmpRoot, { preset: 'strict', platform: 'grok' });
    const raw = await readFile(hooksPath(tmpRoot), 'utf-8');
    assert.doesNotMatch(raw, /--gentle/);
    assert.match(raw, /hook-dispatch preflight/);
  });

  test('status reports wired skills and preset', async () => {
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'grok' });
    const status = await hookStatus(tmpRoot, path.resolve('.'), { platform: 'grok' });
    const grok = status.results.find((r) => r.platform === 'grok');
    assert.strictEqual(grok.installed, true);
    assert.strictEqual(grok.preset, 'gentle');
    assert.ok(grok.wired.includes('preflight'));
  });

  test('warns when .claude/settings.json already carries Rune hooks (Grok reads both)', async () => {
    await mkdir(path.join(tmpRoot, '.claude'), { recursive: true });
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'claude' });
    const result = await installHooks(tmpRoot, { preset: 'gentle', platform: 'grok' });
    assert.ok(result.results[0].notes.some((n) => n.includes('fire twice')));
  });

  test('uninstall deletes the Rune-owned file and leaves other hook files alone', async () => {
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'grok' });
    const userFile = path.join(tmpRoot, '.grok', 'hooks', 'user.json');
    await writeFile(userFile, '{"hooks":{}}\n');
    await uninstallHooks(tmpRoot, { platform: 'grok' });
    assert.strictEqual(existsSync(hooksPath(tmpRoot)), false);
    assert.strictEqual(existsSync(userFile), true);
  });
});

describe('Grok Build + Cursor: one registration (v2.33.0)', () => {
  test('installing cursor and grok together writes only .cursor/hooks.json (Grok runs it)', async () => {
    await mkdir(path.join(tmpRoot, '.cursor'), { recursive: true });
    const result = await installHooks(tmpRoot, { preset: 'strict', platform: ['cursor', 'grok'] });
    assert.ok(existsSync(path.join(tmpRoot, '.cursor', 'hooks.json')));
    assert.ok(!existsSync(hooksPath(tmpRoot)), 'no .grok/hooks/rune.json — Grok would fire every gate twice');
    const grokNotes = result.results.find((r) => r.platform === 'grok').notes.join(' ');
    assert.match(grokNotes, /runs Rune's \.cursor\/hooks\.json/);
  });

  test('cursor install removes an earlier Free-preset .grok/hooks/rune.json', async () => {
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'grok' });
    assert.ok(existsSync(hooksPath(tmpRoot)));
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'cursor' });
    assert.ok(!existsSync(hooksPath(tmpRoot)));
  });

  test('a later grok install does not re-add the duplicate', async () => {
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'cursor' });
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'grok' });
    assert.ok(!existsSync(hooksPath(tmpRoot)));
  });

  test('every Cursor entry carries a matcher group Grok can load', async () => {
    await installHooks(tmpRoot, { preset: 'strict', platform: 'cursor' });
    const cfg = JSON.parse(await readFile(path.join(tmpRoot, '.cursor', 'hooks.json'), 'utf-8'));
    for (const entries of Object.values(cfg.hooks)) {
      for (const e of entries) {
        assert.ok(Array.isArray(e.hooks) && e.hooks.length === 1);
        assert.strictEqual(e.hooks[0].type, 'command');
        assert.strictEqual(e.hooks[0].command, e.command);
      }
    }
  });
});

// Live: the real Grok Build CLI loads Rune's Cursor hooks with zero load errors.
const hasGrok = spawnSync('grok', ['--version'], { encoding: 'utf8' }).status === 0;
describe('grok CLI live check', { skip: !hasGrok && 'grok CLI not installed' }, () => {
  test('grok inspect: 5 Rune hooks from .cursor/hooks.json, no hookLoadErrors', async () => {
    execFileSync('git', ['init', '-q'], { cwd: tmpRoot });
    await mkdir(path.join(tmpRoot, '.cursor'), { recursive: true });
    await installHooks(tmpRoot, { preset: 'strict', platform: ['cursor', 'grok'] });
    const home = await mkdtemp(path.join(tmpdir(), 'rune-grok-home-'));
    try {
      const out = execFileSync('grok', ['inspect', '--json'], {
        cwd: tmpRoot,
        env: { ...process.env, GROK_HOME: home, GROK_FOLDER_TRUST: '0' },
        encoding: 'utf8',
      });
      const d = JSON.parse(out);
      assert.deepStrictEqual(d.hookLoadErrors || [], []);
      const rune = d.hooks.filter((h) => /@rune-kit\/rune@\S+ hook-dispatch/.test(h.target || ''));
      assert.strictEqual(rune.length, 5);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
