# review — Weighted composite scoring

> Reference for `skills/review/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Weighted Composite Scoring

When a review is part of a recurring quality-gate cycle (e.g., sprint review, pre-release gate), produce a **composite quality score** alongside the findings list. This makes review output numeric and comparable across runs.

### Formula

```
Quality Score = (Correctness × 0.35) + (Security × 0.30) + (Test Coverage × 0.20) + (Conventions × 0.15)
```

Each dimension is scored 0–100 based on findings count and severity:
- 0 CRITICAL/HIGH findings → 100 for that dimension
- 1 CRITICAL → dimension capped at 40
- 1 HIGH → dimension capped at 70
- Each additional MEDIUM → subtract 5 (floor: 50)

### Grade Thresholds

| Score | Grade | Verdict |
|-------|-------|---------|
| 90–100 | Excellent | APPROVE |
| 75–89 | Good | APPROVE with notes |
| 60–74 | Fair | REQUEST CHANGES (MEDIUM issues) |
| 40–59 | Poor | REQUEST CHANGES (HIGH issues present) |
| 0–39 | Critical | REQUEST CHANGES (CRITICAL present) |

**When to include**: Only when `mode: "scored"` is passed by the caller, or when invoked by `audit`. Default review output uses the standard severity-ranked report without the score.
