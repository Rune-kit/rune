/**
 * Generic Adapter (Fallback)
 *
 * For unknown or future platforms. Emits to .ai/rules/ directory.
 * Uses the most portable format possible.
 *
 * MODEL TIER MAPPING (v2.15+):
 * Provider-agnostic — emits semantic tier hints in the markdown header.
 * Skill frontmatter `model: opus|sonnet|haiku` is translated to
 * `tier:heavy|mid|light`. The consuming platform resolves the tier.
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
    const translatedModel = skill.model ? MODEL_MAP[skill.model] || skill.model : null;
    const modelSuffix = translatedModel ? ` | model: ${translatedModel}` : '';
    return `# rune-${skill.name}\n\n> Rune ${skill.layer} Skill | ${skill.group}${modelSuffix}\n\n`;
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
};
