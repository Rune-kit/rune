/**
 * Hook Constraint Inlining
 *
 * Converts Claude Code hook behaviors into inline MUST/NEVER instructions.
 * These get injected as a "Platform Constraints" section.
 */

const HOOK_CONSTRAINTS = [
  {
    id: 'secrets-scan',
    instruction: 'MUST NOT: Never run commands containing hardcoded secrets, API keys, or tokens. Scan all shell commands for secret patterns before execution.',
    relevantTools: ['Bash'],
  },
  {
    id: 'auto-format',
    instruction: 'MUST: After editing JS/TS files, ensure code follows project formatting conventions (Prettier/ESLint).',
    relevantTools: ['Edit', 'Write'],
  },
  {
    id: 'typecheck',
    instruction: 'MUST: After editing .ts/.tsx files, verify TypeScript compilation succeeds (no type errors).',
    relevantTools: ['Edit', 'Write'],
  },
  {
    id: 'context-watch',
    instruction: 'SHOULD: Monitor your context usage. If working on a long task, summarize progress before context fills up.',
    relevantTools: [],
  },
  {
    id: 'pre-compact',
    instruction: 'MUST: Before summarizing/compacting context, save important decisions and progress to project files.',
    relevantTools: [],
  },
  {
    id: 'post-session',
    instruction: 'SHOULD: Before ending, save architectural decisions and progress to .rune/ directory for future sessions.',
    relevantTools: [],
  },
];

/**
 * Generate inline hook constraints section for non-Claude platforms
 *
 * @param {object} parsedSkill - parsed skill IR
 * @param {object} adapter - platform adapter
 * @returns {string} constraints section to inject, or empty string
 */
export function generateHookConstraints(parsedSkill, adapter) {
  if (adapter.name === 'claude') return '';

  // Filter to relevant constraints based on tool usage in this skill
  const skillToolNames = parsedSkill.toolRefs.map(r => r.toolName);
  const relevant = HOOK_CONSTRAINTS.filter(h =>
    h.relevantTools.length === 0 || h.relevantTools.some(t => skillToolNames.includes(t))
  );

  if (relevant.length === 0) return '';

  const lines = [
    '',
    '## Platform Constraints',
    '',
    ...relevant.map(h => `- ${h.instruction}`),
    '',
  ];

  return lines.join('\n');
}
