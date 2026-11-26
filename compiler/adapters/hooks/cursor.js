/**
 * Cursor hooks adapter — native `.cursor/hooks.json`.
 *
 * Spec (cursor.com/docs/hooks, verified 2026-11): project hooks live in
 * `<project>/.cursor/hooks.json` as
 *   `{ "version": 1, "hooks": { "<camelCaseEvent>": [{ command, matcher?, timeout? }] } }`
 * and run from the project root in trusted workspaces (cloud agents too).
 * Exit 2 = deny; for permission hooks (preToolUse, beforeShellExecution, …)
 * invalid JSON on stdout also blocks, so every Rune command passes
 * `--format cursor` and the dispatcher prints schema-valid JSON.
 *
 * Mapping (Claude preset → Cursor event, all tool-filtered by `matcher`):
 *   preflight         PreToolUse Edit|Write   → preToolUse  (matcher "Read|Write|StrReplace")
 *   sentinel          PreToolUse Bash         → preToolUse  (matcher "Shell")
 *   dependency-doctor PostToolUse Edit|Write  → postToolUse (matcher "Write|StrReplace")
 *   quarantine        PostToolUse mcp/Read    → postToolUse (matcher "MCP:.*|mcp__.*|Read|WebFetch|Fetch")
 *   completion-gate   Stop                    → stop
 *
 * Grok Build compatibility (v2.33.0). Grok Build — xAI's CLI, which since
 * SpaceX acquired Cursor (Aug 2026) ships Cursor's model list and reads
 * `.cursor/` config — loads `.cursor/hooks.json`, but runs only Claude-style
 * matcher groups (entries with a `hooks` list) and reports Cursor's flat
 * `{command, matcher, timeout}` entries as load errors. Cursor runs only the
 * flat form. So every Rune entry is a hybrid that carries both:
 *   { command, matcher, timeout, hooks: [{ type: "command", command, timeout }] }
 * Cursor reads `command`/`matcher`/`timeout`; Grok reads `matcher` + `hooks`.
 * One registration, each runtime runs it once (verified with `grok inspect`
 * on Grok Build 1.0.92: loaded, no load errors). That is why sentinel uses
 * `preToolUse` + matcher "Shell" rather than `beforeShellExecution`: there
 * Cursor matches `matcher` against the command text, while Grok maps the event
 * to PreToolUse and matches the tool name — one `matcher` can't mean both.
 * Because Grok Build runs these entries, the grok adapter skips
 * `.grok/hooks/rune.json` when Cursor hooks are installed (no double fire).
 *
 * `.cursor/hooks.json` may hold the user's own hooks, so emit/uninstall only
 * add/remove entries whose command carries the Rune dispatch signature.
 *
 * .mdc rules: the three preset rules from earlier versions duplicated what the
 * hooks now do and are removed on install (migration). Tier entries mapped to
 * `rule-alwaysApply` / `rule-glob` stay as `.cursor/rules/rune-<tier>-*.mdc` —
 * they inject guidance text, which a hook cannot do.
 *
 * Cursor also imports Claude hooks from `.claude/settings.json` by default
 * (docs/reference/third-party-hooks); if Rune hooks are there too they fire
 * twice, so emit() warns.
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { summarizeRuneHooks } from '../../commands/hooks/merge.js';
import { DISPATCH_CMD, isRuneManaged, SETTINGS_REL_PATH, WIRED_SKILLS } from '../../commands/hooks/presets.js';
import { hookEntries, platformEntries, renderTierRule, statusLineUserNote, unsupportedEntries, withHookFormat } from './tier-emitter.js';

export const id = 'cursor';
export const HOOKS_REL_PATH = '.cursor/hooks.json';
export const HOOK_TIMEOUT_SECONDS = 30;

const RULES_REL_DIR = '.cursor/rules';
const GROK_HOOKS_REL_PATH = '.grok/hooks/rune.json';
const RUNE_PREFIX = 'rune-';
const AUTO_SIGNATURE = '@rune-kit/rune hook-dispatch';
const LEGACY_PRESET_RULES = ['rune-preflight.mdc', 'rune-sentinel.mdc', 'rune-dependency-doctor.mdc'];

/** Documented Cursor events Rune writes to (subset of cursor.com/docs/hooks). */
export const PRESET_EVENTS = Object.freeze([
  { event: 'preToolUse', skill: 'preflight', matcher: 'Read|Write|StrReplace' },
  { event: 'preToolUse', skill: 'sentinel', matcher: 'Shell' },
  { event: 'postToolUse', skill: 'dependency-doctor', matcher: 'Write|StrReplace' },
  { event: 'postToolUse', skill: 'quarantine', matcher: 'MCP:.*|mcp__.*|Read|WebFetch|Fetch' },
  { event: 'stop', skill: 'completion-gate' },
]);

