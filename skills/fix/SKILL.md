---
name: fix
description: Apply code changes and fixes. Writes implementation code, applies bug fixes, and verifies changes with tests. Core action hub in the development mesh.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L2
  model: sonnet
  group: development
---

# fix

## Purpose

Apply code changes and fixes. Fix is the action hub of the Development Hub — it writes new code, applies bug fixes, refactors existing code, and verifies changes pass tests. Tightly coupled with debug (for diagnosis) and test (for verification) in the development mesh.

## Triggers

- Called by `cook` Phase 4 IMPLEMENT — write code to pass tests
- Called by `debug` when root cause found and fix is ready
- Called by `review` when bugs found during review
- `/rune fix <issue>` — manual fix application
- Auto-trigger: after successful debug diagnosis

## Calls (outbound)

- `debug` (L2): when root cause unclear before fixing — need diagnosis first
- `test` (L2): verify fix with tests after applying changes
- `review` (L2): self-review for complex or risky fixes
- `verification` (L3): validate fix doesn't break existing functionality
- `docs-seeker` (L3): check correct API usage before applying changes

## Called By (inbound)

- `cook` (L1): Phase 4 IMPLEMENT — apply code changes
- `debug` (L2): root cause found, ready to apply fix
- `review` (L2): bug found during review, needs fixing
- `surgeon` (L2): apply refactoring changes

## Cross-Hub Connections

- `fix` ↔ `debug` — bidirectional: debug diagnoses → fix applies, fix can't determine cause → debug investigates
- `fix` → `test` — after applying fix, run tests to verify
- `fix` ← `review` — review finds bug → fix applies correction
- `fix` → `review` — complex fix requests self-review

## Workflow

1. **Receive task** — diagnosis from debug, implementation spec from plan, or bug report from review
2. **Understand context** — read affected files, understand dependencies and side effects
3. **Plan changes** — determine minimal set of changes needed (YAGNI)
4. **Apply changes** — write/edit code using immutable patterns, proper error handling
5. **Verify locally** — call verification for lint, type-check, basic sanity
6. **Run tests** — call test to verify changes pass existing + new tests
7. **Self-review** — for complex fixes, call review for quality check
8. **Report** — output summary of changes made and verification results

## Output Format

```
## Fix Report
- **Task**: [what was fixed/implemented]
- **Status**: complete | partial | blocked

### Changes
- `path/to/file.ts` — [description of change]
- `path/to/other.ts` — [description of change]

### Verification
- Lint: PASS | FAIL
- Types: PASS | FAIL
- Tests: PASS | FAIL ([n] passed, [m] failed)

### Notes
- [any caveats or follow-up needed]
```

## Cost Profile

~2000-5000 tokens input, ~1000-3000 tokens output. Sonnet for code writing quality. Most active skill during implementation.
