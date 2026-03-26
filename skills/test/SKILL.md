---
name: test
description: "TDD test writer. Writes failing tests FIRST (red), then verifies they pass after implementation (green). Covers unit, integration, and e2e tests."
metadata:
  author: runedev
  version: "1.1.0"
  layer: L2
  model: sonnet
  group: development
  tools: "Read, Write, Edit, Bash, Glob, Grep"
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

When writing tests for async Python code:

1. **Verify setup before writing tests**:
   - Confirm `pytest-asyncio` is in project dependencies
   - Confirm `asyncio_mode` is set in `pyproject.toml` `[tool.pytest.ini_options]` (recommend `"auto"`)
   - If neither is configured, warn the caller and suggest setup before proceeding

2. **Writing async test functions**:
   - With `asyncio_mode = "auto"`: just write `async def test_something():` — no decorator needed
   - With `asyncio_mode = "strict"`: every async test needs `@pytest.mark.asyncio`
   - Without asyncio_mode set: always use `@pytest.mark.asyncio` decorator explicitly

3. **Async fixtures**:
   - Use `@pytest_asyncio.fixture` (NOT `@pytest.fixture`) for async setup/teardown
   - Scope rules: async fixtures default to `function` scope — use `scope="session"` carefully with async

4. **Common pitfalls**:
   - Tests that `pass` without `await` — they run but don't execute the async path
   - Missing `pytest-asyncio` makes `async def test_*` silently pass as empty coroutines
   - Mixing sync and async fixtures can cause event loop errors

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

Tests are organized in 4 layers. Each layer catches a different failure class. Higher layers are slower but catch integration issues lower layers miss.

| Layer | Type | What It Catches | Framework | Speed |
|-------|------|-----------------|-----------|-------|
| L1 | **Unit** | Logic bugs, boundary violations, pure function errors | jest/vitest/pytest/cargo test | Fast |
| L2 | **Integration** | API contract breaks, DB query errors, service interaction failures | supertest/httpx/reqwest | Medium |
| L3 | **True Backend** | Real tool/service output correctness (not just exit 0) | Same + real software invocation | Medium-Slow |
| L4 | **E2E / Subprocess** | Full workflow from user/agent perspective, installed app works | Playwright/Cypress/subprocess | Slow |

**Layer rules:**
- **L1 (Unit)**: Synthetic data, no external deps. Every function tested in isolation. Fast, deterministic, CI-friendly
- **L2 (Integration)**: Tests service boundaries — API endpoints, DB operations, message queues. May need test DB or mock server
- **L3 (True Backend)**: **Invokes the REAL tool/service** and verifies output programmatically. No graceful degradation — if the dependency isn't installed, tests FAIL (not skip). Verify: magic bytes, file size > 0, content structure. Print artifact paths for manual inspection
- **L4 (E2E/Subprocess)**: Tests the installed command/app via subprocess or browser automation. Full user workflow: input → process → output → verify

**"No graceful degradation" rule** (L3/L4): Hard dependencies MUST be installed. Tests MUST NOT skip or produce fake results when the dependency is missing. A silently skipping test is worse than a loudly failing test.

Additional modes:

| Type | When | Speed |
|------|------|-------|
| Regression | After bug fixes | Fast |
| Diff-aware | After implementation, large codebases (Phase 6.5) | Fast (targeted) |

## TEST.md — Test Plan + Results Document

For non-trivial features (3+ test files or 20+ test cases), create a `TEST.md` in the test directory. This is BOTH a planning doc (written BEFORE tests) and results doc (appended AFTER tests pass).

### Before writing tests — write the plan:
```markdown
# Test Plan: [Feature Name]

## Test Inventory
- `test_core.py`: ~XX unit tests planned (L1)
- `test_integration.py`: ~XX integration tests planned (L2)
- `test_e2e.py`: ~XX E2E tests planned (L3/L4)

## Unit Test Plan (L1)
| Module | Functions | Edge Cases | Est. Tests | Req IDs |
|--------|-----------|------------|------------|---------|
| `core/auth.py` | login, register, refresh | expired token, invalid creds, rate limit | 12 | REQ-001, REQ-003 |

## E2E Scenarios (L3/L4)
| Workflow | Simulates | Operations | Verified | Req IDs |
|----------|-----------|------------|----------|---------|
| User signup | New user onboarding | register → verify → login | Token valid, profile created | REQ-005 |

## Realistic Workflow Scenarios
- **[Name]**: [Step 1] → [Step 2] → verify [output properties]
```

