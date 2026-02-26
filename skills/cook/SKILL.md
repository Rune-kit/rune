---
name: cook
description: "Feature implementation orchestrator. Use when user says 'implement', 'build', 'add feature', 'create', or invokes /rune cook. Runs full TDD cycle: understand → plan → test → implement → quality → verify → commit."
metadata:
  author: runedev
  version: "0.2.0"
  layer: L1
  model: sonnet
  group: orchestrator
---

# cook

The primary orchestrator for feature implementation. Coordinates the entire L2 mesh in a phased TDD workflow.

<HARD-GATE>
Before starting ANY implementation:
1. You MUST understand the codebase first (Phase 1)
2. You MUST have a plan before writing code (Phase 2)
3. You MUST write failing tests before implementation (Phase 3) — unless explicitly skipped
This applies to EVERY feature regardless of perceived simplicity.
</HARD-GATE>

## Phase Skip Rules

Not every task needs every phase:

```
Simple bug fix:      Phase 1 → 4 → 6 → 7
Small refactor:      Phase 1 → 4 → 5 → 6 → 7
New feature:         All 8 phases
Complex feature:     All 8 phases + brainstorm in Phase 2
Security-sensitive:  All 8 phases + sentinel escalated to opus
Fast mode:           Phase 1 → 4 → 6 → 7 (auto-detected, see below)
```

Determine complexity BEFORE starting. Create TodoWrite with applicable phases.

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

## Phase 1: UNDERSTAND

**Goal**: Know what exists before changing anything.

**REQUIRED SUB-SKILL**: Use `rune:scout`

1. Create TodoWrite with all applicable phases for this task
2. Mark Phase 1 as `in_progress`
3. Invoke scout to scan the codebase:
   - Use `Glob` to find files matching the feature domain (e.g., `**/*auth*`, `**/*user*`)
   - Use `Grep` to search for related patterns, imports, existing implementations
   - Use `Read` to examine key files identified
4. Summarize findings:
   - What exists already
   - What patterns/conventions the project uses
   - What files will likely need to change
5. Mark Phase 1 as `completed`

**Gate**: If scout finds the feature already exists → STOP and inform user.

## Phase 2: PLAN

**Goal**: Break the task into concrete implementation steps before writing code.

**REQUIRED SUB-SKILL**: Use `rune:plan`

1. Mark Phase 2 as `in_progress`
2. Based on scout findings, create an implementation plan:
   - List exact files to create/modify
   - Define the order of changes
   - Identify dependencies between steps
3. If multiple valid approaches exist → invoke `rune:brainstorm` for trade-off analysis
4. Present plan to user for approval
5. Mark Phase 2 as `completed`

**Gate**: User MUST approve the plan before proceeding. Do NOT skip this.

## Phase 3: TEST (TDD Red)

**Goal**: Define expected behavior with failing tests BEFORE writing implementation.

**REQUIRED SUB-SKILL**: Use `rune:test`

1. Mark Phase 3 as `in_progress`
2. Write test files based on the plan:
   - Use `Write` to create test files
   - Cover the primary use case + edge cases
   - Tests MUST be runnable
3. Run the tests to verify they FAIL:
   - Use `Bash` to execute the test command (e.g., `pytest`, `npm test`, `cargo test`)
   - Expected: tests FAIL (red) because implementation doesn't exist yet
4. Mark Phase 3 as `completed`

**Gate**: Tests MUST exist and MUST fail. If tests pass without implementation → tests are wrong, rewrite them.

## Phase 4: IMPLEMENT (TDD Green)

**Goal**: Write the minimum code to make tests pass.

**REQUIRED SUB-SKILL**: Use `rune:fix`

1. Mark Phase 4 as `in_progress`
2. Implement the feature following the plan:
   - Use `Write` for new files
   - Use `Edit` for modifying existing files
   - Follow project conventions found in Phase 1
3. Run tests after each significant change:
   - Use `Bash` to run tests
   - If tests pass → continue to next step in plan
   - If tests fail → debug and fix
4. If stuck on unexpected errors → invoke `rune:debug` (max 3 debug↔fix loops)
5. All tests MUST pass before proceeding
6. Mark Phase 4 as `completed`

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
- **Spec compliance**: Compare approved plan (Phase 2) vs actual diff — did we build what we planned?
- Logic review: Are there obvious bugs?
- Error handling: Are errors caught properly?
- Completeness: Does it cover edge cases?

