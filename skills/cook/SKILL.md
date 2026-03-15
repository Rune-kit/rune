---
name: cook
description: "Feature implementation orchestrator. ALWAYS use this skill for ANY code change — implement, build, add feature, create, fix bug, or any task that modifies source code. This is the default route for 70% of all requests. Runs full TDD cycle: understand → plan → test → implement → quality → verify → commit."
context: fork
agent: general-purpose
metadata:
  author: runedev
  version: "0.7.0"
  layer: L1
  model: sonnet
  group: orchestrator
  tools: "Read, Write, Edit, Bash, Glob, Grep"
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
/rune cook hotfix     → Minimal: fix → verify → commit (Phase 4 → 6 → 7, skip scout if user provides context)
```

**Chain selection**: If user invokes `/rune cook` without a chain type, auto-detect from the task description:
- Contains "bug", "fix", "broken", "error" → `bugfix`
- Contains "refactor", "clean", "restructure" → `refactor`
- Contains "security", "auth", "vulnerability", "CVE" → `security`
- Contains "urgent", "hotfix", "production" → `hotfix`
- Default → `feature`

## Phase Skip Rules

Not every task needs every phase:

```
Simple bug fix:      Phase 1 → 4 → 6 → 7
Small refactor:      Phase 1 → 4 → 5 → 6 → 7
New feature:         Phase 1 → 1.5 → 2 → 3 → 4 → 5 → 6 → 7 → 8
Complex feature:     All phases + brainstorm in Phase 2
Security-sensitive:  All phases + sentinel escalated to opus
Fast mode:           Phase 1 → 4 → 6 → 7 (auto-detected, see below)
Multi-session:       Phase 0 (resume) → 3 → 4 → 5 → 6 → 7 (one plan phase per session)
```

Determine complexity BEFORE starting. Create TodoWrite with applicable phases.

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

**Goal**: Verify the developer's environment can run this project before wasting time on planning.

**SUB-SKILL**: Use `rune:sentinel-env`

**Auto-trigger conditions** (ALL must be true):
- No `.rune/` directory exists (first cook run in this project)
- OR `npm install` / `pip install` / build just failed with environment-looking errors
- AND NOT fast mode

Skip silently on subsequent runs. User can force with `/rune env-check`.

## Phase 1: UNDERSTAND

**Goal**: Know what exists before changing anything.

**REQUIRED SUB-SKILLS**: Use `rune:scout`. For non-trivial tasks, use `rune:ba`.

1. Create TodoWrite with all applicable phases for this task
2. Mark Phase 1 as `in_progress`
3. **BA gate** — determine if Business Analyst elicitation is needed:
   - If task is a Feature Request, Integration, or Greenfield → invoke `rune:ba` for requirement elicitation
   - If task description is > 50 words or contains business terms (users, revenue, workflow, integration) → invoke `rune:ba`
   - If Bug Fix or simple Refactor → skip BA, proceed with scout
   - BA produces a Requirements Document at `.rune/features/<name>/requirements.md` that feeds into Phase 2 (PLAN)
4. **Decision enforcement** — load prior decisions:
   - Use `Glob` to check for `.rune/decisions.md`
   - If exists, use `Read` to load it
   - Extract decisions relevant to the current task domain (match by keywords: module names, tech choices, patterns)
   - These become **constraints for Phase 2 (PLAN)** — the plan MUST NOT contradict active decisions without explicit user override
   - If no `.rune/decisions.md` exists, skip silently
### Phase 1 Step 3.5 — Clarification Gate (Lightweight Socratic Check)

Before planning, ask the user at minimum **2 clarifying questions**:

1. **"What does success look like?"** — defines acceptance criteria (how we know we're done)
2. **"What should NOT change?"** — defines blast radius constraints (what's off-limits)

**Skip conditions** (ALL must be true to skip):
- Bug fix with clear reproduction steps already provided by user
- User explicitly said "just do it", "no questions", or "skip questions"
- Fast mode active AND estimated change < 10 LOC
- Hotfix chain active (production emergency)

This is NOT the full BA elicitation (5 questions). It's a lightweight 2-question gate that prevents the most common failure: implementing the wrong thing. If the answers reveal complexity → escalate to `rune:ba` for deep requirement analysis.

**Question format**: Use brainstorm's dynamic questioning format when possible (Priority level, Decision Point, Why This Matters, Options table, Default).

4. Invoke scout to scan the codebase:
   - Use `Glob` to find files matching the feature domain (e.g., `**/*auth*`, `**/*user*`)
   - Use `Grep` to search for related patterns, imports, existing implementations
   - Use `Read` to examine key files identified
5. Summarize findings:
   - What exists already
   - What patterns/conventions the project uses
   - What files will likely need to change
   - **Active decisions that constrain this task** (from step 3)
6. **Python async detection**: If Python project detected (`pyproject.toml` or `setup.py`), use `Grep` for async indicators:
   - Search for: `async def`, `await`, `aiosqlite`, `aiohttp`, `httpx.AsyncClient`, `asyncio.run`, `trio`
   - If ≥3 matches across source files → flag project as **"async-first Python"**
   - Note for later phases: new code should default to `async def`, avoid blocking calls (`requests.get`, `time.sleep`, `open()`)
7. Mark Phase 1 as `completed`

**Gate**: If scout finds the feature already exists → STOP and inform user.

## Phase 1.5: DOMAIN CONTEXT (L4 Pack Detection)

**Goal**: Detect if domain-specific L4 extension packs apply to this task.

After scout completes (Phase 1), check if the detected tech stack or task description matches any L4 extension pack. If a match is found, load the relevant domain-specific patterns, constraints, and sharp edges into the current workflow.

**Split pack protocol** (context-efficient):
- `Read` the matching PACK.md index (~60-80 lines) — this contains triggers, skill table, connections, and workflows
- Match the task to the specific skill name in the index's Skills Included table
- `Read` only the matching skill file(s) from `skills/` subdirectory (e.g., `extensions/backend/skills/auth.md`)
- Load max 2-3 skill files per invocation — not all skills in the pack
- Pack-level constraints (from index's Connections and Sharp Edges sections) always apply

**Monolith pack protocol** (legacy): If no `format: split` in PACK.md frontmatter, read the full PACK.md and extract the matching `### skill-name` section as before.

