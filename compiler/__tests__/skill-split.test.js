/**
 * Progressive-disclosure split guard (v2.33.0).
 *
 * First pass (baseline ref e913492): cook, ba, review, design, skill-forge,
 * audit, session-bridge, test. Second pass (ref f706021): team,
 * context-engine, autopsy, brainstorm, plan — and cook/ba/review again, still
 * checked against their original pre-split text. Every skill records its own
 * `ref` in the fixture. This test proves, without git
 * history, that nothing was dropped: every non-blank line of the pre-split
 * SKILL.md still exists in SKILL.md + references/*.md, every rune:<skill>
 * mesh connection and every <HARD-GATE> stays in SKILL.md (always loaded),
 * and every pointer resolves.
 *
 * Moved lines may rebase a markdown link target (`](references/x.md)` →
 * `](x.md)` inside a reference file) so it clicks through on GitHub; the
 * line hash normalises local .md link targets, so that still counts.
 *
 * If you intentionally edit moved content, regenerate that skill's baseline
 * (the writer merges into the fixture, per-skill ref):
 *   node scripts/check-split-preservation.js --ref <commit> --write-baseline \
 *     compiler/__tests__/fixtures/split-baseline.json <skills...>
 */
import assert from 'node:assert';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { bundle, gates, hashLine, refs } from '../../scripts/check-split-preservation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baseline = JSON.parse(readFileSync(path.join(ROOT, 'compiler/__tests__/fixtures/split-baseline.json'), 'utf-8'));
const MAX_LINES = 500;

describe('progressive-disclosure split preserved everything', () => {
  for (const [skill, base] of Object.entries(baseline.skills)) {
    describe(skill, () => {
      const dir = path.join(ROOT, 'skills', skill);
      const skillMd = readFileSync(path.join(dir, 'SKILL.md'), 'utf-8');

      test(`SKILL.md is lean (≤ ${MAX_LINES} lines)`, () => {
        const n = skillMd.split('\n').length;
        assert.ok(n <= MAX_LINES, `${skill}/SKILL.md has ${n} lines`);
      });

      test(`every line of the pre-split SKILL.md (${base.ref}) is in SKILL.md + references/`, () => {
        const have = new Set(
          bundle(dir)
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
            .map(hashLine),
        );
        const missing = base.lines.filter((h) => !have.has(h));
        assert.deepStrictEqual(missing, [], `${missing.length} line(s) of ${skill} dropped`);
      });

      test('every mesh connection (rune:<skill>) stays in SKILL.md', () => {
        const now = refs(skillMd);
        const lost = base.crossRefs.filter((r) => !now.has(r));
        assert.deepStrictEqual(lost, [], `${skill} lost connections`);
      });

      test('every HARD-GATE stays in SKILL.md', () => {
        assert.ok(gates(skillMd).length >= base.hardGates, `${skill}: ${gates(skillMd).length} < ${base.hardGates}`);
      });

      test('every "moved to references/…" pointer resolves', () => {
        const ptrs = [...skillMd.matchAll(/Full detail moved to \[`(references\/[^`]+)`\]\(\1\)/g)];
        assert.ok(ptrs.length > 0, `${skill} has no pointers`);
        for (const [, rel] of ptrs) assert.ok(existsSync(path.join(dir, rel)), `${skill}: ${rel} missing`);
      });

      test('links between reference files resolve relative to the file (GitHub click-through)', () => {
        const refDir = path.join(dir, 'references');
        for (const f of readdirSync(refDir).filter((n) => n.endsWith('.md'))) {
          const text = readFileSync(path.join(refDir, f), 'utf-8');
          assert.doesNotMatch(
            text,
            /\]\((?:\.\/)?references\//,
            `${skill}/references/${f} links into references/references/`,
          );
          for (const [, target] of text.matchAll(/\]\(([\w.-]+\.md)\)/g)) {
            assert.ok(existsSync(path.join(refDir, target)), `${skill}/references/${f} → ${target} missing`);
          }
        }
      });
    });
  }
});
