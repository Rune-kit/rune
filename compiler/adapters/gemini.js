/**
 * Gemini CLI Adapter
 *
 * Emits SKILL.md files into .gemini/skills/{name}/ directories — Gemini CLI's
 * native Agent Skills format. Gemini CLI discovers skills automatically from
 * .gemini/skills/ (and the .agents/skills/ interop alias) and lazy-loads the
 * full SKILL.md only when a skill is invoked — no more bundling every skill
 * into GEMINI.md (which loaded all 65 skills as always-on context).
 *
 * Gemini skills dir: .gemini/skills/
 * Gemini skill format: .gemini/skills/{name}/SKILL.md
 * Gemini project context: GEMINI.md (slim pointer, project root)
 *
 * @see https://geminicli.com/docs/cli/skills/
 * @see https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/skills.md
 *
 * MODEL TIER MAPPING (v2.18+):
 * Gemini CLI exposes Pro / Flash / Flash-Lite families. Anthropic tier names
 * translate to Gemini families as a hint comment — Gemini CLI reads model
 * from --model flag / config, not from the skill body.
 */

import { BRANDING_FOOTER } from '../transforms/branding.js';

const MODEL_MAP = {
  opus: 'gemini-2.5-pro',
  sonnet: 'gemini-2.5-flash',
  haiku: 'gemini-2.0-flash-lite',
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
  name: 'gemini',
  outputDir: '.gemini/skills',
  fileExtension: '.md',
  skillPrefix: 'rune-',
  skillSuffix: '',

  // Gemini CLI uses directory-per-skill: .gemini/skills/{name}/SKILL.md
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
    if (translatedModel) lines.push(`# model-hint: ${translatedModel}`);
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

  // Slim GEMINI.md pointer — skills themselves are lazy-loaded natively.
  generateExtraFiles({ stats }) {
    const geminiMd = [
      '# Rune — Project Configuration',
      '',
      'Rune is an interconnected skill ecosystem for AI coding assistants.',
      `${stats.skillCount} core skills + ${stats.packCount} extension packs.`,
      '',
      'Per-skill Agent Skills live under `.gemini/skills/rune-<name>/SKILL.md`. Gemini CLI discovers and lazy-loads them automatically.',
      '',
      'When a user request matches a skill\'s domain (e.g. "implement", "review", "debug"), invoke the matching rune-<name> skill.',
      '',
      '---',
      '> Rune Skill Mesh — https://github.com/rune-kit/rune',
      '',
    ].join('\n');

    return [{ path: 'GEMINI.md', content: geminiMd }];
  },
};
