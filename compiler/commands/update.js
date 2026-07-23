/**
 * `rune update` — one-shot updater for an already-configured project.
 *
 * Mirrors the manual "Updating" flow from the README in a single command:
 *   1. `git pull --ff-only` any detected paid tier repos (Pro / Business).
 *      Detection reuses setup's logic: $RUNE_PRO_ROOT / $RUNE_BUSINESS_ROOT
 *      env vars, then sibling dirs (../Pro, ../Business), then well-known
 *      paths. Absent tiers and non-git checkouts are skipped with a note;
 *      a FAILED pull aborts the update (fail loud — never silently continue).
 *   2. Re-run the managed setup rewrite in place, non-interactively: the
 *      installed platforms, preset, and tiers are detected from the project's
 *      existing hook config instead of prompting. Delegates to `runSetup`.
 *   3. Verify: compiled-output doctor (when a rune.config.json build exists)
 *      + hook drift report, then print a short summary. Codex users are
 *      reminded to re-trust hooks via `/hooks` when `.codex/hooks.json`
 *      changed.
 *
 * Non-interactive by design — safe to run from scripts. Flags:
 *   --no-pull            skip step 1 (tier repos managed some other way)
 *   --preset <p>         override the detected preset
 *   --tier <t>[,<t>]     override the detected tier list
 *   --dry                preview: skip pulls, pass dry to setup (no writes)
 */

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { ADAPTERS, detectPlatforms } from '../adapters/hooks/index.js';
import { checkHookDrift } from './hooks/drift.js';
import { TIER_ENV_VARS } from './hooks/tiers.js';
import { detectTiers, runSetup } from './setup.js';

/** Installed hook configs that may carry tier tokens (env var references). */
const TIER_SCAN_FILES = ['.claude/settings.json', '.codex/hooks.json'];

/** Rule/workflow dirs whose Rune-managed files carry `rune-tier:` frontmatter. */
const TIER_SCAN_DIRS = ['.cursor/rules', '.windsurf/rules', '.windsurf/workflows', '.antigravity/rules'];

const CODEX_HOOKS_REL_PATH = '.codex/hooks.json';

/**
 * Detect which paid tiers are wired into this project's installed hook config.
 * Reads the config files Rune manages and looks for tier env-var tokens
 * (`RUNE_PRO_ROOT` / `RUNE_BUSINESS_ROOT`) or `rune-tier:` frontmatter.
 * Free preset entries never contain either marker, so a Free-only install
 * returns [].
 *
 * @param {string} projectRoot
 * @returns {Promise<string[]>} tier names, e.g. ['pro']
 */
export async function detectInstalledTiers(projectRoot) {
  const chunks = [];
  for (const rel of TIER_SCAN_FILES) {
    const filePath = path.join(projectRoot, rel);
    if (existsSync(filePath)) {
      chunks.push(await readFile(filePath, 'utf-8').catch(() => ''));
    }
  }
  for (const rel of TIER_SCAN_DIRS) {
    const dir = path.join(projectRoot, rel);
    if (!existsSync(dir)) continue;
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile() || !/\.(md|mdc)$/.test(entry.name)) continue;
      chunks.push(await readFile(path.join(dir, entry.name), 'utf-8').catch(() => ''));
    }
  }
  const text = chunks.join('\n');
  const tiers = [];
  for (const [tier, envVar] of Object.entries(TIER_ENV_VARS)) {
    const marker = new RegExp(`${envVar}|rune-tier:\\s*${tier}\\b`);
    if (marker.test(text)) tiers.push(tier);
  }
  return tiers;
}

/**
 * Detect the preset the project was installed with, by asking each detected
 * platform adapter for its status. A `mixed` install resolves to `gentle`
 * (same fallback the drift reporter uses for canonical comparison).
 *
 * @param {string} projectRoot
 * @returns {Promise<'gentle'|'strict'|null>} null when nothing is installed
 */
export async function detectInstalledPreset(projectRoot) {
  for (const id of detectPlatforms(projectRoot)) {
    const status = await ADAPTERS[id].status(projectRoot);
    if (!status.installed || !status.preset) continue;
    if (status.preset === 'mixed') return 'gentle';
    if (status.preset === 'gentle' || status.preset === 'strict') return status.preset;
  }
  return null;
}

/**
 * Default command runner — thin execFile wrapper that never throws.
 * @returns {Promise<{code: number, stdout: string, stderr: string}>}
 */
function defaultExec(cmd, argv) {
  return new Promise((resolve) => {
    execFile(cmd, argv, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        resolve({
          code: typeof err.code === 'number' ? err.code : 1,
          stdout: stdout ?? '',
          stderr: stderr || err.message,
        });
      } else {
        resolve({ code: 0, stdout: stdout ?? '', stderr: stderr ?? '' });
      }
    });
  });
}

