import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
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
