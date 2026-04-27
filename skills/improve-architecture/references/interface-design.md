# Interface Design

When the user picks a deepening candidate whose interface shape is non-obvious — multiple credible designs, no clear winner — hand off to `rune:brainstorm` in `design-it-twice` mode (brainstorm v0.6+) for parallel-subagent exploration.

This file documents what `improve-architecture` provides to brainstorm and what it expects back, so the two skills compose without duplication.

## When to hand off (decision rule)

| Situation | Action |
|-----------|--------|
| Interface is a translation of existing public functions; one obvious shape | Skip brainstorm; hand directly to `surgeon` |
| Two or more credible interface shapes exist (different sets of methods, different parameter shapes) | Hand to `brainstorm` design-it-twice |
| Cross-seam dependencies (remote-owned or true-external) where ports vs no-ports is itself a design question | Hand to `brainstorm` design-it-twice |
| User explicitly asked "what are the options?" | Hand to `brainstorm` design-it-twice |

## What `improve-architecture` provides

A technical brief with:

1. **Module path + scope** — which files / functions are involved
2. **Coupling details** — what currently calls into the candidate, what the candidate currently calls
3. **Dependency category** — from [deepening.md](deepening.md): in-process / local-substitutable / remote-owned / true-external
4. **Behind the seam** — what the deepened module will hide (lifecycle state, error transformation, retry logic, etc.)
5. **Vocabulary tokens** — controlled terms from [language.md](language.md) plus domain terms from `CONTEXT.md` if present

The brief is independent of any user-facing problem-space explanation; brainstorm constructs that separately.

## What `improve-architecture` expects back

For each design brainstorm produces, the response must include:

1. **Interface** — types, methods, params + invariants, ordering, error modes
2. **Usage example** — how a caller actually invokes it
3. **What this hides behind the seam** — internal state, side effects, retry logic
4. **Dependency strategy & adapters** — what category, what adapters (≥2 for real seam, else marked internal)
5. **Trade-offs** — depth vs flexibility vs ease-of-use

Each design must be **radically different** — minimize / maximize-flexibility / optimize-common-case / ports-and-adapters constraints, see brainstorm `design-it-twice.md`.

## Diversity gate (brainstorm enforces)

Brainstorm computes a diversity score across designs. If `diversity < 0.4`, designs are too similar — re-spawn with new constraint pinning. `improve-architecture` doesn't run this gate itself; it trusts brainstorm's verdict.

## After designs return

`improve-architecture` presents the designs sequentially (so user can absorb each), then a comparison table contrasting them by:

- **Depth** — leverage at the interface
- **Locality** — where change concentrates
- **Seam placement** — internal vs external; ports yes/no

Ends with an opinionated recommendation. Hybrid synthesis is allowed if two designs combine well.

## Then to surgeon

Once user picks a design (or hybrid), update the proposal payload's `target` block:

```yaml
target:
  depth: 4
  leverage: 4
  locality: 4
  interface_choice: AuthPort variant 2 (minimize)
suggested_seam: AuthPort
adapters_planned: [HttpAuthAdapter, InMemoryAuthAdapter]
```

Hand off to `surgeon`. Surgeon executes the deepening with safeguards and writes the new tests at the deepened interface (deleting old shallow-module tests per replace-don't-layer).
