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

## Chain Metadata (Cross-Skill Data Forwarding)

Every Cook Report MUST end with a `chain_metadata` YAML block. This enables downstream skills to consume cook's output data without parsing prose. See `docs/references/chain-metadata.md` for the full contract.

```yaml
chain_metadata:
  skill: "rune:cook"
  version: "2.2.0"
  status: "[same as Cook Report status]"
  domain: "[area worked on — e.g., auth, payments, compiler]"
  files_changed:
    - "[list of files created/modified in this session]"
  exports:
    commit_hash: "[actual git hash]"
    files_changed_count: [N]
    test_results: { passed: [N], failed: [N], coverage: [N] }
    quality_gates: { preflight: "[PASS/WARN/FAIL]", sentinel: "[PASS/WARN/FAIL]", review: "[PASS/WARN/FAIL]" }
    phase_count: [N]
    concerns: []  # populated if DONE_WITH_CONCERNS
  suggested_next:  # 1-3 data-driven recommendations based on THIS output
    - skill: "rune:[skill]"
      reason: "[grounded in actual data — not generic advice]"
      consumes: ["[export keys the suggested skill would use]"]
```

**Rules for suggested_next:**
- Base suggestions on ACTUAL output data (sentinel WARN → suggest deeper security review, low coverage → suggest more tests)
- Never suggest skills that already ran successfully in this session
- Status-aware: BLOCKED → suggest debug/fix, DONE → suggest review/deploy/test
- Max 3 suggestions, ordered by priority

**When NOT to emit:** When cook is invoked as a sub-step of `autopilot` or `team` — the orchestrator emits its own chain_metadata at the end.

## Usage Rules

- When cook is invoked **standalone** (not by team): Deliverables table is optional
- When cook is invoked by **team** with a NEXUS Handoff: Deliverables table is **MANDATORY** — team uses it to track acceptance criteria across streams
- Cook Report MUST contain actual commit hash, not placeholder
- Self-Validation must pass before emitting the report
