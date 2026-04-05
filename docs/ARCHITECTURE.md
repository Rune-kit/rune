# Rune Architecture

## 5-Layer Model

| Layer | Name | Count | Can Call | Called By | State |
|-------|------|-------|----------|----------|-------|
| **L0** | **Router** | **1** | **L1-L3 (routing)** | **Every message** | **Stateless (rule-based)** |
| L1 | Orchestrators | 5 | L2, L3 | L0, User | Stateful (workflow) |
| L2 | Workflow Hubs | 28 | L2 (cross-hub), L3 | L1, L2 | Stateful (task) |
| L3 | Utilities | 26 | Nothing (pure)* | L1, L2 | Stateless |
| L4 | Extension Packs | 14 free + 5 pro + 4 business | L3 | L2 (domain match) | Config-based |

### L0 — The Enforcement Layer

`skill-router` is the only L0 skill. It enforces a single discipline: **check the routing table before every response**. It doesn't do work — it ensures the right skill does the work.

- Loaded via plugin description, always active
- Routes user intent to the correct L1-L3 skill
- Prevents agents from bypassing skills ("I'll just do it manually")
- See `skills/skill-router/SKILL.md` for the full routing table and anti-rationalization gate

### L4 — Extension Packs (Activation Protocol)

L4 packs are domain-specific instruction sets stored as `extensions/*/PACK.md` files. They are activated (read) in two ways:

**1. Explicit invocation** — User runs `/rune <pack-skill>` (e.g., `/rune rag-patterns`)
   - `skill-router` detects the L4 trigger in Tier 4 routing table
   - Agent reads `extensions/<pack>/PACK.md`
   - Agent follows the matching skill's Workflow steps

**2. Implicit detection** — `cook` detects domain context in Phase 1.5
   - Scout output reveals domain signals (e.g., `three.js` in dependencies)
   - Cook matches against L4 pack mapping table
   - Agent reads matching PACK.md and applies its constraints/patterns
   - Domain patterns supplement cook's standard phases

**L4 calling rules:**
- L4 CAN call L3 utilities (scout, verification, hallucination-guard)
- L4 CANNOT call L1 or L2 skills
- L4 CANNOT call other L4 packs (no cross-pack dependencies)
- If L4 pack file not found on disk, skip silently (graceful degradation)

### Exceptions

- `team` (L1) can call other L1 orchestrators — meta-orchestration pattern.
- *L3→L3 coordination: `context-engine` → `session-bridge`, `hallucination-guard` → `research`, `session-bridge` → `integrity-check` (documented in SKILL.md).

## Mesh Protocol

### Loop Prevention

```
Rule 1: No self-calls (history[-1] !== target)
Rule 2: Max 2 visits to same skill per chain
Rule 3: Max chain depth: 8
Rule 4: If blocked → escalate to L1 orchestrator
```

### Model Auto-Selection

```
Read-only / scan?           → haiku   (cheapest)
Write / edit / generate?    → sonnet  (default)
Architecture / security?    → opus    (deep reasoning)

Override: priority=critical → always opus
Override: budget constraint → downgrade
Override: user preference   → manual in config
```

### Parallel Execution

| Context | Max Parallel | Reason |
|---------|-------------|--------|
| L3 utilities (haiku) | 5 | Cheap, fast, independent |
| L2 hubs (sonnet) | 3 | Moderate cost, may share context |
| L1 orchestrators | 1 | Only one orchestrator at a time |

### Error Handling & Resilience

| If this fails... | Try this instead... |
|-------------------|---------------------|
| debug can't find cause | problem-solver (different reasoning) |
| docs-seeker can't find | research (broader web search) |
| browser-pilot can't capture | verification (CLI checks) |
| scout can't find files | research + docs-seeker |
| test can't run (env broken) | deploy fix env → test again |
| review finds too many issues | plan re-scope → fix priorities |

## Skill Groups

### L1 Orchestrators

| Skill | Model | Role |
|-------|-------|------|
| cook | sonnet | Feature implementation orchestrator (v0.5.0 — phase-aware execution) |
| team | opus | Multi-agent parallel orchestrator |
| launch | sonnet | Deploy + marketing orchestrator |
| rescue | sonnet | Legacy refactoring orchestrator |
| scaffold | sonnet | Project bootstrap orchestrator (BA-powered, 9-phase pipeline) |

### L2 Workflow Hubs

| Group | Skills |
|-------|--------|
| CREATION | plan, scout, brainstorm, design, skill-forge, ba, mcp-builder |
| DEVELOPMENT | debug, fix, test, review, db |
| QUALITY | sentinel, preflight, onboard, audit, perf, review-intake, logic-guardian |
| DELIVERY | deploy, marketing, incident, docs |
| RESCUE | autopsy, safeguard, surgeon |

### L3 Utilities

| Group | Skills |
|-------|--------|
| KNOWLEDGE | research, docs-seeker, trend-scout |
| REASONING | problem-solver, sequential-thinking |
| VALIDATION | verification, hallucination-guard, integrity-check, completion-gate, constraint-check, sast |
| STATE | context-engine, journal, session-bridge |
| MONITORING | watchdog, scope-guard |
| MEDIA | browser-pilot, asset-creator, video-creator |
| DEPS | dependency-doctor |
| WORKSPACE | worktree |
| GIT | git |
| DOCUMENTS | doc-processor |

