---
name: cook
description: "Feature implementation orchestrator. ALWAYS use this skill for ANY code change — implement, build, add feature, create, fix bug, or any task that modifies source code. This is the default route for 70% of all requests. Runs full TDD cycle: understand → plan → test → implement → quality → verify → commit."
context: fork
background: false
agent: general-purpose
metadata:
  author: runedev
  version: "2.7.0"
  layer: L1
  model: sonnet
  group: orchestrator
  tools: "Read, Write, Edit, Bash, Glob, Grep"
  emit: phase.complete, checkpoint.request
  listen: plan.ready, review.complete, ideas.ready, preflight.passed, verification.complete, convergence.gaps, convergence.clean
---

# cook

## Purpose

The primary orchestrator for feature implementation. Coordinates the entire L2 mesh in a phased TDD workflow. Handles 70% of all user requests — any task that modifies source code routes through cook.

<HARD-GATE>
Before starting ANY implementation:
1. You MUST understand the codebase first (Phase 1)
2. You MUST have a plan before writing code (Phase 2)
3. You MUST write failing tests before implementation (Phase 3) — unless explicitly skipped
This applies to EVERY feature regardless of perceived simplicity.
</HARD-GATE>

## Workflow Chains (Predefined)

Cook supports predefined workflow chains for common task types. Use these as shortcuts instead of manually determining phases:

```
/rune cook feature    → Full TDD pipeline (all phases)
/rune cook bugfix     → Diagnose → fix → verify (Phase 1 → 4 → 6 → 7)
/rune cook refactor   → Understand → plan → implement → quality (Phase 1 → 2 → 4 → 5 → 6 → 7)
/rune cook security   → Full pipeline + sentinel@opus + sast (all phases, security-escalated)
/rune cook hotfix     → Production Hotfix Protocol: contain → fix → verify → deploy → watchdog → postmortem (see below)
/rune cook nano       → Trivial: do → verify → done (no phases, ≤3 steps)
/rune cook --template <name> → Load pre-built workflow template from installed Pro/Business packs
```

### Production Hotfix Protocol

> Full detail moved to [`references/workflow-variants.md`](references/workflow-variants.md) (progressive disclosure). **Read that file before executing this section.** Mesh links used there: `rune:deploy`, `rune:fix`, `rune:incident`, `rune:journal`, `rune:neural-memory`, `rune:sentinel`, `rune:verification`, `rune:watchdog`.

### Template Workflows (Pro/Business)

> Full detail moved to [`references/workflow-variants.md`](references/workflow-variants.md) (progressive disclosure). **Read that file before executing this section.** Mesh links used there: `rune:graft`.

## Phase Skip Rules

Not every task needs every phase:

```
Nano task:           DO → VERIFY → DONE (no phases, auto-detected)
Simple bug fix:      Phase 1 → 4 → 6 → 7
Small refactor:      Phase 1 → 4 → 5 → 6 → 7
New feature:         Phase 1 → 1.5 → 2 → 3 → 4 → 5 → 6 → 6.5 → 7 → 8  (6.5: conditional — requires requirements.md)
Complex feature:     All phases (incl. 6.5) + brainstorm in Phase 2
Security-sensitive:  All phases + sentinel escalated to opus
Fast mode:           Phase 1 → 4 → 6 → 7 (auto-detected, see below)
Multi-session:       Phase 0 (resume) → 3 → 4 → 5 → 6 → 7 (one plan phase per session)
```

Determine complexity BEFORE starting using the Rigor Assessment below. Create TodoWrite with applicable phases.

### Rigor Assessment (Progressive Scaling)

Before selecting a workflow chain or phase set, compute the task's **rigor level** from risk signals. This prevents over-engineering trivial changes while ensuring full ceremony for critical ones.

| Risk Signal | Weight | Detection |
|-------------|--------|-----------|
| Files affected: 1 | 0 | Estimate from task description + scout |
| Files affected: 2-3 | +1 | |
| Files affected: 4+ | +3 | |
| Cross-module impact (changes span 2+ directories) | +2 | scout identifies touch points across boundaries |
| Security-sensitive code (auth, crypto, payments, secrets) | +3 | Keyword match in file paths or task description |
| Public API change (exports, routes, schema) | +2 | Task modifies interfaces consumed by external code |
| Database schema change | +2 | Task mentions migration, schema, ALTER, column |
| New dependency added | +1 | Task requires `npm install` or equivalent |
| Code will be imported by other modules | +1 | New exports or modifications to shared utilities |

**Rigor level mapping:**

