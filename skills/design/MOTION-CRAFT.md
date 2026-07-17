# Motion Craft Reference

The motion authority for Rune's UI mesh. `design`, `cook`, `review`, and `perf` cite these exact values instead of approximating. The premise: in a world where every product works, motion is a differentiator — but **most interfaces are over-animated, not under-animated**. Default to less. Every value below is a fact you can defend, not a preference.

Load this when generating, reviewing, or auditing any animation/motion code.

---

## 1. Should it animate at all?

Decide before writing a single line. The gate is **frequency** — how often a user sees the motion.

| Frequency | Decision |
| --- | --- |
| 100+ times/day (keyboard shortcuts, command palette toggle, core nav) | **No animation. Ever.** |
| Tens/day (hover effects, list navigation, frequent toggles) | Remove or drastically reduce |
| Occasional (modals, drawers, toasts, settings) | Standard animation |
| Rare / first-time (onboarding, empty states, success, celebration) | Delight is welcome here |

**Never animate keyboard-initiated actions.** They repeat hundreds of times a day; motion makes them feel slow, delayed, and disconnected from the input. A command palette with zero open/close animation is the *correct* experience, not a missing feature.

---

## 2. Purpose — why does this animate?

Every animation must answer this in one word. If it can't, delete it.

- **Feedback** — confirming the interface heard the user (press scale, hold-to-confirm fill)
- **Spatial consistency** — showing where something came from or went (a toast enters and exits the same edge; a panel grows from its trigger)
- **State indication** — making a state change legible (morphing button, expanding accordion)
- **Preventing a jarring change** — content that would otherwise teleport, appear, or vanish with no bridge
- **Explanation** — motion that demonstrates how a feature works (marketing/onboarding only)
- **Delight** — allowed *only* at the rare/first-time frequency tier

"It looks cool" is not on this list. On a frequently-seen element, it's a regression.

---

## 3. Easing

Decision order:

- Entering or exiting → **`ease-out`** (starts fast, feels responsive)
- Moving / morphing on screen → **`ease-in-out`**
- Hover / color change → **`ease`**
- Constant motion (marquee, progress, spinner) → **`linear`**
- Default → **`ease-out`**

**Never `ease-in` on UI.** It starts slow, delaying the exact moment the user is watching most closely. `ease-out` at 200ms *feels* faster than `ease-in` at 200ms.

Built-in CSS easings are too weak — they lack the punch that reads as intentional. Use strong custom curves:

```css
--ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1);  /* punchy ease-out for deliberate UI interactions */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);      /* strong ease-in-out for on-screen movement */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);       /* iOS-like drawer/sheet curve */
```

These are the *punchy* variants for deliberate, high-attention motion. The baseline `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` in `DESIGN-REFERENCE.md` remains the general-purpose default; reach for `--ease-out-strong` when an interaction needs extra snap. Don't hand-roll curves from scratch — start from a known strong variant and tune.

---

## 4. Duration

| Element | Duration |
| --- | --- |
| Button press feedback | 100–160ms |
| Tooltips, small popovers | 125–200ms |
| Dropdowns, selects | 150–250ms |
| Modals, drawers | 200–500ms |
| Marketing / explanatory | Can be longer |

**Rule: UI animations stay under 300ms — with one exception: modals/drawers, whose larger surface area justifies 200–500ms.** A 180ms dropdown feels more responsive than a 400ms one. Perceived performance is real: a faster spinner makes load *feel* faster at identical actual time; instant tooltips after the first (skip delay + animation) make a whole toolbar feel faster.

---

## 5. Physicality

- **Never `scale(0)`.** Nothing in the real world appears from nothing. Start from `scale(0.9–0.97)` + `opacity: 0`. Even a barely-visible initial scale makes the entrance read as natural.
  ```css
  /* Bad */   .entering { transform: scale(0); }
  /* Good */  .entering { transform: scale(0.95); opacity: 0; }
  ```
