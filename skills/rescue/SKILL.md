---
name: rescue
description: Legacy refactoring orchestrator. Multi-session workflow to safely modernize messy codebases — autopsy, safety net, incremental surgery, and progress tracking.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L1
  model: sonnet
  group: orchestrator
---

# rescue

## Purpose

Legacy refactoring orchestrator for safely modernizing messy codebases. Rescue runs a multi-session workflow: assess damage (autopsy), build safety nets (safeguard), perform incremental surgery (surgeon), and track progress (journal). Designed to handle the chaos of real-world legacy code without breaking everything.

<HARD-GATE>
- Surgery MUST NOT begin until safety net is committed and tagged.
- ONE module per session. NEVER refactor two coupled modules simultaneously.
- Full test suite must pass before rescue is declared complete.
</HARD-GATE>

## Triggers

- `/rune rescue` — manual invocation on legacy project
- Auto-trigger: when autopsy health score < 40/100

## Calls (outbound)

- `autopsy` (L2): Phase 0 RECON — full codebase health assessment
- `safeguard` (L2): Phase 1 SAFETY NET — characterization tests and protective measures
- `surgeon` (L2): Phase 2-N SURGERY — incremental refactoring (1 module per session)
- `journal` (L3): state tracking across rescue sessions
- `plan` (L2): create refactoring plan based on autopsy findings
- `review` (L2): verify each surgery phase
- `session-bridge` (L3): save rescue state between sessions
- `onboard` (L2): generate context for unfamiliar legacy project
- `dependency-doctor` (L3): audit dependencies in legacy project

## Called By (inbound)

- User: `/rune rescue` direct invocation
- `team` (L1): when team delegates rescue work

---

## Execution

### Step 0 — Initialize TodoWrite

Rescue is multi-session. On first invocation, build full todo list. On resume, read RESCUE-STATE.md and restore todo list to current phase.

```
TodoWrite([
  { content: "RECON: Run autopsy, onboard, and save initial state", status: "pending", activeForm: "Assessing codebase health" },
  { content: "SAFETY NET: Add characterization tests and rollback points", status: "pending", activeForm: "Building safety net" },
  { content: "SURGERY [Module N]: Refactor one module with surgeon", status: "pending", activeForm: "Performing surgery on module N" },
  { content: "CLEANUP: Remove @legacy and @bridge markers", status: "pending", activeForm: "Cleaning up markers" },
  { content: "VERIFY: Run full test suite and compare health scores", status: "pending", activeForm: "Verifying rescue outcome" }
])
```

Note: SURGERY todos are added dynamically — one per module identified in Phase 0. Each module gets its own todo entry.

---

### Phase 0 — RECON

Mark todo[0] `in_progress`.

**0a. Full health assessment.**

```
REQUIRED SUB-SKILL: rune:autopsy
→ Invoke `autopsy` with scope: "full".
→ autopsy returns:
    - health_score: number (0-100)
    - modules: list of { name, path, loc, cyclomatic_complexity, test_coverage, health }
    - issues: list of { severity, file, description }
    - recommended_patterns: map of module → refactoring pattern
```

**0b. Generate project context if missing.**

```
Check: does CLAUDE.md exist in project root?
  If NO:
    REQUIRED SUB-SKILL: rune:onboard
    → Invoke `onboard` to generate CLAUDE.md with project conventions.
```

**0c. Audit dependencies.**

```
REQUIRED SUB-SKILL: rune:dependency-doctor
→ Invoke `dependency-doctor` to identify: outdated packages, security vulnerabilities, unused deps.
→ Capture: dependency report (used in surgeon prompts).
```

**0d. Save initial state.**

```
REQUIRED SUB-SKILL: rune:journal
→ Invoke `journal` to write RESCUE-STATE.md with:
    - health_score_baseline: [autopsy score]
    - modules_to_rescue: [ordered list from autopsy, worst-first]
    - current_phase: "RECON complete"
    - sessions_used: 1
    - dependency_report: [summary]

REQUIRED SUB-SKILL: rune:session-bridge
→ Invoke `session-bridge` to snapshot state for cross-session resume.

Bash: git tag rune-rescue-baseline
```

**0e. Build module surgery queue.**

```
From autopsy.modules, filter: health < 60
Sort: ascending health score (worst first)
Add one TodoWrite entry per module:
  { content: "SURGERY [module.name]: [recommended_pattern]", status: "pending", ... }
```

Mark todo[0] `completed`.

---

### Phase 1 — SAFETY NET

Mark todo[1] `in_progress`. This phase runs once before any surgery.

**1a. Characterization tests.**

