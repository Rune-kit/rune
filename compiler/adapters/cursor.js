/**
 * Cursor Adapter
 *
 * Emits .mdc rule files for .cursor/rules/ directory.
 * Uses @file references for cross-skill mesh.
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
  Skill: 'follow the referenced skill rules',
  Agent: 'execute the workflow',
};

export default {
  name: 'cursor',
  outputDir: '.cursor/rules',
  fileExtension: '.mdc',
  skillPrefix: 'rune-',
  skillSuffix: '',

  transformReference(skillName, raw) {
    const isBackticked = raw.startsWith('`') && raw.endsWith('`');
    const ref = `@rune-${skillName}.mdc`;
    return isBackticked ? `\`${ref}\`` : ref;
  },

  transformToolName(toolName) {
    return TOOL_MAP[toolName] || toolName;
  },

  generateHeader(skill) {
    return [
      '---',
      `description: "${skill.description}"`,
      'globs: []',
      `alwaysApply: ${skill.layer === 'L0'}`,
      '---',
      '',
    ].join('\n');
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
