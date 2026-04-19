/**
 * settings.json merger for `rune hooks install/uninstall`.
 *
 * Strategy: detect Rune-managed hook entries by command signature (not JSON
 * comments — settings.json is strict JSON). Remove all Rune entries, then
 * inject new ones from the preset. User-authored hooks in the same event
 * arrays are preserved.
 */

import { isRuneManaged } from './presets.js';

/**
 * Strip all Rune-managed entries from a settings.json object.
 * Returns a new settings object (no mutation).
 *
 * @param {Object} settings — parsed .claude/settings.json content
 * @returns {Object} settings with Rune hooks removed
 */
export function stripRuneHooks(settings) {
  if (!settings || typeof settings !== 'object') return {};
  if (!settings.hooks || typeof settings.hooks !== 'object') return settings;

  const cleanedHooks = {};
  for (const [eventName, matcherGroups] of Object.entries(settings.hooks)) {
    if (!Array.isArray(matcherGroups)) {
      cleanedHooks[eventName] = matcherGroups;
      continue;
    }

    const cleanedGroups = matcherGroups
      .map((group) => {
        if (!group || !Array.isArray(group.hooks)) return group;
        const cleanedEntries = group.hooks.filter((entry) => !isRuneManaged(entry));
        return { ...group, hooks: cleanedEntries };
      })
      .filter((group) => {
        // Drop groups that became empty after stripping Rune entries
        if (!group || !Array.isArray(group.hooks)) return true;
        return group.hooks.length > 0;
      });

    if (cleanedGroups.length > 0) {
      cleanedHooks[eventName] = cleanedGroups;
    }
  }

  const result = { ...settings };
  if (Object.keys(cleanedHooks).length > 0) {
    result.hooks = cleanedHooks;
  } else {
    delete result.hooks;
  }
  return result;
}

/**
 * Merge a preset hook block into existing settings. Existing Rune entries are
 * replaced; user entries in the same events are preserved.
 *
 * @param {Object} settings — existing .claude/settings.json content (or {})
 * @param {Object} preset — output of buildPreset()
 * @returns {Object} merged settings
 */
export function mergePreset(settings, preset) {
  const stripped = stripRuneHooks(settings || {});
  return appendHookBlock(stripped, preset);
}

/**
 * Append a hook block to pre-stripped settings — does NOT strip Rune entries
 * first. Use this when layering multiple Rune blocks (e.g. preset + tier)
 * after a single upstream `stripRuneHooks` call, to avoid each additional
 * layer wiping the previous one.
 *
 * @param {Object} settings — already-stripped settings (or {})
 * @param {Object} block — { hooks: {...}, ... }
 * @returns {Object} merged settings
 */
export function appendHookBlock(settings, block) {
  const base = settings && typeof settings === 'object' ? settings : {};
  const existingHooks = base.hooks && typeof base.hooks === 'object' ? base.hooks : {};
  const merged = { ...existingHooks };

  for (const [eventName, matcherGroups] of Object.entries(block?.hooks || {})) {
    const existing = Array.isArray(merged[eventName]) ? merged[eventName] : [];
    merged[eventName] = mergeEventGroups(existing, matcherGroups);
  }

  return { ...base, hooks: merged };
}

/**
 * Merge preset matcher groups into existing groups for a single event.
 * If a matcher string already has a user group, append Rune entries into it
 * rather than duplicating the group.
 */
function mergeEventGroups(existingGroups, presetGroups) {
  const result = existingGroups.map((g) => ({ ...g, hooks: [...(g.hooks || [])] }));

  for (const presetGroup of presetGroups) {
    const existingIdx = result.findIndex((g) => g.matcher === presetGroup.matcher);
    if (existingIdx >= 0) {
      result[existingIdx].hooks.push(...presetGroup.hooks);
    } else {
      result.push({ ...presetGroup, hooks: [...presetGroup.hooks] });
    }
  }

  return result;
}

/**
 * Summarize Rune hook entries currently in settings — for `rune hooks status`.
 *
 * @param {Object} settings
 * @returns {{events: Record<string, string[]>, total: number}}
 */
export function summarizeRuneHooks(settings) {
  const events = {};
  let total = 0;
  if (!settings?.hooks) return { events, total };

  for (const [eventName, matcherGroups] of Object.entries(settings.hooks)) {
    if (!Array.isArray(matcherGroups)) continue;
    for (const group of matcherGroups) {
      if (!Array.isArray(group?.hooks)) continue;
      for (const entry of group.hooks) {
        if (!isRuneManaged(entry)) continue;
        total += 1;
        const skill = extractSkillFromCommand(entry.command);
        if (!events[eventName]) events[eventName] = [];
        events[eventName].push(skill);
      }
    }
  }
  return { events, total };
}

function extractSkillFromCommand(command) {
  // Expected shapes:
  //   "npx --yes @rune-kit/rune hook-dispatch <skill> [--gentle]"  (Free preset / dispatch)
  //   "node \"${RUNE_*_ROOT}/hooks/run-hook.cjs\" <skill>"            (tier entry)
  const dispatch = command.match(/hook-dispatch\s+(\S+)/);
  if (dispatch) return dispatch[1];
  const tier = command.match(/run-hook\.cjs(?:"|')?\s+(\S+)/);
  if (tier) return tier[1];
  return 'unknown';
}

/**
 * Strip entries whose extracted skill name appears in `skillIds` from an
 * already-parsed settings object. Used to honor manifest `overrides`:
 * e.g., Pro's `context-sense` replaces an older `context-watch` entry.
 *
 * @param {Object} settings
 * @param {Iterable<string>} skillIds — skill names to remove
 * @returns {Object} new settings
 */
export function stripHooksBySkill(settings, skillIds) {
  const targets = new Set(skillIds);
  if (!settings?.hooks || targets.size === 0) return settings;

  const cleanedHooks = {};
  for (const [eventName, matcherGroups] of Object.entries(settings.hooks)) {
    if (!Array.isArray(matcherGroups)) {
      cleanedHooks[eventName] = matcherGroups;
      continue;
    }
    const cleanedGroups = matcherGroups
      .map((group) => {
        if (!group || !Array.isArray(group.hooks)) return group;
        const filtered = group.hooks.filter((entry) => {
          if (!entry || typeof entry.command !== 'string') return true;
          return !targets.has(extractSkillFromCommand(entry.command));
        });
        return { ...group, hooks: filtered };
      })
      .filter((group) => !group || !Array.isArray(group.hooks) || group.hooks.length > 0);
    if (cleanedGroups.length > 0) cleanedHooks[eventName] = cleanedGroups;
  }

  const result = { ...settings };
  if (Object.keys(cleanedHooks).length > 0) result.hooks = cleanedHooks;
  else delete result.hooks;
  return result;
}

/**
 * Detect active preset by examining Rune commands in settings.
 * Returns 'gentle' | 'strict' | 'mixed' | 'none'.
 */
export function detectPreset(settings) {
  if (!settings?.hooks) return 'none';
  let hasGentle = false;
  let hasStrict = false;
  for (const matcherGroups of Object.values(settings.hooks)) {
    if (!Array.isArray(matcherGroups)) continue;
    for (const group of matcherGroups) {
      if (!Array.isArray(group?.hooks)) continue;
      for (const entry of group.hooks) {
        if (!isRuneManaged(entry)) continue;
        if (entry.command.includes('--gentle')) hasGentle = true;
        else hasStrict = true;
      }
    }
  }
  if (hasGentle && hasStrict) return 'mixed';
  if (hasGentle) return 'gentle';
  if (hasStrict) return 'strict';
  return 'none';
}
