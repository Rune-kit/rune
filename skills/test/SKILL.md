---
name: test
description: "TDD test writer. Writes failing tests FIRST (red), then verifies they pass after implementation (green). Covers unit, integration, and e2e tests."
metadata:
  author: runedev
  version: "0.2.0"
  layer: L2
  model: sonnet
  group: development
---

# test

<HARD-GATE>
Tests define the EXPECTED BEHAVIOR. They MUST be written BEFORE implementation code.
If tests pass without implementation → the tests are wrong. Rewrite them.
The only exception: when retrofitting tests for existing untested code.
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

### Phase 4: Run Tests — Verify They FAIL (RED)

Use `Bash` to run ONLY the newly created test files (not full suite):

- **Jest**: `npx jest path/to/test.ts --no-coverage`
- **Vitest**: `npx vitest run path/to/test.ts`
- **pytest**: `pytest path/to/test_file.py -v`
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

## Test Types

| Type | When | Framework | Speed |
|------|------|-----------|-------|
| Unit | Individual functions, pure logic | jest/vitest/pytest/cargo test | Fast |
| Integration | API endpoints, DB operations | supertest/httpx/reqwest | Medium |
| E2E | Critical user flows | Playwright/Cypress via browser-pilot | Slow |
| Regression | After bug fixes | Same as unit | Fast |

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

## Calls (outbound)

- `verification` (L3): Phase 6 — coverage check (80% minimum threshold)
- `browser-pilot` (L3): Phase 4 — e2e and visual testing for UI flows
- `debug` (L2): Phase 5 — when existing test regresses unexpectedly

## Constraints

1. MUST write tests BEFORE implementation code — if tests pass without implementation, they are wrong
2. MUST cover happy path + edge cases + error cases — not just happy path
3. MUST run tests to verify they FAIL before implementation exists (RED phase is mandatory)
4. MUST NOT write tests that test mock behavior instead of real code behavior
5. MUST achieve 80% coverage minimum — identify and fill gaps
6. MUST use the project's existing test framework and conventions — don't introduce a new one
7. MUST NOT say "tests pass" without showing actual test runner output

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

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Tests passing before implementation exists | CRITICAL | RED Gate: rewrite stricter tests — passing without code = not testing real behavior |
| Skipping the RED phase (not confirming FAIL) | HIGH | Run tests, confirm FAIL output before calling cook/fix to implement |
| Testing mock behavior instead of real code | HIGH | Constraint 4: test what the real code does, not what the mock returns |
| Coverage below 80% without filling gaps | MEDIUM | Coverage Gate: identify uncovered lines and write additional tests |
| Introducing a new test framework instead of using existing one | MEDIUM | Constraint 6: detect framework first, use project's existing one always |

## Done When

- Test framework detected from project config files
- Tests cover happy path + at least 2 edge cases + error case
- All new tests FAIL (RED phase — actual failure output shown)
- After implementation: all tests PASS (GREEN phase — actual pass output shown)
- Coverage ≥80% verified via verification
- Test Report emitted with framework, test count, RED/GREEN status, and coverage

## Cost Profile

~$0.03-0.08 per invocation. Sonnet for writing tests, Bash for running them. Frequent invocation in TDD workflow.
