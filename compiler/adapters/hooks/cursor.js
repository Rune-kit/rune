/**
 * Cursor hooks adapter.
 *
 * Cursor has no PreToolUse/PostToolUse primitives. The closest analog is the
 * `.cursor/rules/*.mdc` auto-attach system: rules with `alwaysApply: true` or
 * glob-scoped rules inject guidance into the agent's prompt when editing
 * matching files. This adapter emits Rune skill invocation reminders as rules.
 *
 * Fidelity vs Claude:
 *   - preflight → rule (alwaysApply, agent sees it before every Edit)
 *   - sentinel  → rule scoped to commit-related files
 *   - dependency-doctor → rule scoped to package.json / lockfiles
 *   - completion-gate → no analog (Cursor has no Stop hook) — documented in notes
 *
 * All Rune rule files are prefixed `rune-` for unambiguous detection.
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { platformEntries, renderTierRule, unsupportedEntries } from './tier-emitter.js';

export const id = 'cursor';

const RULES_REL_DIR = '.cursor/rules';
const RUNE_PREFIX = 'rune-';
const AUTO_SIGNATURE = '@rune-kit/rune hook-dispatch';

export function detect(projectRoot) {
  return existsSync(path.join(projectRoot, '.cursor'));
}

export async function emit({ preset, projectRoot, tierManifests = [] }) {
  if (preset === 'off' && tierManifests.length === 0) return uninstall({ projectRoot });
  if (preset !== 'off' && preset !== 'strict' && preset !== 'gentle') {
    throw new Error(`cursor adapter: invalid preset '${preset}'`);
  }

  const rulesDir = path.join(projectRoot, RULES_REL_DIR);
  const mode = preset === 'strict' ? 'BLOCK' : 'WARN';
  const ruleBase = { mode };

  const rules = [
    {
      name: 'rune-preflight',
      globs: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.py', '**/*.go', '**/*.rs'],
      alwaysApply: true,
      skill: 'preflight',
      description: 'Run Rune preflight before editing source files.',
      detail: `Before editing any source file, mentally run through Rune's preflight checklist: logic preserved, error handling present, no regressions introduced. ${mode} if any concern surfaces.`,
    },
    {
      name: 'rune-sentinel',
      globs: ['**/*.sh', '**/*.Dockerfile', 'Dockerfile', '.github/workflows/*.yml', '.env*'],
      alwaysApply: false,
      skill: 'sentinel',
      description: 'Security review before shell / infra / secret edits.',
      detail: `Before running any Bash or editing infrastructure/env files, audit for secrets, destructive commands, and command injection. ${mode} on any finding.`,
    },
    {
      name: 'rune-dependency-doctor',
      globs: [
        'package.json',
        'package-lock.json',
        'pnpm-lock.yaml',
        'yarn.lock',
        'requirements.txt',
        'Cargo.toml',
        'go.mod',
      ],
      alwaysApply: false,
      skill: 'dependency-doctor',
      description: 'Dependency health audit after lockfile edits.',
      detail:
        'After modifying any lockfile or manifest, run Rune dependency-doctor to check for outdated packages, CVEs, and breaking change risk.',
    },
  ];

  const files =
    preset === 'off'
      ? []
      : rules.map((r) => ({
          path: path.join(rulesDir, `${r.name}.mdc`),
          content: renderMdc({ ...r, ...ruleBase }),
        }));

  const notes =
    preset === 'off'
      ? []
      : [
          'Cursor has no Stop hook equivalent — `completion-gate` must be invoked manually via `/rune completion-gate`.',
          `Auto-attach mode: ${preset}. Rules emit ${mode} guidance to the agent.`,
        ];

  for (const manifest of tierManifests) {
    const tierMode = mode; // share preset mode with tier rules
    for (const entry of platformEntries(manifest, 'cursor')) {
      const content = renderTierRule(entry, 'cursor', { mode: tierMode, tier: manifest.tier });
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

export async function uninstall({ projectRoot }) {
  const rulesDir = path.join(projectRoot, RULES_REL_DIR);
  if (!existsSync(rulesDir)) return { files: [], notes: [] };

  const entries = await readdir(rulesDir, { withFileTypes: true });
  const runeFiles = entries.filter((e) => e.isFile() && e.name.startsWith(RUNE_PREFIX) && e.name.endsWith('.mdc'));

  const files = [];
  for (const file of runeFiles) {
    const abs = path.join(rulesDir, file.name);
    const content = await readFile(abs, 'utf-8');
    if (content.includes(AUTO_SIGNATURE) || content.includes('rune-managed: true')) {
      files.push({ path: abs, content: null });
    }
  }

  return { files, notes: files.length === 0 ? ['no Rune-managed rules found'] : [] };
}

export async function status(projectRoot) {
  const rulesDir = path.join(projectRoot, RULES_REL_DIR);
  if (!existsSync(rulesDir)) {
    return {
      installed: false,
      preset: null,
      wired: [],
      missing: ['preflight', 'sentinel', 'dependency-doctor'],
      notes: ['no .cursor/rules directory'],
    };
  }
  const entries = await readdir(rulesDir, { withFileTypes: true });
  const runeFiles = entries.filter((e) => e.isFile() && e.name.startsWith(RUNE_PREFIX) && e.name.endsWith('.mdc'));
  const wired = runeFiles.map((f) => f.name.replace(RUNE_PREFIX, '').replace('.mdc', ''));
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

  return {
    installed: runeFiles.length > 0,
    preset,
    wired,
    missing,
    notes: ['completion-gate not available on Cursor'],
  };
}

function renderMdc(rule) {
  const frontmatter = [
    '---',
    `description: ${rule.description}`,
    `globs: ${JSON.stringify(rule.globs)}`,
    `alwaysApply: ${rule.alwaysApply}`,
    'rune-managed: true',
    `rune-skill: ${rule.skill}`,
    `mode: ${rule.mode}`,
    '---',
  ].join('\n');
  const body = [
    `# Rune ${rule.skill}`,
    '',
    rule.detail,
    '',
    `_Auto-generated by \`rune hooks install\` (${AUTO_SIGNATURE})._`,
    '_Do not hand-edit — changes will be overwritten. Delete the file to opt out._',
  ].join('\n');
  return `${frontmatter}\n\n${body}\n`;
}
