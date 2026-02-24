---
name: debug
description: Root cause analysis for bugs and unexpected behavior. Traces errors through code, uses structured reasoning, and hands off to fix when cause is found. Core of the debug↔fix mesh.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L2
  model: sonnet
  group: development
---

# debug

## Purpose

Root cause analysis for bugs and unexpected behavior. Debug is the diagnostic engine of the Development Hub — it traces errors through code, analyzes stack traces, uses structured reasoning frameworks, and identifies the exact cause before handing off to fix. Tightly coupled with fix in a bidirectional mesh.

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

## Workflow

1. **Receive error report** — stack trace, error message, reproduction steps, affected files
2. **Reproduce** — verify the error exists and is consistent
3. **Trace** — call scout to find related code, trace data flow through affected functions
4. **Analyze** — examine error patterns, check common causes (null refs, async issues, type mismatches)
5. **Reason** — if complex, call problem-solver for structured analysis (5 Whys, Fishbone)
6. **Lookup** — if API-related, call docs-seeker for documentation verification
7. **Diagnose** — identify root cause with confidence level
8. **Hand off** — pass diagnosis to fix with suggested solution, or escalate to L1 if stuck

## Output Format

```
## Debug Report
- **Error**: [error message]
- **Severity**: critical | high | medium | low
- **Confidence**: high | medium | low

### Root Cause
[Detailed explanation of what's causing the error]

### Location
- `path/to/file.ts:42` — [description of the problematic code]

### Evidence
1. [observation supporting diagnosis]
2. [observation supporting diagnosis]

### Suggested Fix
[Description of what needs to change]

### Related Code
- `path/to/related.ts` — [why it's relevant]
```

## Cost Profile

~2000-5000 tokens input, ~500-1500 tokens output. Sonnet for code analysis quality. May escalate to opus for deeply complex bugs.
