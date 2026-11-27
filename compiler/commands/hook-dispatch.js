/**
 * `rune hook-dispatch <skill> [--gentle] [--format claude|cursor|gemini|antigravity] [--event <Event>]`
 *
 * Runtime dispatcher behind every hook that `rune hooks install` / `rune setup`
 * writes (Claude `.claude/settings.json`, Codex, Cursor, Grok Build, Gemini).
 * It reads the event JSON from stdin, validates the skill name against an
 * allowlist, runs the gate that backs that skill, and translates the verdict
 * into the exit code + stdout contract of the calling runtime.
 *
 * Skill → gate:
 *   preflight         → hooks/pre-tool-guard   (privacy mesh: BLOCK private keys/certs, WARN .env/credentials)
 *                       + test-integrity       (BLOCK weakened/skipped/expected-changed tests and frozen-path edits)
 *                       + junk-match           (BLOCK tautological / empty-snapshot tests; warn on mock-echo / catch-all / status-only)
 *                       + project lints        (`.rune/lints/rules.json` from `rune verify --reflect`)
 *   sentinel          → hooks/secrets-scan     (BLOCK `git commit` when staged files hold high-confidence secrets)
 *                       + test-integrity       (same check on the staged test-file diff)
 *                       + junk-match + lints   (same checks on the staged diff)
 *   quarantine        → hooks/quarantine       (advisory: untrusted MCP / web / upload content)
 *   dependency-doctor → built-in               (advisory: a dependency manifest was edited)
 *   completion-gate   → built-in               (advisory: uncommitted changes at turn end — verify first)
 *
 * Presets:
 *   - strict: a BLOCK verdict blocks — exit 2 (Claude Code, Codex, Cursor,
 *     Gemini CLI and Grok Build all treat exit 2 as "block"), plus the
 *     runtime's deny JSON where it has one.
 *   - gentle (`--gentle`): never blocks — a would-be BLOCK is reported as an
 *     advisory on stderr and the call goes through.
 *   Only preflight and sentinel can block. quarantine, dependency-doctor and
 *   completion-gate are advisory in both presets (a blocking Stop hook loops).
 *
 * Output contract (`--format`):
 *   - claude (default; also Codex and Grok Build `.grok/hooks`): the gate's own
 *     JSON envelope (`systemMessage` / `hookSpecificOutput`) is forwarded on
 *     stdout; a block reason goes to stderr (the channel Claude shows the model).
 *   - cursor: stdout is exactly one JSON object. Permission events get
 *     `{"permission":"allow"|"deny", …}` (invalid JSON from a Cursor permission
 *     hook blocks); postToolUse gets `{"additional_context": …}` when a gate
 *     has advice, every other event `{}`.
 *   - gemini: stdout is exactly one JSON object (Gemini shows plain text as a
 *     system message): the gate envelope, `{"decision":"deny","reason":…}` on
 *     a block, or `{}`.
 *   - antigravity (`.agents/hooks.json`, needs `--event <Event>` because the
 *     payload carries no event name): PreToolUse answers
 *     `{"decision":"allow"|"deny","reason"}`, Stop `{"decision":"allow"}`,
 *     PostToolUse `{}`; advisories go to stderr.
 *
 * Failure policy: a gate that crashes or times out fails OPEN (the call runs)
 * with a note on stderr — a broken hook must never wedge the agent.
 *
 * Security:
 *   - Skill name MUST match the allowlist (no arbitrary shell injection)
 *   - The payload is passed to the gate on stdin only, never to a shell
 *   - Unknown skills fail closed (error in strict, warn in gentle)
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runJunkForEvent } from '../lib/junk-match.js';
import { runIntegrityForEvent } from '../lib/test-integrity.js';
import { runLintsForEvent } from '../lib/verify-lints.js';
import { WIRED_SKILLS } from './hooks/presets.js';

const ALLOWLIST = new Set(WIRED_SKILLS);
export const FORMATS = Object.freeze(['claude', 'cursor', 'gemini', 'antigravity']);

const RUN_HOOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../hooks/run-hook.cjs');
const GATE_TIMEOUT_MS = 20_000;
const MAX_STDIN = 1_000_000;

/** Skills backed by a script in `hooks/<name>/index.cjs`. */
export const SKILL_SCRIPTS = Object.freeze({
  preflight: 'pre-tool-guard',
  sentinel: 'secrets-scan',
  quarantine: 'quarantine',
});

