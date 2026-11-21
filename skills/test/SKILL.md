---
name: test
description: "TDD test writer. Use before implementing any feature or fix (write the failing test first), when the user asks to 'write tests', or when coverage is missing. Writes failing tests FIRST (red), then verifies they pass after implementation (green). Covers unit, integration, and e2e tests."
metadata:
  author: runedev
  version: "1.4.0"
  layer: L2
  model: sonnet
  group: development
  tools: "Read, Write, Edit, Bash, Glob, Grep"
  emit: tests.passed, tests.failed
  listen: code.changed, db.migrated
---

# test

<HARD-GATE>
Tests define the EXPECTED BEHAVIOR. They MUST be written BEFORE implementation code.
If tests pass without implementation → the tests are wrong. Rewrite them.
The only exception: when retrofitting tests for existing untested code.

THE IRON LAW: Write code before test? DELETE IT. Start over.
- Do NOT keep it as "reference"
- Do NOT "adapt" it while writing tests
- Do NOT look at it to "inform" test design
- Delete means delete. `git checkout -- <file>` or remove the changes entirely.
This is not negotiable. This is not optional. "But I already wrote it" is a sunk cost fallacy.

ROLE BOUNDARY: Test writes TEST FILES only. NEVER modify source/implementation files.
- Do NOT "quickly fix" a broken import in source to make tests run
- Do NOT refactor source code to be "more testable"
- Do NOT add missing exports to source files
- If source needs changes → hand off to `rune:fix`. Test's job ends at the test file.
This separation ensures test never writes code biased toward passing its own tests.

VERTICAL SLICING (Iron Law extension): one test → GREEN → one test → GREEN. Never bulk.
- bulk_test_count MUST stay <= 1 before the first GREEN in a session
- After each GREEN, bulk_test_count resets to 0; writing 2+ tests before the next GREEN = HORIZONTAL VIOLATION
- Each cycle MUST emit a commit pair: `test(scope): <behavior>` + `feat(scope): <behavior>`
- Claim "I did TDD" is verified by `completion-gate` against `git log --oneline` — no paired commits = REJECTED
- Horizontal slicing produces tests-of-imagination, not tests-of-behavior. See [references/vertical-tdd.md](references/vertical-tdd.md).
- Emit signal `tdd.horizontal.violation` when triggered; preflight blocks merge until cycles are unwound.
Exceptions (narrow, must be documented in test header): retrofitting characterization tests for legacy untested code; spec-driven scaffolding where the contract is external (OpenAPI, wire protocol).
</HARD-GATE>

## Instructions

### Phase 1: Understand What to Test

1. Read the implementation plan or task description carefully
2. Use `Glob` to find existing test files: `**/*.test.*`, `**/*.spec.*`, `**/test_*`
3. Use `Read` on 2-3 existing test files to understand:
   - Test framework in use
   - File naming convention (e.g., `foo.test.ts` mirrors `foo.ts`)
   - Test directory structure (co-located vs `__tests__/` vs `tests/`)
   - Assertion style and patterns
4. Use `Glob` to find the source file(s) being tested

```
TodoWrite: [
  { content: "Understand scope and find existing test patterns", status: "in_progress" },
  { content: "Detect test framework and conventions", status: "pending" },
  { content: "Write failing tests (RED phase)", status: "pending" },
  { content: "Run tests — verify they FAIL", status: "pending" },
  { content: "After implementation: verify tests PASS (GREEN phase)", status: "pending" }
]
```

### Phase 2: Detect Test Framework

Use `Glob` to find config files and identify the framework:

- `jest.config.*` or `"jest"` key in `package.json` → Jest
- `vitest.config.*` or `"vitest"` key in `package.json` → Vitest
- `pytest.ini`, `[tool.pytest.ini_options]` in `pyproject.toml` → pytest
  - **Async check**: If pytest detected AND source files contain `async def`:
    - Check if `pytest-asyncio` is in dependencies (`pyproject.toml [project.dependencies]` or `[project.optional-dependencies]`)
    - Check if `asyncio_mode` is set in `[tool.pytest.ini_options]` (values: `auto`, `strict`, or absent)
    - If async code exists but no `asyncio_mode` configured → **WARN**: "pytest-asyncio not configured. Async tests may silently pass without executing async code. Recommend adding `asyncio_mode = \"auto\"` to `[tool.pytest.ini_options]` in pyproject.toml."
