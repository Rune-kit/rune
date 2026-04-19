# Project Invariants

> Auto-seeded by `rune onboard`. Edit freely — your changes survive re-runs.
> Append-only: new auto-detections land under `## Auto-detected (new)` and never
> overwrite existing rules.

This file is the project's truth-source for rules that code changes must respect.
`logic-guardian` loads it as a pre-edit gate, and `session-bridge` surfaces the
most critical rules at session start so agents know the danger zones immediately.

## How to read an entry

```
### <short rule title>
- **WHAT**: one-sentence statement of the rule (what must hold)
- **WHERE**: glob patterns for files this rule applies to
- **WHY**: why this rule exists — past incident, cross-file coupling,
  compliance, external contract, etc.
```

If an entry becomes stale, move it to `## Archived` with a one-line note.
Never delete — the archive is evidence of past decisions.

---

## Danger Zones

Paths that disproportionately affect the rest of the codebase. Test coverage,
review, and change-review should be stricter here.

<!-- auto-generated entries appear below -->

---

## Critical Invariants

Rules that cross file boundaries — shared constants, contract values, protocol
fields. Breaking any one silently breaks downstream code.

<!-- auto-generated entries appear below -->

---

## State Machine Rules

Legal transitions for state machines in the project. Illegal transitions are
often the root cause of hard-to-reproduce bugs.

<!-- auto-generated entries appear below -->

---

## Cross-File Consistency

Fields, enums, or schemas mirrored in multiple places. Updates must propagate
together or the project enters an inconsistent state.

<!-- auto-generated entries appear below -->

---

## Auto-detected (new)

New detections from the most recent `rune onboard` run. Review these, promote
the real ones into the sections above, and drop the noise.

<!-- placeholder — each run appends or replaces this block -->

---

## Archived

Rules that were once invariants but are no longer — kept here as history. Do
not delete; their absence later makes reasoning harder.

<!-- empty on first run -->
