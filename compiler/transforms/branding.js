/**
 * Branding Transform
 *
 * Adds Rune attribution footer to compiled skill files.
 */

const DEFAULT_FOOTER = [
  '',
  '---',
  '> **Rune Skill Mesh** — 58 skills, 200+ connections',
  '> Source: https://github.com/rune-kit/rune',
  '> For the full experience with subagents, hooks, adaptive routing, and mesh analytics — use Rune as a Claude Code plugin.',
].join('\n');

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
  return body + '\n' + footer;
}
