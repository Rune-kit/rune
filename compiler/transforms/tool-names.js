/**
 * Tool Name Transform
 *
 * Rewrites Claude Code-specific tool names to platform-generic language.
 */

// "Use `Tool` to ..." or "Use `Tool` for ..." → contextual rewrite
const TOOL_INSTRUCTION_TO_PATTERN = /Use `(Read|Write|Edit|Glob|Grep|Bash|TodoWrite|Skill|Agent)` (?:to |for )/gi;

// "Use `Tool`:" or "Use `Tool`." → direct tool usage
const TOOL_INSTRUCTION_DIRECT_PATTERN = /Use `(Read|Write|Edit|Glob|Grep|Bash|TodoWrite|Skill|Agent)`(?=\s*[:.])/gi;

// Standalone `Tool` reference in any context
const TOOL_REF_PATTERN = /`(Read|Write|Edit|Glob|Grep|Bash|TodoWrite|Skill|Agent)`/g;

// Action verbs for direct patterns (no "to" suffix)
const DIRECT_ACTION = {
  Read: 'Read the relevant files',
  Write: 'Create the files',
  Edit: 'Edit the files',
  Glob: 'Find files by pattern',
  Grep: 'Search file contents',
  Bash: 'Run in the terminal',
  TodoWrite: 'Track progress',
  Skill: 'Follow the skill rules',
  Agent: 'Execute the workflow',
};

/**
 * Transform tool name references in skill body
 *
 * @param {string} body - skill markdown body
 * @param {object} adapter - platform adapter with transformToolName method
 * @returns {string} transformed body
 */
export function transformToolNames(body, adapter) {
  // Skip passthrough adapter
  if (adapter.name === 'claude') return body;

  // First: "Use `Tool` to/for ..." patterns
  let result = body.replace(TOOL_INSTRUCTION_TO_PATTERN, (match, toolName) => {
    const mapped = adapter.transformToolName(toolName);
    if (mapped === toolName) return match;
    return mapped.charAt(0).toUpperCase() + mapped.slice(1) + ' to ';
  });

  // Second: "Use `Tool`:" or "Use `Tool`." patterns
  result = result.replace(TOOL_INSTRUCTION_DIRECT_PATTERN, (match, toolName) => {
    return DIRECT_ACTION[toolName] || match;
  });

  // Third: standalone `Tool` references
  result = result.replace(TOOL_REF_PATTERN, (match, toolName) => {
    const mapped = adapter.transformToolName(toolName);
    if (mapped === toolName) return match;
    return mapped;
  });

  return result;
}
