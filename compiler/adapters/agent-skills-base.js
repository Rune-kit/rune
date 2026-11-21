/**
 * Agent Skills base adapter factory (v2.33+).
 *
 * Several runtimes now consume the Agent Skills open standard verbatim:
 * one directory per skill, a `SKILL.md` with `name` + `description`
 * frontmatter, and optional `scripts/` / `references/` siblings. The only
 * thing that differs between them is WHERE they look. This factory builds a
 * standard-conformant adapter for a given skills root so new runtimes are a
 * ~20-line file instead of another copy of the same transforms.
 *
 * Standard constraints the emitted frontmatter honours:
 *   - `name` equals the skill directory name (`rune-<name>`), lowercase/kebab
 *   - `description` is a single quoted YAML scalar (quotes escaped once)
 *   - no runtime-specific keys — model tiers ride along as a YAML comment
 *
 * @see https://agentskills.io/specification
 */

import { BRANDING_FOOTER } from '../transforms/branding.js';

const DEFAULT_MODEL_MAP = {
  opus: 'tier:heavy',
  sonnet: 'tier:mid',
  haiku: 'tier:light',
};

const DEFAULT_TOOL_MAP = {
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

/**
 * @param {object} opts
 * @param {string} opts.name - platform id used by `rune init --platform <name>`
 * @param {string} opts.outputDir - project-relative skills root, e.g. `.grok/skills`
 * @param {object} [opts.modelMap] - Anthropic tier → provider hint
 * @param {object} [opts.toolMap] - Claude tool name → prose
 * @param {Function} [opts.generateExtraFiles] - optional extra files hook
 * @returns {object} adapter
 */
export function createAgentSkillsAdapter({
  name,
  outputDir,
  modelMap = DEFAULT_MODEL_MAP,
  toolMap = DEFAULT_TOOL_MAP,
  generateExtraFiles,
}) {
  const adapter = {
    name,
    outputDir,
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
      return toolMap[toolName] || toolName;
    },

    generateHeader(skill) {
      const desc = (skill.description || '').replace(/"/g, '\\"');
      const lines = ['---', `name: rune-${skill.name}`, `description: "${desc}"`];
      const translatedModel = skill.model ? modelMap[skill.model] || skill.model : null;
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
  };

  if (typeof generateExtraFiles === 'function') adapter.generateExtraFiles = generateExtraFiles;
  return adapter;
}
