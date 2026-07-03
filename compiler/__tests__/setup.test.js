import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { platform as osPlatform, tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { resolveTier } from '../commands/hooks/tiers.js';
import {
  detectTiers,
  formatSetupResult,
  installTierSkills,
  resolveSkillInstallRoot,
  runSetup,
} from '../commands/setup.js';

let tmpRoot;

async function seedClaude(root) {
  await mkdir(path.join(root, '.claude'), { recursive: true });
}

async function seedTier(root, tier, opts = {}) {
  const tierRoot = path.join(root, '..', tier === 'pro' ? 'Pro' : 'Business');
  await mkdir(path.join(tierRoot, 'hooks'), { recursive: true });
  await writeFile(
    path.join(tierRoot, 'hooks', 'manifest.json'),
    JSON.stringify({
      tier,
      version: '1.0.0',
      minFreeVersion: '2.0.0',
      requires: [tier === 'pro' ? 'RUNE_PRO_ROOT' : 'RUNE_BUSINESS_ROOT'],
      entries: [],
    }),
  );
  if (Array.isArray(opts.skills)) {
    for (const skill of opts.skills) {
      const skillDir = path.join(tierRoot, 'skills', skill);
      await mkdir(skillDir, { recursive: true });
      await writeFile(path.join(skillDir, 'SKILL.md'), `---\nname: ${skill}\n---\n# ${skill}\n`);
    }
  }
}

async function seedFakeRuneRoot(root) {
  const runeRoot = path.join(root, 'fake-rune');
  await mkdir(path.join(runeRoot, 'skills'), { recursive: true });
  return runeRoot;
}

beforeEach(async () => {
  // Clear tier env vars BEFORE each test so detection-isolation tests are
  // deterministic regardless of the operator's shell (e.g. a dev with
  // RUNE_PRO_ROOT set). afterEach also clears them.
  delete process.env.RUNE_PRO_ROOT;
  delete process.env.RUNE_BUSINESS_ROOT;
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

describe('installTierSkills', () => {
  test('copies Pro skill directories into runeRoot/skills', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    const runeRoot = await seedFakeRuneRoot(tmpRoot);
    await seedTier(projectRoot, 'pro', { skills: ['autopilot', 'context-inject'] });
    const manifest = await resolveTier('pro', projectRoot);

    const result = await installTierSkills({ tier: 'pro', tierManifest: manifest, runeRoot });

    assert.strictEqual(result.tier, 'pro');
    assert.deepStrictEqual(result.installed.sort(), ['autopilot', 'context-inject']);
    assert.deepStrictEqual(result.skipped, []);
    assert.strictEqual(result.reason, null);
    assert.ok(existsSync(path.join(runeRoot, 'skills', 'autopilot', 'SKILL.md')));
    assert.ok(existsSync(path.join(runeRoot, 'skills', 'context-inject', 'SKILL.md')));
  });

  test('skips skills already present (no Free clobber, no edit stomp)', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    const runeRoot = await seedFakeRuneRoot(tmpRoot);
    // Pre-existing skill at target (e.g. Free skill with same name, or prior install)
    await mkdir(path.join(runeRoot, 'skills', 'autopilot'), { recursive: true });
    await writeFile(path.join(runeRoot, 'skills', 'autopilot', 'SKILL.md'), '# existing — must not be overwritten');
    await seedTier(projectRoot, 'pro', { skills: ['autopilot'] });
    const manifest = await resolveTier('pro', projectRoot);

    const result = await installTierSkills({ tier: 'pro', tierManifest: manifest, runeRoot });

    assert.deepStrictEqual(result.installed, []);
    assert.strictEqual(result.skipped.length, 1);
    assert.strictEqual(result.skipped[0].skill, 'autopilot');
    const preserved = readFileSync(path.join(runeRoot, 'skills', 'autopilot', 'SKILL.md'), 'utf-8');
    assert.match(preserved, /existing — must not be overwritten/);
  });

  test('dry mode reports installs without writing', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    const runeRoot = await seedFakeRuneRoot(tmpRoot);
    await seedTier(projectRoot, 'pro', { skills: ['autopilot'] });
    const manifest = await resolveTier('pro', projectRoot);

    const result = await installTierSkills({ tier: 'pro', tierManifest: manifest, runeRoot, dry: true });

    assert.deepStrictEqual(result.installed, ['autopilot']);
    assert.ok(!existsSync(path.join(runeRoot, 'skills', 'autopilot')));
  });

  test('returns reason when tier has no skills/ dir', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    const runeRoot = await seedFakeRuneRoot(tmpRoot);
    await seedTier(projectRoot, 'pro'); // no skills option
    const manifest = await resolveTier('pro', projectRoot);

    const result = await installTierSkills({ tier: 'pro', tierManifest: manifest, runeRoot });

    assert.deepStrictEqual(result.installed, []);
    assert.match(result.reason, /no skills\//);
  });

  test('returns reason when runeRoot/skills target missing', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    await seedTier(projectRoot, 'pro', { skills: ['autopilot'] });
    const manifest = await resolveTier('pro', projectRoot);
    const runeRoot = path.join(tmpRoot, 'missing-rune-root');

    const result = await installTierSkills({ tier: 'pro', tierManifest: manifest, runeRoot });

    assert.deepStrictEqual(result.installed, []);
    assert.match(result.reason, /target skills\/ missing/);
  });

  test('rejects adversarial skill directory names (path traversal)', async () => {
    // The OS won't let us mkdir literal '..' or names with '/', so the basename
    // guard is unit-tested at the path.basename level. The runtime guard inside
    // installTierSkills uses the same path.basename(name) !== name check.
    assert.strictEqual(path.basename('normal'), 'normal');
    assert.notStrictEqual(path.basename('../escape'), '../escape');
    assert.notStrictEqual(path.basename('a/b'), 'a/b');
    // Integration smoke: a clean install still works after the guard was added
    const projectRoot = path.join(tmpRoot, 'project');
    const runeRoot = await seedFakeRuneRoot(tmpRoot);
    await seedTier(projectRoot, 'pro', { skills: ['normal'] });
    const manifest = await resolveTier('pro', projectRoot);
    const result = await installTierSkills({ tier: 'pro', tierManifest: manifest, runeRoot });
    assert.deepStrictEqual(result.installed, ['normal']);
  });

  test('rejects relative tierManifest.source path', async () => {
    const runeRoot = await seedFakeRuneRoot(tmpRoot);
    const fakeManifest = {
      tier: 'pro',
      source: './relative/manifest.json', // not absolute
      entries: [],
    };

    const result = await installTierSkills({ tier: 'pro', tierManifest: fakeManifest, runeRoot });

    assert.deepStrictEqual(result.installed, []);
    assert.match(result.reason, /must be absolute/);
  });

  test('skips non-directory entries in skills/ (e.g. stray README.md)', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    const runeRoot = await seedFakeRuneRoot(tmpRoot);
    await seedTier(projectRoot, 'pro', { skills: ['autopilot'] });
    // Stray file at sibling of skill dirs — must NOT be installed
    await writeFile(path.join(tmpRoot, 'Pro', 'skills', 'README.md'), '# Pro skills\n');
    const manifest = await resolveTier('pro', projectRoot);

    const result = await installTierSkills({ tier: 'pro', tierManifest: manifest, runeRoot });

    assert.deepStrictEqual(result.installed, ['autopilot']);
    assert.ok(!existsSync(path.join(runeRoot, 'skills', 'README.md')));
  });

  test('skip message includes version drift when source > installed', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    const runeRoot = await seedFakeRuneRoot(tmpRoot);
    // Installed v1.0.0 at target
    await mkdir(path.join(runeRoot, 'skills', 'autopilot'), { recursive: true });
    await writeFile(
      path.join(runeRoot, 'skills', 'autopilot', 'SKILL.md'),
      '---\nname: autopilot\nmetadata:\n  version: "1.0.0"\n---\n# autopilot\n',
    );
    // Seed Pro tier (creates manifest.json) then source skill with v1.5.0
    await seedTier(projectRoot, 'pro');
    await mkdir(path.join(tmpRoot, 'Pro', 'skills', 'autopilot'), { recursive: true });
    await writeFile(
      path.join(tmpRoot, 'Pro', 'skills', 'autopilot', 'SKILL.md'),
      '---\nname: autopilot\nmetadata:\n  version: "1.5.0"\n---\n# autopilot\n',
    );
    const manifest = await resolveTier('pro', projectRoot);

    const result = await installTierSkills({ tier: 'pro', tierManifest: manifest, runeRoot });

    assert.deepStrictEqual(result.installed, []);
    assert.strictEqual(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /stale: installed v1\.0\.0, source has v1\.5\.0/);
  });

  test('rejects symlink entries inside skills/ (no sandbox escape)', async (t) => {
    // Symlinks on Windows require elevated privileges or Developer Mode — skip cleanly.
    if (osPlatform() === 'win32') {
      t.skip('symlink creation needs admin/dev-mode on Windows');
      return;
    }
    const projectRoot = path.join(tmpRoot, 'project');
    const runeRoot = await seedFakeRuneRoot(tmpRoot);
    await seedTier(projectRoot, 'pro', { skills: ['real-skill'] });
    // Create a malicious symlink targeting /etc inside the Pro skills/ dir
    const escapeTarget = path.join(tmpRoot, 'attacker-target');
    await mkdir(escapeTarget, { recursive: true });
    await writeFile(path.join(escapeTarget, 'SECRET'), 'should not be reachable');
    await symlink(escapeTarget, path.join(tmpRoot, 'Pro', 'skills', 'escape-link'), 'dir');
    const manifest = await resolveTier('pro', projectRoot);

    const result = await installTierSkills({ tier: 'pro', tierManifest: manifest, runeRoot });

    assert.deepStrictEqual(result.installed, ['real-skill']);
    const rejected = result.skipped.find((s) => s.skill === 'escape-link');
    assert.ok(rejected, 'symlink entry should appear in skipped[]');
    assert.match(rejected.reason, /rejected: symlink/);
    assert.ok(!existsSync(path.join(runeRoot, 'skills', 'escape-link')), 'symlink must not be recreated at target');
  });

  test('version regex ignores `version:` text inside multiline description', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    const runeRoot = await seedFakeRuneRoot(tmpRoot);
    // Installed v1.0.0
    await mkdir(path.join(runeRoot, 'skills', 'foo'), { recursive: true });
    await writeFile(
      path.join(runeRoot, 'skills', 'foo', 'SKILL.md'),
      '---\nname: foo\nmetadata:\n  version: "1.0.0"\n---\n',
    );
    // Source has DECEPTIVE description with `version: 9.9.9` text inside YAML block scalar;
    // real metadata.version is also 1.0.0 → drift detector must report "same version", NOT "stale v9.9.9 → v1.0.0"
    await seedTier(projectRoot, 'pro');
    await mkdir(path.join(tmpRoot, 'Pro', 'skills', 'foo'), { recursive: true });
    await writeFile(
      path.join(tmpRoot, 'Pro', 'skills', 'foo', 'SKILL.md'),
      '---\nname: foo\ndescription: |\n  version: 9.9.9 is the legacy format we used to use\nmetadata:\n  version: "1.0.0"\n---\n',
    );
    const manifest = await resolveTier('pro', projectRoot);

    const result = await installTierSkills({ tier: 'pro', tierManifest: manifest, runeRoot });

    // Same version — reason should be "already present (v1.0.0)", NOT a stale-drift message
    assert.strictEqual(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /already present \(v1\.0\.0\)/);
    assert.doesNotMatch(result.skipped[0].reason, /9\.9\.9/);
    assert.doesNotMatch(result.skipped[0].reason, /stale/);
  });

  test('skip message reports matching version when source == installed', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    const runeRoot = await seedFakeRuneRoot(tmpRoot);
    await mkdir(path.join(runeRoot, 'skills', 'autopilot'), { recursive: true });
    await writeFile(
      path.join(runeRoot, 'skills', 'autopilot', 'SKILL.md'),
      '---\nname: autopilot\nmetadata:\n  version: "1.0.0"\n---\n',
    );
    await seedTier(projectRoot, 'pro');
    await mkdir(path.join(tmpRoot, 'Pro', 'skills', 'autopilot'), { recursive: true });
    await writeFile(
      path.join(tmpRoot, 'Pro', 'skills', 'autopilot', 'SKILL.md'),
      '---\nname: autopilot\nmetadata:\n  version: "1.0.0"\n---\n',
    );
    const manifest = await resolveTier('pro', projectRoot);

    const result = await installTierSkills({ tier: 'pro', tierManifest: manifest, runeRoot });

    assert.match(result.skipped[0].reason, /already present \(v1\.0\.0\)/);
  });
});

