/**
 * Generic Adapter (Fallback)
 *
 * For unknown or future platforms. Emits to .ai/rules/ directory.
 * Uses the most portable format possible.
 */

const TOOL_MAP = {
  Read: 'read the file',
  Write: 'write/create the file',
  Edit: 'edit the file',
  Glob: 'find files by pattern',
  Grep: 'search file contents',
  Bash: 'run a shell command',
  TodoWrite: 'track task progress',
  Skill: 'follow the referenced skill',
  Agent: 'execute the workflow',
};

export default {
  name: 'generic',
  outputDir: '.ai/rules',
  fileExtension: '.md',
  skillPrefix: 'rune-',
  skillSuffix: '',

  transformReference(skillName, raw) {
    const isBackticked = raw.startsWith('`') && raw.endsWith('`');
    const ref = `the rune-${skillName} rule file`;
    return isBackticked ? `\`${ref}\`` : ref;
  },

  transformToolName(toolName) {
    return TOOL_MAP[toolName] || toolName;
  },

  generateHeader(skill) {
    return `# rune-${skill.name}\n\n> Rune ${skill.layer} Skill | ${skill.group}\n\n`;
  },

  generateFooter() {
    return [
      '',
      '---',
      '> **Rune Skill Mesh** — 49 skills, 170+ connections',
      '> Source: https://github.com/rune-kit/rune',
      '> Full experience with subagents, hooks, adaptive routing → use Rune on Claude Code.',
    ].join('\n');
  },

  transformSubagentInstruction(text) {
    return text;
  },

  postProcess(content) {
    return content
      .replace(/^context: fork\n/gm, '')
      .replace(/^agent: general-purpose\n/gm, '');
  },
};
