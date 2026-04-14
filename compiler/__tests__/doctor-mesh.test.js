/**
 * Tests for doctor mesh integrity checks
 */

import assert from 'node:assert';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkMeshIntegrity, formatMeshResults } from '../doctor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_ROOT = path.join(__dirname, '.test-mesh-skills');

describe('checkMeshIntegrity', () => {
  beforeEach(async () => {
    await mkdir(path.join(TEST_ROOT, 'skills', 'skill-a'), { recursive: true });
    await mkdir(path.join(TEST_ROOT, 'skills', 'skill-b'), { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_ROOT, { recursive: true, force: true });
  });

  test('detects missing reciprocal connections', async () => {
    // skill-a calls skill-b, but skill-b doesn't acknowledge
    await writeFile(
      path.join(TEST_ROOT, 'skills', 'skill-a', 'SKILL.md'),
      `---
name: skill-a
metadata:
  version: "1.0.0"
---
# skill-a
## Calls (outbound)
- \`skill-b\` (L2): some reason
## Called By (inbound)
None
## Sharp Edges
| Mode | Sev | Mit |
## Done When
- done
## Cost Profile
~100 tokens
`,
    );

    await writeFile(
      path.join(TEST_ROOT, 'skills', 'skill-b', 'SKILL.md'),
      `---
name: skill-b
metadata:
  version: "1.0.0"
---
# skill-b
## Calls (outbound)
None
## Called By (inbound)
None
## Sharp Edges
| Mode | Sev | Mit |
## Done When
- done
## Cost Profile
~100 tokens
`,
    );

    const results = await checkMeshIntegrity(TEST_ROOT);

    assert.strictEqual(results.stats.skills, 2, 'Should find 2 skills');
    assert.strictEqual(results.stats.missingReciprocals, 1, 'Should detect 1 missing reciprocal');
    assert.ok(
      results.warnings.some((w) => w.includes('skill-b') && w.includes('skill-a')),
      'Should warn that skill-b is missing skill-a in Called By',
    );
  });

  test('passes when reciprocals are correct', async () => {
    await writeFile(
      path.join(TEST_ROOT, 'skills', 'skill-a', 'SKILL.md'),
      `---
name: skill-a
metadata:
  version: "1.0.0"
---
# skill-a
## Calls (outbound)
- \`skill-b\` (L2): some reason
## Called By (inbound)
None
## Sharp Edges
| Mode | Sev | Mit |
## Done When
- done
## Cost Profile
~100 tokens
`,
    );

    await writeFile(
      path.join(TEST_ROOT, 'skills', 'skill-b', 'SKILL.md'),
      `---
name: skill-b
metadata:
  version: "1.0.0"
---
# skill-b
## Calls (outbound)
None
## Called By (inbound)
- \`skill-a\` (L2): caller
## Sharp Edges
| Mode | Sev | Mit |
## Done When
- done
## Cost Profile
~100 tokens
`,
    );

    const results = await checkMeshIntegrity(TEST_ROOT);

    assert.strictEqual(results.stats.missingReciprocals, 0, 'Should have no missing reciprocals');
    assert.strictEqual(
      results.checks.find((c) => c.name === 'Reciprocal connections')?.status,
      'pass',
      'Reciprocal check should pass',
    );
  });

  test('suggests version bump for mature skills', async () => {
    await writeFile(
      path.join(TEST_ROOT, 'skills', 'skill-a', 'SKILL.md'),
      `---
name: skill-a
metadata:
  version: "0.9.0"
---
# skill-a
## Calls (outbound)
None
## Called By (inbound)
None
## Sharp Edges
| Mode | Sev | Mit |
## Done When
- done
## Cost Profile
~100 tokens
## Returns
| Artifact | Format | Location |
`,
    );

    const results = await checkMeshIntegrity(TEST_ROOT);

    assert.ok(
      results.warnings.some((w) => w.includes('skill-a') && w.includes('1.0')),
      'Should suggest promoting to 1.0',
    );
  });

  test('detects missing required sections', async () => {
    await writeFile(
      path.join(TEST_ROOT, 'skills', 'skill-a', 'SKILL.md'),
      `---
name: skill-a
metadata:
  version: "1.0.0"
---
# skill-a
## Calls (outbound)
None
## Called By (inbound)
None
`,
    );

    const results = await checkMeshIntegrity(TEST_ROOT);

    assert.ok(
      results.warnings.some((w) => w.includes('skill-a') && w.includes('Sharp Edges')),
      'Should warn about missing Sharp Edges',
    );
    assert.ok(
      results.warnings.some((w) => w.includes('skill-a') && w.includes('Done When')),
      'Should warn about missing Done When',
    );
  });
});

describe('formatMeshResults', () => {
  test('formats results for console output', () => {
    const results = {
      checks: [
        { name: 'Reciprocal connections', status: 'pass' },
        { name: 'Version maturity', status: 'warn', detail: '2 skills ready for 1.0' },
      ],
      warnings: ['skill-a v0.9.0: consider promoting to 1.0'],
      errors: [],
      stats: { skills: 10, connections: 50, missingReciprocals: 0 },
    };

    const output = formatMeshResults(results);

    assert.ok(output.includes('Skills: 10'), 'Should show skill count');
    assert.ok(output.includes('Connections: 50'), 'Should show connection count');
    assert.ok(output.includes('[✓] Reciprocal'), 'Should show pass icon');
    assert.ok(output.includes('[!] Version'), 'Should show warn icon');
    assert.ok(output.includes('skill-a v0.9.0'), 'Should include warnings');
  });
});

describe('integration: real skills', () => {
  test('runs mesh check on actual Rune skills directory', async () => {
    const runeRoot = path.resolve(__dirname, '../..');
    const results = await checkMeshIntegrity(runeRoot);

    // Should find skills
    assert.ok(results.stats.skills > 50, `Should find 50+ skills, got ${results.stats.skills}`);

    // Should find connections
    assert.ok(results.stats.connections > 100, `Should find 100+ connections, got ${results.stats.connections}`);

    // Should not have errors
    assert.strictEqual(results.errors.length, 0, `Should have no errors: ${results.errors.join(', ')}`);
  });
});