1. Check the project's detected stack against the L4 pack mapping:

| Signal in Codebase or Task | Pack | File |
|---|---|---|
| `*.tsx`, `*.svelte`, `*.vue`, Tailwind, CSS modules | `@rune/ui` | `extensions/ui/PACK.md` |
| Express/Fastify/NestJS routes, API endpoints | `@rune/backend` | `extensions/backend/PACK.md` |
| Dockerfile, `.github/workflows/`, Terraform | `@rune/devops` | `extensions/devops/PACK.md` |
| `react-native`, `expo`, `flutter`, `ios/`, `android/` | `@rune/mobile` | `extensions/mobile/PACK.md` |
| Auth, OWASP, secrets, PCI/HIPAA markers | `@rune/security` | `extensions/security/PACK.md` |
| Trading, charts, market data, `decimal.js` | `@rune/trading` | `extensions/trading/PACK.md` |
| Multi-tenant, billing, `stripe`, subscription | `@rune/saas` | `extensions/saas/PACK.md` |
| Cart, checkout, inventory, Shopify | `@rune/ecommerce` | `extensions/ecommerce/PACK.md` |
| `openai`, `anthropic`, embeddings, RAG, LLM | `@rune/ai-ml` | `extensions/ai-ml/PACK.md` |
| `three`, `pixi`, `phaser`, `*.glsl`, game loop | `@rune/gamedev` | `extensions/gamedev/PACK.md` |
| CMS, blog, MDX, `i18next`, SEO | `@rune/content` | `extensions/content/PACK.md` |
| Analytics, tracking, A/B test, funnel | `@rune/analytics` | `extensions/analytics/PACK.md` |
| Chrome extension, `manifest.json`, service worker, content script | `@rune/chrome-ext` | `extensions/chrome-ext/PACK.md` |
| PRD, roadmap, KPI, release notes, `.rune/business/` | `@rune-pro/product` | `extensions/pro-product/PACK.md` |
| Sales outreach, pipeline, call prep, competitive intel | `@rune-pro/sales` | `extensions/pro-sales/PACK.md` |
| Data science, SQL, dashboard, statistical testing, ETL | `@rune-pro/data-science` | `extensions/pro-data-science/PACK.md` |
| Support ticket, KB article, escalation, SLA, FAQ | `@rune-pro/support` | `extensions/pro-support/PACK.md` |
| Budget, expense, revenue forecast, P&L, cash flow, runway | `@rune-pro/finance` | `extensions/pro-finance/PACK.md` |
| Contract, NDA, compliance, GDPR, IP, legal incident | `@rune-pro/legal` | `extensions/pro-legal/PACK.md` |

2. If ≥1 pack matches:
   - Use `Read` to load the matching PACK.md (index if split, full if monolith)
   - For split packs: identify the relevant skill from the index table, then `Read` only that skill file from `skills/` subdirectory
   - For monolith packs: extract the relevant `### skill-name` section from the PACK.md body
   - Apply pack constraints alongside cook's own constraints for the rest of the workflow
   - Announce: "Loaded @rune/[pack] → [skill-name] (split)" or "Loaded @rune/[pack] → [skill-name] (full)"

