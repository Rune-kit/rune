/**
 * Google Antigravity hooks adapter (experimental).
 *
 * Antigravity uses `.antigravity/rules/*.md` for persistent agent context.
 * There is no tool-level hook primitive yet, so we mirror Cursor's pattern:
 * emit rule files that cascade into the agent's prompt. This is the weakest
 * fidelity tier — documented so users know what they're getting.
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { platformEntries, renderTierRule, unsupportedEntries } from './tier-emitter.js';

export const id = 'antigravity';

const RULES_REL_DIR = '.antigravity/rules';
const RUNE_PREFIX = 'rune-';
const AUTO_SIGNATURE = '@rune-kit/rune hook-dispatch';

export function detect(projectRoot) {
  return existsSync(path.join(projectRoot, '.antigravity'));
}

export async function emit({ preset, projectRoot, tierManifests = [] }) {
  if (preset === 'off' && tierManifests.length === 0) return uninstall({ projectRoot });
  if (preset !== 'off' && preset !== 'strict' && preset !== 'gentle') {
    throw new Error(`antigravity adapter: invalid preset '${preset}'`);
  }

  const mode = preset === 'strict' ? 'BLOCK' : 'WARN';
  const rulesDir = path.join(projectRoot, RULES_REL_DIR);

  const rules = [
    { name: 'preflight', description: 'Run preflight review before any source edit.' },
    { name: 'sentinel', description: 'Security review before shell / infra edits.' },
    { name: 'dependency-doctor', description: 'Dependency audit after manifest edits.' },
  ];

  const files =
    preset === 'off'
      ? []
      : rules.map((r) => ({
          path: path.join(rulesDir, `${RUNE_PREFIX}${r.name}.md`),
          content: renderRule(r, mode),
        }));

  const notes =
    preset === 'off'
      ? []
      : [
          'Antigravity support is experimental — rule-injection only, no true hook.',
          `Preset: ${preset} (${mode}). \`completion-gate\` must be invoked manually.`,
        ];

  for (const manifest of tierManifests) {
    for (const entry of platformEntries(manifest, 'antigravity')) {
      const content = renderTierRule(entry, 'antigravity', { mode, tier: manifest.tier });
      if (!content) continue;
      files.push({
        path: path.join(rulesDir, `${RUNE_PREFIX}${manifest.tier}-${entry.id}.md`),
        content,
      });
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

export async function uninstall({ projectRoot }) {
  const rulesDir = path.join(projectRoot, RULES_REL_DIR);
  if (!existsSync(rulesDir)) return { files: [], notes: [] };
  const entries = await readdir(rulesDir, { withFileTypes: true });
  const runeFiles = entries.filter((e) => e.isFile() && e.name.startsWith(RUNE_PREFIX) && e.name.endsWith('.md'));
  const files = [];
  for (const file of runeFiles) {
    const abs = path.join(rulesDir, file.name);
    const content = await readFile(abs, 'utf-8');
    if (content.includes(AUTO_SIGNATURE) || content.includes('rune-managed: true')) {
      files.push({ path: abs, content: null });
    }
  }
  return { files, notes: files.length === 0 ? ['no Rune-managed antigravity rules'] : [] };
}

export async function status(projectRoot) {
  const rulesDir = path.join(projectRoot, RULES_REL_DIR);
  if (!existsSync(rulesDir)) {
    return {
      installed: false,
      preset: null,
      wired: [],
      missing: ['preflight', 'sentinel', 'dependency-doctor'],
      notes: ['no .antigravity/rules directory'],
    };
  }
  const entries = await readdir(rulesDir, { withFileTypes: true });
  const runeFiles = entries.filter((e) => e.isFile() && e.name.startsWith(RUNE_PREFIX) && e.name.endsWith('.md'));
  const wired = runeFiles.map((f) => f.name.replace(RUNE_PREFIX, '').replace('.md', ''));
  const expected = ['preflight', 'sentinel', 'dependency-doctor'];
  const missing = expected.filter((s) => !wired.includes(s));

  let preset = null;
  for (const file of runeFiles) {
    const content = await readFile(path.join(rulesDir, file.name), 'utf-8');
    if (/^mode: BLOCK$/m.test(content)) {
      preset = 'strict';
      break;
    }
    if (/^mode: WARN$/m.test(content)) preset = preset ?? 'gentle';
  }

  return { installed: runeFiles.length > 0, preset, wired, missing, notes: ['experimental — rule-injection only'] };
}

function renderRule(rule, mode) {
  return [
    '---',
    `description: ${rule.description}`,
    'rune-managed: true',
    `rune-skill: ${rule.name}`,
    `mode: ${mode}`,
    '---',
    '',
    `# Rune ${rule.name}`,
    '',
    `${rule.description} Mode: ${mode}.`,
    '',
    'Refer to the Rune skill SKILL.md for the full checklist — apply those checks mentally before each matching edit.',
    '',
    `_Auto-generated by \`rune hooks install\` (${AUTO_SIGNATURE})._`,
    '',
  ].join('\n');
}
