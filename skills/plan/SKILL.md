---
name: plan
description: Create structured implementation plans from requirements. Produces master plan + phase files for enterprise-scale project management. Master plan = overview (<80 lines). Phase files = execution detail (<150 lines each). Each session handles 1 phase. Uses opus for deep reasoning.
metadata:
  author: runedev
  version: "1.1.0"
  layer: L2
  model: opus
  group: creation
  tools: "Read, Write, Edit, Glob, Grep"
---

# plan

## Purpose

Strategic planning engine for the Rune ecosystem. Produces a **master plan + phase files** architecture — NOT a single monolithic plan. The master plan is a concise overview (<80 lines) that references separate phase files, each containing enough detail (<150 lines) that ANY model can execute with high accuracy.

**Design principle: Plan for the weakest coder.** Phase files are designed so that even an Amateur-level model (Haiku) can execute them with minimal errors. When the plan satisfies the Amateur's needs, every model benefits — Junior (Sonnet) executes near-perfectly, Senior (Opus) executes flawlessly.

This is enterprise-grade project management: BA produces WHAT → Plan produces HOW (structured into phases) → ANY coder executes each phase with full context.

<HARD-GATE>
NEVER produce a single monolithic plan file for non-trivial tasks.
Non-trivial = 3+ phases OR 5+ files OR estimated > 100 LOC total change.
For non-trivial tasks: MUST produce master plan + separate phase files.
For trivial tasks (1-2 phases, < 5 files): inline plan is acceptable.
</HARD-GATE>

## Architecture: Master Plan + Phase Files

```
.rune/
  plan-<feature>.md          ← Master plan: phases overview, goals, status tracker (<80 lines)
  plan-<feature>-phase1.md   ← Phase 1 detail: tasks, acceptance criteria, files to touch (<150 lines)
  plan-<feature>-phase2.md   ← Phase 2 detail
  ...
```

### Why This Architecture

- **Big context = even Opus misses details and makes mistakes**
- **Small context = Sonnet handles correctly, Opus has zero mistakes**
- Phase isolation prevents cross-contamination of concerns
- Each session starts clean with only the relevant phase loaded
- Coder (Sonnet/Haiku) can execute a phase file without needing the full plan

### Size Constraints

| File | Max Lines | Content |
|------|-----------|---------|
| Master plan | 80 lines | Overview, phase table, key decisions, status |
| Phase file | 200 lines | Amateur-proof template: data flow, contracts, tasks, failures, NFRs, rejections, cross-phase |
| Total phases | Max 8 | If > 8 phases, split into sub-projects |

## Modes

### Implementation Mode (default)
Standard implementation planning — decompose task into phased steps with code details.

### Feature Spec Mode
Product-oriented planning — write a feature specification before implementation.
**Triggers:** user says "spec", "feature spec", "write spec", "PRD" — or `/rune plan spec <feature>`

### Roadmap Mode
High-level multi-feature planning — organize features into milestones.
**Triggers:** user says "roadmap", "milestone", "release plan", "what to build next" — or `/rune plan roadmap`

## Triggers

- Called by `cook` when task scope > 1 file (Implementation Mode)
- Called by `team` for high-level task decomposition
- `/rune plan <task>` — manual planning
- `/rune plan spec <feature>` — feature specification
- `/rune plan roadmap` — roadmap planning
- Auto-trigger: when user says "implement", "build", "create" with complex scope

## Calls (outbound)

- `scout` (L2): scan codebase for existing patterns, conventions, and structure
- `brainstorm` (L2): when multiple valid approaches exist
- `research` (L3): external knowledge lookup
- `sequential-thinking` (L3): complex architecture with many trade-offs
- L4 extension packs: domain-specific architecture patterns
- `neural-memory` | Before architecture decisions | Recall past decisions on similar problems

## Called By (inbound)

- `cook` (L1): Phase 2 PLAN
- `team` (L1): task decomposition into parallel workstreams
- `brainstorm` (L2): when idea needs structuring
- `rescue` (L1): plan refactoring strategy
- `ba` (L2): hand-off after requirements complete
- `scaffold` (L1): Phase 3 architecture planning
- `skill-forge` (L2): plan structure for new skill
- User: `/rune plan` direct invocation

## Data Flow

### Feeds Into →

- `cook` (L1): master plan + phase files → cook's Phase 2-4 execution roadmap
- `team` (L1): task decomposition + wave grouping → team's parallel workstream dispatch
- `fix` (L2): phase file tasks → fix's implementation targets
- `test` (L2): phase file test tasks → test's RED phase targets

### Fed By ←

