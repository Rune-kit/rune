# design — Output format example

> Reference for `skills/design/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

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
