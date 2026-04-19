#!/usr/bin/env node

/**
 * load-invariants.js — Parse `.rune/INVARIANTS.md` at session start.
 *
 * Responsibilities:
 *   - Read the file if it exists (silent no-op otherwise).
 *   - Skip the `## Archived` section entirely (rules there are intentionally
 *     retired; including them would re-activate historical noise).
 *   - Extract active rules with WHAT / WHERE / WHY + section label.
 *   - Produce a token-budgeted preview string (≤ ~500 tokens by default) that
 *     session-bridge injects verbatim into the agent's session-start summary.
 *   - Detect staleness: if mtime > 30 days old, flag so session-bridge can warn
 *     once per session.
 *
 * Returned shape:
 *   {
 *     loaded: boolean,
 *     path: string,
 *     stale: boolean,           // mtime > 30 days old
 *     stats: { danger, critical, state, cross, archivedSkipped, total },
 *     rules: Rule[],            // [{ section, title, what, where: string[], why }]
 *     preview: string,          // agent-visible bullet list, capped by budget
 *     overflow: number,         // rules present but NOT in preview (budget overflow)
 *   }
 *
 * Usage as library:
 *   import {
 *     loadInvariants,
 *     matchesInvariant,
 *     findMatchingInvariants,
 *   } from './load-invariants.js';
 *
 *   const result = await loadInvariants({ root, budgetTokens: 500 });
 *   // Blast-radius check (used by logic-guardian, Pro autopilot Step 0.5):
 *   const hits = findMatchingInvariants('skills/cook/foo.js', result.rules);
 *
 * Usage as CLI:
 *   node load-invariants.js --root <project-root> [--json]
 */

import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

const DEFAULT_BUDGET_TOKENS = 500;
const STALE_AGE_DAYS = 30;

/**
 * Rough token estimator. Uses Unicode scalar count (`[...str].length`) rather
 * than `str.length`, because:
 *   - `str.length` in JS = UTF-16 code units → emoji outside the BMP count as 2
 *     (e.g. `🔒`.length === 2) even though tokenizers treat them as ~1 token.
 *   - CJK / Vietnamese text tokenizes closer to 1 char ≈ 1 token, not 1/4 —
 *     scalar count gives a safer lower-bound denominator.
 * Not exact tokenization — just a deterministic ceiling that doesn't drift
 * wildly on non-ASCII content.
 */
function estimateTokens(str) {
  let scalars = 0;
  for (const _ of str) scalars += 1;
  return Math.ceil(scalars / 3);
}

/**
 * Walk `text` line-by-line, tracking triple-backtick / triple-tilde fence
 * state. Yields `{ line, inFence, offset }` for each line. Shared by
 * `stripArchived` and `parseInvariants` so markdown constructs inside fenced
 * code blocks (e.g. a `## Archived` line inside a ```markdown example) never
 * trigger false-positive section breaks or rule headers.
 */
function* walkLines(text) {
  let offset = 0;
  let inFence = false;
  let fenceDelim = null;
  while (offset <= text.length) {
    const eol = text.indexOf('\n', offset);
    const lineEnd = eol === -1 ? text.length : eol;
    const line = text.slice(offset, lineEnd);
    const trimmed = line.trimStart();
    if (inFence) {
      if (trimmed.startsWith(fenceDelim)) {
        inFence = false;
        fenceDelim = null;
      }
      yield { line, inFence: true, offset };
    } else {
      if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
        inFence = true;
        fenceDelim = trimmed.startsWith('```') ? '```' : '~~~';
        yield { line, inFence: true, offset };
      } else {
        yield { line, inFence: false, offset };
      }
    }
    if (eol === -1) break;
    offset = eol + 1;
  }
}

/**
 * Strip the `## Archived` section (and anything below it) from `text`.
 * Archived rules are intentionally retired — loading them would re-surface
 * historical noise. Fence-aware: `## Archived` inside a code block does NOT
 * terminate active rules.
 */
export function stripArchived(text) {
  for (const { line, inFence, offset } of walkLines(text)) {
    if (inFence) continue;
    if (/^## Archived\s*$/.test(line)) {
      return text.slice(0, offset);
    }
  }
  return text;
}

/**
 * Parse an INVARIANTS.md body (with archived already stripped) into rule
 * objects. Walks `### SectionTitle` and `#### RuleTitle` blocks; expects each
 * rule block to carry `- **WHAT**:`, `- **WHERE**:`, `- **WHY**:` lines.
 * Missing lines are tolerated — they become empty strings / empty arrays.
 */
