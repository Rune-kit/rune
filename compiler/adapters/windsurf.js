/**
 * Windsurf Adapter
 *
 * Emits .md rule files for .windsurf/rules/ directory.
 * Uses prose references for cross-skill mesh (no @file support).
 */

const TOOL_MAP = {
  Read: 'read the file',
  Write: 'write/create the file',
  Edit: 'edit the file',
  Glob: 'find files matching a pattern',
  Grep: 'search for text in files',
  Bash: 'run a shell command',
  TodoWrite: 'track task progress',
  Skill: 'follow the referenced skill workflow',
  Agent: 'execute the workflow',
};

export default {
  name: 'windsurf',
  outputDir: '.windsurf/rules',
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
    return `# rune-${skill.name}\n\n> Layer: ${skill.layer} | Group: ${skill.group}\n\n`;
  },

  generateFooter() {
    return [
      '',
      '---',
      '> **Rune Skill Mesh** — 58 skills, 200+ connections',
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
