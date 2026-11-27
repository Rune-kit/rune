/**
 * `rune verify --oracle` — compare a candidate implementation against a
 * reference (legacy command, production URL, or recorded fixtures) on a corpus.
 *
 * Each mismatch is a fingerprint { input, expected, actual, diffKind }.
 * Fingerprints are aggregated; only *new* (not baselined) divergences fail the run.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, isAbsolute, join, resolve } from 'node:path';

export const DEFAULT_CORPUS = join('.rune', 'oracle', 'corpus');
export const DEFAULT_BASELINE = join('.rune', 'oracle', 'baseline.json');
export const DEFAULT_TIMEOUT_MS = 10_000;
export const MAX_OUTPUT = 1_000_000;

export const DIFF_KINDS = Object.freeze({
  ERROR: 'error',
  TIMEOUT: 'timeout',
  EXIT: 'exit',
  STATUS: 'status',
  HEADERS: 'headers',
  BODY: 'body',
  STDOUT: 'stdout',
  STDERR: 'stderr',
  MISSING: 'missing',
});

export function splitCommand(command) {
  const text = String(command || '').trim();
  if (!text) return [];
  const out = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\' && i + 1 < text.length) {
        cur += text[++i];
        continue;
      }
      if (ch === quote) {
        quote = null;
        continue;
      }
      cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur) out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

export function isUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

export function redactVolatile(text) {
  return String(text ?? '')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>')
    .replace(/\b\d{4}-\d{2}-\d{2}T[\d.:Z+-]+\b/g, '<ts>');
}

export function canonicalize(text) {
  const raw = String(text ?? '');
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const parsed = JSON.parse(trimmed);
    return `${stableStringify(parsed)}\n`;
  } catch {
    return raw.replace(/\r\n/g, '\n');
  }
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

export function fingerprintId(diffKind, expected, actual) {
  const payload = `${diffKind}\n${redactVolatile(canonicalize(expected))}\n${redactVolatile(canonicalize(actual))}`;
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

export function loadBaseline(file) {
  if (!file || !existsSync(file)) return { accepted: [] };
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    const accepted = Array.isArray(raw) ? raw : Array.isArray(raw.accepted) ? raw.accepted : [];
    return { accepted: accepted.map(normalizeAccepted), path: file };
  } catch (err) {
    throw new Error(`invalid baseline file ${file}: ${err.message}`);
  }
}

function normalizeAccepted(entry) {
  if (typeof entry === 'string') return { id: entry };
  if (entry && typeof entry === 'object') return { id: entry.id || entry.fingerprint, ...entry };
  return { id: String(entry) };
}

export function loadCorpus(dir) {
  if (!dir || !existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`oracle corpus not found: ${dir || '(empty path)'}`);
  }
  const names = readdirSync(dir)
    .filter((n) => !n.startsWith('.') && !n.endsWith('.expected') && n !== 'baseline.json')
    .sort();
  const cases = [];
  for (const name of names) {
    const full = join(dir, name);
    if (!statSync(full).isFile()) continue;
    const raw = readFileSync(full, 'utf8');
    const ext = extname(name).toLowerCase();
    const id = basename(name, ext);
    const sidecar = join(dir, `${id}.expected`);
    const sidecarRaw = existsSync(sidecar) ? readFileSync(sidecar, 'utf8') : null;
    let parsed = null;
    if (ext === '.json') {
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        throw new Error(`corpus case ${name} is not valid JSON: ${err.message}`);
      }
    }
    const c = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { stdin: raw };
    cases.push({
      id: c.id || id,
      args: Array.isArray(c.args) ? c.args.map(String) : [],
      stdin: c.stdin != null ? String(c.stdin) : parsed ? '' : raw,
      method: (c.method || 'POST').toUpperCase(),
      path: c.path || c.url || '',
      headers: c.headers && typeof c.headers === 'object' ? c.headers : {},
      body:
        c.body != null
          ? typeof c.body === 'string'
            ? c.body
            : JSON.stringify(c.body)
          : c.stdin != null
            ? String(c.stdin)
            : parsed
              ? ''
              : raw,
      expected: c.expected != null ? c.expected : sidecarRaw,
      file: name,
    });
  }
  if (!cases.length) throw new Error(`oracle corpus ${dir} has no cases`);
  return cases;
}

function clip(text) {
  const s = String(text ?? '');
  if (s.length <= MAX_OUTPUT) return s;
  return `${s.slice(0, MAX_OUTPUT)}\n…(truncated at ${MAX_OUTPUT} bytes)`;
}

function observationFromCommand(result, kindHint) {
  if (result.error && result.error.code === 'ETIMEDOUT') {
    return {
      ok: false,
      kind: 'timeout',
      timeout: true,
      exit: null,
      stdout: clip(result.stdout),
      stderr: clip(result.stderr),
      status: null,
      headers: {},
      body: '',
      error: 'timeout',
    };
  }
  if (result.error) {
    return {
      ok: false,
      kind: 'error',
      exit: result.status,
      stdout: clip(result.stdout),
      stderr: clip(result.stderr),
      status: null,
      headers: {},
      body: '',
      error: result.error.message,
    };
  }
  return {
    ok: result.status === 0,
    kind: kindHint || 'command',
    exit: result.status,
    stdout: clip(result.stdout),
    stderr: clip(result.stderr),
    status: null,
    headers: {},
    body: clip(result.stdout),
    error: null,
  };
}

export function runCommand(command, cas, { timeoutMs = DEFAULT_TIMEOUT_MS, cwd } = {}) {
  const argv = splitCommand(command);
  if (!argv.length) {
    return {
      ok: false,
      kind: 'error',
      exit: null,
      stdout: '',
      stderr: '',
      status: null,
      headers: {},
      body: '',
      error: 'empty command',
    };
  }
  const args = argv
    .slice(1)
    .concat(cas.args || [])
    .map((a) =>
      String(a)
        .replaceAll('{file}', cas.file || '')
        .replaceAll('{id}', cas.id || '')
        .replaceAll('{input}', cas.stdin || cas.body || ''),
    );
  const result = spawnSync(argv[0], args, {
    cwd,
    input: cas.stdin || cas.body || '',
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: MAX_OUTPUT,
    windowsHide: true,
  });
  return observationFromCommand(result);
}

export async function runUrl(baseUrl, cas, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const root = String(baseUrl).replace(/\/$/, '');
  const suffix = cas.path || '';
  const url = suffix
    ? suffix.startsWith('http')
      ? suffix
      : `${root}${suffix.startsWith('/') ? '' : '/'}${suffix}`
    : root;
  const method = cas.method || 'POST';
  const headers = { ...cas.headers };
  const body = method === 'GET' || method === 'HEAD' ? undefined : cas.body || cas.stdin || '';
  if (body && !headers['content-type'] && !headers['Content-Type']) headers['content-type'] = 'application/json';
  try {
    const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) });
    const text = clip(await res.text());
    const hdrs = {};
    const ct = res.headers.get('content-type');
    if (ct) hdrs['content-type'] = ct.split(';')[0].trim();
    return {
      ok: res.ok,
      kind: 'url',
      exit: null,
      stdout: text,
      stderr: '',
      status: res.status,
      headers: hdrs,
      body: text,
      error: null,
    };
  } catch (err) {
    const timeout = err?.name === 'TimeoutError' || err?.code === 'ABORT_ERR';
    return {
      ok: false,
      kind: timeout ? 'timeout' : 'error',
      timeout,
      exit: null,
      stdout: '',
      stderr: '',
      status: null,
      headers: {},
      body: '',
      error: err.message || String(err),
    };
  }
}

function expectedObservation(cas) {
  if (cas.expected == null) return null;
  const exp = cas.expected;
  if (typeof exp === 'object') {
    return {
      ok: true,
      kind: 'fixture',
      exit: exp.exit ?? exp.statusCode ?? null,
      status: exp.status ?? exp.statusCode ?? null,
      stdout:
        exp.stdout != null
          ? String(exp.stdout)
          : exp.body != null
            ? typeof exp.body === 'string'
              ? exp.body
              : JSON.stringify(exp.body)
            : '',
      stderr: exp.stderr != null ? String(exp.stderr) : '',
      headers: exp.headers || {},
      body:
        exp.body != null
          ? typeof exp.body === 'string'
            ? exp.body
            : JSON.stringify(exp.body)
          : exp.stdout != null
            ? String(exp.stdout)
            : '',
      error: null,
    };
  }
  const text = String(exp);
  try {
    const parsed = JSON.parse(text);
    if (
      parsed &&
      typeof parsed === 'object' &&
      ('stdout' in parsed || 'body' in parsed || 'status' in parsed || 'exit' in parsed)
    ) {
      return expectedObservation({ expected: parsed });
    }
  } catch {
    /* raw */
  }
  return {
    ok: true,
    kind: 'fixture',
    exit: 0,
    status: null,
    stdout: text,
    stderr: '',
    headers: {},
    body: text,
    error: null,
  };
}

