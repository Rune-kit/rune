# ADR Criteria — When to Open an ADR

ADRs (Architecture Decision Records) are durable. They survive sessions, codebases, and team turnover. That power has a cost: writing one for every minor pick fills the directory with noise, and the genuinely load-bearing decisions get lost.

The ADR gate ensures that every entry in `.rune/adr/` *earned* its place.

## The 3-criteria gate

An ADR is offered only if **all three** are true:

### 1. Hard to reverse (`reversibility`)

Score 1–5: how expensive is it to change your mind later?

| Score | Description |
|-------|-------------|
| 1 | Reversible next sprint (one PR, no migration) |
| 2 | Reversible this quarter (a few PRs, simple migration) |
| 3 | Significant cost (data migration, multi-PR rollout) |
| 4 | Quarter-or-more to reverse (schema change, integration rewrite) |
| 5 | Practically irreversible (architectural commitment, lock-in to vendor) |

### 2. Surprising without context (`surprisingness`)

Score 1–5: how likely is a future reader to wonder "why did they do it this way?"

| Score | Description |
|-------|-------------|
| 1 | Obvious — anyone would do it this way |
| 2 | Common, but with one minor detail |
| 3 | Mildly unusual — half of practitioners might pick differently |
| 4 | Strongly counter to common practice |
| 5 | Rare or counter-intuitive — without explanation, future engineer would "fix" it |

### 3. Real tradeoff (`tradeoff_strength`)

Score 1–5: how credible were the rejected alternatives?

| Score | Description |
|-------|-------------|
| 1 | No real alternative — the obvious thing |
| 2 | One alternative considered briefly |
| 3 | 2–3 alternatives evaluated; pick was clear |
| 4 | Multiple credible alternatives; pick required real analysis |
| 5 | Genuinely difficult choice; reasonable people disagreed |

### Threshold

```
score = reversibility + surprisingness + tradeoff_strength    # range 3–15
open_adr = (score >= 11) AND (each axis >= 3)
```

The "each axis >= 3" rule prevents single-axis cheating. A decision that's hard-to-reverse but obvious AND has no real alternatives (e.g., "we're using SQL for our SQL database") shouldn't be an ADR even if reversibility=5.

## Counter-test (anti-fake)

Before opening an ADR, the agent MUST be able to fill in **rejected alternatives + why**. If the agent can't name at least one credible alternative *that was actually considered*, the decision wasn't a real tradeoff. Re-classify as a "convention" — record it in CLAUDE.md or a comment, not in `.rune/adr/`.

```
Rejected alternative: PostgreSQL JSON columns
Why rejected: schema migrations harder; no JSON-path indexing in the version we use; team's tooling stack favors structured columns.
```

If you can't write that section, don't open the ADR.

## ADR file naming

Filename includes the score, so future reviewers see at a glance why this one was kept:

```
.rune/adr/ADR-007-postgres-write-model-s13.md
.rune/adr/ADR-008-event-sourced-orders-s14.md
```

Format: `ADR-NNN-<slug>-s<score>.md` where `NNN` is the sequential number and `score` is the 3–15 sum.

## What qualifies (examples)

- **Architectural shape**: "We're using a monorepo." "The write model is event-sourced; the read model is projected into Postgres." (s ≈ 12–14)
- **Integration patterns between modules**: "Ordering and Billing communicate via domain events, not synchronous HTTP." (s ≈ 11–13)
- **Technology choices that carry lock-in**: database, message bus, auth provider, deployment target — only the ones that would take a quarter to swap out. (s ≈ 11–14)
- **Boundary-and-scope decisions**: "Customer data is owned by the Customer module; other modules reference it by ID only." The explicit no-s are as valuable as the yes-s. (s ≈ 10–12 — borderline, judge case-by-case)
- **Deliberate deviations from the obvious path**: "We're using manual SQL instead of an ORM because X." (s ≈ 11–13 — high surprisingness)
- **Constraints not visible in the code**: "We can't use AWS because of compliance requirements." (s ≈ 11–13)
- **Rejected alternatives when the rejection is non-obvious**: considered GraphQL, picked REST for subtle reasons. (s ≈ 10–12 — if rejection is documented elsewhere, may not need ADR)

## What does NOT qualify (examples)

- "We chose lodash over underscore." (reversibility ≤ 2; not surprising; weak tradeoff) — s ≈ 5
- "This function uses async/await instead of Promises." (reversibility 1; not surprising; convention) — s ≈ 3
- "We're using TypeScript." (reversibility 5; not surprising; obvious for the stack) — s ≈ 7
- "We deferred dark mode." (this is a deferral, not a decision — goes to backlog or `.out-of-scope/`) — N/A

## When score is 8–10 (borderline)

Don't auto-open. Ask the user: "This decision scores 9/15 — borderline. Do you want it as an ADR, or is a comment in the code sufficient?" Default to the lighter touch.

## Score gaming detection

The score can be inflated, but the counter-test (rejected alternative) cannot be faked without lying about history. If the agent fills out scores ≥ 4 on each axis but can't name a credible rejected alternative, the gate fails and no ADR is opened.

`audit` later cross-references ADR scores — if the average score across `.rune/adr/` files is < 11, it flags "ADR inflation" as a quality concern.

## Convention vs Decision

Decisions are tradeoffs at fork points. **Conventions are choices everyone makes the same way** — naming, formatting, simple defaults. Conventions go in CLAUDE.md or code style guides, not ADRs.

A test: if you can imagine the team coming back next quarter and saying "yeah obvious, of course we did it this way" — it's a convention. If they'd say "wait, why did we do *that*?" — it's a decision and probably qualifies.
