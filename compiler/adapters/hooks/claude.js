/**
 * Claude Code hooks adapter.
 *
 * Target: `.claude/settings.json` — native hook primitive (PreToolUse /
 * PostToolUse / Stop). This is the stable reference adapter; other adapters
 * degrade gracefully against Claude's capabilities.
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
import { buildPreset, SETTINGS_REL_PATH, WIRED_SKILLS } from '../../commands/hooks/presets.js';
import { buildTierBlock } from './tier-emitter.js';

export const id = 'claude';

export function detect(projectRoot) {
  return existsSync(path.join(projectRoot, '.claude'));
}

export async function emit({ preset, projectRoot, tierManifests = [] }) {
  if (preset === 'off' && tierManifests.length === 0) return uninstall({ projectRoot });
  if (preset !== 'off' && preset !== 'strict' && preset !== 'gentle') {
    throw new Error(`claude adapter: invalid preset '${preset}'`);
  }

  const settingsPath = path.join(projectRoot, SETTINGS_REL_PATH);
  const existing = await readJson(settingsPath);

  // Strip ONCE up-front — preset + tier layers then merge additively without
  // the next layer wiping the previous.
  let merged = stripRuneHooks(existing);
  // Clear any existing Rune-managed statusLine so re-install is idempotent.
  if (merged.statusLine?.command && isRuneStatusLine(merged.statusLine.command)) {
    const { statusLine: _unused, ...rest } = merged;
    merged = rest;
  }
  const notes = [];

  if (preset !== 'off') {
    merged = appendHookBlock(merged, buildPreset(preset));
  }

  for (const manifest of tierManifests) {
    // Apply `overrides` — strip any surviving entries whose extracted skill name
    // matches an override key. Example: Pro's `context-sense` replaces the older
    // `context-watch` hook, so a pre-migration settings.json that still carries
    // a `context-watch` entry gets cleaned up here.
    const overrideKeys = Object.keys(manifest.overrides || {});
    if (overrideKeys.length > 0) {
      const before = JSON.stringify(merged.hooks || {});
      merged = stripHooksBySkill(merged, overrideKeys);
      const after = JSON.stringify(merged.hooks || {});
      if (before !== after) {
        notes.push(
          `claude: applied ${manifest.tier} overrides — stripped legacy entr${overrideKeys.length === 1 ? 'y' : 'ies'} (${overrideKeys.join(', ')}).`,
        );
      }
    }

    const tierBlock = buildTierBlock(manifest, 'claude');
    if (tierBlock.hooks && Object.keys(tierBlock.hooks).length > 0) {
      merged = appendHookBlock(merged, { hooks: tierBlock.hooks });
    }
    if (tierBlock.statusLine) {
      const existingStatus = merged.statusLine;
      if (!existingStatus || isRuneStatusLine(existingStatus.command)) {
        merged = { ...merged, statusLine: tierBlock.statusLine };
      } else {
        notes.push(
          `claude: user-owned statusLine detected — skipping Rune tier statusLine ('${tierBlock.statusLine.command}'). Remove your statusLine and re-install to adopt Rune's.`,
        );
      }
    }
    if (tierBlock.notes?.length) notes.push(...tierBlock.notes);
  }

  return {
    files: [
      {
        path: settingsPath,
        content: `${JSON.stringify(merged, null, 2)}\n`,
      },
    ],
    notes,
  };
}

export async function uninstall({ projectRoot }) {
  const settingsPath = path.join(projectRoot, SETTINGS_REL_PATH);
  if (!existsSync(settingsPath)) {
    return { files: [], notes: ['no .claude/settings.json — nothing to uninstall'] };
  }
  const existing = await readJson(settingsPath);
  const stripped = stripRuneHooks(existing);
  // statusLine with Rune hook-dispatch or a rune-managed tier command is Rune-owned — strip it.
  if (stripped.statusLine?.command && isRuneStatusLine(stripped.statusLine.command)) {
    delete stripped.statusLine;
  }
  return {
    files: [
      {
        path: settingsPath,
        content: `${JSON.stringify(stripped, null, 2)}\n`,
      },
    ],
    notes: [],
  };
}

const RUNE_TIER_STATUSLINE_RE = /\$\{RUNE_[A-Z][A-Z0-9_]*_ROOT\}/;

function isRuneStatusLine(command) {
  if (typeof command !== 'string') return false;
  // Match the installer's own output shapes only — not any command that happens
  // to contain the substring "rune-pulse" (a user alias could legitimately contain it).
  // Accepts: (1) npx @rune-kit/rune ..., (2) tier-rendered `${RUNE_*_ROOT}/hooks/...`.
  if (RUNE_TIER_STATUSLINE_RE.test(command)) return true;
  return /(^|\s)npx(\s+--yes)?\s+@rune-kit\/rune\b/.test(command);
}

export async function status(projectRoot) {
  const settingsPath = path.join(projectRoot, SETTINGS_REL_PATH);
  if (!existsSync(settingsPath)) {
    return {
      installed: false,
      preset: null,
      wired: [],
      missing: [...WIRED_SKILLS],
      notes: ['no .claude/settings.json'],
    };
  }
  const settings = await readJson(settingsPath);
  const summary = summarizeRuneHooks(settings);
  const preset = detectPreset(settings);
  const wired = Array.from(new Set(Object.values(summary.events).flat()));
  const missing = WIRED_SKILLS.filter((s) => !wired.includes(s));
  return {
    installed: summary.total > 0,
    preset: preset === 'none' ? null : preset,
    wired,
    missing,
    events: summary.events,
    notes: [],
  };
}

async function readJson(settingsPath) {
  if (!existsSync(settingsPath)) return {};
  const raw = await readFile(settingsPath, 'utf-8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `${settingsPath} is not valid JSON — fix it manually or delete the file and re-run \`rune hooks install\`. (${err.message})`,
    );
  }
}
