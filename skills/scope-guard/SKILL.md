---
name: scope-guard
description: "Detects scope creep by quantifying drift percentage. Auto-triggered by L1 orchestrators when files exceed the original plan. Compares git changes against plan, classifies drift into 4 tiers: ON_TRACK, MINOR_DRIFT, SIGNIFICANT_DRIFT, OUT_OF_CONTROL."
user-invocable: false
metadata:
  author: runedev
  version: "0.4.0"
  layer: L3
  model: haiku
  group: monitoring
  tools: "Read, Glob, Grep"
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

### Step 4: Quantify Drift

Compute **Drift Percentage** — the ratio of out-of-scope changes to total changes:

```
drift_pct = (out_of_scope_files / total_files_changed) × 100
```

Classify drift into a 4-tier system:

| Drift % | Level | Status | Action |
|---------|-------|--------|--------|
| **< 10%** | ON TRACK | `ON_TRACK` | No action needed. Proceed normally. |
| **10-25%** | MINOR DRIFT | `MINOR_DRIFT` | Flag out-of-scope files. Suggest trim or acknowledge as intentional. Continue. |
| **25-50%** | SIGNIFICANT DRIFT | `SIGNIFICANT_DRIFT` | **Pause recommended.** Present drift report to user. Re-scope before continuing. |
| **> 50%** | OUT OF CONTROL | `OUT_OF_CONTROL` | **Block.** More unplanned work than planned. Escalate to orchestrator. Require re-alignment before ANY further work. |

**Edge case**: If total planned files = 0 (no plan loaded), use file count thresholds instead:
- 0 out-of-scope → ON_TRACK
- 1-2 out-of-scope → MINOR_DRIFT
- 3-5 out-of-scope → SIGNIFICANT_DRIFT
- 6+ out-of-scope → OUT_OF_CONTROL

### Step 5: Report

Output the following structure:

```
## Scope Report

- **Planned files**: [count from plan]
- **Actual files changed**: [count from git diff]
- **Out-of-scope files**: [count]
- **Drift**: [X]% ([level])
- **Status**: ON_TRACK | MINOR_DRIFT | SIGNIFICANT_DRIFT | OUT_OF_CONTROL

### In-Scope Changes
- [file] — [matches planned task]

### Out-of-Scope Changes
- [file] — [reason: unplanned feature | unrelated refactor | unplanned dep]

### Recommendations
- [ON_TRACK]: No action needed. Proceed.
- [MINOR_DRIFT]: Review [file] — consider reverting or acknowledging as intentional.
- [SIGNIFICANT_DRIFT]: PAUSE. Drift is [X]%. Re-align scope with original plan. Suggested cuts: [files to revert]
- [OUT_OF_CONTROL]: STOP. [X]% of changes are unplanned — more drift than planned work. Present full report to user/orchestrator. Do NOT continue until re-scoped.
```

## Output Format

```
## Scope Report
- Planned files: 3 | Actual: 5 | Out-of-scope: 2
- Drift: 40% (SIGNIFICANT_DRIFT)

### Out-of-Scope Changes
- src/components/NewWidget.tsx — unplanned feature
- docs/new-feature.md — documentation for unplanned feature

### Recommendations
- PAUSE. Drift is 40%. Re-align scope with original plan.
- Suggested cuts: revert src/components/NewWidget.tsx + docs/new-feature.md (reduces drift to 0%)
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
| Over-escalating drift (e.g., 1 extra file = OUT_OF_CONTROL) | LOW | Use drift percentage, not gut feeling. 1 extra file out of 10 = 10% = MINOR_DRIFT, not panic |
| Plan not loadable (no TodoWrite, no progress.md) | MEDIUM | Ask calling skill for plan as text description before proceeding |
| Scope check against plan but not against stated intent | MEDIUM | Plan-based scope guard catches file drift; review Step 6.6 (Scope Drift Detection) catches intent drift. Both should run for full coverage |

## Done When

- Plan loaded from TodoWrite active tasks or .rune/progress.md
- git diff --stat and --cached output parsed for all changed files
- Each changed file classified IN_SCOPE or OUT_OF_SCOPE with reasoning
- Drift percentage computed and classified (ON_TRACK / MINOR_DRIFT / SIGNIFICANT_DRIFT / OUT_OF_CONTROL)
- Scope Report emitted with drift %, level, and actionable recommendations

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| Scope Report | Markdown (drift %, 4-tier level, recommendations) | inline |
| In-scope file list | Classified list | inline |
| Out-of-scope drift report | File list with reasons | inline |
| Recommendations | Actionable list | inline |

## Cost Profile

~200-500 tokens input, ~100-300 tokens output. Haiku. Lightweight monitor.

**Scope guardrail:** scope-guard reports drift and advises — it does not revert files, block commits, or modify code. Override decisions belong to the calling orchestrator or the user.
