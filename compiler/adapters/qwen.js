/**
 * Qwen Coder Adapter
 *
 * Emits SKILL.md files into .qwen/skills/{name}/ directories — Qwen Code's
 * native Agent Skills format. Qwen Code discovers project skills from
 * .qwen/skills/ and lazy-loads them on demand (browse via /skills) — no more
 * QWEN.md @import lines that loaded every skill as always-on context.
 *
 * Qwen skills dir: .qwen/skills/
 * Qwen skill format: .qwen/skills/{name}/SKILL.md
 * Qwen project context: QWEN.md (slim pointer, loaded hierarchically)
 *
 * @see https://qwenlm.github.io/qwen-code-docs/en/users/features/skills/
 * @see https://github.com/QwenLM/qwen-code
 *
 * MODEL TIER MAPPING (v2.18+):
 * Qwen Coder defaults to Qwen3-Coder family. Anthropic-style tier names
 * translate to Qwen size hints (heavy=qwen3-coder-plus, mid=qwen3-coder,
 * light=qwen3-coder-flash). Hint only — Qwen Code reads model from settings.
 */

import { BRANDING_FOOTER } from '../transforms/branding.js';

const MODEL_MAP = {
  opus: 'qwen3-coder-plus',
  sonnet: 'qwen3-coder',
  haiku: 'qwen3-coder-flash',
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
  name: 'qwen',
  outputDir: '.qwen/skills',
  fileExtension: '.md',
  skillPrefix: 'rune-',
  skillSuffix: '',

  // Qwen Code uses directory-per-skill: .qwen/skills/{name}/SKILL.md
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

  // Slim QWEN.md pointer — skills themselves are lazy-loaded natively.
  generateExtraFiles({ stats }) {
    const qwenMd = [
      '# Rune — Project Configuration',
      '',
      'Rune is an interconnected skill ecosystem for AI coding assistants.',
      `${stats.skillCount} core skills + ${stats.packCount} extension packs.`,
      '',
      'Per-skill Agent Skills live under `.qwen/skills/rune-<name>/SKILL.md`. Qwen Code discovers and lazy-loads them on demand (browse via /skills).',
      '',
      '---',
      '> Rune Skill Mesh — https://github.com/rune-kit/rune',
      '',
    ].join('\n');

    return [{ path: 'QWEN.md', content: qwenMd }];
  },
};
