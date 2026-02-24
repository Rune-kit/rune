---
name: context-engine
description: Context window management. Detects when context is filling up, triggers smart compaction, and preserves critical information across compaction boundaries.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L3
  model: haiku
  group: state
---

# context-engine

## Purpose

Context window management for long sessions. Detects when context is approaching limits, triggers smart compaction preserving critical decisions and progress, and coordinates with session-bridge to save state before compaction. Prevents the common failure mode of losing important context mid-workflow.

## Triggers

- Called by `cook` and `team` automatically at context boundaries
- Auto-trigger: when tool call count exceeds threshold or context utilization is high
- Auto-trigger: before compaction events

## Calls (outbound)

# Exception: L3→L3 coordination
- `session-bridge` (L3): coordinate state save when context critical

## Called By (inbound)

- Auto-triggered at phase boundaries and context thresholds by L1 orchestrators

## Execution

### Step 1 — Assess context

Estimate current context usage based on conversation length:

- Count total tool calls made so far in this session
- Estimate tokens consumed: each tool call ≈ 500-2000 tokens (read = low, bash = medium, write = high)
- Add approximate tokens from user/assistant message history

Produce a utilization estimate as a percentage of the model's context window (200K tokens for Claude Sonnet/Opus, 32K for Haiku).

### Step 2 — Classify health

Map utilization to health level:

```
GREEN   (<50%)    — Healthy, continue normally
YELLOW  (50-70%)  — Load only essential files going forward
ORANGE  (70-85%)  — Recommend /compact at next logical boundary
RED     (>85%)    — Trigger immediate compaction, save state first
```

### Step 3 — If YELLOW

Emit advisory to the calling orchestrator:

> "Context at [X]%. Load only essential files. Avoid reading full files when Grep will do."

Do NOT trigger compaction yet. Continue execution.

### Step 4 — If ORANGE

Emit recommendation to the calling orchestrator:

> "Context at [X]%. Recommend /compact at next phase boundary (after current module completes)."

Identify the next safe boundary (end of current loop iteration, end of current file being processed) and flag it.

### Step 5 — If RED

Immediately trigger state save via `rune:session-bridge` (Save Mode) before any compaction occurs.

Pass to session-bridge:
- Current task and phase description
- List of files touched this session
- Decisions made (architectural choices, conventions established)
- Remaining tasks not yet started

After session-bridge confirms save, emit:

> "Context CRITICAL ([X]%). State saved to .rune/. Run /compact now."

Block further tool calls until compaction is acknowledged.

### Step 6 — Report

Emit the context health report to the calling skill.

## Context Health Levels

```
GREEN   (0-50%)   — Healthy, continue normally
YELLOW  (50-70%)  — Load only essential files
ORANGE  (70-85%)  — Recommend /compact at next logical boundary
RED     (85%+)    — Save state NOW via session-bridge, compact immediately
```

## Output Format

```
## Context Health
- **Utilization**: [percentage]
- **Status**: GREEN | YELLOW | ORANGE | RED
- **Tool Calls**: [count]
- **Recommendation**: continue | load-essential-only | compact-at-boundary | compact-immediately

### Critical Context (preserved on compaction)
- Task: [current task]
- Phase: [current phase]
- Decisions: [count saved to .rune/]
- Files touched: [list]
- Blockers: [if any]
```

## Constraints

1. MUST preserve context fidelity — no summarizing away critical details
2. MUST flag context conflicts between skills — never silently pick one
3. MUST NOT inject stale context from previous sessions without marking it as historical

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Triggering compaction without saving state first | CRITICAL | Step 5 (RED): session-bridge MUST run before any compaction — state loss is irreversible |
| Blocking tool calls when context is ORANGE (not RED) | MEDIUM | ORANGE = recommend only; blocking is only for RED (>85%) |
| Injecting stale context from previous session without marking it historical | HIGH | Constraint 3: all loaded context must include session date marker |
| Premature compaction from over-estimated utilization | MEDIUM | Token estimates are rough — err conservative; only block at confirmed RED |

## Done When

- Context utilization estimated (tool call count + approximate token math)
- Health level classified (GREEN / YELLOW / ORANGE / RED)
- Appropriate advisory emitted matching health level (no advisory for GREEN)
- If RED: session-bridge called and confirmed saved before compaction signal
- Context Health Report emitted with utilization %, status, and recommendation

## Cost Profile

~200-500 tokens input, ~100-200 tokens output. Haiku for minimal overhead. Runs frequently as a background monitor.
