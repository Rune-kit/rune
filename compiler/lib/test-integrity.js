/**
 * Test-integrity analyzer.
 *
 * Compares before/after text of test (and snapshot) files and flags
 * assertion weakening, skipped cases, snapshot/expected-literal drift,
 * deleted tests, mocks that replace real calls, and edits to frozen paths
 * (tests/char/**, tests/holdout/** by default).
 *
 * Pure library — no process.exit. CLI (`rune verify --integrity`) and
 * hook-dispatch (preflight Edit/Write, sentinel git commit) both call this.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const RULES = Object.freeze({
  ASSERT_REMOVED: 'assert-removed',
  ASSERT_COMMENTED: 'assert-commented',
  MATCHER_LOOSENED: 'matcher-loosened',
  SKIP_ADDED: 'skip-added',
  ONLY_ADDED: 'only-added',
  XFAIL_ADDED: 'xfail-added',
  TODO_ADDED: 'todo-added',
  SNAPSHOT_UPDATED: 'snapshot-updated',
  EXPECTED_CHANGED: 'expected-changed',
  TEST_DELETED: 'test-deleted',
  ASSERT_COUNT_DROP: 'assert-count-drop',
  MOCK_REPLACED_REAL: 'mock-replaced-real',
  FROZEN_PATH: 'frozen-path',
});

/** Findings that BLOCK under the strict hook preset (unless overridden). */
export const HIGH_RULES = Object.freeze(
  new Set([RULES.ASSERT_REMOVED, RULES.SKIP_ADDED, RULES.EXPECTED_CHANGED, RULES.FROZEN_PATH]),
);

export const DEFAULT_FROZEN_PATHS = Object.freeze(['tests/char/**', 'tests/holdout/**']);

export const OVERRIDE_ENV = 'RUNE_TEST_CHANGE_APPROVED';
export const OVERRIDE_TRAILER = 'Test-Change-Approved';

const MAX_FILE_BYTES = 1_000_000;

// ── Path helpers ────────────────────────────────────────────────────────────

export function normalizeRel(filePath, cwd = '') {
  if (!filePath) return '';
  let p = String(filePath).replace(/\\/g, '/');
  if (cwd) {
    const root = path.resolve(cwd).replace(/\\/g, '/');
    const abs = path.resolve(cwd, filePath).replace(/\\/g, '/');
    if (abs === root) p = '';
    else if (abs.startsWith(`${root}/`)) p = abs.slice(root.length + 1);
  }
  return p.replace(/^\.\//, '');
}

export function matchGlob(relPath, pattern) {
  const p = normalizeRel(relPath);
  const g = String(pattern || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
  if (!g) return false;
  const star = '{{GLOBSTAR}}';
  const esc = g
    .replace(/[.+^{}$()|[\]]/g, '\\$&')
    .replace(/\*\*/g, star)
    .replace(/\*/g, '[^/]*')
    .replaceAll(star, '.*');
  return new RegExp(`^${esc}$`).test(p);
}

export function isSnapshotFile(filePath) {
  const p = normalizeRel(filePath);
  return /(^|\/)__snapshots__\//.test(p) || /\.(snap|snapshot|ambr)$/i.test(p);
}

export function isTestFile(filePath) {
  const p = normalizeRel(filePath);
  if (!p) return false;
  if (isSnapshotFile(p)) return true;
  if (/\.(test|spec)\.[cm]?[jt]sx?$/i.test(p)) return true;
  if (/_test\.go$/i.test(p) || /_test\.rs$/i.test(p)) return true;
  if (/(^|\/)test_[^/]+\.py$/i.test(p) || /_test\.py$/i.test(p)) return true;
  if (/(^|\/)tests?\/.+\.py$/i.test(p)) return true;
  if (/(^|\/)src\/test\//i.test(p)) return true;
  if (/Test(s|Case)?\.java$/i.test(p)) return true;
  if (/(^|\/)(__tests__|tests)\//i.test(p) && /\.([cm]?[jt]sx?|py|go|rs|java)$/i.test(p)) return true;
  return false;
}

export function detectLanguage(filePath) {
  const p = normalizeRel(filePath);
  if (/\.py$/i.test(p)) return 'python';
  if (/\.go$/i.test(p)) return 'go';
  if (/\.rs$/i.test(p)) return 'rust';
  if (/\.java$/i.test(p)) return 'java';
  return 'js';
}

// ── Config ──────────────────────────────────────────────────────────────────

export function loadIntegrityConfig(cwd) {
  const config = {
    frozenPaths: [...DEFAULT_FROZEN_PATHS],
    disabledRules: [],
  };
  const files = [path.join(cwd, '.rune', 'test-integrity.json'), path.join(cwd, '.rune', 'config.json')];
  for (const file of files) {
    if (!existsSync(file)) continue;
    try {
      const raw = JSON.parse(readFileSync(file, 'utf-8'));
      const body = file.endsWith('config.json') ? raw.testIntegrity || raw['test-integrity'] || {} : raw;
      if (Array.isArray(body.frozenPaths)) config.frozenPaths = body.frozenPaths.map(String);
      if (Array.isArray(body.disabledRules)) config.disabledRules = body.disabledRules.map(String);
      break;
    } catch {
      // Malformed config is ignored — fail open rather than wedging the hook.
    }
  }
  return config;
}

export function isFrozenPath(filePath, config, cwd = '') {
  const rel = normalizeRel(filePath, cwd);
  const paths = config?.frozenPaths || DEFAULT_FROZEN_PATHS;
  return paths.some((g) => matchGlob(rel, g));
}

// ── Override ────────────────────────────────────────────────────────────────

function nonEmptyReason(value) {
  const s = String(value || '').trim();
  return s.length >= 3 ? s : '';
}

/** Pull `Test-Change-Approved: <reason>` from a commit message body. */
export function parseTrailerReason(text) {
  if (!text) return '';
  const re = new RegExp(`^${OVERRIDE_TRAILER}\\s*:\\s*(.+)$`, 'im');
  const m = String(text).match(re);
  return m ? nonEmptyReason(m[1]) : '';
}

/**
 * Best-effort extract of the message an agent is about to commit, from a
 * `git commit …` command line (PreToolUse happens before the commit exists).
 */
export function extractCommitMessage(command, cwd = process.cwd()) {
  if (!command) return '';
  const parts = [];
  // Walk tokens instead of a fragile regex for quotes.
  const tokens = tokenizeShell(command);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '-m' || t === '--message' || t === '--trailer') {
      if (tokens[i + 1]) parts.push(tokens[++i]);
    } else if (t.startsWith('-m=') || t.startsWith('--message=') || t.startsWith('--trailer=')) {
      parts.push(t.slice(t.indexOf('=') + 1));
    } else if (t === '-F' || t === '--file') {
      const file = tokens[++i];
      if (file) {
        try {
          const abs = path.resolve(cwd, file);
          parts.push(readFileSync(abs, 'utf-8'));
        } catch {
          /* ignore unreadable -F */
        }
      }
    }
  }
  return parts.join('\n\n');
}

function tokenizeShell(command) {
  const out = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote) {
      if (c === '\\' && quote === '"' && i + 1 < command.length) {
        cur += command[++i];
      } else if (c === quote) {
        quote = null;
      } else {
        cur += c;
      }
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      continue;
    }
    if (/\s/.test(c)) {
      if (cur) out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur) out.push(cur);
  return out;
}

export function resolveOverride({ env = process.env, commitMessage = '', command = '', cwd } = {}) {
  const fromEnv = nonEmptyReason(env?.[OVERRIDE_ENV]);
  if (fromEnv) return { source: 'env', reason: fromEnv };
  const msg = commitMessage || extractCommitMessage(command, cwd);
  const fromTrailer = parseTrailerReason(msg);
  if (fromTrailer) return { source: 'trailer', reason: fromTrailer };
  return null;
}

// ── Comment / line utilities ────────────────────────────────────────────────

function stripLineComment(line, lang) {
  if (lang === 'python') {
    // Keep `#` inside strings at a shallow level: if an odd number of quotes
    // precedes the hash, it's inside a string.
    let inStr = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inStr) {
        if (c === '\\') {
          i++;
          continue;
        }
        if (c === inStr) inStr = null;
        continue;
      }
      if (c === "'" || c === '"') {
        inStr = c;
        continue;
      }
      if (c === '#') return line.slice(0, i);
    }
    return line;
  }
  let inStr = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const n = line[i + 1];
    if (inStr) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      inStr = c;
      continue;
    }
    if (c === '/' && n === '/') return line.slice(0, i);
  }
  return line;
}

