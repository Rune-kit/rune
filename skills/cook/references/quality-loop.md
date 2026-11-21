# cook — Quality loop details

> Reference for `skills/cook/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

### Remediation Cycle Counter

Every BLOCK finding gets a cycle counter. Fix → re-run → still BLOCK? Increment. **Max 3 cycles per gate** before escalation.

```
Cycle 1: fix finding → re-run gate
Cycle 2: different fix → re-run gate
Cycle 3: last attempt → re-run gate
Cycle 4: STOP. Escalate to user with all 3 failed attempts + evidence.
```

Track per-gate, not globally — preflight cycle 2 does not count against sentinel cycle 1. If the SAME finding persists across 3 cycles, the fix approach is wrong — do NOT keep trying the same strategy. Cycle 2+ MUST try a different fix than Cycle 1.

### Upstream Inconsistency Protocol

During Phase 5 quality checks, if a gate finding traces to an **upstream artifact** (plan was wrong, spec was incomplete, architecture was flawed) rather than an implementation bug:

1. Tag finding as `UPSTREAM:<phase>` (e.g., `UPSTREAM:plan`, `UPSTREAM:spec`)
2. STOP current quality gate — fixing code won't resolve an upstream problem
3. Re-invoke the upstream skill (`rune:plan` for plan issues, `rune:ba` for spec gaps) with the finding as context
4. Get user approval on the corrected upstream artifact
5. Resume Phase 5 from the beginning (re-run all gates — upstream change may invalidate prior PASS results)

## Per-Phase Rules (Project-Specific)

Projects can define phase-specific rules in `.rune/phase-rules.md` that apply ONLY during specific cook phases. These are additive — they enhance skill guidance, not replace it.

```markdown
# .rune/phase-rules.md (example)

## Phase 2: PLAN
- All API endpoints must follow REST naming convention /api/v1/<resource>
- Database changes require a rollback migration

## Phase 3: TEST
- Enforce TDD format: describe → it → arrange → act → assert
- Minimum 3 edge cases per public function

## Phase 5: QUALITY
- Review must check for N+1 queries on any ORM code
- Sentinel must verify CORS configuration on new routes
```

**Loading**: Cook reads `.rune/phase-rules.md` during Phase 0 (resume check). Rules for each phase are injected into the sub-skill's context when that phase starts. If file doesn't exist → skip silently.