## Mesh Signals (v2.6.0)

Event-driven skill communication via frontmatter declarations. Skills declare what signals they `emit` and `listen` to — the compiler builds a signal graph and validates consistency.

### Frontmatter

```yaml
metadata:
  emit: code.changed, tests.passed
  listen: plan.ready, codebase.scanned
```

### Signal Naming

Lowercase, dot-separated: `<domain>.<event>` (e.g. `code.changed`, `tests.failed`, `deploy.complete`).

### Signal Catalog

| Signal | Emitters | Listeners |
|--------|----------|-----------|
| `code.changed` | fix | test, sentinel, review, preflight, verification |
| `tests.passed` | test | deploy |
| `tests.failed` | test | debug |
| `security.passed` | sentinel | deploy |
| `security.blocked` | sentinel | fix |
| `review.complete` | review | cook |
| `review.issues` | review | fix |
| `plan.ready` | plan | cook |
| `codebase.scanned` | scout | plan, brainstorm |
| `phase.complete` | cook, team | session-bridge |
| `deploy.complete` | deploy | watchdog |
| `bug.diagnosed` | debug | fix |

### Validation

- `node scripts/validate-signals.js` — checks all signals for consistency
- Every `listen` must have a matching `emit` (hard error)
- Unlistened emitters generate warnings (acceptable for external consumers)
- Signal graph compiled into `skill-index.json` under the `signals` key

### Design Principles

1. **Declarative, not runtime** — signals are metadata for discovery and validation, not a pub/sub bus
2. **Graph-based, not linear** — one signal can trigger multiple listeners in parallel (vs. before/after hooks)
3. **Layer-agnostic** — any skill at any layer can emit or listen
4. **Extensible** — extension packs can declare their own signals

## Cross-Hub Mesh (L2 ↔ L2)

