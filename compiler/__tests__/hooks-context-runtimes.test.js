/**
 * Context Intelligence on every runtime: Pro manifest entries with
 * platforms.<id> === "hook" install as native hooks (not rules), and
 * statusLine-user entries stay out of the repo with a setup note.
 */
import assert from 'node:assert';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { installHooks } from '../commands/hooks/install.js';
import { validateManifest } from '../commands/hooks/tiers.js';

const HOOK = {
  claude: 'hook',
  codex: 'hook',
  grok: 'hook',
  cursor: 'hook',
  antigravity: 'hook',
  gemini: 'hook',
  windsurf: 'workflow+rule',
};

const MANIFEST = {
  name: 'Rune Pro Hooks',
  tier: 'pro',
  version: '1.7.0',
  requires: ['RUNE_PRO_ROOT'],
  entries: [
    {
      id: 'context-inject',
      skill: 'context-inject',
      event: 'UserPromptSubmit',
      matcher: '.*',
      command: `node "\${RUNE_PRO_ROOT}/hooks/run-hook.cjs" context-inject`,
      platforms: { ...HOOK },
    },
    {
      id: 'context-sense',
      skill: 'context-sense',
      event: 'PreToolUse',
      matcher: 'Edit|Write',
      command: `node "\${RUNE_PRO_ROOT}/hooks/run-hook.cjs" context-sense`,
      platforms: { ...HOOK },
    },
    {
      id: 'context-pulse-gemini',
      skill: 'context-pulse',
      event: 'AfterModel',
      command: `node "\${RUNE_PRO_ROOT}/hooks/run-hook.cjs" context-pulse --format gemini`,
      platforms: {
        gemini: 'hook',
        claude: 'unsupported',
        codex: 'unsupported',
        grok: 'unsupported',
        cursor: 'unsupported',
        antigravity: 'unsupported',
        windsurf: 'unsupported',
      },
    },
    {
      id: 'context-reset-precompact',
      skill: 'context-reset',
      event: 'PreCompact',
      command: `node "\${RUNE_PRO_ROOT}/hooks/run-hook.cjs" context-reset`,
      platforms: {
        claude: 'hook',
        codex: 'hook',
        grok: 'hook',
        cursor: 'hook',
        gemini: 'hook',
        antigravity: 'unsupported',
        windsurf: 'unsupported',
      },
    },
    {
      id: 'context-reset-sessionstart',
      skill: 'context-reset',
      event: 'SessionStart',
      command: `node "\${RUNE_PRO_ROOT}/hooks/run-hook.cjs" context-reset`,
      platforms: { ...HOOK, windsurf: 'unsupported' },
    },
    {
      id: 'rune-pulse',
      skill: 'rune-pulse',
      event: 'statusLine',
      command: `node "\${RUNE_PRO_ROOT}/hooks/rune-pulse/index.cjs"`,
      padding: 0,
      platforms: {
        claude: 'statusLine',
        codex: 'unsupported',
        grok: 'statusLine-user',
        cursor: 'statusLine-user',
        antigravity: 'statusLine-user',
        gemini: 'unsupported',
        windsurf: 'unsupported',
      },
    },
  ],
};

async function seed(manifest) {
  const dir = await mkdtemp(path.join(tmpdir(), 'rune-pro-ctx-'));
  await mkdir(path.join(dir, 'hooks'), { recursive: true });
  await writeFile(path.join(dir, 'hooks', 'manifest.json'), JSON.stringify(manifest, null, 2));
  return dir;
}

let tmpRoot;
let tierRoot;
let originalRunePro;

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(tmpdir(), 'rune-ctx-proj-'));
  tierRoot = await seed(MANIFEST);
  originalRunePro = process.env.RUNE_PRO_ROOT;
  process.env.RUNE_PRO_ROOT = tierRoot;
});

afterEach(async () => {
  if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
  if (tierRoot) await rm(tierRoot, { recursive: true, force: true });
  if (originalRunePro === undefined) delete process.env.RUNE_PRO_ROOT;
  else process.env.RUNE_PRO_ROOT = originalRunePro;
});

describe('validateManifest accepts AfterModel and the live Pro 1.7.0 manifest', () => {
  test('AfterModel does not require a matcher', () => {
    const m = validateManifest({
      tier: 'pro',
      entries: [{ id: 'pulse', event: 'AfterModel', command: 'node x' }],
    });
    assert.strictEqual(m.entries[0].event, 'AfterModel');
    assert.strictEqual(m.entries[0].matcher, null);
  });

  test('the real rune-pro hooks manifest (feat/context-all-runtimes) validates', async () => {
    const live = path.resolve(fileURLToPath(import.meta.url), '../../../../rune-pro/hooks/manifest.json');
    const raw = JSON.parse(await readFile(live, 'utf-8'));
    const m = validateManifest(raw, live);
    assert.strictEqual(m.version, '1.7.0');
    assert.ok(m.entries.some((e) => e.event === 'AfterModel'));
    assert.strictEqual(m.entries.find((e) => e.id === 'context-inject').platforms.cursor, 'hook');
    assert.strictEqual(m.entries.find((e) => e.id === 'rune-pulse').platforms.grok, 'statusLine-user');
  });
});

