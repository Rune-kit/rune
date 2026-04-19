/**
 * Hook preset definitions for `rune hooks install`.
 *
 * Presets:
 *   - strict  — dispatcher blocks on BLOCK verdict (returns non-zero exit)
 *   - gentle  — dispatcher warns only (always exits 0), adds --gentle flag
 *   - off     — no hooks installed (uninstall semantics)
 *
 * Each hook command is `rune hook-dispatch <skill>` so the dispatcher owns
 * skill→command mapping. Commands carry the RUNE_MANAGED signature so we can
 * detect and cleanly replace them without comment markers (settings.json is JSON).
 */

export const RUNE_MANAGED_SIGNATURE = 'rune hook-dispatch';

/** Shared relative path to avoid per-file duplication. */
export const SETTINGS_REL_PATH = '.claude/settings.json';

const DISPATCH_CMD = 'npx --yes @rune-kit/rune hook-dispatch';

/**
 * Regex that matches the exact dispatch invocation Rune writes.
 * Matches: `npx [--yes] @rune-kit/rune hook-dispatch` or
 *          `node ... @rune-kit/rune hook-dispatch` as word boundary.
 * Does NOT match arbitrary strings that merely contain those words.
 */
const RUNE_DISPATCH_RE = /(^|\s)npx(\s+--yes)?\s+@rune-kit\/rune\s+hook-dispatch\b/;

/**
 * Regex that matches tier-emitted commands — they substitute a tier env var
 * (e.g. `${RUNE_PRO_ROOT}`, `${RUNE_BUSINESS_ROOT}`). These are Rune-managed
 * because only `rune hooks install --tier <name>` writes them.
 */
const RUNE_TIER_RE = /\$\{RUNE_[A-Z][A-Z0-9_]*_ROOT\}/;

/**
 * Build a preset hooks block for merging into `.claude/settings.json`.
 *
 * @param {'strict'|'gentle'} preset
 * @returns {Object} — { hooks: { PreToolUse: [...], PostToolUse: [...], Stop: [...] } }
 */
export function buildPreset(preset) {
  if (preset !== 'strict' && preset !== 'gentle') {
    throw new Error(`Unknown preset: ${preset}. Use 'strict' or 'gentle'.`);
  }

  const flag = preset === 'gentle' ? ' --gentle' : '';

  return {
    hooks: {
      PreToolUse: [
        {
          matcher: 'Edit|Write',
          hooks: [
            {
              type: 'command',
              command: `${DISPATCH_CMD} preflight${flag}`,
              async: preset === 'gentle',
            },
          ],
        },
        {
          matcher: 'Bash',
          hooks: [
            {
              type: 'command',
              command: `${DISPATCH_CMD} sentinel${flag}`,
              async: false,
            },
          ],
        },
      ],
      PostToolUse: [
        {
          matcher: 'Edit|Write',
          hooks: [
            {
              type: 'command',
              command: `${DISPATCH_CMD} dependency-doctor${flag}`,
              async: true,
            },
          ],
        },
      ],
      Stop: [
        {
          matcher: '.*',
          hooks: [
            {
              type: 'command',
              command: `${DISPATCH_CMD} completion-gate${flag}`,
              async: false,
            },
          ],
        },
      ],
    },
  };
}

/**
 * Skills wired by presets — used by `rune hooks status` to verify skill existence.
 */
export const WIRED_SKILLS = ['preflight', 'sentinel', 'dependency-doctor', 'completion-gate'];

/**
 * Detect if a hook command entry is Rune-managed.
 * Matches only the exact `npx [--yes] @rune-kit/rune hook-dispatch` invocation
 * to avoid false-positives on user commands that merely contain those words.
 *
 * @param {Object} entry — single hook entry { type, command, ... }
 */
export function isRuneManaged(entry) {
  if (!entry || typeof entry.command !== 'string') return false;
  return RUNE_DISPATCH_RE.test(entry.command) || RUNE_TIER_RE.test(entry.command);
}
