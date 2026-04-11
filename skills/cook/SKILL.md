---
name: cook
description: "Feature implementation orchestrator. ALWAYS use this skill for ANY code change — implement, build, add feature, create, fix bug, or any task that modifies source code. This is the default route for 70% of all requests. Runs full TDD cycle: understand → plan → test → implement → quality → verify → commit."
context: fork
agent: general-purpose
metadata:
  author: runedev
  version: "2.4.0"
  layer: L1
  model: sonnet
  group: orchestrator
  tools: "Read, Write, Edit, Bash, Glob, Grep"
  emit: phase.complete, checkpoint.request
  listen: plan.ready, review.complete, ideas.ready, preflight.passed, verification.complete
---

# cook

## Purpose

The primary orchestrator for feature implementation. Coordinates the entire L2 mesh in a phased TDD workflow. Handles 70% of all user requests — any task that modifies source code routes through cook.

<HARD-GATE>
Before starting ANY implementation:
1. You MUST understand the codebase first (Phase 1)
2. You MUST have a plan before writing code (Phase 2)
3. You MUST write failing tests before implementation (Phase 3) — unless explicitly skipped
This applies to EVERY feature regardless of perceived simplicity.
</HARD-GATE>

## Workflow Chains (Predefined)

Cook supports predefined workflow chains for common task types. Use these as shortcuts instead of manually determining phases:

```
/rune cook feature    → Full TDD pipeline (all phases)
/rune cook bugfix     → Diagnose → fix → verify (Phase 1 → 4 → 6 → 7)
/rune cook refactor   → Understand → plan → implement → quality (Phase 1 → 2 → 4 → 5 → 6 → 7)
/rune cook security   → Full pipeline + sentinel@opus + sast (all phases, security-escalated)
/rune cook hotfix     → Production Hotfix Protocol: contain → fix → verify → deploy → watchdog → postmortem (see below)
/rune cook nano       → Trivial: do → verify → done (no phases, ≤3 steps)
/rune cook --template <name> → Load pre-built workflow template from installed Pro/Business packs
```

### Production Hotfix Protocol

When `hotfix` chain is active AND triggered from a live incident (not a dev-time fix), follow the full orchestrated chain — not just fix → verify → commit.

```
FULL HOTFIX CHAIN (when incident is active):

1. CONTAIN   → `rune:incident` (if not already running): triage + contain blast radius first
2. BRANCH    → create hotfix branch via worktree (isolate from main)
3. FIX       → `rune:fix` (minimal change only — no refactoring, no scope creep)
4. VERIFY    → `rune:verification` (full test suite on hotfix branch)
5. SENTINEL  → `rune:sentinel` (security check — fix may introduce new surface)
6. DEPLOY    → `rune:deploy` (deploy hotfix to production)
7. WATCHDOG  → `rune:watchdog` (confirm health check passes post-deploy)
8. POSTMORTEM → `rune:journal` + `rune:neural-memory` (capture root cause + fix pattern)

HARD-GATES:
- Do NOT skip CONTAIN if users are actively affected
- Do NOT skip SENTINEL on hotfix — rushed fixes frequently introduce new vulnerabilities
- Do NOT merge hotfix to main without VERIFY passing
- Do NOT skip POSTMORTEM — hotfix without learning = same incident next month
```

**Minimal hotfix chain (non-incident, dev-time):** Phase 4 → 6 → 7 (fix → verify → commit). User provides context, skip scout.

### Template Workflows (Pro/Business)

When `--template <name>` is provided, cook loads a pre-built workflow template instead of auto-detecting:

```
/rune cook --template product-discovery   → Pro: stakeholder interviews → problem framing → competitive → spec → validation
/rune cook --template product-launch      → Pro: spec lock → implement → quality gates → staged rollout → announcement
/rune cook --template product-iteration   → Pro: metrics review → feedback synthesis → re-prioritize → implement → measure
/rune cook --template data-exploration    → Pro: data profiling → hypotheses → statistical testing → visualization → report
/rune cook --template data-pipeline       → Pro: schema design → ETL → quality gates → deploy → monitoring
/rune cook --template sales-outreach-campaign → Pro: prospect research → messaging → sequence → A/B test → launch
/rune cook --template sales-deal-review   → Pro: account deep-dive → risk assessment → competitive strategy → action plan
/rune cook --template support-incident-response → Pro: triage → diagnose → fix → verify → postmortem → KB update
/rune cook --template support-kb-refresh  → Pro: audit → gap analysis → draft → review → publish
```

**Template resolution**: Templates are `.md` files in `extensions/pro-*/templates/` or `extensions/business-*/templates/`. Each template defines: phases, skill connections, mesh signals, and acceptance criteria. The compiler includes templates in pack output during build.

**When --template is used**:
1. Skip Phase 1.5 (auto-detection) — template pre-selects domain and pack
2. Skip Phase 1.7 (workflow matching) — template IS the workflow
3. Load template phases as the master plan (Phase 2 becomes "review template plan" not "create plan")
4. Execute each template phase in order, invoking declared skills
5. Emit template's declared signals on completion

**Chain selection**: If user invokes `/rune cook` without a chain type, auto-detect from the task description:
- Contains "bug", "fix", "broken", "error" → `bugfix`
- Contains "refactor", "clean", "restructure" → `refactor`
- Contains "security", "auth", "vulnerability", "CVE" → `security`
- Contains "urgent", "hotfix", "production" → `hotfix`
- Contains "quick", "just", "chỉ cần", "copy", "move", "rename", "bump" → `nano`
- Contains "graft", "port from", "copy from repo", "clone feature from" → **delegate to `rune:graft`** (not a cook chain — hand off entirely)
- Contains `--template` → load template workflow (see above)
- Default → `feature`

## Phase Skip Rules

Not every task needs every phase:

```
Nano task:           DO → VERIFY → DONE (no phases, auto-detected)
Simple bug fix:      Phase 1 → 4 → 6 → 7
Small refactor:      Phase 1 → 4 → 5 → 6 → 7
New feature:         Phase 1 → 1.5 → 2 → 3 → 4 → 5 → 6 → 7 → 8
Complex feature:     All phases + brainstorm in Phase 2
Security-sensitive:  All phases + sentinel escalated to opus
Fast mode:           Phase 1 → 4 → 6 → 7 (auto-detected, see below)
Multi-session:       Phase 0 (resume) → 3 → 4 → 5 → 6 → 7 (one plan phase per session)
```

Determine complexity BEFORE starting using the Rigor Assessment below. Create TodoWrite with applicable phases.

### Rigor Assessment (Progressive Scaling)

Before selecting a workflow chain or phase set, compute the task's **rigor level** from risk signals. This prevents over-engineering trivial changes while ensuring full ceremony for critical ones.

| Risk Signal | Weight | Detection |
|-------------|--------|-----------|
| Files affected: 1 | 0 | Estimate from task description + scout |
| Files affected: 2-3 | +1 | |
| Files affected: 4+ | +3 | |
| Cross-module impact (changes span 2+ directories) | +2 | scout identifies touch points across boundaries |
| Security-sensitive code (auth, crypto, payments, secrets) | +3 | Keyword match in file paths or task description |
| Public API change (exports, routes, schema) | +2 | Task modifies interfaces consumed by external code |
| Database schema change | +2 | Task mentions migration, schema, ALTER, column |
| New dependency added | +1 | Task requires `npm install` or equivalent |
| Code will be imported by other modules | +1 | New exports or modifications to shared utilities |

**Rigor level mapping:**

| Score | Level | Maps To | Phases |
|-------|-------|---------|--------|
| 0 | Nano | `nano` chain | DO → VERIFY → DONE |
| 1-2 | Fast | `fast` mode | Phase 1 → 4 → 6 → 7 |
| 3-5 | Standard | `bugfix` / `refactor` | Phase 1 → 2 → 4 → 5 → 6 → 7 |
| 6-8 | Full | `feature` | Phase 1 → 1.5 → 2 → 3 → 4 → 5 → 6 → 7 → 8 |
| 9+ | Critical | `security` / full + adversary | All phases + sentinel@opus + adversary |

**Rules:**
- Security signal (+3) automatically floors rigor at Standard — NEVER nano/fast for security code
- User can override: "full pipeline" forces Full, "just do it" forces Nano
- If rigor upgrades mid-task (e.g., scout reveals cross-module impact not obvious from description), announce: "Rigor upgrade: [signal detected] — upgrading from Fast to Standard."
- Announce chosen level: "Rigor: Fast (score 2 — single file, no security)"

## Nano Mode (Auto-Detect)

For trivial tasks that don't need any pipeline at all:

```
IF all of these are true:
  - Task is ≤3 discrete steps (e.g., run command, edit 1 file, commit)
  - Task description < 60 chars OR user prefixes with "quick:", "just", "chỉ cần"
  - No code logic changes (copy files, config edits, version bumps, git ops, run scripts)
  - No new functions/classes/components created
THEN: Nano Mode activated
  - Execute directly: DO → VERIFY → DONE
  - No phases. No plan. No test. No review.
  - Still verify output (check exit codes, confirm file exists, etc.)
  - Still use semantic commit message if committing
```

**Announce**: "Nano mode: trivial task, executing directly."
**Override**: User can say "full pipeline" or "cook feature" to force phases.
**Escape hatch**: If during execution the task turns out more complex than expected → announce upgrade: "Upgrading to Fast/Full mode — task is more complex than detected." Resume from Phase 1.

<HARD-GATE>
Nano mode MUST NOT be used for:
- Any code that will be imported/called by other code
- Security-relevant files (auth, crypto, payments, .env, secrets)
- Database schema changes
- Public API changes
If any of these are detected mid-task, STOP and upgrade to Fast/Full mode.
</HARD-GATE>

## Fast Mode (Auto-Detect)

Cook auto-detects small changes and streamlines the pipeline:

```
IF all of these are true:
  - Total estimated change < 30 LOC
  - Single file affected
  - No security-relevant code (auth, crypto, payments, .env)
  - No public API changes
  - No database schema changes
THEN: Fast Mode activated
  - Skip Phase 2 (PLAN) — change is too small for a formal plan
  - Skip Phase 3 (TEST) — unless existing tests cover the area
  - Skip Phase 5b (SENTINEL) — non-security code
  - Skip Phase 8 (BRIDGE) — not worth persisting
  - KEEP Phase 5a (PREFLIGHT) and Phase 6 (VERIFY) — always run quality checks
```

**Announce fast mode**: "Fast mode: small change detected (<30 LOC, single file, non-security). Streamlined pipeline."
**Override**: User can say "full pipeline" to force all phases even on small changes.

## Phase 0.5: ENVIRONMENT CHECK (First Run Only)

**SUB-SKILL**: Use `rune:sentinel-env` — verify the environment can run the project before planning.

Auto-trigger: no `.rune/` dir (first run) OR build just failed with env-looking errors AND NOT fast mode. Skip silently on subsequent runs. Force with `/rune env-check`.

## Phase 1: UNDERSTAND

**Goal**: Know what exists before changing anything.

**REQUIRED SUB-SKILLS**: Use `rune:scout`. For non-trivial tasks, use `rune:ba`.

1. Create TodoWrite with all applicable phases for this task
2. Mark Phase 1 as `in_progress`
3. **BA gate**: Feature Request / Integration / Greenfield → invoke `rune:ba`. Task > 50 words or business terms (users, revenue, workflow) → invoke `rune:ba`. Bug Fix / simple Refactor → skip. BA produces `.rune/features/<name>/requirements.md` for Phase 2.
4. **Decision enforcement**: `Glob` for `.rune/decisions.md`; if exists, `Read` + extract constraints for Phase 2. Plan MUST NOT contradict active decisions without explicit user override.
4b. **Contract enforcement**: If `.rune/contract.md` was loaded in Phase 0.6, list applicable contract sections for this task (e.g., `contract.security` for auth work, `contract.data` for database changes). These rules constrain Phase 2 planning and Phase 4 implementation.

