import assert from 'node:assert';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkMeshIntegrity } from '../doctor.js';
import { collectStats, renderStatus, renderStatusJson } from '../status.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNE_ROOT = path.resolve(__dirname, '../..');
const PRO_DIR = path.resolve(RUNE_ROOT, '../../Pro/extensions');
const BIZ_DIR = path.resolve(RUNE_ROOT, '../../Business/extensions');

// ─── collectStats ───

describe('collectStats', () => {
  test('collects core skill count', async () => {
    const stats = await collectStats(RUNE_ROOT);
    assert.ok(stats.skillCount >= 60, `Expected >= 60 skills, got ${stats.skillCount}`);
  });

  test('counts skills by layer', async () => {
    const stats = await collectStats(RUNE_ROOT);
    assert.strictEqual(stats.layers.L0, 1);
    assert.ok(stats.layers.L1 >= 4);
    assert.ok(stats.layers.L2 >= 25);
    assert.ok(stats.layers.L3 >= 20);
  });

  test('counts signals', async () => {
    const stats = await collectStats(RUNE_ROOT);
    assert.ok(stats.signalCount >= 10, `Expected >= 10 signals, got ${stats.signalCount}`);
  });

  test('builds signal map with emitters and listeners', async () => {
    const stats = await collectStats(RUNE_ROOT);
    assert.ok(Object.keys(stats.signalMap.emitters).length > 0);
    assert.ok(Object.keys(stats.signalMap.listeners).length > 0);
  });

  test('counts connections', async () => {
    const stats = await collectStats(RUNE_ROOT);
    assert.ok(stats.totalConnections > 100);
    assert.ok(parseFloat(stats.avgConnections) > 1);
  });

  test('uses the same canonical outbound connection count as doctor', async () => {
    const [stats, mesh] = await Promise.all([collectStats(RUNE_ROOT), checkMeshIntegrity(RUNE_ROOT)]);
    assert.strictEqual(stats.totalConnections, mesh.stats.connections);
  });

  test('discovers free packs', async () => {
    const stats = await collectStats(RUNE_ROOT);
    assert.ok(stats.freePacks.length >= 14);
  });

  test('detects free tier when no tier sources', async () => {
    const stats = await collectStats(RUNE_ROOT);
    assert.strictEqual(stats.tier, 'free');
  });

  test('detects pro tier when pro sources exist', async () => {
    const stats = await collectStats(RUNE_ROOT, { pro: PRO_DIR });
    if (stats.proPacks.length > 0) {
      assert.strictEqual(stats.tier, 'pro');
    }
  });

  test('detects business tier when business sources exist', async () => {
    const stats = await collectStats(RUNE_ROOT, { pro: PRO_DIR, business: BIZ_DIR });
    if (stats.bizPacks.length > 0) {
      assert.strictEqual(stats.tier, 'business');
    }
  });

  test('counts pro pack lines', async () => {
    const stats = await collectStats(RUNE_ROOT, { pro: PRO_DIR });
    for (const pack of stats.proPacks) {
      assert.ok(pack.name, 'Pack should have a name');
      assert.ok(pack.lines > 0, `Pack ${pack.name} should have lines`);
    }
  });

  test('counts business pack lines', async () => {
    const stats = await collectStats(RUNE_ROOT, { business: BIZ_DIR });
    for (const pack of stats.bizPacks) {
      assert.ok(pack.name);
      assert.ok(pack.lines > 0);
    }
  });

  test('handles non-existent tier paths gracefully', async () => {
    const stats = await collectStats(RUNE_ROOT, {
      pro: '/nonexistent/path',
      business: '/nonexistent/path',
    });
    assert.deepStrictEqual(stats.proPacks, []);
    assert.deepStrictEqual(stats.bizPacks, []);
    assert.strictEqual(stats.tier, 'free');
  });

  test('returns parsedSkills array', async () => {
    const stats = await collectStats(RUNE_ROOT);
    assert.strictEqual(stats.parsedSkills.length, stats.skillCount);
    for (const skill of stats.parsedSkills) {
      assert.ok(skill.name);
    }
  });
});

// ─── renderStatus ───