/** Events earlier Rune versions wrote to; their Rune entries are migrated away. */
export const LEGACY_EVENTS = Object.freeze(['beforeShellExecution', 'afterFileEdit']);

/** Map a Claude-shaped Pro manifest event to a Cursor hooks.json event. */
export function mapCursorTierEvent(entry) {
  switch (entry.event) {
    case 'UserPromptSubmit':
      return { event: 'beforeSubmitPrompt' };
    case 'PreToolUse':
      return { event: 'preToolUse', matcher: 'Write|StrReplace' };
    case 'PreCompact':
      return { event: 'preCompact' };
    case 'SessionStart':
      return { event: 'sessionStart' };
    default:
      return null;
  }
}

export function cursorTierHookItem(entry) {
  const mapped = mapCursorTierEvent(entry);
  if (!mapped) return null;
  const command = withHookFormat(entry.command, 'cursor');
  const item = { command, timeout: HOOK_TIMEOUT_SECONDS };
  if (mapped.matcher) item.matcher = mapped.matcher;
  item.hooks = [{ type: 'command', command, timeout: HOOK_TIMEOUT_SECONDS }];
  return { event: mapped.event, item };
}


export function detect(projectRoot) {
  return existsSync(path.join(projectRoot, '.cursor'));
}

export function buildCursorPreset(preset) {
  const flag = preset === 'gentle' ? ' --gentle' : '';
  const hooks = {};
  for (const { event, skill, matcher } of PRESET_EVENTS) {
    const command = `${DISPATCH_CMD} ${skill} --format cursor${flag}`;
    const entry = { command };
    if (matcher) entry.matcher = matcher;
    entry.timeout = HOOK_TIMEOUT_SECONDS;
    // Matcher-group view of the same entry, for Grok Build (see header).
    entry.hooks = [{ type: 'command', command, timeout: HOOK_TIMEOUT_SECONDS }];
    (hooks[event] ||= []).push(entry);
  }
  return hooks;
}

/** Remove Rune-managed entries; drop events that end up empty. */
export function stripRuneEntries(config) {
  const hooks = {};
  for (const [event, entries] of Object.entries(config?.hooks || {})) {
    if (!Array.isArray(entries)) {
      hooks[event] = entries;
      continue;
    }
    const kept = entries.filter((e) => !isRuneManaged(e));
    if (kept.length > 0) hooks[event] = kept;
  }
  return { ...config, hooks };
}

