# Design Reference — Rune Baseline

Public design knowledge for the `design` skill. Universal best practices — not personal taste.

> **Override**: Users can create `~/.claude/docs/design-dna.md` to override any section with their own curated preferences. The design skill reads this file first if it exists, then falls back to this baseline.

---

## 1. Font Pairing Guide

Choose based on product domain. Avoid using a single font family for everything.

### Recommended Pairings

| Name | Headline | Body | Best For |
|------|----------|------|----------|
| **Tech Modern** | Space Grotesk 700 | Inter 400/500 | SaaS, Developer Tools, AI |
| **Financial Trust** | IBM Plex Sans 600 | IBM Plex Sans 400 | Banking, Insurance, Enterprise |
| **Startup Bold** | Satoshi 700 | DM Sans 400 | Startups, Products, Landing |
| **Editorial Clean** | Playfair Display 700 | Source Sans 3 400 | Blogs, Magazines, Portfolios |
| **Medical Clear** | Inter 600 | Inter 400 | Healthcare, Government, Accessibility-first |
| **E-commerce Warm** | DM Serif Display 400 | DM Sans 400 | Retail, Lifestyle, Fashion |
| **Gaming Bold** | Rajdhani 700 | Exo 2 400 | Gaming, Esports, Entertainment |
| **Data Dense** | Inter 600 | Inter 400 | Dashboards, Analytics, BI |

### Monospace Fonts (for numeric data)

| Font | Best For |
|------|----------|
| JetBrains Mono 700 | Financial data, prices, P&L, metrics |
| Fira Code 500 | Code blocks, terminal output |
| IBM Plex Mono 400 | Tables, technical documentation |

### Rules

- Financial numbers: **always** monospace + bold — prevents layout shift and signals precision
- Body text: minimum 14px, prefer 16px for readability
- Line height: 1.5 for body, 1.2 for headings
- Max content width: 720px for prose, 1280px for dashboards
- Heading scale ratio: ~1.25 (minor third) for dense UI, ~1.333 (perfect fourth) for marketing

---

## 2. Chart Type Selection

Match chart type to the data story, not to what looks fancy.

| Data Story | Chart Type | Notes |
|------------|-----------|-------|
| **Trend over time** | Line chart, Area chart | Area for volume, Line for precision |
| **Comparison** | Bar chart (vertical or horizontal) | Horizontal for long labels |
| **Part of whole** | Donut, Treemap | Donut for ≤6 segments, Treemap for hierarchical |
| **Distribution** | Histogram, Box plot | Box plot for comparing distributions |
| **Correlation** | Scatter plot | Always include a data table fallback for accessibility |
| **Ranking** | Horizontal bar | Sort by value, not alphabetically |
| **Flow/Process** | Sankey, Funnel | Funnel for conversion, Sankey for multi-path |
| **Geographic** | Choropleth map | Pair with data table (maps are hard to read precisely) |
| **Real-time** | Streaming line/area | Include pause button, auto-scroll, last-updated timestamp |
| **Financial** | Candlestick (OHLC) | Use dedicated charting lib (Lightweight Charts, TradingView) |
| **KPI/Metric** | Single number + sparkline | Large number, small contextual trend line |

### Chart Accessibility

- Never rely on color alone — use patterns, labels, or both
- Provide data table alternative for screen readers
- Minimum contrast between adjacent data series
- Include clear axis labels and units

### Recommended Libraries

| Platform | Library | Notes |
|----------|---------|-------|
| React | Recharts | Simple, composable, good defaults |
| React (advanced) | Nivo | D3-based, rich chart types |
| Financial | Lightweight Charts (TradingView) | Candlestick, real-time optimized |
| General web | Chart.js | Lightweight, canvas-based |
| Data-heavy | Observable Plot | Statistical charts, D3-based |

---

## 3. Component Architecture

Three-layer pattern prevents component bloat.

