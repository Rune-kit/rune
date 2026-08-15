# Process

**Best for:** sequential cross-functional processes where the reader needs to see *who* does *what*, *what data* enters and leaves each step, and *which tools* are used — responsibility audits, handoff maps, end-to-end workflow documentation. Prefer **swimlane** when data types and tools don't matter; prefer process when each step's input/output payload and responsible actor must be legible at a glance.

## Layout conventions

- **Horizontal lanes** (one per actor, 1–6) × **vertical steps** (columns, 1–12).
- Left label column (~140px) holds each actor's label (uppercase mono, one or two lines).
- Top header strip holds a numbered pill + step label per column (labels ≤9 chars).
- Nodes sit in `(lane, step)` cells that have work; **empty cells render nothing**.
- Each node (100×64): role chip (top-left, the lane's key), title (sans), `in → out` sublabel + tool (mono), and **two data-type chips** at the bottom — input bottom-left, output bottom-right. Skip the input chip on the first step's nodes; skip the output chip on the last step's nodes.

## Data-type chips

Same catalog as `type-data-flow.md` (`DB`, `TB`, `FL`, `WB`, `LS`, `N/A`). Chip colors describe *payload format*; keep them separate from any accent signal.

## Arrow rules

Three styles, bound to topology. Draw connectors before all node rects.

| Style | Stroke | Dash | When |
|---|---|---|---|
| `normal` | `muted`, 1.0 | — | Standard hand-off between steps or actors, unlabeled |
| `focal-in` / `focal-out` | `accent`, 1.2 | — | Every edge into (`focal-in`) or out of (`focal-out`) the focal node |
| `trigger` | `muted`, 1.0 | `4,3` | Orchestration trigger (scheduler → tool, override → upstream) |

Routing is **single-bend right-angle**: exit a node's right edge, run a corridor, enter the destination's top (downward) or bottom (upward). Same-lane adjacent steps use a plain horizontal `<line>`. No diagonals, no left-side entry, no top/bottom exit. 8px `Q`-bezier corners. Arrows are unlabeled by default — the step number + actor lane carry the meaning; label only a non-step concept (a re-test loop, an escalation).

## Focal rule

Three focal slots, exactly one entry each:

- **One focal step** (header pill + label in accent).
- **One focal node** (accent border + accent role chip; title text stays `ink`).
- **One focal arrow set** (`focal-in` and `focal-out` edges touching the focal node, accent).

## Complexity budget

| Dimension | Max |
|---|---|
| Lanes (actors) | 6 |
| Steps | 12 |
| Labeled arrows | 0 by default (label only non-step concepts) |
| Data-type chips per node | 2 |

Above 6 lanes or 12 steps: split into overview + detail.

## Anti-patterns

- Placeholder empty cells; diagonal arrows; left/right entry on a vertical-dominant arrow.
- More than one focal step / focal node.
- Unlabeled lanes; all arrows the same style (triggers must be dashed).

## Example

A Rune cook→ship workflow: lanes `USER`, `COOK`, `SPECIALIST`, `GATE` across steps `plan → build → test → review → ship`, focal on the `test` step and its node, with dashed `trigger` edges for the review loop.

- `assets/template.html` — minimal light base
- `assets/template-dark.html` — minimal dark variant
