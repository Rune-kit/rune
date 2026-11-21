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
 * Mapping (Claude preset → Cursor event):
 *   preflight         PreToolUse Edit|Write   → preToolUse (matcher "Write")
 *   sentinel          PreToolUse Bash         → beforeShellExecution
 *   dependency-doctor PostToolUse Edit|Write  → afterFileEdit
 *   quarantine        PostToolUse mcp/Read    → postToolUse (matcher "MCP:.*|Read")
 *   completion-gate   Stop                    → stop
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
import { platformEntries, renderTierRule, unsupportedEntries } from './tier-emitter.js';

export const id = 'cursor';
export const HOOKS_REL_PATH = '.cursor/hooks.json';
export const HOOK_TIMEOUT_SECONDS = 30;

const RULES_REL_DIR = '.cursor/rules';
const RUNE_PREFIX = 'rune-';
const AUTO_SIGNATURE = '@rune-kit/rune hook-dispatch';
const LEGACY_PRESET_RULES = ['rune-preflight.mdc', 'rune-sentinel.mdc', 'rune-dependency-doctor.mdc'];

/** Documented Cursor events Rune writes to (subset of cursor.com/docs/hooks). */
export const PRESET_EVENTS = Object.freeze([
  { event: 'preToolUse', skill: 'preflight', matcher: 'Write' },
  { event: 'beforeShellExecution', skill: 'sentinel' },
  { event: 'afterFileEdit', skill: 'dependency-doctor' },
  { event: 'postToolUse', skill: 'quarantine', matcher: 'MCP:.*|Read' },
  { event: 'stop', skill: 'completion-gate' },
]);

export function detect(projectRoot) {
  return existsSync(path.join(projectRoot, '.cursor'));
}

export function buildCursorPreset(preset) {
  const flag = preset === 'gentle' ? ' --gentle' : '';
  const hooks = {};
  for (const { event, skill, matcher } of PRESET_EVENTS) {
    const entry = { command: `${DISPATCH_CMD} ${skill} --format cursor${flag}` };
    if (matcher) entry.matcher = matcher;
    entry.timeout = HOOK_TIMEOUT_SECONDS;
    hooks[event] = [entry];
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
    if (await claudeHasRuneHooks(projectRoot)) {
      notes.push(
        'Cursor also imports .claude/settings.json hooks (Settings → Agents → Third-Party Imports), which already has Rune hooks — inside Cursor they would fire twice. Keep one: `rune hooks install --platform claude --preset off`, or turn off Third-Party Imports.',
      );
    }
  }
  if (existsSync(hooksPath) || preset !== 'off') {
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
