---
name: cook
description: "Feature implementation orchestrator. ALWAYS use this skill for ANY code change — implement, build, add feature, create, fix bug, or any task that modifies source code. This is the default route for 70% of all requests. Runs full TDD cycle: understand → plan → test → implement → quality → verify → commit."
context: fork
agent: general-purpose
metadata:
  author: runedev
  version: "1.5.0"
  layer: L1
  model: sonnet
  group: orchestrator
  tools: "Read, Write, Edit, Bash, Glob, Grep"
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
/rune cook hotfix     → Minimal: fix → verify → commit (Phase 4 → 6 → 7, skip scout if user provides context)
/rune cook nano       → Trivial: do → verify → done (no phases, ≤3 steps)
```

**Chain selection**: If user invokes `/rune cook` without a chain type, auto-detect from the task description:
- Contains "bug", "fix", "broken", "error" → `bugfix`
- Contains "refactor", "clean", "restructure" → `refactor`
- Contains "security", "auth", "vulnerability", "CVE" → `security`
- Contains "urgent", "hotfix", "production" → `hotfix`
- Contains "quick", "just", "chỉ cần", "copy", "move", "rename", "bump" → `nano`
- Default → `feature`

## Phase Skip Rules

Not every task needs every phase:

```
Nano task:           DO → VERIFY → DONE (no phases, auto-detected)
Simple bug fix:      Phase 1 → 4 → 6 → 7
Small refactor:      Phase 1 → 4 → 5 → 6 → 7
New feature:         Phase 1 → 1.5 → 2 → 3 → 4 → 5 → 6 → 7 → 8
Complex feature:     All phases + brainstorm in Phase 2
Security-sensitive:  All phases + sentinel escalated to opus
Fast mode:           Phase 1 → 4 → 6 → 7 (auto-detected, see below)
Multi-session:       Phase 0 (resume) → 3 → 4 → 5 → 6 → 7 (one plan phase per session)
```

Determine complexity BEFORE starting. Create TodoWrite with applicable phases.

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
3. **BA gate**: Feature Request / Integration / Greenfield → invoke `rune:ba`. Task > 50 words or business terms (users, revenue, workflow) → invoke `rune:ba`. Bug Fix / simple Refactor → skip. BA produces `.rune/features/<name>/requirements.md` for Phase 2.
4. **Decision enforcement**: `Glob` for `.rune/decisions.md`; if exists, `Read` + extract constraints for Phase 2. Plan MUST NOT contradict active decisions without explicit user override.

### Phase 1 Step 3.5 — Clarification Gate

Ask **2 questions** before planning: (1) "What does success look like?" (2) "What should NOT change?"

Skip if: bug fix with clear repro steps | user said "just do it" | fast mode + <10 LOC | hotfix chain active. Complexity revealed → escalate to `rune:ba`.

5. Invoke scout to scan the codebase (Glob + Grep + Read on relevant files)
6. Summarize: what exists, project conventions, files likely to change, active decision constraints
7. **Python async detection**: if Python project detected, `Grep` for async indicators (`async def`, `await`, `aiosqlite`, `aiohttp`, `asyncio.run`). If ≥3 matches → flag as **"async-first Python"** — new code defaults to `async def`
8. Mark Phase 1 as `completed`

**Gate**: If scout finds the feature already exists → STOP and inform user.

## Phase 1.5: DOMAIN CONTEXT (L4 Pack Detection)

**Goal**: Detect if domain-specific L4 extension packs apply to this task.

<MUST-READ path="references/pack-detection.md" trigger="Phase 1.5 — before checking L4 pack mapping"/>

After scout completes, check if the detected tech stack or task description matches any L4 extension pack. This phase is lightweight — a Read + pattern match. It does NOT replace Phase 1 (scout) or Phase 2 (plan). If 0 packs match: skip silently.

## Phase 0: RESUME CHECK (Before Phase 1)

**Goal**: Detect if a master plan already exists for this task. If so, skip Phase 1-2 and resume from the current phase.

**Step 0.5 — Cross-Project Recall**: Call `neural-memory` (Recall Mode) with 3-5 topics relevant to the current task. Always prefix queries with the project name (e.g., `"ProjectName auth pattern"` not `"auth pattern"`).

1. Use `Glob` to check for `.rune/plan-*.md` files
2. If a master plan exists matching the current task: Read it → find first `⬚ Pending` or `🔄 Active` phase → load ONLY that phase file → announce "Resuming from Phase N" → skip to Phase 4
3. If no master plan exists → proceed to Phase 1 as normal

**This enables multi-session workflows**: Opus plans once → each session picks up the next phase.

## Phase 2: PLAN

**Goal**: Break the task into concrete implementation steps before writing code.

**REQUIRED SUB-SKILL**: Use `rune:plan`

1. Mark Phase 2 as `in_progress`
2. **Feature workspace** (opt-in) — for non-trivial features (3+ phases), suggest creating `.rune/features/<feature-name>/` with `spec.md`, `plan.md`, `decisions.md`, `status.md`. Skip for simple bug fixes, fast mode.
3. Create implementation plan: exact files to create/modify, change order, dependencies, active decision constraints
4. If multiple valid approaches exist → invoke `rune:brainstorm` for trade-off analysis
5. Present plan to user for approval
6. If feature workspace was created, write approved plan to `.rune/features/<name>/plan.md`
7. Mark Phase 2 as `completed`

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

When `rune:plan` produces a **master plan + phase files** (non-trivial tasks):

1. After plan approval: load ONLY Phase 1's file — do NOT load all phase files
2. Execute through cook Phase 3-6 (test → implement → quality → verify)
3. After phase complete: mark tasks done, update master plan status `⬚ → ✅`, announce "Phase N complete. Phase N+1 ready for next session."
4. Next session: Phase 0 detects master plan → loads next phase → executes

<HARD-GATE>
NEVER load multiple phase files at once. One phase per session = small context = better code.
If the coder model needs info from other phases, it's in the Cross-Phase Context section of the current phase file.
</HARD-GATE>

## Phase 3: TEST (TDD Red)

**Goal**: Define expected behavior with failing tests BEFORE writing implementation.

**REQUIRED SUB-SKILL**: Use `rune:test`

1. Mark Phase 3 as `in_progress`
2. Write test files based on the plan — cover primary use case + edge cases; tests MUST be runnable
3. **Python async pre-check** (if async-first Python flagged in Phase 1): verify `pytest-asyncio` is installed and `asyncio_mode = "auto"` is in `pyproject.toml` — if missing, warn user before writing async tests
4. Run tests to verify they FAIL — expected: RED because implementation doesn't exist yet
5. Mark Phase 3 as `completed`

**Gate**: Tests MUST exist and MUST fail. If tests pass without implementation → tests are wrong, rewrite them.

## Phase 4: IMPLEMENT (TDD Green)

**Goal**: Write the minimum code to make tests pass.

**REQUIRED SUB-SKILL**: Use `rune:fix`

1. Mark Phase 4 as `in_progress`
2. **Phase-file execution** — if working from a master plan + phase file:
   - Execute tasks from `## Tasks` section wave-by-wave
   - Wave N only starts after ALL Wave N-1 tasks complete
   - Follow Code Contracts, Rejection Criteria, Failure Scenarios from the phase file
   - Mark each task `[x]` as completed
