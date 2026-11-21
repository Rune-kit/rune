# ba — Structured elicitation frameworks

> Reference for `skills/ba/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

#### Structured Elicitation Frameworks

Choose the framework that fits the requirement type. Use it to STRUCTURE the 5 Questions above, not replace them.

| Framework | When to Use | Structure |
|-----------|------------|-----------|
| **PICO** | Clinical, research, data-driven, or A/B testing features | **P**opulation (who), **I**ntervention (what change), **C**omparison (vs what), **O**utcome (measurable result) |
| **INVEST** | User stories for sprint-sized features | **I**ndependent, **N**egotiable, **V**aluable, **E**stimable, **S**mall, **T**estable |
| **Jobs-to-be-Done** | Product features, user workflows | "When [situation], I want to [motivation] so I can [expected outcome]" |


**PICO Example (data feature):**
```
P: Dashboard users monitoring real-time metrics
I: Add anomaly detection alerts
C: vs. current manual threshold setting
O: 30% faster incident detection (measurable KPI)
```

**When to apply which:**
- Feature Request → INVEST (ensures stories are sprint-ready)
- Data/Analytics/Research feature → PICO (forces measurable outcome definition)
- Product/UX feature → Jobs-to-be-Done (keeps focus on user motivation)
- Integration → 5 Questions only (frameworks add noise for plumbing tasks)