export async function emit({ preset, projectRoot, tierManifests = [] }) {
  if (preset === 'off' && tierManifests.length === 0) return uninstall({ projectRoot });
  if (preset !== 'off' && preset !== 'strict' && preset !== 'gentle') {
    throw new Error(`cursor adapter: invalid preset '${preset}'`);
  }

  const rulesDir = path.join(projectRoot, RULES_REL_DIR);
  const hooksPath = path.join(projectRoot, HOOKS_REL_PATH);
  const files = [];
  const notes = [];

  const existing = existsSync(hooksPath) ? await readJson(hooksPath) : {};
  let config = stripRuneEntries({ version: 1, ...existing });
  if (preset !== 'off') {
    const runeHooks = buildCursorPreset(preset);
    const hooks = { ...config.hooks };
    for (const [event, entries] of Object.entries(runeHooks)) hooks[event] = [...(hooks[event] || []), ...entries];
    config = { ...config, hooks };
    notes.push(
      `Native Cursor hooks written to ${HOOKS_REL_PATH} (${preset}). Project hooks run only in a trusted workspace — check Settings → Hooks.`,
    );
    notes.push(
      'Grok Build also reads .cursor/hooks.json and runs these same entries — no separate `--platform grok` hooks needed.',
    );
    const grokFile = path.join(projectRoot, GROK_HOOKS_REL_PATH);
    if (existsSync(grokFile) && (await isFreePresetOnly(grokFile))) {
      files.push({ path: grokFile, content: null });
      notes.push(
        `Removed ${GROK_HOOKS_REL_PATH}: Grok Build would run Rune hooks twice (it also reads ${HOOKS_REL_PATH}).`,
      );
    }
    if (await claudeHasRuneHooks(projectRoot)) {
      notes.push(
        'Cursor also imports .claude/settings.json hooks (Settings → Agents → Third-Party Imports), which already has Rune hooks — inside Cursor they would fire twice. Keep one: `rune hooks install --platform claude --preset off`, or turn off Third-Party Imports.',
      );
    }
  }

  const hooks = { ...(config.hooks || {}) };
  let addedTierHooks = 0;
  for (const manifest of tierManifests) {
    for (const entry of hookEntries(manifest, 'cursor')) {
      const mapped = cursorTierHookItem(entry);
      if (!mapped) continue;
      hooks[mapped.event] = [...(hooks[mapped.event] || []), mapped.item];
      addedTierHooks += 1;
    }
    const userNote = statusLineUserNote(manifest, 'cursor');
    if (userNote) notes.push(userNote);
  }
  if (addedTierHooks > 0) {
    config = { ...config, hooks };
    notes.push(`Native Cursor hooks written for ${addedTierHooks} Pro/Business context-intelligence entr${addedTierHooks === 1 ? 'y' : 'ies'}.`);
  }
  if (existsSync(hooksPath) || preset !== 'off' || addedTierHooks > 0) {
    files.push({ path: hooksPath, content: `${JSON.stringify(config, null, 2)}\n` });
  }

  files.push(...(await legacyRuleDeletions(rulesDir)));

  const mode = preset === 'strict' ? 'BLOCK' : 'WARN';
  for (const manifest of tierManifests) {
    for (const entry of platformEntries(manifest, 'cursor')) {
      const content = renderTierRule(entry, 'cursor', { mode, tier: manifest.tier });
      if (!content) continue;
      files.push({
        path: path.join(rulesDir, `${RUNE_PREFIX}${manifest.tier}-${entry.id}.mdc`),
        content,
      });
    }
    const skipped = unsupportedEntries(manifest, 'cursor');
    if (skipped.length > 0) {
      notes.push(
        `cursor: ${manifest.tier} skipped ${skipped.length} entr${skipped.length === 1 ? 'y' : 'ies'} (${skipped.map((e) => e.id).join(', ')}) — platform-unsupported or Claude-only.`,
      );
    }
  }

  return { files, notes };
}

/** True when a Grok hook file holds only Free-preset Rune dispatch entries (no tier or user hooks). */
export async function isFreePresetOnly(file) {
  try {
    const cfg = JSON.parse(await readFile(file, 'utf-8'));
    const entries = Object.values(cfg?.hooks || {})
      .flat()
      .flatMap((g) => (Array.isArray(g?.hooks) ? g.hooks : [g]));
    return (
      entries.length > 0 && entries.every((e) => isRuneManaged(e) && !/\$\{RUNE_[A-Z0-9_]+_ROOT\}/.test(e.command))
    );
  } catch {
    return false;
  }
}

