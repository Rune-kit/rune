---
name: fix
description: Apply code changes and fixes. Writes implementation code, applies bug fixes, and verifies changes with tests. Core action hub in the development mesh.
metadata:
  author: runedev
  version: "0.6.0"
  layer: L2
  model: sonnet
  group: development
  tools: "Read, Write, Edit, Bash, Glob, Grep"
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
- `neural-memory` (L3): after fix verified — capture fix pattern (cause → solution)

## Called By (inbound)

- `cook` (L1): Phase 4 IMPLEMENT — apply code changes
- `debug` (L2): root cause found, ready to apply fix
- `review` (L2): bug found during review, needs fixing
- `surgeon` (L2): apply refactoring changes
- `review-intake` (L2): apply fixes identified during structured review intake

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

### Step 4.5: Quality Decay Check (Self-Regulation)

When fix is called repeatedly (e.g., by cook Phase 4, or iterative fix loops), track a **WTF-likelihood score** — the probability that continued fixing is making things worse.

**Compute every 3 fix attempts** (or when called 5+ times in a single cook session):

| Signal | Score Adjustment |
|--------|-----------------|
| A fix was reverted (any test that passed now fails) | +15% |
| Fix touched >3 files (blast radius expanding) | +5% per extra file beyond 3 |
| 15+ fixes already applied in this session | +1% per fix beyond 15 |
| All remaining issues are LOW severity | +10% |
| Fix touched files outside the original diagnosis scope | +20% |
| Consecutive fixes without running tests between them | +10% |

**Thresholds:**
- **>20% WTF-likelihood**: STOP fixing. Report current state to cook/user with: "Quality decay detected — continued fixes risk introducing more bugs than they resolve. {N} fixes applied, {score}% risk. Recommend: commit current progress, re-assess remaining issues."
- **Hard cap: 30 fixes per session** — regardless of score. After 30, STOP and report.

**Reset conditions:** WTF-likelihood resets to 0% when:
- User explicitly says "continue fixing"
- A full test suite run shows zero regressions
- Scope is narrowed to a single file

> Source: garrytan/gstack v0.9.0 (qa skill) — prevents runaway fix loops where each fix introduces new risk.

### Step 5: Post-Fix Hardening (Defense-in-Depth)

After the fix works, make the bug **structurally impossible** — not just "fixed this time."

Single validation at one point can be bypassed by different code paths, refactoring, or mocks. Add validation at EVERY layer data passes through:

| Layer | Purpose | Example |
|-------|---------|---------|
| **Entry Point** | Reject invalid input at API boundary | Validate params not empty/exists/correct type |
| **Business Logic** | Ensure data makes sense for this operation | Check preconditions specific to this function |
| **Environment Guard** | Prevent dangerous ops in specific contexts | In tests: refuse writes outside tmpdir |
| **Debug Instrumentation** | Capture context for forensics if bug recurs | Log stack trace + key values before risky ops |

Apply this when: the bug was caused by invalid data flowing through multiple layers. Skip for trivial one-liner fixes.

### Step 5b: Preserve Debug Instrumentation

If `rune:debug` left `#region agent-debug` markers in the code:

1. **During fix**: DO NOT remove these markers — they capture the investigation trail
2. **After fix verified** (tests pass, lint pass): scan for `#region agent-debug` markers
3. **Remove markers and their contents** in a final cleanup pass ONLY after full verification
4. If the fix is partial or tests still fail → KEEP all markers for the next debug cycle

**Why:** Premature cleanup of debug instrumentation erases failure history. If the bug recurs after cleanup, the next debug session starts from zero. Keeping markers until verification means downstream skills can see what was already investigated.

### Step 6: Self-Review

Verify correctness of the changes just made.

- Call `rune:hallucination-guard` to verify all imports introduced or modified are real and correctly named
- Call `rune:docs-seeker` if any external API, library method, or SDK call was added or changed
- For complex or risky fixes (auth, data mutation, async logic): call `rune:review` for a full quality check

### Step 6b: Capture Fix Pattern

Call `neural-memory` (Capture Mode) to save the fix pattern: what broke, why, and how it was fixed. Priority 7 for recurring bugs.

### Step 7: Report

Produce a structured summary of all changes made.

- List every file modified and a one-line description of what changed
- Include verification results (tests, types, lint)
- Note any follow-up work if the fix is partial or has known limitations

## Constraints

1. MUST NOT change test files to make tests pass — fix the CODE, not the TESTS
2. MUST have a diagnosis (from debug or clear error) before applying fixes
3. MUST run tests after each fix attempt — never batch multiple untested changes
4. MUST NOT exceed 3 fix attempts — if 3 fixes fail, re-diagnose via rune:debug (which will classify: wrong approach → brainstorm rescue, wrong design → plan redesign)
5. MUST follow project conventions found by scout — don't invent new patterns
6. MUST NOT add unplanned features while fixing — fix only what was diagnosed
7. MUST track fix attempt number — this feeds debug's 3-Fix Escalation classification
8. MUST preserve `#region agent-debug` markers until fix is fully verified — cleanup only after tests pass