3. If 0 packs match: skip silently, proceed to Phase 2

This phase is lightweight — a Read + pattern match, not a full scan. It does NOT replace Phase 1 (scout) or Phase 2 (plan). It augments them with domain expertise.

## Phase 0: RESUME CHECK (Before Phase 1)

**Goal**: Detect if a master plan already exists for this task. If so, skip Phase 1-2 and resume from the current phase.

**Step 0.5 — Cross-Project Recall**: Call `neural-memory` (Recall Mode) with 3-5 topics relevant to the current task. Load applicable patterns, past decisions, and error history from neural memory. Always prefix queries with the project name to avoid cross-project noise (e.g., `"ProjectName auth pattern"` not just `"auth pattern"`). This activates neurons from past sessions and surfaces context that may not be in the local `.rune/` files.

1. Use `Glob` to check for `.rune/plan-*.md` files
2. If a master plan exists that matches the current task:
   - Read the master plan file
   - Find the first phase with status `⬚ Pending` or `🔄 Active`
   - Read ONLY that phase's file (e.g., `.rune/plan-<feature>-phase<N>.md`)
   - Announce: "Resuming from Phase N: <name>. Loading phase file."
   - Skip to Phase 4 (IMPLEMENT) with the phase file as context
   - Mark the phase as `🔄 Active` in the master plan
3. If no master plan exists → proceed to Phase 1 as normal

**This enables multi-session workflows**: Opus plans once → each session picks up the next phase.

## Phase 2: PLAN

**Goal**: Break the task into concrete implementation steps before writing code.

**REQUIRED SUB-SKILL**: Use `rune:plan`

1. Mark Phase 2 as `in_progress`
2. **Feature workspace** (opt-in) — for non-trivial features (3+ phases), suggest creating a feature workspace:
   ```
   .rune/features/<feature-name>/
   ├── spec.md       — what we're building and why (user's original request + context)
   ├── plan.md       — implementation plan (output of plan skill)
   ├── decisions.md  — feature-specific decisions (subset of .rune/decisions.md)
   └── status.md     — progress tracking (completed/pending phases)
   ```
   - Ask user: "Create feature workspace for `<feature-name>`?" — if yes, create the directory + spec.md with the user's request
   - plan.md is written after Step 4 (plan approval)
   - Skip for simple bug fixes, small refactors, or fast mode
   - Session-bridge (Phase 8) auto-updates status.md if workspace exists
3. Based on scout findings, create an implementation plan:
   - List exact files to create/modify
   - Define the order of changes
   - Identify dependencies between steps
   - **Include active decisions from Phase 1 step 3 as constraints** — plan must respect prior decisions or explicitly flag overrides
4. If multiple valid approaches exist → invoke `rune:brainstorm` for trade-off analysis
5. Present plan to user for approval
6. If feature workspace was created (step 2), write approved plan to `.rune/features/<name>/plan.md`
7. Mark Phase 2 as `completed`

**Gate**: User MUST approve the plan before proceeding. Do NOT skip this.

## Phase 2.5: ADVERSARY (Red-Team Challenge)

**Goal**: Stress-test the approved plan BEFORE writing code — catch flaws at plan time, not implementation time.

**REQUIRED SUB-SKILL**: Use `rune:adversary`

1. **Skip conditions** (do NOT run adversary for):
   - Bug fixes or hotfixes (plan is "fix the bug", nothing to challenge)
   - Simple refactors (< 3 files, no new logic)
   - Fast mode (user explicitly opted for speed)
2. **Run adversary** on the approved plan:
   - Full Red-Team mode for new features, architectural changes, security-sensitive plans
   - Quick Challenge mode for smaller plans (< 3 files, no auth/payment)
3. **Handle verdict**:
   - **REVISE** → return to Phase 2 (PLAN) with adversary findings as constraints. User must re-approve.
   - **HARDEN** → present remediations to user, update plan inline, then proceed to Phase 3
   - **PROCEED** → pass findings as implementation notes to Phase 3
4. **Max 1 REVISE loop** per cook session — if the revised plan also gets REVISE, ask user to decide

### Phase-Aware Execution (Master Plan + Phase Files)

When `rune:plan` produces a **master plan + phase files** (non-trivial tasks):

1. **After plan approval**: Read the master plan to identify Phase 1
2. **Load ONLY Phase 1's file** — do NOT load all phase files into context
3. **Execute Phase 1** through cook Phase 3-6 (test → implement → quality → verify)
4. **After Phase 1 complete**:
   - Mark tasks done in the phase file
   - Update master plan: Phase 1 status `⬚ → ✅`
   - Announce: "Phase 1 complete. Phase 2 ready for next session."
5. **Next session**: Phase 0 (RESUME CHECK) detects the master plan → loads Phase 2 → executes
6. **Repeat** until all phases are ✅

