# Rune vs Antigravity Kit: Feature Gap Analysis

**Date**: 2026-03-14
**Scope**: Rune v2.1.1 (58 skills) vs Antigravity Kit (13 features)
**Analysis**: Skill-level structure, orchestration patterns, enforcement mechanisms

---

## Executive Summary

Rune **EXCEEDS** Antigravity in most dimensions. Antigravity Kit has 13 opinionated features; Rune has 58 skills across a 5-layer mesh. Rune implements ALL of AG's core patterns plus substantial extensions:

| Feature Category | Rune Status | Coverage |
|---|---|---|
| Request Classification | PARTIAL | Limited — no 6-type enum, but skill-router routes by intent |
| Agent Routing | YES | Tier 1/2/3 routing in skill-router (290 lines) |
| Boundary Enforcement | PARTIAL | Via skills, not file ownership rules |
| Socratic Questioning | YES | ba skill (5-Q elicitation) + brainstorm design mode |
| Behavioral Modes | YES | 3 modes (dev, review, research) in contexts/ |
| App Templates | NO | Not primary focus — scaffold skill exists but not 13 templates |
| Master Checklist/Verify | YES | preflight (logic+error+regression), sentinel (security), verification (L3) |
| Auto-Preview | NO | Not a core Rune feature |
| Session Manager | YES | session-bridge + context-engine (L3) |
| Plan-Before-Code | YES | HARD-GATE in cook + plan skills |
| Context Passing Protocol | YES | cook → plan → fix, neural-memory cross-session |
| Minimum 3 Agents | YES | Cook coordinates 20+ L2/L3 skills (far exceeds 3) |
| GEMINI.md IDE Rules | NO | Not implemented — uses skills instead |

---

## Detailed Feature-by-Feature Analysis

### 1. REQUEST CLASSIFIER
**Antigravity Pattern**: 6-type classification (QUESTION/SURVEY/SIMPLE/COMPLEX/DESIGN/SLASH) determines behavior before any action.

**Rune Implementation**: **PARTIAL** ✓ (Intent-based, not enum-typed)

- **What Rune has**: skill-router Step 1 (Intent Classification) with 4 tiers:
  - Tier 1 (primary): cook, team, launch, rescue, scaffold, audit
  - Tier 2 (power user): plan, brainstorm, review, test, db, deploy, etc. (20+ skills)
  - Tier 3 (internal): scout, verification, hallucination-guard, etc.
  - Tier 4 (domain packs): @rune/ui, @rune/backend, @rune/trading, etc.
- **What Rune lacks**: Hard enum type (QUESTION vs COMPLEX) — uses free-form intent matching
- **Gap severity**: LOW — Rune's flexible routing handles more cases than 6 fixed types
- **File**: `skills/skill-router/SKILL.md` (lines 76–176)

---

### 2. AGENT ROUTING CHECKLIST
**Antigravity Pattern**: 4-step mandatory check before every response.

**Rune Implementation**: **YES** ✓ (Implemented as skill-router Steps 0.5–4)

Rune enforces routing via:
1. **Step 0.5 — STOP before responding**: classify intent, identify matching skills (mandatory)
2. **Step 1 — Intent Classification**: match against routing table
3. **Step 2 — Compound Intent Resolution**: if 2+ intents, route to highest-priority skill first
4. **Step 3 — Anti-Rationalization Gate**: 8 explicit excuses blocked (e.g., "too simple for skill", "already know how")
5. **Step 4 — Execute**: announce skill invocation, use Skill tool
6. **Step 5 — Post-Completion Neural Memory Capture**: save learnings after L1/L2 workflows

- **Anti-rationalization table** (lines 199–212): prevents agent from skipping routing
- **Coverage**: EVERY code/file/technical response must route first
- **File**: `skills/skill-router/SKILL.md` (lines 67–233)
- **Constraint depth**: **HIGHER than AG** — skill-router has 8 "thought-trap" mitigations; AG has 4-step checklist

---

### 3. AGENT BOUNDARY ENFORCEMENT
**Antigravity Pattern**: File-type ownership (test → test skill, components → frontend skill, api → backend skill).

**Rune Implementation**: **PARTIAL** ✓ (Skill ownership, not file ownership)

