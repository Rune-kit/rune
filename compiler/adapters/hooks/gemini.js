/**
 * Gemini CLI hooks adapter.
 *
 * Spec (geminicli.com docs/hooks/index.md + reference.md, verified 2026-11):
 * project hooks live in `<project>/.gemini/settings.json` under `hooks`:
 *   `{ "hooks": { "BeforeTool": [{ matcher, hooks: [{ type: "command", command, name?, timeout? }] }] } }`
 * `timeout` is in MILLISECONDS (default 60000). Tool matchers are regexes over
 * Gemini tool names (`write_file`, `replace`, `run_shell_command`, `web_fetch`,
 * `read_file`, `read_many_files`, MCP tools are `mcp_<server>_<tool>`).
 * stdout must be pure JSON ("Golden Rule"), so commands pass `--format gemini`
 * and the dispatcher prints `{}`; exit 2 blocks (BeforeTool) or retries
 * (AfterAgent) with stderr as the reason.
 *
 * Mapping (Claude preset → Gemini event):
 *   preflight         → BeforeTool  `write_file|replace`
 *   sentinel          → BeforeTool  `run_shell_command`
 *   dependency-doctor → AfterTool   `write_file|replace`
 *   quarantine        → AfterTool   `web_fetch|read_file|read_many_files|mcp_.*`
 *   completion-gate   → AfterAgent  (lifecycle event, no matcher)
 *
 * `.gemini/settings.json` holds unrelated user settings, so emit/uninstall only
 * touch hook entries carrying the Rune dispatch signature. Claude Code and Grok
 * never read this file, so they are unaffected. Gemini fingerprints project
 * hooks: the first run after install (or after a command change) asks for trust.
 * Tier (Pro/Business) entries are not mapped to Gemini yet and are skipped.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { appendHookBlock, detectPreset, stripRuneHooks, summarizeRuneHooks } from '../../commands/hooks/merge.js';
import { DISPATCH_CMD, WIRED_SKILLS } from '../../commands/hooks/presets.js';
import { hookEntries, statusLineUserNote, unsupportedEntries, withHookFormat } from './tier-emitter.js';

export const id = 'gemini';
export const SETTINGS_REL_PATH = '.gemini/settings.json';
export const HOOK_TIMEOUT_MS = 30000;

/** Map a Claude-shaped Pro manifest event to a Gemini CLI hook event. */
export function mapGeminiTierEvent(entry) {
  switch (entry.event) {
    case 'UserPromptSubmit':
      return { event: 'BeforeAgent' };
    case 'PreToolUse':
      return { event: 'BeforeTool', matcher: 'write_file|replace' };
    case 'PreCompact':
      return { event: 'PreCompress' };
    case 'SessionStart':
      return { event: 'SessionStart' };
    case 'AfterModel':
      return { event: 'AfterModel' };
    default:
      return null;
  }
}

export function buildGeminiTierBlock(manifest) {
  const hooks = {};
  const skipped = [];
  for (const entry of hookEntries(manifest, 'gemini')) {
    const mapped = mapGeminiTierEvent(entry);
    if (!mapped) {
      skipped.push(entry.id);
      continue;
    }
    const group = {
      hooks: [
        {
          name: `rune-${manifest.tier}-${entry.id}`,
          type: 'command',
          command: withHookFormat(entry.command, 'gemini'),
          timeout: HOOK_TIMEOUT_MS,
        },
      ],
    };
    if (mapped.matcher) group.matcher = mapped.matcher;
    (hooks[mapped.event] ||= []).push(group);
  }
  return { hooks, skipped };
}

export const PRESET_EVENTS = Object.freeze([
  { event: 'BeforeTool', skill: 'preflight', matcher: 'write_file|replace' },
  { event: 'BeforeTool', skill: 'sentinel', matcher: 'run_shell_command' },
  { event: 'AfterTool', skill: 'dependency-doctor', matcher: 'write_file|replace' },
  { event: 'AfterTool', skill: 'quarantine', matcher: 'web_fetch|read_file|read_many_files|mcp_.*' },
  { event: 'AfterAgent', skill: 'completion-gate' },
]);

export function detect(projectRoot) {
  return existsSync(path.join(projectRoot, '.gemini'));
}