export function compareObservations(expected, actual) {
  const diffs = [];
  const push = (diffKind, exp, act) => {
    diffs.push({
      diffKind,
      expected: exp == null ? '' : String(exp),
      actual: act == null ? '' : String(act),
    });
  };
  if (!actual) {
    push(DIFF_KINDS.MISSING, summarize(expected), '');
    return diffs;
  }
  if (actual.timeout || actual.kind === 'timeout') {
    push(DIFF_KINDS.TIMEOUT, summarize(expected), actual.error || 'timeout');
    return diffs;
  }
  if (actual.error && actual.kind === 'error' && !expected?.error) {
    push(DIFF_KINDS.ERROR, summarize(expected), actual.error);
    return diffs;
  }
  if (expected?.status != null && actual.status != null && Number(expected.status) !== Number(actual.status)) {
    push(DIFF_KINDS.STATUS, expected.status, actual.status);
  }
  if (expected?.exit != null && actual.exit != null && Number(expected.exit) !== Number(actual.exit)) {
    push(DIFF_KINDS.EXIT, expected.exit, actual.exit);
  }
  const expHeaders = expected?.headers || {};
  for (const [k, v] of Object.entries(expHeaders)) {
    const got = actual.headers?.[k] ?? actual.headers?.[k.toLowerCase()];
    if (got !== undefined && String(got) !== String(v)) push(DIFF_KINDS.HEADERS, `${k}: ${v}`, `${k}: ${got}`);
  }
  const expBody = canonicalize(expected?.body ?? expected?.stdout ?? '');
  const actBody = canonicalize(actual.body ?? actual.stdout ?? '');
  if (expBody !== actBody) {
    const kind =
      expected?.kind === 'url' || actual.kind === 'url' || expected?.status != null
        ? DIFF_KINDS.BODY
        : DIFF_KINDS.STDOUT;
    push(kind, expected?.body ?? expected?.stdout ?? '', actual.body ?? actual.stdout ?? '');
  }
  const expErr = canonicalize(expected?.stderr ?? '');
  const actErr = canonicalize(actual.stderr ?? '');
  if (expErr && expErr !== actErr) push(DIFF_KINDS.STDERR, expected.stderr, actual.stderr);
  return diffs;
}