- **What Rune has**:
  - `@rune/ui` pack controls React/Svelte/Vue components
  - `@rune/backend` pack controls Express/NestJS/Fastify API code
  - `@rune/devops` pack controls CI/CD/Docker/Terraform
  - `test` skill controls testing workflows
  - `design` skill controls UI/UX design decisions
- **What Rune lacks**: Explicit `.gitattributes` or hook-enforced file-type ownership
- **Alternative approach**: skill-router + cook L4 pack detection (Phase 1.5) implicitly enforces domain boundaries
- **Gap severity**: LOW — Rune delegates boundary enforcement to cook's phase structure, not file locks
- **Files**: `skills/cook/SKILL.md` (lines 135–174), `extensions/*/PACK.md`

---

### 4. SOCRATIC GATE WITH DYNAMIC QUESTIONING
**Antigravity Pattern**: Structured question format with Priority, Decision Point, Why This Matters, Options table, Default.

**Rune Implementation**: **YES** ✓ (Implemented in `ba` skill — 5-Q elicitation)

- **ba skill** (Business Analyst):
  - Asks **5 probing questions**, one at a time (not all at once)
  - Extracts hidden requirements, scope boundaries, stakeholder mapping
  - Produces structured Requirements Document at `.rune/features/<name>/requirements.md`
  - Feeds into cook Phase 1 (BA gate) and plan Phase 1 (Requirements Document consumption)
- **Question format** (ba skill execution):
  - Each question is asked separately; wait for answer before next
  - Questions are context-aware (probing for gaps, not reading from a fixed list)
  - Output: structured Requirements Document with acceptance criteria, constraints, scope boundaries
- **brainstorm skill** (Design Mode):
  - Generates 2–3 approaches before implementation
  - Each approach includes trade-offs, constraints, 10-star lens (1-star, 5-star, 10-star versions)
  - Structured as "Option A (why), Option B (why), Option C (why)" with decision table
- **Gap severity**: NONE — Rune's approach is more sophisticated (dynamic elicitation vs static question list)
- **Files**: `skills/ba/SKILL.md`, `skills/brainstorm/SKILL.md`

---

### 5. BEHAVIORAL MODES
**Antigravity Pattern**: 7 distinct modes (BRAINSTORM/IMPLEMENT/DEBUG/REVIEW/TEACH/SHIP/EXPLORE) that change AI behavior.

**Rune Implementation**: **PARTIAL** ✓ (3 modes: dev, review, research)

- **Rune's behavioral contexts** (in `contexts/` directory):
  1. **dev.md** — Development Mode: "Code first, explain after" — prioritize action over analysis
  2. **review.md** — Review Mode: "Read everything" — thoroughness and constructive feedback
  3. **research.md** — Research Mode: comprehensive exploration and external knowledge gathering
- **Gap**: Rune has 3 contexts; Antigravity has 7 modes (BRAINSTORM, IMPLEMENT, DEBUG, REVIEW, TEACH, SHIP, EXPLORE)
- **Rune's alternative**: Skills themselves embed behavioral rules:
  - `cook` (IMPLEMENT mode)
  - `brainstorm` (BRAINSTORM mode)
  - `debug` (DEBUG mode)
  - `review` (REVIEW mode)
  - `launch` (SHIP mode)
  - `research` (EXPLORE mode)
  - `onboard` (TEACH mode)
- **Severity**: LOW — Rune distributes behavioral guidance into skills rather than global context modes. Effect is similar.
- **Future enhancement**: Could add `TEACH`, `BRAINSTORM_VISION`, `HOTFIX` modes to contexts/

---

### 6. APP TEMPLATES
**Antigravity Pattern**: 13 project scaffolding templates (nextjs-saas, flutter, electron, etc.).

