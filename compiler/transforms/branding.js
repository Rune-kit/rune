/**
 * Branding Transform
 *
 * Adds Rune attribution footer to compiled skill files.
 * All adapters MUST import BRANDING_FOOTER instead of hardcoding stats.
 */

/**
 * Single source of truth for branding footer.
 * Update these numbers here — all adapters inherit automatically.
 */
export const BRANDING_FOOTER = [
  '',
  '---',
  '> **Rune Skill Mesh** — 67 skills, 248 connections + 46 signals, 14 extension packs',
  '> [Landing Page](https://rune-kit.github.io/rune) · [Source](https://github.com/rune-kit/rune) (MIT)',
  '> **Rune Pro** ($49 lifetime) — 9 domain packs + context intelligence → [rune-kit.github.io/rune#pricing](https://rune-kit.github.io/rune#pricing)',
  '> **Rune Business** ($149 lifetime) — finance, legal, HR, enterprise-search packs → [rune-kit.github.io/rune#pricing](https://rune-kit.github.io/rune#pricing)',
].join('\n');

const DEFAULT_FOOTER = BRANDING_FOOTER;

/**
 * Add branding footer to skill output
 *
 * @param {string} body - transformed skill body
 * @param {object} adapter - platform adapter
 * @returns {string} body with footer
 */
export function addBranding(body, adapter) {
  if (adapter.name === 'claude') return body;

  const footer = adapter.generateFooter ? adapter.generateFooter() : DEFAULT_FOOTER;
  return `${body}\n${footer}`;
}
