/**
 * CONTEXT.md format — validates the project glossary structure.
 *
 * Lazy creation rule: empty/absent CONTEXT.md is OK; the validator only runs on existing files.
 *
 * Required sections: # Project Glossary heading, ## Language table, ## Relationships
 * Optional sections: ## Example dialogue, ## Flagged ambiguities
 */

import assert from 'node:assert';
import { describe, test } from 'node:test';

function validateContextMd(content) {
  const issues = [];

  if (!/^# .+/m.test(content.split('\n')[0] || '')) {
    issues.push('first line must be H1 (# Title)');
  }

  if (!/## Language/.test(content)) {
    issues.push('missing ## Language section');
  }

  if (!/## Relationships/.test(content)) {
    issues.push('missing ## Relationships section');
  }

  // Validate Language table shape if present
  const langMatch = content.match(/## Language\s*\n([\s\S]*?)(?=\n## |\n# |$)/);
  if (langMatch) {
    const tableLines = langMatch[1].split('\n').filter((l) => l.trim().startsWith('|'));
    if (tableLines.length < 3) {
      issues.push('## Language section must contain a Markdown table with header + separator + >=1 row');
    } else {
      // Header should mention Term, Definition, Aliases, Status
      const header = tableLines[0].toLowerCase();
      const requiredColumns = [
        { lower: 'term', label: 'Term' },
        { lower: 'definition', label: 'Definition' },
        { lower: 'aliases', label: 'Aliases' },
        { lower: 'status', label: 'Status' },
      ];
      for (const col of requiredColumns) {
        if (!header.includes(col.lower)) {
          issues.push(`Language table header missing column: ${col.label}`);
        }
      }
      // Each row should have a status field with valid value
      const validStatuses = ['canonical', 'pending', 'conflicted'];
      for (let i = 2; i < tableLines.length; i++) {
        const row = tableLines[i];
        const cells = row
          .split('|')
          .map((c) => c.trim())
          .filter(Boolean);
        if (cells.length >= 4) {
          const status = cells[3].toLowerCase();
          if (!validStatuses.includes(status)) {
            issues.push(`row "${cells[0]}" has invalid status "${status}"`);
          }
        }
      }
    }
  }

  return issues;
}

describe('CONTEXT.md format', () => {
  test('valid context passes', () => {
    const content = `# Project Glossary

## Language

| Term | Definition | Aliases to avoid | Status |
|------|------------|-------------------|--------|
| **Order** | A customer's request to purchase items | Purchase, transaction | canonical |
| **Invoice** | A request for payment | Bill | canonical |

## Relationships

- An **Order** produces one or more **Invoices**

## Flagged ambiguities

- "account" was used for both Customer and User — resolved.
`;
    assert.deepStrictEqual(validateContextMd(content), []);
  });

  test('rejects content without H1', () => {
    const content = `## Language
| Term | Definition | Aliases | Status |
|------|------------|---------|--------|
| **X** | y | z | canonical |
## Relationships
- A
`;
    const issues = validateContextMd(content);
    assert.ok(
      issues.some((i) => i.includes('H1')),
      'should require H1',
    );
  });

  test('rejects missing Language section', () => {
    const content = `# Project Glossary
## Relationships
- A
`;
    const issues = validateContextMd(content);
    assert.ok(
      issues.some((i) => i.includes('Language')),
      'should require Language section',
    );
  });

  test('rejects missing Relationships section', () => {
    const content = `# Project Glossary
## Language
| Term | Definition | Aliases | Status |
|------|------------|---------|--------|
| **X** | y | z | canonical |
`;
    const issues = validateContextMd(content);
    assert.ok(
      issues.some((i) => i.includes('Relationships')),
      'should require Relationships section',
    );
  });

  test('rejects invalid status value', () => {
    const content = `# Project Glossary
## Language
| Term | Definition | Aliases | Status |
|------|------------|---------|--------|
| **Order** | y | z | provisional |
## Relationships
- A
`;
    const issues = validateContextMd(content);
    assert.ok(
      issues.some((i) => i.includes('invalid status')),
      'should reject status outside canonical|pending|conflicted',
    );
  });

  test('accepts pending and conflicted statuses', () => {
    const content = `# Project Glossary
## Language
| Term | Definition | Aliases | Status |
|------|------------|---------|--------|
| **Order** | y | z | pending |
| **Invoice** | y | z | conflicted |
## Relationships
- A
`;
    assert.deepStrictEqual(validateContextMd(content), []);
  });

  test('rejects table missing required columns', () => {
    const content = `# Project Glossary
## Language
| Term | Definition |
|------|------------|
| **Order** | y |
## Relationships
- A
`;
    const issues = validateContextMd(content);
    assert.ok(
      issues.some((i) => i.includes('Aliases')),
      'should require Aliases column',
    );
    assert.ok(
      issues.some((i) => i.includes('Status')),
      'should require Status column',
    );
  });
});
