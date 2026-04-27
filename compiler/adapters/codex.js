/**
 * OpenAI Codex Adapter
 *
 * Emits SKILL.md files into .codex/skills/{name}/ directories.
 * Codex uses the same SKILL.md frontmatter format (name, description)
 * with markdown body — very close to Rune's native format.
 *
 * Codex project context: AGENTS.md (equivalent to CLAUDE.md)
 * Codex skills dir: .codex/skills/
 * Codex skill format: .codex/skills/{name}/SKILL.md
 *
 * MODEL TIER MAPPING (v2.15+):
 * Skill frontmatter `model: opus|sonnet|haiku` (Anthropic naming) is
 * translated to Codex/OpenAI provider-correct model names so the field
 * is meaningful in the compiled output. Unknown tier values pass through.
 */

import { BRANDING_FOOTER } from '../transforms/branding.js';

const MODEL_MAP = {
  opus: 'gpt-5-pro',
  sonnet: 'gpt-5',
  haiku: 'gpt-5-mini',
};

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
  name: 'codex',
  outputDir: '.codex/skills',
  fileExtension: '.md',
  skillPrefix: 'rune-',
  skillSuffix: '',

  // Codex uses directory-per-skill: .codex/skills/{name}/SKILL.md
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
    const lines = ['---', `name: rune-${skill.name}`, `description: "${desc}"`];
    const translatedModel = skill.model ? MODEL_MAP[skill.model] || skill.model : null;
    if (translatedModel) lines.push(`model: ${translatedModel}`);
    lines.push('---', '', '');
    return lines.join('\n');
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