3. Implement the feature following the plan (Write for new files, Edit for existing)
4. Run tests after each significant change — if fail → debug and fix
   - **Python async** (if async-first flagged): no blocking calls in async functions — `time.sleep` → `asyncio.sleep`, `requests` → `httpx.AsyncClient`, use `asyncio.gather()` for parallel I/O
5. If stuck → invoke `rune:debug` (max 3 debug↔fix loops). Fixes outside plan scope require user approval (R4).
6. **Re-plan check** — evaluate before Phase 5: max debug loops hit? out-of-scope files changed? new dep changes approach? user scope change? If any fire → invoke `rune:plan` with delta context, get user approval before resuming.
7. **Approach Pivot Gate** — if re-plan ALSO fails:

   <HARD-GATE>
   Do NOT surrender. Do NOT tell user "no solution exists."
   Do NOT try a 4th variant of the same approach.
   MUST invoke brainstorm(mode="rescue") before giving up.
   </HARD-GATE>

   Invoke `rune:brainstorm(mode="rescue")` with `failed_approach`, `failure_evidence[]`, `original_goal`. Returns 3-5 alternatives → user picks → **restart from Phase 2**.

8. All tests MUST pass before proceeding
9. Mark Phase 4 as `completed`

**Gate**: ALL tests from Phase 3 MUST pass. Do NOT proceed with failing tests.

## Phase 5: QUALITY (Parallel)

**Goal**: Catch issues before they reach production.

Run quality checks **in parallel** for speed. Any CRITICAL finding blocks the commit.

```
PARALLEL EXECUTION:
  Launch 5a + 5b + 5c simultaneously as independent Task agents.
  Wait for ALL to complete before proceeding.
  If any returns BLOCK → fix findings, re-run the blocking check only.
```

### 5a. Preflight (Spec Compliance + Logic)
**REQUIRED SUB-SKILL**: Use `rune:preflight`
- Spec compliance: compare approved plan vs actual diff
- Logic review, error handling, completeness

