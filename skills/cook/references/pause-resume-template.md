# Pause/Resume Template — Formal Mid-Phase Handoff

This file defines the `.continue-here.md` format used when cook must pause mid-phase
(context limit, user break, session end before phase completes).

## When to Use

When cook cannot complete the current phase in one session:
- Context limit approaching (context-watch ORANGE)
- User explicitly requests a break ("pause", "đợi", "wait")
- Session end is forced before phase completes

## `.rune/.continue-here.md` Format

```markdown
## Continue Here
- **Phase**: [current phase number and name]
- **Task**: [current task within phase — e.g., "Task 3 of 5"]
- **Completed**: [list of tasks done this session]
- **Remaining**: [list of tasks not yet started]
- **Decisions**: [any decisions made this session]
- **Blockers**: [if any — what's stuck and why]
- **WIP Files**: [files modified but not yet committed]
```

## Pause Protocol

1. Create `.rune/.continue-here.md` with the format above
2. Create a WIP commit: `wip: cook phase N paused at task M`
3. Stop execution

## Resume Protocol

Phase 0 (RESUME CHECK) detects `.continue-here.md` → resumes from exact task position.

This is more granular than Phase 0's plan-level resume — it resumes **within** a phase, not just between phases.

After successful resume and phase completion → delete `.continue-here.md`.
