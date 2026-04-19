/**
 * `rune hooks status [--platform <name>|all]`
 *
 * For each detected (or requested) platform, reports:
 *   - installed (boolean)
 *   - preset (gentle | strict | mixed | null)
 *   - wired skills
 *   - missing skills (present-in-project-but-not-wired)
 *   - per-platform notes
 *
 * Claude Code adapter additionally returns `events` for hook-level detail.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { ADAPTERS, CAPABILITIES, detectPlatforms, getAdapter, PLATFORM_KEYS } from '../../adapters/hooks/index.js';
import { WIRED_SKILLS } from './presets.js';
import { checkManifestRequires, locateTierManifest, resolveTier } from './tiers.js';

/**
 * @param {string} projectRoot
 * @param {string} runeRoot
 * @param {{platform?: string|string[], tier?: string|string[]}} args
 */
export async function hookStatus(projectRoot, runeRoot, args = {}) {
  const platforms = resolvePlatforms(projectRoot, args.platform);
  const missingInRepo = findMissingSkills(runeRoot, WIRED_SKILLS);
  const tiers = await resolveRequestedTiers(projectRoot, args.tier);

  if (platforms.length === 0) {
    return {
      platforms: [],
      results: [],
      tiers,
      missingInRepo,
      notes: [
        'No target platform detected. Create `.claude/`, `.cursor/`, `.windsurf/`, or `.antigravity/` first, or pass `--platform <name>`.',
      ],
    };
  }

  const results = [];
  for (const id of platforms) {
    const adapter = getAdapter(id);
    const info = await adapter.status(projectRoot);
    results.push({
      platform: id,
      capability: CAPABILITIES[id] ?? null,
      ...info,
    });
  }

  return { platforms, results, tiers, missingInRepo, notes: [] };
}

async function resolveRequestedTiers(projectRoot, requested) {
  if (!requested) return [];
  const list = Array.isArray(requested) ? requested : [requested];
  const out = [];
  for (const tier of Array.from(new Set(list))) {
    const loc = locateTierManifest(tier, projectRoot);
    if (!loc) {
      out.push({ tier, found: false, manifestPath: null, requiresOk: false, requiresMissing: [], entries: 0 });
      continue;
    }
    try {
      const manifest = await resolveTier(tier, projectRoot);
      const req = checkManifestRequires(manifest);
      out.push({
        tier,
        found: true,
        manifestPath: loc,
        requiresOk: req.ok,
        requiresMissing: req.missing,
        entries: manifest.entries.length,
        version: manifest.version,
      });
    } catch (err) {
      out.push({
        tier,
        found: false,
        manifestPath: loc,
        error: err.message,
        requiresOk: false,
        requiresMissing: [],
        entries: 0,
      });
    }
  }
  return out;
}

function resolvePlatforms(projectRoot, requested) {
  if (!requested) return detectPlatforms(projectRoot);
  const list = Array.isArray(requested) ? requested : [requested];
  const expanded = [];
  for (const item of list) {
    if (item === 'all') {
      expanded.push(...PLATFORM_KEYS);
    } else if (ADAPTERS[item]) {
      expanded.push(item);
    } else {
      throw new Error(`Unknown platform: ${item}. Choose from: ${PLATFORM_KEYS.join(', ')}, all`);
    }
  }
  return Array.from(new Set(expanded));
}

function findMissingSkills(runeRoot, skills) {
  const skillsDir = path.join(runeRoot, 'skills');
  return skills.filter((skill) => !existsSync(path.join(skillsDir, skill, 'SKILL.md')));
}
