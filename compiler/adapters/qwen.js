/**
 * Qwen Coder Adapter
 *
 * Emits per-skill rule files into qwen/skills/ and a top-level QWEN.md that
 * uses Qwen Code's @import syntax to load each rule file. Qwen Code loads
 * QWEN.md hierarchically (cwd → parent → ~/.qwen/QWEN.md).
 *
 * Qwen rules dir: qwen/skills/
 * Qwen rule file: qwen/skills/rune-{name}.md
 * Qwen project context: QWEN.md at project root (with @path imports)
 *
 * @see https://qwenlm.github.io/qwen-code-docs/en/users/configuration/settings/
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
  Skill: 'follow the imported rune-{name} skill',
  Agent: 'execute the workflow',
};

export default {
  name: 'qwen',
  outputDir: 'qwen/skills',
  fileExtension: '.md',
  skillPrefix: 'rune-',
  skillSuffix: '',

  // Qwen skills are flat per-skill markdown files imported from QWEN.md.
  useSkillDirectories: false,

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
    return `rune-${skillName}-scripts`;
  },

  postProcess(content) {
    return content.replace(/^context: fork\n/gm, '').replace(/^agent: general-purpose\n/gm, '');
  },

  // Emit QWEN.md at project root with @import lines for every per-skill file.
  generateExtraFiles({ stats }) {
    const skillFiles = stats.files
      .filter((f) => f.startsWith('rune-') && f.endsWith('.md') && !f.includes('/') && !f.includes('\\'))
      .sort();

    const qwenMd = [
      '# Rune — Project Configuration',
      '',
      'Rune is an interconnected skill ecosystem for AI coding assistants.',
      `${stats.skillCount} core skills + ${stats.packCount} extension packs.`,
      '',
      '## Loaded Skills',
      '',
      'Qwen Code loads each referenced file as part of this project context.',
      '',
      ...skillFiles.map((f) => `@qwen/skills/${f}`),
      '',
      '---',
      '> Rune Skill Mesh — https://github.com/rune-kit/rune',
      '',
    ].join('\n');

    return [{ path: 'QWEN.md', content: qwenMd }];
  },
};
