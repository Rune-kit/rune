/**
 * improve-architecture skill — structural and vocabulary tests.
 *
 * Validates:
 *   - SKILL.md parses, version 0.1.0, layer L2, model opus
 *   - Required reference files exist (language, deepening, interface-design, scoring)
 *   - evals.md exists with >=4 evals across categories
 *   - Vocabulary discipline: skill body + references do NOT use banned aliases
 *   - Proposal payload schema shape (sample YAML in SKILL.md parses)
 */

import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseSkill } from '../parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(__dirname, '../../skills/improve-architecture');

const REQUIRED_FILES = [
  'SKILL.md',
  'references/language.md',
  'references/deepening.md',
  'references/interface-design.md',
  'references/scoring.md',
  'evals.md',
];

// --- Files exist ---

describe('improve-architecture file presence', () => {
  for (const f of REQUIRED_FILES) {
    test(`${f} exists`, () => {
      const p = path.join(SKILL_DIR, f);
      assert.ok(existsSync(p), `missing: ${f}`);
    });
  }
});

// --- SKILL.md parses correctly ---

test('SKILL.md frontmatter — name, version, layer, model', () => {
  const skillPath = path.join(SKILL_DIR, 'SKILL.md');
  const parsed = parseSkill(readFileSync(skillPath, 'utf-8'));
  assert.strictEqual(parsed.frontmatter.name, 'improve-architecture');
  assert.strictEqual(parsed.frontmatter.metadata.version, '0.1.0');
  assert.strictEqual(parsed.frontmatter.metadata.layer, 'L2');
  assert.strictEqual(parsed.frontmatter.metadata.model, 'opus');
});

test('SKILL.md emit includes architecture.shallow.flagged + architecture.deletion.passed', () => {
  const skillPath = path.join(SKILL_DIR, 'SKILL.md');
  const content = readFileSync(skillPath, 'utf-8');
  assert.ok(/emit:.*architecture\.shallow\.flagged/.test(content), 'emits architecture.shallow.flagged');
  assert.ok(/emit:.*architecture\.deletion\.passed/.test(content), 'emits architecture.deletion.passed');
});

// --- Required reference content ---

test('language.md defines all 8 controlled terms', () => {
  const content = readFileSync(path.join(SKILL_DIR, 'references/language.md'), 'utf-8');
  const required = ['Module', 'Interface', 'Implementation', 'Depth', 'Seam', 'Adapter', 'Leverage', 'Locality'];
  for (const term of required) {
    // Each term should appear as a heading line `### Term`
    assert.ok(new RegExp(`^### ${term}\\b`, 'm').test(content), `language.md missing heading for "${term}"`);
  }
});

test('deepening.md lists all 4 dependency categories', () => {
  const content = readFileSync(path.join(SKILL_DIR, 'references/deepening.md'), 'utf-8');
  for (const cat of ['In-process', 'Local-substitutable', 'Remote-owned', 'True-external']) {
    assert.ok(content.includes(cat), `deepening.md missing dependency category "${cat}"`);
  }
});

test('scoring.md provides numeric rubric for depth/leverage/locality', () => {
  const content = readFileSync(path.join(SKILL_DIR, 'references/scoring.md'), 'utf-8');
  for (const metric of ['## Depth (1–5)', '## Leverage (1–5)', '## Locality (1–5)']) {
    assert.ok(content.includes(metric), `scoring.md missing section "${metric}"`);
  }
  // Deletion test verdict enum
  for (const verdict of ['vanish', 'concentrate', 'redistribute']) {
    assert.ok(content.includes(verdict), `scoring.md missing deletion-test verdict "${verdict}"`);
  }
});

// --- Eval coverage ---

test('evals.md has >=4 evals across categories', () => {
  const content = readFileSync(path.join(SKILL_DIR, 'evals.md'), 'utf-8');
  const evalMatches = content.match(/^## Eval: E\d+/gm) || [];
  assert.ok(evalMatches.length >= 4, `expected >=4 evals, found ${evalMatches.length}`);

  for (const cat of ['happy-path', 'edge-case', 'adversarial', 'jailbreak']) {
    assert.ok(content.includes(cat), `evals.md missing category "${cat}"`);
  }
});

// --- Vocabulary discipline: banned aliases in narrative prose ---

describe('vocabulary discipline', () => {
  // Skip narrative scan inside reference files that explicitly enumerate banned terms
  // (language.md lists "Avoid:" rules — those mentions are intentional)
  const SKIPPED_FILES = ['references/language.md'];

  // Banned alias terms in skill narrative.
  // We allow them inside fenced code blocks AND inside lines starting with "Avoid:" or "Banned"
  // to permit legitimate doctrine prose ("don't say boundary").
  const BANNED_ALIASES = ['boundary', 'component', 'service'];

  for (const f of REQUIRED_FILES) {
    if (SKIPPED_FILES.includes(f) || f === 'evals.md') continue;
    test(`${f} narrative has no banned aliases`, () => {
      const content = readFileSync(path.join(SKILL_DIR, f), 'utf-8');
      const lines = content.split('\n');
      let inFence = false;
      const violations = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith('```')) {
          inFence = !inFence;
          continue;
        }
        if (inFence) continue;
        // Skip lines that explicitly call out banned terms
        const trimmed = line.trim();
        if (
          trimmed.startsWith('*Avoid*') ||
          trimmed.startsWith('Avoid:') ||
          trimmed.startsWith('Banned') ||
          trimmed.startsWith('- **') || // banned-framings list items
          /["“”'].*("|”|')\s*$/.test(trimmed) || // quoted phrases like "service"
          line.includes('banned ') // doctrine sentences mentioning banned X
        ) {
          continue;
        }
        for (const bad of BANNED_ALIASES) {
          // Match whole word, not substring (so "microservice" wouldn't trigger "service" only when it's a standalone word)
          if (new RegExp(`\\b${bad}\\b`, 'i').test(line) && !line.includes(`"${bad}"`)) {
            violations.push(`${f}:${i + 1}: ${line.trim()}`);
            break;
          }
        }
      }
      assert.deepStrictEqual(violations, [], `vocabulary violations in ${f}:\n${violations.join('\n')}`);
    });
  }
});

// --- Proposal payload sample is parseable ---

test('SKILL.md sample proposal payload is well-formed YAML-ish', () => {
  const content = readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf-8');
  // Find the architecture.proposal block
  const match = content.match(/architecture\.proposal:[\s\S]*?(?=\n```|\n\n##)/);
  assert.ok(match, 'SKILL.md missing architecture.proposal sample');
  const block = match[0];
  // Must include required fields
  for (const field of [
    'module_path:',
    'current:',
    'target:',
    'dependency_category:',
    'suggested_seam:',
    'adapters_planned:',
  ]) {
    assert.ok(block.includes(field), `proposal payload missing field "${field}"`);
  }
});
