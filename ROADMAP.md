# Rune Roadmap

> Last updated: November 2026 | Version: 2.34.1

---

## Philosophy

Rune is a **mesh**, not a plugin store. Every addition must deepen connections, not just add surface area.

- **Depth over breadth** — one enriched skill beats three shallow ones. Connections matter more than skill count.
- **Mesh-first** — new skills must wire into existing L1/L2 orchestrators. Isolated skills don't ship.
- **Meet developers where they work** — every core skill ships to every supported runtime, natively where the runtime allows.
- **Community-driven quality** — community packs go through the same depth and connection review as core skills.
- **Earn the paid tiers** — Pro/Business packs must demonstrably outperform free alternatives for their domain.

---

## Current State (v2.34.1 — "Serve")

| Area | Count | Status |
|-------|-------|--------|
| L0 Router | 1 | ✅ |
| L1 Orchestrators | 5 | ✅ |
| L2 Workflow Hubs | 30 | ✅ |
| L3 Utilities | 31 | ✅ |
| L4 Free Extension Packs | 14 | ✅ |
| Pro Packs | 9 | ✅ Shipped — $49 lifetime |
| Business Packs | 4 (+ 4 cross-department orchestrators) | ✅ Shipped — $149 lifetime |
| Mesh | 248 connections · 46 signals | ✅ Enforced by `rune doctor` + `validate-signals` |
| Tests | 1,680+ | ✅ CI (lint + tests + doctor + version/number sync) |
| Compiler targets | 16 | ✅ claude, codex, cursor, windsurf, antigravity, opencode, openclaw, generic, aider, copilot, gemini, qoder, qwen, grok, cline, agents |
| Native plugins | Claude Code · Codex · Cursor · Grok Build · Gemini CLI · Agent Plugins 1.0 | ✅ Manifests in repo; marketplace listings in progress |
| Runtime hooks | Claude Code + Codex + Grok Build + Cursor + Gemini CLI (native) · Windsurf / Antigravity (rules) | ✅ |
| Payments | Polar (card / PayPal) · SePay (VN bank transfer) | ✅ Live on the landing page |

---

## Shipped (v2.3 – v2.32, May → Aug 2026)

The old "Solid Ground" and "Deeper Mesh" milestones are closed. Highlights:

- ✅ Skill validation, E2E build-pipeline and pack validation tests; c8 coverage; CI on every push
- ✅ `CONTRIBUTING.md`, skill template, extension template, community-pack doc
- ✅ Payments on **Polar + SePay** (replaced the LemonSqueezy plan) with GitHub-username delivery for Pro/Business repos
- ✅ `rune setup` wizard, `rune update`, tier stacking (`--tier pro,business`), hook drift reporter
- ✅ Codex as a first-class native runtime (plugin, synchronous hooks, `.codex/agents` roles)
- ✅ Agent Skills migration for all directory-per-skill adapters (v2.23)
- ✅ Spec discipline + convergence gates (`ba`, `converge`, Level 3.5 verification), `council`, `diagram`
- ✅ Visual brainstorming via `diagram` (Mermaid import → editorial HTML/SVG)

Full detail: [`CHANGELOG.md`](CHANGELOG.md).

---

## v2.34 — "Serve" · November 2026 (this release)

**Theme:** Install Rune once, use it from every agent on every machine — and stop agents quietly hollowing out tests.

- ✅ `rune serve` — Rune as an MCP server (Streamable HTTP or `--stdio`); Free + Pro/Business skills; locked down by default (localhost, hashed bearer key, path confinement)
- ✅ `rune serve setup` — wizard or `--yes --json` for agents; tunnel / domain / Tailscale / local expose; `status`, `doctor`, `connect`, `start`, `stop`; agent runbook in `deploy/references/rune-serve.md`; docs and site section with diagrams
- ✅ Test-integrity gate — `rune verify --integrity` plus hook-dispatch preflight (Edit/Write of test files) and sentinel (`git commit`); frozen `tests/char/**` and `tests/holdout/**`; auditable override
- ✅ Pro Context Intelligence hooks install natively on Cursor, Grok Build, Antigravity and Gemini CLI
- ✅ 2026 model-tier refresh — `fable`/`opus`/`sonnet`/`haiku`; stable-GA Gemini CLI hints; Antigravity haiku → Gemini 4 Hydrogen (Low); Codex `rune_frontier`; Grok 4.7 + effort

