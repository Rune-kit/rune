# Cook Report — Output Format

Full format for the Cook Report emitted at the end of every cook session.
Also defines the NEXUS Deliverables table format used when cook is invoked by `team`.

## Cook Report Format

```
## Cook Report: [Task Name]
- **Status**: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
- **Phases**: [list of completed phases]
- **Files Changed**: [count] ([list])
- **Tests**: [passed]/[total] ([coverage]%)
- **Quality**: preflight [PASS/WARN] | sentinel [PASS/WARN] | review [PASS/WARN]
- **Commit**: [hash] — [message]

### Deliverables (NEXUS response — when invoked by team)
| # | Deliverable | Status | Evidence |
|---|-------------|--------|----------|
| 1 | [from handoff] | DELIVERED | [file path or test output quote] |
| 2 | [from handoff] | DELIVERED | [file path or test output quote] |
| 3 | [from handoff] | PARTIAL | [what's missing and why] |

### Concerns (if DONE_WITH_CONCERNS)
- [concern]: [impact assessment] — [suggested remediation]

### Decisions Made
- [decision]: [rationale]

### Session State
- Saved to .rune/decisions.md
- Saved to .rune/progress.md
```

## Usage Rules

- When cook is invoked **standalone** (not by team): Deliverables table is optional
- When cook is invoked by **team** with a NEXUS Handoff: Deliverables table is **MANDATORY** — team uses it to track acceptance criteria across streams
- Cook Report MUST contain actual commit hash, not placeholder
- Self-Validation must pass before emitting the report
