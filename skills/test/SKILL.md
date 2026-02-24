---
name: test
description: Write and run tests — unit, integration, e2e. Enforces TDD (red→green→refactor). Calls debug when tests fail with unclear reasons.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L2
  model: sonnet
  group: development
---

# test

## Purpose

Write and run tests — unit, integration, and e2e. Test enforces TDD discipline in the Rune ecosystem: write failing tests first (red), implement to pass (green), refactor. When tests fail with unclear reasons, hands off to debug for root cause analysis. Connected to the quality gate via preflight.

## Triggers

- Called by `cook` Phase 3 TEST — write failing tests (TDD red)
- Called by `fix` after applying changes — verify fix works
- Called by `review` when untested edge cases found
- Called by `deploy` for pre-deployment verification
- Called by `preflight` for targeted regression tests
- `/rune test` — manual test run

## Calls (outbound)

- `debug` (L2): when test fails with unclear reason — hand off for root cause analysis
- `browser-pilot` (L3): for e2e/visual testing in browser
- `verification` (L3): validate test coverage meets threshold (80%+)

## Called By (inbound)

- `cook` (L1): Phase 3 TEST — write tests first
- `fix` (L2): verify fix passes tests
- `review` (L2): untested edge case found → write test for it
- `deploy` (L2): pre-deployment full test suite
- `preflight` (L2): run targeted regression tests on affected code
- `surgeon` (L2): verify refactored code
- `launch` (L1): pre-deployment test suite
- `safeguard` (L2): writing characterization tests for legacy code

## Cross-Hub Connections

- `test` → `debug` — test fails unexpectedly → debug investigates
- `test` ← `fix` — fix applied → test verifies
- `test` ← `review` — review finds untested edge case → test writes it

## Workflow

1. **Analyze scope** — determine what needs testing based on task (new feature, bug fix, regression)
2. **Write tests** — create test cases covering happy path, edge cases, error cases
3. **Run tests** — execute test suite (targeted, not full suite unless deploy)
4. **Evaluate results** — if all pass → report success, if fail → analyze
5. **Debug failures** — if failure is unclear, call debug for root cause analysis
6. **Coverage check** — call verification to check coverage threshold
7. **Report** — output test results and coverage

## Test Types

```
UNIT         — individual functions, utilities, components (fastest)
INTEGRATION  — API endpoints, database operations, service interactions
E2E          — critical user flows via browser-pilot (slowest, most expensive)
REGRESSION   — targeted tests for code affected by changes (preflight use)
```

## Output Format

```
## Test Report
- **Suite**: [test file/suite name]
- **Status**: PASS | FAIL | PARTIAL
- **Results**: [passed]/[total] ([percentage]%)
- **Coverage**: [line]% lines, [branch]% branches

### Passed
- [test name] — [what it verifies]

### Failed
- [test name] — [error message]
  - Expected: [expected]
  - Received: [received]

### Coverage Gaps
- `path/to/file.ts:42-58` — uncovered branch (error handling)

### Recommendations
- [suggestion for additional tests]
```

## Cost Profile

~1500-4000 tokens input, ~500-1500 tokens output. Sonnet for test writing quality. Frequent invocation in TDD workflow.