Full detail: [`CHANGELOG.md`](CHANGELOG.md#2340---2026-11-26).

---

## v2.33 — "Everywhere" · Q4 2026

**Theme:** Rune installs natively in every major agent, and the Free → Pro path stops leaking.

### Platform reach
- ✅ Agent Plugins 1.0 root `plugin.json` (skills; no MCP server shipped)
- ✅ Cursor plugin manifest (`.cursor-plugin/plugin.json`)
- ✅ Gemini CLI extension (`gemini-extension.json`)
- ✅ Grok Build: `grok` compiler target (`.grok/skills`) + `.grok-plugin/marketplace.json` (Grok also loads the Claude plugin and hooks)
- ✅ `cline` (`.cline/skills`) and universal `agents` (`.agents/skills` — Kiro, Amp, Goose, Factory, Junie, Trae …) targets
- ✅ `npx skills add rune-kit/rune` documented (skills.sh)
- ✅ Claude marketplace ids fixed (`@rune/<pack>` → `rune-<pack>`) — `claude plugin validate` passes
- ⬚ Marketplace submissions: Cursor Marketplace, Anthropic community marketplace, xAI plugin marketplace, Gemini extension gallery (topic `gemini-cli-extension`)
- ⬚ Awesome-list PRs (awesome-claude-code, awesome-claude-skills ×2, awesome-agent-skills)

### Free → Pro
- ✅ README buy links go to the public pricing page (were 404s to private repos)
- ✅ One-line, opt-out Pro hint when the Free context counter reaches RED (`RUNE_PRO_HINT=0` disables)
- ⬚ 60-second demo GIF (with vs without Rune) at the top of the README
- ⬚ Re-run the benchmark on Codex, Cursor and Grok Build; publish per-platform numbers

### Quality
- ✅ Drift scanner in `version-sync-check` — stale skill/signal/connection/platform counts fail CI
- ✅ `AGENTS.md` + `llms.txt`
- ✅ `rune doctor` works on directory-per-skill output (was crashing with EISDIR)
- ✅ Every platform ships `references/` (single-file targets and packs included); cross-skill reference links resolve after compile
- ✅ The 13 largest SKILL.md files split into SKILL.md + `references/` in two passes (every skill ≤ 500 lines; nothing dropped, guarded by a test)
- ✅ Look-alike skills sharpened instead of merged (research / docs-seeker / trend-scout, problem-solver / sequential-thinking, hallucination-guard / completion-gate / constraint-check)
- ✅ Codex roles on GPT-6.x (gpt-6.2-astra / gpt-6.2-sol / gpt-6-luna); Antigravity no longer gets an invented `model` field
- ✅ Platform-neutral worktree path (`.claude/worktrees/` for Claude Code, `.rune/worktrees/` elsewhere)
- ✅ `onboard --runtimes`: one canonical `AGENTS.md`, per-runtime pointers and hooks; native Grok hooks (`rune hooks install --platform grok`)
- ✅ Native Cursor hooks (`.cursor/hooks.json`) and Gemini CLI hooks (`.gemini/settings.json`) via `rune hooks install --platform cursor|gemini`

---

## Next — v2.35+ · Q1 2027

### Hooks everywhere
- ⬚ Gemini extension: ship Gemini-format lifecycle hooks and move the Claude ones out of `hooks/hooks.json`, so Gemini stops logging skipped events
- ✅ Pro/Business tier hook entries on Cursor, Grok Build, Antigravity and Gemini CLI (shipped in v2.34)
- ⬚ Copilot and Kiro hook adapters
- ⬚ CI job that installs Rune into each runtime that has a headless validator (`claude plugin validate`, `gemini extensions validate`, `grok plugin validate`)

### Reach
- ✅ `rune serve` MCP server — expose skills to any MCP client (shipped in v2.34; claude.ai / ChatGPT connectors still open)
- ⬚ Standalone "starter" skills on skills.sh (cook, sentinel, rescue) that lead to the full mesh
- ⬚ Pro on every native runtime (Cursor, Grok Build, Gemini), not just Claude Code and Codex

### Community
- ⬚ GitHub Discussions + Discord; `good first issue` labels
- ⬚ Community pack registry (rune-kit/community-packs) with the same depth review as core
- ⬚ Skill authoring tutorial (build a pack for your domain)

### Intelligence
- ⬚ Web mesh-analytics dashboard (skill heatmap, chain frequency) — opt-in telemetry only
- ⬚ Cost recommendations after `cook` ("these 3 skills ran on the heavy tier, could be mid")

---

## Not on the Roadmap

These ideas have been evaluated and deliberately excluded:

| Idea | Reason |
|------|--------|
| GUI skill editor | Adds complexity; SKILL.md + text editor is sufficient and portable |
| Skill versioning/rollback | Git handles this; in-tool versioning is over-engineering |
| Hosted cloud execution | Rune runs in the IDE; server-side execution changes the security model |
| Skill marketplace monetization (paid individual skills) | Contradicts MIT philosophy; paid value lives in domain packs, not individual skills |

---

## How to Contribute

All roadmap items are tracked as GitHub issues on [rune-kit/rune](https://github.com/rune-kit/rune/issues).

- **Bug reports** — open an issue with the `bug` label
- **Feature requests** — open an issue with `enhancement`; reference the roadmap milestone if applicable
- **Community packs** — once v2.4 ships the submission process, use the `community-pack` issue template
- **Enrichment contributions** — PRs that deepen existing skills (add workflows, fix gaps) are always welcome; check `docs/SKILL-TEMPLATE.md` for the format

> Rune grows by deepening what exists, not by accumulating what doesn't. The best contribution is making one skill significantly better, not adding a new one.
