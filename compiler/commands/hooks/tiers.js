/**
 * Tier manifest loader for `rune hooks install/uninstall/status`.
 *
 * The Free compiler is tier-agnostic. Tiers (Pro / Business / custom) ship
 * their own `hooks/manifest.json` files following the schema described in
 * `docs/HOOKS.md`. This module resolves a `--tier` flag (or explicit path)
 * into a loaded manifest.
 *
 * Resolution order for `--tier pro`:
 *   1. `$RUNE_PRO_ROOT/hooks/manifest.json` (env var — primary)
 *   2. `<projectRoot>/../Pro/hooks/manifest.json` (monorepo sibling)
 *   3. Fails with a helpful upgrade message.
 *
 * For `--tier-manifest <path>` we load the file directly. This keeps the
 * compiler side free of hardcoded tier logic — any future tier (Business,
 * third-party) plugs in by shipping a manifest at a known path.
 */

import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Known tier env vars. Adding a new tier = add its env var here. */
export const TIER_ENV_VARS = Object.freeze({
  pro: 'RUNE_PRO_ROOT',
  business: 'RUNE_BUSINESS_ROOT',
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Read Free compiler version from the bundled package.json. Cached after first read.
 * @returns {string} semver string, e.g. "2.12.1"
 */
let _freeVersionCache = null;
export function getFreeVersion() {
  if (_freeVersionCache) return _freeVersionCache;
  const pkgPath = path.resolve(__dirname, '..', '..', '..', 'package.json');
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    _freeVersionCache = typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    _freeVersionCache = '0.0.0';
  }
  return _freeVersionCache;
}

/** For test/override scenarios — resets the cache. */
export function _resetFreeVersionCache() {
  _freeVersionCache = null;
}

/**
 * Parse a semver `x.y.z` (ignores pre-release/build) into a tuple. Returns null on malformed input.
 * @param {string} v
 * @returns {[number,number,number]|null}
 */
export function parseSemver(v) {
  if (typeof v !== 'string') return null;
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * Compare two semver strings. Returns -1, 0, 1 or null if either is malformed.
 */
export function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}

/** Valid event names a manifest entry may declare. */
const VALID_EVENTS = new Set(['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop', 'statusLine']);

/** Tier names must be simple lowercase identifiers. Blocks `../../etc` and similar traversal. */
const TIER_NAME_RE = /^[a-z][a-z0-9-]{0,31}$/;

/**
 * Assert a tier name is safe to use as a path segment.
 * @param {string} tier
 */
function assertSafeTierName(tier) {
  if (typeof tier !== 'string' || !TIER_NAME_RE.test(tier)) {
    throw new Error(
      `Invalid tier name: ${JSON.stringify(tier)}. Tier must be a lowercase identifier (a-z, 0-9, dash).`,
    );
  }
}

/**
 * Locate a tier manifest by tier name.
 *
 * @param {string} tier — 'pro' | 'business' | custom
 * @param {string} projectRoot — the user project root (used for monorepo fallback)
 * @returns {string|null} absolute path if found, else null
 */
export function locateTierManifest(tier, projectRoot) {
  assertSafeTierName(tier);
  const envVar = TIER_ENV_VARS[tier];
  if (envVar && process.env[envVar]) {
    // Resolve + re-anchor so that env var values can't traverse out via `..`.
    const root = path.resolve(process.env[envVar]);
    const candidate = path.join(root, 'hooks', 'manifest.json');
    if (existsSync(candidate)) return candidate;
  }
  // Monorepo fallback: <projectRoot>/../<Tier>/hooks/manifest.json (capitalized tier).
  // tier is pre-validated against TIER_NAME_RE so no traversal is possible here.
  const capitalized = tier.charAt(0).toUpperCase() + tier.slice(1);
  const fallback = path.resolve(projectRoot, '..', capitalized, 'hooks', 'manifest.json');
  if (existsSync(fallback)) return fallback;
  return null;
}

/**
 * Load + validate a tier manifest JSON file.
 *
 * @param {string} manifestPath
 * @returns {Promise<TierManifest>}
 */
export async function loadTierManifest(manifestPath) {
  if (!existsSync(manifestPath)) {
    throw new Error(`Tier manifest not found: ${manifestPath}`);
  }
  const raw = await readFile(manifestPath, 'utf-8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Tier manifest ${manifestPath} is not valid JSON: ${err.message}`);
  }
  return validateManifest(parsed, manifestPath);
}

/**
 * Validate manifest shape + normalize to internal form.
 * Throws with a specific error on any violation so users get actionable output.
 */
export function validateManifest(manifest, source = '<memory>') {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error(`Manifest ${source}: expected top-level object`);
  }
  if (typeof manifest.tier !== 'string' || !manifest.tier) {
    throw new Error(`Manifest ${source}: missing required string field 'tier'`);
  }
  if (!Array.isArray(manifest.entries)) {
    throw new Error(`Manifest ${source}: 'entries' must be an array`);
  }

  const seenIds = new Set();
  const entries = manifest.entries.map((raw, i) => {
    const where = `${source} entries[${i}]`;
    if (!raw || typeof raw !== 'object') {
      throw new Error(`${where}: expected object`);
    }
    if (typeof raw.id !== 'string' || !raw.id) {
      throw new Error(`${where}: missing required string 'id'`);
    }
    if (seenIds.has(raw.id)) {
      throw new Error(`${where}: duplicate entry id '${raw.id}'`);
    }
    seenIds.add(raw.id);
    if (typeof raw.event !== 'string' || !VALID_EVENTS.has(raw.event)) {
      throw new Error(
        `${where}: 'event' must be one of ${[...VALID_EVENTS].join(', ')} (got ${JSON.stringify(raw.event)})`,
      );
    }
    if (typeof raw.command !== 'string' || !raw.command) {
      throw new Error(`${where}: missing required string 'command'`);
    }
    if (raw.matcher !== undefined && typeof raw.matcher !== 'string') {
      throw new Error(`${where}: 'matcher' must be a string if present`);
    }
    if (raw.event !== 'statusLine' && raw.event !== 'Stop' && !raw.matcher) {
      throw new Error(`${where}: '${raw.event}' requires a 'matcher' string (e.g. 'Edit|Write' or '.*')`);
    }
    if (raw.globs !== undefined && !Array.isArray(raw.globs)) {
      throw new Error(`${where}: 'globs' must be an array of strings if present`);
    }
    return {
      id: raw.id,
      skill: typeof raw.skill === 'string' && raw.skill ? raw.skill : raw.id,
      event: raw.event,
      matcher: raw.matcher ?? null,
      command: raw.command,
      async: raw.async === true,
      padding: typeof raw.padding === 'number' ? raw.padding : undefined,
      claudeOnly: raw.claudeOnly === true,
      description: typeof raw.description === 'string' ? raw.description : '',
      globs: Array.isArray(raw.globs) ? [...raw.globs] : null,
      platforms: raw.platforms && typeof raw.platforms === 'object' ? { ...raw.platforms } : {},
    };
  });

  const minFreeVersion =
    typeof manifest.minFreeVersion === 'string' && manifest.minFreeVersion.length > 0 ? manifest.minFreeVersion : null;
  if (manifest.minFreeVersion !== undefined && minFreeVersion === null) {
    throw new Error(`Manifest ${source}: 'minFreeVersion' must be a non-empty string if present`);
  }
  if (minFreeVersion && !parseSemver(minFreeVersion)) {
    throw new Error(
      `Manifest ${source}: 'minFreeVersion' must be semver x.y.z (got ${JSON.stringify(minFreeVersion)})`,
    );
  }

  return {
    name: typeof manifest.name === 'string' ? manifest.name : `Rune ${manifest.tier} Hooks`,
    description: typeof manifest.description === 'string' ? manifest.description : '',
    tier: manifest.tier,
    version: typeof manifest.version === 'string' ? manifest.version : '0.0.0',
    minFreeVersion,
    requires: Array.isArray(manifest.requires) ? [...manifest.requires] : [],
    entries,
    overrides: manifest.overrides && typeof manifest.overrides === 'object' ? { ...manifest.overrides } : {},
    source,
  };
}

