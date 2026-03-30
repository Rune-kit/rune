import assert from 'node:assert';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseSkill, parseTemplate } from '../parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRO_DIR = path.resolve(__dirname, '../../../Pro/extensions');

// Signal naming: lowercase, dot-separated (same as validate-signals.js)
const SIGNAL_NAME_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

describe('parseTemplate', () => {
  test('parses template frontmatter correctly', () => {
    const content = [
      '---',
      'name: test-workflow',
      'pack: "@rune-pro/product"',
      'version: "1.0.0"',
      'description: A test workflow template',
      'domain: product',
      'chain: full',
      'signals:',
      '  emit: product.test.complete',
      '  listen: codebase.scanned',
      'connections:',
      '  - ba',
      '  - plan',
      '  - brainstorm',
      '---',
      '',
      '# Template: Test Workflow',
      '',
      '## Phases',
      '',
      '### Phase 1: Setup',
      '**Skills**: `rune:ba`',
    ].join('\n');

    const parsed = parseTemplate(content);

    assert.strictEqual(parsed.name, 'test-workflow');
    assert.strictEqual(parsed.pack, '@rune-pro/product');
    assert.strictEqual(parsed.version, '1.0.0');
    assert.strictEqual(parsed.domain, 'product');
    assert.strictEqual(parsed.chain, 'full');
    assert.deepStrictEqual(parsed.signals.emit, ['product.test.complete']);
    assert.deepStrictEqual(parsed.signals.listen, ['codebase.scanned']);
    assert.deepStrictEqual(parsed.connections, ['ba', 'plan', 'brainstorm']);
    assert.ok(parsed.sections.has('Phases'));
  });

  test('handles multiple emit signals', () => {
    const content = [
      '---',
      'name: multi-emit',
      'signals:',
      '  emit: signal.one, signal.two, signal.three',
      '  listen: signal.input',
      '---',
      '',
      '# Multi-emit template',
    ].join('\n');

    const parsed = parseTemplate(content);
    assert.deepStrictEqual(parsed.signals.emit, ['signal.one', 'signal.two', 'signal.three']);
    assert.deepStrictEqual(parsed.signals.listen, ['signal.input']);
  });

  test('handles no signals gracefully', () => {
    const content = [
      '---',
      'name: no-signals',
      'domain: test',
      '---',
      '',
      '# Template without signals',
    ].join('\n');

    const parsed = parseTemplate(content);
    assert.deepStrictEqual(parsed.signals.emit, []);
    assert.deepStrictEqual(parsed.signals.listen, []);
  });

  test('handles no connections gracefully', () => {
    const content = [
      '---',
      'name: no-connections',
      '---',
      '',
      '# Template without connections',
    ].join('\n');

    const parsed = parseTemplate(content);
    assert.deepStrictEqual(parsed.connections, []);
  });

  test('defaults chain to standard', () => {
    const content = ['---', 'name: default-chain', '---', '', '# Template'].join('\n');

    const parsed = parseTemplate(content);
    assert.strictEqual(parsed.chain, 'standard');
  });

  test('extracts cross-references from body', () => {
    const content = [
      '---',
      'name: with-refs',
      '---',
      '',
      '# Template',
      '',
      'Uses `rune:ba` and `rune:plan` for setup.',
    ].join('\n');

    const parsed = parseTemplate(content);
    assert.strictEqual(parsed.crossRefs.length, 2);
    assert.strictEqual(parsed.crossRefs[0].skillName, 'ba');
    assert.strictEqual(parsed.crossRefs[1].skillName, 'plan');
  });
});