- `Cargo.toml` with `#[cfg(test)]` pattern → built-in `cargo test`
- `*_test.go` files present → built-in `go test`
- `cypress.config.*` → Cypress (E2E)
- `playwright.config.*` → Playwright (E2E)

**Verification gate**: Framework identified before writing any test code.

### Phase 3: Write Failing Tests

Use `Write` to create test files following the detected conventions:

1. Mirror source file location: if source is `src/auth/login.ts`, test is `src/auth/login.test.ts`
2. Structure tests with clear `describe` / `it` blocks (or language equivalent):
   - `describe('Feature name')`
     - `it('should [expected behavior] when [condition]')`
3. Cover all three categories:
   - **Happy path**: valid inputs, expected success output
   - **Edge cases**: empty input, boundary values, large input
   - **Error cases**: invalid input, missing data, network failure simulation

4. Use proper assertions. Do NOT use implementation details — test behavior:
   - Jest/Vitest: `expect(result).toBe(expected)`
   - pytest: `assert result == expected`
   - Rust: `assert_eq!(result, expected)`
   - Go: `if result != expected { t.Errorf(...) }`

5. For async code: use `async/await` or pytest `@pytest.mark.asyncio`

#### Python Async Tests (pytest-asyncio)

> Full detail moved to [`references/python-async.md`](references/python-async.md) (progressive disclosure). **Read that file before executing this section.**

### Phase 3.5: Cycle Discipline (Vertical Slicing Gate)

Before running the new test in Phase 4, count what's about to be added to the working tree:

```
bulk_test_count = (test files staged + test files unstaged but new) since the last GREEN commit
```

**Gate**: `bulk_test_count` MUST be exactly 1.

| State | Action |
|-------|--------|
| `bulk_test_count == 1` | Proceed to Phase 4 (run RED). |
| `bulk_test_count >= 2` AND no prior GREEN this session | HORIZONTAL VIOLATION — pause, keep one test, defer the rest. |
| `bulk_test_count >= 2` AND last GREEN exists in `git log` | HORIZONTAL VIOLATION — same. |
| `bulk_test_count == 0` | No test to run; this phase is a no-op. |

**Cycle audit log** — append to TEST.md (or create) one line per cycle:

```
cycle 1 — RED: test_validates_email_rejects_empty | GREEN: validateEmail handles empty | commit: 4f3a1c
cycle 2 — RED: test_validates_email_requires_at_sign | GREEN: validateEmail checks @ | commit: a92e0d
```

The audit log is the receipt. `completion-gate` reads it.

When the violation fires, do NOT delete tests automatically — surface to the calling agent: "horizontal slicing detected (N tests before first GREEN). Recommend keeping test K, deferring N-1 to subsequent cycles."

### Phase 4: Run Tests — Verify They FAIL (RED)

Use `Bash` to run ONLY the newly created test files (not full suite):

- **Jest**: `npx jest path/to/test.ts --no-coverage`
- **Vitest**: `npx vitest run path/to/test.ts`
- **pytest**: `pytest path/to/test_file.py -v` (if async tests and no `asyncio_mode` in config: add `--asyncio-mode=auto`)
- **Rust**: `cargo test test_module_name`
- **Go**: `go test ./path/to/package/... -run TestFunctionName`

**Hard gate**: ALL new tests MUST fail at this point.

- If ANY test passes before implementation exists → that test is not testing real behavior. Rewrite it to be stricter.
- If tests fail with import/syntax errors (not assertion errors) → fix the test code, re-run

### Phase 5: After Implementation — Verify Tests PASS (GREEN)

After `rune:fix` writes implementation code, run the same test command again:

1. ALL tests in the new test files MUST pass
2. Run the full test suite with `Bash` to check for regressions:
   - `npm test`, `pytest`, `cargo test`, `go test ./...`
3. If any test fails: report clearly which test, what was expected, what was received
4. If an existing test now fails (regression): escalate to `rune:debug`

**Verification gate**: 100% of new tests pass AND 0 regressions in existing tests.

