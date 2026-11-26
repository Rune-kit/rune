import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkDescriptions, checkTierRepo, readDescription, WHEN_RE } from '../description-budget-check.js';

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

describe('description budget --root (tier repos)', () => {
  function tierFixture() {
    const root = mkdtempSync(join(tmpdir(), 'rune-tier-desc-'));
    const md = (desc) => `---\nname: x\ndescription: "${desc}"\n---\n\n# x\n`;
    mkdirSync(join(root, 'skills', 'autopilot'), { recursive: true });
    writeFileSync(
      join(root, 'skills', 'autopilot', 'SKILL.md'),
      md('Runs a whole feature. Use when the user wants it done end to end.'),
    );
    mkdirSync(join(root, 'extensions', 'pro-demo', 'skills'), { recursive: true });
    writeFileSync(join(root, 'extensions', 'pro-demo', 'PACK.md'), md('Demo pack without a trigger phrase.'));
    writeFileSync(join(root, 'extensions', 'pro-demo', 'skills', 'alpha.md'), md('Checks ALL the things.'));
    writeFileSync(join(root, 'extensions', 'pro-demo', 'skills', 'alpha-evals.md'), '# evals, no frontmatter\n');
    return root;
  }

  test('natural trigger wording counts as when-to-use', () => {
    for (const desc of [
      'Quarterly review. Use at quarter close or before a board update.',
      'Contract review to run before you sign anything.',
      'Opens a PR whenever the plan is approved.',
    ]) {
      assert.ok(WHEN_RE.test(desc), desc);
    }
    assert.ok(!WHEN_RE.test('Demo pack without a trigger phrase.'));
  });

  test('counts entry skills + pack descriptions, checks pack skill files, skips evals', () => {
    const root = tierFixture();
    try {
      const result = checkTierRepo(root);
      assert.deepEqual(
        result.skills.map((s) => s.name),
        ['skills/autopilot', 'extensions/pro-demo'],
      );
      assert.deepEqual(
        result.packSkills.map((s) => s.name),
        ['extensions/pro-demo/skills/alpha'],
      );
      assert.ok(result.errors.some((e) => e.includes('pro-demo/skills/alpha') && e.includes('ALL')));
      assert.deepEqual(result.warnings, ['extensions/pro-demo: entry description does not say when to use it']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