<HARD-GATE>
NEVER load multiple phase files at once. One phase per session = small context = better code.
If the coder model needs info from other phases, it's in the Cross-Phase Context section of the current phase file.
</HARD-GATE>

**Why one phase per session?**
- Big context = even Opus misses details and makes mistakes
- Small context = Sonnet handles correctly, Opus has zero mistakes
- Phase files are self-contained via Amateur-Proof Template — no other context needed

## Phase 3: TEST (TDD Red)

**Goal**: Define expected behavior with failing tests BEFORE writing implementation.

**REQUIRED SUB-SKILL**: Use `rune:test`

1. Mark Phase 3 as `in_progress`
2. Write test files based on the plan:
   - Use `Write` to create test files
   - Cover the primary use case + edge cases
   - Tests MUST be runnable
3. **Python async pre-check** (if async-first Python flagged in Phase 1):
   - Verify `pytest-asyncio` is in project dependencies (`pyproject.toml` or `requirements*.txt`)
   - Check `pyproject.toml` for `[tool.pytest.ini_options]` → `asyncio_mode = "auto"` — if missing, warn user and suggest adding it before writing async tests
   - If pytest-asyncio not installed: warn that async tests will silently pass without executing async code
4. Run the tests to verify they FAIL:
   - Use `Bash` to execute the test command (e.g., `pytest`, `npm test`, `cargo test`)
   - Expected: tests FAIL (red) because implementation doesn't exist yet
4. Mark Phase 3 as `completed`

**Gate**: Tests MUST exist and MUST fail. If tests pass without implementation → tests are wrong, rewrite them.

## Phase 4: IMPLEMENT (TDD Green)

**Goal**: Write the minimum code to make tests pass.

**REQUIRED SUB-SKILL**: Use `rune:fix`

1. Mark Phase 4 as `in_progress`
2. **Phase-file execution** — if working from a master plan + phase file:
   - Execute tasks listed in the phase file (the `## Tasks` section)
   - Follow code contracts from `## Code Contracts` section
   - Respect rejection criteria from `## Rejection Criteria` section
   - Handle failure scenarios from `## Failure Scenarios` section
   - Use `## Cross-Phase Context` for imports/exports from other phases
   - Mark each task `[x]` in the phase file as completed
3. Implement the feature following the plan:
   - Use `Write` for new files
   - Use `Edit` for modifying existing files
   - Follow project conventions found in Phase 1
3. Run tests after each significant change:
   - Use `Bash` to run tests
   - If tests pass → continue to next step in plan
   - If tests fail → debug and fix
   - **Python async checklist** (if async-first Python flagged in Phase 1):
     - No blocking calls in async functions: `time.sleep()` → `asyncio.sleep()`, `open()` → `aiofiles.open()`, `requests.get()` → `httpx.AsyncClient.get()`
     - Use `async with` for async context managers (DB connections, HTTP sessions)
     - Prefer `asyncio.gather()` for parallel I/O operations
     - Use `asyncio.TaskGroup` (Python 3.11+) for structured concurrency
4. If stuck on unexpected errors → invoke `rune:debug` (max 3 debug↔fix loops)
5. **Re-plan check** — before proceeding to Phase 5, evaluate:
   - Did debug-fix loops hit max (3) for any area? → trigger re-plan
   - Were files modified outside the approved plan scope? → trigger re-plan
   - Was a new dependency added that changes the approach? → trigger re-plan
   - Did the user request a scope change during implementation? → trigger re-plan
   - If any trigger fires: invoke `rune:plan` with delta context:
     ```
     Delta: { original_plan: "Phase 2 plan or .rune/features/<name>/plan.md",
              trigger: "max_debug | scope_expansion | new_dependency | user_scope_change",
              failed_area: "description of what went wrong",
              discovered: "new facts found during implementation" }
     ```
     Plan outputs revised phases. Get user approval before resuming.
6. **Approach Pivot Gate** — if re-plan ALSO fails (implementation still blocked after revised plan):

   <HARD-GATE>
   Do NOT surrender. Do NOT tell user "no solution exists."
   Do NOT try a 4th variant of the same approach.
   MUST invoke brainstorm(mode="rescue") before giving up.
   </HARD-GATE>

   **Trigger conditions** (ANY of these):
   - Re-plan produced a revised plan, but implementation hits the SAME category of blocker
   - 3 debug-fix loops exhausted AND re-plan exhausted (total 6+ failed attempts in same approach)
   - Agent catches itself about to say "this approach doesn't seem feasible" or "no solution found"

   **Action**:
   ```
   Invoke rune:brainstorm with:
     mode: "rescue"
     failed_approach: "[name of approach from Phase 2]"
     failure_evidence: ["blocker 1", "blocker 2", "blocker 3"]
     original_goal: "[what we're still trying to achieve]"
   ```

   brainstorm(rescue) returns 3-5 category-diverse alternatives → present to user → user picks → **restart from Phase 2** with the new approach. Previous work is sunk cost — do not try to salvage.

