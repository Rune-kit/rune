/**
 * Google Antigravity hooks adapter — native `.agents/hooks.json` (v2.33.0).
 *
 * Antigravity (App, CLI `agy`, IDE) reads workspace hooks from
 * `.agents/hooks.json` and rules from `.agents/rules/*.md`
 * (antigravity.google/docs/hooks, /rules — checked 2026-11-22). Since Jun 2026
 * the Antigravity CLI is Google's terminal agent for free / Google AI Pro &
 * Ultra accounts; Gemini CLI is kept for Gemini Code Assist enterprise
 * licences (see the gemini adapter).
 *
 * Schema: hook NAME → event config. Tool events take matcher groups,
 * lifecycle events (Stop, SessionStart, …) a flat handler list:
 *   { "rune-preflight": { "PreToolUse": [{ matcher, hooks: [{ type, command, timeout }] }] },
 *     "rune-completion-gate": { "Stop": [{ type, command, timeout }] } }
 * Payloads are `{ toolCall: { name, args } }` with Antigravity tool names
 * (run_command, view_file, write_to_file, replace_file_content, …) and
 * PreToolUse must answer `{"decision": "allow"|"deny", "reason"}` — the
 * dispatcher's `--format antigravity` does that translation. The payload has
 * no event name, so each command passes `--event <Event>`.
 *
 * Rune owns the `rune-*` keys in hooks.json and the `rune-*.md` rules it
 * generated; everything else is preserved. Earlier versions wrote rule-only
 * stand-ins to `.antigravity/rules/` — those are removed on install.
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { DISPATCH_CMD } from '../../commands/hooks/presets.js';
import { platformEntries, renderTierRule, unsupportedEntries } from './tier-emitter.js';

export const id = 'antigravity';

export const HOOKS_REL_PATH = '.agents/hooks.json';
export const RULES_REL_DIR = '.agents/rules';
const LEGACY_RULES_REL_DIR = '.antigravity/rules';
const RUNE_PREFIX = 'rune-';
const AUTO_SIGNATURE = '@rune-kit/rune hook-dispatch';
export const HOOK_TIMEOUT_SECONDS = 30;

const FILE_READ_WRITE = 'view_file|write_to_file|replace_file_content|multi_replace_file_content';
const FILE_WRITE = 'write_to_file|replace_file_content|multi_replace_file_content';

/** Wired skill → Antigravity event + tool matcher. */
export const PRESET_EVENTS = Object.freeze([
  { skill: 'preflight', event: 'PreToolUse', matcher: FILE_READ_WRITE },
  { skill: 'sentinel', event: 'PreToolUse', matcher: 'run_command' },
  { skill: 'dependency-doctor', event: 'PostToolUse', matcher: FILE_WRITE },
  { skill: 'quarantine', event: 'PostToolUse', matcher: 'read_url_content|search_web|mcp_.*|view_file' },
  { skill: 'completion-gate', event: 'Stop' },
]);

const TOOL_EVENTS = new Set(['PreToolUse', 'PostToolUse']);

export function detect(projectRoot) {
  // `.agents/` alone is shared with Codex and other Agent Skills runtimes, so
  // it is not enough to claim Antigravity.
  return (
    existsSync(path.join(projectRoot, '.antigravity')) ||
    existsSync(path.join(projectRoot, HOOKS_REL_PATH)) ||
    existsSync(path.join(projectRoot, RULES_REL_DIR))
  );
}

export function buildAntigravityPreset(preset) {
  const flag = preset === 'gentle' ? ' --gentle' : '';
  const out = {};
  for (const { skill, event, matcher } of PRESET_EVENTS) {
    const handler = {
      type: 'command',
      command: `${DISPATCH_CMD} ${skill} --format antigravity --event ${event}${flag}`,
      timeout: HOOK_TIMEOUT_SECONDS,
    };
    out[`${RUNE_PREFIX}${skill}`] = {
      [event]: TOOL_EVENTS.has(event) ? [{ matcher, hooks: [handler] }] : [handler],
    };
  }
  return out;
}

function stripRune(config) {
  const kept = {};
  for (const [name, value] of Object.entries(config || {})) {
    if (!name.startsWith(RUNE_PREFIX)) kept[name] = value;
  }
  return kept;
}