```
REQUIRED SUB-SKILL: rune:safeguard
→ Invoke `safeguard` with action: "characterize".
→ safeguard writes tests that capture CURRENT behavior (even buggy behavior).
→ These tests are the rollback oracle — if they break, surgery went wrong.
→ Capture: test file paths, test count.
```

**1b. Add boundary markers.**

```
REQUIRED SUB-SKILL: rune:safeguard
→ Invoke `safeguard` with action: "mark".
→ safeguard adds inline markers to legacy code:
    @legacy     — old implementation to be replaced
    @new-v2     — new implementation being introduced
    @bridge     — compatibility shim between old and new
```

**1c. Config freeze + rollback point.**

```
REQUIRED SUB-SKILL: rune:safeguard
→ Invoke `safeguard` with action: "freeze".
→ safeguard commits current state as checkpoint.

Bash: git add -A && git commit -m "chore: rescue safety net — characterization tests + markers"
Bash: git tag rune-rescue-safety-net
```

Mark todo[1] `completed`.

---

### Phase 2-N — SURGERY (one module per session)

For each module in the surgery queue (one per session):

Mark the corresponding SURGERY todo `in_progress`.

**Sa. Pre-surgery check.**

```
Verify:
  [ ] Safety net tests pass (run characterization tests)
  [ ] Module is not coupled to another in-progress module
  [ ] Blast radius ≤ 5 files

Blast radius check:
  Bash: grep -r "import.*[module-name]\|require.*[module-name]" --include="*.ts" --include="*.js" -l
  Count files. If > 5:
    → STOP surgery on this module
    → Report: "Blast radius [N] files exceeds limit of 5 — use Strangler Fig pattern to reduce scope first"
    → Pick a smaller sub-module to start with
```

**Sb. Execute surgery.**

```
REQUIRED SUB-SKILL: rune:surgeon
→ Invoke `surgeon` with:
    - module: [module name and path]
    - pattern: [recommended_pattern from autopsy]
    - blast_radius_files: [list from pre-surgery check]
    - dependency_report: [from Phase 0]
    - characterization_tests: [paths from Phase 1]

Supported patterns:
  Strangler Fig          — for modules > 500 LOC: route traffic to new impl gradually
  Branch by Abstraction  — for replacing implementations: introduce interface first
  Expand-Migrate-Contract — for safe transitions: expand API, migrate callers, contract old API
  Extract & Simplify     — for cyclomatic complexity > 10: extract pure functions

surgeon returns: modified files list, refactoring summary, test results.
```

**Sc. Review surgery output.**

```
REQUIRED SUB-SKILL: rune:review
→ Invoke `review` with: modified files, surgeon summary.
→ review checks: code quality, pattern adherence, no regressions introduced.
→ Capture: review verdict (pass | fail | warnings).

If review verdict == fail:
  → STOP, do not commit
  → Report review findings to user
  → Revert surgeon changes: Bash: git checkout [modified-files]
```

**Sd. Run characterization tests.**

```
Bash: [project test command, e.g. npm test or pytest]
If tests fail:
  → STOP immediately
  → Report: "Characterization tests broken by surgery on [module] — reverting"
  → Bash: git checkout [modified-files]
  → Do NOT mark todo complete
  → Update RESCUE-STATE.md with failure note
```

**Se. Commit and save state.**

```
Bash: git add [modified-files]
Bash: git commit -m "refactor([module]): [pattern] — [brief description]"

REQUIRED SUB-SKILL: rune:journal
→ Update RESCUE-STATE.md:
    - module [name]: status=complete, health_before=[X], health_after=[Y]
    - sessions_used: [increment]

REQUIRED SUB-SKILL: rune:session-bridge
→ Save updated state for next session resume.
```

**Context check — before continuing to next module:**

```
If approaching context limit (50+ tool calls or user signals fatigue):
  → STOP after current module commit
  → Report: "Session limit reached. Rescue state saved. Resume with /rune rescue to continue."
  → Do NOT start next module in same session
```

Mark SURGERY todo `completed`.

Repeat for each module in queue across subsequent sessions.

---

### Phase N+1 — CLEANUP

Mark CLEANUP todo `in_progress`.

Run only after ALL surgery todos are `completed`.

**Remove boundary markers.**

```
Grep: find all @legacy, @bridge markers in codebase
  Bash: grep -rn "@legacy\|@bridge" --include="*.ts" --include="*.js" -l

For each file with markers:
  → Remove @legacy blocks (old implementation replaced)
  → Remove @bridge shims (migration complete)
  → Keep @new-v2 comments only if they add documentation value; otherwise remove
  Edit each file to strip markers.
```