function summarize(obs) {
  if (!obs) return '';
  if (obs.status != null) return `HTTP ${obs.status} ${clip(obs.body || obs.stdout || '')}`.trim();
  if (obs.exit != null) return `exit ${obs.exit}\n${clip(obs.stdout || '')}`.trim();
  return clip(obs.body || obs.stdout || obs.error || '');
}

function classifyOracle(value, cwd) {
  const v = String(value || '').trim();
  if (!v) return { type: 'empty' };
  if (isUrl(v)) return { type: 'url', value: v };
  const path = isAbsolute(v) ? v : resolve(cwd, v);
  if (existsSync(path) && statSync(path).isDirectory()) return { type: 'fixtures', value: path };
  return { type: 'command', value: v };
}

export async function runCase(spec, cas, { timeoutMs, cwd, runner } = {}) {
  if (runner) return runner(spec, cas);
  if (spec.type === 'url') return runUrl(spec.value, cas, { timeoutMs });
  if (spec.type === 'command') return runCommand(spec.value, cas, { timeoutMs, cwd });
  if (spec.type === 'fixtures') return expectedObservation(cas);
  return {
    ok: false,
    kind: 'error',
    error: `unknown oracle type ${spec.type}`,
    stdout: '',
    stderr: '',
    body: '',
    headers: {},
    status: null,
    exit: null,
  };
}

/**
 * @returns {Promise<{ findings, clusters, newCount, baselinedCount, compared, runLog, blocked, exitCode }>}
 */
