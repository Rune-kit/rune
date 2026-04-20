/**
 * Doctor tier-coverage check — warns when a tier's hooks are installed on
 * Claude but missing on other detected platforms, or when required env vars
 * are unset so installed hooks would fail at runtime.
 *
 * Checks are advisory (WARN) — never block the doctor pipeline.
 */

import assert from 'node:assert';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { listDetectedTiers } from '../commands/hooks/tiers.js';
import { checkTierCoverage } from '../doctor.js';

const PRO_MANIFEST = {
  name: 'Rune Pro Hooks',
  description: 'Pro tier hooks',
  tier: 'pro',
  version: '1.0.0',
  requires: ['RUNE_PRO_ROOT'],
  entries: [
    {
      id: 'context-inject',
      skill: 'context-inject',
      event: 'UserPromptSubmit',
      matcher: '.*',
      command: 'node "${RUNE_PRO_ROOT}/hooks/run-hook.cjs" context-inject',
    },
    {
      id: 'context-sense',
      skill: 'context-sense',
      event: 'PreToolUse',
      matcher: 'Edit|Write',
      command: 'node "${RUNE_PRO_ROOT}/hooks/run-hook.cjs" context-sense',
    },
  ],
};

let tmpRoot;
let tierRoot;
let originalRunePro;

async function seedTierRoot(tier, manifest) {
  const dir = await mkdtemp(path.join(tmpdir(), `rune-doc-${tier}-`));
  await mkdir(path.join(dir, 'hooks'), { recursive: true });
  await writeFile(path.join(dir, 'hooks', 'manifest.json'), JSON.stringify(manifest, null, 2));
  return dir;
}

async function seedPlatform(root, platform) {
  const map = {
    claude: { dir: '.claude', settings: true },
    cursor: { dir: '.cursor/rules' },
    windsurf: { dir: '.windsurf/workflows' },
    antigravity: { dir: '.antigravity/rules' },
  };
  const spec = map[platform];
  await mkdir(path.join(root, spec.dir), { recursive: true });
  if (spec.settings) {
    await writeFile(path.join(root, '.claude', 'settings.json'), '{}');
  }
}

async function seedTierHooksOn(root, platform, tier) {
  if (platform === 'claude') {
    const settingsPath = path.join(root, '.claude', 'settings.json');
    const settings = {
      hooks: {
        UserPromptSubmit: [
          {
            matcher: '.*',
            hooks: [
              { type: 'command', command: 'node "${RUNE_' + tier.toUpperCase() + '_ROOT}/hooks/run-hook.cjs" ctx' },
            ],
          },
        ],
      },
    };
    await mkdir(path.dirname(settingsPath), { recursive: true });
    await writeFile(settingsPath, JSON.stringify(settings, null, 2));
    return;
  }
  const dirs = {
    cursor: path.join(root, '.cursor/rules'),
    windsurf: path.join(root, '.windsurf/workflows'),
    antigravity: path.join(root, '.antigravity/rules'),
  };
  const ext = { cursor: '.mdc', windsurf: '.md', antigravity: '.md' }[platform];
  const dir = dirs[platform];
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `rune-${tier}-context-inject${ext}`), '# tier hook\n');
}

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(tmpdir(), 'rune-doctor-tier-'));
  tierRoot = await seedTierRoot('pro', PRO_MANIFEST);
  originalRunePro = process.env.RUNE_PRO_ROOT;
  process.env.RUNE_PRO_ROOT = tierRoot;
});

afterEach(async () => {
  if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
  if (tierRoot) await rm(tierRoot, { recursive: true, force: true });
  if (originalRunePro === undefined) delete process.env.RUNE_PRO_ROOT;
  else process.env.RUNE_PRO_ROOT = originalRunePro;
});

describe('listDetectedTiers', () => {
  test('returns empty array when no tier env vars set and no monorepo sibling', async () => {
    delete process.env.RUNE_PRO_ROOT;
    const result = await listDetectedTiers(tmpRoot);
    assert.deepStrictEqual(result, []);
  });

  test('returns Pro tier when RUNE_PRO_ROOT resolves', async () => {
    const result = await listDetectedTiers(tmpRoot);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].tier, 'pro');
    assert.strictEqual(result[0].found, true);
    assert.strictEqual(result[0].requiresOk, true);
    assert.deepStrictEqual(result[0].requiresMissing, []);
  });

  test('reports requiresMissing when env var gets unset after locate', async () => {
    // Manifest locates via a secondary path (env set at locate, unset at requires check).
    // Simulate by forcing a manifest with extra required env.
    const extraReq = { ...PRO_MANIFEST, requires: ['RUNE_PRO_ROOT', 'SOME_OTHER_VAR'] };
    await writeFile(path.join(tierRoot, 'hooks', 'manifest.json'), JSON.stringify(extraReq, null, 2));
    const result = await listDetectedTiers(tmpRoot);
    assert.strictEqual(result[0].requiresOk, false);
    assert.deepStrictEqual(result[0].requiresMissing, ['SOME_OTHER_VAR']);
  });
});