- **Origin-aware popovers.** A popover/dropdown/tooltip scales in from its trigger, not its center. `transform-origin: center` is wrong for almost every trigger-anchored surface.
  ```css
  .popover { transform-origin: var(--radix-popover-content-transform-origin); }  /* Radix */
  .popover { transform-origin: var(--transform-origin); }                        /* Base UI */
  ```
  **Modals are exempt** — they aren't anchored to a trigger; keep them centered.
- **Press feedback.** `transform: scale(0.97)` on `:active`, `transition: transform 160ms ease-out`. Subtle (0.95–0.98). Applies to any pressable element. `scale()` scales children too (font, icons) — a feature here.
- **Tooltips: skip delay on subsequent hovers.** Delay the first to prevent accidental activation; once one is open, adjacent tooltips open instantly (`transition-duration: 0ms`). Faster feel without losing the guard.

---

## 6. Interruptibility

CSS **transitions** can be interrupted and retargeted mid-flight; **keyframes** restart from zero. For anything triggered rapidly (toasts being added, toggles) or gesture-driven, transitions (or springs) are smoother.

```css
/* Interruptible — good for dynamic UI */
.toast { transition: transform 400ms ease; }

/* Not interruptible — avoid for dynamic UI */
@keyframes slideIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
```

Animate entry without JS using `@starting-style`:

```css
.toast {
  opacity: 1; transform: translateY(0);
  transition: opacity 400ms ease, transform 400ms ease;
  @starting-style { opacity: 0; transform: translateY(100%); }
}
```

Legacy fallback where browser support is short: `useEffect(() => setMounted(true), [])` + a `data-mounted` attribute.

`translate` percentages are relative to the element's own size — `translateY(100%)` moves by the element's height regardless of dimensions. Prefer over hardcoded px.

---

## 7. Springs (physics-based motion)

Springs feel natural because they simulate physics and have no fixed duration — they settle on parameters. Reach for them for anything a user can touch: drag with momentum, "alive" elements, interruptible gestures, decorative mouse-tracking.

Think in two designer-friendly parameters, not the raw physics triplet:

- **Damping ratio** — controls overshoot. `1.0` = critically damped, smooth settle, no bounce. `< 1.0` overshoots and oscillates. Lower = bouncier.
- **Response** — how quickly the value reaches target, in seconds. Lower = snappier. This is *not* "duration."

**Defaults:**
- Start most UI at **damping `1.0`** — graceful and non-distracting.
- Add bounce (**damping ~`0.8`**) **only when the gesture itself carried momentum** (a flick, a throw, a drag release). Overshoot on a menu that just faded in feels wrong; overshoot on a card you flicked feels right. Keep bounce subtle (0.1–0.3).

**Concrete values:**

| Interaction | Damping | Response |
| --- | --- | --- |
| Move / reposition | `1.0` | `0.4` |
| Rotation | `0.8` | `0.4` |
| Drawer / sheet | `0.8` | `0.3` |

Web mapping (Motion / Framer Motion) — `bounce` + `duration` maps closely to damping + response:

```js
import { animate } from 'motion';
animate(el, { y: 0 }, { type: 'spring', bounce: 0, duration: 0.4 });      // critically damped default
animate(el, { y: target }, { type: 'spring', bounce: 0.2, duration: 0.4 }); // momentum → slight bounce
```

For mouse-tracking, interpolate with `useSpring` rather than tying the value directly to pointer position (direct = artificial, no momentum) — and only when the motion is decorative.

Springs **maintain velocity when interrupted** — keyframes restart from zero — so they're ideal for gestures a user may reverse mid-motion.

---

## 8. Fluid gesture interactions

The through-line of a fluid interface: motion starts from the current on-screen value, inherits the user's velocity, projects momentum forward, and can be grabbed and reversed at any instant.