/**
 * `git pull --ff-only` each detected tier repo.
 *
 * Statuses per tier:
 *   - absent  — tier not detected (no env var / sibling / well-known path)
 *   - skipped — detected but not a git checkout (npx/tarball install)
 *   - pulled  — git pull succeeded
 *   - failed  — git pull failed (dirty tree, auth, diverged…) → result.ok=false
 *
 * @param {{ detected: ReturnType<typeof detectTiers>, exec?: typeof defaultExec }} opts
 * @returns {Promise<{ ok: boolean, results: Array<{tier: string, root: string|null, status: string, detail: string}> }>}
 */
export async function pullTierRepos({ detected, exec = defaultExec }) {
  const results = [];
  for (const tier of Object.keys(TIER_ENV_VARS)) {
    const info = detected[tier];
    if (!info) {
      results.push({ tier, root: null, status: 'absent', detail: 'not detected — skipping' });
      continue;
    }
    // detectTiers points at <tierRoot>/hooks/manifest.json — walk back to the root.
    const tierRoot = path.resolve(path.dirname(path.dirname(info.path)));
    if (!existsSync(path.join(tierRoot, '.git'))) {
      results.push({
        tier,
        root: tierRoot,
        status: 'skipped',
        detail: `${tierRoot} is not a git repo — pull skipped (update it the way it was installed)`,
      });
      continue;
    }
    const { code, stdout, stderr } = await exec('git', ['-C', tierRoot, 'pull', '--ff-only']);
    if (code === 0) {
      const summary = (stdout.trim().split('\n').pop() || 'done').trim();
      results.push({ tier, root: tierRoot, status: 'pulled', detail: summary });
    } else {
      results.push({ tier, root: tierRoot, status: 'failed', detail: (stderr || stdout).trim() });
    }
  }
  return { ok: results.every((r) => r.status !== 'failed'), results };
}

/**
 * Compiled-output verification. Only meaningful for build-pipeline projects
 * (rune.config.json with a non-Claude platform) — Claude Code loads source
 * SKILL.md files natively, so there is no compiled output to check.
 */
async function defaultDoctorCheck(projectRoot, runeRoot) {
  const configPath = path.join(projectRoot, 'rune.config.json');
  if (!existsSync(configPath)) {
    return { skipped: true, reason: 'no rune.config.json — compiled-output check skipped' };
  }
  let config;
  try {
    config = JSON.parse(await readFile(configPath, 'utf-8'));
  } catch (err) {
    return { skipped: true, reason: `rune.config.json unreadable (${err.message}) — compiled-output check skipped` };
  }
  if (!config.platform || config.platform === 'claude') {
    return { skipped: true, reason: 'Claude Code native — no compiled output to check' };
  }
  const { runDoctor } = await import('../doctor.js');
  const { getAdapter } = await import('../adapters/index.js');
  const resolvedRuneRoot = config.source === '@rune-kit/rune' ? runeRoot : config.source || runeRoot;
  const results = await runDoctor({
    outputRoot: projectRoot,
    adapter: getAdapter(config.platform),
    config,
    runeRoot: resolvedRuneRoot,
  });
  return { skipped: false, healthy: results.healthy, results };
}

/**
 * The full update flow. Pure orchestration — every side-effecting collaborator
 * is injectable via `deps` for tests.
 *
 * @param {object} opts
 * @param {string} opts.projectRoot
 * @param {string} opts.runeRoot
 * @param {object} [opts.args] — CLI flags: no-pull, preset, tier, dry
 * @param {object} [opts.deps] — { exec, runSetupFn, checkHookDriftFn, doctorFn, skillTarget, wellKnownPaths }
 * @returns {Promise<object>} structured result for formatUpdateResult
 */
