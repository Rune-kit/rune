/**
 * Reflect + generated lints.
 *
 * A small rules file (`.rune/lints/rules.json`) is the source of truth.
 * `rune verify --reflect` ingests recurring review findings, dedupes them into
 * that file, appends `.rune/conventions.md`, and upserts a pointer block in
 * AGENTS.md / CLAUDE.md when those files exist. It does not commit.
 *
 * `rune verify --lints` (and hook-dispatch) runs the regex lints against the
 * working tree or a git diff.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { collectGitDiffs, diffsFromEvent, isGitCommitCommand, normalizeRel } from './test-integrity.js';

export const RULES_PATH = join('.rune', 'lints', 'rules.json');
export const CONVENTIONS_PATH = join('.rune', 'conventions.md');
export const FINDINGS_PATH = join('.rune', 'review-findings.jsonl');
export const POINTER_START = '<!-- rune-verify-lints -->';
export const POINTER_END = '<!-- /rune-verify-lints -->';

const WRITE_TOOLS = new Set(['Write', 'Edit', 'edit', 'write', 'str_replace', 'create', 'apply_patch', 'ApplyPatch']);

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.cache', 'vendor']);

export function rulesFile(cwd) {
  return resolve(cwd, RULES_PATH);
}

export function loadRules(cwd) {
  const file = rulesFile(cwd);
  if (!existsSync(file)) return { rules: [], path: file };
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const rules = Array.isArray(raw) ? raw : Array.isArray(raw.rules) ? raw.rules : [];
  return { rules: rules.map(normalizeRule).filter((r) => r.id), path: file };
}

function normalizeRule(rule, index = 0) {
  if (!rule || typeof rule !== 'object') return { id: '', pattern: '' };
  const id = slug(rule.id || rule.title || rule.message || `rule-${index + 1}`);
  return {
    id,
    title: rule.title || rule.id || id,
    pattern: rule.pattern || rule.regex || '',
    message: rule.message || rule.title || rule.id || id,
    files: rule.files || rule.glob || '**/*',
    severity: rule.severity === 'high' || rule.severity === 'error' ? 'high' : 'warn',
    source: rule.source || 'reflect',
    added: rule.added || null,
  };
}

export function slug(text) {
  return (
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'rule'
  );
}

export function loadFindings(input) {
  if (input == null) return [];
  if (Array.isArray(input)) return input.map(normalizeFinding);
  const text = String(input).trim();
  if (!text) return [];
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      return (Array.isArray(parsed) ? parsed : parsed.findings || [parsed]).map(normalizeFinding);
    } catch {
      /* fall through to jsonl / lines */
    }
  }
  const findings = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('{')) {
      try {
        findings.push(normalizeFinding(JSON.parse(trimmed)));
        continue;
      } catch {
        /* treat as a title line */
      }
    }
    findings.push(normalizeFinding({ title: trimmed }));
  }
  return findings;
}

function normalizeFinding(f) {
  if (typeof f === 'string') return normalizeFinding({ title: f });
  const title = f.title || f.message || f.id || 'untitled';
  return {
    id: slug(f.id || title),
    title,
    pattern: f.pattern || f.regex || '',
    message: f.message || title,
    files: f.files || f.glob || '**/*.{js,ts,jsx,tsx,py,go,rs,java}',
    severity: f.severity === 'high' || f.severity === 'error' ? 'high' : 'warn',
    count: Number(f.count) > 0 ? Number(f.count) : 1,
    source: f.source || 'review',
    promote: Boolean(f.promote),
  };
}

export function recurringFindings(findings, { minCount = 2 } = {}) {
  const buckets = new Map();
  for (const f of findings) {
    const key = f.pattern ? `p:${f.pattern}` : `t:${f.id}`;
    if (!buckets.has(key)) buckets.set(key, { ...f, count: 0 });
    const b = buckets.get(key);
    b.count += f.count || 1;
    if (f.promote) b.promote = true;
    if ((f.severity || 'warn') === 'high') b.severity = 'high';
  }
  return [...buckets.values()].filter((f) => f.promote || f.count >= minCount);
}

