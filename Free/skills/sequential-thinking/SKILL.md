---
name: sequential-thinking
description: "Step-by-step complex reasoning for multi-variable problems. Breaks interconnected decisions into ordered logical steps with bias detection, reversibility classification, and second-order effect tracking."
metadata:
  author: runedev
  version: "0.3.0"
  layer: L3
  model: sonnet
  group: reasoning
  tools: "Read, Glob, Grep"
---

# sequential-thinking

## Purpose

Multi-variable analysis utility for decisions where factors are interdependent and order of reasoning matters. Receives a decision problem, classifies reversibility, detects cognitive biases, maps variable dependencies, processes them in dependency order, checks for second-order effects, and returns a structured decision tree with final recommendation. Stateless — no memory between calls.

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

### Step 0 — Reversibility Classification

Before investing analytical effort, classify the decision:

| Type | Definition | Analytical Effort |
|------|-----------|-------------------|
| **Two-way door** | Reversible, can iterate, low switching cost | Decide quickly, set review date. Light analysis. |
| **One-way door** | Irreversible, high stakes, costly to reverse | Full sequential analysis. Deep reasoning. |
| **Partially reversible** | Some aspects reversible, some not | Full analysis on irreversible aspects, light on reversible. |

If two-way door → streamline: skip Step 4 (second-order) and Step 5 (bias cross-check). State reasoning.

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

**Running state block** at each step:

```
State after Step N:
- [Variable A]: resolved to [value] because [reason]
- [Variable B]: resolved to [value] because [reason]
- Remaining: [Variable C], [Variable D]
```

### Step 4 — Second-Order Effects Check

After all variables are resolved, apply second-order thinking:

For each resolved variable, ask: **"And then what?"**

| Variable | First-Order Effect | Second-Order Effect | Risk Level |
|----------|-------------------|--------------------|-|
| [A = value] | [immediate consequence] | [consequence of consequence] | low/medium/high |

Flag any second-order effect that:
- Contradicts the goal stated in the input
- Creates a feedback loop (reinforcing or balancing)
- Affects stakeholders not considered in the analysis
- Would flip a previous variable's optimal value

If a dangerous second-order effect is found → revisit the affected variable with this new information.

### Step 5 — Bias Cross-Check

Check the analysis for the 3 biases most dangerous to multi-variable decisions:

| Bias | Detection Question | If Detected |
|------|-------------------|-------------|
| **Anchoring** | Did the first variable we resolved disproportionately constrain all others? Would the result differ if we started from a different variable? | Re-evaluate with a different starting variable. Compare results. |
| **Status Quo** | Did we give an unfair advantage to "keep current approach" for any variable? Would we choose this if starting from scratch? | Evaluate current state with same rigor as alternatives. |
| **Overconfidence** | How confident are we in each variable's resolution? Are confidence intervals wide enough? | Assign explicit confidence % to each resolution. Flag any > 90% without strong evidence. |

If bias is detected → note it in the report and state whether it changes the recommendation.

### Step 6 — Synthesize

After all variables are resolved and cross-checked:
- Combine all per-step conclusions into a coherent final recommendation
- Identify any variables that remained ambiguous — state what additional information would resolve them
- Assess overall confidence: `high` (all variables resolved cleanly), `medium` (1-2 ambiguous), `low` (major uncertainty remains)
- Note the reversibility classification from Step 0 — if two-way door, include a review date

### Step 7 — Report

Return the full decision tree and recommendation in the output format below.

## Constraints

- Never evaluate variable B before all variables that constrain B are resolved
- If a dependency cycle is detected, flag it explicitly and break the cycle by treating one variable as a fixed assumption
- Use Sonnet — reasoning depth and coherence across many steps matters
- If more than 8 variables are identified, group related ones into composite variables to keep analysis tractable
- MUST classify reversibility (Step 0) before investing analytical effort
- MUST check for second-order effects on one-way door decisions
- MUST run bias cross-check on one-way door decisions

## Output Format

```
## Sequential Analysis: [Decision]

### Reversibility: [two-way door / one-way door / partially reversible]
[One sentence reasoning. If two-way: "Light analysis — decide quickly, review in [timeframe]."]

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
   - Conclusion: **[chosen value]** (confidence: X%)
   - State: { A: [value] }

2. **[Variable B]** (depends on A = [value])
   - Options remaining: [filtered list]
   - Reasoning: [updated analysis given A's value]
   - Conclusion: **[chosen value]** (confidence: X%)
   - State: { A: [value], B: [value] }

...

### Second-Order Effects (one-way door only)
| Variable | First-Order | Second-Order | Risk |
|----------|------------|-------------|------|
| [A] | [effect] | [and then what?] | low/medium/high |

### Bias Check
- ⚠️ [Bias]: [detection result] → [action taken or "not detected"]

### Ambiguities
- [variable or factor that could not be fully resolved, and what information would resolve it]

### Final Recommendation
[synthesized conclusion incorporating all resolved variables, with confidence level]

- **Confidence**: high | medium | low
- **Key assumption**: [the most critical assumption this recommendation depends on]
- **Review date**: [when to revisit this decision, especially for two-way doors]
```

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Evaluating variable B before all variables constraining B are resolved | CRITICAL | Dependency order is mandatory — sort by constraint depth first |
| Dependency cycle detected but not flagged | HIGH | Break cycle by treating one variable as a fixed assumption — flag explicitly |
| More than 8 variables without grouping | MEDIUM | Group related variables — keep tractable, not exhaustive |
| Final recommendation missing confidence level | MEDIUM | Confidence (high/medium/low) is required — ambiguities drive confidence down |
| Full analysis on a two-way door decision | MEDIUM | Step 0 classifies reversibility — two-way doors get light analysis |
| Ignoring second-order effects on irreversible decisions | HIGH | Step 4 is mandatory for one-way doors — "and then what?" |
| Anchoring on first variable resolved | MEDIUM | Bias cross-check Step 5 — test if different starting variable changes result |
| No review date on reversible decisions | LOW | Two-way doors MUST include a review date — iterate, don't commit |

## Done When

- Reversibility classified (two-way / one-way / partial)
- All variables identified and typed (controllable vs. fixed)
- Dependency map documented (A constrains B, C influences D)
- Variables evaluated in dependency order with running state block and confidence % at each step
- Second-order effects checked (one-way door decisions)
- Bias cross-check completed (anchoring, status quo, overconfidence)
- Ambiguities listed with what information would resolve them
- Final recommendation emitted with confidence level and review date
- Sequential Analysis report in output format

## Cost Profile

~500-1500 tokens input, ~500-1200 tokens output. Sonnet for reasoning depth.
