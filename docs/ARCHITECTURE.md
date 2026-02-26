# Rune Architecture

## 5-Layer Model

| Layer | Name | Count | Can Call | Called By | State |
|-------|------|-------|----------|----------|-------|
| **L0** | **Router** | **1** | **L1-L3 (routing)** | **Every message** | **Stateless (rule-based)** |
| L1 | Orchestrators | 4 | L2, L3 | L0, User | Stateful (workflow) |
| L2 | Workflow Hubs | 22 | L2 (cross-hub), L3 | L1, L2 | Stateful (task) |
| L3 | Utilities | 21 | Nothing (pure)* | L1, L2 | Stateless |
| L4 | Extension Packs | 12 | L3 | L2 (domain match) | Config-based |

### L0 — The Enforcement Layer

`skill-router` is the only L0 skill. It enforces a single discipline: **check the routing table before every response**. It doesn't do work — it ensures the right skill does the work.

- Loaded via plugin description, always active
- Routes user intent to the correct L1-L3 skill
- Prevents agents from bypassing skills ("I'll just do it manually")
- See `skills/skill-router/SKILL.md` for the full routing table and anti-rationalization gate

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
| cook | sonnet | Feature implementation orchestrator |
| team | opus | Multi-agent parallel orchestrator |
| launch | sonnet | Deploy + marketing orchestrator |
| rescue | sonnet | Legacy refactoring orchestrator |

### L2 Workflow Hubs

| Group | Skills |
|-------|--------|
| CREATION | plan, scout, brainstorm, design, skill-forge |
| DEVELOPMENT | debug, fix, test, review, db |
| QUALITY | sentinel, preflight, onboard, audit, perf, review-intake |
| DELIVERY | deploy, marketing, incident |
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
```

## Context Bus

Each workflow maintains a shared context managed by L1:

```
L1: full bus (complete picture)
L2: relevant subset (only what they need)
L3: minimal query (stateless, no history)
L4: domain-filtered subset
```