export function mergeRules(existing, incoming, { today } = {}) {
  const date = today || new Date().toISOString().slice(0, 10);
  const rules = existing.map(normalizeRule);
  const added = [];
  for (const f of incoming) {
    const next = normalizeRule({
      id: f.id,
      title: f.title,
      pattern: f.pattern,
      message: f.message,
      files: f.files,
      severity: f.severity,
      source: f.source || 'reflect',
      added: date,
    });
    const idx = rules.findIndex((r) => r.id === next.id || (next.pattern && r.pattern === next.pattern));
    if (idx >= 0) {
      const cur = rules[idx];
      rules[idx] = {
        ...cur,
        ...next,
        added: cur.added || date,
        message: next.message || cur.message,
        pattern: next.pattern || cur.pattern,
      };
    } else {
      rules.push(next);
      added.push(next);
    }
  }
  return { rules, added };
}

const POINTER_BODY = `${POINTER_START}
## Project lint rules (Rune)

This project records recurring review findings in \`.rune/lints/rules.json\` and \`.rune/conventions.md\`. Run \`rune verify --lints\` (also part of \`rune verify --reflect\`). Preflight and commit hooks run the same checks. Do not weaken or delete a rule without human approval.
${POINTER_END}`;

export function upsertPointer(content) {
  const text = content == null ? '' : String(content);
  if (text.includes(POINTER_START) && text.includes(POINTER_END)) {
    return text.replace(new RegExp(`${POINTER_START}[\\s\\S]*?${POINTER_END}`), POINTER_BODY.trim());
  }
  if (!text.trim()) return `${POINTER_BODY.trim()}\n`;
  return `${text.replace(/\s*$/, '\n\n')}${POINTER_BODY.trim()}\n`;
}

export function appendConvention(existing, rules, { today } = {}) {
  const date = today || new Date().toISOString().slice(0, 10);
  let text = existing?.trim() ? existing.replace(/\s*$/, '\n') : '# Conventions\n';
  const added = [];
  for (const r of rules) {
    const heading = `## ${date} — ${r.title}`;
    if (text.includes(`— ${r.title}`) || text.includes(heading)) continue;
    text += `\n${heading}\n\n${r.message}\n`;
    if (r.pattern) text += `\nGenerated lint: \`${r.id}\` (\`${r.pattern}\`) — run \`rune verify --lints\`.\n`;
    text += `\n_Recorded by \`rune verify --reflect\`._\n`;
    added.push(r.id);
  }
  if (!text.endsWith('\n')) text += '\n';
  return { text, added };
}

function walkFiles(root, { maxFiles = 4000 } = {}) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (ent.name.startsWith('.') && ent.name !== '.rune') continue;
      if (SKIP_DIRS.has(ent.name)) continue;
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        stack.push(full);
      } else if (ent.isFile()) {
        out.push(full);
        if (out.length >= maxFiles) return out;
      }
    }
  }
  return out;
}

export function expandBraces(pattern) {
  const src = String(pattern);
  const m = src.match(/\{([^{}]+)\}/);
  if (!m) return [src];
  return m[1].split(',').flatMap((part) => expandBraces(src.replace(m[0], part.trim())));
}

function splitCommaGlobs(pattern) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of String(pattern)) {
    if (ch === '{') depth += 1;
    else if (ch === '}') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function matchFilesGlob(rel, pattern) {
  if (!pattern || pattern === '**/*' || pattern === '*') return true;
  const pats = splitCommaGlobs(pattern).flatMap(expandBraces);
  return pats.some((p) => matchOneGlob(rel, p));
}

function matchOneGlob(rel, pattern) {
  const norm = rel.split(sep).join('/');
  const src = pattern.replace(/^\.\//, '');
  // Swap ** first so a following * cannot eat the placeholder.
  const regex = `^${src
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}\/?/g, '(?:.*/)?')}$`;
  try {
    return new RegExp(regex).test(norm);
  } catch {
    return false;
  }
}

function compilePattern(pattern) {
  if (!pattern) return null;
  try {
    return new RegExp(pattern);
  } catch {
    try {
      return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    } catch {
      return null;
    }
  }
}

export function lintFile(rel, content, rules) {
  const findings = [];
  const lines = String(content || '').split('\n');
  for (const rule of rules) {
    if (!rule.pattern || !matchFilesGlob(rel, rule.files)) continue;
    const re = compilePattern(rule.pattern);
    if (!re) continue;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) continue;
      const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
      const global = new RegExp(re.source, flags);
      if (global.test(line)) {
        findings.push({
          file: rel,
          line: i + 1,
          rule: rule.id,
          severity: rule.severity || 'warn',
          message: rule.message,
          after: line.trim().slice(0, 160),
          before: '',
        });
      }
    }
  }
  return findings;
}

