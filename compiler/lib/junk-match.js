/**
 * Junk-match scanner — tests and checks that pass trivially or match on noise.
 *
 * Used by `rune verify --junk` and by hook-dispatch (preflight / sentinel).
 * Findings are fingerprints { file, line, rule, before, after, detail, severity }.
 */

import {
  collectGitDiffs,
  detectLanguage,
  diffsFromEvent,
  isGitCommitCommand,
  isSnapshotFile,
  isTestFile,
  normalizeRel,
} from './test-integrity.js';

export const JUNK_RULES = Object.freeze({
  EXPECT_TRUE: 'expect-true',
  TAUTOLOGY: 'tautology',
  CATCHALL_REGEX: 'catchall-regex',
  EMPTY_SNAPSHOT: 'empty-snapshot',
  MOCK_ECHO: 'mock-echo',
  STATUS_ONLY: 'status-only',
  FIXTURE_IN_SRC: 'fixture-in-src',
});

export const JUNK_HIGH_RULES = new Set([JUNK_RULES.EXPECT_TRUE, JUNK_RULES.TAUTOLOGY, JUNK_RULES.EMPTY_SNAPSHOT]);

const WRITE_TOOLS = new Set(['Write', 'Edit', 'edit', 'write', 'str_replace', 'create', 'apply_patch', 'ApplyPatch']);

const EXPECT_TRUE_RE =
  /(?:expect|assert)\s*\(\s*(?:true|false)\s*\)|(?:assert\.ok|assert\.isTrue|assertTrue|assert_true|XCTAssertTrue)\s*\(\s*true\s*\)|assert!\s*\(\s*true\s*\)|\bassert\s+(?:True|true)\b/;

const TAUTOLOGY_RE =
  /expect\s*\(\s*([A-Za-z_][\w.]*)\s*\)\s*\.\s*(?:toBe|toEqual|toStrictEqual)\s*\(\s*\1\s*\)|assert(?:\.equal|\.strictEqual|\.deepEqual|_eq!)\s*\(\s*([A-Za-z_][\w.]*)\s*,\s*\2\s*\)|assertEquals\s*\(\s*([A-Za-z_][\w.]*)\s*,\s*\3\s*\)|self\.assertEqual\s*\(\s*([A-Za-z_][\w.]*)\s*,\s*\4\s*\)|assert_eq!\s*\(\s*([A-Za-z_][\w.]*)\s*,\s*\5\s*\)/;

