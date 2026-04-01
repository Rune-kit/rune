import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  getSessionOverview,
  getSkillFrequency,
  getModelDistribution,
  getSessionTrend,
  getSkillChains,
  getToolDistribution,
  getAllAnalytics,
} from '../analytics.js';

// ─── Test Helpers ───

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function sessionEntry(overrides = {}) {
  return {
    id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: today(),
    duration_min: 15,
    tool_calls: 42,
    tool_distribution: { Read: 15, Edit: 12, Bash: 8, Grep: 7 },
    skill_invocations: 5,
    skills_used: ['cook', 'plan', 'scout'],
    primary_skill: 'cook',
    models_used: { opus: 1, sonnet: 2 },
    skill_durations: { cook: 3000, plan: 1500 },
    ...overrides,
  };
}

function chainEntry(chain, session = 'test-session') {
  return { session, chain, depth: Array.isArray(chain) ? chain.length : 0 };
}

async function setupMetrics(tmpDir, sessions = [], chains = [], skillTotals = null) {
  const metricsDir = path.join(tmpDir, '.rune', 'metrics');
  await mkdir(metricsDir, { recursive: true });

  if (sessions.length > 0) {
    const lines = sessions.map((s) => JSON.stringify(s)).join('\n') + '\n';
    await writeFile(path.join(metricsDir, 'sessions.jsonl'), lines);
  }

  if (chains.length > 0) {
    const lines = chains.map((c) => JSON.stringify(c)).join('\n') + '\n';
    await writeFile(path.join(metricsDir, 'chains.jsonl'), lines);
  }

  if (skillTotals) {
    await writeFile(
      path.join(metricsDir, 'skills.json'),
      JSON.stringify({ version: 1, updated: new Date().toISOString(), skills: skillTotals }),
    );
  }
}

// ─── Tests ───

describe('analytics — empty state', () => {
  let tmpDir;
  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'rune-analytics-test-'));
  });
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns zeros when no .rune/metrics/ exists', async () => {
    const overview = await getSessionOverview(tmpDir, 30);
    assert.equal(overview.total_sessions, 0);
    assert.equal(overview.avg_duration_min, 0);
    assert.equal(overview.total_tool_calls, 0);
  });

  it('returns empty arrays for frequency/distribution', async () => {
    const skills = await getSkillFrequency(tmpDir, 30);
    assert.deepEqual(skills, []);
    const models = await getModelDistribution(tmpDir, 30);
    assert.deepEqual(models, []);
    const tools = await getToolDistribution(tmpDir, 30);
    assert.deepEqual(tools, []);
    const chains = await getSkillChains(tmpDir, 30);
    assert.deepEqual(chains, []);
  });

  it('returns empty trend', async () => {
    const trend = await getSessionTrend(tmpDir, 30);
    assert.deepEqual(trend, []);
  });

  it('getAllAnalytics works with empty data', async () => {
    const data = await getAllAnalytics(tmpDir, 30);
    assert.equal(data.overview.total_sessions, 0);
    assert.ok(data.generated);
    assert.equal(data.days, 30);
  });
});

