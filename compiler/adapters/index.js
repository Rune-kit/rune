/**
 * Adapter Registry
 *
 * Central registry for all platform adapters.
 */

import antigravity from './antigravity.js';
import claude from './claude.js';
import codex from './codex.js';
import cursor from './cursor.js';
import generic from './generic.js';
import openclaw from './openclaw.js';
import opencode from './opencode.js';
import windsurf from './windsurf.js';

const adapters = {
  claude,
  cursor,
  windsurf,
  antigravity,
  generic,
  openclaw,
  codex,
  opencode,
};

/**
 * Get adapter by platform name
 * @param {string} platform
 * @returns {object} adapter
 */
export function getAdapter(platform) {
  const adapter = adapters[platform];
  if (!adapter) {
    const available = Object.keys(adapters).join(', ');
    throw new Error(`Unknown platform "${platform}". Available: ${available}`);
  }
  return adapter;
}

/**
 * List all available platform names
 * @returns {string[]}
 */
export function listPlatforms() {
  return Object.keys(adapters);
}

export { adapters };