```
ui/           → Primitives (Button, Input, Dialog, Card, Badge, Avatar)
                No business logic. Props = visual variants only.
                Example: <Button variant="primary" size="md" />

components/   → Composed (PriceDisplay, UserCard, NotificationBell, SearchBar)
                Combines 2-5 primitives with light business logic.
                Example: <PriceDisplay value={42.50} currency="USD" change={+2.3} />

features/     → Page modules (DashboardOverview, SettingsPanel, CheckoutFlow)
                Full business logic, data fetching, state management.
                Never imported by ui/ or components/.
```

### Rules

- Primitives: <100 LOC, ≤5 props (not counting `className`)
- If a component has >8 boolean props → refactor to compound pattern
- If a component has >3 conditional renders → split into variants
- Features never import from other features (use shared components/ instead)

---

## 4. Color Fundamentals

Not specific palettes — principles for choosing colors.

### Semantic Color Roles

Every design system needs these 10 tokens minimum:

```
Background:  --bg-base, --bg-surface, --bg-elevated
Text:        --text-primary, --text-secondary
Border:      --border-default
Interactive: --accent (brand/primary action)
Status:      --success, --danger, --warning
```

### Domain-Specific Color Rules

| Domain | Key Rule |
|--------|----------|
| Finance/Trading | Profit/Loss colors are semantic signals, NOT brand. Reserve green/red exclusively for data meaning. |
| Healthcare | Red = clinical alert ONLY. Never decorative red. |
| E-commerce | CTA button must be highest-contrast element on page. |
| Developer Tools | Dark mode default. Accent colors should complement syntax highlighting, not clash. |
| AI/ML | Purple/violet is acceptable (established AI signal). Not elsewhere. |

### Contrast Requirements (WCAG 2.2 AA)

| Element | Minimum Ratio |
|---------|---------------|
| Normal text (<18px) | 4.5:1 |
| Large text (≥18px bold or ≥24px) | 3:1 |
| UI components (borders, icons) | 3:1 |
| Focus indicator | 3:1 against adjacent colors |

### Dark Mode Principles

