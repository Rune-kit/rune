#!/usr/bin/env node

/**
 * detect-invariants.js — Scan a project and emit candidate invariant rules
 * for `.rune/INVARIANTS.md`.
 *
 * Detection buckets (ordered by specificity, not confidence):
 *   1. Danger zones     — directories with high churn signals (deep + many files)
 *   2. Critical         — shared constants exported and imported in ≥ 3 places
 *   3. State machines   — reducer shapes, switch(state), enum-driven transitions
 *   4. Cross-file       — duplicated literal tuples (suggests mirrored schemas)
 *
 * Heuristics favor recall over precision for danger zones (let the user prune),
 * precision over recall for critical invariants (don't cry wolf).
 *
 * Usage as CLI:
 *   node detect-invariants.js --root <project-root> [--json]
 *
 * Usage as module:
 *   import { detectInvariants } from './detect-invariants.js';
 *   const rules = await detectInvariants({ root });
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.turbo',
  '.cache',
  '__pycache__',
  '.venv',
  'venv',
  'target',
  '.rune',
]);

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rs']);

/**
 * Files whose presence marks a directory as a first-class artifact (AI skills,
 * extension packs, plugin manifests). These directories become danger-zone
 * candidates even if they contain no SOURCE_EXTS files — a SKILL.md edit can
 * reshape runtime behavior for every consumer.
 */
const SIGNAL_FILES = new Set(['SKILL.md', 'PACK.md', 'plugin.json']);

const MAX_FILES = 2000;
const MAX_FILE_BYTES = 200_000;

/**
 * Main entry — returns structured rule objects.
 *
 * @param {{root: string, maxFiles?: number}} opts
 * @returns {Promise<{danger: Rule[], critical: Rule[], state: Rule[], cross: Rule[], stats: Object}>}
 */
export async function detectInvariants(opts) {
  const { root } = opts;
  const maxFiles = opts.maxFiles ?? MAX_FILES;
  if (!root) throw new Error('detectInvariants: root is required');

  const index = await buildIndex(root, maxFiles);

  const danger = detectDangerZones(index);
  const critical = await detectCriticalConstants(root, index);
  const state = await detectStateMachines(root, index);
  const cross = await detectCrossFileConsistency(root, index);

  return {
    danger,
    critical,
    state,
    cross,
    stats: {
      filesScanned: index.files.length,
      directoriesSeen: index.dirs.size,
      truncated: index.truncated,
    },
  };
}

/**
 * Walk the tree, collecting source files with size + path.
 */
async function buildIndex(root, maxFiles) {
  const files = [];
  const dirs = new Set();
  const signalDirs = new Map(); // rel-dir -> count of signal files
  let truncated = false;

  async function walk(dir, depth) {
    if (files.length >= maxFiles) {
      truncated = true;
      return;
    }
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    dirs.add(path.relative(root, dir) || '.');
    for (const entry of entries) {
      if (files.length >= maxFiles) {
        truncated = true;
        return;
      }
      if (IGNORED_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith('.') && depth === 0) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
      } else if (entry.isFile() && SIGNAL_FILES.has(entry.name)) {
        const relDir = path.relative(root, dir).replace(/\\/g, '/') || '.';
        signalDirs.set(relDir, (signalDirs.get(relDir) || 0) + 1);
      }
      if (entry.isFile() && SOURCE_EXTS.has(path.extname(entry.name))) {
        try {
          const s = await stat(full);
          if (s.size <= MAX_FILE_BYTES) {
            files.push({
              abs: full,
              rel: path.relative(root, full).replace(/\\/g, '/'),
              size: s.size,
            });
          }
        } catch {
          /* skip unreadable */
        }
      }
    }
  }

  await walk(root, 0);
  return { files, dirs, signalDirs, truncated };
}

/**
 * Danger-zone heuristic: directories with ≥ 5 source files AND depth ≥ 2
 * OR directories whose relative path contains high-risk keywords.
 * Sort by file count desc, take top 5.
 */
