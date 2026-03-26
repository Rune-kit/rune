# Error Recovery — Phase Failure Handling

What to do when each phase fails, plus repair operators to use before escalating.

## Phase Failure Table

| Phase | If this fails... | Do this... |
|-------|-----------------|------------|
| 1 UNDERSTAND | scout finds nothing relevant | Proceed with plan, note limited context |
| 2 PLAN | Task too complex | Break into smaller tasks, consider `rune:team` |
| 3 TEST | Can't write tests (no test framework) | Skip TDD, write tests after implementation |
| 4 IMPLEMENT | Fix hits repeated bugs | `rune:debug` (max 3 loops) → re-plan → if still blocked → **Approach Pivot Gate** → `rune:brainstorm(rescue)` |
| 5a PREFLIGHT | Logic issues found | Fix → re-run preflight |
| 5b SENTINEL | Security CRITICAL found | Fix immediately → re-run (mandatory) |
| 5c REVIEW | Code quality issues | Fix CRITICAL/HIGH → re-review (max 2 loops) |
| 6 VERIFY | Build/lint/type fails | Fix → re-run verification |

## Repair Operators (before escalation)

When a task fails during Phase 4 (IMPLEMENT), apply these operators in order before escalating.

| Operator | When | Action |
|----------|------|--------|
| **RETRY** | Transient failure (network, timeout, flaky test) | Re-run same approach, max 2 attempts |
| **DECOMPOSE** | Task too complex, partial progress | Split into 2-3 smaller tasks, continue |
| **PRUNE** | Approach fundamentally wrong | Remove failed code, try different approach from plan |

## Retry Budget

**2 repair attempts per task.**

After 2 failures → escalate:
- Same error both times → `debug` for root cause
- Different errors → `plan` to redesign the task
- All approaches exhausted → `brainstorm(rescue)` for alternative category

Do NOT ask user until repair budget is spent.
