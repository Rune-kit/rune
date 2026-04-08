---
name: verification
description: "Universal verification runner. Runs lint, type-check, tests, and build. Use after any code change to verify nothing is broken."
metadata:
  author: runedev
  version: "0.5.0"
  layer: L3
  model: haiku
  group: validation
  tools: "Read, Bash, Glob, Grep"
  listen: code.changed
  emit: verification.complete
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
- **Python**: check `pyproject.toml` for `[build-system]` section:
  - If build backend found (setuptools, poetry-core, hatchling, flit-core): `python -m build --no-isolation 2>&1 | head -20` to verify packaging
  - If `setup.py` exists (legacy): `python setup.py check --strict`
  - Then always: `pip install -e . --dry-run` to catch broken entry points, missing `__init__.py`, or import path issues
  - If no `pyproject.toml` and no `setup.py` (scripts-only project): SKIP
- **Rust**: `cargo build`
- **Go**: `go build ./...`

If build fails: record first 20 lines of build output, mark as FAIL.

### Phase 6: Generate Report

Compile all results into the structured report. Update all TodoWrite items to completed.

### 3-Level Artifact Verification

Every file created or modified during implementation must pass ALL 3 levels:

**Level 1 — EXISTS**: File is on disk, non-empty.
```
Glob("path/to/expected/file") → found
```

**Level 2 — SUBSTANTIVE**: Contains real logic, NOT a stub. Scan for these stub patterns:

| Pattern | Language | Meaning |
|---|---|---|
| Component returns only `<div>Placeholder</div>` or `<div>TODO</div>` | React/Vue | Stub component |
| Route returns `{ message: "Not implemented" }` or `res.status(501)` | API | Stub endpoint |
| Function body is only `return null` / `return {}` / `return []` / `pass` | Any | Stub function |
| Class with all methods throwing `NotImplementedError` | Python/Java | Stub class |
| `useEffect` with empty body / `async function` with no `await` | React/JS | Hollow implementation |
| File has only type/interface exports but no implementation | TypeScript | Stub types-only file |
| `// TODO` or `# TODO` as the only content in a function | Any | Placeholder |

If ANY stub pattern detected → mark file as STUB, Level 2 FAIL.

**Level 3 — WIRED**: Actually imported/called/used by the rest of the system.

| File Type | Wiring Check |
|---|---|
| Component | `Grep("<ComponentName")` in parent files → ≥1 consumer |
| API route | `Grep("fetch\\|axios\\|api.*endpoint")` for this path → ≥1 caller |
| Hook | `Grep("useHookName(")` → ≥1 consumer |
| Utility function | `Grep("import.*from.*this-file")` → ≥1 importer |
| DB model/schema | `Grep("ModelName\\|table_name")` in query files → ≥1 reference |
| CSS/style module | `Grep("import.*from.*this-style")` → ≥1 importer |

If file has 0 consumers → mark as UNWIRED, Level 3 FAIL.

**Exception**: Entry-point files (main.ts, index.ts, App.tsx, routes config) are exempt from Level 3 — they ARE the top-level consumers.

<HARD-GATE name="3-level-verification">
ALL new files must pass Level 1 + Level 2 + Level 3.
EXISTS but STUB = "Existence Theater" — agent created files but didn't implement them.
EXISTS and SUBSTANTIVE but UNWIRED = dead code — created but never connected.
Report which level failed for each file in the Verification Report.
</HARD-GATE>

### Artifact Output Verification

> Inspired by CLI-Anything (HKUDS/CLI-Anything, 14.5k★): "Never trust exit 0."
> Many tools exit 0 even when they fail silently. Always verify ACTUAL output.

After each phase command, verify that the expected artifact or indicator is present:

**Test output** — scan stdout for the pass/fail summary line:
- Vitest/Jest: look for `X passed`, `X failed` — if neither appears, output is incomplete
- Pytest: look for `X passed` or `X failed` — exit 0 with no summary = runner crashed silently
- If only exit code available and no summary line found → mark as INCOMPLETE, not PASS