### Phase 1 Step 3.5 — Clarification Gate

Ask **2 questions** before planning: (1) "What does success look like?" (2) "What should NOT change?"

Skip if: bug fix with clear repro steps | user said "just do it" | fast mode + <10 LOC | hotfix chain active. Complexity revealed → escalate to `rune:ba`.

5. Invoke scout to scan the codebase (Glob + Grep + Read on relevant files)
6. Summarize: what exists, project conventions, files likely to change, active decision constraints
7. **Python async detection**: if Python project detected, `Grep` for async indicators (`async def`, `await`, `aiosqlite`, `aiohttp`, `asyncio.run`). If ≥3 matches → flag as **"async-first Python"** — new code defaults to `async def`
8. **Explore-Before-Commit**: If scout reveals multiple viable approaches (e.g., 2+ libraries, 2+ architectural patterns), do NOT commit to an approach yet. Instead:
   - List alternatives with 1-line trade-off each
   - Flag to Phase 2 (plan) for formal comparison
   - Separating "thinking" (Phase 1) from "committing" (Phase 2) prevents premature lock-in
9. Mark Phase 1 as `completed`

**Gate**: If scout finds the feature already exists → STOP and inform user.

## Phase 1.5: DOMAIN CONTEXT (L4 Pack Detection)

**Goal**: Detect if domain-specific L4 extension packs apply to this task.

<MUST-READ path="references/pack-detection.md" trigger="Phase 1.5 — before checking L4 pack mapping"/>

After scout completes, check if the detected tech stack or task description matches any L4 extension pack. This phase is lightweight — a Read + pattern match. It does NOT replace Phase 1 (scout) or Phase 2 (plan). If 0 packs match: skip silently.

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

## Phase 0: RESUME CHECK (Before Phase 1)

**Goal**: Detect if a master plan already exists for this task, or if a `--template` was specified. If so, skip Phase 1-2 and resume/load the workflow.

**Step 0.4 — Template Detection**: If user passed `--template <name>`:
1. Search installed pack templates for the name: `Glob` for `extensions/*/templates/<name>.md` and `extensions/pro-*/templates/<name>.md`
2. If found: `Read` the template file → parse phases, signals, connections, acceptance criteria
3. Generate a master plan from the template: each template phase becomes a plan phase
4. Write plan files to `.rune/plan-<template-name>.md` + `.rune/plan-<template-name>-phaseN.md`
5. Announce "Loading template: <name> (<pack>)" → skip Phase 1, 1.5, 1.7, 2 → proceed to Phase 4 with Phase 1 of the template
6. If template not found: warn user and fall through to normal workflow

**Step 0.5 — Cross-Project Recall**: Call `neural-memory` (Recall Mode) with 3-5 topics relevant to the current task. Always prefix queries with the project name (e.g., `"ProjectName auth pattern"` not `"auth pattern"`).

1. Use `Glob` to check for `.rune/plan-*.md` files
2. If a master plan exists matching the current task: Read it → find first `⬚ Pending` or `🔄 Active` phase → load ONLY that phase file → announce "Resuming from Phase N" → skip to Phase 4
3. If no master plan exists → proceed to Phase 1 as normal

**Step 0.6 — Contract Load**: Use `Glob` to check for `.rune/contract.md`. If it exists:
1. `Read` the contract file and parse each `## section` as a named rule set
2. Hold contract rules in context — they apply as **hard gates** throughout all phases
3. Any code change that violates a contract rule → STOP and inform user before proceeding
4. If no contract exists → proceed normally (contract is optional)

<HARD-GATE>
Contract violations are NON-NEGOTIABLE. If `.rune/contract.md` exists and a planned or implemented change violates any rule, cook MUST stop and report the violation. The user must explicitly override ("ignore contract rule X") to proceed.
</HARD-GATE>

**This enables multi-session workflows**: Opus plans once → each session picks up the next phase.

## Phase 2: PLAN

**Goal**: Break the task into concrete implementation steps before writing code.

**REQUIRED SUB-SKILL**: Use `rune:plan`

1. Mark Phase 2 as `in_progress`
2. **Feature workspace** (opt-in) — for non-trivial features (3+ phases), suggest creating `.rune/features/<feature-name>/` with `spec.md`, `plan.md`, `decisions.md`, `status.md`. Skip for simple bug fixes, fast mode.
3. Create implementation plan: exact files to create/modify, change order, dependencies, active decision constraints
4. If multiple valid approaches exist → invoke `rune:brainstorm` for trade-off analysis
5. Present plan to user for approval
6. If feature workspace was created, write approved plan to `.rune/features/<name>/plan.md`
7. Mark Phase 2 as `completed`

**Gate**: User MUST approve the plan before proceeding. Do NOT skip this.

### Phase 2.5: RFC GATE (Breaking Changes Only)

**Goal**: Formal change management for breaking changes. Prevents unreviewed breaking changes from reaching production.

<MUST-READ path="references/rfc-template.md" trigger="Phase 2.5 — any time a breaking change is detected in the plan"/>

<HARD-GATE>
Breaking change without RFC = BLOCKED. No exceptions.
"It's just a small change" is the #1 excuse for production incidents from unreviewed breaking changes.
</HARD-GATE>

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

### Phase-Aware Execution (Master Plan + Phase Files)

When `rune:plan` produces a **master plan + phase files** (non-trivial tasks):

1. After plan approval: load ONLY Phase 1's file — do NOT load all phase files
2. Execute through cook Phase 3-6 (test → implement → quality → verify)
3. After phase complete: mark tasks done, update master plan status `⬚ → ✅`, announce "Phase N complete. Phase N+1 ready for next session."
4. Next session: Phase 0 detects master plan → loads next phase → executes

