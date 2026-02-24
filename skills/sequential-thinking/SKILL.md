---
name: sequential-thinking
description: Step-by-step complex reasoning for multi-variable problems. Breaks down interconnected decisions into ordered logical steps.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L3
  model: sonnet
  group: reasoning
---

# sequential-thinking

## Purpose

Multi-variable analysis utility for decisions where factors are interdependent and order of reasoning matters. Receives a decision problem, maps variable dependencies, processes them in dependency order, and returns a structured decision tree with final recommendation. Stateless — no memory between calls.

## Calls (outbound)

None — pure L3 reasoning utility.

## Called By (inbound)

- `debug` (L2): multi-factor bugs with interacting causes
- `plan` (L2): complex architecture with many trade-offs
- `brainstorm` (L2): evaluating approaches with many variables

## When to Use

Invoke this skill when:
- The decision has more than 3 interacting variables
- Choosing option A changes what options are valid for B and C
- Architecture decisions have cascading downstream effects
- Trade-off analysis where constraints eliminate entire solution branches

Do NOT use for simple linear analysis — `problem-solver` is more efficient for single-dimension reasoning.

## Execution

### Input

```
decision: string        — the decision or problem to analyze
variables: string[]     — (optional) pre-identified factors; if omitted, skill identifies them
constraints: string[]   — (optional) hard limits that eliminate options
goal: string            — (optional) success criteria or desired outcome
```

### Step 1 — Identify All Variables

List every factor that affects the decision. For each variable, record:
- Name and description
- Possible values or range
- Whether it is controllable (we can choose) or fixed (constraint from environment)

If the caller provided `variables`, validate and expand the list. If omitted, derive from the decision statement.

### Step 2 — Map Dependencies

For each pair of variables, determine if a dependency exists:
- `[A] constrains [B]`: choosing a value for A limits valid values for B
- `[A] influences [B]`: A affects the cost/benefit calculation for B but does not eliminate options
- `[A] independent of [B]`: no relationship

Document dependencies as: `[Variable A] → [Variable B]: [type and reason]`

Identify which variables have the most outbound dependencies — those must be resolved first.

### Step 3 — Evaluate in Dependency Order

Sort variables from most-constrained (fixed / most depended upon) to least-constrained (free / most flexible). Process in that order:

For each variable in sequence:
- State current known state of all previously resolved variables
- Evaluate valid options given those constraints
- Select the best option with explicit reasoning
- Record the conclusion and how it affects downstream variables

Do not jump ahead — each step must reference the conclusions of prior steps.

### Step 4 — Track State

At each step, maintain a running state block:

```
State after Step N:
- [Variable A]: resolved to [value] because [reason]
- [Variable B]: resolved to [value] because [reason]
- Remaining: [Variable C], [Variable D]
```

This makes the reasoning chain auditable and allows callers to verify the logic.

### Step 5 — Synthesize

After all variables are resolved:
- Combine all per-step conclusions into a coherent final recommendation
- Identify any variables that remained ambiguous — state what additional information would resolve them
- Assess overall confidence: `high` (all variables resolved cleanly), `medium` (1-2 ambiguous), `low` (major uncertainty remains)

### Step 6 — Report

Return the full decision tree and recommendation in the output format below.

## Constraints

- Never evaluate variable B before all variables that constrain B are resolved
- If a dependency cycle is detected, flag it explicitly and break the cycle by treating one variable as a fixed assumption
- Use Sonnet — reasoning depth and coherence across many steps matters
- If more than 8 variables are identified, group related ones into composite variables to keep analysis tractable

## Output Format

```
## Sequential Analysis: [Decision]

### Variables Identified
| Variable | Possible Values | Type |
|----------|----------------|------|
| [A]      | [options]      | controllable / fixed |
| [B]      | [options]      | controllable / fixed |

### Dependency Map
- [A] → [B]: [type] — [reason]
- [C] → [A]: [type] — [reason]

### Step-by-Step Evaluation
1. **[Variable A]** (no dependencies — evaluate first)
   - Options: [x, y, z]
   - Reasoning: [why one is better given constraints]
   - Conclusion: **[chosen value]**
   - State: { A: [value] }

2. **[Variable B]** (depends on A = [value])
   - Options remaining: [filtered list]
   - Reasoning: [updated analysis given A's value]
   - Conclusion: **[chosen value]**
   - State: { A: [value], B: [value] }

...

### Ambiguities
- [variable or factor that could not be fully resolved, and what information would resolve it]

### Final Recommendation
[synthesized conclusion incorporating all resolved variables, with confidence level]

- **Confidence**: high | medium | low
- **Key assumption**: [the most critical assumption this recommendation depends on]
```

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Evaluating variable B before all variables constraining B are resolved | CRITICAL | Constraint: dependency order is mandatory — sort by constraint depth first |
| Dependency cycle detected but not flagged | HIGH | Break cycle by treating one variable as a fixed assumption — flag it explicitly |
| More than 8 variables without grouping them into composites | MEDIUM | Constraint: group related variables — keep analysis tractable, not exhaustive |
| Final recommendation missing confidence level | MEDIUM | Confidence (high/medium/low) is required — ambiguities drive confidence down |

## Done When

- All variables identified and typed (controllable vs. fixed)
- Dependency map documented (A constrains B, C influences D)
- Variables evaluated in dependency order with running state block at each step
- Ambiguities listed with what information would resolve them
- Final recommendation emitted with confidence level
- Sequential Analysis report in output format

## Cost Profile

~500-1500 tokens input, ~500-1000 tokens output. Sonnet for reasoning depth.