describe('installHooks --tier pro writes native context hooks', () => {
  test('Cursor gets hybrid hook entries, not .mdc rules, plus a setup note', async () => {
    await mkdir(path.join(tmpRoot, '.cursor'), { recursive: true });
    const result = await installHooks(tmpRoot, { preset: 'off', tier: 'pro', platform: 'cursor' });
    const cfg = JSON.parse(await readFile(path.join(tmpRoot, '.cursor', 'hooks.json'), 'utf-8'));
    const events = Object.keys(cfg.hooks);
    assert.ok(events.includes('beforeSubmitPrompt'));
    assert.ok(events.includes('preToolUse'));
    assert.ok(events.includes('preCompact'));
    assert.ok(events.includes('sessionStart'));
    const inject = cfg.hooks.beforeSubmitPrompt[0];
    assert.match(inject.command, /context-inject/);
    assert.match(inject.command, /--format cursor/);
    assert.ok(inject.hooks?.[0]?.command.includes('--format cursor'));
    const sense = cfg.hooks.preToolUse.find((e) => e.command.includes('context-sense'));
    assert.equal(sense.matcher, 'Write|StrReplace');
    const rulesDir = path.join(tmpRoot, '.cursor', 'rules');
    let names = [];
    try {
      names = await readdir(rulesDir);
    } catch {
      names = [];
    }
    assert.ok(!names.includes('rune-pro-context-inject.mdc'));
    const cursor = result.results.find((r) => r.platform === 'cursor');
    assert.ok(cursor.notes.some((n) => n.includes('rune-pulse') && n.includes('setup')));
  });

  test('Antigravity writes PreInvocation / PreToolUse / SessionStart hooks and a setup note', async () => {
    await mkdir(path.join(tmpRoot, '.antigravity'), { recursive: true });
    const result = await installHooks(tmpRoot, { preset: 'off', tier: 'pro', platform: 'antigravity' });
    const cfg = JSON.parse(await readFile(path.join(tmpRoot, '.agents', 'hooks.json'), 'utf-8'));
    assert.ok(cfg['rune-pro-context-inject'].PreInvocation);
    assert.ok(cfg['rune-pro-context-sense'].PreToolUse);
    assert.ok(cfg['rune-pro-context-reset-sessionstart'].SessionStart);
    assert.equal(cfg['rune-pro-context-reset-precompact'], undefined);
    const injectCmd = cfg['rune-pro-context-inject'].PreInvocation[0].command;
    assert.match(injectCmd, /--format antigravity/);
    const notes = result.results.find((r) => r.platform === 'antigravity').notes.join('\n');
    assert.match(notes, /setup --runtime antigravity/);
  });

  test('Gemini maps events including AfterModel and PreCompress', async () => {
    await mkdir(path.join(tmpRoot, '.gemini'), { recursive: true });
    await installHooks(tmpRoot, { preset: 'off', tier: 'pro', platform: 'gemini' });
    const cfg = JSON.parse(await readFile(path.join(tmpRoot, '.gemini', 'settings.json'), 'utf-8'));
    assert.ok(cfg.hooks.BeforeAgent);
    assert.ok(cfg.hooks.BeforeTool);
    assert.ok(cfg.hooks.PreCompress);
    assert.ok(cfg.hooks.SessionStart);
    assert.ok(cfg.hooks.AfterModel);
    assert.match(cfg.hooks.BeforeAgent[0].hooks[0].command, /--format gemini/);
    assert.equal(cfg.hooks.BeforeTool[0].matcher, 'write_file|replace');
  });

  test('Grok alone gets Claude-shaped hook events; Cursor hybrid is not duplicated', async () => {
    await mkdir(path.join(tmpRoot, '.grok'), { recursive: true });
    await installHooks(tmpRoot, { preset: 'off', tier: 'pro', platform: 'grok' });
    const grokOnly = JSON.parse(await readFile(path.join(tmpRoot, '.grok', 'hooks', 'rune.json'), 'utf-8'));
    assert.ok(grokOnly.hooks.UserPromptSubmit);
    assert.ok(grokOnly.hooks.PreToolUse);
    assert.ok(grokOnly.hooks.PreCompact);
    assert.ok(grokOnly.hooks.SessionStart);
    assert.equal(grokOnly.hooks.statusLine, undefined);

    await mkdir(path.join(tmpRoot, '.cursor'), { recursive: true });
    const result = await installHooks(tmpRoot, { preset: 'gentle', tier: 'pro', platform: 'cursor,grok' });
    const grokShared = JSON.parse(await readFile(path.join(tmpRoot, '.grok', 'hooks', 'rune.json'), 'utf-8'));
    // Cursor already emits these as hybrid hooks that Grok Build runs.
    assert.equal(grokShared.hooks?.UserPromptSubmit, undefined);
    const notes = result.results.find((r) => r.platform === 'grok').notes.join('\n');
    assert.match(notes, /setup --runtime grok|skipped Grok-unsupported/);
  });
});
