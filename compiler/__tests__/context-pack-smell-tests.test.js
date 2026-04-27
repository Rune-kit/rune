/**
 * Context-pack v0.2 smell tests — regex gates that catch rot-prone briefs.
 *
 * BLOCK regex must catch:
 *   - file:line references (login.ts:42)
 *   - "line N" / "on line N" patterns
 *   - Path-only narrative bullets outside Files Touched section
 *
 * WARN regex must catch:
 *   - Bare path mentions in narrative (advisory, not blocking)
 *
 * Mandatory sections must be enforced:
 *   - ### Out of scope (always)
 *   - ### Type Surface (when task >= 300 tokens)
 */

import assert from 'node:assert';
import { describe, test } from 'node:test';

// --- Smell-test regex (mirrors durability-rules.md) ---

const FILE_LINE_RE = /\b\S+\.[a-z]{1,4}:\d+\b/;
const LINE_N_RE = /\b(line |on line )\d+\b/i;
const NARRATIVE_PATH_RE = /\b(src|lib|app)\/\S+/;

function runSmellTests(packet) {
  const violations = { block: [], warn: [] };

  if (FILE_LINE_RE.test(packet)) {
    const m = packet.match(FILE_LINE_RE);
    violations.block.push({ rule: 'file:line', match: m[0] });
  }

  if (LINE_N_RE.test(packet)) {
    const m = packet.match(LINE_N_RE);
    violations.block.push({ rule: 'line N', match: m[0] });
  }

  // Narrative path: only WARN if it appears OUTSIDE the Files Touched section.
  const filesTouchedMatch = packet.match(/### Files Touched[\s\S]*?(?=\n### |\n## |$)/);
  const filesTouchedBlock = filesTouchedMatch ? filesTouchedMatch[0] : '';
  // Strip the Files Touched section before scanning
  const narrative = packet.replace(filesTouchedBlock, '');
  if (NARRATIVE_PATH_RE.test(narrative)) {
    const m = narrative.match(NARRATIVE_PATH_RE);
    violations.warn.push({ rule: 'narrative path', match: m[0] });
  }

  return violations;
}

function checkMandatorySections(packet, taskTokenCount = 0) {
  const issues = [];
  if (!/### Out of scope/.test(packet)) {
    issues.push('missing ### Out of scope section');
  }
  if (taskTokenCount >= 300 && !/### Type Surface/.test(packet)) {
    issues.push('missing ### Type Surface section (mandatory for tasks >= 300 tokens)');
  }
  return issues;
}

// --- Tests ---

describe('context-pack smell tests', () => {
  describe('BLOCK tier — file:line references', () => {
    test('catches login.ts:42', () => {
      const packet = '## Context Packet\n\n**Task**: Modify the function at src/auth/login.ts:42';
      const v = runSmellTests(packet);
      assert.strictEqual(v.block.length, 1);
      assert.strictEqual(v.block[0].rule, 'file:line');
    });

    test('catches handler.py:100', () => {
      const packet = 'See handler.py:100 for the bug';
      const v = runSmellTests(packet);
      assert.strictEqual(v.block.length, 1);
    });

    test('catches main.go:5', () => {
      const packet = 'In main.go:5 the import is wrong';
      const v = runSmellTests(packet);
      assert.strictEqual(v.block.length, 1);
    });
  });

  describe('BLOCK tier — line N references', () => {
    test('catches "line 42"', () => {
      const packet = 'The bug is on line 42 of the file';
      const v = runSmellTests(packet);
      assert.strictEqual(v.block.length, 1);
      assert.strictEqual(v.block[0].rule, 'line N');
    });

    test('catches "on line 100"', () => {
      const packet = 'See on line 100 below';
      const v = runSmellTests(packet);
      assert.strictEqual(v.block.length, 1);
    });

    test('catches case-insensitive "Line 42"', () => {
      const packet = 'Look at Line 42';
      const v = runSmellTests(packet);
      assert.strictEqual(v.block.length, 1);
    });
  });

  describe('WARN tier — narrative paths', () => {
    test('warns on narrative `src/auth/`', () => {
      const packet = '## Context Packet\n\nThe work happens in src/auth/handlers';
      const v = runSmellTests(packet);
      assert.strictEqual(v.warn.length, 1);
    });

    test('does NOT warn when path is only in Files Touched section', () => {
      const packet = `## Context Packet

**Task**: Add device tracking

### Files Touched (locator-only)
- src/auth/login.ts (LoginInput, AuthService.authenticate) — handler

### Out of scope
- (none)`;
      const v = runSmellTests(packet);
      assert.strictEqual(v.warn.length, 0, 'paths in Files Touched are allowed');
    });
  });

  describe('clean packets pass', () => {
    test('valid v2 packet has zero violations', () => {
      const packet = `## Context Packet

**Task**: Add device_id to login flow
**Parent**: cook
**Scope**: AuthService, LoginInput

### Decisions Made
- Pass through to session storage

### Constraints
- MUST: preserve backward-compat
- MUST NOT: change rate-limit window

### Type Surface (durable)
- LoginInput { email: string; password: string; device_id?: string }
- AuthService.authenticate(input: LoginInput): Result<Session, AuthError>

### Files Touched (locator-only)
- src/auth/login.ts (LoginInput, AuthService.authenticate) — route handler

### Acceptance Criteria
- [ ] Persists device_id when provided
- [ ] Returns AuthError when credentials invalid

### Out of scope
- Audit log writer
`;
      const v = runSmellTests(packet);
      assert.strictEqual(v.block.length, 0, `expected 0 BLOCK, got: ${JSON.stringify(v.block)}`);
      // narrative section uses "AuthService" — no path mention outside Files Touched
      assert.strictEqual(v.warn.length, 0, `expected 0 WARN, got: ${JSON.stringify(v.warn)}`);
    });
  });
});

describe('mandatory section gate', () => {
  test('rejects packet missing Out of scope', () => {
    const packet = `## Context Packet
**Task**: x
### Acceptance Criteria
- [ ] does y
`;
    const issues = checkMandatorySections(packet, 100);
    assert.ok(issues.some((i) => i.includes('Out of scope')));
  });

  test('rejects packet missing Type Surface for large tasks', () => {
    const packet = `## Context Packet
**Task**: large task
### Out of scope
- (none)
### Acceptance Criteria
- [ ] does y
`;
    const issues = checkMandatorySections(packet, 500);
    assert.ok(issues.some((i) => i.includes('Type Surface')));
  });

  test('allows packet without Type Surface for small tasks (<300 tokens)', () => {
    const packet = `## Context Packet
**Task**: small task
### Out of scope
- (none)
### Acceptance Criteria
- [ ] does y
`;
    const issues = checkMandatorySections(packet, 200);
    assert.strictEqual(issues.length, 0, `expected pass for small task, got: ${issues.join('\n')}`);
  });

  test('passes valid packet with all sections', () => {
    const packet = `## Context Packet
**Task**: task
### Type Surface
- T { x: string }
### Out of scope
- (none)
### Acceptance Criteria
- [ ] does y
`;
    const issues = checkMandatorySections(packet, 500);
    assert.strictEqual(issues.length, 0);
  });
});
