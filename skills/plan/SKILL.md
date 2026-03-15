---
name: plan
description: Create structured implementation plans from requirements. Produces master plan + phase files for enterprise-scale project management. Master plan = overview (<80 lines). Phase files = execution detail (<150 lines each). Each session handles 1 phase. Uses opus for deep reasoning.
metadata:
  author: runedev
  version: "0.4.0"
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

**Triggers:**
- User says "spec", "feature spec", "write spec", "PRD"
- `/rune plan spec <feature>`

### Roadmap Mode
High-level multi-feature planning — organize features into milestones.

**Triggers:**
- User says "roadmap", "milestone", "release plan", "what to build next"
- `/rune plan roadmap`

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

## Cross-Hub Connections

- `plan` ↔ `brainstorm` — bidirectional: plan asks brainstorm for options, brainstorm asks plan for structure
- `ba` → `plan` — BA produces Requirements Document, plan consumes it as primary input

## Executable Steps (Implementation Mode)

### Step 1 — Gather Context

**Check for Requirements Document first**: Use `Glob` to check for `.rune/features/*/requirements.md`. If a Requirements Document exists (produced by `rune:ba`), read it and use it as the primary input — it contains user stories, acceptance criteria, scope, and constraints. Do NOT re-gather requirements that BA already elicited.

Use findings from `rune:scout` if already available. If not, invoke `rune:scout` with the project root to scan directory structure, detect framework, identify key files, and extract existing patterns. Do NOT skip this step — plans without context produce wrong file paths.

Call `neural-memory` (Recall Mode) to check for past architecture decisions on similar problems before making new ones.

### Step 2 — Classify Complexity

Determine if the task needs master plan + phase files or inline plan:

| Criteria | Inline Plan | Master + Phase Files |
|----------|-------------|---------------------|
| Phases | 1-2 | 3+ |
| Files touched | < 5 | 5+ |
| Estimated LOC | < 100 | 100+ |
| Cross-module | No | Yes |
| Session span | Single session | Multi-session |

If ANY "Master + Phase Files" criterion is true → produce master plan + phase files.

### Step 3 — Decompose into Phases

Group related work into phases. Each phase is a coherent unit that:
- Can be completed in one session
- Has a clear "done when" condition
- Produces testable output
- Is independent enough to execute without other phases loaded

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

### Step 4 — Write Master Plan File

Save to `.rune/plan-<feature>.md`:

```markdown
# Feature: <name>

## Overview
<1-3 sentences: what and why>

## Phases
| # | Name | Status | Plan File | Summary |
|---|------|--------|-----------|---------|
| 1 | Foundation | ⬚ Pending | plan-X-phase1.md | Types, core engine, basic UI |
| 2 | Interaction | ⬚ Pending | plan-X-phase2.md | Dialogue, combat, items |
| 3 | Polish | ⬚ Pending | plan-X-phase3.md | Effects, sounds, game over |

## Key Decisions
- <decision 1 — chosen approach and why>
- <decision 2>

## Architecture
<brief system diagram or component list — NOT implementation detail>

## Dependencies
- <external dep>: <status>

## Risks
- <risk>: <mitigation>
```

**Max 80 lines.** No implementation details — that's what phase files are for.

### Step 5 — Write Phase Files

For each phase, save to `.rune/plan-<feature>-phase<N>.md`.

Phase files follow the **Amateur-Proof Template** — designed so that even the weakest model can execute without guessing. Every section exists because an Amateur said "I need this to code correctly."

```markdown
# Phase N: <name>

## Goal
<What this phase delivers — 1-2 sentences>

## Data Flow
<5-line ASCII diagram showing how data moves through this phase's components>
```
User Input → validateInput() → calculateProfit() → formatResult() → API Response
                                      ↓
                                 TradeEntry[]
```

## Code Contracts
<Function signatures, interfaces, schemas that this phase MUST implement>
<This is the MOST IMPORTANT section — coder implements these contracts>

```typescript
interface TradeEntry {
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
}

interface ProfitResult {
  netPnL: number;
  totalFees: number;
  winRate: number;
}

