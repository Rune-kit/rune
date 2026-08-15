# Style Guide

Single source of truth for color, typography, and layout tokens. Every diagram draws from the **semantic roles** below — never from hex values inlined in other reference files. Change this file to change the visual skin; every new diagram inherits it without touching type-specific logic.

## Token resolution order

Before drawing, resolve tokens in this order and record which source won:

1. `.rune/design-system.md` — if it names colors and fonts, map them onto the roles below.
2. `.rune/conventions.md` — if it names palette or typography, map them next.
3. Shipped defaults in this file — used only when neither of the above names a value.

The output is the **same roles** either way (`paper`, `ink`, `accent`, …). What changes is which hex values and font families fill them. If a project already names fonts (e.g. Space Grotesk / Inter / JetBrains Mono), use those families — do **not** force a specific serif/sans/mono family over the project's own.

## Semantic roles

| Role | Purpose | Default (light) | Default (dark) |
|---|---|---|---|
| `paper` | Page background, default node fill | `#f5f5f5` | `#2d3142` |
| `paper-2` | Diagram container bg, secondary fill | `#ececec` | `#393e53` |
| `ink` | Primary text, primary stroke | `#2d3142` | `#f5f5f5` |
| `muted` | Secondary text, default arrow stroke | `#4f5d75` | `#bfc0c0` |
| `soft` | Sublabels, boundary labels | `#7a8399` | `#8e98ac` |
| `rule` | Hairline borders | `rgba(45,49,66,0.12)` | `rgba(245,245,245,0.12)` |
| `rule-solid` | Stronger borders, baselines | `#bfc0c0` | `rgba(191,192,192,0.25)` |
| `accent` | Focal / 1–2 max per diagram | `#eb6c36` | `#f08a59` |
| `accent-tint` | Fill for accent-bordered boxes | `rgba(235,108,54,0.08)` | `rgba(240,138,89,0.10)` |
| `link` | HTTP/API calls, external arrows | `#2e5aa8` | `#6a95d8` |

**Focal rule:** `accent` goes on 1–2 elements max. Everything else is `ink` / `muted` / `soft`. If you are tempted to accent 4 things, you have not decided what is focal yet.

### Inversion rule (light → dark)

Any `rgba(45,49,66, X)` in light becomes `rgba(245,245,245, X)` in dark. Same opacities, RGB flipped. The accent gets a slight hue-shift brighter to read on dark paper.

## Node type → treatment

| Type | Fill | Stroke |
|---|---|---|
| **Focal** (1–2 max) | `accent-tint` | `accent` |
| **Backend / API / Step** | `#ffffff` (white) | `ink` |
| **Store / State** | `ink @ 0.05` | `muted` |
| **External / Cloud** | `ink @ 0.03` | `ink @ 0.30` |
| **Input / User** | `muted @ 0.10` | `soft` |
| **Optional / Async** | `ink @ 0.02` | `ink @ 0.20` dashed `4,3` |
| **Security / Boundary** | `accent @ 0.05` | `accent @ 0.50` dashed `4,4` |

## Typography

| Role | Default family | Size | Weight | Usage |
|---|---|---|---|---|
| `title` | serif | 1.75rem | 400 | Page H1 |
| `node-name` | sans | 12px | 600 | Human-readable labels |
| `sublabel` | mono | 9px | 400 | Port, protocol, URL, field type |
| `eyebrow` | mono | 7–8px | 500, tracked 0.18em, uppercase | Type tags, axis labels |
| `arrow-label` | mono | 8px | 400, tracked 0.06em | Arrow annotations |
| `callout` | serif italic | 14px | 400 | Editorial asides only |

Three families, not more: serif + sans + mono. Mono is for **technical** content (ports, commands, URLs, field types); human-readable names go in sans; the page title is serif.

**Override:** if the project's `.rune/design-system.md` or `.rune/conventions.md` names a display/body/mono family, use those instead of the defaults above. The *role split* (serif title / sans names / mono technical) stays even when the specific families change.

## Stroke, radius, spacing

| Token | Value | Use |
|---|---|---|
| `stroke-thin` | `0.8` | Tag-box outlines, leaf nodes |
| `stroke-default` | `1` | Most strokes |
| `stroke-strong` | `1.2` | Emphasis strokes |
| `radius-sm` | `4` | Small tags |
| `radius-md` | `6` | Node boxes |
| `radius-lg` | `8` | Containers, rings |
| `grid` | `4` | Every coord, size, and gap is divisible by 4 (hard rule) |

## Constraints

- **Contrast**: `ink` must hit WCAG AA on `paper`; `muted` must hit AA on `paper` for 11px+ text.
- **One accent**: pick one color for `accent`. Two accents erase the focal signal.
- **No rainbow palette**: if a brand ships 8 colors, pick 3 (paper, ink, accent); the rest become `muted` variants.
- **Paper is warm-neutral, not pure white**: pick a cream, bone, or light grey with a hint of warmth.
- **Dot pattern is optional, not default**: the 22×22 dot pattern is opt-in for long-form editorial hero diagrams. Default background is a clean `paper` fill. When enabled, ~10% opacity of `ink`.
- **Container is clean by default**: the SVG sits directly on the page paper; a framed variant (`paper-2` bg + `rule` border + 8px radius + padding) is opt-in for card-heavy layouts.
