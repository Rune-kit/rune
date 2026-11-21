import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as cursor from '../adapters/hooks/cursor.js';
import { dispatchHook } from '../commands/hook-dispatch.js';
import { installHooks } from '../commands/hooks/install.js';
import { WIRED_SKILLS } from '../commands/hooks/presets.js';
import { hookStatus } from '../commands/hooks/status.js';
import { uninstallHooks } from '../commands/hooks/uninstall.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNE_ROOT = path.resolve(__dirname, '..', '..');
const RULES_DIR = '.cursor/rules';
const HOOKS = '.cursor/hooks.json';

function makeIO(stdinData) {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let o = '';
  stdout.on('data', (c) => {
    o += c.toString();
  });
  stderr.resume();
  stdin.end(stdinData);
  return { stdin, stdout, stderr, out: () => o };
}

let tmpRoot;

async function seedCursor(root) {
  await mkdir(path.join(root, '.cursor'), { recursive: true });
}

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(tmpdir(), 'rune-cursor-'));
});

afterEach(async () => {
  if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
});

describe('cursor adapter', () => {
  test('detect() true when .cursor exists', async () => {
    await seedCursor(tmpRoot);
    assert.strictEqual(cursor.detect(tmpRoot), true);
  });

  test('detect() false when .cursor missing', () => {
    assert.strictEqual(cursor.detect(tmpRoot), false);
  });

  // Documented keys only — cursor.com/docs/hooks (version 1, camelCase events, per-hook options)
  const DOC_EVENTS = new Set([
    'sessionStart',
    'sessionEnd',
    'preToolUse',
    'postToolUse',
    'postToolUseFailure',
    'subagentStart',
    'subagentStop',
    'beforeShellExecution',
    'afterShellExecution',
    'beforeMCPExecution',
    'afterMCPExecution',
    'beforeReadFile',
    'afterFileEdit',
    'beforeSubmitPrompt',
    'preCompact',
    'stop',
    'afterAgentResponse',
    'afterAgentThought',
  ]);
  const DOC_ENTRY_KEYS = new Set(['command', 'type', 'timeout', 'loop_limit', 'failClosed', 'matcher']);

  test('emit(gentle) writes .cursor/hooks.json with version 1 and documented events/keys only', async () => {
    const plan = await cursor.emit({ preset: 'gentle', projectRoot: tmpRoot });
    const file = plan.files.find((f) => f.path.endsWith(path.join('.cursor', 'hooks.json')));
    assert.ok(file, 'hooks.json planned');
    const cfg = JSON.parse(file.content);
    assert.strictEqual(cfg.version, 1);
    assert.deepStrictEqual(Object.keys(cfg).sort(), ['hooks', 'version']);
    for (const [event, entries] of Object.entries(cfg.hooks)) {
      assert.ok(DOC_EVENTS.has(event), `undocumented event ${event}`);
      for (const entry of entries) {
        for (const key of Object.keys(entry)) assert.ok(DOC_ENTRY_KEYS.has(key), `undocumented key ${key}`);
        assert.match(entry.command, /@rune-kit\/rune hook-dispatch \S+ --format cursor --gentle$/);
        assert.strictEqual(entry.timeout, 30);
      }
    }
    assert.deepStrictEqual(Object.keys(cfg.hooks).sort(), [
      'afterFileEdit',
      'beforeShellExecution',
      'postToolUse',
      'preToolUse',
      'stop',
    ]);
    assert.strictEqual(cfg.hooks.preToolUse[0].matcher, 'Write');
    assert.ok(!plan.files.some((f) => f.path.endsWith('.mdc')), 'no preset .mdc rules any more');
  });

  test('every wired skill is mapped to a Cursor event', () => {
    const skills = cursor.PRESET_EVENTS.map((e) => e.skill).sort();
    assert.deepStrictEqual(skills, [...WIRED_SKILLS].sort());
  });

  test('emit(strict) drops --gentle', async () => {
    const plan = await cursor.emit({ preset: 'strict', projectRoot: tmpRoot });
    const cfg = JSON.parse(plan.files[0].content);
    for (const entries of Object.values(cfg.hooks)) {
      for (const e of entries) assert.ok(!e.command.includes('--gentle'));
    }
  });

  test('installed commands emit schema-valid JSON for their event (permission hooks never get plain text)', async () => {
    const plan = await cursor.emit({ preset: 'gentle', projectRoot: tmpRoot });
    const cfg = JSON.parse(plan.files[0].content);
    for (const [event, entries] of Object.entries(cfg.hooks)) {
      const argv = entries[0].command.split(/\s+/).slice(entries[0].command.split(/\s+/).indexOf('hook-dispatch') + 1);
      const io = makeIO(JSON.stringify({ hook_event_name: event, tool_name: 'Write' }));
      const code = await dispatchHook(argv, io);
      assert.strictEqual(code, 0);
      const out = JSON.parse(io.out());
      if (['preToolUse', 'beforeShellExecution'].includes(event)) assert.deepStrictEqual(out, { permission: 'allow' });
      else assert.deepStrictEqual(out, {});
    }
  });

  test('emit(off) delegates to uninstall', async () => {
    await seedCursor(tmpRoot);
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'cursor' });
    const plan = await cursor.emit({ preset: 'off', projectRoot: tmpRoot });
    assert.ok(plan.files.every((f) => f.content === null));
    assert.ok(plan.files.length >= 1);
  });

  test('emit() rejects invalid preset', async () => {
    await assert.rejects(cursor.emit({ preset: 'loose', projectRoot: tmpRoot }), /invalid preset/);
  });

  test('install merges into an existing hooks.json and keeps user hooks', async () => {
    await seedCursor(tmpRoot);
    const user = {
      version: 1,
      hooks: { afterFileEdit: [{ command: './fmt.sh' }], sessionStart: [{ command: './hi.sh' }] },
    };
    await writeFile(path.join(tmpRoot, HOOKS), JSON.stringify(user), 'utf-8');
    const result = await installHooks(tmpRoot, { preset: 'gentle', platform: 'cursor' });
    assert.strictEqual(result.written, true);
    const cfg = JSON.parse(await readFile(path.join(tmpRoot, HOOKS), 'utf-8'));
    assert.deepStrictEqual(cfg.hooks.sessionStart, [{ command: './hi.sh' }]);
    assert.strictEqual(cfg.hooks.afterFileEdit[0].command, './fmt.sh');
    assert.strictEqual(cfg.hooks.afterFileEdit.length, 2);
  });

  test('idempotent re-install produces identical content', async () => {
    await seedCursor(tmpRoot);
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'cursor' });
    const first = await readFile(path.join(tmpRoot, HOOKS), 'utf-8');
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'cursor' });
    const second = await readFile(path.join(tmpRoot, HOOKS), 'utf-8');
    assert.strictEqual(first, second);
  });

  test('install migrates legacy preset .mdc rules but keeps user rules', async () => {
    await seedCursor(tmpRoot);
    const rulesDir = path.join(tmpRoot, RULES_DIR);
    await mkdir(rulesDir, { recursive: true });
    await writeFile(path.join(rulesDir, 'rune-preflight.mdc'), '---\nrune-managed: true\n---\n', 'utf-8');
    await writeFile(path.join(rulesDir, 'user-custom.mdc'), '---\ndescription: user\n---\n', 'utf-8');
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'cursor' });
    const remaining = await readdir(rulesDir);
    assert.deepStrictEqual(remaining, ['user-custom.mdc']);
  });

  test('uninstall strips only Rune entries and keeps user hooks + rules', async () => {
    await seedCursor(tmpRoot);
    const rulesDir = path.join(tmpRoot, RULES_DIR);
    await mkdir(rulesDir, { recursive: true });
    await writeFile(path.join(rulesDir, 'user-custom.mdc'), '---\ndescription: user\n---\n\n# User rule\n', 'utf-8');
    await writeFile(
      path.join(tmpRoot, HOOKS),
      JSON.stringify({ version: 1, hooks: { stop: [{ command: './mine.sh' }] } }),
    );

    await installHooks(tmpRoot, { preset: 'gentle', platform: 'cursor' });
    await uninstallHooks(tmpRoot, { platform: 'cursor' });

    assert.ok((await readdir(rulesDir)).includes('user-custom.mdc'), 'user rule must survive');
    const cfg = JSON.parse(await readFile(path.join(tmpRoot, HOOKS), 'utf-8'));
    assert.deepStrictEqual(cfg, { version: 1, hooks: { stop: [{ command: './mine.sh' }] } });
  });

  test('uninstall deletes hooks.json when only Rune entries were in it', async () => {
    await seedCursor(tmpRoot);
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'cursor' });
    await uninstallHooks(tmpRoot, { platform: 'cursor' });
    assert.ok(!existsSync(path.join(tmpRoot, HOOKS)));
  });

  test('warns about double-firing when .claude/settings.json already has Rune hooks', async () => {
    await seedCursor(tmpRoot);
    await mkdir(path.join(tmpRoot, '.claude'), { recursive: true });
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'claude' });
    const plan = await cursor.emit({ preset: 'gentle', projectRoot: tmpRoot });
    assert.ok(plan.notes.some((n) => /fire twice/.test(n)));
  });

  test('uninstall skips files without rune-managed signature', async () => {
    await seedCursor(tmpRoot);
    const rulesDir = path.join(tmpRoot, RULES_DIR);
    await mkdir(rulesDir, { recursive: true });
    // A file that happens to start with "rune-" but is NOT managed by Rune
    await writeFile(
      path.join(rulesDir, 'rune-fake.mdc'),
      '---\ndescription: user imposter\n---\n\nnot ours\n',
      'utf-8',
    );

    await uninstallHooks(tmpRoot, { platform: 'cursor' });
    assert.ok(existsSync(path.join(rulesDir, 'rune-fake.mdc')), 'non-managed rune-* file must survive');
  });

  test('status reports installed preset after install', async () => {
    await seedCursor(tmpRoot);
    await installHooks(tmpRoot, { preset: 'strict', platform: 'cursor' });
    const result = await hookStatus(tmpRoot, RUNE_ROOT, { platform: 'cursor' });
    const r = result.results.find((x) => x.platform === 'cursor');
    assert.strictEqual(r.installed, true);
    assert.strictEqual(r.preset, 'strict');
    assert.ok(r.wired.includes('preflight'));
    assert.ok(r.wired.includes('sentinel'));
    assert.ok(r.wired.includes('dependency-doctor'));
    assert.ok(r.wired.includes('completion-gate'));
    assert.ok(r.wired.includes('quarantine'));
  });

  test('status reports not installed when .cursor missing', async () => {
    const result = await hookStatus(tmpRoot, RUNE_ROOT, { platform: 'cursor' });
    const r = result.results.find((x) => x.platform === 'cursor');
    assert.strictEqual(r.installed, false);
    assert.ok(r.missing.includes('preflight'));
  });
});
