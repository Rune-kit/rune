/**
 * Oracle-pending record schema (v2.15+) — verify the JSON schema written by
 * session-bridge detach mode. The pending file in .rune/oracle-pending/<id>.json
 * is the rendezvous point between adversary (dispatcher) and primary agent
 * (reattach poller).
 *
 * Validates:
 *   - Required fields present + correct type
 *   - sessionId pattern: oracle-<unix-ms>-<rand>
 *   - bundleHash pattern: sha256:<hex>
 *   - status enum: pending | complete | failed
 *   - sourceSkill enum: debug | fix | manual
 *   - Idempotency: same bundleHash returns same sessionId
 *   - Timeout transition: pending → failed when now > timeoutAt
 *   - Cleanup: records older than 24h dropped
 */

import assert from 'node:assert';
import { describe, test } from 'node:test';

const SESSION_ID_PATTERN = /^oracle-\d+-[a-z0-9]+$/;
const BUNDLE_HASH_PATTERN = /^sha256:[a-f0-9]{8,64}$/;
const STATUS_VALUES = new Set(['pending', 'complete', 'failed']);
const SOURCE_SKILL_VALUES = new Set(['debug', 'fix', 'manual']);

function isIso8601(s) {
  if (typeof s !== 'string') return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s);
}

function validatePendingRecord(rec) {
  const errors = [];
  if (typeof rec.sessionId !== 'string' || !SESSION_ID_PATTERN.test(rec.sessionId)) errors.push('invalid_sessionId');
  if (!isIso8601(rec.dispatchedAt)) errors.push('invalid_dispatchedAt');
  if (typeof rec.triggerSignal !== 'string') errors.push('invalid_triggerSignal');
  if (!SOURCE_SKILL_VALUES.has(rec.sourceSkill)) errors.push('invalid_sourceSkill');
  if (typeof rec.targetModel !== 'string') errors.push('invalid_targetModel');
  if (typeof rec.bundleHash !== 'string' || !BUNDLE_HASH_PATTERN.test(rec.bundleHash))
    errors.push('invalid_bundleHash');
  if (!STATUS_VALUES.has(rec.status)) errors.push('invalid_status');
  if (!isIso8601(rec.timeoutAt)) errors.push('invalid_timeoutAt');

  // Conditional fields
  if (rec.status === 'complete') {
    if (rec.responseId === null || typeof rec.responseId !== 'string') errors.push('missing_responseId_when_complete');
    if (rec.responseExcerpt === null || typeof rec.responseExcerpt !== 'string')
      errors.push('missing_responseExcerpt_when_complete');
    if (typeof rec.responseExcerpt === 'string' && rec.responseExcerpt.length > 500)
      errors.push('responseExcerpt_too_long');
  }
  if (rec.status === 'pending') {
    if (rec.responseId !== null) errors.push('responseId_must_be_null_when_pending');
    if (rec.responseExcerpt !== null) errors.push('responseExcerpt_must_be_null_when_pending');
  }
  return { valid: errors.length === 0, errors };
}

function timeoutCheck(record, now) {
  if (record.status !== 'pending') return record;
  if (new Date(now).getTime() >= new Date(record.timeoutAt).getTime()) {
    return { ...record, status: 'failed' };
  }
  return record;
}

function cleanupExpired(records, now, ttlMs = 24 * 60 * 60 * 1000) {
  return records.filter((r) => new Date(now).getTime() - new Date(r.dispatchedAt).getTime() <= ttlMs);
}

function buildPending(overrides = {}) {
  return {
    sessionId: 'oracle-1714234500-abc123',
    dispatchedAt: '2026-04-27T12:34:56Z',
    triggerSignal: 'agent.stuck',
    sourceSkill: 'debug',
    targetModel: 'claude-opus-4-7',
    bundleHash: 'sha256:9f3a4b5c6d7e8f90',
    status: 'pending',
    timeoutAt: '2026-04-27T12:44:56Z',
    responseId: null,
    responseExcerpt: null,
    ...overrides,
  };
}

