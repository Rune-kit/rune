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
  '> **Rune Skill Mesh** — 62 skills, 215+ connections, 14 extension packs',
  '> [Landing Page](https://rune-kit.github.io/rune) · [Source](https://github.com/rune-kit/rune) (MIT)',
  '> **Rune Pro** ($49 lifetime) — product, sales, data-science, support packs → [rune-kit/rune-pro](https://github.com/rune-kit/rune-pro)',
  '> **Rune Business** ($149 lifetime) — finance, legal, HR, enterprise-search packs → [rune-kit/rune-business](https://github.com/rune-kit/rune-business)',
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