const CATCHALL_RE =
  /(?:toMatch|toMatchObject|matches|assertMatch|assertRegexpMatches|re\.(?:match|search|fullmatch)|regexp\.MustCompile|Regex::new)\s*\(\s*(?:[/](?:\^?\.\*\$?|\.|\[\s\\S\]\*|\(\?s\)\.\*)[/][gimsuy]*|r?['"`](?:\^?\.\*\$?|\.|\[\s\\S\]\*)['"`])/;

const EMPTY_INLINE_SNAP_RE = /toMatch(?:Inline)?Snapshot\s*\(\s*(?:`\s*`|'\s*'|"\s*")\s*\)/;

const STATUS_ASSERT_RE = /\b(?:statusCode|status_code|status)\b|\.Code\b|toHave(?:Http)?Status|HTTPStatus|HttpStatus/;

const ANY_ASSERT_RE =
  /\b(?:expect|assert|assert_eq|assert_ne|assertEquals|assertTrue|assertFalse|assertThat|XCTAssert|require|should)\s*[\s(.!]/;

const STATUS_NAME_RE =
  /\b(status|http\s*code|unauthorized|forbidden|not found|no content|health|ping|404|401|403|204|200 ok)\b/i;

const FIXTURE_IMPORT_RE =
  /(?:from\s+|require\s*\(\s*|import\s*\(\s*|include\s+|open\s*\(\s*)['"`][^'"`]*(?:__fixtures__|__snapshots__|\.snap\b|evals\/[^'"`]*expected)[^'"`]*['"`]|['"`][^'"`]*(?:__fixtures__|__snapshots__|evals\/[^'"`]*expected)[^'"`]*['"`]/;

const MOCK_SET_RE =
  /(?:mockReturnValue(?:Once)?|mockResolvedValue(?:Once)?|mockImplementation(?:Once)?|thenReturn|and_return)\s*\(\s*([^)]+?)\s*\)|return_value\s*=\s*([^\s,#]+)/g;

function oneLine(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

function finding(file, line, rule, source, detail, severity) {
  return {
    file,
    line,
    rule,
    before: '',
    after: oneLine(source),
    detail: detail || '',
    severity: severity || (JUNK_HIGH_RULES.has(rule) ? 'high' : 'warn'),
  };
}

function addedLineNumbers(before, after) {
  if (before == null || before === '') {
    return null; // new file — all lines are in scope
  }
  const prev = new Set(
    String(before)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
  );
  const added = new Set();
  String(after)
    .split('\n')
    .forEach((line, i) => {
      if (line.trim() && !prev.has(line.trim())) added.add(i + 1);
    });
  return added;
}

function lineInScope(line, added) {
  return !added || added.has(line);
}

export function splitTestBlocks(content, lang) {
  const lines = String(content || '').split('\n');
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let name = null;
    const indent = (line.match(/^\s*/) || [''])[0].length;
    if (lang === 'python') {
      const m = line.match(/^(\s*)def\s+(test_\w+)\s*\(/);
      if (m) name = m[2];
    } else if (lang === 'go') {
      const m = line.match(/^func\s+(Test\w+)\s*\(/);
      if (m) {
        name = m[1];
      }
    } else if (lang === 'rust') {
      if (/#\[(?:tokio::)?test/.test(lines[i] || '') || (i > 0 && /#\[(?:tokio::)?test/.test(lines[i - 1] || ''))) {
        const m = line.match(/^\s*(?:async\s+)?fn\s+(\w+)\s*\(/);
        if (m) name = m[1];
      }
    } else if (lang === 'java') {
      const prev = `${lines[i - 1] || ''} ${lines[i - 2] || ''}`;
      if (/@Test\b/.test(prev) || /@Test\b/.test(line)) {
        const m = line.match(/\b(?:void|fun)\s+(\w+)\s*\(/);
        if (m) name = m[1];
      }
    } else {
      const m = line.match(
        /^(\s*)(?:it|test|xtest|xit)\s*(?:\.(?:only|skip|todo|concurrent))*\s*\(\s*(['"`])([\s\S]*?)\2/,
      );
      if (m) name = m[3];
    }
    if (name) starts.push({ name, start: i, indent, line: i + 1 });
  }
  const blocks = [];
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    let end = lines.length;
    for (let j = i + 1; j < starts.length; j++) {
      if (starts[j].indent <= s.indent) {
        end = starts[j].start;
        break;
      }
    }
    blocks.push({
      name: s.name,
      startLine: s.line,
      endLine: end,
      body: lines.slice(s.start, end).join('\n'),
    });
  }
  return blocks;
}

function scanLineRules(file, after, added) {
  const findings = [];
  const lines = String(after || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    if (!lineInScope(lineNo, added)) continue;
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) continue;

    if (EXPECT_TRUE_RE.test(trimmed)) {
      findings.push(
        finding(
          file,
          lineNo,
          JUNK_RULES.EXPECT_TRUE,
          trimmed,
          'Assertion received a boolean literal — it cannot fail based on the code under test.',
        ),
      );
    }
    if (TAUTOLOGY_RE.test(trimmed)) {
      findings.push(
        finding(file, lineNo, JUNK_RULES.TAUTOLOGY, trimmed, 'Both sides of the assertion are the same identifier.'),
      );
    }
    if (CATCHALL_RE.test(trimmed)) {
      findings.push(
        finding(
          file,
          lineNo,
          JUNK_RULES.CATCHALL_REGEX,
          trimmed,
          'Matcher is a catch-all pattern (.*, ., or ^.*$) that accepts almost any string.',
        ),
      );
    }
    if (EMPTY_INLINE_SNAP_RE.test(trimmed)) {
      findings.push(finding(file, lineNo, JUNK_RULES.EMPTY_SNAPSHOT, trimmed, 'Inline snapshot of empty output.'));
    }
  }
  return findings;
}

function scanEmptySnapshotFile(file, after, _added) {
  if (!isSnapshotFile(file)) return [];
  const text = String(after || '').trim();
  const empty =
    text === '' ||
    /^exports\[.+]\s*=\s*(?:`\s*`|'\\s*'|"\s*"|);\s*$/m.test(text) ||
    (text.includes('exports[') && !/`[^`\n]+`|"[^"\n]+"|'[^'\n]+'/.test(text));
  if (!empty) return [];
  return [finding(file, 1, JUNK_RULES.EMPTY_SNAPSHOT, text.slice(0, 80), 'Snapshot file records empty output.')];
}

function normalizeLiteral(s) {
  return String(s || '')
    .trim()
    .replace(/[;,]\s*$/, '')
    .replace(/^['"`]|['"`]$/g, '');
}

function scanBlocks(file, after, lang, added) {
  const findings = [];
  for (const block of splitTestBlocks(after, lang)) {
    const touched =
      !added || [...Array(block.endLine - block.startLine + 1).keys()].some((k) => added.has(block.startLine + k));
    if (!touched) continue;

    const assertLines = block.body.split('\n').map((l, i) => ({ line: block.startLine + i, text: l }));
    const asserts = assertLines.filter(
      (l) => ANY_ASSERT_RE.test(l.text) && !/^\s*\/\//.test(l.text) && !/^\s*#/.test(l.text),
    );

    // mock-echo: a mock was told a literal, and the only asserts check that same literal
    const mockLits = [];
    let m;
    const mockRe = new RegExp(MOCK_SET_RE.source, 'g');
    while ((m = mockRe.exec(block.body))) {
      const lit = normalizeLiteral(m[1] || m[2] || '');
      if (lit) mockLits.push(lit);
    }
    if (mockLits.length && asserts.length) {
      const echoAsserts = asserts.filter((a) => mockLits.some((lit) => a.text.includes(lit)));
      const otherAsserts = asserts.filter((a) => !mockLits.some((lit) => a.text.includes(lit)));
      if (echoAsserts.length && otherAsserts.length === 0) {
        findings.push(
          finding(
            file,
            echoAsserts[0].line,
            JUNK_RULES.MOCK_ECHO,
            echoAsserts[0].text.trim(),
            `Test only asserts that a mock returns the value it was programmed with (${mockLits[0]}).`,
          ),
        );
      }
    }

    // status-only: every assert is about an HTTP/status code, and the test is not named as a status test
    if (
      asserts.length &&
      asserts.every((a) => STATUS_ASSERT_RE.test(a.text)) &&
      !STATUS_NAME_RE.test(block.name || '')
    ) {
      findings.push(
        finding(
          file,
          asserts[0].line,
          JUNK_RULES.STATUS_ONLY,
          asserts[0].text.trim(),
          `Test "${oneLine(block.name)}" only checks a status code, with no body/header/behavior assertion.`,
        ),
      );
    }
  }
  return findings;
}

function isProbablySrc(rel) {
  if (isTestFile(rel) || isSnapshotFile(rel)) return false;
  if (/\.(md|json|ya?ml|toml|lock)$/i.test(rel)) return false;
  // Config and docs are not "runtime paths".
  if (/(^|\/)(docs?|examples?|scripts?|hooks|compiler\/__tests__)(\/|$)/i.test(rel)) return false;
  return true;
}

function scanFixtureInSrc(file, after, added) {
  if (!isProbablySrc(file)) return [];
  const findings = [];
  const lines = String(after || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    if (!lineInScope(lineNo, added)) continue;
    if (FIXTURE_IMPORT_RE.test(lines[i])) {
      findings.push(
        finding(
          file,
          lineNo,
          JUNK_RULES.FIXTURE_IN_SRC,
          lines[i].trim(),
          'Production code reads a test fixture, snapshot, or eval expected-output file — a "matches but junk" smell.',
        ),
      );
    }
  }
  return findings;
}

export function analyzeJunkFile({ file, before, after } = {}) {
  const rel = file || 'unknown';
  const added = addedLineNumbers(before, after);
  const findings = [];
  if (isSnapshotFile(rel)) {
    findings.push(...scanEmptySnapshotFile(rel, after, added));
    return findings;
  }
  if (isTestFile(rel)) {
    const lang = detectLanguage(rel);
    findings.push(...scanLineRules(rel, after, added));
    findings.push(...scanBlocks(rel, after, lang, added));
  } else {
    findings.push(...scanFixtureInSrc(rel, after, added));
  }
  // Dedup same rule+line
  const seen = new Set();
  return findings.filter((f) => {
    const k = `${f.rule}:${f.file}:${f.line}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function analyzeJunkDiffs(diffs, { cwd = '' } = {}) {
  const findings = [];
  for (const d of diffs || []) {
    const file = normalizeRel(d.file || d.path || '', cwd);
    findings.push(
      ...analyzeJunkFile({
        file,
        before: d.before ?? d.prev ?? '',
        after: d.after ?? d.next ?? '',
      }),
    );
  }
  const high = findings.filter((f) => f.severity === 'high');
  const warn = findings.filter((f) => f.severity !== 'high');
  return { findings, high, warn, blocked: high.length > 0 };
}

export function analyzeJunkGit(cwd, options = {}) {
  const diffs = collectGitDiffs(cwd, options);
  return analyzeJunkDiffs(diffs, { cwd });
}

export function formatJunkReport(result, { json = false } = {}) {
  if (json) {
    return `${JSON.stringify({ findings: result.findings, high: result.high.length, warn: result.warn.length, blocked: result.blocked }, null, 2)}\n`;
  }
  if (!result.findings.length) {
    return 'junk-match: clean — no tautological asserts, catch-all matchers, empty snapshots, mock-echo, or status-only checks detected.\n';
  }
  const lines = [
    `junk-match: ${result.high.length} high, ${result.warn.length} warn${result.blocked ? '  (exit 2)' : ''}`,
    '',
  ];
  for (const f of result.findings) {
    const tag = (f.severity === 'high' ? 'HIGH' : 'WARN').padEnd(4);
    lines.push(`${tag}  ${f.rule.padEnd(22)} ${f.file}:${f.line}`);
    if (f.after) lines.push(`      ${f.after}`);
    if (f.detail) lines.push(`      ${f.detail}`);
  }
  if (result.blocked) {
    lines.push('');
    lines.push(
      'A green suite that matches on noise is not evidence. Strengthen the assertion (or delete a vacuous test).',
    );
  }
  return `${lines.join('\n')}\n`;
}

export function formatJunkHookMessage(result) {
  const head = result.blocked ? 'BLOCKED' : 'WARNING';
  const lines = [`[Rune junk-match] ${head}: ${result.findings.map((f) => f.rule).join(', ')}`];
  for (const f of result.findings.slice(0, 12)) {
    lines.push(`  - ${f.rule}: ${f.file}:${f.line}  ${f.after || ''}`.trimEnd());
  }
  if (result.blocked) {
    lines.push(
      'This test (or production path) can pass without exercising real behavior. Fix the assertion, not the production code, or drop the vacuous test.',
    );
  }
  return lines.join('\n');
}

export function runJunkForEvent(event, cwd) {
  try {
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
    const result = analyzeJunkDiffs(diffs, { cwd });
    if (!result.findings.length) return { status: 0, stdout: '', stderr: '', result };
    const message = formatJunkHookMessage(result);
    if (result.blocked) {
      return {
        status: 2,
        stdout: `${JSON.stringify({ systemMessage: message, hookSpecificOutput: { hookEventName: 'PreToolUse' } })}\n`,
        stderr: `${message}\n`,
        result,
      };
    }
    return {
      status: 0,
      stdout: `${JSON.stringify({ systemMessage: message })}\n`,
      stderr: '',
      result,
    };
  } catch (err) {
    return { status: null, stdout: '', stderr: '', error: err.message };
  }
}