- **Respond on pointer-down, not release.** Highlight the instant it's pressed; waiting for `click` feels dead. Feedback must be continuous *during* the gesture, not only at the end.
- **1:1 tracking** — the dragged element stays glued to the finger and respects the grab offset (don't snap to center on grab). Use Pointer Events + `setPointerCapture` so tracking continues when the pointer leaves bounds.
- **Velocity handoff** — when the gesture ends, the animation continues at the finger's exact release velocity so there's no seam between drag and animate. Some spring APIs want relative velocity: `gestureVelocity / (target − current)`.
- **Momentum projection** — don't snap to the nearest boundary from the release point; project the resting position from velocity (like scroll deceleration), then snap to the target nearest that projection:
  ```js
  function project(v /* px/s */, decel = 0.998) { return (v / 1000) * decel / (1 - decel); }
  const target = nearestSnapPoint(currentPosition + project(releaseVelocity));
  ```
- **Momentum dismissal** — don't require crossing a distance threshold; compute velocity (`Math.abs(distance) / elapsedMs`) and dismiss if `> ~0.11`. A flick should be enough.
- **Rubber-banding** — at a boundary, resist progressively instead of stopping hard (a hard stop reads as "frozen"):
  ```js
  function rubberband(overshoot, dim, c = 0.55) { return (overshoot * dim * c) / (dim + c * Math.abs(overshoot)); }
  ```
- **Multi-touch protection** — ignore extra touch points once a drag begins (`if (isDragging) return`) to prevent jumps.
- **Decompose 2D motion into independent X and Y springs** — a single spring on a 2D distance desyncs when the axes have different velocities.
- **Interrupt from the presentation value** — on interrupt, read the element's live on-screen transform and animate from there; starting from the logical/target value causes a visible jump.

---

## 9. Motion performance

Full detail lives in `perf`; the rules that gate motion:

- **Only animate `transform` and `opacity`** — they skip layout and paint and run on the GPU. `width`/`height`/`margin`/`padding`/`top`/`left` trigger all three rendering steps.
- **Avoid `transition: all`** — it animates unintended properties, often off-GPU.
- **Framer Motion shorthands (`x`/`y`/`scale`) are NOT hardware-accelerated** — they run on the main thread via rAF and drop frames under load. Use the full transform string: `animate={{ transform: "translateX(100px)" }}`.
- **Don't drive child transforms via a CSS variable on the parent** — it recalculates styles for all children. Set `transform` directly on the element.
- **CSS animations beat JS under load** — they run off the main thread while the browser loads/scripts/paints. Use CSS for predetermined motion, JS/springs for dynamic/interruptible.
- **WAAPI** gives JS control at CSS performance (hardware-accelerated, interruptible, no library).
- **`will-change`** hints imminent motion — use where motion is about to happen, don't leave it on permanently.

---

## 10. Accessibility

Reduced motion means *fewer and gentler*, not zero — keep opacity/color transitions that aid comprehension, drop movement/position/parallax.

```css
@media (prefers-reduced-motion: reduce) {
  .element { transition: opacity 200ms ease; transform: none !important; }
}
@media (prefers-reduced-transparency: reduce) {
  .toolbar { background: white; backdrop-filter: none; } /* frostier/solid translucent surfaces */
}
@media (hover: hover) and (pointer: fine) {
  .element:hover { transform: scale(1.05); } /* gate hover motion — touch fires false hovers on tap */
}
```

```jsx
const reduce = useReducedMotion();
const closedX = reduce ? 0 : '-100%';
```

Also avoid full-viewport moving backgrounds and slow looping oscillations (~0.2 Hz); ease dark↔light theme changes rather than jumping brightness.

---

## 11. Polish

- **Asymmetric enter/exit** — slow where the user is deciding, fast where the system responds. A hold-to-delete fills over 2s linear; the release snaps back in 200ms ease-out.
- **Stagger group entrances** — 30–80ms between items; longer feels slow. Decorative, so never block interaction while it plays.
  ```css
  .item { opacity: 0; transform: translateY(8px); animation: fadeIn 300ms ease-out forwards; }
  .item:nth-child(2) { animation-delay: 50ms; }
  .item:nth-child(3) { animation-delay: 100ms; }
  @keyframes fadeIn { to { opacity: 1; transform: translateY(0); } }
  ```
- **Blur to mask imperfect crossfades** — when two states visibly overlap despite tuning easing/duration, add `filter: blur(2px)` during the transition to blend them into one perceived transformation. Keep blur < 20px (heavy blur is expensive, especially Safari).
- **`clip-path: inset(t r b l)`** is a powerful animation tool — each value eats in from that side. Uses: reveal-on-scroll (`inset(0 0 100% 0)` → `inset(0 0 0 0)`), hold-to-delete overlay, seamless tab color transitions (duplicate the list, clip the active copy), comparison sliders.
- **Cohesion** — match motion to the component's personality and the rest of the product. A playful component can be bouncier; a dashboard stays crisp and fast. Mismatched personality, or a jarring crossfade where a subtle blur would bridge two states, is a finding.
- **Translucent chrome** — build nav/toolbars/sheets as translucent layers (`backdrop-filter: blur()` + semi-transparent bg) with content scrolling under, not opaque bars. Never stack a light translucent surface on another. Materialize (animate blur + scale together on enter) rather than a plain opacity fade.

---

## 12. Feel-checking (when code alone can't decide)

Motion feel often can't be judged from source. When uncertain, recommend a feel-check instead of guessing:

- **Slow motion** — bump duration 2–5× or use DevTools animation inspector. Check colors crossfade cleanly, easing doesn't stop abruptly, `transform-origin` is right, coordinated properties stay in sync.
- **Frame-by-frame** — Chrome DevTools Animations panel reveals timing drift between coordinated properties.
- **Real devices** for gestures (drawers, swipe) — desktop emulation lies about touch feel.
- **Fresh eyes next day** — imperfections invisible during development surface later.

---

## 13. Vocabulary (reverse-lookup glossary)

When a user describes a motion effect without knowing its name, map the sensation to the term. Lead with the closest match; note alternates only when two genuinely compete.

**Entrances/Exits** — Fade in/out · Slide in · Scale in · **Pop in** (slight overshoot) · **Reveal** (uncover via clip-path/mask) · Enter/Exit.
**Sequencing** — Keyframes · Interpolation/Tween · **Stagger** (cascade with per-item delay) · Orchestration · Delay · Duration · Fill mode · Stepped animation.
**Transforms** — Translate · Scale · Rotate · Skew · 3D tilt/Flip · Perspective · Transform origin · **Origin-aware** (grows from its trigger, not center).
**State transitions** — Crossfade · Continuity transition · **Morph** (one shape into another) · **Shared element transition** (element travels + transforms between positions) · **Layout animation** (animates to new size/pos instead of snapping) · Accordion/Collapse · Direction-aware transition.
**Scroll** — Scroll reveal · Scroll-driven animation · Parallax · Page transition · View transition.
**Feedback** — Hover effect · **Press/Tap feedback** (subtle scale-down) · **Hold to confirm** (fill while held) · Drag · Drag to reorder · Swipe to dismiss · **Rubber-banding** (resist + snap-back past a boundary) · Shake/Wiggle (error) · Ripple.
**Easing** — Easing · Ease-out (default for UI) · Ease-in (usually avoid) · Ease-in-out · Linear (spinners/marquees only) · Cubic-bezier · Asymmetric easing.
**Springs** — Spring · Stiffness/Tension · Damping · Mass · Bounce · Perceptual duration · Momentum · Velocity · Interruptible animation.
**Ambient** — Marquee · Loop · Alternate (yoyo) · Orbit · Pulse · Float · Idle animation.
**Polish** — Blur · Clip-path · Mask (soft fadeable edges) · Before/after slider · Line drawing · Text morph · Skeleton/Shimmer · **Number ticker** · **Tabular numbers** (fixed-width digits, essential for counters) · Typewriter.
**Performance** — Frame rate (FPS) · Jank · Dropped frame · Compositing · will-change · Layout thrashing.
**Principles** — Purposeful animation · Anticipation · Follow-through · Squash & stretch · Perceived performance · Frequency of use · Spatial consistency · Hardware acceleration · Reduced motion.