- `ba` (L2): Requirements Document → plan's primary input (locked decisions, user stories)
- `scout` (L2): codebase analysis → plan's convention/pattern awareness
- `neural-memory` (external): past architectural decisions → plan's precedent context

### Feedback Loops ↻

- `plan` ↔ `brainstorm`: plan requests options when multiple approaches exist → brainstorm generates options → plan selects and structures the chosen approach
- `plan` ↔ `cook`: cook discovers plan gaps during implementation → plan updates phase files → cook resumes with corrected tasks

## Executable Steps (Implementation Mode)

### Step 1 — Gather Context

Check for `.rune/features/*/requirements.md` via `Glob`. If a Requirements Document exists (from `rune:ba`), read it — it contains user stories, acceptance criteria, scope, constraints. Do NOT re-gather what BA already elicited.

Invoke `rune:scout` if not already done — plans without context produce wrong file paths. Call `neural-memory` (Recall Mode) to surface past architecture decisions before making new ones.

### Step 2 — Classify Complexity

Determine inline plan vs master + phase files:

| Criteria | Inline Plan | Master + Phase Files |
|----------|-------------|---------------------|
| Phases | 1-2 | 3+ |
| Files touched | < 5 | 5+ |
| Estimated LOC | < 100 | 100+ |
| Cross-module | No | Yes |
| Session span | Single session | Multi-session |

If ANY "Master + Phase Files" criterion is true → produce master plan + phase files.

### Step 3 — Decompose into Phases
<MUST-READ path="references/wave-planning.md" trigger="when writing wave-structured task lists inside any phase"/>

Group work into phases. Each phase: completable in one session, clear "done when", produces testable output, independent enough to run without other phases loaded.

<HARD-GATE>
Each phase MUST be completable by ANY coder model (including Haiku) with ONLY the phase file loaded.
If the coder would need to read the master plan or other phase files to execute → the phase file is missing detail.
Phase files are SELF-CONTAINED execution instructions — designed for the weakest model to succeed.
</HARD-GATE>

Phase decomposition rules:
- **Foundation first**: types, schemas, core engine
- **Dependencies before consumers**: create what's imported before the importer
- **Test alongside**: each phase includes its own test tasks
- **Max 5-7 tasks per phase**: if more, split the phase
- **Vertical slices over horizontal layers**: prefer "auth end-to-end" over "all models → all APIs → all UI"

Tasks within each phase MUST be organized into waves (parallel-safe groupings). See `references/wave-planning.md`.

### Step 4 — Write Master Plan File
<MUST-READ path="references/plan-templates.md" trigger="when writing the master plan file"/>

Save to `.rune/plan-<feature>.md`. Use the Master Plan Template in `references/plan-templates.md`. Max 80 lines — no implementation details.

### Step 4.5 — Workflow Registry (Complex Features Only)
<MUST-READ path="references/workflow-registry.md" trigger="when feature has 4+ phases OR 3+ user-facing workflows"/>

For complex features (4+ phases OR 3+ user-facing workflows): build a 4-view Workflow Registry before writing phase files. Catches orphaned components, unphased workflows, and missing state transitions at plan time.

**Skip** for: trivial tasks, inline plans, single-workflow features.

### Step 5 — Write Phase Files
<MUST-READ path="references/plan-templates.md" trigger="when writing any phase file"/>

For each phase, save to `.rune/plan-<feature>-phase<N>.md`. Use the Amateur-Proof Template in `references/plan-templates.md`.

<HARD-GATE>
Every phase file MUST include ALL of these sections (Amateur-Proof Checklist):
1. ✅ Data Flow — ASCII diagram of how data moves
2. ✅ Code Contracts — function signatures, interfaces, types
3. ✅ Tasks — with file paths, logic description, edge cases
4. ✅ Failure Scenarios — table of when/then/error for each error case
5. ✅ Rejection Criteria — explicit "DO NOT" anti-patterns
6. ✅ Cross-Phase Context — what's assumed from prior phases, what's exported for future phases
7. ✅ Acceptance Criteria — testable, includes performance if applicable
8. ✅ Test tasks — every code task has corresponding tests
9. ✅ Traceability Matrix — every BA requirement mapped to tasks and tests (skip if no BA requirements exist)

A phase missing ANY of sections 1-7 is INCOMPLETE — the weakest coder will guess wrong.
Performance Constraints section is optional (only when NFRs apply).
</HARD-GATE>

### Step 5.5 — Completeness Scoring (Alternatives)
<MUST-READ path="references/completeness-scoring.md" trigger="when presenting alternative approaches"/>