export function buildGeminiPreset(preset) {
  const flag = preset === 'gentle' ? ' --gentle' : '';
  const hooks = {};
  for (const { event, skill, matcher } of PRESET_EVENTS) {
    const group = {};
    if (matcher) group.matcher = matcher;
    group.hooks = [
      {
        name: `rune-${skill}`,
        type: 'command',
        command: `${DISPATCH_CMD} ${skill} --format gemini${flag}`,
        timeout: HOOK_TIMEOUT_MS,
      },
    ];
    (hooks[event] ||= []).push(group);
  }
  return { hooks };
}

export async function emit({ preset, projectRoot, tierManifests = [] }) {
  if (preset === 'off' && tierManifests.length === 0) return uninstall({ projectRoot });
  if (preset !== 'off' && preset !== 'strict' && preset !== 'gentle') {
    throw new Error(`gemini adapter: invalid preset '${preset}'`);
  }
  const settingsPath = path.join(projectRoot, SETTINGS_REL_PATH);
  const existing = existsSync(settingsPath) ? await readJson(settingsPath) : {};
  let merged = stripRuneHooks(existing);
  const notes = [];
  if (preset !== 'off') {
    merged = appendHookBlock(merged, buildGeminiPreset(preset));
    notes.push(
      `Gemini CLI hooks written to ${SETTINGS_REL_PATH} (${preset}). Gemini asks you to trust new project hooks on first run; review them with \`/hooks panel\`.`,
    );
  }
  for (const manifest of tierManifests) {
    const tierBlock = buildGeminiTierBlock(manifest);
    if (Object.keys(tierBlock.hooks).length > 0) {
      merged = appendHookBlock(merged, { hooks: tierBlock.hooks });
      notes.push(
        `Gemini CLI hooks written for ${manifest.tier} context-intelligence entries. Gemini asks you to trust new project hooks on first run.`,
      );
    }
    const userNote = statusLineUserNote(manifest, 'gemini');
    if (userNote) notes.push(userNote);
    const skipped = [...tierBlock.skipped, ...unsupportedEntries(manifest, 'gemini').map((e) => e.id)];
    if (skipped.length > 0) {
      notes.push(`gemini: ${manifest.tier} skipped ${skipped.join(', ')}.`);
    }
  }
  return { files: [{ path: settingsPath, content: `${JSON.stringify(merged, null, 2)}\n` }], notes };
}

export async function uninstall({ projectRoot }) {
  const settingsPath = path.join(projectRoot, SETTINGS_REL_PATH);
  if (!existsSync(settingsPath)) return { files: [], notes: [`no ${SETTINGS_REL_PATH} — nothing to uninstall`] };
  const existing = await readJson(settingsPath);
  if (summarizeRuneHooks(existing).total === 0) return { files: [], notes: ['no Rune-managed Gemini hooks found'] };
  const stripped = stripRuneHooks(existing);
  const content = Object.keys(stripped).length === 0 ? null : `${JSON.stringify(stripped, null, 2)}\n`;
  return { files: [{ path: settingsPath, content }], notes: [] };
}

export async function status(projectRoot) {
  const settingsPath = path.join(projectRoot, SETTINGS_REL_PATH);
  if (!existsSync(settingsPath)) {
    return {
      installed: false,
      preset: null,
      wired: [],
      missing: [...WIRED_SKILLS],
      notes: [`no ${SETTINGS_REL_PATH}`],
    };
  }
  const settings = await readJson(settingsPath);
  const summary = summarizeRuneHooks(settings);
  const preset = detectPreset(settings);
  const wired = Array.from(new Set(Object.values(summary.events).flat()));
  return {
    installed: summary.total > 0,
    preset: preset === 'none' ? null : preset,
    wired,
    missing: WIRED_SKILLS.filter((s) => !wired.includes(s)),
    events: summary.events,
    notes: ['Run `/hooks panel` in Gemini CLI to see loaded hooks; `/hooks disable rune-<skill>` turns one off.'],
  };
}

async function readJson(p) {
  const raw = await readFile(p, 'utf-8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `${p} is not valid JSON — fix it, then re-run \`rune hooks install --platform gemini\`. (${err.message})`,
    );
  }
}
