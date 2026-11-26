/**
 * Claude Code Adapter (Passthrough)
 *
 * No transformation needed — source IS the output.
 *
 * MODEL TIER MAPPING (v2.15+):
 * No-op. Claude Code understands `model: fable|opus|sonnet|haiku|inherit`
 * natively (code.claude.com/docs/en/sub-agents), so no translation is required.
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