<HARD-GATE>
NEVER load multiple phase files at once. One phase per session = small context = better code.
If the coder model needs info from other phases, it's in the Cross-Phase Context section of the current phase file.
</HARD-GATE>

## Phase 3: TEST (TDD Red)

**Goal**: Define expected behavior with failing tests BEFORE writing implementation.

**REQUIRED SUB-SKILL**: Use `rune:test`

1. Mark Phase 3 as `in_progress`
2. **Eval definitions** (Full/Critical rigor only): Before writing tests, define capability evals (pass@k) and regression evals (pass^k) in `.rune/evals/<feature>.md`. Capability evals test "can the system do this new thing?" — regression evals test "did we break existing behavior?" Skip for Fast/Standard rigor levels.
3. Write test files based on the plan — cover primary use case + edge cases; tests MUST be runnable
4. **Python async pre-check** (if async-first Python flagged in Phase 1): verify `pytest-asyncio` is installed and `asyncio_mode = "auto"` is in `pyproject.toml` — if missing, warn user before writing async tests
5. Run tests to verify they FAIL — expected: RED because implementation doesn't exist yet
6. Mark Phase 3 as `completed`

**Gate**: Tests MUST exist and MUST fail. If tests pass without implementation → tests are wrong, rewrite them.

## Phase 4: IMPLEMENT (TDD Green)

**Goal**: Write the minimum code to make tests pass.

**REQUIRED SUB-SKILL**: Use `rune:fix`

1. Mark Phase 4 as `in_progress`
2. **Phase-file execution** — if working from a master plan + phase file:
   - Execute tasks from `## Tasks` section wave-by-wave
   - Wave N only starts after ALL Wave N-1 tasks complete
   - Follow Code Contracts, Rejection Criteria, Failure Scenarios from the phase file
   - Mark each task `[x]` as completed
3. Implement the feature following the plan (Write for new files, Edit for existing)
4. Run tests after each significant change — if fail → debug and fix
   - **Python async** (if async-first flagged): no blocking calls in async functions — `time.sleep` → `asyncio.sleep`, `requests` → `httpx.AsyncClient`, use `asyncio.gather()` for parallel I/O
5. If stuck → invoke `rune:debug` (max 3 debug↔fix loops). Fixes outside plan scope require user approval (R4).
6. **Re-plan check** — evaluate before Phase 5: max debug loops hit? out-of-scope files changed? new dep changes approach? user scope change? If any fire → invoke `rune:plan` with delta context, get user approval before resuming.
7. **Approach Pivot Gate** — if re-plan ALSO fails:

   <HARD-GATE>
   Do NOT surrender. Do NOT tell user "no solution exists."
   Do NOT try a 4th variant of the same approach.
   MUST invoke brainstorm(mode="rescue") before giving up.
   </HARD-GATE>

   Invoke `rune:brainstorm(mode="rescue")` with `failed_approach`, `failure_evidence[]`, `original_goal`. Returns 3-5 alternatives → user picks → **restart from Phase 2**.

8. All tests MUST pass before proceeding
9. Mark Phase 4 as `completed`

**Gate**: ALL tests from Phase 3 MUST pass. Do NOT proceed with failing tests.

## Phase 5: QUALITY (Staged)

**Goal**: Catch issues before they reach production.

Quality checks run in **two stages** — spec compliance gates code review. Reviewing code quality before verifying it matches the spec wastes effort on code that may need rewriting.

**Signal dispatch ordering**: When `fix` emits `code.changed`, 4 listeners react (preflight, sentinel, test, review). Cook coordinates dispatch order — do NOT let all 4 fire simultaneously:
- **Stage 1**: preflight + sentinel (parallel — independent checks)
- **Stage 2**: test (after Stage 1 passes — no point testing non-compliant code)
- **Stage 3**: review (after test passes — review verified code only)

```
STAGE 1 (parallel):
  Launch 5a (preflight) + 5b (sentinel) simultaneously.
  Wait for BOTH to complete.
  If 5a returns BLOCK → fix spec gaps, re-run 5a. Code review CANNOT start on non-compliant code.
  If 5b returns BLOCK → fix security issue, re-run 5b.

STAGE 2 (after Stage 1 passes):
  Launch 5c (review) + 5d (completion-gate) simultaneously.
  If any returns BLOCK → fix findings, re-run the blocking check only.
```

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

### 5a. Preflight (Spec Compliance + Logic) — STAGE 1
**REQUIRED SUB-SKILL**: Use `rune:preflight`
- Spec compliance: compare approved plan vs actual diff
- Logic review, error handling, completeness
- **Must pass before 5c (review) can start** — no point reviewing code quality if it doesn't match the spec

### 5b. Security — STAGE 1
**REQUIRED SUB-SKILL**: Use `rune:sentinel`
- Secret scan, OWASP check (no injection/XSS/CSRF), dependency audit

### 5c. Code Review — STAGE 2
**REQUIRED SUB-SKILL**: Use `rune:review`
- Pattern compliance, code quality, performance bottlenecks
- Reviewer reads code independently — does NOT rely on implementer's claims
- **Reviewer isolation** (when invoked via `team`): The review agent MUST be a separate context window from the implementing agent. Author reasoning contaminates review — the reviewer should never have seen the implementation's reasoning chain. Sonnet implements, a fresh Sonnet reviews.

### 5d. Completion Gate — STAGE 2
**REQUIRED SUB-SKILL**: Use `rune:completion-gate`
- Validate agent claims match evidence trail (tests ran, files changed, build passed)
- No truncated code files (`// ...`, `// rest of code`, bare ellipsis) — agent MUST complete all output
- Any UNCONFIRMED claim → BLOCK

**Gate**: If sentinel finds CRITICAL security issue → STOP, fix it, re-run. Non-negotiable.
**Gate**: If completion-gate finds UNCONFIRMED claim → STOP, re-verify. Non-negotiable.

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

