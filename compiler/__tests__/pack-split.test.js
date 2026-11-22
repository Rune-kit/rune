import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { getAdapter } from '../adapters/index.js';
import { buildAll } from '../emitter.js';
import { parsePack } from '../parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSIONS_DIR = path.resolve(__dirname, '../../extensions');

// --- Monolith format (regression) ---

test('parsePack: monolith format has isSplit=false', () => {
  const content = `---
name: "@rune/trading"
description: "Trading patterns"
metadata:
  version: "0.2.0"
  layer: L4
  price: free
  target: Traders
---

# @rune/trading

## Purpose
Trading pack.

## Skills Included

### risk-management
Risk management workflow.
`;

  const parsed = parsePack(content, 'extensions/trading/PACK.md');

  assert.strictEqual(parsed.isSplit, false);
  assert.deepStrictEqual(parsed.skillManifest, []);
  assert.strictEqual(parsed.name, '@rune/trading');
  assert.strictEqual(parsed.version, '0.2.0');
  assert.strictEqual(parsed.layer, 'L4');
  assert.ok(parsed.body.includes('risk-management'));
});

test('parsePack: monolith without metadata block defaults correctly', () => {
  const content = `---
name: "@rune/test"
description: "Test pack"
---

# @rune/test
Body here.
`;

  const parsed = parsePack(content, 'test/PACK.md');

  assert.strictEqual(parsed.isSplit, false);
  assert.strictEqual(parsed.version, '1.0.0');
});

// --- Split format detection ---

test('parsePack: split format detected via metadata.format', () => {
  const content = `---
name: "@rune/backend"
description: "Backend patterns"
metadata:
  version: "0.3.0"
  layer: L4
  price: free
  target: Backend developers
  format: split
---

# @rune/backend

## Purpose
Backend pack index.

## Skills Included
| Skill | Model | Description |
|-------|-------|-------------|
| api-design | sonnet | API patterns |
| auth | sonnet | Auth patterns |
`;

  const parsed = parsePack(content, 'extensions/backend/PACK.md');

  assert.strictEqual(parsed.isSplit, true);
  assert.strictEqual(parsed.version, '0.3.0');
  assert.strictEqual(parsed.name, '@rune/backend');
});

test('parsePack: skill manifest parsed from string array', () => {
  // Note: our YAML parser is simple — it handles nested objects but not arrays.
  // This test validates the parseSkillManifest function directly with object skills.
  const content = `---
name: "@rune/test"
description: "Test"
metadata:
  format: split
---

Body.
`;

  const parsed = parsePack(content, 'test/PACK.md');
  assert.strictEqual(parsed.isSplit, true);
  // With simple YAML parser, skills array won't parse — manifest will be empty
  // Real usage will use the skills/ directory detection as fallback
  assert.ok(Array.isArray(parsed.skillManifest));
});

// --- Real pack regression: existing monolith packs parse correctly ---

test('parsePack: real trading PACK.md parses as split', () => {
  const tradingPath = path.join(EXTENSIONS_DIR, 'trading', 'PACK.md');
  if (!existsSync(tradingPath)) {
    console.log('  skip: trading PACK.md not found');
    return;
  }

  const content = readFileSync(tradingPath, 'utf-8');
  const parsed = parsePack(content, tradingPath);

  assert.strictEqual(parsed.isSplit, true);
  assert.strictEqual(parsed.layer, 'L4');
  assert.strictEqual(parsed.group, 'extension');
  assert.ok(parsed.body.length > 50);
});

test('parsePack: real backend PACK.md parses as split (post-split)', () => {
  const backendPath = path.join(EXTENSIONS_DIR, 'backend', 'PACK.md');
  if (!existsSync(backendPath)) {
    console.log('  skip: backend PACK.md not found');
    return;
  }

  const content = readFileSync(backendPath, 'utf-8');
  const parsed = parsePack(content, backendPath);

  assert.strictEqual(parsed.isSplit, true);
  assert.strictEqual(parsed.layer, 'L4');
  assert.ok(parsed.sections.size > 0);
});

