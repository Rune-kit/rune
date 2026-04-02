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
  } catch {
    /* file read error — use empty */
  }

  let chains = [];
  try {
    if (existsSync(files.chains)) chains = readJsonl(await readFile(files.chains, 'utf-8'));
  } catch {
    /* file read error — use empty */
  }

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

// ─── Skill Heatmap (per-day per-skill matrix) ───

export async function getSkillHeatmap(runeRoot, days = 30) {
  const { sessions } = await loadMetrics(runeRoot);
  const filtered = filterByDays(sessions, days);

  // Build matrix: { date → { skill → count } }
  const matrix = {};
  const allSkills = new Set();

  for (const session of filtered) {
    const date = session.date;
    if (!session.skills_used) continue;
    if (!matrix[date]) matrix[date] = {};
    for (const skill of session.skills_used) {
      matrix[date][skill] = (matrix[date][skill] || 0) + 1;
      allSkills.add(skill);
    }
  }

  // Sort dates, get top skills by total frequency
  const dates = Object.keys(matrix).sort();
  const skillTotals = {};
  for (const date of dates) {
    for (const [skill, count] of Object.entries(matrix[date])) {
      skillTotals[skill] = (skillTotals[skill] || 0) + count;
    }
  }

  const topSkills = Object.entries(skillTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([skill]) => skill);

  // Build heatmap grid: [ { skill, days: [ { date, count } ] } ]
  const heatmap = topSkills.map((skill) => ({
    skill,
    total: skillTotals[skill],
    days: dates.map((date) => ({
      date,
      count: matrix[date][skill] || 0,
    })),
  }));

  return { heatmap, dates, maxCount: Math.max(1, ...heatmap.flatMap((h) => h.days.map((d) => d.count))) };
}

// ─── Session Timeline (skill sequence for last N sessions) ───

export async function getSessionTimeline(runeRoot, days = 30, limit = 5) {
  const { sessions, chains } = await loadMetrics(runeRoot);
  const filtered = filterByDays(sessions, days)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.duration_min || 0) - (a.duration_min || 0))
    .slice(0, limit);

  // Map session IDs to their chains
  const sessionChains = {};
  for (const chain of chains) {
    if (!chain.session || !Array.isArray(chain.chain)) continue;
    if (!sessionChains[chain.session]) sessionChains[chain.session] = [];
    sessionChains[chain.session].push(chain.chain);
  }

  return filtered.map((session) => ({
    id: session.id,
    date: session.date,
    duration_min: session.duration_min || 0,
    tool_calls: session.tool_calls || 0,
    skills_used: session.skills_used || [],
    primary_skill: session.primary_skill || (session.skills_used || [])[0] || 'unknown',
    chains: (sessionChains[session.id] || []).slice(0, 5),
  }));
}

// ─── Skill Mesh (connections from skill frequency) ───

export async function getSkillMesh(runeRoot, days = 30) {
  const { sessions, chains } = await loadMetrics(runeRoot);
  const filtered = filterByDays(sessions, days);

  // Node sizes from frequency
  const freq = {};
  for (const session of filtered) {
    if (!session.skills_used) continue;
    for (const skill of session.skills_used) {
      freq[skill] = (freq[skill] || 0) + 1;
    }
  }

  const nodes = Object.entries(freq)
    .map(([skill, count]) => ({ id: skill, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const nodeSet = new Set(nodes.map((n) => n.id));

  // Edges from co-occurrence in sessions
  const edgeMap = {};
  for (const session of filtered) {
    if (!session.skills_used || session.skills_used.length < 2) continue;
    const skills = session.skills_used.filter((s) => nodeSet.has(s));
    for (let i = 0; i < skills.length; i++) {
      for (let j = i + 1; j < skills.length; j++) {
        const key = [skills[i], skills[j]].sort().join('::');
        edgeMap[key] = (edgeMap[key] || 0) + 1;
      }
    }
  }

  // Also add chain-based edges (sequential connection = stronger signal)
  const sessionDates = new Map(sessions.map((s) => [s.id, s.date]));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days || 9999));
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  for (const chain of chains) {
    if (!chain.session || !Array.isArray(chain.chain)) continue;
    const date = sessionDates.get(chain.session);
    if (date === undefined || date < cutoffStr) continue;
    const skills = chain.chain.filter((s) => nodeSet.has(s));
    for (let i = 0; i < skills.length - 1; i++) {
      const key = [skills[i], skills[i + 1]].sort().join('::');
      edgeMap[key] = (edgeMap[key] || 0) + 2; // Chain edges weighted 2x
    }
  }

  const edges = Object.entries(edgeMap)
    .map(([key, weight]) => {
      const [source, target] = key.split('::');
      return { source, target, weight };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 40);

  return { nodes, edges, maxCount: Math.max(1, ...nodes.map((n) => n.count)) };
}

// ─── All Queries ───

export async function getAllAnalytics(runeRoot, days = 30) {
  const [
    overview,
    skillFrequency,
    modelDistribution,
    sessionTrend,
    skillChains,
    toolDistribution,
    skillHeatmap,
    sessionTimeline,
    skillMesh,
  ] = await Promise.all([
    getSessionOverview(runeRoot, days),
    getSkillFrequency(runeRoot, days),
    getModelDistribution(runeRoot, days),
    getSessionTrend(runeRoot, days),
    getSkillChains(runeRoot, days),
    getToolDistribution(runeRoot, days),
    getSkillHeatmap(runeRoot, days),
    getSessionTimeline(runeRoot, days, 5),
    getSkillMesh(runeRoot, days),
  ]);

  return {
    overview,
    skillFrequency,
    modelDistribution,
    sessionTrend,
    skillChains,
    toolDistribution,
    skillHeatmap,
    sessionTimeline,
    skillMesh,
    generated: new Date().toISOString(),
    days,
  };
}
