# Rune website — design contract

Scope: the static GitHub Pages site in `docs/` (`index.html`, `style.css`, `script.js`).
Written with the Rune `design` skill (Step 5 contract + Step 6.5 audit), the `diagram` skill and
the `ui` pack's `landing-patterns`. `.rune/` is gitignored in this repo, so the contract lives here.

## Mood & domain
- Domain: Developer Tools × Landing. Mood: confident, technical, calm.
- One accent per theme, used for focal elements only (max two accent nodes per diagram).

## Tokens (from `:root` / `[data-theme="dark"]`)
| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg-base` / `--bg-card` | warm beige / paper | ink / slate | page / cards |
| `--accent` | `#5b7852` sage | `#10b981` emerald | focal strokes, fills, buttons |
| `--sv-ink-accent` | accent 62% + ink | accent | accent-coloured **text** (≥4.5:1) |
| `--sv-line` | ink 62% | ink 45% | connectors, arrowheads (≥3:1) |
| `--sv-hair` | ink 18% | ink 18% | dashed zone outlines (decorative) |
| `--sv-pro` / `--sv-biz` | oklch(72% .16 70) / oklch(66% .15 295) | same | tier markers only, never text |
| `--sv-term-bg` | oklch(17% .02 250) | same | terminals + code blocks (always dark) |

Fonts: Space Grotesk (display), Inter (body), JetBrains Mono (code, eyebrows, numbers).
Icons: Phosphor Regular (MIT), inlined as an SVG `<symbol>` sprite — no hand-drawn icons, no emoji.

## Scale minimums
- Body ≥ 16px, meta ≥ 14px *rendered* (SVG user units are bumped on the mobile diagram, which renders at ~0.9×).
- Eyebrows: 12px mono, uppercase, 0.12–0.14em tracking.
- Touch targets ≥ 44px on ≤760px; copy buttons go icon-only with `aria-label` there.
- Focus ring: 3px `--accent`, 3px offset, on every interactive element.

## Diagram rules (`diagram` skill)
- Orthogonal connectors only (`H`/`V` paths); arrowheads are marker polygons.
- Paint order: zones → wires → nodes. Zones carry an eyebrow label.
- Every SVG: `role="img"`, `aria-labelledby` → `<title>` "diagram: …" + `<desc>`.
- `skills/diagram/scripts/self_check.py` must pass on the extracted SVGs.

## Motion (MOTION-CRAFT)
- Packets are decorative, linear, 2.4s loop; rest state `opacity: 0` in the base rule.
- Run only while on screen (IntersectionObserver), Pause/Play button with `aria-pressed` (WCAG 2.2.2).
- `prefers-reduced-motion: reduce` → bail (packets and the pause button are not rendered).

## UX writing
- Developer-tools tone: direct, technical, verb-first CTAs ("Read the rune serve guide").
- Never show a real key; mock keys are masked (`rune_sk_••••`).
- Copy feedback: "Copied" on the button + `aria-live` "Copied to clipboard"; failure says
  "Copy failed — select the text instead".
- Avoid hard-coded skill counts other than the synced core count (version-sync check).

## Anti-patterns (banned)
Centered-everything heroes, identical card grids, emoji icons, curvy/diagonal connectors,
floating unlabeled annotations, accent on more than two diagram nodes, pure `#000`/`#fff` tokens.

## Pre-delivery checklist — #serve (verified from renders, Nov 2026)
- [x] Contrast computed on rendered pairs: SVG sub/mono 5.1 (light) / 6.1 (dark); eyebrow 5.0 / 7.3; wires 3.6 / 4.2.
- [x] Focus-visible ring on tabs, copy buttons, pause button, CTA.
- [x] Tabs: roving tabindex, Arrow/Home/End, `aria-controls`, hidden panels.
- [x] Icon-only buttons have `aria-label`.
- [x] Reduce path exercised in headless Chrome (packets `display: none`).
- [x] Light + dark themes.
- [x] Responsive at 375 / 390 / 768 / 1024 / 1440 — no horizontal overflow from this section.
- [x] No lorem; real commands only.

## UI spec — #serve section
1. Head (split 1.7fr / 1fr): eyebrow pill, h2, lead | three facts with icon tiles.
2. Map (`figure[data-sv-map]`): caption sentence + pause button; wide SVG (≥901px, 3 zones
   left→right) or tall SVG (≤900px, top→bottom).
3. Steps: 3-step rail (horizontal ≥901px, vertical ≤900px), each with a copyable command.
4. Duo: terminal mock (`role="img"`) | connect tabs (Grok Bot, Claude Code, Grok Build, Codex, Cursor, Gemini).
5. Agent card: "Or let your agent do all of it" + SSH commands.
6. CTA: guide link + note + `aria-live` region.

### Unwired elements
None — every button has a handler (tabs, copy, pause) and every link has a real target.

## 6-pillar visual audit — #serve
| Pillar | Score | Notes |
|---|---|---|
| Copy | 3 | Direct dev-tools voice, real commands, copy/failure microcopy |
| Visuals | 3 | Phosphor sprite, orthogonal 3-zone diagram, tier markers; no illustration |
| Color | 4 | Semantic tokens, oklch tier hues, both themes, computed contrast |
| Typography | 3 | Display/body/mono hierarchy, ≥14px rendered meta |
| Spacing | 3 | 8px rhythm, consistent 24px gutters |
| UX | 3 | Keyboard tabs, copy feedback, pause control, reduced motion |
| **Total** | **19/24** | PASS. Backlog: animated tab-panel transition, illustration for the agent card |
