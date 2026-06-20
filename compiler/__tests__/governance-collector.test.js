import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { assembleGovernance } from '../governance-collector.js';

// ─── Test Helpers ───

function today() {
  return new Date().toISOString().slice(0, 10);
}

function sessionEntry(overrides = {}) {
  return {
    id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: today(),
    duration_min: 10,
    tool_calls: 20,
    skill_invocations: 3,
    skills_used: ['cook', 'plan', 'scout'],
    primary_skill: 'cook',
    models_used: { sonnet: 2 },
    ...overrides,
  };
}

async function setupMetrics(tmpDir, sessions = [], skillTotals = null) {
  const metricsDir = path.join(tmpDir, '.rune', 'metrics');
  await mkdir(metricsDir, { recursive: true });

  if (sessions.length > 0) {
    const lines = `${sessions.map((s) => JSON.stringify(s)).join('\n')}\n`;
    await writeFile(path.join(metricsDir, 'sessions.jsonl'), lines);
  }

  if (skillTotals) {
    await writeFile(
      path.join(metricsDir, 'skills.json'),
      JSON.stringify({ version: 1, updated: new Date().toISOString(), skills: skillTotals }),
    );
  }
}

// ─── Tests ───

describe('assembleGovernance — empty state', () => {
  let tmpDir;
  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'rune-gov-test-'));
  });
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns a valid object shape when no metrics exist', async () => {
    const result = await assembleGovernance(tmpDir, 30);

    assert.ok(typeof result === 'object' && result !== null, 'should return an object');
    assert.ok(typeof result.generated_at === 'string', 'generated_at should be a string');
    assert.ok(Array.isArray(result.gates), 'gates should be an array');
    assert.ok(Array.isArray(result.signals), 'signals should be an array');
    assert.ok(Array.isArray(result.compliance), 'compliance should be an array');
    assert.ok(Array.isArray(result.decisions), 'decisions should be an array');
  });

  it('generated_at is a valid ISO date-time string', async () => {
    const result = await assembleGovernance(tmpDir, 30);
    const parsed = new Date(result.generated_at);
    assert.ok(!Number.isNaN(parsed.getTime()), 'generated_at must be parseable as a date');
  });

  it('window_days reflects the days parameter', async () => {
    const result = await assembleGovernance(tmpDir, 14);
    assert.equal(result.window_days, 14);
  });

  it('returns empty arrays when no data exists', async () => {
    const result = await assembleGovernance(tmpDir, 30);
    assert.deepEqual(result.gates, []);
    assert.deepEqual(result.decisions, []);
  });
});

