/**
 * Tier Override Tests
 *
 * Tests the tier resolution logic: Business > Pro > Free.
 * When the same normalized pack name exists in multiple tiers,
 * the highest-priority tier wins.
 */

import assert from 'node:assert';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { discoverTieredPacks } from '../emitter.js';

/**
 * Create a temp directory structure with PACK.md files for testing
 */
function createTierFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'rune-tier-'));

  const freePacks = path.join(root, 'free');
  const proPacks = path.join(root, 'pro');
  const bizPacks = path.join(root, 'business');

  // Free: saas, trading, ui
  for (const pack of ['saas', 'trading', 'ui']) {
    const dir = path.join(freePacks, pack);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'PACK.md'), `---\nname: "@rune/${pack}"\n---\n\nFree ${pack} pack.\n`);
  }

  // Pro: pro-product, pro-saas (overrides free saas)
  for (const pack of ['pro-product', 'pro-saas']) {
    const dir = path.join(proPacks, pack);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'PACK.md'), `---\nname: "@rune-pro/${pack}"\n---\n\nPro ${pack} pack.\n`);
  }

  // Business: business-saas (overrides pro-saas AND free saas), business-finance
  for (const pack of ['business-saas', 'business-finance']) {
    const dir = path.join(bizPacks, pack);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'PACK.md'), `---\nname: "@rune-biz/${pack}"\n---\n\nBusiness ${pack} pack.\n`);
  }

  return { root, freePacks, proPacks, bizPacks };
}

// --- discoverTieredPacks ---

describe('discoverTieredPacks', () => {
  test('returns free packs when no tier sources provided', async () => {
    const { freePacks, root } = createTierFixture();
    try {
      const packs = await discoverTieredPacks(freePacks, {});
      assert.strictEqual(packs.length, 3);
      assert.ok(packs.every((p) => p.tier === 'free'));
      const names = packs.map((p) => p.dirName).sort();
      assert.deepStrictEqual(names, ['saas', 'trading', 'ui']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('pro pack overrides free pack with same normalized name', async () => {
    const { freePacks, proPacks, root } = createTierFixture();
    try {
      const packs = await discoverTieredPacks(freePacks, { pro: proPacks });

      // "saas" normalized name should come from pro (pro-saas), not free (saas)
      const saasPack = packs.find((p) => p.dirName === 'pro-saas' || p.dirName === 'saas');
      assert.ok(saasPack, 'saas pack should exist');
      assert.strictEqual(saasPack.tier, 'pro');
      assert.strictEqual(saasPack.dirName, 'pro-saas');

      // pro-product should be added (no free equivalent)
      const productPack = packs.find((p) => p.dirName === 'pro-product');
      assert.ok(productPack, 'pro-product should exist');
      assert.strictEqual(productPack.tier, 'pro');

      // trading and ui should remain free
      const tradingPack = packs.find((p) => p.dirName === 'trading');
      assert.ok(tradingPack, 'trading should exist');
      assert.strictEqual(tradingPack.tier, 'free');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('business pack overrides both pro and free', async () => {
    const { freePacks, proPacks, bizPacks, root } = createTierFixture();
    try {
      const packs = await discoverTieredPacks(freePacks, { pro: proPacks, business: bizPacks });

      // "saas" should come from business (highest tier)
      const saasPack = packs.find((p) => p.dirName.includes('saas'));
      assert.ok(saasPack, 'saas pack should exist');
      assert.strictEqual(saasPack.tier, 'business');
      assert.strictEqual(saasPack.dirName, 'business-saas');

      // business-finance should be added
      const financePack = packs.find((p) => p.dirName === 'business-finance');
      assert.ok(financePack, 'business-finance should exist');
      assert.strictEqual(financePack.tier, 'business');

      // pro-product should still exist (no business override)
      const productPack = packs.find((p) => p.dirName === 'pro-product');
      assert.ok(productPack, 'pro-product should exist');
      assert.strictEqual(productPack.tier, 'pro');

      // trading and ui should remain free
      const tradingPack = packs.find((p) => p.dirName === 'trading');
      assert.strictEqual(tradingPack.tier, 'free');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('handles missing tier directories gracefully', async () => {
    const { freePacks, root } = createTierFixture();
    try {
      const packs = await discoverTieredPacks(freePacks, {
        pro: '/nonexistent/pro/extensions',
        business: '/nonexistent/business/extensions',
      });
      assert.strictEqual(packs.length, 3);
      assert.ok(packs.every((p) => p.tier === 'free'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('respects enabledPacks filter across tiers', async () => {
    const { freePacks, proPacks, root } = createTierFixture();
    try {
      const packs = await discoverTieredPacks(freePacks, { pro: proPacks }, ['trading', 'pro-product']);

      assert.strictEqual(packs.length, 2);
      const names = packs.map((p) => p.dirName).sort();
      assert.deepStrictEqual(names, ['pro-product', 'trading']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('output is sorted by dirName for deterministic builds', async () => {
    const { freePacks, proPacks, bizPacks, root } = createTierFixture();
    try {
      const packs = await discoverTieredPacks(freePacks, { pro: proPacks, business: bizPacks });
      const names = packs.map((p) => p.dirName);
      const sorted = [...names].sort();
      assert.deepStrictEqual(names, sorted);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('pro override tracks free pack in overrides array', async () => {
    const { freePacks, proPacks, root } = createTierFixture();
    try {
      const packs = await discoverTieredPacks(freePacks, { pro: proPacks });
      const saasPack = packs.find((p) => p.dirName === 'pro-saas');
      assert.ok(saasPack, 'pro-saas should exist');
      assert.strictEqual(saasPack.overrides.length, 1);
      assert.strictEqual(saasPack.overrides[0].tier, 'free');
      assert.strictEqual(saasPack.overrides[0].dirName, 'saas');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('business override tracks both pro and free in overrides array', async () => {
    const { freePacks, proPacks, bizPacks, root } = createTierFixture();
    try {
      const packs = await discoverTieredPacks(freePacks, { pro: proPacks, business: bizPacks });
      const saasPack = packs.find((p) => p.dirName === 'business-saas');
      assert.ok(saasPack, 'business-saas should exist');
      // Should have both free and pro overrides (free was overridden by pro, then pro by business)
      assert.strictEqual(saasPack.overrides.length, 2);
      const overrideTiers = saasPack.overrides.map((o) => o.tier).sort();
      assert.deepStrictEqual(overrideTiers, ['free', 'pro']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('free-only packs have empty overrides array', async () => {
    const { freePacks, proPacks, root } = createTierFixture();
    try {
      const packs = await discoverTieredPacks(freePacks, { pro: proPacks });
      const tradingPack = packs.find((p) => p.dirName === 'trading');
      assert.ok(tradingPack, 'trading should exist');
      assert.deepStrictEqual(tradingPack.overrides, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
