# ba — Completeness scoring and logic-check output

> Reference for `skills/ba/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

### Step 3.5 — Completeness Scoring (Options & Alternatives)

When presenting options, alternatives, or scope decisions to the user, rate each with a **Completeness score (X/10)**:

| Score | Meaning | Guidance |
|-------|---------|----------|
| 9-10 | Complete — all edge cases, full coverage, production-ready | Always recommend |
| 7-8 | Covers happy path, skips some edges | Acceptable for MVP |
| 4-6 | Shortcut — defers significant work to later | Flag trade-off explicitly |
| 1-3 | Minimal viable, technical debt guaranteed | Only for time-critical emergencies |

**Always recommend the higher-completeness option** unless the delta is truly expensive. With AI-assisted coding, the marginal cost of completeness is near-zero:

| Task Type | Human Team | AI-Assisted | Compression |
|-----------|-----------|-------------|-------------|
| Boilerplate / scaffolding | 2 days | 15 min | ~100x |
| Test writing | 1 day | 15 min | ~50x |
| Feature implementation | 1 week | 30 min | ~30x |
| Bug fix + regression test | 4 hours | 15 min | ~20x |

**When showing effort estimates**, always show both scales: `(human: ~X / AI: ~Y)`. The compression ratio reframes "too expensive" into "15 minutes more."

**Anti-pattern**: "Choose B — it covers 90% of the value with less code." → If A is only 70 lines more, choose A. The last 10% is where production bugs hide.

#### Output Format

```
Logic Consistency Report:
  1. AC → User Story:      🟢 all AC trace to US-1 or US-2
  1b. EARS FR → story+AC:  🟢 FR-1..FR-5 each map to a story and an AC
  2. Business rule → AC:   🟡 "no duplicate emails" cited — exception flow missing
  3. Scope disjoint:       🟢
  4. Terminal states:      🟢
  5. Deps in constraints:  🔴 "PostgreSQL 15" missing from Q5 answer
  6. NFR measurable:       🟢
  7. Hidden reqs resolved: 🟢

Verdict: 1 🔴, 1 🟡, 5 🟢 → BLOCK handoff until 🔴 fixed
```
