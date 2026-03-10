---
name: plan
description: Create structured implementation plans from requirements. Breaks tasks into phases, identifies dependencies, and makes architecture decisions. Uses opus for deep reasoning.
metadata:
  author: runedev
  version: "0.3.0"
  layer: L2
  model: opus
  group: creation
---

# plan

## Purpose

Create structured implementation plans from requirements. Plan is the strategic brain of the Rune ecosystem — it breaks complex tasks into phased implementation steps, identifies dependencies and risks, and makes architecture decisions. Uses opus for deep reasoning quality. Bidirectionally connected with brainstorm for creative exploration.

## Modes

### Implementation Mode (default)
Standard implementation planning — decompose task into phased steps with code details.

### Feature Spec Mode
Product-oriented planning — write a feature specification before implementation. Use when the task is a product feature (not just a code change) and needs user stories, acceptance criteria, and scope definition.

**Feature Spec Mode triggers:**
- User says "spec", "feature spec", "write spec", "PRD"
- `/rune plan spec <feature>`
- `cook` Phase 2 when task description is product-oriented (user stories, not code changes)

### Roadmap Mode
High-level multi-feature planning — organize features into milestones with dependencies and priorities.

**Roadmap Mode triggers:**
- User says "roadmap", "milestone", "release plan", "what to build next"
- `/rune plan roadmap`

## Triggers

- Called by `cook` when task scope > 1 file (Implementation Mode)
- Called by `team` for high-level task decomposition (Implementation Mode)
- `/rune plan <task>` — manual planning (Implementation Mode)
- `/rune plan spec <feature>` — feature specification (Feature Spec Mode)
- `/rune plan roadmap` — roadmap planning (Roadmap Mode)
- Auto-trigger: when user says "implement", "build", "create" with complex scope

## Calls (outbound)

- `scout` (L2): scan codebase for existing patterns, conventions, and structure
- `brainstorm` (L2): when multiple valid approaches exist and creative exploration needed
- `research` (L3): external knowledge lookup for unfamiliar technologies
- `sequential-thinking` (L3): complex architecture with many trade-offs
- L4 extension packs: domain-specific architecture patterns when context matches (e.g., @rune/ai-ml for AI architecture decisions)

## Called By (inbound)

- `cook` (L1): Phase 2 PLAN — create implementation plan
- `team` (L1): high-level task decomposition into parallel workstreams
- `brainstorm` (L2): when idea is selected and needs structuring into actionable plan
- `rescue` (L1): plan refactoring strategy for legacy modules
- User: `/rune plan <task>` direct invocation
- `skill-forge` (L2): plan structure for new skill creation

## Cross-Hub Connections

- `plan` ↔ `brainstorm` — bidirectional: plan asks brainstorm for creative options, brainstorm asks plan for structure

## Executable Steps

### Step 1 — Gather Context

**Check for Requirements Document first**: Use `Glob` to check for `.rune/features/*/requirements.md`. If a Requirements Document exists (produced by `rune:ba`), read it and use it as the primary input — it contains user stories, acceptance criteria, scope, and constraints. Do NOT re-gather requirements that BA already elicited.

Use findings from `rune:scout` if already available. If not, invoke `rune:scout` with the project root to scan directory structure, detect framework, identify key files, and extract existing patterns. Do NOT skip this step — plans without context produce wrong file paths.

### Step 2 — Decompose the Task (Bite-Sized)

Break the task into ordered, atomic steps. Each step must be **completable in 2-5 minutes** by a single agent.

<HARD-GATE>
Steps that say "implement the feature" or "set up the database" are TOO VAGUE.
Each step must specify EXACTLY what code to write — including function signatures, data structures, and key logic.
A step the agent can't execute without asking clarifying questions = BAD STEP. Rewrite it.
</HARD-GATE>

Each step must specify:
- Exact file path(s) to touch (absolute paths, not relative)
- What to add, change, or delete in each file — **include function signatures and key logic pseudocode**
- Which function/class/component is affected
- Order of operations (respect dependency graph — create dependencies before consumers)
- **Estimated scope**: small (1-10 LOC) | medium (10-30 LOC) | large (30+ LOC → split further)

### Granularity Rules

| If step is... | Then... |
|---|---|
| > 30 LOC change | Split into 2+ smaller steps |
| "Set up X" without specifics | Add function signatures + data types |
| Missing test entry | Add test cases inline (HARD-GATE) |
| "Refactor Y" without before/after | Describe exact transformation |
| Agent needs to ask "how?" | Step is too vague — rewrite with details |

