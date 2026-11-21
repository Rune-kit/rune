# plan — Change stacking

> Reference for `skills/plan/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Change Stacking (Overlap Detection)

When producing phase files with wave-based task grouping, every task MUST declare dependency metadata:

```markdown
### Task: Implement auth middleware
- **File**: `src/middleware/auth.ts` — new
- **touches**: [src/middleware/auth.ts, src/types/auth.d.ts]
- **provides**: [AuthMiddleware, verifyToken()]
- **requires**: [UserModel from Wave 1]
- **depends_on**: [task-1a]
```

**Pre-dispatch validation** (run after all tasks written, before presenting plan):

| Check | Detection | Action |
|-------|-----------|--------|
| **File overlap** | Same file in `touches[]` of 2+ tasks in same wave | BLOCK — move to sequential waves or merge tasks |
| **Missing dependency** | Task A's `requires[]` not in any prior task's `provides[]` | BLOCK — add missing task or fix dependency chain |
| **Cycle detection** | Task A `depends_on` B, B `depends_on` A | BLOCK — decompose into smaller tasks to break cycle |
| **Orphaned provides** | Task declares `provides[]` but no future task `requires[]` it | WARN — may indicate dead code or missing consumer task |

**Skip if**: Inline plan (trivial task), single-phase plan, or all tasks are strictly sequential.
