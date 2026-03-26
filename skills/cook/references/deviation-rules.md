# Deviation Rules — When Implementation Diverges from Plan

When implementation diverges from the approved plan, classify the deviation and act accordingly.

## Rule Table

| Rule | Scope | Action | Example |
|------|-------|--------|---------|
| R1: Bug fix | Code doesn't work as planned | Auto-fix, continue | Test fails due to typo, missing import |
| R2: Security fix | Vulnerability discovered | Auto-fix, continue | SQL injection, XSS, hardcoded secret |
| R3: Blocking fix | Can't proceed without change | Auto-fix, continue | Missing dependency, wrong API signature |
| R4: Architectural change | Different approach than planned | **ASK user first** | New database table, changed API contract, different library |

## Guidance

**R1-R3**: Security primitives and correctness fixes are NOT features — fix silently.

**R4**: If you catch yourself thinking "this is a better way" — STOP and ask.
The plan was approved for a reason. Architectural deviations require explicit user consent before proceeding.
