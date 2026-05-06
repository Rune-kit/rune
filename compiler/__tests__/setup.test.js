import assert from 'node:assert';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { detectTiers, formatSetupResult, runSetup } from '../commands/setup.js';

let tmpRoot;

async function seedClaude(root) {
  await mkdir(path.join(root, '.claude'), { recursive: true });
}

async function seedTier(root, tier) {
  const dir = path.join(root, '..', tier === 'pro' ? 'Pro' : 'Business', 'hooks');
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, 'manifest.json'),
    JSON.stringify({
      tier,
      version: '1.0.0',
      minFreeVersion: '2.0.0',
      requires: [tier === 'pro' ? 'RUNE_PRO_ROOT' : 'RUNE_BUSINESS_ROOT'],
      entries: [],
    }),
  );
}

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(tmpdir(), 'rune-setup-'));
  await mkdir(path.join(tmpRoot, 'project'), { recursive: true });
});

afterEach(async () => {
  if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
  delete process.env.RUNE_PRO_ROOT;
  delete process.env.RUNE_BUSINESS_ROOT;
});

describe('detectTiers', () => {
  test('returns null for both when no tier present', () => {
    const projectRoot = path.join(tmpRoot, 'project');
    const result = detectTiers(projectRoot, { wellKnownPaths: { pro: [], business: [] } });
    assert.strictEqual(result.pro, null);
    assert.strictEqual(result.business, null);
  });

  test('detects Pro via sibling path', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    await seedTier(projectRoot, 'pro');
    const result = detectTiers(projectRoot, { wellKnownPaths: { pro: [], business: [] } });
    assert.ok(result.pro);
    assert.match(result.pro.source, /sibling/);
    assert.strictEqual(result.pro.version, '1.0.0');
    assert.strictEqual(result.business, null);
  });

  test('detects Business via sibling path', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    await seedTier(projectRoot, 'business');
    const result = detectTiers(projectRoot, { wellKnownPaths: { pro: [], business: [] } });
    assert.ok(result.business);
    assert.match(result.business.source, /sibling/);
    assert.strictEqual(result.pro, null);
  });

  test('env var takes precedence over sibling', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    await seedTier(projectRoot, 'pro');
    // Env var pointing at a different location
    const envRoot = path.join(tmpRoot, 'env-pro');
    await mkdir(path.join(envRoot, 'hooks'), { recursive: true });
    await writeFile(
      path.join(envRoot, 'hooks', 'manifest.json'),
      JSON.stringify({ tier: 'pro', version: '2.0.0', minFreeVersion: '2.0.0', requires: [], entries: [] }),
    );
    process.env.RUNE_PRO_ROOT = envRoot;
    const result = detectTiers(projectRoot, { wellKnownPaths: { pro: [], business: [] } });
    assert.match(result.pro.source, /\$RUNE_PRO_ROOT/);
    assert.strictEqual(result.pro.version, '2.0.0');
  });
});

describe('runSetup (non-interactive)', () => {
  test('--here installs to current project, no tiers when none detected', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    await seedClaude(projectRoot);
    const result = await runSetup({
      projectRoot,
      runeRoot: path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..'),
      args: { here: true, preset: 'gentle', 'no-tier': true },
    });
    assert.strictEqual(result.scope, 'current');
    assert.strictEqual(result.preset, 'gentle');
    assert.deepStrictEqual(result.tiers, []);
    assert.strictEqual(result.targetRoot, projectRoot);
  });

  test('--tier flag bypasses prompt', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    await seedClaude(projectRoot);
    await seedTier(projectRoot, 'pro');
    const result = await runSetup({
      projectRoot,
      runeRoot: path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..'),
      args: { here: true, preset: 'gentle', tier: 'pro' },
    });
    assert.deepStrictEqual(result.tiers, ['pro']);
  });

  test('--dry does not write files', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    await seedClaude(projectRoot);
    const result = await runSetup({
      projectRoot,
      runeRoot: path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..'),
      args: { here: true, preset: 'gentle', 'no-tier': true, dry: true },
    });
    assert.strictEqual(result.written, false);
  });
});

describe('formatSetupResult', () => {
  test('renders summary with scope and tiers', () => {
    const out = formatSetupResult({
      scope: 'current',
      targetRoot: '/path/to/project',
      tiers: ['pro'],
      preset: 'gentle',
      platforms: ['claude'],
      written: true,
      notes: [],
    });
    assert.match(out, /Setup Complete/);
    assert.match(out, /Tiers:.*Free.*pro/);
    assert.match(out, /current project/);
    assert.match(out, /rune doctor --hooks/);
  });

  test('renders global scope label when scope=global', () => {
    const out = formatSetupResult({
      scope: 'global',
      targetRoot: '/home/user',
      tiers: [],
      preset: 'gentle',
      platforms: ['claude'],
      written: true,
      notes: [],
    });
    assert.match(out, /GLOBAL/);
  });
});