describe('analytics — with data', () => {
  let tmpDir;
  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'rune-analytics-test-'));
  });
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('getSessionOverview aggregates correctly', async () => {
    await setupMetrics(tmpDir, [
      sessionEntry({ duration_min: 10, tool_calls: 30, skill_invocations: 3 }),
      sessionEntry({ duration_min: 20, tool_calls: 50, skill_invocations: 7 }),
    ]);
    const overview = await getSessionOverview(tmpDir, 30);
    assert.equal(overview.total_sessions, 2);
    assert.equal(overview.avg_duration_min, 15);
    assert.equal(overview.total_tool_calls, 80);
    assert.equal(overview.total_skill_invocations, 10);
    assert.equal(overview.active_days, 1);
  });

  it('getSkillFrequency counts sessions per skill', async () => {
    await setupMetrics(tmpDir, [
      sessionEntry({ skills_used: ['cook', 'plan'] }),
      sessionEntry({ skills_used: ['cook', 'debug'] }),
      sessionEntry({ skills_used: ['plan'] }),
    ]);
    const freq = await getSkillFrequency(tmpDir, 30);
    assert.equal(freq[0].skill, 'cook');
    assert.equal(freq[0].sessions_count, 2);
    assert.equal(freq[1].skill, 'plan');
    assert.equal(freq[1].sessions_count, 2);
    assert.equal(freq[2].skill, 'debug');
    assert.equal(freq[2].sessions_count, 1);
  });

  it('getModelDistribution aggregates model counts', async () => {
    await setupMetrics(tmpDir, [
      sessionEntry({ models_used: { opus: 2, sonnet: 3 } }),
      sessionEntry({ models_used: { sonnet: 1, haiku: 5 } }),
    ]);
    const models = await getModelDistribution(tmpDir, 30);
    const map = Object.fromEntries(models.map((m) => [m.model, m.skill_count]));
    assert.equal(map.sonnet, 4);
    assert.equal(map.haiku, 5);
    assert.equal(map.opus, 2);
  });

  it('getSessionTrend groups by date', async () => {
    await setupMetrics(tmpDir, [
      sessionEntry({ date: daysAgo(1), skill_invocations: 3 }),
      sessionEntry({ date: daysAgo(1), skill_invocations: 5 }),
      sessionEntry({ date: today(), skill_invocations: 2 }),
    ]);
    const trend = await getSessionTrend(tmpDir, 30);
    assert.equal(trend.length, 2);
    assert.equal(trend[0].sessions, 2);
    assert.equal(trend[0].skill_invocations, 8);
    assert.equal(trend[1].sessions, 1);
  });

  it('getSkillChains counts pattern frequency', async () => {
    await setupMetrics(
      tmpDir,
      [sessionEntry({ id: 's1' }), sessionEntry({ id: 's2' })],
      [
        chainEntry(['cook', 'plan', 'scout'], 's1'),
        chainEntry(['cook', 'plan', 'scout'], 's2'),
        chainEntry(['debug', 'fix'], 's1'),
      ],
    );
    const chains = await getSkillChains(tmpDir, 30);
    assert.equal(chains[0].chain, 'cook → plan → scout');
    assert.equal(chains[0].count, 2);
    assert.equal(chains[1].chain, 'debug → fix');
    assert.equal(chains[1].count, 1);
  });

  it('getToolDistribution aggregates tool counts', async () => {
    await setupMetrics(tmpDir, [
      sessionEntry({ tool_distribution: { Read: 10, Edit: 5 } }),
      sessionEntry({ tool_distribution: { Read: 3, Bash: 7 } }),
    ]);
    const tools = await getToolDistribution(tmpDir, 30);
    const map = Object.fromEntries(tools.map((t) => [t.tool, t.count]));
    assert.equal(map.Read, 13);
    assert.equal(map.Edit, 5);
    assert.equal(map.Bash, 7);
  });
});

describe('analytics — date filtering', () => {
  let tmpDir;
  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'rune-analytics-test-'));
  });
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('filters sessions by day range', async () => {
    await setupMetrics(tmpDir, [
      sessionEntry({ date: today() }),
      sessionEntry({ date: daysAgo(5) }),
      sessionEntry({ date: daysAgo(15) }),
      sessionEntry({ date: daysAgo(45) }),
    ]);
    const all = await getSessionOverview(tmpDir, 0);
    assert.equal(all.total_sessions, 4);

    const week = await getSessionOverview(tmpDir, 7);
    assert.equal(week.total_sessions, 2);

    const month = await getSessionOverview(tmpDir, 30);
    assert.equal(month.total_sessions, 3);
  });

  it('days=0 returns all sessions', async () => {
    await setupMetrics(tmpDir, [
      sessionEntry({ date: daysAgo(100) }),
      sessionEntry({ date: today() }),
    ]);
    const all = await getSessionOverview(tmpDir, 0);
    assert.equal(all.total_sessions, 2);
  });
});

