---
name: fix
description: Apply code changes and fixes. Writes implementation code, applies bug fixes, and verifies changes with tests. Core action hub in the development mesh.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L2
  model: sonnet
  group: development
---

# fix

## Purpose

Apply code changes. Fix receives a plan, debug finding, or review finding and writes the actual code. It does NOT investigate root causes — that is rune:debug's job. Fix is the action hub: locate, change, verify, report.

<HARD-GATE>
Never change test files to make tests pass unless the tests themselves are provably wrong (wrong expected value, wrong test setup, testing a removed API). The rule: fix the CODE, not the TESTS.
If unsure whether the test is wrong or the implementation is wrong → call `rune:debug` to investigate.
</HARD-GATE>

## Triggers

- Called by `cook` Phase 4 IMPLEMENT — write code to pass tests
- Called by `debug` when root cause found and fix is ready
- Called by `review` when bugs found during review
- `/rune fix <issue>` — manual fix application
- Auto-trigger: after successful debug diagnosis

## Calls (outbound)

- `debug` (L2): when root cause unclear before fixing — need diagnosis first
- `test` (L2): verify fix with tests after applying changes
- `review` (L2): self-review for complex or risky fixes
- `verification` (L3): validate fix doesn't break existing functionality
- `docs-seeker` (L3): check correct API usage before applying changes
- `hallucination-guard` (L3): verify imports after code changes
- `scout` (L2): find related code before applying changes

## Called By (inbound)

- `cook` (L1): Phase 4 IMPLEMENT — apply code changes
- `debug` (L2): root cause found, ready to apply fix
- `review` (L2): bug found during review, needs fixing
- `surgeon` (L2): apply refactoring changes

## Cross-Hub Connections

- `fix` ↔ `debug` — bidirectional: debug diagnoses → fix applies, fix can't determine cause → debug investigates
- `fix` → `test` — after applying fix, run tests to verify
- `fix` ← `review` — review finds bug → fix applies correction
- `fix` → `review` — complex fix requests self-review

## Execution

### Step 1: Understand

Read and fully understand the fix request before touching any file.

- Read the incoming request: debug report, plan spec, or review finding
- Identify what is broken or missing and what the expected behavior should be
- If the request is ambiguous or root cause is unclear → call `rune:debug` before proceeding
- Note the scope: single function, single file, or multi-file change

### Step 2: Locate

Find the exact files and lines to change.

- Use `rune:scout` to locate the relevant files, functions, and surrounding code
- Use `Read` to examine the specific file:line identified in the debug report or plan
- Use `Glob` to find related files: types, tests, config that may also need updating
- Map all touch points before writing a single line of code

### Step 3: Change

Apply the minimal set of changes needed.

- Use `Edit` for targeted modifications to existing files
- Use `Write` only when creating a genuinely new file is required
- Follow project conventions: naming, immutability patterns, error handling style
- Keep changes minimal — fix the stated problem, do not refactor unrelated code (YAGNI)
- Never use `any` in TypeScript; never use bare `except:` in Python
- If a new import is needed → note it for Step 5 hallucination-guard check

### Step 4: Verify

Confirm the change works and nothing is broken.

- Use `Bash` to run the relevant tests: the specific failing test first, then the full suite
- If tests fail after the fix:
  - Investigate with `rune:debug` (max 3 debug loops before escalating)
  - Do NOT change test files to make tests pass — fix the implementation code
- If project has a type-check command, run it via `Bash`
- If project has a lint command, run it via `Bash`

### Step 5: Self-Review

Verify correctness of the changes just made.

- Call `rune:hallucination-guard` to verify all imports introduced or modified are real and correctly named
- Call `rune:docs-seeker` if any external API, library method, or SDK call was added or changed
- For complex or risky fixes (auth, data mutation, async logic): call `rune:review` for a full quality check

### Step 6: Report

Produce a structured summary of all changes made.

- List every file modified and a one-line description of what changed
- Include verification results (tests, types, lint)
- Note any follow-up work if the fix is partial or has known limitations

## Constraints

1. MUST NOT change test files to make tests pass — fix the CODE, not the TESTS
2. MUST have a diagnosis (from debug or clear error) before applying fixes
3. MUST run tests after each fix attempt — never batch multiple untested changes
4. MUST NOT exceed 3 fix attempts — if 3 fixes fail, re-diagnose via rune:debug
5. MUST follow project conventions found by scout — don't invent new patterns
6. MUST NOT add unplanned features while fixing — fix only what was diagnosed

## Mesh Gates

| Gate | Requires | If Missing |
|------|----------|------------|
| Evidence Gate | Debug report OR clear error description before fixing | Run rune:debug first |
| Test Gate | Tests run after each fix attempt | Run tests before claiming fix works |

## Output Format

```
## Fix Report
- **Task**: [what was fixed/implemented]
- **Status**: complete | partial | blocked

### Changes
- `path/to/file.ts` — [description of change]
- `path/to/other.ts` — [description of change]

### Verification
- Lint: PASS | FAIL
- Types: PASS | FAIL
- Tests: PASS | FAIL ([n] passed, [m] failed)

### Notes
- [any caveats or follow-up needed]
```

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Modifying test files to make tests pass | CRITICAL | HARD-GATE blocks this — fix the code, never the tests (unless test setup is provably wrong) |
| Applying fix without a diagnosis | HIGH | Evidence Gate: need debug report or clear error description before touching code |
| Exceeding 3 fix attempts without re-diagnosing | HIGH | Constraint 4: after 3 failures, call debug again — the hypothesis was wrong |
| Introducing unrelated refactoring while fixing | MEDIUM | YAGNI: fix only what was diagnosed — unrelated changes belong in a separate task |
| Not running tests after each individual change | MEDIUM | Constraint 3: never batch untested changes — run tests after each edit |

## Done When

- Root cause identified (debug report or clear error received)
- Minimal changes applied targeting only the diagnosed problem
- Tests pass for the fixed functionality (actual output shown)
- Lint and type check pass
- hallucination-guard verified any new imports
- Fix Report emitted with changed files and verification results

## Cost Profile

~2000-5000 tokens input, ~1000-3000 tokens output. Sonnet for code writing quality. Most active skill during implementation.
