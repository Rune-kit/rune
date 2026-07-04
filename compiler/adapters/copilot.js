/**
 * GitHub Copilot Adapter
 *
 * Emits SKILL.md files into .github/skills/{name}/ directories — GitHub
 * Copilot's native Agent Skills format (supported since Dec 2025 across
 * Copilot CLI, VS Code agent mode, and github.com). Skills are loaded
 * on-demand based on the description, keeping context lean.
 *
 * Copilot skills dir: .github/skills/ (also reads .claude/skills and .agents/skills)
 * Copilot skill format: .github/skills/{name}/SKILL.md
 * Copilot project context: AGENTS.md (Copilot Spaces / Coding Agent convention)
 *
 * @see https://docs.github.com/en/copilot/concepts/agents/about-agent-skills
 * @see https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills
 *
 * MODEL TIER MAPPING (v2.18+):
 * Copilot multi-model support exposes Anthropic/OpenAI/Google providers. Tier
 * names are emitted as a hint comment in the body — Copilot does not parse a
 * model field, so we don't fight the platform.
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
  Agent: 'execute the workflow',
};

export default {
  name: 'copilot',
  outputDir: '.github/skills',
  fileExtension: '.md',
  skillPrefix: 'rune-',
  skillSuffix: '',

  // Copilot uses directory-per-skill: .github/skills/{name}/SKILL.md
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
    // Agent Skills spec: name + description frontmatter, markdown body.
    // Tier hint stays a body comment — Copilot has no model frontmatter key.
    const desc = (skill.description || '').replace(/"/g, '\\"');
    const tierHint = skill.model ? MODEL_MAP[skill.model] || skill.model : null;
    const lines = ['---', `name: rune-${skill.name}`, `description: "${desc}"`, '---', ''];
    if (tierHint) lines.push(`<!-- tier-hint: ${tierHint} -->`, '');
    lines.push('');
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

  // Emit a top-level .github/copilot-instructions.md as the entry point + an
  // AGENTS.md so Copilot Spaces / Coding Agent can find the project context.
  generateExtraFiles({ stats }) {
    const copilotIndex = [
      '# Rune — Copilot Custom Instructions',
      '',
      `Per-skill Agent Skills live under \`.github/skills/rune-<name>/SKILL.md\` (${stats.skillCount} skills + ${stats.packCount} packs). Copilot discovers and loads them on demand based on each skill's description.`,
      '',
      'When a user request matches a skill\'s domain (e.g. "fix the failing test", "review this PR"), prefer invoking the corresponding rune-<name> skill over freestyling.',
      '',
      '---',
      '> Rune Skill Mesh — https://github.com/rune-kit/rune',
      '',
    ].join('\n');

    const agentsMd = [
      '# Rune — Project Configuration',
      '',
      'Rune is an interconnected skill ecosystem for AI coding assistants.',
      `${stats.skillCount} core skills + ${stats.packCount} extension packs.`,
      '',
      'Per-skill Agent Skills: `.github/skills/rune-<name>/SKILL.md`',
      '',
      '---',
      '> Rune Skill Mesh — https://github.com/rune-kit/rune',
      '',
    ].join('\n');

    return [
      { path: '.github/copilot-instructions.md', content: copilotIndex },
      { path: 'AGENTS.md', content: agentsMd },
    ];
  },
};
