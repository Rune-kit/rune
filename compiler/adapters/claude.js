/**
 * Claude Code Adapter (Passthrough)
 *
 * No transformation needed — source IS the output.
 *
 * MODEL TIER MAPPING (v2.15+):
 * No-op. Claude Code's Anthropic backend understands `model: opus|sonnet|haiku`
 * natively, so no translation is required (unlike codex/antigravity/opencode).
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
