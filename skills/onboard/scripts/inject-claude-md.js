#!/usr/bin/env node

/**
 * inject-claude-md.js — Idempotent editor for CLAUDE.md that maintains an
 * auto-generated "Invariants (auto-detected)" pointer block.
 *
 * The block is delimited by HTML comment markers that are valid in Markdown:
 *
 *   <!-- @rune-invariants-pointer:start -->
 *   ...
 *   <!-- @rune-invariants-pointer:end -->
 *
 * Content outside these markers is NEVER touched. Re-running replaces only the
 * content between the markers. Users can delete the markers to opt out — a
 * subsequent run will re-inject them once and respect a user-placed
 * `<!-- @rune-invariants-pointer:skip -->` directive indefinitely.
 *
 * Usage as CLI:
 *   node inject-claude-md.js --claude-md <path> --invariants <path>
 *
 * Usage as module:
 *   import { injectInvariantsPointer, buildPointerBlock } from './inject-claude-md.js';
 *   const { action, content } = injectInvariantsPointer({ claudeMd, globs });
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

export const MARKER_START = '<!-- @rune-invariants-pointer:start -->';
export const MARKER_END = '<!-- @rune-invariants-pointer:end -->';
export const SKIP_DIRECTIVE = '<!-- @rune-invariants-pointer:skip -->';

const DEFAULT_INVARIANTS_PATH = '.rune/INVARIANTS.md';
const MAX_GLOBS_IN_POINTER = 8;

export function buildPointerBlock({ globs = [], invariantsPath = DEFAULT_INVARIANTS_PATH } = {}) {
  const unique = Array.from(new Set(globs.filter((g) => typeof g === 'string' && g.trim())));
  const shown = unique.slice(0, MAX_GLOBS_IN_POINTER);
  const overflow = unique.length - shown.length;

  const lines = [
    MARKER_START,
    '## Invariants (auto-detected)',
    '',
    `Before editing these paths, read [\`${invariantsPath}\`](${invariantsPath}) —`,
    'it lists danger zones and cross-file invariants this project enforces.',
    '',
  ];

  if (shown.length === 0) {
    lines.push('_No danger zones detected yet. Re-run `rune onboard` after the codebase grows._');
  } else {
    for (const glob of shown) {
      lines.push(`- \`${glob}\``);
    }
    if (overflow > 0) {
      lines.push(`- _…and ${overflow} more — see \`${invariantsPath}\`_`);
    }
  }

  lines.push('', MARKER_END);
  return lines.join('\n');
}

export function injectInvariantsPointer({ claudeMd = '', globs = [], invariantsPath = DEFAULT_INVARIANTS_PATH } = {}) {
  if (claudeMd.includes(SKIP_DIRECTIVE)) {
    return { action: 'skipped', reason: 'skip-directive', content: claudeMd };
  }

  const block = buildPointerBlock({ globs, invariantsPath });

  const startIdx = claudeMd.indexOf(MARKER_START);
  const endIdx = claudeMd.indexOf(MARKER_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = claudeMd.slice(0, startIdx);
    const after = claudeMd.slice(endIdx + MARKER_END.length);
    const next = `${before}${block}${after}`;
    if (next === claudeMd) {
      return { action: 'unchanged', content: claudeMd };
    }
    return { action: 'updated', content: next };
  }

  if (startIdx !== -1 || endIdx !== -1) {
    return {
      action: 'error',
      reason: 'marker-mismatch',
      content: claudeMd,
    };
  }

  const separator = claudeMd.length === 0 || claudeMd.endsWith('\n\n') ? '' : claudeMd.endsWith('\n') ? '\n' : '\n\n';
  const next = `${claudeMd}${separator}${block}\n`;
  return { action: 'created', content: next };
}

export async function applyInvariantsPointer({
  claudeMdPath,
  globs = [],
  invariantsPath = DEFAULT_INVARIANTS_PATH,
  dryRun = false,
} = {}) {
  if (!claudeMdPath) {
    throw new Error('claudeMdPath is required');
  }

  const existing = existsSync(claudeMdPath) ? await readFile(claudeMdPath, 'utf8') : '';
  const result = injectInvariantsPointer({ claudeMd: existing, globs, invariantsPath });

  if (!dryRun && (result.action === 'created' || result.action === 'updated')) {
    await writeFile(claudeMdPath, result.content, 'utf8');
  }

  return { ...result, path: claudeMdPath, existed: existing.length > 0 };
}

async function main() {
  const { values } = parseArgs({
    options: {
      'claude-md': { type: 'string' },
      invariants: { type: 'string', default: DEFAULT_INVARIANTS_PATH },
      globs: { type: 'string', multiple: true, default: [] },
      dry: { type: 'boolean', default: false },
    },
  });

  const claudeMdPath = values['claude-md'];
  if (!claudeMdPath) {
    console.error('Usage: inject-claude-md.js --claude-md <path> [--invariants <path>] [--globs glob ...] [--dry]');
    process.exit(2);
  }

  const result = await applyInvariantsPointer({
    claudeMdPath,
    globs: values.globs,
    invariantsPath: values.invariants,
    dryRun: values.dry,
  });

  console.log(JSON.stringify({ path: result.path, action: result.action, reason: result.reason ?? null }));
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('inject-claude-md.js')) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
