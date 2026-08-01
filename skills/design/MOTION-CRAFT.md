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

- Entering or arriving → **`ease-out`** (starts fast, feels responsive)
- Moving / morphing on screen → **`ease-in-out`**
- Hover / color change → **`ease`**
- Constant motion (marquee, progress, spinner) → **`linear`**
- A released object still travelling (spin, tumble, coin flip) → **`linear`** — nothing torques an object in flight, so angular velocity is constant. Easing a free spin is the standard tell of a fake.
- Departing the frame, or falling → **`ease-in`** (the exception below)
- Default → **`ease-out`**

**`ease-in` is wrong on arrival, right on departure.** On anything the user is waiting to *see*, it starts slow and delays the exact moment they are watching most closely — `ease-out` at 200ms feels faster than `ease-in` at 200ms. But a thing that leaves does not leave at its slowest, and gravity accelerates. Two legitimate uses:

| Situation | Curve |
| --- | --- |
| Departing / exiting the frame | `cubic-bezier(0.45, 0, 0.9, 0.35)` |
| Falling under gravity | `cubic-bezier(0.55, 0, 0.9, 0.45)` |

Watch for `ease-in` hiding inside a composed curve: `smootherstep` begins at zero velocity, which is `ease-in` under another name.

Built-in CSS easings are too weak — they lack the punch that reads as intentional. Use strong custom curves:

```css
--ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1);  /* punchy ease-out for deliberate UI interactions */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);      /* strong ease-in-out for on-screen movement */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);       /* iOS-like drawer/sheet curve */
```

These are the *punchy* variants for deliberate, high-attention motion. The baseline `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` in `DESIGN-REFERENCE.md` remains the general-purpose default; reach for `--ease-out-strong` when an interaction needs extra snap. Don't hand-roll curves from scratch — start from a known strong variant and tune.

### Large travel: choose by peak slope, not by name

The rules above pick a curve by *feel*, which is correct for the short distances most UI covers. For a large rotation or a long translate they are not enough: the curve's name tells you nothing about whether the motion will strobe. What decides that is peak speed, and peak speed comes from the curve's maximum slope.

```
peak = maxSlope × travel / duration
```

| Curve | Max slope |
| --- | --- |
| `cubic-bezier(0.45, 0, 0.55, 1)` (sine-ish) | **1.82** |
| `cubic-bezier(0.33, 1, 0.68, 1)` | 3.03 |
| `cubic-bezier(0.77, 0, 0.175, 1)` (`--ease-in-out`) | 4.95 |
| `cubic-bezier(0.19, 1, 0.22, 1)` (ease-out-expo) | **5.26** |

**Aliasing ceiling:** a thin asymmetric part — a clock hand, a needle, a spoke — stops reading as itself past roughly **30°/frame**, i.e. 1800°/s at 60fps.

So a 360° turn on the expo curve needs **~1050ms** to stay under the ceiling, while the sine-ish curve does it in **~365ms**. Same rotation, 2.9× apart, and nothing in the code reveals it. **When a spinner or a large turn strobes, the fix is almost always the curve, not the duration** — and `--ease-out-strong` (slope ≈4.3) is a bad default for exactly this case.

**A rotationally symmetric part aliases at a fraction of its own repeat, not at 30°/frame.** A six-lobed shape has a 60° pitch: a frame step near 30° makes the direction ambiguous, and at 60° it looks like it never moved at all. Keep the step under **a third of the repeat** — 20°/frame for six-fold. Count the symmetry before picking a duration.

### Velocity continuity across keyframe joins

A move that passes through an intermediate pose becomes two keyframe segments. Ease both and the element **decelerates to a dead stop at the join** and sets off again — a hitch that is invisible in the source and obvious at 4× slow motion. "Moving on screen → `ease-in-out`" applies to the move *as a whole*; once you split it, hand the velocity across the seam.

For a bezier, start slope is `y1/x1` and end slope is `(1−y2)/(1−x2)`. With `avg = distanceFraction / timeFraction` per segment, solve:

