---
name: completion-gate
description: "Validates agent claims against evidence trail. Catches 'done' without proof, 'tests pass' without output, 'fixed' without verification. Called by cook and team at workflow end."
user-invocable: false
metadata:
  author: runedev
  version: "1.8.0"
  layer: L3
  model: haiku
  group: validation
  tools: "Read, Bash, Glob, Grep"
---

# completion-gate

## Purpose

The lie detector for agent claims. Validates that what an agent says it did actually happened — with evidence. Catches the #1 failure mode in AI coding: claiming completion without proof.

<HARD-GATE>
Every claim requires evidence. No evidence = UNCONFIRMED = BLOCK.
"I ran the tests and they pass" without stdout = UNCONFIRMED.
"I fixed the bug" without before/after diff = UNCONFIRMED.
"Build succeeds" without build output = UNCONFIRMED.
</HARD-GATE>

## Triggers

- Called by `cook` in Phase 5d (quality gate)
- Called by `team` before merging stream results
- Called by any skill that reports "done" to an orchestrator
- Auto-trigger: when agent says "done", "complete", "fixed", "passing"

## Calls (outbound)

None — pure validator. Reads evidence, produces verdict.

## Called By (inbound)

- `cook` (L1): Phase 5d — validate completion claims before commit
- `team` (L1): validate cook reports from parallel streams

## Execution

### Step 1 — Collect Claims

Parse the agent's output for completion claims. Common claim patterns:

```
CLAIM PATTERNS:
  "tests pass" / "all tests passing" / "test suite green"
  "build succeeds" / "build complete" / "compiles clean"
  "no lint errors" / "lint clean"
  "fixed" / "resolved" / "bug is gone"
  "implemented" / "feature complete" / "done"
  "no security issues" / "sentinel passed"
```

Extract each claim as: `{ claim: string, source_skill: string }`

### Step 1b — Stub Detection (Existence Theater Check)

Before checking claims, scan all files created/modified in this workflow for stubs:

```
Grep for stub patterns in new/modified files:
- "Placeholder" | "TODO" | "Not implemented" | "NotImplementedError"
- Functions with body: only `return null` / `return {}` / `pass` / `throw`
- Components returning only a single div with no logic
```

If ANY stub detected:
- Add synthetic claim: "implemented [filename]" → CONTRADICTED (file is a stub)
- This catches agents that create files but don't implement them

### Step 1c — Self-Validation Check

If the skill that just ran has a `## Self-Validation` section, extract its checklist and treat each item as an implicit claim:

```
For each Self-Validation check in the skill's SKILL.md:
  1. Read the check (e.g., "at least one assertion per test")
  2. Look for evidence in tool output that this check was satisfied
  3. If evidence found → add as CONFIRMED claim
  4. If no evidence → add as UNCONFIRMED claim ("Self-Validation: [check] — no evidence")
```

Why: Self-Validation catches domain-specific quality issues that generic claim matching (Step 2) cannot detect. A test skill knows "no assertions = useless test" but completion-gate doesn't — unless the skill's Self-Validation tells it to check.

<HARD-GATE>
If a skill has Self-Validation and ANY check is UNCONFIRMED or CONTRADICTED → overall verdict cannot be CONFIRMED, even if all explicit claims pass.
</HARD-GATE>

### Step 1d — Execution Loop Audit

Before validating claims, audit the agent's tool call pattern for execution loops that indicate the agent was stuck but didn't report it:

**Classify the agent's tool calls** from this workflow into two categories:

| Category | Tools | Expected in Phase 4 |
|----------|-------|---------------------|
| **Observation** | Read, Grep, Glob, Bash(grep/ls/cat) | <40% of calls |
| **Effect** | Write, Edit, Bash(build/test/npm) | >60% of calls |

**Loop patterns to detect**:

| Pattern | Detection | Verdict Impact |
|---------|-----------|----------------|
| **Observation chain**: 6+ consecutive observation tools in Phase 4 | Count longest observation-only streak | Add WARN: "Agent had {N}-call observation streak during implementation — possible analysis paralysis" |
| **Low effect ratio**: <20% effect calls during Phase 4 | `effect_calls / total_calls` | Add WARN: "Only {X}% of Phase 4 calls were writes — agent may have been stuck" |
| **Repeating tool pattern**: Same tool+args called 3+ times | Hash tool+args, count duplicates | Add WARN: "Agent called {tool}({args}) {N} times — possible loop" |
| **Budget overrun**: Phase 4 exceeded 50 tool calls for a single-file task | Count Phase 4 calls vs files changed | Add WARN: "50+ tool calls for {N} files changed — disproportionate effort" |

**Scoring impact**: Loop warnings don't change individual claim verdicts but ARE included in the Completion Gate Report under a new `### Execution Efficiency` section. This gives the calling orchestrator signal about whether the agent's process was healthy, not just whether the output was correct.

**Skip if**: Nano/Fast rigor — not enough tool calls to meaningfully analyze.

### Step 2 — Match Evidence

For each claim, look for corresponding evidence in the conversation context:

| Claim Type | Required Evidence | Where to Find |
|---|---|---|
| "tests pass" | Test runner stdout with pass count | Bash output from test command |
| "build succeeds" | Build command stdout showing success | Bash output from build command |
| "lint clean" | Linter stdout (even if empty = 0 errors) | Bash output from lint command |
| "fixed" | Git diff showing the change + test proving fix | Edit/Write tool calls + test output |
| "implemented" | Files created/modified matching the plan | Write/Edit tool calls vs plan |
| "no security issues" | Sentinel report with PASS verdict | Sentinel skill output |
| "coverage ≥ X%" | Coverage tool output with actual percentage | Test runner with coverage flag |

### Step 3 — Validate Each Claim (Default-FAIL Mindset)

<HARD-GATE>
Default posture is FAIL, not PASS. Actively seek 3-5 issues per review.
Zero issues found = red flag — look harder, not a sign of quality.
This prevents rubber-stamping where the gate confirms everything without scrutiny.
</HARD-GATE>


For each claim + evidence pair:

```
IF evidence exists AND evidence supports claim:
  → CONFIRMED
IF evidence exists BUT contradicts claim:
  → CONTRADICTED (most serious — agent is wrong)
IF no evidence found:
  → UNCONFIRMED (agent may be right but didn't prove it)
```

**3-Axis verification** — categorize each claim into one of three axes, then ensure all axes are covered:

| Axis | Question | Example Claims |
|------|----------|----------------|
| **Completeness** | Were all planned tasks done? All specs implemented? | "implemented feature X", "all TODO items done", "migration created" |
| **Correctness** | Does output match spec intent? Do tests verify real behavior? | "tests pass", "build succeeds", "lint clean", "fixed the bug" |
| **Coherence** | Does it follow project patterns? Consistent with existing code? | "follows conventions", "uses existing patterns", "no new deps needed" |

If an axis has ZERO claims → flag as gap: "No [Completeness/Correctness/Coherence] evidence found — agent may have skipped this dimension."

**Adversarial validation checklist** (run AFTER initial verdicts):
1. Re-read each CONFIRMED claim — is the evidence actually proving THIS claim, or a different one?
2. Check for **partial completion** — did the agent do 80% but claim 100%? (e.g., "implemented feature" but only the happy path)
3. Check for **scope mismatch** — does the evidence prove the SPECIFIC claim or a broader/narrower version?
4. If all claims are CONFIRMED on first pass, apply **skeptic sweep**: re-examine the weakest 2 claims with heightened scrutiny
5. Check **axis coverage** — are all 3 axes (Completeness/Correctness/Coherence) represented? Missing axis = investigation gap

### Step 4 — Report

```
## Completion Gate Report
- **Status**: CONFIRMED | UNCONFIRMED | CONTRADICTED
- **Claims Checked**: [count]
- **Confirmed**: [count] | **Unconfirmed**: [count] | **Contradicted**: [count]

### Claim Validation
| # | Claim | Evidence | Verdict |
|---|---|---|---|
| 1 | "All tests pass" | Bash: `npm test` → "42 passed, 0 failed" | CONFIRMED |
| 2 | "Build succeeds" | No build command output found | UNCONFIRMED |
| 3 | "No lint errors" | Bash: `npm run lint` → "3 errors" | CONTRADICTED |

### Gaps (if any)
- Claim 2: Re-run `npm run build` and capture output
- Claim 3: Agent claimed clean but lint shows 3 errors — fix required

### Verdict
UNCONFIRMED — 1 claim lacks evidence, 1 contradicted. Cannot proceed to commit.
```

### Step 4.5 — Cross-Phase Integration Check

When validating a completed phase in a multi-phase plan, check for integration gaps between phases:

1. **Orphaned exports** — files/functions created in this phase that claim to be used by future phases (see `## Cross-Phase Context → Exports`) but are not yet importable:
   ```
   Grep for the export name in the current codebase:
   - If export exists AND is importable → CONFIRMED
   - If export exists but has wrong signature vs phase file contract → CONTRADICTED
   - Expected export missing entirely → UNCONFIRMED ("Phase N claims to export X but X not found")
   ```

2. **Uncalled routes** — API endpoints added in this phase but not wired to any frontend/consumer yet:
   - This is OK if a future phase handles wiring (check master plan)
   - Flag as WARN if no future phase mentions consuming this route

3. **Auth gaps** — new endpoints or pages without authentication/authorization:
   - `Grep` for route handlers without auth middleware
   - Flag as WARN (may be intentional for public endpoints, but worth checking)

4. **E2E flow trace** — for the primary user flow this phase enables:
   - Trace: entry point → business logic → data layer → response
   - If any step in the chain is missing or stubbed → CONTRADICTED

**This step is OPTIONAL for single-phase tasks and MANDATORY for multi-phase master plans.**

### Step 5 — Evidence Quality Gate

Before emitting verdict, verify evidence quality:

1. **IDENTIFY** — list every claim the agent made (Step 1 output)
2. **RUN** — confirm verification commands were actually executed (not just planned)
3. **READ** — read every line of command output (not just exit code)
4. **VERIFY** — match each claim to a specific evidence quote (file:line or output snippet)
5. **CLAIM** — only mark CONFIRMED if evidence quote directly supports the claim

| Evidence Quality | Verdict |
|-----------------|---------|
| Exit code 0 only, no output read | INSUFFICIENT — re-run and read output |
| Output read but no quote matched to claim | UNCONFIRMED — cite specific evidence |
| Quote matches claim exactly | CONFIRMED |
| Quote contradicts claim | CONTRADICTED |

### Step 5.5 — Plan Diff Check

When validating a phase within a master plan, diff actual changes against the phase plan file:

1. **Read the active phase plan** — `Glob` for `.rune/plan-*-phase*.md` matching the current phase
2. **Extract `## Files Touched`** — build a list of expected files (new/modify/delete)
3. **Extract `## Tasks`** — build a list of all `- [ ]` and `- [x]` items
4. **Compare against actual changes** — `git diff --name-only` (or file system scan)
5. **Report**:

| Check | Status |
|-------|--------|
| Unchecked task in phase plan (`- [ ]` still exists) | **INCOMPLETE** — task was not done |
| File in plan's "Files Touched" but not in actual diff | **MISSING** — planned file was never touched |
| File in actual diff but NOT in plan's "Files Touched" | **UNPLANNED** — scope creep (warn, not block) |
| All tasks `[x]` AND all planned files touched | **PLAN-ALIGNED** |

```
Plan Diff: PLAN-ALIGNED | INCOMPLETE (2 unchecked tasks) | MISSING (1 file never touched)
```

**Skip if**: No active phase plan found (single-task, no master plan). **MANDATORY** for multi-phase master plans.

## Verdict Rules

```
ALL claims CONFIRMED         → overall CONFIRMED (proceed)
ANY claim CONTRADICTED       → overall CONTRADICTED (BLOCK — fix the contradiction)
ANY claim UNCONFIRMED        → overall UNCONFIRMED (BLOCK — provide evidence)
  (no CONTRADICTED)
```

## Output Format

Completion Gate Report with status (CONFIRMED/UNCONFIRMED/CONTRADICTED), claim validation table, gaps, and verdict. See Step 4 Report above for full template.

## Constraints

1. MUST check every completion claim against actual tool output — not agent narrative
2. MUST flag missing evidence as UNCONFIRMED — absence of proof is not proof of absence
3. MUST flag contradictions as CONTRADICTED — this is more serious than missing evidence
4. MUST NOT accept "I verified it" as evidence — show the command output
5. MUST be fast (haiku) — this runs on every cook completion

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Agent rephrases claim to avoid detection | MEDIUM | Pattern matching covers common phrasings — extend as new patterns emerge |
| Evidence from a DIFFERENT test run (stale) | HIGH | Check that evidence timestamp/context matches current changes |
| Agent pre-generates evidence by running commands proactively | LOW | This is actually GOOD behavior — we want agents to provide evidence |
| Completion-gate itself claims "all confirmed" without evidence | CRITICAL | Gate report MUST include the evidence table — no table = report is invalid |
| Existence Theater — agent creates files but they're stubs | HIGH | Step 1b stub detection: grep for Placeholder/TODO/NotImplementedError in new files |
| Cross-phase integration gaps — exports exist but wrong signature | HIGH | Step 4.5: verify exports match Code Contracts from phase file |
| Phase complete but E2E flow broken — missing link in the chain | MEDIUM | Step 4.5 E2E flow trace: entry → logic → data → response must all be connected |
| Rubber-stamping — all CONFIRMED without scrutiny | HIGH | Default-FAIL mindset: actively seek 3-5 issues. Zero issues = red flag, apply skeptic sweep on weakest 2 claims |
| Partial completion claimed as full — 80% done but "implemented" | HIGH | Adversarial checklist: check for partial completion, scope mismatch, evidence-claim alignment |
| Self-Validation skipped — skill has checks but gate ignores them | HIGH | Step 1c: extract Self-Validation from skill's SKILL.md, treat each as implicit claim. Missing = UNCONFIRMED |
| Plan says done but phase file has unchecked tasks | HIGH | Step 5.5: diff changed files vs phase plan's Files Touched + Tasks sections |
| Agent stuck in observation loop but claims "implemented" | HIGH | Step 1d: Execution Loop Audit detects low effect ratio and observation chains — flags in report even if claims pass |

## Done When

- All completion claims extracted from agent output
- Each claim matched against tool output evidence
- Verdict table emitted with claim/evidence/verdict for each item
- All 3 verification axes (Completeness/Correctness/Coherence) have at least one claim checked
- Plan diff check passed (if multi-phase): all tasks checked, all planned files touched
- Overall verdict: CONFIRMED / UNCONFIRMED / CONTRADICTED
- If not CONFIRMED: specific gaps listed with remediation steps

## Cost Profile

~500-1000 tokens input, ~200-500 tokens output. Haiku for speed. Runs frequently as part of cook's quality phase.