### After tests pass — append results:
```markdown
## Test Results
[Paste full `pytest -v --tb=no` or `npm test` output]

## Summary
- Total: XX | Passed: XX | Failed: 0
- Execution time: X.Xs | Coverage: XX%

## Requirement Coverage
| Req ID | Test File(s) | Status |
|--------|-------------|--------|
| REQ-001 | `test_auth.py::test_login` | ✅ Covered |
| REQ-002 | — | ❌ Not covered |

## Gaps
- [Areas not covered and why]
```

**Why TEST.md**: Planning tests before code catches missing edge cases early. Appending results creates permanent evidence. One document = complete testing story.

## Skill Behavior Tests (Eval Scenarios)

For testing SKILL.md behavior (not code), use **Eval Scenarios** — unit tests for skill files, not code files.

### Eval Scenario Format

```markdown
## Eval: E[NN] — [scenario name]

### Prompt
[The exact situation/message an agent receives]

### Expected Reasoning
[Step-by-step reasoning the agent SHOULD follow]

### Must Include
- [Assertion 1: what the output MUST contain or do]
- [Assertion 2]

### Must NOT
- [Anti-pattern 1: what the output MUST NOT do]
- [Anti-pattern 2]

### Category
happy-path | adversarial | edge-case | jailbreak | credential-leak
```

### Eval Coverage Requirements

A skill is **behavior-tested** when it has evals covering:

| Category | Min Evals | Purpose |
|----------|-----------|---------|
| Happy path | 1 | Core workflow executes correctly |
| Edge case | 1 | Empty input, missing context, unusual state |
| Adversarial | 1 | Time pressure, sunk cost, authority pressure |
| Jailbreak / injection | 1 | Prompt injection attempt, "ignore instructions" |

**Minimum**: 4 evals per skill (1 per category). Security-critical skills (sentinel, safeguard): 8+ evals.

### Eval Storage

Save eval files as `skills/<name>/evals.md`. Each eval is a numbered scenario (E01–E24 range). skill-forge Phase 7 checks for evals presence before ship.


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

## Advanced: Oracle-Injection E2E Testing

For **data pipelines, AI workflows, and multi-stage processing** where comparing full output structures is impractical, use oracle injection:

1. **Generate a UUID oracle token**: `const oracle = crypto.randomUUID()`
2. **Inject into synthetic input**: embed the oracle in realistic test data that flows through the pipeline
3. **Run the full pipeline**: input → all stages → output
4. **Search for oracle in output**: if found → data flowed end-to-end correctly

```
// Example: testing a document processing pipeline
const oracle = "ORACLE-" + crypto.randomUUID();
const testDoc = `Meeting notes: discussed ${oracle} integration timeline`;
const result = await pipeline.process(testDoc);
assert(result.output.includes(oracle), "Oracle not found — pipeline lost data");
```

**When to use**: E2E tests for pipelines with 3+ stages, LLM-based processing, ETL workflows, or any system where output structure is complex/non-deterministic but data preservation is critical.

**When NOT to use**: Unit tests, simple CRUD, or when exact output comparison is feasible.


## Spec→Test Traceability

When a plan with acceptance criteria exists (`.rune/features/<name>/plan.md` or phase file), every criterion MUST map to at least one test case.

```
Plan Acceptance Criteria → Test Case → Implementation

AC-1: "User can reset password via email" → test_password_reset_sends_email()
AC-2: "Rate limit: max 3 reset attempts/hour" → test_password_reset_rate_limit()
AC-3: "Expired tokens rejected" → test_expired_reset_token_rejected()
```

**Validation step** (after writing tests): Cross-check plan's acceptance criteria against test names. For each criterion:
- Has test → OK
- No test → flag as UNTESTED REQUIREMENT (more serious than uncovered lines)

**Why this is stronger than coverage**: Coverage checks that lines were EXECUTED. Traceability checks that INTENT was VERIFIED. You can have 100% coverage but miss a requirement if the test doesn't assert the right behavior.

**Skip if**: No plan exists (ad-hoc fix), or plan has no acceptance criteria section.

## Eval-Driven Development

Define **capability evals** and **regression evals** BEFORE writing implementation code. Evals go beyond unit tests — they verify that the agent/system can handle the feature's intent, not just its mechanics.

### Two Eval Types

| Type | Purpose | Pass Criteria | When |
|------|---------|---------------|------|
| **Capability eval** | Can the system do this new thing? | pass@k: ≥1 success in k attempts (k=3-5) | Before implementation |
| **Regression eval** | Did we break existing behavior? | pass^k: ALL k attempts must pass | After implementation |

**pass@k** (capability): At least 1 of k runs succeeds. Used for new features where some variance is acceptable. Threshold: ≥90% pass@3 for standard features, ≥95% pass@5 for critical paths.