7. All tests MUST pass before proceeding
8. Mark Phase 4 as `completed`

**Gate**: ALL tests from Phase 3 MUST pass. Do NOT proceed with failing tests.

## Phase 5: QUALITY (Parallel)

**Goal**: Catch issues before they reach production.

Run quality checks **in parallel** for speed. Any CRITICAL finding blocks the commit.

```
PARALLEL EXECUTION:
  Launch 5a + 5b + 5c simultaneously as independent Task agents.
  Wait for ALL to complete before proceeding.
  If any returns BLOCK → fix findings, re-run the blocking check only.
```

### 5a. Preflight (Spec Compliance + Logic)
**REQUIRED SUB-SKILL**: Use `rune:preflight`
- **Spec compliance**: Compare approved plan (Phase 2) vs actual diff — did we build what we planned?
- Logic review: Are there obvious bugs?
- Error handling: Are errors caught properly?
- Completeness: Does it cover edge cases?

### 5b. Security
**REQUIRED SUB-SKILL**: Use `rune:sentinel`
- Secret scan: No hardcoded keys/tokens
- OWASP check: No injection, XSS, CSRF vulnerabilities
- Dependency audit: No known vulnerable packages

### 5c. Code Review
**REQUIRED SUB-SKILL**: Use `rune:review`
- Pattern compliance: Follows project conventions
- Code quality: Clean, readable, maintainable
- Performance: No obvious bottlenecks

### 5d. Completion Gate
**REQUIRED SUB-SKILL**: Use `rune:completion-gate`
- Validate that agent claims match evidence trail
- Check: tests actually ran (stdout captured), files actually changed (git diff), build actually passed
- Any UNCONFIRMED claim → BLOCK with specific gap identified

**Gate**: If sentinel finds CRITICAL security issue → STOP, fix it, re-run. Non-negotiable.
**Gate**: If completion-gate finds UNCONFIRMED claim → STOP, re-verify. Non-negotiable.

## Checkpoint Protocol (Opt-In)

For long-running cook sessions, save intermediate state at phase boundaries:

```
After Phase 2 (PLAN approved):    session-bridge saves plan + decisions
After Phase 4 (IMPLEMENT done):   session-bridge saves progress + modified files
After Phase 5 (QUALITY passed):   session-bridge saves quality results

Trigger: Invoke rune:session-bridge at each boundary.
This is OPT-IN — only activate if:
  - Task spans 3+ phases
  - Context-watch has triggered a warning
  - User explicitly requests checkpoints
```

## Phase Transition Protocol (MANDATORY)

Before entering ANY Phase N+1, assert ALL of the following:

```
ASSERT Phase N status == completed (in TodoWrite)
ASSERT Phase N gate condition met (see Mesh Gates table below)
ASSERT No BLOCK status from any sub-skill in Phase N
ASSERT No unresolved CRITICAL findings from quality checks

IF any assertion fails:
  → STOP. Do NOT proceed to Phase N+1.
  → Log: "BLOCKED at Phase N→N+1 transition: [specific assertion that failed]"
  → Fix the blocking issue, then re-check assertions.
```

**Key transitions to enforce:**
| Transition | Gate | Common Violation |
|---|---|---|
| Phase 1 → 2 | Scout Gate (codebase scanned) | Skipping scout "to save time" |
| Phase 2 → 3 | Plan Gate (user approved plan) | Starting code without approval |
| Phase 3 → 4 | Test-First Gate (failing tests exist) | Writing code before tests |
| Phase 4 → 5 | All tests pass | Moving to quality with failing tests |
| Phase 5 → 6 | Quality gate (no CRITICAL findings) | Ignoring sentinel CRITICAL |
| Phase 6 → 7 | Verification green (lint + types + build) | Committing broken build |

## Phase 6: VERIFY

**Goal**: Final automated verification before commit.

**REQUIRED SUB-SKILL**: Use `rune:verification`

1. Mark Phase 6 as `in_progress`
2. Run full verification suite:
   - Lint check (e.g., `eslint`, `ruff`, `clippy`)
   - Type check (e.g., `tsc --noEmit`, `mypy`, `cargo check`)
   - Full test suite (not just new tests)
   - Build (e.g., `npm run build`, `cargo build`)
3. Use `rune:hallucination-guard` to verify:
   - All imports reference real modules
   - API calls use correct signatures
   - No phantom dependencies
4. Mark Phase 6 as `completed`

