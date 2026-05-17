/**
 * `rune setup` — Interactive Setup Wizard
 *
 * One-shot configuration: detects available tiers, asks the operator three
 * questions (scope / tiers / preset), and wires hooks to the chosen
 * destination. Replaces the multi-step `cd <project> && export RUNE_PRO_ROOT
 * && rune hooks install --preset gentle --tier pro` workflow with a single
 * command.
 *
 * Non-interactive mode: pass `--here` / `--global` + `--preset` + `--tier`
 * flags to skip prompts. Useful for CI / scripted setups.
 *
 * Scopes:
 *   - current  — `<cwd>/.claude/settings.json` (per-project, default)
 *   - global   — `~/.claude/settings.json` (every Claude Code session)
 *
 * Tier auto-detection paths (in order):
 *   1. `$RUNE_PRO_ROOT` / `$RUNE_BUSINESS_ROOT` env var
 *   2. `<cwd>/../Pro/hooks/manifest.json` (monorepo sibling)
 *   3. Well-known paths: `D:/Project/Rune/Pro`, `~/rune-pro`, etc.
 */

import { existsSync, readFileSync } from 'node:fs';
import { cp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { installHooks } from './hooks/install.js';
import { resolveTier, TIER_ENV_VARS } from './hooks/tiers.js';

export const WELL_KNOWN_TIER_PATHS = {
  pro: ['D:/Project/Rune/Pro', path.join(os.homedir(), 'rune-pro'), path.join(os.homedir(), 'Project', 'Rune', 'Pro')],
  business: [
    'D:/Project/Rune/Business',
    path.join(os.homedir(), 'rune-business'),
    path.join(os.homedir(), 'Project', 'Rune', 'Business'),
  ],
};

/**
 * @param {{ projectRoot: string, runeRoot: string, args: object }} opts
 * @returns {Promise<{ scope: string, tiers: string[], preset: string, written: boolean, files: string[], notes: string[], skillResults: Array<{tier: string, installed: string[], skipped: Array<{skill: string, reason: string}>, reason: string|null}> }>}
 */
export async function runSetup({ projectRoot, runeRoot, args = {} }) {
  const detected = detectTiers(projectRoot);

  // Scope resolution
  let scope;
  if (args.global) scope = 'global';
  else if (args.here) scope = 'current';
  else scope = await promptScope(projectRoot);

  // Tier resolution
  let tiers;
  if (args.tier) {
    tiers = Array.isArray(args.tier) ? args.tier : String(args.tier).split(',');
  } else if (args['no-tier']) {
    tiers = [];
  } else {
    tiers = await promptTiers(detected);
  }

  // Preset resolution
  const preset = args.preset || (await promptPreset());

  // Determine target root
  const targetRoot = scope === 'global' ? os.homedir() : projectRoot;

  // For global scope, claude is the only meaningful platform (cursor/windsurf
  // configs typically live per-project). Force claude.
  const platform = scope === 'global' ? 'claude' : args.platform;

  // Set tier env vars from detection so installer can resolve
  for (const tier of tiers) {
    const envVar = TIER_ENV_VARS[tier];
    if (envVar && !process.env[envVar] && detected[tier]?.path) {
      // Walk back from manifest.json → tier root
      const manifestPath = detected[tier].path;
      const tierRoot = path.dirname(path.dirname(manifestPath));
      process.env[envVar] = tierRoot;
    }
  }

  // Run installer
  const result = await installHooks(targetRoot, {
    preset,
    tier: tiers,
    platform,
    dry: args.dry,
  });

  // Install tier skill files into <runeRoot>/skills/ so Claude Code (and any
  // plugin-aware platform) discovers them alongside Free skills. Without this
  // step, paid tiers ship hooks only — `rune:autopilot` returns "Unknown skill"
  // because Pro/skills/autopilot/ is invisible to the plugin runtime.
  const skillResults = [];
  for (const tier of tiers) {
    try {
      const tierManifest = await resolveTier(tier, projectRoot);
      const skillResult = await installTierSkills({
        tier,
        tierManifest,
        runeRoot,
        dry: args.dry,
      });
      skillResults.push(skillResult);
    } catch (err) {
      skillResults.push({ tier, installed: [], skipped: [], reason: err.message });
    }
  }

  return {
    scope,
    targetRoot,
    tiers,
    preset,
    detected,
    skillResults,
    ...result,
  };
}

/**
 * Copy a tier's skill directories into the Free plugin's skills/ folder so
 * the Claude Code plugin runtime discovers them with the `rune:` prefix.
 *
 * Idempotent: existing skill directories are SKIPPED (not overwritten). This
 * protects Free skills from being clobbered by a same-named Pro skill, and
 * protects an in-place edit of a previously-installed Pro skill from being
 * stomped on a re-run.
 *
 * Pre-condition: tierManifest.source points at the absolute path of the tier's
 * manifest.json (set by validateManifest). Tier root = grandparent of that path.
 *
 * @param {object} opts
 * @param {string} opts.tier
 * @param {import('./hooks/tiers.js').TierManifest} opts.tierManifest
 * @param {string} opts.runeRoot — target is `<runeRoot>/skills/`
 * @param {boolean} [opts.dry]
 * @returns {Promise<{tier: string, installed: string[], skipped: Array<{skill: string, reason: string}>, reason: string|null}>}
 */
export async function installTierSkills({ tier, tierManifest, runeRoot, dry }) {
  if (!tierManifest?.source) {
    return { tier, installed: [], skipped: [], reason: 'tier manifest source missing' };
  }
  // Defensive: validateManifest accepts any string; only locateTierManifest guarantees absolute.
  // Reject relative to keep tierRoot derivation honest.
  if (!path.isAbsolute(tierManifest.source)) {
    return {
      tier,
      installed: [],
      skipped: [],
      reason: `tier manifest source must be absolute (got ${tierManifest.source})`,
    };
  }
  const tierRoot = path.dirname(path.dirname(tierManifest.source));
  const sourceDir = path.join(tierRoot, 'skills');
  if (!existsSync(sourceDir)) {
    return { tier, installed: [], skipped: [], reason: `no skills/ dir at ${sourceDir}` };
  }
  if (!runeRoot) {
    return { tier, installed: [], skipped: [], reason: 'runeRoot not provided' };
  }
  const targetDir = path.join(runeRoot, 'skills');
  if (!existsSync(targetDir)) {
    return { tier, installed: [], skipped: [], reason: `target skills/ missing at ${targetDir}` };
  }
  const installed = [];
  const skipped = [];
  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      // Reject symlinks even when their target is a directory — `cp` with default
      // dereference=false would recreate the symlink and let the Claude Code runtime
      // follow it outside runeRoot/skills/ at read time (POSIX symlink-escape).
      if (entry.isSymbolicLink()) {
        skipped.push({ skill: entry.name, reason: 'rejected: symlink (would escape sandbox)' });
      }
      continue;
    }
    const skillName = entry.name;
    // Guard against path traversal via adversarial directory names (../, /, \).
    // A compromised tier repo with a skill dir like '../../../etc' would otherwise
    // escape runeRoot/skills/ and overwrite arbitrary files. assertSafeTierName
    // in tiers.js covers the tier name but NOT per-skill directory names.
    if (path.basename(skillName) !== skillName || skillName === '.' || skillName === '..') {
      skipped.push({ skill: skillName, reason: 'rejected: unsafe directory name' });
      continue;
    }
    const src = path.join(sourceDir, skillName);
    const dst = path.join(targetDir, skillName);
    if (existsSync(dst)) {
      const drift = await detectVersionDrift(src, dst);
      skipped.push({ skill: skillName, reason: drift || 'already present' });
      continue;
    }
    if (!dry) {
      try {
        // dereference: true → copy symlink targets as content instead of recreating
        // symlinks at dst. Belt-and-suspenders alongside the isSymbolicLink reject above
        // (nested symlinks inside a skill dir would otherwise still recreate).
        await cp(src, dst, { recursive: true, dereference: true });
      } catch (err) {
        // Clean partial-copy residue so next run isn't silently locked-out by
        // existsSync(dst) on a corrupt half-written directory.
        await rm(dst, { recursive: true, force: true }).catch(() => {});
        skipped.push({ skill: skillName, reason: `copy failed: ${err.message}` });
        continue;
      }
    }
    installed.push(skillName);
  }
  return { tier, installed, skipped, reason: null };
}

