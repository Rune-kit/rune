import assert from 'node:assert';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { installHooks } from '../commands/hooks/install.js';
import { detectTiers } from '../commands/setup.js';
import {
  detectInstalledPreset,
  detectInstalledTiers,
  formatUpdateResult,
  pullTierRepos,
  runUpdate,
} from '../commands/update.js';

let tmpRoot;

/** Seed a tier repo sibling (../Pro or ../Business) with a manifest whose
 * entries reference the tier env var — matching what real tier manifests emit. */
async function seedTierRepo(projectRoot, tier, opts = {}) {
  const tierRoot = path.join(projectRoot, '..', tier === 'pro' ? 'Pro' : 'Business');
  await mkdir(path.join(tierRoot, 'hooks'), { recursive: true });
  const envVar = tier === 'pro' ? 'RUNE_PRO_ROOT' : 'RUNE_BUSINESS_ROOT';
  await writeFile(
    path.join(tierRoot, 'hooks', 'manifest.json'),
    JSON.stringify({
      tier,
      version: '1.0.0',
      minFreeVersion: '2.0.0',
      requires: [envVar],
      entries: [
        {
          id: `${tier}-pulse`,
          event: 'PreToolUse',
          matcher: 'Edit|Write',
          command: `node "\${${envVar}}/hooks/pulse.js"`,
        },
      ],
    }),
  );
  if (opts.git) {
    await mkdir(path.join(tierRoot, '.git'), { recursive: true });
  }
  return tierRoot;
}

async function seedFakeRuneRoot(root) {
  const runeRoot = path.join(root, 'fake-rune');
  await mkdir(path.join(runeRoot, 'skills'), { recursive: true });
  return runeRoot;
}

/** Install real Free hooks (optionally + tier) into the tmp project so the
 * "already installed" detection paths have something real to read. */
async function installProjectHooks(projectRoot, { preset = 'gentle', tier } = {}) {
  await mkdir(path.join(projectRoot, '.claude'), { recursive: true });
  await installHooks(projectRoot, { preset, tier, platform: 'claude' });
}

beforeEach(async () => {
  delete process.env.RUNE_PRO_ROOT;
  delete process.env.RUNE_BUSINESS_ROOT;
  tmpRoot = await mkdtemp(path.join(tmpdir(), 'rune-update-'));
  await mkdir(path.join(tmpRoot, 'project'), { recursive: true });
});

afterEach(async () => {
  if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
  delete process.env.RUNE_PRO_ROOT;
  delete process.env.RUNE_BUSINESS_ROOT;
});

describe('detectInstalledTiers', () => {
  test('returns [] for a project with no Rune hook configs', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    assert.deepStrictEqual(await detectInstalledTiers(projectRoot), []);
  });

  test('returns [] when only Free preset hooks are installed (no false positive)', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    await installProjectHooks(projectRoot, { preset: 'gentle' });
    assert.deepStrictEqual(await detectInstalledTiers(projectRoot), []);
  });

  test('detects pro from RUNE_PRO_ROOT tokens in .claude/settings.json', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    await seedTierRepo(projectRoot, 'pro');
    await installProjectHooks(projectRoot, { preset: 'gentle', tier: ['pro'] });
    assert.deepStrictEqual(await detectInstalledTiers(projectRoot), ['pro']);
  });

  test('detects business from tier token in .codex/hooks.json', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    await mkdir(path.join(projectRoot, '.codex'), { recursive: true });
    await writeFile(
      path.join(projectRoot, '.codex', 'hooks.json'),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: '.*',
              // biome-ignore lint/suspicious/noTemplateCurlyInString: literal env token by design
              hooks: [{ type: 'command', command: 'node "${RUNE_BUSINESS_ROOT}/hooks/gate.js"' }],
            },
          ],
        },
      }),
    );
    assert.deepStrictEqual(await detectInstalledTiers(projectRoot), ['business']);
  });

  test('detects pro from rune-tier frontmatter in .cursor/rules', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    const rulesDir = path.join(projectRoot, '.cursor', 'rules');
    await mkdir(rulesDir, { recursive: true });
    await writeFile(path.join(rulesDir, 'rune-pro-pulse.mdc'), '---\nrune-managed: true\nrune-tier: pro\n---\n# x\n');
    assert.deepStrictEqual(await detectInstalledTiers(projectRoot), ['pro']);
  });
});

describe('detectInstalledPreset', () => {
  test('returns null when nothing is installed', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    assert.strictEqual(await detectInstalledPreset(projectRoot), null);
  });

  test('returns the installed preset (strict)', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    await installProjectHooks(projectRoot, { preset: 'strict' });
    assert.strictEqual(await detectInstalledPreset(projectRoot), 'strict');
  });

  test('returns gentle for a gentle install', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    await installProjectHooks(projectRoot, { preset: 'gentle' });
    assert.strictEqual(await detectInstalledPreset(projectRoot), 'gentle');
  });
});