```
endSlope₁ × avg₁ = startSlope₂ × avg₂
```

Per-segment control lives *inside* the keyframe — `animation-timing-function` there governs the segment that **starts** at that keyframe, not the one that ends there.

**Verify by measuring, not by reading the curve names.** Sample the delivered motion off the browser's own computed matrix across a paused run and differentiate it — `Math.atan2(m.b, m.a)` for rotation, `m.e`/`m.f` for translate. Unwrap the angle first or every wrap reads as a spike. Three questions the numbers answer that the render cannot: peak speed (aliasing), minimum speed inside a beat meant to stop (a "hold" that never actually stops), and any ratio between two parts you claimed but did not enforce.

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

Reduced motion is not about removing animation. It is about **deciding what remains when the animation disappears** — and that decision is made per animation, from its role, not by a blanket "gentler everywhere" rule.

### Ask the role first

> **Is the motion sequence the content, or is it decorating a result that exists either way?**

| Answer | Alias | Under reduce |
| --- | --- | --- |
| The sequence **is** the content | Communicative | Keep the **destination**; drop or rewrite the journey |
| It decorates a result that exists either way | Decorative | Bail, or collapse the transition — no substitute owed |

Communicative: expand/collapse that reveals structure, a scroll-linked story where cards take turns, a menu↔close icon swap, progress with no honest still equivalent. Decorative: custom cursor flourish, parallax depth, hover bounce, a staggered reveal on an already-complete layout.

### Then pick one of four strategies

| # | Strategy | When | Under reduce it **looks like** |
| --- | --- | --- | --- |
| 1 | **Bail** | Pure decoration, no honest reduced form | Effect is **gone** — OS cursor back, no custom layer |
| 2 | **Snap to end state** | Sequence is the content (staged journey) | The **same final layout** as the animation's last frame — no travel, no mid-poses piled up |
| 3 | **Collapse transition** | Motion only decorates a result already in the DOM | Control **appears in place** (tab pill, underline) — instant, not a slide |
| 4 | **Reduce complexity** | Cost/layers/autoplay are the problem, not duration | **Same silhouette**, cheaper — fewer blur layers, autoplay off, fewer clones |

**Do not blur 2 and 3.** If the destination is already in app state and motion was only the travel (which tab is active), that is **3**. If the destination is a multi-pose journey you must *write* (scroll-staged enter → flip → dismiss, icon A must become B), that is **2** — zeroing durations alone teleports the UI through every mid-pose at once.

**Strategy 4 is not a substitute for 2.** Dropping layers does not replace an end-state applicator. And if there is no honest reduced form at all, that is **1**, not 4.

**Always, on top of the four** — read the preference **live**, with a `change` listener (or the library equivalent: `gsap.matchMedia`, Framer `MotionConfig` / `useReducedMotion`). A one-shot `.matches` at mount goes stale the moment the user toggles the OS setting mid-session.

### Failure modes that grep clean

`prefers-reduced-motion` appearing in a file proves almost nothing. **Touches ≠ reachable ≠ correct.**

| Failure | Why it hurts | Fix |
| --- | --- | --- |
| **Dead reduce branch** — an outer `if (reduced) return` runs *before* the end-state helper | Reduced users get the raw default DOM: overlapping layers, wrong transforms, no meaning | Gate only on "is there content to show?"; let the inner setup pick full motion vs snap |
| **`duration: 0` on sequence-as-content** | The browser applies every key pose in one frame — stacked/teleported UI, not "same destination, no journey" | Strategy 2: write one end state, skip building the journey driver |
| **`0s` while something awaits completion** | Some engines drop `transitionend` / `animationend` / `onComplete` for true zero-length transitions; state machines hang | Use `~0.01ms` when anything listens; a true instant write (`gsap.set`, snap styles) when nothing does |
| **Blanket `* { animation-duration: 0 !important }` alone** | Over-removes feedback that should survive — short opacity fades, focus-ring transitions, essential loading cues | Optional backstop at `0.01ms` + `animation-iteration-count: 1`, then intentional per-component strategies on top |
| **JS motion ungated** | CSS media queries cannot stop a GSAP/Motion/Lenis/canvas timeline | The same live preference boolean gates library setup; destroy scroll hijackers under reduce |

