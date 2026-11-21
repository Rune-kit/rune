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
 * MODEL TIER HINT (v2.33.0, verified 2026-11-21):
 * Antigravity's SKILL.md frontmatter supports only `name` and `description`
 * (antigravity.google/docs/skills) — there is no per-skill `model` field, so
 * Rune no longer emits one (earlier versions wrote `model: gemini-3-*`, which
 * Antigravity ignored and which is not in its current model list). Instead a
 * one-line hint after the frontmatter names the model that fits the tier, per
 * antigravity.google/docs/models:
 *   opus   → Gemini 4 Neon (High) or Orchestrator — planner-grade reasoning
 *   sonnet → Gemini 4 Hydrogen — the default executor (search, edit, build, test)
 *   haiku  → Gemini 3.8 Flash — fast, available on every plan
 * Unknown tier values produce no hint.
 */

import { BRANDING_FOOTER } from '../transforms/branding.js';

const MODEL_HINT = {
  opus: 'Gemini 4 Neon (High) or Orchestrator — planner-grade reasoning',
  sonnet: 'Gemini 4 Hydrogen — the default executor model',
  haiku: 'Gemini 3.8 Flash — fast, available on every plan',
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
    lines.push('---', '');
    const hint = MODEL_HINT[skill.model];
    if (hint) lines.push(`> Suggested Antigravity model: ${hint}.`, '');
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
};
