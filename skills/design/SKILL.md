---
name: design
description: Design system reasoning. Maps product domain to style, palette, typography, and platform-specific patterns. Generates .rune/design-system.md as the shared design contract for all UI-generating skills.
metadata:
  author: runedev
  version: "0.4.0"
  layer: L2
  model: sonnet
  group: creation
  tools: "Read, Write, Edit, Glob, Grep"
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

### External Data Source

Design intelligence data from [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT, 42.8k★).
Located at `references/ui-pro-max-data/` — 161 palettes, 84 styles, 73 font pairings, 161 reasoning rules, 99 UX guidelines.

When `references/ui-pro-max-data/` is available:
- Step 2: query `styles.csv` for domain-matched visual styles (expands from 10 → 84)
- Step 3: query `ui-reasoning.csv` for industry-specific design rules (161 rules)
- Step 3: query `colors.csv` for palette alternatives (expands from 10 → 161)
- Step 6 (Anti-AI): cross-check proposed style against reasoning DB — if flagged as "AI-generic", suggest 3 alternatives

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

### Step 2.5 — Mood-to-Constraint Mapping

After classifying domain, ask ONE question: **"What should users feel when they use this?"**

Accept a single mood keyword (or infer from context if obvious). Map mood to concrete design constraints:

| Mood | Color Temp | Typography Weight | Whitespace | Animation | Shadow |
|------|-----------|-------------------|------------|-----------|--------|
| **Impressed** | Cool (blue-slate) | Heavy display (700-800) | Generous (xl-3xl) | Dramatic reveals (0.8-1.2s ease-out) | Deep, layered |
| **Excited** | Warm (amber-orange) | Bold contrasts (400 vs 800) | Tight-medium (sm-lg) | Energetic springs (0.4-0.6s spring) | Elevation lifts |
| **Calm** | Neutral-warm (stone-sage) | Light-medium (300-500) | Very generous (2xl-3xl) | Slow fades (0.6-0.8s ease-out-quad) | Soft, minimal |
| **Confident** | Cool-neutral (zinc-slate) | Medium-heavy (500-700) | Structured (md-xl) | Precise slides (0.3-0.5s ease) | Crisp, defined |
| **Playful** | Saturated (multi-hue) | Round + bold (600-700) | Medium, irregular (md-lg) | Bouncy springs (0.4-0.6s spring, overshoot) | Hard/comic (3-5px offset) |
| **Techy** | Cold (gray-cyan) | Mono-heavy, crisp (400-600) | Dense, grid-aligned (sm-md) | Sharp snaps (0.15-0.3s ease-out) | Minimal or glow |
| **Professional** | Muted neutrals | System fonts, readable (400-500) | Balanced (md-lg) | Subtle (0.2-0.3s ease) | Standard elevation |
| **Inspired** | Rich-warm (gold-terracotta) | Editorial display (300-700 range) | Asymmetric, generous | Scroll-driven reveals (0.5-0.8s) | Dramatic, directional |

**Mapping rules:**
1. Mood constraints OVERRIDE generic domain defaults where they conflict (mood is user intent, domain is convention)
2. If mood contradicts domain safety (e.g., "Playful" + Healthcare), WARN user: "Playful tone may reduce trust in medical context — proceed?"
3. Write selected mood + resolved constraints to `.rune/design-system.md` under `## Mood` section
4. Downstream skills (`animation-patterns`, `palette-picker`, `type-system`) read mood constraints from design-system.md

**Skip if**: User says "no preference" or "just follow domain defaults" — proceed to Step 3 with domain-only reasoning.

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

### Step 5.5 — UI Design Contract (UI-SPEC.md)

After generating the design system, lock key visual decisions in `.rune/ui-spec.md` — a binding contract that prevents design drift during implementation.

