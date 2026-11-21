---
name: design
description: "Design system reasoning. Use when starting UI work in a project with no .rune/design-system.md, when UI looks generic or inconsistent, or when choosing style, palette, and typography. Maps product domain to platform-specific patterns and generates .rune/design-system.md as the shared design contract for all UI-generating skills."
metadata:
  author: runedev
  version: "0.9.0"
  layer: L2
  model: opus
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
- `browser-pilot` (L3): render the surface and inspect it before claiming any visual property holds (Step 5.4)
- `review` (L2): accessibility violations found → flag for fix in next code review

## Called By (inbound)

- `cook` (L1): before any frontend code generation
- `scaffold` (L1): design system for new project
- `brainstorm` (L2): when selected approach has UI/UX implications
- `ba` (L2): when requirements include UI/UX components
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
5. **When the domain involves any UI motion** (transitions, animations, gestures, springs, micro-interactions) → also `Read` `skills/design/MOTION-CRAFT.md`. It is the canonical motion authority: the should-it-animate frequency gate, easing/duration budgets (including peak-slope curve selection for large travel, and velocity continuity across keyframe joins), physicality (never `scale(0)`, origin-aware popovers), spring physics, gesture handoff, motion performance, the role→strategy reduced-motion framework, SVG-specific mechanics (user units, `pathLength`, SVGO), and a reverse-lookup vocabulary. Cite its exact values in the design-system motion section; never approximate curves or durations. **When MOTION-CRAFT.md and DESIGN-REFERENCE.md disagree on a motion detail (easing, duration, interaction timing), MOTION-CRAFT.md wins** — it is the deeper, motion-specific source; DESIGN-REFERENCE.md's Animation Timing / Interaction Patterns tables are the general baseline.

> **Advisory motion-audit mode**: When asked to "improve the animations" / "make this feel better" / "what could be animated here", operate read-only — survey the motion surface against MOTION-CRAFT.md, report frequency-gated findings (and deliberately rejected candidates), and hand precise recipes to `cook`/`fix`. Suggesting motion everywhere is worse than useless; expect to reject most candidates.

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

### Step 2.7 — Tweaks, Not Menus (Default Style Pattern)

Picking from a 10-option style menu is how AI UI gets generic. Instead:

1. **Propose ONE opinionated default** based on domain + mood (from Step 2.5). Describe it in 2-3 lines — style, palette direction, typography pairing.
2. **Ask for tweaks, not choices.** The question is **"Any tweaks to this, or ship it?"** — not "Which of these do you prefer?"
3. **Accept natural-language adjustments.** Map phrases → design system edits:
   - "more professional" → heavier type weights, reduce saturation, tighter spacing
   - "less corporate" → looser weights, brighter accent, more whitespace
   - "darker" → swap base for darker neutral, raise contrast on elevated surfaces
   - "more playful" → add subtle animation, soften corners, bolder accent
   - "more trust" → cooler palette (slate/blue), heavier headers, smaller radius
4. **If the user asks for a menu**, provide max 3 options — but mark one as the recommended default. Never present a neutral list of 5+ equivalent styles.

Why: Every menu option dilutes commitment. A single confident default gets committed, tweaked, and shipped. A menu gets deliberated, A/B'd, and abandoned. This is the **Tweaks Default** pattern from Anthropic's design system guidance — the AI commits first, humans steer second.

### Step 2.9 — Universal Anti-AI Rules (apply to ALL domains)

These rules apply regardless of domain, mood, or platform. Every generated design system MUST comply.

**Enforcement**: `rune:review` v1.1.0+ reads `.rune/design-system.md` § Scale Minimums and flags violations of Rules 1–3 below as MEDIUM/HIGH findings. Rules 4–6 (Measurable Constraints, No-Pure-No-Lorem, CJK-First) are design-time guidance — added in design v0.6.0, review enforcement forthcoming. Design defines, review enforces — this is the contract.

#### Rule 1 — Scale Minimums

> Full detail moved to [`references/anti-ai-rules.md`](references/anti-ai-rules.md) (progressive disclosure). **Read that file before executing this section.**

#### Rule 2 — Placeholder Over Bad SVG

> Full detail moved to [`references/anti-ai-rules.md`](references/anti-ai-rules.md) (progressive disclosure). **Read that file before executing this section.**

#### Rule 3 — Color Derivation via oklch(), not Manual Shading

> Full detail moved to [`references/anti-ai-rules.md`](references/anti-ai-rules.md) (progressive disclosure). **Read that file before executing this section.**

#### Rule 4 — Measurable Constraints, Not Vague Directives

> Full detail moved to [`references/anti-ai-rules.md`](references/anti-ai-rules.md) (progressive disclosure). **Read that file before executing this section.**

#### Rule 5 — No Pure Black, No Pure White, No Lorem Ipsum

> Full detail moved to [`references/anti-ai-rules.md`](references/anti-ai-rules.md) (progressive disclosure). **Read that file before executing this section.**

#### Rule 6 — CJK-First Font Stack (Multi-Language Products Only)

