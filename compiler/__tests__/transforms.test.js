import assert from 'node:assert';
import { describe, test } from 'node:test';
import { addBranding } from '../transforms/branding.js';
import { transformCrossReferences } from '../transforms/cross-references.js';
import { transformToolNames } from '../transforms/tool-names.js';

// --- Mock adapter ---

const mockAdapter = {
  name: 'test',
  transformReference(skillName, raw) {
    const isBackticked = raw.startsWith('`') && raw.endsWith('`');
    const ref = `@rune-${skillName}.mdc`;
    return isBackticked ? `\`${ref}\`` : ref;
  },
  transformToolName(toolName) {
    const map = { Read: 'read file', Write: 'write file', Bash: 'run command' };
    return map[toolName] || toolName;
  },
  generateFooter() {
    return '\n---\n> Rune Test Footer';
  },
};

const claudeAdapter = {
  name: 'claude',
};

// --- Cross-reference transform ---

describe('transformCrossReferences', () => {
  test('rewrites backticked rune:cook reference', () => {
    const input = 'Use `rune:cook` for features.';
    const result = transformCrossReferences(input, mockAdapter);
    assert.ok(result.includes('`@rune-cook.mdc`'));
    assert.ok(!result.includes('rune:cook'));
  });

  test('rewrites bare rune:plan reference', () => {
    const input = 'Delegate to rune:plan for planning.';
    const result = transformCrossReferences(input, mockAdapter);
    assert.ok(result.includes('@rune-plan.mdc'));
    assert.ok(!result.includes('rune:plan'));
  });

  test('handles multiple refs in same line', () => {
    const input = 'Use `rune:cook` then `rune:test` then `rune:fix`.';
    const result = transformCrossReferences(input, mockAdapter);
    assert.ok(result.includes('@rune-cook.mdc'));
    assert.ok(result.includes('@rune-test.mdc'));
    assert.ok(result.includes('@rune-fix.mdc'));
  });

  test('does not modify text without refs', () => {
    const input = 'Regular markdown without any references.';
    const result = transformCrossReferences(input, mockAdapter);
    assert.strictEqual(result, input);
  });
});

// --- Tool name transform ---

describe('transformToolNames', () => {
  test('rewrites tool references in backticks', () => {
    const input = 'Use `Read` to check the file.';
    const result = transformToolNames(input, mockAdapter);
    assert.ok(!result.includes('`Read`'));
  });

  test('does not modify non-tool words', () => {
    const input = 'Read the documentation carefully.';
    const result = transformToolNames(input, mockAdapter);
    // Should not touch bare "Read" without backticks in tool pattern
    assert.ok(result.includes('Read'));
  });
});

// --- Branding transform ---

describe('addBranding', () => {
  test('adds footer for non-Claude adapters', () => {
    const body = '# Skill\n\nSome content.';
    const result = addBranding(body, mockAdapter);
    assert.ok(result.includes('Rune Test Footer'));
  });

  test('skips footer for Claude adapter', () => {
    const body = '# Skill\n\nSome content.';
    const result = addBranding(body, claudeAdapter);
    assert.strictEqual(result, body);
  });
});
