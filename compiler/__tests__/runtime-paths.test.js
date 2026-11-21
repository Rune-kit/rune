import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { getAdapter, listPlatforms } from '../adapters/index.js';
import { parseSkill } from '../parser.js';
import { transformSkill } from '../transformer.js';
import { NEUTRAL_WORKTREE_DIR, transformRuntimePaths } from '../transforms/runtime-paths.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const worktreeSrc = readFileSync(path.join(ROOT, 'skills/worktree/SKILL.md'), 'utf-8');

describe('runtime paths: worktree directory', () => {
  test('claude keeps .claude/worktrees (matches claude --worktree)', () => {
    const body = 'git worktree add .claude/worktrees/x';
    assert.strictEqual(transformRuntimePaths(body, { name: 'claude' }), body);
  });

  test('other runtimes get the neutral .rune/worktrees', () => {
    assert.strictEqual(
      transformRuntimePaths('git worktree add .claude/worktrees/x', { name: 'codex' }),
      `git worktree add ${NEUTRAL_WORKTREE_DIR}/x`,
    );
  });

  test('adapter.worktreeDir overrides the default', () => {
    assert.strictEqual(transformRuntimePaths('.claude/worktrees/x', { name: 'x', worktreeDir: '.x/wt' }), '.x/wt/x');
  });

  test('unrelated .claude paths are untouched', () => {
    const body = 'edit .claude/settings.json';
    assert.strictEqual(transformRuntimePaths(body, { name: 'codex' }), body);
  });

  test('source skill is authored for Claude and git-ignores the dir first', () => {
    assert.match(
      worktreeSrc,
      /git check-ignore -q \.claude\/worktrees\/ \|\| echo "\.claude\/worktrees\/" >> \.gitignore/,
    );
  });

  for (const platform of listPlatforms().filter((p) => p !== 'claude')) {
    test(`${platform}: compiled worktree skill has no .claude/ worktree path`, () => {
      const adapter = getAdapter(platform);
      const parsed = parseSkill(worktreeSrc, path.join(ROOT, 'skills/worktree/SKILL.md'));
      const { body } = transformSkill(parsed, adapter);
      assert.doesNotMatch(body, /\.claude\/worktrees/);
      assert.match(body, /\.rune\/worktrees\/<name>/);
      assert.match(body, /git check-ignore -q \.rune\/worktrees\//);
    });
  }
});
