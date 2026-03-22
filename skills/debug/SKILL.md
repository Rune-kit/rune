---
name: debug
description: Root cause analysis for bugs and unexpected behavior. Traces errors through code, uses structured reasoning, and hands off to fix when cause is found. Core of the debug↔fix mesh.
metadata:
  author: runedev
  version: "0.8.0"
  layer: L2
  model: sonnet
  group: development
  tools: "Read, Bash, Glob, Grep"
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
- `brainstorm` (L2): 3-Fix Escalation when root cause is "wrong approach" — invoke with mode="rescue" for category-diverse alternatives
- `plan` (L2): 3-Fix Escalation when root cause is "wrong module design" — invoke for redesign
- `docs-seeker` (L3): lookup API docs for unclear errors or deprecated APIs
- `problem-solver` (L3): structured reasoning (5 Whys, Fishbone) for complex bugs
- `browser-pilot` (L3): capture browser console errors, network failures, visual bugs
- `sequential-thinking` (L3): multi-variable root cause analysis
- `neural-memory` (L3): after root cause found — capture error pattern for future recognition

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

### Step 1.5: Scope Lock (Edit Boundary)

After reproducing the error, **lock edits to the narrowest affected directory** to prevent debug-driven scope creep — the #1 source of "while I'm here, let me also fix..." violations.

1. Identify the narrowest directory containing the affected files (from stack trace or error location)
2. Announce to user: "Debug scope locked to `<dir>/`. Changes will be restricted to this area."
3. Any fix recommendation in the Debug Report MUST reference only files within this boundary
4. If root cause traces outside the boundary → expand scope with user confirmation first

**Skip conditions** (do NOT lock):
- Bug spans the entire repo (3+ unrelated directories in stack trace)
- Cannot determine affected area from initial evidence
- User explicitly says "investigate everything"

**Why:** Debugging naturally expands scope as you trace root causes. Without a boundary, rune:fix receives recommendations touching 10+ files across unrelated modules. The scope lock forces discipline: fix at the source, not at every symptom site.

> Source: garrytan/gstack v0.9.0 (investigate skill) — auto-freeze to affected module during debug sessions.

### Step 2: Gather Evidence

Use tools to collect facts — do NOT guess yet.

- Use `Grep` to search codebase for the exact error string or related error codes
- Use `Read` to examine stack trace files, log files, or the specific file:line mentioned
- Use `Glob` to find related files (config, types, tests) that may be involved
- Use `rune:browser-pilot` if the issue is UI-related (console errors, network failures, visual bugs)
- Use `rune:scout` to trace imports and identify all modules touched by the affected code path

#### Backward Tracing (for deep stack errors)

When the error appears deep in execution (wrong directory, wrong path, wrong value):

1. **Observe symptom** — what's the exact error and where does it appear?
2. **Find immediate cause** — what code directly triggers this? Read that file:line
3. **What called this?** — trace one level up. What value was passed? By whom?
4. **Keep tracing up** — repeat until you find where the bad value ORIGINATES
5. **Fix at source** — the root cause is where invalid data is CREATED, not where it CRASHES

Rule: NEVER fix where the error appears. Trace back to where invalid data originated.

#### Instrumentation Tip: Use console.error, Not Loggers
When adding diagnostic instrumentation, use `console.error()` (stderr) — NOT application loggers. Loggers are configured to suppress output based on log level or environment (e.g., `LOG_LEVEL=warn` silences `logger.debug`). `console.error` bypasses all logger configuration and writes directly to stderr. This is counterintuitive but critical — the one time you NEED debug output is exactly when loggers are configured to hide it.

#### Defense-in-Depth (After Root Cause Found)
When the root cause is invalid data flowing through multiple layers, recommend fixing at ALL layers — not just the source:

| Layer | Purpose | Example |
|-------|---------|---------|
| Layer 1: Entry Point | Reject invalid input at API/CLI boundary | Validate not empty, exists, correct type |
| Layer 2: Business Logic | Ensure data makes sense for the operation | Validate required params before processing |
| Layer 3: Environment Guards | Prevent dangerous operations in specific contexts | Refuse destructive ops outside allowed dirs |
| Layer 4: Debug Instrumentation | Capture context for forensics | Stack trace logging before dangerous operations |