describe('pullTierRepos', () => {
  test('reports absent tiers as skipped without calling git', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    const calls = [];
    const exec = async (...args) => {
      calls.push(args);
      return { code: 0, stdout: '', stderr: '' };
    };
    const detected = detectTiers(projectRoot, { wellKnownPaths: { pro: [], business: [] } });
    const result = await pullTierRepos({ detected, exec });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(calls.length, 0);
    for (const r of result.results) {
      assert.strictEqual(r.status, 'absent');
    }
  });

  test('skips (with note) a detected tier that is not a git repo', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    await seedTierRepo(projectRoot, 'pro'); // no .git
    const exec = async () => {
      throw new Error('git must not be called');
    };
    const detected = detectTiers(projectRoot, { wellKnownPaths: { pro: [], business: [] } });
    const result = await pullTierRepos({ detected, exec });
    assert.strictEqual(result.ok, true);
    const pro = result.results.find((r) => r.tier === 'pro');
    assert.strictEqual(pro.status, 'skipped');
    assert.match(pro.detail, /not a git repo/i);
  });

  test('pulls a detected git tier with git -C <root> pull --ff-only', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    const tierRoot = await seedTierRepo(projectRoot, 'pro', { git: true });
    const calls = [];
    const exec = async (cmd, argv) => {
      calls.push([cmd, argv]);
      return { code: 0, stdout: 'Already up to date.\n', stderr: '' };
    };
    const detected = detectTiers(projectRoot, { wellKnownPaths: { pro: [], business: [] } });
    const result = await pullTierRepos({ detected, exec });
    assert.strictEqual(result.ok, true);
    const pro = result.results.find((r) => r.tier === 'pro');
    assert.strictEqual(pro.status, 'pulled');
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0][0], 'git');
    assert.deepStrictEqual(calls[0][1], ['-C', path.resolve(tierRoot), 'pull', '--ff-only']);
  });

  test('fails loud when git pull fails (dirty tree, auth, ...)', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    await seedTierRepo(projectRoot, 'pro', { git: true });
    const exec = async () => ({ code: 1, stdout: '', stderr: 'error: Your local changes would be overwritten' });
    const detected = detectTiers(projectRoot, { wellKnownPaths: { pro: [], business: [] } });
    const result = await pullTierRepos({ detected, exec });
    assert.strictEqual(result.ok, false);
    const pro = result.results.find((r) => r.tier === 'pro');
    assert.strictEqual(pro.status, 'failed');
    assert.match(pro.detail, /local changes/);
  });
});