| Score | Level | Maps To | Phases |
|-------|-------|---------|--------|
| 0 | Nano | `nano` chain | DO → VERIFY → DONE |
| 1-2 | Fast | `fast` mode | Phase 1 → 4 → 6 → 7 |
| 3-5 | Standard | `bugfix` / `refactor` | Phase 1 → 2 → 4 → 5 → 6 → 7 |
| 6-8 | Full | `feature` | Phase 1 → 1.5 → 2 → 3 → 4 → 5 → 6 → 7 → 8 |
| 9+ | Critical | `security` / full + adversary | All phases + sentinel@opus + adversary |

**Rules:**
- Security signal (+3) automatically floors rigor at Standard — NEVER nano/fast for security code
- User can override: "full pipeline" forces Full, "just do it" forces Nano
- If rigor upgrades mid-task (e.g., scout reveals cross-module impact not obvious from description), announce: "Rigor upgrade: [signal detected] — upgrading from Fast to Standard."
- Announce chosen level: "Rigor: Fast (score 2 — single file, no security)"

## Nano Mode (Auto-Detect)

For trivial tasks that don't need any pipeline at all:

```
IF all of these are true:
  - Task is ≤3 discrete steps (e.g., run command, edit 1 file, commit)
  - Task description < 60 chars OR user prefixes with "quick:", "just", "chỉ cần"
  - No code logic changes (copy files, config edits, version bumps, git ops, run scripts)
  - No new functions/classes/components created
THEN: Nano Mode activated
  - Execute directly: DO → VERIFY → DONE
  - No phases. No plan. No test. No review.
  - Still verify output (check exit codes, confirm file exists, etc.)
  - Still use semantic commit message if committing
```

**Announce**: "Nano mode: trivial task, executing directly."
**Override**: User can say "full pipeline" or "cook feature" to force phases.
**Escape hatch**: If during execution the task turns out more complex than expected → announce upgrade: "Upgrading to Fast/Full mode — task is more complex than detected." Resume from Phase 1.

<HARD-GATE>
Nano mode MUST NOT be used for:
- Any code that will be imported/called by other code
- Security-relevant files (auth, crypto, payments, .env, secrets)
- Database schema changes
- Public API changes
If any of these are detected mid-task, STOP and upgrade to Fast/Full mode.
</HARD-GATE>

## Fast Mode (Auto-Detect)

Cook auto-detects small changes and streamlines the pipeline:

```
IF all of these are true:
  - Total estimated change < 30 LOC
  - Single file affected
  - No security-relevant code (auth, crypto, payments, .env)
  - No public API changes
  - No database schema changes
THEN: Fast Mode activated
  - Skip Phase 2 (PLAN) — change is too small for a formal plan
  - Skip Phase 3 (TEST) — unless existing tests cover the area
  - Skip Phase 5b (SENTINEL) — non-security code
  - Skip Phase 8 (BRIDGE) — not worth persisting
  - KEEP Phase 5a (PREFLIGHT) and Phase 6 (VERIFY) — always run quality checks
```

**Announce fast mode**: "Fast mode: small change detected (<30 LOC, single file, non-security). Streamlined pipeline."
**Override**: User can say "full pipeline" to force all phases even on small changes.

## Phase 0.5: ENVIRONMENT CHECK (First Run Only)

**SUB-SKILL**: Use `rune:sentinel-env` — verify the environment can run the project before planning.

Auto-trigger: no `.rune/` dir (first run) OR build just failed with env-looking errors AND NOT fast mode. Skip silently on subsequent runs. Force with `/rune env-check`.

## Phase 1: UNDERSTAND

**Goal**: Know what exists before changing anything.

**REQUIRED SUB-SKILLS**: Use `rune:scout`. For non-trivial tasks, use `rune:ba`.

1. Create TodoWrite with all applicable phases for this task
2. Mark Phase 1 as `in_progress`
3. **BA gate**: Feature Request / Integration / Greenfield → invoke `rune:ba`. Task > 50 words or business terms (users, revenue, workflow) → invoke `rune:ba`. Bug Fix / simple Refactor → skip. BA produces `.rune/features/<name>/requirements.md` for Phase 2. **Synthesis-mode auto-trigger**: if user pasted a spec > 200 words, conversation has > 1000 words on this feature, `.rune/features/<name>/requirements.md` already exists (continuation), or user said "synthesize"/"just write the spec" → BA Step 1.4 activates Synthesis Mode (extract + cite sources + confirm), skipping the 5-question elicitation. Cook does NOT need to choose mode — BA detects automatically.
4. **Decision enforcement**: `Glob` for `.rune/decisions.md`; if exists, `Read` + extract constraints for Phase 2. Plan MUST NOT contradict active decisions without explicit user override.
4b. **Contract enforcement**: If `.rune/contract.md` was loaded in Phase 0.6, list applicable contract sections for this task (e.g., `contract.security` for auth work, `contract.data` for database changes). These rules constrain Phase 2 planning and Phase 4 implementation.