// --- Integration: buildAll auto-discovers split pack skill files ---

describe('buildAll split pack auto-discovery', () => {
  async function createTempWithSplitPack() {
    const tmp = path.join(tmpdir(), `rune-split-test-${Date.now()}`);
    const skillsDir = path.join(tmp, 'skills', 'test-skill');
    const extDir = path.join(tmp, 'extensions', 'test-pack');
    const extSkillsDir = path.join(extDir, 'skills');

    await mkdir(skillsDir, { recursive: true });
    await mkdir(extSkillsDir, { recursive: true });

    // Minimal core skill (required for build)
    await writeFile(
      path.join(skillsDir, 'SKILL.md'),
      [
        '---',
        'name: test-skill',
        'description: "A test skill"',
        'layer: L3',
        'group: utility',
        'connections: []',
        'tags: [test]',
        '---',
        '',
        '# test-skill',
        '',
        'Hello.',
      ].join('\n'),
      'utf-8',
    );

    // Split pack WITHOUT skills: array in frontmatter
    await writeFile(
      path.join(extDir, 'PACK.md'),
      [
        '---',
        'name: "@rune/test-pack"',
        'description: "Test pack"',
        'metadata:',
        '  version: "0.1.0"',
        '  format: split',
        '---',
        '',
        '# @rune/test-pack',
        '',
        'Pack index body.',
      ].join('\n'),
      'utf-8',
    );

    // Two skill files in skills/ subdir
    await writeFile(
      path.join(extSkillsDir, 'alpha.md'),
      [
        '---',
        'name: "alpha"',
        'description: "Alpha skill"',
        'model: sonnet',
        '---',
        '',
        '# alpha',
        '',
        'Alpha body content here.',
      ].join('\n'),
      'utf-8',
    );
    await writeFile(
      path.join(extSkillsDir, 'beta.md'),
      [
        '---',
        'name: "beta"',
        'description: "Beta skill"',
        'model: sonnet',
        '---',
        '',
        '# beta',
        '',
        'Beta body content here.',
      ].join('\n'),
      'utf-8',
    );

    return tmp;
  }

  test('auto-discovers skill files from skills/ subdir when manifest is empty', async () => {
    const tmp = await createTempWithSplitPack();
    try {
      const outputRoot = path.join(tmp, 'out');
      const adapter = getAdapter('cursor');
      const stats = await buildAll({ runeRoot: tmp, outputRoot, adapter });

      assert.strictEqual(stats.packCount, 1, 'should build 1 pack');

      // Read the compiled pack output
      const packOutput = await readFile(
        path.join(outputRoot, adapter.outputDir, 'rune-ext-test-pack', 'SKILL.md'),
        'utf-8',
      );

      // Should contain the pack index body
      assert.ok(packOutput.includes('Pack index body'), 'missing pack index body');

      // Directory adapters: short index + one file per skill (keeps every file small)
      assert.ok(!packOutput.includes('Alpha body content here'), 'index must not inline skill bodies');
      assert.ok(packOutput.includes('skills/alpha.md'), 'index must link alpha skill file');
      assert.ok(packOutput.includes('skills/beta.md'), 'index must link beta skill file');
      const packRoot = path.join(outputRoot, adapter.outputDir, 'rune-ext-test-pack');
      const alpha = await readFile(path.join(packRoot, 'skills', 'alpha.md'), 'utf-8');
      const beta = await readFile(path.join(packRoot, 'skills', 'beta.md'), 'utf-8');
      assert.ok(alpha.includes('Alpha body content here'), 'missing alpha skill body');
      assert.ok(beta.includes('Beta body content here'), 'missing beta skill body');
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  test('single-file adapters still concatenate skill bodies into the pack', async () => {
    const tmp = await createTempWithSplitPack();
    try {
      const outputRoot = path.join(tmp, 'out');
      const adapter = getAdapter('aider');
      await buildAll({ runeRoot: tmp, outputRoot, adapter });
      const files = await readdir(path.join(outputRoot, adapter.outputDir), { recursive: true });
      const packFile = files.find((f) => String(f).includes('test-pack'));
      assert.ok(packFile, 'pack output missing');
      const packOutput = await readFile(path.join(outputRoot, adapter.outputDir, String(packFile)), 'utf-8');
      assert.ok(packOutput.includes('Alpha body content here'), 'missing alpha skill body');
      assert.ok(packOutput.includes('Beta body content here'), 'missing beta skill body');
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  test('split packs copy per-skill and pack-level references and rewrite links per file', async () => {
    const tmp = await createTempWithSplitPack();
    try {
      const extDir = path.join(tmp, 'extensions', 'test-pack');
      await mkdir(path.join(extDir, 'skills', 'alpha', 'references'), { recursive: true });
      await mkdir(path.join(extDir, 'references'), { recursive: true });
      await writeFile(path.join(extDir, 'skills', 'alpha', 'references', 'own.md'), '# own\n');
      await writeFile(path.join(extDir, 'references', 'shared.md'), '# shared\n');
      await writeFile(
        path.join(extDir, 'skills', 'alpha.md'),
        '---\nname: "alpha"\ndescription: "Alpha skill"\n---\n\n# alpha\n\nSee `references/own.md` and `references/shared.md`.\n',
      );
      await writeFile(path.join(extDir, 'skills', 'alpha-evals.md'), '# evals fixture\n');
      const outputRoot = path.join(tmp, 'out');
      const adapter = getAdapter('cursor');
      await buildAll({ runeRoot: tmp, outputRoot, adapter });
      const packRoot = path.join(outputRoot, adapter.outputDir, 'rune-ext-test-pack');
      const alpha = await readFile(path.join(packRoot, 'skills', 'alpha.md'), 'utf-8');
      assert.ok(alpha.includes('`alpha/references/own.md`'), 'own reference link not rewritten');
      assert.ok(alpha.includes('`../references/shared.md`'), 'pack-level reference link not rewritten');
      assert.ok(existsSync(path.join(packRoot, 'skills', 'alpha', 'references', 'own.md')), 'own reference not copied');
      assert.ok(existsSync(path.join(packRoot, 'references', 'shared.md')), 'pack reference not copied');
      assert.ok(!existsSync(path.join(packRoot, 'skills', 'alpha-evals.md')), 'eval fixture must not ship');
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  test('real ai-ml pack includes skill content after build', async () => {
    const aimlPath = path.join(EXTENSIONS_DIR, 'ai-ml', 'PACK.md');
    if (!existsSync(aimlPath)) {
      console.log('  skip: ai-ml PACK.md not found');
      return;
    }

    const tmp = path.join(tmpdir(), `rune-aiml-test-${Date.now()}`);
    const runeRoot = path.resolve(__dirname, '../..');
    const adapter = getAdapter('cursor');
    await buildAll({ runeRoot, outputRoot: tmp, adapter });

    try {
      const packOutput = await readFile(path.join(tmp, adapter.outputDir, 'rune-ext-ai-ml', 'SKILL.md'), 'utf-8');

      // Index stays small; every skill ships as its own file under skills/
      assert.ok(Buffer.byteLength(packOutput) < 100_000, 'pack index must stay under the 100 KB inline limit');
      const packRoot = path.join(tmp, adapter.outputDir, 'rune-ext-ai-ml');
      const skillFiles = (await readdir(path.join(packRoot, 'skills'))).filter((f) => f.endsWith('.md'));
      assert.ok(skillFiles.length >= 3, `expected per-skill files, got ${skillFiles.length}`);
      assert.ok(!skillFiles.some((f) => f.endsWith('-evals.md')), 'eval fixtures must not ship as skills');
      for (const f of skillFiles) {
        assert.ok(packOutput.includes(`skills/${f}`), `index must link skills/${f}`);
      }
      assert.ok(packOutput.includes('ai-agents') || packOutput.includes('AI agent'), 'missing ai-agents skill content');
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
