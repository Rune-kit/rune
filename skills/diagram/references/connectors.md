# Connectors

Universal connector and node primitives. Type-specialized primitives (lifeline, activation bar, region, fragment frame) live in the relevant `type-*.md`.

## Paint order

Always draw in this z-order: background → zones → arrows → labels → nodes. Arrows go **behind** boxes; label masks sit on top of arrows but are clipped if a node paints over them (see rule 6).

## Arrow markers (define all three, always)

```svg
<marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
  <polygon points="0 0, 8 3, 0 6" fill="#4f5d75"/>
</marker>
<marker id="arrow-accent" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
  <polygon points="0 0, 8 3, 0 6" fill="#eb6c36"/>
</marker>
<marker id="arrow-link" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
  <polygon points="0 0, 8 3, 0 6" fill="#2e5aa8"/>
</marker>
```

| Arrow | Stroke | When |
|---|---|---|
| Default | `muted` | Internal, generic |
| Accent | `accent` | Primary / highlighted / headline |
| Link-blue | `link` | HTTP/API calls, external systems |
| Dashed | `stroke-dasharray="5,4"` + any color | Optional, passive, return, async |

## Mandatory connector rules

These six rules are non-negotiable. Run the self-check scripts before producing any diagram.

### 1. Rounded right-angle (orthogonal) connectors only

Never use a diagonal `<line>` or straight slanted path between nodes that do not share an x or y axis. Every bend is a quarter-arc with `r=8` (or `r=6` minimum for tight layouts). A plain straight `<line>` is reserved for endpoints that share the same x or y coordinate.

Two-bend elbow path (`r=8`), right then down from `(x1,y1)` to `(x2,y2)`, `mid = (x1+x2)/2`:

```svg
<path d="M x1,y1 H mid-8 Q mid,y1 mid,y1+8 V y2-8 Q mid,y2 mid+8,y2 H x2"
      fill="none" stroke="…" stroke-width="1.2" marker-end="url(#arrow)"/>
```

Flip the vertical signs for right+up. For a destination noticeably above/below the source, exit the source's top/bottom edge with a single-bend L-path (horizontal → corner → vertical into the node) instead of a left/right side port. Reserve left/right ports for primarily-horizontal travel.

Dashed paths follow the same orthogonal routing, port-selection, and bridge/hop rules — the dash pattern only communicates semantic weight, not a different grammar.

### 2. Label-to-connector margin: 6–10px gap, always

A label must never sit *on* its arrow. Place the label centered above (or beside, for vertical segments) the line with a minimum 6px gap between the bottom of the label's mask rect and the connector stroke. If the label is large, push to 8–10px. Never let the mask rect touch or overlap the stroke.

### 3. No overlapping connectors

Two connectors must never share the same stroke path, run parallel on top of each other, or be drawn on top of each other for any segment. When two orthogonal arrows must cross, apply the bridge/hop arc on the less important one (see below). When two arrows naturally want to overlap, offset their routing by ≥12px. If you find yourself stacking connectors, redesign — the diagram is over budget (split into overview + detail).

### 4. Shared edge → fan the attach points

When two or more connectors enter or exit the same edge of a box, each gets its own attach point — no two connectors may share a point. Spread attach points evenly with ≥12px between adjacent points (8px minimum for very small boxes):

- For N connectors on an edge of length L, attach point `k` (1..N) sits at offset `L * k / (N + 1)`.
- Route each connector orthogonally from its own attach point — no merging strokes near the box.
- Two parallel connectors running the same direction stay ≥12px apart along their entire length, not just at the attach point.

### 5. No transit behind a non-endpoint box

A connector must not pass behind a box that is not its source or destination — except when the box is geometrically unavoidable on the only direct orthogonal path (e.g. a footer service bar sitting between source and destination). In that exception:

- The stroke must be **dashed** (`stroke-dasharray="4,3"`) to signal "transit, not interaction".
- The label sits at the **visible end** (near the source), not behind the intervening box.
- No arrowhead may land on the intervening box's edge.

When in doubt, reroute.

### 6. Label mask must not overlap a node painted after it

Because nodes paint after labels, a mask that lands partly inside a node is covered by the node fill and the text renders as a fragment on the node border. Place the label on a segment of the connector that runs through open canvas — for a connector leaving a node's right edge, clear the node's `x + width` before the mask starts. A mask fully *inside* a node is a badge chip (`EXT`, `EDGE`, `ORIG`) and is legal. Verify with `verify_geometry.py`.