### 5b. Security
**REQUIRED SUB-SKILL**: Use `rune:sentinel`
- Secret scan, OWASP check (no injection/XSS/CSRF), dependency audit

### 5c. Code Review
**REQUIRED SUB-SKILL**: Use `rune:review`
- Pattern compliance, code quality, performance bottlenecks

### 5d. Completion Gate
**REQUIRED SUB-SKILL**: Use `rune:completion-gate`
- Validate agent claims match evidence trail (tests ran, files changed, build passed)
- No truncated code files (`// ...`, `// rest of code`, bare ellipsis) — agent MUST complete all output
- Any UNCONFIRMED claim → BLOCK

**Gate**: If sentinel finds CRITICAL security issue → STOP, fix it, re-run. Non-negotiable.
**Gate**: If completion-gate finds UNCONFIRMED claim → STOP, re-verify. Non-negotiable.

## Checkpoint Protocol (Opt-In)

Invoke `rune:session-bridge` after Phase 2, 4, and 5 to save intermediate state. OPT-IN — activate only if task spans 3+ phases, context-watch is ORANGE, or user explicitly requests checkpoints.

## Phase Transition Protocol (MANDATORY)

Before entering ANY Phase N+1, assert: Phase N `completed` in TodoWrite | gate condition met | no BLOCK from sub-skills | no unresolved CRITICAL findings. If any fails → STOP, log "BLOCKED at Phase N→N+1: [assertion]", fix, re-check.

**Key transitions:** 1→2: scout done | 2→3: plan approved | 3→4: failing tests exist | 4→5: all tests pass | 5→6: no CRITICAL findings | 6→7: lint+types+build green.

## Phase 6: VERIFY

**REQUIRED SUB-SKILL**: Use `rune:verification` — run lint, type check, full test suite, build. Then `rune:hallucination-guard` to verify imports and API signatures. ALL checks MUST pass before commit.

## Phase 7: COMMIT

**RECOMMENDED SUB-SKILL**: Use `rune:git` — stage specific files (`git add <files>`, NOT `git add .`), generate semantic commit message from diff. If working from master plan: update phase status `🔄 → ✅`, announce next phase or "All phases complete."

## Phase 8: BRIDGE

**Goal**: Save context for future sessions and record metrics for mesh analytics.

**REQUIRED SUB-SKILL**: Use `rune:session-bridge`

1. Mark Phase 8 as `in_progress`
2. Save to `.rune/decisions.md` (approach + trade-offs), `.rune/progress.md` (task complete), `.rune/conventions.md` (new patterns)
3. **Skill metrics** → `.rune/metrics/skills.json`: increment phase run/skip counts, quality gate results, debug loop counts under `cook` key
4. **Routing overrides** (H3): if Phase 4 hit max loops for an error pattern → write rule to `.rune/metrics/routing-overrides.json`. Max 10 active rules.
5. **Step 8.5 — Capture Learnings**: `neural-memory` (Capture Mode) — 2-5 memories: architecture decisions, patterns, error root-causes, trade-offs. Cognitive language (causal/decisional/comparative). Tags: `[project, tech, topic]`. Priority 5 routine / 7-8 decisions / 9-10 critical errors.
6. Mark Phase 8 as `completed`

## Autonomous Loop Patterns

When cook runs inside `team` (L1) or autonomous workflows, these patterns apply.

### De-Sloppify Pass

After Phase 4, if implementation touched 5+ files: re-read all modified files, check for leftover debug statements, inconsistent naming, duplicated logic, missing error handling. Fix issues found (still Phase 4).

### Continuous PR Loop (team orchestration only)

```
cook instance → commit → push → create PR → wait CI
  IF CI passes → mark workstream complete
  IF CI fails → read CI output → fix → push → wait CI (max 3 retries)
  IF 3 retries fail → escalate to user with CI logs
```

### Formal Pause/Resume (`.continue-here.md`)

<MUST-READ path="references/pause-resume-template.md" trigger="when cook must pause mid-phase (context limit, user break, session end)"/>

When cook must pause mid-phase, create `.rune/.continue-here.md` with structured handoff, then WIP commit. Phase 0 detects it on resume. More granular than plan-level resume — resumes within a phase.

### Mid-Run Signal Detection

<MUST-READ path="references/mid-run-signals.md" trigger="when user sends a message DURING cook execution"/>

Two-stage intent classification: keyword fast-path for short messages (<60 chars), context classification for longer ones. Never queue user messages — process immediately.

<HARD-GATE>
NEVER treat a Cancel/Pause signal as a Steer or NewTask. User safety signals take absolute priority.
If ambiguous between Cancel and Steer → ask user: "Did you mean stop, or change approach?"
</HARD-GATE>

