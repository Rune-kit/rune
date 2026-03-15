/**
 * Compliance Transform
 *
 * Injects a compliance preamble into every compiled skill file.
 * This distributes enforcement to ALL platforms (Cursor, Windsurf, etc.)
 * so the AI is reminded of routing discipline even if skill-router
 * itself is not loaded in context.
 *
 * Only applies to non-Claude platforms (Claude has native plugin enforcement).
 */

const COMPLIANCE_PREAMBLE = [
  '',
  '> **RUNE COMPLIANCE**: Before ANY code response, you MUST:',
  '> 1. Classify this request (CODE_CHANGE | QUESTION | DEBUG | REVIEW | EXPLORE)',
  '> 2. Route through the correct Rune skill (see skill-router routing table)',
  "> 3. Follow the skill's workflow — do NOT freelance or skip steps",
  '> Violation: writing code without skill routing = incorrect behavior.',
  '',
].join('\n');

/**
 * Inject compliance preamble after the first heading in a skill body.
 *
 * @param {string} body - skill body text
 * @param {object} adapter - platform adapter
 * @returns {string} body with compliance preamble injected
 */
export function transformCompliance(body, adapter) {
  if (adapter.name === 'claude') return body;

  // Insert after first heading (# skill-name), before first ## section
  const firstH2 = body.indexOf('\n## ');
  if (firstH2 !== -1) {
    return body.slice(0, firstH2) + COMPLIANCE_PREAMBLE + body.slice(firstH2);
  }

  // Fallback: append at end if no ## sections found
  return body + COMPLIANCE_PREAMBLE;
}
