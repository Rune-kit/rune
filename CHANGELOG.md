# Changelog

All notable changes to Rune are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.2.6] - 2026-03-18

### Improved
- **cook v1.0.0** — Two-stage Mid-Run Signal Detection (keyword fast-path for Cancel/Pause/Status/Steer + context classification for longer messages), Hash-Based Tool Loop Detection (3x warn, 5x force stop, content-aware stuck detection)
- **debug v0.6.0** — Hash-Based Evidence Loop Detection (re-read/re-test/re-grep detection), hypothesis category diversity rule (Data/Control Flow/Environment/State must rotate across cycles)

### Sources
- nextlevelbuilder/goclaw (832★) — two-stage intent classification, SHA256-based loop detection

## [2.2.5] - 2026-03-18

### Improved
- **ba v0.3.0** — Structured Elicitation Frameworks (PICO, INVEST, Jobs-to-be-Done) with decision table for framework selection per requirement type
- **research v0.3.0** — Minimum 3 Complementary Sources HARD-GATE, source type taxonomy, domain diversity rule, triangulation-based synthesis
- **completion-gate v1.4.0** — Default-FAIL QA mindset HARD-GATE, adversarial validation checklist, skeptic sweep on weakest claims

### Sources
- K-Dense claude-scientific-skills (170 skills, literature-review PICO pattern)
- msitarzewski/agency-agents (50.8k★, Default-FAIL QA mindset)

## [2.2.4] - 2026-03-17

### Improved
- **plan v0.6.0** — Workflow Registry 4-view (by Workflow, Component, User Journey, State)
- **team v0.5.0** — NEXUS Handoff Templates with metadata/context/deliverables/quality/evidence
- **cook v0.9.0** — NEXUS-enhanced Cook Report with Deliverables table + Acceptance Criteria tracking

### Sources
- msitarzewski/agency-agents (50.8k★)

## [2.2.3] - 2026-03-15

### Improved
- **7 core skills enriched** from CLI-Anything (17.4k★), GSD (30.8k★), taste-skill (3.4k★)
- test v0.5.0, verification v0.5.0, cook v0.8.0, plan v0.5.0, hallucination-guard v0.3.0, sentinel-env v0.2.0, completion-gate v1.3.0

## [2.2.2] - 2026-03-14

### Improved
- **4 core skills enriched** from superpowers (89k★)
- review v0.3.0, review-intake v1.1.0, skill-forge v1.2.0, completion-gate v1.2.0

## [2.2.1] - 2026-03-14

### Added
- **Enforcement Upgrade** — Antigravity-level IDE compliance across all platforms
  - skill-router v1.2.0: 5-type Request Classifier (CODE_CHANGE|QUESTION|DEBUG|REVIEW|EXPLORE), File Ownership Matrix, Self-Verification HARD-GATE, Routing Proof line
  - brainstorm v0.4.0: Problem Restatement requirement, Dynamic Questioning (P0/P1/P2)
  - cook v0.6.0: Clarification Gate (2-question minimum), Phase Transition Protocol
  - `compiler/transforms/compliance.js`: distributes enforcement preamble to all non-Claude platform builds
- **L4 Pack Enrichment** — all 13 free packs now rated Deep (500+ lines)
  - @rune/ecommerce 675→1212: multi-currency, fraud detection, checkout optimization, search/filtering, webhooks
  - @rune/content 382→1567: search integration, newsletter, scheduling, accessibility, rich media, analytics
  - @rune/gamedev 393→1513: multiplayer/networking, audio, input, ECS, particles, camera, scene management
- Antigravity Kit gap analysis documentation

### Changed
- Compiler pipeline: 7→8 stages (added compliance transform after subagents, before hooks)
- Free pack total lines: 8,253→11,096
- Grand total across 19 packs: 14,170→17,013

## [2.2.0] - 2026-03-09

### Added
- **OpenCode adapter** — 8th supported platform
- **Skills catalog page** — browsable skill listing
- Guides and documentation updates

## [2.1.1] - 2026-03-12

### Added
- **tools: field** on all 55 skills — permission scope per skill
- **@rune-pro/sales** pack (6 skills, private repo)
- **@rune-pro/data-science** pack (7 skills, 1356 lines)
- **@rune-pro/support** pack (6 skills, 802 lines)
- **@rune/chrome-ext** pack (6 skills, 995 lines, FREE)

### Changed
- L4 Tier 1 packs enriched: ui 225→947, security 216→536, backend 257→678, saas 276→805
- Pricing model: subscription → lifetime ($49 Pro, $149 Business)
- Pro packs moved to private repo (rune-kit/rune-pro)

## [2.1.0] - 2026-03-11