### Phase 1 Step 3.5 — Clarification Gate

Ask **2 questions** before planning: (1) "What does success look like?" (2) "What should NOT change?"

Skip if: bug fix with clear repro steps | user said "just do it" | fast mode + <10 LOC | hotfix chain active. Complexity revealed → escalate to `rune:ba`.

5. Invoke scout to scan the codebase (Glob + Grep + Read on relevant files)
6. Summarize: what exists, project conventions, files likely to change, active decision constraints
7. **Python async detection**: if Python project detected, `Grep` for async indicators (`async def`, `await`, `aiosqlite`, `aiohttp`, `asyncio.run`). If ≥3 matches → flag as **"async-first Python"** — new code defaults to `async def`
8. **Explore-Before-Commit**: If scout reveals multiple viable approaches (e.g., 2+ libraries, 2+ architectural patterns), do NOT commit to an approach yet. Instead:
   - List alternatives with 1-line trade-off each
   - Flag to Phase 2 (plan) for formal comparison
   - Separating "thinking" (Phase 1) from "committing" (Phase 2) prevents premature lock-in
9. Mark Phase 1 as `completed`

**Gate**: If scout finds the feature already exists → STOP and inform user.

## Phase 1.5: DOMAIN CONTEXT (L4 Pack Detection)

**Goal**: Detect if domain-specific L4 extension packs apply to this task.

<MUST-READ path="references/pack-detection.md" trigger="Phase 1.5 — before checking L4 pack mapping"/>

After scout completes, check if the detected tech stack or task description matches any L4 extension pack. This phase is lightweight — a Read + pattern match. It does NOT replace Phase 1 (scout) or Phase 2 (plan). If 0 packs match: skip silently.

## Phase 1.7: WORKFLOW ORCHESTRATION (Multi-Skill Sequences)

> Full detail moved to [`references/orchestration.md`](references/orchestration.md) (progressive disclosure). **Read that file before executing this section.**

## Phase 0: RESUME CHECK (Before Phase 1)

**Goal**: Detect if a master plan already exists for this task, or if a `--template` was specified. If so, skip Phase 1-2 and resume/load the workflow.

**Step 0.4 — Template Detection**: If user passed `--template <name>`:
1. Search installed pack templates for the name: `Glob` for `extensions/*/templates/<name>.md` and `extensions/pro-*/templates/<name>.md`
2. If found: `Read` the template file → parse phases, signals, connections, acceptance criteria
3. Generate a master plan from the template: each template phase becomes a plan phase
4. Write plan files to `.rune/plan-<template-name>.md` + `.rune/plan-<template-name>-phaseN.md`
5. Announce "Loading template: <name> (<pack>)" → skip Phase 1, 1.5, 1.7, 2 → proceed to Phase 4 with Phase 1 of the template
6. If template not found: warn user and fall through to normal workflow

**Step 0.5 — Cross-Project Recall**: Call `neural-memory` (Recall Mode) with 3-5 topics relevant to the current task. Always prefix queries with the project name (e.g., `"ProjectName auth pattern"` not `"auth pattern"`).

1. Use `Glob` to check for `.rune/plan-*.md` files
2. If a master plan exists matching the current task:
   - **Step 0.55 — Spec-Backfill Gate (HARD-GATE)**: Before resuming, `Glob` `.rune/features/*/requirements.md`. If NO requirements doc exists AND the task is a **Feature / Integration / Greenfield** (same classification as the Phase 1 BA-gate — NOT a bug fix, refactor, or trivial change), the plan was produced without a spec (e.g., a `brainstorm → plan` bypass that skipped `ba`). Do NOT resume blindly:
     1. Invoke `rune:ba` to backfill requirements (5-question elicitation, or Synthesis Mode if the plan + conversation already carry enough context) → produces `.rune/features/<name>/requirements.md`.
     2. Re-invoke `rune:plan` to reconcile the existing plan against the new spec — if the plan contradicts a locked Decision or misses a requirement, revise the affected phase files and get user re-approval (Re-Planning protocol).
     3. THEN resume. For Bug Fix / Refactor / trivial tasks, skip this gate — no spec is expected.
   - Read the (reconciled) master plan → find first `⬚ Pending` or `🔄 Active` phase → load ONLY that phase file → announce "Resuming from Phase N" → skip to Phase 4
3. If no master plan exists → proceed to Phase 1 as normal

**Step 0.6 — Contract Load**: Use `Glob` to check for `.rune/contract.md`. If it exists:
1. `Read` the contract file and parse each `## section` as a named rule set
2. Hold contract rules in context — they apply as **hard gates** throughout all phases
3. Any code change that violates a contract rule → STOP and inform user before proceeding
4. If no contract exists → proceed normally (contract is optional)