/** Skills whose verdict may block (strict preset only). */
export const BLOCKING_SKILLS = Object.freeze(new Set(['preflight', 'sentinel']));

/** Dependency manifests that dependency-doctor watches. */
const MANIFESTS = new Set([
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'Pipfile',
  'go.mod',
  'Cargo.toml',
  'Gemfile',
  'composer.json',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'pubspec.yaml',
]);

// Cursor events whose output is NOT a permission decision. Anything else —
// including a missing/unparsed hook_event_name — gets the permission form,
// because a permission hook blocks on `{}` while the other events ignore it.
const CURSOR_NON_PERMISSION_EVENTS = new Set([
  'postToolUse',
  'postToolUseFailure',
  'afterShellExecution',
  'afterMCPExecution',
  'afterFileEdit',
  'afterAgentResponse',
  'afterAgentThought',
  'stop',
  'subagentStop',
  'sessionStart',
  'sessionEnd',
  'preCompact',
  'beforeSubmitPrompt',
  'afterTabFileEdit',
  'workspaceOpen',
  // Grok Build runs Cursor-file hooks and may report its own (Claude-cased) names.
  'PostToolUse',
  'PostToolUseFailure',
  'Stop',
  'SubagentStop',
  'SessionStart',
  'SessionEnd',
  'PreCompact',
  'UserPromptSubmit',
]);

function readFlag(argv, name) {
  const idx = argv.findIndex((a) => a === name || a.startsWith(`${name}=`));
  if (idx === -1) return { value: undefined, valueIdx: -1 };
  if (argv[idx].includes('=')) return { value: argv[idx].split('=')[1], valueIdx: -1 };
  return { value: argv[idx + 1], valueIdx: idx + 1 };
}

function readFormat(argv) {
  const { value } = readFlag(argv, '--format');
  return FORMATS.includes(value) ? value : 'claude';
}

/** Antigravity tool names → the Claude names the gates understand. */
const ANTIGRAVITY_TOOLS = Object.freeze({
  run_command: 'Bash',
  view_file: 'Read',
  write_to_file: 'Write',
  replace_file_content: 'Edit',
  multi_replace_file_content: 'Edit',
  read_url_content: 'WebFetch',
  search_web: 'WebSearch',
});

/** JSON (or nothing) a runtime expects on stdout for a non-blocking result. */
export function passThroughOutput(format, eventName) {
  if (format === 'antigravity') {
    return eventName === 'PreToolUse' || eventName === 'Stop' ? '{"decision":"allow"}\n' : '{}\n';
  }
  if (format === 'cursor') return CURSOR_NON_PERMISSION_EVENTS.has(eventName) ? '{}\n' : '{"permission":"allow"}\n';
  if (format === 'gemini') return '{}\n';
  return '';
}

/**
 * Normalize runtime-specific payloads into the Claude shape the gates read
 * (`tool_name` + `tool_input.{file_path,command}`). Cursor's
 * beforeShellExecution / afterFileEdit put `command` / `file_path` at the top
 * level; Gemini uses `tool_input` like Claude.
 */
export function normalizeEvent(event) {
  const e = event && typeof event === 'object' && !Array.isArray(event) ? { ...event } : {};
  // Antigravity: { toolCall: { name, args: { CommandLine | TargetFile | AbsolutePath } } }
  if (e.toolCall && typeof e.toolCall === 'object' && !e.tool_input) {
    const name = String(e.toolCall.name || '');
    const args = e.toolCall.args || {};
    const input = {};
    if (typeof args.CommandLine === 'string') input.command = args.CommandLine;
    const file = args.TargetFile || args.AbsolutePath;
    if (typeof file === 'string') input.file_path = file;
    if (typeof args.Url === 'string') input.url = args.Url;
    e.tool_name = ANTIGRAVITY_TOOLS[name] || (name.startsWith('mcp_') ? `mcp__${name.slice(4)}` : name);
    e.tool_input = input;
  }
  if (!e.tool_input || typeof e.tool_input !== 'object') {
    const input = {};
    if (typeof e.command === 'string') input.command = e.command;
    if (typeof e.file_path === 'string') input.file_path = e.file_path;
    else if (typeof e.path === 'string') input.file_path = e.path;
    e.tool_input = input;
  } else if (!e.tool_input.file_path && typeof e.tool_input.path === 'string') {
    e.tool_input = { ...e.tool_input, file_path: e.tool_input.path };
  }
  if (!e.tool_name) {
    if (e.tool_input.command) e.tool_name = 'Bash';
    else if (e.tool_input.file_path) e.tool_name = 'Write';
  }
  return e;
}