**Build output** — after `npm run build` / `cargo build` / `go build`:
- Verify the output file exists: `Glob("dist/**/*.js")` or equivalent
- Verify file size > 0 bytes: a zero-byte output = silent truncation failure
- If output directory is missing → FAIL even if command exited 0

**Lint output** — parse stdout for counts, not just exit code:
- ESLint: look for `X problems (Y errors, Z warnings)` — `0 problems` = PASS
- Ruff/Flake8: zero output lines = PASS; any file:line output = FAIL
- If linter exits 0 but output contains `error` keyword → log as suspicious, mark WARN

**Generated files** — check magic bytes for binary outputs:
- PDF: first bytes must be `%PDF` — use `Bash("head -c 4 file.pdf")`
- ZIP/XLSX/DOCX: first bytes must be `PK` (ZIP magic) — use `Bash("head -c 2 file.zip")`
- File size must exceed minimum threshold (PDF > 1KB, ZIP > 100 bytes)

**Type check** — do not trust exit code alone:
- TypeScript `tsc --noEmit`: look for `Found X errors` or absence of error lines
- `Found 0 errors` = PASS; any other count = FAIL
- Empty output from `tsc` = PASS (no errors emitted) — note explicitly

<HARD-GATE name="artifact-verification">
Verification MUST check actual command output for success indicators, not just exit codes.
Exit 0 without a confirming output artifact or success string = UNVERIFIED.
Report the specific line that confirmed success (e.g., "3 passed, 0 failed").
</HARD-GATE>

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
- `db` (L2): run migration in test environment
- `perf` (L2): run benchmark scripts if configured
- `skill-forge` (L2): verify newly created skill passes lint/type/build checks

## Output Format

```
VERIFICATION REPORT
===================
Lint:      [PASS/FAIL/SKIP] ([details])
Types:     [PASS/FAIL/SKIP] ([X errors])
Tests:     [PASS/FAIL/SKIP] ([passed]/[total], [coverage]%)
Build:     [PASS/FAIL/SKIP]

### 3-Level File Verification
| File | L1 Exists | L2 Substantive | L3 Wired | Verdict |
|------|-----------|----------------|----------|---------|
| src/auth/login.ts | ✓ | ✓ | ✓ (imported by routes.ts) | PASS |
| src/auth/reset.ts | ✓ | STUB (returns null) | — | FAIL L2 |
| src/utils/format.ts | ✓ | ✓ | UNWIRED (0 importers) | FAIL L3 |

Overall:   [PASS/FAIL]

### Failures (if any)
- Lint: [error details with file:line]
- Types: [first 5 type errors]
- Tests: [first 5 failing test names]
- Build: [first 5 build errors]
- Stubs: [files that failed Level 2 with stub pattern detected]
- Unwired: [files that failed Level 3 with 0 consumers]
```

## Output Completion Enforcement

> From taste-skill (Leonxlnx/taste-skill, 3.4k★): Truncated code is worse than no code — it passes reviews but breaks at runtime.

When verifying code files (Level 2 SUBSTANTIVE check), also scan for **truncation patterns** — signs that the agent generated partial output and stopped:

| Banned Pattern | Language | What It Means |
|---|---|---|
| `// ...` or `/* ... */` as a statement | JS/TS | Agent truncated remaining code |
| `# ...` as a statement (not comment) | Python | Agent truncated |
| `// rest of code` / `// remaining implementation` | Any | Explicit truncation admission |
| `// TODO: implement` as sole function body | Any | Placeholder, not implementation |
| `{ /* same as above */ }` | JS/TS | Copy-paste truncation |
| `...` (bare ellipsis, not spread operator) | JS/TS/Python | Truncation marker |
| `[PAUSED]` / `[CONTINUED]` in source | Any | Agent session marker leaked into code |

**Action on detection:**
- Mark file as TRUNCATED (distinct from STUB) in Verification Report
- TRUNCATED files are Level 2 FAIL — they CANNOT pass verification
- Report the specific line number and pattern detected
- If agent claims "done" with truncated files → REJECTED by Evidence-Before-Claims gate