<HARD-GATE>
Contract violations are NON-NEGOTIABLE. If `.rune/contract.md` exists and a planned or implemented change violates any rule, cook MUST stop and report the violation. The user must explicitly override ("ignore contract rule X") to proceed.
</HARD-GATE>

**This enables multi-session workflows**: Opus plans once → each session picks up the next phase.

## Phase 2: PLAN

**Goal**: Break the task into concrete implementation steps before writing code.

**REQUIRED SUB-SKILL**: Use `rune:plan`

1. Mark Phase 2 as `in_progress`
2. **Feature workspace** (opt-in) — for non-trivial features (3+ phases), suggest creating `.rune/features/<feature-name>/` with `spec.md`, `plan.md`, `decisions.md`, `status.md`. Skip for simple bug fixes, fast mode.
3. Create implementation plan: exact files to create/modify, change order, dependencies, active decision constraints
4. If multiple valid approaches exist → invoke `rune:brainstorm` for trade-off analysis
5. **Frontend detection** — if task touches `.tsx/.jsx/.vue/.svelte/.css`, component files, or mentions "UI/page/screen/design/layout/landing": invoke `rune:design` BEFORE plan approval. Pass hint `mode: "tweaks-default"` — design proposes ONE opinionated default per `.rune/design-system.md` (Step 2.7), not a 5-option menu. User replies with tweaks ("more professional", "darker") rather than picking from a list. If `.rune/design-system.md` is missing, design creates it first.
6. Present plan to user for approval
7. If feature workspace was created, write approved plan to `.rune/features/<name>/plan.md`
8. Mark Phase 2 as `completed`

**Gate**: User MUST approve the plan before proceeding. Do NOT skip this.

### Phase 2.5: RFC GATE (Breaking Changes Only)

**Goal**: Formal change management for breaking changes. Prevents unreviewed breaking changes from reaching production.

<MUST-READ path="references/rfc-template.md" trigger="Phase 2.5 — any time a breaking change is detected in the plan"/>

<HARD-GATE>
Breaking change without RFC = BLOCKED. No exceptions.
"It's just a small change" is the #1 excuse for production incidents from unreviewed breaking changes.
</HARD-GATE>

### Phase 2.5: ADVERSARY (Red-Team Challenge)

**Goal**: Stress-test the approved plan BEFORE writing code — catch flaws at plan time, not implementation time.

**REQUIRED SUB-SKILL**: Use `rune:adversary`

1. **Skip conditions**: bug fixes, hotfixes, simple refactors (< 3 files, no new logic), fast mode
2. **Run adversary** — Full Red-Team mode for new features/architectural changes; Quick Challenge mode for smaller plans
3. **Handle verdict**:
   - **REVISE** → return to Phase 2 with adversary findings as constraints; user must re-approve
   - **HARDEN** → present remediations, update plan inline, then proceed to Phase 3
   - **PROCEED** → pass findings as implementation notes to Phase 3
4. **Max 1 REVISE loop** per cook session — if revised plan also gets REVISE, ask user to decide

### Phase-Aware Execution (Master Plan + Phase Files)

> Full detail moved to [`references/orchestration.md`](references/orchestration.md) (progressive disclosure). **Read that file before executing this section.** Mesh links used there: `rune:plan`.

<HARD-GATE>
NEVER load multiple phase files at once. One phase per session = small context = better code.
If the coder model needs info from other phases, it's in the Cross-Phase Context section of the current phase file.
</HARD-GATE>

## Phase 3: TEST (TDD Red)

**Goal**: Define expected behavior with failing tests BEFORE writing implementation.

**REQUIRED SUB-SKILL**: Use `rune:test`

1. Mark Phase 3 as `in_progress`
2. **Eval definitions** (Full/Critical rigor only): Before writing tests, define capability evals (pass@k) and regression evals (pass^k) in `.rune/evals/<feature>.md`. Capability evals test "can the system do this new thing?" — regression evals test "did we break existing behavior?" Skip for Fast/Standard rigor levels.
3. Write ONE test for the next behavior — vertical slicing required, see `rune:test` `references/vertical-tdd.md`. Bulk-writing tests = horizontal violation, blocks Phase 4
4. **Python async pre-check** (if async-first Python flagged in Phase 1): verify `pytest-asyncio` is installed and `asyncio_mode = "auto"` is in `pyproject.toml` — if missing, warn user before writing async tests
5. Run the test to verify it FAILS — expected: RED because implementation doesn't exist yet
6. Mark Phase 3 as `completed` (one cycle); Phase 4 implements that one cycle, then loop returns here for the next test

