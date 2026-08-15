# Sequence

**Best for:** request/response flows, protocol exchanges, multi-actor interactions over time, API call traces, incident reconstructions, auth/token refresh paths with branching.

## Layout conventions

- Actors as boxes in a horizontal row at the top.
- **Lifelines**: dashed vertical lines descending from each actor to the bottom.
- Messages: horizontal arrows between lifelines; time flows top→down.
- **Activation bar**: narrow rectangle (`w=8`, muted fill, 0.8 hairline stroke) on a lifeline spanning the interval that actor holds control. Stack for nested calls.
- Self-messages: short U-shaped loop returning to the same lifeline; label right of the loop.
- Return messages: **dashed** stroke + **filled** marker (never open). Prefer muted; optionally match the originating call color when pairing multi-hop stacks.
- Coral on the primary success response or headline message — one, maybe two. Actor focal strokes do not count toward the coral message budget.
- When the flow **branches** (valid vs invalid token, retry, optional step), draw a **combined fragment** frame — do not invent free-floating if/else arrow clusters.

## Message kinds

| Kind | Stroke | Marker | When |
|---|---|---|---|
| Call (sync) | solid muted or link-blue | filled | Request that expects a reply |
| Return | **dashed** muted (or match call color) | filled | Reply to a sync call — never solid |
| Async / fire-and-forget | dashed muted | **open** arrowhead | Beacons, events, one-way notify |
| Headline success | solid accent (≤1–2 messages) | accent filled | Primary happy-path response only |

### Open arrowhead (async)

```svg
<marker id="arrow-open" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
  <polyline points="0 0, 8 3, 0 6" fill="none" stroke="#4f5d75" stroke-width="1.2"/>
</marker>
```

Dark mode: stroke `#bfc0c0`. Do not fill the open marker — the hollow head is the async signal. Return messages keep the **filled** marker even when dashed.

## Combined fragments (`alt` / `opt` / `loop`)

Use a rectangular **frame** spanning only the lifelines participating in the branch. Operator label is mono, uppercase, in a small tab at the top-left of the frame. Time still flows top→down inside the frame.

```svg
<!-- Frame: light ink wash + hairline. Label tab top-left. -->
<rect x="X" y="Y" width="W" height="H" rx="4"
      fill="rgba(45,49,66,0.02)" stroke="rgba(45,49,66,0.22)" stroke-width="1"/>
<!-- Operator tab -->
<rect x="X" y="Y" width="40" height="16" rx="2"
      fill="#f5f5f5" stroke="rgba(45,49,66,0.22)" stroke-width="1"/>
<text x="X+20" y="Y+12" fill="#4f5d75" font-size="8"
      font-family="mono" text-anchor="middle" letter-spacing="0.12em">ALT</text>
```

### Operators

| Operator | Regions | Divider | Guard label |
|---|---|---|---|
| `opt` | 1 | none | `[if condition]` under the tab (mono 8px) |
| `alt` | **2 max** | dashed horizontal hairline across the frame | `[guard]` on region 1; `[else]` on region 2 |
| `loop` | 1 | none | `[for each item]` or `[retry ≤ 3]` under the tab |

### Fragment layout rules

- Frame left/right inset ≥12px from the outermost participating lifeline centers.
- ≥24px between consecutive message y-levels inside a region (4px grid).
- Guard sits in the first ~20px under the tab; first message ≥24px below the guard baseline.
- Divider y on the 4px grid; ≥16px clear of messages above and below.
- Nested fragments: **max 1 level**.
- Default: **one** fragment per diagram; a second only if each is a single-region `opt`/`loop`.
- Coral on **one** headline success message across the whole diagram (usually the happy-path return). Do not coral both `alt` branches.

### Out of scope (do not invent)

- `par`, `critical`, `break`, `ref`, and other UML operators.
- Participant create/destroy, found/lost messages, duration timing bars.

## Complexity budget (sequence-specific)

- Max lifelines: 5. Max messages (arrows): 12.
- Max combined fragments: 1 (hard default); 2 only if each is a single-region `opt`/`loop`.
- Max `alt` regions: 2. Max fragment nesting depth: 1. Max coral elements: 2 (prefer 1).

If exceeded, split: overview (happy path) + detail (failure / refresh path).

## Anti-patterns

- Message arrow pointing *upward* (reverses time — never).
- Activation bars that never close.
- Labels sitting over another lifeline — shorten or shift y into a gap.
- Swimlane-style lanes instead of lifelines (different grammar).
- `if/else` as two free-floating arrow clusters with **no** fragment frame.
- Nested `alt` inside `alt` (split into two diagrams).
- Fragment operator label in sans — must be mono: `ALT` / `OPT` / `LOOP`.
- Coral on both `alt` branches.
- Frame that covers actors with no messages inside the fragment.
- Filled arrowhead on async fire-and-forget; open arrowhead on returns.