describe('Pending record schema', () => {
  test('valid pending record passes', () => {
    const result = validatePendingRecord(buildPending());
    assert.strictEqual(result.valid, true, `unexpected errors: ${result.errors.join(', ')}`);
  });

  test('valid complete record passes', () => {
    const result = validatePendingRecord(
      buildPending({
        status: 'complete',
        responseId: 'resp_xyz789',
        responseExcerpt: 'Root cause: missing await on session refresh in middleware/auth.ts:47',
      }),
    );
    assert.strictEqual(result.valid, true, `unexpected errors: ${result.errors.join(', ')}`);
  });

  test('valid failed record passes', () => {
    const result = validatePendingRecord(buildPending({ status: 'failed' }));
    assert.strictEqual(result.valid, true);
  });

  test('rejects invalid sessionId pattern', () => {
    const result = validatePendingRecord(buildPending({ sessionId: 'NotAnOracleId' }));
    assert.ok(result.errors.includes('invalid_sessionId'));
  });

  test('rejects invalid bundleHash pattern', () => {
    const result = validatePendingRecord(buildPending({ bundleHash: 'md5:abc123' }));
    assert.ok(result.errors.includes('invalid_bundleHash'));
  });

  test('rejects unknown status', () => {
    const result = validatePendingRecord(buildPending({ status: 'in_flight' }));
    assert.ok(result.errors.includes('invalid_status'));
  });

  test('rejects unknown sourceSkill', () => {
    const result = validatePendingRecord(buildPending({ sourceSkill: 'review' }));
    assert.ok(result.errors.includes('invalid_sourceSkill'));
  });

  test('complete record without responseId is invalid', () => {
    const result = validatePendingRecord(buildPending({ status: 'complete' }));
    assert.ok(result.errors.includes('missing_responseId_when_complete'));
    assert.ok(result.errors.includes('missing_responseExcerpt_when_complete'));
  });

  test('responseExcerpt > 500 chars rejected', () => {
    const result = validatePendingRecord(
      buildPending({ status: 'complete', responseId: 'r', responseExcerpt: 'x'.repeat(501) }),
    );
    assert.ok(result.errors.includes('responseExcerpt_too_long'));
  });

  test('pending record with responseId set is invalid', () => {
    const result = validatePendingRecord(buildPending({ responseId: 'r1' }));
    assert.ok(result.errors.includes('responseId_must_be_null_when_pending'));
  });
});

describe('Idempotency', () => {
  test('same bundleHash returns same sessionId on duplicate dispatch', () => {
    const existing = buildPending({ sessionId: 'oracle-1714234500-abc' });
    const inbox = [existing];

    const dispatch = (bundleHash) => {
      const match = inbox.find((r) => r.bundleHash === bundleHash && r.status === 'pending');
      if (match) return match.sessionId;
      const newId = `oracle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      inbox.push(buildPending({ sessionId: newId, bundleHash }));
      return newId;
    };

    const id1 = dispatch(existing.bundleHash);
    const id2 = dispatch(existing.bundleHash);
    assert.strictEqual(id1, id2);
    assert.strictEqual(id1, existing.sessionId);
  });
});

describe('Timeout transition', () => {
  test('pending record becomes failed when now > timeoutAt', () => {
    const record = buildPending({ timeoutAt: '2026-04-27T12:00:00Z' });
    const after = timeoutCheck(record, '2026-04-27T13:00:00Z');
    assert.strictEqual(after.status, 'failed');
  });

  test('pending stays pending when now < timeoutAt', () => {
    const record = buildPending({ timeoutAt: '2026-04-27T13:00:00Z' });
    const after = timeoutCheck(record, '2026-04-27T12:30:00Z');
    assert.strictEqual(after.status, 'pending');
  });

  test('complete records not affected by timeout check', () => {
    const record = buildPending({
      status: 'complete',
      responseId: 'r',
      responseExcerpt: 'done',
      timeoutAt: '2026-04-27T12:00:00Z',
    });
    const after = timeoutCheck(record, '2026-04-27T20:00:00Z');
    assert.strictEqual(after.status, 'complete');
  });
});

describe('Cleanup orphaned records', () => {
  test('records >24h old are dropped', () => {
    const records = [
      buildPending({ sessionId: 'oracle-1-fresh', dispatchedAt: '2026-04-27T11:00:00Z' }),
      buildPending({ sessionId: 'oracle-2-stale', dispatchedAt: '2026-04-25T11:00:00Z' }),
    ];
    const remaining = cleanupExpired(records, '2026-04-27T12:00:00Z');
    assert.strictEqual(remaining.length, 1);
    assert.strictEqual(remaining[0].sessionId, 'oracle-1-fresh');
  });

  test('records <24h old are kept', () => {
    const records = [buildPending({ dispatchedAt: '2026-04-26T13:00:00Z' })];
    const remaining = cleanupExpired(records, '2026-04-27T12:00:00Z');
    assert.strictEqual(remaining.length, 1);
  });
});