function detectDangerZones(index) {
  const HIGH_RISK_KEYWORDS = [
    'auth',
    'payment',
    'billing',
    'router',
    'session',
    'security',
    'crypto',
    'migration',
    'compiler',
    'parser',
    'state',
  ];

  const byDir = new Map();
  for (const f of index.files) {
    const dir = path.posix.dirname(f.rel);
    byDir.set(dir, (byDir.get(dir) || 0) + 1);
  }

  // Fold signal-file directories (SKILL.md / PACK.md / plugin.json) into the
  // scoring pool so AI-skill repos surface their orchestrators as danger zones
  // even when the directory contains no SOURCE_EXTS files.
  const signalDirs = index.signalDirs ?? new Map();
  const scored = [];
  const consideredDirs = new Set([...byDir.keys(), ...signalDirs.keys()]);
  for (const dir of consideredDirs) {
    if (dir === '.' || dir === '') continue;
    const count = byDir.get(dir) ?? 0;
    const signalCount = signalDirs.get(dir) ?? 0;
    const depth = dir.split('/').length;
    const keywordHit = HIGH_RISK_KEYWORDS.find((kw) => dir.toLowerCase().includes(kw));
    let score = 0;
    if (count >= 5 && depth >= 2) score += count;
    if (keywordHit) score += 20;
    if (signalCount > 0) score += 15 + signalCount;
    if (score === 0) continue;
    scored.push({ dir, count: count + signalCount, keyword: keywordHit, signal: signalCount > 0, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 5);

  return top.map((s) => {
    const artifactLabel = s.signal ? 'skill / pack artifacts' : 'source files';
    const why = s.keyword
      ? `High-risk keyword "${s.keyword}" in path + ${s.count} ${artifactLabel}. Cross-cutting concerns amplify blast radius.`
      : s.signal
        ? `${s.count} skill/pack artifact(s) under \`${s.dir}/\` — SKILL.md / PACK.md edits reshape runtime behavior for every consumer.`
        : `${s.count} source files in a directory ≥ depth 2 — concentrated surface area.`;
    return {
      section: 'danger',
      title: `${s.dir} — ${s.count} ${artifactLabel}`,
      what: `Changes under \`${s.dir}/\` touch core logic; require tests before merge.`,
      where: [`${s.dir}/**`],
      why,
    };
  });
}

/**
 * Shared constant detection:
 * Find `export const FOO = "literal"` (or UPPER_CASE) in ≤ 50 files,
 * then count imports of FOO across the index. If imported ≥ 3 times, flag it.
 */
async function detectCriticalConstants(_root, index) {
  const CONST_REGEX = /export\s+const\s+([A-Z][A-Z0-9_]+)\s*=\s*(?:['"`]|\d|\{|\[)/g;
  const candidates = new Map(); // name -> { file, value-snippet }
  let examined = 0;

  for (const f of index.files) {
    if (examined >= 50) break;
    if (!/\.(ts|tsx|js|jsx|mjs)$/.test(f.rel)) continue;
    if (f.size > 80_000) continue;
    examined += 1;
    let content;
    try {
      content = await readFile(f.abs, 'utf-8');
    } catch {
      continue;
    }
    let match;
    CONST_REGEX.lastIndex = 0;
    while ((match = CONST_REGEX.exec(content))) {
      const name = match[1];
      if (!candidates.has(name)) {
        candidates.set(name, { file: f.rel, hits: 0 });
      }
    }
  }

  if (candidates.size === 0) return [];

  // Count usages for each candidate across all indexed source files
  const importRegexes = new Map();
  for (const name of candidates.keys()) {
    importRegexes.set(name, new RegExp(`\\b${escapeRegex(name)}\\b`, 'g'));
  }

  let usageScanned = 0;
  for (const f of index.files) {
    if (usageScanned >= 200) break;
    if (!/\.(ts|tsx|js|jsx|mjs)$/.test(f.rel)) continue;
    if (f.size > 80_000) continue;
    usageScanned += 1;
    let content;
    try {
      content = await readFile(f.abs, 'utf-8');
    } catch {
      continue;
    }
    for (const [name, re] of importRegexes) {
      const matches = content.match(re);
      if (matches && matches.length > 0) {
        const c = candidates.get(name);
        if (f.rel !== c.file) c.hits += matches.length;
      }
    }
  }

  const rules = [];
  for (const [name, { file, hits }] of candidates) {
    if (hits < 3) continue;
    rules.push({
      section: 'critical',
      title: `Shared constant ${name}`,
      what: `\`${name}\` (defined in \`${file}\`) is referenced ${hits} times across the codebase. Changing its value affects every consumer.`,
      where: [file, `**/*.{ts,tsx,js,jsx,mjs}`],
      why: `Widely imported constants are effectively part of the project's contract. Renames or value changes must propagate atomically.`,
    });
  }
  rules.sort((a, b) => (b.what.match(/\d+/) || 0) - (a.what.match(/\d+/) || 0));
  return rules.slice(0, 10);
}

/**
 * State-machine detection: files that contain both a state enum/union AND
 * a switch or reducer acting on it. Surface the pair as a single rule.
 */
async function detectStateMachines(_root, index) {
  const rules = [];
  const STATE_HINT = /\b(state|status|phase|stage)\s*[:=]\s*(?:['"])([a-z_]+)(?:['"])/i;
  const SWITCH_HINT = /switch\s*\(\s*(?:\w+\.)?(?:state|status|phase|stage)\s*\)/;
  const REDUCER_HINT = /case\s+['"`][A-Z_][A-Z0-9_]+['"`]\s*:/;

  let scanned = 0;
  for (const f of index.files) {
    if (scanned >= 150) break;
    if (!/\.(ts|tsx|js|jsx|mjs|py)$/.test(f.rel)) continue;
    if (f.size > 80_000) continue;
    scanned += 1;
    let content;
    try {
      content = await readFile(f.abs, 'utf-8');
    } catch {
      continue;
    }

    const hasSwitch = SWITCH_HINT.test(content);
    const hasReducer = REDUCER_HINT.test(content);
    const stateMatch = STATE_HINT.exec(content);
    if (!(hasSwitch || hasReducer) || !stateMatch) continue;

    rules.push({
      section: 'state',
      title: `State machine in ${f.rel}`,
      what: `Transitions in \`${f.rel}\` must respect declared states. New states require updating every switch/case site.`,
      where: [f.rel],
      why: `Detected ${hasSwitch ? 'switch(state)' : 'reducer'} + state literal (e.g. "${stateMatch[2]}"). Missing-case bugs are a classic regression vector.`,
    });
    if (rules.length >= 5) break;
  }
  return rules;
}

/**
 * Cross-file consistency heuristic: find string literal tuples that appear
 * verbatim in ≥ 3 files (e.g. `["pending", "active", "closed"]`). Often these
 * are mirrored schemas/enums that must stay in lock-step.
 */
async function detectCrossFileConsistency(_root, index) {
  const TUPLE_REGEX = /\[\s*(['"][a-z_-]{2,}['"](?:\s*,\s*['"][a-z_-]{2,}['"]){2,})\s*\]/gi;
  const byTuple = new Map();

  let scanned = 0;
  for (const f of index.files) {
    if (scanned >= 150) break;
    if (!/\.(ts|tsx|js|jsx|mjs|py)$/.test(f.rel)) continue;
    if (f.size > 80_000) continue;
    scanned += 1;
    let content;
    try {
      content = await readFile(f.abs, 'utf-8');
    } catch {
      continue;
    }
    const seen = new Set();
    TUPLE_REGEX.lastIndex = 0;
    let match;
    while ((match = TUPLE_REGEX.exec(content))) {
      const normalized = match[1].replace(/\s+/g, '').toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      if (!byTuple.has(normalized)) byTuple.set(normalized, new Set());
      byTuple.get(normalized).add(f.rel);
    }
  }

  const rules = [];
  for (const [tuple, fileSet] of byTuple) {
    if (fileSet.size < 3) continue;
    const sample = tuple.split(',').slice(0, 4).join(', ');
    rules.push({
      section: 'cross',
      title: `Mirrored literal tuple (${sample}${tuple.includes(',') ? '…' : ''})`,
      what: `Identical literal list appears in ${fileSet.size} files; updates must land in every location.`,
      where: Array.from(fileSet).sort().slice(0, 10),
      why: `Duplicated tuples are typically mirrored schemas (DB columns, API fields, state enums). Drift between copies causes subtle bugs.`,
    });
  }
  rules.sort((a, b) => b.where.length - a.where.length);
  return rules.slice(0, 5);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Render a detection result into the markdown block that gets injected under
 * `## Auto-detected (new)` in INVARIANTS.md.
 */
export function renderInvariants(result) {
  const lines = [];
  const sections = [
    ['Danger Zones', result.danger],
    ['Critical Invariants', result.critical],
    ['State Machine Rules', result.state],
    ['Cross-File Consistency', result.cross],
  ];
  for (const [title, rules] of sections) {
    if (!rules || rules.length === 0) continue;
    lines.push(`### ${title}`);
    lines.push('');
    for (const rule of rules) {
      lines.push(`#### ${rule.title}`);
      lines.push(`- **WHAT**: ${rule.what}`);
      lines.push(`- **WHERE**: ${rule.where.map((w) => `\`${w}\``).join(', ')}`);
      lines.push(`- **WHY**: ${rule.why}`);
      lines.push('');
    }
  }
  if (lines.length === 0) return '_No invariants detected in this run._\n';
  return `${lines.join('\n')}`;
}

// ─── CLI ───

async function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string', default: process.cwd() },
      json: { type: 'boolean', default: false },
    },
  });
  const result = await detectInvariants({ root: values.root });
  if (values.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  process.stdout.write(renderInvariants(result));
  process.stdout.write(`\n_Scanned ${result.stats.filesScanned} files._\n`);
}

// Only run main() when invoked directly as a CLI
const isMain = (() => {
  try {
    return import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(path.basename(process.argv[1]));
  } catch {
    return false;
  }
})();
if (isMain) {
  main().catch((err) => {
    process.stderr.write(`detect-invariants: ${err.message}\n`);
    process.exit(1);
  });
}
