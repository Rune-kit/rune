# cook — Phase 6.5 converge

> Reference for `skills/cook/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Phase 6.5: CONVERGE (Spec↔Code Gap Scan)

**REQUIRED SUB-SKILL**: Use `rune:converge` — verify the ACTUAL codebase matches the spec before committing.

**Trigger**: feature/greenfield chains where `.rune/features/<name>/requirements.md` exists.
**Skip** (announce the skip): nano/fast/bugfix/refactor/hotfix chains, or no requirements.md (ad-hoc task — Phase 5 gates are the only protection).

1. Invoke `rune:converge` — it re-reads spec/plan/contracts as sole intent, scans present code state, classifies gaps (`missing` / `partial` / `contradicts` / `unrequested`)
2. **`convergence.clean`** → proceed to Phase 7
3. **`convergence.gaps`** → inspect the signal's `counts` payload first:
   - **Unrequested-only** (`counts.missing`=0, `counts.partial`=0, `counts.contradicts`=0, `counts.unrequested`>0): no CV tasks were appended — surface the findings in the Cook Report and proceed to Phase 7. Do NOT enter the remediation loop for informational scope-creep findings
   - **Otherwise**: converge appended `CV-*` remediation tasks to the active phase file:
     - Execute the CV tasks (return to Phase 4 loop for them; CRITICAL/HIGH first)
     - Re-run Phase 6 VERIFY on the remediated code, then re-invoke converge (round 2)
     - **Max 2 remediation rounds.** Gaps still present after round 2 → produce a Structured Escalation Report (the same gap surviving 2 rounds means the approach is wrong, not the effort)
4. `unrequested` findings are surfaced to the user in the Cook Report — never silently deleted, never blocking
5. **Stale CV tasks**: if converge reports clean but unchecked `CV-*` tasks remain from earlier rounds (e.g., rules changed between rounds), cook closes them as `[x] (resolved — superseded)` with a Cook Report note — converge's append-only contract means only cook may touch them

> **HARD-GATE** — this gate stays in `SKILL.md` (always loaded) under the section of the same name; it applies here unchanged.