function calculateProfit(entries: TradeEntry[]): ProfitResult;
function validateInput(raw: unknown): TradeEntry[];  // throws ValidationError
```

## Tasks
- [ ] Task 1 — Create calculateProfit function
  - File: `src/foo/bar.ts`
  - Create: `function calculateProfit(entries: TradeEntry[]): ProfitResult`
  - Logic: sum entries by side, apply fees (0.1% per trade), return net P&L
  - Edge: empty array → return { netPnL: 0, totalFees: 0, winRate: 0 }
- [ ] Task 2 — Add input validation
  - File: `src/foo/baz.ts`
  - Modify: add `validateInput()` before processing
  - Logic: check side is 'long'|'short', prices > 0, quantity > 0
- [ ] Task 3 — Write tests
  - File: `tests/foo/bar.test.ts`
  - Cases: happy path, empty input, negative values, overflow

## Failure Scenarios
<What should happen when things go wrong — coder MUST implement these>

| When | Then | Error Type |
|------|------|-----------|
| entries is empty array | return zero-value ProfitResult | No error (valid edge case) |
| entry has negative price | throw ValidationError("price must be positive") | ValidationError |
| entry has quantity = 0 | throw ValidationError("quantity must be > 0") | ValidationError |
| calculation overflows Number.MAX_SAFE_INTEGER | use BigInt or throw OverflowError | OverflowError |

## Performance Constraints
<Non-functional requirements — skip if not applicable>

| Metric | Requirement | Why |
|--------|-------------|-----|
| Input size | Must handle 10,000 entries | Production data volume |
| Response time | < 100ms for 10K entries | Real-time dashboard |
| Memory | < 50MB for 10K entries | Container memory limit |

## Rejection Criteria (DO NOT)
<Anti-patterns the coder MUST avoid — things that seem right but are wrong>

- ❌ DO NOT use `toFixed()` for financial calculations — use Decimal.js or integer cents
- ❌ DO NOT mutate the input array — create new objects (immutability rule)
- ❌ DO NOT use `any` type — full TypeScript strict
- ❌ DO NOT import from Phase 2+ files — this phase is self-contained

## Cross-Phase Context
<What this phase assumes from previous phases / what future phases expect from this one>

- **Assumes**: Phase 1 created `src/shared/types.ts` with base types
- **Exports for Phase 3**: `calculateProfit()` will be imported by `src/dashboard/PnLCard.tsx`
- **Interface contract**: ProfitResult shape MUST NOT change — Phase 3 depends on it

## Acceptance Criteria
- [ ] All tasks marked done
- [ ] Tests pass with 80%+ coverage on new code
- [ ] No TypeScript errors (`tsc --noEmit` passes)
- [ ] Failure scenarios all handled (table above)
- [ ] Performance: calculateProfit(10K entries) < 100ms
- [ ] No `any` types, no mutation, no `toFixed()` for money

## Files Touched
- `src/foo/bar.ts` — new
- `src/foo/baz.ts` — modify
- `tests/foo/bar.test.ts` — new
```

**Max 200 lines per phase file.** Must be self-contained — coder should NOT need to read master plan or other phases to execute.

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

A phase missing ANY of sections 1-7 is INCOMPLETE — the weakest coder will guess wrong.
Performance Constraints section is optional (only when NFRs apply).
</HARD-GATE>

### Step 6 — Present and Get Approval

Present the **master plan** to user (NOT all phase files). User reviews:
- Phase breakdown
- Key decisions
- Risks

Wait for explicit approval ("go", "proceed", "yes") before writing phase files.

If user requests changes → revise and re-present.

### Step 7 — Execution Handoff

After approval, the execution flow is:

```
1. Cook loads master plan → identifies current phase (first ⬚ Pending)
2. Cook loads ONLY that phase's file
3. Coder executes tasks in the phase file
4. Mark tasks done in phase file as completed
5. When phase complete → update master plan status: ⬚ → ✅
6. Next session: load master plan → find next ⬚ phase → load phase file → execute
```

**Model selection for execution:**
- Opus plans phases (this skill)
- Sonnet/Haiku executes them (cook → fix)
- If Sonnet makes small errors → fix lightly (cheaper than using Opus for execution)