**Gate**: Test MUST exist and MUST fail. If test passes without implementation → test is wrong, rewrite. If 2+ tests staged before any GREEN → `tdd.horizontal.violation` signal, unwind to one test.

## Phase 4: IMPLEMENT (TDD Green)

**Goal**: Write the minimum code to make tests pass.

**REQUIRED SUB-SKILL**: Use `rune:fix`

### Reuse Ladder (climb before you write)

> Full detail moved to [`references/reuse-ladder.md`](references/reuse-ladder.md) (progressive disclosure). **Read that file before executing this section.** Mesh links used there: `rune:brainstorm`, `rune:debug`, `rune:plan`.

   <HARD-GATE>
   Do NOT surrender. Do NOT tell user "no solution exists."
   Do NOT try a 4th variant of the same approach.
   MUST invoke brainstorm(mode="rescue") before giving up.
   </HARD-GATE>

## Phase 5: QUALITY (Staged)

**Goal**: Catch issues before they reach production.

Quality checks run in **two stages** — spec compliance gates code review. Reviewing code quality before verifying it matches the spec wastes effort on code that may need rewriting.

**Signal dispatch ordering**: When `fix` emits `code.changed`, 4 listeners react (preflight, sentinel, test, review). Cook coordinates dispatch order — do NOT let all 4 fire simultaneously:
- **Stage 1**: preflight + sentinel (parallel — independent checks)
- **Stage 2**: test (after Stage 1 passes — no point testing non-compliant code)
- **Stage 3**: review (after test passes — review verified code only)

```
STAGE 1 (parallel):
  Launch 5a (preflight) + 5b (sentinel) simultaneously.
  Wait for BOTH to complete.
  If 5a returns BLOCK → fix spec gaps, re-run 5a. Code review CANNOT start on non-compliant code.
  If 5b returns BLOCK → fix security issue, re-run 5b.

STAGE 2 (after Stage 1 passes):
  Launch 5c (review) + 5d (completion-gate) simultaneously.
  If any returns BLOCK → fix findings, re-run the blocking check only.
```

### Remediation Cycle Counter

> Full detail moved to [`references/quality-loop.md`](references/quality-loop.md) (progressive disclosure). **Read that file before executing this section.**

### Upstream Inconsistency Protocol

> Full detail moved to [`references/quality-loop.md`](references/quality-loop.md) (progressive disclosure). **Read that file before executing this section.** Mesh links used there: `rune:ba`, `rune:plan`.

### 5a. Preflight (Spec Compliance + Logic) — STAGE 1
**REQUIRED SUB-SKILL**: Use `rune:preflight`
- Spec compliance: compare approved plan vs actual diff
- Logic review, error handling, completeness
- **Must pass before 5c (review) can start** — no point reviewing code quality if it doesn't match the spec

### 5b. Security — STAGE 1
**REQUIRED SUB-SKILL**: Use `rune:sentinel`
- Secret scan, OWASP check (no injection/XSS/CSRF), dependency audit

### 5c. Code Review — STAGE 2
**REQUIRED SUB-SKILL**: Use `rune:review`
- Pattern compliance, code quality, performance bottlenecks
- Reviewer reads code independently — does NOT rely on implementer's claims
- **Reviewer isolation** (when invoked via `team`): The review agent MUST be a separate context window from the implementing agent. Author reasoning contaminates review — the reviewer should never have seen the implementation's reasoning chain. Sonnet implements, a fresh Sonnet reviews.

### 5d. Completion Gate — STAGE 2
**REQUIRED SUB-SKILL**: Use `rune:completion-gate`
- Validate agent claims match evidence trail (tests ran, files changed, build passed)
- No truncated code files (`// ...`, `// rest of code`, bare ellipsis) — agent MUST complete all output
- Any UNCONFIRMED claim → BLOCK

**Gate**: If sentinel finds CRITICAL security issue → STOP, fix it, re-run. Non-negotiable.
**Gate**: If completion-gate finds UNCONFIRMED claim → STOP, re-verify. Non-negotiable.

## Per-Phase Rules (Project-Specific)

> Full detail moved to [`references/quality-loop.md`](references/quality-loop.md) (progressive disclosure). **Read that file before executing this section.**

## Checkpoint Protocol (Opt-In)

Invoke `rune:session-bridge` after Phase 2, 4, and 5 to save intermediate state. OPT-IN — activate only if task spans 3+ phases, context-watch is ORANGE, or user explicitly requests checkpoints. Before spawning subagents, invoke `rune:context-pack` to create structured handoff briefings.

## Phase Transition Protocol (MANDATORY)

Before entering ANY Phase N+1, assert: Phase N `completed` in TodoWrite | gate condition met | no BLOCK from sub-skills | no unresolved CRITICAL findings. If any fails → STOP, log "BLOCKED at Phase N→N+1: [assertion]", fix, re-check.

