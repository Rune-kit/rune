// Rune Post-Session Reflect Hook
// 1. Flushes session metrics from tmpdir to .rune/metrics/ (H3 Intelligence)
// 2. Displays structured self-review checklist at session end (Stop event)

const fs = require('fs');
const path = require('path');
const { stateFile } = require('../lib/context-key.cjs');
const { captureConsole } = require('../lib/hook-output.cjs');
// Hook stdout is a JSON contract, not free text (Codex rejects bare lines and
// discards the output). Capture the prints below and emit one envelope on exit.
captureConsole('Stop');


const cwd = process.cwd();
let sessionId;
try {
  sessionId = JSON.parse(fs.readFileSync(0, 'utf-8')).session_id;
} catch {
  // Older runtimes may not provide hook input.
}

// === H3: Flush Session Metrics ===

const metricsJsonl = stateFile('rune-metrics', sessionId, cwd).replace(/\.json$/, '.jsonl');
const counterFile = stateFile('rune-context-watch', sessionId, cwd);
const runeMetricsDir = path.join(cwd, '.rune', 'metrics');

// Resolve skill names → expected model from agent frontmatter
// Reads agents/*.md at flush time — no runtime model detection needed
// Map skill names → models, weighted by invocation count
// skillCounts: { skillName: invocationCount }
function resolveSkillModels(skillCounts) {
  const models = {};
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..', '..');
  const agentsDir = path.join(pluginRoot, 'agents');

  if (!fs.existsSync(agentsDir)) return models;

  for (const [skill, count] of Object.entries(skillCounts)) {
    try {
      const agentFile = path.join(agentsDir, `${skill}.md`);
      if (!fs.existsSync(agentFile)) continue;
      const content = fs.readFileSync(agentFile, 'utf-8');
      const match = content.match(/^model:\s*(\w+)/m);
      if (match) {
        const model = match[1];
        models[model] = (models[model] || 0) + count;
      }
    } catch { /* best-effort */ }
  }
  return models;
}

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
  let watchState = { count: 0, sessionStart: null, sessionId: null, toolCounts: {} };
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

  // Build skill usage map and duration aggregation
  const skillCounts = {};
  const skillDurations = {};
  const skillChain = [];
  for (const evt of skillEvents) {
    skillCounts[evt.skill] = (skillCounts[evt.skill] || 0) + 1;
    skillChain.push(evt.skill);
    if (evt.duration_ms != null) {
      skillDurations[evt.skill] = (skillDurations[evt.skill] || 0) + evt.duration_ms;
    }
  }

  // Determine primary skill (most invoked)
  const primarySkill = Object.entries(skillCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

  // Map skills to expected models from agent definitions (weighted by invocation count)
  const modelsUsed = resolveSkillModels(skillCounts);

  // Use session ID from context-watch (shared) or generate new
  const metricSessionId = sessionId
    || watchState.sessionId
    || `s-${now.slice(0, 10).replace(/-/g, '')}-${now.slice(11, 19).replace(/:/g, '')}`;

  // 1. Upsert sessions.jsonl. Stop can fire more than once in one session;
  // appending every time inflated session counts and duration metrics.
  let previousSession = null;
  const sessionsFile = path.join(runeMetricsDir, 'sessions.jsonl');
  let sessionEntries = [];
  if (fs.existsSync(sessionsFile)) {
    sessionEntries = fs
      .readFileSync(sessionsFile, 'utf-8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      });
    previousSession = [...sessionEntries].reverse().find((entry) => entry.id === metricSessionId) || null;
  }

  const mergedSkillCounts = { ...(previousSession?.skill_counts || {}) };
  for (const [skill, count] of Object.entries(skillCounts)) {
    mergedSkillCounts[skill] = (mergedSkillCounts[skill] || 0) + count;
  }
  const mergedSkillDurations = { ...(previousSession?.skill_durations || {}) };
  for (const [skill, duration] of Object.entries(skillDurations)) {
    mergedSkillDurations[skill] = (mergedSkillDurations[skill] || 0) + duration;
  }
  const mergedModels = { ...(previousSession?.models_used || {}) };
  for (const [model, count] of Object.entries(modelsUsed)) {
    mergedModels[model] = (mergedModels[model] || 0) + count;
  }
  const mergedSkills = Object.keys(mergedSkillCounts);
  const mergedPrimarySkill = Object.entries(mergedSkillCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0]
    || previousSession?.primary_skill
    || primarySkill;

  const sessionEntry = {
    id: metricSessionId,
    date: now.slice(0, 10),
    duration_min: durationMin,
    tool_calls: watchState.count,
    tool_distribution: watchState.toolCounts,
    skill_invocations: Object.values(mergedSkillCounts).reduce((sum, count) => sum + count, 0),
    skills_used: mergedSkills,
    primary_skill: mergedPrimarySkill,
    models_used: mergedModels,
    skill_counts: Object.keys(mergedSkillCounts).length > 0 ? mergedSkillCounts : undefined,
    skill_durations: Object.keys(mergedSkillDurations).length > 0 ? mergedSkillDurations : undefined
  };

  sessionEntries = sessionEntries.filter((entry) => entry.id !== metricSessionId);
  sessionEntries.push(sessionEntry);
  fs.writeFileSync(
    sessionsFile,
    `${sessionEntries.slice(-100).map((entry) => JSON.stringify(entry)).join('\n')}\n`,
  );

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
      session: metricSessionId,
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

  console.log(`\n📊 [Rune metrics] Session ${metricSessionId} — ${durationMin}min, ${watchState.count} tool calls, ${skillEvents.length} new skill invocations`);
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
