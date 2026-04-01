// Rune Context Watch Hook
// Lightweight tool call counter — detects context pressure and suggests rune:context-engine
// Runs as PreToolUse hook on Edit/Write (high-cost operations)
//
// H3 Intelligence: also tracks tool type distribution and session start timestamp
// for metrics aggregation at session end.
//
// Uses a temp file counter (survives across hook invocations within same session).
// Zero overhead: just reads/increments a number. No token cost.
//
// Data source: stdin JSON from Claude Code (not env vars)

const fs = require('fs');
const path = require('path');
const os = require('os');

// Counter file scoped to current working directory (hash of cwd)
const cwd = process.cwd();
const hash = Buffer.from(cwd).toString('base64url').slice(0, 16);
const counterFile = path.join(os.tmpdir(), `rune-context-watch-${hash}.json`);

// Thresholds
const FIRST_WARNING = 40;
const REPEAT_INTERVAL = 20;
const CRITICAL_THRESHOLD = 80;

// Read stdin JSON to get tool name (Claude Code passes hook data via stdin)
let stdinData = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', chunk => { stdinData += chunk; });
process.stdin.on('end', () => {
  let toolName = 'unknown';
  try {
    const parsed = JSON.parse(stdinData);
    toolName = parsed.tool || parsed.tool_name || 'unknown';
  } catch {
    // Fallback to env var for backwards compatibility
    toolName = process.env.CLAUDE_TOOL_NAME || 'unknown';
  }

  // Read current state
  let state = { count: 0, lastWarning: 0, sessionStart: null, sessionId: null, toolCounts: {} };
  try {
    const raw = fs.readFileSync(counterFile, 'utf-8');
    state = JSON.parse(raw);
    // Ensure fields exist (upgrade from old format)
    if (!state.toolCounts) state.toolCounts = {};
    if (!state.sessionStart) state.sessionStart = new Date().toISOString();
    if (!state.sessionId) {
      const s = state.sessionStart;
      state.sessionId = `s-${s.slice(0, 10).replace(/-/g, '')}-${s.slice(11, 19).replace(/:/g, '')}`;
    }
  } catch {
    // First run or corrupted — start fresh
    const now = new Date().toISOString();
    state.sessionStart = now;
    state.sessionId = `s-${now.slice(0, 10).replace(/-/g, '')}-${now.slice(11, 19).replace(/:/g, '')}`;
  }

  // Increment total and per-tool counters
  state.count += 1;
  state.toolCounts[toolName] = (state.toolCounts[toolName] || 0) + 1;

  // Check thresholds
  const count = state.count;
  const sinceLast = count - state.lastWarning;

  if (count >= CRITICAL_THRESHOLD && sinceLast >= REPEAT_INTERVAL) {
    console.log(`\n🔴 [Rune context-watch] ${count} tool calls — context likely RED (>85%).`);
    console.log('  RECOMMENDED: Invoke rune:context-engine for state save + /compact.');
    console.log('  Risk: auto-compaction may lose critical decisions without state save.\n');
    state.lastWarning = count;
  } else if (count >= FIRST_WARNING && sinceLast >= REPEAT_INTERVAL) {
    console.log(`\n🟡 [Rune context-watch] ${count} tool calls — context filling up.`);
    console.log('  Consider invoking rune:context-engine at the next logical boundary.');
    console.log('  Or run /compact manually if at a good stopping point.\n');
    state.lastWarning = count;
  }

  // Pass through stdin to stdout (required for PreToolUse hooks)
  if (stdinData) process.stdout.write(stdinData);

  // Persist
  try {
    fs.writeFileSync(counterFile, JSON.stringify(state));
  } catch {
    // Non-critical — counter resets next run
  }

  process.exit(0);
});

// Handle empty stdin (pipe closed immediately)
process.stdin.on('error', () => process.exit(0));
process.stdin.resume();
