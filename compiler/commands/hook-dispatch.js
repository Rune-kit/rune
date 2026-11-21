/**
 * `rune hook-dispatch <skill> [--gentle]`
 *
 * Runtime dispatcher invoked by Claude Code hooks. Reads event JSON from stdin,
 * validates the skill name against an allowlist, then forwards to the skill's
 * execution (currently a no-op placeholder that emits a verdict line — skill
 * invocation wiring happens when skills gain a headless mode).
 *
 * In gentle mode: always exits 0, prints advisory line (stderr).
 * In strict mode: exits 2 on BLOCK verdict (Claude Code, Cursor, Gemini CLI and
 * Grok all treat exit 2 as "block").
 *
 * Output contract (`--format`):
 *   - claude (default): stdout stays EMPTY, advisory goes to stderr. Cursor
 *     imports `.claude/settings.json` hooks and treats non-JSON stdout from a
 *     permission hook as "block", so a plain-text line here would stall edits
 *     in Cursor; empty stdout is a no-op in Claude Code and Grok.
 *   - cursor: stdout is one JSON object — `{"permission":"allow"}` for
 *     Cursor's permission hooks (preToolUse, beforeShellExecution,
 *     beforeMCPExecution, beforeReadFile, subagentStart — and any event it
 *     can't identify), `{}` for known non-permission events.
 *     (cursor.com/docs/hooks: invalid JSON from a permission hook blocks.)
 *   - gemini: stdout is `{}` — Gemini CLI parses stdout as JSON and shows any
 *     plain text as a system message (geminicli docs/hooks "Golden Rule").
 *
 * Security:
 *   - Skill name MUST match the allowlist (no arbitrary shell injection)
 *   - Event payload is parsed but never passed to shell commands
 *   - Unknown skills fail closed (error in strict, warn in gentle)
 */

import { WIRED_SKILLS } from './hooks/presets.js';

const ALLOWLIST = new Set(WIRED_SKILLS);
export const FORMATS = Object.freeze(['claude', 'cursor', 'gemini']);
// Cursor events whose output is NOT a permission decision. Anything else —
// including a missing/unparsed hook_event_name (stdin cut off by the 500 ms
// safety timeout, malformed payload) — gets the permission form, because a
// permission hook blocks on `{}` while the other events ignore extra fields.
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
]);

function readFormat(argv) {
  const idx = argv.findIndex((a) => a === '--format' || a.startsWith('--format='));
  if (idx === -1) return 'claude';
  const value = argv[idx].includes('=') ? argv[idx].split('=')[1] : argv[idx + 1];
  return FORMATS.includes(value) ? value : 'claude';
}

/** JSON (or nothing) a runtime expects on stdout for a non-blocking result. */
export function passThroughOutput(format, eventName) {
  if (format === 'cursor') return CURSOR_NON_PERMISSION_EVENTS.has(eventName) ? '{}\n' : '{"permission":"allow"}\n';
  if (format === 'gemini') return '{}\n';
  return '';
}

/**
 * @param {string[]} argv — positional args after `hook-dispatch`
 * @param {{stdin?: NodeJS.ReadableStream, stdout?: NodeJS.WritableStream, stderr?: NodeJS.WritableStream}} io
 * @returns {Promise<number>} exit code
 */
export async function dispatchHook(argv, io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const stdin = io.stdin || process.stdin;

  const format = readFormat(argv);
  const formatValueIdx = argv.indexOf('--format');
  const positional = argv.filter((a, i) => !a.startsWith('--') && !(formatValueIdx !== -1 && i === formatValueIdx + 1));
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

  // Read event JSON from stdin (best-effort; hooks may pass empty stdin)
  let eventJson = {};
  try {
    const raw = await readStdin(stdin);
    if (raw.trim()) eventJson = JSON.parse(raw);
  } catch {
    // Non-JSON stdin is tolerable — skills may not need the payload
  }

  // Skill invocation placeholder — skills don't yet expose a headless API.
  // For v1: emit advisory line, pass through. This unblocks hook installation
  // while skill-forge adds `--hook-mode` to preflight/sentinel/etc.
  const mode = gentle ? 'advisory' : 'enforcing';
  stderr.write(`rune-hook: ${skill} [${mode}] — tool=${eventJson?.tool_name || 'unknown'}\n`);
  const out = passThroughOutput(format, eventJson?.hook_event_name);
  if (out) stdout.write(out);

  // Until skills expose headless verdicts, dispatcher returns neutral success.
  // When skills add `--hook-mode`, extend this to run them and propagate exit codes.
  return 0;
}

function readStdin(stream) {
  return new Promise((resolve, reject) => {
    if (stream.isTTY) {
      resolve('');
      return;
    }
    let buf = '';
    stream.setEncoding('utf-8');
    stream.on('data', (chunk) => {
      buf += chunk;
      if (buf.length > 1_000_000) {
        stream.destroy();
        reject(new Error('stdin too large'));
      }
    });
    stream.on('end', () => resolve(buf));
    stream.on('error', reject);
    // Safety timeout — don't block Claude Code indefinitely
    setTimeout(() => resolve(buf), 500);
  });
}
