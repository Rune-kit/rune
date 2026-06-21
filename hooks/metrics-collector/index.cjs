// Rune Metrics Collector Hook
// PostToolUse on Skill|Task|Agent — captures skill invocations for H3 mesh analytics
// (skills run both via the Skill tool and as rune:* subagents via Task/Agent)
// Append-only JSONL to tmpdir. Flushed to .rune/metrics/ at session end.
// Async: true — never blocks skill execution.
//
// Data source: stdin JSON from Claude Code (not env vars)

const fs = require('fs');
const path = require('path');
const os = require('os');
const { resolveStateKey, stateFile } = require('../lib/context-key.cjs');

// metricsFile + watchFile are keyed by the Claude Code session_id (parsed from
// stdin in the handler) so they reset per session and match the session-keyed
// context-watch counter. See lib/context-key.cjs.

// Read stdin JSON to get tool input (Claude Code passes hook data via stdin)
let stdinData = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', chunk => { stdinData += chunk; });
process.stdin.on('end', () => {
  let skillName = 'unknown';
  let claudeSessionId; // raw Claude Code session_id — used to key temp files

  try {
    const hookData = JSON.parse(stdinData);
    claudeSessionId = hookData.session_id;
    // PostToolUse stdin covers TWO invocation paths:
    //   Skill tool: { tool: "Skill", tool_input: { skill: "rune:cook", ... } }
    //   Task tool:  { tool: "Task",  tool_input: { subagent_type: "rune:cook", ... } }
    // In Rune most skills run as subagents via Task, so the old Skill-only
    // capture left skills_used[] empty. Capture both.
    const toolName = hookData.tool || hookData.tool_name || '';
    const toolInput = hookData.tool_input || {};
    const fromSkill = () => (toolInput.skill || toolInput.name || '').replace(/^rune:/, '') || 'unknown';
    // Subagent path — only count Rune skills (rune:*); skip generic agents
    // (general-purpose, Explore, claude, statusline-setup, …) which are not skills.
    const fromSubagent = () => {
      const sub = toolInput.subagent_type || '';
      return /^rune:/.test(sub) ? sub.replace(/^rune:/, '') : 'unknown';
    };
    // Branch on TOOL NAME first (authoritative), so a Skill invocation is never
    // mis-routed by an incidental subagent_type field. Fall back to field-sniffing
    // only when the tool name is absent.
    if (toolName === 'Skill') {
      skillName = fromSkill();
    } else if (toolName === 'Task' || toolName === 'Agent') {
      skillName = fromSubagent();
    } else if (toolInput.skill || toolInput.name) {
      skillName = fromSkill();
    } else {
      skillName = fromSubagent();
    }
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

    // Session-keyed temp files (match the session-keyed context-watch counter).
    const metricsFile = path.join(os.tmpdir(), `rune-metrics-${resolveStateKey(claudeSessionId)}.jsonl`);
    const watchFile = stateFile('rune-context-watch', claudeSessionId);

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