export async function runOracle(projectRoot, options = {}) {
  const cwd = projectRoot;
  const oracle = classifyOracle(options.oracle, cwd);
  const candidate = options.candidate ? classifyOracle(options.candidate, cwd) : null;
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : DEFAULT_TIMEOUT_MS;

  if (oracle.type === 'empty') throw new Error('pass --oracle <cmd|url|fixtures-dir>');
  if (oracle.type !== 'fixtures' && !candidate) {
    throw new Error('pass --candidate <cmd|url> (required unless --oracle is a recorded fixture directory)');
  }
  if (candidate && candidate.type === 'fixtures') {
    throw new Error('--candidate must be a command or URL, not a directory');
  }

  const corpusDir = options.corpus
    ? isAbsolute(options.corpus)
      ? options.corpus
      : resolve(cwd, options.corpus)
    : oracle.type === 'fixtures'
      ? oracle.value
      : resolve(cwd, DEFAULT_CORPUS);

  const cases = loadCorpus(corpusDir);
  const baselinePath = options.baseline
    ? isAbsolute(options.baseline)
      ? options.baseline
      : resolve(cwd, options.baseline)
    : resolve(cwd, DEFAULT_BASELINE);
  const baseline = loadBaseline(existsSync(baselinePath) ? baselinePath : null);
  const accepted = new Set((baseline.accepted || []).map((a) => a.id).filter(Boolean));

  const findings = [];
  const compared = [];

  for (const cas of cases) {
    let expected;
    let actual;
    if (oracle.type === 'fixtures') {
      expected = expectedObservation(cas);
      if (!expected) {
        findings.push({
          input: cas.id,
          expected: '',
          actual: '',
          diffKind: DIFF_KINDS.MISSING,
          id: fingerprintId(DIFF_KINDS.MISSING, cas.id, ''),
          caseId: cas.id,
          detail: 'fixture case has no expected output',
        });
        continue;
      }
      actual = await runCase(candidate, cas, { timeoutMs, cwd, runner: options.runner });
    } else {
      expected = await runCase(oracle, cas, { timeoutMs, cwd, runner: options.runner });
      actual = await runCase(candidate, cas, { timeoutMs, cwd, runner: options.runner });
    }
    compared.push({ id: cas.id });
    const diffs = compareObservations(expected, actual);
    for (const d of diffs) {
      const id = fingerprintId(d.diffKind, d.expected, d.actual);
      findings.push({
        input: cas.id,
        expected: d.expected,
        actual: d.actual,
        diffKind: d.diffKind,
        id,
        caseId: cas.id,
        baselined: accepted.has(id),
      });
    }
  }

  const clusters = aggregate(findings);
  const newCount = findings.filter((f) => !f.baselined).length;
  const baselinedCount = findings.filter((f) => f.baselined).length;

  const runId = options.runId || new Date().toISOString().replace(/[:.]/g, '-');
  const logDir = resolve(cwd, '.rune', 'oracle');
  let runLog = null;
  if (options.writeLog !== false) {
    try {
      mkdirSync(logDir, { recursive: true });
      runLog = join(logDir, `run-${runId}.jsonl`);
      const lines = findings.map((f) => JSON.stringify(f));
      writeFileSync(runLog, lines.length ? `${lines.join('\n')}\n` : '');
    } catch {
      runLog = null;
    }
  }

  return {
    findings,
    clusters,
    newCount,
    baselinedCount,
    compared: compared.length,
    runLog,
    blocked: newCount > 0,
    exitCode: newCount > 0 ? 2 : 0,
    baselinePath,
    corpusDir,
  };
}

export function aggregate(findings) {
  const map = new Map();
  for (const f of findings) {
    const key = f.id || fingerprintId(f.diffKind, f.expected, f.actual);
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        diffKind: f.diffKind,
        expected: f.expected,
        actual: f.actual,
        cases: [],
        baselined: Boolean(f.baselined),
      });
    }
    const c = map.get(key);
    c.cases.push(f.input || f.caseId);
    c.baselined = c.baselined && Boolean(f.baselined);
  }
  return [...map.values()].sort((a, b) => b.cases.length - a.cases.length || a.diffKind.localeCompare(b.diffKind));
}

export function formatOracleReport(result, { json = false } = {}) {
  if (json) {
    return `${JSON.stringify({ compared: result.compared, newCount: result.newCount, baselinedCount: result.baselinedCount, clusters: result.clusters, findings: result.findings, runLog: result.runLog }, null, 2)}\n`;
  }
  const lines = [];
  if (!result.findings.length) {
    lines.push(`oracle: clean — ${result.compared} case(s) matched the reference.`);
    return `${lines.join('\n')}\n`;
  }
  lines.push(
    `oracle: ${result.compared} compared, ${result.newCount} new divergence(s), ${result.baselinedCount} baselined${result.blocked ? '  (exit 2)' : ''}`,
  );
  lines.push('');
  for (const c of result.clusters) {
    const tag = c.baselined ? 'BASE' : 'NEW ';
    lines.push(
      `${tag}  ${c.diffKind.padEnd(10)} ${c.id}  (${c.cases.length} case${c.cases.length === 1 ? '' : 's'}: ${c.cases.join(', ')})`,
    );
    lines.push(`      expected: ${oneLine(c.expected)}`);
    lines.push(`      actual:   ${oneLine(c.actual)}`);
  }
  if (result.blocked) {
    lines.push('');
    lines.push(
      'New divergences are not baselined. Fix the candidate, or add the fingerprint id to the baseline file after human review:',
    );
    lines.push(`  ${result.baselinePath}`);
  }
  if (result.runLog) lines.push(`Log: ${result.runLog}`);
  return `${lines.join('\n')}\n`;
}

function oneLine(s) {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}