describe('assembleGovernance — gate skill counting', () => {
  let tmpDir;
  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'rune-gov-test-'));
  });
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('counts sentinel invocations from sessions', async () => {
    await setupMetrics(tmpDir, [
      sessionEntry({ skills_used: ['cook', 'sentinel', 'plan'] }),
      sessionEntry({ skills_used: ['sentinel', 'preflight'] }),
      sessionEntry({ skills_used: ['cook', 'debug'] }),
    ]);

    const result = await assembleGovernance(tmpDir, 30);
    const sentinelGate = result.gates.find((g) => g.name === 'sentinel');
    assert.ok(sentinelGate, 'sentinel gate should be in gates[]');
    assert.equal(sentinelGate.fired, 2);
  });

  it('counts preflight invocations correctly', async () => {
    await setupMetrics(tmpDir, [
      sessionEntry({ skills_used: ['preflight', 'cook'] }),
      sessionEntry({ skills_used: ['preflight'] }),
    ]);

    const result = await assembleGovernance(tmpDir, 30);
    const preflightGate = result.gates.find((g) => g.name === 'preflight');
    assert.ok(preflightGate, 'preflight gate should be in gates[]');
    assert.equal(preflightGate.fired, 2);
  });

  it('includes multiple gate skills in one result', async () => {
    await setupMetrics(tmpDir, [
      sessionEntry({
        skills_used: ['sentinel', 'preflight', 'completion-gate', 'logic-guardian', 'cook'],
      }),
    ]);

    const result = await assembleGovernance(tmpDir, 30);
    const gateNames = result.gates.map((g) => g.name);
    assert.ok(gateNames.includes('sentinel'), 'sentinel should appear');
    assert.ok(gateNames.includes('preflight'), 'preflight should appear');
    assert.ok(gateNames.includes('completion-gate'), 'completion-gate should appear');
    assert.ok(gateNames.includes('logic-guardian'), 'logic-guardian should appear');
  });

  it('omits non-gate skills from gates[]', async () => {
    await setupMetrics(tmpDir, [sessionEntry({ skills_used: ['cook', 'plan', 'scout', 'debug'] })]);

    const result = await assembleGovernance(tmpDir, 30);
    const nonGateInGates = result.gates.filter(
      (g) =>
        ![
          'sentinel',
          'sentinel-env',
          'preflight',
          'completion-gate',
          'logic-guardian',
          'constraint-check',
          'hallucination-guard',
          'integrity-check',
        ].includes(g.name),
    );
    assert.equal(nonGateInGates.length, 0, 'no non-gate skills should appear in gates[]');
  });

  it('gate entries have required schema fields', async () => {
    await setupMetrics(tmpDir, [sessionEntry({ skills_used: ['sentinel'] })]);

    const result = await assembleGovernance(tmpDir, 30);
    const gate = result.gates[0];
    assert.ok(Object.hasOwn(gate, 'name'));
    assert.ok(Object.hasOwn(gate, 'fired'));
    assert.ok(Object.hasOwn(gate, 'passed'));
    assert.ok(Object.hasOwn(gate, 'bypassed'));
    assert.ok(Object.hasOwn(gate, 'blocked'));
    assert.equal(typeof gate.fired, 'number');
    // Phase-1 limitation: outcome fields are 0
    assert.equal(gate.passed, 0, 'passed must be 0 (GAP-1: no outcome capture)');
    assert.equal(gate.bypassed, 0, 'bypassed must be 0 (GAP-1: no outcome capture)');
    assert.equal(gate.blocked, 0, 'blocked must be 0 (GAP-1: no outcome capture)');
  });

  it('reads gate counts from skills.json totals when no windowed sessions', async () => {
    // No sessions — but skills.json says sentinel ran 5 times globally.
    // skills.json uses the REAL producer shape: { skill: { total_invocations, last_used } }.
    await setupMetrics(tmpDir, [], {
      sentinel: { total_invocations: 5, last_used: today() },
      cook: { total_invocations: 10, last_used: today() },
    });

    const result = await assembleGovernance(tmpDir, 30);
    const sentinelGate = result.gates.find((g) => g.name === 'sentinel');
    assert.ok(sentinelGate, 'sentinel should appear from skills.json totals');
    assert.equal(sentinelGate.fired, 5, 'fired must come from total_invocations');
    assert.ok(sentinelGate.ts, 'ts should be derived from last_used');
    // cook is not a gate skill — should not appear
    const cookGate = result.gates.find((g) => g.name === 'cook');
    assert.equal(cookGate, undefined, 'cook should not appear in gates[]');
  });
});

describe('assembleGovernance — signals from static mesh', () => {
  let tmpDir;
  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'rune-gov-test-'));
  });
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('signals[] is an array (may be empty if skills dir missing)', async () => {
    const result = await assembleGovernance(tmpDir, 30);
    assert.ok(Array.isArray(result.signals));
  });

  it('does not throw when skills/ dir is missing', async () => {
    // tmpDir has no skills/ — should degrade to []
    const result = await assembleGovernance(tmpDir, 30);
    assert.deepEqual(result.signals, []);
  });

  it('signal entries have required fields when signals exist', async () => {
    // Create a minimal skills/ dir with one SKILL.md that has signals
    const skillsDir = path.join(tmpDir, 'skills', 'test-skill');
    await mkdir(skillsDir, { recursive: true });
    const skillContent = `---
name: test-skill
description: A test skill
metadata:
  version: "0.1.0"
  layer: L2
  emit: test.signal.done
  listen: test.signal.start
---
# test-skill
A minimal skill for testing.
`;
    await writeFile(path.join(skillsDir, 'SKILL.md'), skillContent);

    const result = await assembleGovernance(tmpDir, 30);
    // Signals array may be empty if the visualizer cannot fully parse, but it should not throw
    assert.ok(Array.isArray(result.signals));
    // If signals populated, verify shape
    for (const sig of result.signals) {
      assert.ok(typeof sig.name === 'string', 'signal must have a name');
      assert.ok(Object.hasOwn(sig, 'count'), 'signal must have count field');
      assert.equal(typeof sig.count, 'number');
    }
  });
});