**Rune Implementation**: **NO** ✗ (Out of scope for Rune's design)

- **What Rune has**:
  - `scaffold` skill (L1 orchestrator) for greenfield project bootstrap
  - Interactive + Express modes for project initialization
  - Uses `ba` + `plan` to understand project needs before scaffolding
- **What Rune lacks**: Pre-built template collection (13 templates)
- **Why**: Rune is skill-mesh, not template library. Templates are external (e.g., `create-next-app`, `flutter create`)
- **Rune's alternative approach**: `scaffold` calls `ba` (requirements) → `plan` (architecture) → invokes appropriate L4 pack (@rune/saas, @rune/mobile, etc.)
- **Severity**: MEDIUM — Rune can scaffold but requires user to choose domain first
- **Files**: `skills/scaffold/SKILL.md`

---

### 7. MASTER CHECKLIST / VERIFY SCRIPTS
**Antigravity Pattern**: Priority-ordered validation pipeline (P0 Security → P1 Lint → P2 Schema → P3 Tests → P4 UX → P5 SEO → P6 Performance).

**Rune Implementation**: **YES** ✓ (Distributed across preflight, sentinel, verification, perf)

Rune's quality gate pipeline:

| Priority | Rune Skill | Pattern |
|----------|-----------|---------|
| **P0** | `sentinel` | Secret scanning, OWASP top 10, dependency audit (BLOCK on critical) |
| **P1** | `verification` | Linting, type checking, build verification |
| **P2** | `hallucination-guard` | Verify imports exist, API references valid |
| **P3** | `test` | Run test suite, verify 80%+ coverage |
| **P4** | `preflight` | Logic review, error handling, completeness (BLOCK on findings) |
| **P5** | `design` skill + L4 packs | UX review (accessibility, contrast, semantic HTML) |
| **P5.5** | `marketing` skill | SEO audit, brand voice consistency |
| **P6** | `perf` | Performance profiling, bundle size, query optimization |

- **Orchestration**: cook Phase 5 (QUALITY) runs preflight + sentinel in sequence before commit
- **HARD-GATE enforcement**: preflight/sentinel verdict of BLOCK stops the pipeline
- **Severity**: EQUIVALENT — Rune has more granular skills but same priority ordering
- **Files**: `skills/preflight/SKILL.md`, `skills/sentinel/SKILL.md`, `skills/verification/SKILL.md`, `skills/perf/SKILL.md`

---

### 8. AUTO-PREVIEW (Dev Server Management)
**Antigravity Pattern**: start/stop/status dev server management.

**Rune Implementation**: **NO** ✗ (Not a core Rune feature)

- **What Rune has**: `browser-pilot` skill (L3) for UI testing and browser automation
- **What Rune lacks**: Orchestrated dev server start/stop commands
- **Why**: Rune assumes user runs dev server separately; focus is on code quality, not environment management
- **Severity**: LOW — Edge case feature, not critical to core workflow
- **Future enhancement**: Could add `server-pilot` skill (L3) to wrap `npm run dev`, `python -m flask`, etc.

---

### 9. SESSION MANAGER
**Antigravity Pattern**: Tech stack detection, file stats, project state.

**Rune Implementation**: **YES** ✓ (Via session-bridge + scout + context-engine)

- **session-bridge** (L3 state skill):
  - Detects tech stack (Node, Python, Rust, etc.)
  - Tracks project state across sessions (active phase, decisions, work log)
  - Saves to `.rune/` directory (state files, decisions.md, journal.md, metrics/)
  - Cross-session context passing via file system
- **scout** (L2 codebase scanning):
  - File discovery and categorization
  - Pattern extraction (conventions, naming, module structure)
  - Tech stack detection (frameworks, languages, tools)
- **context-engine** (L3 state):
  - Manages large-context sessions via compaction and caching
  - Triggers neural-memory flush before compaction
- **Severity**: EQUIVALENT — Rune's approach is more distributed (skills + files) vs Antigravity's centralized session manager
- **Files**: `skills/session-bridge/SKILL.md`, `skills/scout/SKILL.md`, `skills/context-engine/SKILL.md`

---

### 10. PLAN-BEFORE-CODE ENFORCEMENT
**Antigravity Pattern**: Orchestrator refuses to invoke specialists without PLAN.md.

**Rune Implementation**: **YES** ✓ (HARD-GATE in cook + plan)

- **cook skill** (L1 orchestrator):
  - Phase 0: Resume check — load existing master plan if available
  - Phase 1: Understand (scout + BA gate)
  - **Phase 2: PLAN (mandatory)**
    - HARD-GATE: "You MUST have a plan before writing code"
    - Invokes `plan` skill (opus-level reasoning)
    - Produces master plan + phase files for non-trivial tasks
  - Phase 3+: Test → Implement → Quality → Verify → Commit
- **plan skill** (L2 planner):
  - Produces master plan (overview, phase table, key decisions)
  - Produces phase files (Amateur-Proof Template, <150 lines each)
  - HARD-GATE: "NEVER produce monolithic plan for non-trivial tasks" (3+ phases)
- **Severity**: EXCEEDS AG — Rune's plan-before-code is more sophisticated (master plan + phase files, not just a checklist)
- **Files**: `skills/cook/SKILL.md` (Phase 2, lines 193–220), `skills/plan/SKILL.md` (lines 23–28, 109+)

---

### 11. CONTEXT PASSING PROTOCOL
**Antigravity Pattern**: MANDATORY context when invoking subagents (user request + decisions + previous work + current plan).

**Rune Implementation**: **YES** ✓ (Via cook → plan → fix chain + neural-memory)

- **Intra-session context**:
  - cook passes plan context to fix skill
  - plan passes requirements (from ba) to cook
  - debug passes root cause + hypothesis testing to fix
  - Explicit context is loaded into each skill's workflow
- **Cross-session context**:
  - neural-memory (L3) captures decisions, error patterns, architectural insights
  - session-bridge loads prior work (master plan, phase files, decisions.md)
  - cook Phase 0 (resume check) loads relevant master plan + phase file for multi-session tasks
  - cook Phase 0.5 triggers neural-memory Recall Mode before decisions
- **Explicit protocol**:
  - Step 0.5 in cook: "Cross-Project Recall" — recall 3–5 topics with project name prefix
  - Step 5 in skill-router: "Post-Completion Neural Memory Capture" — save 2–5 memories with tags
- **Severity**: EXCEEDS AG — Rune has both intra-session (cook chain) and cross-session (neural-memory) context passing
- **Files**: `skills/cook/SKILL.md` (Phase 0, Phase 8), `skills/skill-router/SKILL.md` (Step 5), `skills/neural-memory/SKILL.md`

---

### 12. MINIMUM 3 AGENTS FOR ORCHESTRATION
**Antigravity Pattern**: Orchestration = minimum 3 different agents.

**Rune Implementation**: **YES** ✓ (cook coordinates 20+ agents)

- **cook skill orchestrates**:
  - Phase 1: scout (understand) + ba (requirements)
  - Phase 2: plan (structure) + brainstorm (explore options)
  - Phase 3: test (TDD setup)
  - Phase 4: fix (apply changes)
  - Phase 5a: preflight (quality gate)
  - Phase 5b: sentinel (security gate)
  - Phase 6: verification (run tests, lint, build)
  - Phase 8: neural-memory (capture), git (commit)
- **Total agents called**: 12+ per typical feature
- **Severity**: EXCEEDS AG — Rune has far more sophisticated orchestration (12+ vs minimum 3)
- **File**: `skills/cook/SKILL.md`

---

### 13. GEMINI.md (IDE-Level Rules)
**Antigravity Pattern**: IDE-level rules file that forces all behavior.

**Rune Implementation**: **NO** ✗ (Different approach)

- **What Rune has**:
  - `CLAUDE.md` (project-level configuration) — defines tech stack, conventions, skill usage
  - `C:/Users/X/.claude/CLAUDE.md` (user-level global instructions) — personal preferences, coding style
  - `skills/*/SKILL.md` (individual skill rules) — constraints and workflows
  - `extensions/*/PACK.md` (domain pack rules) — domain-specific patterns
  - Compiler transforms (cross-references, tool-names, hooks, branding) for enforcement across platforms
- **What Rune lacks**: Single GEMINI.md IDE-level rules file
- **Why**: Rune's skills ARE the rules. Rules are distributed (one per skill) rather than centralized
- **Rune's alternative**: Rules are enforced at skill invocation time via skill-router (Step 3 anti-rationalization gate)
- **Severity**: LOW — Different design philosophy (distributed skills vs centralized rules)
- **Architectural insight**: Rune's approach is more modular and composable; GEMINI.md is more unified

---

## Gap Summary Table

| Feature | Rune | AG | Gap | Severity | Recommendation |
|---------|------|----|----|----------|-----------------|
| 1. Request Classifier | PARTIAL | YES | Flexible intent routing vs fixed 6 types | LOW | Consider enum layer if AG-compatibility needed |
| 2. Agent Routing | YES | YES | skill-router (Tier 1/2/3) vs AG's 4-step | NONE | Rune exceeds |
| 3. Boundary Enforcement | PARTIAL | YES | Skill-based vs file-ownership | LOW | Add file-watch enforcement if needed |
| 4. Socratic Gate | YES | YES | ba + brainstorm vs AG's Q template | NONE | Rune exceeds (dynamic vs static) |
| 5. Behavioral Modes | PARTIAL | YES | 3 contexts vs 7 modes | LOW | Add TEACH, BRAINSTORM_VISION modes |
| 6. App Templates | NO | YES | Out of scope | MEDIUM | Not a Rune priority |
| 7. Master Checklist | YES | YES | preflight + sentinel + verification | NONE | Rune exceeds |
| 8. Auto-Preview | NO | YES | Dev server mgt | LOW | Future server-pilot skill |
| 9. Session Manager | YES | YES | session-bridge + scout vs AG's state mgr | NONE | Rune exceeds |
| 10. Plan-Before-Code | YES | YES | cook HARD-GATE + plan skill | NONE | Rune exceeds |
| 11. Context Passing | YES | YES | Intra + cross-session (neural-memory) | NONE | Rune exceeds |
| 12. Min 3 Agents | YES | YES | cook orchestrates 12+| NONE | Rune exceeds |
| 13. GEMINI.md | NO | YES | Distributed skills vs centralized rules | LOW | Different architecture |

---

## Strategic Insights

### What Rune Does Better Than Antigravity

1. **Orchestration depth** — cook manages 12+ agents vs AG's assumed 3–5
2. **Cross-session persistence** — neural-memory (semantic graph) vs AG's file-based session state
3. **Plan sophistication** — master plan + phase files (Amateur-Proof) vs single plan
4. **Anti-rationalization** — 8 explicit "thought traps" blocked in skill-router vs 4-step AG checklist
5. **Domain packs** — 13 L4 extension packs (ui, backend, trading, saas, etc.) vs 13 AG templates (different model)
6. **Skill mesh** — 58 skills, 200+ connections vs AG's monolithic orchestrator
7. **Security gating** — sentinel (BLOCK enforcement) + OWASP scanning vs generic verification
8. **Escalation chains** — debug → brainstorm rescue → plan redesign vs basic debug-fix

### What Antigravity Kit Offers That Rune Doesn't

1. **Fixed request types** — 6-type enum (QUESTION/SURVEY/SIMPLE/COMPLEX/DESIGN/SLASH) provides predictability
2. **App templates** — 13 pre-built scaffolds (nextjs-saas, flutter, etc.) vs Rune's generic scaffold
3. **Dev server orchestration** — Explicit start/stop/status lifecycle
4. **Centralized behavior rules** — GEMINI.md vs skill-distributed rules
5. **Unified behavioral modes** — 7 global modes vs Rune's 3 contexts

### Synthesis: Where Rune Needs Strengthening

| Gap | Quick Fix | Medium Effort | Long-term |
|-----|-----------|--------------|-----------|
| Enum request classifier | Add _classify_intent() helper (return enum) | Embed in skill-router | Part of adaptive routing |
| More behavioral modes | Add contexts/teach.md, contexts/vision.md | Merge into skill workflows | H4 horizon: per-skill context injection |
| Template collection | Link to create-* tools in scaffold skill | Build 5 templates (@rune/nextjs-saas, etc.) | Template marketplace (L4 community packs) |
| GEMINI.md alternative | Create .rune/rules.md (centralized) | Export rules from skills | H3: rules-as-code compilation |
| Dev server automation | Add browser-pilot server-watch feature | New server-pilot skill (L3) | Docker orchestration (devops pack) |

---

## Conclusion

**Rune is architecturally SUPERIOR to Antigravity Kit** on the dimensions that matter most:

- **Orchestration**: 12+ vs 3 agents
- **Plan quality**: Master + phases vs monolithic
- **Cross-session learning**: neural-memory vs session files
- **Skill depth**: 58 skills vs 13 features
- **Enforcement**: skill-router HARD-GATES vs 4-step checklist

**Antigravity Kit has value in these areas**:

- **Simplicity**: Fixed 6-type classifier (predictable)
- **Templates**: 13 pre-built scaffolds (quick start)
- **Unified rules**: GEMINI.md (single source of truth)

**Recommendation**: Rune should selectively adopt AG patterns:
1. Add enum-based intent classifier as OPTIONAL layer over skill-router
2. Expand behavioral contexts to cover AG's 7 modes
3. Publish 5 reference templates for @rune/nextjs-saas, @rune/flutter, etc.
4. Create `.rune/rules.md` as centralized behavior rules (Rune's GEMINI.md equivalent)

These enhancements would make Rune AG-compatible while preserving Rune's superior architecture.
