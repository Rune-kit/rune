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
  assert.strictEqual(cursor.fileExtension, '.md');
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

// --- Frontmatter escaping (regression: descriptions containing quoted phrases) ---

test('generateHeader escapes quoted descriptions exactly once (valid YAML)', () => {
  // Parser hands adapters CLEAN text (interior \" already unescaped) — the
  // adapter re-escapes exactly once. Double-escaping produced `\\"` which
  // prematurely terminates the YAML scalar.
  const skill = { name: 'docs', layer: 'L2', group: 'workflow', description: 'The "docs are never outdated" skill' };
  for (const name of ['cursor', 'windsurf', 'copilot', 'codex', 'antigravity', 'opencode', 'gemini', 'qoder', 'qwen']) {
    const header = getAdapter(name).generateHeader(skill);
    assert.ok(header.includes('\\"docs are never outdated\\"'), `${name} should escape quotes once`);
    assert.ok(!header.includes('\\\\"'), `${name} must not double-escape quotes`);
  }
});

// --- Cursor-specific ---

test('cursor adapter emits Agent Skills (dir-per-skill SKILL.md)', () => {
  const cursor = getAdapter('cursor');
  assert.strictEqual(cursor.outputDir, '.cursor/skills');
  assert.strictEqual(cursor.useSkillDirectories, true);
  assert.strictEqual(cursor.skillFileName, 'SKILL.md');

  const header = cursor.generateHeader({ name: 'fix', layer: 'L2', group: 'workflow', description: 'Fix code' });
  assert.ok(header.includes('name: rune-fix'));
  assert.ok(header.includes('description: "Fix code"'));
  assert.ok(!header.includes('alwaysApply'), 'skills format has no alwaysApply');
});

// --- Windsurf-specific ---

test('windsurf adapter emits Cascade Skills (dir-per-skill SKILL.md)', () => {
  const windsurf = getAdapter('windsurf');
  assert.strictEqual(windsurf.outputDir, '.windsurf/skills');
  assert.strictEqual(windsurf.useSkillDirectories, true);
  assert.strictEqual(windsurf.skillFileName, 'SKILL.md');

  const header = windsurf.generateHeader({ name: 'fix', layer: 'L2', group: 'workflow', description: 'Fix code' });
  assert.ok(header.includes('name: rune-fix'));
  assert.ok(header.includes('description: "Fix code"'));
});

// --- Codex-specific ---

test('codex adapter uses skill directories', () => {
  const codex = getAdapter('codex');
  assert.strictEqual(codex.useSkillDirectories, true);
  assert.strictEqual(codex.skillFileName, 'SKILL.md');
});

test('codex AGENTS.md documents the tier→model + reasoning-effort mapping', async () => {
  const codex = getAdapter('codex');
  const extras = await codex.generateExtraFiles({
    stats: { skillCount: 65, crossRefsResolved: 204, packCount: 14, files: [] },
  });
  const agents = extras.find((e) => e.path === 'AGENTS.md');
  assert.ok(agents, 'codex emits AGENTS.md');
  // Guards against a MODEL_MAP / REASONING_EFFORT_MAP interpolation swap.
  assert.match(agents.content, /opus → `gpt-5\.6-sol` \(`model_reasoning_effort = "high"`\)/);
  assert.match(agents.content, /sonnet → `gpt-5\.6-terra` \(`model_reasoning_effort = "medium"`\)/);
  assert.match(agents.content, /haiku → `gpt-5\.6-terra` \(`model_reasoning_effort = "low"`\)/);
  assert.ok(extras.some((e) => e.path === '.codex/agents/rune-heavy.toml'));
  assert.ok(extras.some((e) => e.path === '.codex/agents/rune-standard.toml'));
  assert.ok(extras.some((e) => e.path === '.codex/agents/rune-fast.toml'));
});

// --- New v2.18 adapters: shape + generateExtraFiles contract ---

test('qoder adapter targets .qoder/skills (dir-per-skill) and emits AGENTS.md', async () => {
  const qoder = getAdapter('qoder');
  assert.strictEqual(qoder.outputDir, '.qoder/skills');
  assert.strictEqual(qoder.useSkillDirectories, true);
  assert.strictEqual(qoder.skillFileName, 'SKILL.md');
  assert.strictEqual(typeof qoder.generateExtraFiles, 'function');
  const extras = await qoder.generateExtraFiles({ stats: { skillCount: 5, packCount: 1, files: [] } });
  assert.ok(extras.some((e) => e.path === 'AGENTS.md' && e.content.includes('.qoder/skills')));
});

test('copilot adapter targets .github/skills with SKILL.md format', async () => {
  const copilot = getAdapter('copilot');
  assert.strictEqual(copilot.outputDir, '.github/skills');
  assert.strictEqual(copilot.useSkillDirectories, true);
  assert.strictEqual(copilot.skillFileName, 'SKILL.md');
  const header = copilot.generateHeader({
    name: 'cook',
    layer: 'L1',
    group: 'orchestrator',
    description: 'Test',
    model: 'opus',
  });
  // Agent Skills spec: name + description frontmatter; tier hint stays a body comment.
  assert.ok(header.includes('name: rune-cook'));
  assert.ok(header.includes('description: "Test"'));
  assert.ok(header.includes('<!-- tier-hint: tier:heavy -->'));
  assert.ok(!header.includes('applyTo'), 'skills format has no applyTo');
  const extras = await copilot.generateExtraFiles({ stats: { skillCount: 5, packCount: 1, files: [] } });
  assert.ok(extras.some((e) => e.path === '.github/copilot-instructions.md' && e.content.includes('.github/skills')));
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

test('qwen adapter targets .qwen/skills and emits slim QWEN.md pointer', async () => {
  const qwen = getAdapter('qwen');
  assert.strictEqual(qwen.outputDir, '.qwen/skills');
  assert.strictEqual(qwen.useSkillDirectories, true);
  assert.strictEqual(qwen.skillFileName, 'SKILL.md');
  const extras = await qwen.generateExtraFiles({
    stats: { skillCount: 2, packCount: 0, files: ['rune-cook/SKILL.md', 'rune-fix/SKILL.md'] },
  });
  const qwenMd = extras.find((e) => e.path === 'QWEN.md');
  assert.ok(qwenMd);
  assert.ok(qwenMd.content.includes('.qwen/skills/rune-<name>/SKILL.md'));
  assert.ok(!qwenMd.content.includes('@qwen/skills/'), 'no @import lines — skills are lazy-loaded natively');
});

test('gemini adapter targets .gemini/skills and emits slim GEMINI.md pointer', async () => {
  const gemini = getAdapter('gemini');
  assert.strictEqual(gemini.outputDir, '.gemini/skills');
  assert.strictEqual(gemini.useSkillDirectories, true);
  assert.strictEqual(gemini.skillFileName, 'SKILL.md');
  const extras = await gemini.generateExtraFiles({
    stats: { skillCount: 2, packCount: 0, files: ['rune-cook/SKILL.md', 'rune-fix/SKILL.md'] },
  });
  const geminiMd = extras.find((e) => e.path === 'GEMINI.md');
  assert.ok(geminiMd);
  assert.ok(geminiMd.content.includes('.gemini/skills/rune-<name>/SKILL.md'));
  assert.ok(!geminiMd.content.includes('## rune-cook'), 'no bundled H2 sections — skills are lazy-loaded natively');
});
