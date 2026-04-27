/**
 * .out-of-scope/ KB format validation.
 *
 * Validates:
 *   - Frontmatter parses as YAML
 *   - Required fields present (concept, aliases, decision, rejected_at, rejected_by, prior_requests)
 *   - decision == "rejected" (deferrals don't belong here)
 *   - concept matches filename (slug rule)
 *   - prior_requests has >=1 entry
 *   - Slug rules: kebab-case, lowercase, max 40 chars
 *
 * Operates on test fixtures (no real .out-of-scope/ in this repo yet).
 */

import assert from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';

// Minimal YAML frontmatter parser — we only need flat key:value + simple lists/objects.
// Mirrors what ba and review-intake expect at runtime.
function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const block = match[1];
  const lines = block.split('\n');
  const out = {};
  let currentKey = null;
  let currentList = null;
  let currentObj = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.startsWith('  - ')) {
      // List item, or object-list item starting with `- key: value`
      const inner = line.slice(4);
      if (inner.includes(': ')) {
        // First field of a new object in the list
        currentObj = {};
        const [k, v] = inner.split(/:\s+/);
        currentObj[k.trim()] = stripQuotes(v.trim());
        currentList.push(currentObj);
      } else {
        currentList.push(stripQuotes(inner.trim()));
        currentObj = null;
      }
    } else if (line.startsWith('    ')) {
      // Continuation field of the current object
      if (currentObj && line.includes(': ')) {
        const [k, v] = line.trim().split(/:\s+/);
        currentObj[k.trim()] = stripQuotes(v.trim());
      }
    } else if (line.match(/^[a-z_]+:/)) {
      const [key, ...rest] = line.split(':');
      const value = rest.join(':').trim();
      currentKey = key.trim();
      currentObj = null;
      if (value === '' || value === '[]') {
        out[currentKey] = [];
        currentList = out[currentKey];
      } else if (value.startsWith('[') && value.endsWith(']')) {
        out[currentKey] = value
          .slice(1, -1)
          .split(',')
          .map((s) => stripQuotes(s.trim()))
          .filter(Boolean);
        currentList = null;
      } else {
        out[currentKey] = stripQuotes(value);
        currentList = null;
      }
    }
  }
  return out;
}

