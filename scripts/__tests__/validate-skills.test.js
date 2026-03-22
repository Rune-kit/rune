import assert from 'node:assert';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkHardGateFormat, parseFrontmatter, validateAllSkills, validateSkill } from '../validate-skills.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const VALID_SKILL = `---
name: test-skill
description: A test skill
layer: L2
model: sonnet
---

# test-skill

## Calls (outbound)
- None

## Called By (inbound)
- \`cook\` (L1)

## Constraints
- Must validate input

## Sharp Edges

| Edge | Impact | Mitigation |
|------|--------|------------|
| None | - | - |

## Done When

- Task is complete
- Tests pass

## Cost Profile

Low — single sonnet call

## Output Format

Markdown report
`;

describe('validate-skills', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'rune-skills-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('parseFrontmatter', () => {
    test('extracts frontmatter', () => {
      const fm = parseFrontmatter('---\nname: cook\nlayer: L1\nmodel: opus\n---\n# cook');
      assert.ok(fm.includes('name: cook'));
      assert.ok(fm.includes('model: opus'));
    });

    test('returns null without frontmatter', () => {
      assert.strictEqual(parseFrontmatter('# No frontmatter here'), null);
    });
  });

  describe('checkHardGateFormat', () => {
    test('passes for XML-style HARD-GATE', () => {
      const content = '<HARD-GATE>Must verify before commit</HARD-GATE>';
      const issues = checkHardGateFormat(content, 'test');
      assert.strictEqual(issues.length, 0);
    });

    test('flags backtick-style HARD-GATE', () => {
      const content = '```\nHARD-GATE: Must verify\n```';
      const issues = checkHardGateFormat(content, 'test');
      assert.strictEqual(issues.length, 1);
      assert.ok(issues[0].includes('backtick block'));
    });
  });

  describe('validateSkill', () => {
    test('passes for valid skill', () => {
      const skillPath = join(tempDir, 'SKILL.md');
      writeFileSync(skillPath, VALID_SKILL);

      const issues = validateSkill(skillPath, 'test-skill');
      const hardIssues = issues.filter((i) => !i.includes('WARN'));
      assert.strictEqual(hardIssues.length, 0);
    });

    test('fails when frontmatter is missing', () => {
      const skillPath = join(tempDir, 'SKILL.md');
      writeFileSync(skillPath, '# No frontmatter\n\n## Constraints\nNone');

      const issues = validateSkill(skillPath, 'bad-skill');
      assert.ok(issues.some((i) => i.includes('Missing YAML frontmatter')));
    });

    test('fails for missing frontmatter fields', () => {
      const skillPath = join(tempDir, 'SKILL.md');
      writeFileSync(skillPath, '---\nname: test\n---\n# test');

      const issues = validateSkill(skillPath, 'test');
      assert.ok(issues.some((i) => i.includes('Missing frontmatter field "layer:"')));
      assert.ok(issues.some((i) => i.includes('Missing frontmatter field "model:"')));
    });

    test('fails for invalid layer', () => {
      const skillPath = join(tempDir, 'SKILL.md');
      writeFileSync(skillPath, '---\nname: test\nlayer: L9\nmodel: sonnet\n---\n# test');

      const issues = validateSkill(skillPath, 'test');
      assert.ok(issues.some((i) => i.includes('Invalid layer "L9"')));
    });

    test('fails for invalid model', () => {
      const skillPath = join(tempDir, 'SKILL.md');
      writeFileSync(skillPath, '---\nname: test\nlayer: L2\nmodel: gpt4\n---\n# test');

      const issues = validateSkill(skillPath, 'test');
      assert.ok(issues.some((i) => i.includes('Invalid model "gpt4"')));
    });

    test('warns when Output Format section missing', () => {
      const skillPath = join(tempDir, 'SKILL.md');
      const noOutput = VALID_SKILL.replace('## Output Format\n\nMarkdown report\n', '');
      writeFileSync(skillPath, noOutput);

      const issues = validateSkill(skillPath, 'test');
      assert.ok(issues.some((i) => i.includes('WARN') && i.includes('Output Format')));
    });

    test('fails when required sections missing', () => {
      const skillPath = join(tempDir, 'SKILL.md');
      writeFileSync(skillPath, '---\nname: test\ndescription: test\nlayer: L2\nmodel: sonnet\n---\n# test\n');

      const issues = validateSkill(skillPath, 'test');
      assert.ok(issues.some((i) => i.includes('Missing section "## Constraints"')));
      assert.ok(issues.some((i) => i.includes('Missing section "## Done When"')));
    });

    test('returns error for unreadable file', () => {
      const issues = validateSkill('/nonexistent/path/SKILL.md', 'ghost');
      assert.strictEqual(issues.length, 1);
      assert.ok(issues[0].includes('Cannot read SKILL.md'));
    });
  });

  describe('validateAllSkills', () => {
    test('scans directory of skills', () => {
      mkdirSync(join(tempDir, 'skill-a'));
      writeFileSync(join(tempDir, 'skill-a', 'SKILL.md'), VALID_SKILL);

      mkdirSync(join(tempDir, 'skill-b'));
      writeFileSync(join(tempDir, 'skill-b', 'SKILL.md'), VALID_SKILL);

      const { scanned, allIssues } = validateAllSkills(tempDir);
      assert.strictEqual(scanned, 2);
      assert.strictEqual(allIssues.length, 0);
    });

    test('reports missing SKILL.md', () => {
      mkdirSync(join(tempDir, 'empty-skill'));

      const { allIssues } = validateAllSkills(tempDir);
      assert.ok(allIssues.some((i) => i.includes('No SKILL.md found')));
    });
  });

  describe('integration: real skills', () => {
    test('validates actual Rune skills directory', () => {
      const { scanned, allIssues, warnings } = validateAllSkills(join(__dirname, '../../skills'));
      assert.ok(scanned >= 50, `Expected 50+ skills, got ${scanned}`);
      console.log(`  Scanned ${scanned} skills: ${allIssues.length} issues, ${warnings.length} warnings`);
    });
  });
});
