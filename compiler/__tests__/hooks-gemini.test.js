import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as gemini from '../adapters/hooks/gemini.js';
import { dispatchHook } from '../commands/hook-dispatch.js';
import { installHooks } from '../commands/hooks/install.js';
import { WIRED_SKILLS } from '../commands/hooks/presets.js';
import { hookStatus } from '../commands/hooks/status.js';
import { uninstallHooks } from '../commands/hooks/uninstall.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNE_ROOT = path.resolve(__dirname, '..', '..');
const SETTINGS = '.gemini/settings.json';

// geminicli docs/hooks/index.md — event table + hook configuration fields
const DOC_EVENTS = new Set([
  'SessionStart',
  'SessionEnd',
  'BeforeAgent',
  'AfterAgent',
  'BeforeModel',
  'AfterModel',
  'BeforeToolSelection',
  'BeforeTool',
  'AfterTool',
  'PreCompress',
  'Notification',
]);
const DOC_GROUP_KEYS = new Set(['matcher', 'sequential', 'hooks']);
const DOC_HOOK_KEYS = new Set(['type', 'command', 'name', 'timeout', 'description']);
const LIFECYCLE = new Set(['SessionStart', 'SessionEnd', 'BeforeAgent', 'AfterAgent', 'PreCompress', 'Notification']);

let tmpRoot;
beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(tmpdir(), 'rune-gemini-'));
});
afterEach(async () => {
  if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
});

async function seed(settings) {
  await mkdir(path.join(tmpRoot, '.gemini'), { recursive: true });
  if (settings) await writeFile(path.join(tmpRoot, SETTINGS), JSON.stringify(settings, null, 2));
}
const read = async () => JSON.parse(await readFile(path.join(tmpRoot, SETTINGS), 'utf-8'));

describe('gemini hooks adapter', () => {
  test('detect() follows .gemini/', async () => {
    assert.strictEqual(gemini.detect(tmpRoot), false);
    await seed();
    assert.strictEqual(gemini.detect(tmpRoot), true);
  });

  test('preset uses documented events, keys, ms timeouts and Gemini tool names', () => {
    const { hooks } = gemini.buildGeminiPreset('gentle');
    for (const [event, groups] of Object.entries(hooks)) {
      assert.ok(DOC_EVENTS.has(event), `undocumented event ${event}`);
      for (const group of groups) {
        for (const k of Object.keys(group)) assert.ok(DOC_GROUP_KEYS.has(k), `undocumented group key ${k}`);
        if (LIFECYCLE.has(event))
          assert.ok(!('matcher' in group), 'lifecycle events take exact-string matchers; Rune omits them');
        for (const h of group.hooks) {
          for (const k of Object.keys(h)) assert.ok(DOC_HOOK_KEYS.has(k), `undocumented hook key ${k}`);
          assert.strictEqual(h.type, 'command');
          assert.strictEqual(h.timeout, 30000, 'Gemini timeouts are milliseconds');
          assert.match(h.command, /@rune-kit\/rune hook-dispatch \S+ --format gemini --gentle$/);
        }
      }
    }
    assert.deepStrictEqual(Object.keys(hooks).sort(), ['AfterAgent', 'AfterTool', 'BeforeTool']);
    assert.strictEqual(hooks.BeforeTool[0].matcher, 'write_file|replace');
    assert.strictEqual(hooks.BeforeTool[1].matcher, 'run_shell_command');
  });

  test('every wired skill is mapped', () => {
    assert.deepStrictEqual(gemini.PRESET_EVENTS.map((e) => e.skill).sort(), [...WIRED_SKILLS].sort());
  });

  test('installed commands print pure JSON on stdout (Golden Rule)', async () => {
    for (const { skill } of gemini.PRESET_EVENTS) {
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      let out = '';
      stdout.on('data', (c) => {
        out += c;
      });
      stderr.resume();
      stdin.end(JSON.stringify({ hook_event_name: 'BeforeTool', tool_name: 'write_file' }));
      const code = await dispatchHook([skill, '--format', 'gemini', '--gentle'], { stdin, stdout, stderr });
      assert.strictEqual(code, 0);
      assert.deepStrictEqual(JSON.parse(out), {});
    }
  });

  test('install merges into existing settings.json without touching other settings or user hooks', async () => {
    await seed({
      theme: 'Dracula',
      hooks: { BeforeTool: [{ matcher: 'write_file|replace', hooks: [{ type: 'command', command: './mine.sh' }] }] },
    });
    const result = await installHooks(tmpRoot, { preset: 'gentle', platform: 'gemini' });
    assert.strictEqual(result.written, true);
    const s = await read();
    assert.strictEqual(s.theme, 'Dracula');
    const group = s.hooks.BeforeTool.find((g) => g.matcher === 'write_file|replace');
    assert.strictEqual(group.hooks[0].command, './mine.sh');
    assert.strictEqual(group.hooks.length, 2);
  });

  test('re-install is idempotent; strict replaces gentle', async () => {
    await seed();
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'gemini' });
    const first = await readFile(path.join(tmpRoot, SETTINGS), 'utf-8');
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'gemini' });
    assert.strictEqual(await readFile(path.join(tmpRoot, SETTINGS), 'utf-8'), first);
    await installHooks(tmpRoot, { preset: 'strict', platform: 'gemini' });
    assert.ok(!(await readFile(path.join(tmpRoot, SETTINGS), 'utf-8')).includes('--gentle'));
  });

  test('uninstall keeps user settings and hooks, removes only Rune entries', async () => {
    const user = { theme: 'Dracula', hooks: { AfterAgent: [{ hooks: [{ type: 'command', command: './audit.sh' }] }] } };
    await seed(user);
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'gemini' });
    await uninstallHooks(tmpRoot, { platform: 'gemini' });
    assert.deepStrictEqual(await read(), user);
  });

  test('uninstall deletes settings.json only when Rune hooks were all it held', async () => {
    await seed();
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'gemini' });
    await uninstallHooks(tmpRoot, { platform: 'gemini' });
    assert.ok(!existsSync(path.join(tmpRoot, SETTINGS)));
  });

  test('install never touches Claude or Grok hook files', async () => {
    await seed();
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'gemini' });
    assert.ok(!existsSync(path.join(tmpRoot, '.claude')));
    assert.ok(!existsSync(path.join(tmpRoot, '.grok')));
  });

  test('status reports preset and all wired skills', async () => {
    await seed();
    await installHooks(tmpRoot, { preset: 'strict', platform: 'gemini' });
    const r = (await hookStatus(tmpRoot, RUNE_ROOT, { platform: 'gemini' })).results.find(
      (x) => x.platform === 'gemini',
    );
    assert.strictEqual(r.installed, true);
    assert.strictEqual(r.preset, 'strict');
    assert.deepStrictEqual([...r.wired].sort(), [...WIRED_SKILLS].sort());
  });

  test('malformed settings.json gives an actionable error', async () => {
    await seed();
    await writeFile(path.join(tmpRoot, SETTINGS), '{ nope');
    await assert.rejects(gemini.emit({ preset: 'gentle', projectRoot: tmpRoot }), /not valid JSON/);
  });
});