**Verify markers removed.**

```
Bash: grep -rn "@legacy\|@bridge" --include="*.ts" --include="*.js"
Expected: no output. If any remain → fix before continuing.
```

```
Bash: git add -A && git commit -m "chore: rescue cleanup — remove @legacy and @bridge markers"
```

Mark CLEANUP todo `completed`.

---

### Phase N+2 — VERIFY

Mark VERIFY todo `in_progress`.

```
Bash: [full test command]
Capture: passed, failed, coverage %.

If tests fail:
  → Do NOT mark rescue complete
  → Identify which module introduced failure
  → Report: "Final verify failed: [failing test list]"
```

```
REQUIRED SUB-SKILL: rune:autopsy
→ Invoke `autopsy` again with scope: "full".
→ Capture: health_score_final.
```

**Compare health scores.**

```
health_score_baseline: [from Phase 0 RESCUE-STATE.md]
health_score_final:    [from this autopsy]
improvement:           [final - baseline]

Report:
  Rescue complete.
  Health: [baseline] → [final] (+[improvement] points)
  Modules refactored: [count]
  Sessions used: [count]
```

```
REQUIRED SUB-SKILL: rune:journal
→ Final RESCUE-STATE.md update: status=complete, health_final=[score].

Bash: git tag rune-rescue-complete
```

Mark VERIFY todo `completed`.

---

## Status Command

`/rune rescue status` — reads RESCUE-STATE.md via `journal` and presents:

```
## Rescue Dashboard
- **Health Score**: [before] → [current] (target: [goal])
- **Modules**: [completed]/[total]
- **Current Phase**: [phase]
- **Sessions Used**: [count]

### Module Status
| Module | Status | Health | Pattern |
|--------|--------|--------|---------|
| auth | done | 72→91 | Strangler Fig |
| payments | in-progress | 34→?? | Extract & Simplify |
| legacy-api | pending | 28 | TBD |
```

---

## Safety Rules

```
NEVER refactor 2 coupled modules in same session
ALWAYS run characterization tests after each surgery
Max blast radius: 5 files per session
If context low → STOP, save state via journal + session-bridge, commit partial
Rollback point: git tag rune-rescue-baseline (set in Phase 0)
```

## Constraints

1. MUST run autopsy diagnostic BEFORE planning any refactoring — understand before changing
2. MUST create safety net (characterization tests via safeguard) BEFORE any code surgery
3. MUST NOT refactor two coupled modules simultaneously — one module per session
4. MUST run full test suite after EVERY individual edit — never accumulate failing tests
5. MUST tag a safe rollback point before starting surgery
6. MUST NOT exceed blast radius of 5 files per surgical session

## Mesh Gates

| Gate | Requires | If Missing |
|------|----------|------------|
| Autopsy Gate | autopsy report with health score before planning | Run rune:autopsy first |
| Safety Gate | safeguard characterization tests passing before surgery | Run rune:safeguard first |
| Surgery Gate | Each edit verified individually (tests pass) | Revert last edit, fix, re-verify |

## Output Format

```
## Rescue Report: [Module Name]
- **Status**: complete | partial | blocked
- **Modules Refactored**: [count]
- **Tests Before**: [count] ([pass rate]%)
- **Tests After**: [count] ([pass rate]%)
- **Health Score**: [before] → [after]
- **Rollback Tag**: [git tag name]
```

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Starting surgery before safety net committed and tagged | CRITICAL | HARD-GATE: `rune-rescue-safety-net` git tag must exist before Phase 2 |
| Refactoring two coupled modules in the same session | HIGH | HARD-GATE: one module per session — split coupled modules into sequential sessions |
| Blast radius > 5 files before surgery halted | HIGH | Count importers before each surgery — stop if > 5 and split scope |
| Not saving state between sessions (rescue spans many sessions) | MEDIUM | journal + session-bridge mandatory after each session — RESCUE-STATE.md must be current |
| Continuing surgery after characterization tests fail on current code | MEDIUM | Tests must PASS on unmodified code first — fix the test if current behavior is captured wrongly |

## Done When

- autopsy complete with quantified health score and surgery queue
- safeguard characterization tests passing on current code (HARD-GATE)
- All modules in surgery queue processed (one per session)
- @legacy and @bridge markers removed from codebase (CLEANUP phase)
- Final autopsy run — health_score_final > health_score_baseline
- Rescue Report emitted with before/after health comparison and session count

## Cost Profile

~$0.10-0.30 per session. Sonnet for surgery, opus for autopsy. Multi-session workflow.
