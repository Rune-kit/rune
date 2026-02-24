---
name: brainstorm
description: Creative ideation and solution exploration. Generates multiple approaches with trade-offs, uses structured frameworks (SCAMPER, First Principles), and hands off to plan for structuring.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L2
  model: opus
  group: creation
---

# brainstorm

## Purpose

Creative ideation and solution exploration. Brainstorm is the creative engine of the Creation group — it generates multiple approaches with trade-offs, explores alternatives using structured frameworks, and hands the selected approach to plan for structuring. Uses opus for deep creative reasoning.

## Triggers

- Called by `cook` when multiple valid approaches exist for a feature
- Called by `plan` when architecture decision needs creative exploration
- `/rune brainstorm <topic>` — manual brainstorming
- Auto-trigger: when task description is vague or open-ended

## Calls (outbound)

- `plan` (L2): when idea is selected and needs structuring into actionable steps
- `research` (L3): gather data for informed brainstorming (existing solutions, benchmarks)
- `trend-scout` (L3): market context and trends for product-oriented brainstorming
- `problem-solver` (L3): structured reasoning frameworks (SCAMPER, First Principles, 6 Hats)
- `sequential-thinking` (L3): evaluating approaches with many variables

## Called By (inbound)

- `cook` (L1): when multiple valid approaches exist for a feature
- `plan` (L2): when architecture decision needs creative exploration
- User: `/rune brainstorm <topic>` direct invocation

## Cross-Hub Connections

- `brainstorm` ↔ `plan` — bidirectional: brainstorm generates options → plan structures the chosen one, plan needs exploration → brainstorm ideates

## Workflow

1. **Understand context** — parse the problem/opportunity, identify constraints and goals
2. **Research** — call research for existing solutions, call trend-scout for market context
3. **Generate options** — produce 2-4 distinct approaches with different trade-offs
4. **Evaluate** — analyze each option against constraints (cost, complexity, timeline, scalability)
5. **Recommend** — present options with clear recommendation and rationale
6. **Iterate** — refine based on user feedback if needed
7. **Hand off** — pass selected approach to plan for structuring into implementation steps

## Reasoning Frameworks

```
SCAMPER     — Substitute, Combine, Adapt, Modify, Put to use, Eliminate, Reverse
FIRST PRINCIPLES — Break down to fundamentals, rebuild from ground up
6 THINKING HATS  — Facts, Emotions, Caution, Benefits, Creativity, Process
CRAZY 8s    — 8 ideas in 8 minutes (rapid ideation)
```

## Output Format

```
## Brainstorm: [Topic]

### Context
[Problem statement and constraints]

### Option A: [Name] (Recommended)
- **Approach**: [description]
- **Pros**: [advantages]
- **Cons**: [disadvantages]
- **Effort**: low | medium | high
- **Risk**: low | medium | high

### Option B: [Name]
- **Approach**: [description]
- **Pros**: [advantages]
- **Cons**: [disadvantages]
- **Effort**: low | medium | high
- **Risk**: low | medium | high

### Option C: [Name]
...

### Recommendation
[Why Option X is recommended, and under what conditions Option Y might be better]
```

## Cost Profile

~2000-5000 tokens input, ~1000-2500 tokens output. Opus for creative reasoning depth. Runs infrequently — only when creative exploration is needed.
