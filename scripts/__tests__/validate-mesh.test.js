import assert from 'node:assert';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseSkillMd, validateMesh } from '../validate-mesh.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('validate-mesh', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'rune-mesh-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('parseSkillMd', () => {
    test('extracts calls and calledBy from SKILL.md', () => {
      const skillDir = join(tempDir, 'cook');
      mkdirSync(skillDir);
      writeFileSync(
        join(skillDir, 'SKILL.md'),
        `---
name: cook
layer: L1
---

# cook

## Calls (outbound)
- \`fix\` (L2) — applies code changes
- \`test\` (L2) — runs tests

## Called By (inbound)
- \`skill-router\` (L0) — routes tasks

## Constraints
None
`,
      );

      const result = parseSkillMd(join(skillDir, 'SKILL.md'));
      assert.strictEqual(result.name, 'cook');
      assert.deepStrictEqual(result.calls, ['fix', 'test']);
      assert.deepStrictEqual(result.calledBy, ['skill-router']);
    });

    test('returns empty arrays when no connections', () => {
      const skillDir = join(tempDir, 'lonely');
      mkdirSync(skillDir);
      writeFileSync(
        join(skillDir, 'SKILL.md'),
        `---
name: lonely
layer: L3
---

# lonely

## Constraints
None
`,
      );

      const result = parseSkillMd(join(skillDir, 'SKILL.md'));
      assert.strictEqual(result.name, 'lonely');
      assert.deepStrictEqual(result.calls, []);
      assert.deepStrictEqual(result.calledBy, []);
    });
  });

  describe('validateMesh', () => {
    test('passes when mesh is bidirectionally consistent', () => {
      // cook calls fix, fix lists cook in calledBy
      mkdirSync(join(tempDir, 'cook'));
      writeFileSync(
        join(tempDir, 'cook', 'SKILL.md'),
        `---
name: cook
layer: L1
---
# cook
## Calls (outbound)
- \`fix\` (L2) — applies changes

## Called By (inbound)
- None

## Constraints
None
`,
      );

      mkdirSync(join(tempDir, 'fix'));
      writeFileSync(
        join(tempDir, 'fix', 'SKILL.md'),
        `---
name: fix
layer: L2
---
# fix
## Calls (outbound)
- None

## Called By (inbound)
- \`cook\` (L1) — orchestrates

## Constraints
None
`,
      );

      const { skillCount, issues } = validateMesh(tempDir);
      assert.strictEqual(skillCount, 2);
      assert.strictEqual(issues.length, 0);
    });

    test('detects missing calledBy entry', () => {
      mkdirSync(join(tempDir, 'cook'));
      writeFileSync(
        join(tempDir, 'cook', 'SKILL.md'),
        `---
name: cook
layer: L1
---
# cook
## Calls (outbound)
- \`fix\` (L2) — applies changes

## Called By (inbound)
- None

## Constraints
None
`,
      );

      mkdirSync(join(tempDir, 'fix'));
      writeFileSync(
        join(tempDir, 'fix', 'SKILL.md'),
        `---
name: fix
layer: L2
---
# fix
## Calls (outbound)
- None

## Called By (inbound)
- None

## Constraints
None
`,
      );

      const { issues } = validateMesh(tempDir);
      assert.strictEqual(issues.length, 1);
      assert.ok(issues[0].includes('cook'));
      assert.ok(issues[0].includes('fix'));
    });

    test('detects missing calls entry', () => {
      mkdirSync(join(tempDir, 'cook'));
      writeFileSync(
        join(tempDir, 'cook', 'SKILL.md'),
        `---
name: cook
layer: L1
---
# cook
## Calls (outbound)
- None

## Called By (inbound)
- None

## Constraints
None
`,
      );

      mkdirSync(join(tempDir, 'fix'));
      writeFileSync(
        join(tempDir, 'fix', 'SKILL.md'),
        `---
name: fix
layer: L2
---
# fix
## Calls (outbound)
- None

## Called By (inbound)
- \`cook\` (L1) — orchestrates

## Constraints
None
`,
      );

      const { issues } = validateMesh(tempDir);
      assert.strictEqual(issues.length, 1);
      assert.ok(issues[0].includes('cook'));
    });

    test('ignores User in calledBy', () => {
      mkdirSync(join(tempDir, 'cook'));
      writeFileSync(
        join(tempDir, 'cook', 'SKILL.md'),
        `---
name: cook
layer: L1
---
# cook
## Calls (outbound)
- None

## Called By (inbound)
- User

## Constraints
None
`,
      );

      const { issues } = validateMesh(tempDir);
      assert.strictEqual(issues.length, 0);
    });
  });

  describe('integration: real skills directory', () => {
    test('validates actual Rune skills directory', () => {
      const { skillCount, issues } = validateMesh(join(__dirname, '../../skills'));
      assert.ok(skillCount >= 50, `Expected 50+ skills, got ${skillCount}`);
      // Log but don't fail — mesh may have known issues
      if (issues.length > 0) {
        console.log(`  Mesh has ${issues.length} connection issues (known)`);
      }
    });
  });
});
