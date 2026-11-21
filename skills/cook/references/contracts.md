# cook — Data flow, mesh gates, output and ownership contracts

> Reference for `skills/cook/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Data Flow

**Feeds Into →** `journal` (decisions → ADRs) | `session-bridge` (context → .rune/ state) | `neural-memory` (learnings → cross-session)

**Fed By ←** `ba` (requirements → Phase 1) | `plan` (master plan → Phase 2-4) | `session-bridge` (.continue-here.md → Phase 0 resume) | `neural-memory` (past decisions → Phase 0 recall)

**Feedback Loops ↻** cook↔debug (Phase 4 bug → debug → fix → resume; if plan wrong → Approach Pivot) | cook↔test (RED → GREEN → failures loop back)

## Mesh Gates

| Gate | Requires | If Missing |
|------|----------|------------|
| Resume Gate | Phase 0 checks for master plan before starting | Proceed to Phase 1 |
| Spec-Backfill Gate | Feature/greenfield resume requires `requirements.md` to exist alongside the plan | Plan without spec → invoke `rune:ba` to backfill, reconcile plan, THEN resume |
| Scout Gate | scout output before Phase 2 | Invoke rune:scout first |
| Plan Gate | User-approved plan before Phase 3 | Cannot proceed |
| Adversary Gate | adversary verdict before Phase 3 for features | Skip for bugfix/hotfix/refactor |
| Phase File Gate | Active phase file only (multi-session) | Load only active phase |
| Test-First Gate | Failing tests before Phase 4 | Write tests or get explicit skip |
| Quality Gate | preflight + sentinel + review before Phase 7 | Fix findings, re-run |
| Verification Gate | lint + types + tests + build green before commit | Fix, re-run |
| Convergence Gate | `convergence.clean` (or documented escalation) before Phase 7 for features with requirements.md | Execute CV tasks, re-verify, re-converge (max 2 rounds) |

## Output Format

<MUST-READ path="references/output-format.md" trigger="before emitting the Cook Report at end of any session"/>

Emit a Cook Report with: Status, Phases, Files Changed, Tests, Quality results, Commit hash.
When invoked by `team` with a NEXUS Handoff, include the Deliverables table — MANDATORY.

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| Plan files (master + phase) | Markdown | `.rune/plan-<feature>.md`, `.rune/plan-<feature>-phase<N>.md` |
| Implementation code | Source files | Per plan file paths |
| Test files | Source files | Co-located or `__tests__/` per project convention |
| Verification results | Inline stdout | Shown in Cook Report |
| Cook Report | Markdown (inline) | Emitted at end of session |
| Session state | Markdown | `.rune/decisions.md`, `.rune/progress.md`, `.rune/conventions.md` |

## Document Ownership

| Scope | Access | Files |
|-------|--------|-------|
| **Owns** (read + write) | `.rune/plan-*.md`, `.rune/progress.md`, `.rune/decisions.md`, `.rune/conventions.md`, source files per approved plan |
| **Reads** (never writes) | `CLAUDE.md`, `SKILL.md` (any), `.rune/contract.md`, `.rune/checkpoint.md` |
| **Never modifies** | `compiler/**`, `extensions/**`, `PACK.md`, other skills' `SKILL.md`, `.rune/learnings.jsonl` |

When delegating to sub-skills (scout, plan, test, review), each sub-skill owns its own output. Cook coordinates but does not overwrite sub-skill artifacts.

## Self-Validation

```
SELF-VALIDATION (run before emitting Cook Report):
- [ ] Every phase in Phase Skip Rules was either executed or explicitly skipped with reason
- [ ] Plan approval gate was not bypassed — user said "go" (check conversation history)
- [ ] No Phase 4 code was written before Phase 3 tests (TDD order preserved)
- [ ] All Phase 5 quality gates (preflight, sentinel, review) ran — not just claimed
- [ ] Phase 6.5 converge ran for features with requirements.md — or skip announced (no spec) / escalation documented
- [ ] No quality gate exceeded 3 remediation cycles without user escalation
- [ ] No upstream issue was fixed by code change alone — UPSTREAM findings re-invoked the source skill
- [ ] Cook Report contains actual commit hash, not placeholder
```