### Phase 6: Coverage Check

After GREEN phase, call `verification` to check coverage threshold (80% minimum):

- If coverage drops below 80%: identify uncovered lines, write additional tests
- Report coverage gaps with file:line references

### Phase 6.5: Diff-Aware Mode (optional)

When invoked with `mode: "diff-aware"` or by `cook` after implementation:

1. Run `git diff main --name-only` to get changed files
2. For each changed file, trace its **blast radius**: what imports it? what routes does it serve? what components render it?
3. Map changed files → affected routes/endpoints/pages
4. Prioritize tests: files with most downstream dependents get tested first
5. Generate targeted test commands that cover ONLY affected paths — skip unchanged modules

This mode is valuable for large codebases where running the full suite is slow. It answers: "what could this diff have broken?"

```
Input:  git diff main --name-only
Output: Prioritized test plan targeting only affected paths
```

## Test Types — 4-Layer Methodology

> Full detail moved to [`references/test-types.md`](references/test-types.md) (progressive disclosure). **Read that file before executing this section.**

## TEST.md — Test Plan + Results Document

> Full detail moved to [`references/test-plan-doc.md`](references/test-plan-doc.md) (progressive disclosure). **Read that file before executing this section.**

## Skill Behavior Tests (Eval Scenarios)

> Full detail moved to [`references/evals.md`](references/evals.md) (progressive disclosure). **Read that file before executing this section.**


## Error Recovery

- If test framework not found: ask calling skill to specify, or check `package.json` `devDependencies`
- If `Write` to test file fails: check if directory exists, create it first with `Bash mkdir -p`
- If tests error on import (module not found): check that source file path is correct, adjust imports
- If `Bash` test runner hangs beyond 120 seconds: kill and report as TIMEOUT

## Called By (inbound)

- `cook` (L1): Phase 3 TEST — write tests first
- `fix` (L2): verify fix passes tests
- `review` (L2): untested edge case found → write test for it
- `deploy` (L2): pre-deployment full test suite
- `preflight` (L2): run targeted regression tests on affected code
- `surgeon` (L2): verify refactored code
- `launch` (L1): pre-deployment test suite
- `safeguard` (L2): writing characterization tests for legacy code
- `review-intake` (L2): write tests for issues identified during review intake
- `scaffold` (L1): generate initial test suite for new project
- `graft` (L2): write integration tests for grafted code
- `skill-forge` (L2): write tests for new skill functionality
- `mcp-builder` (L2): write tests for MCP server tools
- `debug` (L2): write regression test capturing the bug
- `plan` (L2): reference test requirements in implementation plan

## Calls (outbound)

- `verification` (L3): Phase 6 — coverage check (80% minimum threshold)
- `browser-pilot` (L3): Phase 4 — e2e and visual testing for UI flows
- `debug` (L2): Phase 5 — when existing test regresses unexpectedly

## Data Flow

### Feeds Into →

- `cook` (L1): test results (pass/fail/coverage) → cook's Phase 5 quality gate evidence
- `completion-gate` (L3): test runner stdout → evidence for "tests pass" claims
- `fix` (L2): failing test output → fix's target (what to make green)

### Fed By ←

- `plan` (L2): phase file test tasks → test's RED phase targets (what to test)
- `review` (L2): untested edge cases found during review → new test targets
- `fix` (L2): implemented code → test's GREEN phase verification target

### Feedback Loops ↻

- `test` ↔ `fix`: test writes failing tests (RED) → fix implements to pass → test verifies (GREEN) → if new failures emerge, loop continues
- `test` ↔ `debug`: test discovers regression → debug diagnoses root cause → test writes regression test to prevent recurrence

## Anti-Rationalization Table