function stripBlockComments(text, lang) {
  if (lang === 'python') return text;
  return text.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));
}

function isCommentLine(line, lang) {
  const t = line.trim();
  if (!t) return false;
  if (lang === 'python') return t.startsWith('#');
  return t.startsWith('//') || t.startsWith('/*') || t.startsWith('*');
}

function uncommentLine(line, lang) {
  let t = line.trim();
  if (lang === 'python') return t.replace(/^#\s?/, '');
  t = t.replace(/^\/\/\s?/, '');
  t = t.replace(/^\/\*\s?/, '').replace(/\s*\*\/$/, '');
  t = t.replace(/^\*\s?/, '');
  return t;
}

// ── Patterns per language ───────────────────────────────────────────────────

const ASSERT_LINE = {
  js: /\b(expect\s*\(|assert(?:\s*\.|\s*\()|should\s*\()/,
  python: /(?:^|\s)(?:assert\s+|self\.assert\w+\s*\(|pytest\.raises\s*\()/,
  go: /\b(?:(?:require|assert)\.\w+\s*\(|t\.(?:Error|Errorf|Fatal|Fatalf|FailNow|Fail|Helper)\s*\()/,
  rust: /\b(?:assert(?:_eq|_ne|_matches)?!)/,
  java: /\b(?:assert(?:Equals|NotEquals|True|False|That|Same|NotSame|Null|NotNull|ArrayEquals|Throws|DoesNotThrow)\s*\(|Assertions\.\w+\s*\(|assertThat\s*\()/,
};

const SKIP_PATTERNS = {
  js: [
    { re: /\b(?:it|test|describe|suite|context)\.skip\b/, kind: 'skip' },
    { re: /\b(?:xit|xtest|xdescribe)\s*\(/, kind: 'skip' },
    { re: /\b(?:it|test|describe|suite)\.only\b/, kind: 'only' },
    { re: /\b(?:it|test)\.todo\b/, kind: 'todo' },
  ],
  python: [
    { re: /@pytest\.mark\.skip(?:if)?\b/, kind: 'skip' },
    { re: /@unittest\.skip(?:If|Unless)?\b/, kind: 'skip' },
    { re: /(?:pytest|unittest)\.skip\s*\(/, kind: 'skip' },
    { re: /@pytest\.mark\.xfail\b/, kind: 'xfail' },
    { re: /@pytest\.mark\.(?:only|run)\b/, kind: 'only' },
  ],
  go: [{ re: /\bt\.(?:Skip|Skipf|SkipNow)\s*\(/, kind: 'skip' }],
  rust: [{ re: /#\[ignore(?:\s*\(.*\))?\s*\]/, kind: 'skip' }],
  java: [
    { re: /@Disabled\b/, kind: 'skip' },
    { re: /@Ignored?\b/, kind: 'skip' },
    { re: /@DisabledIf\b/, kind: 'skip' },
  ],
};

const MOCK_PATTERNS = [
  { re: /\b(?:jest|vi)\.mock\(\s*(['"`])([^'"`]+)\1/, group: 2 },
  { re: /\b(?:jest|vi)\.spyOn\s*\(/, group: 0 },
  { re: /@patch\(\s*(['"`])([^'"`]+)\1/, group: 2 },
  { re: /\b(?:mock\.patch|unittest\.mock\.patch|monkeypatch\.setattr)\s*\(/, group: 0 },
  { re: /\bmockito\.(?:mock|when|doReturn)\s*\(/i, group: 0 },
  { re: /@Mock\b/, group: 0 },
  { re: /\bmockall::|mock!\s*\(/, group: 0 },
];

// Matcher strength: higher = stricter. A drop is a loosening.
const JS_MATCHER_LEVEL = {
  tostrictequal: 5,
  toequal: 4,
  tobe: 4,
  tomatchobject: 3,
  tomatch: 2,
  tocontain: 2,
  tocontainequal: 2,
  tohaveproperty: 2,
  tohavelength: 2,
  tobecloseto: 3,
  tobetruthy: 1,
  tobefalsy: 1,
  tobedefined: 1,
  tobeundefined: 1,
  tobenull: 1,
  tobenan: 1,
  tobeok: 1,
};

const MATCHER_ALIASES = [
  // language-agnostic loosening pairs (from → to). Used when a same-test
  // assertion swaps a strict matcher for a looser one.
  ['tostrictequal', 'toequal'],
  ['tostrictequal', 'tomatchobject'],
  ['toequal', 'tomatchobject'],
  ['toequal', 'tocontain'],
  ['tobe', 'tocontain'],
  ['toequal', 'tomatch'],
  ['tobe', 'tobetruthy'],
  ['toequal', 'tobetruthy'],
  ['tostrictequal', 'tobetruthy'],
  ['tobe', 'tobedefined'],
  ['toequal', 'tobedefined'],
  ['assertstrictequal', 'assertok'],
  ['assertdeepequal', 'assertok'],
  ['assertequal', 'assertok'],
  ['assertequal', 'asserttrue'],
  ['assertdeepequal', 'asserttrue'],
  ['assert_eq', 'assert'],
  ['assert_ne', 'assert'],
  ['assertequals', 'asserttrue'],
  ['assertarrayequals', 'asserttrue'],
  ['require.equal', 'require.true'],
  ['assert.equal', 'assert.true'],
  ['assert.equalf', 'assert.true'],
];

const TEST_NAME_RE = {
  js: /\b(?:it|test|describe|specify)\s*(?:\.(?:only|skip|todo|failing))?\s*\(\s*(['"`])([\s\S]*?)\1/g,
  python: /^\s*(?:async\s+)?def\s+(test_\w+)/gm,
  go: /^\s*func\s+(Test\w+)\s*\(/gm,
  rust: /#\[test\][\s\S]{0,80}?\bfn\s+(\w+)/g,
  java: /@(?:Test|ParameterizedTest|RepeatedTest)\b[\s\S]{0,200}?\b(?:void|public|private|protected|\s)+(\w+)\s*\(/g,
};

function matcherKey(token) {
  return String(token || '')
    .replace(/[()!]/g, '')
    .replace(/([a-z])([A-Z])/g, '$1$2')
    .toLowerCase()
    .replace(/_/g, '');
}

function jsMatcherLevel(name) {
  return JS_MATCHER_LEVEL[matcherKey(name)] ?? null;
}

// ── Parse a test file into structured facts ─────────────────────────────────

function parseTestFile(text, lang, file) {
  const raw = text ?? '';
  const stripped = stripBlockComments(raw, lang);
  const lines = stripped.split('\n');
  const asserts = [];
  const skips = [];
  const mocks = [];
  const tests = [];
  const imports = new Set();

  for (const m of raw.matchAll(TEST_NAME_RE[lang] || TEST_NAME_RE.js)) {
    const name = m[2] || m[1];
    if (name) tests.push({ name, index: m.index });
  }

  for (const m of raw.matchAll(/(?:^|\n)\s*(?:import|from|require\s*\()\s*['"]([^'"]+)['"]/g)) {
    imports.add(m[1]);
  }
  for (const m of raw.matchAll(/^\s*(?:from|import)\s+([\w.]+)/gm)) {
    imports.add(m[1]);
  }

  for (let i = 0; i < lines.length; i++) {
    const original = (raw.split('\n')[i] ?? lines[i]).trimEnd();
    const code = stripLineComment(lines[i], lang);
    const trimmed = code.trim();
    const commented = isCommentLine(original, lang) ? uncommentLine(original, lang) : '';

    const inspect = (src, commentedOut) => {
      if (!src) return;
      if (ASSERT_LINE[lang]?.test(src) || ASSERT_LINE.js.test(src)) {
        asserts.push({
          line: i + 1,
          text: src.trim(),
          commented: Boolean(commentedOut),
          file,
          ...describeAssert(src.trim(), lang),
        });
      }
      for (const { re, kind } of SKIP_PATTERNS[lang] || []) {
        if (re.test(src)) skips.push({ line: i + 1, kind, text: src.trim(), file });
      }
      for (const { re, group } of MOCK_PATTERNS) {
        const m = src.match(re);
        if (m) mocks.push({ line: i + 1, target: m[group] || m[0], text: src.trim(), file });
      }
    };

    inspect(trimmed, false);
    if (commented) inspect(commented, true);
  }

  return { asserts, skips, mocks, tests, imports, raw };
}

function describeAssert(text, lang) {
  const info = { matcher: null, expected: null, actual: null, tolerance: null, level: null };

  if (lang === 'js' || lang === 'javascript' || lang === 'typescript' || !lang) {
    const chain = text.match(/expect\s*\(([\s\S]+?)\)\s*\.([A-Za-z]+)\s*\(([\s\S]*)\)\s*;?$/);
    if (chain) {
      info.actual = chain[1].trim();
      info.matcher = chain[2];
      info.expected = splitFirstArg(chain[3]);
      info.level = jsMatcherLevel(chain[2]);
      if (matcherKey(chain[2]) === 'tobecloseto') {
        const args = splitArgs(chain[3]);
        info.expected = args[0] || info.expected;
        info.tolerance = args[1] != null ? Number(args[1]) : 2;
      }
    } else {
      const node = text.match(/assert\s*\.(\w+)\s*\(([\s\S]*)\)\s*;?$/);
      if (node) {
        info.matcher = `assert.${node[1]}`;
        const args = splitArgs(node[2]);
        // assert.equal(actual, expected) / assert.ok(value)
        if (args.length >= 2) {
          info.actual = args[0];
          info.expected = args[1];
        } else {
          info.actual = args[0];
        }
        const k = matcherKey(node[1]);
        info.level =
          k === 'ok' || k === 'istrue' || k === 'isfalse'
            ? 1
            : k.includes('strict') || k.includes('deep') || k === 'equal'
              ? 4
              : 2;
      }
    }
  }

  if (lang === 'python') {
    const meth = text.match(/self\.assert(\w+)\s*\(([\s\S]*)\)\s*$/);
    if (meth) {
      info.matcher = `assert${meth[1]}`;
      const args = splitArgs(meth[2]);
      info.actual = args[0];
      info.expected = args[1] ?? null;
      const k = meth[1].toLowerCase();
      info.level = k === 'true' || k === 'false' ? 1 : k === 'in' || k === 'regex' ? 2 : k.includes('almost') ? 3 : 4;
      if (k.includes('almost')) {
        const places = meth[2].match(/places\s*=\s*(\d+)/) || args[2];
        const delta = meth[2].match(/delta\s*=\s*([0-9.eE+-]+)/);
        info.tolerance = places ? Number(Array.isArray(places) ? places[1] : places) : delta ? Number(delta[1]) : null;
      }
    } else {
      const bare = text.match(/^assert\s+([\s\S]+)$/);
      if (bare) {
        const eq = bare[1].match(/^([\s\S]+?)\s*==\s*([\s\S]+)$/);
        const inn = bare[1].match(/^([\s\S]+?)\s+in\s+([\s\S]+)$/);
        if (eq) {
          info.matcher = 'assert==';
          info.actual = eq[1].trim();
          info.expected = eq[2].trim();
          info.level = 4;
        } else if (inn) {
          info.matcher = 'assert-in';
          info.actual = inn[2].trim();
          info.expected = inn[1].trim();
          info.level = 2;
        } else {
          info.matcher = 'assert';
          info.actual = bare[1].trim();
          info.level = 1;
        }
        const approx = bare[1].match(/approx\s*\(([\s\S]*?)\)/);
        if (approx) {
          const rel = approx[1].match(/rel\s*=\s*([0-9.eE+-]+)/);
          const abs = approx[1].match(/abs\s*=\s*([0-9.eE+-]+)/);
          info.tolerance = rel ? Number(rel[1]) : abs ? Number(abs[1]) : null;
          info.level = 3;
        }
      }
    }
  }

  if (lang === 'go') {
    const m = text.match(/\b((?:require|assert)\.(\w+))\s*\(([\s\S]*)\)\s*$/);
    if (m) {
      info.matcher = m[1];
      const args = splitArgs(m[3]);
      // testify: Equal(t, expected, actual)
      info.expected = args[1];
      info.actual = args[2] ?? args[1];
      const k = m[2].toLowerCase();
      info.level = k === 'true' || k === 'false' ? 1 : k === 'contains' || k === 'regexp' ? 2 : 4;
    }
  }

  if (lang === 'rust') {
    const m = text.match(/\b(assert(?:_eq|_ne|_matches)?)\s*!\s*\(([\s\S]*)\)\s*;?$/);
    if (m) {
      info.matcher = m[1];
      const args = splitArgs(m[2]);
      info.actual = args[0];
      info.expected = args[1] ?? null;
      info.level = m[1] === 'assert' ? 1 : 4;
    }
  }

  if (lang === 'java') {
    const m = text.match(/\b(assert\w+)\s*\(([\s\S]*)\)\s*;?$/);
    if (m) {
      info.matcher = m[1];
      const args = splitArgs(m[2]);
      // junit: assertEquals(expected, actual) — or with message first
      if (args.length >= 3 && isStringLiteral(args[0])) {
        info.expected = args[1];
        info.actual = args[2];
      } else {
        info.expected = args[0];
        info.actual = args[1];
      }
      const k = m[1].toLowerCase();
      info.level = k === 'asserttrue' || k === 'assertfalse' ? 1 : k.includes('that') ? 2 : 4;
    }
  }

  return info;
}

function isStringLiteral(s) {
  return typeof s === 'string' && /^['"`]/.test(s.trim());
}

function isLiteral(s) {
  if (s == null) return false;
  const t = String(s).trim();
  return (
    /^['"`]/.test(t) ||
    /^-?\d/.test(t) ||
    /^(true|false|null|undefined|None|nil|True|False)$/.test(t) ||
    /^[[{]/.test(t)
  );
}

function splitFirstArg(src) {
  const args = splitArgs(src);
  return args[0] ?? '';
}

function splitArgs(src) {
  const out = [];
  let cur = '';
  let depth = 0;
  let inStr = null;
  const s = String(src || '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      cur += c;
      if (c === '\\' && inStr !== "'") {
        if (i + 1 < s.length) cur += s[++i];
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      inStr = c;
      cur += c;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') {
      depth++;
      cur += c;
      continue;
    }
    if (c === ')' || c === ']' || c === '}') {
      depth--;
      cur += c;
      continue;
    }
    if (c === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function currentTestName(tests, offset) {
  let name = '';
  for (const t of tests) {
    if (t.index <= offset) name = t.name;
    else break;
  }
  return name;
}

function offsetOfLine(text, lineNumber) {
  const lines = text.split('\n');
  let off = 0;
  for (let i = 0; i < lineNumber - 1 && i < lines.length; i++) off += lines[i].length + 1;
  return off;
}

// ── Diff analysis ───────────────────────────────────────────────────────────

function finding({ file, line, rule, before, after, severity, detail }) {
  return {
    file,
    line: line || 1,
    rule,
    before: before == null ? '' : String(before),
    after: after == null ? '' : String(after),
    severity: severity || (HIGH_RULES.has(rule) ? 'high' : 'warn'),
    detail: detail || '',
  };
}

function normalizeAssertText(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarName(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const na = a.toLowerCase();
  const nb = b.toLowerCase();
  if (na.includes(nb) || nb.includes(na)) return true;
  // cheap token overlap
  const ta = new Set(na.split(/[^a-z0-9]+/).filter(Boolean));
  const tb = new Set(nb.split(/[^a-z0-9]+/).filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return false;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.min(ta.size, tb.size) >= 0.6;
}

function isLoosened(fromMatcher, toMatcher) {
  if (!fromMatcher || !toMatcher) return false;
  const a = matcherKey(fromMatcher);
  const b = matcherKey(toMatcher);
  if (a === b) return false;
  const la = jsMatcherLevel(fromMatcher);
  const lb = jsMatcherLevel(toMatcher);
  if (la != null && lb != null && lb < la) return true;
  const rawFrom = String(fromMatcher).toLowerCase();
  const rawTo = String(toMatcher).toLowerCase();
  return MATCHER_ALIASES.some(
    ([from, to]) =>
      (a.includes(from) || rawFrom.includes(from)) &&
      (b.includes(to) || rawTo.includes(to) || b === to.replace(/_/g, '')),
  );
}

function toleranceWidened(before, after) {
  if (before.tolerance == null || after.tolerance == null) return false;
  if (Number.isNaN(before.tolerance) || Number.isNaN(after.tolerance)) return false;
  const matcher = matcherKey(after.matcher || before.matcher || '');
  // jest toBeCloseTo: smaller numDigits is looser; pytest approx rel/abs: larger is looser
  if (matcher === 'tobecloseto' || matcher.includes('almost') || matcher.includes('places')) {
    return after.tolerance < before.tolerance;
  }
  return after.tolerance > before.tolerance;
}

/**
 * Analyze a single file's before/after text.
 * `implChanged` is true when a non-test source file also changed in the same diff.
 */
export function analyzeFileDiff({ file, before, after, implChanged = false, config, cwd = '' } = {}) {
  const findings = [];
  const rel = normalizeRel(file, cwd);
  const cfg = config || { frozenPaths: DEFAULT_FROZEN_PATHS, disabledRules: [] };
  const beforeText = before == null ? '' : String(before);
  const afterText = after == null ? '' : String(after);
  const frozen = isFrozenPath(rel, cfg, cwd);
  const deleted = beforeText.length > 0 && after == null;
  const added = afterText.length > 0 && before == null;
  // Treat identical text as a no-op (except we still need frozen if someone
  // "edits" with the same content — that's a no-op, allow).
  const changed = beforeText !== afterText || deleted || (added && afterText.length > 0 && beforeText !== afterText);

  if (frozen && changed) {
    findings.push(
      finding({
        file: rel,
        line: 1,
        rule: RULES.FROZEN_PATH,
        before: summary(beforeText),
        after: after == null ? '(deleted)' : summary(afterText),
        detail:
          'Characterization / holdout tests are frozen. Re-baseline with rune:safeguard and a Test-Change-Approved override.',
      }),
    );
    // Still run the rest so the report is complete, but frozen already blocks.
  }

  if (isSnapshotFile(rel) && changed && after != null) {
    findings.push(
      finding({
        file: rel,
        line: 1,
        rule: RULES.SNAPSHOT_UPDATED,
        before: summary(beforeText),
        after: summary(afterText),
        detail:
          'Snapshot / golden file changed. Confirm the new snapshot is intentional, not an updated expectation to match a bug.',
      }),
    );
    return filterDisabled(findings, cfg);
  }

  if (!isTestFile(rel) && !frozen) return [];

  const lang = detectLanguage(rel);

  if (after == null && beforeText) {
    findings.push(
      finding({
        file: rel,
        line: 1,
        rule: RULES.TEST_DELETED,
        before: summary(beforeText),
        after: '(file deleted)',
        detail: 'Test file deleted.',
      }),
    );
    return filterDisabled(findings, cfg);
  }

  const prev = parseTestFile(beforeText, lang, rel);
  const next = parseTestFile(afterText, lang, rel);

  // Active (non-commented) asserts
  const prevActive = prev.asserts.filter((a) => !a.commented);
  const nextActive = next.asserts.filter((a) => !a.commented);
  const nextCommented = next.asserts.filter((a) => a.commented);

  // Pair replacements first so a loosened matcher or changed expected value
  // is not also reported as assert-removed (which would over-block).
  const accounted = new Set(); // prevActive indexes that were replaced or kept
  const nextUsed = new Set();
  const prevByTest = groupAssertsByTest(prevActive, prev.tests, beforeText);
  const nextByTest = groupAssertsByTest(nextActive, next.tests, afterText);
  const allTestNames = new Set([...prevByTest.keys(), ...nextByTest.keys()]);

  function markAccounted(b, a) {
    accounted.add(prevActive.indexOf(b));
    if (a) nextUsed.add(nextActive.indexOf(a));
  }

  // Exact text that merely moved stays accounted.
  const nextByNorm = new Map();
  nextActive.forEach((a, i) => {
    const k = normalizeAssertText(a.text);
    if (!nextByNorm.has(k)) nextByNorm.set(k, []);
    nextByNorm.get(k).push(i);
  });
  prevActive.forEach((b, i) => {
    const k = normalizeAssertText(b.text);
    const bucket = nextByNorm.get(k);
    if (!bucket || !bucket.length) return;
    const ni = bucket.shift();
    accounted.add(i);
    nextUsed.add(ni);
  });

  for (const name of allTestNames) {
    const pb = (prevByTest.get(name) || []).filter((b) => !accounted.has(prevActive.indexOf(b)));
    const na = (nextByTest.get(name) || []).filter((a) => !nextUsed.has(nextActive.indexOf(a)));
    for (const b of pb) {
      const counterparts = na.filter(
        (a) => !nextUsed.has(nextActive.indexOf(a)) && (sameActual(b, a) || sameActualLoose(b, a)),
      );
      const cand = counterparts[0] || (na.length === 1 && pb.length === 1 ? na[0] : null);
      if (!cand) continue;
      markAccounted(b, cand);
      if (isLoosened(b.matcher, cand.matcher) && normalizeAssertText(b.text) !== normalizeAssertText(cand.text)) {
        findings.push(
          finding({
            file: rel,
            line: cand.line,
            rule: RULES.MATCHER_LOOSENED,
            before: b.text,
            after: cand.text,
            detail: `Matcher loosened (${b.matcher} → ${cand.matcher}).`,
          }),
        );
      }
      if (toleranceWidened(b, cand)) {
        findings.push(
          finding({
            file: rel,
            line: cand.line,
            rule: RULES.MATCHER_LOOSENED,
            before: b.text,
            after: cand.text,
            detail: `Numeric tolerance widened (${b.tolerance} → ${cand.tolerance}).`,
          }),
        );
      }
      if (
        b.expected != null &&
        cand.expected != null &&
        normalizeAssertText(b.expected) !== normalizeAssertText(cand.expected) &&
        (isLiteral(b.expected) || isLiteral(cand.expected))
      ) {
        findings.push(
          finding({
            file: rel,
            line: cand.line,
            rule: RULES.EXPECTED_CHANGED,
            before: b.text,
            after: cand.text,
            detail: implChanged
              ? 'Expected literal changed in the same diff as implementation code.'
              : 'Expected literal changed. If the behavior change is real, get human approval.',
          }),
        );
      }
    }
  }

  for (const a of prevActive) {
    if (accounted.has(prevActive.indexOf(a))) continue;
    const norm = normalizeAssertText(a.text);
    const becameComment = nextCommented.find((c) => normalizeAssertText(c.text) === norm);
    if (becameComment) {
      findings.push(
        finding({
          file: rel,
          line: becameComment.line,
          rule: RULES.ASSERT_COMMENTED,
          before: a.text,
          after: `// ${a.text}`,
          detail: 'Assertion was commented out.',
        }),
      );
      continue;
    }
    findings.push(
      finding({
        file: rel,
        line: a.line,
        rule: RULES.ASSERT_REMOVED,
        before: a.text,
        after: '(deleted)',
        detail: 'Assertion removed. Fix the code, not the tests.',
      }),
    );
  }

  if (nextActive.length < prevActive.length) {
    findings.push(
      finding({
        file: rel,
        line: 1,
        rule: RULES.ASSERT_COUNT_DROP,
        before: String(prevActive.length),
        after: String(nextActive.length),
        detail: `Net assertion count dropped (${prevActive.length} → ${nextActive.length}).`,
      }),
    );
  }

  // Skip / only / xfail / todo added
  const prevSkipKeys = new Set(prev.skips.map((s) => `${s.kind}:${normalizeAssertText(s.text)}`));
  for (const s of next.skips) {
    const key = `${s.kind}:${normalizeAssertText(s.text)}`;
    if (prevSkipKeys.has(key)) continue;
    const rule =
      s.kind === 'only'
        ? RULES.ONLY_ADDED
        : s.kind === 'xfail'
          ? RULES.XFAIL_ADDED
          : s.kind === 'todo'
            ? RULES.TODO_ADDED
            : RULES.SKIP_ADDED;
    const severity = s.kind === 'todo' || s.kind === 'only' ? 'warn' : HIGH_RULES.has(rule) ? 'high' : 'warn';
    // only hides the rest of the suite — treat as warn (not in the BLOCK list), xfail like skip?
    // Task: "added skip/only/xfail/todo" is flagged; BLOCK list says "skip added".
    // only/xfail: I'll treat xfail as skip-added (high) because it silences failure; only as warn.
    const finalRule = s.kind === 'xfail' ? RULES.SKIP_ADDED : rule;
    findings.push(
      finding({
        file: rel,
        line: s.line,
        rule: finalRule,
        before: '',
        after: s.text,
        severity: s.kind === 'todo' || s.kind === 'only' ? 'warn' : 'high',
        detail:
          s.kind === 'only'
            ? 'Focused .only leaves the rest of the suite unrun.'
            : s.kind === 'todo'
              ? 'Test marked todo — it will not run.'
              : 'Test skipped. A skipped test is a green suite that checks less.',
      }),
    );
    void severity;
  }

  // Deleted tests, with rename tolerance
  const prevNames = prev.tests.map((t) => t.name);
  const nextNames = next.tests.map((t) => t.name);
  const nextNameSet = new Set(nextNames);
  for (const name of prevNames) {
    if (nextNameSet.has(name)) continue;
    const renamed = nextNames.some((n) => similarName(name, n) && !prevNames.includes(n));
    if (renamed) continue;
    // If the suite grew or stayed the same and no asserts dropped, this is
    // almost certainly a rename/rewrite — don't flag a deletion.
    if (nextNames.length >= prevNames.length && nextActive.length >= prevActive.length) continue;
    const line = (prev.tests.find((t) => t.name === name)?.index ?? 0) === 0 ? 1 : undefined;
    const t = prev.tests.find((x) => x.name === name);
    findings.push(
      finding({
        file: rel,
        line: t ? lineNumberAt(beforeText, t.index) : 1,
        rule: RULES.TEST_DELETED,
        before: name,
        after: '(deleted)',
        detail: `Test ${JSON.stringify(name)} was removed.`,
      }),
    );
    void line;
  }

  // Mocks that replace a previously real collaborator
  const prevMockKeys = new Set(prev.mocks.map((m) => m.target));
  for (const m of next.mocks) {
    if (prevMockKeys.has(m.target)) continue;
    const target = m.target;
    const appearedBefore =
      (target && target !== m.text && (prev.imports.has(target) || beforeText.includes(target))) ||
      // spyOn / generic mock introduced into a file that previously had none
      (prev.mocks.length === 0 && /mock|spyOn|patch/i.test(m.text) && prevActive.length > 0);
    if (appearedBefore) {
      findings.push(
        finding({
          file: rel,
          line: m.line,
          rule: RULES.MOCK_REPLACED_REAL,
          before: '',
          after: m.text,
          detail: `New mock may replace a previously real call${target && target !== m.text ? ` (${target})` : ''}.`,
        }),
      );
    }
  }

  return filterDisabled(findings, cfg);
}

function filterDisabled(findings, cfg) {
  const disabled = new Set(cfg.disabledRules || []);
  return findings.filter((f) => !disabled.has(f.rule));
}

function groupAssertsByTest(asserts, tests, text) {
  const map = new Map();
  for (const a of asserts) {
    const name = currentTestName(tests, offsetOfLine(text, a.line)) || '(file)';
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(a);
  }
  return map;
}

function sameActual(a, b) {
  return a.actual && b.actual && normalizeAssertText(a.actual) === normalizeAssertText(b.actual);
}

function sameActualLoose(a, b) {
  if (!a.actual || !b.actual) return false;
  const x = normalizeAssertText(a.actual);
  const y = normalizeAssertText(b.actual);
  return x.includes(y) || y.includes(x);
}

function lineNumberAt(text, index) {
  if (index == null || index < 0) return 1;
  return text.slice(0, index).split('\n').length;
}

function summary(text) {
  const t = String(text || '').trim();
  if (t.length <= 160) return t;
  return `${t.slice(0, 157)}…`;
}

/**
 * Analyze a list of file diffs. `diffs` items: { file, before, after }.
 * `implChanged` may be set per-item or computed from the list.
 */
export function analyzeDiffs(diffs, { config, cwd = '', implFiles, implChanged: implChangedOpt } = {}) {
  const cfg = config || loadIntegrityConfig(cwd);
  const impl =
    implFiles ||
    (diffs || [])
      .filter((d) => {
        const rel = normalizeRel(d.file, cwd);
        return (
          !isTestFile(rel) && !isSnapshotFile(rel) && (d.before !== d.after || d.after == null || d.before == null)
        );
      })
      .map((d) => normalizeRel(d.file, cwd));
  const implChanged = Boolean(implChangedOpt) || impl.length > 0;
  const findings = [];
  for (const d of diffs || []) {
    const rel = normalizeRel(d.file, cwd);
    if (!isTestFile(rel) && !isFrozenPath(rel, cfg, cwd) && !isSnapshotFile(rel)) continue;
    findings.push(
      ...analyzeFileDiff({
        file: rel,
        before: d.before,
        after: d.after,
        implChanged,
        config: cfg,
        cwd,
      }),
    );
  }
  return finalize(findings);
}

function finalize(findings) {
  // Dedup identical fingerprints
  const seen = new Set();
  const out = [];
  for (const f of findings) {
    const key = `${f.file}:${f.line}:${f.rule}:${f.before}:${f.after}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  const high = out.filter((f) => f.severity === 'high');
  const warn = out.filter((f) => f.severity !== 'high');
  return { findings: out, high, warn, blocked: high.length > 0 };
}

// ── Git collection ──────────────────────────────────────────────────────────

function git(cwd, args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      timeout: 8000,
      maxBuffer: 8 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    if (allowFail) return err.stdout || '';
    throw err;
  }
}

function gitShow(cwd, spec) {
  try {
    const buf = execFileSync('git', ['show', spec], {
      cwd,
      encoding: 'buffer',
      timeout: 8000,
      maxBuffer: MAX_FILE_BYTES + 4096,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (!buf || buf.includes(0) || buf.length > MAX_FILE_BYTES) return null;
    return buf.toString('utf-8');
  } catch {
    return null;
  }
}

function readWorking(cwd, rel) {
  const abs = path.join(cwd, rel);
  if (!existsSync(abs)) return null;
  try {
    const buf = readFileSync(abs);
    if (buf.includes(0) || buf.length > MAX_FILE_BYTES) return null;
    return buf.toString('utf-8');
  } catch {
    return null;
  }
}

/**
 * Collect before/after diffs from git.
 *  - staged:  index vs HEAD          (`git diff --cached`)
 *  - base:    worktree+index vs <ref>
 *  - default: worktree+index vs HEAD
 */
export function collectGitDiffs(cwd, { staged = false, base } = {}) {
  const args = staged ? ['diff', '--cached', '--name-status', '-z'] : ['diff', base || 'HEAD', '--name-status', '-z'];
  let out = '';
  try {
    out = git(cwd, args, { allowFail: true });
  } catch {
    return [];
  }
  const parts = out.split('\0').filter(Boolean);
  const diffs = [];
  for (let i = 0; i < parts.length; ) {
    const status = parts[i++];
    const fileA = parts[i++] || '';
    const renamed = status.startsWith('R') || status.startsWith('C');
    const fileB = renamed ? parts[i++] || fileA : fileA;
    const rel = normalizeRel(fileB, cwd);
    const code = status[0];
    let before = '';
    let after = '';
    if (code === 'D') {
      before = staged ? gitShow(cwd, `HEAD:${fileA}`) : gitShow(cwd, `${base || 'HEAD'}:${fileA}`);
      after = null;
    } else if (code === 'A') {
      before = '';
      after = staged ? gitShow(cwd, `:${fileB}`) : readWorking(cwd, rel);
    } else {
      before = staged ? gitShow(cwd, `HEAD:${fileA}`) : gitShow(cwd, `${base || 'HEAD'}:${fileA}`);
      after = staged ? gitShow(cwd, `:${fileB}`) : readWorking(cwd, rel);
      if (before == null) before = '';
    }
    diffs.push({ file: rel, before, after, status: code });
  }
  return diffs;
}

export function analyzeGit(cwd, options = {}) {
  const config = options.config || loadIntegrityConfig(cwd);
  const diffs = collectGitDiffs(cwd, options);
  return { ...analyzeDiffs(diffs, { config, cwd }), diffs };
}

// ── Event (hook) collection ─────────────────────────────────────────────────

const WRITE_TOOLS = new Set([
  'Write',
  'Edit',
  'apply_patch',
  'write_file',
  'write_to_file',
  'replace_file_content',
  'multi_replace_file_content',
]);

export function isGitCommitCommand(command) {
  return /(?:^|[;&|]\s*|&&\s*)git\s+commit\b/.test(String(command || '').trim());
}

/**
 * Reconstruct the intended after-text of a PreToolUse Edit/Write/apply_patch.
 * Returns an array of { file, before, after }.
 */
export function diffsFromEvent(event, cwd) {
  const tool = event?.tool_name || '';
  const input = event?.tool_input && typeof event.tool_input === 'object' ? event.tool_input : {};
  const diffs = [];

  if (
    tool === 'apply_patch' ||
    input.patch ||
    (typeof input.command === 'string' && input.command.includes('*** Begin Patch'))
  ) {
    const patch = typeof input === 'string' ? input : input.command || input.input || input.patch || '';
    return diffsFromApplyPatch(patch, cwd);
  }

  const file = input.file_path || input.path;
  if (!file) return diffs;
  const rel = normalizeRel(file, cwd);
  const before = readWorking(cwd, rel) ?? '';

  if (typeof input.content === 'string') {
    diffs.push({ file: rel, before, after: input.content });
    return diffs;
  }
  if (typeof input.contents === 'string') {
    diffs.push({ file: rel, before, after: input.contents });
    return diffs;
  }
  if (typeof input.new_string === 'string') {
    const old = typeof input.old_string === 'string' ? input.old_string : '';
    let after = before;
    if (old && input.replace_all) after = before.split(old).join(input.new_string);
    else if (old && before.includes(old)) after = before.replace(old, input.new_string);
    else after = input.new_string; // full-file replacement fallback
    diffs.push({ file: rel, before, after });
    return diffs;
  }
  if (Array.isArray(input.edits)) {
    let after = before;
    for (const ed of input.edits) {
      const o = ed.old_string || ed.oldString || '';
      const n = ed.new_string || ed.newString || '';
      if (o && after.includes(o)) after = ed.replace_all ? after.split(o).join(n) : after.replace(o, n);
    }
    diffs.push({ file: rel, before, after });
    return diffs;
  }
  // Path known but no body (e.g. a tool that only names the file): still
  // surface frozen-path edits; otherwise we cannot judge content.
  if (isFrozenPath(rel, loadIntegrityConfig(cwd), cwd)) {
    diffs.push({ file: rel, before, after: `${before}\n` }); // force a change signal
  }
  return diffs;
}

function diffsFromApplyPatch(patch, cwd) {
  const diffs = [];
  if (typeof patch !== 'string') return diffs;
  const chunks = patch.split(/^\*\*\* (?:Begin Patch|End Patch)\s*$/m).join('');
  const fileRe = /^\*\*\* (Update|Add|Delete) File:\s*(.+)$/gm;
  const markers = [...chunks.matchAll(fileRe)];
  for (let i = 0; i < markers.length; i++) {
    const kind = markers[i][1];
    const rel = normalizeRel(markers[i][2].trim(), cwd);
    const start = markers[i].index + markers[i][0].length;
    const end = i + 1 < markers.length ? markers[i + 1].index : chunks.length;
    const body = chunks.slice(start, end);
    const beforeDisk = readWorking(cwd, rel);
    if (kind === 'Delete') {
      diffs.push({ file: rel, before: beforeDisk ?? '', after: null });
      continue;
    }
    if (kind === 'Add') {
      const added = body
        .split('\n')
        .filter((l) => l.startsWith('+'))
        .map((l) => l.slice(1))
        .join('\n');
      diffs.push({ file: rel, before: '', after: added });
      continue;
    }
    // Update: apply +/- lines loosely onto the disk copy when we have it,
    // otherwise reconstruct from the patch's context/minus/plus.
    const after = applyUnifiedish(beforeDisk ?? reconstructMinus(body), body);
    diffs.push({ file: rel, before: beforeDisk ?? reconstructMinus(body), after });
  }
  return diffs;
}

function reconstructMinus(body) {
  return body
    .split('\n')
    .filter((l) => l.startsWith(' ') || l.startsWith('-'))
    .map((l) => l.slice(1))
    .join('\n');
}

function applyUnifiedish(before, body) {
  // Prefer applying each hunk as a replacement of the '-' block with the '+' block.
  let text = before ?? '';
  const lines = body.split('\n');
  let minus = [];
  let plus = [];
  const flush = () => {
    if (minus.length === 0 && plus.length === 0) return;
    const oldB = minus.join('\n');
    const newB = plus.join('\n');
    if (oldB && text.includes(oldB)) text = text.replace(oldB, newB);
    else if (!oldB) text = text ? `${text}\n${newB}` : newB;
    minus = [];
    plus = [];
  };
  for (const l of lines) {
    if (l.startsWith('@@') || l.startsWith('***')) {
      flush();
      continue;
    }
    if (l.startsWith('-')) minus.push(l.slice(1));
    else if (l.startsWith('+')) plus.push(l.slice(1));
    else if (l.startsWith(' ')) {
      // context — flush pending change first if we crossed out of a change block
      if (minus.length || plus.length) flush();
    }
  }
  flush();
  return text;
}

/**
 * Run the integrity check in a hook context.
 * @returns {{status:number, stdout:string, stderr:string, result?:object, override?:object}}
 */
export function runIntegrityForEvent(event, cwd, { config } = {}) {
  try {
    const tool = event?.tool_name || '';
    const input = event?.tool_input && typeof event.tool_input === 'object' ? event.tool_input : {};
    const command = input.command || event.command || '';
    const cfg = config || loadIntegrityConfig(cwd);

    let diffs = [];
    let override = null;
    let dirtyImpl = false;

    if (isGitCommitCommand(command)) {
      diffs = collectGitDiffs(cwd, { staged: true });
      override = resolveOverride({ env: process.env, command, cwd });
    } else if (
      WRITE_TOOLS.has(tool) ||
      (tool && tool !== 'Read' && tool !== 'Bash' && (input.file_path || input.path))
    ) {
      diffs = diffsFromEvent(event, cwd);
      override = resolveOverride({ env: process.env, cwd });
      // Also consider dirty impl files in the worktree so expected-changed
      // can be tagged "together with matching impl change".
      try {
        const status = git(cwd, ['status', '--porcelain'], { allowFail: true });
        dirtyImpl = status
          .split('\n')
          .map((l) => l.slice(3).trim())
          .some((f) => f && !isTestFile(f) && !isSnapshotFile(f));
      } catch {
        /* not a git repo — fine */
      }
    } else {
      return { status: 0, stdout: '', stderr: '' };
    }

    const relevant = diffs.filter((d) => {
      const rel = normalizeRel(d.file, cwd);
      return isTestFile(rel) || isFrozenPath(rel, cfg, cwd) || isSnapshotFile(rel);
    });
    if (relevant.length === 0) return { status: 0, stdout: '', stderr: '' };

    const result = analyzeDiffs(relevant, { config: cfg, cwd, implChanged: dirtyImpl });
    if (result.findings.length === 0) return { status: 0, stdout: '', stderr: '', result };

    const message = formatHookMessage(result, { override, strictBlock: result.blocked });
    if (result.blocked && !override) {
      return {
        status: 2,
        stdout: `${JSON.stringify({ systemMessage: message, hookSpecificOutput: { hookEventName: 'PreToolUse' } })}\n`,
        stderr: `${message}\n`,
        result,
      };
    }
    // Warn-only, or high findings with an auditable override.
    return {
      status: 0,
      stdout: `${JSON.stringify({ systemMessage: message })}\n`,
      stderr: '',
      result,
      override,
    };
  } catch (err) {
    return { status: null, stdout: '', stderr: '', error: err.message };
  }
}

// ── Formatting ──────────────────────────────────────────────────────────────

export function formatReport(result, { json = false } = {}) {
  if (json) {
    return `${JSON.stringify({ findings: result.findings, high: result.high.length, warn: result.warn.length, blocked: result.blocked }, null, 2)}\n`;
  }
  if (!result.findings.length) {
    return 'test-integrity: clean — no assertion weakening, skips, frozen-path edits, or snapshot updates detected.\n';
  }
  const lines = [];
  const high = result.high.length;
  const warn = result.warn.length;
  lines.push(`test-integrity: ${high} high, ${warn} warn${result.blocked ? '  (exit 2)' : ''}`);
  lines.push('');
  for (const f of result.findings) {
    const tag = (f.severity === 'high' ? 'HIGH' : 'WARN').padEnd(4);
    lines.push(`${tag}  ${f.rule.padEnd(22)} ${f.file}:${f.line}`);
    if (f.before) lines.push(`      before: ${oneLine(f.before)}`);
    if (f.after) lines.push(`      after:  ${oneLine(f.after)}`);
    if (f.detail) lines.push(`      ${f.detail}`);
  }
  if (result.blocked) {
    lines.push('');
    lines.push('Fix the CODE, not the TESTS. If this change is intentional, get human approval and rerun with:');
    lines.push(`  ${OVERRIDE_TRAILER}: <reason>     (git commit trailer)`);
    lines.push(`  ${OVERRIDE_ENV}=<reason>     (environment)`);
  }
  return `${lines.join('\n')}\n`;
}

export function formatHookMessage(result, { override } = {}) {
  const head = result.blocked && !override ? 'BLOCKED' : override && result.blocked ? 'OVERRIDDEN' : 'WARNING';
  const lines = [`[Rune test-integrity] ${head}: ${summarizeRules(result.findings)}`];
  for (const f of result.findings.slice(0, 12)) {
    lines.push(`  - ${f.rule}: ${f.file}:${f.line}  ${oneLine(f.before) || '∅'}  →  ${oneLine(f.after) || '∅'}`);
  }
  if (result.findings.length > 12) lines.push(`  - …and ${result.findings.length - 12} more`);
  if (override) {
    lines.push(`  Override accepted from ${override.source}: ${override.reason}`);
  } else if (result.blocked) {
    lines.push('Fix the CODE, not the TESTS. If this test change is intentional, get human approval and retry with:');
    lines.push(`  - env ${OVERRIDE_ENV}="<reason>"`);
    lines.push(`  - or a commit trailer: ${OVERRIDE_TRAILER}: <reason>`);
  }
  return lines.join('\n');
}

function summarizeRules(findings) {
  const counts = {};
  for (const f of findings) counts[f.rule] = (counts[f.rule] || 0) + 1;
  return Object.entries(counts)
    .map(([k, n]) => (n > 1 ? `${n}× ${k}` : k))
    .join(', ');
}

function oneLine(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

export function verdictFromResult(result, { override, gentle } = {}) {
  if (!result || !result.findings?.length) return { exitCode: 0, blocked: false };
  if (result.blocked && override) return { exitCode: 0, blocked: false, overridden: true };
  if (result.blocked && gentle) return { exitCode: 0, blocked: false, wouldBlock: true };
  if (result.blocked) return { exitCode: 2, blocked: true };
  return { exitCode: 0, blocked: false };
}
