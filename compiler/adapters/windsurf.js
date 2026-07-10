/**
 * Windsurf Adapter
 *
 * Emits SKILL.md files into .windsurf/skills/{name}/ directories — the native
 * Cascade Skills format. Cascade uses progressive disclosure: only the skill's
 * name and description are shown to the model by default; the full SKILL.md is
 * loaded when Cascade invokes the skill (or via @skill-name).
 *
 * REBRAND (2026-06-02): Windsurf is now "Devin Desktop" (Cognition), rolled out
 * over-the-air. Devin Desktop PREFERS `.devin/skills/` + `.devin/rules/` but
 * still reads `.windsurf/skills/` + `.windsurf/rules/` as a documented fallback
 * (docs.devin.ai). Rune keeps emitting to `.windsurf/` for maximum compat — it
 * works on both current Devin and any un-migrated Windsurf install. The CLI flag
 * stays `--platform windsurf`. Flip the emission dirs to `.devin/` only once
 * Devin deprecates the `.windsurf/` fallback. @see docs.devin.ai/desktop
 *
 * Windsurf/Devin skills dir: .windsurf/skills/  (Devin also reads .devin/skills/)
 * Skill format: .windsurf/skills/{name}/SKILL.md
 *
 * NOTE: .windsurf/rules/ is still used by the runtime-hooks installer
 * (adapters/hooks/windsurf.js) — rules are the correct vehicle for always-on
 * hook context. Only skill emission moved to .windsurf/skills/.
 *
 * MODEL TIER MAPPING (v2.15+):
 * No-op. Windsurf's Anthropic API integration understands `model: opus|sonnet|haiku`
 * natively. No translation required.
 */

import { BRANDING_FOOTER } from '../transforms/branding.js';

const TOOL_MAP = {
  Read: 'read the file',
  Write: 'write/create the file',
  Edit: 'edit the file',
  Glob: 'find files matching a pattern',
  Grep: 'search for text in files',
  Bash: 'run a shell command',
  TodoWrite: 'track task progress',
  Skill: 'invoke the named skill',
  Agent: 'execute the workflow',
};

export default {
  name: 'windsurf',
  outputDir: '.windsurf/skills',
  fileExtension: '.md',
  skillPrefix: 'rune-',
  skillSuffix: '',

  // Windsurf uses directory-per-skill: .windsurf/skills/{name}/SKILL.md
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
    return ['---', `name: rune-${skill.name}`, `description: "${desc}"`, '---', '', ''].join('\n');
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