| Excuse | Reality |
|---|---|
| "Too simple to need tests first" | Simple code breaks. Test takes 30 seconds. Write it first. |
| "I'll write tests after — same result" | Tests-after = "what does this do?" Tests-first = "what SHOULD this do?" Completely different. |
| "I already wrote the code, let me just add tests" | Iron Law: delete the code. Start over with tests. Sunk cost is not an argument. |
| "Tests after achieve the same goals" | They don't. Tests-after are biased by the implementation you just wrote. |
| "It's about spirit not ritual" | Violating the letter IS violating the spirit. Write the test first. |
| "I mentally tested it" | Mental testing is not testing. Run the command, show the output. |
| "This is different because..." | It's not. Write the test first. |
| "I'll batch the tests since they're related" | Batched tests = tests of imagination. Each cycle reacts to the prior. Write one, GREEN it, then the next. |
| "All five tests are already written, let me just review them with you" | Same fallacy as code-before-test. Keep the first one, defer the others to subsequent cycles. |

## Advanced: Oracle-Injection E2E Testing

> Full detail moved to [`references/oracle-e2e.md`](references/oracle-e2e.md) (progressive disclosure). **Read that file before executing this section.**


## Spec→Test Traceability

> Full detail moved to [`references/traceability.md`](references/traceability.md) (progressive disclosure). **Read that file before executing this section.**

## Eval-Driven Development

> Full detail moved to [`references/evals.md`](references/evals.md) (progressive disclosure). **Read that file before executing this section.**

## Red Flags — STOP and Start Over

If you catch yourself with ANY of these, delete implementation code and restart with tests:

- Code exists before test file
- "I already manually tested it"
- "Tests after achieve the same purpose"
- "It's about spirit not ritual"
- "This is different because..."
- "Let me just finish this, then add tests"

**All of these mean: Delete code. Start over with TDD.**

## Constraints

1. MUST write tests BEFORE implementation code — if tests pass without implementation, they are wrong
2. MUST cover happy path + edge cases + error cases — not just happy path
3. MUST run tests to verify they FAIL before implementation exists (RED phase is mandatory)
4. MUST NOT write tests that test mock behavior instead of real code behavior
5. MUST achieve 80% coverage minimum — identify and fill gaps
6. MUST use the project's existing test framework and conventions — don't introduce a new one
7. MUST NOT say "tests pass" without showing actual test runner output
8. MUST delete implementation code written before tests — Iron Law, no exceptions
9. MUST show RED phase output (actual failure) — "I confirmed they fail" without output is REJECTED
10. MUST NOT modify source/implementation files — test writes test files ONLY, hand off source changes to rune:fix
11. MUST NOT write a 2nd test until the 1st test reaches GREEN — vertical slicing only, bulk_test_count <= 1 enforced
12. MUST emit commit pair per cycle (`test:` then `feat:`) — git log is the audit trail for "I did TDD" claims

## Mesh Gates

| Gate | Requires | If Missing |
|------|----------|------------|
| RED Gate | All new tests FAIL before implementation | If any pass, rewrite stricter tests |
| GREEN Gate | All tests PASS after implementation | Fix code, not tests |
| Coverage Gate | 80%+ coverage verified via verification | Write additional tests for gaps |

## Output Format

```
## Test Report
- **Framework**: [detected]
- **Files Created**: [list of new test file paths]
- **Tests Written**: [count]
- **Status**: RED (failing as expected) | GREEN (all passing)

### Test Cases
| Test | Status | Description |
|------|--------|-------------|
| `test_name` | FAIL/PASS | [what it tests] |

### Coverage
- Lines: [X]% | Branches: [Y]%
- Gaps: `path/to/file.ts:42-58` — uncovered branch (error handling)

### Regressions (if any)
- [existing test that broke, with error details]
```

## Testing Anti-Patterns (Gate Functions)

> Full detail moved to [`references/testing-anti-patterns.md`](references/testing-anti-patterns.md) (progressive disclosure). **Read that file before executing this section.**

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| Test files | Source files | Co-located or `__tests__/` per project convention |
| Test plan + results | Markdown | `TEST.md` in test directory (non-trivial features only) |
| Eval scenarios | Markdown | `skills/<name>/evals.md` (for skill behavior testing) |
| Coverage report | Inline stdout | Shown in Test Report |
| Test Report | Markdown (inline) | Emitted to calling skill (cook, fix, review) |

## Chain Metadata

Append to Test Report when invoked standalone. Suppress when called as sub-skill inside an L1 orchestrator (cook, team, etc.) — the orchestrator emits a consolidated block. See `docs/references/chain-metadata.md`.

