import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseSkill } from '../parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.resolve(__dirname, '../../skills');

test('parse cook SKILL.md', () => {
  const content = readFileSync(path.join(SKILLS_DIR, 'cook/SKILL.md'), 'utf-8');
  const parsed = parseSkill(content, 'cook/SKILL.md');

  console.log('name:', JSON.stringify(parsed.name));
  console.log('description:', JSON.stringify(parsed.description?.substring(0, 50)));
  console.log('layer:', parsed.layer);
  console.log('model:', parsed.model);
  console.log('group:', parsed.group);
  console.log('contextFork:', parsed.contextFork);
  console.log('agentType:', parsed.agentType);
  console.log('crossRefs:', parsed.crossRefs.length);
  console.log('toolRefs:', parsed.toolRefs.length);
  console.log('hardGates:', parsed.hardGates.length);
  console.log('sections:', [...parsed.sections.keys()]);
  console.log('frontmatter keys:', Object.keys(parsed.frontmatter));

  assert.strictEqual(parsed.name, 'cook');
  assert.strictEqual(parsed.layer, 'L1');
  assert.ok(parsed.crossRefs.length > 0);
  assert.ok(parsed.hardGates.length > 0);
});

test('parse fix SKILL.md', () => {
  const content = readFileSync(path.join(SKILLS_DIR, 'fix/SKILL.md'), 'utf-8');
  const parsed = parseSkill(content, 'fix/SKILL.md');

  console.log('fix name:', JSON.stringify(parsed.name));
  console.log('fix layer:', parsed.layer);

  assert.strictEqual(parsed.name, 'fix');
  assert.strictEqual(parsed.layer, 'L2');
});

test('parse verification SKILL.md', () => {
  const content = readFileSync(path.join(SKILLS_DIR, 'verification/SKILL.md'), 'utf-8');
  const parsed = parseSkill(content, 'verification/SKILL.md');

  console.log('verification name:', JSON.stringify(parsed.name));
  console.log('verification layer:', parsed.layer);
  console.log('verification toolRefs:', parsed.toolRefs.length);

  assert.strictEqual(parsed.name, 'verification');
  assert.strictEqual(parsed.layer, 'L3');
});

describe('signals parsing', () => {
  test('parses emit and listen from metadata', () => {
    const content = [
      '---',
      'name: alpha',
      'description: "Test skill"',
      'metadata:',
      '  layer: L2',
      '  emit: code.changed, tests.passed',
      '  listen: plan.ready',
      '---',
      '',
      '# alpha',
    ].join('\n');

    const parsed = parseSkill(content);
    assert.ok(parsed.signals, 'signals should not be null');
    assert.deepStrictEqual(parsed.signals.emit, ['code.changed', 'tests.passed']);
    assert.deepStrictEqual(parsed.signals.listen, ['plan.ready']);
  });

  test('emit only — no listen', () => {
    const content = [
      '---',
      'name: beta',
      'description: "Emitter only"',
      'metadata:',
      '  layer: L3',
      '  emit: deploy.complete',
      '---',
      '',
      '# beta',
    ].join('\n');

    const parsed = parseSkill(content);
    assert.ok(parsed.signals);
    assert.deepStrictEqual(parsed.signals.emit, ['deploy.complete']);
    assert.deepStrictEqual(parsed.signals.listen, []);
  });

  test('listen only — no emit', () => {
    const content = [
      '---',
      'name: gamma',
      'description: "Listener only"',
      'metadata:',
      '  layer: L3',
      '  listen: code.changed',
      '---',
      '',
      '# gamma',
    ].join('\n');

    const parsed = parseSkill(content);
    assert.ok(parsed.signals);
    assert.deepStrictEqual(parsed.signals.emit, []);
    assert.deepStrictEqual(parsed.signals.listen, ['code.changed']);
  });

  test('no signals — returns null', () => {
    const content = [
      '---',
      'name: delta',
      'description: "No signals"',
      'metadata:',
      '  layer: L3',
      '---',
      '',
      '# delta',
    ].join('\n');

    const parsed = parseSkill(content);
    assert.strictEqual(parsed.signals, null);
  });

  test('real cook skill has signals', () => {
    const content = readFileSync(path.join(SKILLS_DIR, 'cook/SKILL.md'), 'utf-8');
    const parsed = parseSkill(content, 'cook/SKILL.md');
    assert.ok(parsed.signals, 'cook should have signals');
    assert.ok(parsed.signals.emit.includes('phase.complete'));
  });

  test('real test skill has emit and listen', () => {
    const content = readFileSync(path.join(SKILLS_DIR, 'test/SKILL.md'), 'utf-8');
    const parsed = parseSkill(content, 'test/SKILL.md');
    assert.ok(parsed.signals, 'test should have signals');
    assert.ok(parsed.signals.emit.includes('tests.passed'));
    assert.ok(parsed.signals.emit.includes('tests.failed'));
    assert.ok(parsed.signals.listen.includes('code.changed'));
  });

  test('top-level emit/listen (Pro/Business pack format)', () => {
    const content = [
      '---',
      'name: "feature-spec"',
      'pack: "@rune-pro/product"',
      'version: "1.2.0"',
      'model: opus',
      'tools: [Read, Write]',
      'emit: product.spec.drafted',
      'listen: sales.account.researched, product.research.complete',
      '---',
      '',
      '# feature-spec',
    ].join('\n');

    const parsed = parseSkill(content);
    assert.ok(parsed.signals, 'top-level signals should be parsed');
    assert.deepStrictEqual(parsed.signals.emit, ['product.spec.drafted']);
    assert.deepStrictEqual(parsed.signals.listen, ['sales.account.researched', 'product.research.complete']);
  });

  test('top-level emit only (no listen)', () => {
    const content = [
      '---',
      'name: "account-research"',
      'emit: sales.account.researched',
      '---',
      '',
      '# account-research',
    ].join('\n');

    const parsed = parseSkill(content);
    assert.ok(parsed.signals);
    assert.deepStrictEqual(parsed.signals.emit, ['sales.account.researched']);
    assert.deepStrictEqual(parsed.signals.listen, []);
  });

  test('metadata emit takes precedence over top-level', () => {
    const content = [
      '---',
      'name: "hybrid"',
      'emit: top.level.signal',
      'metadata:',
      '  emit: nested.signal',
      '---',
      '',
      '# hybrid',
    ].join('\n');

    const parsed = parseSkill(content);
    assert.ok(parsed.signals);
    assert.deepStrictEqual(parsed.signals.emit, ['nested.signal']);
  });
});
