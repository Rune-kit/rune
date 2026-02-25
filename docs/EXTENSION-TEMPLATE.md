---
name: "@rune/pack-name"
description: One-line description of what this extension pack provides.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L4
  price: "$9|$12|$15"
  target: Target developer audience
---

# @rune/pack-name

## Purpose

One paragraph: what domain this pack serves, why these skills are grouped together, what developer problem it solves.

## Triggers

- Auto-trigger: when [domain-specific files/patterns] detected in project
- `/rune <command>` — manual invocation
- Called by `cook` (L1) when [domain context] detected

## Skills Included

### skill-1

Brief description of what this skill does.

#### Workflow

**Step 1 — [Action]**
Concrete, executable step. Include tool names (Grep, Read, Bash) and expected behavior.

**Step 2 — [Action]**
Next step with specific details.

#### Example

```language
// Concrete code example showing the skill's output or pattern
```

### skill-2

Brief description.

#### Workflow

**Step 1 — [Action]**
...

#### Example

```language
// Code example
```

### skill-3

Brief description.

#### Workflow

**Step 1 — [Action]**
...

#### Example

```language
// Code example
```

## Connections

```
Calls → [L3 utility]: [when/why]
Called By ← [L2 hub]: [when/why]
Called By ← [L1 orchestrator]: [when auto-detected]
```

## Tech Stack Support (if applicable)

| Framework | Library | Notes |
|-----------|---------|-------|
| [framework] | [library] | [notes] |

## Constraints

1. MUST [required behavior specific to this domain]
2. MUST NOT [forbidden behavior]
3. MUST [another rule]

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| [domain-specific failure] | HIGH/MEDIUM | [how to avoid] |

## Done When

- [Verifiable condition 1]
- [Verifiable condition 2]
- [Structured output emitted]

## Cost Profile

Estimated token usage for pack workflow. [model] default.