Two cases the blanket approach gets wrong in the other direction: a **state-change swap** (menu→cross) is communicative — keep it, make it instant, never leave the old glyph on screen. A **spinner that means "loading"** is essential motion with no still equivalent — slow it before killing it.

### Patterns

Note what these are: **per-component implementations of a chosen strategy**, scoped to a class — not a global switch. `transform: none` on one element is strategy 1 or 3 for that element. The same declaration applied with `*` is the blanket rule warned about above.

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

**Hazard overlay** (secondary — role first, hazard second): large viewport translate/parallax/zoom/spin and smooth-scroll hijack are removed under reduce (usually alongside strategy 1 or 2). Autoplay continuous motion >5s needs a pause control regardless of preference (WCAG 2.2.2), default paused under reduce. Flashing >3×/sec never ships.

**Verify both states, never grep alone.** Exercise the UI with the preference on *and* off, and assert **meaning**, not absence of movement: bail → effect absent from the DOM; snap → the final transforms/positions are present; collapse → active styles applied with no travel; complexity → fewer layers / autoplay stopped. For collapse/expand chrome check `aria-expanded` and the visible open-closed cue still read correctly. Toggle the emulation with the page still open — a stale path until refresh is a live-preference failure.

---

## 11. Polish

- **Asymmetric enter/exit** — slow where the user is deciding, fast where the system responds. A hold-to-delete fills over 2s linear; the release snaps back in 200ms ease-out. As a house rule, **exits run ~20% faster than entrances**.
- **Anticipation is not optional** on anything that throws, launches, or shakes. ~**40–50ms** and about **1.5px** of wind-up in the opposite direction before the move. Without it the object reads as teleporting — and a percentage of a very short beat is not enough; anticipation needs real milliseconds.
- **Impact is not optional either.** Something that lands squashes against its base — `transform-origin` at the base, not the middle, or it pinches in midair — rebounds past its resting height, then settles. Three keyframes, roughly **30% of the clock**.
- **Decay ratios.** Each swing ~**0.6–0.7** of the previous, three or four swings, landing exactly on zero. A decay that does not visibly decay reads as a wobble, not a settle.
- **Beats do not overlap.** Where a gesture has stages, let each finish before the next starts — overlapping them produces one muddled event instead of several readable ones. Beats under ~**250ms** blur into a single event regardless.
- **Never stop a spin by animating it back to 0** — it visibly rewinds. Let it run and hide it, or end on a rotation that maps the shape onto itself.
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

---

## 14. SVG motion mechanics

Everything above applies to SVG. These are the rules that apply *only* to it — the ones that make an animated glyph behave identically at 24px and 96px instead of drifting, clipping, or being silently destroyed by the build.

### Units — why one keyframe set can serve every size

| Where the transform lives | What `10px` means | Scales with icon size? |
| --- | --- | --- |
| On an SVG child (`<path>`, `<g>`, `<circle>`) | 10 **user units** in the local viewBox | **Yes, free** |
| On the root `<svg>` or an HTML wrapper | 10 real screen pixels | **No** |
| `perspective`, `translateZ` | real screen pixels, always | **No** — derive from `size` |
| `vector-effect: non-scaling-stroke` width | real CSS pixels | **No** |

In a 24-unit viewBox, `translateX(2px)` on a path is **2 of 24 units** — one twelfth of the glyph at any render size. The same literal in a 256-unit box is one 128th. **A number is meaningless without its viewBox; always state which box you are in.**

**Rule: no transform on the root `<svg>` or an HTML wrapper unless the value is computed from the rendered `size`.** Anything that genuinely needs a wrapper (3D perspective, an arc that must not share a timing function with a spin) computes its px in JS.

Related: put transforms on a wrapper `<g>` rather than the shape itself, and set `transform-box: fill-box` when you want `transform-origin` to mean "this element's own box" instead of the SVG user-space origin — the default catches out almost everyone rotating a part in place.

