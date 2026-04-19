import assert from 'node:assert';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as windsurf from '../adapters/hooks/windsurf.js';
import { installHooks } from '../commands/hooks/install.js';
import { hookStatus } from '../commands/hooks/status.js';
import { uninstallHooks } from '../commands/hooks/uninstall.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNE_ROOT = path.resolve(__dirname, '..', '..');
const WF_DIR = '.windsurf/workflows';
const RULES_DIR = '.windsurf/rules';

let tmpRoot;

async function seedWindsurf(root) {
  await mkdir(path.join(root, '.windsurf'), { recursive: true });
}

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(tmpdir(), 'rune-windsurf-'));
});

afterEach(async () => {
  if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
});

describe('windsurf adapter', () => {
  test('detect() true when .windsurf exists', async () => {
    await seedWindsurf(tmpRoot);
    assert.strictEqual(windsurf.detect(tmpRoot), true);
  });

  test('emit(gentle) returns both workflows and rules (6 files)', async () => {
    const plan = await windsurf.emit({ preset: 'gentle', projectRoot: tmpRoot });
    assert.strictEqual(plan.files.length, 6);
    const workflows = plan.files.filter((f) => f.path.includes('workflows'));
    const rules = plan.files.filter((f) => f.path.includes('rules'));
    assert.strictEqual(workflows.length, 3);
    assert.strictEqual(rules.length, 3);
    for (const file of plan.files) {
      assert.ok(file.content.includes('rune-managed: true'));
    }
  });

  test('emit(strict) renders BLOCK mode', async () => {
    const plan = await windsurf.emit({ preset: 'strict', projectRoot: tmpRoot });
    for (const file of plan.files) {
      assert.ok(file.content.includes('BLOCK'));
    }
  });

  test('emit() rejects invalid preset', async () => {
    await assert.rejects(windsurf.emit({ preset: 'yolo', projectRoot: tmpRoot }), /invalid preset/);
  });

  test('install writes workflows + rules', async () => {
    await seedWindsurf(tmpRoot);
    const result = await installHooks(tmpRoot, { preset: 'gentle', platform: 'windsurf' });
    assert.strictEqual(result.written, true);
    const workflows = await readdir(path.join(tmpRoot, WF_DIR));
    const rules = await readdir(path.join(tmpRoot, RULES_DIR));
    assert.ok(workflows.includes('rune-preflight.md'));
    assert.ok(workflows.includes('rune-sentinel.md'));
    assert.ok(workflows.includes('rune-dependency-doctor.md'));
    assert.ok(rules.includes('rune-preflight-rule.md'));
  });

  test('idempotent re-install', async () => {
    await seedWindsurf(tmpRoot);
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'windsurf' });
    const first = await readFile(path.join(tmpRoot, WF_DIR, 'rune-preflight.md'), 'utf-8');
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'windsurf' });
    const second = await readFile(path.join(tmpRoot, WF_DIR, 'rune-preflight.md'), 'utf-8');
    assert.strictEqual(first, second);
  });

  test('uninstall removes Rune workflows + rules, preserves user files', async () => {
    await seedWindsurf(tmpRoot);
    const wfDir = path.join(tmpRoot, WF_DIR);
    const rulesDir = path.join(tmpRoot, RULES_DIR);
    await mkdir(wfDir, { recursive: true });
    await mkdir(rulesDir, { recursive: true });
    await writeFile(path.join(wfDir, 'user-workflow.md'), '# User workflow\n', 'utf-8');
    await writeFile(path.join(rulesDir, 'user-rule.md'), '# User rule\n', 'utf-8');

    await installHooks(tmpRoot, { preset: 'gentle', platform: 'windsurf' });
    await uninstallHooks(tmpRoot, { platform: 'windsurf' });

    const wfLeft = await readdir(wfDir);
    const rulesLeft = await readdir(rulesDir);
    assert.ok(wfLeft.includes('user-workflow.md'), 'user workflow must survive');
    assert.ok(rulesLeft.includes('user-rule.md'), 'user rule must survive');
    assert.ok(!wfLeft.some((f) => f.startsWith('rune-')), 'no rune-* workflows');
    assert.ok(!rulesLeft.some((f) => f.startsWith('rune-')), 'no rune-* rules');
  });

  test('status after install reports wired skills', async () => {
    await seedWindsurf(tmpRoot);
    await installHooks(tmpRoot, { preset: 'gentle', platform: 'windsurf' });
    const result = await hookStatus(tmpRoot, RUNE_ROOT, { platform: 'windsurf' });
    const r = result.results.find((x) => x.platform === 'windsurf');
    assert.strictEqual(r.installed, true);
    assert.strictEqual(r.preset, 'gentle');
    assert.ok(r.wired.includes('preflight'));
  });

  test('status reports missing when .windsurf absent', async () => {
    const result = await hookStatus(tmpRoot, RUNE_ROOT, { platform: 'windsurf' });
    const r = result.results.find((x) => x.platform === 'windsurf');
    assert.strictEqual(r.installed, false);
    assert.ok(r.missing.includes('preflight'));
  });
});