```yaml
chain_metadata:
  skill: "rune:test"
  version: "1.2.0"
  status: "[DONE]"
  domain: "[area tested]"
  files_changed:
    - "[test files created/modified]"
  exports:
    test_results: { passed: [N], failed: [N], coverage: [N] }
    test_files: ["[paths to test files]"]
    status: "[RED | GREEN]"  # RED = TDD failing (expected), GREEN = all pass
  suggested_next:  # status-aware — pick based on RED or GREEN
    # When GREEN:
    - skill: "rune:preflight"
      reason: "[grounded in results — e.g., 'All 15 tests GREEN, check edge case completeness']"
      consumes: ["test_results", "test_files"]
    # When RED (TDD expected):
    - skill: "rune:fix"
      reason: "[grounded in failures — e.g., '3 tests RED as expected, implement to make them pass']"
      consumes: ["test_results", "test_files"]
```

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Tests passing before implementation exists | CRITICAL | RED Gate: rewrite stricter tests — passing without code = not testing real behavior |
| Skipping the RED phase (not confirming FAIL) | HIGH | Run tests, confirm FAIL output before calling cook/fix to implement |
| Testing mock behavior instead of real code | HIGH | Anti-Pattern 1 gate: "Am I testing real behavior or mock existence?" |
| Mocking without understanding side effects | HIGH | Anti-Pattern 3 gate: run with real impl first, observe side effects, THEN mock minimally |
| Incomplete mocks missing downstream fields | HIGH | Anti-Pattern 4 iron rule: mock COMPLETE data structure, not just fields your test checks |
| Coverage below 80% without filling gaps | MEDIUM | Coverage Gate: identify uncovered lines and write additional tests |
| Introducing a new test framework instead of using existing one | MEDIUM | Constraint 6: detect framework first, use project's existing one always |
| Modifying source files to make tests work | HIGH | Role boundary: test writes test files ONLY — source changes go to rune:fix |
| Test-only methods leaking into production code | MEDIUM | Anti-Pattern 2 gate: if method only called by tests → move to test utilities |
| Bulk test writing before first GREEN (horizontal slicing) | CRITICAL | Phase 3.5 gate — bulk_test_count <= 1, defer additional tests to subsequent cycles |
| Test names describe shape (`returns boolean`, `has property`) instead of behavior | MEDIUM | Scan names for shape-words; rewrite to behavior verbs (accepts/rejects/produces). See [references/test-quality.md](references/test-quality.md) |
| Mocking internal collaborators in same module | HIGH | System-boundary rule from [references/mocking-policy.md](references/mocking-policy.md) — mock only what you don't own |
| Layering old shallow-module tests on top of new deepened-interface tests | MEDIUM | After improve-architecture deepens a module, REPLACE tests don't ADD them; one interface = one test surface |

## Self-Validation

```
SELF-VALIDATION (run before emitting Test Report):
- [ ] Every test file has at least one assertion — no empty test bodies
- [ ] RED phase output shows actual failures (not "0 tests") — tests were real, not stubs
- [ ] No test modifies source code — test files only, source changes belong to fix
- [ ] Test names describe behavior, not implementation ("should reject expired token" not "test function X")
- [ ] No mocks of the thing being tested — only mock external dependencies
- [ ] If BA requirements exist (REQ-xxx), every requirement has at least one test — check plan's Traceability Matrix
```

## Done When

- Test framework detected from project config files
- Tests cover happy path + at least 2 edge cases + error case
- All new tests FAIL (RED phase — actual failure output shown)
- After implementation: all tests PASS (GREEN phase — actual pass output shown)
- Coverage ≥80% verified via verification
- Test Report emitted with framework, test count, RED/GREEN status, and coverage
- Self-Validation: all checks passed
- Cycle audit trail intact — every RED has a paired GREEN in `git log`, no orphan tests pre-first-GREEN
- Test names use behavior-words (accepts/rejects/produces/...) not shape-words (returns/has property/is defined)

## Cost Profile

~$0.03-0.08 per invocation. Sonnet for writing tests, Bash for running them. Frequent invocation in TDD workflow.

**Scope guardrail**: Do not modify source or implementation files to make tests pass unless explicitly delegated by the parent agent.
