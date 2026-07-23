import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { installHooks } from '../commands/hooks/install.js';
import { hookStatus } from '../commands/hooks/status.js';
import { uninstallHooks } from '../commands/hooks/uninstall.js';

let tmpRoot;
const runeRoot = path.resolve('.');
const hooksPath = (root) => path.join(root, '.codex', 'hooks.json');

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(tmpdir(), 'rune-codex-hooks-'));
  await mkdir(path.join(tmpRoot, '.codex'), { recursive: true });
});

afterEach(async () => {
  if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
});

describe('Codex hooks adapter', () => {
  test('auto-detects Codex and emits executable synchronous hooks', async () => {
    const result = await installHooks(tmpRoot, { preset: 'gentle' });
    assert.deepStrictEqual(result.platforms, ['codex']);
    assert.strictEqual(result.written, true);

    const config = JSON.parse(await readFile(hooksPath(tmpRoot), 'utf-8'));
    assert.ok(config.hooks.PreToolUse);
    assert.ok(config.hooks.PostToolUse);
    assert.ok(config.hooks.Stop);
    assert.ok(result.results[0].notes.some((note) => note.includes('/hooks')));

    for (const groups of Object.values(config.hooks)) {
      for (const group of groups) {
        for (const hook of group.hooks) {
          assert.strictEqual('async' in hook, false, 'Codex skips async handlers');
        }
      }
    }
    assert.strictEqual('matcher' in config.hooks.Stop[0], false, 'Stop matchers are ignored by Codex');
  });

  test('preserves user hooks across install and uninstall', async () => {
    const userConfig = {
      description: 'User hooks',
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'user-policy.cmd' }] }],
      },
    };
    await writeFile(hooksPath(tmpRoot), `${JSON.stringify(userConfig, null, 2)}\n`);

    await installHooks(tmpRoot, { preset: 'strict' });
    await uninstallHooks(tmpRoot, { platform: 'codex' });

    const restored = JSON.parse(await readFile(hooksPath(tmpRoot), 'utf-8'));
    assert.deepStrictEqual(restored, userConfig);
  });

  test('status reports the active preset and wired skills', async () => {
    await installHooks(tmpRoot, { preset: 'gentle' });
    const result = await hookStatus(tmpRoot, runeRoot);
    const codex = result.results.find((entry) => entry.platform === 'codex');
    assert.strictEqual(codex.installed, true);
    assert.strictEqual(codex.preset, 'gentle');
    assert.ok(codex.wired.includes('sentinel'));
    assert.ok(codex.wired.includes('completion-gate'));
    assert.strictEqual(codex.capability.maturity, 'stable');
  });

  test('removes Rune-only hooks.json on uninstall', async () => {
    await installHooks(tmpRoot, { preset: 'gentle' });
    await uninstallHooks(tmpRoot, { platform: 'codex' });
    assert.strictEqual(existsSync(hooksPath(tmpRoot)), false);
  });

  test('rejects malformed Codex hooks config without overwriting it', async () => {
    const malformed = '{ broken json';
    await writeFile(hooksPath(tmpRoot), malformed);
    await assert.rejects(installHooks(tmpRoot, { preset: 'gentle' }), /hooks\.json is not valid JSON/);
    assert.strictEqual(await readFile(hooksPath(tmpRoot), 'utf-8'), malformed);
  });
});