/**
 * Assert the current Free compiler satisfies a manifest's `minFreeVersion`.
 * Throws with an actionable upgrade message when the local Free is too old.
 *
 * @param {import('./tiers.js').TierManifest} manifest
 * @param {string} [currentFreeVersion] — defaults to `getFreeVersion()`. Override for tests.
 */
export function assertFreeVersionCompat(manifest, currentFreeVersion) {
  if (!manifest || !manifest.minFreeVersion) return;
  const current = currentFreeVersion ?? getFreeVersion();
  const cmp = compareSemver(current, manifest.minFreeVersion);
  if (cmp === null) {
    // Malformed input — surface but don't block (defensive).
    return;
  }
  if (cmp < 0) {
    throw new Error(
      `Tier '${manifest.tier}' requires Rune Free >= ${manifest.minFreeVersion} but the installed compiler is ${current}. ` +
        `Upgrade Free first: \`npm i -g @rune-kit/rune@latest\` (or \`npx @rune-kit/rune@latest hooks install --tier ${manifest.tier}\`).`,
    );
  }
}

/**
 * Check whether a manifest's `requires` list is satisfied by current env.
 * Returns { ok, missing }.
 */
export function checkManifestRequires(manifest) {
  const missing = (manifest.requires || []).filter((name) => !process.env[name]);
  return { ok: missing.length === 0, missing };
}