describe('YAML list parsing in frontmatter', () => {
  // This tests the parser's ability to handle YAML list items (- item)
  // which was added for template connections support
  test('parses YAML list items under nested key', () => {
    const content = [
      '---',
      'name: yaml-list-test',
      'connections:',
      '  - alpha',
      '  - beta',
      '  - gamma-delta',
      '---',
      '',
      '# Test',
    ].join('\n');

    const parsed = parseTemplate(content);
    assert.deepStrictEqual(parsed.connections, ['alpha', 'beta', 'gamma-delta']);
  });

  test('YAML list does not break existing key-value nested blocks', () => {
    // Ensure the parser still handles metadata: { key: value } correctly
    const content = [
      '---',
      'name: skill-test',
      'description: Test',
      'metadata:',
      '  layer: L2',
      '  model: sonnet',
      '  emit: code.changed',
      '---',
      '',
      '# skill-test',
    ].join('\n');

    const parsed = parseSkill(content);
    assert.strictEqual(parsed.name, 'skill-test');
    assert.strictEqual(parsed.layer, 'L2');
    assert.strictEqual(parsed.model, 'sonnet');
    assert.deepStrictEqual(parsed.signals.emit, ['code.changed']);
  });
});

describe('Pro template files', () => {
  const packs = ['pro-product', 'pro-data-science', 'pro-sales', 'pro-support'];

  for (const pack of packs) {
    const templatesDir = path.join(PRO_DIR, pack, 'templates');

    test(`${pack} has templates directory`, () => {
      assert.ok(existsSync(templatesDir), `${templatesDir} should exist`);
    });

    // Skip if Pro dir doesn't exist (CI without Pro repo)
    if (!existsSync(templatesDir)) continue;

    const files = readdirSync(templatesDir).filter((f) => f.endsWith('.md'));

    for (const file of files) {
      const templatePath = path.join(templatesDir, file);

      test(`${pack}/${file}: parses without error`, () => {
        const content = readFileSync(templatePath, 'utf-8');
        const parsed = parseTemplate(content, templatePath);
        assert.ok(parsed.name, `template ${file} must have a name`);
      });

      test(`${pack}/${file}: has required frontmatter fields`, () => {
        const content = readFileSync(templatePath, 'utf-8');
        const parsed = parseTemplate(content, templatePath);

        assert.ok(parsed.name, 'name is required');
        assert.ok(parsed.pack, 'pack is required');
        assert.ok(parsed.version, 'version is required');
        assert.ok(parsed.description, 'description is required');
        assert.ok(parsed.domain, 'domain is required');
        assert.ok(parsed.chain, 'chain is required');
      });

      test(`${pack}/${file}: has valid signal names`, () => {
        const content = readFileSync(templatePath, 'utf-8');
        const parsed = parseTemplate(content, templatePath);

        for (const signal of parsed.signals.emit) {
          assert.ok(SIGNAL_NAME_PATTERN.test(signal), `emit signal "${signal}" must match lowercase.dot.notation`);
        }
        for (const signal of parsed.signals.listen) {
          assert.ok(
            SIGNAL_NAME_PATTERN.test(signal),
            `listen signal "${signal}" must match lowercase.dot.notation`,
          );
        }
      });

      test(`${pack}/${file}: has at least one connection`, () => {
        const content = readFileSync(templatePath, 'utf-8');
        const parsed = parseTemplate(content, templatePath);
        assert.ok(parsed.connections.length > 0, 'template must declare skill connections');
      });

      test(`${pack}/${file}: body has Phases section`, () => {
        const content = readFileSync(templatePath, 'utf-8');
        const parsed = parseTemplate(content, templatePath);
        assert.ok(parsed.sections.has('Phases'), 'template must have a ## Phases section');
      });

      test(`${pack}/${file}: body has Acceptance Criteria section`, () => {
        const content = readFileSync(templatePath, 'utf-8');
        const parsed = parseTemplate(content, templatePath);
        assert.ok(parsed.sections.has('Acceptance Criteria'), 'template must have ## Acceptance Criteria');
      });
    }
  }
});

describe('template count per pack', () => {
  const expectedCounts = {
    'pro-product': 3,
    'pro-data-science': 2,
    'pro-sales': 2,
    'pro-support': 2,
  };

  for (const [pack, expected] of Object.entries(expectedCounts)) {
    test(`${pack} has ${expected} templates`, () => {
      const templatesDir = path.join(PRO_DIR, pack, 'templates');
      if (!existsSync(templatesDir)) {
        assert.fail(`${templatesDir} does not exist`);
        return;
      }
      const files = readdirSync(templatesDir).filter((f) => f.endsWith('.md'));
      assert.strictEqual(files.length, expected, `${pack} should have ${expected} templates, got ${files.length}`);
    });
  }
});
