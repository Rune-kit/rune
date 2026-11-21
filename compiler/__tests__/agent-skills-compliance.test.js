/**
 * Agent Skills compliance — v2.33 "Everywhere"
 *
 * The repo root is now an Agent Plugin (root plugin.json), a Cursor plugin,
 * a Gemini CLI extension, and a Grok plugin. All four load `skills/<dir>/SKILL.md`
 * directly and require Agent Skills–valid frontmatter; a non-conformant skill is
 * SKIPPED silently by strict clients. These tests keep every source skill
 * loadable everywhere, and keep compiled dir-per-skill output doctor-clean.
 *
 * @see https://agentskills.io/specification
 * @see https://agent-plugins.org/specification §7.1
 */

import assert from 'node:assert';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { getAdapter } from '../adapters/index.js';
import { runDoctor } from '../doctor.js';
import { buildAll } from '../emitter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SKILLS_DIR = path.join(ROOT, 'skills');
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function frontmatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : '';
}

function scalar(fm, key) {
  const m = fm.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).replace(/\\"/g, '"');
  }
  return v;
}

const skillDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(path.join(SKILLS_DIR, d.name, 'SKILL.md')))
  .map((d) => d.name);

describe('source skills conform to the Agent Skills spec', () => {
  test('there are skills to check', () => {
    assert.ok(skillDirs.length > 0);
  });

  for (const dir of skillDirs) {
    test(`skills/${dir}`, () => {
      const fm = frontmatter(readFileSync(path.join(SKILLS_DIR, dir, 'SKILL.md'), 'utf-8'));
      const name = scalar(fm, 'name');
      const description = scalar(fm, 'description');
      assert.strictEqual(name, dir, 'name must match the parent directory name');
      assert.ok(name.length >= 1 && name.length <= 64, 'name must be 1-64 chars');
      assert.match(name, NAME_RE, 'name: lowercase letters, digits, single hyphens');
      assert.ok(description && description.length >= 1, 'description required');
      assert.ok(description.length <= 1024, `description is ${description.length} chars (max 1024)`);
    });
  }
});

describe('progressive disclosure', () => {
  // Agent Skills guidance: keep SKILL.md lean and push detail into references/.
  // v2.33.0 split the 8 largest skills (cook, ba, review, design, skill-forge,
  // audit, session-bridge, test) into SKILL.md + references/. A handful stay
  // between 500 and 650 lines; this ceiling stops any skill growing back.
  const CEILING = 650;

  test(`no SKILL.md exceeds ${CEILING} lines`, () => {
    const over = [];
    for (const dir of readdirSync(SKILLS_DIR)) {
      const file = path.join(SKILLS_DIR, dir, 'SKILL.md');
      if (!existsSync(file)) continue;
      const lines = readFileSync(file, 'utf-8').split('\n').length;
      if (lines > CEILING) over.push(`${dir} (${lines})`);
    }
    assert.deepStrictEqual(over, [], `split into references/: ${over.join(', ')}`);
  });

  test('every local references/ path a skill mentions exists', () => {
    const missing = [];
    for (const dir of readdirSync(SKILLS_DIR)) {
      const file = path.join(SKILLS_DIR, dir, 'SKILL.md');
      if (!existsSync(file)) continue;
      const text = readFileSync(file, 'utf-8');
      // only refs that point into this skill: start-of-token `references/…`,
      // not `../other/references/…` or `@rune-pro/…/references/…`
      for (const m of text.matchAll(/(^|[\s(`'"])(references\/[\w./-]+\.(?:md|json|ya?ml|py|js|sh))/g)) {
        const ref = m[2];
        const local = path.join(SKILLS_DIR, dir, ref);
        if (existsSync(local)) continue;
        // cross-skill prose form: "`completion-gate` → `references/x.md`"
        const crossSkill = readdirSync(SKILLS_DIR).some((d) => existsSync(path.join(SKILLS_DIR, d, ref)));
        if (!crossSkill) missing.push(`${dir}: ${ref}`);
      }
    }
    assert.deepStrictEqual(missing, []);
  });
});

describe('compiled dir-per-skill output', () => {
  for (const platform of ['grok', 'cline', 'agents']) {
    test(`${platform}: build → doctor runs clean (no EISDIR, all skills found)`, async () => {
      const out = mkdtempSync(path.join(os.tmpdir(), `rune-${platform}-`));
      try {
        const adapter = getAdapter(platform);
        const stats = await buildAll({ runeRoot: ROOT, outputRoot: out, adapter });
        assert.strictEqual(stats.errors.length, 0, JSON.stringify(stats.errors));

        const skillsRoot = path.join(out, adapter.outputDir);
        for (const dir of skillDirs) {
          const file = path.join(skillsRoot, `rune-${dir}`, 'SKILL.md');
          assert.ok(existsSync(file), `missing ${file}`);
          const fm = frontmatter(readFileSync(file, 'utf-8'));
          assert.strictEqual(scalar(fm, 'name'), `rune-${dir}`, 'compiled name must equal its directory');
          assert.ok(scalar(fm, 'name').length <= 64);
        }

        const results = await runDoctor({ outputRoot: out, adapter, config: { platform }, runeRoot: ROOT });
        const skillCheck = results.checks.find((c) => c.name === 'Skill files');
        assert.strictEqual(skillCheck?.status, 'pass', JSON.stringify(skillCheck));
        assert.ok(
          !results.warnings.some((w) => /rune-(pro|business|kit)\b/.test(w)),
          'brand links are not dangling skill refs',
        );
      } finally {
        rmSync(out, { recursive: true, force: true });
      }
    });
  }
});