```
plan ↔ brainstorm     (creative ↔ structure)
fix ↔ debug           (fix ↔ root cause)
test → debug          (unexpected failure)
review → test         (untested edge case found)
review → fix          (bug found during review)
review → review-intake (external feedback received on reviewed code)
review-intake → fix   (verified feedback → apply changes)
review-intake → test  (reviewer found untested edge case)
review-intake → sentinel (reviewer flagged security concern)
fix → test            (verify after fix)
deploy → test         (pre-deploy verification)
debug → scout         (find related code)
marketing → scout     (analyze assets)
plan → scout          (scan before planning)
fix → review          (self-review complex fix)
review → scout        (more context needed)
surgeon → safeguard   (untested module found)
preflight → sentinel  (security sub-check)
audit → sentinel      (security phase delegation)
audit → autopsy       (complexity/health phase)
audit → dependency-doctor (deps phase delegation)
audit → scout         (discovery phase)
audit → journal       (save audit report)

# perf
perf ← cook           (Phase 5 quality gate)
perf ← audit          (performance dimension delegation)
perf ← review         (performance patterns detected in diff)
perf ← deploy         (pre-deploy perf regression check)
perf → scout          (find hotpath files)
perf → browser-pilot  (Lighthouse / Core Web Vitals)
perf → verification   (run benchmark scripts if configured)

# db
db ← cook             (schema change detected in diff)
db ← deploy           (pre-deploy migration safety check)
db ← audit            (database health dimension)
db → scout            (find schema/migration files)
db → verification     (run migration in test env)
db → hallucination-guard (verify SQL syntax and ORM methods)

# incident
incident ← launch     (watchdog alerts during Phase 3 VERIFY)
incident ← deploy     (health check fails post-deploy)
incident → watchdog   (current system state — what's down)
incident → autopsy    (root cause after containment)
incident → journal    (record incident timeline)
incident → sentinel   (check for security dimension)

# design
design ← cook         (frontend task detected, no design-system.md)
design ← review       (AI anti-pattern detected in diff)
design ← perf         (Lighthouse Accessibility BLOCK)
design → scout        (detect platform, tokens, component library)
design → asset-creator (generate base visual assets from design system)

# skill-forge
skill-forge ← cook    (feature being built IS a new skill)
skill-forge ← plan    (plan identifies need for reusable skill)
skill-forge → scout   (scan existing skills for overlap)
skill-forge → plan    (structure complex multi-phase skills)
skill-forge → hallucination-guard (verify referenced skills exist)
skill-forge → verification (validate SKILL.md format)
skill-forge → journal (record skill creation ADR)

# review-intake
review-intake ← cook  (Phase 5: external review arrives)
review-intake ← review (self-review surfaces issues to address)
review-intake → scout  (verify reviewer claims against codebase)
review-intake → fix    (apply verified changes)
review-intake → test   (add tests for reviewer-found edge cases)
review-intake → hallucination-guard (verify suggested APIs exist)
review-intake → sentinel (re-check security if reviewer flagged)

# completion-gate
completion-gate ← cook    (Phase 5d: validate agent claims)
completion-gate ← team    (validate cook reports from streams)

# worktree
worktree ← team           (Phase 2: create worktrees for streams)
worktree ← cook           (optional isolation for complex features)

# sast
sast ← sentinel           (deep analysis beyond regex patterns)
sast ← audit              (security dimension in full audit)
sast ← cook               (security-sensitive code paths)
sast ← review             (security patterns detected in diff)

# constraint-check
constraint-check ← cook   (end-of-workflow discipline audit)
constraint-check ← team   (verify stream agent compliance)
constraint-check ← audit  (quality dimension assessment)

# logic-guardian
logic-guardian ← cook     (Phase 1.5: complex logic project detected)
logic-guardian ← fix      (pre-edit gate on manifested files)
logic-guardian ← surgeon  (pre-refactor on logic modules)
logic-guardian ← team     (validate logic integrity across streams)
logic-guardian ← review   (check if diff removes manifested logic)
logic-guardian → scout    (scan project for logic files)
logic-guardian → verification (run tests after logic edits)
logic-guardian → hallucination-guard (verify references after edit)
logic-guardian → journal  (record logic changes as ADRs)
logic-guardian → session-bridge (save manifest for cross-session)

# ba (Business Analyst)
ba ← cook             (Phase 1 BA gate — feature requests, integrations, greenfield)
ba ← scaffold         (Phase 1 requirement elicitation)
ba → plan             (hand-off: requirements.md → implementation planning)
ba → brainstorm       (explore approaches when requirements are ambiguous)
ba → research         (domain research for hidden requirements)

# scaffold (Project Bootstrap)
scaffold → ba         (Phase 1: requirement elicitation)
scaffold → research   (Phase 2: tech stack research)
scaffold → plan       (Phase 3: architecture planning)
scaffold → design     (Phase 4: design system generation)
scaffold → fix        (Phase 5: code generation)
scaffold → test       (Phase 6: test generation)
scaffold → docs       (Phase 7: documentation)
scaffold → git        (Phase 8: initial commit)
scaffold → verification (Phase 9: build + test verification)
scaffold → sentinel   (Phase 9: security scan)

# docs (Documentation Lifecycle)
docs ← cook           (Phase 8: auto-update docs after feature)
docs ← scaffold       (Phase 7: generate initial docs)
docs → scout          (scan codebase for doc-worthy exports)
docs → doc-processor  (generate PDF/DOCX from markdown)
docs → git            (commit doc changes)

# git (Semantic Git Operations)
git ← cook            (Phase 7: semantic commit generation)
git ← scaffold        (Phase 8: initial commit)
git ← docs            (commit doc changes)
git ← launch          (tag and release)

# mcp-builder (MCP Server Builder)
mcp-builder ← cook    (building an MCP server)
mcp-builder → scout   (scan for existing MCP patterns)
mcp-builder → test    (generate MCP server tests)
mcp-builder → docs    (generate MCP server documentation)
mcp-builder → hallucination-guard (verify SDK imports exist)

# doc-processor (Document Format Utility)
doc-processor ← docs  (PDF/DOCX generation)
doc-processor ← marketing (generate branded PDFs)
```

## Master Plan + Phase Files (Amateur-Proof Architecture)

The `plan` skill (v0.4.0) produces structured plans designed for **any model to execute with high accuracy**.

### Design Principle

> Plan for the weakest coder. If Haiku (Amateur) can execute the phase file, every model benefits.

### Structure

```
.rune/
  plan-<feature>.md          ← Master plan: overview (<80 lines)
  plan-<feature>-phase1.md   ← Phase 1: self-contained execution detail (<200 lines)
  plan-<feature>-phase2.md   ← Phase 2: self-contained execution detail
  ...
```

### Phase File Template (Amateur-Proof)

Every phase file MUST include these 7 mandatory sections:

| Section | Purpose | Why Amateur Needs It |
|---------|---------|---------------------|
| Data Flow | ASCII diagram of data movement | Prevents wrong function call order |
| Code Contracts | Function signatures, interfaces | Prevents wrong return types |
| Tasks | File paths, logic, edge cases | Prevents missed files |
| Failure Scenarios | When/Then/Error table | Prevents missing error handling |
| Rejection Criteria | Explicit DO NOTs | Prevents common anti-patterns |
| Cross-Phase Context | Imports from prior, exports for future | Prevents broken dependencies |
| Acceptance Criteria | Testable conditions | Prevents "done" without proof |

### Execution Flow

```
1. cook Phase 0: check for existing master plan → resume from current phase
2. cook Phase 2: plan produces master + phase files → user approves
3. cook Phase 3-7: load ONLY current phase file → test → implement → quality → commit
4. cook Phase 7: mark phase ✅ in master plan → announce next phase
5. Next session: Phase 0 detects master plan → loads next phase → executes
```

**One phase per session = small context = better code from any model.**

## Context Bus

Each workflow maintains a shared context managed by L1:

```
L1: full bus (complete picture)
L2: relevant subset (only what they need)
L3: minimal query (stateless, no history)
L4: domain-filtered subset
```
