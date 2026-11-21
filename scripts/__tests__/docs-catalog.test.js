/**
 * docs/skills/index.html (the public skill catalog page) must list every
 * core skill exactly once, with the layer the skill declares.
 */
import assert from 'node:assert';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('docs/skills/index.html catalog', () => {
  const html = readFileSync(join(ROOT, 'docs', 'skills', 'index.html'), 'utf-8');
  const cards = [...html.matchAll(/\{ name: '([a-z0-9-]+)', layer: '(L[0-3])'/g)].map((m) => ({
    name: m[1],
    layer: m[2],
  }));
  const skills = readdirSync(join(ROOT, 'skills')).filter((d) => existsSync(join(ROOT, 'skills', d, 'SKILL.md')));

  test('lists every core skill exactly once', () => {
    const names = cards.map((c) => c.name);
    assert.deepStrictEqual([...names].sort(), [...skills].sort());
    assert.strictEqual(new Set(names).size, names.length, 'duplicate card');
  });

  test('card layer matches the skill frontmatter', () => {
    for (const { name, layer } of cards) {
      const md = readFileSync(join(ROOT, 'skills', name, 'SKILL.md'), 'utf-8');
      const declared = md.match(/^\s+layer:\s*"?(L[0-3])"?/m)?.[1];
      assert.strictEqual(layer, declared, `${name}: card says ${layer}, SKILL.md says ${declared}`);
    }
  });
});