/**
 * Enumerate known tiers and return status for each that can be located.
 * Tiers that can't be found (no env var, no monorepo sibling) are skipped.
 * Invalid/corrupt manifests are reported with { found: false, error }.
 *
 * @param {string} projectRoot
 * @returns {Promise<Array<{tier: string, found: boolean, manifestPath: string|null, version?: string, requires: string[], requiresOk: boolean, requiresMissing: string[], entries: number, error?: string}>>}
 */
export async function listDetectedTiers(projectRoot) {
  const out = [];
  for (const tier of Object.keys(TIER_ENV_VARS)) {
    const manifestPath = locateTierManifest(tier, projectRoot);
    if (!manifestPath) continue;
    try {
      const manifest = await loadTierManifest(manifestPath);
      const req = checkManifestRequires(manifest);
      out.push({
        tier,
        found: true,
        manifestPath,
        version: manifest.version,
        requires: [...(manifest.requires || [])],
        requiresOk: req.ok,
        requiresMissing: req.missing,
        entries: manifest.entries.length,
      });
    } catch (err) {
      out.push({
        tier,
        found: false,
        manifestPath,
        requires: [],
        requiresOk: false,
        requiresMissing: [],
        entries: 0,
        error: err.message,
      });
    }
  }
  return out;
}

/**
 * Resolve a tier request (`--tier pro`) into a loaded, validated manifest,
 * or throw with a helpful upgrade/missing-env message.
 *
 * @param {string} tier
 * @param {string} projectRoot
 * @returns {Promise<TierManifest>}
 */
export async function resolveTier(tier, projectRoot) {
  const manifestPath = locateTierManifest(tier, projectRoot);
  if (!manifestPath) {
    const envVar = TIER_ENV_VARS[tier];
    const capitalized = tier.charAt(0).toUpperCase() + tier.slice(1);
    const siblingPath = path.resolve(projectRoot, '..', capitalized, 'hooks', 'manifest.json');
    const lines = [`Could not locate '${tier}' tier manifest. Rune looked in:`];
    if (envVar) {
      lines.push(`  1. $${envVar}/hooks/manifest.json  (env var — set this if ${capitalized} is installed elsewhere)`);
      lines.push(`  2. ${siblingPath}  (monorepo sibling fallback)`);
    } else {
      lines.push(`  • ${siblingPath}  (monorepo sibling fallback)`);
    }
    lines.push('');
    lines.push(`Fix one of:`);
    if (envVar) {
      lines.push(`  • export ${envVar}=/path/to/${capitalized}   # point at your ${tier} install`);
    }
    lines.push(`  • Clone ${capitalized} next to Free so the sibling path resolves`);
    lines.push(`  • Drop --tier ${tier} to install Free-only hooks`);
    lines.push('');
    lines.push(`See https://rune.dev/docs/hooks#tiers for details.`);
    throw new Error(lines.join('\n'));
  }
  const manifest = await loadTierManifest(manifestPath);
  if (manifest.tier !== tier) {
    throw new Error(`Manifest at ${manifestPath} declares tier='${manifest.tier}' but was requested as '${tier}'`);
  }
  assertFreeVersionCompat(manifest);
  return manifest;
}

/**
 * @typedef TierManifestEntry
 * @property {string} id
 * @property {string} skill
 * @property {'UserPromptSubmit'|'PreToolUse'|'PostToolUse'|'Stop'|'statusLine'} event
 * @property {string|null} matcher
 * @property {string} command
 * @property {boolean} async
 * @property {number|undefined} padding
 * @property {boolean} claudeOnly
 * @property {string} description
 * @property {string[]|null} globs
 * @property {Record<string, string>} platforms
 */

/**
 * @typedef TierManifest
 * @property {string} name
 * @property {string} description
 * @property {string} tier
 * @property {string} version
 * @property {string[]} requires
 * @property {TierManifestEntry[]} entries
 * @property {Record<string, string>} overrides
 * @property {string} source
 */
