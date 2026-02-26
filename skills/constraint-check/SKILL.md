---
name: constraint-check
description: "Meta-validator for HARD-GATEs. Verifies that skills' mandatory constraints were followed during a workflow. Use when completing a cook/team session to audit discipline compliance."
metadata:
  author: runedev
  version: "1.0.0"
  layer: L3
  model: haiku
  group: validation
---

# constraint-check

## Purpose

The internal affairs department for Rune skills. Checks whether HARD-GATEs and mandatory constraints were actually followed during a workflow — not just claimed to be followed. Reads the constraint definitions from skill files and audits the conversation trail for compliance.

While `completion-gate` checks if claims have evidence, `constraint-check` checks if the PROCESS was followed. Did you actually write tests before code? Did you actually get plan approval? Did you actually run sentinel?

## Triggers

- Called by `cook` (L1) at end of workflow as discipline audit
- Called by `team` (L1) to verify stream agents followed constraints
- Called by `audit` (L2) during quality dimension assessment
- `/rune constraint-check` — manual audit of current session

## Calls (outbound)

None — pure read-only validator.

## Called By (inbound)

- `cook` (L1): end-of-workflow discipline audit
- `team` (L1): verify stream agent compliance
- `audit` (L2): quality dimension
- User: manual session audit

## Execution

### Step 1 — Identify Active Skills

Parse the conversation/workflow to identify which skills were invoked:

```
Extract from context:
  - Skills invoked via Skill tool (exact list)
  - Skills referenced in agent narrative
  - Phase progression (cook phases completed)
```

### Step 2 — Load Constraint Definitions

For each invoked skill, extract HARD-GATEs and numbered constraints:

```
For each skill in invoked_skills:
  Read: skills/<skill>/SKILL.md
  Extract:
    - <HARD-GATE> blocks → mandatory, violation = BLOCK
    - ## Constraints numbered list → required, violation = WARN
    - ## Mesh Gates table → required gates
```

### Step 3 — Audit Compliance

Check each constraint against the conversation evidence:

| Constraint Type | How to Verify | Evidence Source |
|---|---|---|
| "MUST write tests BEFORE code" | Test file Write/Edit timestamps before implementation Write/Edit | Tool call ordering |
| "MUST get user approval" | User message containing "go"/"yes"/"proceed" after plan | Conversation history |
| "MUST run verification" | Bash command with test/lint/build output | Tool call results |
| "MUST show actual output" | Stdout captured in agent response | Agent messages |
| "MUST NOT modify files outside scope" | Git diff files vs plan file list | Git + plan comparison |
| "Iron Law: delete code before test" | No implementation code exists before test creation | Tool call ordering |

### Step 4 — Classify Violations

```
HARD-GATE violation   → BLOCK (skill says this is non-negotiable)
Constraint violation  → WARN (skill says this is required but not fatal)
Best practice skip    → INFO (recommended but optional)
```

### Step 5 — Report

```
## Constraint Check Report
- **Status**: COMPLIANT | VIOLATIONS_FOUND | CRITICAL_VIOLATION
- **Skills Audited**: [count]
- **Constraints Checked**: [count]
- **Violations**: [count by severity]

### HARD-GATE Violations (BLOCK)
- [skill:test] Iron Law: implementation code written at tool_call #12 BEFORE test file created at #15
- [skill:cook] Plan Gate: Phase 4 started without user approval message

### Constraint Violations (WARN)
- [skill:verification] Constraint 2: "All tests pass" claimed at message #20 without stdout evidence
- [skill:sentinel] Constraint 3: files scanned list not included in report

### Compliance Summary
| Skill | HARD-GATEs | Constraints | Status |
|-------|-----------|-------------|--------|
| cook | 3/3 ✓ | 6/7 (1 WARN) | WARN |
| test | 0/1 ✗ | 8/9 (1 WARN) | BLOCK |
| verification | 1/1 ✓ | 4/6 (2 WARN) | WARN |
| sentinel | 1/1 ✓ | 7/7 ✓ | PASS |

### Remediation
- BLOCK: test Iron Law — delete implementation, restart with test-first
- WARN: verification — re-run and capture stdout
```

## Constraint Catalog (Quick Reference)

Key HARD-GATEs across skills that constraint-check audits:

| Skill | HARD-GATE | Check Method |
|---|---|---|
| test | Tests BEFORE code (Iron Law) | Tool call ordering |
| cook | Scout before plan, plan before code | Phase progression |
| plan | Every code phase has test entry | Plan content |
| verification | Evidence for every claim | Stdout capture |
| sentinel | BLOCK = halt pipeline | No commit after BLOCK |
| preflight | BLOCK = halt pipeline | No commit after BLOCK |
| debug | No code changes during debug | No Write/Edit in debug |
| debug | 3-fix escalation | Fix attempt counter |
| brainstorm | No implementation before approval | User message check |

## Constraints

1. MUST check all HARD-GATEs for every invoked skill — not just the ones that seem relevant
2. MUST use tool call ordering (not agent narrative) to verify temporal constraints
3. MUST distinguish HARD-GATE violations (BLOCK) from constraint violations (WARN)
4. MUST report specific evidence for each violation — not just "violated"
5. MUST NOT accept agent's self-report as compliance evidence — check independently

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Agent self-reports compliance and constraint-check trusts it | CRITICAL | Constraint 5: check tool calls independently, not agent narrative |
| Only checking cook constraints, missing test/sentinel/etc | HIGH | Constraint 1: audit ALL invoked skills, not just the orchestrator |
| Temporal check wrong (tool calls reordered in context) | MEDIUM | Use tool call sequence numbers, not message ordering |
| Too strict on optional steps (INFO treated as BLOCK) | LOW | Step 4 classification: only HARD-GATE = BLOCK, constraints = WARN |

## Done When

- All invoked skills identified from context
- HARD-GATEs and constraints extracted from each skill's SKILL.md
- Each constraint checked against conversation evidence
- Violations classified as BLOCK/WARN/INFO
- Compliance summary table emitted per skill
- Remediation steps listed for each violation

## Cost Profile

~1000-2000 tokens input, ~500-1000 tokens output. Haiku for speed — reads skill files and checks tool call ordering.
