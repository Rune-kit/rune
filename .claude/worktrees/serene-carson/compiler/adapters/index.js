/**
 * Adapter Registry
 *
 * Central registry for all platform adapters.
 */

import claude from './claude.js';
import cursor from './cursor.js';
import windsurf from './windsurf.js';
import antigravity from './antigravity.js';
import generic from './generic.js';
import openclaw from './openclaw.js';

const adapters = {
  claude,
  cursor,
  windsurf,
  antigravity,
  generic,
  openclaw,
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
