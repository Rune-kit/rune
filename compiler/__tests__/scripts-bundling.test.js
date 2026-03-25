/**
 * Scripts Bundling Tests
 *
 * Tests the scripts/ directory copy pipeline:
 * - copyScriptsDir helper
 * - scriptsDir adapter method
 * - {scripts_dir} placeholder resolution
 * - End-to-end buildAll with scripts
 */

import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { getAdapter } from '../adapters/index.js';
import { buildAll } from '../emitter.js';
import { resolveScriptsPath } from '../transforms/scripts-path.js';

// --- resolveScriptsPath transform ---

describe('resolveScriptsPath', () => {
  test('replaces {scripts_dir} with resolved path', () => {
    const body = 'Run: `node {scripts_dir}/build-deck.js`';
    const result = resolveScriptsPath(body, '.cursor/rules/rune-slides-scripts');
    assert.strictEqual(result, 'Run: `node .cursor/rules/rune-slides-scripts/build-deck.js`');
  });

  test('replaces multiple occurrences', () => {
    const body = '{scripts_dir}/a.js and {scripts_dir}/b.js';
    const result = resolveScriptsPath(body, 'scripts');
    assert.strictEqual(result, 'scripts/a.js and scripts/b.js');
  });

  test('returns body unchanged when no placeholder', () => {
    const body = 'No placeholders here';
    const result = resolveScriptsPath(body, 'some/path');
    assert.strictEqual(result, body);
  });

  test('returns body unchanged when scriptsPath is null', () => {
    const body = 'Has {scripts_dir} but no path';
    const result = resolveScriptsPath(body, null);
    assert.strictEqual(result, body);
  });

  test('returns body unchanged when body is empty', () => {
    assert.strictEqual(resolveScriptsPath('', 'path'), '');
  });
});

// --- scriptsDir adapter method ---

describe('adapter scriptsDir', () => {
  test('flat-file adapters return sibling dir pattern', () => {
    for (const name of ['cursor', 'windsurf', 'antigravity', 'generic', 'openclaw']) {
      const adapter = getAdapter(name);
      assert.ok(adapter.scriptsDir, `${name} should have scriptsDir`);
      assert.strictEqual(adapter.scriptsDir('slides'), 'rune-slides-scripts', `${name} scriptsDir mismatch`);
    }
  });

  test('directory-per-skill adapters return nested dir pattern', () => {
    for (const name of ['codex', 'opencode']) {
      const adapter = getAdapter(name);
      assert.ok(adapter.scriptsDir, `${name} should have scriptsDir`);
      assert.strictEqual(adapter.scriptsDir('slides'), 'rune-slides/scripts', `${name} scriptsDir mismatch`);
    }
  });

  test('claude adapter has no scriptsDir (passthrough)', () => {
    const adapter = getAdapter('claude');
    assert.ok(!adapter.scriptsDir, 'claude should not have scriptsDir');
  });
});

// --- Integration: buildAll with scripts ---