### 5b. Security
**REQUIRED SUB-SKILL**: Use `rune:sentinel`
- Secret scan: No hardcoded keys/tokens
- OWASP check: No injection, XSS, CSRF vulnerabilities
- Dependency audit: No known vulnerable packages

### 5c. Code Review
**REQUIRED SUB-SKILL**: Use `rune:review`
- Pattern compliance: Follows project conventions
- Code quality: Clean, readable, maintainable
- Performance: No obvious bottlenecks

### 5d. Completion Gate
**REQUIRED SUB-SKILL**: Use `rune:completion-gate`
- Validate that agent claims match evidence trail
- Check: tests actually ran (stdout captured), files actually changed (git diff), build actually passed
- Any UNCONFIRMED claim → BLOCK with specific gap identified

**Gate**: If sentinel finds CRITICAL security issue → STOP, fix it, re-run. Non-negotiable.
**Gate**: If completion-gate finds UNCONFIRMED claim → STOP, re-verify. Non-negotiable.

## Checkpoint Protocol (Opt-In)

For long-running cook sessions, save intermediate state at phase boundaries:

```
After Phase 2 (PLAN approved):    session-bridge saves plan + decisions
After Phase 4 (IMPLEMENT done):   session-bridge saves progress + modified files
After Phase 5 (QUALITY passed):   session-bridge saves quality results

Trigger: Invoke rune:session-bridge at each boundary.
This is OPT-IN — only activate if:
  - Task spans 3+ phases
  - Context-watch has triggered a warning
  - User explicitly requests checkpoints
```

## Phase 6: VERIFY

**Goal**: Final automated verification before commit.

**REQUIRED SUB-SKILL**: Use `rune:verification`

1. Mark Phase 6 as `in_progress`
2. Run full verification suite:
   - Lint check (e.g., `eslint`, `ruff`, `clippy`)
   - Type check (e.g., `tsc --noEmit`, `mypy`, `cargo check`)
   - Full test suite (not just new tests)
   - Build (e.g., `npm run build`, `cargo build`)
3. Use `rune:hallucination-guard` to verify:
   - All imports reference real modules
   - API calls use correct signatures
   - No phantom dependencies
4. Mark Phase 6 as `completed`

**Gate**: ALL checks MUST pass. If any fail → fix and re-run. Do NOT commit broken code.

## Phase 7: COMMIT

**Goal**: Create a clean, semantic commit.

1. Mark Phase 7 as `in_progress`
2. Stage changed files:
   - Use `Bash` to run `git add <specific files>` (NOT `git add .`)
   - Verify staged files with `git status`
3. Create commit with semantic message:
   - Format: `<type>: <description>`
   - Types: feat, fix, refactor, test, docs, chore
   - Use `Bash` to run `git commit -m "<message>"`
4. Mark Phase 7 as `completed`

## Phase 8: BRIDGE

**Goal**: Save context for future sessions.

**REQUIRED SUB-SKILL**: Use `rune:session-bridge`

1. Mark Phase 8 as `in_progress`
2. Save decisions to `.rune/decisions.md`:
   - What approach was chosen and why
   - Any trade-offs made
3. Update `.rune/progress.md` with completed task
4. Update `.rune/conventions.md` if new patterns were established
5. Mark Phase 8 as `completed`

## Error Recovery

| Phase | If this fails... | Do this... |
|-------|-----------------|------------|
| 1 UNDERSTAND | scout finds nothing relevant | Proceed with plan, note limited context |
| 2 PLAN | Task too complex | Break into smaller tasks, consider `rune:team` |
| 3 TEST | Can't write tests (no test framework) | Skip TDD, write tests after implementation |
| 4 IMPLEMENT | Fix hits repeated bugs | `rune:debug` (max 3 loops), then escalate to user |
| 5a PREFLIGHT | Logic issues found | Fix → re-run preflight |
| 5b SENTINEL | Security CRITICAL found | Fix immediately → re-run (mandatory) |
| 5c REVIEW | Code quality issues | Fix CRITICAL/HIGH → re-review (max 2 loops) |
| 6 VERIFY | Build/lint/type fails | Fix → re-run verification |

## Called By (inbound)

- User: `/rune cook` direct invocation — primary entry point
- `team` (L1): parallel workstream execution (meta-orchestration)

## Calls (outbound)

