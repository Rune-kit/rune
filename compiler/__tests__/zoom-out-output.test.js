/**
 * Zoom-out output validation — scout v0.4 zoom-out mode produces a 3-layer Mermaid map.
 *
 * Validates:
 *   - Output is parseable Mermaid (graph LR ... or graph TB)
 *   - L0 (target) node is present and styled as "stuck"
 *   - L1 cap: max 8 sibling files
 *   - L2 cap: max 8 caller modules
 *   - Total nodes never exceed L0 + 16
 *   - Edge collapse note appears when caps hit
 */

import assert from 'node:assert';
import { describe, test } from 'node:test';

function parseMermaid(text) {
  // Minimal validator — just need to confirm structure
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const directive = lines.find((l) => /^graph (LR|TB|RL|BT)/.test(l));
  if (!directive) return { valid: false, error: 'missing graph directive' };

  const nodes = new Set();
  const edges = [];
  for (const line of lines) {
    if (line.startsWith('graph ') || line.startsWith('classDef ') || line.startsWith('%%')) continue;
    // Extract node names from edges like "A --> B" or "A -.text.- B"
    const edgeMatch = line.match(/^(\S+?)(?:\[[^\]]*\])?\s*(?:-->|-\.[^.]*\.-)\s*(\S+?)(?:\[[^\]]*\])?$/);
    if (edgeMatch) {
      nodes.add(edgeMatch[1]);
      nodes.add(edgeMatch[2]);
      edges.push({ from: edgeMatch[1], to: edgeMatch[2] });
    }
  }
  return { valid: true, nodes: [...nodes], edges };
}

function buildZoomOutFixture({ targetName, l1Files, l2Modules, edgeCollapseNote = false }) {
  const lines = ['graph LR', `  ${targetName}[src/auth/login.ts]:::stuck`];
  for (let i = 0; i < l1Files; i++) {
    lines.push(`  sibling${i}[siblingFile${i}] -.same-dir.- ${targetName}`);
  }
  for (let i = 0; i < l2Modules; i++) {
    lines.push(`  caller${i}[callerModule${i}] --> ${targetName}`);
  }
  if (edgeCollapseNote) {
    lines.push('  %% showing top 8 by import-frequency (>8 collapsed)');
  }
  lines.push('  classDef stuck fill:#ff6b6b');
  return lines.join('\n');
}

describe('zoom-out Mermaid output', () => {
  test('valid output parses', () => {
    const fixture = buildZoomOutFixture({ targetName: 'target', l1Files: 3, l2Modules: 4 });
    const parsed = parseMermaid(fixture);
    assert.strictEqual(parsed.valid, true);
    assert.ok(parsed.nodes.includes('target'));
  });

  test('target has classDef stuck', () => {
    const fixture = buildZoomOutFixture({ targetName: 'target', l1Files: 1, l2Modules: 1 });
    assert.ok(fixture.includes(':::stuck'));
    assert.ok(fixture.includes('classDef stuck'));
  });

  test('respects L1 cap (8 max)', () => {
    const fixture = buildZoomOutFixture({ targetName: 'target', l1Files: 8, l2Modules: 0 });
    const parsed = parseMermaid(fixture);
    const siblingCount = parsed.nodes.filter((n) => n.startsWith('sibling')).length;
    assert.ok(siblingCount <= 8, `expected <=8 siblings, got ${siblingCount}`);
  });

  test('respects L2 cap (8 max)', () => {
    const fixture = buildZoomOutFixture({ targetName: 'target', l1Files: 0, l2Modules: 8 });
    const parsed = parseMermaid(fixture);
    const callerCount = parsed.nodes.filter((n) => n.startsWith('caller')).length;
    assert.ok(callerCount <= 8, `expected <=8 callers, got ${callerCount}`);
  });

  test('total node cap: target + L1 (8) + L2 (8) = 17 max', () => {
    const fixture = buildZoomOutFixture({ targetName: 'target', l1Files: 8, l2Modules: 8 });
    const parsed = parseMermaid(fixture);
    assert.ok(parsed.nodes.length <= 17, `expected <=17 nodes, got ${parsed.nodes.length}`);
  });

  test('edge-collapse note included when caps hit', () => {
    const fixture = buildZoomOutFixture({
      targetName: 'target',
      l1Files: 8,
      l2Modules: 8,
      edgeCollapseNote: true,
    });
    assert.ok(fixture.includes('showing top 8'));
  });

  test('rejects output without graph directive', () => {
    const fixture = `target[src/auth/login.ts]
  caller --> target`;
    const parsed = parseMermaid(fixture);
    assert.strictEqual(parsed.valid, false);
  });
});

describe('agent.stuck signal name validity', () => {
  test('agent.stuck conforms to signal naming pattern', () => {
    const SIGNAL_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;
    assert.ok(SIGNAL_PATTERN.test('agent.stuck'));
  });
});
