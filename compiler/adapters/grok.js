/**
 * Grok Build Adapter (xAI) — v2.33+
 *
 * Emits Agent Skills into `.grok/skills/rune-<name>/SKILL.md`. Grok Build
 * discovers project skills from `./.grok/skills/` (walked up to the repo
 * root), lazy-loads them by `description`, and exposes each as a slash
 * command (`/rune-cook`). Extra frontmatter keys are ignored, so the standard
 * `name` + `description` pair is all Grok needs.
 *
 * Grok also reads Claude Code plugins/marketplaces natively, so the Rune
 * plugin (skills + hooks) installs with `grok plugin install rune-kit/rune
 * --trust` — this adapter is for projects that want compiled, vendored
 * skills instead (CI images, monorepos, air-gapped machines).
 *
 * @see https://docs.x.ai/build/features/skills-plugins-marketplaces
 * @see https://github.com/xai-org/grok-build (docs/user-guide/08-skills.md)
 *
 * MODEL TIER MAPPING: Grok accepts but does not apply a per-skill `model`
 * key, so the tier travels as a provider-agnostic `# model-hint` comment.
 */

import { createAgentSkillsAdapter } from './agent-skills-base.js';

export default createAgentSkillsAdapter({
  name: 'grok',
  outputDir: '.grok/skills',
});