export function parseInvariants(text) {
  const rules = [];
  const SECTION_RE = /^##\s+(Danger Zones|Critical Invariants|State Machine Rules|Cross-File Consistency)\b/;
  const SUBSECTION_RE = /^###\s+(Danger Zones|Critical Invariants|State Machine Rules|Cross-File Consistency)\b/;
  const RULE_HEADER_RE = /^####\s+(.+?)\s*$/;
  const FIELD_RE = /^-\s+\*\*(WHAT|WHERE|WHY)\*\*:\s*(.+)$/;

  let currentSection = null;
  let current = null;

  const flush = () => {
    if (current && current.title) rules.push(current);
    current = null;
  };

  for (const { line: raw, inFence } of walkLines(text)) {
    // Fenced code blocks can legitimately contain text that looks like
    // section headers or field lines (e.g. a markdown example inside a WHY).
    // Ignore them while inside a fence.
    if (inFence) continue;
    const line = raw.trimEnd();
    const sectionMatch = SECTION_RE.exec(line) || SUBSECTION_RE.exec(line);
    if (sectionMatch) {
      flush();
      currentSection = sectionLabelToKey(sectionMatch[1]);
      continue;
    }
    const ruleMatch = RULE_HEADER_RE.exec(line);
    if (ruleMatch && currentSection) {
      flush();
      current = {
        section: currentSection,
        title: ruleMatch[1].trim(),
        what: '',
        where: [],
        why: '',
      };
      continue;
    }
    if (!current) continue;
    const fieldMatch = FIELD_RE.exec(line);
    if (!fieldMatch) continue;
    const [, key, value] = fieldMatch;
    if (key === 'WHAT') current.what = value.trim();
    else if (key === 'WHY') current.why = value.trim();
    else if (key === 'WHERE') current.where = extractGlobs(value);
  }
  flush();
  return rules;
}

function sectionLabelToKey(label) {
  switch (label) {
    case 'Danger Zones':
      return 'danger';
    case 'Critical Invariants':
      return 'critical';
    case 'State Machine Rules':
      return 'state';
    case 'Cross-File Consistency':
      return 'cross';
    default:
      return 'other';
  }
}

/**
 * Convert a minimal glob pattern to a RegExp. Supports the subset of globs
 * seen in INVARIANTS.md `WHERE` entries:
 *   - `**` matches any number of path segments (including zero)
 *   - `*` matches anything except `/`
 *   - `?` matches a single non-`/` character
 *   - All other regex metacharacters are escaped literally
 * Paths are normalized to forward slashes before matching.
 */
function globToRegExp(glob) {
  const normalized = glob.replace(/\\/g, '/');
  let re = '';
  let i = 0;
  while (i < normalized.length) {
    const c = normalized[i];
    if (c === '*' && normalized[i + 1] === '*') {
      // `**/` = zero or more segments
      if (normalized[i + 2] === '/') {
        re += '(?:.*/)?';
        i += 3;
      } else {
        re += '.*';
        i += 2;
      }
    } else if (c === '*') {
      re += '[^/]*';
      i += 1;
    } else if (c === '?') {
      re += '[^/]';
      i += 1;
    } else if ('.+^$()[]{}|\\'.includes(c)) {
      re += `\\${c}`;
      i += 1;
    } else {
      re += c;
      i += 1;
    }
  }
  return new RegExp(`^${re}$`);
}

/**
 * Return true if `filePath` matches any glob in a rule's `where[]`.
 * Normalizes paths to forward slashes first so Windows and POSIX callers get
 * identical results. Consumers (logic-guardian pre-edit gate, autopilot
 * pre-flight gate) use this to decide whether a planned edit touches an
 * invariant-protected path.
 */
export function matchesInvariant(filePath, rule) {
  if (!rule || !Array.isArray(rule.where) || rule.where.length === 0) return false;
  const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  for (const glob of rule.where) {
    if (globToRegExp(glob).test(normalized)) return true;
  }
  return false;
}

/**
 * Return every rule whose WHERE globs match `filePath`. Order preserved from
 * the loaded rules array. Use this when an edit blast radius needs to surface
 * every active invariant that applies.
 */
export function findMatchingInvariants(filePath, rules) {
  return rules.filter((rule) => matchesInvariant(filePath, rule));
}