**Gate**: ALL checks MUST pass. If any fail → fix and re-run. Do NOT commit broken code.

## Phase 7: COMMIT

**Goal**: Create a clean, semantic commit.

**RECOMMENDED SUB-SKILL**: Use `rune:git` for semantic commit generation.

1. Mark Phase 7 as `in_progress`
2. Stage changed files:
   - Use `Bash` to run `git add <specific files>` (NOT `git add .`)
   - Verify staged files with `git status`
3. Invoke `rune:git commit` to generate semantic commit message from staged diff:
   - Analyzes diff to classify change type (feat/fix/refactor/test/docs/chore)
   - Extracts scope from file paths
   - Detects breaking changes
   - Formats as conventional commit: `<type>(<scope>): <description>`
   - Fallback: if git skill unavailable, use format `<type>: <description>` manually
4. **Master plan update** — if working from a master plan + phase files:
   - Update the master plan file: current phase status `🔄 → ✅`
   - If next phase exists: announce "Phase N complete. Phase N+1 ready for next session."
   - If all phases ✅: announce "All phases complete. Feature done."
5. Mark Phase 7 as `completed`

## Phase 8: BRIDGE

**Goal**: Save context for future sessions and record metrics for mesh analytics.

**REQUIRED SUB-SKILL**: Use `rune:session-bridge`

1. Mark Phase 8 as `in_progress`
2. Save decisions to `.rune/decisions.md`:
   - What approach was chosen and why
   - Any trade-offs made
3. Update `.rune/progress.md` with completed task
4. Update `.rune/conventions.md` if new patterns were established
5. **Write skill-sourced metrics** to `.rune/metrics/skills.json`:
   - Read the existing file (or create `{ "version": 1, "updated": "<now>", "skills": {} }`)
   - Under the `cook` key, update:
     - `phases`: increment `run` or `skip` count for each phase that was run/skipped this session
     - `quality_gate_results`: increment `preflight_pass`/`preflight_fail`, `sentinel_pass`/`sentinel_block`, `review_pass`/`review_issues` based on Phase 5 outcomes
     - `debug_loops`: increment `total` by number of debug-fix loops in Phase 4, update `max_per_session` if this session exceeded it
   - Write the updated file back
6. **Adaptive error recovery** (H3 Intelligence):
   - If Phase 4 had 3 debug-fix loops (max) for a specific error pattern, write a routing override to `.rune/metrics/routing-overrides.json`:
     - Format: `{ "id": "r-<timestamp>", "condition": "<error pattern>", "action": "route to problem-solver before debug", "source": "auto", "active": true }`
   - Max 10 active rules — if exceeded, remove oldest inactive rule
7. **Step 8.5 — Capture Learnings**: Call `neural-memory` (Capture Mode). Save 2-5 memories covering: architecture decisions made this session, patterns introduced or validated, errors encountered and their root-cause fixes, and any trade-offs chosen. Use rich cognitive language (causal, decisional, comparative — not flat facts). Tag each memory with `[project-name, technology, topic]`. Priority: 5 for routine patterns, 7-8 for key decisions, 9-10 for critical errors. Do NOT batch — save each memory immediately. Do NOT wait for the user to ask.
8. Mark Phase 8 as `completed`

## Autonomous Loop Patterns

When cook runs inside `team` (L1) or autonomous workflows, these patterns apply:

### De-Sloppify Pass

After Phase 4 (IMPLEMENT), if the implementation touched 5+ files, run a focused cleanup pass:
1. Re-read all modified files
2. Check for: leftover debug statements, inconsistent naming, duplicated logic, missing error handling
3. Fix issues found (this is still Phase 4 — not a new phase)
4. This pass catches "almost right" code that slips through when focused on making tests pass

### Continuous PR Loop (team orchestration only)

When `team` runs multiple cook instances in parallel:
```
cook instance → commit → push → create PR → wait CI
  IF CI passes → mark workstream complete
  IF CI fails → read CI output → fix → push → wait CI (max 3 retries)
  IF 3 retries fail → escalate to user with CI logs
```

### Exit Conditions (Mandatory for Autonomous Runs)

Every cook invocation inside `team` or autonomous workflows MUST have exit conditions:

```
MAX_DEBUG_LOOPS:   3 per error area (already enforced)
MAX_QUALITY_LOOPS: 2 re-runs of Phase 5 (fix→recheck cycle)
MAX_REPLAN:        1 re-plan per cook session (Phase 4 re-plan check)
MAX_PIVOT:         1 approach pivot per cook session (Approach Pivot Gate)
TIMEOUT_SIGNAL:    If context-watch reports ORANGE, wrap up current phase and checkpoint
```

