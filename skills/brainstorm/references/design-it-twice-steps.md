# brainstorm — Design-It-Twice steps

> Reference for `skills/brainstorm/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

### Step 2.5 — Constraint Matrix Spawn (Design-It-Twice Mode only)

Spawn N=3 parallel subagents (or N=4 if dependency category is `remote-owned` / `true-external`). Each is pinned to exactly one constraint via Task tool spawn:

| Constraint ID | Pinning |
|---------------|---------|
| C1 | "Minimize the interface — aim for 1–3 entry points. Maximize leverage per entry point." |
| C2 | "Maximize flexibility — support many use cases, extension surface." |
| C3 | "Optimize for the most common caller — make the default case trivial. Rare cases pay cost." |
| C4 | "Design around ports and adapters for cross-seam dependencies." (only when applicable) |

Use the spawn prompt template from [references/design-it-twice.md](design-it-twice.md). Include CONTEXT.md domain terms in the prompt so each design names things consistently with project domain language.

Each subagent returns a YAML block: interface, usage example, what's hidden, dependency strategy/adapters, tradeoffs.

### Step 3.75 — Decorrelated Judgment (council, Design-It-Twice Mode only)

The diversity score (Step 3.5) measures how DIFFERENT the candidate designs are — it says nothing about which one is BEST. For high-stakes interface decisions, that judgment call benefits from a second architecture's opinion, the same discipline `adversary` Step 0.6 and `review` Step 1.6 already apply.

**Trigger — call council (mode=judge) when ANY of:**
- N=4 was spawned (dependency category `remote-owned` or `true-external`, per Step 2.5 — the same tier that already signals higher stakes)
- Diversity landed in the 0.4–0.59 marginal band (Step 3.5) and a re-spawn still didn't clearly separate the candidates
- User explicitly asks for a second opinion on which design to pick

**Do NOT call council for**: routine Design-It-Twice runs where diversity ≥ 0.6 on an in-process/local-substitutable dependency (N=3) — this is opt-in overhead on top of the existing subagent fan-out, not a default tax on every design-it-twice run.

**Request**: `{ question: <the candidate designs' interface/usage/tradeoffs YAML + "which design is strongest given constraints X">, mode: "judge", n: 3, diversity: { prefer_model_families: true }, evidence_required: [reasoning] }`. Self-contained — council's voices never saw the subagent spawns.

**Consume**: fold `agreement.consensus_claims` into Step 4's recommendation as a `[council-verified]` signal alongside (never instead of) the diversity score. Fold `agreement.dissent` into the hedge condition, tagged `[council-dissent]`. If `decorrelation: NO_DECORRELATION`, say so plainly — do NOT describe the judgment as independent confirmation from same-family subagents; the diversity-score mechanism remains the primary signal in that case.