**Key transitions:** 1→2: scout done | 2→3: plan approved | 3→4: failing tests exist | 4→5: all tests pass | 5→6: no CRITICAL findings | 6→6.5: lint+types+build green | 6.5→7: convergence.clean or documented escalation (features with requirements.md; others pass through).

## Phase 6: VERIFY

**REQUIRED SUB-SKILL**: Use `rune:verification` — run lint, type check, full test suite, build. Then `rune:hallucination-guard` to verify imports and API signatures. ALL checks MUST pass before commit.

**Quickstart execution**: if `.rune/features/<name>/quickstart.md` exists (plan Step 3.7 boundary artifact), execute its validation blocks — run each command, compare against its **Expect** line. Any mismatch = verification FAIL (treat like a failing test). If the environment cannot run a block (no browser, no DB), SKIP it with the reason named in the Cook Report — a skipped quickstart is visible debt, never silent.

## Phase 6.5: CONVERGE (Spec↔Code Gap Scan)

**REQUIRED SUB-SKILL**: Use `rune:converge` — verify the ACTUAL codebase matches the spec before committing.

**Trigger**: feature/greenfield chains where `.rune/features/<name>/requirements.md` exists.
**Skip** (announce the skip): nano/fast/bugfix/refactor/hotfix chains, or no requirements.md (ad-hoc task — Phase 5 gates are the only protection).

1. Invoke `rune:converge` — it re-reads spec/plan/contracts as sole intent, scans present code state, classifies gaps (`missing` / `partial` / `contradicts` / `unrequested`)
2. **`convergence.clean`** → proceed to Phase 7
3. **`convergence.gaps`** → inspect the signal's `counts` payload first:
   - **Unrequested-only** (`counts.missing`=0, `counts.partial`=0, `counts.contradicts`=0, `counts.unrequested`>0): no CV tasks were appended — surface the findings in the Cook Report and proceed to Phase 7. Do NOT enter the remediation loop for informational scope-creep findings
   - **Otherwise**: converge appended `CV-*` remediation tasks to the active phase file:
     - Execute the CV tasks (return to Phase 4 loop for them; CRITICAL/HIGH first)
     - Re-run Phase 6 VERIFY on the remediated code, then re-invoke converge (round 2)
     - **Max 2 remediation rounds.** Gaps still present after round 2 → produce a Structured Escalation Report (the same gap surviving 2 rounds means the approach is wrong, not the effort)
4. `unrequested` findings are surfaced to the user in the Cook Report — never silently deleted, never blocking
5. **Stale CV tasks**: if converge reports clean but unchecked `CV-*` tasks remain from earlier rounds (e.g., rules changed between rounds), cook closes them as `[x] (resolved — superseded)` with a Cook Report note — converge's append-only contract means only cook may touch them

<HARD-GATE>
A P1 story with a CRITICAL convergence gap (missing/contradicts) MUST NOT be committed as "done."
Either remediate within the round cap, or escalate with the gap documented — never claim completion over a known dead path.
</HARD-GATE>

## Phase 7: COMMIT

**RECOMMENDED SUB-SKILL**: Use `rune:git` — stage specific files (`git add <files>`, NOT `git add .`), generate semantic commit message from diff. If working from master plan: update phase status `🔄 → ✅`, announce next phase or "All phases complete."

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

## Autonomous Loop Patterns

> Full detail moved to [`references/autonomous-patterns.md`](references/autonomous-patterns.md) (progressive disclosure). **Read that file before executing this section.**

<HARD-GATE>
NEVER treat a Cancel/Pause signal as a Steer or NewTask. User safety signals take absolute priority.
If ambiguous between Cancel and Steer → ask user: "Did you mean stop, or change approach?"
</HARD-GATE>

<HARD-GATE>
"Bad work is worse than no work." Cook MUST produce this report rather than attempting a 4th variant of a failing approach. Escalating is not failure — shipping broken code is.
</HARD-GATE>

## Deviation Rules

<MUST-READ path="references/deviation-rules.md" trigger="when implementation diverges from the approved plan"/>

R1-R3 (bug/security/blocking fix): auto-fix, continue. R4 (architectural change): ASK user first.

## Error Recovery

<MUST-READ path="references/error-recovery.md" trigger="when any phase fails or a task hits repeated errors"/>

Includes phase-by-phase failure handling and repair operators (RETRY → DECOMPOSE → PRUNE) with a 2-attempt budget before escalation.

## Analysis Paralysis Guard

> Full detail moved to [`references/paralysis-guard.md`](references/paralysis-guard.md) (progressive disclosure). **Read that file before executing this section.**

<HARD-GATE>
5+ consecutive read-only tool calls (Read, Grep, Glob) without a single write action (Edit, Write, Bash) = STUCK.

