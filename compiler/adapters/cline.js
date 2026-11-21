/**
 * Cline Adapter — v2.33+
 *
 * Emits Agent Skills into `.cline/skills/rune-<name>/SKILL.md`. Cline loads
 * skill metadata at startup, activates a skill when the request matches its
 * `description`, and exposes enabled skills as slash commands.
 *
 * Cline constraints (guarded by compiler/__tests__/agent-skills-compliance.test.js):
 *   - frontmatter `name` must exactly match the skill directory name
 *   - `description` max 1024 chars
 *
 * @see https://docs.cline.bot/customization/skills
 */

import { createAgentSkillsAdapter } from './agent-skills-base.js';

export default createAgentSkillsAdapter({
  name: 'cline',
  outputDir: '.cline/skills',
});
