---
name: context-engine
description: Context window management. Detects when context is filling up, triggers smart compaction, and preserves critical information across compaction boundaries.
metadata:
  author: runedev
  version: "0.1.0"
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

- `cook` (L1): auto-triggered at phase boundaries to check context health
- `team` (L1): monitors context across parallel workstreams
- `session-bridge` (L3): coordinates to save state before compaction

## Workflow

1. **Monitor context** — track tool call count, estimate context utilization
2. **Detect threshold** — warn when approaching 70% context, alert at 85%
3. **Prepare compaction** — identify critical information to preserve:
   - Current task and phase
   - Architecture decisions made
   - Files touched and changes applied
   - Test results and blockers
   - Remaining tasks
4. **Trigger save** — coordinate with session-bridge to persist state to .rune/
5. **Recommend action** — suggest compaction timing to L1 orchestrator

## Context Health Levels

```
GREEN   (0-60%)   — Healthy, continue normally
YELLOW  (60-80%)  — Approaching limit, save state at next phase boundary
ORANGE  (80-90%)  — Near limit, save state NOW, consider compaction
RED     (90%+)    — Critical, force save and compact immediately
```

## Output Format

```
## Context Health
- **Utilization**: [percentage]
- **Status**: GREEN | YELLOW | ORANGE | RED
- **Tool Calls**: [count]
- **Recommendation**: continue | save-at-boundary | save-now | compact-immediately

### Critical Context (preserved on compaction)
- Task: [current task]
- Phase: [current phase]
- Decisions: [count saved to .rune/]
- Files touched: [list]
- Blockers: [if any]
```

## Cost Profile

~200-500 tokens input, ~100-200 tokens output. Haiku for minimal overhead. Runs frequently as a background monitor.
