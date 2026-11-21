/**
 * Universal `.agents/skills` Adapter — v2.33+
 *
 * Emits Agent Skills into `.agents/skills/rune-<name>/SKILL.md`, the shared
 * cross-vendor skills root. Use this when your runtime is not one Rune
 * targets by name — Amp, Goose, Factory Droid, Junie, Kiro, Trae, Grok Build
 * (scans `.agents/skills/` alongside `.grok/`), Codex, and any other agent
 * that follows the Agent Skills standard's `.agents/` convention.
 *
 * Difference from the `codex` adapter (same directory): `agents` writes ONLY
 * the skills — no AGENTS.md block and no `.codex/agents/*.toml` roles — so it
 * is safe for repos that are not Codex projects.
 *
 * @see https://agentskills.io/specification
 */

import { createAgentSkillsAdapter } from './agent-skills-base.js';

export default createAgentSkillsAdapter({
  name: 'agents',
  outputDir: '.agents/skills',
});
