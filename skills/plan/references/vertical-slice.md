# Vertical Slice (Tracer-Bullet) Decomposition

**Each slice is a thin path through ALL layers** — schema, API, UI, tests — that produces a demoable, verifiable outcome on its own. Prefer many thin slices over few thick ones.

> Horizontal layers ("all models → all APIs → all UI") look organized but block on the slowest layer. Vertical slices ship in parallel and verify continuously.

## Slice rules

1. **End-to-end, not end-of-end** — every slice touches every layer it needs (schema migration + handler + UI + test). A slice that only adds a database column is not a slice; it's a fragment.
2. **Demoable on its own** — when the slice is merged, you can demo it (or run a single command to verify). If demoing requires "and now switch to the other PR", the slices were drawn wrong.
3. **Narrow but complete** — one user story, one happy path, minimal error handling. Edge cases are *separate slices*, not bigger versions of the same slice.
4. **Independently grabbable** — any developer or agent should be able to pick up Slice N without reading Slice N+1. Dependencies declared explicitly, not implicit.

## Slice types

| Type | Definition | When |
|------|------------|------|
| **AFK** | Can be implemented and merged without human interaction. Spec is concrete enough that an agent (or the weakest model) executes it correctly. | Default — prefer wherever possible |
| **HITL** | Requires human input mid-execution: architectural decisions, design review, copy approval, third-party access (OAuth setup, DNS, payment provider). | Only when AFK is genuinely impossible |

**Bias toward AFK.** A slice marked HITL is friction — every HITL slice blocks the parallel queue. Before marking HITL, ask: can the human input be done ONCE upfront and then the slice is AFK?

## Slice template (per task in a phase file)

```markdown
### Slice: [verb-led title]
- **Type**: AFK | HITL
- **Story**: As a [persona], I want to [action] so that [benefit]
- **Path through layers**:
  - Schema: [migration / type addition]
  - API: [endpoint or function signature]
  - UI: [component or surface]
  - Test: [verification approach]
- **Demoable**: [exact command or click-path that shows it works]
- **Blocked by**: [slice IDs] | None — can start immediately
- **Out of scope** (explicit): [what this slice does NOT cover]
```

## Granularity

Right-sized slice:
- Fits in one phase file (under the Amateur-Proof 200-line cap)
- Completable in one session by Sonnet/Haiku
- Touches 3-7 files total across all layers
- Has exactly ONE acceptance criterion that proves the path works end-to-end

If a slice has 5+ acceptance criteria → split it. If a slice touches 10+ files → split it. If two slices share 3+ files → merge or sequence them (file overlap = race condition in parallel execution).

## Decomposition checklist

Before approving a slice breakdown, verify:

- [ ] Every slice can be demoed independently
- [ ] No slice requires another in-flight slice to be merged first (declared deps OK; in-flight overlap NOT OK)
- [ ] AFK / HITL labels are accurate — HITL slices have a specific blocking input named
- [ ] Slice count matches granularity rule (3-7 slices for a typical feature; if 1 or 2, slice is too thick; if 15+, too thin)
- [ ] First slice is the **smallest valuable end-to-end path** — proves the architecture works before scaling

## Anti-patterns

| Anti-pattern | Why it fails |
|--------------|--------------|
| Layer-1 slice ("just the database changes") | Not demoable, not verifiable, blocks every downstream slice |
| Slice with "and the admin UI for it" appended | Hidden second slice — split |
| 10 acceptance criteria on one slice | Granularity miss — slice is actually a feature |
| Slice marked HITL because "I might want to review the design" | HITL is for hard blockers, not soft preferences. Use AFK + post-merge review. |
| First slice is the most complex one ("let's build the hardest part first") | Wrong order. First slice proves architecture; complexity comes later when foundation is verified. |

## Integration with phase planning

Vertical slices map cleanly to phase wave structure:

```
Phase 1, Wave 1: Slice A (foundation slice — proves architecture end-to-end)
Phase 1, Wave 2: Slice B, C (parallel — depend on A's contract, not on each other)
Phase 2, Wave 1: Slice D, E (next layer of slices)
```

Each slice = one task in a wave. Use `touches[]` / `provides[]` / `requires[]` metadata (see Change Stacking in `plan/SKILL.md`) to detect file overlap between slices in the same wave.
