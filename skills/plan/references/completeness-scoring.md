# Completeness Scoring

> Reference for `plan` skill — Step 5.5.
> Load this when presenting alternative approaches from brainstorm or Step 3 decisions.

## Scoring Table

When presenting alternatives, rate each with **Completeness X/10**:

| Score | Meaning |
|-------|---------|
| 9-10 | Complete — all edge cases, full coverage, production-ready |
| 7-8 | Happy path covered, some edges skipped |
| 4-6 | Shortcut — defers significant work |
| 1-3 | Minimal viable, debt guaranteed |

## Rules

- **Always recommend the higher-completeness option.** With AI-assisted coding, the marginal cost of completeness is near-zero.
- Show **dual effort estimates** for each approach: `(human: ~X / AI: ~Y)`
- **Anti-pattern**: "Option B saves 70 LOC" → 70 LOC delta is meaningless with AI. Choose complete. The last 10% of coverage is where production bugs hide.


## Example Format

```
**Option A: Full validation with Zod** — Completeness 9/10
- Covers: schema validation, error messages, type inference
- human: ~2h / AI: ~15min
- Recommended ✅

**Option B: Manual checks** — Completeness 5/10
- Covers: happy path only, defers edge cases
- human: ~30min / AI: ~5min
- Not recommended — defers 40% of error handling
```