**Escalation chain**: debug-fix (3x) → re-plan (1x) → **approach pivot via brainstorm rescue (1x)** → THEN escalate to user. Never surrender before exhausting the pivot.

If any exit condition triggers without resolution → cook emits `BLOCKED` status with details and stops. Never spin indefinitely.

### Subagent Status Protocol

When cook completes (whether standalone or invoked by `team`), it MUST return one of four statuses. Sub-skills invoked by cook (fix, test, review, sentinel, etc.) MUST also return one of these statuses so cook can route accordingly.

| Status | Meaning | Cook Action |
|--------|---------|-------------|
| `DONE` | Task complete, no issues | Proceed to next phase |
| `DONE_WITH_CONCERNS` | Task complete but issues noted (e.g., "tests pass but a performance regression observed") | Proceed, but append concern to `.rune/progress.md` and surface in Cook Report; address in Phase 5 (QUALITY) or next review cycle |
| `NEEDS_CONTEXT` | Cannot proceed without more information (missing requirement, ambiguous spec, unknown environment) | Pause execution. Ask user the specific question(s) blocking progress. Resume from the same phase after answer received. |
| `BLOCKED` | Hard blocker — cannot continue regardless of context (broken dependency, fundamental incompatibility, exhausted escalation chain) | Trigger escalation chain: debug-fix (3x) → re-plan (1x) → brainstorm rescue (1x) → then escalate to user with full details |

**DONE_WITH_CONCERNS logging format** (append to `.rune/progress.md`):
```
[CONCERN][phase][timestamp] <sub-skill>: <concern description>
```

**NEEDS_CONTEXT format**: State exactly what is unknown, why it blocks progress, and what the two most likely answers are (to help the user respond quickly).

**BLOCKED format**: Include the phase, the sub-skill that emitted BLOCKED, the specific blocker, and what was already attempted.

## Error Recovery

| Phase | If this fails... | Do this... |
|-------|-----------------|------------|
| 1 UNDERSTAND | scout finds nothing relevant | Proceed with plan, note limited context |
| 2 PLAN | Task too complex | Break into smaller tasks, consider `rune:team` |
| 3 TEST | Can't write tests (no test framework) | Skip TDD, write tests after implementation |
| 4 IMPLEMENT | Fix hits repeated bugs | `rune:debug` (max 3 loops) → re-plan → if still blocked → **Approach Pivot Gate** → `rune:brainstorm(rescue)` |
| 5a PREFLIGHT | Logic issues found | Fix → re-run preflight |
| 5b SENTINEL | Security CRITICAL found | Fix immediately → re-run (mandatory) |
| 5c REVIEW | Code quality issues | Fix CRITICAL/HIGH → re-review (max 2 loops) |
| 6 VERIFY | Build/lint/type fails | Fix → re-run verification |

## Called By (inbound)

- User: `/rune cook` direct invocation — primary entry point
- `team` (L1): parallel workstream execution (meta-orchestration)

## Calls (outbound)

- `neural-memory` (external): Phase 0 (resume) + Phase 8 (complete) — Recall project context at start, capture learnings at end
- `sentinel-env` (L3): Phase 0.5 — environment pre-flight (first run only)
- `scout` (L2): Phase 1 — scan codebase before planning
- `onboard` (L2): Phase 1 — if no CLAUDE.md exists, initialize project context first
- `plan` (L2): Phase 2 — create implementation plan
- `brainstorm` (L2): Phase 2 — trade-off analysis when multiple approaches exist
- `design` (L2): Phase 2 — UI/design phase when building frontend features
- `adversary` (L2): Phase 2.5 — red-team challenge on approved plan before implementation
- `test` (L2): Phase 3 — write failing tests (RED phase)
- `fix` (L2): Phase 4 — implement code changes (GREEN phase)
- `debug` (L2): Phase 4 — when implementation hits unexpected errors (max 3 loops)
- `db` (L2): Phase 4 — when schema changes are detected in the diff
- `preflight` (L2): Phase 5a — logic and completeness review
- `sentinel` (L2): Phase 5b — security scan
- `review` (L2): Phase 5c — code quality review
- `perf` (L2): Phase 5 — performance regression check before PR (optional)
- `completion-gate` (L3): Phase 5d — validate agent claims against evidence trail
- `constraint-check` (L3): Phase 5 — audit HARD-GATE compliance across workflow
- `verification` (L3): Phase 6 — automated checks (lint, types, tests, build)
- `hallucination-guard` (L3): Phase 6 — verify imports and API calls are real
- `journal` (L3): Phase 7 — record architectural decisions made during feature
- `session-bridge` (L3): Phase 8 — save context for future sessions
- `audit` (L2): Phase 5 — project health audit when scope warrants it
- `review-intake` (L2): Phase 5 — structured review intake for complex PRs
- `sast` (L3): Phase 5 — static analysis security testing
- `skill-forge` (L2): when new skill creation detected during cook flow
- `worktree` (L3): Phase 4 — worktree isolation for parallel implementation
- L4 extension packs: Phase 1.5 — domain-specific patterns when stack matches (see Phase 1.5 mapping table)

