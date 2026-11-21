# plan — Feature spec and roadmap modes

> Reference for `skills/plan/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Feature Spec Mode

**Step 1** — Problem Statement: what problem, who has it, current workaround?
**Step 2** — User Stories: primary + 2-3 secondary + edge cases. Format: `As a [persona], I want to [action] so that [benefit]`
**Step 3** — Acceptance Criteria: `GIVEN [context] WHEN [action] THEN [result]` — happy path + errors + performance
**Step 4** — Scope Definition: In scope / Out of scope / Dependencies / Open questions
**Step 5** — Write Spec File: save to `.rune/features/<feature-name>/spec.md`

After spec approved → transition to Implementation Mode.

## Roadmap Mode

**Step 1** — Inventory: scan for open issues, TODO/FIXME, planned features.
**Step 2** — Prioritize (ICE Scoring): Impact × Confidence × Ease (each 1-10), sort descending.
**Step 3** — Group into Milestones: M1 = top 3-5 by ICE, M2 = next 3-5, Backlog = remaining.
**Step 4** — Write to `.rune/roadmap.md`.