**pass^k** (regression): ALL k runs must pass. Used for existing behavior that must never break. If ANY run fails, it's a regression. Threshold: 100% pass^3.

### Eval File Format

Store evals in `.rune/evals/<feature>.md`:

```markdown
# Eval: <feature name>

## Capability Evals (pass@k)
| ID | Description | k | Threshold | Status |
|----|-------------|---|-----------|--------|
| CAP-1 | [what the system should be able to do] | 3 | 90% | pending |

## Regression Evals (pass^k)
| ID | Description | k | Status |
|----|-------------|---|--------|
| REG-1 | [existing behavior that must not break] | 3 | pending |
```

### Anti-Pattern: Eval Overfitting

Do NOT overfit evals to specific prompts or known examples. Evals should test the **capability**, not the **exact input**.

- BAD: `"When user says 'hello', respond with 'Hi there!'"` — tests exact string match
- GOOD: `"When user greets, respond with a greeting"` — tests capability

### Integration with TDD

1. Write eval definitions (capability + regression) → `.rune/evals/<feature>.md`
2. Write unit/integration tests (RED phase) → test files
3. Implement feature (GREEN phase) → source files
4. Run evals to verify capability achieved + no regressions
5. Preflight checks eval results as part of quality gate

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

Before writing tests, check yourself against these 5 anti-patterns. Each has a **gate function** — a question you MUST answer before proceeding.

### Anti-Pattern 1: Testing Mock Behavior
Asserting that a mock exists (e.g., `testId="sidebar-mock"`) instead of testing real component behavior. You're proving the mock works, not the code.
**Gate**: "Am I testing real component behavior or just mock existence?" → If mock existence: STOP. Rewrite to test real behavior.

### Anti-Pattern 2: Test-Only Methods in Production
Adding `destroy()`, `reset()`, or `__testSetup()` methods to production classes that are ONLY called from test files. Production code should not know tests exist.
**Gate**: "Is this method only called by tests?" → If yes: STOP. Move to test utilities or test helper file, not production class.

### Anti-Pattern 3: Mocking Without Understanding Side Effects
Mocking a function without first understanding ALL its side effects. The real function may write config files, update caches, or emit events that downstream code depends on.
**Gate**: Before mocking, STOP and answer: "What side effects does the REAL function have? Does this test depend on any of those?" → Run with real implementation first, observe what happens, THEN add minimal mocking.

### Anti-Pattern 4: Incomplete Mocks
Partial mock missing fields that downstream code consumes. Your test passes because it only checks the fields you mocked, but production code reads fields your mock doesn't have → runtime crash.
**Iron Rule**: Mock the COMPLETE data structure as it exists in reality, not just fields your immediate test uses. Examine actual API response / real data shape before writing mock.

### Anti-Pattern 5: Mock Setup Longer Than Test Logic
If mock setup is 30 lines and the actual test assertion is 3 lines, the test is testing infrastructure, not behavior. This is a code smell that indicates wrong abstraction level.
**Gate**: "Is my mock setup longer than my test logic?" → If yes: test at a higher level (integration) or extract mock factories.

### Anti-Pattern 6: Test Slop (Framework-Behavior Tests)
Tests that verify the framework works rather than YOUR code works. If the test would still pass with an empty component/function, it's testing infrastructure.
**Gate**: "Would this test pass if I deleted my business logic?" → If yes: STOP. Rewrite to test behavior that YOUR code introduces.

Examples of test slop:
- "renders without crashing" (tests that React works, not your component)
- "route responds with 200" without checking response body (tests Express, not your handler)
- Asserting a mock was called N times without checking the RESULT of those calls
- Type existence tests (`typeof result === 'object'`) when you should test the actual value

**Red flags — any of these means STOP and rethink:**
- Mock setup longer than test logic
- `*-mock` test IDs in assertions
- Methods only called in test files
- Can't explain in one sentence why a mock is needed
- Test would pass with empty implementation (test slop)

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| Test files | Source files | Co-located or `__tests__/` per project convention |
| Test plan + results | Markdown | `TEST.md` in test directory (non-trivial features only) |
| Eval scenarios | Markdown | `skills/<name>/evals.md` (for skill behavior testing) |
| Coverage report | Inline stdout | Shown in Test Report |
| Test Report | Markdown (inline) | Emitted to calling skill (cook, fix, review) |

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

## Cost Profile

~$0.03-0.08 per invocation. Sonnet for writing tests, Bash for running them. Frequent invocation in TDD workflow.

**Scope guardrail**: Do not modify source or implementation files to make tests pass unless explicitly delegated by the parent agent.
