# skill-forge — Refactor techniques

> Reference for `skills/skill-forge/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

#### Pressure Types for Test Scenarios

Best tests combine 3+ pressures simultaneously:

| Pressure | Example Scenario |
|----------|------------------|
| Time | "Emergency deployment, deadline in 30 min" |
| Sunk cost | "Already wrote 200 lines, can't restart" |
| Authority | "Senior dev says skip testing" |
| Economic | "Customer churning, ship now or lose $50k MRR" |
| Exhaustion | "50 tool calls deep, context filling up" |
| Social | "Looking dogmatic by insisting on process" |
| Pragmatic | "Being practical vs being pedantic" |

#### Scenario Quality Requirements

1. **Concrete A/B/C options** — force explicit choice (no "I'd ask the user" escape hatch)
2. **Real constraints** — specific times, actual consequences, named files
3. **Real file paths** — `/tmp/payment-system` not "a project"
4. **"Make agent ACT"** — "What do you do?" not "What should you do?"
5. **No easy outs** — every option has a cost

#### Meta-Testing (When GREEN Isn't Working)

If the agent keeps failing even WITH the skill loaded, ask: "How could that skill have been written differently to make the correct option crystal clear?"

Three possible responses:
1. "Skill was clear, I chose to ignore it" → foundational principle needed (stronger HARD-GATE)
2. "Skill should have said X explicitly" → add that exact phrasing verbatim
3. "I didn't see section Y" → reorganize for discoverability (move up, add header)

#### Bulletproof Criteria

A skill is bulletproof when:
- Agent chooses correct option under maximum pressure (3+ pressures combined)
- Agent CITES skill sections as justification for its choice
- Agent ACKNOWLEDGES the temptation but follows the rule anyway

#### Persuasion Principles for Skill Language

Research (Meincke et al., 2025, 28,000 conversations) shows 33% → 72% compliance with these techniques:

| Principle | Application | Use For |
|-----------|-------------|---------|
| Authority | "YOU MUST", imperative language | Eliminates decision fatigue, safety-critical rules |
| Commitment | Explicit announcements + tracked choices | Creates accountability trail |
| Scarcity | Time-bound requirements, "before proceeding" | Triggers immediate action |
| Social Proof | "Every time", universal statements | Documents what prevents failures |
| Unity | "We're building quality" language | Shared identity, quality goals |

**Prohibited in skills:**
- **Liking** ("Great job following the process!") → creates sycophancy
- **Reciprocity** ("I helped you, now follow the rules") → feels manipulative

**Ethical test**: Would this serve the user's genuine interests if they fully understood the technique?