export async function runUpdate({ projectRoot, runeRoot, args = {}, deps = {} }) {
  const notes = [];

  // ── 0. Something to update? ──
  const platforms = detectPlatforms(projectRoot);
  if (platforms.length === 0) {
    return {
      ok: false,
      reason:
        'No Rune installation detected in this project — nothing to update. Run `npx @rune-kit/rune setup` first.',
      pull: { ok: true, results: [] },
      notes,
    };
  }

  // ── 1. Pull tier repos (fail loud on pull errors) ──
  const detected = detectTiers(projectRoot, deps.wellKnownPaths ? { wellKnownPaths: deps.wellKnownPaths } : {});
  let pull;
  if (args['no-pull'] || args.dry) {
    const why = args['no-pull'] ? '--no-pull' : '--dry';
    pull = {
      ok: true,
      results: Object.keys(TIER_ENV_VARS).map((tier) => ({
        tier,
        root: null,
        status: detected[tier] ? 'skipped' : 'absent',
        detail: detected[tier] ? `pull skipped (${why})` : 'not detected — skipping',
      })),
    };
  } else {
    pull = await pullTierRepos({ detected, exec: deps.exec });
  }
  if (!pull.ok) {
    return {
      ok: false,
      reason: 'tier pull failed — resolve it manually (dirty tree? auth?) then re-run `rune update`',
      pull,
      notes,
    };
  }

  // ── 2. Re-run managed setup, reusing what is already installed ──
  const preset = args.preset || (await detectInstalledPreset(projectRoot)) || 'gentle';
  let tiers;
  if (args.tier) {
    tiers = String(args.tier)
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  } else {
    const installed = await detectInstalledTiers(projectRoot);
    tiers = installed.filter((tier) => detected[tier]);
    for (const tier of installed) {
      if (!detected[tier]) {
        const envVar = TIER_ENV_VARS[tier] || `RUNE_${tier.toUpperCase()}_ROOT`;
        notes.push(
          `${tier}: hooks are installed but the tier repo was not found — skipping. Set $${envVar} or clone the repo next to Free, then re-run \`rune update\`.`,
        );
      }
    }
  }

  const codexHooksPath = path.join(projectRoot, CODEX_HOOKS_REL_PATH);
  const codexBefore = existsSync(codexHooksPath) ? await readFile(codexHooksPath, 'utf-8').catch(() => null) : null;

  const setupArgs = {
    here: true,
    preset,
    dry: args.dry,
    ...(tiers.length > 0 ? { tier: tiers.join(',') } : { 'no-tier': true }),
  };
  const setup = await (deps.runSetupFn || runSetup)({
    projectRoot,
    runeRoot,
    args: setupArgs,
    skillTarget: deps.skillTarget,
  });

  const codexAfter = existsSync(codexHooksPath) ? await readFile(codexHooksPath, 'utf-8').catch(() => null) : null;
  const codexReTrust = platforms.includes('codex') && codexBefore !== codexAfter;

  // ── 3. Verify: compiled output + hook drift ──
  const doctor = await (deps.doctorFn || defaultDoctorCheck)(projectRoot, runeRoot);
  const drift = await (deps.checkHookDriftFn || checkHookDrift)(projectRoot);

  return { ok: true, pull, platforms, preset, tiers, setup, drift, doctor, codexReTrust, notes };
}

const PULL_ICONS = { pulled: '✓', absent: '·', skipped: '·', failed: '✗' };

/**
 * Render a runUpdate result for console output.
 * @param {Awaited<ReturnType<typeof runUpdate>>} result
 * @returns {string}
 */
export function formatUpdateResult(result) {
  const lines = [];
  lines.push('');
  lines.push('  Rune Update');
  lines.push('  ────────────');

  if (result.pull?.results?.length > 0) {
    lines.push('  Tier repos:');
    for (const r of result.pull.results) {
      const icon = PULL_ICONS[r.status] || '·';
      const label = r.status === 'failed' ? 'pull FAILED' : r.status;
      lines.push(`    ${icon} ${r.tier} — ${label}: ${r.detail}`);
    }
  }

  if (!result.ok) {
    lines.push('');
    lines.push(`  ✗ Update aborted: ${result.reason}`);
    lines.push('');
    return lines.join('\n');
  }

  lines.push('  Setup rewrite:');
  lines.push(
    `    Platforms: ${(result.setup?.platforms || result.platforms || []).join(', ') || '—'} | Preset: ${result.preset} | Tiers: Free${result.tiers?.length ? ` + ${result.tiers.join(' + ')}` : ''}`,
  );
  for (const sr of result.setup?.skillResults || []) {
    if (sr.installed?.length > 0) {
      lines.push(`    Skills: ${sr.tier}: ${sr.installed.length} installed`);
    } else if (sr.skipped?.length > 0) {
      lines.push(`    Skills: ${sr.tier}: ${sr.skipped.length} already present / skipped`);
    }
  }
  if (result.setup && result.setup.written === false) {
    lines.push('    (dry-run — no files written)');
  }

  lines.push('  Verify:');
  if (result.doctor?.skipped) {
    lines.push(`    Doctor: skipped — ${result.doctor.reason}`);
  } else if (result.doctor) {
    lines.push(`    Doctor: ${result.doctor.healthy ? '✓ healthy' : '✗ issues found — run `rune doctor` for detail'}`);
  }
  if (result.drift?.summary) {
    const s = result.drift.summary;
    lines.push(`    Hook drift: ${s.drifted} drifted, ${s.missing} missing, ${s.errors} error(s)`);
  }

  for (const note of result.notes || []) {
    lines.push(`  ⚠ ${note}`);
  }

  if (result.codexReTrust) {
    lines.push('');
    lines.push('  ⚠ Codex: .codex/hooks.json changed — open /hooks in Codex to review and re-trust the definitions.');
  }

  lines.push('');
  return lines.join('\n');
}