You MUST either:
1. **Act** — write code, run a command, create a file
2. **Report BLOCKED** — state the specific missing piece: "Cannot proceed because [X]"

Stuck patterns (all banned):
- Reading 10+ files to "fully understand" before acting
- Grepping every variation of a string across the entire repo
- Reading the same file twice in one investigation
- "Let me check one more thing" — repeated after 5 reads

A wrong first attempt that produces feedback beats perfect understanding that never ships.
</HARD-GATE>

## Called By (inbound)

- User: `/rune cook` direct invocation — primary entry point
- `team` (L1): parallel workstream execution (meta-orchestration)

## Calls (outbound)

| Phase | Sub-skill | Layer | Purpose |
|-------|-----------|-------|---------|
| 0 / 8 | `neural-memory` | ext | Recall context at start; capture learnings at end |
| 0.5 | `sentinel-env` | L3 | Environment pre-flight (first run only) |
| 1 | `scout` | L2 | Scan codebase before planning |
| 1 | `onboard` | L2 | Initialize project context if no CLAUDE.md |
| 1 | `ba` | L2 | Requirement elicitation for features |
| 1 | `logic-guardian` | L2 | Conditional: when `.rune/logic-manifest.json` exists — protect complex business logic before any edits |
| 2 | `plan` | L2 | Create implementation plan |
| 2 | `brainstorm` | L2 | Trade-off analysis / rescue mode |
| 2 | `design` | L2 | UI/design phase for frontend features — invoke with `mode: "tweaks-default"` (one opinionated default + accept natural-language tweaks, not a 5-option menu) |
| 2.5 | `adversary` | L2 | Red-team challenge on approved plan |
| 3 | `test` | L2 | Write failing tests (RED phase) |
| 4 | `fix` | L2 | Implement code changes (GREEN phase) |
| 4 | `debug` | L2 | Unexpected errors (max 3 loops) |
| 4 | `db` | L2 | Schema changes detected in diff |
| 4 | `worktree` | L3 | Worktree isolation for parallel implementation |
| 5a | `preflight` | L2 | Spec compliance + logic review |
| 5b | `sentinel` | L2 | Security scan |
| 5c | `review` | L2 | Code quality review |
| 5 | `scope-guard` | L3 | Verify changed files match approved plan scope (flag out-of-scope files before commit) |
| 5 | `perf` | L2 | Performance regression check (optional) |
| 5 | `audit` | L2 | Project health audit when scope warrants |
| 5 | `review-intake` | L2 | Structured review intake for complex PRs OR Issue Triage Mode for issue tracker items (state machine: needs-triage / needs-info / ready-for-agent / ready-for-human / wontfix). When external feedback source is an issue (not PR comment), review-intake auto-detects and runs Issue Triage Mode — emits `triage.classified` + `agent.brief.ready` (for AFK pickup) |
| 5 | `sast` | L3 | Static analysis security testing |
| 5d | `completion-gate` | L3 | Validate agent claims against evidence trail |
| 5 | `constraint-check` | L3 | Audit HARD-GATE compliance across workflow |
| 6 | `verification` | L3 | Lint + types + tests + build |
| 6 | `hallucination-guard` | L3 | Verify imports and API calls are real |
| 6.5 | `converge` | L3 | Spec↔code gap scan for features with requirements.md — dead buttons, missing backends, contradicted decisions |
| 7 | `journal` | L3 | Record architectural decisions |
| 8 | `session-bridge` | L3 | Save context for future sessions |
| any | `context-pack` | L3 | create structured handoff briefings before spawning subagents |
| any | `skill-forge` | L2 | When new skill creation detected during cook |
| 1.5 | L4 extension packs | L4 | Domain-specific patterns when stack matches |

## Data Flow

**Feeds Into →** `journal` (decisions → ADRs) | `session-bridge` (context → .rune/ state) | `neural-memory` (learnings → cross-session)

**Fed By ←** `ba` (requirements → Phase 1) | `plan` (master plan → Phase 2-4) | `session-bridge` (.continue-here.md → Phase 0 resume) | `neural-memory` (past decisions → Phase 0 recall)

**Feedback Loops ↻** cook↔debug (Phase 4 bug → debug → fix → resume; if plan wrong → Approach Pivot) | cook↔test (RED → GREEN → failures loop back)

## Constraints

1. MUST run scout before planning
2. MUST get user plan approval before writing code
3. MUST write failing tests before implementation (TDD) unless explicitly skipped
4. MUST NOT commit with failing tests
5. MUST NOT modify files outside approved plan scope without user confirmation
6. MUST run verification (lint + type-check + tests + build) before commit
7. MUST NOT say "all tests pass" without showing actual test output
8. MUST NOT contradict `.rune/decisions.md` without explicit user override