### Exit Conditions (Mandatory for Autonomous Runs)

<MUST-READ path="references/exit-conditions.md" trigger="cook running inside team or any autonomous workflow"/>

Hard caps: MAX_DEBUG_LOOPS=3, MAX_QUALITY_LOOPS=2, MAX_REPLAN=1, MAX_PIVOT=1, MAX_FIXES=30, WTF_THRESHOLD=20%.
Escalation chain: debug-fix (3x) → re-plan (1x) → brainstorm rescue (1x) → THEN escalate to user.

### Subagent Status Protocol

<MUST-READ path="references/subagent-status.md" trigger="when cook or any sub-skill needs to return a status"/>

Cook and all sub-skills return: `DONE` | `DONE_WITH_CONCERNS` | `NEEDS_CONTEXT` | `BLOCKED`.

## Deviation Rules

<MUST-READ path="references/deviation-rules.md" trigger="when implementation diverges from the approved plan"/>

R1-R3 (bug/security/blocking fix): auto-fix, continue. R4 (architectural change): ASK user first.

## Error Recovery

<MUST-READ path="references/error-recovery.md" trigger="when any phase fails or a task hits repeated errors"/>

Includes phase-by-phase failure handling and repair operators (RETRY → DECOMPOSE → PRUNE) with a 2-attempt budget before escalation.

## Analysis Paralysis Guard

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

### Hash-Based Tool Loop Detection

<MUST-READ path="references/loop-detection.md" trigger="when same tool+args+result appears to be repeating"/>

Mentally track tool call fingerprints. 3 identical calls → WARN. 5 identical calls → FORCE STOP. Only same-input-AND-same-output counts as a loop.

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
| 2 | `plan` | L2 | Create implementation plan |
| 2 | `brainstorm` | L2 | Trade-off analysis / rescue mode |
| 2 | `design` | L2 | UI/design phase for frontend features |
| 2.5 | `adversary` | L2 | Red-team challenge on approved plan |
| 3 | `test` | L2 | Write failing tests (RED phase) |
| 4 | `fix` | L2 | Implement code changes (GREEN phase) |
| 4 | `debug` | L2 | Unexpected errors (max 3 loops) |
| 4 | `db` | L2 | Schema changes detected in diff |
| 4 | `worktree` | L3 | Worktree isolation for parallel implementation |
| 5a | `preflight` | L2 | Spec compliance + logic review |
| 5b | `sentinel` | L2 | Security scan |
| 5c | `review` | L2 | Code quality review |
| 5 | `perf` | L2 | Performance regression check (optional) |
| 5 | `audit` | L2 | Project health audit when scope warrants |
| 5 | `review-intake` | L2 | Structured review intake for complex PRs |
| 5 | `sast` | L3 | Static analysis security testing |
| 5d | `completion-gate` | L3 | Validate agent claims against evidence trail |
| 5 | `constraint-check` | L3 | Audit HARD-GATE compliance across workflow |
| 6 | `verification` | L3 | Lint + types + tests + build |
| 6 | `hallucination-guard` | L3 | Verify imports and API calls are real |
| 7 | `journal` | L3 | Record architectural decisions |
| 8 | `session-bridge` | L3 | Save context for future sessions |
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
| Scout Gate | scout output before Phase 2 | Invoke rune:scout first |
| Plan Gate | User-approved plan before Phase 3 | Cannot proceed |
| Adversary Gate | adversary verdict before Phase 3 for features | Skip for bugfix/hotfix/refactor |
| Phase File Gate | Active phase file only (multi-session) | Load only active phase |
| Test-First Gate | Failing tests before Phase 4 | Write tests or get explicit skip |
| Quality Gate | preflight + sentinel + review before Phase 7 | Fix findings, re-run |
| Verification Gate | lint + types + tests + build green before commit | Fix, re-run |

## Output Format

<MUST-READ path="references/output-format.md" trigger="before emitting the Cook Report at end of any session"/>

Emit a Cook Report with: Status, Phases, Files Changed, Tests, Quality results, Commit hash.
When invoked by `team` with a NEXUS Handoff, include the Deliverables table — MANDATORY.

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
- [ ] Cook Report contains actual commit hash, not placeholder
```

## Done When

All applicable phases complete + Self-Validation passed:
- User approved plan | All tests PASS (output shown) | preflight+sentinel+review PASS | build green
- Cook Report emitted with commit hash | Session state saved to .rune/ via session-bridge

## Cost Profile

~$0.05-0.15 per feature. Haiku for scanning (Phase 1), sonnet for coding (Phase 3-4), opus for complex planning (Phase 2 when needed).
