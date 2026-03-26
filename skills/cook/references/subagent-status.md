# Subagent Status Protocol

When cook completes (whether standalone or invoked by `team`), it MUST return one of four statuses.
Sub-skills invoked by cook (fix, test, review, sentinel, etc.) MUST also return one of these statuses
so cook can route accordingly.

## Status Table

| Status | Meaning | Cook Action |
|--------|---------|-------------|
| `DONE` | Task complete, no issues | Proceed to next phase |
| `DONE_WITH_CONCERNS` | Task complete but issues noted (e.g., "tests pass but a performance regression observed") | Proceed, but append concern to `.rune/progress.md` and surface in Cook Report; address in Phase 5 (QUALITY) or next review cycle |
| `NEEDS_CONTEXT` | Cannot proceed without more information (missing requirement, ambiguous spec, unknown environment) | Pause execution. Ask user the specific question(s) blocking progress. Resume from the same phase after answer received. |
| `BLOCKED` | Hard blocker — cannot continue regardless of context (broken dependency, fundamental incompatibility, exhausted escalation chain) | Trigger escalation chain: debug-fix (3x) → re-plan (1x) → brainstorm rescue (1x) → then escalate to user with full details |

## Message Formats

### DONE_WITH_CONCERNS

Append to `.rune/progress.md`:
```
[CONCERN][phase][timestamp] <sub-skill>: <concern description>
```

### NEEDS_CONTEXT

State exactly:
1. What is unknown
2. Why it blocks progress
3. The two most likely answers (to help the user respond quickly)

### BLOCKED

Include:
1. The phase
2. The sub-skill that emitted BLOCKED
3. The specific blocker
4. What was already attempted
