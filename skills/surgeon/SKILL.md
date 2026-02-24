---
name: surgeon
description: Incremental refactorer. Refactors ONE module per session using proven patterns — Strangler Fig, Branch by Abstraction, Expand-Migrate-Contract.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L2
  model: sonnet
  group: rescue
---

# surgeon

## Purpose

Incremental refactorer that operates on ONE module per session using proven refactoring patterns. Surgeon is precise and safe — it applies small, tested changes with strict blast radius limits. Each surgery session ends with working, tested code committed.

<HARD-GATE>
- Blast radius MUST be checked before starting (max 5 files)
- Safeguard MUST have run before any edit is made
- Tests MUST pass after every single edit — never accumulate failing tests
- Never refactor two coupled modules in the same session
</HARD-GATE>

## Called By (inbound)

- `rescue` (L1): Phase 2-N SURGERY — one surgery session per module

## Calls (outbound)

- `scout` (L2): understand module dependencies, consumers, and blast radius
- `safeguard` (L2): if untested module found, build safety net first
- `debug` (L2): when refactoring reveals hidden bugs
- `fix` (L2): apply refactoring changes
- `test` (L2): verify after each change
- `review` (L2): quality check on refactored code
- `journal` (L3): update rescue progress

## Execution Steps

### Step 1 — Pre-surgery scan

Call `rune:scout` targeting the module to refactor. Ask scout to return:
- All files the module imports (dependencies)
- All files that import the module (consumers)
- Total file count touched (blast radius check)

```
Count the unique files that would be modified in this surgery session.
If count > 5 → STOP. Split surgery into smaller sessions.
Report which files are in scope and which must wait for a later session.
```

Confirm that `rune:safeguard` has already run for this module (check for `tests/char/<module>.test.ts` and `rune-safeguard-<module>` git tag).

If safeguard has NOT run, call `rune:safeguard` now before continuing. Do not skip this.

### Step 2 — Select refactoring pattern

Based on module characteristics from scout, choose ONE pattern:

| Pattern | When to use |
|---|---|
| **Strangler Fig** | Module > 500 LOC with many consumers. New code grows alongside legacy, consumers migrate one by one. |
| **Branch by Abstraction** | Tightly coupled module. Create interface → wrap legacy behind it → build new impl → flip the switch. |
| **Expand-Migrate-Contract** | Changing a function signature or data shape. Expand (add new), migrate callers, contract (remove old). Each phase = one commit. |
| **Extract & Simplify** | Specific function with cyclomatic complexity > 10. Extract sub-functions, simplify conditionals. |

State the chosen pattern explicitly before starting.

### Step 3 — Refactor

Use `Edit` for all code changes. Rules:
- One logical change per `Edit` call — do not batch unrelated changes
- Changes MUST be small and reversible
- Never rewrite a file from scratch — use targeted edits
- Never change more than 5 files total in this session
- If a change reveals a hidden bug, stop and call `rune:debug` before continuing

For **Strangler Fig**: Create the new module file first, then update one consumer at a time.

For **Branch by Abstraction**: Create the interface first (commit), wrap legacy (commit), build new impl (commit), switch (commit). Four commits minimum.

For **Expand-Migrate-Contract**: Expand (add new API alongside old), migrate each caller (one commit per caller if possible), contract (remove old API last).

For **Extract & Simplify**: Extract sub-functions one at a time. Each extraction = one commit.

### Step 4 — Test after each change

After every `Edit`, call `rune:test` targeting:
1. The characterization tests from `tests/char/<module>.test.ts`
2. Any existing unit tests for the module
3. Any consumer tests affected by this change

```
If any test fails → STOP. Do NOT continue with more edits.
Call rune:debug to investigate. Fix before next edit.
The code MUST stay in a working state after every single change.
```

### Step 5 — Review

After all edits for this session are complete and tests pass, call `rune:review` on the changed files.

Address any CRITICAL or HIGH issues raised by review before committing.

### Step 6 — Commit

Use `Bash` to commit this surgery step:

```bash
git add <changed files>
git commit -m "refactor(<module>): [pattern] — [what was done]"
```

The commit message MUST describe which pattern was used and what changed. Each commit must leave the codebase in a fully working state.

### Step 7 — Update journal

Call `rune:journal` to record:
- Module operated on
- Pattern used
- Files changed
- Health score delta (estimated)
- What remains for next session (if partial)

## Refactoring Patterns

```
STRANGLER FIG           — New code grows around legacy (module > 500 LOC, many consumers)
BRANCH BY ABSTRACTION   — Interface → wrap legacy → build new → switch
EXPAND-MIGRATE-CONTRACT — Each step is one safe commit
EXTRACT & SIMPLIFY      — For complex functions (cyclomatic > 10)
```

## Safety Rules

```
- NEVER refactor 2 coupled modules in same session
- ALWAYS run tests after each change
- Max blast radius: 5 files per session
- If context low → STOP, save state, commit partial work
- Each commit must leave code in working state
- Never skip safeguard, even for "simple" changes
```

## Output Format

```
## Surgery Report: [Module Name]
- **Pattern**: [chosen pattern]
- **Status**: complete | partial (safe stopping point reached)
- **Health**: [before] → [after estimated]
- **Files Changed**: [list, max 5]
- **Commits**: [count]

### Steps Taken
1. [step] — [result] — [test status]

### Remaining (if partial)
- [what's left for next surgery session]
- Recommended: re-run rune:surgeon targeting [module] — session 2

### Next Step
[if complete]: Run rune:autopsy to update health scores
[if partial]: Commit this checkpoint, then start new surgeon session for remaining work
```

## Constraints

1. MUST verify safeguard tests pass before making any edit
2. MUST check blast radius before starting — max 5 files per session
3. MUST run tests after EVERY individual edit — never accumulate untested changes
4. MUST NOT change function signatures without updating all callers
5. MUST preserve external behavior — refactoring changes structure, not behavior

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Editing without confirming safeguard ran first | CRITICAL | HARD-GATE: check for `tests/char/<module>.test.*` AND `rune-safeguard-<module>` tag before first edit |
| Exceeding 5-file blast radius without splitting | HIGH | HARD-GATE: count files in scope before starting — stop and split if > 5 |
| Batching multiple edits before running tests | HIGH | HARD-GATE: run tests after every single Edit call — never accumulate untested changes |
| Wrong pattern chosen for module size/type | MEDIUM | Match pattern explicitly: Strangler Fig = large/many-consumers, Extract = high cyclomatic complexity |
| Not committing at safe stopping points when context runs low | MEDIUM | Every commit = working state — stop before context limit, not after losing partial work |

## Done When

- Safeguard confirmed (char tests + rollback tag exist)
- Blast radius checked and within 5 files
- Refactoring pattern selected and stated explicitly
- All edits applied with tests passing after each individual edit
- Characterization tests still pass after all changes
- review passed on changed files
- Surgery committed with message format `refactor(<module>): <pattern> — <description>`
- journal updated with module health delta and remaining work

## Cost Profile

~3000-6000 tokens input, ~1000-2000 tokens output. Sonnet. One module per session.