> Full detail moved to [`references/anti-ai-rules.md`](references/anti-ai-rules.md) (progressive disclosure). **Read that file before executing this section.**

### Step 3 — Apply Domain Reasoning Rules

> Full detail moved to [`references/domain-rules.md`](references/domain-rules.md) (progressive disclosure). **Read that file before executing this section.**

### Step 4 — Platform-Specific Overrides

> Full detail moved to [`references/platform-overrides.md`](references/platform-overrides.md) (progressive disclosure). **Read that file before executing this section.**

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
> Items marked 👁 describe what a human would SEE — tick them only from a render, or mark them ASSUMED (Step 5.4).
- [ ] 👁 Color contrast ≥ 4.5:1 for all text
- [ ] 👁 Focus-visible ring on ALL interactive elements (never outline-none alone)
- [ ] 👁 Touch targets ≥ 44×44px on mobile / ≥ 24×24px on desktop, with 8px gap between targets (matches Step 2.9 Rule 1)
- [ ] All icon-only buttons have aria-label
- [ ] All inputs have associated <label> or aria-label
- [ ] 👁 Empty state, error state, loading state for all async data
- [ ] cursor-pointer on all clickable non-button elements
- [ ] Every animation has a named role (communicative / decorative) and one of the four reduce strategies — bail, snap to end state, collapse, reduce complexity (MOTION-CRAFT §10)
- [ ] Motion preference is read live (`change` listener or library equivalent), not once at mount
- [ ] 👁 Reduce path exercised, not grepped — meaning survives with the preference on
- [ ] Dark mode support (or explicit reasoning why not)
- [ ] 👁 Responsive tested at 375px / 768px / 1024px / 1440px
- [ ] No pure #000 or #fff in semantic tokens (use oklch neutrals)
- [ ] No lorem ipsum / placeholder copy in shipped output (use real data or labelled `[ PLACEHOLDER: ... ]` blocks)
- [ ] If multi-language: CJK-capable font listed FIRST in stack (`"Noto Sans SC", "Inter", ...`)
```

### Step 5.4 — Render Blindness (advisory)

A checklist item ticked from source is a prediction, not an observation. You emit markup and
imagine the result, and **the imagined render is always flattering** — overflow, wrapping,
contrast failure, misalignment and collision are invisible in source form. Every item in the
checklist above that describes what a human would *see* is unverified until the surface is
rendered and inspected, or the specific property is computed.

| Claim | What source-reading proves | What actually settles it |
|-------|---------------------------|--------------------------|
| "Contrast ≥ 4.5:1" | The token values were chosen | Compute the ratio for the rendered pair — a token used on an unexpected background fails anyway |
| "Responsive at 375px" | Breakpoints exist | Render at 375px and look: wrapping, overflow, tap-target collision |
| "No overflow / clean alignment" | Nothing | Render — this class of failure has no textual signature |
| "Focus ring visible" | The CSS rule exists | Tab through it; a parent `overflow:hidden` or a later rule can eat it |
| "Empty / error / loading states work" | The branches exist | Render each one; the happy path is the only state most designs are ever seen in |

**Advisory, not a gate.** When the runtime grants a browser, `browser-pilot` is the strongest
check available and costs one call — take it, then report what was seen. When it does not,
say so: mark the visual items **ASSUMED (not rendered)** rather than ticking them. A checklist
of predictions labelled as observations is worse than a short one that is honest — see
`completion-gate` → `references/claim-discipline.md`.

Highest-yield renders, when budget allows only a few: narrowest breakpoint, longest realistic
content string, empty state, dark mode.

### Step 5.5 — UI Design Contract (UI-SPEC.md)

> Full detail moved to [`references/ui-spec.md`](references/ui-spec.md) (progressive disclosure). **Read that file before executing this section.**

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
6. **Motion safety**: Check for animations/transitions without `prefers-reduced-motion` media query or Tailwind `motion-reduce:` variant. Where the guard *is* present, the check is not done — confirm the branch is reachable (no outer `if (reduced) return` before the end-state applicator) and that JS timelines (GSAP/Motion/Lenis) are gated too, since a CSS media query cannot stop them. **Touches ≠ reachable ≠ correct.**

**Output**: Accessibility audit section in Design Report with pass/fail per check and specific file:line violations.

If violations found → add them to `.rune/design-system.md` Anti-Patterns section as concrete rules.

### Step 6.5 — 6-Pillar Visual Audit

> Full detail moved to [`references/visual-audit.md`](references/visual-audit.md) (progressive disclosure). **Read that file before executing this section.**

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

> Full detail moved to [`references/output-example.md`](references/output-example.md) (progressive disclosure). **Read that file before executing this section.**

## Constraints

1. MUST classify domain before generating design system — never generate with unknown domain
2. MUST include anti-pattern list in every design system — a system without anti-patterns is incomplete
3. MUST NOT use purple/indigo as default accent unless domain is AI-Native or explicitly brand-purple
4. MUST write `.rune/design-system.md` — ephemeral design decisions evaporate; persistence is the point
5. MUST NOT overwrite existing design-system.md without user confirmation
6. MUST include platform-specific overrides when platform is iOS or Android
7. MUST propose ONE opinionated default and ask for tweaks — never present a neutral 5+ option menu (Step 2.7 Tweaks Default)
8. MUST enforce Scale Minimums (hero ≥48px, body ≥16px, touch targets ≥44px) in every design system (Step 2.9 Rule 1)
9. MUST use Phosphor/Huge icons or boxed placeholders — NEVER generate custom SVG for standard iconography (Step 2.9 Rule 2)
10. MUST derive accent variants via `oklch(from var(--accent) ...)` — NEVER hand-shade hex values (Step 2.9 Rule 3)
11. MUST write measurable rules into design-system.md — never vague directives like "modern typography" or "tasteful spacing" (Step 2.9 Rule 4)
12. MUST NOT use pure `#000` / `#fff` for default text or background, MUST NOT ship lorem ipsum (Step 2.9 Rule 5)
13. MUST list CJK-capable font FIRST in stack if product targets Chinese/Japanese/Korean (Step 2.9 Rule 6)
14. MUST list every intentionally inert/placeholder element in `.rune/ui-spec.md` under `## Unwired Elements` (element, location, why unwired, wiring owner) — Placeholder Ownership (Step 2.9 Rule 2)