/**
 * Compare source SKILL.md version against installed version. Returns a string
 * describing the drift if source is newer (so user knows an upgrade exists),
 * or null when versions match / cannot be parsed. Never throws — best-effort.
 *
 * @param {string} srcSkillDir
 * @param {string} dstSkillDir
 * @returns {Promise<string|null>}
 */
async function detectVersionDrift(srcSkillDir, dstSkillDir) {
  try {
    const [srcVer, dstVer] = await Promise.all([
      readSkillVersion(path.join(srcSkillDir, 'SKILL.md')),
      readSkillVersion(path.join(dstSkillDir, 'SKILL.md')),
    ]);
    if (!srcVer || !dstVer) return null;
    if (srcVer === dstVer) return `already present (v${dstVer})`;
    return `stale: installed v${dstVer}, source has v${srcVer} — delete target dir to upgrade`;
  } catch {
    return null;
  }
}

/**
 * Extract version string from a SKILL.md `metadata.version` field. Minimal
 * YAML scan scoped to the `metadata:` block — avoids false positives from
 * multiline description continuation lines that contain `version:` text
 * (e.g. `description: |\n  version: 1.0.0 is legacy`). Avoids pulling in a
 * full YAML dependency for one field.
 *
 * Returns null when SKILL.md cannot be read, frontmatter missing, metadata
 * block missing, or version field absent.
 *
 * @param {string} skillMdPath
 * @returns {Promise<string|null>}
 */