All four layers are necessary. During testing, each layer catches bugs the others miss — different code paths bypass single validation points. When recommending a fix via `rune:fix`, explicitly call out which layers need validation added.

#### Multi-Component Instrumentation (for systems with 3+ layers)

When the system has multiple components (CI → build → deploy, API → service → DB):

Before hypothesizing, add diagnostic logging at EACH component boundary:
- Log what data ENTERS each component
- Log what data EXITS each component
- Verify environment/config propagation across boundaries
- Run once → analyze logs → identify WHICH boundary fails → THEN hypothesize

This reveals: "secrets reach workflow ✓, workflow reaches build ✗" — pinpoints the failing layer.

### Step 2b: Instrument with Preserved Markers

When adding diagnostic logging or instrumentation during investigation, mark ALL additions with region markers:

```
// #region agent-debug — [hypothesis being tested]
console.log('[DEBUG] value at boundary:', data);
// #endregion agent-debug
```

Language-appropriate equivalents:
- Python: `# region agent-debug` / `# endregion agent-debug`
- Rust: `// region agent-debug` / `// endregion agent-debug`

**Why preserved markers matter:**
- `rune:fix` will preserve these markers until the bug is fully resolved and tests pass
- If the bug recurs, markers show exactly what was previously instrumented
- Cleaning up debug traces before the fix is verified prevents learning from failure history
- After fix is verified + tests pass → fix will clean up markers in a final pass

<HARD-GATE>
ALL diagnostic code added during debug MUST be wrapped in `#region agent-debug` markers.
Unmarked instrumentation will be treated as stray code and removed prematurely.
</HARD-GATE>

### Step 2c: Check Debug Knowledge Base

Before forming hypotheses, check `.rune/debug/knowledge-base.md`:
- If file exists → search for matching symptoms/error messages
- If match found → try known fix FIRST, skip hypothesis cycle
- If no match → proceed to Step 3

After successful root cause identification (Step 5), append entry:
```
### [date] — [symptom summary]
- **Symptom**: [error message or behavior]
- **Root Cause**: [what was actually wrong]
- **Fix**: [what resolved it]
- **Files**: [affected files]
```

This prevents re-debugging the same issue across sessions.

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

### Step 5b: Capture Error Pattern

Call `neural-memory` (Capture Mode) to save the error pattern: root cause, symptoms, and fix approach. Tag with [project-name, error, technology].

### Step 6: 3-Fix Escalation Rule

