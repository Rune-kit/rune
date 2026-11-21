# design — 6-pillar visual audit

> Reference for `skills/design/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

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