describe('checkTierCoverage', () => {
  test('silent when no tiers detected', async () => {
    delete process.env.RUNE_PRO_ROOT;
    const result = await checkTierCoverage({ projectRoot: tmpRoot });
    assert.strictEqual(result.checks.length, 0);
    assert.strictEqual(result.warnings.length, 0);
  });

  test('silent when tier detected but no platform dirs exist', async () => {
    const result = await checkTierCoverage({ projectRoot: tmpRoot });
    assert.strictEqual(result.checks.length, 0);
    assert.strictEqual(result.warnings.length, 0);
  });

  test('pass when Pro installed on every detected platform', async () => {
    await seedPlatform(tmpRoot, 'claude');
    await seedPlatform(tmpRoot, 'cursor');
    await seedTierHooksOn(tmpRoot, 'claude', 'pro');
    await seedTierHooksOn(tmpRoot, 'cursor', 'pro');

    const result = await checkTierCoverage({ projectRoot: tmpRoot });
    const tierCheck = result.checks.find((c) => c.name === 'Tier coverage');
    assert.ok(tierCheck, 'should emit a tier-coverage check');
    assert.strictEqual(tierCheck.status, 'pass');
    assert.strictEqual(result.warnings.length, 0);
  });

  test('warns when Pro on Claude but missing on detected Cursor', async () => {
    await seedPlatform(tmpRoot, 'claude');
    await seedPlatform(tmpRoot, 'cursor');
    await seedTierHooksOn(tmpRoot, 'claude', 'pro');
    // Cursor platform seeded but NO pro-prefixed files — the gap we want to catch.

    const result = await checkTierCoverage({ projectRoot: tmpRoot });
    const tierCheck = result.checks.find((c) => c.name === 'Tier coverage');
    assert.strictEqual(tierCheck.status, 'warn');
    assert.strictEqual(result.warnings.length >= 1, true);
    const msg = result.warnings.join('\n');
    assert.match(msg, /pro/);
    assert.match(msg, /cursor/);
    assert.match(msg, /rune hooks install/);
  });

  test('warns when tier manifest requires unset env var', async () => {
    await seedPlatform(tmpRoot, 'claude');
    await seedTierHooksOn(tmpRoot, 'claude', 'pro');
    // Rewrite manifest to add a req that is definitely unset.
    const extraReq = { ...PRO_MANIFEST, requires: ['RUNE_PRO_ROOT', 'DOCTOR_TIER_MISSING_ENV'] };
    await writeFile(path.join(tierRoot, 'hooks', 'manifest.json'), JSON.stringify(extraReq, null, 2));

    const result = await checkTierCoverage({ projectRoot: tmpRoot });
    const envWarn = result.warnings.find((w) => w.includes('DOCTOR_TIER_MISSING_ENV'));
    assert.ok(envWarn, `expected missing-env warning, got: ${result.warnings.join('\n')}`);
    assert.match(envWarn, /pro/);
    assert.match(envWarn, /will FAIL at runtime/);
  });

  test('no false-positive: Pro on Cursor alone (no Claude dir) is not a gap', async () => {
    await seedPlatform(tmpRoot, 'cursor');
    await seedTierHooksOn(tmpRoot, 'cursor', 'pro');

    const result = await checkTierCoverage({ projectRoot: tmpRoot });
    const tierCheck = result.checks.find((c) => c.name === 'Tier coverage');
    // Installed on every detected platform (just cursor) → pass, not warn.
    assert.strictEqual(tierCheck.status, 'pass');
  });

  test('windsurf workflow OR rule file counts as installed', async () => {
    await seedPlatform(tmpRoot, 'windsurf');
    const rulesDir = path.join(tmpRoot, '.windsurf/rules');
    await mkdir(rulesDir, { recursive: true });
    await writeFile(path.join(rulesDir, 'rune-pro-context-inject-rule.md'), '# rule\n');

    const result = await checkTierCoverage({ projectRoot: tmpRoot });
    const tierCheck = result.checks.find((c) => c.name === 'Tier coverage');
    assert.strictEqual(tierCheck.status, 'pass');
  });
});
