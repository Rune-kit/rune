#!/usr/bin/env node

/**
 * onboard-invariants.js — Orchestrate invariant detection, INVARIANTS.md
 * generation (merge-preserving), and CLAUDE.md pointer injection.
 *
 * Writes/updates:
 *   - .rune/INVARIANTS.md       (seeded from template, append-only on re-run)
 *   - CLAUDE.md                 (pointer block between markers)
 *
 * Safe re-runs:
 *   - Existing user sections above the auto-detected block are preserved.
 *   - New detections land under `## Auto-detected (new)` — never overwrite.
 *
 * Usage as CLI:
 *   node onboard-invariants.js --root <project-root> [--dry]
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { detectInvariants, renderInvariants } from './detect-invariants.js';
import { applyInvariantsPointer } from './inject-claude-md.js';

const AUTO_HEADER = '## Auto-detected (new)';
const TEMPLATE_REL_PATH = '../references/invariants-template.md';

/**
 * Locate the next `## `-level section boundary in `text`, ignoring any `##`
 * lines that appear inside fenced code blocks (``` or ~~~).
 * Returns the index of the start of the boundary line, or -1 if none.
 */
function findNextSectionOffset(text) {
  let offset = 0;
  let inFence = false;
  let fenceDelim = null;
  while (offset < text.length) {
    const eol = text.indexOf('\n', offset);
    const lineEnd = eol === -1 ? text.length : eol;
    const line = text.slice(offset, lineEnd);
    const trimmed = line.trimStart();
    if (inFence) {
      if (trimmed.startsWith(fenceDelim)) {
        inFence = false;
        fenceDelim = null;
      }
    } else {
      if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
        inFence = true;
        fenceDelim = trimmed.startsWith('```') ? '```' : '~~~';
      } else if (line.startsWith('## ') && !line.startsWith(AUTO_HEADER)) {
        return offset;
      }
    }
    if (eol === -1) break;
    offset = eol + 1;
  }
  return -1;
}

export async function loadTemplate(templatePath) {
  const resolved = templatePath ?? path.resolve(import.meta.dirname, TEMPLATE_REL_PATH);
  return readFile(resolved, 'utf8');
}

export function mergeInvariantsContent({ existing, autoDetected, template }) {
  const freshBody = renderAutoDetectedBlock(autoDetected);

  if (!existing || existing.trim().length === 0) {
    return replaceAutoBlock(template, freshBody, { seeded: true });
  }

  if (!existing.includes(AUTO_HEADER)) {
    const trailing = existing.endsWith('\n') ? '' : '\n';
    const appended = `${existing}${trailing}\n---\n\n${AUTO_HEADER}\n\n${freshBody}\n`;
    return { content: appended, seeded: false, replaced: false, appended: true };
  }

  return replaceAutoBlock(existing, freshBody, { seeded: false });
}

function replaceAutoBlock(source, freshBody, { seeded }) {
  const headerIdx = source.indexOf(AUTO_HEADER);
  if (headerIdx === -1) {
    const trailing = source.endsWith('\n') ? '' : '\n';
    return {
      content: `${source}${trailing}\n${AUTO_HEADER}\n\n${freshBody}\n`,
      seeded,
      replaced: false,
      appended: true,
    };
  }

  const afterHeader = source.slice(headerIdx + AUTO_HEADER.length);
  const nextOffsetRaw = findNextSectionOffset(afterHeader);
  const nextOffset = nextOffsetRaw === -1 ? afterHeader.length : nextOffsetRaw;

  const before = source.slice(0, headerIdx);
  const after = afterHeader.slice(nextOffset);
  const replaced = `${before}${AUTO_HEADER}\n\n${freshBody}\n\n${after.replace(/^\n+/, '')}`;

  return { content: replaced, seeded, replaced: true, appended: false };
}

function renderAutoDetectedBlock(result) {
  const total =
    (result?.danger?.length ?? 0) +
    (result?.critical?.length ?? 0) +
    (result?.state?.length ?? 0) +
    (result?.cross?.length ?? 0);
  if (total === 0) return '_No new detections on this run._';
  return renderInvariants(result).trimEnd();
}

export function collectPointerGlobs(result, limit = 8) {
  const danger = (result?.danger ?? []).map((e) => firstWhere(e)).filter(Boolean);
  const critical = (result?.critical ?? []).map((e) => firstWhere(e)).filter(Boolean);
  return Array.from(new Set([...danger, ...critical])).slice(0, limit);
}

function firstWhere(entry) {
  if (!entry) return null;
  if (Array.isArray(entry.where)) return entry.where[0] ?? null;
  return entry.where ?? null;
}

export async function runOnboardInvariants({ root, dryRun = false, templatePath } = {}) {
  if (!root) throw new Error('root is required');

  const runeDir = path.join(root, '.rune');
  const invariantsPath = path.join(runeDir, 'INVARIANTS.md');
  const claudeMdPath = path.join(root, 'CLAUDE.md');

  const result = await detectInvariants({ root });
  const rendered = renderInvariants(result);
  const template = await loadTemplate(templatePath);

  const existing = existsSync(invariantsPath) ? await readFile(invariantsPath, 'utf8') : '';
  const merged = mergeInvariantsContent({ existing, autoDetected: result, template });

  if (!dryRun) {
    await mkdir(runeDir, { recursive: true });
    await writeFile(invariantsPath, merged.content, 'utf8');
  }

  const globs = collectPointerGlobs(result);
  const pointer = await applyInvariantsPointer({
    claudeMdPath,
    globs,
    invariantsPath: path.relative(root, invariantsPath).replaceAll('\\', '/'),
    dryRun,
  });

  return {
    invariants: {
      path: invariantsPath,
      action: merged.seeded ? 'seeded' : merged.replaced ? 'replaced' : merged.appended ? 'appended' : 'noop',
      stats: result.stats ?? null,
      detected: {
        danger: result.danger?.length ?? 0,
        critical: result.critical?.length ?? 0,
        state: result.state?.length ?? 0,
        cross: result.cross?.length ?? 0,
      },
    },
    claudeMd: {
      path: pointer.path,
      action: pointer.action,
      reason: pointer.reason ?? null,
    },
    rendered,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string' },
      dry: { type: 'boolean', default: false },
    },
  });

  const root = values.root ?? process.cwd();
  const result = await runOnboardInvariants({ root, dryRun: values.dry });
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('onboard-invariants.js')) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
