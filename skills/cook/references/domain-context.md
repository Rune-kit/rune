# cook — Domain context (L4 packs)

> Reference for `skills/cook/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Phase 1.5: DOMAIN CONTEXT (L4 Pack Detection)

**Goal**: Detect if domain-specific L4 extension packs apply to this task.

<MUST-READ path="references/pack-detection.md" trigger="Phase 1.5 — before checking L4 pack mapping"/>

After scout completes, check if the detected tech stack or task description matches any L4 extension pack. This phase is lightweight — a Read + pattern match. It does NOT replace Phase 1 (scout) or Phase 2 (plan). If 0 packs match: skip silently.
