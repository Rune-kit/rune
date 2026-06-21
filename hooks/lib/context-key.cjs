'use strict';

// Shared state-file keying for Rune context hooks (rune-pulse, context-sense,
// context-inject).
//
// State files are keyed by the Claude Code session_id, which Claude Code passes
// on stdin to the statusline AND to every PreToolUse / UserPromptSubmit hook in
// the same session. Because the key is identical across all of them, the hooks
// always read the SAME pulse file the statusline wrote — and because it is
// unique per session, counters reset automatically when a new session starts.
//
// process.cwd() was the previous key. It silently differed between the
// statusline and the hook processes (e.g. different launch directories), so the
// hooks could never find the statusline's real-percentage pulse file and fell
// back to a stale, never-reset tool-call counter — reporting ~100% "compact
// now" while the real context was a fraction of that.
//
// Falls back to a cwd hash only when session_id is unavailable (older Claude
// Code builds that don't pass it), which preserves the legacy behavior instead
// of crashing.

const os = require('node:os');
const path = require('node:path');

function resolveStateKey(sessionId, cwd) {
  if (typeof sessionId === 'string') {
    const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 36);
    if (safe) return `s_${safe}`;
  }
  return `cwd_${Buffer.from(cwd || process.cwd()).toString('base64url').slice(0, 16)}`;
}

function stateFile(prefix, sessionId, cwd) {
  return path.join(os.tmpdir(), `${prefix}-${resolveStateKey(sessionId, cwd)}.json`);
}

module.exports = { resolveStateKey, stateFile };
