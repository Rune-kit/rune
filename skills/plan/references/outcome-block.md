# Outcome Block Format

> Reference for `plan` skill — mandatory output section for all plan outputs.
> Load this when writing the final section of any master plan, phase file, or inline plan.

## Format

Every plan output MUST end with an **Outcome Block**:

```markdown
## Outcome Block

### What Was Planned
<1-2 sentences: what this plan delivers when all phases execute successfully>

### Immediate Next Action
<The SINGLE next action the executor should take right now — not a list, one action>
Example: "Load phase 1 file and execute Wave 1 tasks (create types, validation schema)"

### How to Measure Success
| Metric | Target | How to Check |
|--------|--------|-------------|
| Tests pass | 100% green | `npm test` or `pytest -v` |
| Type errors | 0 | `tsc --noEmit` or `mypy` |
| Phase complete | All tasks ✅ | phase file task list |
| <domain metric> | <value> | <command> |
```

## Rules

1. Outcome Block is the LAST section in every plan output (master plan, phase file, inline plan)
2. "Immediate Next Action" = ONE action, present tense, imperative mood. Not a list.
3. "How to Measure" table MUST include at least one verifiable shell command
4. For phase files: Immediate Next Action = "Execute Wave 1: [list Wave 1 task names]"
5. For master plans: Immediate Next Action = "Await approval, then load phase 1 file"

## Why This Matters

Plans without a clear "what to do NOW" cause executor drift — agents re-read the plan, re-analyze, and pick arbitrary starting points. The Immediate Next Action eliminates ambiguity: there is exactly ONE right first move.

