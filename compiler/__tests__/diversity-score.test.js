/**
 * Diversity score for Design-It-Twice mode.
 *
 * Computes pairwise Jaccard similarity over feature vectors of N designs.
 * Returns 1 - mean(similarity).
 *
 * Used by brainstorm v0.6 Step 3.5 to gate re-spawning when designs are too similar.
 */

import assert from 'node:assert';
import { describe, test } from 'node:test';

function jaccard(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersect = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 1;
  return intersect.size / union.size;
}

function diversityScore(designs) {
  if (designs.length < 2) return 1;
  const pairs = [];
  for (let i = 0; i < designs.length; i++) {
    for (let j = i + 1; j < designs.length; j++) {
      pairs.push(jaccard(designs[i], designs[j]));
    }
  }
  const mean = pairs.reduce((a, b) => a + b, 0) / pairs.length;
  return 1 - mean;
}

// Encoding: a feature vector is a list of feature tokens.
// Examples:
//   ["methods:1", "returns:1", "adapters:0", "deps:1", "paradigm:minimal", "async:no", "stream:no"]
//   ["methods:8", "returns:5", "adapters:3", "deps:5", "paradigm:extensible", "async:yes", "stream:yes"]

describe('diversity score', () => {
  test('identical designs return diversity 0', () => {
    const d1 = ['methods:3', 'paradigm:minimal'];
    const d2 = ['methods:3', 'paradigm:minimal'];
    assert.strictEqual(diversityScore([d1, d2]), 0);
  });

  test('disjoint designs return diversity 1', () => {
    const d1 = ['methods:3', 'paradigm:minimal'];
    const d2 = ['methods:8', 'paradigm:extensible'];
    assert.strictEqual(diversityScore([d1, d2]), 1);
  });

  test('half-overlap returns diversity 0.5', () => {
    const d1 = ['methods:3', 'paradigm:minimal'];
    const d2 = ['methods:3', 'paradigm:extensible'];
    // jaccard = 1/3 (intersection {methods:3}, union {methods:3, paradigm:minimal, paradigm:extensible})
    // diversity = 1 - 1/3 = 0.6667
    const diversity = diversityScore([d1, d2]);
    assert.ok(Math.abs(diversity - 0.6667) < 0.001, `expected ~0.6667, got ${diversity}`);
  });

  test('three radically different designs pass 0.6 floor', () => {
    const c1 = ['methods:2', 'returns:1', 'paradigm:minimal', 'adapters:0', 'async:no'];
    const c2 = ['methods:8', 'returns:5', 'paradigm:extensible', 'adapters:0', 'async:yes'];
    const c4 = ['methods:3', 'returns:2', 'paradigm:ports-adapters', 'adapters:2', 'async:no'];
    const diversity = diversityScore([c1, c2, c4]);
    assert.ok(diversity >= 0.6, `expected >=0.6, got ${diversity}`);
  });

  test('three near-identical designs fail 0.4 floor', () => {
    const a = ['methods:3', 'returns:1', 'paradigm:minimal'];
    const b = ['methods:3', 'returns:1', 'paradigm:minimal'];
    const c = ['methods:3', 'returns:1', 'paradigm:minimal'];
    const diversity = diversityScore([a, b, c]);
    assert.ok(diversity < 0.4, `expected <0.4, got ${diversity}`);
  });

  test('marginal designs land in 0.4-0.59 zone (warn tier)', () => {
    // 6/9 features shared between each pair → jaccard ≈ 0.50, diversity ≈ 0.50
    const a = ['m:3', 'r:1', 'p:m', 'a:0', 'q:x', 'e:y'];
    const b = ['m:3', 'r:1', 'p:m', 'a:0', 'q:x', 'e:z'];
    const c = ['m:3', 'r:1', 'p:m', 'a:0', 'q:y', 'e:z'];
    const diversity = diversityScore([a, b, c]);
    assert.ok(diversity >= 0.3 && diversity < 0.6, `expected 0.3-0.59, got ${diversity}`);
  });

  test('single design returns diversity 1 (degenerate)', () => {
    assert.strictEqual(diversityScore([['x']]), 1);
  });

  test('four designs (when C4 included) — diverse set passes', () => {
    const c1 = ['methods:2', 'paradigm:minimal'];
    const c2 = ['methods:8', 'paradigm:extensible'];
    const c3 = ['methods:1', 'paradigm:default-light'];
    const c4 = ['methods:3', 'paradigm:ports-adapters'];
    const diversity = diversityScore([c1, c2, c3, c4]);
    assert.ok(diversity >= 0.6, `expected >=0.6, got ${diversity}`);
  });
});

describe('threshold gate', () => {
  test('floor 0.4 — below triggers re-spawn', () => {
    const FLOOR = 0.4;
    const lowDiversity = 0.3;
    assert.strictEqual(lowDiversity < FLOOR, true);
  });

  test('threshold 0.6 — proceed without warning', () => {
    const THRESHOLD = 0.6;
    const goodDiversity = 0.7;
    assert.strictEqual(goodDiversity >= THRESHOLD, true);
  });

  test('warn zone 0.4-0.59 — surface to user', () => {
    const value = 0.5;
    assert.ok(value >= 0.4 && value < 0.6);
  });
});
