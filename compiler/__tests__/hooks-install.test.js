import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { installHooks } from '../commands/hooks/install.js';
import { SETTINGS_REL_PATH } from '../commands/hooks/presets.js';
import { hookStatus } from '../commands/hooks/status.js';
import { uninstallHooks } from '../commands/hooks/uninstall.js';

const RUNE_ROOT = path.resolve(import.meta.dirname, '..', '..');

let tmpRoot;

async function seedClaude(root) {
  await mkdir(path.join(root, '.claude'), { recursive: true });
}

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(tmpdir(), 'rune-hooks-'));
});

afterEach(async () => {
  if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
});

describe('installHooks (claude adapter)', () => {
  test('fresh install writes .claude/settings.json with gentle preset', async () => {
    await seedClaude(tmpRoot);
    const result = await installHooks(tmpRoot, { preset: 'gentle' });
    assert.strictEqual(result.preset, 'gentle');
    assert.strictEqual(result.written, true);
    assert.deepStrictEqual(result.platforms, ['claude']);

    const settingsPath = path.join(tmpRoot, SETTINGS_REL_PATH);
    assert.ok(existsSync(settingsPath));

    const settings = JSON.parse(await readFile(settingsPath, 'utf-8'));
    assert.ok(settings.hooks?.PreToolUse);
    assert.ok(settings.hooks?.Stop);
  });

  test('defaults to gentle when preset omitted', async () => {
    await seedClaude(tmpRoot);
    const result = await installHooks(tmpRoot, {});
    assert.strictEqual(result.preset, 'gentle');
    const settings = JSON.parse(await readFile(path.join(tmpRoot, SETTINGS_REL_PATH), 'utf-8'));
    const stopCmd = settings.hooks.Stop[0].hooks[0].command;
    assert.ok(stopCmd.includes('--gentle'));
  });

  test('re-install with same preset is idempotent', async () => {
    await seedClaude(tmpRoot);
    await installHooks(tmpRoot, { preset: 'gentle' });
    const first = await readFile(path.join(tmpRoot, SETTINGS_REL_PATH), 'utf-8');
    await installHooks(tmpRoot, { preset: 'gentle' });
    const second = await readFile(path.join(tmpRoot, SETTINGS_REL_PATH), 'utf-8');
    assert.strictEqual(first, second);
  });

  test('upgrade gentle → strict replaces Rune entries', async () => {
    await seedClaude(tmpRoot);
    await installHooks(tmpRoot, { preset: 'gentle' });
    await installHooks(tmpRoot, { preset: 'strict' });
    const settings = JSON.parse(await readFile(path.join(tmpRoot, SETTINGS_REL_PATH), 'utf-8'));
    const preflightCmd = settings.hooks.PreToolUse[0].hooks[0].command;
    assert.ok(!preflightCmd.includes('--gentle'), 'strict should not have --gentle');
  });

  test('preserves user hooks when installing', async () => {
    const settingsDir = path.join(tmpRoot, '.claude');
    await mkdir(settingsDir, { recursive: true });
    await writeFile(
      path.join(settingsDir, 'settings.json'),
      JSON.stringify(
        {
          env: { MY_VAR: 'keep-me' },
          hooks: {
            PreToolUse: [{ matcher: 'Read', hooks: [{ type: 'command', command: 'user-read-hook.sh' }] }],
          },
        },
        null,
        2,
      ),
    );

    await installHooks(tmpRoot, { preset: 'gentle' });
    const settings = JSON.parse(await readFile(path.join(settingsDir, 'settings.json'), 'utf-8'));
    assert.deepStrictEqual(settings.env, { MY_VAR: 'keep-me' }, 'env preserved');
    const readGroup = settings.hooks.PreToolUse.find((g) => g.matcher === 'Read');
    assert.ok(readGroup, 'user Read matcher preserved');
    assert.strictEqual(readGroup.hooks[0].command, 'user-read-hook.sh');
  });

  test('rejects invalid preset', async () => {
    await seedClaude(tmpRoot);
    await assert.rejects(installHooks(tmpRoot, { preset: 'loose' }), /Invalid preset/);
  });

  test('dry-run does not write', async () => {
    await seedClaude(tmpRoot);
    const result = await installHooks(tmpRoot, { preset: 'gentle', dry: true });
    assert.strictEqual(result.written, false);
    assert.ok(!existsSync(path.join(tmpRoot, SETTINGS_REL_PATH)));
  });

  test('preset=off uninstalls rune hooks only', async () => {
    await seedClaude(tmpRoot);
    await installHooks(tmpRoot, { preset: 'gentle' });
    const result = await installHooks(tmpRoot, { preset: 'off' });
    assert.strictEqual(result.preset, 'off');
    const settings = JSON.parse(await readFile(path.join(tmpRoot, SETTINGS_REL_PATH), 'utf-8'));
    assert.strictEqual(settings.hooks, undefined);
  });

  test('T1: preset=off with no settings.json does not create the file', async () => {
    await seedClaude(tmpRoot);
    const settingsPath = path.join(tmpRoot, SETTINGS_REL_PATH);
    assert.ok(!existsSync(settingsPath), 'precondition: file must not exist');
    const result = await installHooks(tmpRoot, { preset: 'off' });
    // H1 fix: written reflects actual byte writes, not just !dry
    assert.strictEqual(result.written, false);
    assert.ok(result.notes.some((n) => n.includes('no changes')));
    const claudeResult = result.results.find((r) => r.platform === 'claude');
    assert.strictEqual(claudeResult.files.length, 0, 'no files should be written for off+missing');
    assert.strictEqual(claudeResult.writes, 0);
    assert.ok(!existsSync(settingsPath), 'settings.json must NOT have been created');
  });

  test('T2: malformed settings.json causes actionable error, file unchanged', async () => {
    const settingsDir = path.join(tmpRoot, '.claude');
    await mkdir(settingsDir, { recursive: true });
    const settingsPath = path.join(settingsDir, 'settings.json');
    const malformed = '{ not valid json }';
    await writeFile(settingsPath, malformed, 'utf-8');
    await assert.rejects(installHooks(tmpRoot, { preset: 'gentle' }), (err) => {
      assert.ok(err.message.includes('settings.json'), 'error must mention settings.json');
      return true;
    });
    assert.strictEqual(await readFile(settingsPath, 'utf-8'), malformed);
  });

  test('auto-detects no platforms → returns empty results with note', async () => {
    const result = await installHooks(tmpRoot, { preset: 'gentle' });
    assert.deepStrictEqual(result.platforms, []);
    assert.strictEqual(result.written, false);
    assert.ok(result.notes.some((n) => n.includes('No target platform')));
  });

  test('--platform claude forces install even without .claude/', async () => {
    const result = await installHooks(tmpRoot, { preset: 'gentle', platform: 'claude' });
    assert.deepStrictEqual(result.platforms, ['claude']);
    assert.strictEqual(result.written, true);
    assert.ok(existsSync(path.join(tmpRoot, SETTINGS_REL_PATH)));
  });

  test('--platform all targets only detected platforms (no silent dir creation)', async () => {
    // Bare dir → no platforms detected → all expands to nothing
    const bare = await installHooks(tmpRoot, { preset: 'gentle', platform: 'all' });
    assert.deepStrictEqual(bare.platforms, []);
    assert.strictEqual(bare.written, false);

    // Seed .claude/ + .cursor/ only → all picks up those two, NOT windsurf/antigravity
    await seedClaude(tmpRoot);
    await mkdir(path.join(tmpRoot, '.cursor'), { recursive: true });
    const result = await installHooks(tmpRoot, { preset: 'gentle', platform: 'all' });
    assert.ok(result.platforms.includes('claude'));
    assert.ok(result.platforms.includes('cursor'));
    assert.ok(!result.platforms.includes('windsurf'), 'must not force-create windsurf dir');
    assert.ok(!result.platforms.includes('antigravity'), 'must not force-create antigravity dir');
    assert.ok(!existsSync(path.join(tmpRoot, '.windsurf')));
    assert.ok(!existsSync(path.join(tmpRoot, '.antigravity')));
  });

  test('--platform <name> still force-creates the platform dir (explicit opt-in)', async () => {
    const result = await installHooks(tmpRoot, { preset: 'gentle', platform: 'cursor' });
    assert.deepStrictEqual(result.platforms, ['cursor']);
    assert.ok(existsSync(path.join(tmpRoot, '.cursor', 'rules')));
  });

  test('unknown --platform rejected', async () => {
    await assert.rejects(installHooks(tmpRoot, { preset: 'gentle', platform: 'bogus' }), /Unknown platform/);
  });
});

