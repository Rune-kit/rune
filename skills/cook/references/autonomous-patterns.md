# cook — Autonomous loop patterns

> Reference for `skills/cook/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

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

> **HARD-GATE** — this gate stays in `SKILL.md` (always loaded) under the section of the same name; it applies here unchanged.

### Exit Conditions (Mandatory for Autonomous Runs)

<MUST-READ path="references/exit-conditions.md" trigger="cook running inside team or any autonomous workflow"/>

Hard caps: MAX_DEBUG_LOOPS=3, MAX_QUALITY_LOOPS=2, MAX_REPLAN=1, MAX_PIVOT=1, MAX_FIXES=30, WTF_THRESHOLD=20%.
Escalation chain: debug-fix (3x) → re-plan (1x) → brainstorm rescue (1x) → THEN escalate to user.

### Structured Escalation Report

After 3 retry failures, structured escalation prevents cargo-cult retrying.

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

> **HARD-GATE** — this gate stays in `SKILL.md` (always loaded) under the section of the same name; it applies here unchanged.

### Subagent Question Gate

Subagents that start work without asking questions frequently produce the wrong thing.

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
