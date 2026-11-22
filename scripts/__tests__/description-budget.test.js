import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkDescriptions, readDescription } from '../description-budget-check.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function fixture(skills) {
  const dir = mkdtempSync(join(tmpdir(), 'rune-desc-'));
  for (const [name, desc] of Object.entries(skills)) {
    mkdirSync(join(dir, name));
    writeFileSync(join(dir, name, 'SKILL.md'), `---\nname: ${name}\ndescription: "${desc}"\n---\n\n# ${name}\n`);
  }
  return dir;
}

describe('description budget', () => {
  test('repo skills are within budget', () => {
    const result = checkDescriptions(join(ROOT, 'skills'));
    assert.ok(result.skills.length > 0);
    assert.deepEqual(result.errors, []);
  });

  test('reads quoted descriptions', () => {
    assert.equal(readDescription('---\nname: x\ndescription: "Hi \\"there\\""\n---\n'), 'Hi "there"');
  });

  test('flags over-long, shouting and over-total descriptions', () => {
    const dir = fixture({ a: 'x'.repeat(30), b: 'Use this ALWAYS for ANY change', c: 'y'.repeat(40) });
    try {
      const r = checkDescriptions(dir, { perSkillMax: 35, totalMax: 60 });
      assert.ok(r.errors.some((e) => e.startsWith('c: description is 40 chars')));
      assert.ok(r.errors.some((e) => e.includes('all-caps') && e.includes('ALWAYS, ANY')));
      assert.ok(r.errors.some((e) => e.startsWith('total description length')));
      assert.ok(!r.errors.some((e) => e.startsWith('a:')));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
