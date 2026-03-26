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

## Data Flow

Data relationships capture how skill outputs become inputs for other skills — without direct invocation. Unlike Calls/Called By (control flow), data flow tracks artifacts that persist and get consumed asynchronously.

### Feeds Into →

- `skill-name` (L2): [what artifact] → [how it's consumed]

### Fed By ←

- `skill-name` (L2): [what artifact] ← [what this skill needs from it]

### Feedback Loops ↻

- `skill-a` ↔ `skill-b`: [what gets refined bidirectionally and why]

## Workflow

Step-by-step execution flow.

## Output Format

```
Structured output that calling skills can consume.
```

## Returns

Explicit output contract so calling skills know exactly what to expect.

| Field | Type | Description |
|-------|------|-------------|
| `field_name` | type | What this field contains and when it's populated |
| `status` | enum | e.g., `DONE` / `DONE_WITH_CONCERNS` / `BLOCKED` |

Why: Without explicit return schemas, calling skills guess at output structure. This causes silent failures when output format changes. Every L1/L2 skill MUST have a Returns section.

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

## Self-Validation

Domain-specific quality checks that run BEFORE this skill reports "done". These are embedded in the skill itself — not centralized like completion-gate. Each check is specific to what THIS skill produces.

```
SELF-VALIDATION (run before emitting output):
- [ ] [check 1 — what to verify about this skill's output]
- [ ] [check 2 — domain-specific quality criterion]
- [ ] [check 3 — format/completeness check]
IF ANY check fails → fix before reporting done. Do NOT defer to completion-gate.
```

Why: Completion-gate validates claims generically. Self-Validation catches domain-specific quality issues that only THIS skill understands (e.g., test skill checks assertion count, plan skill checks dependency ordering, review skill checks all files were read).

## Done When

- [condition 1 — specific, verifiable]
- [condition 2]
- [condition 3 — structured report emitted]
- Self-Validation checklist: all checks passed

## Cost Profile

Estimated token usage per invocation.

**Scope guardrail**: [Terminal boundary statement — what this skill must NOT do even if asked. Examples: "Do not write code — only produce plans.", "Do not modify files outside the target module.", "Do not execute fixes — only diagnose and hand off to fix."]

Why: Without terminal guardrails, agents drift into adjacent responsibilities. A review skill starts fixing code, a plan skill starts implementing, a debug skill starts deploying. The guardrail is the last line in the skill file — a final reminder of scope boundaries before the agent acts.