- Don't just invert colors — adjust saturation (desaturate in dark mode)
- Surface elevation = lighter shade (not darker)
- Avoid pure white (#fff) text on dark — use #f0f0f0 or similar
- Test both modes — don't treat dark mode as afterthought

---

## 5. Spacing & Layout

### 8px Grid

```
xs: 4px   — tight inline spacing
sm: 8px   — default gap between related elements
md: 16px  — section padding, card padding
lg: 24px  — section gaps
xl: 32px  — major section breaks
2xl: 48px — page section spacing
3xl: 64px — hero/above-fold vertical rhythm
```

### Border Radius

```
sm: 6px   — inputs, small chips
md: 8px   — cards, containers
lg: 12px  — modals, large surfaces
xl: 16px  — hero cards, feature sections
full: 9999px — pills, avatars, circular buttons
```

### Responsive Breakpoints

```
sm:  640px   — mobile landscape
md:  768px   — tablet portrait
lg:  1024px  — tablet landscape / small desktop
xl:  1280px  — desktop
2xl: 1536px  — large desktop
```

- Design mobile-first (min-width media queries)
- Test at: 375px (iPhone SE), 768px, 1024px, 1440px
- Content max-width: 1280px (dashboard), 720px (prose)

---

## 6. Interaction Patterns

### Micro-Interactions (Universal)

| Trigger | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Hover on card | scale(1.02) + shadow lift | 200ms | ease-out |
| Button click | scale(0.97) | 100ms | ease-in |
| Page transition | fade + slide 8px | 200ms | ease |
| Data loading | Skeleton shimmer | loop | linear |
| Toast notification | slide-in from edge | 300ms | cubic-bezier(0.34, 1.56, 0.64, 1) |
| Modal open | fade bg + scale content from 0.95 | 200ms | ease-out |

### Real-Time Data UX

- Price/value updates: flash background color briefly (green up, red down, 600ms fade)
- Live indicator: pulsing green dot (CSS animation, not JS)
- Auto-updating lists: new items slide in from top, don't jump
- Always show "Last updated: X seconds ago" for stale data awareness
- Pause/resume button for streaming data

### Loading States

| Duration | Pattern |
|----------|---------|
| <300ms | No indicator (perceived as instant) |
| 300ms–2s | Skeleton loader or spinner |
| 2s–10s | Progress bar or step indicator |
| >10s | Progress + estimated time + cancel button |

### Form Patterns

- Inline validation (on blur, not on every keystroke)
- Disable submit button during async operation + show spinner
- Error messages below the field, not in alert dialogs
- Success: brief toast (3s auto-dismiss) — don't redirect immediately

---

## 7. UX Checklist

### Critical (Block Ship)

- [ ] Color contrast ≥ 4.5:1 for all text
- [ ] Focus-visible ring on ALL interactive elements (never `outline: none` alone)
- [ ] Touch targets ≥ 44×44px with 8px gap between targets
- [ ] `aria-label` on ALL icon-only buttons
- [ ] Every `<input>` has associated `<label>` or `aria-label`
- [ ] Semantic HTML (`<button>` not `<div onClick>`, `<nav>`, `<main>`, `<section>`)
- [ ] `aria-hidden="true"` on decorative icons/images
- [ ] `cursor-pointer` on all clickable non-button elements
- [ ] Don't convey information by color alone — add icon, text, or pattern

### High (Fix Before Launch)

- [ ] Empty state, error state, loading state for all async data
- [ ] Disable + spinner on async buttons (prevent double submit)
- [ ] Virtualize lists with >50 items (react-window, @tanstack/virtual)
- [ ] `prefers-reduced-motion` respected for all animations
- [ ] Dark mode support (or explicit documented reason why not)
- [ ] Responsive tested at 375px, 768px, 1024px, 1440px
- [ ] No layout shift on data load (reserve space with skeletons)
- [ ] Error messages are specific and actionable (not "Something went wrong")

### Medium (Polish)

- [ ] Skeleton loaders match actual content shape (not generic boxes)
- [ ] Hover states on all interactive elements
- [ ] Keyboard navigation works for all flows (Tab, Enter, Escape)
- [ ] Command palette (Cmd+K / Ctrl+K) for power users (SaaS/DevTools)
- [ ] Number count-up animation on KPI cards (first load only)
- [ ] Toast notifications positioned consistently (bottom-right recommended)
- [ ] Page titles update on navigation (`<title>` or document.title)

---

## 8. CSS Patterns

### Glassmorphism

```css
.glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
}
```

### Shadows

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);
```

### Animation Timing

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-slow: 350ms;
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 9. Number & Currency Formatting

```typescript
// Always use Intl.NumberFormat — never manual toFixed()
const fmtCurrency = (v: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2
  }).format(v)

const fmtCompact = (v: number) =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(v)

const fmtPercent = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2
  }).format(v / 100)
```

### Rules

- Financial values: always 2 decimal places, monospace font
- Large numbers: compact notation (1.2K, 3.4M) for display, full on hover
- Percentages: include sign (+2.34%, -1.50%)
- Variance coloring: positive = success color, negative = danger color
- Add directional icon alongside color: ▲ up, ▼ down (don't rely on color alone)

---

## 10. Anti-Pattern Signatures (AI-Generated UI)

These patterns signal "this was generated by AI, not designed by a human." Avoid them.

| Anti-Pattern | Why It Fails | Fix |
|-------------|-------------|-----|
| Purple-to-blue gradient hero | Default AI output, no design intent | Choose domain-appropriate palette |
| Card grid monotony | Every section is equal cards in a grid | Vary layout: hero → features → testimonials → CTA |
| Centered everything | Breaks left-to-right reading flow | Left-align body text, center only headings/CTAs |
| Inter-only typography | Zero personality, signals laziness | Use a pairing: display font + body font |
| Generic stock photos | Instantly recognizable as filler | Use illustrations, icons, or real screenshots |
| Animations on everything | Distracting, delays information access | Animate entry once, keep data static |
| Missing states | No empty, error, or loading states | Design all 4 states: default, loading, empty, error |
| Enormous padding | Wastes space, signals no content | Tighter spacing in data-dense UI, generous only in marketing |
| Rainbow status colors | Red, yellow, green, blue, purple all on one dashboard | Max 3 status colors per context |
| Fixed-width everything | Doesn't respond to viewport | Fluid widths, container queries where appropriate |
