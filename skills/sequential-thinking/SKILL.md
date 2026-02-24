---
name: sequential-thinking
description: Step-by-step complex reasoning for multi-variable problems. Breaks down interconnected decisions into ordered logical steps.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L3
  model: sonnet
  group: reasoning
---

# sequential-thinking

## Purpose

Step-by-step complex reasoning for multi-variable problems where decisions are interconnected. Breaks down complex situations into ordered logical steps, tracking dependencies between decisions.

## Triggers

- Called by L2 skills when problem has many interacting variables

## Calls (outbound)

None — pure L3 reasoning utility.

## Called By (inbound)

- `debug` (L2): multi-factor bugs with interacting causes
- `plan` (L2): complex architecture with many trade-offs
- `brainstorm` (L2): evaluating approaches with many variables

## Workflow

1. **Identify variables** — list all factors affecting the decision
2. **Map dependencies** — which decisions constrain which others
3. **Order steps** — sequence decisions from most constrained to least
4. **Reason through** — step-by-step analysis with intermediate conclusions
5. **Synthesize** — final recommendation incorporating all factors

## Output Format

```
## Sequential Analysis: [Problem]

### Variables
- [variable]: [possible values]

### Dependencies
- [A] depends on [B] because [reason]

### Step-by-Step
1. **[Decision 1]**: [reasoning] → [conclusion]
2. **[Decision 2]** (given Decision 1): [reasoning] → [conclusion]
...

### Final Recommendation
[synthesized conclusion]
```

## Cost Profile

~500-1500 tokens input, ~500-1000 tokens output. Sonnet for reasoning depth.
