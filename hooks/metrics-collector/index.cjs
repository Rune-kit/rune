// Rune Metrics Collector Hook
// PostToolUse on Skill — captures skill invocations for H3 mesh analytics
// Append-only JSONL to tmpdir. Flushed to .rune/metrics/ at session end.
// Async: true — never blocks skill execution.
//
// Data source: stdin JSON from Claude Code (not env vars)

const fs = require('fs');
const path = require('path');
const os = require('os');

const cwd = process.cwd();
const hash = Buffer.from(cwd).toString('base64url').slice(0, 16);
const metricsFile = path.join(os.tmpdir(), `rune-metrics-${hash}.jsonl`);
const watchFile = path.join(os.tmpdir(), `rune-context-watch-${hash}.json`);

// Read stdin JSON to get tool input (Claude Code passes hook data via stdin)
let stdinData = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', chunk => { stdinData += chunk; });
process.stdin.on('end', () => {
  let skillName = 'unknown';

  try {
    const hookData = JSON.parse(stdinData);
    // PostToolUse stdin: { tool: "Skill", tool_input: { skill: "rune:cook", ... }, tool_result: ... }
    const toolInput = hookData.tool_input || {};
    const raw = toolInput.skill || toolInput.name || '';
    skillName = raw.replace(/^rune:/, '') || 'unknown';
  } catch {
    // Fallback: try env var for backwards compatibility
    const toolInput = process.env.CLAUDE_TOOL_INPUT || '';
    try {
      const parsed = JSON.parse(toolInput);
      const raw = parsed.skill || parsed.name || '';
      skillName = raw.replace(/^rune:/, '');
    } catch {
      const match = toolInput.match(/(?:rune:)?([a-z][\w-]*)/i);
      if (match) skillName = match[1];
    }
  }

  if (skillName && skillName !== 'unknown') {
    const now = Date.now();
    const ts = new Date(now).toISOString();

    // Read session ID from context-watch state (shared tmpdir file)
    let sessionId = null;
    try {
      const watchState = JSON.parse(fs.readFileSync(watchFile, 'utf-8'));
      sessionId = watchState.sessionId || null;
    } catch { /* no watch state yet */ }

    // Compute duration since last skill event (approximate skill execution time)
    let durationMs = null;
    try {
      const lines = fs.readFileSync(metricsFile, 'utf-8').trim().split('\n').filter(Boolean);
      if (lines.length > 0) {
        const last = JSON.parse(lines[lines.length - 1]);
        durationMs = now - new Date(last.ts).getTime();
        // Cap at 10 minutes — longer gaps are idle time, not skill duration
        if (durationMs > 600000) durationMs = null;
      }
    } catch { /* first event or read error */ }

    const entry = JSON.stringify({
      ts,
      skill: skillName,
      event: 'invoke',
      session_id: sessionId,
      duration_ms: durationMs
    });

    try {
      fs.appendFileSync(metricsFile, entry + '\n');
    } catch {
      // Non-critical — metrics are best-effort
    }
  }

  process.exit(0);
});

// Handle empty stdin (pipe closed immediately)
process.stdin.on('error', () => process.exit(0));
process.stdin.resume();