## Node box — full pattern

```svg
<!-- 1. Opaque paper mask — prevents arrows bleeding through transparent fills -->
<rect x="X" y="Y" width="W" height="H" rx="6" fill="#f5f5f5"/>
<!-- 2. Styled box -->
<rect x="X" y="Y" width="W" height="H" rx="6" fill="FILL" stroke="STROKE" stroke-width="1"/>
<!-- 3. Rectangular type tag (rx=2, NOT a pill) -->
<rect x="X+8" y="Y+6" width="28" height="12" rx="2" fill="transparent" stroke="STROKE@0.40" stroke-width="0.8"/>
<text x="X+22" y="Y+15" fill="STROKE@0.8" font-size="7" font-family="mono"
      text-anchor="middle" letter-spacing="0.08em">API</text>
<!-- 4. Node name (sans — human-readable) -->
<text x="CX" y="CY+2" fill="ink" font-size="12" font-weight="600"
      font-family="sans" text-anchor="middle">Node Name</text>
<!-- 5. Technical sublabel (mono) -->
<text x="CX" y="CY+18" fill="muted" font-size="9"
      font-family="mono" text-anchor="middle">tech:port</text>
```

## Arrow labels — always mask, always with margin

```svg
<!-- Mask sits above the arrow with a visible gap. Stroke is at ARROW_Y. -->
<rect x="MID_X-18" y="ARROW_Y-20" width="36" height="12" rx="2" fill="#f5f5f5"/>
<text x="MID_X" y="ARROW_Y-11" fill="#7a8399" font-size="8"
      font-family="mono" text-anchor="middle" letter-spacing="0.06em">WRITE</text>
```

Rules: ≤14 characters, all-caps, centered on segment midpoint; mandatory 6–10px gap between mask bottom and stroke; never `writing-mode` vertical; for vertical segments, place the label to the side with the same horizontal gap.

## Crossing arrows — bridge / hop

When two orthogonal arrows must cross, add a small arc (hop) on the less important arrow at the crossing point; the more important arrow is drawn uninterrupted.

```svg
<!-- Horizontal hop over a vertical crossing at x=cx, on a line at y -->
<path d="M x1,y H cx-8 a 8,8 0 0,1 16,0 H x2"
      fill="none" stroke="…" stroke-width="1.2" marker-end="url(#arrow)"/>
```

`a 8,8 0 0,1 16,0` is an 8px-radius semicircular bump upward. For a vertical hop over a horizontal, use `a 8,8 0 0,0 0,16` on the vertical path. Bridge the less semantically important arrow (passive, secondary, write-back, or dashed/muted) — never both.

## Zone grouping

Group 2+ nodes that serve the same tier or trust boundary with a zone rect drawn **before** arrows and nodes:

```svg
<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8"
      fill="rgba(45,49,66,0.02)" stroke="rgba(45,49,66,0.10)" stroke-width="0.8"/>
<rect x="{label_x}" y="{y+4}" width="{label_w}" height="12" rx="2" fill="{paper}"/>
<text x="{label_cx}" y="{y+13}" fill="rgba(45,49,66,0.40)" font-size="7"
      font-family="mono" text-anchor="middle" letter-spacing="0.14em">LAYER</text>
```

Rules: leave 12–16px above the first enclosed node for the eyebrow label; zone fill is a 2% ink wash (anything stronger competes with node fills); max 3 zones per diagram (more reads like a swimlane). Dark mode swaps `rgba(45,49,66,…)` → `rgba(245,245,245,…)` at the same opacities.

## Legend — horizontal strip at the bottom

Never float the legend inside the diagram area. Place it as a horizontal strip after all nodes, with a hairline separator, and expand the SVG `viewBox` height by ~60px:

```svg
<line x1="30" y1="LEGEND_Y-8" x2="VIEWBOX_W-30" y2="LEGEND_Y-8"
      stroke="rgba(45,49,66,0.10)" stroke-width="0.8"/>
<text x="30" y="LEGEND_Y+8" fill="#4f5d75" font-size="8" font-family="mono"
      letter-spacing="0.14em">LEGEND</text>
```

Items follow in a horizontal row, ~160px apart. Cover every node treatment and arrow kind used — and nothing extra.
