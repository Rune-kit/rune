import assert from 'node:assert';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import {
  applyInvariantsPointer,
  buildPointerBlock,
  injectInvariantsPointer,
  MARKER_END,
  MARKER_START,
  SKIP_DIRECTIVE,
} from '../../skills/onboard/scripts/inject-claude-md.js';

describe('buildPointerBlock', () => {
  test('wraps output in start/end markers', () => {
    const block = buildPointerBlock({ globs: ['src/auth/**'] });
    assert.ok(block.startsWith(MARKER_START));
    assert.ok(block.trimEnd().endsWith(MARKER_END));
    assert.ok(block.includes('src/auth/**'));
  });

  test('dedupes globs and caps the rendered list', () => {
    const globs = Array.from({ length: 20 }, (_, i) => `src/mod${i}/**`);
    globs.push('src/mod0/**');
    const block = buildPointerBlock({ globs });
    const rendered = block.split('\n').filter((l) => l.startsWith('- `'));
    assert.strictEqual(rendered.length, 8, `cap at 8 items, got ${rendered.length}`);
    assert.ok(block.includes('…and 12 more'));
  });

  test('renders placeholder when no globs provided', () => {
    const block = buildPointerBlock({ globs: [] });
    assert.ok(block.includes('No danger zones detected'));
  });
});

describe('injectInvariantsPointer — idempotency', () => {
  test('creates block when none exists', () => {
    const { action, content } = injectInvariantsPointer({
      claudeMd: '# My Project\n\nSome content.\n',
      globs: ['src/core/**'],
    });
    assert.strictEqual(action, 'created');
    assert.ok(content.includes(MARKER_START));
    assert.ok(content.includes('src/core/**'));
    assert.ok(content.startsWith('# My Project'));
  });

  test('replaces existing block in place', () => {
    const initial = injectInvariantsPointer({
      claudeMd: '# Proj\n',
      globs: ['src/a/**'],
    });
    const updated = injectInvariantsPointer({
      claudeMd: initial.content,
      globs: ['src/b/**'],
    });
    assert.strictEqual(updated.action, 'updated');
    assert.ok(updated.content.includes('src/b/**'));
    assert.ok(!updated.content.includes('src/a/**'), 'old glob must be removed');
    const startCount = (updated.content.match(/@rune-invariants-pointer:start/g) || []).length;
    assert.strictEqual(startCount, 1, 'exactly one start marker must remain');
  });

  test('reports unchanged when input is identical', () => {
    const first = injectInvariantsPointer({ claudeMd: '', globs: ['src/a/**'] });
    const second = injectInvariantsPointer({ claudeMd: first.content, globs: ['src/a/**'] });
    assert.strictEqual(second.action, 'unchanged');
  });

  test('preserves content outside the markers verbatim', () => {
    const before = '# Heading\n\nUser text.\n\n## Conventions\n\n- Rule A\n';
    const after = '\n\n## Footer\n\nend.\n';
    const injected = injectInvariantsPointer({
      claudeMd: before + after,
      globs: ['x/**'],
    });
    assert.ok(injected.content.includes('User text.'));
    assert.ok(injected.content.includes('## Footer'));
    assert.ok(injected.content.includes('end.'));
  });

  test('honors skip directive — does not inject', () => {
    const input = `# Project\n\n${SKIP_DIRECTIVE}\n`;
    const result = injectInvariantsPointer({ claudeMd: input, globs: ['x/**'] });
    assert.strictEqual(result.action, 'skipped');
    assert.strictEqual(result.content, input);
  });

  test('reports error on marker mismatch (orphan start only)', () => {
    const input = `# Project\n\n${MARKER_START}\nstuff\n`;
    const result = injectInvariantsPointer({ claudeMd: input, globs: ['x/**'] });
    assert.strictEqual(result.action, 'error');
    assert.strictEqual(result.reason, 'marker-mismatch');
  });
});

describe('applyInvariantsPointer — filesystem', () => {
  test('writes file when action is created', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'rune-inject-'));
    try {
      const claudeMdPath = path.join(root, 'CLAUDE.md');
      await writeFile(claudeMdPath, '# Proj\n', 'utf8');
      const result = await applyInvariantsPointer({
        claudeMdPath,
        globs: ['src/api/**'],
      });
      assert.strictEqual(result.action, 'created');
      const onDisk = await readFile(claudeMdPath, 'utf8');
      assert.ok(onDisk.includes('src/api/**'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('dryRun does not write', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'rune-inject-'));
    try {
      const claudeMdPath = path.join(root, 'CLAUDE.md');
      await writeFile(claudeMdPath, '# Proj\n', 'utf8');
      const result = await applyInvariantsPointer({
        claudeMdPath,
        globs: ['x/**'],
        dryRun: true,
      });
      assert.strictEqual(result.action, 'created');
      const onDisk = await readFile(claudeMdPath, 'utf8');
      assert.ok(!onDisk.includes(MARKER_START), 'disk must not include marker in dry-run');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('creates CLAUDE.md from scratch when file does not exist', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'rune-inject-'));
    try {
      const claudeMdPath = path.join(root, 'CLAUDE.md');
      const result = await applyInvariantsPointer({
        claudeMdPath,
        globs: ['src/new/**'],
      });
      assert.strictEqual(result.action, 'created');
      assert.strictEqual(result.existed, false);
      const onDisk = await readFile(claudeMdPath, 'utf8');
      assert.ok(onDisk.includes(MARKER_START));
      assert.ok(onDisk.includes('src/new/**'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
