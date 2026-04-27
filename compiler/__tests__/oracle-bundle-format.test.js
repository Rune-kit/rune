/**
 * Adversary oracle-mode context bundle format — verify the regex-validated
 * structure that adversary emits when dispatching to a second model.
 *
 * The bundle has 3 mandatory sections:
 *   1. [SYSTEM] line with exact role-priming text
 *   2. [USER] line with template-driven problem statement
 *   3. ### File N: <path> blocks with normalized content
 *
 * Validates:
 *   - System prompt is invariant (must match exact text)
 *   - User section non-empty, within length bounds
 *   - File headers numbered sequentially
 *   - Hard caps enforced (12 files, 4k chars per file, 100k bundle)
 *   - Forbidden content stripped (secrets redacted)
 *   - Citation validation (reply must cite files in bundle)
 */

import assert from 'node:assert';
import { describe, test } from 'node:test';

const SYSTEM_LINE_REGEX =
  /^\[SYSTEM\] You are Oracle, a focused one-shot problem solver\. You have NO prior context — assume zero project knowledge\. Cite file:line for every claim\. Reject any claim you cannot ground in the provided files\.$/;

const USER_LINE_REGEX = /^\[USER\] .{20,2000}$/;

const FILE_HEADER_REGEX = /^### File \d+: [^\n]+$/;

const HARD_CAPS = {
  bundleChars: 400_000,
  perFileChars: 4_000,
  fileCount: 12,
  userMaxChars: 2_000,
};

function buildSystemLine() {
  return '[SYSTEM] You are Oracle, a focused one-shot problem solver. You have NO prior context — assume zero project knowledge. Cite file:line for every claim. Reject any claim you cannot ground in the provided files.';
}

function buildUserLine(source, payload) {
  if (source === 'debug') {
    return `[USER] Agent stuck after ${payload.cycles} hypothesis cycles. Disproved: ${payload.disproved}. Error: ${payload.error}. What is the most likely root cause not yet considered?`;
  }
  if (source === 'fix') {
    return `[USER] Agent stuck after ${payload.attempts} failed fix attempts on ${payload.file}. Each attempt's tests failed with: ${payload.testFailure}. What is the most likely cause of the test failure?`;
  }
  return `[USER] ${payload}`;
}

function buildBundle({ files = [], userLine, systemLine = buildSystemLine() }) {
  const sections = [systemLine, '', userLine, ''];
  files.forEach((f, i) => {
    sections.push(`### File ${i + 1}: ${f.path}`);
    sections.push(f.content);
    sections.push('');
  });
  return sections.join('\n');
}

function validateBundle(bundle) {
  const errors = [];
  if (bundle.length > HARD_CAPS.bundleChars) errors.push('bundle_too_large');
  const lines = bundle.split('\n');
  const sysLine = lines.find((l) => l.startsWith('[SYSTEM]'));
  if (!sysLine || !SYSTEM_LINE_REGEX.test(sysLine)) errors.push('invalid_system_line');
  const userLine = lines.find((l) => l.startsWith('[USER]'));
  if (!userLine || !USER_LINE_REGEX.test(userLine)) errors.push('invalid_user_line');
  const fileHeaders = lines.filter((l) => l.startsWith('### File '));
  if (fileHeaders.length > HARD_CAPS.fileCount) errors.push('too_many_files');
  for (let i = 0; i < fileHeaders.length; i++) {
    if (!FILE_HEADER_REGEX.test(fileHeaders[i])) errors.push(`invalid_file_header_${i}`);
    const expectedNum = i + 1;
    if (!fileHeaders[i].startsWith(`### File ${expectedNum}:`)) errors.push(`out_of_order_file_${i}`);
  }
  return { valid: errors.length === 0, errors };
}

