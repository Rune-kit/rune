---
name: "animation-patterns"
pack: "@rune/ui"
description: "Motion design patterns — micro-interactions, page transitions, scroll animations, loading states. Applies CSS transitions, Framer Motion, or GSAP based on project stack. Always respects prefers-reduced-motion."
model: sonnet
tools: [Read, Edit, Write, Grep, Glob, Bash]
---

# animation-patterns

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

**Step 5 — Mood-to-Animation Timing**

If `.rune/design-system.md` contains a `## Mood` section, read the selected mood and apply the matching motion profile. This ensures animation feel aligns with the product's emotional intent — not just technical correctness.

| Mood | Duration | Easing | Hover | Enter/Exit | Scroll | Signature |
|------|----------|--------|-------|------------|--------|-----------|
| **Impressed** | 0.8-1.2s | `ease-out` | Scale 1.03 + deep shadow | Fade-up 24px | Parallax layers | Staggered reveals with 100ms delay between items |
| **Excited** | 0.4-0.6s | `spring(1, 80, 10)` | Scale 1.06 + color shift | Slide-in from edge | Snap scroll | Overshoot on entry (1.56 bounce), pulse on data change |
| **Calm** | 0.6-0.8s | `ease-out-quad` | Subtle opacity 0.8→1 | Slow fade 300ms | Gentle float | Breathing rhythm on idle elements (opacity 0.7↔1, 4s loop) |
| **Confident** | 0.3-0.5s | `ease` | Precise underline/border | Clean slide 16px | None or minimal | Sharp, decisive — no overshoot, no bounce |
| **Playful** | 0.4-0.6s | `spring(1, 100, 12)` | Wobble or tilt (rotate ±2°) | Bounce-in from bottom | Elastic snap | Squish on click (scaleX 1.05, scaleY 0.95), emoji-like feedback |
| **Techy** | 0.15-0.3s | `ease-out` | Glow border or underline | Instant or 100ms fade | Sticky headers | Typewriter text, cursor blink, terminal-feel transitions |
| **Professional** | 0.2-0.3s | `ease` | Background tint only | Simple fade | Fixed header | Minimal — motion serves function, never decoration |
| **Inspired** | 0.5-0.8s | `cubic-bezier(0.4, 0, 0.2, 1)` | Reveal hidden detail | Scroll-driven enter | Parallax + reveal | Cinematic — content appears as user discovers, like turning pages |

**Usage rules:**
1. Read mood from `.rune/design-system.md` → select matching row → apply as default motion tokens
2. If no mood defined, fall back to **Professional** (safest, least opinionated)
3. ALL timing values must be wrapped in `prefers-reduced-motion` check — mood doesn't override accessibility
4. Mood overrides generic Step 2 micro-interactions where they conflict

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
