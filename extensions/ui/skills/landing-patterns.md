---
name: "landing-patterns"
pack: "@rune/ui"
description: "Landing page section patterns — 12 section archetypes with HTML structure hints, Tailwind classes, responsive rules, and conversion-focused copy guidance. Anti-AI design rules enforced throughout."
model: sonnet
tools: [Read, Edit, Write, Grep, Glob, Bash]
---

# landing-patterns

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
          Rune wires your AI coding assistant to a mesh of 62 skills so you spend time building, not prompting.
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
