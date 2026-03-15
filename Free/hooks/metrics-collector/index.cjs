// Rune Metrics Collector Hook
// PostToolUse on Skill — captures skill invocations for H3 mesh analytics
// Append-only JSONL to tmpdir. Flushed to .rune/metrics/ at session end.
// Async: true — never blocks skill execution.

const fs = require('fs');
const path = require('path');
const os = require('os');

const cwd = process.cwd();
const hash = Buffer.from(cwd).toString('base64url').slice(0, 16);
const metricsFile = path.join(os.tmpdir(), `rune-metrics-${hash}.jsonl`);

// Extract skill name from tool input
const toolInput = process.env.CLAUDE_TOOL_INPUT || '';
let skillName = 'unknown';
try {
  const parsed = JSON.parse(toolInput);
  // Skill tool input has { skill: "rune:cook" } or { skill: "cook" }
  const raw = parsed.skill || parsed.name || '';
  skillName = raw.replace(/^rune:/, '');
} catch {
  // If not JSON, try raw string match
  const match = toolInput.match(/(?:rune:)?([a-z][\w-]*)/i);
  if (match) skillName = match[1];
}

if (skillName && skillName !== 'unknown') {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    skill: skillName,
    event: 'invoke'
  });

  try {
    fs.appendFileSync(metricsFile, entry + '\n');
  } catch {
    // Non-critical — metrics are best-effort
  }
}

process.exit(0);