## Checkpoint Protocol (Opt-In)

Invoke `rune:session-bridge` after Phase 2, 4, and 5 to save intermediate state. OPT-IN — activate only if task spans 3+ phases, context-watch is ORANGE, or user explicitly requests checkpoints. Before spawning subagents, invoke `rune:context-pack` to create structured handoff briefings.

## Phase Transition Protocol (MANDATORY)

Before entering ANY Phase N+1, assert: Phase N `completed` in TodoWrite | gate condition met | no BLOCK from sub-skills | no unresolved CRITICAL findings. If any fails → STOP, log "BLOCKED at Phase N→N+1: [assertion]", fix, re-check.

**Key transitions:** 1→2: scout done | 2→3: plan approved | 3→4: failing tests exist | 4→5: all tests pass | 5→6: no CRITICAL findings | 6→7: lint+types+build green.

## Phase 6: VERIFY

**REQUIRED SUB-SKILL**: Use `rune:verification` — run lint, type check, full test suite, build. Then `rune:hallucination-guard` to verify imports and API signatures. ALL checks MUST pass before commit.

## Phase 7: COMMIT

**RECOMMENDED SUB-SKILL**: Use `rune:git` — stage specific files (`git add <files>`, NOT `git add .`), generate semantic commit message from diff. If working from master plan: update phase status `🔄 → ✅`, announce next phase or "All phases complete."

## Phase 8: BRIDGE

**Goal**: Save context for future sessions and record metrics for mesh analytics.

**REQUIRED SUB-SKILL**: Use `rune:session-bridge`

1. Mark Phase 8 as `in_progress`
2. Save to `.rune/decisions.md` (approach + trade-offs), `.rune/progress.md` (task complete), `.rune/conventions.md` (new patterns)
3. **Skill metrics** → `.rune/metrics/skills.json`: increment phase run/skip counts, quality gate results, debug loop counts under `cook` key
4. **Routing overrides** (H3): if Phase 4 hit max loops for an error pattern → write rule to `.rune/metrics/routing-overrides.json`. Max 10 active rules.
5. **Step 8.5 — Cross-Cutting Sweep**: After commit, check if this phase changed stats (skill count, test count, signal count, pack count, layer counts). If ANY stat changed:
   - [ ] `README.md` — stats, badges, feature list
   - [ ] `docs/index.html` (landing page) — meta tags, hero badge, install section, mesh stats, footer
   - [ ] `dashboard.html` (if local) — KPI cards, test count, skill tabs, layer counts
   - [ ] `CLAUDE.md` — commands, test count, skill list
   - [ ] `MEMORY.md` — milestones, version info

   **Skip if**: No stats changed (pure refactor, docs-only, style change). **MANDATORY** if any numeric stat in README differs from actual.
6. **Step 8.6 — Capture Learnings**: `neural-memory` (Capture Mode) — 2-5 memories: architecture decisions, patterns, error root-causes, trade-offs. Cognitive language (causal/decisional/comparative). Tags: `[project, tech, topic]`. Priority 5 routine / 7-8 decisions / 9-10 critical errors.
6. Mark Phase 8 as `completed`

## Autonomous Loop Patterns

When cook runs inside `team` (L1) or autonomous workflows, these patterns apply.

### De-Sloppify Pass

After Phase 4 completes (all tests green), run a **separate focused cleanup pass** on all modified files. Two focused passes outperform one constrained pass — let the implementer write freely in Phase 4, then clean up here.

**Trigger**: Implementation touched 3+ files OR 100+ LOC changed. Skip for nano/fast rigor.

**Slop targets** (check every modified file):

| Slop Type | Detection | Fix |
|-----------|-----------|-----|
| Leftover debug | `console.log`, `print()`, `debugger`, `TODO: remove` | Delete |
| Over-defensive checks | Null checks on values guaranteed non-null by TypeScript/framework | Remove redundant guard |
| Type-test slop | `typeof x === 'string'` when x is already typed as string | Remove — trust the type system |
| Duplicated logic | Same 3+ lines appear in multiple places | Extract utility |
| Framework-behavior tests | Tests asserting that React renders, that Express routes exist, that mocks work | Delete — test YOUR code, not the framework |
| Inconsistent naming | Mixed `camelCase`/`snake_case` in same file | Normalize to project convention |
| Dead imports | Imports no longer used after edits | Remove |

**Important**: This is NOT a quality gate — it's a cleanup pass. Don't block the pipeline for cosmetic issues. Fix what you find, move on.

### Continuous PR Loop (team orchestration only)

```
cook instance → commit → push → create PR → wait CI
  IF CI passes → mark workstream complete
  IF CI fails → read CI output → fix → push → wait CI (max 3 retries)
  IF 3 retries fail → escalate to user with CI logs
```

### Formal Pause/Resume (`.continue-here.md`)

<MUST-READ path="references/pause-resume-template.md" trigger="when cook must pause mid-phase (context limit, user break, session end)"/>

When cook must pause mid-phase, create `.rune/.continue-here.md` with structured handoff, then WIP commit. Phase 0 detects it on resume. More granular than plan-level resume — resumes within a phase.

### Mid-Run Signal Detection

<MUST-READ path="references/mid-run-signals.md" trigger="when user sends a message DURING cook execution"/>

Two-stage intent classification: keyword fast-path for short messages (<60 chars), context classification for longer ones. Never queue user messages — process immediately.

<HARD-GATE>
NEVER treat a Cancel/Pause signal as a Steer or NewTask. User safety signals take absolute priority.
If ambiguous between Cancel and Steer → ask user: "Did you mean stop, or change approach?"
</HARD-GATE>

### Exit Conditions (Mandatory for Autonomous Runs)

<MUST-READ path="references/exit-conditions.md" trigger="cook running inside team or any autonomous workflow"/>