When presenting alternatives (from brainstorm or Step 3), rate each **Completeness X/10**. Always recommend the higher-completeness option — with AI, the marginal cost of completeness is near-zero.

### Step 6 — Present and Get Approval

Present the **master plan** to user (NOT all phase files). User reviews: phase breakdown, key decisions, risks, completeness scores. Wait for explicit approval ("go", "proceed", "yes") before writing phase files.

### Step 7 — Execution Handoff

```
1. Cook loads master plan → identifies current phase (first ⬚ Pending)
2. Cook loads ONLY that phase's file
3. Coder executes tasks in the phase file
4. Mark tasks done in phase file as completed
5. When phase complete → update master plan status: ⬚ → ✅
6. Next session: load master plan → find next ⬚ phase → load phase file → execute
```

Model selection: Opus plans phases (this skill). Sonnet/Haiku executes them (cook → fix).

## Inline Plan (Trivial Tasks)

For trivial tasks (1-2 phases, < 5 files, < 100 LOC) — skip master + phase files. See inline plan template in `references/plan-templates.md`.

## Re-Planning (Dynamic Adaptation)

When cook encounters unexpected conditions during execution:

**Trigger Conditions:** Phase hits max debug-fix loops (3) | new files outside plan scope | dependency change | user requests scope change.

**Re-Plan Protocol:**
1. Read master plan + current phase file + delta context (what changed, what failed)
2. Assess impact: which remaining phases are affected?
3. Revise: mark ✅ completed phases, modify affected phase files, add new phases if scope expanded. Do NOT rewrite completed phases.
4. Present revised master plan with diff summary — get approval before resuming.

## Feature Spec Mode

**Step 1** — Problem Statement: what problem, who has it, current workaround?
**Step 2** — User Stories: primary + 2-3 secondary + edge cases. Format: `As a [persona], I want to [action] so that [benefit]`
**Step 3** — Acceptance Criteria: `GIVEN [context] WHEN [action] THEN [result]` — happy path + errors + performance
**Step 4** — Scope Definition: In scope / Out of scope / Dependencies / Open questions
**Step 5** — Write Spec File: save to `.rune/features/<feature-name>/spec.md`

After spec approved → transition to Implementation Mode.

## Roadmap Mode

**Step 1** — Inventory: scan for open issues, TODO/FIXME, planned features.
**Step 2** — Prioritize (ICE Scoring): Impact × Confidence × Ease (each 1-10), sort descending.
**Step 3** — Group into Milestones: M1 = top 3-5 by ICE, M2 = next 3-5, Backlog = remaining.
**Step 4** — Write to `.rune/roadmap.md`.

## Output Format

**Master Plan** (`.rune/plan-<feature>.md`): Overview, Phases table, Key Decisions, Decision Compliance, Architecture, Dependencies/Risks. Max 80 lines. See `references/plan-templates.md`.

**Phase File** (`.rune/plan-<feature>-phase<N>.md`): 7 mandatory sections (Amateur-Proof Template). Max 200 lines. Self-contained. See `references/plan-templates.md`.

**Inline Plan** (trivial tasks): Changes, Tests, Risks. See `references/plan-templates.md`.

## Outcome Block (Mandatory)
<MUST-READ path="references/outcome-block.md" trigger="when writing the final section of any plan output"/>

Every plan output — master plan, phase file, or inline plan — MUST end with an **Outcome Block** containing: What Was Planned + Immediate Next Action (single action, imperative) + How to Measure table (at least one shell command).

## Constraints

