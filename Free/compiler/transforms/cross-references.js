/**
 * Cross-Reference Transform
 *
 * Rewrites `rune:<name>` references to platform-native format.
 */

const CROSS_REF_PATTERN = /`rune:([a-z][\w-]*)`/g;
const BARE_REF_PATTERN = /(?<!`)rune:([a-z][\w-]*)(?!`)/g;

/**
 * Transform cross-references in skill body using the platform adapter
 *
 * @param {string} body - skill markdown body
 * @param {object} adapter - platform adapter with transformReference method
 * @returns {string} transformed body
 */
export function transformCrossReferences(body, adapter) {
  // First pass: backtick-wrapped references (`rune:cook`)
  let result = body.replace(CROSS_REF_PATTERN, (match, skillName) => {
    return adapter.transformReference(skillName, match);
  });

  // Second pass: bare references (rune:cook without backticks)
  result = result.replace(BARE_REF_PATTERN, (match, skillName) => {
    return adapter.transformReference(skillName, match);
  });

  return result;
}
