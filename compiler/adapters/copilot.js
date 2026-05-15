/**
 * GitHub Copilot CLI Adapter
 *
 * Emits per-skill instruction files into .github/instructions/ — the documented
 * convention for GitHub Copilot custom instructions (read by both the CLI and
 * the GitHub Copilot IDE plugin family).
 *
 * Copilot instructions dir: .github/instructions/
 * Copilot instruction file: .github/instructions/rune-{name}.instructions.md
 * Copilot project context: AGENTS.md (Copilot Spaces / Coding Agent convention)
 *
 * Each .instructions.md uses YAML frontmatter with `applyTo` for path scoping.
 * Default applyTo: "**" means "apply to all files."
 *
 * @see https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions
 * @see https://docs.github.com/en/copilot/concepts/response-customization
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
  Skill: 'follow the referenced instructions',
  Agent: 'execute the workflow',
};

export default {
  name: 'copilot',
  outputDir: '.github/instructions',
  fileExtension: '.instructions.md',
  skillPrefix: 'rune-',
  skillSuffix: '',

  // Copilot instructions are flat per-skill files, not directories.
  useSkillDirectories: false,

  transformReference(skillName, raw) {
    const isBackticked = raw.startsWith('`') && raw.endsWith('`');
    const ref = `the rune-${skillName} instructions`;
    return isBackticked ? `\`${ref}\`` : ref;
  },

  transformToolName(toolName) {
    return TOOL_MAP[toolName] || toolName;
  },

  generateHeader(skill) {
    // Per docs.github.com Copilot CLI custom-instructions spec, the only
    // documented frontmatter key for `.instructions.md` is `applyTo`. Other
    // metadata (description, tier hint) belongs in the markdown body so it
    // survives parsing across CLI/IDE/extensions consistently.
    const desc = (skill.description || '').replace(/\n/g, ' ');
    const tierHint = skill.model ? MODEL_MAP[skill.model] || skill.model : null;
    const lines = ['---', 'applyTo: "**"', '---', '', `# rune-${skill.name}`, '', `> ${desc}`];
    if (tierHint) lines.push('', `<!-- tier-hint: ${tierHint} -->`);
    lines.push('', '');
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

  // Emit a top-level .github/copilot-instructions.md as the entry point + an
  // AGENTS.md so Copilot Spaces / Coding Agent can find the project context.
  generateExtraFiles({ stats }) {
    const copilotIndex = [
      '# Rune — Copilot Custom Instructions',
      '',
      `Per-skill instructions live under \`.github/instructions/rune-<name>.instructions.md\` (${stats.skillCount} skills + ${stats.packCount} packs). Copilot loads them based on each file's \`applyTo\` glob.`,
      '',
      'When a user request matches a skill\'s domain (e.g. "fix the failing test", "review this PR"), prefer following the corresponding rune-<name>.instructions.md over freestyling.',
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
      'Per-skill custom instructions: `.github/instructions/rune-<name>.instructions.md`',
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
