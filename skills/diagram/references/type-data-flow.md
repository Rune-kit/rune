# Data Flow

**Best for:** visualizing how data moves through a pipeline **across organizational roles** — who initiates, who processes, who publishes, and who consumes. Use when the reader must see **who does what at each stage**, not just the technical components. Prefer **swimlane** for plain cross-functional business processes; prefer data-flow when the subject is a pipeline with typed payloads and role-scoped access boundaries.

## Layout conventions

- **Horizontal lanes** (one per role, 1–4) × **vertical steps** (columns, 1–6).
- Left label column (~140px) holds each lane's role label (uppercase mono, one or two lines).
- Top header strip holds a numbered pill + step label per column.
- Nodes sit in the `(lane, step)` cells that have work; **empty cells render nothing** — no placeholder rect, no role chip.
- Each node (100×64): role chip (top-left, the lane's 3-letter key), title (sans), sublabel + tool (mono), and **two data-type chips** at the bottom — input on the bottom-left, output on the bottom-right.

## Data-type chips

Small `16×8` badges describing the payload entering/leaving each node. Either may be omitted (source has only output, sink has only input).

| Code | Color | Meaning |
|------|-------|---------|
| `WB` | `#6e6479` mauve | Web / public data |
| `DB` | `#5e7a9b` steel-blue | Dataset / raw file |
| `TB` | `#b8915a` amber | Table / analysis-ready |
| `FL` | `#9c6b50` sienna | File / report / export |
| `LS` | `#4a7c59` forest | Live stream / event |

Reading a row becomes a payload-transformation trace: scan each node's input → output.

## Arrow rules

Four styles, bound to topology. Draw connectors before all node rects.

| Style | Stroke | Dash | When |
|---|---|---|---|
| `muted` | `muted`, 1.0 | — | Standard data hand-off between steps or within a lane |
| `trigger` | `muted`, 1.0 | `4,3` | Governance trigger — an admin action enables downstream work, unlabeled |
| `accent` | `accent`, 1.2 | — | Focal cross-role handoff — **exactly one**, labeled |
| `link` | `link`, 1.0 | — | Published / externally-consumed output |

Routing is **single-bend**: exit right, run a corridor, drop into the destination top/bottom. No diagonals; 8px `Q`-bezier corners. Only the `accent` arrow gets a label (opaque mask, 6–10px gap).

## Focal rule

One central cross-role handoff defines the diagram's claim — three focal slots, exactly one entry each:

- **One focal step** (header pill + label in accent).
- **One focal node** (accent border + accent role chip) — the node that *receives* the handoff.
- **One focal arrow** (`accent`, labeled with a short payload descriptor).

## Complexity budget

| Dimension | Max |
|---|---|
| Lanes (roles) | 4 |
| Steps | 6 |
| Labeled arrows | 1 (focal accent only) |
| Data-type chips per node | 2 |

Above 4 lanes or 6 steps: split into two diagrams (e.g. ingestion / analytics).

## Anti-patterns

- Placeholder empty cells; more than one labeled arrow; diagonal arrows.
- Accent on more than one node/step/arrow.
- Lane tints over-applied (≤1 lane).

## Example

A Rune agent mesh as a data flow: lanes `USER`, `ORCHESTRATOR`, `SPECIALIST`, `GATE` across steps `collect → plan → build → verify → ship`, with the focal handoff labeled `plan` into the `build` node.

- `assets/template.html` — minimal light base
- `assets/template-dark.html` — minimal dark variant
