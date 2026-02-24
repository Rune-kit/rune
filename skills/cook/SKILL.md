---
name: cook
description: Feature implementation orchestrator. Runs the full build cycle — understand, plan, test, implement, review, verify, commit. The main entry point for building features.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L1
  model: sonnet
  group: orchestrator
---

# cook

## Purpose

The primary orchestrator for feature implementation. Cook runs the full build cycle from understanding a request to committing tested, reviewed code. It coordinates the entire L2 mesh — calling scout, plan, test, fix, review, preflight, sentinel, and session-bridge in a phased workflow. Delegates model selection per phase: haiku for scanning, sonnet for coding, opus for architecture.

## Triggers

- `/rune cook <task>` — manual invocation
- Called by `team` when delegating a feature task
- Auto-trigger: when user says "implement", "build", "add feature", "create"

## Calls (outbound)

### Phase 1: UNDERSTAND
- `scout` (L2): scan codebase for context, existing patterns, related code

### Phase 2: PLAN
- `plan` (L2): create implementation plan (opus if complex, sonnet if straightforward)
- `brainstorm` (L2): if multiple valid approaches exist

### Phase 3: TEST (TDD Red)
- `test` (L2): write failing tests first — define expected behavior before coding

### Phase 4: IMPLEMENT (TDD Green)
- `fix` (L2): write code to pass the tests
- `debug` (L2): if implementation hits unexpected errors

### Phase 5: QUALITY
- `preflight` (L2): pre-commit quality gate (logic, error handling, completeness)
- `sentinel` (L2): security gate (secrets, OWASP, dependencies)
- `review` (L2): code quality review

### Phase 6: VERIFY
- `verification` (L3): run lint, type-check, full test suite
- `hallucination-guard` (L3): verify imports and API references

### Phase 7: COMMIT
- Git commit with semantic message

### Phase 8: BRIDGE
- `session-bridge` (L3): save decisions, conventions, progress to .rune/
- `onboard` (L2): generate project context if no CLAUDE.md found

## Called By (inbound)

- User: `/rune cook <task>` direct invocation
- `team` (L1): when team delegates a feature task to a cook instance

## Workflow

```
/rune cook "add user authentication with JWT"
│
├─ Phase 1: UNDERSTAND
│  └─ scout → scan auth patterns, existing middleware, user model
│
├─ Phase 2: PLAN
│  ├─ plan → break into tasks: model, middleware, routes, tests
│  └─ brainstorm? → JWT vs sessions vs OAuth (if ambiguous)
│
├─ Phase 3: TEST (Red)
│  └─ test → write failing tests for auth endpoints
│
├─ Phase 4: IMPLEMENT (Green)
│  ├─ fix → write auth code to pass tests
│  └─ debug? → if unexpected errors during implementation
│
├─ Phase 5: QUALITY
│  ├─ preflight → logic review, error handling, completeness
│  ├─ sentinel → secret scan, OWASP check on auth code
│  └─ review → code quality, patterns, security review
│
├─ Phase 6: VERIFY
│  ├─ verification → lint + types + full test suite
│  └─ hallucination-guard → verify imports exist
│
├─ Phase 7: COMMIT
│  └─ git commit -m "feat: add JWT authentication"
│
└─ Phase 8: BRIDGE
   └─ session-bridge → save "chose JWT because..." to .rune/decisions.md
```

## Phase Skip Rules

Not every task needs every phase:

```
Simple bug fix:     UNDERSTAND → IMPLEMENT → VERIFY → COMMIT
Small refactor:     UNDERSTAND → IMPLEMENT → QUALITY → COMMIT
New feature:        All 8 phases
Complex feature:    All 8 phases + brainstorm in Phase 2
Security-sensitive: All 8 phases + sentinel escalated to opus
```

## Context Bus

Cook maintains a shared context bus across all phases:

```
{
  task: "add user authentication with JWT",
  phase: "implement",
  decisions: [
    { phase: "plan", decision: "use JWT over sessions", reason: "stateless API" }
  ],
  files_touched: ["auth.ts", "middleware.ts", "user.model.ts"],
  tests_written: ["auth.test.ts"],
  errors_encountered: [],
  current_blocker: null
}
```

## Error Recovery

| If this fails... | Cook does this... |
|---|---|
| scout finds nothing | proceed with plan, note limited context |
| plan too complex | break into smaller cook instances via team |
| test can't write tests | skip TDD, proceed to implement, write tests after |
| fix hits bug | call debug, loop debug↔fix (max 3 iterations) |
| preflight blocks | fix issues, re-run preflight |
| sentinel blocks | fix security issues before commit (mandatory) |
| review finds critical | fix → re-review (max 2 iterations) |

## Output Format

```
## Cook Report: [Task Name]
- **Status**: complete | partial | blocked
- **Phases Completed**: [list]
- **Files Changed**: [count]
- **Tests**: [passed]/[total]
- **Quality**: preflight [PASS/WARN], sentinel [PASS/WARN]
- **Commit**: [hash] [message]

### Decisions Made
- [decision and rationale]

### Session State
- Saved to .rune/decisions.md
- Saved to .rune/progress.md
```

## Cost Profile

~$0.05-0.15 per feature. Delegates to haiku for scanning, sonnet for coding, opus for planning complex features. Most cost is in Phase 4 (implement) and Phase 5 (quality).
