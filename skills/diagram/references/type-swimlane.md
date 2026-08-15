# Swimlane

**Best for:** cross-functional processes, RACI-style flows, vendor handoffs, multi-team shipping workflows.

## Layout conventions

- Horizontal lanes (or vertical columns) — one per actor/team. Label each lane in the left margin (or top) with a mono eyebrow.
- Lane dividers: 1px hairlines.
- Process steps are rectangles placed inside the lane of the actor performing them; arrows show flow.
- Handoffs (arrows crossing lane boundaries) are the most important edges — consider coral on the handoff that introduces the most coupling or latency.
- Don't force equal step count per lane; a lane with one step is fine.

## Connector style

Handoffs crossing lane boundaries are the meaningful edges. Off-axis handoffs use orthogonal elbows per `connectors.md`. Within-lane flow may use straight `<line>` segments when endpoints share an x or y coordinate.

## Complexity budget

- Max lanes: 5. Max nodes: 9. Max arrows: 12. Max coral: 2.

## Anti-patterns

- Lanes without labels.
- A step drawn across two lanes (pick one owner).
- Arrows that snake back and forth — reorder steps so the flow is mostly straight.

## Examples

- `assets/template.html` — minimal light base
- `assets/template-dark.html` — minimal dark variant