describe('uninstallHooks (claude adapter)', () => {
  test('no-op when no platforms detected', async () => {
    const result = await uninstallHooks(tmpRoot);
    assert.deepStrictEqual(result.platforms, []);
    assert.strictEqual(result.written, false);
  });

  test('no-op when .claude/ exists but no settings.json', async () => {
    await seedClaude(tmpRoot);
    const result = await uninstallHooks(tmpRoot);
    assert.deepStrictEqual(result.platforms, ['claude']);
    // H1 fix: written=false when no actual writes happened
    assert.strictEqual(result.written, false);
    const claudeResult = result.results.find((r) => r.platform === 'claude');
    assert.strictEqual(claudeResult.files.length, 0);
    assert.strictEqual(claudeResult.writes, 0);
  });

  test('removes Rune hooks, preserves user hooks', async () => {
    const settingsDir = path.join(tmpRoot, '.claude');
    await mkdir(settingsDir, { recursive: true });
    await writeFile(
      path.join(settingsDir, 'settings.json'),
      JSON.stringify(
        {
          hooks: {
            PreToolUse: [
              {
                matcher: 'Edit|Write',
                hooks: [
                  { type: 'command', command: 'npx --yes @rune-kit/rune hook-dispatch preflight' },
                  { type: 'command', command: 'user-lint.sh' },
                ],
              },
            ],
          },
        },
        null,
        2,
      ),
    );

    const result = await uninstallHooks(tmpRoot);
    assert.strictEqual(result.written, true);
    const settings = JSON.parse(await readFile(path.join(settingsDir, 'settings.json'), 'utf-8'));
    const editGroup = settings.hooks.PreToolUse.find((g) => g.matcher === 'Edit|Write');
    assert.strictEqual(editGroup.hooks.length, 1);
    assert.strictEqual(editGroup.hooks[0].command, 'user-lint.sh');
  });

  test('T4: user hook preserved exactly through install/uninstall round-trip', async () => {
    const settingsDir = path.join(tmpRoot, '.claude');
    await mkdir(settingsDir, { recursive: true });
    const userCommand = 'my-rune hook-dispatch-notes.sh';
    const initialSettings = {
      hooks: {
        PreToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: userCommand }] }],
      },
    };
    await writeFile(path.join(settingsDir, 'settings.json'), JSON.stringify(initialSettings, null, 2));

    await installHooks(tmpRoot, { preset: 'gentle' });
    await uninstallHooks(tmpRoot);

    const settings = JSON.parse(await readFile(path.join(settingsDir, 'settings.json'), 'utf-8'));
    const editGroup = settings.hooks?.PreToolUse?.find((g) => g.matcher === 'Edit|Write');
    assert.ok(editGroup, 'user Edit|Write group must survive');
    assert.ok(
      editGroup.hooks.some((h) => h.command === userCommand),
      `user command "${userCommand}" must be preserved exactly`,
    );
  });

  test('malformed settings.json causes actionable error on uninstall', async () => {
    const settingsDir = path.join(tmpRoot, '.claude');
    await mkdir(settingsDir, { recursive: true });
    await writeFile(path.join(settingsDir, 'settings.json'), '{ broken json', 'utf-8');
    await assert.rejects(uninstallHooks(tmpRoot), (err) => {
      assert.ok(err.message.includes('settings.json') || err.message.includes('JSON'));
      return true;
    });
  });
});