describe('buildAll with scripts', () => {
  async function createTempSkillTree() {
    const tmp = path.join(tmpdir(), `rune-scripts-test-${Date.now()}`);
    const skillsDir = path.join(tmp, 'skills');
    const slideSkillDir = path.join(skillsDir, 'test-slide');
    const scriptsDir = path.join(slideSkillDir, 'scripts');
    const plainSkillDir = path.join(skillsDir, 'test-plain');

    await mkdir(scriptsDir, { recursive: true });
    await mkdir(plainSkillDir, { recursive: true });

    // Skill with scripts/
    await writeFile(
      path.join(slideSkillDir, 'SKILL.md'),
      [
        '---',
        'name: test-slide',
        'description: "Test slide skill"',
        'layer: L3',
        'group: utility',
        'connections: []',
        'tags: [test]',
        '---',
        '',
        '# test-slide',
        '',
        'Run: `node {scripts_dir}/build-deck.js --input slides.json`',
        '',
        'Also: `{scripts_dir}/helper.py`',
      ].join('\n'),
      'utf-8',
    );

    await writeFile(path.join(scriptsDir, 'build-deck.js'), '// build deck script\nconsole.log("hello");\n', 'utf-8');
    await writeFile(path.join(scriptsDir, 'helper.py'), '# helper\nprint("hi")\n', 'utf-8');

    // Skill without scripts/
    await writeFile(
      path.join(plainSkillDir, 'SKILL.md'),
      [
        '---',
        'name: test-plain',
        'description: "Test plain skill"',
        'layer: L3',
        'group: utility',
        'connections: []',
        'tags: [test]',
        '---',
        '',
        '# test-plain',
        '',
        'No scripts here.',
      ].join('\n'),
      'utf-8',
    );

    // Minimal extensions dir (empty — no packs needed for test)
    await mkdir(path.join(tmp, 'extensions'), { recursive: true });

    // Minimal .claude-plugin for openclaw
    await mkdir(path.join(tmp, '.claude-plugin'), { recursive: true });
    await writeFile(path.join(tmp, '.claude-plugin', 'plugin.json'), JSON.stringify({ version: '0.0.1' }), 'utf-8');

    return tmp;
  }

  test('cursor: scripts copied to sibling dir, placeholder resolved', async () => {
    const tmp = await createTempSkillTree();
    try {
      const outputRoot = path.join(tmp, 'out');
      const adapter = getAdapter('cursor');
      const stats = await buildAll({ runeRoot: tmp, outputRoot, adapter });

      // Scripts copied
      assert.ok(stats.scriptsCopied >= 2, `expected 2+ scripts copied, got ${stats.scriptsCopied}`);

      // Scripts dir exists with files
      const scriptsOut = path.join(outputRoot, adapter.outputDir, 'rune-test-slide-scripts');
      assert.ok(existsSync(path.join(scriptsOut, 'build-deck.js')), 'build-deck.js missing in output');
      assert.ok(existsSync(path.join(scriptsOut, 'helper.py')), 'helper.py missing in output');

      // Placeholder resolved in .mdc output
      const mdc = await readFile(path.join(outputRoot, adapter.outputDir, 'rune-test-slide.mdc'), 'utf-8');
      assert.ok(!mdc.includes('{scripts_dir}'), 'placeholder should be resolved');
      assert.ok(mdc.includes('.cursor/rules/rune-test-slide-scripts/build-deck.js'), 'resolved path missing');

      // Plain skill: no scripts dir created
      assert.ok(
        !existsSync(path.join(outputRoot, adapter.outputDir, 'rune-test-plain-scripts')),
        'plain skill should not have scripts dir',
      );
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  test('codex: scripts inside skill directory', async () => {
    const tmp = await createTempSkillTree();
    try {
      const outputRoot = path.join(tmp, 'out');
      const adapter = getAdapter('codex');
      const stats = await buildAll({ runeRoot: tmp, outputRoot, adapter });

      assert.ok(stats.scriptsCopied >= 2);

      // Scripts inside skill dir: .codex/skills/rune-test-slide/scripts/
      const scriptsOut = path.join(outputRoot, adapter.outputDir, 'rune-test-slide', 'scripts');
      assert.ok(existsSync(path.join(scriptsOut, 'build-deck.js')), 'build-deck.js missing');
      assert.ok(existsSync(path.join(scriptsOut, 'helper.py')), 'helper.py missing');

      // Placeholder resolved
      const md = await readFile(path.join(outputRoot, adapter.outputDir, 'rune-test-slide', 'SKILL.md'), 'utf-8');
      assert.ok(!md.includes('{scripts_dir}'), 'placeholder should be resolved');
      assert.ok(md.includes('.codex/skills/rune-test-slide/scripts/build-deck.js'), 'resolved path missing');
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  test('skill without scripts: no error, no empty dirs', async () => {
    const tmp = await createTempSkillTree();
    try {
      const outputRoot = path.join(tmp, 'out');
      const adapter = getAdapter('windsurf');
      const stats = await buildAll({ runeRoot: tmp, outputRoot, adapter });

      // Should still build both skills
      assert.strictEqual(stats.skillCount, 2);

      // No scripts dir for plain skill
      assert.ok(!existsSync(path.join(outputRoot, adapter.outputDir, 'rune-test-plain-scripts')));
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  test('stats include scriptsCopied count', async () => {
    const tmp = await createTempSkillTree();
    try {
      const outputRoot = path.join(tmp, 'out');
      const adapter = getAdapter('generic');
      const stats = await buildAll({ runeRoot: tmp, outputRoot, adapter });

      assert.strictEqual(typeof stats.scriptsCopied, 'number');
      assert.strictEqual(stats.scriptsCopied, 2);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  test('claude adapter: passthrough, no scripts processing', async () => {
    const tmp = await createTempSkillTree();
    try {
      const outputRoot = path.join(tmp, 'out');
      const adapter = getAdapter('claude');
      const stats = await buildAll({ runeRoot: tmp, outputRoot, adapter });

      // Claude is passthrough — no build
      assert.strictEqual(stats.platform, 'claude');
      assert.strictEqual(stats.skillCount, 0);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  test('scripts content copied as-is (byte-for-byte)', async () => {
    const tmp = await createTempSkillTree();
    try {
      const outputRoot = path.join(tmp, 'out');
      const adapter = getAdapter('cursor');
      await buildAll({ runeRoot: tmp, outputRoot, adapter });

      const original = await readFile(path.join(tmp, 'skills', 'test-slide', 'scripts', 'build-deck.js'), 'utf-8');
      const copied = await readFile(
        path.join(outputRoot, adapter.outputDir, 'rune-test-slide-scripts', 'build-deck.js'),
        'utf-8',
      );
      assert.strictEqual(copied, original, 'script content should be identical');
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  test('multiple adapters resolve different paths', async () => {
    const tmp = await createTempSkillTree();
    try {
      // Cursor (flat)
      const cursorOut = path.join(tmp, 'out-cursor');
      const cursorAdapter = getAdapter('cursor');
      await buildAll({ runeRoot: tmp, outputRoot: cursorOut, adapter: cursorAdapter });
      const cursorMdc = await readFile(path.join(cursorOut, '.cursor/rules/rune-test-slide.mdc'), 'utf-8');
      assert.ok(cursorMdc.includes('.cursor/rules/rune-test-slide-scripts/'), 'cursor path');

      // Codex (directory)
      const codexOut = path.join(tmp, 'out-codex');
      const codexAdapter = getAdapter('codex');
      await buildAll({ runeRoot: tmp, outputRoot: codexOut, adapter: codexAdapter });
      const codexMd = await readFile(path.join(codexOut, '.codex/skills/rune-test-slide/SKILL.md'), 'utf-8');
      assert.ok(codexMd.includes('.codex/skills/rune-test-slide/scripts/'), 'codex path');
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