- `scout` (L2): Phase 1 — scan codebase before planning
- `onboard` (L2): Phase 1 — if no CLAUDE.md exists, initialize project context first
- `plan` (L2): Phase 2 — create implementation plan
- `brainstorm` (L2): Phase 2 — trade-off analysis when multiple approaches exist
- `design` (L2): Phase 2 — UI/design phase when building frontend features
- `test` (L2): Phase 3 — write failing tests (RED phase)
- `fix` (L2): Phase 4 — implement code changes (GREEN phase)
- `debug` (L2): Phase 4 — when implementation hits unexpected errors (max 3 loops)
- `db` (L2): Phase 4 — when schema changes are detected in the diff
- `preflight` (L2): Phase 5a — logic and completeness review
- `sentinel` (L2): Phase 5b — security scan
- `review` (L2): Phase 5c — code quality review
- `perf` (L2): Phase 5 — performance regression check before PR (optional)
- `completion-gate` (L3): Phase 5d — validate agent claims against evidence trail
- `constraint-check` (L3): Phase 5 — audit HARD-GATE compliance across workflow
- `verification` (L3): Phase 6 — automated checks (lint, types, tests, build)
- `hallucination-guard` (L3): Phase 6 — verify imports and API calls are real
- `journal` (L3): Phase 7 — record architectural decisions made during feature
- `session-bridge` (L3): Phase 8 — save context for future sessions

## Constraints

1. MUST run scout before planning — no plan based on assumptions alone
2. MUST present plan to user and get approval before writing code
3. MUST write failing tests before implementation (TDD) unless explicitly skipped by user
4. MUST NOT commit with failing tests — fix or revert first
5. MUST NOT modify files outside the approved plan scope without user confirmation
6. MUST run verification (lint + type-check + tests + build) before commit — not optional
7. MUST NOT say "all tests pass" without showing the actual test output

## Mesh Gates

| Gate | Requires | If Missing |
|------|----------|------------|
| Scout Gate | scout output (files examined, patterns found) before Phase 2 | Invoke rune:scout first |
| Plan Gate | User-approved plan with file paths before Phase 3 | Cannot proceed to TEST |
| Test-First Gate | Failing tests exist before Phase 4 IMPLEMENT | Write tests first or get explicit skip from user |
| Quality Gate | preflight + sentinel + review passed before Phase 7 COMMIT | Fix findings, re-run |
| Verification Gate | lint + types + tests + build all green before commit | Fix failures, re-run |

## Output Format

```
## Cook Report: [Task Name]
- **Status**: complete | partial | blocked
- **Phases**: [list of completed phases]
- **Files Changed**: [count] ([list])
- **Tests**: [passed]/[total] ([coverage]%)
- **Quality**: preflight [PASS/WARN] | sentinel [PASS/WARN] | review [PASS/WARN]
- **Commit**: [hash] — [message]

### Decisions Made
- [decision]: [rationale]

### Session State
- Saved to .rune/decisions.md
- Saved to .rune/progress.md
```

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Skipping scout to "save time" on a simple task | CRITICAL | Scout Gate blocks this — Phase 1 is mandatory regardless of perceived simplicity |
| Writing code without user-approved plan | HIGH | Plan Gate: do NOT proceed to Phase 3 without explicit approval ("go", "proceed", "yes") |
| Claiming "all tests pass" without showing output | HIGH | Constraint 7 blocks this — show actual test runner output via completion-gate |
| Entering debug↔fix loop more than 3 times without escalating | MEDIUM | After 3 loops, stop and present to user — do not keep spinning |
| Not escalating to sentinel:opus on security-sensitive tasks | MEDIUM | Auth, crypto, payment code → sentinel must run at opus, not sonnet |
| Running Phase 5 checks sequentially instead of parallel | MEDIUM | Launch preflight+sentinel+review as parallel Task agents for speed |
| Saying "done" without evidence trail | CRITICAL | completion-gate validates claims — UNCONFIRMED = BLOCK |
| Fast mode on security-relevant code | HIGH | Fast mode auto-excludes auth/crypto/payments — never fast-track security code |

## Done When

- All applicable phases complete per Phase Skip Rules (determined before starting)
- User has approved the plan (Phase 2 gate — explicit "go" received)
- All tests PASS — actual test runner output shown
- preflight + sentinel + review all PASS or findings addressed
- verification (lint + types + build) green
- Commit created with semantic message
- Cook Report emitted with commit hash and phase list
- Session state saved to .rune/ via session-bridge

## Cost Profile

~$0.05-0.15 per feature. Haiku for scanning (Phase 1), sonnet for coding (Phase 3-4), opus for complex planning (Phase 2 when needed).