function stripQuotes(s) {
  if (!s) return s;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

const REQUIRED_FIELDS = ['concept', 'aliases', 'decision', 'rejected_at', 'rejected_by', 'prior_requests'];
const SLUG_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateOutOfScope(filename, content) {
  const issues = [];
  const fm = parseFrontmatter(content);
  if (!fm) return ['frontmatter missing or unparseable'];

  for (const f of REQUIRED_FIELDS) {
    if (!(f in fm) || fm[f] === undefined) issues.push(`missing field: ${f}`);
  }

  if (fm.decision && fm.decision !== 'rejected') {
    issues.push(`decision must be "rejected" (got "${fm.decision}") — deferrals don't belong in .out-of-scope/`);
  }

  if (fm.concept) {
    if (!SLUG_RE.test(fm.concept)) issues.push(`concept slug malformed: ${fm.concept}`);
    if (fm.concept.length > 40) issues.push(`concept slug too long (>40 chars): ${fm.concept}`);
    const expected = path.basename(filename, '.md');
    if (fm.concept !== expected) {
      issues.push(`concept "${fm.concept}" does not match filename "${expected}"`);
    }
  }

  if (fm.rejected_at && !ISO_DATE_RE.test(fm.rejected_at)) {
    issues.push(`rejected_at must be ISO date YYYY-MM-DD (got "${fm.rejected_at}")`);
  }

  if (Array.isArray(fm.prior_requests) && fm.prior_requests.length === 0) {
    issues.push('prior_requests must have >=1 entry');
  }

  return issues;
}

// --- Tests ---

describe('out-of-scope/ KB format', () => {
  let tmpDir;

  test('valid file passes', () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'rune-oos-'));
    const file = path.join(tmpDir, 'dark-mode.md');
    const content = `---
concept: dark-mode
aliases: [night-theme, dark-theme]
decision: rejected
rejected_at: 2026-04-27
rejected_by: review-intake
priority_to_revisit: low
prior_requests:
  - id: gh-issue-42
    summary: Add dark mode support
    closed_at: 2025-08-01
revisit_if:
  - "team adds front-end engineer"
---

# Dark Mode

Body content.
`;
    writeFileSync(file, content);
    const issues = validateOutOfScope(file, content);
    assert.deepStrictEqual(issues, []);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('rejects file with decision=deferred', () => {
    const content = `---
concept: dark-mode
aliases: [night-theme]
decision: deferred
rejected_at: 2026-04-27
rejected_by: ba
prior_requests:
  - id: gh-issue-42
    summary: x
    closed_at: 2025-08-01
---

body
`;
    const issues = validateOutOfScope('dark-mode.md', content);
    assert.ok(
      issues.some((i) => i.includes('decision must be "rejected"')),
      'should reject decision=deferred',
    );
  });

  test('rejects mismatched filename and concept', () => {
    const content = `---
concept: foo-bar
aliases: []
decision: rejected
rejected_at: 2026-04-27
rejected_by: ba
prior_requests:
  - id: i
    summary: s
    closed_at: 2025-08-01
---

body
`;
    const issues = validateOutOfScope('different-name.md', content);
    assert.ok(
      issues.some((i) => i.includes('does not match filename')),
      'should flag filename/concept mismatch',
    );
  });

  test('rejects empty prior_requests', () => {
    const content = `---
concept: dark-mode
aliases: []
decision: rejected
rejected_at: 2026-04-27
rejected_by: ba
prior_requests: []
---

body
`;
    const issues = validateOutOfScope('dark-mode.md', content);
    assert.ok(
      issues.some((i) => i.includes('prior_requests must have >=1 entry')),
      'should require prior_requests',
    );
  });

  test('rejects malformed slug', () => {
    const content = `---
concept: Dark_Mode
aliases: []
decision: rejected
rejected_at: 2026-04-27
rejected_by: ba
prior_requests:
  - id: i
    summary: s
    closed_at: 2025-08-01
---

body
`;
    const issues = validateOutOfScope('Dark_Mode.md', content);
    assert.ok(
      issues.some((i) => i.includes('concept slug malformed')),
      'should reject non-kebab-case slug',
    );
  });

  test('rejects slug longer than 40 chars', () => {
    const longSlug = 'a-very-long-concept-name-that-exceeds-the-forty-char-cap';
    const content = `---
concept: ${longSlug}
aliases: []
decision: rejected
rejected_at: 2026-04-27
rejected_by: ba
prior_requests:
  - id: i
    summary: s
    closed_at: 2025-08-01
---

body
`;
    const issues = validateOutOfScope(`${longSlug}.md`, content);
    assert.ok(
      issues.some((i) => i.includes('too long')),
      'should reject overlong slug',
    );
  });

  test('rejects malformed rejected_at date', () => {
    const content = `---
concept: dark-mode
aliases: []
decision: rejected
rejected_at: yesterday
rejected_by: ba
prior_requests:
  - id: i
    summary: s
    closed_at: 2025-08-01
---

body
`;
    const issues = validateOutOfScope('dark-mode.md', content);
    assert.ok(
      issues.some((i) => i.includes('ISO date')),
      'should reject non-ISO date',
    );
  });

  test('rejects file missing required fields', () => {
    const content = `---
concept: dark-mode
---

body
`;
    const issues = validateOutOfScope('dark-mode.md', content);
    assert.ok(issues.length >= 4, `expected multiple missing-field errors, got ${issues.length}`);
  });
});

describe('signal name validity', () => {
  test('outofscope.match conforms to signal naming pattern', () => {
    const SIGNAL_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;
    assert.ok(SIGNAL_PATTERN.test('outofscope.match'));
  });
});
