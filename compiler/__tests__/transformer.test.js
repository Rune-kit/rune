import assert from 'node:assert';
import { describe, test } from 'node:test';
import { getAdapter } from '../adapters/index.js';
import { transformSkill } from '../transformer.js';

// --- Transformer pipeline ---

describe('transformSkill', () => {
  const mockSkill = {
    name: 'fix',
    layer: 'L2',
    group: 'workflow',
    description: 'Apply code fixes',
    body: '# fix\n\nUse `rune:cook` for orchestration.\n\nUse `Read` to check files.\n\n## Steps\n\n1. Analyze\n2. Fix\n3. Verify',
    crossRefs: ['cook'],
    toolRefs: ['Read'],
    hardGates: [],
    frontmatter: { layer: 'L2', model: 'sonnet' },
    sections: new Map(),
  };

  test('Claude adapter returns body unchanged', () => {
    const claude = getAdapter('claude');
    const result = transformSkill(mockSkill, claude);
    assert.strictEqual(result.body, mockSkill.body);
    assert.strictEqual(result.header, '');
    assert.strictEqual(result.footer, '');
  });

  test('Cursor adapter transforms cross-refs to skill references', () => {
    const cursor = getAdapter('cursor');
    const result = transformSkill(mockSkill, cursor);
    assert.ok(result.body.includes('the rune-cook skill'));
    assert.ok(!result.body.includes('rune:cook'));
  });

  test('result has header, body, and footer', () => {
    const cursor = getAdapter('cursor');
    const result = transformSkill(mockSkill, cursor);
    assert.ok(typeof result.header === 'string');
    assert.ok(typeof result.body === 'string');
    assert.ok(typeof result.footer === 'string');
    assert.ok(result.header.length > 0, 'header should not be empty for non-Claude');
    assert.ok(result.footer.length > 0, 'footer should not be empty for non-Claude');
  });

  test('Cursor header contains SKILL.md frontmatter with name and description', () => {
    const cursor = getAdapter('cursor');
    const result = transformSkill(mockSkill, cursor);
    assert.ok(result.header.includes('name: rune-'));
    assert.ok(result.header.includes('description:'));
  });

  test('Generic adapter transforms refs to descriptive text', () => {
    const generic = getAdapter('generic');
    const result = transformSkill(mockSkill, generic);
    assert.ok(result.body.includes('rune-cook rule file'));
  });

  test('postProcess strips context: fork and agent: general-purpose', () => {
    const skillWithDirectives = {
      ...mockSkill,
      body: 'context: fork\nagent: general-purpose\n# fix\n\nContent here.',
    };
    const cursor = getAdapter('cursor');
    const result = transformSkill(skillWithDirectives, cursor);
    assert.ok(!result.body.includes('context: fork'));
    assert.ok(!result.body.includes('agent: general-purpose'));
  });
});
