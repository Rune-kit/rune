/**
 * Runtime Paths Transform
 *
 * Skills are authored for Claude Code, so a few working directories live
 * under `.claude/`. Claude Code keeps them (its own `--worktree` sessions use
 * `.claude/worktrees/` too); every other runtime gets a neutral `.rune/`
 * location so a Codex, Cursor or Gemini project does not grow a `.claude/`
 * folder just to hold git worktrees.
 *
 * Adapters may override with `adapter.worktreeDir` (no trailing slash).
 */

export const CLAUDE_WORKTREE_DIR = '.claude/worktrees';
export const NEUTRAL_WORKTREE_DIR = '.rune/worktrees';

/**
 * @param {string} body - skill body
 * @param {object} adapter - platform adapter
 * @returns {string}
 */
export function transformRuntimePaths(body, adapter) {
  if (!adapter || adapter.name === 'claude') return body;
  const target = adapter.worktreeDir || NEUTRAL_WORKTREE_DIR;
  return body.split(CLAUDE_WORKTREE_DIR).join(target);
}