export function runLints(cwd, { diffs, rules, staged, base } = {}) {
  const loaded = rules ? { rules: rules.map(normalizeRule) } : loadRules(cwd);
  if (!loaded.rules.length) {
    return { findings: [], high: [], warn: [], blocked: false, rules: 0, files: 0 };
  }
  let targets;
  if (diffs) {
    targets = diffs.map((d) => ({
      file: normalizeRel(d.file || d.path || '', cwd),
      content: d.after ?? d.next ?? '',
    }));
  } else if (staged || base) {
    targets = collectGitDiffs(cwd, { staged, base }).map((d) => ({
      file: normalizeRel(d.file, cwd),
      content: d.after ?? '',
    }));
  } else {
    const root = resolve(cwd);
    targets = walkFiles(root)
      .map((full) => ({
        file: relative(root, full).split(sep).join('/'),
        content: readFileIfText(full),
      }))
      .filter((t) => t.content != null);
  }

  const findings = [];
  let files = 0;
  for (const t of targets) {
    if (t.content == null) continue;
    files += 1;
    findings.push(...lintFile(t.file, t.content, loaded.rules));
  }
  const high = findings.filter((f) => f.severity === 'high');
  const warn = findings.filter((f) => f.severity !== 'high');
  return { findings, high, warn, blocked: high.length > 0, rules: loaded.rules.length, files };
}

function readFileIfText(full) {
  try {
    const st = statSync(full);
    if (st.size > 1_000_000) return null;
    const buf = readFileSync(full);
    if (buf.includes(0)) return null;
    return buf.toString('utf8');
  } catch {
    return null;
  }
}

export function formatLintsReport(result, { json = false } = {}) {
  if (json) {
    return `${JSON.stringify({ findings: result.findings, high: result.high.length, warn: result.warn.length, blocked: result.blocked, rules: result.rules, files: result.files }, null, 2)}\n`;
  }
  if (!result.rules) {
    return 'lints: no rules file (create one with `rune verify --reflect` or add `.rune/lints/rules.json`).\n';
  }
  if (!result.findings.length) {
    return `lints: clean — ${result.rules} rule(s) applied to ${result.files} file(s).\n`;
  }
  const lines = [
    `lints: ${result.high.length} high, ${result.warn.length} warn  (${result.rules} rules, ${result.files} files)${result.blocked ? '  (exit 2)' : ''}`,
    '',
  ];
  for (const f of result.findings) {
    const tag = (f.severity === 'high' ? 'HIGH' : 'WARN').padEnd(4);
    lines.push(`${tag}  ${f.rule.padEnd(22)} ${f.file}:${f.line}`);
    if (f.message) lines.push(`      ${f.message}`);
    if (f.after) lines.push(`      ${f.after}`);
  }
  if (result.blocked) {
    lines.push('');
    lines.push(
      'A generated project lint failed. Fix the code, or get human approval before changing `.rune/lints/rules.json`.',
    );
  }
  return `${lines.join('\n')}\n`;
}

export function runLintsForEvent(event, cwd) {
  try {
    if (!existsSync(rulesFile(cwd))) return { status: 0, stdout: '', stderr: '' };
    const tool = event?.tool_name || '';
    const input = event?.tool_input && typeof event.tool_input === 'object' ? event.tool_input : {};
    const command = input.command || event.command || '';
    let diffs = [];
    if (isGitCommitCommand(command)) {
      diffs = collectGitDiffs(cwd, { staged: true });
    } else if (
      WRITE_TOOLS.has(tool) ||
      (tool && tool !== 'Read' && tool !== 'Bash' && (input.file_path || input.path))
    ) {
      diffs = diffsFromEvent(event, cwd);
    } else {
      return { status: 0, stdout: '', stderr: '' };
    }
    if (!diffs.length) return { status: 0, stdout: '', stderr: '' };
    const result = runLints(cwd, { diffs });
    if (!result.findings.length) return { status: 0, stdout: '', stderr: '', result };
    const message = formatLintsHookMessage(result);
    if (result.blocked) {
      return {
        status: 2,
        stdout: `${JSON.stringify({ systemMessage: message, hookSpecificOutput: { hookEventName: 'PreToolUse' } })}\n`,
        stderr: `${message}\n`,
        result,
      };
    }
    return { status: 0, stdout: `${JSON.stringify({ systemMessage: message })}\n`, stderr: '', result };
  } catch (err) {
    return { status: null, stdout: '', stderr: '', error: err.message };
  }
}