## Constraints

1. MUST run scout before planning — no plan based on assumptions alone
2. MUST present plan to user and get approval before writing code
3. MUST write failing tests before implementation (TDD) unless explicitly skipped by user
4. MUST NOT commit with failing tests — fix or revert first
5. MUST NOT modify files outside the approved plan scope without user confirmation
6. MUST run verification (lint + type-check + tests + build) before commit — not optional
7. MUST NOT say "all tests pass" without showing the actual test output
8. MUST NOT contradict active decisions from `.rune/decisions.md` without explicit user override — if the plan conflicts with a prior decision, flag it and ask user before proceeding

## Mesh Gates

| Gate | Requires | If Missing |
|------|----------|------------|
| Resume Gate | Phase 0 checks for existing master plan before starting | Proceed to Phase 1 if no plan exists |
| Scout Gate | scout output (files examined, patterns found) before Phase 2 | Invoke rune:scout first |
| Plan Gate | User-approved plan with file paths before Phase 3 | Cannot proceed to TEST |
| Adversary Gate | adversary verdict (PROCEED/HARDEN) before Phase 3 for features | Skip for bugfix/hotfix/refactor/fast-mode |
| Phase File Gate | Current phase file loaded (not full plan) for multi-session | Load only the active phase file |
| Test-First Gate | Failing tests exist before Phase 4 IMPLEMENT | Write tests first or get explicit skip from user |
| Quality Gate | preflight + sentinel + review passed before Phase 7 COMMIT | Fix findings, re-run |
| Verification Gate | lint + types + tests + build all green before commit | Fix failures, re-run |

## Output Format

```
## Cook Report: [Task Name]
- **Status**: complete | partial | blocked
- **Phases**: [list of completed phases]
- **Files Changed**: [count] ([list])
- **Tests**: [passed]/[total] ([coverage]%)
- **Quality**: preflight [PASS/WARN] | sentinel [PASS/WARN] | review [PASS/WARN]
- **Commit**: [hash] — [message]

### Decisions Made
- [decision]: [rationale]

### Session State
- Saved to .rune/decisions.md
- Saved to .rune/progress.md
```

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Skipping scout to "save time" on a simple task | CRITICAL | Scout Gate blocks this — Phase 1 is mandatory regardless of perceived simplicity |
| Writing code without user-approved plan | HIGH | Plan Gate: do NOT proceed to Phase 3 without explicit approval ("go", "proceed", "yes") |
| Claiming "all tests pass" without showing output | HIGH | Constraint 7 blocks this — show actual test runner output via completion-gate |
| Entering debug↔fix loop more than 3 times without escalating | MEDIUM | After 3 loops → re-plan → if still blocked → Approach Pivot Gate → brainstorm(rescue) |
| Surrendering "no solution" without triggering Approach Pivot Gate | CRITICAL | MUST invoke brainstorm(rescue) before telling user "can't be done" — pivot to different category first |
| Re-planning with the same approach category after it fundamentally failed | HIGH | Re-plan = revise steps within same approach. If CATEGORY is wrong → Approach Pivot Gate, not re-plan |
| Not escalating to sentinel:opus on security-sensitive tasks | MEDIUM | Auth, crypto, payment code → sentinel must run at opus, not sonnet |
| Running Phase 5 checks sequentially instead of parallel | MEDIUM | Launch preflight+sentinel+review as parallel Task agents for speed |
| Saying "done" without evidence trail | CRITICAL | completion-gate validates claims — UNCONFIRMED = BLOCK |
| Fast mode on security-relevant code | HIGH | Fast mode auto-excludes auth/crypto/payments — never fast-track security code |
| Loading all phase files at once into context | HIGH | Phase File Gate: load ONLY the active phase file — one phase per session |
| Resuming without checking master plan | MEDIUM | Phase 0 (RESUME CHECK) runs before Phase 1 — detects existing plans |

## Done When

- All applicable phases complete per Phase Skip Rules (determined before starting)
- User has approved the plan (Phase 2 gate — explicit "go" received)
- All tests PASS — actual test runner output shown
- preflight + sentinel + review all PASS or findings addressed
- verification (lint + types + build) green
- Commit created with semantic message
- Cook Report emitted with commit hash and phase list
- Session state saved to .rune/ via session-bridge

## Cost Profile

~$0.05-0.15 per feature. Haiku for scanning (Phase 1), sonnet for coding (Phase 3-4), opus for complex planning (Phase 2 when needed).
