# design — UI design contract (UI-SPEC.md)

> Reference for `skills/design/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

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

> **HARD-GATE** — this gate stays in `SKILL.md` (always loaded) under the section of the same name; it applies here unchanged.
