---
name: design
description: Design system reasoning. Maps product domain to style, palette, typography, and platform-specific patterns. Generates .rune/design-system.md as the shared design contract for all UI-generating skills.
metadata:
  author: runedev
  version: "0.3.0"
  layer: L2
  model: sonnet
  group: creation
---

# design

## Purpose

Design system reasoning layer. Converts a product description into a concrete design system — style, color direction, typography pairing, platform conventions, and an explicit anti-pattern list for this domain. Writes `.rune/design-system.md` as the persistent design contract that all UI-generating skills read before producing code. Prevents AI-generated UI from defaulting to generic patterns ("purple accent, card grids, centered everything") that signal "not designed by a human."

## Triggers

- `/rune design` — manual invocation when starting a new UI project
- Called by `cook` (L1): frontend task detected, no `.rune/design-system.md` exists
- Called by `review` (L2): AI anti-pattern detected — recommended to run design skill
- Called by `perf` (L2): Lighthouse Accessibility BLOCK — design foundation may be missing

## Calls (outbound)

- `scout` (L2): detect existing design tokens, component library, platform targets
- `asset-creator` (L3): generate base visual assets (logo, OG image) from design system
- `review` (L2): accessibility violations found → flag for fix in next code review

## Called By (inbound)

- `cook` (L1): before any frontend code generation
- `review` (L2): when AI anti-pattern detected in diff
- `perf` (L2): when Lighthouse Accessibility score blocks
- User: `/rune design` direct invocation

## Output Files

```
.rune/
└── design-system.md    # Design contract for all UI-generating skills
```

## Executable Steps

### Step 0 — Load Design Reference

Load the design knowledge base before reasoning:

1. Check for user-level override: `~/.claude/docs/design-dna.md`
   - If exists → `Read` it. This is the primary reference (user's curated taste).
2. If no user override → `Read` the baseline: `skills/design/DESIGN-REFERENCE.md` (shipped with Rune)
3. The loaded reference provides: font pairings, chart selection, component architecture, color principles, UX checklist, interaction patterns, anti-pattern signatures
4. Apply reference knowledge throughout Steps 3-5 (domain reasoning, token generation, checklist)

> **Why two layers**: The baseline ships "good enough" universal design knowledge. Users who care about aesthetics create their own `design-dna.md` with curated palettes, font pairings, and style preferences. The design skill works well with either — it just works _better_ with a curated reference.

### Step 1 — Discover

Invoke `scout` to detect:
- **Platform target**: `web` | `ios` (SwiftUI) | `android` (Compose) | `react-native` | `multi-platform`
- **Existing design tokens**: check for `tokens.json`, `design-system/`, `theme.ts`, `tailwind.config.*`, `variables.css`
- **Component library in use**: shadcn/ui | Radix | MUI | Ant Design | custom | none
- **Framework**: Next.js | Vite+React | SvelteKit | Vue | SwiftUI | Jetpack Compose | other

If `.rune/design-system.md` already exists: Read it, check `Last Updated` date. If < 30 days old, ask user whether to refresh or keep. Do NOT silently overwrite.

### Step 2 — Classify Product Domain

From the user's task description + codebase context, classify product type:

| Category | Examples |
|----------|---------|
| **Trading/Fintech** | trading dashboard, portfolio tracker, payment app, crypto wallet |
| **SaaS Dashboard** | admin panel, analytics, CRM, project management |
| **Landing/Marketing** | landing page, product site, marketing page, waitlist |
| **Healthcare** | patient portal, medical dashboard, health tracker |
| **E-commerce** | product catalog, cart, checkout, marketplace |
| **Developer Tools** | IDE plugin, CLI dashboard, API explorer, devtool |
| **Creative/Portfolio** | portfolio, design showcase, art gallery, agency site |
| **Social/Community** | social feed, forum, messaging, community platform |
| **Mobile Consumer** | iOS/Android consumer app — entertainment, productivity, lifestyle |
| **AI-Native** | AI assistant interface, chatbot, model explorer |

If domain is unclear: ask one clarifying question — "Is this closer to X or Y?"

### Step 3 — Apply Domain Reasoning Rules

Map domain to design system parameters:

**Trading/Fintech:**
```
Style:       Data-Dense Dark
Palette:     Neutral dark (#0c1419 bg), semantic colors ONLY for profit/loss
             Profit: #00d084 (green) | Loss: #ff6b6b (red)
             Accent: #2196f3 (data highlight) — NOT purple
Typography:  JetBrains Mono 700 for ALL numeric values (prices, P&L, %)
             Inter 400 for labels, Inter 600 for headings
Effects:     Subtle grid lines, real-time pulse animations on live data
Anti-patterns:
  ❌ Gradient washes on data tables (obscures precision)
  ❌ Accent colors that conflict with profit/loss signal colors
  ❌ Decorative motion (distracts from live data)
  ❌ Dark-on-dark text for secondary labels (contrast required)
```

**SaaS Dashboard:**
```
Style:       Minimalism or Flat Design
Palette:     Professional neutrals, single brand accent (NOT purple unless brand)
             Light: #ffffff bg, #f8fafc surface | Dark: #0f172a bg, #1e293b surface
             Accent: brand-defined — default #6366f1 is acceptable here as a SaaS pattern
Typography:  Inter 400/500/600 throughout — consistent, readable, data-friendly
             Space Grotesk 700 for hero/display only
Effects:     Skeleton loaders, subtle hover states, clean data tables
Anti-patterns:
  ❌ Card-grid monotony (every section same layout)
  ❌ Animations that delay data visibility
  ❌ Missing empty/error states in data tables
```

**Landing/Marketing:**
```
Style:       Glassmorphism (current era) or Aurora/Mesh
Palette:     Brand-expressive — this is the ONE context where bold palette is correct
             High-contrast CTAs (must pass 4.5:1 contrast on all backgrounds)
Typography:  Space Grotesk 700 for hero display (48–72px)
             Inter 400/500 for body — max line-width 720px
Effects:     Animated mesh gradients, floating glass cards, scroll-triggered reveals
Anti-patterns:
  ❌ Generic hero: "big text + diagonal purple-to-blue gradient" — AI signature
  ❌ Centered layout throughout (breaks directional reading flow)
  ❌ Missing scroll animations on a static page
  ❌ CTAs that don't stand out from body copy
```

**Healthcare:**
```
Style:       Trust & Authority (clean, clinical, accessible)
Palette:     Clean blue/white/green — NO red except clinical alerts
             #f0f9ff bg, #1e40af accent, #059669 success, #dc2626 CRITICAL_ONLY
Typography:  Inter throughout — never decorative fonts
             Body minimum 16px for readability by older/impaired users
Effects:     Minimal — subtle hover, no motion by default
Anti-patterns:
  ❌ Dark mode as default (patients/elderly → light mode)
  ❌ Gamification patterns (inappropriate for medical context)
  ❌ Red for informational messages (reserved for clinical alerts)
  ❌ Dense data layouts without clear visual hierarchy
```

**E-commerce:**
```
Style:       Conversion-Optimized (Warm Minimalism)
Palette:     Warm neutrals, high-contrast CTAs
             Urgency signals: #ef4444 for "low stock", #f59e0b for "sale"
Typography:  Bold product names (Space Grotesk 600+), readable descriptions (Inter 400)
Effects:     Hover zoom on product images, add-to-cart pulse, trust badges
Anti-patterns:
  ❌ Cluttered above-fold (too many competing CTAs)
  ❌ Add to cart button that doesn't stand out
  ❌ Missing product image zoom/gallery
  ❌ Checkout flow with more than 3 steps visible at once
```

**Developer Tools:**
```
Style:       Minimalism or Neubrutalism
Palette:     Dark mode default — #0d1117 bg (GitHub-scale), #161b22 surface
             Syntax highlighting colors as accent palette
             No heavy gradients — developers recognize and distrust decorative UI
Typography:  JetBrains Mono for code/commands, Inter for prose
Effects:     Keyboard shortcuts visible, dense information layout OK
Anti-patterns:
  ❌ Decorative animations that delay tool response
  ❌ Non-monospace font for code blocks or command output
  ❌ Light mode only (developer tools default to dark)
  ❌ Visual noise around core functionality
```

**Creative/Portfolio:**
```
Style:       Editorial Grid or Glassmorphism or Brutalism (brand-specific)
Palette:     MUST be distinctive — generic palettes are disqualifying
             This is the one category where custom/unusual palettes are required
Typography:  Custom or display font as headline (NOT Inter alone)
             Font pairing must have contrast: Display + neutral body
Effects:     Curated — hover reveals, scroll-based reveals, cursor effects
Anti-patterns:
  ❌ Generic card grid with equal padding everywhere
  ❌ Inter-only typography (zero personality)
  ❌ Stock photo backgrounds
  ❌ Navigation that looks like every other portfolio
```

**AI-Native:**
```
Style:       Minimal Functional or Glassmorphism
Palette:     Purple/violet IS acceptable here (it is the AI-native signal)
             #7c3aed accent, dark neutral bg, subtle gradients
Typography:  Inter throughout — clarity over personality
Effects:     Typing indicators, streaming text, thinking states
Anti-patterns:
  ❌ Purple on non-AI product (exports the AI signal to inappropriate contexts)
  ❌ Static empty states — AI interfaces must show "thinking" states
  ❌ Missing latency UX (skeleton during generation, cancel button)
```

### Step 4 — Platform-Specific Overrides

Apply platform conventions on top of domain rules:

**iOS (SwiftUI / iOS 26+):**
```
Visual language: Liquid Glass — translucent surfaces with backdrop blur
  background: UIBlurEffect or .regularMaterial
  border: subtle 1px rgba(white, 0.15) — NOT solid
  roundness: aggressive corner radius (16–24px on cards, full on buttons)
Icons: SF Symbols ONLY — not Heroicons, not Lucide
Typography: SF Pro family — Dynamic Type scaling is mandatory
Safe areas: Content must respect safeAreaInsets on all edges
Anti-patterns:
  ❌ Solid-background cards (deprecated in iOS 26 Liquid Glass era)
  ❌ Custom icon fonts (SF Symbols is the platform contract)
  ❌ Fixed font sizes (Dynamic Type must be supported)
```

**Android (Jetpack Compose / Material 3 Expressive):**
```
Color: MaterialTheme.colorScheme — dynamic color derived from wallpaper
  NEVER hardcode hex colors in Compose — use semantic tokens
Shape: Extreme corner expressiveness — use shape variation as affordance signal
  Small interactive: RoundedCornerShape(4dp)
  Cards/surfaces: RoundedCornerShape(16dp)
  FABs: CircleShape
Motion: Spring physics — tween() is almost never the right choice
  spring(dampingRatio = Spring.DampingRatioMediumBouncy)
Anti-patterns:
  ❌ Hardcoded hex colors (breaks dynamic color contract)
  ❌ Linear easing (Material 3 Expressive uses spring physics)
  ❌ Small corner radii (shape expressiveness is a key M3 Expressive principle)
```

**Web:**
- Apply domain rules from Step 3
- Default: dark mode support required (`prefers-color-scheme: dark`)
- Responsive: must design for 375px, 768px, 1024px, 1440px breakpoints
- Accessibility: WCAG 2.2 AA minimum

### Step 5 — Generate Design System File

Use `Write` to create `.rune/design-system.md`:

```markdown
# Design System: [Project Name]
Last Updated: [YYYY-MM-DD]
Platform: [web | ios | android | multi-platform]
Domain: [product category]
Style: [chosen style]

## Color Tokens

### Primitive (raw values)
--color-[name]-[scale]: [hex]

### Semantic (meaning-mapped)
--bg-base:        [value]  — page background
--bg-surface:     [value]  — card/panel background
--bg-elevated:    [value]  — modal/dropdown background
--text-primary:   [value]  — primary text
--text-secondary: [value]  — secondary/muted text
--border:         [value]  — default border
--accent:         [value]  — primary action/brand
--success:        [value]  — positive/profit signal
--danger:         [value]  — error/loss signal
--warning:        [value]  — caution signal

## Typography

| Role | Font | Weight | Size |
|------|------|--------|------|
| Display | [font] | [weight] | [px range] |
| H1 | [font] | [weight] | [px] |
| H2/H3 | [font] | [weight] | [px] |
| Body | [font] | [weight] | [px] |
| Mono/Numbers | [font] | [weight] | [px] |

Numbers rule: [monospace font] for ALL numeric values in this domain (prices, metrics, IDs)

## Spacing (8px base)
xs: 4px | sm: 8px | md: 16px | lg: 24px | xl: 32px | 2xl: 48px | 3xl: 64px

## Border Radius
sm: 6px | md: 8px | lg: 12px | xl: 16px | full: 9999px

## Effects
[signature effects for this style — gradients, shadows, blur, etc.]

## Anti-Patterns (MUST NOT generate these)
[domain-specific list from Step 3 + platform overrides]
- ❌ [anti-pattern 1] — [why it fails in this domain]
- ❌ [anti-pattern 2]

## Platform Notes
[platform-specific implementation requirements from Step 4]

## Component Library
[detected library or "custom"]

## Pre-Delivery Checklist
- [ ] Color contrast ≥ 4.5:1 for all text
- [ ] Focus-visible ring on ALL interactive elements (never outline-none alone)
- [ ] Touch targets ≥ 24×24px with 8px gap between targets
- [ ] All icon-only buttons have aria-label
- [ ] All inputs have associated <label> or aria-label
- [ ] Empty state, error state, loading state for all async data
- [ ] cursor-pointer on all clickable non-button elements
- [ ] prefers-reduced-motion respected for all animations
- [ ] Dark mode support (or explicit reasoning why not)
- [ ] Responsive tested at 375px / 768px / 1024px / 1440px
```

### Step 6 — Accessibility Review

Run a focused accessibility audit on the design system and any existing UI code. This step ensures the design contract doesn't produce inaccessible outputs.

**Automated checks** (use Grep on codebase):
1. **Color contrast**: Verify all text/bg combinations in the design system meet WCAG 2.2 AA (4.5:1 normal text, 3:1 large text). Flag any semantic color pair that fails.
2. **Focus indicators**: Search for `outline-none`, `outline: none`, `focus:outline-none` without a replacement `focus-visible` ring. Every instance is a violation.
3. **Touch targets**: Search for buttons/links with explicit small sizing (`w-6 h-6`, `p-1` on interactive elements). Flag anything < 24x24px.
4. **Missing labels**: Search for `<input` without adjacent `<label` or `aria-label`. Search for icon-only buttons without `aria-label`.
5. **Semantic HTML**: Flag `<div onClick`, `<span onClick` (should be `<button>`). Flag missing `<nav>`, `<main>`, `<header>` landmarks.
6. **Motion safety**: Check for animations/transitions without `prefers-reduced-motion` media query or Tailwind `motion-reduce:` variant.

**Output**: Accessibility audit section in Design Report with pass/fail per check and specific file:line violations.

If violations found → add them to `.rune/design-system.md` Anti-Patterns section as concrete rules.

### Step 7 — UX Writing Patterns

Generate microcopy guidelines specific to this product domain. UX writing is part of design — not an afterthought.

**Domain-specific microcopy rules:**

| Domain | Tone | Error Pattern | CTA Pattern | Empty State |
|--------|------|---------------|-------------|-------------|
| Trading/Fintech | Precise, neutral, no humor | "Order failed: insufficient margin ($X required)" | "Place Order", "Close Position" | "No open positions. Market opens in 2h 15m." |
| SaaS Dashboard | Professional, helpful | "Couldn't save changes. Try again or contact support." | "Get Started", "Upgrade Plan" | "No data yet. Connect your first integration." |
| E-commerce | Friendly, urgent-capable | "This item is no longer available. Here are similar items." | "Add to Cart", "Buy Now" | "Your cart is empty. Continue shopping?" |
| Healthcare | Calm, clinical, clear | "We couldn't verify your insurance. Please check your member ID." | "Schedule Visit", "View Results" | "No upcoming appointments." |
| Developer Tools | Direct, technical | "Build failed: missing dependency `@types/node`" | "Deploy", "Run Tests" | "No builds yet. Push to trigger CI." |

**Generate for this project:**
- Error message template: `[What happened] + [Why] + [What to do next]`
- Empty state template: `[What's missing] + [How to fill it]`
- Confirmation template: `[What will happen] + [Reversibility]`
- Loading text: context-appropriate (not just "Loading...")
- Button label rules: verb-first, specific action (not "Submit", "Click Here")

Add UX writing guidelines to `.rune/design-system.md` under a new `## UX Writing` section.

### Step 8 — Report

Emit design summary to calling skill:

```
## Design Report: [Project Name]

### Domain Classification
[product category] — [style chosen] — [platform]

### Design System Generated
.rune/design-system.md

### Key Decisions
- Accent: [color + reasoning — why this color for this domain]
- Typography: [pairing + reasoning]
- Style: [style name + why it fits this product]

### Anti-Patterns Registered (will be flagged by review)
- ❌ [n] domain-specific patterns
- ❌ [n] platform-specific patterns

### Pre-Delivery Checklist
[count] items to verify before shipping
```

## Output Format

```
## Design Report: TradingOS Dashboard

### Domain Classification
Trading/Fintech — Data-Dense Dark — Web

### Design System Generated
.rune/design-system.md

### Key Decisions
- Accent: #2196f3 (blue) — neutral data highlight; profit/loss colors (#00d084/#ff6b6b)
  are reserved as semantic signals, not brand colors
- Typography: JetBrains Mono 700 for all numeric values (prices, P&L, %),
  Inter 400/600 for prose and labels
- Style: Data-Dense Dark — users scan real-time data under time pressure;
  decorative elements compete with data for attention

### Anti-Patterns Registered
- ❌ 4 domain-specific (gradient wash, conflicting accent colors, decorative motion, dark-on-dark)
- ❌ 1 platform-specific (fixed font sizes not applicable — web target)

### Pre-Delivery Checklist
12 items to verify before shipping
```

## Constraints

1. MUST classify domain before generating design system — never generate with unknown domain
2. MUST include anti-pattern list in every design system — a system without anti-patterns is incomplete
3. MUST NOT use purple/indigo as default accent unless domain is AI-Native or explicitly brand-purple
4. MUST write `.rune/design-system.md` — ephemeral design decisions evaporate; persistence is the point
5. MUST NOT overwrite existing design-system.md without user confirmation
6. MUST include platform-specific overrides when platform is iOS or Android

## Mesh Gates (L1/L2 only)

| Gate | Requires | If Missing |
|------|----------|------------|
| Domain Gate | Product domain classified before generating tokens | Ask clarifying question |
| Anti-Pattern Gate | Anti-pattern list derived from domain rules (not generic) | Domain-specific list required |
| Persistence Gate | .rune/design-system.md written before reporting done | Write file first |
| Platform Gate | Platform detected before generating tokens | Default to web, note assumption |

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Generating generic design system without domain classification | CRITICAL | Domain Gate blocks this — classify first |
| Purple/indigo accent on non-AI-native product | HIGH | Constraint 3 blocks this — re-generate with domain-appropriate accent |
| Anti-pattern list copied from generic sources (not domain-specific) | HIGH | Each anti-pattern must cite why it fails in THIS specific domain |
| design-system.md not written (only reported verbally) | HIGH | Constraint 4 — no file = no persistence = future sessions lose design context |
| iOS target generating solid-background cards | MEDIUM | Platform Gate: iOS 26 Liquid Glass deprecates this pattern |
| Android target using hardcoded hex colors | MEDIUM | Platform Gate: MaterialTheme.colorScheme is mandatory for dynamic color |

## Done When

- Design reference loaded (user override or baseline)
- Domain classified (one of the 10 categories or explicit custom reasoning)
- Design system generated with: colors (primitive + semantic), typography, spacing, effects, anti-patterns
- Platform-specific overrides applied (if iOS/Android target)
- Accessibility review completed (6 checks: contrast, focus, touch targets, labels, semantic HTML, motion)
- UX writing guidelines generated (error, empty state, confirmation, loading, button templates)
- `.rune/design-system.md` written (includes UX Writing section)
- Design Report emitted with accent/typography reasoning and anti-pattern count
- Pre-Delivery Checklist included in design-system.md

## Cost Profile

~2000-5000 tokens input, ~800-1500 tokens output. Sonnet for design reasoning quality.
