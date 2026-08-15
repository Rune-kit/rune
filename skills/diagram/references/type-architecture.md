# Architecture

**Best for:** system overviews, data-flow diagrams, integration maps, infra topology, agent-mesh topologies.

## Layout conventions

- Group components by tier or trust boundary (frontend → backend → data; public → private).
- Primary flow runs left→right or top→down. Pick one and hold it.
- Draw arrows before boxes so z-order puts connections behind components.
- 1–2 coral focal nodes: the primary integration point, the primary data store, or the key decision node.
- Dashed boundary rectangles mark regions (VPC, security group, trust zone); labels sit on a paper-colored mask over the boundary line.

## Connector style

Rounded right-angle (orthogonal) connectors are mandatory for all off-axis connections — diagonal `<line>` is a hard fail (see `connectors.md`). Two-bend elbow with `r=8`:

```svg
<!-- right+down: from (x1,y1) to (x2,y2), mid = (x1+x2)/2 -->
<path d="M x1,y1 H mid-8 Q mid,y1 mid,y1+8 V y2-8 Q mid,y2 mid+8,y2 H x2"
      fill="none" stroke="…" stroke-width="1.2" marker-end="url(#arrow)"/>
```

Port selection: use top/bottom for vertical connectors. When the destination is noticeably above or below the source, exit the source's top/bottom edge with a single-bend L-path into the destination's top/bottom edge — not a left/right side port. Reserve left/right ports for primarily-horizontal travel.

Dashed paths (optional, return, async, passive) use `stroke-dasharray="4,3"` and `stroke-width="1"`, with the same routing, port-selection, and bridge/hop rules as solid paths. When a dashed and a solid path must cross, bridge the dashed one.

Zone label margin: leave ≥16px between the bottom of the zone eyebrow label and the top of the first enclosed node (zone `y` = node_top − 32; label mask `y` = zone_y + 4).

## Zone grouping

Group 2+ nodes that serve the same tier or trust boundary with a zone rect drawn before arrows and nodes (z-order: bg → zones → arrows → nodes). See `connectors.md` § Zone grouping for the primitive. Max 3 zones per diagram.

## Anti-patterns

- Every box in coral ("this is important too") — hierarchy collapses.
- Bidirectional arrow when one direction is obvious from context.
- Legend floating inside the diagram area.
- Diagonal connector between off-axis nodes.
- Connector routed behind a non-endpoint box (unless dashed-transit exception applies).

## Examples

- `examples/architecture.html` — minimal light (6 nodes, 1 focal accent)
- `assets/template-dark.html` — minimal dark variant
