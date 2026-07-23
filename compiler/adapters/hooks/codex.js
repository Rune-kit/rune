/**
 * OpenAI Codex hooks adapter.
 *
 * Target: `.codex/hooks.json` — Codex-native lifecycle hooks. Codex currently
 * skips handlers marked `async`, so Rune emits every command synchronously and
 * relies on the preset's `--gentle` flag for warn-only behavior.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  appendHookBlock,
  detectPreset,
  stripHooksBySkill,
  stripRuneHooks,
  summarizeRuneHooks,
} from '../../commands/hooks/merge.js';
import { buildPreset, WIRED_SKILLS } from '../../commands/hooks/presets.js';

export const id = 'codex';
export const HOOKS_REL_PATH = '.codex/hooks.json';

const RUNE_DESCRIPTION = 'Rune lifecycle hooks for OpenAI Codex.';

export function detect(projectRoot) {
  return existsSync(path.join(projectRoot, '.codex'));
}

export async function emit({ preset, projectRoot, tierManifests = [] }) {
  if (preset === 'off' && tierManifests.length === 0) return uninstall({ projectRoot });
  if (preset !== 'off' && preset !== 'strict' && preset !== 'gentle') {
    throw new Error(`codex adapter: invalid preset '${preset}'`);
  }

  const hooksPath = path.join(projectRoot, HOOKS_REL_PATH);
  const existing = await readJson(hooksPath);
  let merged = stripRuneHooks(existing);
  const notes = [
    'Codex requires review/trust for new or changed project hooks. Open `/hooks` after installation.',
    'Codex does not execute async command hooks; Rune emitted synchronous handlers with preset-controlled behavior.',
  ];

  if (!merged.description) merged.description = RUNE_DESCRIPTION;
  if (preset !== 'off') {
    merged = appendHookBlock(merged, normalizeBlock(buildPreset(preset)));
  }

  for (const manifest of tierManifests) {
    const overrideKeys = Object.keys(manifest.overrides || {});
    if (overrideKeys.length > 0) merged = stripHooksBySkill(merged, overrideKeys);

    const tierBlock = buildCodexTierBlock(manifest);
    if (Object.keys(tierBlock.hooks).length > 0) {
      merged = appendHookBlock(merged, tierBlock);
    }
    if (tierBlock.skipped.length > 0) {
      notes.push(`${manifest.tier}: skipped Codex-unsupported entries (${tierBlock.skipped.join(', ')}).`);
    }
  }

  return {
    files: [{ path: hooksPath, content: `${JSON.stringify(merged, null, 2)}\n` }],
    notes,
  };
}

export async function uninstall({ projectRoot }) {
  const hooksPath = path.join(projectRoot, HOOKS_REL_PATH);
  if (!existsSync(hooksPath)) {
    return { files: [], notes: ['no .codex/hooks.json — nothing to uninstall'] };
  }

  const existing = await readJson(hooksPath);
  const stripped = stripRuneHooks(existing);
  const keys = Object.keys(stripped);
  const isRuneOnlyShell = keys.length === 1 && keys[0] === 'description' && stripped.description === RUNE_DESCRIPTION;

  return {
    files: [{ path: hooksPath, content: isRuneOnlyShell ? null : `${JSON.stringify(stripped, null, 2)}\n` }],
    notes: [],
  };
}

export async function status(projectRoot) {
  const hooksPath = path.join(projectRoot, HOOKS_REL_PATH);
  if (!existsSync(hooksPath)) {
    return {
      installed: false,
      preset: null,
      wired: [],
      missing: [...WIRED_SKILLS],
      notes: ['no .codex/hooks.json'],
    };
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
    notes: ['Use `/hooks` in Codex to inspect the current trust state.'],
  };
}

function normalizeBlock(block) {
  const hooks = {};
  for (const [event, groups] of Object.entries(block.hooks || {})) {
    hooks[event] = groups.map((group) => {
      const normalized = {
        ...group,
        hooks: group.hooks.map(normalizeCommand),
      };
      if (event === 'UserPromptSubmit' || event === 'Stop') delete normalized.matcher;
      return normalized;
    });
  }
  return { hooks };
}

function normalizeCommand(entry) {
  const { async: _unsupported, ...normalized } = entry;
  const commandWindows = toWindowsCommand(normalized.command);
  if (commandWindows !== normalized.command) normalized.commandWindows = commandWindows;
  return normalized;
}

function buildCodexTierBlock(manifest) {
  const hooks = {};
  const skipped = [];

  for (const entry of manifest.entries) {
    if (entry.event === 'statusLine' || entry.claudeOnly || entry.platforms?.codex === 'unsupported') {
      skipped.push(entry.id || entry.skill);
      continue;
    }

    const event = entry.event;
    const matcher = entry.matcher || '.*';
    if (!hooks[event]) hooks[event] = [];
    let group = hooks[event].find((candidate) => candidate.matcher === matcher);
    if (!group) {
      group = { matcher, hooks: [] };
      hooks[event].push(group);
    }
    group.hooks.push(
      normalizeCommand({
        type: 'command',
        command: entry.command,
      }),
    );
  }

  return { ...normalizeBlock({ hooks }), skipped };
}

function toWindowsCommand(command) {
  if (typeof command !== 'string') return command;
  return command.replace(/\$\{([A-Z][A-Z0-9_]*)\}/g, '%$1%');
}

async function readJson(hooksPath) {
  if (!existsSync(hooksPath)) return {};
  const raw = await readFile(hooksPath, 'utf-8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `${hooksPath} is not valid JSON — fix it manually or delete the file and re-run \`rune hooks install --platform codex\`. (${err.message})`,
    );
  }
}
