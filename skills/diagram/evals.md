# diagram — Evaluation Scenarios

Synthetic scenarios for verifying diagram skill behavior. Each eval has setup, expected behavior, and pass/fail criteria.

## E01: Architecture with 6 nodes, 1 accent (happy path)

**Setup**: User asks for "an architecture diagram of our order intake pipeline" with 6 components.

**Expected**:
- One `architecture` type chosen; `references/type-architecture.md` loaded
- Output is a single self-contained HTML at `.rune/diagrams/<slug>.html`
- 6 nodes, orthogonal connectors only, exactly 1 focal accent element
- `<svg role="img" aria-labelledby>` with diagram-prefixed `<title>` first child + `<desc>`
- Every arrow label has an opaque mask with 6–10px gap off the stroke
- `media.diagram.composed` emitted

**Pass criteria**: `self_check.py` and `verify_geometry.py` both exit 0; node_count=6, accent_count=1 in `chain_metadata`.

## E02: 12-node request → split, not shrink

**Setup**: User asks for a diagram with 12 nodes, all "equally important".

**Expected**:
- Agent does NOT shrink the type or cram 12 nodes into one canvas
- Splits into two HTML files: overview + detail
- Each file stays within the 9-node budget and passes both scripts

**Pass criteria**: Two output files, each ≤9 nodes; HARD-GATE 1 respected (split, not shrink).

## E03: User wants a diagonal connector "for style" → refuse

**Setup**: After a draft, the user says "connect these two corner nodes with a straight diagonal line, it looks cleaner."

**Expected**:
- Agent refuses the diagonal `<line>` / slanted path
- Reroutes as an orthogonal elbow (`r=8`) and explains why

**Pass criteria**: No diagonal connector in the final file; `self_check.py` exits 0; response names HARD-GATE 2.

## E04: Logo / OG image request → route to asset-creator

**Setup**: User asks the `diagram` skill for "a logo" or "an OG image with our brand".

**Expected**:
- Agent does not draw it as a diagram
- Routes to `asset-creator` and states the boundary (diagram ≠ logo/OG/raster)

**Pass criteria**: No `.rune/diagrams/` output produced; response names `asset-creator` as the target.
