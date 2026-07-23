'use strict';

// Hook stdout envelope — the one format both runtimes accept.
//
// Claude Code tolerates bare text on a hook's stdout. Codex CLI does not: it
// parses stdout as its `HookUniversalOutputWire` JSON and reports anything else
// as `hook: <Event> Failed`, discarding the output. Every Rune hook that printed
// a plain `[Rune: ...]` line was therefore failing on Codex — the hooks loaded,
// ran, exited 0, and had their output thrown away.
//
// Both runtimes accept the same envelope, so emitting it is not a Codex-specific
// branch — it is simply the correct output contract:
//
//   {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"…"}}
//   {"systemMessage":"…"}
//
// Verified against codex-cli 0.145 (schema read from the binary: decision,
// reason, continue, stopReason, suppressOutput, systemMessage, and
// hookSpecificOutput.{hookEventName,additionalContext,permissionDecision,…};
// unknown keys are rejected) and Claude Code's documented hook output.
//
// Buffer-then-emit, because the envelope is ONE JSON object: a hook that prints
// three lines must accumulate them and emit once at exit, not three times.

/** Events where the model-facing payload is `additionalContext`. */
const CONTEXT_EVENTS = new Set(['SessionStart', 'UserPromptSubmit']);

/**
 * Collects a hook's output and emits a single valid envelope.
 *
 * @param {string} hookEventName  Claude/Codex event name, e.g. 'SessionStart'
 * @returns {{line: (text: string) => void, emit: () => void, isEmpty: () => boolean}}
 */
function outputBuffer(hookEventName) {
  const parts = [];
  return {
    /** Queue one line of output. Empty/blank input is ignored. */
    line(text) {
      if (typeof text !== 'string') return;
      const trimmed = text.replace(/\s+$/, '');
      if (trimmed.trim()) parts.push(trimmed);
    },
    isEmpty() {
      return parts.length === 0;
    },
    /** Write the envelope. Emits nothing at all when there is nothing to say. */
    emit() {
      if (parts.length === 0) return;
      const text = parts.join('\n');
      const payload = CONTEXT_EVENTS.has(hookEventName)
        ? { hookSpecificOutput: { hookEventName, additionalContext: text } }
        : { systemMessage: text };
      process.stdout.write(`${JSON.stringify(payload)}\n`);
    },
  };
}

/**
 * One-shot form for hooks with a single message.
 *
 * @param {string} hookEventName
 * @param {string} text
 */
function emit(hookEventName, text) {
  const buf = outputBuffer(hookEventName);
  buf.line(text);
  buf.emit();
}

/**
 * Route a hook's existing `console.log` calls into one envelope.
 *
 * Hooks build their message across many prints and several early `process.exit`
 * paths. Rewriting each print site into an explicit buffer would mean touching
 * every branch — and missing one silently reintroduces the bare-text bug. So
 * capture at the boundary instead: the message logic stays exactly as written,
 * and the envelope is emitted once on exit no matter which branch got there.
 *
 * `console.error` is untouched — stderr is not parsed as the output contract.
 *
 * @param {string} hookEventName
 * @param {{captureError?: boolean}} [options]
 * @returns {{buffer: ReturnType<typeof outputBuffer>, restore: () => void}}
 */
function captureConsole(hookEventName, options = {}) {
  const buffer = outputBuffer(hookEventName);
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args) => {
    buffer.line(args.map((a) => (typeof a === 'string' ? a : String(a))).join(' '));
  };
  if (options.captureError) {
    console.error = (...args) => {
      buffer.line(args.map((a) => (typeof a === 'string' ? a : String(a))).join(' '));
    };
  }
  const restore = () => {
    console.log = originalLog;
    console.error = originalError;
  };
  // Fires for a natural end AND for process.exit(), which is how the BLOCK
  // paths leave — those messages must survive too.
  process.on('exit', () => {
    restore();
    buffer.emit();
  });
  return { buffer, restore };
}

module.exports = { outputBuffer, emit, captureConsole, CONTEXT_EVENTS };
