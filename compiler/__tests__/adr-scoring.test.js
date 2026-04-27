/**
 * ADR scoring gate — verify the 3-criteria threshold logic.
 *
 * The gate: open_adr = (sum >= 11) AND (each axis >= 3)
 *   - Prevents single-axis cheating
 *   - Counter-test (rejected alternative) is enforced at write time, not numerically
 *
 * Also validates ADR filename pattern includes the score.
 */

import assert from 'node:assert';
import { describe, test } from 'node:test';

function shouldOpenAdr({ reversibility, surprisingness, tradeoff_strength }) {
  const sum = reversibility + surprisingness + tradeoff_strength;
  const minAxis = Math.min(reversibility, surprisingness, tradeoff_strength);
  return sum >= 11 && minAxis >= 3;
}

const ADR_FILENAME_PATTERN = /^ADR-\d{3}-[a-z][a-z0-9]*(-[a-z0-9]+)*-s(\d{1,2})\.md$/;

describe('ADR scoring gate', () => {
  test('opens ADR when sum >= 11 and all axes >= 3', () => {
    assert.strictEqual(shouldOpenAdr({ reversibility: 4, surprisingness: 4, tradeoff_strength: 3 }), true);
    assert.strictEqual(shouldOpenAdr({ reversibility: 5, surprisingness: 5, tradeoff_strength: 5 }), true);
    assert.strictEqual(shouldOpenAdr({ reversibility: 4, surprisingness: 3, tradeoff_strength: 4 }), true);
  });

  test('blocks when sum < 11', () => {
    assert.strictEqual(
      shouldOpenAdr({ reversibility: 3, surprisingness: 3, tradeoff_strength: 3 }),
      false,
      'sum=9 should block',
    );
    assert.strictEqual(
      shouldOpenAdr({ reversibility: 4, surprisingness: 4, tradeoff_strength: 2 }),
      false,
      'sum=10 should block (also violates min-axis rule)',
    );
  });

  test('blocks single-axis cheating: 5+5+1 = 11 sum but axis=1 fails min-axis rule', () => {
    assert.strictEqual(shouldOpenAdr({ reversibility: 5, surprisingness: 5, tradeoff_strength: 1 }), false);
    assert.strictEqual(shouldOpenAdr({ reversibility: 5, surprisingness: 1, tradeoff_strength: 5 }), false);
    assert.strictEqual(shouldOpenAdr({ reversibility: 1, surprisingness: 5, tradeoff_strength: 5 }), false);
  });

  test('boundary: sum=11 with all axes = 3 — Wait, 3+3+3 = 9, not 11. Min sum with each axis >=3 is 9. So sum=11 implies at least one axis is 4', () => {
    // 3+3+5 = 11, all axes >= 3, should open
    assert.strictEqual(shouldOpenAdr({ reversibility: 3, surprisingness: 3, tradeoff_strength: 5 }), true);
  });

  test('borderline cases (sum 8-10) all block — these go to conventions, not ADRs', () => {
    for (let r = 1; r <= 5; r++) {
      for (let s = 1; s <= 5; s++) {
        for (let t = 1; t <= 5; t++) {
          const sum = r + s + t;
          const result = shouldOpenAdr({ reversibility: r, surprisingness: s, tradeoff_strength: t });
          if (sum >= 8 && sum <= 10) {
            assert.strictEqual(result, false, `sum=${sum} (${r}/${s}/${t}) should block`);
          }
        }
      }
    }
  });
});

describe('ADR filename pattern', () => {
  test('valid filenames with score', () => {
    assert.ok(ADR_FILENAME_PATTERN.test('ADR-007-postgres-write-model-s13.md'));
    assert.ok(ADR_FILENAME_PATTERN.test('ADR-001-monorepo-s12.md'));
    assert.ok(ADR_FILENAME_PATTERN.test('ADR-042-event-sourced-orders-s14.md'));
  });

  test('rejects filename without score suffix', () => {
    assert.ok(!ADR_FILENAME_PATTERN.test('ADR-007-postgres-write-model.md'));
  });

  test('rejects non-sequential ADR id format', () => {
    assert.ok(!ADR_FILENAME_PATTERN.test('ADR-7-postgres-s11.md'));
  });

  test('rejects PascalCase slug', () => {
    assert.ok(!ADR_FILENAME_PATTERN.test('ADR-007-PostgresWriteModel-s13.md'));
  });

  test('extracts score from filename', () => {
    const m = 'ADR-007-postgres-write-model-s13.md'.match(ADR_FILENAME_PATTERN);
    assert.strictEqual(parseInt(m[2], 10), 13);
  });
});