function extractGlobs(raw) {
  const BACKTICK_RE = /`([^`]+)`/g;
  const globs = [];
  let match;
  BACKTICK_RE.lastIndex = 0;
  while ((match = BACKTICK_RE.exec(raw))) {
    globs.push(match[1].trim());
  }
  // Fallback: if no backticks, split on commas/semicolons.
  if (globs.length === 0) {
    return raw
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return globs;
}

/**
 * Render an agent-visible preview. Caps at ~budgetTokens by dropping tail rules
 * and appending an overflow marker. Priority order: danger → critical → state → cross.
 */
export function renderPreview(rules, { budgetTokens = DEFAULT_BUDGET_TOKENS } = {}) {
  if (rules.length === 0) {
    return { preview: '', overflow: 0 };
  }
  const priority = { danger: 0, critical: 1, state: 2, cross: 3, other: 4 };
  const ordered = [...rules].sort((a, b) => (priority[a.section] ?? 9) - (priority[b.section] ?? 9));

  const ICON = { danger: '⚠', critical: '🔒', state: '🔁', cross: '🔗', other: '•' };
  const header = '📎 Active Invariants (.rune/INVARIANTS.md)';
  const lines = [header];
  let tokens = estimateTokens(header);
  let shown = 0;

  for (const rule of ordered) {
    const icon = ICON[rule.section] ?? '•';
    const wherePreview = rule.where.length > 0 ? rule.where.slice(0, 2).join(', ') : rule.title;
    const line = `${icon}  ${wherePreview} — ${rule.what || rule.title}`;
    const cost = estimateTokens(line);
    if (tokens + cost > budgetTokens) break;
    lines.push(line);
    tokens += cost;
    shown += 1;
  }

  const overflow = ordered.length - shown;
  if (overflow > 0) {
    lines.push(`…+${overflow} more rule${overflow === 1 ? '' : 's'} in .rune/INVARIANTS.md`);
  }
  return { preview: lines.join('\n'), overflow };
}

export async function loadInvariants({ root, budgetTokens = DEFAULT_BUDGET_TOKENS } = {}) {
  if (!root) throw new Error('loadInvariants: root is required');

  const invariantsPath = path.join(root, '.rune', 'INVARIANTS.md');
  const empty = {
    loaded: false,
    count: 0,
    path: invariantsPath,
    stale: false,
    stats: { danger: 0, critical: 0, state: 0, cross: 0, total: 0, archivedSkipped: false },
    rules: [],
    preview: '',
    overflow: 0,
  };
  if (!existsSync(invariantsPath)) return empty;

  let raw;
  try {
    raw = await readFile(invariantsPath, 'utf8');
  } catch {
    return empty;
  }

  const beforeArchive = stripArchived(raw);
  const archivedSkipped = beforeArchive.length !== raw.length;
  const rules = parseInvariants(beforeArchive);

  const stats = {
    danger: rules.filter((r) => r.section === 'danger').length,
    critical: rules.filter((r) => r.section === 'critical').length,
    state: rules.filter((r) => r.section === 'state').length,
    cross: rules.filter((r) => r.section === 'cross').length,
    total: rules.length,
    archivedSkipped,
  };

  let stale = false;
  try {
    const st = await stat(invariantsPath);
    const ageDays = (Date.now() - st.mtimeMs) / (1000 * 60 * 60 * 24);
    stale = ageDays > STALE_AGE_DAYS;
  } catch {
    /* stat failure is non-fatal */
  }

  const { preview, overflow } = renderPreview(rules, { budgetTokens });

  return {
    loaded: rules.length > 0,
    count: rules.length,
    path: invariantsPath,
    stale,
    stats,
    rules,
    preview,
    overflow,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string' },
      json: { type: 'boolean', default: false },
      budget: { type: 'string', default: String(DEFAULT_BUDGET_TOKENS) },
    },
  });
  const root = values.root ?? process.cwd();
  const parsedBudget = Number.parseInt(values.budget, 10);
  const budgetTokens = Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : DEFAULT_BUDGET_TOKENS;
  const result = await loadInvariants({ root, budgetTokens });
  if (values.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (!result.loaded) {
    process.stdout.write('No invariants loaded — .rune/INVARIANTS.md missing or empty.\n');
    return;
  }
  process.stdout.write(`${result.preview}\n`);
  if (result.stale) process.stdout.write('\n⚠ Invariants file is stale (>30 days). Run `rune onboard --refresh`.\n');
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('load-invariants.js')) {
  main().catch((err) => {
    process.stderr.write(`load-invariants: ${err.message}\n`);
    process.exit(1);
  });
}