describe('runSetup — Pro skill installation (regression: rune:autopilot Unknown skill)', () => {
  test('installs Pro skills into runeRoot/skills as part of setup', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    await seedClaude(projectRoot);
    await seedTier(projectRoot, 'pro', { skills: ['autopilot'] });
    const runeRoot = await seedFakeRuneRoot(tmpRoot);

    const result = await runSetup({
      projectRoot,
      runeRoot,
      args: { here: true, preset: 'gentle', tier: 'pro' },
      // Pin the install target — without this, resolveSkillInstallRoot would
      // target the REAL plugin cache on dev machines (test side-effect).
      skillTarget: runeRoot,
    });

    assert.deepStrictEqual(result.tiers, ['pro']);
    assert.strictEqual(result.skillResults.length, 1);
    assert.strictEqual(result.skillResults[0].tier, 'pro');
    assert.deepStrictEqual(result.skillResults[0].installed, ['autopilot']);
    assert.ok(existsSync(path.join(runeRoot, 'skills', 'autopilot', 'SKILL.md')));
  });

  test('skillResults empty array when no tier selected', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    await seedClaude(projectRoot);
    const runeRoot = await seedFakeRuneRoot(tmpRoot);

    const result = await runSetup({
      projectRoot,
      runeRoot,
      args: { here: true, preset: 'gentle', 'no-tier': true },
    });

    assert.deepStrictEqual(result.skillResults, []);
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

  test('renders skill install summary when skillResults present', () => {
    const out = formatSetupResult({
      scope: 'current',
      targetRoot: '/path/to/project',
      tiers: ['pro'],
      preset: 'gentle',
      platforms: ['claude'],
      written: true,
      notes: [],
      skillResults: [{ tier: 'pro', installed: ['autopilot'], skipped: [], reason: null }],
    });
    assert.match(out, /Skills:.*pro: 1 installed.*autopilot/);
  });

  test('renders skip + warn lines for tiers with collisions or missing skills/', () => {
    const out = formatSetupResult({
      scope: 'current',
      targetRoot: '/path/to/project',
      tiers: ['pro', 'business'],
      preset: 'gentle',
      platforms: ['claude'],
      written: true,
      notes: [],
      skillResults: [
        { tier: 'pro', installed: [], skipped: [{ skill: 'autopilot', reason: 'already present' }], reason: null },
        { tier: 'business', installed: [], skipped: [], reason: 'no skills/ dir at /tmp/Business/skills' },
      ],
    });
    assert.match(out, /Skipped:.*pro: 1 already present/);
    assert.match(out, /Skill warn:business: no skills\//);
  });

  test('partitions skipped into benign vs rejected and surfaces rejection details', () => {
    const out = formatSetupResult({
      scope: 'current',
      targetRoot: '/path/to/project',
      tiers: ['pro'],
      preset: 'gentle',
      platforms: ['claude'],
      written: true,
      notes: [],
      skillResults: [
        {
          tier: 'pro',
          installed: ['safe-skill'],
          skipped: [
            { skill: 'autopilot', reason: 'already present (v1.0.0)' },
            { skill: 'evil-link', reason: 'rejected: symlink (would escape sandbox)' },
            { skill: '../escape', reason: 'rejected: unsafe directory name' },
          ],
          reason: null,
        },
      ],
    });
    // Counts partitioned and reported together
    assert.match(out, /Skipped:.*pro: 1 already present, 2 rejected/);
    // Each rejected skill surfaced as a warning line (security visibility)
    assert.match(out, /⚠ evil-link: rejected: symlink/);
    assert.match(out, /⚠ \.\.\/escape: rejected: unsafe directory name/);
  });
});

describe('resolveSkillInstallRoot', () => {
  let home;

  beforeEach(async () => {
    home = await mkdtemp(path.join(tmpdir(), 'rune-home-'));
  });

  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  test('targets the NEWEST plugin-cache version dir when the cache exists', async () => {
    // npx/source-checkout executions must NOT install into their own runeRoot
    // when a plugin cache exists — the plugin runtime only reads the cache.
    const cache = path.join(home, '.claude', 'plugins', 'cache', 'rune-kit', 'rune');
    await mkdir(path.join(cache, '2.17.1', 'skills'), { recursive: true });
    await mkdir(path.join(cache, '2.22.1', 'skills'), { recursive: true });
    await mkdir(path.join(cache, '2.9.0', 'skills'), { recursive: true });

    const target = resolveSkillInstallRoot('/some/npx/ephemeral/root', { homedir: home });
    assert.strictEqual(target.source, 'plugin-cache');
    assert.strictEqual(target.root, path.join(cache, '2.22.1'));
  });

  test('ignores cache version dirs without a skills/ folder', async () => {
    const cache = path.join(home, '.claude', 'plugins', 'cache', 'rune-kit', 'rune');
    await mkdir(path.join(cache, '2.22.1', 'skills'), { recursive: true });
    await mkdir(path.join(cache, '2.23.0'), { recursive: true }); // half-installed, no skills/

    const target = resolveSkillInstallRoot('/fallback', { homedir: home });
    assert.strictEqual(target.root, path.join(cache, '2.22.1'));
  });

  test('falls back to runeRoot when no plugin cache exists', async () => {
    const target = resolveSkillInstallRoot('/plain/rune/root', { homedir: home });
    assert.strictEqual(target.source, 'rune-root');
    assert.strictEqual(target.root, '/plain/rune/root');
  });
});
