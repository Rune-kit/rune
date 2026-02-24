---
name: scope-guard
description: Detects scope creep. Compares current git changes against original plan, flags out-of-scope files, and reports IN_SCOPE or CREEP_DETECTED.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L3
  model: haiku
  group: monitoring
---

# scope-guard

## Purpose

Passive scope monitor. Reads the original task plan, inspects current git diff to see what files have changed, and compares them against the planned scope. Flags any unplanned additions as scope creep with specific file-level detail.

## Called By (inbound)

- Auto-triggered by L1 orchestrators when files changed exceed plan expectations

## Calls (outbound)

None — pure L3 monitoring utility.

## Executable Instructions

### Step 1: Load Plan

Read the original task/plan from one of these sources (check in order):

1. TodoWrite task list — read active todos as the planned scope
2. `.rune/progress.md` — use `Read` on `D:\Project\.rune\progress.md` (or equivalent path)
3. If neither exists, ask the calling skill to provide the plan as a text description

Extract from the plan:
- List of files/directories expected to be changed
- List of features/tasks planned
- Any explicitly out-of-scope items mentioned

### Step 2: Assess Current Work

Run `Bash` with git diff to see what has actually changed:

```bash
git diff --stat HEAD
```

Also check staged changes:

```bash
git diff --stat --cached
```

Parse the output to extract the list of changed files.

### Step 3: Compare

For each changed file, determine if it is:
- **IN_SCOPE**: file matches a planned file/directory or is a natural dependency of planned work
- **OUT_OF_SCOPE**: file is not mentioned in the plan and is not a direct dependency

Rules for "natural dependency" (counts as IN_SCOPE):
- Test files for planned source files
- Config files modified as a side-effect of adding a planned feature
- Lock files (package-lock.json, yarn.lock, Cargo.lock) — always IN_SCOPE

Rules for OUT_OF_SCOPE (counts as creep):
- New features not mentioned in the plan
- Refactoring of files unrelated to the task
- New dependencies added without a planned feature requiring them
- Documentation files for unplanned features

### Step 4: Flag Creep

If any OUT_OF_SCOPE files are detected:
- List each out-of-scope file with the reason it is flagged
- Classify as: `MINOR CREEP` (1-2 unplanned files) or `SIGNIFICANT CREEP` (3+ unplanned files)

If zero OUT_OF_SCOPE files: status is `IN_SCOPE`.

### Step 5: Report

Output the following structure:

```
## Scope Report

- **Planned files**: [count from plan]
- **Actual files changed**: [count from git diff]
- **Out-of-scope files**: [count]
- **Status**: IN_SCOPE | MINOR CREEP | SIGNIFICANT CREEP

### In-Scope Changes
- [file] — [matches planned task]

### Out-of-Scope Changes
- [file] — [reason: unplanned feature | unrelated refactor | unplanned dep]

### Recommendations
- [If IN_SCOPE]: No action needed. Proceed.
- [If MINOR CREEP]: Review [file] — consider reverting or acknowledging as intentional.
- [If SIGNIFICANT CREEP]: STOP. Re-align with original plan before continuing. [list files to revert]
```

## Output Format

```
## Scope Report
- Planned files: 3 | Actual: 5 | Out-of-scope: 2
- Status: MINOR CREEP

### Out-of-Scope Changes
- src/components/NewWidget.tsx — unplanned feature
- docs/new-feature.md — documentation for unplanned feature

### Recommendations
- Review src/components/NewWidget.tsx — revert or log as intentional scope change.
```

## Constraints

1. MUST compare actual changes against stated scope — not just file count
2. MUST flag files modified outside scope with specific paths
3. MUST allow user override — advisory, not authoritarian

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Classifying test files for planned code as out-of-scope | MEDIUM | Test files for planned source files are always IN_SCOPE — natural dependency |
| Classifying lock file changes as out-of-scope | LOW | package-lock.json, yarn.lock, Cargo.lock are always IN_SCOPE |
| SIGNIFICANT CREEP threshold applied to 1-2 unplanned files | LOW | MINOR = 1-2 files, SIGNIFICANT = 3+ files — don't escalate prematurely |
| Plan not loadable (no TodoWrite, no progress.md) | MEDIUM | Ask calling skill for plan as text description before proceeding |

## Done When

- Plan loaded from TodoWrite active tasks or .rune/progress.md
- git diff --stat and --cached output parsed for all changed files
- Each changed file classified IN_SCOPE or OUT_OF_SCOPE with reasoning
- Creep severity classified (IN_SCOPE / MINOR CREEP / SIGNIFICANT CREEP)
- Scope Report emitted with recommendations

## Cost Profile

~200-500 tokens input, ~100-300 tokens output. Haiku. Lightweight monitor.