Hard caps: MAX_DEBUG_LOOPS=3, MAX_QUALITY_LOOPS=2, MAX_REPLAN=1, MAX_PIVOT=1, MAX_FIXES=30, WTF_THRESHOLD=20%.
Escalation chain: debug-fix (3x) → re-plan (1x) → brainstorm rescue (1x) → THEN escalate to user.

### Structured Escalation Report

> From agency-agents (msitarzewski/agency-agents, 50.8k★): "After 3 retry failures, structured escalation prevents cargo-cult retrying."

When escalation chain exhausts (all retries hit) or cook returns `BLOCKED`, produce a Structured Escalation Report instead of a vague "I can't do this":

```markdown
## Escalation Report
- **Task**: [original task description]
- **Status**: BLOCKED
- **Attempts**: [count] across [N] phases

### Failure History
| # | Approach | Phase | Outcome | Root Cause |
|---|---------|-------|---------|------------|
| 1 | Direct fix | Phase 4 | Tests fail — null ref in auth.ts:42 | Missing user context |
| 2 | Re-plan with guard clause | Phase 4 | Build fails — circular import | Guard approach introduces cycle |
| 3 | Brainstorm rescue → adapter pattern | Phase 4 | Tests pass but perf regression 3x | Adapter adds indirection overhead |

### Root Cause Analysis
[1-2 sentences: why ALL approaches failed — is it architectural, environmental, or requirements-level?]

### Recommended Resolutions (pick one)
1. **Reassign** — different skill/agent with fresh context
2. **Decompose** — break into smaller sub-tasks that CAN succeed independently
3. **Revise requirements** — relax constraint X to unblock (specify which)
4. **Accept partial** — ship what works, defer blocked portion
5. **Defer** — park this task, work on something else first

### Impact Assessment
- **Blocked by this**: [downstream tasks/phases that depend on this]
- **Not blocked**: [independent work that can continue]
```

<HARD-GATE>
"Bad work is worse than no work." Cook MUST produce this report rather than attempting a 4th variant of a failing approach. Escalating is not failure — shipping broken code is.
</HARD-GATE>

### Subagent Question Gate

> From superpowers (obra/superpowers, 84k★): "Subagents that start work without asking questions produce the wrong thing 40% of the time."

Before dispatching a sub-skill (fix, test, review) for a non-trivial task (3+ files OR ambiguous scope):

1. **Invite questions**: Include in the handoff: "Before starting, ask up to 3 clarifying questions if anything is unclear."
2. **Answer before work**: If the sub-skill returns questions → answer them, THEN re-dispatch with answers included.
3. **Skip if**: Fast/Nano rigor, single-file fix, or sub-skill is haiku-tier (too cheap to gate).

This prevents the #1 parallel work failure: sub-skill assumes wrong interpretation, builds 500 LOC, then gets rejected in review.

### Subagent Status Protocol

<MUST-READ path="references/subagent-status.md" trigger="when cook or any sub-skill needs to return a status"/>

Cook and all sub-skills return: `DONE` | `DONE_WITH_CONCERNS` | `NEEDS_CONTEXT` | `BLOCKED`.

### Subagent Context Isolation

When invoking sub-skills (fix, debug, test, review, etc.), **craft exactly the context they need** — never pass the full orchestrator session context.

| Pass To Sub-Skill | DO NOT Pass |
|-------------------|-------------|
| Task description + specific goal | Full conversation history |
| Relevant file paths from scout | Unrelated files from other phases |
| Project conventions (naming, test framework) | Other sub-skill outputs |
| Plan excerpt for THIS phase only | Full master plan |
| Error/stack trace (for debug/fix) | Previous debug attempts from other bugs |

**Why**: Sub-skills that inherit orchestrator context get polluted — they chase false connections, reference stale data, and consume tokens on irrelevant context. A focused sub-skill with 500 tokens of curated context outperforms one with 5000 tokens of inherited noise.

## Deviation Rules

<MUST-READ path="references/deviation-rules.md" trigger="when implementation diverges from the approved plan"/>

R1-R3 (bug/security/blocking fix): auto-fix, continue. R4 (architectural change): ASK user first.

## Error Recovery

<MUST-READ path="references/error-recovery.md" trigger="when any phase fails or a task hits repeated errors"/>

Includes phase-by-phase failure handling and repair operators (RETRY → DECOMPOSE → PRUNE) with a 2-attempt budget before escalation.

## Analysis Paralysis Guard

<HARD-GATE>
5+ consecutive read-only tool calls (Read, Grep, Glob) without a single write action (Edit, Write, Bash) = STUCK.

You MUST either:
1. **Act** — write code, run a command, create a file
2. **Report BLOCKED** — state the specific missing piece: "Cannot proceed because [X]"

Stuck patterns (all banned):
- Reading 10+ files to "fully understand" before acting
- Grepping every variation of a string across the entire repo
- Reading the same file twice in one investigation
- "Let me check one more thing" — repeated after 5 reads

A wrong first attempt that produces feedback beats perfect understanding that never ships.
</HARD-GATE>

### Observation/Effect Ratio Tracking

Track every tool call during Phase 4 (IMPLEMENT) as either **observation** (read-only) or **effect** (modifies state):

| Category | Tool Examples |
|----------|--------------|
| **Observation** | Read, Grep, Glob, Bash(grep/ls/cat/git log) |
| **Effect** | Write, Edit, Bash(npm/build/test/mkdir) |

**Detection rules** (check every 8 tool calls during Phase 4):

| Pattern | Threshold | Signal | Action |
|---------|-----------|--------|--------|
| **Observation chain** | 6+ consecutive observation tools with zero effects | Agent is stuck reading, not building | Inject: "OBSERVATION LOOP — 6 reads without writing. Act on what you know or report BLOCKED." |
| **Low effect ratio** | In last 10 calls, effects < 15% | Agent is in analysis mode, not implementation | Inject: "Effect ratio below 15%. Phase 4 is IMPLEMENT — write code, don't just read it." |
| **Diminishing returns** | Last 3 observations found <2 new relevant facts combined | Searching is no longer productive | Inject: "Diminishing returns — last 3 reads added nothing new. Synthesize and act." |
| **Repeating sequences** | A-B-A-B or A-B-C-A-B-C pattern across 6+ calls | Circular behavior | Inject: "REPEATING SEQUENCE detected. Break the cycle — try a different approach or report BLOCKED." |