describe('hookStatus (claude adapter)', () => {
  test('reports empty platforms when nothing detected', async () => {
    const result = await hookStatus(tmpRoot, RUNE_ROOT);
    assert.deepStrictEqual(result.platforms, []);
  });

  test('reports none for .claude/ without settings', async () => {
    await seedClaude(tmpRoot);
    const result = await hookStatus(tmpRoot, RUNE_ROOT);
    const claude = result.results.find((r) => r.platform === 'claude');
    assert.strictEqual(claude.installed, false);
    assert.strictEqual(claude.preset, null);
  });

  test('reports gentle preset after install', async () => {
    await seedClaude(tmpRoot);
    await installHooks(tmpRoot, { preset: 'gentle' });
    const result = await hookStatus(tmpRoot, RUNE_ROOT);
    const claude = result.results.find((r) => r.platform === 'claude');
    assert.strictEqual(claude.installed, true);
    assert.strictEqual(claude.preset, 'gentle');
    assert.ok(claude.events.PreToolUse.includes('preflight'));
    assert.ok(claude.events.Stop.includes('completion-gate'));
  });

  test('--platform all surfaces every adapter', async () => {
    const result = await hookStatus(tmpRoot, RUNE_ROOT, { platform: 'all' });
    assert.strictEqual(result.results.length, 4);
    for (const id of ['claude', 'cursor', 'windsurf', 'antigravity']) {
      const r = result.results.find((x) => x.platform === id);
      assert.ok(r, `result for ${id} must be present`);
      assert.ok(r.capability, `capability matrix for ${id} must be present`);
    }
  });
});
