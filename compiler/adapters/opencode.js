/**
 * OpenCode Adapter
 *
 * Emits SKILL.md files into .opencode/skills/{name}/ directories.
 * OpenCode uses the same SKILL.md frontmatter format (name, description)
 * with markdown body — identical to Codex pattern.
 *
 * OpenCode project context: AGENTS.md (+ CLAUDE.md fallback)
 * OpenCode skills dir: .opencode/skills/
 * OpenCode skill format: .opencode/skills/{name}/SKILL.md
 * OpenCode agents dir: .opencode/agents/
 *
 * OpenCode also searches:
 *   .claude/skills/{name}/SKILL.md (Claude-compatible)
 *   .agents/skills/{name}/SKILL.md (agent-compatible)
 *
 * @see https://opencode.ai/docs/skills/
 * @see https://opencode.ai/docs/agents/
 *
 * MODEL TIER MAPPING (v2.15+):
 * OpenCode is provider-agnostic — emits semantic tier hints rather than
 * concrete model names. Skill frontmatter `model: opus|sonnet|haiku` is
 * translated to `tier:heavy|mid|light`. The OpenCode IDE resolves the
 * tier to its configured provider model.
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
  Skill: 'invoke the named skill',
  Agent: 'delegate to a subagent',
};

export default {
  name: 'opencode',
  outputDir: '.opencode/skills',
  fileExtension: '.md',
  skillPrefix: 'rune-',
  skillSuffix: '',

  // OpenCode uses directory-per-skill: .opencode/skills/{name}/SKILL.md
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
    // OpenCode has native subagent support — preserve parallel agent instructions
    return text;
  },

  scriptsDir(skillName) {
    return `rune-${skillName}/scripts`;
  },

  postProcess(content) {
    return content.replace(/^context: fork\n/gm, '').replace(/^agent: general-purpose\n/gm, '');
  },
};
