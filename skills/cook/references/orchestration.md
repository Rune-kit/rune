# cook — Orchestration details

> Reference for `skills/cook/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Phase 1.7: WORKFLOW ORCHESTRATION (Multi-Skill Sequences)

**Goal**: If Phase 1.5 detected a pack AND the task maps to a named workflow, orchestrate the multi-skill sequence.

**Trigger**: Only runs if Phase 1.5 found a pack match AND the pack's Workflows table has a matching command.

<MUST-READ path="references/pack-detection.md" trigger="Phase 1.7 — workflow command detection section"/>

1. Read the matched PACK.md's Workflows section
2. Identify the workflow name and skill sequence
3. For each skill in sequence:
   a. Load the skill file from the pack's `skills/` directory
   b. Execute the skill's workflow steps
   c. Write output artifact to `.rune/<domain>/` (e.g., `.rune/hr/jd-[role]-[date].md`)
   d. The next skill reads the previous artifact as input context
4. After all skills complete: summarize the workflow results to the user

**Threading state**: Each skill in the sequence produces an artifact file. The next skill's Step 1 reads existing artifacts from `.rune/<domain>/`. This is already built into each skill — no new plumbing needed.

**Skip if**: No workflow match found in Phase 1.5. Single-skill tasks proceed directly to Phase 2 (PLAN) as normal.

### Phase-Aware Execution (Master Plan + Phase Files)

When `rune:plan` produces a **master plan + phase files** (non-trivial tasks):

1. After plan approval: load ONLY Phase 1's file — do NOT load all phase files
2. Execute through cook Phase 3-6 (test → implement → quality → verify)
3. After phase complete: mark tasks done, update master plan status `⬚ → ✅`, announce "Phase N complete. Phase N+1 ready for next session."
4. Next session: Phase 0 detects master plan → loads next phase → executes

> **HARD-GATE** — this gate stays in `SKILL.md` (always loaded) under the section of the same name; it applies here unchanged.
