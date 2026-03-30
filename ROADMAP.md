# Rune Roadmap

> Last updated: March 2026 | Version: 2.6.0

---

## Philosophy

Rune is a **mesh**, not a plugin store. Every addition must deepen connections, not just add surface area.

These principles guide every roadmap decision:

- **Depth over breadth** — one enriched skill beats three shallow ones. Connections matter more than skill count.
- **Mesh-first** — new skills must wire into existing L1/L2 orchestrators. Isolated skills don't ship.
- **Community-driven quality** — community packs go through the same depth and connection review as core skills.
- **Platform parity** — every core feature must work across all 8 supported platforms.
- **Earn the paid tiers** — Pro/Business packs must demonstrably outperform free alternatives for their domain.

---

## Current State (v2.6.0)

| Layer | Count | Status |
|-------|-------|--------|
| L0 Router | 1 | ✅ Complete |
| L1 Orchestrators | 5 | ✅ Complete |
| L2 Workflow Hubs | 28 | ✅ Complete |
| L3 Utilities | 27 | ✅ Complete |
| L4 Free Extension Packs | 14 | ✅ Complete |
| Pro Packs (4) | 25 skills | ✅ Shipped |
| Business Packs (4) | 26 skills | ✅ Shipped |
| Tests | 566 | ✅ Passing |
| Mesh Signals | 17 | ✅ Active |
| Platforms | 8 | ✅ Active |

---

## v2.3 — "Solid Ground" · Q2 2026

**Theme:** Test coverage, health score, and Business tier depth. No new skills until the foundation earns it.

### Health & Quality
- ⬚ Skill validation tests — parse all 59 SKILL.md, assert required frontmatter fields (name, layer, model, connections)
- ⬚ E2E build pipeline tests — build each platform adapter, assert output structure matches spec
- ⬚ Pack validation tests — doctor checks for all 143 split skill files, no dangling refs
- ⬚ Coverage reporting with c8 — enforce 80%+ threshold on CI
- ⬚ Target: 200+ total tests, health score 85+/100

### Business Tier Depth
- ⬚ HR pack deepening — current depth below 700-line target; add talent-acquisition, performance-cycles, offboarding workflows
- ⬚ Enterprise-search pack deepening — add semantic search patterns, RAG pipeline integration, index management workflows
- ⬚ Cross-pack orchestration protocol — define handoff contracts between product→sales→support→data-science (v1 spec only, no new orchestrator yet)

### Infrastructure
- ⬚ LemonSqueezy integration for Pro/Business license key delivery
- ⬚ License validation in `rune init` — detect tier, unlock paid pack installation
- ⬚ CONTRIBUTING.md — community contribution guide (code style, skill template, review checklist)

---

## v2.4 — "Deeper Mesh" · Q3 2026

**Theme:** Enrichment backlog cleared, orchestration upgraded, community foundation laid.

### Enrichment Backlog (HIGH priority)
- ⬚ Wave-based parallel execution in `cook` and `plan` — `depends_on` field → wave grouping → parallel task dispatch; biggest workflow throughput win
- ⬚ Nyquist validation gate — test-as-planning-gate pattern wired into `plan` Step 1; reject plans that skip testability
- ⬚ Cross-phase integration checker — `cook` Phase 7 validates no regressions across phase boundaries before commit

### Enrichment Backlog (MEDIUM priority)
- ⬚ Self-host + SaaS toggle pattern — `scaffold` and `ba` get dual-track output: self-hosted infra vs managed SaaS path
- ⬚ Credit billing with AI cost passthrough — `saas` pack + `ba` financial modeling for per-seat vs usage billing
- ⬚ Visual brainstorming companion — `brainstorm` output can generate Mermaid diagrams (mindmap, flowchart) for spatial thinkers
- ⬚ UI design contract + 6-pillar audit — `design` skill formalizes contract with `review`; 6 pillars: layout, typography, color, motion, accessibility, content

### Community
- ⬚ Community pack submission process — GitHub issue template, review checklist, depth + mesh requirements
- ⬚ Pack marketplace page — browseable catalog on website with install commands, skill counts, platform support
- ⬚ Skill authoring tutorial — written guide + example pack walkthrough (targeting: "I want to build a pack for my domain")

### Enrichment Backlog (LOW priority)
- ⬚ CLAUDE.md template injection — `scaffold` can auto-generate project CLAUDE.md from stack answers in `ba` elicitation
- ⬚ Brownfield codebase mapper — `onboard` skill extension: reads existing repo, generates mesh-compatible context map

---

## v3.0 — "Open Ecosystem" · Q4 2026

**Theme:** Community becomes a first-class contributor. Platform reach expands. Intelligence layer gets visibility.

### Platform Expansion
- ⬚ Gemini Code Assist adapter — 9th platform; requires research into Google IDE plugin format
- ⬚ Amazon Q Developer adapter — enterprise IDE coverage
- ⬚ VS Code extension — auto-install Rune rules into any AI IDE via marketplace; reduces friction from "download + configure" to one click
- ⬚ GitHub Copilot Workspace adapter — pending API availability assessment

### Community Ecosystem
- ⬚ GitHub Discussions or Discord community — official space for pack authors, users, and contributors
- ⬚ Community pack registry — reviewed and curated third-party packs listed at rune-kit/community-packs
- ⬚ Monthly enrichment sessions — public issue where top-voted skills get deepened with community research

### Intelligence & Analytics
- ⬚ Web-based mesh analytics dashboard — replaces CLI-only `/rune metrics`; visualize skill usage heatmap, chain frequency, session counts
- ⬚ Skill usage heatmap across projects — aggregate anonymized telemetry (opt-in) to surface underused skills
- ⬚ Adaptive routing refinement — routing-overrides.json gets seeded from community usage patterns, not just local sessions
- ⬚ Cost optimization recommendations — `cook` post-session analysis: "these 3 skills ran on opus, could be sonnet — save ~40%"

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
