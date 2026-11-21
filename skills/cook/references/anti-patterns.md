# cook — Multi-agent anti-patterns

> Reference for `skills/cook/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Anti-Patterns

Common multi-agent failures to explicitly avoid. These are NOT edge cases — they are the most frequent cook failures in production.

| Anti-Pattern | Why It Fails | Correct Approach |
|---|---|---|
| **Bypass hierarchy** — skipping scout/plan and jumping to Phase 4 code | Builds wrong thing. Most "wasted work" traces back to missing Phase 1-2 | Follow phase gates. Even "obvious" tasks benefit from 30s of scout |
| **Resume without spec** — a `brainstorm → plan` chain produced a plan file, so Phase 0 skips to Phase 4 and `ba` never runs | Plan exists but no requirements/acceptance criteria — a plan without a spec. Ships confident code for the wrong "what" | Spec-Backfill Gate (Step 0.55): feature/greenfield resume with no `requirements.md` → run `ba`, reconcile plan, THEN resume |
| **Shadow decisions** — making architectural choices without logging to decisions.md | Next session repeats the same debate. Team agents contradict each other | Log every non-trivial choice via `decisions.md` or `journal` |
| **Gold-plating** — adding "nice-to-have" features not in the approved plan | Scope creep, delayed delivery, untested code paths | Build ONLY what's in the plan. Log extras as follow-up tasks |
| **Test-after** — writing tests after implementation instead of before (TDD violation) | Tests validate implementation bugs, not requirements. Coverage looks good but misses edge cases | Phase 3 (RED) before Phase 4 (GREEN). Always |
| **Monolithic commit** — one giant commit with all changes | Impossible to revert partially. Review is overwhelming | Commit per phase or per logical unit. Small, reviewable diffs |
| **Assumption-based implementation** — guessing requirements instead of asking | Builds the wrong thing confidently. User discovers mismatch late | If ambiguous, ask. 30s of clarification saves 30min of rework |
| **Infinite remediation loop** — fixing the same BLOCK finding 4+ times with the same approach | Wastes tokens, drifts further from solution. If 3 attempts failed, the approach is wrong | Remediation Cycle Counter: max 3 cycles, Cycle 2+ must try different strategy, Cycle 4 escalates to user |
| **Code fix for upstream problem** — fixing implementation when the plan/spec was wrong | Code "passes" but implements the wrong thing. Bug resurfaces in integration | Upstream Inconsistency Protocol: tag as UPSTREAM, re-invoke upstream skill, get approval, re-run gates |