## Scope Gate

| Change Type | Action |
|-------------|--------|
| Bug fix (diagnosed cause) | Fix it |
| Security fix (found during fix) | Fix it + flag to sentinel |
| Blocking issue (can't complete fix without) | Fix it + document in report |
| Unrelated improvement | **STOP — create separate task** |
| Architectural change | **STOP — escalate to cook/plan** |

If fix requires touching >3 files not in the diagnosis → re-diagnose. You're probably fixing a symptom.

## Mesh Gates

| Gate | Requires | If Missing |
|------|----------|------------|
| Evidence Gate | Debug report OR clear error description before fixing | Run rune:debug first |
| Test Gate | Tests run after each fix attempt | Run tests before claiming fix works |

## Output Format

```
## Fix Report
- **Task**: [what was fixed/implemented]
- **Status**: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED

### Changes
- `path/to/file.ts` — [description of change]
- `path/to/other.ts` — [description of change]

### Verification
- Lint: PASS | FAIL
- Types: PASS | FAIL
- Tests: PASS | FAIL ([n] passed, [m] failed)

### Concerns (if DONE_WITH_CONCERNS)
- [concern]: [impact assessment] — [suggested remediation]

### Context Needed (if NEEDS_CONTEXT)
- [what is unknown]: [why it blocks] — [two most likely answers]

### Blocker (if BLOCKED)
- [specific blocker]: [what was attempted]

### Notes
- [any caveats or follow-up needed]
```

### Status Protocol (Subagent Contract)

Fix returns one of four statuses to its caller (cook, debug, review, surgeon). The caller uses this to route next actions.

| Status | When | Example |
|--------|------|---------|
| `DONE` | Fix applied, tests pass, no issues | Clean bug fix, all green |
| `DONE_WITH_CONCERNS` | Fix works but has side effects or caveats worth noting | "Tests pass but performance regressed 15% — consider optimizing in follow-up" |
| `NEEDS_CONTEXT` | Cannot apply fix without clarification — ambiguous spec or missing info | "Two valid interpretations of the expected behavior — need user input" |
| `BLOCKED` | Hard blocker — exhausted fix attempts, broken dependency, fundamental incompatibility | "3 fix attempts failed — triggering debug escalation" |

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| Code changes | Source files | Per debug report / plan file paths |
| Fix Report | Markdown (inline) | Emitted to calling skill (cook, debug, review, surgeon) |
| Verification output | Inline (Fix Report) | Lint + types + test results |

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Modifying test files to make tests pass | CRITICAL | HARD-GATE blocks this — fix the code, never the tests (unless test setup is provably wrong) |
| Applying fix without a diagnosis | HIGH | Evidence Gate: need debug report or clear error description before touching code |
| Exceeding 3 fix attempts without re-diagnosing | HIGH | Constraint 4: after 3 failures, call debug again — the hypothesis was wrong |
| Introducing unrelated refactoring while fixing | MEDIUM | YAGNI: fix only what was diagnosed — unrelated changes belong in a separate task |
| Not running tests after each individual change | MEDIUM | Constraint 3: never batch untested changes — run tests after each edit |
| Fixing at crash site without tracing data origin | HIGH | Defense-in-depth: trace where bad data ORIGINATES, add validation at every layer it passes through |
| Single-point validation (fix one spot, hope it holds) | MEDIUM | Step 5: add entry + business logic + environment + debug layers for data-flow bugs |
| Removing debug instrumentation before fix is verified | MEDIUM | Step 5b: preserve `#region agent-debug` markers until all tests pass — premature cleanup erases failure history |
| Runaway fix loop — 20+ fixes without checking quality decay | HIGH | Step 4.5: WTF-likelihood self-regulation. >20% risk = STOP. Hard cap 30 fixes/session. Each fix adds risk — diminishing returns after ~15 |

## Done When

- Root cause identified (debug report or clear error received)
- Minimal changes applied targeting only the diagnosed problem
- Tests pass for the fixed functionality (actual output shown)
- Lint and type check pass
- hallucination-guard verified any new imports
- Fix Report emitted with 4-state status, changed files, and verification results
- If `DONE_WITH_CONCERNS`: concerns listed with impact + remediation
- If `NEEDS_CONTEXT`: specific questions stated with two likely answers
- If `BLOCKED`: blocker + all attempted approaches documented

## Cost Profile

~2000-5000 tokens input, ~1000-3000 tokens output. Sonnet for code writing quality. Most active skill during implementation.

**Scope guardrail**: Do not refactor unrelated code or create new features beyond the diagnosed fix target unless explicitly delegated by the parent agent.
