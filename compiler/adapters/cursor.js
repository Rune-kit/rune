/**
 * Cursor Adapter
 *
 * Emits SKILL.md files into .cursor/skills/{name}/ directories — Cursor's
 * native Agent Skills format (Cursor 2.4+, Jan 2026). Skills are loaded
 * dynamically when the agent decides they're relevant, unlike .cursor/rules
 * which are always-on context.
 *
 * Cursor skills dir: .cursor/skills/
 * Cursor skill format: .cursor/skills/{name}/SKILL.md
 * @see https://cursor.com/docs/skills
 *
 * NOTE: .cursor/rules/ is still used by the runtime-hooks installer
 * (adapters/hooks/cursor.js) — rules are the correct vehicle for always-on
 * hook context. Only skill emission moved to .cursor/skills/.
 *
 * MODEL TIER MAPPING (v2.15+):
 * No-op. Cursor's Anthropic API integration understands `model: opus|sonnet|haiku`
 * natively. No translation required.
 */

import { BRANDING_FOOTER } from '../transforms/branding.js';

const TOOL_MAP = {
  Read: 'read the file',
  Write: 'write/create the file',
  Edit: 'edit the file',
  Glob: 'search for files by pattern',
  Grep: 'search file contents',
  Bash: 'run a terminal command',
  TodoWrite: 'track progress',
  Skill: 'invoke the named skill',
  Agent: 'execute the workflow',
};

export default {
  name: 'cursor',
  outputDir: '.cursor/skills',
  fileExtension: '.md',
  skillPrefix: 'rune-',
  skillSuffix: '',

  // Cursor uses directory-per-skill: .cursor/skills/{name}/SKILL.md
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
    return BRANDING_FOOTER;
  },

  transformSubagentInstruction(text) {
    return text;
  },

  scriptsDir(skillName) {
    return `rune-${skillName}/scripts`;
  },

  postProcess(content) {
    return content.replace(/^context: fork\n/gm, '').replace(/^agent: general-purpose\n/gm, '');
  },
};