## Inline Plan (Trivial Tasks)

For trivial tasks (1-2 phases, < 5 files, < 100 LOC):

Skip master plan + phase files. Produce inline plan directly:

```
## Plan: [Task Name]

### Changes
1. [file]: [what to change] — [function signature]
2. [file]: [what to change]

### Tests
- [test file]: [test cases]

### Risks
- [risk]: [mitigation]

Awaiting approval.
```

## Re-Planning (Dynamic Adaptation)

When cook encounters unexpected conditions during execution:

### Trigger Conditions
- Phase execution hits max debug-fix loops (3)
- New files discovered outside the plan scope
- Dependency change alters the approach
- User requests scope change

### Re-Plan Protocol

1. **Read the master plan** + **current phase file**
2. **Read delta context**: what changed, what failed
3. **Assess impact**: which remaining phases are affected?
4. **Revise**:
   - Mark completed phases as ✅ in master plan
   - Modify affected phase files
   - Add new phases if scope expanded
   - **Do NOT rewrite completed phases**
5. **Present revised master plan** with diff summary
6. **Get approval** before resuming

## Feature Spec Mode

When invoked in Feature Spec Mode, produce a structured specification.

### Steps

**Step 1 — Problem Statement**
- What problem? Who has it? Current workaround?

**Step 2 — User Stories**
- Primary story, 2-3 secondary, edge cases
- Format: `As a [persona], I want to [action] so that [benefit]`

**Step 3 — Acceptance Criteria**
- `GIVEN [context] WHEN [action] THEN [result]`
- Happy path + error cases + performance criteria

**Step 4 — Scope Definition**
- In scope / Out of scope / Dependencies / Open questions

**Step 5 — Write Spec File**
Save to `.rune/features/<feature-name>/spec.md`

After spec approved → transition to Implementation Mode.

## Roadmap Mode

When invoked in Roadmap Mode, produce a prioritized feature roadmap.

### Steps

**Step 1 — Inventory**
Scan project for: open issues, TODO/FIXME comments, planned features.

**Step 2 — Prioritize (ICE Scoring)**
Impact × Confidence × Ease (each 1-10). Sort descending.

**Step 3 — Group into Milestones**
- Milestone 1: top 3-5 features by ICE
- Milestone 2: next 3-5
- Backlog: remaining

**Step 4 — Write Roadmap**
Save to `.rune/roadmap.md`

## Output Format

### Master Plan (`.rune/plan-<feature>.md`)
```markdown
# Feature: <name>

## Overview
<1-3 sentences: what and why>

## Phases
| # | Name | Status | Plan File | Summary |
|---|------|--------|-----------|---------|
| 1 | [name] | ⬚ Pending | plan-X-phase1.md | [1-line summary] |

## Key Decisions
- [decision — chosen approach and why]

## Architecture
<brief system diagram — NOT implementation detail>

## Dependencies / Risks
- [dep/risk]: [status/mitigation]
```
Max 80 lines. No implementation details.

### Phase File (`.rune/plan-<feature>-phase<N>.md`)
7 mandatory sections (Amateur-Proof Template):
1. **Goal** — 1-2 sentences
2. **Data Flow** — 5-line ASCII diagram
3. **Code Contracts** — function signatures, interfaces
4. **Tasks** — file paths, logic, edge cases, tests
5. **Failure Scenarios** — when/then/error table
6. **Rejection Criteria** — explicit DO NOTs
7. **Cross-Phase Context** — assumes from prior, exports for future
8. **Acceptance Criteria** — testable conditions

Max 200 lines. Self-contained — coder needs ONLY this file.

### Inline Plan (trivial tasks)
```
## Plan: [Task Name]
### Changes
1. [file]: [what] — [signature]
### Tests
- [test file]: [cases]
### Risks
- [risk]: [mitigation]
```

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

## Cost Profile

~3000-8000 tokens input, ~2000-5000 tokens output (master + all phase files). Opus for architectural reasoning. Most expensive L2 skill but runs infrequently. Phase files are written once, executed by cheaper models (Sonnet/Haiku).
