/**
 * Google Antigravity (Jules) Adapter
 *
 * Emits SKILL.md files into .agents/skills/{name}/ directories.
 * Uses the same SKILL.md frontmatter format (name, description)
 * with markdown body — identical to Codex pattern.
 *
 * Antigravity project context: AGENTS.md (+ CLAUDE.md fallback)
 * Antigravity skills dir: .agents/skills/
 * Antigravity skill format: .agents/skills/{name}/SKILL.md
 *
 * MODEL TIER MAPPING (v2.15+):
 * Skill frontmatter `model: opus|sonnet|haiku` (Anthropic naming) is
 * translated to Gemini provider-correct model names. Antigravity supports
 * both Gemini and Claude — defaulting to Gemini family since it is the
 * native model. Unknown tier values pass through.
 */

import { BRANDING_FOOTER } from '../transforms/branding.js';

const MODEL_MAP = {
  opus: 'gemini-3-pro',
  sonnet: 'gemini-3-flash',
  haiku: 'gemini-3-flash-lite',
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
  name: 'antigravity',
  outputDir: '.agents/skills',
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
    return `rune-${skillName}-scripts`;
  },

  referencesDir(skillName) {
    return `rune-${skillName}-references`;
  },

  postProcess(content) {
    return content.replace(/^context: fork\n/gm, '').replace(/^agent: general-purpose\n/gm, '');
  },
};