/** Pull the human-readable message out of a gate's stdout envelope. */
function envelopeText(stdout) {
  const env = parseJson(stdout);
  if (!env) return '';
  return env.systemMessage || env.hookSpecificOutput?.additionalContext || env.reason || '';
}

function parseJson(text) {
  const t = (text || '').trim();
  if (!t.startsWith('{')) return null;
  try {
    return JSON.parse(t.split('\n').filter(Boolean).pop());
  } catch {
    return null;
  }
}

/** Run a script gate. @returns {{status:number|null, stdout:string, stderr:string, error?:string}} */
function runScriptGate(script, event, cwd) {
  const res = spawnSync(process.execPath, [RUN_HOOK, script], {
    input: JSON.stringify(event),
    cwd,
    env: process.env,
    encoding: 'utf-8',
    timeout: GATE_TIMEOUT_MS,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (res.error) return { status: null, stdout: '', stderr: '', error: res.error.message };
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

function advisoryEnvelope(eventName, text) {
  return { status: 0, stdout: `${JSON.stringify({ systemMessage: text })}\n`, stderr: '', eventName };
}

/** dependency-doctor: a dependency manifest was edited → remind to sync the lockfile. */
function dependencyGate(event) {
  const file = event.tool_input?.file_path;
  if (!file || !MANIFESTS.has(path.basename(String(file)))) return { status: 0, stdout: '', stderr: '' };
  return advisoryEnvelope(
    'PostToolUse',
    `[Rune dependency-doctor] ${path.basename(String(file))} changed — reinstall so the lockfile matches, and run rune:dependency-doctor before committing a new or upgraded dependency.`,
  );
}

/** completion-gate: uncommitted source changes at turn end → verify before claiming done. */
function completionGate(event, cwd) {
  if (event.stop_hook_active) return { status: 0, stdout: '', stderr: '' };
  let changed = [];
  try {
    changed = execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf-8', timeout: 5000 })
      .split('\n')
      .filter(Boolean);
  } catch {
    return { status: 0, stdout: '', stderr: '' };
  }
  if (changed.length === 0) return { status: 0, stdout: '', stderr: '' };
  return advisoryEnvelope(
    'Stop',
    `[Rune completion-gate] ${changed.length} uncommitted change(s). Before calling this done: run the tests/build (rune:verification) and show the evidence.`,
  );
}

function crash(gate) {
  return !gate || (gate.status !== 0 && gate.status !== 2);
}

/**
 * Combine two gate results. A BLOCK from either wins; advisories are
 * concatenated. A crash in one gate does not discard a real verdict from the
 * other; only when both crash do we fail open.
 */
export function mergeGates(a, b) {
  const aCrash = crash(a);
  const bCrash = crash(b);
  if (aCrash && bCrash) {
    return a || b || { status: null, stdout: '', stderr: '', error: 'gate failed' };
  }
  const usable = [a, b].filter((g) => g && !crash(g));
  const blocks = usable.filter((g) => g.status === 2);
  const chosen = blocks.length ? blocks : usable;
  const messages = [];
  const stderrs = [];
  for (const g of chosen) {
    if (g.stderr?.trim()) stderrs.push(g.stderr.trim());
    const text = envelopeText(g.stdout);
    if (text) messages.push(text);
  }
  const lead = blocks[0] || usable[0] || a || b;
  return {
    status: blocks.length ? 2 : 0,
    stdout: messages.length
      ? `${JSON.stringify({ systemMessage: messages.join('\n'), hookSpecificOutput: { hookEventName: 'PreToolUse' } })}\n`
      : lead?.stdout || '',
    stderr: stderrs.join('\n'),
    override: a?.override || b?.override,
    result: [a, b].find((g) => g?.result?.blocked)?.result || a?.result || b?.result,
    error: aCrash ? a?.error : bCrash ? b?.error : undefined,
  };
}

function runVerifyGates(event, cwd) {
  return mergeGates(
    mergeGates(runIntegrityForEvent(event, cwd), runJunkForEvent(event, cwd)),
    runLintsForEvent(event, cwd),
  );
}

function runGate(skill, event, cwd) {
  if (skill === 'preflight') {
    return mergeGates(runScriptGate(SKILL_SCRIPTS.preflight, event, cwd), runVerifyGates(event, cwd));
  }
  if (skill === 'sentinel') {
    return mergeGates(runScriptGate(SKILL_SCRIPTS.sentinel, event, cwd), runVerifyGates(event, cwd));
  }
  if (SKILL_SCRIPTS[skill]) return runScriptGate(SKILL_SCRIPTS[skill], event, cwd);
  if (skill === 'dependency-doctor') return dependencyGate(event);
  if (skill === 'completion-gate') return completionGate(event, cwd);
  return { status: 0, stdout: '', stderr: '' };
}

/**
 * Translate a gate result into { code, stdout, stderr } for the runtime.
 * Exported for tests.
 */
export function translate({ skill, format, gentle, eventName, gate }) {
  const out = { code: 0, stdout: '', stderr: '' };

  if (gate.status === null || (gate.status !== 0 && gate.status !== 2)) {
    // Gate crashed / timed out → fail open.
    out.stderr = `rune-hook: ${skill} gate failed (${gate.error || `exit ${gate.status}`}) — allowing\n`;
    out.stdout = passThroughOutput(format, eventName);
    return out;
  }

  const blocked = gate.status === 2 && BLOCKING_SKILLS.has(skill);
  const reason = (gate.stderr.trim() || envelopeText(gate.stdout) || `${skill} blocked this action`).trim();

  if (blocked && !gentle) {
    out.code = 2;
    out.blocked = true;
    out.stderr = `${reason}\n`;
    if (format === 'antigravity') {
      // Antigravity reads the decision from stdout; exit 0 so it is not mistaken for a hook error.
      out.code = 0;
      out.stdout = `${JSON.stringify({ decision: 'deny', reason })}\n`;
    } else if (format === 'cursor') {
      out.stdout = CURSOR_NON_PERMISSION_EVENTS.has(eventName)
        ? '{}\n'
        : `${JSON.stringify({ permission: 'deny', user_message: reason, agent_message: reason })}\n`;
    } else if (format === 'gemini') {
      out.stdout = `${JSON.stringify({ decision: 'deny', reason })}\n`;
    } else {
      out.stdout = `${JSON.stringify({ systemMessage: reason, hookSpecificOutput: { hookEventName: 'PreToolUse' } })}\n`;
    }
    return out;
  }

  if (blocked && gentle) {
    out.stderr = `rune-hook: ${skill} [advisory] would block (strict preset): ${reason}\n`;
    out.stdout = passThroughOutput(format, eventName);
    return out;
  }

  // Allowed — forward any advisory the gate produced.
  const message = envelopeText(gate.stdout);
  const envelope = parseJson(gate.stdout);
  if (format === 'antigravity') {
    out.stdout = passThroughOutput(format, eventName);
    if (message) out.stderr = `${message}\n`;
  } else if (format === 'cursor') {
    if (CURSOR_NON_PERMISSION_EVENTS.has(eventName)) {
      // Only postToolUse takes `additional_context`; other events have no
      // model-facing field, so the advisory goes to stderr.
      // Cursor reads `additional_context`; Grok Build reads `hookSpecificOutput.additionalContext`.
      if (message && (eventName === 'postToolUse' || eventName === 'PostToolUse')) {
        out.stdout = `${JSON.stringify({
          additional_context: message,
          hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: message },
        })}\n`;
      } else {
        out.stdout = '{}\n';
        if (message) out.stderr = `${message}\n`;
      }
    } else {
      out.stdout = '{"permission":"allow"}\n';
      if (message) out.stderr = `${message}\n`;
    }
  } else if (format === 'gemini') {
    out.stdout = envelope ? `${JSON.stringify(envelope)}\n` : '{}\n';
  } else if (envelope) {
    out.stdout = `${JSON.stringify(envelope)}\n`;
  }
  return out;
}

/**
 * @param {string[]} argv — positional args after `hook-dispatch`
 * @param {{stdin?: NodeJS.ReadableStream, stdout?: NodeJS.WritableStream, stderr?: NodeJS.WritableStream, cwd?: string}} io
 * @returns {Promise<number>} exit code
 */
export async function dispatchHook(argv, io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const cwd = io.cwd || process.cwd();

  const format = readFormat(argv);
  const valueIdx = new Set([readFlag(argv, '--format').valueIdx, readFlag(argv, '--event').valueIdx]);
  const positional = argv.filter((a, i) => !a.startsWith('--') && !valueIdx.has(i));
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const skill = positional[0];
  const gentle = flags.has('--gentle');

  if (!skill) {
    stderr.write('rune hook-dispatch: missing skill name\n');
    return gentle ? 0 : 1;
  }

  if (!ALLOWLIST.has(skill)) {
    stderr.write(`rune hook-dispatch: unknown skill "${skill}"\n`);
    return gentle ? 0 : 1;
  }

  // Read stdin. Synchronously when it is the real process stdin — Claude Code
  // discards the output of hooks that settle stdin asynchronously (see
  // hooks/lib/hook-stdin.cjs).
  let raw = '';
  try {
    raw = io.stdin ? await readStream(io.stdin) : readFileSync(0, 'utf-8');
  } catch {
    raw = '';
  }
  if (raw.length > MAX_STDIN) raw = '';

  let eventJson = {};
  try {
    if (raw.trim()) eventJson = JSON.parse(raw);
  } catch {
    // Non-JSON stdin is tolerable — gates treat an empty payload as "nothing to check"
  }
  const eventName = eventJson?.hook_event_name || readFlag(argv, '--event').value;
  const event = normalizeEvent(eventJson);

  const gate = runGate(skill, event, cwd);
  const result = translate({ skill, format, gentle, eventName, gate });

  const mode = gentle ? 'advisory' : 'enforcing';
  const verdict = result.blocked ? 'BLOCK' : 'pass';
  const outcome =
    gate.override && gate.result?.blocked && !result.blocked ? 'overridden' : gateOutcome(skill, gate, result, gentle);
  recordGateOutcome(cwd, {
    gate: skill,
    outcome,
    mode,
    tool: event.tool_name || null,
    event: eventName || null,
    ...(gate.override ? { override: gate.override } : {}),
    ...(gate.result?.blocked ? { rules: [...new Set((gate.result.high || []).map((f) => f.rule))] } : {}),
  });
  stderr.write(`rune-hook: ${skill} [${mode}] ${verdict} — tool=${event.tool_name || 'unknown'}\n`);
  if (result.stderr) stderr.write(result.stderr);
  if (result.stdout) stdout.write(result.stdout);
  return result.code;
}

export const GATE_LOG_REL = path.join('.rune', 'metrics', 'gate-outcomes.jsonl');
const GATE_LOG_MAX_LINES = 2000;

/**
 * Classify a dispatch for the governance log (Business Govern tab):
 *   blocked  — strict preset stopped the tool call
 *   bypassed — gentle preset: the gate would have blocked, the call went through
 *   passed   — gate ran and allowed the call
 *   error    — gate crashed / timed out (fail-open)
 * Exported for tests.
 */
export function gateOutcome(skill, gate, result, gentle) {
  if (gate.status === null || (gate.status !== 0 && gate.status !== 2)) return 'error';
  if (result.blocked) return 'blocked';
  if (gate.status === 2 && BLOCKING_SKILLS.has(skill) && gentle) return 'bypassed';
  return 'passed';
}

/**
 * Append one verdict to `.rune/metrics/gate-outcomes.jsonl` (the file
 * governance-collector reads). Best-effort: never throws, never changes the
 * exit code. Passes are only logged in projects that already have `.rune/`
 * so a stray hook never litters an unrelated repo; blocks and bypasses are
 * always logged. `RUNE_GATE_LOG=0` turns logging off.
 */
export function recordGateOutcome(cwd, record) {
  try {
    if (process.env.RUNE_GATE_LOG === '0') return false;
    const hasRuneDir = existsSync(path.join(cwd, '.rune'));
    if (!hasRuneDir && (record.outcome === 'passed' || record.outcome === 'error')) return false;
    const file = path.join(cwd, GATE_LOG_REL);
    mkdirSync(path.dirname(file), { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), source: 'hook-dispatch', ...record });
    appendFileSync(file, `${line}\n`);
    const lines = readFileSync(file, 'utf-8').split('\n').filter(Boolean);
    if (lines.length > GATE_LOG_MAX_LINES) writeFileSync(file, `${lines.slice(-GATE_LOG_MAX_LINES).join('\n')}\n`);
    return true;
  } catch {
    return false;
  }
}

function readStream(stream) {
  return new Promise((resolve, reject) => {
    if (stream.isTTY) {
      resolve('');
      return;
    }
    let buf = '';
    stream.setEncoding?.('utf-8');
    stream.on('data', (chunk) => {
      buf += chunk;
      if (buf.length > MAX_STDIN) {
        stream.destroy();
        resolve('');
      }
    });
    stream.on('end', () => resolve(buf));
    stream.on('error', reject);
    setTimeout(() => resolve(buf), 500);
  });
}
