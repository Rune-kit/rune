/**
 * Claude Code Adapter (Passthrough)
 *
 * No transformation needed — source IS the output.
 */

export default {
  name: 'claude',
  outputDir: null,
  fileExtension: '.md',
  skillPrefix: '',
  skillSuffix: '',

  transformReference(_skillName, raw) {
    return raw;
  },

  transformToolName(toolName) {
    return toolName;
  },

  generateHeader(_skill) {
    return '';
  },

  generateFooter() {
    return '';
  },

  transformSubagentInstruction(text) {
    return text;
  },

  postProcess(content) {
    return content;
  },
};
