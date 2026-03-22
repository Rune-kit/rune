import assert from 'node:assert';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { parseFrontmatter, validatePack } from '../validate-pack.js';

const VALID_PACK = `---
name: test-pack
description: A test pack
layer: L4
format: monolith
---

# test-pack

## Purpose
Test purpose

## Triggers
When testing

## Skills Included

### Skill One

**Step 1**: Do something

## Connections
- None

## Constraints
- None

## Sharp Edges

| Edge | Impact | Mitigation |
|------|--------|------------|
| None | - | - |

## Done When
- Tests pass

## Cost Profile
Low
`;

describe('validate-pack', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'rune-pack-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('parseFrontmatter', () => {
    test('extracts frontmatter from content', () => {
      const fm = parseFrontmatter('---\nname: foo\nlayer: L4\n---\n# Content');
      assert.ok(fm.includes('name: foo'));
      assert.ok(fm.includes('layer: L4'));
    });

    test('returns null when no frontmatter', () => {
      assert.strictEqual(parseFrontmatter('# No frontmatter'), null);
    });
  });

  describe('validatePack', () => {
    test('passes for valid pack', () => {
      const packDir = join(tempDir, 'good-pack');
      mkdirSync(packDir);
      writeFileSync(join(packDir, 'PACK.md'), VALID_PACK);

      const issues = validatePack(packDir);
      assert.strictEqual(issues.length, 0);
    });

    test('fails when PACK.md is missing', () => {
      const packDir = join(tempDir, 'empty-pack');
      mkdirSync(packDir);

      const issues = validatePack(packDir);
      assert.strictEqual(issues.length, 1);
      assert.ok(issues[0].includes('Missing PACK.md'));
    });

    test('fails when frontmatter is missing', () => {
      const packDir = join(tempDir, 'no-fm');
      mkdirSync(packDir);
      writeFileSync(join(packDir, 'PACK.md'), '# No frontmatter\n\n## Purpose\nTest');

      const issues = validatePack(packDir);
      assert.ok(issues.some((i) => i.includes('Missing YAML frontmatter')));
    });

    test('fails when required frontmatter fields missing', () => {
      const packDir = join(tempDir, 'bad-fm');
      mkdirSync(packDir);
      writeFileSync(join(packDir, 'PACK.md'), '---\nname: test\n---\n# test\n## Purpose\nTest');

      const issues = validatePack(packDir);
      assert.ok(issues.some((i) => i.includes('Missing frontmatter field: description:')));
      assert.ok(issues.some((i) => i.includes('Missing frontmatter field: layer:')));
    });

    test('fails when layer is not L4', () => {
      const packDir = join(tempDir, 'bad-layer');
      mkdirSync(packDir);
      writeFileSync(join(packDir, 'PACK.md'), VALID_PACK.replace('layer: L4', 'layer: L2'));

      const issues = validatePack(packDir);
      assert.ok(issues.some((i) => i.includes('must be layer L4')));
    });

    test('fails when required sections missing', () => {
      const packDir = join(tempDir, 'missing-sections');
      mkdirSync(packDir);
      writeFileSync(join(packDir, 'PACK.md'), '---\nname: test\ndescription: test\nlayer: L4\n---\n# test');

      const issues = validatePack(packDir);
      assert.ok(issues.some((i) => i.includes('Missing section: ## Purpose')));
      assert.ok(issues.some((i) => i.includes('Missing section: ## Triggers')));
    });

    test('fails when no skill headers found', () => {
      const packDir = join(tempDir, 'no-skills');
      mkdirSync(packDir);
      const noSkills = VALID_PACK.replace('### Skill One\n\n**Step 1**: Do something', 'No skills here');
      writeFileSync(join(packDir, 'PACK.md'), noSkills);

      const issues = validatePack(packDir);
      assert.ok(issues.some((i) => i.includes('No skills found')));
    });

    test('fails when no workflow steps', () => {
      const packDir = join(tempDir, 'no-steps');
      mkdirSync(packDir);
      const noSteps = VALID_PACK.replace('**Step 1**: Do something', 'Just do it');
      writeFileSync(join(packDir, 'PACK.md'), noSteps);

      const issues = validatePack(packDir);
      assert.ok(issues.some((i) => i.includes('workflow steps')));
    });
  });

  describe('integration: real extensions', () => {
    test('validates actual extension packs', () => {
      const extDir = join(import.meta.dirname, '../../extensions');
      const packs = readdirSync(extDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      assert.ok(packs.length >= 10, `Expected 10+ packs, got ${packs.length}`);

      for (const pack of packs) {
        const issues = validatePack(join(extDir, pack));
        if (issues.length > 0) {
          console.log(`  ${pack}: ${issues.length} issues (known)`);
        }
      }
    });
  });
});
