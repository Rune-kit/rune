/**
 * `rune hooks install [--preset strict|gentle|off] [--platform claude|cursor|windsurf|antigravity|all]`
 *
 * Writes Rune-managed hook/rule/workflow entries for one or more platforms.
 * Idempotent: re-running replaces existing Rune entries, preserves user entries.
 */

import { existsSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ADAPTERS, detectPlatforms, getAdapter, PLATFORM_KEYS } from '../../adapters/hooks/index.js';
import { checkManifestRequires, resolveTier } from './tiers.js';

/**
 * @param {string} projectRoot
 * @param {{preset?: string, dry?: boolean, platform?: string|string[], tier?: string|string[]}} args
 */
export async function installHooks(projectRoot, args = {}) {
  const preset = args.preset || 'gentle';
  if (preset !== 'strict' && preset !== 'gentle' && preset !== 'off') {
    throw new Error(`Invalid preset: ${preset}. Choose from: strict | gentle | off`);
  }

  const tierManifests = await resolveTierManifests(projectRoot, args.tier);
  const tierNotes = [];
  for (const manifest of tierManifests) {
    const { ok, missing } = checkManifestRequires(manifest);
    if (!ok) {
      tierNotes.push(
        `${manifest.tier}: missing env var${missing.length === 1 ? '' : 's'} (${missing.join(', ')}) — hooks are written with literal \${${missing[0]}} and will FAIL at runtime until you \`export ${missing.join('=… && export ')}=…\` in your shell.`,
      );
    }
  }

  const platforms = resolvePlatforms(projectRoot, args.platform);
  if (platforms.length === 0) {
    return {
      preset,
      tiers: tierManifests.map((m) => m.tier),
      platforms: [],
      results: [],
      written: false,
      notes: [
        'No target platform detected. Create `.claude/`, `.cursor/`, `.windsurf/`, or `.antigravity/` first, or pass `--platform <name>`.',
        ...tierNotes,
      ],
    };
  }

  const results = [];
  let totalWrites = 0;
  for (const id of platforms) {
    const adapter = getAdapter(id);
    const plan = await adapter.emit({ preset, projectRoot, tierManifests });
    let platformWrites = 0;
    if (!args.dry) {
      for (const file of plan.files) {
        if (file.content === null) {
          if (existsSync(file.path)) {
            await unlink(file.path);
            platformWrites += 1;
          }
        } else {
          await mkdir(path.dirname(file.path), { recursive: true });
          await writeFile(file.path, file.content, 'utf-8');
          platformWrites += 1;
        }
      }
    }
    totalWrites += platformWrites;
    results.push({
      platform: id,
      files: plan.files.map((f) => ({ path: f.path, deleted: f.content === null })),
      notes: plan.notes,
      writes: platformWrites,
    });
  }

  return {
    preset,
    tiers: tierManifests.map((m) => m.tier),
    platforms,
    results,
    written: !args.dry && totalWrites > 0,
    notes: [...(totalWrites === 0 && !args.dry ? ['no changes to apply (already clean)'] : []), ...tierNotes],
  };
}

/**
 * Resolve requested tiers to loaded manifests.
 * @returns {Promise<import('./tiers.js').TierManifest[]>}
 */
async function resolveTierManifests(projectRoot, requested) {
  if (!requested) return [];
  const list = Array.isArray(requested) ? requested : [requested];
  const unique = Array.from(new Set(list.filter((t) => typeof t === 'string' && t.length > 0)));
  const manifests = [];
  for (const tier of unique) {
    manifests.push(await resolveTier(tier, projectRoot));
  }
  return manifests;
}

function resolvePlatforms(projectRoot, requested) {
  if (!requested) return detectPlatforms(projectRoot);
  const list = Array.isArray(requested) ? requested : [requested];
  const expanded = [];
  for (const item of list) {
    if (item === 'all') {
      // `all` = every *detected* platform, never force-creates unrelated platform dirs.
      // To install into a platform with no existing directory, pass `--platform <name>` explicitly.
      expanded.push(...detectPlatforms(projectRoot));
    } else if (ADAPTERS[item]) {
      expanded.push(item);
    } else {
      throw new Error(`Unknown platform: ${item}. Choose from: ${PLATFORM_KEYS.join(', ')}, all`);
    }
  }
  return Array.from(new Set(expanded));
}
