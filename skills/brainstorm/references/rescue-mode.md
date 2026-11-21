# brainstorm — Rescue mode

> Reference for `skills/brainstorm/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

### Rescue Mode
Activated when an approach has been tried and **fundamentally failed** — not a bug, but a wrong approach. Rescue mode forces **category-diverse** alternatives instead of variants of the failed approach.

**Rescue Mode triggers:**
- `cook` Phase 4: Approach Pivot Gate fires (3 debug-fix loops exhausted + re-plan still fails)
- `debug`: 3-Fix Escalation Rule fires AND root cause is "approach doesn't work" (not a bug in implementation)
- `fix`: 3 fix attempts fail AND each attempt reveals a different blocker (systemic, not localized)
- Manual: `/rune brainstorm rescue <what failed and why>`

**Rescue Mode input:**
```
mode: "rescue"
failed_approach: string     — what was tried
failure_evidence: string[]  — concrete reasons it failed (error messages, blockers, dead ends)
original_goal: string       — what we're still trying to achieve
```

**Rescue Mode constraints:**
1. MUST generate 3-5 approaches (more than Discovery's 2-3 — wider net)
2. Each approach MUST be a **different category**, not a variant of the failed one
3. At least 1 approach must be "unconventional" (hacky, wrapper, reverse-engineer, proxy, etc.)
4. MUST use Collision-Zone Thinking or Inversion Exercise — conventional thinking already failed
5. MUST explicitly state why each approach is a **different category** from the failed one
6. Failed approach MUST be listed as "Option X (FAILED)" — visible reminder not to loop back

**Category examples** (approaches in different categories):
```
Direct API call ≠ Wrapper/middleware layer ≠ Reverse engineering ≠ Browser automation
  ≠ Extension/plugin ≠ Proxy/bridge service ≠ Alternative tool entirely
```
