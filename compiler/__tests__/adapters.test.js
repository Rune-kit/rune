import assert from 'node:assert';
import { describe, test } from 'node:test';
import { getAdapter, listPlatforms } from '../adapters/index.js';

// --- Adapter registry ---

test('listPlatforms returns all 13 platform adapters', () => {
  const adapters = listPlatforms();
  const expected = [
    'claude',
    'cursor',
    'windsurf',
    'antigravity',
    'codex',
    'opencode',
    'openclaw',
    'generic',
    'aider',
    'copilot',
    'gemini',
    'qoder',
    'qwen',
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

const ADAPTER_NAMES = [
  'cursor',
  'windsurf',
  'antigravity',
  'codex',
  'opencode',
  'generic',
  'aider',
  'copilot',
  'gemini',
  'qoder',
  'qwen',
];

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

// --- New v2.18 adapters: shape + generateExtraFiles contract ---

test('qoder adapter targets .qoder/rules and emits AGENTS.md', async () => {
  const qoder = getAdapter('qoder');
  assert.strictEqual(qoder.outputDir, '.qoder/rules');
  assert.strictEqual(qoder.useSkillDirectories, false);
  assert.strictEqual(typeof qoder.generateExtraFiles, 'function');
  const extras = await qoder.generateExtraFiles({ stats: { skillCount: 5, packCount: 1, files: [] } });
  assert.ok(extras.some((e) => e.path === 'AGENTS.md' && e.content.includes('Rune')));
});

test('copilot adapter targets .github/instructions with .instructions.md ext', async () => {
  const copilot = getAdapter('copilot');
  assert.strictEqual(copilot.outputDir, '.github/instructions');
  assert.strictEqual(copilot.fileExtension, '.instructions.md');
  const header = copilot.generateHeader({ name: 'cook', layer: 'L1', group: 'orchestrator', description: 'Test' });
  // Per docs.github.com Copilot CLI custom-instructions spec, only `applyTo` is a
  // documented frontmatter field. Description and tier-hint must live in the body.
  assert.ok(header.includes('applyTo: "**"'));
  assert.ok(!/^description:/m.test(header.split('---')[1] || ''), 'description must NOT appear in frontmatter');
  const extras = await copilot.generateExtraFiles({ stats: { skillCount: 5, packCount: 1, files: [] } });
  assert.ok(extras.some((e) => e.path === '.github/copilot-instructions.md'));
  assert.ok(extras.some((e) => e.path === 'AGENTS.md'));
});

test('codex adapter migrated to generateExtraFiles for AGENTS.md (no longer special-cased in emitter)', async () => {
  const codex = getAdapter('codex');
  assert.strictEqual(typeof codex.generateExtraFiles, 'function');
  const extras = await codex.generateExtraFiles({
    stats: { skillCount: 64, packCount: 14, crossRefsResolved: 287, files: [] },
  });
  const agentsMd = extras.find((e) => e.path === 'AGENTS.md');
  assert.ok(agentsMd, 'codex must emit AGENTS.md via generateExtraFiles');
  assert.ok(agentsMd.content.includes('Rune'));
  assert.ok(agentsMd.content.includes('64 core skills'));
});

test('emitter rejects absolute paths from generateExtraFiles (path-traversal guard)', async () => {
  // Smoke: verify both qoder and gemini return relative paths only (no absolute).
  for (const name of ['qoder', 'copilot', 'aider', 'qwen', 'gemini', 'codex']) {
    const adapter = getAdapter(name);
    const extras = await adapter.generateExtraFiles({
      stats: { skillCount: 1, packCount: 0, crossRefsResolved: 0, files: ['rune-cook.md'] },
      outputDir: '/tmp/test',
    });
    for (const extra of extras || []) {
      assert.ok(!extra.path.startsWith('/'), `${name} returned absolute path: ${extra.path}`);
      assert.ok(!/^[A-Z]:[\\/]/.test(extra.path), `${name} returned Windows absolute path: ${extra.path}`);
    }
  }
});

test('aider adapter emits .aider.conf.yml with read array', async () => {
  const aider = getAdapter('aider');
  assert.strictEqual(aider.outputDir, 'aider/rules');
  const extras = await aider.generateExtraFiles({
    stats: { skillCount: 2, packCount: 0, files: ['rune-cook.md', 'rune-fix.md', 'index.md'] },
  });
  const conf = extras.find((e) => e.path === '.aider.conf.yml');
  assert.ok(conf);
  assert.ok(conf.content.includes('read:'));
  assert.ok(conf.content.includes('aider/rules/rune-cook.md'));
  assert.ok(conf.content.includes('aider/rules/rune-fix.md'));
  // index.md must NOT be in the read array
  assert.ok(!conf.content.includes('aider/rules/index.md'));
});

test('qwen adapter emits QWEN.md with @import lines', async () => {
  const qwen = getAdapter('qwen');
  assert.strictEqual(qwen.outputDir, 'qwen/skills');
  const extras = await qwen.generateExtraFiles({
    stats: { skillCount: 2, packCount: 0, files: ['rune-cook.md', 'rune-fix.md'] },
  });
  const qwenMd = extras.find((e) => e.path === 'QWEN.md');
  assert.ok(qwenMd);
  assert.ok(qwenMd.content.includes('@qwen/skills/rune-cook.md'));
  assert.ok(qwenMd.content.includes('@qwen/skills/rune-fix.md'));
});

test('gemini adapter declares generateExtraFiles for bundled GEMINI.md', () => {
  const gemini = getAdapter('gemini');
  assert.strictEqual(gemini.outputDir, 'gemini/skills');
  assert.strictEqual(typeof gemini.generateExtraFiles, 'function');
  // Full bundle test happens in pipeline test (needs filesystem) — contract checked here.
});
