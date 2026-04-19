/**
 * Hooks adapter registry — per-platform emitters for `rune hooks install`.
 *
 * Each adapter exposes:
 *   - id: platform key (e.g. 'claude', 'cursor')
 *   - detect(projectRoot) → boolean  (presence of platform-specific dir)
 *   - emit({preset, projectRoot}) → Promise<{ files: [{path, content, mode?}], notes: string[] }>
 *   - uninstall({projectRoot}) → Promise<{ files: [{path, content|null, mode?}], notes: string[] }>
 *     (content = null means delete the file)
 *   - status(projectRoot) → Promise<{ installed: boolean, preset: string|null, wired: string[], missing: string[], notes: string[] }>
 *
 * The install command iterates adapters, calls emit, and writes files.
 * Adapters NEVER write files themselves — they return a plan.
 */

import * as antigravity from './antigravity.js';
import * as claude from './claude.js';
import * as cursor from './cursor.js';
import * as windsurf from './windsurf.js';

export const ADAPTERS = Object.freeze({
  claude,
  cursor,
  windsurf,
  antigravity,
});

export const PLATFORM_KEYS = Object.freeze(Object.keys(ADAPTERS));

export function getAdapter(id) {
  const adapter = ADAPTERS[id];
  if (!adapter) {
    throw new Error(`Unknown hooks platform: ${id}. Choose from: ${PLATFORM_KEYS.join(', ')}`);
  }
  return adapter;
}

/**
 * Auto-detect platforms present in the project. Returns ids with truthy detect().
 */
export function detectPlatforms(projectRoot) {
  return PLATFORM_KEYS.filter((id) => ADAPTERS[id].detect?.(projectRoot));
}

/**
 * Platform capability matrix — honest about what each can auto-fire.
 * Consumed by `rune hooks status` and docs.
 */
export const CAPABILITIES = Object.freeze({
  claude: {
    maturity: 'stable',
    preToolEdit: true,
    preToolBash: true,
    postToolEdit: true,
    stop: true,
    notes: 'Full hook parity — PreToolUse/PostToolUse/Stop all supported.',
  },
  cursor: {
    maturity: 'beta',
    preToolEdit: 'rule-injection',
    preToolBash: false,
    postToolEdit: false,
    stop: false,
    notes: 'No tool-level hooks. Uses auto-attach `.mdc` rules as best-effort pre-edit guidance.',
  },
  windsurf: {
    maturity: 'beta',
    preToolEdit: 'workflow',
    preToolBash: 'workflow',
    postToolEdit: false,
    stop: false,
    notes: 'Workflows fire on user command, not tool use. Cascade rules approximate auto-fire.',
  },
  antigravity: {
    maturity: 'experimental',
    preToolEdit: 'rule-injection',
    preToolBash: false,
    postToolEdit: false,
    stop: false,
    notes: 'Early platform; uses rule-injection fallback only.',
  },
});