export function formatLintsHookMessage(result) {
  const head = result.blocked ? 'BLOCKED' : 'WARNING';
  const lines = [`[Rune lints] ${head}: ${result.findings.map((f) => f.rule).join(', ')}`];
  for (const f of result.findings.slice(0, 12)) {
    lines.push(`  - ${f.rule}: ${f.file}:${f.line}  ${f.message || f.after || ''}`);
  }
  if (result.blocked) {
    lines.push('Fix the code to satisfy `.rune/lints/rules.json`, or get human approval before changing the rule.');
  }
  return lines.join('\n');
}

function readMaybe(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

/**
 * Ingest findings, write rules + conventions + pointers, then run the lints.
 * Never commits. Returns the files that were written (for the user to stage).
 */
export function runReflect(cwd, options = {}) {
  const today = options.today || new Date().toISOString().slice(0, 10);
  let rawFindings = options.findings;
  if (rawFindings == null) {
    const from = options.findingsPath ? resolve(cwd, options.findingsPath) : resolve(cwd, FINDINGS_PATH);
    if (existsSync(from)) rawFindings = readFileSync(from, 'utf8');
    else rawFindings = '';
  } else if (typeof rawFindings !== 'string' && !Array.isArray(rawFindings)) {
    rawFindings = JSON.stringify(rawFindings);
  }

  const parsed = loadFindings(rawFindings);
  const incoming = recurringFindings(parsed, { minCount: options.minCount ?? 2 });
  const existing = loadRules(cwd);
  const merged = mergeRules(existing.rules, incoming, { today });

  const written = [];
  const dir = dirname(rulesFile(cwd));
  mkdirSync(dir, { recursive: true });
  const readme = join(dir, 'README.md');
  const bundle = {
    version: 1,
    updated: today,
    rules: merged.rules,
  };
  writeFileSync(rulesFile(cwd), `${JSON.stringify(bundle, null, 2)}\n`);
  written.push(relative(cwd, rulesFile(cwd)).split(sep).join('/') || RULES_PATH);
  if (!existsSync(readme)) {
    writeFileSync(
      readme,
      '# Generated project lints\n\n`rules.json` is the source of truth. Run `rune verify --lints` or `rune verify --reflect`. Hooks run the same checks on edit and commit. Do not auto-commit these files — stage them for a human to review.\n',
    );
    written.push(relative(cwd, readme).split(sep).join('/'));
  }

  const conventionsFile = resolve(cwd, CONVENTIONS_PATH);
  mkdirSync(dirname(conventionsFile), { recursive: true });
  const conv = appendConvention(readMaybe(conventionsFile), incoming.length ? incoming : merged.added, { today });
  if (conv.added.length || !existsSync(conventionsFile)) {
    writeFileSync(conventionsFile, conv.text);
    written.push(CONVENTIONS_PATH.split(sep).join('/'));
  }

  const pointers = [];
  for (const name of ['AGENTS.md', 'CLAUDE.md']) {
    const file = resolve(cwd, name);
    if (!existsSync(file)) continue;
    const next = upsertPointer(readFileSync(file, 'utf8'));
    if (next !== readFileSync(file, 'utf8')) {
      writeFileSync(file, next);
      pointers.push(name);
      written.push(name);
    }
  }

  const linted = runLints(cwd, { staged: options.staged, base: options.base, rules: merged.rules });
  return {
    ...linted,
    promoted: incoming.length,
    addedRules: merged.added.map((r) => r.id),
    written,
    pointers,
    incoming,
  };
}

export function formatReflectReport(result, { json = false } = {}) {
  if (json) {
    return `${JSON.stringify({ promoted: result.promoted, addedRules: result.addedRules, written: result.written, pointers: result.pointers, findings: result.findings, high: result.high.length, warn: result.warn.length }, null, 2)}\n`;
  }
  const lines = [];
  lines.push(
    `reflect: promoted ${result.promoted} recurring finding(s); ${result.addedRules.length} new rule(s); ${result.rules} rule(s) total.`,
  );
  if (result.written?.length) {
    lines.push(`Wrote (stage these — nothing was committed): ${result.written.join(', ')}`);
  }
  if (result.pointers?.length) lines.push(`Pointer block updated in ${result.pointers.join(', ')}.`);
  if (!result.promoted && !result.addedRules.length) {
    lines.push('No new recurring findings (need count ≥ 2, or `"promote": true`). Existing rules still ran.');
  }
  lines.push('');
  lines.push(formatLintsReport(result).trimEnd());
  return `${lines.join('\n')}\n`;
}
