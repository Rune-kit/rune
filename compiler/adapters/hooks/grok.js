/**
 * Grok Build hooks adapter (xAI).
 *
 * Target: `.grok/hooks/rune.json` — Grok's project hook directory
 * (docs.x.ai/build/features/hooks: personal `~/.grok/hooks/*.json`, project
 * `<project>/.grok/hooks/*.json`). The schema is Claude-shaped:
 * `{ hooks: { Event: [{ matcher, hooks: [{ type: "command", command, timeout }] }] } }`,
 * Claude tool names in `matcher` are mapped by Grok, and `timeout` is in
 * seconds (default 5 — too short for a cold `npx`, so Rune sets 30).
 *
 * Rune owns this file outright, so uninstall deletes it. Grok also reads
 * `.claude/settings.json`; if Rune hooks are installed there too they fire
 * twice inside Grok, so emit() warns. Project hooks run only after the folder
 * is trusted (`/hooks-trust` or `grok --trust`). PreToolUse is the only
 * blocking event; failures are fail-open.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { appendHookBlock, detectPreset, stripHooksBySkill, summarizeRuneHooks } from '../../commands/hooks/merge.js';
import { buildPreset, SETTINGS_REL_PATH, WIRED_SKILLS } from '../../commands/hooks/presets.js';
import { hasRuneHooks as cursorHasRuneHooks } from './cursor.js';
import { statusLineUserNote } from './tier-emitter.js';

export const id = 'grok';
export const HOOKS_REL_PATH = '.grok/hooks/rune.json';
export const HOOK_TIMEOUT_SECONDS = 30;

export function detect(projectRoot) {
  return existsSync(path.join(projectRoot, '.grok'));
}

export async function emit({ preset, projectRoot, tierManifests = [], platforms = [] }) {
  if (preset === 'off' && tierManifests.length === 0) return uninstall({ projectRoot });
  // Grok Build also runs Rune's `.cursor/hooks.json` entries (hybrid format,
  // see adapters/hooks/cursor.js). Writing the Free preset here too would fire
  // every gate twice, so leave it to the Cursor file.
  const cursorCovers = preset !== 'off' && (platforms.includes('cursor') || (await cursorHasRuneHooks(projectRoot)));
  if (cursorCovers && tierManifests.length === 0) {
    const hooksPath = path.join(projectRoot, HOOKS_REL_PATH);
    return {
      files: existsSync(hooksPath) ? [{ path: hooksPath, content: null }] : [],
      notes: [
        `Grok Build runs Rune's .cursor/hooks.json entries — skipped ${HOOKS_REL_PATH} so the gates fire once. Trust the folder (/hooks-trust) and check the /hooks tab.`,
      ],
    };
  }
  if (preset !== 'off' && preset !== 'strict' && preset !== 'gentle') {
    throw new Error(`grok adapter: invalid preset '${preset}'`);
  }

  let merged = {};
  const notes = [
    'Grok runs project hooks only in a trusted folder — run `/hooks-trust` in Grok (or start it with `--trust`), then check the /hooks tab.',
  ];
  if (await claudeHasRuneHooks(projectRoot)) {
    notes.push(
      'Grok also reads .claude/settings.json, which already has Rune hooks — inside Grok they would fire twice. Keep one: `rune hooks install --platform claude --preset off` or `--platform grok --preset off`.',
    );
  }

  if (preset !== 'off' && !cursorCovers) merged = appendHookBlock(merged, normalizeBlock(buildPreset(preset)));

  for (const manifest of tierManifests) {
    const overrideKeys = Object.keys(manifest.overrides || {});
    if (overrideKeys.length > 0) merged = stripHooksBySkill(merged, overrideKeys);
    const tierBlock = buildGrokTierBlock(manifest, { skipCursorCovered: cursorCovers });
    if (Object.keys(tierBlock.hooks).length > 0) merged = appendHookBlock(merged, tierBlock);
    const userNote = statusLineUserNote(manifest, 'grok');
    if (userNote) notes.push(userNote);
    if (tierBlock.skipped.length > 0) {
      notes.push(`${manifest.tier}: skipped Grok-unsupported entries (${tierBlock.skipped.join(', ')}).`);
    }
  }

  return {
    files: [{ path: path.join(projectRoot, HOOKS_REL_PATH), content: `${JSON.stringify(merged, null, 2)}\n` }],
    notes,
  };
}

export async function uninstall({ projectRoot }) {
  const hooksPath = path.join(projectRoot, HOOKS_REL_PATH);
  if (!existsSync(hooksPath)) {
    return { files: [], notes: [`no ${HOOKS_REL_PATH} — nothing to uninstall`] };
  }
  return { files: [{ path: hooksPath, content: null }], notes: [] };
}

export async function status(projectRoot) {
  const hooksPath = path.join(projectRoot, HOOKS_REL_PATH);
  if (!existsSync(hooksPath)) {
    return { installed: false, preset: null, wired: [], missing: [...WIRED_SKILLS], notes: [`no ${HOOKS_REL_PATH}`] };
  }
  const settings = await readJson(hooksPath);
  const summary = summarizeRuneHooks(settings);
  const preset = detectPreset(settings);
  const wired = Array.from(new Set(Object.values(summary.events).flat()));
  return {
    installed: summary.total > 0,
    preset: preset === 'none' ? null : preset,
    wired,
    missing: WIRED_SKILLS.filter((skill) => !wired.includes(skill)),
    events: summary.events,
    notes: ['Use the /hooks tab in Grok to see loaded hooks and trust state.'],
  };
}

function normalizeBlock(block) {
  const hooks = {};
  for (const [event, groups] of Object.entries(block.hooks || {})) {
    hooks[event] = groups.map((group) => {
      const normalized = { ...group, hooks: group.hooks.map(normalizeCommand) };
      if (event === 'UserPromptSubmit' || event === 'Stop') delete normalized.matcher;
      return normalized;
    });
  }
  return { hooks };
}

// Grok documents only type / command / url / timeout — drop Claude's `async`.
function normalizeCommand(entry) {
  const { async: _unsupported, ...rest } = entry;
  return { ...rest, timeout: rest.timeout ?? HOOK_TIMEOUT_SECONDS };
}

function buildGrokTierBlock(manifest, opts = {}) {
  const hooks = {};
  const skipped = [];
  for (const entry of manifest.entries) {
    if (
      entry.event === 'statusLine' ||
      entry.claudeOnly ||
      entry.platforms?.grok === 'unsupported' ||
      entry.platforms?.grok === 'statusLine-user'
    ) {
      skipped.push(entry.id || entry.skill);
      continue;
    }
    // When Cursor hooks are installed, Grok Build also runs the hybrid
    // `.cursor/hooks.json` entries. Skip the same Pro hook here so it fires once.
    if (opts.skipCursorCovered && entry.platforms?.cursor === 'hook') {
      skipped.push(entry.id || entry.skill);
      continue;
    }
    const matcher = entry.matcher || '.*';
    if (!hooks[entry.event]) hooks[entry.event] = [];
    let group = hooks[entry.event].find((g) => g.matcher === matcher);
    if (!group) {
      group = { matcher, hooks: [] };
      hooks[entry.event].push(group);
    }
    group.hooks.push({ type: 'command', command: entry.command });
  }
  return { ...normalizeBlock({ hooks }), skipped };
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
      `${p} is not valid JSON — delete it and re-run \`rune hooks install --platform grok\`. (${err.message})`,
    );
  }
}
