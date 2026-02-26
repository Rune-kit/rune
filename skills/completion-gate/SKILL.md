---
name: completion-gate
description: "Validates agent claims against evidence trail. Catches 'done' without proof, 'tests pass' without output, 'fixed' without verification."
metadata:
  author: runedev
  version: "1.0.0"
  layer: L3
  model: haiku
  group: validation
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
- `verification` (L3): cross-check with verification report

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

### Step 3 — Validate Each Claim

For each claim + evidence pair:

```
IF evidence exists AND evidence supports claim:
  → CONFIRMED
IF evidence exists BUT contradicts claim:
  → CONTRADICTED (most serious — agent is wrong)
IF no evidence found:
  → UNCONFIRMED (agent may be right but didn't prove it)
```

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

## Verdict Rules

```
ALL claims CONFIRMED         → overall CONFIRMED (proceed)
ANY claim CONTRADICTED       → overall CONTRADICTED (BLOCK — fix the contradiction)
ANY claim UNCONFIRMED        → overall UNCONFIRMED (BLOCK — provide evidence)
  (no CONTRADICTED)
```

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

## Done When

- All completion claims extracted from agent output
- Each claim matched against tool output evidence
- Verdict table emitted with claim/evidence/verdict for each item
- Overall verdict: CONFIRMED / UNCONFIRMED / CONTRADICTED
- If not CONFIRMED: specific gaps listed with remediation steps

## Cost Profile

~500-1000 tokens input, ~200-500 tokens output. Haiku for speed. Runs frequently as part of cook's quality phase.
