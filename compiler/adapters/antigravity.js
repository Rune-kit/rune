/**
 * Google Antigravity (Jules) Adapter
 *
 * Emits SKILL.md files into .agents/skills/{name}/ directories.
 * Uses the same SKILL.md frontmatter format (name, description)
 * with markdown body — identical to Codex pattern.
 *
 * Antigravity project context: AGENTS.md (+ CLAUDE.md fallback)
 * Antigravity skills dir: .agents/skills/
 * Antigravity skill format: .agents/skills/{name}/SKILL.md
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
  name: 'antigravity',
  outputDir: '.agents/skills',
  fileExtension: '.md',
  skillPrefix: 'rune-',
  skillSuffix: '',

  useSkillDirectories: true,
  skillFileName: 'SKILL.md',

  transformReference(skillName, raw) {
    const isBackticked = raw.startsWith('`') && raw.endsWith('`');
    const ref = `the rune-${skillName} skill`;
    return isBackticked ? `\`${ref}\`` : ref;
  },

  transformToolName(toolName) {
    return TOOL_MAP[toolName] || toolName;
  },

  generateHeader(skill) {
    const desc = (skill.description || '').replace(/"/g, '\\"');
    return ['---', `name: rune-${skill.name}`, `description: "${desc}"`, '---', '', ''].join('\n');
  },

  generateFooter() {
    return [
      '',
      '---',
      '> **Rune Skill Mesh** — 58 skills, 200+ connections, 14 extension packs',
      '> Source: https://github.com/rune-kit/rune (MIT)',
      '> **Rune Pro** ($49 lifetime) — product, sales, data-science, support packs → [rune-kit/rune-pro](https://github.com/rune-kit/rune-pro)',
      '> **Rune Business** ($149 lifetime) — finance, legal, HR, enterprise-search packs → [rune-kit/rune-business](https://github.com/rune-kit/rune-business)',
    ].join('\n');
  },

  transformSubagentInstruction(text) {
    return text;
  },

  postProcess(content) {
    return content.replace(/^context: fork\n/gm, '').replace(/^agent: general-purpose\n/gm, '');
  },
};