## Mesh Gates (L1/L2 only)

| Gate | Requires | If Missing |
|------|----------|------------|
| Domain Gate | Product domain classified before generating tokens | Ask clarifying question |
| Anti-Pattern Gate | Anti-pattern list derived from domain rules (not generic) | Domain-specific list required |
| Persistence Gate | .rune/design-system.md written before reporting done | Write file first |
| Platform Gate | Platform detected before generating tokens | Default to web, note assumption |
| Tweaks-Default Gate | One opinionated default proposed before asking for tweaks | Do NOT present neutral 5-option menus |
| Scale-Minimums Gate | Hero ≥48px, body ≥16px, touch ≥44px written into design-system.md | Emit minimums block in output |
| SVG-Placeholder Gate | No hand-rolled SVG for standard icons — Phosphor/Huge or placeholder | Swap to icon library or `[ ICON: name ]` box |
| oklch-Derivation Gate | All accent variants derived via `oklch(from ...)` | Rewrite manual hex shades as relative oklch |
| Measurable-Constraints Gate | Every rule in design-system.md is testable (concrete units, hex/oklch, ratios) | Rewrite vague directives as measurable specs (Step 2.9 Rule 4 table) |
| No-Pure-No-Lorem Gate | No `#000`/`#fff` in semantic tokens; no lorem ipsum in output | Swap to oklch neutrals; replace lorem with real data or labelled placeholder |
| Placeholder-Ownership Gate | Every inert/placeholder element shipped is listed in `.rune/ui-spec.md` `## Unwired Elements` (element, location, why, wiring owner) | Add the missing rows before reporting done — an unlisted placeholder is a dead element with no owner |

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
| Presenting a neutral 5+ option style menu (deliberation death) | HIGH | Step 2.7 Tweaks Default — propose ONE opinionated default, ask for tweaks |
| Body text at 14px or hero at <40px (AI boilerplate scale) | HIGH | Step 2.9 Rule 1 — enforce Scale Minimums table in every design system |
| Hand-rolled SVG for dashboard/menu/close icons (malformed geometry) | HIGH | Step 2.9 Rule 2 — Phosphor/Huge Icons or `[ ICON: name ]` placeholder, never custom |
| Accent variants shaded by eyeball (inconsistent perceived brightness) | MEDIUM | Step 2.9 Rule 3 — `oklch(from var(--accent) calc(l - 0.1) c h)` |
| Missing `text-wrap: pretty` on headings (widow words) | LOW | One-line CSS — add to base heading styles |
| Vague directive in design-system.md ("modern typography", "tasteful spacing") | HIGH | Step 2.9 Rule 4 — rewrite as measurable spec a reviewer can enforce |
| Pure `#000` background or `#fff` body bg in semantic tokens | MEDIUM | Step 2.9 Rule 5 — `oklch(98% 0 0)` / `oklch(8% 0 0)` neutrals |
| Lorem ipsum text shipped in production output | HIGH | Step 2.9 Rule 5 — use real user data or labelled `[ PLACEHOLDER ]` block |
| CJK product with Latin-first font stack (Chinese chars fall back to OS default, break rhythm) | MEDIUM | Step 2.9 Rule 6 — `"Noto Sans SC", "Inter", system-ui` |

## Done When

- Design reference loaded (user override or baseline)
- Domain classified (one of the 10 categories or explicit custom reasoning)
- Mood mapped to constraints (or explicitly skipped with "domain defaults")
- Opinionated default proposed (Step 2.7) — user confirmed or requested tweaks
- Universal anti-AI rules applied (Step 2.9): Scale Minimums, Placeholder-over-bad-SVG, oklch() color derivation
- Design system generated with: colors (primitive + semantic, oklch-derived variants), typography, spacing, effects, anti-patterns
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
