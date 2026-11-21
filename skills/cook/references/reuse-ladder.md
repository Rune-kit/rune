# cook — Reuse ladder

> Reference for `skills/cook/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

### Reuse Ladder (climb before you write)

Before writing the code for each task, climb this ladder and stop at the first rung that holds. Advisory, not a gate — it shapes *what* you write, never blocks the phase. Runs AFTER you understand the change (scout done, plan approved), never as a substitute for tracing the real flow.

1. **Needs to exist at all?** Speculative need → skip it, say so in one line (YAGNI).
2. **Already in this codebase?** A helper, util, type, or pattern that already lives here → reuse it. Re-implementing what sits a few files over is the most common slop — `Grep` before you write.
3. **Stdlib does it?** Use it.
4. **Native platform feature covers it?** DB constraint over app code, CSS over JS, `<input type="date">` over a picker lib.
5. **Already-installed dependency solves it?** Use it. Never add a new dep for what a few lines cover.
6. **One line?** Make it one line.
7. **Only then** — the minimum code that makes the test pass.

Two rungs work → take the higher one and move on. Mark a deliberate shortcut with a `// yagni:` comment naming its ceiling + upgrade path (`// yagni: global lock — per-account locks if throughput matters`) so the De-Sloppify Pass and later readers see intent, not ignorance.

**Bug-fix corollary** — the lazy fix IS the root-cause fix: `Grep` every caller of the function you're about to touch, then fix the shared function once. One guard where all callers route through is a smaller diff than one guard per caller — and patching only the path the ticket names leaves every sibling caller still broken.

**Never lazy about**: understanding the problem, input validation at trust boundaries, error handling that prevents data loss, security, accessibility, anything explicitly requested. The ladder shortens the solution, never the reading — a small diff you don't understand is a confident wrong fix, not laziness.

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
   - **Oracle reattach check** — between tasks, glob `.rune/oracle-pending/*.json`. For any record with `status=pending`, invoke `session-bridge --reattach <sessionId>`. If `complete` → consume the response (route to debug/fix per `sourceSkill`). If `pending` → continue with next independent task. If `failed` → continue without second opinion.
6. **Re-plan check** — evaluate before Phase 5: max debug loops hit? out-of-scope files changed? new dep changes approach? user scope change? If any fire → invoke `rune:plan` with delta context, get user approval before resuming.
7. **Approach Pivot Gate** — if re-plan ALSO fails:

   > **HARD-GATE** — this gate stays in `SKILL.md` (always loaded) under the section of the same name; it applies here unchanged.

   Invoke `rune:brainstorm(mode="rescue")` with `failed_approach`, `failure_evidence[]`, `original_goal`. Returns 3-5 alternatives → user picks → **restart from Phase 2**.

8. All tests MUST pass before proceeding
9. Mark Phase 4 as `completed`

**Gate**: ALL tests from Phase 3 MUST pass. Do NOT proceed with failing tests.
