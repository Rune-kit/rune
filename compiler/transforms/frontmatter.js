/**
 * Frontmatter Transform
 *
 * Strips or rewrites Claude Code-specific frontmatter directives.
 * - context: fork → removed on non-Claude platforms
 * - agent: general-purpose → removed on non-Claude platforms
 * - model: → removed or converted to comment
 */

/**
 * Strip Claude Code-specific frontmatter lines from raw content
 *
 * @param {string} content - full SKILL.md content (with frontmatter)
 * @param {object} adapter - platform adapter
 * @returns {string} content with cleaned frontmatter
 */
export function transformFrontmatter(content, adapter) {
  if (adapter.name === 'claude') return content;

  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return content;

  const frontmatterBlock = match[1];
  const afterFrontmatter = content.slice(match[0].length);

  // Remove Claude Code-specific directives
  const cleaned = frontmatterBlock
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('context:')) return false;
      if (trimmed.startsWith('agent:')) return false;
      return true;
    })
    .join('\n');

  return `---\n${cleaned}\n---${afterFrontmatter}`;
}