### Added
- **6 new skills** (55→58 after adversary + sentinel-env later): ba, scaffold, docs, git, mcp-builder, doc-processor
- **cook v0.5.0**: Phase-aware execution, phase-file resume, master plan tracking
- **plan v0.4.0**: Amateur-Proof Template with master plan + phase files
- **@rune-pro/product** pack (6 skills, 1253 lines)
- **@rune/trading**: experiment-loop skill

### Changed
- Skill count: 49→55 (L1: 4→5, L2: 23→26, L3: 21→23)
- Mesh connections: 170+→200+

## [2.0.0] - 2026-03-08

### Added
- **Multi-platform compiler** — 3-stage pipeline (Parse → Transform → Emit)
- 6 compiler transforms: cross-refs, tool-names, frontmatter, subagents, hooks, branding
- 5 platform adapters: claude, cursor, windsurf, antigravity, generic
- CLI: `npx @rune-kit/rune init|build|doctor`
- All 49 skills compile to ALL platforms with zero knowledge loss

### Changed
- Architecture: from Claude-Code-only to multi-platform mesh

## [1.5.1] - 2025-03-05

### Added
- **Agent Skills standard compliance** — adopted frontmatter fields from Anthropic's official skills spec.
- `context: fork` on all L1 orchestrators (cook, team, launch, rescue) — run in isolated subagent context.
- `disable-model-invocation: true` on side-effect skills (launch, deploy, incident) — prevents Claude from auto-triggering deployments or incident responses.
- `user-invocable: false` on internal L3 utilities (completion-gate, constraint-check, integrity-check, context-engine, scope-guard, worktree, skill-router) — Claude-only background skills.
- Dynamic context injection (`!`command``) on skill-router — injects live routing overrides and skill metrics before Claude reads the routing table.
- Pushy descriptions on all L1 orchestrators — prevents undertriggering per Anthropic's best practice.
- Explicit `skills[]` array in marketplace.json listing all 49 skill paths.

## [1.5.0] - 2025-03-05

### Added
- **logic-guardian** (L2, Quality group) — protects complex business logic from accidental AI deletion/overwrite. Maintains `.rune/logic-manifest.json`, enforces pre-edit gates, validates post-edit diffs.
- **trade-logic** skill in `@rune/trading` extension — trading-specific logic preservation: entry/exit specs, indicator parameter registry, production-backtest sync, state machine documentation, backtest result linkage.
- **docs/TRADE-MATRIX.md** — complete NxN skill-to-skill delegation matrix (4 matrices: L1->L2, L2<->L2, L1/L2->L3, L3->L3 exceptions).
- Plugin instruction feed for proactive skill usage across all projects.
- Session-start hook loads `logic-manifest.json` when present.
- CHANGELOG.md (this file).

### Changed
- Skill count: 48 -> 49 (L2 hubs: 22 -> 23).
- Mesh connections: 160+ -> 170+.
- Updated skill-router routing table with logic-guardian entry.
- Updated ARCHITECTURE.md, README.md, marketplace.json with new counts.

## [1.4.0] - 2025-03-03

### Added
- Behavioral contexts (dev, research, review modes) injected via `.rune/active-context.md`.
- Pre-compact hook preserves critical context before auto-compaction.
- Enhanced cook with L4 extension pack detection (Phase 1.5).
- Enhanced launch with artifact dependency scanning.
- Cross-IDE analysis documentation.

## [1.3.0] - 2025-02-28

### Added
- H3 Intelligence: mesh analytics, adaptive routing, community packs.
- metrics-collector hook captures skill invocations to tmpdir JSONL.
- context-watch extended with tool counters and session timestamp.
- post-session-reflect flushes metrics to `.rune/metrics/`.
- audit Phase 8: Mesh Analytics (`/rune metrics`).
- skill-router Step 0: adaptive routing via `routing-overrides.json`.
- cook Phase 8: skill-sourced metrics and auto routing overrides.
- `/rune pack` commands for community L4 packs.
- `docs/COMMUNITY-PACKS.md` guide.

## [1.2.0] - 2025-02-27

### Added
- Wave 2: SAST skill, constraint-check skill.
- Pre-tool-guard hook, secrets-scan hook.
- Updated plugin manifest with hook definitions.

## [1.1.0] - 2025-02-26

### Added
- Option A lean upgrade: 10 patches across existing skills, 2 new skills, 1 hook.
- skill-forge and review-intake skills.

## [1.0.0] - 2025-02-25

### Added
- Initial release: 44 core skills across 5-layer mesh architecture.
- L0 Router (skill-router), L1 Orchestrators (cook, team, launch, rescue).
- L2 Workflow Hubs and L3 Utilities.
- 12 L4 Extension Packs.
- Cross-session persistence via `.rune/` directory.
