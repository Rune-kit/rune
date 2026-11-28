# Feature: Mesh diagram zoom, search and selection panel

## Overview
The mesh iframe shipped in #25 cannot be zoomed, so labels stay unreadable and
you cannot tell which skills connect. This adds camera controls, search, a
persistent selection panel, layer filters, a light theme and a fullscreen link.
Layout and data stay generated from skill-index.json.

## Phases
| # | Name | Status | Summary |
|---|------|--------|---------|
| 1 | Camera + graph helpers | done | Pure functions in scripts/lib/mesh-view.mjs, unit tests |
| 2 | Diagram chrome | done | Toolbar, panel/sheet, theme, boot() wired by site-gen |
| 3 | Guide embed + checks | done | Fullscreen link, taller iframe, overflow DOM check, CI / PR |

## Key Decisions
- Pure camera/search/selection logic is tested without a browser; DOM boot lives in the same module.
- Labels: L0/L1 at any zoom; related-to-selection always; every label only when zoom ≥ 2.5, drawn horizontal.
- Selection is sticky (click/tap/search). Hover does not change the panel.
- site-gen copies mesh-view.mjs → docs/assets/mesh-view.js and embeds MESH_DATA as JSON.
- Homepage #mesh stays the existing tier cards (not this iframe). Fullscreen is the standalone diagram page.

## Deferred
- Animated "play a failure" traces (wave 2).
