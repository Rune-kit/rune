/**
 * OpenAI Codex Adapter
 *
 * Emits SKILL.md files into .agents/skills/{name}/ directories.
 * Codex uses the same SKILL.md frontmatter format (name, description)
 * with markdown body — very close to Rune's native format.
 *
 * Codex project context: AGENTS.md (equivalent to CLAUDE.md)
 * Codex skills dir: .agents/skills/ (scanned from CWD up to repo root)
 * Codex skill format: .agents/skills/{name}/SKILL.md
 *
 * NOTE: Codex dropped .codex/skills/ from its scan list — .codex/ is config
 * only (config.toml). Repo skills MUST live in .agents/skills/ to be
 * auto-discovered. @see https://developers.openai.com/codex/skills
 *
 * MODEL TIER MAPPING (v2.15+, lineup refreshed 2026-07):
 * Skill frontmatter `model: opus|sonnet|haiku` (Anthropic naming) is
 * translated to Codex/OpenAI provider-correct model names so the field
 * is meaningful in the compiled output. Unknown tier values pass through.
 *
 * Codex GPT-5.6 tiers (verified against codex-cli 0.144.1 + developers.openai.com/codex/models):
 *   sol  = flagship/complex → opus
 *   terra = balanced everyday → sonnet
 *   luna = fast/affordable → haiku
 * Codex also exposes `model_reasoning_effort = minimal|low|medium|high|xhigh`
 * (a config.toml key, not per-skill frontmatter) — Rune surfaces the tier→effort
 * suggestion in AGENTS.md rather than emitting a speculative per-skill field.
 */

import { BRANDING_FOOTER } from '../transforms/branding.js';

const MODEL_MAP = {
  opus: 'gpt-5.6-sol',
  sonnet: 'gpt-5.6-terra',
  haiku: 'gpt-5.6-luna',
};

// Suggested config.toml `model_reasoning_effort` per tier (global key, documented in AGENTS.md).
const REASONING_EFFORT_MAP = {
  opus: 'high',
  sonnet: 'medium',
  haiku: 'low',
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
  name: 'codex',
  outputDir: '.agents/skills',
  fileExtension: '.md',
  skillPrefix: 'rune-',
  skillSuffix: '',

  // Codex uses directory-per-skill: .agents/skills/{name}/SKILL.md
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
    return `rune-${skillName}/scripts`;
  },

  postProcess(content) {
    return content.replace(/^context: fork\n/gm, '').replace(/^agent: general-purpose\n/gm, '');
  },

  // Codex (and OpenAI's AGENTS.md convention generally) reads AGENTS.md at the
  // project root for high-level context. Migrated from emitter.js v2.18.
  generateExtraFiles({ stats }) {
    const agentsMd = [
      '# Rune — Project Configuration',
      '',
      '## Overview',
      '',
      'Rune is an interconnected skill ecosystem for AI coding assistants.',
      `${stats.skillCount} core skills | 5-layer mesh architecture | ${stats.crossRefsResolved} connections | Multi-platform.`,
      'Philosophy: "Less skills. Deeper connections."',
      '',
      'Platform: codex',
      '',
      '## Skills',
      '',
      `**${stats.skillCount} core skills** + **${stats.packCount} extension packs**`,
      '',
      '## Usage',
      '',
      'Reference skills using the `Skill` tool or delegate to subagents using the `Agent` tool.',
      '',
      '## Skills Directory',
      '',
      'Skills are located in: .agents/skills/ (auto-discovered by Codex)',
      '',
      '## Model Tiers',
      '',
      'Rune skills carry a tier hint (`opus`/`sonnet`/`haiku`). Suggested Codex mapping:',
      '',
      `- opus → \`${MODEL_MAP.opus}\` (\`model_reasoning_effort = "${REASONING_EFFORT_MAP.opus}"\`) — architecture / security / planning`,
      `- sonnet → \`${MODEL_MAP.sonnet}\` (\`model_reasoning_effort = "${REASONING_EFFORT_MAP.sonnet}"\`) — code / edit / review`,
      `- haiku → \`${MODEL_MAP.haiku}\` (\`model_reasoning_effort = "${REASONING_EFFORT_MAP.haiku}"\`) — scan / read-only`,
      '',
      'Set `model` + `model_reasoning_effort` in `~/.codex/config.toml` to match the tier of the task.',
      '',
      '---',
      '> Rune Skill Mesh — https://github.com/rune-kit/rune',
      '',
    ].join('\n');
    return [{ path: 'AGENTS.md', content: agentsMd }];
  },
};