describe('renderStatus', () => {
  test('renders box with Unicode borders', async () => {
    const stats = await collectStats(RUNE_ROOT);
    const output = renderStatus(stats);
    assert.ok(output.includes('╭'));
    assert.ok(output.includes('╰'));
    assert.ok(output.includes('│'));
  });

  test('shows tier icon — free', async () => {
    const stats = await collectStats(RUNE_ROOT);
    const output = renderStatus(stats);
    assert.ok(output.includes('🔮 Rune'));
  });

  test('shows tier icon — pro', async () => {
    const stats = await collectStats(RUNE_ROOT, { pro: PRO_DIR });
    if (stats.tier === 'pro') {
      const output = renderStatus(stats);
      assert.ok(output.includes('⚡ Rune Pro'));
    }
  });

  test('shows tier icon — business', async () => {
    const stats = await collectStats(RUNE_ROOT, { pro: PRO_DIR, business: BIZ_DIR });
    if (stats.tier === 'business') {
      const output = renderStatus(stats);
      assert.ok(output.includes('🏢 Rune Business'));
    }
  });

  test('shows skill count with layer breakdown', async () => {
    const stats = await collectStats(RUNE_ROOT);
    const output = renderStatus(stats);
    assert.match(output, /Skills\s+\d+ core/);
    assert.ok(output.includes('L0:'));
    assert.ok(output.includes('L1:'));
    assert.ok(output.includes('L2:'));
    assert.ok(output.includes('L3:'));
  });

  test('shows pack counts', async () => {
    const stats = await collectStats(RUNE_ROOT);
    const output = renderStatus(stats);
    assert.match(output, /Packs\s+\d+ free/);
  });

  test('shows signal count', async () => {
    const stats = await collectStats(RUNE_ROOT);
    const output = renderStatus(stats);
    assert.match(output, /Signals\s+\d+ defined/);
  });

  test('shows mesh connections', async () => {
    const stats = await collectStats(RUNE_ROOT);
    const output = renderStatus(stats);
    assert.match(output, /Mesh\s+\d+\+ connections/);
  });

  test('shows health progress bar', async () => {
    const stats = await collectStats(RUNE_ROOT);
    const output = renderStatus(stats);
    assert.ok(output.includes('▓'));
    assert.ok(output.includes('mesh health'));
  });

  test('shows active signals section', async () => {
    const stats = await collectStats(RUNE_ROOT);
    const output = renderStatus(stats);
    assert.ok(output.includes('Active Signals'));
    assert.ok(output.includes('→'));
  });

  test('shows project info when provided', async () => {
    const stats = await collectStats(RUNE_ROOT);
    const output = renderStatus(stats, {
      version: '2.6.0',
      platform: 'cursor',
      projectName: 'my-app',
    });
    assert.ok(output.includes('my-app'));
    assert.ok(output.includes('cursor'));
    assert.ok(output.includes('2.6.0'));
  });

  test('shows Pro pack section for pro tier', async () => {
    const stats = await collectStats(RUNE_ROOT, { pro: PRO_DIR });
    if (stats.proPacks.length > 0) {
      const output = renderStatus(stats);
      assert.ok(output.includes('Pro Packs'));
      assert.ok(output.includes('@rune-pro/'));
      assert.ok(output.includes('lines'));
    }
  });

  test('shows Business pack section for business tier', async () => {
    const stats = await collectStats(RUNE_ROOT, { pro: PRO_DIR, business: BIZ_DIR });
    if (stats.bizPacks.length > 0) {
      const output = renderStatus(stats);
      assert.ok(output.includes('Business Packs'));
      assert.ok(output.includes('@rune-pro/'));
    }
  });

  test('omits Pro/Biz sections for free tier', async () => {
    const stats = await collectStats(RUNE_ROOT);
    const output = renderStatus(stats);
    assert.ok(!output.includes('Pro Packs'));
    assert.ok(!output.includes('Business Packs'));
  });
});

// ─── renderStatusJson ───

