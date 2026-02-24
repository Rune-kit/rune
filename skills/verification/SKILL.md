---
name: verification
description: "Universal verification runner. Runs lint, type-check, tests, and build. Use after any code change to verify nothing is broken."
metadata:
  author: runedev
  version: "0.2.0"
  layer: L3
  model: haiku
  group: validation
---

# verification

Runs all automated checks to verify code health. Stateless — runs checks and reports results.

## Instructions

### Phase 1: Detect Project Type

Use `Glob` to find project config files:

1. Check for `package.json` → Node.js/TypeScript project
2. Check for `pyproject.toml` or `setup.py` → Python project
3. Check for `Cargo.toml` → Rust project
4. Check for `go.mod` → Go project
5. Check for `pom.xml` or `build.gradle` → Java project

Use `Read` on the detected config file to find scripts or tool config (e.g., `package.json` scripts block for custom lint/test commands).

```
TodoWrite: [
  { content: "Detect project type", status: "in_progress" },
  { content: "Run lint check", status: "pending" },
  { content: "Run type check", status: "pending" },
  { content: "Run test suite", status: "pending" },
  { content: "Run build", status: "pending" },
  { content: "Generate verification report", status: "pending" }
]
```

### Phase 2: Run Lint

Use `Bash` to run the appropriate linter. If `package.json` has a `lint` script, prefer that:

- **Node.js (npm lint script)**: `npm run lint`
- **Node.js (no script)**: `npx eslint . --max-warnings 0`
- **Python**: `ruff check .` (fallback: `flake8 .`)
- **Rust**: `cargo clippy -- -D warnings`
- **Go**: `golangci-lint run` (fallback: `go vet ./...`)

If lint fails: record the failure output, mark lint as FAIL, continue to next step. Do NOT stop.

**Verification gate**: Command exits without crashing (even if it reports lint errors — those are FAIL, not errors).

### Phase 3: Run Type Check

Use `Bash`:

- **TypeScript**: `npx tsc --noEmit`
- **Python**: `mypy .` (fallback: `pyright .`)
- **Rust**: `cargo check`
- **Go**: `go vet ./...`

If type check fails: record error count and first 10 error lines, mark as FAIL, continue.

### Phase 4: Run Tests

Use `Bash` to run the test suite. Prefer the project script if available:

- **Node.js (npm test script)**: `npm test`
- **Vitest**: `npx vitest run`
- **Jest**: `npx jest --passWithNoTests`
- **Python**: `pytest -v` (fallback: `python -m unittest discover`)
- **Rust**: `cargo test`
- **Go**: `go test ./...`

Record: total tests, passed count, failed count, coverage percentage if output includes it.

If tests fail: record which tests failed (first 20), mark as FAIL, continue to build.

### Phase 5: Run Build

Use `Bash`:

- **Node.js**: check `package.json` for `build` script → `npm run build` (fallback: `npx tsc`)
- **Python**: skip (interpreted) unless `pyproject.toml` has build backend
- **Rust**: `cargo build`
- **Go**: `go build ./...`

If build fails: record first 20 lines of build output, mark as FAIL.

### Phase 6: Generate Report

Compile all results into the structured report. Update all TodoWrite items to completed.

## Error Recovery

- If project type cannot be detected: report "Unknown project type" and skip all checks
- If a command is not found (e.g., `ruff` not installed): note "tool not installed", mark check as SKIP
- If a command hangs for more than 60 seconds: kill it, mark check as TIMEOUT, continue

## Calls (outbound)

None — pure runner using Bash for all checks. Does not invoke other skills.

## Called By (inbound)

- `cook` (L1): Phase 6 VERIFY — final check before commit
- `fix` (L2): validate fix doesn't break existing functionality
- `test` (L2): validate test coverage meets threshold
- `deploy` (L2): post-deploy health checks
- `sentinel` (L2): run security audit tools (npm audit, etc.)
- `safeguard` (L2): verify safety net is solid before refactoring

## Output Format

```
VERIFICATION REPORT
===================
Lint:      [PASS/FAIL/SKIP] ([details])
Types:     [PASS/FAIL/SKIP] ([X errors])
Tests:     [PASS/FAIL/SKIP] ([passed]/[total], [coverage]%)
Build:     [PASS/FAIL/SKIP]

Overall:   [PASS/FAIL]

### Failures (if any)
- Lint: [error details with file:line]
- Types: [first 5 type errors]
- Tests: [first 5 failing test names]
- Build: [first 5 build errors]
```

## Constraints

1. MUST run ALL four checks: lint, type-check, tests, build — not just tests
2. MUST show actual command output — never claim "all passed" without evidence
3. MUST report specific failures with file:line references
4. MUST NOT skip checks because "changes are small"

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Claiming "all passed" without showing actual command output | CRITICAL | Constraint 2 blocks this — show the actual stdout/stderr from every command |
| Skipping build because "changes are small" | HIGH | Constraint 4: all four checks mandatory — size of changes doesn't matter |
| Marking check as PASS when the tool isn't installed | MEDIUM | Mark as SKIP (not PASS) — PASS means the tool ran and reported clean |
| Stopping after first failure instead of running remaining checks | MEDIUM | Run all checks; aggregate all failures so developer can fix everything at once |

## Done When

- Project type detected from config files
- lint, type-check, tests, and build all executed (or SKIP with reason if tool missing)
- Each check shows actual command output
- Failures include specific file:line references (not just counts)
- Verification Report emitted with Overall PASS/FAIL verdict

## Cost Profile

~$0.01-0.03 per run. Haiku + Bash commands. Fast and cheap.
