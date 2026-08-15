# Loop

**Best for:** reinforcing cycles, flywheels, feedback loops, and operating loops — anything where the last step feeds the first and a shared hub accumulates state. The reader must see both motions at once: work advances clockwise around the ring, while each pass writes durable state back to one common center.

Prefer **flowchart** when the path ends or branches toward an outcome. Prefer loop only when the center accumulates shared state; the dashed write-back spokes are the defining signal — remove them and the figure is only a circular process.

## Layout conventions

- **5–8 stations plus exactly one hub.** Above 8 stations, split into overview + detail. Two hubs = two diagrams.
- Station `k=0` sits at the top; increasing `k` advances clockwise in equal `360/N` steps.
- Station: standard node (`paper` fill, `ink` stroke); name in sans, sublabel in mono.
- Hub: the one dark element (`ink` fill, `paper` text) — slightly larger than a station. It is accumulated state (memory, standards, evidence), not a seventh process step.
- At most **one** focal station (`accent-tint` fill, `accent` stroke).
- **Ring flow** — solid `muted` circular arcs on the station circle, clockwise. **Write-back spokes** — dashed `soft` radial lines inward to the hub (`stroke-dasharray="5,4"`).

## Geometry (deterministic)

For `N` stations, hub center `C=(cx,cy)`, ring radius `R`, station half-size `(a,b)`:

```text
theta_k = -90deg + k * (360deg / N)      # station k center angle
P_k     = C + R * (cos theta_k, sin theta_k)
```

Ring connectors are same-radius circular arcs between adjacent stations; the closing arc returns station `N-1` to station `0`:

```svg
M q_exit(k).x q_exit(k).y  A R R 0 0 1  q_end.x q_end.y
```

`q_exit(k)` is the circle/box intersection just clockwise of station `k`; `q_end` is the destination entry point, backed off by the marker overhang (~1.2px). Large-arc flag `0`, sweep `1` (clockwise). Spokes run from the station's inner edge toward `C` and stop `marker_gap` (≈6px) before the hub stroke.

Round station rectangles to the 4px grid; preserve symmetry when rounding paired stations. Include station boxes, ring curves, arrowheads, and a `margin` (≈64px) in the viewBox so nothing clips.

## Connector rules (type-specific exceptions)

`connectors.md` applies in full except for two loop-specific primitives, which replace the diagonal-`<line>` ban for this type:

- **Ring arcs** are same-radius circular arcs, solid, clockwise — never mixed with straight or orthogonal segments.
- **Spokes** are straight radial dashed lines pointing inward. They are true radii: they must not cross one another, and may touch only their source station and the hub.
- Ring connectors stay outside the hub. If a ring route would cross the hub, increase `R` or split.
- Spoke labels (optional) use `arrow-label`, an opaque `paper` mask, and a 6–10px gap. Label a curated subset, not all six.

## Anti-patterns

- Two hubs (two accumulated states) — draw two diagrams.
- Solid spokes — they look like primary flow; write-backs must stay dashed.
- Uneven station angles without reason; mixed arc + orthogonal ring segments.
- A cycle that never actually returns — that is a flowchart arranged in a circle.

## Example

A cook flywheel: stations `plan → implement → review → fix → verify → learn` around a `Shared context` hub, with dashed write-backs and one focal station (`review`).

- `assets/template.html` — minimal light base
- `assets/template-dark.html` — minimal dark variant
