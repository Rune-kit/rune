---
name: "@rune/ui"
description: Frontend UI patterns — React health scoring, Core Web Vitals auditing, design systems, color palettes, typography, component architecture, landing page sections, accessibility audits, animation patterns, and design decision mapping.
metadata:
  author: runedev
  version: "0.3.0"
  layer: L4
  price: "$12"
  target: Frontend developers
---

# @rune/ui

## Purpose

Frontend development accumulates invisible debt: ad-hoc color variables, mismatched font pairings, prop-drilled components, untested accessibility, janky animations, React anti-patterns, and slow page loads — all before you even decide what the product should *look* like. This pack addresses all layers systematically. Ten skills cover the full UI lifecycle: React codebase health scoring, Core Web Vitals performance auditing, token consistency, color palette selection, typography pairing, component composability, landing page structure, design-domain mapping, WCAG compliance, and motion polish. Run any skill independently or chain all ten as a comprehensive UI health check + design foundation generator.

**Anti-AI Design Contract** (enforced by all skills in this pack):
- NO gradient blob heroes (purple → pink → blue)
- NO default indigo/violet (#6366f1) unless it IS the brand color
- NO Lucide icons — use Phosphor Icons (`@phosphor-icons/react`) or Huge Icons
- NO uniform card grids — vary sizes, establish visual hierarchy
- NO centered hero formula (big title + subtitle + 2 buttons stacked)

## Triggers

- Auto-trigger: when `*.tsx`, `*.svelte`, `*.vue`, CSS/Tailwind files detected in project
- `/rune design-system` — generate or enforce design tokens
- `/rune palette-picker` — select a curated color palette by product type
- `/rune type-system` — select a typography pairing by product tone
- `/rune component-patterns` — refactor component architecture
- `/rune landing-patterns` — generate landing page section structure
- `/rune design-decision` — map product domain to full style recommendation
- `/rune a11y-audit` — run accessibility audit
- `/rune animation-patterns` — add or refine motion design
- `/rune react-health` — score React codebase health (0-100)
- `/rune web-vitals` — audit Core Web Vitals and performance
- Called by `cook` (L1) when frontend task is detected
- Called by `review` (L2) when UI code is under review
- Called by `design` (L2) when visual design decisions needed

## Skills Included

---

### react-health

React codebase health scoring — 0-100 health score across 6 dimensions: state management, effects hygiene, performance patterns, architecture, bundle efficiency, and accessibility. Detects anti-patterns that automated linters miss, quantifies technical debt, and produces a prioritized fix list.

#### Workflow

**Step 1 — Detect framework and React version**
Read `package.json` to identify: React version (17/18/19), framework (Next.js, Vite, Remix, Astro), compiler status (`react-compiler` or `babel-plugin-react-compiler`), and styling approach (Tailwind, CSS Modules, styled-components). Framework context changes which rules apply — Next.js has App Router-specific patterns, Vite has different chunking strategies.

**Step 2 — State and effects audit**
Use Grep to scan for these anti-patterns across all `*.tsx`, `*.jsx` files:

| Anti-Pattern | Grep Pattern | Why It's Bad |
|---|---|---|
| Derived state in useState | `useState.*=.*props\.` or `useEffect.*setState` that mirrors a prop | Causes sync bugs — compute during render instead |
| Unnecessary effects for data transform | `useEffect.*setState.*filter\|map\|reduce` | Runs after render for no reason — move to useMemo or compute inline |
| Missing cleanup in effects | `useEffect` without `return () =>` when subscribing | Memory leaks on unmount (WebSocket, intervals, event listeners) |
| State for ref-appropriate values | `useState` tracking DOM measurements, timers, previous values | Causes unnecessary re-renders — use useRef |
| Prop drilling > 3 levels | Component chains passing the same prop through 3+ files | Extract to Context or Zustand store |
| God component > 300 lines | Component files exceeding 300 LOC | Split into composed smaller components |

Score: count violations, weight by severity (critical=5, high=3, medium=1), calculate percentage against total component count.

**Step 3 — Dead code detection**
Scan for unused exports, orphaned files, and dead types:
- **Unused exports**: Use Grep to find all `export` declarations, then cross-reference with import statements across the codebase. Any export not imported anywhere (excluding entry points and barrel files) is dead.
- **Orphan files**: Use Glob to find all `.tsx`/`.ts` files, then check which are never imported. Exclude test files, config files, and entry points.
- **Duplicate components**: Find components with similar names or identical prop interfaces that could be consolidated.
- **Barrel file bloat**: Flag `index.ts` files that re-export everything — these break tree-shaking and increase bundle size.

**Step 4 — Bundle efficiency audit**
Check for common bundle bloat patterns:
- **Wholesale imports**: `import _ from 'lodash'` instead of `import groupBy from 'lodash/groupBy'` — can add 70KB+ to bundle
- **Moment.js usage**: Flag any `import moment` — suggest `date-fns` or `dayjs` (moment is 300KB with locales)
- **Icon library imports**: `import { Icon } from 'react-icons'` importing the full set — use specific pack imports
- **Missing dynamic imports**: Large components (charts, editors, modals) loaded eagerly — should use `React.lazy()` or Next.js `dynamic()`
- **Polyfill sprawl**: Check `browserslist` or `@babel/preset-env` targets — modern-only targets can drop 20-50KB of polyfills
- **CSS-in-JS runtime cost**: Flag `styled-components` or `@emotion/styled` in performance-critical paths — suggest extraction or Tailwind

**Step 5 — Performance patterns check**
Scan for React-specific performance issues:
- `React.memo` wrapping components that receive new object/array literals as props (memo is useless with `style={{}}` or `data={[...]}}`)
- Missing `key` prop on list items, or using array index as key on dynamic lists
- Inline function creation in JSX (`onClick={() => fn(id)}`) inside large lists (>50 items) without `useCallback`
- `useEffect` with missing dependencies (lint-suppressed with `// eslint-disable-next-line`)
- Context providers wrapping the entire app when only a subtree needs them (causes full-app re-renders)
- Unvirtualized lists rendering >50 items — flag for `@tanstack/react-virtual` or `react-window`

**Step 6 — Generate health report**
Produce a structured health report with scores:

```
React Health Report — [Project Name]
═══════════════════════════════════════
Overall Score: 72/100 (Needs work)

Dimension          Score   Issues Found
─────────────────────────────────────
State/Effects      65/100  3 derived states, 2 missing cleanups
Performance        78/100  1 unvirtualized list, barrel file bloat
Architecture       80/100  1 god component (412 lines)
Bundle Efficiency  60/100  lodash wholesale import, no dynamic imports
Dead Code          85/100  4 unused exports, 1 orphan file
Accessibility      70/100  6 icon buttons missing aria-label

Score Tiers: 75+ Great │ 50-74 Needs Work │ <50 Critical

Top 5 Fixes (by impact):
1. [CRITICAL] Replace lodash wholesale import → save ~70KB
2. [HIGH] Add React.lazy() to ChartPanel and RichEditor
3. [HIGH] Extract derived state from useEffect in UserList
4. [MEDIUM] Virtualize TransactionTable (renders 200+ rows)
5. [MEDIUM] Remove 4 unused exports in utils/
```

#### Sharp Edges

| Failure Mode | Mitigation |
|---|---|
| False positives on "unused exports" in library packages | Exclude files matching `package.json` `main`/`exports` entry points |
| Barrel file detection flags intentional public API re-exports | Only flag barrel files in `src/` not in package root |
| God component count includes generated files | Exclude files matching `*.generated.*`, `*.auto.*` patterns |

---

### web-vitals

Core Web Vitals performance audit — measures LCP, CLS, FCP, TBT, INP, and Speed Index against Google thresholds. Identifies render-blocking resources, network dependency chains, layout shift culprits, missing preloads, caching gaps, and tree-shaking opportunities. Framework-aware analysis for Next.js, Vite, SvelteKit, and Astro.

#### Workflow

**Step 1 — Detect build tooling and framework**
Read `package.json`, config files (`next.config.*`, `vite.config.*`, `svelte.config.*`, `astro.config.*`), and build scripts. Identify:
- Bundler: Webpack, Vite, Rollup, esbuild, Turbopack
- Framework: Next.js (App Router vs Pages), SvelteKit, Astro, Remix
- CSS strategy: Tailwind (content config), CSS Modules, global CSS
- Compression: gzip/brotli configuration
- Source maps: enabled in production? (should be external or disabled)

**Step 2 — Audit render-blocking resources**
Use Grep to scan HTML entry points and framework layouts for:
- `<link rel="stylesheet">` in `<head>` without `media` attribute — blocks first paint
- `<script>` tags without `async` or `defer` — blocks HTML parsing
- CSS `@import` chains — each import is a sequential network request
- Large inline `<style>` blocks (>50KB) — delays first paint

For each blocking resource, estimate impact: 0ms impact = note but don't prioritize. Focus on resources that delay FCP by >100ms.

**Step 3 — Analyze layout shift sources (CLS)**
Use Grep to find common CLS culprits:
- `<img>` and `<video>` without explicit `width` and `height` attributes — causes layout shift when media loads
- Dynamic content injection above the fold (`insertBefore`, `prepend`, or React `useState` toggling visibility)
- Web fonts without `font-display: swap` or `font-display: optional` — FOIT causes text layout shift
- Ads or embeds without reserved space (`aspect-ratio` or `min-height` on container)
- CSS animations that trigger layout (`top`, `left`, `width`, `height`) instead of composited properties (`transform`, `opacity`)

#### CLS Fix Patterns

```html
<!-- BEFORE: no dimensions → layout shift when image loads -->
<img src="/hero.jpg" alt="Hero" />

<!-- AFTER: explicit dimensions prevent CLS -->
<img src="/hero.jpg" alt="Hero" width="1200" height="630"
     class="w-full h-auto" loading="lazy" decoding="async" />
```

```css
/* Font display — prevent FOIT layout shift */
@font-face {
  font-family: 'Space Grotesk';
  src: url('/fonts/space-grotesk.woff2') format('woff2');
  font-display: swap; /* show fallback immediately, swap when loaded */
}

/* Reserve space for dynamic content */
.ad-container {
  min-height: 250px; /* match ad unit height */
  contain: layout;   /* prevent layout influence on siblings */
}
```

**Step 4 — Network dependency chain analysis**
Identify critical rendering path bottlenecks:
- **Waterfall chains**: Resource A loads → discovers Resource B → discovers Resource C. Each link adds latency. Fix with `<link rel="preload">` for critical assets.
- **Missing preconnects**: Third-party origins (fonts.googleapis.com, CDN, analytics) without `<link rel="preconnect">`. But verify the origin is actually used — unused preconnects waste connection resources.
- **Large payloads without compression**: JS/CSS bundles >100KB served without gzip/brotli. Check server response headers for `Content-Encoding`.
- **Duplicate requests**: Same resource fetched multiple times (common with CSS @import or uncoordinated dynamic imports).

```html
<!-- Preload critical resources discovered late in the waterfall -->
<link rel="preload" href="/fonts/inter-var.woff2" as="font"
      type="font/woff2" crossorigin />
<link rel="preload" href="/hero-image.webp" as="image"
      fetchpriority="high" />

<!-- Preconnect to third-party origins ACTUALLY used -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
```

**Step 5 — Tree-shaking and code splitting audit**
Check bundler configuration and import patterns:

| Issue | Detection | Fix |
|---|---|---|
| Barrel file re-exports break tree-shaking | `index.ts` with `export * from` or `export { A, B, C, ... }` importing everything | Import directly from source: `import { Button } from './Button'` not `from '.'` |
| `sideEffects: false` missing in package.json | Check `package.json` `sideEffects` field | Add `"sideEffects": false` (or list files with side effects like CSS imports) |
| No code splitting at route level | Framework routes without `React.lazy()` or `dynamic()` | Next.js does this automatically; Vite needs manual `React.lazy()` |
| Vendor chunk too large (>250KB) | Check build output for single large chunk | Configure `splitChunks` (Webpack) or `manualChunks` (Vite/Rollup) |
| CSS not purged | Tailwind without `content` config, or unused CSS classes shipping | Verify `tailwind.config.js` `content` paths cover all template files |

**Step 6 — Image optimization audit**
Scan for image-related performance issues:
- Serving JPEG/PNG when WebP/AVIF would save 30-60% bandwidth — check `<img>` `src` extensions
- Missing `loading="lazy"` on below-the-fold images
- Missing `fetchpriority="high"` on LCP image (hero image, above-the-fold banner)
- Images served at full resolution without responsive `srcset` — wastes bandwidth on mobile
- No `<picture>` element for art direction (different crops for mobile/desktop)

```html
<!-- Optimized responsive image with modern formats -->
<picture>
  <source srcset="/hero.avif" type="image/avif" />
  <source srcset="/hero.webp" type="image/webp" />
  <img
    src="/hero.jpg"
    alt="Product dashboard showing real-time analytics"
    width="1200" height="630"
    class="w-full h-auto"
    fetchpriority="high"
    decoding="async"
  />
</picture>

<!-- Below-the-fold: lazy load -->
<img src="/feature.webp" alt="..." loading="lazy" decoding="async"
     width="600" height="400" class="w-full h-auto" />
```

**Step 7 — Generate performance report**
Produce a structured report with Core Web Vitals thresholds:

```
Web Vitals Audit — [Project Name]
═══════════════════════════════════════
Thresholds (Good / Needs Improvement / Poor):
  LCP:  < 2.5s  / < 4.0s  / > 4.0s
  FCP:  < 1.8s  / < 3.0s  / > 3.0s
  CLS:  < 0.1   / < 0.25  / > 0.25
  INP:  < 200ms / < 500ms / > 500ms
  TBT:  < 200ms / < 600ms / > 600ms
  TTFB: < 800ms / < 1.8s  / > 1.8s

Top Issues (by estimated impact):
1. [HIGH] Hero image served as 2.4MB PNG — convert to WebP, save ~1.5MB
2. [HIGH] 3 render-blocking stylesheets in <head> — defer non-critical CSS
3. [MEDIUM] 4 images missing width/height — causes CLS on load
4. [MEDIUM] lodash imported wholesale — tree-shake or replace with lodash-es
5. [LOW] Font preconnect to unused origin — remove to free connection slot
```

#### Sharp Edges

| Failure Mode | Mitigation |
|---|---|
| Recommending image lazy-load on LCP element | Never lazy-load the LCP image — it must load eagerly with `fetchpriority="high"` |
| Flagging render-blocking CSS that's actually critical | Distinguish critical (above-fold) CSS from non-critical before recommending defer |
| Tree-shaking audit false positives on CSS-in-JS | CSS `import './styles.css'` is a side effect — don't flag as unused |
| Preconnect removal breaks actual resource loading | Always verify zero requests went to the origin before recommending removal |

---

### design-system

Generate and enforce design system tokens — colors, typography, spacing, shadows, border radius. Detects existing ad-hoc values and consolidates them into a structured token file with full dark/light theme support.

#### Workflow

**Step 1 — Detect existing tokens**
Use Grep to scan for hardcoded color values (`#[0-9a-fA-F]{3,6}`, `rgb(`, `hsl(`), spacing (`px`, `rem`), and font sizes across all CSS, Tailwind config, and component files. Build an inventory of values in use.

**Step 2 — Generate token file**
From the inventory, produce a CSS custom properties file (or `tailwind.config` theme extension). Group tokens into semantic layers: primitive → semantic → component. Flag duplicates and near-duplicates (e.g., `#1a1a2e` vs `#1a1a2f`).

**Step 3 — Enforce consistency**
Re-run Grep after token file is written. Any hardcoded value that has a matching token is flagged as a violation. Output a replacement diff for each violation.

**Step 4 — Dark/light theme toggle**
Emit a `[data-theme]`-based theme switcher. Semantic tokens point to different primitives per theme. No JavaScript duplication — CSS handles the switch; JS only toggles the attribute.

#### Example

```css
/* tokens.css — generated by design-system skill */
:root,
[data-theme="light"] {
  /* Primitive */
  --color-slate-950: #020617;
  --color-slate-900: #0f172a;
  --color-slate-100: #f1f5f9;
  --color-emerald-500: #10b981;
  --space-4: 1rem;
  --radius-md: 0.5rem;

  /* Semantic */
  --bg-base:      var(--color-slate-100);
  --bg-card:      #ffffff;
  --text-primary: var(--color-slate-950);
  --color-primary: var(--color-emerald-500);
  --border-color: rgba(0, 0, 0, 0.1);
}

[data-theme="dark"] {
  --bg-base:      var(--color-slate-950);
  --bg-card:      var(--color-slate-900);
  --text-primary: #f8fafc;
  --color-primary: var(--color-emerald-500);
  --border-color: rgba(255, 255, 255, 0.08);
}
```

```ts
// theme-toggle.ts — minimal toggle, no flash on reload
const stored = localStorage.getItem('theme') ?? 'dark'
document.documentElement.setAttribute('data-theme', stored)

export function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('theme', next)
}
```

---

### palette-picker

Color palette database organized by product type. 25 curated palettes covering fintech, healthcare, education, gaming, ecommerce, SaaS, social, news/content, productivity, and developer tools — each with CSS custom properties, Tailwind config extension, dark/light variants, and colorblind-safe alternatives.

#### Workflow

**Step 1 — Detect product type**
Read `CLAUDE.md`, `README.md`, or ask: "What does this product do?" Classify into one of: fintech | healthcare | education | gaming | ecommerce | saas | social | news-content | productivity | devtools.

**Step 2 — Recommend palette**
Apply the decision tree below. Output the top 2 palette candidates with rationale (mood, contrast profile, brand signal).

**Step 3 — Generate token file**
Emit `palette.css` with CSS custom properties for the chosen palette. Include both dark and light variants. Include Tailwind `theme.extend.colors` block.

**Step 4 — Verify contrast ratios**
Run contrast checks: primary text on background (≥ 4.5:1), large headings (≥ 3:1), interactive elements on their backgrounds. Flag any failure. Substitute colorblind-safe alternative if requested.

#### Decision Tree

```
Product Type          → Palette Recommendation
─────────────────────────────────────────────────
fintech / trading     → Midnight Profit (dark bg + green/red signals)
healthcare            → Clean Clinic (white/teal, high readability)
education / kids      → Warm Academy (amber/orange, approachable)
gaming                → Neon Arena (dark + electric cyan/magenta)
ecommerce             → Trust Cart (white + amber CTA + forest green)
saas / dashboard      → Slate Precision (slate-900 + blue-500 accents)
social / community    → Gradient Social (slate + violet/fuchsia gradient)
news / content        → Neutral Ink (off-white + near-black, serif-ready)
productivity / tools  → Calm Focus (gray-50 + indigo-700, minimal noise)
developer tools       → Terminal Dark (zinc-950 + emerald-400 mono)
```

#### Palette Reference

```css
/* ── PALETTE: Midnight Profit (Fintech/Trading) ─────────────── */
[data-palette="midnight-profit"][data-theme="dark"] {
  --bg-base:        #0c1419;
  --bg-card:        #121a20;
  --bg-elevated:    #1a2332;
  --text-primary:   #ffffff;
  --text-secondary: #a0aeb8;
  --border:         #2a3f52;
  --profit:         #00d084;   /* green — gains */
  --loss:           #ff6b6b;   /* red — losses */
  --accent:         #2196f3;
  /* Colorblind (deuteranopia): profit→#1e88e5, loss→#ffa726 */
}
[data-palette="midnight-profit"][data-theme="light"] {
  --bg-base:        #faf8f3;
  --bg-card:        #f5f0ea;
  --text-primary:   #0c1419;
  --text-secondary: #4a5568;
  --border:         #d1cfc9;
  --profit:         #059669;
  --loss:           #dc2626;
  --accent:         #1d4ed8;
}

/* ── PALETTE: Clean Clinic (Healthcare) ─────────────────────── */
[data-palette="clean-clinic"] {
  --bg-base:        #f0fafa;
  --bg-card:        #ffffff;
  --text-primary:   #0d1f2d;
  --text-secondary: #4b6070;
  --border:         #c7e8ea;
  --primary:        #0891b2;   /* cyan-600 */
  --secondary:      #0d9488;   /* teal-600 */
  --accent:         #06b6d4;
  --danger:         #ef4444;
  --success:        #16a34a;
}

/* ── PALETTE: Slate Precision (SaaS/Dashboard) ───────────────── */
[data-palette="slate-precision"][data-theme="dark"] {
  --bg-base:        #0f172a;
  --bg-card:        #1e293b;
  --bg-elevated:    #334155;
  --text-primary:   #f8fafc;
  --text-secondary: #94a3b8;
  --primary:        #3b82f6;   /* blue-500 */
  --success:        #10b981;
  --danger:         #ef4444;
  --warning:        #f59e0b;
}
[data-palette="slate-precision"][data-theme="light"] {
  --bg-base:        #ffffff;
  --bg-card:        #f8fafc;
  --bg-elevated:    #f1f5f9;
  --text-primary:   #0f172a;
  --text-secondary: #475569;
  --primary:        #2563eb;
}

/* ── PALETTE: Neon Arena (Gaming) ────────────────────────────── */
[data-palette="neon-arena"] {
  --bg-base:        #080c10;
  --bg-card:        #0f1520;
  --text-primary:   #e8f4f8;
  --text-secondary: #7a9ab0;
  --primary:        #00ffe0;   /* electric cyan */
  --secondary:      #ff2d78;   /* hot magenta */
  --accent:         #ffe600;   /* warning yellow */
  --border:         rgba(0, 255, 224, 0.15);
}

/* ── PALETTE: Trust Cart (Ecommerce) ─────────────────────────── */
[data-palette="trust-cart"][data-theme="light"] {
  --bg-base:        #ffffff;
  --bg-card:        #fafafa;
  --text-primary:   #111827;
  --text-secondary: #6b7280;
  --cta:            #f97316;   /* orange-500 — add-to-cart */
  --success:        #16a34a;   /* forest green — in stock */
  --trust:          #1d4ed8;   /* blue — secure badge */
  --border:         #e5e7eb;
}

/* ── PALETTE: Terminal Dark (Developer Tools) ────────────────── */
[data-palette="terminal-dark"] {
  --bg-base:        #09090b;   /* zinc-950 */
  --bg-card:        #18181b;   /* zinc-900 */
  --bg-elevated:    #27272a;   /* zinc-800 */
  --text-primary:   #fafafa;
  --text-secondary: #a1a1aa;
  --primary:        #34d399;   /* emerald-400 — code green */
  --accent:         #818cf8;   /* indigo-400 — links */
  --border:         #3f3f46;
  --comment:        #71717a;
}
```

```js
// tailwind.config.js — extending with palette tokens
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        profit:  'var(--profit)',
        loss:    'var(--loss)',
        primary: 'var(--primary)',
        'bg-base':  'var(--bg-base)',
        'bg-card':  'var(--bg-card)',
        'text-primary':   'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
      }
    }
  }
}
```

---

### type-system

Typography pairing database — 22 font pairings organized by product vibe. Each pairing includes Google Fonts URL, Tailwind config, size scale from display to caption, weight mapping, and line height ratios. Decision tree maps product type and tone to the right pairing.

#### Workflow

**Step 1 — Detect product tone**
Read `CLAUDE.md` or ask: "What is the product tone?" Classify: modern-tech | editorial | playful | corporate | developer | luxury | humanist | brutalist | minimal.

**Step 2 — Recommend pairing**
Apply the decision tree. Output the top 2 pairings with rationale (brand signal, readability score, Google Fonts load weight).

**Step 3 — Generate @font-face / config**
Emit the `<link>` preconnect + stylesheet tag for Google Fonts. Emit Tailwind `fontFamily` config. Emit a CSS type scale (`--text-display` through `--text-caption`).

**Step 4 — Verify readability**
Check: body size ≥ 14px, line-height ≥ 1.5 for body, ≤ 1.25 for headings. Flag any contrast failure using the project's background token.

#### Decision Tree

```
Product Tone          → Pairing
──────────────────────────────────────────────────────────
modern tech / saas    → Space Grotesk + Inter
editorial / blog      → Playfair Display + Source Serif 4
playful / kids / app  → Fredoka + Nunito
corporate / enterprise→ IBM Plex Sans + IBM Plex Serif
developer tools / CLI → JetBrains Mono + Inter
luxury / fashion      → Cormorant Garamond + Montserrat
humanist / health     → DM Sans + DM Serif Display
brutalist / bold      → Bebas Neue + IBM Plex Mono
minimal / productivity→ Inter + Inter (weight-only hierarchy)
gaming / esports      → Rajdhani + Exo 2
```

#### Pairing Reference

```html
<!-- Space Grotesk + Inter (modern-tech / saas) -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

<!-- Playfair Display + Source Serif 4 (editorial) -->
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Source+Serif+4:wght@400;600&display=swap" rel="stylesheet">

<!-- Fredoka + Nunito (playful) -->
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&family=Nunito:wght@400;600&display=swap" rel="stylesheet">

<!-- IBM Plex Sans + IBM Plex Serif (corporate) -->
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Serif:wght@400;600&display=swap" rel="stylesheet">

<!-- JetBrains Mono + Inter (developer tools) -->
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

<!-- Cormorant Garamond + Montserrat (luxury) -->
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,400&family=Montserrat:wght@400;500;700&display=swap" rel="stylesheet">

<!-- DM Sans + DM Serif Display (humanist / health) -->
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display&display=swap" rel="stylesheet">
```

```css
/* Type scale — Space Grotesk + Inter pairing */
:root {
  --font-display:  'Space Grotesk', system-ui, sans-serif;
  --font-body:     'Inter', system-ui, sans-serif;
  --font-mono:     'JetBrains Mono', monospace;

  /* Scale */
  --text-display:  clamp(2.5rem, 5vw, 4.5rem); /* 40–72px */
  --text-h1:       clamp(2rem,   4vw, 2.5rem);  /* 32–40px */
  --text-h2:       clamp(1.375rem, 2.5vw, 1.75rem); /* 22–28px */
  --text-h3:       1.125rem;  /* 18px */
  --text-body:     1rem;      /* 16px */
  --text-small:    0.875rem;  /* 14px */
  --text-caption:  0.75rem;   /* 12px */

  /* Leading */
  --leading-tight:  1.2;
  --leading-snug:   1.35;
  --leading-normal: 1.5;
  --leading-relaxed:1.75;
}

h1, h2, h3 { font-family: var(--font-display); line-height: var(--leading-tight); }
body        { font-family: var(--font-body);    line-height: var(--leading-normal); }
code, pre   { font-family: var(--font-mono); }

/* Financial numbers — always mono + bold */
.number, .price, .stat {
  font-family: var(--font-mono);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
```

```js
// tailwind.config.js — font pairing extension
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        body:    ['Inter',         'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono','monospace'],
      },
      fontSize: {
        'display': ['clamp(2.5rem, 5vw, 4.5rem)', { lineHeight: '1.1' }],
        'h1':      ['clamp(2rem, 4vw, 2.5rem)',   { lineHeight: '1.2' }],
        'h2':      ['1.75rem',  { lineHeight: '1.3' }],
        'h3':      ['1.125rem', { lineHeight: '1.4' }],
      }
    }
  }
}
```

---

### landing-patterns

Landing page section patterns — 12 section archetypes with HTML structure hints, Tailwind classes, responsive rules, and conversion-focused copy guidance. Anti-AI design rules enforced throughout.

#### Workflow

**Step 1 — Identify page goal**
Classify: acquisition (email capture / waitlist) | conversion (paid plan) | brand (awareness) | product (feature showcase). Goal determines section priority and CTA placement.

**Step 2 — Select section sequence**
From the section library below, compose a sequence. Recommended base: Hero → Social Proof → Features → How It Works → Testimonials → Pricing → FAQ → CTA Footer. Adjust by goal.

**Step 3 — Apply style**
Pull palette from `palette-picker` and fonts from `type-system`. Apply Anti-AI design rules (see below). Each section gets a distinct visual treatment — do NOT apply the same background/card style to every section.

**Step 4 — Responsive audit**
Every section must work at 375px (mobile), 768px (tablet), 1280px (desktop). Check text wrapping, CTA tap targets (≥ 44px), and image aspect ratios.

**Step 5 — Conversion check**
Verify: primary CTA visible above the fold; social proof within first 2 sections; pricing section has a clear default/recommended plan; FAQ addresses the top 3 objections.

#### Section Library

```
Hero Variants:
  split-hero         Left text + right image/video. NOT centered formula.
  asymmetric-hero    60/40 split. Offset grid. Works for SaaS.
  cinematic-hero     Full-bleed video/image background. Text overlay. Gaming / brand.

Social Proof:
  logo-strip         Horizontal scrolling logos. Grayscale → color on hover.
  stats-bar          3–4 large numbers (e.g., "12,000+ teams"). Mono font.
  testimonial-grid   Asymmetric card sizes. NOT uniform grid.
  quote-hero         Single large pull-quote with avatar. Editorial feel.

Features:
  bento-grid         Mixed-size cards. Large hero card + smaller supporting.
  alternating-rows   Icon + text, alternating left/right. Classic but effective.
  feature-tabs       Tab navigation for feature groups. Reduces scroll length.

Conversion:
  pricing-toggle     Monthly / annual toggle. Recommended tier visually elevated.
  pricing-comparison Feature matrix table. Clear checkmarks, no feature bloat.
  cta-split          Left: value reminder. Right: form or button. High conversion.
  floating-cta       Sticky bar at bottom on mobile. Dismissable.

Discovery:
  faq-accordion      Expandable Q&A. Addresses objections in copy, not just features.
  how-it-works       3-step numbered sequence. Icon per step. Progress line optional.
  waitlist-capture   Email input + social proof count. ("Join 3,200 on waitlist")
```

#### Example — Split Hero (Anti-AI compliant)

```tsx
// ANTI-AI RULES APPLIED:
// ✅ Split layout — NOT centered hero formula
// ✅ Custom brand color — NOT default indigo/violet
// ✅ Phosphor Icons — NOT Lucide
// ✅ Asymmetric layout — NOT uniform sections
// ✅ No gradient blob

import { ArrowRight, CheckCircle } from '@phosphor-icons/react'

export function SplitHero() {
  return (
    <section className="min-h-screen grid lg:grid-cols-[1fr_1.2fr] items-center gap-0">
      {/* Left — copy */}
      <div className="px-8 py-20 lg:px-16 lg:py-0 max-w-xl">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)] mb-6">
          <CheckCircle weight="fill" size={16} aria-hidden="true" />
          Now in public beta
        </span>
        <h1 className="font-display text-h1 font-bold text-[var(--text-primary)] mb-6 leading-tight">
          Shipping fast starts<br />
          <em className="not-italic text-[var(--primary)]">before the sprint</em>
        </h1>
        <p className="text-[var(--text-secondary)] text-body leading-relaxed mb-8 max-w-md">
          Rune wires your AI coding assistant to a mesh of 55 skills so you spend time building, not prompting.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--primary)] text-white font-semibold text-sm hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
          >
            Get started free
            <ArrowRight size={16} aria-hidden="true" />
          </a>
          <a
            href="/docs"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-[var(--border)] text-[var(--text-primary)] font-semibold text-sm hover:bg-[var(--bg-card)] transition-colors"
          >
            Read the docs
          </a>
        </div>
      </div>

      {/* Right — visual (product screenshot or illustration) */}
      <div className="relative h-full min-h-[60vh] bg-[var(--bg-card)] overflow-hidden">
        {/* Replace with actual product screenshot */}
        <div className="absolute inset-0 flex items-center justify-center text-[var(--text-secondary)]">
          Product visual
        </div>
      </div>
    </section>
  )
}
```

#### Example — Bento Grid Features

```tsx
// Bento: asymmetric sizing breaks the uniform grid anti-pattern
export function BentoFeatures() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-display text-h2 font-semibold text-[var(--text-primary)] mb-12 text-center">
          One mesh. Every workflow.
        </h2>
        {/* Intentionally unequal grid — NOT uniform cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-[200px]">
          {/* Hero card — spans 2 cols × 2 rows */}
          <div className="col-span-2 row-span-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-8 flex flex-col justify-end">
            <p className="text-xs font-medium text-[var(--primary)] mb-2 uppercase tracking-wide">Orchestration</p>
            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">cook — your AI project manager</h3>
            <p className="text-sm text-[var(--text-secondary)]">Phases your work, delegates to the right skill, and escalates when stuck.</p>
          </div>
          {/* Small cards fill remaining cells */}
          <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-6 flex flex-col justify-between">
            <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">55 Skills</p>
            <p className="text-2xl font-bold font-mono text-[var(--text-primary)]">5 layers</p>
          </div>
          <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-6">
            <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2">Platforms</p>
            <p className="text-sm text-[var(--text-primary)]">Claude Code · Cursor · Windsurf · Antigravity</p>
          </div>
          <div className="col-span-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-6">
            <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2">Open source</p>
            <p className="text-sm text-[var(--text-primary)]">MIT license. Self-host or install in 30 seconds.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
```

---

### design-decision

Product domain → style mapping. Given a product category, outputs a complete design recommendation: visual style, palette, typography pairing, component aesthetic, and a `design-system.md` scaffold. Bridges the gap between "I need to build a UI" and "I know exactly what it should look like."

#### Workflow

**Step 1 — Classify product domain**
Read `CLAUDE.md`, `README.md`, or ask: "What problem does this product solve? Who uses it?" Map to one of the 9 domains below.

**Step 2 — Recommend style stack**
Apply the domain → style matrix. Output: visual style name, palette slug, typography pairing, component aesthetic, and 3 reference patterns to avoid ("do NOT do X").

**Step 3 — Generate design-system.md**
Emit a `design-system.md` file in the project root (or `.rune/`) with: color tokens (CSS custom properties), font pairing (Google Fonts link), spacing scale, component aesthetic rules, and anti-patterns for this domain.

#### Domain → Style Matrix

```
Domain            Style              Palette              Typography         Component Aesthetic
─────────────────────────────────────────────────────────────────────────────────────────────
Fintech/Trading   Dark + Precision   midnight-profit      Space Grotesk+Mono  Dense tables, data overlays
Healthcare        Clean + Calm       clean-clinic         DM Sans+DM Serif    Rounded, soft, spacious
Education         Warm + Friendly    warm-academy*        Fredoka+Nunito       Illustrated, playful cards
Gaming            Dark + Neon        neon-arena           Rajdhani+Exo 2      Hard edges, glow effects
Ecommerce         Trust + Focused    trust-cart           Inter+Inter          Product-first, clean CTA
SaaS/Dashboard    Precision + Flex   slate-precision      Space Grotesk+Inter  Data-dense, sidebar nav
Social/Community  Vibrant + Engaged  gradient-social*     Inter+Inter          Avatar-heavy, reaction UX
News/Content      Readable + Neutral neutral-ink*         Playfair+Source Serif Wide columns, drop caps
Productivity      Minimal + Calm     calm-focus*          Inter+Inter (weight) Almost no decoration
DevTools          Terminal + Crisp   terminal-dark        JetBrains Mono+Inter Code blocks, mono emphasis

* Palette not shown in palette-picker example block — generate with same CSS custom props pattern.
```

#### Style Characteristic Reference

```
glassmorphism    When: premium SaaS landing, dark bg hero. Avoid: dense data tables (illegible).
                 CSS: background: rgba(255,255,255,0.05); backdrop-filter: blur(12px);
                      border: 1px solid rgba(255,255,255,0.1); border-radius: 16px;

neubrutalism     When: bold brand statement, startup, creative tool. Avoid: healthcare, finance.
                 CSS: border: 2px solid #000; box-shadow: 4px 4px 0 #000;
                      background: #ffe600; (or other saturated fill)

claymorphism     When: education, kids, consumer apps. Avoid: enterprise, B2B data tools.
                 CSS: border-radius: 20px; box-shadow: 0 8px 0 rgba(0,0,0,0.15),
                      inset 0 -4px 0 rgba(0,0,0,0.1); (inflated, soft look)

aurora/gradient  When: landing page hero ONLY, used sparingly. AVOID as overall theme.
                 CSS: background: conic-gradient(from 180deg at 50% 50%, ...); opacity: 0.15;
                      (subtle, behind content — never the main visual)

flat/minimal     When: productivity, devtools, content. Best default for B2B SaaS.
                 CSS: No shadows except --shadow-sm. Single accent color. Whitespace-heavy.

dark-precision   When: fintech, devtools, monitoring. Default dark bg with high-contrast accents.
                 CSS: bg #0f172a or darker; mono fonts for data; green/red semantic signals.
```

#### Example — Generated design-system.md

```markdown
# Design System: [Product Name]

## Domain
SaaS Dashboard — B2B productivity tool for engineering teams

## Visual Style
Flat/Minimal with Slate Precision palette. Dark mode default.
Do NOT use gradient blobs, glassmorphism panels, or Lucide icons.

## Color Tokens
[→ See palette.css — generated by palette-picker, slate-precision]

## Typography
Pairing: Space Grotesk (headings, 600–700) + Inter (body, 400–500)
[→ See Google Fonts link in type-system output]

## Component Rules
- Cards: bg-card + border border-[var(--border)] + rounded-lg. NO drop shadows on cards.
- Buttons: primary = bg-primary text-white. ghost = border + transparent bg.
- Icons: Phosphor Icons only. Weight: regular for UI, fill for status indicators.
- Data tables: zebra stripe with bg-elevated on odd rows. Mono font for numbers.

## Anti-Patterns for This Domain
- No centered hero with 2-button CTA
- No gradient backgrounds
- No uniform card grid (vary card sizes by content importance)
```

---

### component-patterns

Component architecture patterns — compound components, render props, composition, slots. Detects prop-heavy components and guides refactoring toward composable, maintainable architectures.

#### Workflow

**Step 1 — Detect prop-heavy components**
Use Grep to find component signatures with more than 8 props (`interface \w+Props \{` then count fields, or scan function parameter lists). Read each flagged file to understand the component's responsibilities.

**Step 2 — Classify and suggest pattern**
For each flagged component, classify by smell: boolean-flag hell → compound component; render logic branching → render props or slots; deeply nested data → context + provider. Output a refactor plan with the specific pattern to apply.

**Step 3 — Emit refactored scaffold**
Write the refactored component skeleton following the compound component pattern. Do not overwrite the original — emit to a `*.refactored.tsx` file for review.

**Step 4 — Composition vs inheritance + slot patterns**
After structural refactor, audit for slot opportunities (Svelte `<slot>`, Vue `v-slot`, React `children` with typed slots). Enforce: prefer composition (pass components as props) over inheritance (extend base class). Flag any `extends React.Component` or class-based patterns for migration.

#### Example

```tsx
// BEFORE: prop-heavy (9 props, hard to extend)
<Modal title="..." open footer actions size variant onClose onConfirm loading />

// AFTER: compound component pattern
<Modal open onClose={handleClose}>
  <Modal.Header>Confirm Action</Modal.Header>
  <Modal.Body>Are you sure?</Modal.Body>
  <Modal.Footer>
    <Button variant="ghost" onClick={handleClose}>Cancel</Button>
    <Button variant="primary" loading={isLoading} onClick={handleConfirm}>
      Confirm
    </Button>
  </Modal.Footer>
</Modal>
```

```tsx
// Svelte slot pattern — composition over prop drilling
// Caller decides what goes in header/footer, component owns layout
<Card>
  <svelte:fragment slot="header">
    <h3 class="text-h3 font-semibold">Usage this month</h3>
  </svelte:fragment>

  <MetricChart data={usage} />

  <svelte:fragment slot="footer">
    <a href="/billing" class="text-sm text-[var(--primary)]">View invoice</a>
  </svelte:fragment>
</Card>
```

```tsx
// React typed children slots via discriminated union
type ModalSlot = { as: 'header' | 'body' | 'footer'; children: React.ReactNode }

function resolveSlots(children: React.ReactNode) {
  const slots: Record<string, React.ReactNode> = {}
  React.Children.forEach(children, (child) => {
    if (React.isValidElement<ModalSlot>(child) && child.props.as) {
      slots[child.props.as] = child.props.children
    }
  })
  return slots
}
```

---

### a11y-audit

Accessibility audit beyond automated tools. Checks WCAG 2.1 AA compliance — focus management, screen reader compatibility, color contrast, ARIA patterns, keyboard navigation, focus traps, and skip navigation.

#### Workflow

**Step 1 — Automated scan**
Run `Bash: npx axe-core-cli <url> --reporter json` to capture all automated violations. Parse the JSON output and group by impact: critical → serious → moderate → minor.

**Step 2 — Manual WCAG 2.1 AA review**
Use Grep to find `onClick` on non-button elements (missing keyboard support), `<img` without `alt`, `aria-label` absence on icon-only buttons, and `outline: none` without a focus-visible replacement. Read flagged files and annotate each violation with the WCAG criterion it breaks.

**Step 3 — Emit audit report**
Produce a structured report: automated violations (count by impact), manual violations (file + line + fix), contrast ratios for brand colors (pass/fail at AA). Include a prioritized fix list.

**Step 4 — Focus trap audit + skip nav**
Scan for `Dialog`, `Modal`, `Drawer`, `Popover` components. Verify each has: a focus trap on open (`focus-trap-react` or `aria-modal`), returns focus to trigger on close, has an `aria-labelledby` referencing its title. Also check: first `<a>` in `<body>` is a "Skip to main content" link visible on focus (WCAG 2.4.1).

#### Example

```tsx
// VIOLATION: icon button with no accessible name
<button onClick={handleClose}>
  <XIcon />
</button>

// FIX: add aria-label; icon is decorative
<button onClick={handleClose} aria-label="Close dialog">
  <XIcon aria-hidden="true" />
</button>

// VIOLATION: div acting as button (no keyboard, no role)
<div onClick={handleSubmit}>Submit</div>

// FIX: use semantic element
<button type="button" onClick={handleSubmit}>Submit</button>
```

```tsx
// Focus trap pattern for modals (using focus-trap-react)
import FocusTrap from 'focus-trap-react'

export function Dialog({ open, onClose, title, children }: DialogProps) {
  return open ? (
    <FocusTrap focusTrapOptions={{ onDeactivate: onClose }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        <div className="bg-[var(--bg-card)] rounded-xl p-6 max-w-md w-full shadow-lg">
          <h2 id="dialog-title" className="text-h3 font-semibold mb-4">{title}</h2>
          {children}
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="absolute top-4 right-4 focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <X aria-hidden="true" />
          </button>
        </div>
      </div>
    </FocusTrap>
  ) : null
}
```

```html
<!-- Skip navigation link — must be FIRST focusable element in <body> -->
<a
  href="#main-content"
  class="
    sr-only focus:not-sr-only
    fixed top-4 left-4 z-[9999]
    px-4 py-2 rounded-md
    bg-[var(--primary)] text-white font-semibold text-sm
    focus-visible:ring-2 focus-visible:ring-offset-2
  "
>
  Skip to main content
</a>
```

---

### animation-patterns

Motion design patterns — micro-interactions, page transitions, scroll animations, loading states. Applies CSS transitions, Framer Motion, or GSAP based on project stack. Always respects `prefers-reduced-motion`.

#### Workflow

**Step 1 — Detect interaction points**
Use Grep to find hover handlers (`onMouseEnter`, `:hover`), route changes (Next.js `useRouter`, SvelteKit `goto`), and loading states (`isLoading`, `isPending`). Read component files to understand where motion can add feedback or polish.

**Step 2 — Apply micro-interactions**
For each interaction point, select the appropriate pattern: hover → scale + shadow lift; button click → press-down (scale 0.97); data load → skeleton pulse then fade-in; route change → slide or fade transition. Emit the updated component with motion classes or Framer Motion variants.

**Step 3 — Audit reduced-motion compliance**
Use Grep to find every animation/transition declaration. Verify each is wrapped in a `prefers-reduced-motion: no-preference` media query or uses Framer Motion's `useReducedMotion()` hook. Flag any that are not.

**Step 4 — Page transition patterns**
Apply View Transitions API for same-document navigations (SvelteKit, Astro, vanilla JS). For React/Next.js, use Framer Motion `AnimatePresence` + `layoutId` for shared layout animations. Emit transition wrapper component with both strategies.

#### Example

```tsx
// Tailwind micro-interaction with reduced-motion respect
<button
  className="
    transform transition-all duration-200 ease-out
    hover:scale-105 hover:shadow-md
    active:scale-95
    motion-reduce:transform-none motion-reduce:transition-none
  "
>
  Confirm
</button>

// Framer Motion with reduced-motion hook
const prefersReduced = useReducedMotion()

<motion.div
  initial={{ opacity: 0, y: prefersReduced ? 0 : 16 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: prefersReduced ? 0 : 0.25 }}
/>
```

```tsx
// Shared layout animation — card expands to modal (Framer Motion)
// Works because both use the same layoutId="card-{id}"
function CardGrid({ items }: { items: Item[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <>
      {items.map((item) => (
        <motion.div
          key={item.id}
          layoutId={`card-${item.id}`}
          onClick={() => setSelected(item.id)}
          className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] cursor-pointer"
        >
          <motion.h3 layoutId={`title-${item.id}`}>{item.title}</motion.h3>
        </motion.div>
      ))}

      <AnimatePresence>
        {selected && (
          <motion.div
            layoutId={`card-${selected}`}
            className="fixed inset-8 z-50 rounded-2xl bg-[var(--bg-card)] p-8"
          >
            <motion.h3 layoutId={`title-${selected}`} className="text-h2 font-bold">
              {items.find(i => i.id === selected)?.title}
            </motion.h3>
            <button onClick={() => setSelected(null)} aria-label="Close">
              <X aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
```

```css
/* View Transitions API — SvelteKit / Astro page transitions */
/* In app.css or global stylesheet */
@media (prefers-reduced-motion: no-preference) {
  ::view-transition-old(root) {
    animation: 200ms ease-out both fade-out;
  }
  ::view-transition-new(root) {
    animation: 250ms ease-in both fade-in;
  }
}

@keyframes fade-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes fade-in  { from { opacity: 0; } to { opacity: 1; } }

/* SvelteKit: enable in svelte.config.js → experimental: { viewTransitions: true } */
```

---

## Connections

```
Calls → asset-creator (L3): generate design assets (icons, illustrations)
Calls → design (L2): escalate when full design review is needed
Calls → perf (L2): react-health and web-vitals feed findings to perf for deeper analysis
Calls → verification (L3): react-health triggers verification after fix application
Called By ← review (L2): when UI code is being reviewed
Called By ← cook (L1): when frontend task detected
Called By ← launch (L1): pre-launch UI quality gate
Called By ← scaffold (L1): when bootstrapping a new frontend project
Called By ← preflight (L2): react-health runs as pre-commit quality gate on React projects
design-decision → palette-picker: feeds palette slug to token generation
design-decision → type-system: feeds pairing name to font config generation
landing-patterns → palette-picker: pulls palette for section styling
landing-patterns → type-system: pulls font pairing for section copy
react-health → web-vitals: health report feeds into vitals audit for bundle-to-load correlation
web-vitals → react-health: slow LCP/TBT traces back to bundle bloat identified by react-health
```

## Tech Stack Support

| Framework    | Styling            | Components    | Motion              |
|--------------|--------------------|---------------|---------------------|
| React 19     | TailwindCSS 4      | shadcn/ui     | Framer Motion       |
| Next.js 16   | CSS Custom Props   | Radix UI      | Framer Motion       |
| SvelteKit 5  | CSS Custom Props   | Custom        | View Transitions API|
| Vue 3        | TailwindCSS 4      | Headless UI   | Vue Transitions     |
| Astro 5      | TailwindCSS 4      | Astro Islands | View Transitions API|

## Constraints

1. MUST respect `prefers-reduced-motion` on every animation — no exceptions.
2. MUST NOT overwrite original component files during refactor — emit to `*.refactored.tsx` or provide a diff.
3. MUST target WCAG 2.1 AA as the minimum bar for all a11y recommendations (AAA where feasible).
4. MUST use project's existing stack (detect from `package.json`) before suggesting new dependencies.
5. MUST enforce Anti-AI design rules: no gradient blobs, no default indigo, Phosphor Icons not Lucide, no uniform card grids.
6. MUST use Google Fonts CDN only for external font loading — no other external font services.
7. Color palettes MUST include colorblind-safe alternatives (deuteranopia minimum).

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Token generation produces semantic tokens without primitives, causing theme switching to break | HIGH | Always emit 3-layer token structure: primitive → semantic → component |
| Compound component refactor breaks controlled state (open/value props lost) | HIGH | Audit for controlled vs uncontrolled patterns before emitting scaffold |
| axe-core misses ARIA live region issues and dynamic content violations | MEDIUM | Supplement automated scan with manual Grep for `setState`/store updates that modify visible content |
| Framer Motion animations ship without `useReducedMotion` check | HIGH | Grep for `motion.` usage post-edit; flag any missing the hook |
| Design token enforcement flags third-party library hardcoded values | LOW | Scope Grep to `src/` only; exclude `node_modules` and generated files |
| palette-picker recommends palette without contrast verification | HIGH | Always run contrast check in Step 4 before emitting palette.css |
| type-system recommends decorative font for body copy (Cormorant at 14px) | MEDIUM | Flag any pairing where body font is display/serif — warn readability at small sizes |
| landing-patterns emits centered hero formula (the anti-pattern) | HIGH | Enforce split-hero or asymmetric-hero as defaults; centered-hero requires explicit opt-in |
| design-decision recommends glassmorphism for data-dense dashboard | MEDIUM | Block glassmorphism recommendation when product domain is fintech, devtools, or productivity |
| Focus trap missing on modal — keyboard users trapped in page behind overlay | CRITICAL | a11y-audit Step 4 must scan all Dialog/Modal/Drawer/Popover components before audit closes |

## Done When

- React health score generated (0-100) with per-dimension breakdown; top 5 fixes listed by impact; dead code inventory complete
- Web Vitals report produced with all 6 metrics against thresholds; render-blocking resources identified; CLS culprits found; image optimization recommendations emitted
- Token file generated with 3-layer structure; hardcoded values replaced or flagged with diffs; dark/light theme switcher emitted
- Palette selected, CSS custom properties emitted, contrast ratios verified (≥ 4.5:1 body, ≥ 3:1 large text), colorblind alternatives noted
- Font pairing selected, Google Fonts link emitted, Tailwind fontFamily config emitted, type scale CSS variables written
- Component refactor scaffold emitted; original files untouched; slot patterns applied where applicable
- Landing section sequence composed; Anti-AI rules verified; responsive audit at 375/768/1280px complete; conversion checklist passed
- Design system .md generated with color, typography, component, and anti-pattern rules for the product domain
- Axe-core scan shows zero critical/serious violations; focus trap audit complete; skip nav link present
- All animations pass `prefers-reduced-motion` audit; page transition pattern implemented

## Cost Profile

~24,000–38,000 tokens per full pack run (all 10 skills). Individual skill: ~2,000–5,000 tokens. Sonnet default. Use haiku for detection scans (Step 1 of each skill); escalate to sonnet for generation, refactoring, and report writing. Use `design-decision` first when starting a new project — it reduces token cost of subsequent skills by pre-scoping palette and typography choices.
