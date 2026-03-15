---
name: skill-name
description: One-line description of what this skill does and when to use it.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L1|L2|L3
  model: haiku|sonnet|opus
  group: orchestrator|creation|development|quality|delivery|rescue|knowledge|reasoning|validation|state|monitoring|media|deps
---

# skill-name

## Purpose

One paragraph describing the skill's role in the Rune ecosystem.

## Triggers

- `/rune <command>` — manual invocation
- Auto-trigger conditions (file patterns, error types, etc.)

## Calls (outbound connections)

- `skill-name` (L2|L3): condition when this skill calls it

## Called By (inbound connections)

- `skill-name` (L1|L2): condition when called

## Workflow

Step-by-step execution flow.

## Output Format

```
Structured output that calling skills can consume.
```

## Constraints

3-7 MUST/MUST NOT rules specific to this skill.
Every constraint should block a specific failure mode or rationalization.

Format:
1. MUST [required behavior] — [why]
2. MUST NOT [forbidden behavior] — [consequence]

## Mesh Gates (L1/L2 only)

| Gate | Requires | If Missing |
|------|----------|------------|
| [Gate Name] | [What must exist before proceeding] | [Action to take] |

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| [what goes wrong] | CRITICAL/HIGH/MEDIUM/LOW | [how to avoid it] |

## Done When

- [condition 1 — specific, verifiable]
- [condition 2]
- [condition 3 — structured report emitted]

## Cost Profile

Estimated token usage per invocation.
