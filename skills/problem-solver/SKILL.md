---
name: problem-solver
description: Structured reasoning frameworks for complex problems. Uses 5 Whys, Fishbone, First Principles, and other analytical methods.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L3
  model: sonnet
  group: reasoning
---

# problem-solver

## Purpose

Structured reasoning for complex problems that resist straightforward solutions. Applies analytical frameworks like 5 Whys, Fishbone, and First Principles to break down problems systematically. Called when debug or brainstorm needs deeper reasoning.

## Triggers

- Called by L2 skills when standard analysis is insufficient

## Calls (outbound)

None — pure L3 reasoning utility.

## Called By (inbound)

- `debug` (L2): complex bugs that resist standard debugging
- `brainstorm` (L2): structured frameworks for creative exploration
- `plan` (L2): first principles analysis for architecture decisions

## Frameworks Available

```
5 WHYS          — Drill to root cause by asking "why?" iteratively
FISHBONE        — Categorize causes: People, Process, Technology, Environment
FIRST PRINCIPLES — Strip assumptions, rebuild from fundamentals
SCAMPER         — Substitute, Combine, Adapt, Modify, Put to use, Eliminate, Reverse
IMPACT MATRIX   — Effort vs Impact prioritization
```

## Output Format

```
## Analysis: [Problem]
- **Framework**: [chosen framework]
- **Confidence**: high | medium | low

### Reasoning Chain
1. [step with evidence]
2. [step with evidence]
...

### Root Cause / Conclusion
[finding]

### Recommended Action
[what to do next]
```

## Cost Profile

~500-1500 tokens input, ~500-1000 tokens output. Sonnet for reasoning quality.