### Complete Code in Plans

Plans SHOULD include enough detail that an agent can implement without guessing:
- Function signatures with parameter types and return types
- Data structure shapes (interfaces, schemas)
- Key branching logic in pseudocode
- Import paths for dependencies

This is NOT writing the implementation — it's specifying the contract clearly enough that implementation is mechanical.

### Step 3 — Identify Risks
For each step, assess:
- **Breaking changes**: does this modify a public API, exported function, or shared type?
- **Dependencies**: does this step require another step to complete first?
- **Test coverage gaps**: which changed code paths have no existing tests?
- **External dependencies**: new packages required? version conflicts?

Flag every risk explicitly. Do not silently assume it is safe.

### Step 4 — Write the Plan (with tests)
Format each phase as:
```
Phase N: [name]
- Files: [absolute paths]
- Changes: [what to implement]
- Tests: [test file path + test cases to write]
- Complexity: low | medium | high
- Risks: [identified risks from Step 3]
```

<HARD-GATE>
Every phase that writes production code MUST have a corresponding test entry. A plan with zero test steps is REJECTED — do not present it to the user.
</HARD-GATE>

If multiple approaches are viable, invoke `rune:brainstorm` before writing the plan. If trade-offs involve complex architectural reasoning, invoke `rune:sequential-thinking`.

### Step 5 — Present and Get Approval
Present the full plan to the user. Do NOT begin execution. Wait for explicit approval ("yes", "go", "proceed", "looks good") before handing the plan to the caller (e.g., `cook`) for execution.

If the user requests changes, revise the plan and re-present. Do not skip re-presentation after revisions.

## Re-Planning (Dynamic Adaptation)

Plans are not static. When cook encounters unexpected conditions during implementation, it can request a plan revision.

### Trigger Conditions
- Phase 4 (IMPLEMENT) hits max debug-fix loops (3) on a specific area
- New files discovered outside the original plan scope
- Dependency added that changes the implementation approach
- User requests scope change mid-implementation

### Re-Plan Protocol

When cook calls back with delta context:

1. **Read the original plan** (from Phase 2 output or `.rune/features/<name>/plan.md`)
2. **Read the delta context**: what changed, what failed, what was discovered
3. **Assess impact**: which remaining phases are affected?
4. **Revise plan**:
   - Mark completed phases as `[DONE]`
   - Modify affected future phases with updated file paths, logic, dependencies
   - Add new phases if scope expanded
   - **Do NOT rewrite completed phases** — only append/modify pending work
5. **Present revised plan** to user with diff summary:
   - "Original: N phases. Revised: M phases. Changes: [list of what changed and why]"
6. **Get approval** before cook resumes

### Output Format (Re-Plan)

```
## Revised Plan: [Task Name]

### What Changed
- [trigger]: [description of what was discovered]
- [impact]: [which phases affected]

### Revised Phases
1. **Phase 1: [name]** — [DONE]
2. **Phase 2: [name]** — [DONE]
3. **Phase 3: [name]** — [MODIFIED: reason]
   - Files: [updated paths]
   - Changes: [updated implementation]
4. **Phase 4: [name]** — [NEW: reason]
   ...

### Awaiting Approval
Reply "go" to resume with revised plan.
```

## Feature Spec Mode

When invoked in Feature Spec Mode, produce a structured specification instead of an implementation plan.

### Feature Spec Steps

**Step 1 — Problem Statement**
- What problem does this feature solve? (1-2 sentences)
- Who has this problem? (target user persona)
- How are they solving it today? (current workaround)

**Step 2 — User Stories**
Format: `As a [persona], I want to [action] so that [benefit]`
- Primary story (the core use case)
- 2-3 secondary stories (important variations)
- Edge cases as stories (unusual but valid scenarios)

**Step 3 — Acceptance Criteria**
For each user story, write testable criteria:
- `GIVEN [context] WHEN [action] THEN [expected result]`
- Include both happy path and error cases
- Include performance criteria if relevant ("page loads in < 2s")

**Step 4 — Scope Definition**
- **In scope**: explicit list of what this feature includes
- **Out of scope**: explicit list of what this feature does NOT include (prevents scope creep)
- **Dependencies**: what must exist before this feature can work
- **Open questions**: unresolved decisions that need stakeholder input

**Step 5 — Write Spec File**
Save to `.rune/features/<feature-name>/spec.md` using the template:

```markdown
# Feature Spec: [Feature Name]
Created: [date] | Status: Draft | Author: AI + [user]

## Problem
[problem statement]

## User Stories
1. [primary story]
2. [secondary stories]

## Acceptance Criteria
- [ ] [GIVEN/WHEN/THEN criteria]

## Scope
### In Scope
- [items]
### Out of Scope
- [items]
### Dependencies
- [items]
### Open Questions
- [questions]

## Technical Notes
[any implementation hints for the engineer — not a full plan, just key considerations]
```

After spec is approved → transition to Implementation Mode to produce the actual implementation plan from the spec.

## Roadmap Mode

When invoked in Roadmap Mode, produce a prioritized feature roadmap.

### Roadmap Steps

**Step 1 — Inventory**
Scan the project for: open issues, TODO comments, planned features in docs, user-requested features. Use `scout` + `Grep` for `TODO`, `FIXME`, `HACK`, `PLANNED`.

**Step 2 — Prioritize**
Apply ICE scoring (Impact × Confidence × Ease, each 1-10):

| Feature | Impact | Confidence | Ease | ICE Score |
|---------|--------|------------|------|-----------|
| [name]  | [1-10] | [1-10]     | [1-10] | [product] |

Sort by ICE score descending. Top items go to Milestone 1.

**Step 3 — Group into Milestones**
- **Milestone 1** (next release): top 3-5 features by ICE score
- **Milestone 2** (following release): next 3-5 features
- **Backlog**: remaining features, loosely ordered

For each milestone:
- Estimated scope (small/medium/large per feature)
- Dependencies between features (which must ship first)
- Risk flags (any feature that blocks others)

**Step 4 — Write Roadmap**
Save to `.rune/roadmap.md`:

```markdown
# Product Roadmap
Updated: [date]

## Milestone 1: [name] (Target: [timeframe])
| # | Feature | ICE | Scope | Status |
|---|---------|-----|-------|--------|
| 1 | [name]  | [score] | [S/M/L] | planned |

## Milestone 2: [name]
...

## Backlog
...
```

## Constraints

1. MUST include exact file paths for every phase — no vague "set up the database"
2. MUST include acceptance criteria for every phase — how do we know it's done?
3. MUST include test entries for every phase that produces code — plans with zero tests are rejected
4. MUST order phases by dependency — don't plan step 3 before step 1's output exists
5. MUST NOT produce plans with fewer than 3 phases for non-trivial tasks
6. MUST get user approval before the plan is executed

## Output Format

```
## Implementation Plan: [Task Name]

### Architecture Decision
- **Approach**: [chosen approach]
- **Rationale**: [why this approach]
- **Alternatives considered**: [other options and why rejected]

### Dependencies
- [dependency] — [status: available | needs setup]

### Phases
1. **Phase 1: [name]** — [description]
   - Files: [absolute paths]
   - Changes: [what to implement]
   - Tests: [test file path + test cases]
   - Complexity: low | medium | high
   - Risks: [risks]

2. **Phase 2: [name]** — [description]
   ...

### Risks
- [risk] — [mitigation]

### Success Criteria
- [ ] [criterion 1]
- [ ] [criterion 2]

### Awaiting Approval
Reply "go" to execute, or describe changes needed.
```

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Generating plan without scout context — file paths invented | CRITICAL | Constraint 1: exact paths require scout output — call scout first, always |
| Plan with zero test entries for code-producing phases | CRITICAL | HARD-GATE rejects it — every code phase needs a test entry |
| Not waiting for user approval before handing to cook | HIGH | Constraint 6: present plan, wait for explicit "go" / "proceed" / "yes" |
| Phases with vague descriptions ("set up the database") | CRITICAL | Bite-Sized HARD-GATE: each step must include function signatures and key logic |
| Steps > 30 LOC without splitting | HIGH | Granularity Rules: split into 2+ smaller steps with clear boundaries |
| Over-scoping: 10+ phase plan when task could be 3 phases | MEDIUM | If plan exceeds 6 phases, consider splitting into two tasks |
| Agent needs to ask "how?" during execution | HIGH | Step is too vague — plan should be detailed enough for mechanical execution |

## Done When

- Scout output read and conventions/patterns identified
- Task decomposed into ordered, atomic phases with exact file paths
- Risks identified for each phase (breaking changes, dependencies, coverage gaps)
- Every code-producing phase has a corresponding test entry
- Plan presented to user with "Awaiting Approval" prompt
- User has explicitly approved (received "go", "proceed", or equivalent)
- Implementation Plan emitted in output format

## Cost Profile

~3000-8000 tokens input, ~1000-3000 tokens output. Opus for architectural reasoning quality. Most expensive L2 skill but runs infrequently.