describe('runUpdate', () => {
  test('fails with guidance when no Rune installation is detected', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    const runeRoot = await seedFakeRuneRoot(tmpRoot);
    const result = await runUpdate({
      projectRoot,
      runeRoot,
      args: {},
      deps: { wellKnownPaths: { pro: [], business: [] } },
    });
    assert.strictEqual(result.ok, false);
    assert.match(result.reason, /setup/i);
  });

  test('re-runs setup reusing installed preset + tier, pulls tier repo', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    const runeRoot = await seedFakeRuneRoot(tmpRoot);
    await seedTierRepo(projectRoot, 'pro', { git: true });
    await installProjectHooks(projectRoot, { preset: 'strict', tier: ['pro'] });
    const execCalls = [];
    const exec = async (cmd, argv) => {
      execCalls.push([cmd, argv]);
      return { code: 0, stdout: 'Already up to date.\n', stderr: '' };
    };

    const result = await runUpdate({
      projectRoot,
      runeRoot,
      args: {},
      deps: { exec, skillTarget: runeRoot, wellKnownPaths: { pro: [], business: [] } },
    });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.preset, 'strict');
    assert.deepStrictEqual(result.tiers, ['pro']);
    assert.strictEqual(execCalls.length, 1);
    assert.ok(result.setup, 'setup result expected');
    assert.deepStrictEqual(result.setup.tiers, ['pro']);
    assert.strictEqual(result.setup.preset, 'strict');
    assert.ok(result.drift, 'drift result expected');
    const pro = result.pull.results.find((r) => r.tier === 'pro');
    assert.strictEqual(pro.status, 'pulled');
  });

  test('does NOT run setup when a tier pull fails', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    const runeRoot = await seedFakeRuneRoot(tmpRoot);
    await seedTierRepo(projectRoot, 'pro', { git: true });
    await installProjectHooks(projectRoot, { preset: 'gentle', tier: ['pro'] });
    let setupRan = false;
    const result = await runUpdate({
      projectRoot,
      runeRoot,
      args: {},
      deps: {
        exec: async () => ({ code: 128, stdout: '', stderr: 'fatal: could not read Username' }),
        runSetupFn: async () => {
          setupRan = true;
          return {};
        },
        wellKnownPaths: { pro: [], business: [] },
      },
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(setupRan, false);
    assert.match(result.reason, /pull failed/i);
  });

  test('--no-pull skips git pulls entirely', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    const runeRoot = await seedFakeRuneRoot(tmpRoot);
    await seedTierRepo(projectRoot, 'pro', { git: true });
    await installProjectHooks(projectRoot, { preset: 'gentle', tier: ['pro'] });
    const exec = async () => {
      throw new Error('git must not be called with --no-pull');
    };
    const result = await runUpdate({
      projectRoot,
      runeRoot,
      args: { 'no-pull': true },
      deps: { exec, skillTarget: runeRoot, wellKnownPaths: { pro: [], business: [] } },
    });
    assert.strictEqual(result.ok, true);
    for (const r of result.pull.results) {
      assert.notStrictEqual(r.status, 'pulled');
    }
  });

  test('skips (with note) an installed tier whose repo is no longer found', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    const runeRoot = await seedFakeRuneRoot(tmpRoot);
    // Install hooks WITH the pro tier while the repo exists...
    await seedTierRepo(projectRoot, 'pro');
    await installProjectHooks(projectRoot, { preset: 'gentle', tier: ['pro'] });
    // ...then the repo disappears (user deleted the clone).
    await rm(path.join(projectRoot, '..', 'Pro'), { recursive: true, force: true });

    const result = await runUpdate({
      projectRoot,
      runeRoot,
      args: {},
      deps: { skillTarget: runeRoot, wellKnownPaths: { pro: [], business: [] } },
    });

    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.tiers, []);
    assert.ok(
      result.notes.some((n) => /pro/.test(n) && /not found/i.test(n)),
      `expected a "repo not found" note, got: ${JSON.stringify(result.notes)}`,
    );
  });

  test('--dry passes dry through to setup (no writes)', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    const runeRoot = await seedFakeRuneRoot(tmpRoot);
    await installProjectHooks(projectRoot, { preset: 'gentle' });
    const result = await runUpdate({
      projectRoot,
      runeRoot,
      args: { dry: true, 'no-pull': true },
      deps: { skillTarget: runeRoot, wellKnownPaths: { pro: [], business: [] } },
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.setup.written, false);
  });

  test('flags Codex re-trust when .codex/hooks.json content changed', async () => {
    const projectRoot = path.join(tmpRoot, 'project');
    const runeRoot = await seedFakeRuneRoot(tmpRoot);
    await mkdir(path.join(projectRoot, '.codex'), { recursive: true });
    // Stale/no hooks file → setup rewrite will change it.
    const result = await runUpdate({
      projectRoot,
      runeRoot,
      args: { 'no-pull': true },
      deps: { skillTarget: runeRoot, wellKnownPaths: { pro: [], business: [] } },
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.codexReTrust, true);
  });
});

describe('formatUpdateResult', () => {
  test('renders pull, setup, and verification summary', () => {
    const out = formatUpdateResult({
      ok: true,
      pull: {
        ok: true,
        results: [
          { tier: 'pro', status: 'pulled', detail: 'Already up to date.' },
          { tier: 'business', status: 'absent', detail: 'not detected' },
        ],
      },
      platforms: ['claude'],
      preset: 'gentle',
      tiers: ['pro'],
      setup: {
        scope: 'current',
        targetRoot: '/p',
        tiers: ['pro'],
        preset: 'gentle',
        platforms: ['claude'],
        written: true,
        skillResults: [],
      },
      drift: {
        findings: [],
        summary: { drifted: 0, missing: 0, errors: 0 },
        platforms: [{ platform: 'claude', preset: 'gentle' }],
      },
      doctor: { skipped: true, reason: 'no rune.config.json' },
      codexReTrust: false,
      notes: [],
    });
    assert.match(out, /Rune Update/);
    assert.match(out, /pro.*pulled/i);
    assert.match(out, /business.*not detected/i);
    assert.match(out, /preset.*gentle/i);
    assert.match(out, /0 drifted, 0 missing/);
    assert.doesNotMatch(out, /\/hooks/);
  });

  test('renders the Codex re-trust reminder when hooks.json changed', () => {
    const out = formatUpdateResult({
      ok: true,
      pull: { ok: true, results: [] },
      platforms: ['codex'],
      preset: 'gentle',
      tiers: [],
      setup: { platforms: ['codex'], written: true, skillResults: [] },
      drift: { findings: [], summary: { drifted: 0, missing: 0, errors: 0 }, platforms: [] },
      doctor: { skipped: true, reason: 'no rune.config.json' },
      codexReTrust: true,
      notes: [],
    });
    assert.match(out, /\/hooks/);
    assert.match(out, /re-trust/i);
  });

  test('renders loud failure for a failed pull', () => {
    const out = formatUpdateResult({
      ok: false,
      reason: 'tier pull failed — resolve manually and re-run `rune update`',
      pull: {
        ok: false,
        results: [{ tier: 'pro', status: 'failed', detail: 'error: Your local changes would be overwritten' }],
      },
      notes: [],
    });
    assert.match(out, /✗/);
    assert.match(out, /pro/);
    assert.match(out, /local changes/);
    assert.match(out, /re-run/i);
  });
});
