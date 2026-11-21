# design — Universal anti-AI rules

> Reference for `skills/design/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

#### Rule 1 — Scale Minimums

Below these thresholds, designs read as "AI boilerplate" no matter how good the palette is.

| Element | Minimum | Ideal |
|---------|---------|-------|
| Hero/display text | 48px | 56-72px |
| H1 (page title) | 32px | 36-40px |
| Body text | 16px (never 14px for primary content) | 16-18px |
| Secondary/meta text | 14px | 14-15px |
| Touch targets (mobile) | 44×44px | 48×48px |
| Touch target gap (mobile) | 8px | 12px |
| Focus-visible ring | 2px | 3px |

Write these minimums to `.rune/design-system.md` under `## Scale Minimums`. Downstream skills (`cook`, `fix`) treat violations as review findings.

#### Rule 2 — Placeholder Over Bad SVG

If the design calls for an icon, illustration, or graphic that the agent cannot generate at high quality, **ship a boxed placeholder, not a malformed SVG**.

```html
<!-- GOOD: placeholder -->
<div class="placeholder" data-icon="dashboard" aria-label="Dashboard icon — design pass needed">
  [ ICON: dashboard ]
</div>

<!-- BAD: AI-generated SVG with broken geometry -->
<svg viewBox="0 0 24 24">
  <path d="M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5"/>
</svg>
```

- Use **Phosphor Icons** (`@phosphor-icons/react`) or **Huge Icons** as the library default. Never generate custom SVG for standard iconography.
- For illustrations, reference a placeholder string (e.g., `[ILLUSTRATION: empty-state-dashboard]`) that a human or asset-creator pass fills in later.
- Malformed SVG is the #1 AI tell. A clean labeled placeholder is honest and professional.

**Placeholder Ownership (MANDATORY)**: every placeholder or intentionally inert element the design ships — `[ ICON: ... ]`, `[ILLUSTRATION: ...]`, `[ PLACEHOLDER: ... ]`, and any button/link/form rendered as visual-only (no behavior designed yet) — MUST be listed in `.rune/ui-spec.md` under a `## Unwired Elements` section:

```markdown
## Unwired Elements
| Element | Location | Why unwired | Owner of wiring |
|---------|----------|-------------|-----------------|
| product-grid | ProductGrid.tsx | awaiting US-2 backend | US-2 Endpoint task |
| [ ICON: dashboard ] | Sidebar.tsx | asset pass pending | asset-creator |
```

This list is how downstream gates tell **declared debt** from **accidental dead UI**: `preflight` skips these elements, `verification` reports them as INFO (visible, non-failing), and `converge` counts them as `missing` until wired. A placeholder NOT on this list that reaches implementation = a dead element with no owner — that's the bug this section exists to prevent.

#### Rule 3 — Color Derivation via oklch(), not Manual Shading

When the design needs a darker hover, lighter surface, or tinted state, **derive from the accent via oklch()** — never eyeball a hex value.

```css
/* GOOD: relative derivation */
--accent: oklch(65% 0.2 255);
--accent-hover:  oklch(from var(--accent) calc(l - 0.08) c h);
--accent-pressed: oklch(from var(--accent) calc(l - 0.15) c h);
--accent-subtle:  oklch(from var(--accent) calc(l + 0.3) calc(c * 0.4) h);

/* BAD: manual hex shading — breaks hue/chroma consistency */
--accent: #3b82f6;
--accent-hover: #2563eb;  /* guessed darker */
```

Why: HSL shading distorts perceived brightness at different hues. oklch() keeps perceptual lightness consistent, so derived states look intentional rather than "kinda close." Write derived tokens to `.rune/design-system.md` — downstream skills reuse these, not re-derive.

Bonus: use `text-wrap: pretty` on headings to prevent widow words. One line, zero ceremony.

#### Rule 4 — Measurable Constraints, Not Vague Directives

Every design rule written into `.rune/design-system.md` MUST be measurable. Vague directives are not constraints — they are decoration. A reviewer cannot enforce "use modern typography"; they CAN enforce "Inter 96/64/40/24/16 px on an 8 px grid."

| Vague (reject) | Measurable (accept) |
|---|---|
| "Use modern typography" | "Inter 96/64/40/24/16 px on an 8 px grid" |
| "Subtle shadows" | "0 1px 2px rgba(0,0,0,0.05) (sm), 0 4px 6px rgba(0,0,0,0.07) (md)" |
| "Brand-aligned color" | "Accent: oklch(65% 0.2 255); hover: oklch(from var(--accent) calc(l - 0.08) c h)" |
| "Good contrast" | "All text/bg pairs ≥ 4.5:1 (WCAG AA), large text ≥ 3:1" |
| "Tasteful spacing" | "8 px grid: every margin, padding, line-height a multiple of 8" |
| "Real content, not lorem ipsum" | "Use the user's actual data; if missing, ship a labelled `[ PLACEHOLDER: content-type ]` block" |

#### Rule 5 — No Pure Black, No Pure White, No Lorem Ipsum

Three small forbids that catch the highest-frequency AI tells:

1. **No `#000` or `#fff`** for any default text or background. Both crush perceived depth and read as "default browser styles." Use `oklch(98% 0 0)` / `oklch(8% 0 0)` (or domain-appropriate neutrals) and derive surfaces from them.
2. **No lorem ipsum / "Lorem ipsum dolor"** anywhere in shipped output. Either use the user's real data, or ship a labelled `[ PLACEHOLDER: hero-headline ]` block (same pattern as Rule 2 SVG placeholder). Lorem ipsum is the #2 AI tell after malformed SVG.
3. **No `outline: none` without a `:focus-visible` replacement.** Already covered by Pre-Delivery Checklist; restated here so it lives next to the other two highest-impact forbids.

#### Rule 6 — CJK-First Font Stack (Multi-Language Products Only)

If the product ships in Chinese / Japanese / Korean (or mixes CJK with Latin), the font stack MUST list a CJK-capable family FIRST, with Latin as fallback:

```css
/* GOOD: CJK-first, Latin fallback */
font-family: "Noto Sans SC", "Source Han Sans SC", "Inter", system-ui, sans-serif;

/* BAD: Latin-first — Chinese characters render in browser fallback (PingFang, Heiti) and break rhythm */
font-family: "Inter", "Noto Sans SC", system-ui;
```

For prose / serif: `"Noto Serif SC" / "Source Han Serif SC" / "Manrope"`. For monospace: `"JetBrains Mono" / "Sarasa Mono SC"` (Sarasa unifies CJK + Latin metrics). Skip this rule entirely if the product is Latin-only — listing CJK fonts you don't need slows first-paint.
