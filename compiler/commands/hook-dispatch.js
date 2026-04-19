/**
 * `rune hook-dispatch <skill> [--gentle]`
 *
 * Runtime dispatcher invoked by Claude Code hooks. Reads event JSON from stdin,
 * validates the skill name against an allowlist, then forwards to the skill's
 * execution (currently a no-op placeholder that emits a verdict line — skill
 * invocation wiring happens when skills gain a headless mode).
 *
 * In gentle mode: always exits 0, prints advisory line.
 * In strict mode: exits 2 on BLOCK verdict (Claude Code blocks the tool call).
 *
 * Security:
 *   - Skill name MUST match the allowlist (no arbitrary shell injection)
 *   - Event payload is parsed but never passed to shell commands
 *   - Unknown skills fail closed (error in strict, warn in gentle)
 */

import { WIRED_SKILLS } from './hooks/presets.js';

const ALLOWLIST = new Set(WIRED_SKILLS);

/**
 * @param {string[]} argv — positional args after `hook-dispatch`
 * @param {{stdin?: NodeJS.ReadableStream, stdout?: NodeJS.WritableStream, stderr?: NodeJS.WritableStream}} io
 * @returns {Promise<number>} exit code
 */
export async function dispatchHook(argv, io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const stdin = io.stdin || process.stdin;

  const positional = argv.filter((a) => !a.startsWith('--'));
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
  stdout.write(`rune-hook: ${skill} [${mode}] — tool=${eventJson?.tool_name || 'unknown'}\n`);

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
