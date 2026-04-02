---
name: "component-patterns"
pack: "@rune/ui"
description: "Component architecture patterns — compound components, render props, composition, slots. Detects prop-heavy components and guides refactoring toward composable, maintainable architectures."
model: sonnet
tools: [Read, Edit, Write, Grep, Glob, Bash]
---

# component-patterns

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

**Step 5 — Bento Card Archetypes**

When designing card-based layouts, apply named archetypes instead of uniform grids. Each archetype has a specific interaction model and animation signature. Mix archetypes within a page to create visual hierarchy.

| Archetype | Content Type | Layout | Interaction | Animation |
|-----------|-------------|--------|-------------|-----------|
| **Intelligent List** | Ranked/sortable items (leaderboard, top assets, recent activity) | Vertical stack, auto-reorders | Drag to reorder, click to expand | `layoutId` shared animation on reorder — items slide to new position (Framer Motion `layout` prop) |
| **Command Input** | Search, AI prompt, quick actions | Single input + dropdown results | Type to filter, keyboard nav, Enter to execute | Typewriter placeholder text + shimmer gradient on focus + results fade-in with 50ms stagger |
| **Live Status** | Real-time metrics (uptime, price, active users) | Compact card, number-dominant | Hover for sparkline/history | Breathing pulse on idle (opacity 0.85↔1, 3s), overshoot scale on value change (spring) |
| **Wide Data Stream** | Horizontal feed (news, transactions, timeline) | Full-width horizontal scroll or infinite carousel | Swipe/drag, auto-advance optional | Infinite scroll with momentum, snap to item, fade edges to signal overflow |
| **Contextual Panel** | Detail view, settings, metadata | Expandable from parent card or sidebar | Click parent → panel slides in | Stagger children (50ms each), float-in from right (translateX 24px → 0) |

**Anti-patterns for card layouts:**
- ❌ **Uniform grid** — all cards same size, same padding, same content structure = AI signature
- ❌ **Card soup** — cards with no clear grouping or hierarchy
- ❌ **Static bento** — bento layout without interaction model = decorative, not functional

**Composition rules:**
1. A page should use 2-4 archetypes max — more = visual noise
2. **Live Status** cards cluster together (dashboard KPI row)
3. **Intelligent List** is the primary content area — usually takes 60%+ of viewport
4. **Command Input** is a singleton — ONE per page, always accessible (often pinned top or Cmd+K)
5. **Wide Data Stream** breaks vertical rhythm — use as section separator between dense blocks
6. **Contextual Panel** is secondary — triggered by interaction, never shown by default on load

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