**Important**: These are injected as advisor messages, not hard blocks. The agent can continue if it has good reason, but the message forces conscious acknowledgment of the pattern.

**Skip if**: Phase 1 (UNDERSTAND) — observation-heavy is expected during research. Only track during Phase 4+ where effects should dominate.

### Budget-Aware Phase Progression

Beyond the existing Exit Conditions (MAX_DEBUG_LOOPS, MAX_QUALITY_LOOPS, etc.), track **cumulative budget** across the entire cook session:

| Budget | Limit | What Happens at Limit |
|--------|-------|----------------------|
| **Phase 4 react budget** | 15 tool calls per task within Phase 4 | Force: move to next task or report partial completion |
| **Global replan budget** | 2 replans per session (Phase 4 Step 6) | Force: proceed with current plan or escalate to user |
| **Quality retry budget** | 3 total quality re-runs across 5a-5d | Force: ship with known issues documented, don't loop |
| **Total session tool calls** | 150 calls | Force: save state via session-bridge, compact or pause |

**Hard override rules**:
- If react budget exhausted for a task but task is IN_PROGRESS → force CONTINUE to next task (don't re-attempt)
- If replan budget exhausted but plan still failing → force escalation (don't attempt 3rd replan)
- If quality retry budget exhausted → emit concerns in Cook Report, proceed to commit with documented caveats

**Why**: Without hard budgets, agents get trapped in local optimization loops — retrying the same failing approach indefinitely. Budget constraints force escalation or acceptance of partial results, which is always better than an infinite loop.

### Hash-Based Tool Loop Detection

<MUST-READ path="references/loop-detection.md" trigger="when same tool+args+result appears to be repeating"/>

Mentally track tool call fingerprints. 3 identical calls → WARN. 5 identical calls → FORCE STOP. Only same-input-AND-same-output counts as a loop.

## Called By (inbound)

- User: `/rune cook` direct invocation — primary entry point
- `team` (L1): parallel workstream execution (meta-orchestration)

## Calls (outbound)

| Phase | Sub-skill | Layer | Purpose |
|-------|-----------|-------|---------|
| 0 / 8 | `neural-memory` | ext | Recall context at start; capture learnings at end |
| 0.5 | `sentinel-env` | L3 | Environment pre-flight (first run only) |
| 1 | `scout` | L2 | Scan codebase before planning |
| 1 | `onboard` | L2 | Initialize project context if no CLAUDE.md |
| 1 | `ba` | L2 | Requirement elicitation for features |
| 1 | `logic-guardian` | L2 | Conditional: when `.rune/logic-manifest.json` exists — protect complex business logic before any edits |
| 2 | `plan` | L2 | Create implementation plan |
| 2 | `brainstorm` | L2 | Trade-off analysis / rescue mode |
| 2 | `design` | L2 | UI/design phase for frontend features |
| 2.5 | `adversary` | L2 | Red-team challenge on approved plan |
| 3 | `test` | L2 | Write failing tests (RED phase) |
| 4 | `fix` | L2 | Implement code changes (GREEN phase) |
| 4 | `debug` | L2 | Unexpected errors (max 3 loops) |
| 4 | `db` | L2 | Schema changes detected in diff |
| 4 | `worktree` | L3 | Worktree isolation for parallel implementation |
| 5a | `preflight` | L2 | Spec compliance + logic review |
| 5b | `sentinel` | L2 | Security scan |
| 5c | `review` | L2 | Code quality review |
| 5 | `scope-guard` | L3 | Verify changed files match approved plan scope (flag out-of-scope files before commit) |
| 5 | `perf` | L2 | Performance regression check (optional) |
| 5 | `audit` | L2 | Project health audit when scope warrants |
| 5 | `review-intake` | L2 | Structured review intake for complex PRs |
| 5 | `sast` | L3 | Static analysis security testing |
| 5d | `completion-gate` | L3 | Validate agent claims against evidence trail |
| 5 | `constraint-check` | L3 | Audit HARD-GATE compliance across workflow |
| 6 | `verification` | L3 | Lint + types + tests + build |
| 6 | `hallucination-guard` | L3 | Verify imports and API calls are real |
| 7 | `journal` | L3 | Record architectural decisions |
| 8 | `session-bridge` | L3 | Save context for future sessions |
| any | `context-pack` | L3 | create structured handoff briefings before spawning subagents |
| any | `skill-forge` | L2 | When new skill creation detected during cook |
| 1.5 | L4 extension packs | L4 | Domain-specific patterns when stack matches |

## Data Flow

**Feeds Into →** `journal` (decisions → ADRs) | `session-bridge` (context → .rune/ state) | `neural-memory` (learnings → cross-session)

**Fed By ←** `ba` (requirements → Phase 1) | `plan` (master plan → Phase 2-4) | `session-bridge` (.continue-here.md → Phase 0 resume) | `neural-memory` (past decisions → Phase 0 recall)

**Feedback Loops ↻** cook↔debug (Phase 4 bug → debug → fix → resume; if plan wrong → Approach Pivot) | cook↔test (RED → GREEN → failures loop back)

## Constraints

1. MUST run scout before planning
2. MUST get user plan approval before writing code
3. MUST write failing tests before implementation (TDD) unless explicitly skipped
4. MUST NOT commit with failing tests
5. MUST NOT modify files outside approved plan scope without user confirmation
6. MUST run verification (lint + type-check + tests + build) before commit
7. MUST NOT say "all tests pass" without showing actual test output
8. MUST NOT contradict `.rune/decisions.md` without explicit user override

## Mesh Gates

| Gate | Requires | If Missing |
|------|----------|------------|
| Resume Gate | Phase 0 checks for master plan before starting | Proceed to Phase 1 |
| Scout Gate | scout output before Phase 2 | Invoke rune:scout first |
| Plan Gate | User-approved plan before Phase 3 | Cannot proceed |
| Adversary Gate | adversary verdict before Phase 3 for features | Skip for bugfix/hotfix/refactor |
| Phase File Gate | Active phase file only (multi-session) | Load only active phase |
| Test-First Gate | Failing tests before Phase 4 | Write tests or get explicit skip |
| Quality Gate | preflight + sentinel + review before Phase 7 | Fix findings, re-run |
| Verification Gate | lint + types + tests + build green before commit | Fix, re-run |

## Structured Output Contract (Prompt-as-API Pattern)

When cook invokes sub-skills that produce structured output (e.g., `ba` for requirements, `plan` for implementation plans, `test` for test specs), use the **Prompt-as-API-Contract** pattern: specify the exact output schema in the invocation prompt so the sub-skill returns machine-parseable results, not free-form prose.

### Pattern

```
INVOCATION: "Analyze [X] and return results as JSON matching this schema:
{
  "insights": [{ "id": string, "category": string, "description": string, "actionable": string }],
  "confidence": number,
  "next_steps": string[]
}
Do NOT include explanatory text outside the JSON block."
```

### When to Apply

| Phase | Sub-skill | Output Contract |
|-------|-----------|----------------|
| Phase 1 | `ba` | `{ requirements: [{id, priority, description, acceptance_criteria}], ambiguities: string[] }` |
| Phase 2 | `plan` | `{ phases: [{name, tasks: [{description, files, effort}], dependencies}] }` |
| Phase 3 | `test` | `{ test_cases: [{name, type, file, assertion}], coverage_targets: string[] }` |
| Phase 5 | `review` | `{ findings: [{severity, file, line, description, fix}], verdict: "PASS"|"WARN"|"BLOCK" }` |

### Rules

- Include 1-2 concrete examples in the prompt — examples are worth more than schema descriptions
- Always specify "Do NOT include explanatory text outside the JSON/markdown block" — LLMs default to wrapping structured output in prose
- When the output will be consumed by another skill (not displayed to user), ALWAYS use this pattern
- When the output will be displayed to the user, use markdown format instead — humans don't read JSON

### Why

Free-form sub-skill output forces the calling skill to parse natural language — fragile and lossy. Structured contracts make skill-to-skill communication reliable, enable automated validation, and reduce the tokens wasted on parsing instructions.

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

## Anti-Patterns

Common multi-agent failures to explicitly avoid. These are NOT edge cases — they are the most frequent cook failures in production.

| Anti-Pattern | Why It Fails | Correct Approach |
|---|---|---|
| **Bypass hierarchy** — skipping scout/plan and jumping to Phase 4 code | Builds wrong thing. Most "wasted work" traces back to missing Phase 1-2 | Follow phase gates. Even "obvious" tasks benefit from 30s of scout |
| **Shadow decisions** — making architectural choices without logging to decisions.md | Next session repeats the same debate. Team agents contradict each other | Log every non-trivial choice via `decisions.md` or `journal` |
| **Gold-plating** — adding "nice-to-have" features not in the approved plan | Scope creep, delayed delivery, untested code paths | Build ONLY what's in the plan. Log extras as follow-up tasks |
| **Test-after** — writing tests after implementation instead of before (TDD violation) | Tests validate implementation bugs, not requirements. Coverage looks good but misses edge cases | Phase 3 (RED) before Phase 4 (GREEN). Always |
| **Monolithic commit** — one giant commit with all changes | Impossible to revert partially. Review is overwhelming | Commit per phase or per logical unit. Small, reviewable diffs |
| **Assumption-based implementation** — guessing requirements instead of asking | Builds the wrong thing confidently. User discovers mismatch late | If ambiguous, ask. 30s of clarification saves 30min of rework |
| **Infinite remediation loop** — fixing the same BLOCK finding 4+ times with the same approach | Wastes tokens, drifts further from solution. If 3 attempts failed, the approach is wrong | Remediation Cycle Counter: max 3 cycles, Cycle 2+ must try different strategy, Cycle 4 escalates to user |
| **Code fix for upstream problem** — fixing implementation when the plan/spec was wrong | Code "passes" but implements the wrong thing. Bug resurfaces in integration | Upstream Inconsistency Protocol: tag as UPSTREAM, re-invoke upstream skill, get approval, re-run gates |

## Sharp Edges

<MUST-READ path="references/sharp-edges.md" trigger="before declaring done — review all 18 failure modes"/>

**CRITICAL failures** (always check): skipping scout | writing code without plan approval | "done" without evidence trail | surrendering without Approach Pivot Gate | breaking change without RFC | treating Cancel/Pause as scope change.

## Self-Validation

```
SELF-VALIDATION (run before emitting Cook Report):
- [ ] Every phase in Phase Skip Rules was either executed or explicitly skipped with reason
- [ ] Plan approval gate was not bypassed — user said "go" (check conversation history)
- [ ] No Phase 4 code was written before Phase 3 tests (TDD order preserved)
- [ ] All Phase 5 quality gates (preflight, sentinel, review) ran — not just claimed
- [ ] No quality gate exceeded 3 remediation cycles without user escalation
- [ ] No upstream issue was fixed by code change alone — UPSTREAM findings re-invoked the source skill
- [ ] Cook Report contains actual commit hash, not placeholder
```

## Done When

All applicable phases complete + Self-Validation passed:
- User approved plan | All tests PASS (output shown) | preflight+sentinel+review PASS | build green
- Cook Report emitted with commit hash | Session state saved to .rune/ via session-bridge

## Cost Profile

~$0.05-0.15 per feature. Haiku for scanning (Phase 1), sonnet for coding (Phase 3-4), opus for complex planning (Phase 2 when needed).
