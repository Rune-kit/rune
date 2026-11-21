# cook — Phase 8 bridge

> Reference for `skills/cook/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Phase 8: BRIDGE

**Goal**: Save context for future sessions and record metrics for mesh analytics.

**REQUIRED SUB-SKILL**: Use `rune:session-bridge`

1. Mark Phase 8 as `in_progress`
2. Save to `.rune/decisions.md` (approach + trade-offs), `.rune/progress.md` (task complete), `.rune/conventions.md` (new patterns)
3. **Skill metrics** → `.rune/metrics/skills.json`: increment phase run/skip counts, quality gate results, debug loop counts under `cook` key
4. **Routing overrides** (H3): if Phase 4 hit max loops for an error pattern → write rule to `.rune/metrics/routing-overrides.json`. Max 10 active rules.
5. **Step 8.5 — Cross-Cutting Sweep**: After commit, check if this phase changed stats (skill count, test count, signal count, pack count, layer counts). If ANY stat changed:
   - [ ] `README.md` — stats, badges, feature list
   - [ ] `docs/index.html` (landing page) — meta tags, hero badge, install section, mesh stats, footer
   - [ ] `dashboard.html` (if local) — KPI cards, test count, skill tabs, layer counts
   - [ ] `CLAUDE.md` — commands, test count, skill list
   - [ ] `MEMORY.md` — milestones, version info

   **Skip if**: No stats changed (pure refactor, docs-only, style change). **MANDATORY** if any numeric stat in README differs from actual.
6. **Step 8.6 — Capture Learnings**: `neural-memory` (Capture Mode) — 2-5 memories: architecture decisions, patterns, error root-causes, trade-offs. Cognitive language (causal/decisional/comparative). Tags: `[project, tech, topic]`. Priority 5 routine / 7-8 decisions / 9-10 critical errors.
6. Mark Phase 8 as `completed`
