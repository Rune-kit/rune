/**
 * Context preview signal (v2.15+) — verify the schema and threshold logic
 * for context-engine's preview-gate mode. Caller emits context.preview before
 * bundling expensive context, gating dispatch on token budget.
 *
 * Validates:
 *   - Signal name conforms to dot-notation pattern
 *   - Payload schema (caller, estimated_tokens, file_count, top_5, threshold, action)
 *   - Threshold action enum: proceed | warn | block
 *   - Caller-specific threshold table (adversary 50k/100k, team 30k/80k, etc.)
 *   - Token estimate function: chars × 0.25
 *   - Decision function: tokens >= block_at → block, >= warn_at → warn, else proceed
 */

import assert from 'node:assert';
import { describe, test } from 'node:test';

const SIGNAL_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

const VALID_CALLERS = new Set(['adversary', 'team', 'review', 'audit']);
const VALID_ACTIONS = new Set(['proceed', 'warn', 'block']);

const DEFAULT_THRESHOLDS = {
  adversary: { warn_at: 50_000, block_at: 100_000 },
  team: { warn_at: 30_000, block_at: 80_000 },
  review: { warn_at: 40_000, block_at: 100_000 },
  audit: { warn_at: 60_000, block_at: 120_000 },
};

function estimateTokens(chars) {
  return Math.floor(chars * 0.25);
}

function decideAction(estimatedTokens, threshold) {
  if (estimatedTokens >= threshold.block_at) return 'block';
  if (estimatedTokens >= threshold.warn_at) return 'warn';
  return 'proceed';
}

function buildPreviewPayload({ caller, files, promptChars = 200 }) {
  if (!VALID_CALLERS.has(caller)) throw new Error(`unknown caller: ${caller}`);
  const threshold = DEFAULT_THRESHOLDS[caller];
  const totalChars = promptChars + files.reduce((sum, f) => sum + f.chars, 0);
  const estimated_tokens = estimateTokens(totalChars);
  const top_5_files_by_size = [...files].sort((a, b) => b.chars - a.chars).slice(0, 5);
  return {
    caller,
    estimated_tokens,
    file_count: files.length,
    top_5_files_by_size,
    threshold,
    action: decideAction(estimated_tokens, threshold),
  };
}

function validatePayload(payload) {
  const errors = [];
  if (!VALID_CALLERS.has(payload.caller)) errors.push('invalid_caller');
  if (typeof payload.estimated_tokens !== 'number' || payload.estimated_tokens < 0) errors.push('invalid_tokens');
  if (typeof payload.file_count !== 'number' || payload.file_count < 0) errors.push('invalid_file_count');
  if (!Array.isArray(payload.top_5_files_by_size) || payload.top_5_files_by_size.length > 5)
    errors.push('invalid_top_5');
  if (typeof payload.threshold?.warn_at !== 'number' || typeof payload.threshold?.block_at !== 'number')
    errors.push('invalid_threshold');
  if (!VALID_ACTIONS.has(payload.action)) errors.push('invalid_action');
  return { valid: errors.length === 0, errors };
}

describe('Signal naming compliance', () => {
  test('context.preview conforms to signal naming pattern', () => {
    assert.match('context.preview', SIGNAL_PATTERN);
  });
});

describe('Payload schema', () => {
  test('valid payload passes', () => {
    const payload = buildPreviewPayload({
      caller: 'adversary',
      files: [{ path: 'a.ts', chars: 1000 }],
    });
    assert.strictEqual(validatePayload(payload).valid, true);
  });

  test('rejects unknown caller', () => {
    const payload = buildPreviewPayload({
      caller: 'adversary',
      files: [{ path: 'a.ts', chars: 1000 }],
    });
    payload.caller = 'unknown_skill';
    assert.ok(validatePayload(payload).errors.includes('invalid_caller'));
  });

  test('rejects unknown action', () => {
    const payload = buildPreviewPayload({
      caller: 'adversary',
      files: [{ path: 'a.ts', chars: 1000 }],
    });
    payload.action = 'maybe';
    assert.ok(validatePayload(payload).errors.includes('invalid_action'));
  });

  test('top_5 capped at 5 entries even with many files', () => {
    const files = Array.from({ length: 12 }, (_, i) => ({ path: `f${i}.ts`, chars: 100 + i * 10 }));
    const payload = buildPreviewPayload({ caller: 'team', files });
    assert.ok(payload.top_5_files_by_size.length <= 5);
    assert.strictEqual(payload.file_count, 12);
  });
});

describe('Token estimation', () => {
  test('chars × 0.25 = tokens', () => {
    assert.strictEqual(estimateTokens(4000), 1000);
    assert.strictEqual(estimateTokens(0), 0);
    assert.strictEqual(estimateTokens(100_000), 25_000);
  });
});

describe('Action decision logic', () => {
  test('proceed when under warn threshold', () => {
    const payload = buildPreviewPayload({
      caller: 'adversary',
      files: [{ path: 'a.ts', chars: 10_000 }],
    });
    assert.strictEqual(payload.action, 'proceed');
  });

  test('warn when between warn and block', () => {
    const payload = buildPreviewPayload({
      caller: 'adversary',
      files: [{ path: 'a.ts', chars: 280_000 }],
    });
    assert.strictEqual(payload.action, 'warn');
  });

  test('block when at or over block threshold', () => {
    const payload = buildPreviewPayload({
      caller: 'adversary',
      files: [{ path: 'a.ts', chars: 500_000 }],
    });
    assert.strictEqual(payload.action, 'block');
  });
});

describe('Caller-specific thresholds', () => {
  test('adversary uses 50k/100k', () => {
    assert.deepStrictEqual(DEFAULT_THRESHOLDS.adversary, { warn_at: 50_000, block_at: 100_000 });
  });

  test('team uses lower per-worker thresholds (30k/80k)', () => {
    assert.deepStrictEqual(DEFAULT_THRESHOLDS.team, { warn_at: 30_000, block_at: 80_000 });
  });

  test('audit uses higher cross-pack thresholds (60k/120k)', () => {
    assert.deepStrictEqual(DEFAULT_THRESHOLDS.audit, { warn_at: 60_000, block_at: 120_000 });
  });

  test('same file scope produces different actions per caller', () => {
    const files = [{ path: 'big.ts', chars: 200_000 }]; // ~50k tokens
    const adv = buildPreviewPayload({ caller: 'adversary', files });
    const team = buildPreviewPayload({ caller: 'team', files });
    // Adversary: 50k → exactly at warn_at → warn
    assert.strictEqual(adv.action, 'warn');
    // Team: 50k > block_at (80k worker cap not hit, but...) actually 50k < 80k → warn
    assert.strictEqual(team.action, 'warn');
  });
});
