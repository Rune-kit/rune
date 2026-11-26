/**
 * Canonical authoring tiers and per-provider translations.
 *
 * Skill / agent frontmatter uses Anthropic-native aliases
 * (`haiku` | `sonnet` | `opus` | `fable`) as the authoring vocabulary.
 * Adapters translate the hint for the target runtime. Unknown values pass
 * through unchanged (forward-compatible). Skills without `model:` emit nothing.
 *
 * Verified 2026-11-26 against:
 *   - platform.claude.com/docs/en/models/overview (Fable 5.2, Opus 5.5, Sonnet 5.5, Haiku 5.5)
 *   - code.claude.com/docs/en/sub-agents (`model: fable|opus|sonnet|haiku|inherit`)
 *   - developers.openai.com / learn.chatgpt.com Codex models (gpt-6.2-astra / gpt-6.2-sol / gpt-6-luna)
 *   - antigravity.google/docs/models (Gemini 4 Neon / Carbon / Hydrogen; 3.8 Flash leaves 2026-11-30)
 *   - Gemini CLI 0.70.0 packages/core/src/config/models.ts + live `gemini models`
 *   - docs.x.ai Grok 4.7 (`grok-4.7`); unauthenticated `grok models` on 1.0.92 still listed 4.6/4.5
 *
 * Tier semantics (cheap/fast → deep reasoning):
 *   haiku  — high-volume, latency-sensitive, narrowly scoped work
 *   sonnet — everyday implementation, review, edit
 *   opus   — default heavy tier: long-running agentic coding / planning / security
 *   fable  — frontier: demanding long-horizon reasoning, only when Opus at higher
 *            effort still falls short (about 2× Opus). Not the default for "hard".
 *
 * Rune does not mass-promote opus skills to fable. Claude's own guidance is to
 * start on Opus 5.5 and step up only when needed.
 */

export const AUTHORING_TIERS = Object.freeze(['haiku', 'sonnet', 'opus', 'fable']);

/** Provider-agnostic semantic hints (opencode, openclaw, generic, qoder, aider, copilot, default). */
export const SEMANTIC_TIER = Object.freeze({
  fable: 'tier:frontier',
  opus: 'tier:heavy',
  sonnet: 'tier:mid',
  haiku: 'tier:light',
});

/** Codex / OpenAI model ids used in `.codex/agents/*.toml` roles and AGENTS.md. */
export const CODEX_MODEL = Object.freeze({
  fable: 'gpt-6.2-astra',
  opus: 'gpt-6.2-astra',
  sonnet: 'gpt-6.2-sol',
  haiku: 'gpt-6-luna',
});

/**
 * Suggested `model_reasoning_effort` for Codex roles.
 * Luna's official starting point is `high`. Astra accepts low|medium|high|xhigh|max;
 * fable uses `xhigh` as a step up from opus (`high`) without requiring `max`.
 */
export const CODEX_EFFORT = Object.freeze({
  fable: 'xhigh',
  opus: 'high',
  sonnet: 'medium',
  haiku: 'high',
});

/**
 * Antigravity body hints (SKILL.md has no `model` field).
 * After 2026-11-30, Gemini 3.8 Flash / 4 Argon / Claude 4.6 leave the catalog.
 * Gemini 4 Hydrogen is the only Gemini model on every plan, so haiku maps to
 * Hydrogen (Low) rather than the retiring Flash id.
 */
export const ANTIGRAVITY_HINT = Object.freeze({
  fable: 'Gemini 4 Neon (Extra) or Orchestrator (Neon) — long-horizon / maximum reasoning',
  opus: 'Gemini 4 Neon (High) or Orchestrator — planner-grade reasoning',
  sonnet: 'Gemini 4 Hydrogen — the default executor model',
  haiku: 'Gemini 4 Hydrogen (Low) — fast, available on every plan',
});

/**
 * Gemini CLI (enterprise / Gemini Code Assist) hints — Gemini 4 is Antigravity-only.
 *
 * 0.70.0 source catalog (packages/core/src/config/models.ts):
 *   stable GA flash = gemini-3.5-flash, stable GA lite = gemini-3.1-flash-lite
 *   latest flash / lite (gemini-3.8-flash, gemini-3.5-flash-lite) are experiment-gated
 *   top pro preview = gemini-3.1-pro-preview; default pro = gemini-2.5-pro
 *
 * Live `gemini models` on an unauthenticated 0.70.0 CLI (2026-11-26) listed
 * gemini-2.5-pro, gemini-3.5-flash, gemini-3.1-flash-lite — not the experiment-gated
 * latest ids previously hinted. Hints now follow the stable GA ids, with a
 * preview fallback called out on the heavy tiers.
 */
export const GEMINI_CLI_HINT = Object.freeze({
  fable: 'gemini-3.1-pro-preview (or gemini-2.5-pro if preview is not listed)',
  opus: 'gemini-3.1-pro-preview (or gemini-2.5-pro if preview is not listed)',
  sonnet: 'gemini-3.5-flash',
  haiku: 'gemini-3.1-flash-lite',
});

/** Qwen Code size hints. Provider ids still pending live verification. */
export const QWEN_HINT = Object.freeze({
  fable: 'qwen3-coder-plus',
  opus: 'qwen3-coder-plus',
  sonnet: 'qwen3-coder',
  haiku: 'qwen3-coder-flash',
});

/**
 * Grok Build skill `model` is accepted but not applied (docs.x.ai skills page).
 * Hints name the current flagship and an effort level. Do not pin a concrete
 * id in SKILL.md frontmatter — accounts differ (unauthenticated 1.0.92 listed
 * grok-4.6 / grok-4.5; official docs list grok-4.7).
 */
export const GROK_HINT = Object.freeze({
  fable: 'grok-4.7 · reasoning effort xhigh (or the latest grok-4.x your account lists)',
  opus: 'grok-4.7 · reasoning effort high (or the latest grok-4.x your account lists)',
  sonnet: 'grok-4.7 · reasoning effort medium (or the latest grok-4.x your account lists)',
  haiku: 'grok-4.7 · reasoning effort low (or the latest grok-4.x your account lists)',
});

/**
 * @param {Record<string, string>} map
 * @param {string | undefined | null} model
 * @returns {string | null} translated hint, the raw value for unknown tiers, or null if omitted
 */
export function translateTier(map, model) {
  if (!model) return null;
  return Object.hasOwn(map, model) ? map[model] : model;
}
