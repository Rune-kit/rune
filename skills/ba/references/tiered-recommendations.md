# ba — Tiered recommendations

> Reference for `skills/ba/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

### Step 6.5 — Tiered Recommendations

For product-oriented requirements (Feature Request, Integration, Greenfield), generate **tiered strategic recommendations**. This structures the path forward into actionable time horizons.

**Three Tiers:**

| Tier | Timeframe | Focus | Characteristics |
|------|-----------|-------|-----------------|
| **Quick Win** | 0-30 days | Immediate impact | Low effort, high visibility, builds momentum |
| **Differentiation** | 1-3 months | Competitive edge | Medium effort, unique value, hard to copy |
| **Long-term Moat** | 6-12 months | Sustainable advantage | High effort, defensible, compounds over time |

**For each tier, specify:**

```markdown
### Quick Win (0-30 days)
- **Action**: [Specific deliverable]
- **Resources**: [Team size, tools, dependencies]
- **Expected Impact**: [Measurable outcome]
- **Risk if skipped**: [What happens without this]

### Differentiation (1-3 months)
- **Action**: [...]
- **Resources**: [...]
- **Expected Impact**: [...]
- **Risk if skipped**: [...]

### Long-term Moat (6-12 months)
- **Action**: [...]
- **Resources**: [...]
- **Expected Impact**: [...]
- **Risk if skipped**: [...]
```

**Rules:**
- Quick Win MUST be achievable in first sprint — no dependencies on later tiers
- Differentiation should create switching costs or unique capabilities
- Long-term Moat should compound (network effects, data moats, ecosystem lock-in)
- Every tier includes "Risk if skipped" — makes trade-offs explicit
- Skip this step for Bug Fix and Refactor types (no strategic dimension)
