---
name: debug
description: Root cause analysis for bugs and unexpected behavior. Traces errors through code, uses structured reasoning, and hands off to fix when cause is found. Core of the debug↔fix mesh.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L2
  model: sonnet
  group: development
---

# debug

## Purpose

Root cause analysis ONLY. Debug investigates — it does NOT fix. It traces errors through code, analyzes stack traces, forms and tests hypotheses, and identifies the exact cause before handing off to rune:fix.

<HARD-GATE>
Do NOT fix the code. Debug investigates only. Any code change is out of scope.
If root cause cannot be identified after 3 hypothesis cycles:
- Escalate to `rune:problem-solver` for structured 5-Whys or Fishbone analysis
- Or escalate to `rune:sequential-thinking` for multi-variable analysis
- Report escalation in the Debug Report with all evidence gathered so far
</HARD-GATE>

## Triggers

- Called by `cook` when implementation hits unexpected errors
- Called by `test` when a test fails with unclear reason
- Called by `fix` when root cause is unclear before fixing
- `/rune debug <issue>` — manual debugging
- Auto-trigger: when error output contains stack trace or error code

## Calls (outbound)

- `scout` (L2): find related code, trace imports, identify affected modules
- `fix` (L2): when root cause found, hand off with diagnosis for fix application
- `docs-seeker` (L3): lookup API docs for unclear errors or deprecated APIs
- `problem-solver` (L3): structured reasoning (5 Whys, Fishbone) for complex bugs
- `browser-pilot` (L3): capture browser console errors, network failures, visual bugs
- `sequential-thinking` (L3): multi-variable root cause analysis

## Called By (inbound)

- `cook` (L1): implementation hits bug during Phase 4
- `fix` (L2): root cause unclear, can't fix blindly — needs diagnosis first
- `test` (L2): test fails unexpectedly, unclear why
- `surgeon` (L2): diagnose issues in legacy modules

## Cross-Hub Connections

- `debug` ↔ `fix` — bidirectional: debug finds cause → fix applies, fix can't determine cause → debug investigates
- `debug` ← `test` — test fails → debug investigates

## Execution

### Step 1: Reproduce

Understand and confirm the error described in the request.

- Read the error message, stack trace, and reproduction steps
- Identify which environment it occurs in (dev/prod, browser/server)
- Confirm the error is consistent and reproducible before proceeding
- If no reproduction steps provided, ask for them or attempt the most likely path

### Step 2: Gather Evidence

Use tools to collect facts — do NOT guess yet.

- Use `Grep` to search codebase for the exact error string or related error codes
- Use `Read` to examine stack trace files, log files, or the specific file:line mentioned
- Use `Glob` to find related files (config, types, tests) that may be involved
- Use `rune:browser-pilot` if the issue is UI-related (console errors, network failures, visual bugs)
- Use `rune:scout` to trace imports and identify all modules touched by the affected code path

### Step 3: Form Hypotheses

List exactly 2-3 possible root causes — no more, no fewer.

- Each hypothesis must be specific (name the file, function, or line if possible)
- Order by likelihood (most likely first)
- Format:
  - H1: [specific hypothesis — file/function/pattern]
  - H2: [specific hypothesis]
  - H3: [specific hypothesis]

### Step 4: Test Hypotheses

Test each hypothesis systematically using tools.

- Use `Read` to inspect the suspected file/function for each hypothesis
- Use `Bash` to run targeted tests: a single failing test, a type check, a linter on the file
- Use `rune:browser-pilot` for UI hypotheses (inspect DOM, network, console)
- For each hypothesis: mark CONFIRMED / RULED OUT with evidence
- If all 3 hypotheses are ruled out → go back to Step 2 to gather more evidence
- Maximum 3 hypothesis cycles. If still unresolved after 3 cycles → escalate (see Hard-Gate)

### Step 5: Identify Root Cause

Narrow to the single actual cause.

- State the confirmed hypothesis and the exact evidence that proves it
- Identify the specific file, line number, and code construct responsible
- Note any contributing factors (environment, data, timing, config)

### Step 6: 3-Fix Escalation Rule

<HARD-GATE>
If the SAME bug has been "fixed" 3 times and keeps returning:
1. STOP fixing. The bug is not the problem — the ARCHITECTURE is.
2. Escalate to `rune:plan` for redesign of the affected module.
3. Report all 3 fix attempts and why each failed in the escalation.
"Try a 4th fix" is NOT acceptable. After 3 failures, question the design.
</HARD-GATE>

Track fix attempts in the Debug Report. If this is attempt N>1 for the same symptom:
- Reference previous fix attempts and their outcomes
- Explain why the previous fix didn't hold
- If N=3: trigger the escalation gate above

### Step 7: Report

Produce structured output and hand off to rune:fix.

- Write the Debug Report (see Output Format below)
- Call `rune:fix` with the full report if fix is needed
- Do NOT apply any code changes — report only

## Constraints

1. MUST NOT apply any code changes — debug investigates only, fix applies
2. MUST reproduce the error before forming hypotheses — no guessing from error messages alone
3. MUST gather evidence (file reads, grep, stack traces) before hypothesizing
4. MUST form exactly 2-3 hypotheses, ordered by likelihood — no more, no fewer
5. MUST mark each hypothesis CONFIRMED or RULED OUT with specific evidence
6. MUST NOT exceed 3 hypothesis cycles — escalate to problem-solver or sequential-thinking
7. MUST NOT say "I know what's wrong" without citing file:line evidence

## Output Format

```
## Debug Report
- **Error**: [error message]
- **Severity**: critical | high | medium | low
- **Confidence**: high | medium | low
- **Fix Attempt**: [1/2/3 — track recurring bugs]

### Root Cause
[Detailed explanation of what's causing the error]

### Location
- `path/to/file.ts:42` — [description of the problematic code]

### Evidence
1. [observation supporting diagnosis]
2. [observation supporting diagnosis]

### Previous Fix Attempts (if any)
- Attempt 1: [what was tried] → [why it didn't hold]
- Attempt 2: [what was tried] → [why it didn't hold]

### Suggested Fix
[Description of what needs to change — no code, just direction]
[If attempt 3: "ESCALATION: 3-fix rule triggered. Recommending redesign via rune:plan."]

### Related Code
- `path/to/related.ts` — [why it's relevant]
```

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Forming hypothesis from error message alone without evidence | HIGH | Evidence-first rule: read files and grep logs BEFORE hypothesizing |
| Modifying code while "investigating" | CRITICAL | HARD-GATE: any code change during debug = out of scope — hand off to fix |
| Marking hypothesis CONFIRMED without file:line proof | HIGH | CONFIRMED requires specific evidence cited — "it makes sense" is not evidence |
| Exceeding 3 hypothesis cycles without escalation | MEDIUM | After 3 cycles: escalate to rune:problem-solver or rune:sequential-thinking |
| Same bug "fixed" 3+ times without questioning architecture | CRITICAL | 3-Fix Escalation Rule: after 3 failed fixes, escalate to rune:plan for redesign |
| Not tracking fix attempt number for recurring bugs | HIGH | Debug Report MUST include Fix Attempt counter — enables escalation gate |

## Done When

- Error reproduced (not assumed) with specific reproduction steps documented
- 2-3 hypotheses formed, each marked CONFIRMED or RULED OUT with file:line evidence
- Root cause identified at specific file:line
- Structured Debug Report emitted
- No code changes made — rune:fix called with the report if fix is needed

## Cost Profile

~2000-5000 tokens input, ~500-1500 tokens output. Sonnet for code analysis quality. May escalate to opus for deeply complex bugs.
