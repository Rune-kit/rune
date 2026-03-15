// Rune Post-Session Reflect Hook
// 1. Flushes session metrics from tmpdir to .rune/metrics/ (H3 Intelligence)
// 2. Displays structured self-review checklist at session end (Stop event)

const fs = require('fs');
const path = require('path');
const os = require('os');

const cwd = process.cwd();
const hash = Buffer.from(cwd).toString('base64url').slice(0, 16);

// === H3: Flush Session Metrics ===

const metricsJsonl = path.join(os.tmpdir(), `rune-metrics-${hash}.jsonl`);
const counterFile = path.join(os.tmpdir(), `rune-context-watch-${hash}.json`);
const runeMetricsDir = path.join(cwd, '.rune', 'metrics');

try {
  flushMetrics();
} catch (e) {
  // Metrics flush is best-effort — never block session end
  // Silently ignore errors
}

function flushMetrics() {
  // Read session skill invocations from tmpdir JSONL
  let skillEvents = [];
  if (fs.existsSync(metricsJsonl)) {
    const lines = fs.readFileSync(metricsJsonl, 'utf-8').trim().split('\n').filter(Boolean);
    for (const line of lines) {
      try { skillEvents.push(JSON.parse(line)); } catch { /* skip malformed */ }
    }
  }

  // Read context-watch state for tool counts and session timing
  let watchState = { count: 0, sessionStart: null, toolCounts: {} };
  if (fs.existsSync(counterFile)) {
    try {
      watchState = JSON.parse(fs.readFileSync(counterFile, 'utf-8'));
    } catch { /* use defaults */ }
  }

  // Nothing to flush if no data
  if (skillEvents.length === 0 && watchState.count === 0) return;

  // Ensure .rune/metrics/ exists
  fs.mkdirSync(runeMetricsDir, { recursive: true });

  const now = new Date().toISOString();
  const sessionStart = watchState.sessionStart || now;
  const durationMin = Math.round((new Date(now) - new Date(sessionStart)) / 60000);

  // Build skill usage map
  const skillCounts = {};
  const skillChain = [];
  for (const evt of skillEvents) {
    skillCounts[evt.skill] = (skillCounts[evt.skill] || 0) + 1;
    skillChain.push(evt.skill);
  }

  // Determine primary skill (most invoked)
  const primarySkill = Object.entries(skillCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

  // Generate session ID
  const sessionId = `s-${now.slice(0, 10).replace(/-/g, '')}-${now.slice(11, 19).replace(/:/g, '')}`;

  // 1. Append to sessions.jsonl
  const sessionEntry = {
    id: sessionId,
    date: now.slice(0, 10),
    duration_min: durationMin,
    tool_calls: watchState.count,
    tool_distribution: watchState.toolCounts,
    skill_invocations: skillEvents.length,
    skills_used: Object.keys(skillCounts),
    primary_skill: primarySkill
  };

  const sessionsFile = path.join(runeMetricsDir, 'sessions.jsonl');
  fs.appendFileSync(sessionsFile, JSON.stringify(sessionEntry) + '\n');

  // Cap at 100 sessions (rotate oldest)
  try {
    const allLines = fs.readFileSync(sessionsFile, 'utf-8').trim().split('\n').filter(Boolean);
    if (allLines.length > 100) {
      fs.writeFileSync(sessionsFile, allLines.slice(-100).join('\n') + '\n');
    }
  } catch { /* cap is best-effort */ }

  // 2. Merge into skills.json (running totals)
  const skillsFile = path.join(runeMetricsDir, 'skills.json');
  let skillsData = { version: 1, updated: now, skills: {} };
  if (fs.existsSync(skillsFile)) {
    try {
      skillsData = JSON.parse(fs.readFileSync(skillsFile, 'utf-8'));
    } catch { /* start fresh */ }
  }

  for (const [skill, count] of Object.entries(skillCounts)) {
    if (!skillsData.skills[skill]) {
      skillsData.skills[skill] = { total_invocations: 0, last_used: now.slice(0, 10) };
    }
    skillsData.skills[skill].total_invocations += count;
    skillsData.skills[skill].last_used = now.slice(0, 10);
  }
  skillsData.updated = now;

  fs.writeFileSync(skillsFile, JSON.stringify(skillsData, null, 2) + '\n');

  // 3. Append to chains.jsonl
  if (skillChain.length > 0) {
    const chainsFile = path.join(runeMetricsDir, 'chains.jsonl');
    const chainEntry = {
      session: sessionId,
      chain: skillChain,
      depth: skillChain.length
    };
    fs.appendFileSync(chainsFile, JSON.stringify(chainEntry) + '\n');
  }

  // 4. Cleanup tmpdir files
  try { fs.unlinkSync(metricsJsonl); } catch { /* already gone */ }
  // Note: counterFile is cleaned by session-start hook on next session

  // Report metrics flush
  const skillList = Object.entries(skillCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([s, c]) => `${s}(${c})`)
    .join(', ');

  console.log(`\n📊 [Rune metrics] Session ${sessionId} — ${durationMin}min, ${watchState.count} tool calls, ${skillEvents.length} skill invocations`);
  if (skillList) console.log(`   Skills: ${skillList}`);
  console.log(`   Saved to .rune/metrics/\n`);
}

// === Original: Verification Checklist ===

console.log(`
┌─────────────────────────────────────────────────────┐
│  Rune Session End — Verification Checklist          │
├─────────────────────────────────────────────────────┤
│  Before closing this session, confirm:              │
│                                                     │
│  □ All TodoWrite tasks marked complete?             │
│  □ Tests ran and passing?                           │
│  □ No hardcoded secrets introduced?                 │
│  □ If schema changed: migration + rollback exist?   │
│  □ Verification ran (lint + types + build)?         │
│                                                     │
│  If any item is unclear → address it now.           │
└─────────────────────────────────────────────────────┘
`);
