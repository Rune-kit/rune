/**
 * Skill description quality (v2.15+) — lint validation that every SKILL.md
 * description is YAML-safe, well-formed, and ambiguous-name skills carry an
 * explicit "Use when…" routing hint.
 *
 * Validates:
 *   - All descriptions are double-quoted (YAML safety)
 *   - All descriptions end with `.` or `?`
 *   - All descriptions are 30-500 chars
 *   - Specific ambiguous-name skills include "Use when…" clause
 */

import assert from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, test } from 'node:test';

const SKILLS_DIR = resolve(import.meta.dirname, '../..', 'skills');

function listSkills() {
  return readdirSync(SKILLS_DIR).filter((name) => {
    const p = join(SKILLS_DIR, name);
    return statSync(p).isDirectory() && readdirSync(p).includes('SKILL.md');
  });
}

function readDescriptionLine(name) {
  const text = readFileSync(join(SKILLS_DIR, name, 'SKILL.md'), 'utf8');
  const lines = text.split(/\r?\n/);
  for (const line of lines.slice(0, 20)) {
    if (line.startsWith('description:')) return line;
  }
  return null;
}

function extractDescriptionValue(line) {
  const m = line.match(/^description:\s+"(.+)"\s*$/);
  if (m) return m[1].replace(/\\"/g, '"');
  return null;
}

const AMBIGUOUS_SKILLS_REQUIRING_USE_WHEN = [
  'ba',
  'completion-gate',
  'constraint-check',
  'doc-processor',
  'integrity-check',
  'logic-guardian',
  'onboard',
  'preflight',
  'sentinel-env',
  'watchdog',
  'worktree',
  'hallucination-guard',
  'mcp-builder',
];

describe('Skill description format', () => {
  test('every description is double-quoted (YAML-safe)', () => {
    const skills = listSkills();
    const violations = [];
    for (const name of skills) {
      const line = readDescriptionLine(name);
      if (!line) {
        violations.push(`${name}: no description line found`);
        continue;
      }
      if (!line.match(/^description:\s+"/)) {
        violations.push(`${name}: description is not double-quoted`);
      }
    }
    assert.strictEqual(violations.length, 0, `Unquoted descriptions:\n${violations.join('\n')}`);
  });

  test('every description ends with terminal punctuation', () => {
    const skills = listSkills();
    const violations = [];
    for (const name of skills) {
      const line = readDescriptionLine(name);
      const val = extractDescriptionValue(line);
      if (!val) continue;
      if (!val.match(/[.?]$/)) {
        violations.push(`${name}: description does not end with . or ?`);
      }
    }
    assert.strictEqual(violations.length, 0, `Bad endings:\n${violations.join('\n')}`);
  });

  test('every description is 30-500 chars', () => {
    const skills = listSkills();
    const violations = [];
    for (const name of skills) {
      const line = readDescriptionLine(name);
      const val = extractDescriptionValue(line);
      if (!val) continue;
      if (val.length < 30) violations.push(`${name}: description too short (${val.length} chars)`);
      if (val.length > 500) violations.push(`${name}: description too long (${val.length} chars)`);
    }
    assert.strictEqual(violations.length, 0, `Length violations:\n${violations.join('\n')}`);
  });
});

describe('Ambiguous-name skills include "Use when…" routing hint', () => {
  test('all 13 ambiguous-name skills explicitly state "Use when…"', () => {
    const violations = [];
    for (const name of AMBIGUOUS_SKILLS_REQUIRING_USE_WHEN) {
      const line = readDescriptionLine(name);
      const val = extractDescriptionValue(line);
      if (!val) {
        violations.push(`${name}: description not parseable`);
        continue;
      }
      if (!/Use when/i.test(val)) {
        violations.push(`${name}: missing "Use when…" clause`);
      }
    }
    assert.strictEqual(violations.length, 0, `Ambiguous-name skills missing "Use when…":\n${violations.join('\n')}`);
  });
});

describe('Description integrity', () => {
  test('YAML escape sequences are well-formed (no orphan \\")', () => {
    const skills = listSkills();
    const violations = [];
    for (const name of skills) {
      const line = readDescriptionLine(name);
      if (!line) continue;
      // Parse the quoted value: count unescaped quotes inside the value
      const inner = line.replace(/^description:\s+"/, '').replace(/"\s*$/, '');
      // Every \" should be escaping a quote; bare " inside is invalid
      let i = 0;
      let bareQuotes = 0;
      while (i < inner.length) {
        if (inner[i] === '\\' && inner[i + 1] === '"') {
          i += 2;
          continue;
        }
        if (inner[i] === '"') bareQuotes++;
        i++;
      }
      if (bareQuotes > 0) {
        violations.push(`${name}: ${bareQuotes} unescaped " inside description value`);
      }
    }
    assert.strictEqual(violations.length, 0, `Bare quotes:\n${violations.join('\n')}`);
  });
});