export async function emit({ preset, projectRoot, tierManifests = [] }) {
  if (preset === 'off' && tierManifests.length === 0) return uninstall({ projectRoot });
  if (preset !== 'off' && preset !== 'strict' && preset !== 'gentle') {
    throw new Error(`antigravity adapter: invalid preset '${preset}'`);
  }

  const files = [];
  const notes = [];
  const hooksPath = path.join(projectRoot, HOOKS_REL_PATH);
  const existing = existsSync(hooksPath) ? await readJson(hooksPath) : {};
  let config = stripRune(existing);
  if (preset !== 'off') {
    config = { ...config, ...buildAntigravityPreset(preset) };
    notes.push(
      `Native Antigravity hooks written to ${HOOKS_REL_PATH} (${preset}) — App, CLI (agy) and IDE. Check them with /hooks.`,
    );
  }
  if (preset !== 'off' || existsSync(hooksPath)) {
    files.push({ path: hooksPath, content: `${JSON.stringify(config, null, 2)}\n` });
  }

  files.push(...(await managedRuleDeletions(path.join(projectRoot, LEGACY_RULES_REL_DIR))));

  const mode = preset === 'strict' ? 'BLOCK' : 'WARN';
  const rulesDir = path.join(projectRoot, RULES_REL_DIR);
  for (const manifest of tierManifests) {
    for (const entry of platformEntries(manifest, 'antigravity')) {
      const content = renderTierRule(entry, 'antigravity', { mode, tier: manifest.tier });
      if (!content) continue;
      files.push({ path: path.join(rulesDir, `${RUNE_PREFIX}${manifest.tier}-${entry.id}.md`), content });
    }
    const skipped = unsupportedEntries(manifest, 'antigravity');
    if (skipped.length > 0) {
      notes.push(
        `antigravity: ${manifest.tier} skipped ${skipped.length} entr${skipped.length === 1 ? 'y' : 'ies'} (${skipped.map((e) => e.id).join(', ')}) — platform-unsupported or Claude-only.`,
      );
    }
  }

  return { files, notes };
}

async function managedRuleDeletions(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const file of await readdir(dir, { withFileTypes: true })) {
    if (!file.isFile() || !file.name.startsWith(RUNE_PREFIX) || !file.name.endsWith('.md')) continue;
    const abs = path.join(dir, file.name);
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
    const kept = stripRune(config);
    if (Object.keys(kept).length === 0) files.push({ path: hooksPath, content: null });
    else if (Object.keys(kept).length !== Object.keys(config).length) {
      files.push({ path: hooksPath, content: `${JSON.stringify(kept, null, 2)}\n` });
    }
  }
  files.push(...(await managedRuleDeletions(path.join(projectRoot, RULES_REL_DIR))));
  files.push(...(await managedRuleDeletions(path.join(projectRoot, LEGACY_RULES_REL_DIR))));
  return { files, notes: files.length === 0 ? ['no Rune-managed Antigravity hooks or rules'] : [] };
}

export async function status(projectRoot) {
  const hooksPath = path.join(projectRoot, HOOKS_REL_PATH);
  const expected = PRESET_EVENTS.map((e) => e.skill);
  if (!existsSync(hooksPath)) {
    return { installed: false, preset: null, wired: [], missing: expected, notes: [`no ${HOOKS_REL_PATH}`] };
  }
  const config = await readJson(hooksPath);
  const wired = [];
  let preset = null;
  for (const [name, value] of Object.entries(config)) {
    if (!name.startsWith(RUNE_PREFIX)) continue;
    wired.push(name.slice(RUNE_PREFIX.length));
    const text = JSON.stringify(value);
    if (text.includes('--gentle')) preset = preset ?? 'gentle';
    else preset = 'strict';
  }
  return {
    installed: wired.length > 0,
    preset,
    wired,
    missing: expected.filter((s) => !wired.includes(s)),
    notes: ['Antigravity runs workspace hooks from .agents/hooks.json — list them with /hooks.'],
  };
}

async function readJson(p) {
  const raw = await readFile(p, 'utf-8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`${p} is not valid JSON — fix or delete it, then re-run \`rune hooks install\`. (${err.message})`);
  }
}
