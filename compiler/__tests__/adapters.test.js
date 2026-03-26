import assert from 'node:assert';
import { describe, test } from 'node:test';
import { getAdapter, listPlatforms } from '../adapters/index.js';

// --- Adapter registry ---

test('listPlatforms returns all 9 platform adapters', () => {
  const adapters = listPlatforms();
  const expected = [
    'agents',
    'claude',
    'cursor',
    'windsurf',
    'antigravity',
    'codex',
    'opencode',
    'openclaw',
    'generic',
  ];
  for (const name of expected) {
    assert.ok(adapters.includes(name), `missing adapter: ${name}`);
  }
});

test('getAdapter returns adapter by name', () => {
  const cursor = getAdapter('cursor');
  assert.strictEqual(cursor.name, 'cursor');
  assert.strictEqual(cursor.fileExtension, '.mdc');
});

test('getAdapter throws for unknown adapter', () => {
  assert.throws(() => getAdapter('nonexistent'), /unknown/i);
});

// --- Shared adapter contract ---

const REQUIRED_METHODS = [
  'transformReference',
  'transformToolName',
  'generateHeader',
  'generateFooter',
  'transformSubagentInstruction',
  'postProcess',
];

const REQUIRED_PROPS = ['name', 'outputDir', 'fileExtension', 'skillPrefix', 'skillSuffix'];

const ADAPTER_NAMES = ['agents', 'cursor', 'windsurf', 'antigravity', 'codex', 'opencode', 'generic'];

for (const adapterName of ADAPTER_NAMES) {
  describe(`${adapterName} adapter contract`, () => {
    const adapter = getAdapter(adapterName);

    test('has all required properties', () => {
      for (const prop of REQUIRED_PROPS) {
        assert.ok(prop in adapter, `${adapterName} missing prop: ${prop}`);
      }
    });

    test('has all required methods', () => {
      for (const method of REQUIRED_METHODS) {
        assert.strictEqual(typeof adapter[method], 'function', `${adapterName} missing method: ${method}`);
      }
    });

    test('transformReference handles plain and backticked refs', () => {
      const plain = adapter.transformReference('cook', 'cook');
      assert.ok(typeof plain === 'string' && plain.length > 0);

      const backticked = adapter.transformReference('cook', '`cook`');
      assert.ok(typeof backticked === 'string' && backticked.length > 0);
    });

    test('transformToolName maps known tools', () => {
      const result = adapter.transformToolName('Read');
      assert.ok(typeof result === 'string' && result.length > 0);
    });

    test('generateHeader returns string', () => {
      const skill = { name: 'test', layer: 'L2', group: 'workflow', description: 'Test skill' };
      const header = adapter.generateHeader(skill);
      assert.strictEqual(typeof header, 'string');
    });

    test('generateFooter includes Rune branding', () => {
      const footer = adapter.generateFooter();
      assert.ok(footer.includes('Rune'), `${adapterName} footer missing Rune branding`);
    });

    test('postProcess strips Claude-specific directives', () => {
      const input = 'context: fork\ncontent\nagent: general-purpose\nmore';
      const result = adapter.postProcess(input);
      assert.ok(!result.includes('context: fork'));
      assert.ok(!result.includes('agent: general-purpose'));
    });
  });
}

// --- Cursor-specific ---

test('cursor adapter generates .mdc frontmatter with alwaysApply', () => {
  const cursor = getAdapter('cursor');
  const l0Skill = { name: 'router', layer: 'L0', group: 'meta', description: 'Routes tasks' };
  const l2Skill = { name: 'fix', layer: 'L2', group: 'workflow', description: 'Fix code' };

  const l0Header = cursor.generateHeader(l0Skill);
  assert.ok(l0Header.includes('alwaysApply: true'));

  const l2Header = cursor.generateHeader(l2Skill);
  assert.ok(l2Header.includes('alwaysApply: false'));
});

// --- Codex-specific ---

test('codex adapter uses skill directories', () => {
  const codex = getAdapter('codex');
  assert.strictEqual(codex.useSkillDirectories, true);
  assert.strictEqual(codex.skillFileName, 'SKILL.md');
});