**Continuation protocol** — if the agent hit output limits mid-file:
- Agent MUST log: `[PAUSED — X of Y functions complete]` in its response (NOT in the code file)
- Agent MUST resume and complete the file in the next turn
- Verification re-runs after completion to clear the TRUNCATED flag

## Evidence-Before-Claims Gate

<HARD-GATE>
An agent MUST NOT claim "done", "fixed", "passing", or "verified" without showing the actual command output that proves it.
"I ran the tests and they pass" WITHOUT stdout/stderr = UNVERIFIED CLAIM = REJECTED.
The verification report IS the evidence. No report = no verification happened.
</HARD-GATE>

### Claim Validation Protocol

When any skill calls verification and then reports results upstream:

1. **Output capture is mandatory** — every Bash command's stdout/stderr must appear in the report
2. **Pass requires proof** — PASS means "tool ran AND output shows zero errors" (not "tool ran without crashing")
3. **Silence is not success** — if a command produces no output, note it explicitly ("0 errors, 0 warnings")
4. **Partial runs are labeled** — if only 2 of 4 checks ran, Overall = INCOMPLETE (not PASS)

### Red Flags — Agent is Lying

| Claim | Without | Verdict |
|---|---|---|
| "All tests pass" | Test runner stdout showing pass count | REJECTED — re-run and show output |
| "No lint errors" | Linter stdout | REJECTED — re-run and show output |
| "Build succeeds" | Build command stdout | REJECTED — re-run and show output |
| "I verified it" | Verification Report | REJECTED — run verification skill properly |
| "Fixed and working" | Before/after test output | REJECTED — show the diff in results |

## Constraints

1. MUST run ALL four checks: lint, type-check, tests, build — not just tests
2. MUST show actual command output — never claim "all passed" without evidence
3. MUST report specific failures with file:line references
4. MUST NOT skip checks because "changes are small"
5. MUST include stdout/stderr capture in every check result — empty output noted explicitly
6. MUST mark Overall as INCOMPLETE if any check was skipped without valid reason (tool not installed = valid, "changes are small" = invalid)

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Claiming "all passed" without showing actual command output | CRITICAL | Evidence-Before-Claims HARD-GATE blocks this — stdout/stderr is mandatory |
| Agent says "verified" without producing Verification Report | CRITICAL | No report = no verification. Re-run the skill properly. |
| Skipping build because "changes are small" | HIGH | Constraint 4: all four checks mandatory — size of changes doesn't matter |
| Marking check as PASS when the tool isn't installed | MEDIUM | Mark as SKIP (not PASS) — PASS means the tool ran and reported clean |
| Stopping after first failure instead of running remaining checks | MEDIUM | Run all checks; aggregate all failures so developer can fix everything at once |
| Reporting PASS when output has warnings but zero errors | LOW | PASS is correct but note warning count — caller decides if warnings matter |
| Trusting exit code 0 without output verification | CRITICAL | Artifact Verification HARD-GATE: always confirm success indicator in stdout (pass count, "0 errors", output file exists) |
| Existence Theater — file exists but is a stub | HIGH | 3-Level check: Level 2 scans for stub patterns (`<div>Placeholder</div>`, `return null`, `NotImplementedError`) |
| Dead code — file created but never imported/used | MEDIUM | 3-Level check: Level 3 greps for consumers. 0 importers = UNWIRED |
| Truncated code — agent hit output limit mid-file | HIGH | Output Completion Enforcement: scan for `// ...`, `// rest of code`, bare ellipsis patterns. TRUNCATED = Level 2 FAIL |

## Done When

- Project type detected from config files
- lint, type-check, tests, and build all executed (or SKIP with reason if tool missing)
- Each check shows actual command output
- Failures include specific file:line references (not just counts)
- Verification Report emitted with Overall PASS/FAIL verdict

## Cost Profile

~$0.01-0.03 per run. Haiku + Bash commands. Fast and cheap.