describe('analytics — edge cases', () => {
  let tmpDir;
  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'rune-analytics-test-'));
  });
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('handles malformed JSONL lines gracefully', async () => {
    const metricsDir = path.join(tmpDir, '.rune', 'metrics');
    await mkdir(metricsDir, { recursive: true });
    await writeFile(
      path.join(metricsDir, 'sessions.jsonl'),
      JSON.stringify(sessionEntry()) + '\n' + 'NOT VALID JSON\n' + JSON.stringify(sessionEntry()) + '\n',
    );
    const overview = await getSessionOverview(tmpDir, 30);
    assert.equal(overview.total_sessions, 2); // skips malformed line
  });

  it('handles empty JSONL files', async () => {
    const metricsDir = path.join(tmpDir, '.rune', 'metrics');
    await mkdir(metricsDir, { recursive: true });
    await writeFile(path.join(metricsDir, 'sessions.jsonl'), '');
    const overview = await getSessionOverview(tmpDir, 30);
    assert.equal(overview.total_sessions, 0);
  });

  it('excludes orphaned chains (no matching session)', async () => {
    await setupMetrics(
      tmpDir,
      [sessionEntry({ id: 's1' })],
      [
        chainEntry(['cook', 'plan'], 's1'),
        chainEntry(['debug', 'fix'], 'orphaned-session'), // no matching session
        chainEntry(null, 's1'), // malformed chain
      ],
    );
    const chains = await getSkillChains(tmpDir, 30);
    assert.equal(chains.length, 1);
    assert.equal(chains[0].chain, 'cook → plan');
  });

  it('handles sessions without optional fields', async () => {
    await setupMetrics(tmpDir, [
      { id: 's1', date: today(), duration_min: 5, tool_calls: 10 },
      // Missing: skill_invocations, skills_used, primary_skill, models_used, skill_durations
    ]);
    const overview = await getSessionOverview(tmpDir, 30);
    assert.equal(overview.total_sessions, 1);
    const models = await getModelDistribution(tmpDir, 30);
    assert.deepEqual(models, []);
  });

  it('handles corrupted skills.json', async () => {
    const metricsDir = path.join(tmpDir, '.rune', 'metrics');
    await mkdir(metricsDir, { recursive: true });
    await writeFile(path.join(metricsDir, 'skills.json'), 'NOT JSON');
    // Should not throw
    const data = await getAllAnalytics(tmpDir, 30);
    assert.ok(data);
  });
});

describe('analytics — dashboard HTML generation', () => {
  it('generates valid HTML from analytics data', async () => {
    const { generateDashboardHTML } = await import('../dashboard.js');

    const data = {
      overview: { total_sessions: 5, avg_duration_min: 12, total_tool_calls: 200, total_skill_invocations: 30, active_days: 3 },
      skillFrequency: [{ skill: 'cook', sessions_count: 4 }, { skill: 'plan', sessions_count: 2 }],
      modelDistribution: [{ model: 'sonnet', skill_count: 8 }, { model: 'opus', skill_count: 3 }],
      sessionTrend: [{ date: '2026-03-30', sessions: 2, duration_min: 20, skill_invocations: 10, tool_calls: 80 }],
      skillChains: [{ chain: 'cook → plan → scout', count: 3 }],
      toolDistribution: [{ tool: 'Read', count: 50 }, { tool: 'Edit', count: 30 }],
      generated: new Date().toISOString(),
      days: 30,
    };

    const html = generateDashboardHTML(data);
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('Rune Analytics'));
    assert.ok(html.includes('Usage Trend'));
    assert.ok(html.includes('Top Skills'));
    assert.ok(html.includes('Model Distribution'));
    assert.ok(html.includes('Tool Distribution'));
    assert.ok(html.includes('Workflow Chains'));
    assert.ok(html.includes('cook'));
  });

  it('generates empty state HTML when no data', async () => {
    const { generateDashboardHTML } = await import('../dashboard.js');

    const data = {
      overview: { total_sessions: 0, avg_duration_min: 0, total_tool_calls: 0, total_skill_invocations: 0, active_days: 0 },
      skillFrequency: [],
      modelDistribution: [],
      sessionTrend: [],
      skillChains: [],
      toolDistribution: [],
      generated: new Date().toISOString(),
      days: 30,
    };

    const html = generateDashboardHTML(data);
    assert.ok(html.includes('No analytics data yet'));
  });
});
