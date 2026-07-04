/**
 * Qoder Adapter
 *
 * Emits SKILL.md files into .qoder/skills/{name}/ directories — Qoder's
 * documented project-level Agent Skills location (works identically in
 * Qoder IDE and CLI). Qoder also reads AGENTS.md as its project-context file.
 *
 * Qoder skills dir: .qoder/skills/
 * Qoder skill format: .qoder/skills/{name}/SKILL.md
 * Qoder project context: AGENTS.md (open AGENTS.md standard)
 *
 * @see https://docs.qoder.com/extensions/skills
 * @see https://agents.md/
 *
 * MODEL TIER MAPPING (v2.18+):
 * Qoder is provider-agnostic — emits semantic tier hints rather than concrete
 * model names. Qoder IDE resolves the tier to its configured provider model.
 */

import { BRANDING_FOOTER } from '../transforms/branding.js';

const MODEL_MAP = {
  opus: 'tier:heavy',
  sonnet: 'tier:mid',
  haiku: 'tier:light',
};

const TOOL_MAP = {
  Read: 'read the file',
  Write: 'write/create the file',
  Edit: 'edit the file',
  Glob: 'find files by pattern',
  Grep: 'search file contents',
  Bash: 'run a shell command',
  TodoWrite: 'track task progress',
  Skill: 'invoke the rune-{name} skill',
  Agent: 'execute the workflow',
};

export default {
  name: 'qoder',
  outputDir: '.qoder/skills',
  fileExtension: '.md',
  skillPrefix: 'rune-',
  skillSuffix: '',

  // Qoder uses directory-per-skill: .qoder/skills/{name}/SKILL.md
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

  // Qoder reads AGENTS.md at the project root as its high-level context file.
  generateExtraFiles({ stats }) {
    const agentsMd = [
      '# Rune — Project Configuration',
      '',
      'Rune is an interconnected skill ecosystem for AI coding assistants.',
      `${stats.skillCount} core skills + ${stats.packCount} extension packs.`,
      '',
      'Per-skill Agent Skills live under `.qoder/skills/rune-<name>/SKILL.md`. Qoder discovers and loads them on demand.',
      '',
      '---',
      '> Rune Skill Mesh — https://github.com/rune-kit/rune',
      '',
    ].join('\n');
    return [{ path: 'AGENTS.md', content: agentsMd }];
  },
};