1. MUST produce master plan + phase files for non-trivial tasks (3+ phases OR 5+ files OR 100+ LOC)
2. MUST keep master plan under 80 lines — overview only, no implementation details
3. MUST keep each phase file under 200 lines — self-contained, Amateur-proof
4. MUST include exact file paths for every task — no vague "set up the database"
5. MUST include test tasks for every phase that produces code
6. MUST include ALL Amateur-Proof sections: data flow, code contracts, tasks, failure scenarios, rejection criteria, cross-phase context, acceptance criteria
7. MUST order phases by dependency — don't plan phase 3 before phase 1's output exists
8. MUST get user approval before writing phase files
9. Phase files MUST be self-contained — coder should NOT need master plan to execute
10. Max 8 phases per master plan — if more, split into sub-projects
11. MUST include failure scenarios table — what happens when things go wrong
12. MUST include rejection criteria — explicit "DO NOT" anti-patterns to prevent common mistakes
13. MUST include cross-phase context — what's assumed from prior phases, what's exported for future

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| Master plan | Markdown | `.rune/plan-<feature>.md` |
| Phase files | Markdown | `.rune/plan-<feature>-phase<N>.md` (one per phase) |
| Feature spec | Markdown | `.rune/features/<name>/spec.md` (Feature Spec Mode only) |
| Roadmap | Markdown | `.rune/roadmap.md` (Roadmap Mode only) |
| Inline plan | Markdown (inline) | Emitted directly for trivial tasks |

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Monolithic plan file that overflows context | CRITICAL | HARD-GATE: non-trivial tasks MUST use master + phase files |
| Phase file too vague for Amateur to execute | CRITICAL | Amateur-Proof template: ALL 7 mandatory sections required |
| Coder uses wrong approach (toFixed for money, mutation) | CRITICAL | Rejection Criteria section: explicit "DO NOT" list prevents common traps |
| Coder doesn't handle errors properly | HIGH | Failure Scenarios table: when/then/error for EVERY error case |
| Coder doesn't know what other phases expect | HIGH | Cross-Phase Context: explicit imports/exports between phases |
| Coder over-engineers or under-engineers perf | HIGH | Performance Constraints: specific metrics with thresholds |
| Master plan contains implementation detail | HIGH | Max 80 lines, overview only — detail goes in phase files |
| Phase file references other phase files | HIGH | Phase files are self-contained — cross-phase section handles this |
| Plan without scout context — invented file paths | CRITICAL | Step 1: scout first, always |
| Phase with zero test tasks | CRITICAL | HARD-GATE rejects it |
| 10+ phases overwhelming the master plan | MEDIUM | Max 8 phases — split into sub-projects if more |
| Task without File path or Verify command | HIGH | Every task MUST have File + Test + Verify + Commit fields — no vague "implement the feature" tasks |
| Horizontal layer planning (all models → all APIs → all UI) | HIGH | Vertical slices parallelize better. Use wave-based grouping: independent tasks in same wave, dependent tasks in later waves |
| Tasks without `depends_on` in Wave 2+ | MEDIUM | Implicit dependencies break parallel dispatch. Every Wave 2+ task MUST declare `depends_on` |
| Plan ignores locked Decisions from BA | CRITICAL | Decision Compliance section cross-checks requirements.md — locked decisions are non-negotiable |
| Complex feature missing Workflow Registry — components planned but never wired | HIGH | Step 4.5: 4-view registry catches orphaned components, unphased workflows, and missing state transitions before phase files are written |
| Recommending shortcut approach without Completeness Score | MEDIUM | Step 5.5: every alternative needs X/10 Completeness score + dual effort estimate (human vs AI). "Saves 70 LOC" is not a reason when AI makes the delta cost minutes |
| Plan output missing Outcome Block | MEDIUM | Every plan output MUST end with Outcome Block (What Was Planned + Immediate Next Action + How to Measure) — executor drift when omitted |
| Outcome Block "Next Action" is a list, not one action | LOW | One action only — ambiguity about where to start causes re-analysis and lost context |

## Self-Validation

```
SELF-VALIDATION (run before presenting plan to user):
- [ ] Every task has a clear file path — no "update relevant files" vagueness
- [ ] Wave dependencies are acyclic — no task depends on a task in the same or later wave
- [ ] Every code-producing phase has at least one test task
- [ ] Phase files have ALL Amateur-Proof sections (data flow, code contracts, failure scenarios, rejection criteria)
- [ ] Locked decisions from BA are reflected in plan — none contradicted or ignored
- [ ] Every BA requirement has a corresponding Req ID in at least one phase's Traceability Matrix
```

## Done When

- Complexity classified (inline vs master + phase files)
- Scout output read and conventions/patterns identified
- BA requirements consumed (if available)
- Master plan written (< 80 lines) with phase table and key decisions
- Phase files written (< 200 lines each) with ALL Amateur-Proof sections:
  - Data flow diagram, code contracts, tasks with edge cases
  - Failure scenarios table, rejection criteria (DO NOTs)
  - Cross-phase context (assumes/exports), acceptance criteria
- Every code-producing phase has test tasks
- Master plan presented to user with "Awaiting Approval"
- User has explicitly approved
- Self-Validation: all checks passed
- Outcome Block present in every plan output (master plan, phase files, inline plan)
- Outcome Block contains: What Was Planned + Immediate Next Action (single action) + How to Measure table

## Cost Profile

~3000-8000 tokens input, ~2000-5000 tokens output (master + all phase files). Opus for architectural reasoning. Most expensive L2 skill but runs infrequently. Phase files are written once, executed by cheaper models (Sonnet/Haiku).