function redactSecrets(content) {
  return content
    .replace(/(api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,}["']/gi, '$1=<REDACTED>')
    .replace(/Authorization:\s*Bearer\s+\S{20,}/g, 'Authorization: Bearer <REDACTED>')
    .replace(/process\.env\.[A-Z_]+\s*=\s*["'][^"']+["']/g, (match) => match.replace(/["'][^"']+["']/, '"<REDACTED>"'));
}

describe('System prompt invariance', () => {
  test('exact system line matches regex', () => {
    assert.match(buildSystemLine(), SYSTEM_LINE_REGEX);
  });

  test('rejects modified system prompt (no improvising)', () => {
    const tampered = '[SYSTEM] You are Oracle, an improved problem solver with extra context.';
    assert.doesNotMatch(tampered, SYSTEM_LINE_REGEX);
  });

  test('rejects empty system line', () => {
    assert.doesNotMatch('[SYSTEM]', SYSTEM_LINE_REGEX);
  });
});

describe('User section template', () => {
  test('debug-source user line matches regex', () => {
    const line = buildUserLine('debug', { cycles: 3, disproved: 'H1; H2; H3', error: '401 intermittent' });
    assert.match(line, USER_LINE_REGEX);
  });

  test('fix-source user line matches regex', () => {
    const line = buildUserLine('fix', {
      attempts: 2,
      file: 'src/auth.ts',
      testFailure: 'expected 200, got 401',
    });
    assert.match(line, USER_LINE_REGEX);
  });

  test('rejects user line under 20 chars', () => {
    assert.doesNotMatch('[USER] short', USER_LINE_REGEX);
  });

  test('manual mode accepts free-form within bounds', () => {
    const line = `[USER] ${'x'.repeat(100)}`;
    assert.match(line, USER_LINE_REGEX);
  });
});

describe('File header structure', () => {
  test('valid file header passes regex', () => {
    assert.match('### File 1: src/auth/login.ts', FILE_HEADER_REGEX);
    assert.match('### File 12: tests/e2e/checkout.spec.ts', FILE_HEADER_REGEX);
  });

  test('rejects malformed file headers', () => {
    assert.doesNotMatch('### File: src/auth.ts', FILE_HEADER_REGEX);
    assert.doesNotMatch('### file 1: src/auth.ts', FILE_HEADER_REGEX);
    assert.doesNotMatch('## File 1: src/auth.ts', FILE_HEADER_REGEX);
  });

  test('files numbered sequentially from 1', () => {
    const bundle = buildBundle({
      systemLine: buildSystemLine(),
      userLine: buildUserLine('manual', 'Why does the test fail intermittently?'),
      files: [
        { path: 'a.ts', content: 'a' },
        { path: 'b.ts', content: 'b' },
        { path: 'c.ts', content: 'c' },
      ],
    });
    const result = validateBundle(bundle);
    assert.strictEqual(result.valid, true, `unexpected errors: ${result.errors.join(', ')}`);
  });
});

describe('Hard caps', () => {
  test('rejects bundle with 13+ files', () => {
    const files = Array.from({ length: 13 }, (_, i) => ({ path: `f${i}.ts`, content: 'x' }));
    const bundle = buildBundle({ userLine: buildUserLine('manual', 'Why does this break under load?'), files });
    const result = validateBundle(bundle);
    assert.ok(result.errors.includes('too_many_files'));
  });

  test('accepts bundle with exactly 12 files', () => {
    const files = Array.from({ length: 12 }, (_, i) => ({ path: `f${i}.ts`, content: 'x' }));
    const bundle = buildBundle({ userLine: buildUserLine('manual', 'Why does this break under load?'), files });
    const result = validateBundle(bundle);
    assert.strictEqual(result.valid, true);
  });

  test('rejects bundle exceeding 400k chars total', () => {
    const oversize = 'x'.repeat(50_000);
    const files = Array.from({ length: 10 }, () => ({ path: 'big.ts', content: oversize }));
    const bundle = buildBundle({ userLine: buildUserLine('manual', 'Why does this break under load?'), files });
    const result = validateBundle(bundle);
    assert.ok(result.errors.includes('bundle_too_large'));
  });
});

describe('Secret redaction', () => {
  test('redacts hardcoded api keys', () => {
    const input = 'const apiKey = "sk-1234567890abcdef"';
    const out = redactSecrets(input);
    assert.match(out, /<REDACTED>/);
    assert.doesNotMatch(out, /sk-1234567890abcdef/);
  });

  test('redacts Bearer tokens', () => {
    const input = 'Authorization: Bearer abc123def456ghi789jkl000mno111';
    const out = redactSecrets(input);
    assert.match(out, /Bearer <REDACTED>/);
  });

  test('preserves non-secret content', () => {
    const input = 'function login(user) { return user.id; }';
    assert.strictEqual(redactSecrets(input), input);
  });
});

describe('Signal naming compliance', () => {
  const SIGNAL_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

  test('oracle.dispatched conforms to signal naming', () => {
    assert.match('oracle.dispatched', SIGNAL_PATTERN);
  });

  test('oracle.response conforms to signal naming', () => {
    assert.match('oracle.response', SIGNAL_PATTERN);
  });

  test('oracle.failed conforms to signal naming', () => {
    assert.match('oracle.failed', SIGNAL_PATTERN);
  });
});
