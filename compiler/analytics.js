/**
 * Analytics Query Layer
 *
 * Reads .rune/metrics/ JSONL files and returns structured data
 * for the analytics dashboard. Pure JS — no external dependencies.
 *
 * Upgrade path: swap readJsonl() with DuckDB queries when data
 * volume exceeds ~1000 sessions (currently capped at 100).
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// ─── File Readers ───

function readJsonl(content) {
  return content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function loadMetrics(runeRoot) {
  const dir = path.join(runeRoot, '.rune', 'metrics');
  const files = {
    sessions: path.join(dir, 'sessions.jsonl'),
    chains: path.join(dir, 'chains.jsonl'),
    skills: path.join(dir, 'skills.json'),
  };

  let sessions = [];
  try {
    if (existsSync(files.sessions)) sessions = readJsonl(await readFile(files.sessions, 'utf-8'));
  } catch { /* file read error — use empty */ }

  let chains = [];
  try {
    if (existsSync(files.chains)) chains = readJsonl(await readFile(files.chains, 'utf-8'));
  } catch { /* file read error — use empty */ }

  let skillTotals = {};
  if (existsSync(files.skills)) {
    try {
      const raw = JSON.parse(await readFile(files.skills, 'utf-8'));
      skillTotals = raw.skills || {};
    } catch {
      /* corrupted — use empty */
    }
  }

  return { sessions, chains, skillTotals };
}

// ─── Date Filtering ───

function filterByDays(sessions, days) {
  if (!days || days <= 0) return sessions;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return sessions.filter((s) => s.date >= cutoffStr);
}

// ─── Query Functions ───

export async function getSessionOverview(runeRoot, days = 30) {
  const { sessions } = await loadMetrics(runeRoot);
  const filtered = filterByDays(sessions, days);

  if (filtered.length === 0) {
    return {
      total_sessions: 0,
      avg_duration_min: 0,
      total_tool_calls: 0,
      total_skill_invocations: 0,
      active_days: 0,
    };
  }

  const totalDuration = filtered.reduce((sum, s) => sum + (s.duration_min || 0), 0);
  const totalTools = filtered.reduce((sum, s) => sum + (s.tool_calls || 0), 0);
  const totalSkills = filtered.reduce((sum, s) => sum + (s.skill_invocations || 0), 0);
  const uniqueDays = new Set(filtered.map((s) => s.date)).size;

  return {
    total_sessions: filtered.length,
    avg_duration_min: Math.round(totalDuration / filtered.length),
    total_tool_calls: totalTools,
    total_skill_invocations: totalSkills,
    active_days: uniqueDays,
  };
}

export async function getSkillFrequency(runeRoot, days = 30) {
  const { sessions } = await loadMetrics(runeRoot);
  const filtered = filterByDays(sessions, days);

  const counts = {};
  for (const session of filtered) {
    if (!session.skills_used) continue;
    for (const skill of session.skills_used) {
      counts[skill] = (counts[skill] || 0) + 1;
    }
  }

  return Object.entries(counts)
    .map(([skill, sessions_count]) => ({ skill, sessions_count }))
    .sort((a, b) => b.sessions_count - a.sessions_count);
}

export async function getModelDistribution(runeRoot, days = 30) {
  const { sessions } = await loadMetrics(runeRoot);
  const filtered = filterByDays(sessions, days);

  const models = {};
  for (const session of filtered) {
    if (!session.models_used) continue;
    for (const [model, count] of Object.entries(session.models_used)) {
      models[model] = (models[model] || 0) + count;
    }
  }

  return Object.entries(models)
    .map(([model, skill_count]) => ({ model, skill_count }))
    .sort((a, b) => b.skill_count - a.skill_count);
}

export async function getSessionTrend(runeRoot, days = 30) {
  const { sessions } = await loadMetrics(runeRoot);
  const filtered = filterByDays(sessions, days);

  const byDate = {};
  for (const session of filtered) {
    const date = session.date;
    if (!byDate[date]) {
      byDate[date] = { date, sessions: 0, duration_min: 0, skill_invocations: 0, tool_calls: 0 };
    }
    byDate[date].sessions += 1;
    byDate[date].duration_min += session.duration_min || 0;
    byDate[date].skill_invocations += session.skill_invocations || 0;
    byDate[date].tool_calls += session.tool_calls || 0;
  }

  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getSkillChains(runeRoot, days = 30) {
  const { chains, sessions } = await loadMetrics(runeRoot);

  // Filter chains by matching session dates
  const sessionDates = new Map();
  for (const s of sessions) {
    sessionDates.set(s.id, s.date);
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days || 9999));
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const filtered = chains.filter((c) => {
    if (!c.session || !Array.isArray(c.chain)) return false;
    const date = sessionDates.get(c.session);
    // Drop orphaned chains (session rotated out) — only include known sessions in range
    return date !== undefined && date >= cutoffStr;
  });

  // Count unique chain patterns (normalize to string key)
  const patterns = {};
  for (const chain of filtered) {
    const key = chain.chain.join(' → ');
    patterns[key] = (patterns[key] || 0) + 1;
  }

  return Object.entries(patterns)
    .map(([chain, count]) => ({ chain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

export async function getToolDistribution(runeRoot, days = 30) {
  const { sessions } = await loadMetrics(runeRoot);
  const filtered = filterByDays(sessions, days);

  const tools = {};
  for (const session of filtered) {
    if (!session.tool_distribution) continue;
    for (const [tool, count] of Object.entries(session.tool_distribution)) {
      tools[tool] = (tools[tool] || 0) + count;
    }
  }

  return Object.entries(tools)
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count);
}

// ─── All Queries ───

export async function getAllAnalytics(runeRoot, days = 30) {
  const [overview, skillFrequency, modelDistribution, sessionTrend, skillChains, toolDistribution] =
    await Promise.all([
      getSessionOverview(runeRoot, days),
      getSkillFrequency(runeRoot, days),
      getModelDistribution(runeRoot, days),
      getSessionTrend(runeRoot, days),
      getSkillChains(runeRoot, days),
      getToolDistribution(runeRoot, days),
    ]);

  return {
    overview,
    skillFrequency,
    modelDistribution,
    sessionTrend,
    skillChains,
    toolDistribution,
    generated: new Date().toISOString(),
    days,
  };
}
