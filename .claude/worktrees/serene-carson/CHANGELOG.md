# Changelog

All notable changes to Rune are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
