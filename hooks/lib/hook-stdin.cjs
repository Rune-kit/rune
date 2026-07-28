'use strict';

// Hook stdin — read it synchronously, always.
//
// A hook that collects stdin with `process.stdin.on('data'/'end')` and writes its
// result from the 'end' callback has its stdout DISCARDED by Claude Code. The hook
// runs, the payload arrives, the callback fires, the write succeeds, exit code is 0
// — and the output never reaches the model. Nothing reports an error, which is why
// five Rune hooks looked healthy while contributing nothing.
//
// Verified by differential test on Claude Code 2.1.220: an identical hook writing
// the identical envelope is seen by the model when stdin is read with
// `readFileSync(0)`, and unseen when read with an async listener. Switching the
// write to `fs.writeSync(1, …)` does not rescue the async form, so this is about
// when the process settles, not about flushing.
//
// So: read stdin synchronously, then do the work on the main tick.

const fs = require('node:fs');

/**
 * Read the hook payload from stdin, synchronously.
 *
 * @returns {string} raw stdin, or '' when there is nothing to read
 */
function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf-8');
  } catch {
    // No stdin attached (manual invocation, or a runtime that omits the payload)
    return '';
  }
}

/**
 * Read and parse the payload. Hook payloads are JSON, but a runtime invoking a
 * hook by hand may pipe raw text — callers that want that fallback read `.raw`.
 *
 * @returns {{raw: string, data: object}}
 */
function readHookInput() {
  const raw = readStdinSync();
  let data = {};
  try {
    data = JSON.parse(raw);
  } catch {
    data = {};
  }
  return { raw, data };
}

module.exports = { readStdinSync, readHookInput };