<HARD-GATE>
If the SAME bug has been "fixed" 3 times and keeps returning:
1. STOP fixing. The bug is not the problem — the ARCHITECTURE is.
2. **Classify the failure**:
   - **Same category of blocker each time** (e.g., API doesn't support X, platform limitation) → the APPROACH is wrong, not just the code
   - **Different bugs each time** (e.g., race condition, then null pointer, then type error) → the MODULE needs redesign
3. **Route based on classification**:
   - Approach is wrong → Escalate to `rune:brainstorm(mode="rescue")` for category-diverse alternatives
   - Module needs redesign → Escalate to `rune:plan` for redesign of the affected module
4. Report all 3 fix attempts and why each failed in the escalation.
"Try a 4th fix" is NOT acceptable. After 3 failures, question the design OR the approach.
</HARD-GATE>

Track fix attempts in the Debug Report. If this is attempt N>1 for the same symptom:
- Reference previous fix attempts and their outcomes
- Explain why the previous fix didn't hold
- If N=3: trigger the escalation gate above — classify and route accordingly

### Step 7: Report

Produce structured output and hand off to rune:fix.

- Write the Debug Report (see Output Format below)
- Call `rune:fix` with the full report if fix is needed
- Do NOT apply any code changes — report only

## Analysis Paralysis Guard

<HARD-GATE>
Debug is read-heavy by nature — but there are limits.

After Step 4 (Test Hypotheses): if NO hypothesis is confirmed after 3 cycles of Steps 2-4, you MUST stop and escalate. Do NOT start cycle 4. Report all evidence gathered and escalate to problem-solver or sequential-thinking.

Within any single step: 5+ consecutive Read/Grep calls without forming or testing a hypothesis = stuck. Stop reading, form a hypothesis from what you have, and test it. Incomplete hypotheses that get tested are better than perfect hypotheses that never form.
</HARD-GATE>

### Hash-Based Evidence Loop Detection

Beyond counting reads, detect when debug is **re-gathering the same evidence without progress** — the most common debug-specific stuck pattern.

**Detection signals** (track mentally across hypothesis cycles):

| Signal | Count | Meaning | Action |
|--------|-------|---------|--------|
| Reading the same file:line range in different cycles | 2x | Re-examining without new lens | Form hypothesis from existing evidence NOW |
| Running the same test command with same failure output | 3x | No code changed between runs | STOP — hand off to fix with current diagnosis, even if incomplete |
| Grepping the same error string after already finding all occurrences | 2x | Hoping for different results | Evidence is complete — move to Step 3 (hypothesize) |
| Same hypothesis tested with same evidence across cycles | 2x | Circular reasoning | Mark hypothesis INCONCLUSIVE, try a DIFFERENT hypothesis category |

**Hypothesis category diversity rule**: If H1 (cycle 1) was "wrong input data" and it was RULED OUT, H1 (cycle 2) MUST be from a DIFFERENT category:

| Category | Examples |
|----------|---------|
| Data | Wrong value, missing field, type mismatch, encoding |
| Control Flow | Wrong branch, missing guard, race condition, async ordering |
| Environment | Wrong config, missing env var, version mismatch, path issue |
| State | Stale cache, mutation side-effect, leaked reference, dangling connection |

> Source: goclaw (832★) — content-aware loop detection adapted for debug hypothesis cycles.

## Red Flags — STOP and Return to Step 2

If you catch yourself thinking any of these, you are GUESSING, not debugging:

- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "It's probably X, let me fix that"
- "I don't fully understand but this might work"
- "Here are the main problems: [lists fixes without investigation]"
- Proposing solutions before tracing data flow
- "One more fix attempt" (when already tried 2+)
- "Let me read one more file before forming a hypothesis" (after 5+ reads)

ALL of these mean: STOP. Return to Step 2 (Gather Evidence).

## Constraints

1. MUST NOT apply any code changes — debug investigates only, fix applies
2. MUST reproduce the error before forming hypotheses — no guessing from error messages alone
3. MUST gather evidence (file reads, grep, stack traces) before hypothesizing
4. MUST form exactly 2-3 hypotheses, ordered by likelihood — no more, no fewer
5. MUST mark each hypothesis CONFIRMED or RULED OUT with specific evidence
6. MUST NOT exceed 3 hypothesis cycles — escalate to problem-solver or sequential-thinking
7. MUST NOT say "I know what's wrong" without citing file:line evidence
8. For deep stack errors: MUST use backward tracing (Step 2) — never fix at the crash site
9. For multi-component systems: MUST instrument boundaries before hypothesizing

## Output Format

```
## Debug Report
- **Error**: [error message]
- **Status**: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
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

### Concerns (if DONE_WITH_CONCERNS)
- [concern]: [impact assessment] — [suggested remediation]

### Context Needed (if NEEDS_CONTEXT)
- [what is unknown]: [why it blocks diagnosis] — [two most likely answers]

### Suggested Fix
[Description of what needs to change — no code, just direction]
[If attempt 3: "ESCALATION: 3-fix rule triggered. Recommending redesign via rune:plan."]

### Related Code
- `path/to/related.ts` — [why it's relevant]
```

### Status Protocol (Subagent Contract)

Debug returns one of four statuses to its caller (cook, fix, test, surgeon). The caller uses this to route next actions.

| Status | When | Example |
|--------|------|---------|
| `DONE` | Root cause identified with high confidence, ready for fix | Clear diagnosis with file:line evidence |
| `DONE_WITH_CONCERNS` | Root cause found but diagnosis has caveats | "Likely race condition but cannot reproduce consistently — fix may need retry logic" |
| `NEEDS_CONTEXT` | Cannot diagnose without more info — missing repro steps, env details, or access | "Error only occurs in production — need prod logs or env variables to continue" |
| `BLOCKED` | Exhausted 3 hypothesis cycles, escalation triggered | "3 cycles completed, no confirmed root cause — escalating to problem-solver" |

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| Debug Report | Markdown (inline) | Emitted to calling skill (cook, fix, test, surgeon) |
| Root cause + location | Inline (Debug Report) | Specific file:line with evidence |
| Fix recommendation | Inline (Debug Report) | Direction only — no code changes |
| Debug knowledge base entry | Markdown | `.rune/debug/knowledge-base.md` (appended on success) |

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Forming hypothesis from error message alone without evidence | HIGH | Evidence-first rule: read files and grep logs BEFORE hypothesizing |
| Modifying code while "investigating" | CRITICAL | HARD-GATE: any code change during debug = out of scope — hand off to fix |
| Marking hypothesis CONFIRMED without file:line proof | HIGH | CONFIRMED requires specific evidence cited — "it makes sense" is not evidence |
| Exceeding 3 hypothesis cycles without escalation | MEDIUM | After 3 cycles: escalate to rune:problem-solver or rune:sequential-thinking |
| Same bug "fixed" 3+ times without questioning architecture | CRITICAL | 3-Fix Escalation Rule: classify failure → same blocker category = brainstorm(rescue), different bugs = plan redesign |
| Escalating to plan when the APPROACH is wrong (not the module) | HIGH | If all 3 fixes hit the same category of blocker (API limit, platform gap), the approach needs pivoting via brainstorm(rescue), not re-planning |
| Not tracking fix attempt number for recurring bugs | HIGH | Debug Report MUST include Fix Attempt counter — enables escalation gate |
| Adding instrumentation without region markers | MEDIUM | All debug logging MUST use `#region agent-debug` — unmarked code gets cleaned up prematurely by fix |
| Re-reading same file:line in different hypothesis cycles | HIGH | Hash-based evidence loop: if same evidence gathered 2x, form hypothesis from existing data — don't re-gather |
| Same hypothesis category across cycles after RULED OUT | HIGH | Hypothesis category diversity: if "data" ruled out in cycle 1, cycle 2 must try "control flow", "environment", or "state" |
| Running same test 3x with same failure without code change | MEDIUM | True stuck loop — no progress possible. Hand off to fix with current incomplete diagnosis |
| Scope creep via debug — "while investigating, also fix X" | HIGH | Step 1.5 Scope Lock: lock edits to narrowest affected directory. Fix recommendations MUST stay within boundary. Expand only with user confirmation |
| Debug report recommends touching 5+ unrelated files | HIGH | Symptom of fixing at crash sites instead of source. Backward trace (Step 2) to find origin. If truly 5+ files → likely architectural issue → escalate via 3-Fix Rule |

## Done When

- Error reproduced (not assumed) with specific reproduction steps documented
- 2-3 hypotheses formed, each marked CONFIRMED or RULED OUT with file:line evidence
- Root cause identified at specific file:line
- Structured Debug Report emitted with 4-state status
- If `DONE_WITH_CONCERNS`: caveats documented with impact assessment
- If `NEEDS_CONTEXT`: specific questions + two likely answers provided
- If `BLOCKED`: all 3 hypothesis cycles documented + escalation target identified
- No code changes made — rune:fix called with the report if fix is needed

## Cost Profile

~2000-5000 tokens input, ~500-1500 tokens output. Sonnet for code analysis quality. May escalate to opus for deeply complex bugs.

**Scope guardrail**: Do not apply code changes or expand investigation beyond the locked scope directory unless explicitly delegated by the parent agent.
