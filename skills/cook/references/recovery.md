# cook — Deviation and error recovery

> Reference for `skills/cook/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Deviation Rules

<MUST-READ path="references/deviation-rules.md" trigger="when implementation diverges from the approved plan"/>

R1-R3 (bug/security/blocking fix): auto-fix, continue. R4 (architectural change): ASK user first.

## Error Recovery

<MUST-READ path="references/error-recovery.md" trigger="when any phase fails or a task hits repeated errors"/>

Includes phase-by-phase failure handling and repair operators (RETRY → DECOMPOSE → PRUNE) with a 2-attempt budget before escalation.
