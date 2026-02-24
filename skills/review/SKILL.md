---
name: review
description: Code quality review — patterns, security, performance, correctness. Finds bugs, suggests improvements, triggers fix for issues found. Escalates to opus for security-critical code.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L2
  model: sonnet
  group: development
---

# review

## Purpose

Code quality review covering patterns, security, performance, and correctness. Review is the quality conscience of the Development Hub — it finds bugs, identifies code smells, checks for security issues, and triggers fix for anything that needs changing. Escalates to opus for security-critical code paths.

## Triggers

- Called by `cook` Phase 5 REVIEW — after implementation complete
- Called by `fix` for self-review on complex fixes
- `/rune review` — manual code review
- Auto-trigger: when PR is created or significant code changes committed

## Calls (outbound)

- `scout` (L2): find related code for fuller context during review
- `test` (L2): when untested edge cases found — write tests for them
- `fix` (L2): when bugs found during review — trigger fix
- `sentinel` (L2): when security-critical code detected (auth, input, crypto)
- `docs-seeker` (L3): verify API usage is current and correct

## Called By (inbound)

- `cook` (L1): Phase 5 REVIEW — post-implementation quality check
- `fix` (L2): complex fix requests self-review
- User: `/rune review` direct invocation
- `surgeon` (L2): review refactored code quality
- `rescue` (L1): review refactored code quality

## Cross-Hub Connections

- `review` → `test` — untested edge case found → test writes it
- `review` → `fix` — bug found during review → fix applies correction
- `review` → `scout` — needs more context → scout finds related code
- `review` ← `fix` — complex fix requests self-review
- `review` → `sentinel` — security-critical code → sentinel deep scan

## Workflow

1. **Gather context** — read changed files, call scout for related code if needed
2. **Correctness review** — check logic, data flow, edge cases, async patterns
3. **Security review** — check for OWASP top 10, secrets, input validation (delegate to sentinel if critical)
4. **Performance review** — check for N+1 queries, unnecessary re-renders, memory leaks
5. **Pattern review** — check consistency with project conventions, naming, structure
6. **Test coverage** — identify untested edge cases, call test if gaps found
7. **Bug detection** — if bugs found, call fix with descriptions
8. **Report** — output review with severity-ranked findings

## Severity Levels

```
CRITICAL  — security vulnerability, data loss risk, crash bug
HIGH      — logic error, missing validation, broken edge case
MEDIUM    — code smell, performance issue, missing error handling
LOW       — style inconsistency, naming suggestion, minor refactor opportunity
```

## Output Format

```
## Code Review Report
- **Files Reviewed**: [count]
- **Findings**: [count by severity]
- **Overall**: APPROVE | REQUEST CHANGES | NEEDS DISCUSSION

### CRITICAL
- `path/to/file.ts:42` — [description of critical issue]

### HIGH
- `path/to/file.ts:85` — [description of high-severity issue]

### MEDIUM
- `path/to/file.ts:120` — [description of medium issue]

### Positive Notes
- [good patterns observed]

### Verdict
[Summary and recommendation]
```

## Cost Profile

~3000-6000 tokens input, ~1000-2000 tokens output. Sonnet default, opus for security-critical reviews. Runs once per implementation cycle.
