# cook — Plan-phase gates (RFC, adversary)

> Reference for `skills/cook/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

### Phase 2.5: RFC GATE (Breaking Changes Only)

**Goal**: Formal change management for breaking changes. Prevents unreviewed breaking changes from reaching production.

<MUST-READ path="references/rfc-template.md" trigger="Phase 2.5 — any time a breaking change is detected in the plan"/>

> **HARD-GATE** — this gate stays in `SKILL.md` (always loaded) under the section of the same name; it applies here unchanged.

### Phase 2.5: ADVERSARY (Red-Team Challenge)

**Goal**: Stress-test the approved plan BEFORE writing code — catch flaws at plan time, not implementation time.

**REQUIRED SUB-SKILL**: Use `rune:adversary`

1. **Skip conditions**: bug fixes, hotfixes, simple refactors (< 3 files, no new logic), fast mode
2. **Run adversary** — Full Red-Team mode for new features/architectural changes; Quick Challenge mode for smaller plans
3. **Handle verdict**:
   - **REVISE** → return to Phase 2 with adversary findings as constraints; user must re-approve
   - **HARDEN** → present remediations, update plan inline, then proceed to Phase 3
   - **PROCEED** → pass findings as implementation notes to Phase 3
4. **Max 1 REVISE loop** per cook session — if revised plan also gets REVISE, ask user to decide
