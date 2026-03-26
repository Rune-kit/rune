# Exit Conditions — Autonomous Loop Caps

Every cook invocation inside `team` or autonomous workflows MUST respect these exit conditions.
These caps prevent runaway loops and force escalation before context exhaustion.

## Hard Caps

```
MAX_DEBUG_LOOPS:   3 per error area (already enforced in Phase 4)
MAX_QUALITY_LOOPS: 2 re-runs of Phase 5 (fix→recheck cycle)
MAX_REPLAN:        1 re-plan per cook session (Phase 4 re-plan check)
MAX_PIVOT:         1 approach pivot per cook session (Approach Pivot Gate)
MAX_FIXES:         30 per session (hard cap — fix's WTF-likelihood self-regulation)
WTF_THRESHOLD:     20% quality decay risk → STOP fixing, commit progress, re-assess
TIMEOUT_SIGNAL:    If context-watch reports ORANGE, wrap up current phase and checkpoint
```

## Escalation Chain

```
debug-fix (3x) → re-plan (1x) → approach pivot via brainstorm rescue (1x) → THEN escalate to user
```

Never surrender before exhausting the pivot. Never spin indefinitely.

## Triggered State

If any exit condition triggers without resolution:
- Cook emits `BLOCKED` status with full details (phase, blocker, what was tried)
- Execution stops
- User must make a decision before cook can resume