## Mesh Gates

| Gate | Requires | If Missing |
|------|----------|------------|
| Resume Gate | Phase 0 checks for master plan before starting | Proceed to Phase 1 |
| Spec-Backfill Gate | Feature/greenfield resume requires `requirements.md` to exist alongside the plan | Plan without spec → invoke `rune:ba` to backfill, reconcile plan, THEN resume |
| Scout Gate | scout output before Phase 2 | Invoke rune:scout first |
| Plan Gate | User-approved plan before Phase 3 | Cannot proceed |
| Adversary Gate | adversary verdict before Phase 3 for features | Skip for bugfix/hotfix/refactor |
| Phase File Gate | Active phase file only (multi-session) | Load only active phase |
| Test-First Gate | Failing tests before Phase 4 | Write tests or get explicit skip |
| Quality Gate | preflight + sentinel + review before Phase 7 | Fix findings, re-run |
| Verification Gate | lint + types + tests + build green before commit | Fix, re-run |
| Convergence Gate | `convergence.clean` (or documented escalation) before Phase 7 for features with requirements.md | Execute CV tasks, re-verify, re-converge (max 2 rounds) |

## Structured Output Contract (Prompt-as-API Pattern)

> Full detail moved to [`references/structured-output.md`](references/structured-output.md) (progressive disclosure). **Read that file before executing this section.**

## Output Format

<MUST-READ path="references/output-format.md" trigger="before emitting the Cook Report at end of any session"/>

Emit a Cook Report with: Status, Phases, Files Changed, Tests, Quality results, Commit hash.
When invoked by `team` with a NEXUS Handoff, include the Deliverables table — MANDATORY.

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| Plan files (master + phase) | Markdown | `.rune/plan-<feature>.md`, `.rune/plan-<feature>-phase<N>.md` |
| Implementation code | Source files | Per plan file paths |
| Test files | Source files | Co-located or `__tests__/` per project convention |
| Verification results | Inline stdout | Shown in Cook Report |
| Cook Report | Markdown (inline) | Emitted at end of session |
| Session state | Markdown | `.rune/decisions.md`, `.rune/progress.md`, `.rune/conventions.md` |

## Document Ownership

| Scope | Access | Files |
|-------|--------|-------|
| **Owns** (read + write) | `.rune/plan-*.md`, `.rune/progress.md`, `.rune/decisions.md`, `.rune/conventions.md`, source files per approved plan |
| **Reads** (never writes) | `CLAUDE.md`, `SKILL.md` (any), `.rune/contract.md`, `.rune/checkpoint.md` |
| **Never modifies** | `compiler/**`, `extensions/**`, `PACK.md`, other skills' `SKILL.md`, `.rune/learnings.jsonl` |

When delegating to sub-skills (scout, plan, test, review), each sub-skill owns its own output. Cook coordinates but does not overwrite sub-skill artifacts.

## Anti-Patterns

> Full detail moved to [`references/anti-patterns.md`](references/anti-patterns.md) (progressive disclosure). **Read that file before executing this section.**

## Sharp Edges

<MUST-READ path="references/sharp-edges.md" trigger="before declaring done — review all 18 failure modes"/>

**CRITICAL failures** (always check): skipping scout | writing code without plan approval | "done" without evidence trail | surrendering without Approach Pivot Gate | breaking change without RFC | treating Cancel/Pause as scope change.

## Self-Validation

```
SELF-VALIDATION (run before emitting Cook Report):
- [ ] Every phase in Phase Skip Rules was either executed or explicitly skipped with reason
- [ ] Plan approval gate was not bypassed — user said "go" (check conversation history)
- [ ] No Phase 4 code was written before Phase 3 tests (TDD order preserved)
- [ ] All Phase 5 quality gates (preflight, sentinel, review) ran — not just claimed
- [ ] Phase 6.5 converge ran for features with requirements.md — or skip announced (no spec) / escalation documented
- [ ] No quality gate exceeded 3 remediation cycles without user escalation
- [ ] No upstream issue was fixed by code change alone — UPSTREAM findings re-invoked the source skill
- [ ] Cook Report contains actual commit hash, not placeholder
```

## Done When

All applicable phases complete + Self-Validation passed:
- User approved plan | All tests PASS (output shown) | preflight+sentinel+review PASS | build green
- Convergence: `convergence.clean` OR skip announced (no requirements.md) OR escalation documented — never silent
- Cook Report emitted with commit hash | Session state saved to .rune/ via session-bridge

## Cost Profile

~$0.05-0.15 per feature. Haiku for scanning (Phase 1), sonnet for coding (Phase 3-4), opus for complex planning (Phase 2 when needed).
