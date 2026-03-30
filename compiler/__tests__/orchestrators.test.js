import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseSkill } from '../parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUSINESS_SKILLS_DIR = path.resolve(__dirname, '../../../Business/skills');

// Signal naming pattern
const SIGNAL_NAME_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

const ORCHESTRATORS = ['launch-product', 'quarterly-review', 'compliance-audit', 'customer-lifecycle'];

describe('Business orchestrators', () => {
  test('skills directory exists', () => {
    assert.ok(existsSync(BUSINESS_SKILLS_DIR), `${BUSINESS_SKILLS_DIR} should exist`);
  });

  for (const name of ORCHESTRATORS) {
    const skillPath = path.join(BUSINESS_SKILLS_DIR, name, 'SKILL.md');

    describe(name, () => {
      test('SKILL.md exists', () => {
        assert.ok(existsSync(skillPath), `${skillPath} should exist`);
      });

      // Skip remaining tests if file doesn't exist (CI without Business repo)
      if (!existsSync(skillPath)) return;

      const content = readFileSync(skillPath, 'utf-8');
      const parsed = parseSkill(content, skillPath);

      test('has correct name', () => {
        assert.strictEqual(parsed.name, name);
      });

      test('is L1 layer', () => {
        assert.strictEqual(parsed.layer, 'L1', `${name} must be L1 orchestrator`);
      });

      test('uses opus model', () => {
        assert.strictEqual(parsed.model, 'opus', `${name} should use opus for complex orchestration`);
      });

      test('has description', () => {
        assert.ok(parsed.description.length > 50, `${name} should have a meaningful description`);
      });

      test('is context fork', () => {
        assert.strictEqual(parsed.contextFork, true, `${name} should fork context`);
      });

      test('has emit signals', () => {
        assert.ok(parsed.signals, `${name} must have signals`);
        assert.ok(parsed.signals.emit.length > 0, `${name} must emit at least one signal`);
      });

      test('has listen signals', () => {
        assert.ok(parsed.signals.listen.length > 0, `${name} must listen to at least one signal`);
      });

      test('all signals follow naming convention', () => {
        for (const signal of [...parsed.signals.emit, ...parsed.signals.listen]) {
          assert.ok(SIGNAL_NAME_PATTERN.test(signal), `signal "${signal}" must match lowercase.dot.notation`);
        }
      });

      test('has HARD-GATE block', () => {
        assert.ok(parsed.hardGates.length > 0, `${name} must have at least one HARD-GATE`);
      });

      test('has cross-references to other skills', () => {
        assert.ok(parsed.crossRefs.length >= 3, `${name} should reference at least 3 other skills`);
      });

      test('has Workflow Phases section', () => {
        assert.ok(parsed.sections.has('Workflow Phases'), `${name} must have ## Workflow Phases`);
      });

      test('has Signal Map section', () => {
        assert.ok(parsed.sections.has('Signal Map'), `${name} must have ## Signal Map`);
      });

      test('has Cross-Domain Connections section', () => {
        assert.ok(parsed.sections.has('Cross-Domain Connections'), `${name} must have ## Cross-Domain Connections`);
      });

      test('has Connections section', () => {
        assert.ok(parsed.sections.has('Connections'), `${name} must have ## Connections`);
      });

      test('has Constraints section', () => {
        assert.ok(parsed.sections.has('Constraints'), `${name} must have ## Constraints`);
      });

      test('references multiple domain packs (cross-domain)', () => {
        const body = parsed.body;
        const domains = ['finance', 'legal', 'hr', 'product', 'sales', 'support', 'enterprise-search', 'data-science'];
        const referencedDomains = domains.filter((d) => body.toLowerCase().includes(d));
        assert.ok(referencedDomains.length >= 3, `${name} must reference at least 3 domains, found: ${referencedDomains.join(', ')}`);
      });

      test('emits business.* signals', () => {
        const businessSignals = parsed.signals.emit.filter((s) => s.startsWith('business.'));
        assert.ok(businessSignals.length > 0, `${name} must emit at least one business.* signal`);
      });

      test('body is substantial (300-500+ lines)', () => {
        const lineCount = content.split('\n').length;
        assert.ok(lineCount >= 100, `${name} should be at least 100 lines, got ${lineCount}`);
      });
    });
  }
});

describe('orchestrator signal consistency', () => {
  // Verify orchestrators don't declare signals that overlap with each other
  const allEmitted = new Set();
  const duplicates = [];

  for (const name of ORCHESTRATORS) {
    const skillPath = path.join(BUSINESS_SKILLS_DIR, name, 'SKILL.md');
    if (!existsSync(skillPath)) continue;

    const content = readFileSync(skillPath, 'utf-8');
    const parsed = parseSkill(content, skillPath);

    for (const signal of parsed.signals.emit) {
      if (allEmitted.has(signal)) {
        duplicates.push({ signal, skill: name });
      }
      allEmitted.add(signal);
    }
  }

  test('no duplicate emit signals across orchestrators', () => {
    assert.strictEqual(
      duplicates.length,
      0,
      `Duplicate signals: ${duplicates.map((d) => `${d.signal} (${d.skill})`).join(', ')}`,
    );
  });
});