describe('assembleGovernance — compliance from Business packs', () => {
  // Isolation: a single temp ROOT holds both the Free-side runeRoot and the
  // Business sibling, so the collector's `runeRoot/../Business` resolution works
  // AND the whole tree is cleaned up — never pollutes the shared os.tmpdir().
  let root, runeRoot;
  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'rune-gov-root-'));
    runeRoot = path.join(root, 'Free');
    await mkdir(runeRoot, { recursive: true });
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('returns empty compliance[] when no Business dir exists', async () => {
    const result = await assembleGovernance(runeRoot, 30);
    assert.deepEqual(result.compliance, []);
  });

  it('extracts MUST constraints from a Business PACK.md', async () => {
    const bizRoot = path.join(root, 'Business', 'extensions', 'pro-test-pack');
    await mkdir(bizRoot, { recursive: true });

    const packContent = `---
name: "@rune-pro/test-pack"
metadata:
  version: "1.0.0"
---
# @rune-pro/test-pack

## Constraints

1. MUST verify user permissions before returning data
2. MUST NOT make changes without approval
3. NEVER log sensitive credentials

## Done When

- [ ] At least one system connected (verified via health check)
- [x] All permissions verified
`;
    await writeFile(path.join(bizRoot, 'PACK.md'), packContent);

    const result = await assembleGovernance(runeRoot, 30);

    assert.ok(Array.isArray(result.compliance));
    const mustItems = result.compliance.filter(
      (c) => c.obligation.startsWith('MUST') || c.obligation.startsWith('NEVER'),
    );
    assert.ok(mustItems.length >= 2, 'should extract MUST/NEVER constraints');

    for (const item of result.compliance) {
      assert.ok(typeof item.pack === 'string');
      assert.ok(typeof item.obligation === 'string');
      assert.ok(['met', 'partial', 'gap', 'unknown'].includes(item.status));
    }
  });
});

describe('assembleGovernance — error resilience', () => {
  let tmpDir;
  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'rune-gov-test-'));
  });
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('does not throw when sessions.jsonl contains invalid JSON lines', async () => {
    const metricsDir = path.join(tmpDir, '.rune', 'metrics');
    await mkdir(metricsDir, { recursive: true });
    await writeFile(
      path.join(metricsDir, 'sessions.jsonl'),
      `${JSON.stringify(sessionEntry({ skills_used: ['sentinel'] }))}\nNOT_JSON\n${JSON.stringify(sessionEntry())}\n`,
    );

    const result = await assembleGovernance(tmpDir, 30);
    assert.ok(result, 'should not throw on malformed JSONL');
    assert.ok(Array.isArray(result.gates));
  });

  it('does not throw when skills.json is corrupted', async () => {
    const metricsDir = path.join(tmpDir, '.rune', 'metrics');
    await mkdir(metricsDir, { recursive: true });
    await writeFile(path.join(metricsDir, 'skills.json'), 'NOT_JSON');

    const result = await assembleGovernance(tmpDir, 30);
    assert.ok(result);
    assert.ok(Array.isArray(result.gates));
  });

  it('does not throw when .rune/ directory does not exist', async () => {
    // tmpDir exists but has no .rune/ subdirectory
    const result = await assembleGovernance(tmpDir, 30);
    assert.ok(result);
    assert.ok(typeof result.generated_at === 'string');
    assert.deepEqual(result.gates, []);
  });

  it('decisions[] is always an empty array in Phase 1', async () => {
    await setupMetrics(tmpDir, [sessionEntry({ skills_used: ['sentinel'] })]);
    const result = await assembleGovernance(tmpDir, 30);
    assert.deepEqual(result.decisions, [], 'decisions must be [] until provenance capture is added (GAP-5)');
  });
});