**Why**: design-system.md defines tokens (what's available). UI-SPEC locks decisions (what was chosen and WHY). Without a spec, each component re-decides layout, density, and hierarchy — causing visual inconsistency.

**Generate `.rune/ui-spec.md`:**

```markdown
# UI Specification: [Project Name]
Locked: [YYYY-MM-DD] | Mood: [selected mood]

## Layout Decisions
- Page max-width: [value]px
- Sidebar: [yes/no] — [width]px [fixed/collapsible]
- Content density: [compact/balanced/spacious]
- Card sizing: [uniform/varied] — if varied, specify hierarchy rules

## Visual Hierarchy Rules
- Primary action: [color] [size] [weight] — ONE per viewport
- Secondary action: [ghost/outline] style — max 2 per section
- Data emphasis: [monospace + bold] for numbers, [color accent] for status
- Section separation: [border/spacing/background] — pick ONE, be consistent

## Component Decisions
- Card style: [elevated/bordered/glass] — reasoning: [why]
- Table style: [striped/bordered/minimal] — reasoning: [why]
- Form layout: [stacked/inline/grid] — reasoning: [why]
- Navigation: [sidebar/topbar/tabs] — reasoning: [why]

## Locked Anti-Decisions (things we explicitly chose NOT to do)
- ❌ [rejected option] — because [reason]
```

<HARD-GATE>
UI-SPEC.md is a contract. Once written, changes require explicit user approval ("I want to change the card style"). Skills that generate UI (`cook`, `fix`, `scaffold`) MUST read UI-SPEC.md before producing components. Drift from spec = review finding.
</HARD-GATE>

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

### Step 6.5 — 6-Pillar Visual Audit

Score the generated design system across 6 pillars. Each pillar scored 1-4 (1=Poor, 2=Fair, 3=Good, 4=Excellent). Minimum passing score: **18/24** (average 3.0).

| Pillar | Score 1 (Poor) | Score 2 (Fair) | Score 3 (Good) | Score 4 (Excellent) |
|--------|---------------|----------------|----------------|---------------------|
| **Copy** | Placeholder text, generic CTAs ("Submit"), no voice | Real copy but inconsistent tone | Consistent voice, domain-appropriate, clear CTAs | Personality-rich, scannable, microcopy for every state |
| **Visuals** | Stock photos, generic icons, no visual identity | Consistent icon set, basic imagery | Custom illustrations or curated photography, clear hierarchy | Distinctive visual language, icons tell stories, zero stock |
| **Color** | Default framework palette, no semantic meaning | Brand colors defined but inconsistent usage | Full semantic palette, dark mode, accessible contrast | Mood-aligned, colorblind-safe, context-adaptive (profit/loss/status) |
| **Typography** | Single font, no scale | Font pairing exists but inconsistent sizing | Clear hierarchy (display/heading/body/mono), numbers monospace | Mood-aligned pairing, fluid scaling, platform-native where needed |
| **Spacing** | Inconsistent gaps, cramped or too loose | Base unit defined but not consistently applied | 8px grid, consistent section/component/element spacing | Density variants (compact/default/spacious), rhythm feels intentional |
| **UX** | Missing states (empty/error/loading), no feedback | Basic states exist, some interactive feedback | All states covered, toast/loading/skeleton, focus management | Delightful micro-interactions, smart defaults, zero dead-ends |

**Audit output:**

```
### Visual Audit Score: [total]/24

| Pillar | Score | Notes |
|--------|-------|-------|
| Copy | 3 | Consistent voice, missing loading microcopy |
| Visuals | 2 | Using Phosphor icons (good), no custom illustration |
| Color | 4 | Full semantic palette, colorblind alternates defined |
| Typography | 3 | JetBrains Mono for numbers, Inter for prose — solid |
| Spacing | 3 | 8px grid applied, density variants not needed yet |
| UX | 3 | All states covered, micro-interactions in progress |
| **Total** | **18/24** | PASS — ship-ready with Copy improvements recommended |
```

**If score < 18**: Flag specific weak pillars in Design Report. Add improvement tasks to `.rune/design-system.md` under `## Improvement Backlog`.

**Registry safety check**: If an existing component library is in use (shadcn, MUI, etc.), verify the design system doesn't conflict with the library's token structure. Flag collisions.

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

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| Design system file | Markdown | `.rune/design-system.md` |
| UI specification contract | Markdown | `.rune/ui-spec.md` |
| Design report | Markdown | inline (chat output) |
| Accessibility audit findings | Markdown list | inline + appended to design-system.md |
| Visual audit score | Table (6 pillars × 1-4) | inline + appended to design report |
| UX writing guidelines | Markdown section | `.rune/design-system.md` § UX Writing |

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Generating generic design system without domain classification | CRITICAL | Domain Gate blocks this — classify first |
| Purple/indigo accent on non-AI-native product | HIGH | Constraint 3 blocks this — re-generate with domain-appropriate accent |
| Anti-pattern list copied from generic sources (not domain-specific) | HIGH | Each anti-pattern must cite why it fails in THIS specific domain |
| design-system.md not written (only reported verbally) | HIGH | Constraint 4 — no file = no persistence = future sessions lose design context |
| Mood contradicts domain safety conventions | HIGH | Step 2.5 warns user before proceeding (e.g., Playful + Healthcare) |
| UI-SPEC.md drift — components diverge from locked decisions | HIGH | HARD-GATE: cook/fix must read ui-spec.md before generating UI |
| Visual audit score < 18 shipped without improvement plan | MEDIUM | Step 6.5 flags weak pillars and creates backlog items |
| iOS target generating solid-background cards | MEDIUM | Platform Gate: iOS 26 Liquid Glass deprecates this pattern |
| Android target using hardcoded hex colors | MEDIUM | Platform Gate: MaterialTheme.colorScheme is mandatory for dynamic color |

## Done When

- Design reference loaded (user override or baseline)
- Domain classified (one of the 10 categories or explicit custom reasoning)
- Mood mapped to constraints (or explicitly skipped with "domain defaults")
- Design system generated with: colors (primitive + semantic), typography, spacing, effects, anti-patterns
- Platform-specific overrides applied (if iOS/Android target)
- UI-SPEC.md written with locked layout, hierarchy, and component decisions
- Accessibility review completed (6 checks: contrast, focus, touch targets, labels, semantic HTML, motion)
- 6-Pillar Visual Audit scored ≥ 18/24 (or weak pillars flagged with improvement tasks)
- UX writing guidelines generated (error, empty state, confirmation, loading, button templates)
- `.rune/design-system.md` written (includes Mood + UX Writing sections)
- `.rune/ui-spec.md` written (design contract for UI-generating skills)
- Design Report emitted with mood, accent/typography reasoning, visual audit score, and anti-pattern count
- Pre-Delivery Checklist included in design-system.md

## Cost Profile

~2000-5000 tokens input, ~800-1500 tokens output. Sonnet for design reasoning quality.
