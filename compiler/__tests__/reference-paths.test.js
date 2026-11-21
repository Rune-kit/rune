/**
 * Progressive-disclosure content survives compilation on every platform.
 *
 * - every file under skills/<name>/<extra dir>/ is shipped by every adapter
 *   (directory platforms inside the skill dir, single-file platforms in a
 *   sibling `rune-<name>/` folder)
 * - every `references/…` path in a compiled skill resolves from the file's
 *   own location
 */
import assert from 'node:assert';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { getAdapter, listPlatforms } from '../adapters/index.js';
import { runDoctor } from '../doctor.js';
import { buildAll } from '../emitter.js';
import { rewriteReferencePaths } from '../transforms/reference-paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SKILLS = path.join(ROOT, 'skills');
const REF =
  /(^|[\s([`'"])((?:\.\.\/[a-z0-9-]+\/)?(?:rune-[a-z0-9-]+\/)?references\/[\w./-]+\.(?:md|json|ya?ml|py|js|mjs|cjs|sh|txt|mmd|html|css))/g;

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const skillDirs = new Map(
  readdirSync(SKILLS)
    .filter((d) => existsSync(path.join(SKILLS, d, 'SKILL.md')))
    .map((d) => [d, path.join(SKILLS, d)]),
);
const extras = [...skillDirs].flatMap(([name, dir]) =>
  readdirSync(dir)
    .filter((e) => statSync(path.join(dir, e)).isDirectory() && e !== 'scripts')
    .flatMap((e) => walk(path.join(dir, e)).map((f) => ({ name, rel: path.relative(dir, f) }))),
);

describe('rewriteReferencePaths (unit)', () => {
  const dirAdapter = { name: 'codex', skillPrefix: 'rune-', useSkillDirectories: true };
  const flatAdapter = { name: 'generic', skillPrefix: 'rune-', useSkillDirectories: false };
  const ctx = (adapter, skillName) => ({ skillName, skillDirs, adapter });

  test('own reference: unchanged on directory platforms, prefixed folder on flat ones', () => {
    const body = 'See `references/sharp-edges.md`.';
    assert.strictEqual(rewriteReferencePaths(body, ctx(dirAdapter, 'cook')), body);
    assert.strictEqual(
      rewriteReferencePaths(body, ctx(flatAdapter, 'cook')),
      'See `rune-cook/references/sharp-edges.md`.',
    );
  });

  test('explicit ../<skill>/references path follows the renamed skill dir', () => {
    const body = 'see ../deploy/references/observability.md';
    assert.strictEqual(
      rewriteReferencePaths(body, ctx(dirAdapter, 'debug')),
      'see ../rune-deploy/references/observability.md',
    );
    assert.strictEqual(
      rewriteReferencePaths(body, ctx(flatAdapter, 'debug')),
      'see rune-deploy/references/observability.md',
    );
  });

  test('prose cross-skill reference resolves to the only skill that has the file', () => {
    const body = '(`completion-gate` → `references/claim-discipline.md`)';
    assert.strictEqual(
      rewriteReferencePaths(body, ctx(dirAdapter, 'verification')),
      '(`completion-gate` → `../rune-completion-gate/references/claim-discipline.md`)',
    );
  });

  test('unresolvable paths and Claude output are left alone', () => {
    const body = 'see `references/does-not-exist.md` and @rune-pro/media/references/x.md';
    assert.strictEqual(rewriteReferencePaths(body, ctx(dirAdapter, 'cook')), body);
    assert.strictEqual(
      rewriteReferencePaths('`references/sharp-edges.md`', ctx({ name: 'claude' }, 'cook')),
      '`references/sharp-edges.md`',
    );
  });
});

test('claude: no compile step — the plugin loads skills/<name>/ with references/ in place', async () => {
  const r = await buildAll({ runeRoot: ROOT, outputRoot: os.tmpdir(), adapter: getAdapter('claude') });
  assert.strictEqual(r.skillCount, 0);
  assert.match(r.message, /source SKILL\.md files directly/);
});

for (const platform of listPlatforms().filter((p) => p !== 'claude')) {
  describe(`${platform}: references survive compilation`, () => {
    let out;
    let adapter;
    before(async () => {
      out = mkdtempSync(path.join(os.tmpdir(), `rune-refs-${platform}-`));
      adapter = getAdapter(platform);
      await buildAll({ runeRoot: ROOT, outputRoot: out, adapter });
    });
    after(() => rmSync(out, { recursive: true, force: true }));

    const skillBase = () => path.join(out, adapter.outputDir);
    const skillFile = (name) =>
      adapter.useSkillDirectories
        ? path.join(skillBase(), `${adapter.skillPrefix}${name}`, adapter.skillFileName || 'SKILL.md')
        : path.join(skillBase(), `${adapter.skillPrefix}${name}${adapter.skillSuffix || ''}${adapter.fileExtension}`);

    test('every reference/asset file is shipped', () => {
      const missing = extras
        .map(({ name, rel }) => path.join(skillBase(), `${adapter.skillPrefix}${name}`, rel))
        .filter((f) => !existsSync(f));
      assert.deepStrictEqual(missing, []);
    });

    test('every references/ path in a compiled skill resolves', () => {
      const broken = [];
      for (const name of skillDirs.keys()) {
        const file = skillFile(name);
        if (!existsSync(file)) continue;
        for (const m of readFileSync(file, 'utf-8').matchAll(REF)) {
          const target = path.resolve(path.dirname(file), m[2]);
          // a prose path that names a file in no skill stays as written; only flag
          // paths that point into the build output and miss
          if (!existsSync(target) && m[2].includes('references/') && extras.some((e) => m[2].endsWith(e.rel))) {
            broken.push(`${name}: ${m[2]}`);
          }
        }
      }
      assert.deepStrictEqual(broken, []);
    });

    test('pack reference folders ship and their links resolve', () => {
      const packs = readdirSync(path.join(ROOT, 'extensions')).filter((p) =>
        existsSync(path.join(ROOT, 'extensions', p, 'references')),
      );
      assert.ok(packs.length > 0);
      for (const pack of packs) {
        const name = `${adapter.skillPrefix}ext-${pack}`;
        for (const f of walk(path.join(ROOT, 'extensions', pack, 'references'))) {
          const rel = path.relative(path.join(ROOT, 'extensions', pack), f);
          assert.ok(existsSync(path.join(skillBase(), name, rel)), `${platform}: missing ${name}/${rel}`);
        }
        const compiled = adapter.useSkillDirectories
          ? path.join(skillBase(), name, adapter.skillFileName || 'SKILL.md')
          : path.join(skillBase(), `${name}${adapter.fileExtension}`);
        if (!existsSync(compiled)) continue;
        for (const m of readFileSync(compiled, 'utf-8').matchAll(REF)) {
          if (m[2].startsWith('../')) continue;
          const target = path.resolve(path.dirname(compiled), m[2]);
          assert.ok(existsSync(target), `${platform}: ${pack} link ${m[2]} does not resolve`);
        }
      }
    });

    test('doctor passes on the output', async () => {
      const r = await runDoctor({ outputRoot: out, adapter, config: { platform }, runeRoot: ROOT });
      // no rune.config.json in a bare build dir — that check is about `rune init`, not output
      const failed = r.checks.filter((c) => c.status === 'fail' && c.name !== 'Config file');
      assert.deepStrictEqual(failed, []);
      assert.strictEqual(r.checks.find((c) => c.name === 'Skill files')?.status, 'pass');
    });
  });
}