### Rest must live in a base rule

Declare the resting state in a normal CSS rule, **not only in the `0%` keyframe**. An element whose rest exists only inside the keyframes snaps to a broken pose the moment the animation is removed — which is exactly what `@media (prefers-reduced-motion: reduce) { animation: none }` does. This one property is what makes the flat reduce gate safe (§10, strategy 1) instead of a per-icon audit.

The same rule makes frame 0 and the final frame comparable: an animation that ends 0.4% off its start drifts visibly when the user hovers the same element repeatedly.

### Stroke and path

- **`pathLength="1"`** on a path makes `stroke-dasharray` / `stroke-dashoffset` talk in 0→1 fractions instead of arc lengths — the same keyframes then work on any path, any size.
- **A zero-length dash renders as a round-capped dot.** Use `0.001`, never `0`.
- **Closed paths need `1.02`, not `1`,** to hide fully — the join needs the overshoot.
- **A compound path draws all its subpaths simultaneously.** Multiple `M` subpaths in one `d` share one dash pattern; split into separate `<path>` elements to sequence them.
- **Never `linear` on a draw-on.** A pen accelerates into a stroke and decelerates out — `cubic-bezier(0.45, 0, 0.15, 1)`. Linear is a progress bar, and it is the most common defect in animated-icon libraries.

### Duplicate ids

If the icon can appear twice on one page, `mask="url(#m)"` in both copies resolves to the **first** `#m` in the document — every instance silently renders the first one's mask. Rewrite ids per instance (`useId` or equivalent) at runtime, or `prefixIds` at build time when many icons are inlined into one document. This also silently fakes any frame strip you capture for review.

### SVGO will undo this work

An animated SVG that passes every check can be destroyed by the build pipeline. SVGO's default preset strips exactly the structure the animation depends on. If animated SVG goes through SVGO, disable:

| Plugin | What it breaks |
| --- | --- |
| `cleanupIds` | renames the ids `mask` / `clipPath` `url(#…)` point at — the cut silently stops applying |
| `mergePaths` | fuses separately-animated parts back into one compound path |
| `convertShapeToPath` | turns an unambiguous `<circle>` into an arc pair, where the sweep/large-arc flags can pick the wrong candidate circle |
| `removeHiddenElems` | deletes parked animation content that is legitimately invisible at rest |
| `inlineStyles` | erases the class hooks the keyframes target |
| `removeViewBox` | breaks the user-unit scaling that makes one keyframe set serve every size |

This failure ships green: source is correct, tests pass, production is broken.

### Sizing and framing

An SVG renders its viewBox into a square, so a non-square or over-wide viewBox silently shrinks the glyph — a 142-wide box scales content by `40/142 ≈ 0.28` while every 96-box glyph gets `40/96 ≈ 0.42`, and the same drawing reads faint and small with nothing in the code explaining why. Frame a **square viewBox on the resting ink**, centred on it — not on the artboard, and not on the gesture's full excursion; let overflow leave the frame.

**`getBBox()` lies about optical size** — it includes parked and hidden animation content. To size a glyph, measure ink from rendered pixels at rest.

### Prove clearance before writing keyframes

When two parts move near each other, do not judge by eye whether they stay apart. Model each element's track, step it, and report the minimum gap — two minutes of work that turns "I think this works" into a number, *before* any CSS exists.

- **The floor is the drawing's own resting gap.** Whatever separation the artwork already uses is the least the eye will accept from it.
- **Measure margins off the ink, not the centreline.** A stroke hangs half its width either side of its path: a line spanning y94–114 at width 6 occupies y91–117.
- **Anything that must land exactly where it started should travel a whole number of rendered pixels** — a step of `S` user units renders as `S × size / viewBox` px. Land on a fraction and the returned element carries an antialias fringe the resting one did not have: same shape, different subpixel phase.
- The best outcome of a clearance sweep is discovering nothing has to occlude anything — then nothing can halo.