/** True when `.cursor/hooks.json` already carries Rune-managed entries. */
export async function hasRuneHooks(projectRoot) {
  const p = path.join(projectRoot, HOOKS_REL_PATH);
  if (!existsSync(p)) return false;
  try {
    const cfg = JSON.parse(await readFile(p, 'utf-8'));
    return Object.values(cfg?.hooks || {}).some((list) => Array.isArray(list) && list.some((e) => isRuneManaged(e)));
  } catch {
    return false;
  }
}

async function legacyRuleDeletions(rulesDir) {
  const out = [];
  for (const name of LEGACY_PRESET_RULES) {
    const abs = path.join(rulesDir, name);
    if (!existsSync(abs)) continue;
    const content = await readFile(abs, 'utf-8');
    if (content.includes(AUTO_SIGNATURE) || content.includes('rune-managed: true'))
      out.push({ path: abs, content: null });
  }
  return out;
}

export async function uninstall({ projectRoot }) {
  const files = [];
  const hooksPath = path.join(projectRoot, HOOKS_REL_PATH);
  if (existsSync(hooksPath)) {
    const config = await readJson(hooksPath);
    const stripped = stripRuneEntries(config);
    const userEntries = Object.values(stripped.hooks).flat().length;
    const otherKeys = Object.keys(stripped).filter((k) => k !== 'version' && k !== 'hooks');
    if (userEntries === 0 && otherKeys.length === 0) files.push({ path: hooksPath, content: null });
    else if (JSON.stringify(stripped) !== JSON.stringify(config)) {
      files.push({ path: hooksPath, content: `${JSON.stringify(stripped, null, 2)}\n` });
    }
  }

  const rulesDir = path.join(projectRoot, RULES_REL_DIR);
  if (existsSync(rulesDir)) {
    const entries = await readdir(rulesDir, { withFileTypes: true });
    for (const file of entries) {
      if (!file.isFile() || !file.name.startsWith(RUNE_PREFIX) || !file.name.endsWith('.mdc')) continue;
      const abs = path.join(rulesDir, file.name);
      const content = await readFile(abs, 'utf-8');
      if (content.includes(AUTO_SIGNATURE) || content.includes('rune-managed: true')) {
        files.push({ path: abs, content: null });
      }
    }
  }

  return { files, notes: files.length === 0 ? ['no Rune-managed Cursor hooks or rules found'] : [] };
}

export async function status(projectRoot) {
  const hooksPath = path.join(projectRoot, HOOKS_REL_PATH);
  if (!existsSync(hooksPath)) {
    return { installed: false, preset: null, wired: [], missing: [...WIRED_SKILLS], notes: [`no ${HOOKS_REL_PATH}`] };
  }
  const config = await readJson(hooksPath);
  const events = {};
  let hasGentle = false;
  let hasStrict = false;
  for (const [event, entries] of Object.entries(config.hooks || {})) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!isRuneManaged(entry)) continue;
      const skill = entry.command.match(/hook-dispatch\s+(\S+)/)?.[1] ?? 'unknown';
      (events[event] ||= []).push(skill);
      if (entry.command.includes('--gentle')) hasGentle = true;
      else hasStrict = true;
    }
  }
  const wired = Array.from(new Set(Object.values(events).flat()));
  let preset = null;
  if (hasGentle && hasStrict) preset = 'mixed';
  else if (hasGentle) preset = 'gentle';
  else if (hasStrict) preset = 'strict';
  return {
    installed: wired.length > 0,
    preset,
    wired,
    missing: WIRED_SKILLS.filter((s) => !wired.includes(s)),
    events,
    notes: ['Cursor lists loaded hooks under Settings → Hooks (and the Hooks output channel).'],
  };
}

async function claudeHasRuneHooks(projectRoot) {
  const p = path.join(projectRoot, SETTINGS_REL_PATH);
  if (!existsSync(p)) return false;
  try {
    return summarizeRuneHooks(JSON.parse(await readFile(p, 'utf-8'))).total > 0;
  } catch {
    return false;
  }
}

async function readJson(p) {
  const raw = await readFile(p, 'utf-8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `${p} is not valid JSON — fix or delete it, then re-run \`rune hooks install --platform cursor\`. (${err.message})`,
    );
  }
}