describe('renderStatusJson', () => {
  test('returns valid JSON', async () => {
    const stats = await collectStats(RUNE_ROOT);
    const parsed = JSON.parse(renderStatusJson(stats));
    assert.ok(parsed);
  });

  test('includes tier field', async () => {
    const stats = await collectStats(RUNE_ROOT);
    const parsed = JSON.parse(renderStatusJson(stats));
    assert.ok(['free', 'pro', 'business'].includes(parsed.tier));
  });

  test('includes skills with layers', async () => {
    const stats = await collectStats(RUNE_ROOT);
    const parsed = JSON.parse(renderStatusJson(stats));
    assert.ok(parsed.skills.total >= 60);
    assert.strictEqual(parsed.skills.layers.L0, 1);
  });

  test('includes packs breakdown', async () => {
    const stats = await collectStats(RUNE_ROOT);
    const parsed = JSON.parse(renderStatusJson(stats));
    assert.ok(parsed.packs.free >= 14);
    assert.ok(Array.isArray(parsed.packs.pro));
    assert.ok(Array.isArray(parsed.packs.business));
  });

  test('includes signal data with top signals', async () => {
    const stats = await collectStats(RUNE_ROOT);
    const parsed = JSON.parse(renderStatusJson(stats));
    assert.ok(parsed.signals.count >= 10);
    assert.ok(parsed.signals.top.length > 0);
    for (const sig of parsed.signals.top) {
      assert.ok(sig.name);
      assert.ok(Array.isArray(sig.emitters));
      assert.ok(Array.isArray(sig.listeners));
    }
  });

  test('includes mesh stats', async () => {
    const stats = await collectStats(RUNE_ROOT);
    const parsed = JSON.parse(renderStatusJson(stats));
    assert.ok(parsed.mesh.connections > 100);
    assert.ok(parsed.mesh.avgPerSkill > 1);
  });

  test('includes health score 0-100', async () => {
    const stats = await collectStats(RUNE_ROOT);
    const parsed = JSON.parse(renderStatusJson(stats));
    assert.ok(parsed.health >= 0);
    assert.ok(parsed.health <= 100);
  });

  test('includes project info when provided', async () => {
    const stats = await collectStats(RUNE_ROOT);
    const parsed = JSON.parse(renderStatusJson(stats, { version: '2.6.0', platform: 'cursor', projectName: 'test' }));
    assert.strictEqual(parsed.project, 'test');
    assert.strictEqual(parsed.platform, 'cursor');
    assert.strictEqual(parsed.version, '2.6.0');
  });

  test('pro packs include name and lines', async () => {
    const stats = await collectStats(RUNE_ROOT, { pro: PRO_DIR });
    const parsed = JSON.parse(renderStatusJson(stats));
    for (const pack of parsed.packs.pro) {
      assert.ok(pack.name);
      assert.ok(pack.lines > 0);
    }
  });
});

// ─── Health Score ───

describe('health score', () => {
  test('free tier has reasonable health', async () => {
    const stats = await collectStats(RUNE_ROOT);
    const parsed = JSON.parse(renderStatusJson(stats));
    assert.ok(parsed.health >= 70, `Health ${parsed.health} should be >= 70`);
  });

  test('business tier health >= free tier health', async () => {
    const freeStats = await collectStats(RUNE_ROOT);
    const bizStats = await collectStats(RUNE_ROOT, { pro: PRO_DIR, business: BIZ_DIR });

    const freeHealth = JSON.parse(renderStatusJson(freeStats)).health;
    const bizHealth = JSON.parse(renderStatusJson(bizStats)).health;
    assert.ok(bizHealth >= freeHealth, `Biz ${bizHealth} should be >= Free ${freeHealth}`);
  });
});

// ─── Box Rendering ───

describe('box rendering', () => {
  test('all box lines end with correct border char', async () => {
    const stats = await collectStats(RUNE_ROOT);
    const output = renderStatus(stats);
    const lines = output.split('\n');
    const boxLines = lines.filter((l) => l.startsWith('│') || l.startsWith('╭') || l.startsWith('╰'));

    for (const line of boxLines) {
      const lastChar = line.trimEnd().slice(-1);
      assert.ok(
        ['│', '╮', '╯'].includes(lastChar),
        `Line should end with border char, got: "${lastChar}" in "${line}"`,
      );
    }
  });

  test('box has exactly one top and one bottom border', async () => {
    const stats = await collectStats(RUNE_ROOT);
    const output = renderStatus(stats);
    const lines = output.split('\n');
    assert.strictEqual(lines.filter((l) => l.startsWith('╭')).length, 1);
    assert.strictEqual(lines.filter((l) => l.startsWith('╰')).length, 1);
  });
});
