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
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { installHooks } from './hooks/install.js';
import { TIER_ENV_VARS } from './hooks/tiers.js';

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
 * @returns {Promise<{ scope: string, tiers: string[], preset: string, written: boolean, files: string[], notes: string[] }>}
 */
export async function runSetup({ projectRoot, runeRoot: _runeRoot, args = {} }) {
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

  return {
    scope,
    targetRoot,
    tiers,
    preset,
    detected,
    ...result,
  };
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
  lines.push(`  Scope:     ${result.scope === 'global' ? 'GLOBAL (~/.claude/settings.json)' : `current project (${result.targetRoot})`}`);
  lines.push(`  Tiers:     Free${result.tiers.length > 0 ? ` + ${result.tiers.join(' + ')}` : ''}`);
  lines.push(`  Preset:    ${result.preset}`);
  lines.push(`  Platforms: ${(result.platforms || []).join(', ') || '—'}`);
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
