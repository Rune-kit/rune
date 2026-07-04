/**
 * E2E Pipeline Tests
 *
 * Tests the full compile pipeline: parse → transform → assemble output.
 * Verifies that real skills produce valid output for each platform adapter.
 */

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { getAdapter, listPlatforms } from '../adapters/index.js';
import { parseSkill } from '../parser.js';
import { transformSkill } from '../transformer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.resolve(__dirname, '../../skills');

// Use a real skill (cook) for e2e tests
const cookContent = readFileSync(path.join(SKILLS_DIR, 'cook/SKILL.md'), 'utf-8');
const cookParsed = parseSkill(cookContent, 'cook/SKILL.md');

const fixContent = readFileSync(path.join(SKILLS_DIR, 'fix/SKILL.md'), 'utf-8');
const fixParsed = parseSkill(fixContent, 'fix/SKILL.md');

// --- Full pipeline per platform ---

describe('full pipeline: cook skill', () => {
  for (const platform of listPlatforms()) {
    test(`${platform}: parse → transform → output`, () => {
      const adapter = getAdapter(platform);
      const result = transformSkill(cookParsed, adapter);

      // Result structure
      assert.ok(typeof result.header === 'string', `${platform}: header not string`);
      assert.ok(typeof result.body === 'string', `${platform}: body not string`);
      assert.ok(typeof result.footer === 'string', `${platform}: footer not string`);

      // Body should contain meaningful content
      assert.ok(result.body.length > 500, `${platform}: body too short (${result.body.length})`);

      if (platform === 'claude') {
        // Claude: passthrough, no header/footer
        assert.strictEqual(result.header, '');
        assert.strictEqual(result.footer, '');
        // Should still have original cross-refs
        assert.ok(result.body.includes('rune:'), `claude: should preserve rune: cross-refs`);
      } else {
        // Non-Claude: should have transformed cross-refs
        assert.ok(!result.body.includes('`rune:cook`'), `${platform}: should not have backticked rune:cook cross-ref`);

        // Should have footer with branding
        assert.ok(result.footer.includes('Rune'), `${platform}: footer missing branding`);
      }
    });
  }
});

describe('full pipeline: fix skill', () => {
  test('cursor: cross-refs transformed to skill references', () => {
    const adapter = getAdapter('cursor');
    const result = transformSkill(fixParsed, adapter);

    // Fix references cook, debug, test, etc. — at least some should be transformed
    assert.ok(result.body.includes('the rune-'), 'cursor output should contain skill references');
  });

  test('generic: cross-refs transformed to descriptive text', () => {
    const adapter = getAdapter('generic');
    const result = transformSkill(fixParsed, adapter);
    assert.ok(result.body.includes('rule file'), 'generic output should contain "rule file" references');
  });

  test('openclaw: cross-refs transformed to .md file refs', () => {
    const adapter = getAdapter('openclaw');
    const result = transformSkill(fixParsed, adapter);
    assert.ok(result.body.includes('.md'), 'openclaw output should contain .md references');
  });
});

// --- Output assembly (header + body + footer) ---

describe('output assembly', () => {
  test('cursor output assembles into valid SKILL.md file', () => {
    const adapter = getAdapter('cursor');
    const result = transformSkill(cookParsed, adapter);
    const assembled = result.header + result.body + result.footer;

    // Should start with YAML frontmatter
    assert.ok(assembled.startsWith('---\n'), 'cursor SKILL.md should start with YAML frontmatter');
    assert.ok(assembled.includes('name: rune-'), 'cursor SKILL.md should have name');
    assert.ok(assembled.includes('description:'), 'cursor SKILL.md should have description');
  });

  test('codex output has YAML frontmatter with name', () => {
    const adapter = getAdapter('codex');
    const result = transformSkill(cookParsed, adapter);
    const assembled = result.header + result.body + result.footer;

    assert.ok(assembled.includes('name: rune-cook'), 'codex should have name: rune-cook');
  });

  test('generic output has markdown heading', () => {
    const adapter = getAdapter('generic');
    const result = transformSkill(cookParsed, adapter);

    assert.ok(result.header.includes('# rune-cook'), 'generic header should have # rune-cook');
  });
});