async function readSkillVersion(skillMdPath) {
  try {
    const content = await readFile(skillMdPath, 'utf-8');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;
    // Require metadata: header followed by an indented version: line.
    // Indent is preserved so a top-level `version:` (outside metadata) doesn't match.
    const verMatch = fmMatch[1].match(/^metadata:\s*\n(?:\s+[^\n]*\n)*?\s+version:\s*["']?([^"'\s#]+)/m);
    return verMatch ? verMatch[1] : null;
  } catch {
    return null;
  }
}

/**
 * Auto-detect Pro/Business tiers across env vars, sibling paths, and well-known
 * locations. Returns { pro: { path, source } | null, business: { ... } | null }.
 *
 * @param {string} projectRoot
 * @param {{wellKnownPaths?: { pro: string[], business: string[] }}} opts —
 *   pass `wellKnownPaths: { pro: [], business: [] }` to disable well-known
 *   path lookup (useful in tests so detection doesn't pick up
 *   D:/Project/Rune/Pro on the maintainer's machine).
 */
export function detectTiers(projectRoot, opts = {}) {
  const wellKnown = opts.wellKnownPaths ?? WELL_KNOWN_TIER_PATHS;
  const result = { pro: null, business: null };

  for (const tier of ['pro', 'business']) {
    const envVar = TIER_ENV_VARS[tier];
    const fromEnv = process.env[envVar];
    if (fromEnv) {
      const manifest = path.join(fromEnv, 'hooks', 'manifest.json');
      if (existsSync(manifest)) {
        result[tier] = { path: manifest, source: `$${envVar}`, version: readManifestVersion(manifest) };
        continue;
      }
    }

    // Sibling path
    const sibling = path.join(projectRoot, '..', tier === 'pro' ? 'Pro' : 'Business', 'hooks', 'manifest.json');
    if (existsSync(sibling)) {
      result[tier] = {
        path: path.resolve(sibling),
        source: `sibling (${path.relative(projectRoot, path.resolve(sibling))})`,
        version: readManifestVersion(sibling),
      };
      continue;
    }

    // Well-known paths
    for (const knownRoot of wellKnown[tier] ?? []) {
      const manifest = path.join(knownRoot, 'hooks', 'manifest.json');
      if (existsSync(manifest)) {
        result[tier] = { path: manifest, source: `well-known (${knownRoot})`, version: readManifestVersion(manifest) };
        break;
      }
    }
  }

  return result;
}

function readManifestVersion(manifestPath) {
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf-8')).version || 'unknown';
  } catch {
    return 'unknown';
  }
}

async function promptScope(projectRoot) {
  console.log('');
  console.log('  Where to install hooks?');
  console.log(`    [c] Current project — ${projectRoot}/.claude/settings.json`);
  console.log(`    [g] Global          — ${path.join(os.homedir(), '.claude', 'settings.json')}`);
  console.log('         (every Claude Code session, regardless of project)');
  console.log('');
  const answer = (await prompt('  Scope [c/g] (default c): ')).toLowerCase();
  return answer.startsWith('g') ? 'global' : 'current';
}

async function promptTiers(detected) {
  console.log('');
  console.log('  Which tiers to install?');
  console.log('    [x] Free (always — required)');
  if (detected.pro) {
    console.log(`    [?] Pro      — detected ${detected.pro.source} (v${detected.pro.version})`);
  } else {
    console.log('    [ ] Pro      — not detected');
  }
  if (detected.business) {
    console.log(`    [?] Business — detected ${detected.business.source} (v${detected.business.version})`);
  } else {
    console.log('    [ ] Business — not detected');
  }
  console.log('');

  const tiers = [];
  if (detected.pro) {
    const usePro = (await prompt('  Install Pro tier? [Y/n]: ')).toLowerCase();
    if (!usePro.startsWith('n')) tiers.push('pro');
  }
  if (detected.business) {
    const useBiz = (await prompt('  Install Business tier? [Y/n]: ')).toLowerCase();
    if (!useBiz.startsWith('n')) tiers.push('business');
  }
  return tiers;
}

async function promptPreset() {
  console.log('');
  console.log('  Preset:');
  console.log('    [g] gentle — advisory mode, hooks warn but never block (recommended)');
  console.log('    [s] strict — hooks BLOCK on violations (CI/AFK use)');
  console.log('');
  const answer = (await prompt('  Preset [g/s] (default g): ')).toLowerCase();
  return answer.startsWith('s') ? 'strict' : 'gentle';
}

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Format setup result for console output.
 */
export function formatSetupResult(result) {
  const lines = [];
  lines.push('');
  lines.push('  Rune Setup Complete');
  lines.push('  ──────────────────');
  lines.push(
    `  Scope:     ${result.scope === 'global' ? 'GLOBAL (~/.claude/settings.json)' : `current project (${result.targetRoot})`}`,
  );
  lines.push(`  Tiers:     Free${result.tiers.length > 0 ? ` + ${result.tiers.join(' + ')}` : ''}`);
  lines.push(`  Preset:    ${result.preset}`);
  lines.push(`  Platforms: ${(result.platforms || []).join(', ') || '—'}`);
  for (const sr of result.skillResults || []) {
    if (sr.installed.length > 0) {
      const preview = sr.installed.slice(0, 3).join(', ');
      const more = sr.installed.length > 3 ? `, +${sr.installed.length - 3}` : '';
      lines.push(`  Skills:    ${sr.tier}: ${sr.installed.length} installed (${preview}${more})`);
    }
    if (sr.skipped.length > 0) {
      const rejected = sr.skipped.filter((s) => s.reason.startsWith('rejected:'));
      const benign = sr.skipped.length - rejected.length;
      const parts = [];
      if (benign > 0) parts.push(`${benign} already present`);
      if (rejected.length > 0) parts.push(`${rejected.length} rejected`);
      lines.push(`  Skipped:   ${sr.tier}: ${parts.join(', ')}`);
      // Surface rejection details so the operator can investigate a compromised tier repo.
      for (const r of rejected) {
        lines.push(`    ⚠ ${r.skill}: ${r.reason}`);
      }
    }
    if (sr.reason) {
      lines.push(`  Skill warn:${sr.tier}: ${sr.reason}`);
    }
  }
  if (result.notes?.length) {
    lines.push('');
    lines.push('  Notes:');
    for (const note of result.notes) lines.push(`    • ${note}`);
  }
  lines.push('');
  lines.push('  Verify:');
  lines.push('    rune doctor --hooks   # check drift');
  lines.push('    rune hooks status     # show wired skills');
  lines.push('');
  return lines.join('\n');
}
