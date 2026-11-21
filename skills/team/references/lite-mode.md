# team — Lite mode

> Reference for `skills/team/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

### Lite Mode

For small parallel tasks that don't warrant full worktree isolation:

```
Lite Mode Rules:
  - Max 2 parallel agents (haiku coordination, sonnet workers)
  - NO worktree creation — agents work on same branch
  - File ownership still enforced (disjoint file sets)
  - Simplified merge: sequential git add (no merge conflicts possible with disjoint files)
  - Skip Phase 3 (COORDINATE) — no conflicts with disjoint files
  - Skip integrity-check — small scope, direct output review
  - Coordinator model: haiku (not opus) — saves cost

Lite Mode Phases:
  Phase 1: DECOMPOSE (haiku) — identify 2 streams with disjoint files
  Phase 2: ASSIGN — launch 2 parallel Task agents (sonnet, no worktree)
  Phase 4: MERGE — sequential git add (no merge needed)
  Phase 5: VERIFY — integration tests on result
```

**Announce mode**: "Team lite mode: 2 streams, ≤5 files, no worktrees needed."
**Override**: User can say "full mode" to force worktree isolation.
