import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import * as cursor from '../adapters/hooks/cursor.js';
import { installHooks } from '../commands/hooks/install.js';
import { hookStatus } from '../commands/hooks/status.js';
import { uninstallHooks } from '../commands/hooks/uninstall.js';

const RUNE_ROOT = path.resolve(import.meta.dirname, '..', '..');
const RULES_DIR = '.cursor/rules';

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

  test('emit(gentle) returns 3 .mdc rule files', async () => {
    const plan = await cursor.emit({ preset: 'gentle', projectRoot: tmpRoot });
    assert.strictEqual(plan.files.length, 3);
    const names = plan.files.map((f) => path.basename(f.path)).sort();
    assert.deepStrictEqual(names, ['rune-dependency-doctor.mdc', 'rune-preflight.mdc', 'rune-sentinel.mdc']);
    for (const file of plan.files) {
      assert.ok(file.content.includes('rune-managed: true'));
      assert.ok(file.content.includes('@rune-kit/rune hook-dispatch'));
    }
  });

  test('emit(strict) renders WARN → BLOCK guidance', async () => {
    const gentle = await cursor.emit({ preset: 'gentle', projectRoot: tmpRoot });
    const strict = await cursor.emit({ preset: 'strict', projectRoot: tmpRoot });
    const gentlePreflight = gentle.files.find((f) => f.path.endsWith('rune-preflight.mdc')).content;
    const strictPreflight = strict.files.find((f) => f.path.endsWith('rune-preflight.mdc')).content;
    assert.ok(gentlePreflight.includes('WARN'));
    assert.ok(strictPreflight.includes('BLOCK'));
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

  test('install writes .mdc files to .cursor/rules/', async () => {
    await seedCursor(tmpRoot);
    const result = await installHooks(tmpRoot, { preset: 'gentle', platform: 'cursor' });
    assert.strictEqual(result.written, true);
    const rulesDir = path.join(tmpRoot, RULES_DIR);
    const files = await readdir(rulesDir);
    assert.ok(files.includes('rune-preflight.mdc'));
    assert.ok(files.includes('rune-sentinel.mdc'));
    assert.ok(files.includes('rune-dependency-doctor.mdc'));
  });

  test('idempotent re-install produces identical content', async () => {
    await seedCursor(tmpRoot);
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'cursor' });
    const rulesDir = path.join(tmpRoot, RULES_DIR);
    const first = await readFile(path.join(rulesDir, 'rune-preflight.mdc'), 'utf-8');
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'cursor' });
    const second = await readFile(path.join(rulesDir, 'rune-preflight.mdc'), 'utf-8');
    assert.strictEqual(first, second);
  });

  test('uninstall removes only Rune-managed .mdc files', async () => {
    await seedCursor(tmpRoot);
    const rulesDir = path.join(tmpRoot, RULES_DIR);
    await mkdir(rulesDir, { recursive: true });
    await writeFile(path.join(rulesDir, 'user-custom.mdc'), '---\ndescription: user\n---\n\n# User rule\n', 'utf-8');

    await installHooks(tmpRoot, { preset: 'gentle', platform: 'cursor' });
    await uninstallHooks(tmpRoot, { platform: 'cursor' });

    const remaining = await readdir(rulesDir);
    assert.ok(remaining.includes('user-custom.mdc'), 'user rule must survive');
    assert.ok(!remaining.some((f) => f.startsWith('rune-')), 'no rune-* files should remain');
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
  });

  test('status reports not installed when .cursor missing', async () => {
    const result = await hookStatus(tmpRoot, RUNE_ROOT, { platform: 'cursor' });
    const r = result.results.find((x) => x.platform === 'cursor');
    assert.strictEqual(r.installed, false);
    assert.ok(r.missing.includes('preflight'));
  });
});
