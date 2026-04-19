---
name: session-bridge
description: Universal context persistence across sessions. Auto-saves decisions, conventions, and progress to .rune/ files. Loads state at session start. Use when any skill makes architectural decisions or establishes patterns that must survive session boundaries.
metadata:
  author: runedev
  version: "0.7.0"
  layer: L3
  model: haiku
  group: state
  tools: "Read, Write, Edit, Glob, Grep"
  listen: phase.complete, checkpoint.request
  emit: invariants.loaded
---

# session-bridge

## Purpose

Solve the #1 developer complaint: context loss across sessions. Session-bridge auto-saves critical context to `.rune/` files in the project directory, and loads them at session start. Every new session knows exactly where the last one left off.

## Triggers

- Auto-trigger: when an architectural decision is made
- Auto-trigger: when a convention/pattern is established
- Auto-trigger: before context compaction
- Auto-trigger: at session end (stop hook)
- Signal: `checkpoint.request` — explicit checkpoint from cook/team mid-phase
- `/checkpoint` — manual checkpoint (save exact resume point)
- `/rune status` — manual state check

## Calls (outbound)

# Exception: L3→L3 coordination (same pattern as hallucination-guard → research)
- `integrity-check` (L3): verify .rune/ file integrity before loading state

## Called By (inbound)

- `cook` (L1): auto-save decisions during feature implementation
- `rescue` (L1): state management throughout refactoring
- `context-engine` (L3): save state before compaction
- `context-pack` (L3): coordinate state for sub-agent handoff
- `neural-memory` (L3): sync key decisions back to `.rune/` files after Capture Mode

## State Files Managed

```
.rune/
├── decisions.md        — Architectural decisions log
├── conventions.md      — Established patterns & style
├── progress.md         — Task progress tracker
├── session-log.md      — Brief log of each session
├── instincts.md        — Learned project-specific patterns (trigger→action)
├── cumulative-notes.md — Living project understanding (profile, themes, relationships)
├── learnings.jsonl     — Structured learning log (append-only, queryable)
└── checkpoint.md       — Exact resume point for cross-session continuity
```

## Execution

### Save Mode (end of session or pre-compaction)

#### Step 1 — Gather state

Collect from the current session:
- All architectural or technology choices made (language, library, approach)
- Conventions established (naming patterns, file structure, coding style)
- Tasks completed, in-progress, and blocked
- A one-paragraph summary of what this session accomplished

**Python project context** (if `pyproject.toml` or `setup.py` detected):
- Python version (from `.python-version`, `pyproject.toml` `requires-python`, or `python --version`)
- Virtual environment path and type (venv, poetry, uv, conda)
- Installed optional dependency groups (e.g., `[dev]`, `[test]`, `[embeddings]`)
- Last mypy error count (from most recent verification run, if available)
- Last test coverage percentage (from most recent test run, if available)
- DB migration version (if alembic, django migrations, or similar detected)

#### Step 2 — Update .rune/decisions.md

Use `Glob` to check if `.rune/decisions.md` exists. If not, use `Write` to create it with a `# Decisions Log` header.

For each architectural decision from this session, use `Edit` to append to `.rune/decisions.md`:

```markdown
## [YYYY-MM-DD HH:MM] Decision: <title>

**Context:** Why this decision was needed
**Decision:** What was decided
**Rationale:** Why this approach over alternatives
**Impact:** What files/modules are affected
```

#### Step 3 — Update .rune/conventions.md

Use `Glob` to check if `.rune/conventions.md` exists. If not, use `Write` to create it with a `# Conventions` header.

For each pattern or convention established, use `Edit` to append to `.rune/conventions.md`:

```markdown
## [YYYY-MM-DD] Convention: <title>

**Pattern:** Description of the convention
**Example:** Code example showing the pattern
**Applies to:** Where this convention should be followed
```

Python example:
```markdown
## [YYYY-MM-DD] Convention: Async-First I/O

**Pattern:** All I/O functions use `async def`; blocking calls (`requests`, `open`, `time.sleep`) are forbidden in async modules
**Example:** `async def fetch_data(): async with httpx.AsyncClient() as client: ...`
**Applies to:** All modules in `src/` — sync wrappers only in CLI entry points
```

#### Step 4 — Update .rune/progress.md

Use `Glob` to check if `.rune/progress.md` exists. If not, use `Write` to create it with a `# Progress` header.

Use `Edit` to append the current task status to `.rune/progress.md`:

```markdown
## [YYYY-MM-DD HH:MM] Session Summary

**Completed:**
- [x] Task description

**In Progress:**
- [ ] Task description (step X/Y)

**Blocked:**
- [ ] Task description — reason

**Next Session Should:**
- Start with X
- Continue Y from step Z

**Python Context** (if Python project):
- Python: [version] ([venv type])
- Installed extras: [list of optional dependency groups]
- mypy: [error count] ([strict/normal])
- Coverage: [percentage]%
- Migration: [version or N/A]
```

#### Step 5 — Update .rune/session-log.md

Use `Glob` to check if `.rune/session-log.md` exists. If not, use `Write` to create it with a `# Session Log` header.

Use `Edit` to append a one-line entry to `.rune/session-log.md`:

```
[YYYY-MM-DD HH:MM] — [brief description of session accomplishments]
```

#### Step 5.5 — Autonomous Loop Notes (when inside team or headless)

When session-bridge is invoked by `cook` running inside `team` or in autonomous mode (`claude -p`), persist iteration state to `.rune/task-notes.md`:

```markdown
# Task Notes: [task name]
## What Worked (with evidence)
- [approach]: [outcome, test output, or file path as proof]

## What Failed
- [approach]: [why it failed, error message]

## What's Left
- [ ] [remaining task with specific next step]

## Key Context for Next Iteration
- [critical info that would be lost on context reset]
```

**Why**: In autonomous loops, each `claude -p` invocation starts with zero context. Without this file, the next iteration repeats failed approaches and loses progress. The notes bridge the gap between independent invocations.

**Rules**: Agent reads `.rune/task-notes.md` at start (Step 1 of Load Mode), updates at end. Keep concise — max 50 lines. Prune completed items.

#### Step 5.7 — Instinct Extraction (Project-Scoped Learning)

Extract atomic "instincts" — learned trigger→action patterns — from this session and persist to `.rune/instincts.md`. Instincts are project-scoped by default to prevent cross-project contamination.

**Instinct format:**

```markdown
## [YYYY-MM-DD] Instinct: <short name>

**Trigger:** <when this pattern applies — specific condition>
**Action:** <what to do — specific behavior>
**Confidence:** <0.3–0.9>
**Evidence:** <what happened that taught this — file, error, outcome>
```

**Extraction rules:**

| Signal | Example | Confidence |
|--------|---------|------------|
| Repeated manual correction by user | "Don't use X, use Y here" (2+ times) | 0.7–0.9 |
| Failed approach → successful pivot | Tried approach A, failed, approach B worked | 0.5–0.7 |
| Project-specific convention discovered | "This codebase uses X pattern for Y" | 0.4–0.6 |
| One-off preference (may not generalize) | User chose a specific library once | 0.3–0.4 |

**Promotion to global**: When the same instinct (matching trigger+action) appears in `.rune/instincts.md` across 2+ projects at confidence ≥0.8, promote it to Neural Memory via Step 6 with tag `[cross-project, instinct]`. Until then, it stays project-local.

**Pruning**: At session start (Load Mode Step 1), review instincts older than 30 days with confidence <0.5 — remove them. Instincts that conflict with current conventions should be removed immediately.

**Max instincts**: Keep `.rune/instincts.md` under 20 entries. When full, evict the lowest-confidence entry.

#### Step 5.8 — Learnings Log (Structured JSONL)

Append structured learning entries to `.rune/learnings.jsonl` — an append-only log that captures decisions, insights, and error resolutions in a machine-queryable format. Unlike markdown state files (which are for human reading), JSONL enables fast filtering and "latest winner" lookups.

**Entry schema** — one JSON object per line:

```json
{"ts":"2026-04-04T14:30:00Z","skill":"cook","type":"decision","key":"state-lib","insight":"Chose Zustand over Redux — fewer re-renders in dashboard with 50+ real-time widgets","confidence":0.8,"files":["src/store/index.ts"]}
```

| Field | Type | Description |
|-------|------|-------------|
| `ts` | ISO 8601 | When the learning was captured |
| `skill` | string | Which skill produced this learning |
| `type` | enum | `decision` · `error` · `insight` · `convention` · `performance` |
| `key` | string | Dedup key — latest entry per key+type wins on read |
| `insight` | string | 1-2 sentences, causal language ("Chose X because Y", "Root cause was X") |
| `confidence` | 0.1–1.0 | How certain this learning is (0.3=hunch, 0.7=validated, 0.9=battle-tested) |
| `files` | string[] | Optional — affected file paths |

**Write rules:**
- Append only — never edit or delete lines in the JSONL file
- Max 1-3 entries per session (only genuinely transferable learnings)
- Use causal/comparative language, not flat facts
- Key must be kebab-case, descriptive (e.g., `auth-lib`, `db-migration-strategy`, `react-hook-pitfall`)

**Read rules (latest-winner):**
- When loading learnings, group by `key+type` and take the entry with the latest `ts`
- This means updating a learning = just append a new entry with the same key+type
- No dedup needed on write — dedup happens on read

**Query patterns** (for other skills or session-start):
- All learnings: read `.rune/learnings.jsonl`, parse line-by-line
- By type: filter `type === "error"` to surface past mistakes before coding
- By skill: filter `skill === "cook"` to see cook-specific learnings
- By recency: sort by `ts` descending, take top N
- Surface top 5 learnings at session start if file has 10+ entries

**Pruning**: When file exceeds 100 entries, compact by keeping only the latest-winner per key+type. Write compacted entries to a new file, replace original.

**Why**: Markdown state files (decisions.md, conventions.md) are great for human reading but hard to query programmatically. JSONL enables structured recall — "show me all errors from last week" or "what did we decide about auth?" — without parsing markdown headers.

#### Step 5.9 — Cumulative Project Notes (Structured Memory)

Maintain a running **cumulative notes** file at `.rune/cumulative-notes.md` that evolves across sessions. Unlike `progress.md` (which tracks tasks) or `decisions.md` (which logs choices), cumulative notes capture the **living understanding** of the project — patterns learned, relationships discovered, recurring themes, and open threads.

**Format** — use these fixed sections (add content, never remove prior entries):

```markdown
# Cumulative Project Notes

## Project Profile
- [Core purpose of the project — 1 sentence]
- [Primary users/audience]
- [Key technical constraints — e.g., "must run offline", "latency-critical", "multi-tenant"]

## Architecture Map
- [Key modules and their responsibilities — discovered over sessions]
- [Critical data flows — e.g., "user input → validation → API → DB → cache invalidation"]
- [Integration points — external APIs, services, databases]

## Recurring Themes
- [Patterns that keep coming up across sessions — e.g., "auth edge cases", "migration complexity"]
- [Common failure modes — what breaks and why]
- [Technical debt hotspots — areas that repeatedly cause issues]

## Active Topics
- [What's currently being worked on — updated each session]
- [Open questions that haven't been resolved yet]
- [Experiments in progress]

## Relationship Map
- [Key files and their dependencies — "changing X requires updating Y"]
- [People and their areas — "Alice owns auth, Bob owns payments"]
- [External service dependencies — "Stripe webhook → order.complete handler"]

## Follow-Up Items
- [ ] [Things noted but not yet addressed — carry forward until done]
- [ ] [Ideas that came up during work but were out of scope]

## Attention Points
- [Things the next session should be aware of — fragile areas, pending PRs, deadlines]
- [Temporary workarounds that need proper fixes]
```

**Update rules:**
- **Create** the file on first session-bridge save if it doesn't exist
- **Append** to existing sections — never overwrite prior entries (they represent accumulated knowledge)
- **Prune** entries older than 60 days in Recurring Themes and Relationship Map — these may be stale
- **Move** completed Follow-Up Items to a `## Resolved` section at the bottom (keep last 10)
- **Keep under 200 lines** — if approaching limit, summarize older entries in each section

**Why**: Individual state files (decisions.md, progress.md) capture discrete events. Cumulative notes capture the **emergent understanding** that develops over many sessions — the kind of knowledge that's lost when context resets. This is the project's "institutional memory."

#### Step 6 — Cross-Project Knowledge Extraction (Neural Memory Bridge)

Before committing, extract generalizable patterns from this session for cross-project reuse:

1. Review the session's decisions, conventions, and completed tasks
2. Identify 1-3 patterns that are NOT project-specific but would help in OTHER projects:
   - Technology choices with reasoning ("Chose Redis over Memcached because X")
   - Architecture patterns ("Fan-out queue pattern solved Y")
   - Failure modes discovered ("React 19 useEffect cleanup breaks when Z")
   - Performance insights ("N+1 query pattern in Prisma solved by include")
3. For each generalizable pattern, save to Neural Memory:
   - Use `nmem_remember` with rich cognitive language (causal, comparative, decisional)
   - Tags: `[cross-project, <technology>, <pattern-type>]`
   - Priority: 6-7 (important enough to surface in other projects)
4. Skip if session was purely project-specific (config changes, bug fixes with no transferable insight)

**Why**: This turns every project session into learning that compounds across ALL projects. A pattern discovered in Project A auto-surfaces when Project B faces a similar problem.

#### Step 7 — Commit

Stage and commit all updated state files:

```bash
git add .rune/ && git commit -m "chore: update rune session state"
```

If git is not available or the directory is not a repo, skip the commit and emit a warning.

---

### Load Mode (start of session)

#### Step 1 — Check existence

Use `Glob` to check for `.rune/` directory:

```
Glob pattern: .rune/*.md
```

If no files found: suggest running `/rune onboard` to initialize the project. Exit load mode.

#### Step 1.5 — Integrity verification

Before loading state files, invoke `integrity-check` (L3) to verify `.rune/` files haven't been tampered:

```
REQUIRED SUB-SKILL: rune:integrity-check
→ Invoke integrity-check on all .rune/*.md files found in Step 1.
→ Capture: status (CLEAN | SUSPICIOUS | TAINTED), findings list.
```

Handle results:
- `CLEAN` → proceed to Step 2 (load files)
- `SUSPICIOUS` → present warning to user with specific findings. Ask: "Suspicious patterns detected in .rune/ files. Load anyway?" If user approves → proceed. If not → exit load mode.
- `TAINTED` → **BLOCK load**. Report: ".rune/ integrity check FAILED — possible poisoning detected. Run `/rune integrity` for details."

#### Step 1.7 — Load invariants (auto-discipline)

Before loading the usual state files, run the invariants loader so the agent sees active discipline rules without being told to look:

```
Execute: node skills/session-bridge/scripts/load-invariants.js --root <project-root> --json
```

The loader:
- Reads `.rune/INVARIANTS.md` (silent no-op if missing)
- Strips the `## Archived` section (retired rules don't re-activate)
- Parses active rules into `{ section, title, what, where, why }`
- Returns a token-budgeted preview (≤ 500 tokens by default)
- Flags staleness when mtime > 30 days

**Emit signal**: `invariants.loaded` with payload `{ loaded, count, rules, stats, stale, overflow, path }` where:
- `loaded` (boolean) — whether any active rules were parsed
- `count` (number) — total active rules (convenience alias for `stats.total`)
- `rules` (array) — full rule objects `[{ section, title, what, where: string[], why }]` — consumers cache these for glob matching
- `stats` — `{ danger, critical, state, cross, total, archivedSkipped }`
- `stale` (boolean) — mtime > 30 days
- `overflow` (number) — rules present but not shown in preview (budget overflow)
- `path` (string) — absolute path to `.rune/INVARIANTS.md`

Downstream listeners (`logic-guardian`, Pro `autopilot`) consume `rules[]` directly — no second file read needed.

**Present to agent** (injected verbatim into the Load Mode summary):

```
📎 Active Invariants (.rune/INVARIANTS.md)
⚠  skills/skill-router/** — L0 router, never bypass
🔒  compiler/parser.js — IR schema is the adapter contract
🔁  compiler/hooks/dispatch.js — phase order is pre → run → post
🔗  .claude-plugin/marketplace.json — mirrors plugin.json
…+2 more rules in .rune/INVARIANTS.md
```

**Staleness warning** (emit ONCE per session, not per tool call):

```
⚠ Invariants file is stale (> 30 days since last onboard). Consider `rune onboard --refresh`.
```

**Failure modes**:
- Missing file → silent no-op (no preview, no error). Don't nag fresh repos.
- Malformed file → `loaded: false, rules: []`. Log a single-line warning, continue.
- File fails `integrity-check` in Step 1.5 → this step is skipped entirely (load already blocked).

#### Step 2 — Load files

Use `Read` on all four state files in parallel:

```
Read: .rune/decisions.md
Read: .rune/conventions.md
Read: .rune/progress.md
Read: .rune/session-log.md
Read: .rune/cumulative-notes.md
```

#### Step 3 — Summarize

Present the loaded context to the agent in a structured summary:

> "Here's what happened in previous sessions:"
> - Last session: [last line from session-log.md]
> - Key decisions: [last 3 entries from decisions.md]
> - Active conventions: [count from conventions.md]
> - Current progress: [in-progress and blocked items from progress.md]
> - Project understanding: [Active Topics + Attention Points from cumulative-notes.md]
> - Next task: [first item under "Next Session Should" from progress.md]

#### Step 4 — Resume

Identify the next concrete task from `progress.md` → "Next Session Should" section. Present it as the recommended starting point to the calling orchestrator.

### Checkpoint Mode (explicit save-and-resume point)

Unlike Save Mode (which captures session state broadly), Checkpoint Mode creates an **exact resume point** — a single file that tells the next session precisely where to pick up, what's in-flight, and what decisions are load-bearing.

**Trigger**: User says `/checkpoint`, or `cook`/`team` emits `checkpoint.request` signal when pausing mid-phase.

#### Step 1 — Capture resume state

Collect into a structured checkpoint:

```markdown
# Checkpoint — [YYYY-MM-DD HH:MM]

## What I Was Doing
[1-2 sentences: the exact task and sub-step in progress]

## Current Git State
- Branch: [branch name]
- Last commit: [short hash + message]
- Uncommitted changes: [list of modified/untracked files, or "clean"]
- Stashed: [yes/no — if yes, stash message]

## Decisions Made This Session (Load-Bearing)
[Only decisions that affect the remaining work — not all decisions]
- [Decision 1]: [choice + why]
- [Decision 2]: [choice + why]

## What's Left (Ordered)
1. [Next immediate step — be specific: file, function, what to change]
2. [Step after that]
3. [Remaining steps...]

## Context the Next Session Needs
[Critical info that's NOT in the code or git history — mental model, gotchas discovered, things tried and failed]
- [Item 1]
- [Item 2]

## Resume Command
[Exact instruction for the next session to pick up — e.g., "Continue Phase 2 Task 3: implement the retry logic in src/api/client.ts, the happy path is done, need error handling"]
```

#### Step 2 — Write checkpoint file

Write to `.rune/checkpoint.md` (overwrite — only one active checkpoint at a time).

#### Step 3 — Confirm to user

```
## Checkpoint Saved
- **Resume point**: [1-line summary of what to continue]
- **Git state**: [branch] @ [commit hash] — [clean/N uncommitted files]
- **Remaining tasks**: [count]
- Next session will auto-detect this checkpoint and offer to resume.
```

#### Checkpoint Resume (in Load Mode)

At Load Mode Step 1, after checking `.rune/*.md` existence, also check for `.rune/checkpoint.md`:

- If checkpoint exists, read it FIRST (before other state files)
- Present the resume point prominently:
  ```
  ## Checkpoint Detected — [date]
  **Resume**: [Resume Command from checkpoint]
  **Git state**: [branch] @ [commit] — [clean/dirty]
  **Tasks remaining**: [count]
  ```
- After successful resume (user confirms they've picked up where they left off), rename checkpoint:
  ```bash
  mv .rune/checkpoint.md .rune/checkpoint-[date].resolved.md
  ```
- Keep last 3 resolved checkpoints for history, delete older ones

**Why**: Save Mode captures everything broadly. Checkpoint captures the **exact needle position** — like a bookmark in a book vs. a summary of chapters read. The next session doesn't need to scan all state files to figure out what to do; the checkpoint tells it directly.

## Output Format

### Save Mode
```
## Session Bridge — Saved
- **decisions.md**: [N] decisions appended
- **conventions.md**: [N] conventions appended
- **progress.md**: updated (completed/in-progress/blocked counts)
- **session-log.md**: 1 entry appended
- **Git commit**: [hash] | skipped (no git)
```

### Load Mode
```
## Session Bridge — Loaded
- **Last session**: [date and summary]
- **Checkpoint**: [detected — resume point] | [none]
- **Invariants**: [N loaded from .rune/INVARIANTS.md] | [none] | [stale — run rune onboard --refresh]
- **Decisions on file**: [count]
- **Conventions on file**: [count]
- **Learnings on file**: [count] (top 5 surfaced if 10+)
- **Next task**: [task description]
```

### Checkpoint Mode
```
## Checkpoint Saved
- **Resume point**: [1-line summary]
- **Git state**: [branch] @ [hash] — [clean/N files]
- **Remaining tasks**: [count]
```

## Constraints

1. MUST save decisions, conventions, and progress — not just a status line
2. MUST verify saved context can be loaded in a fresh session — test the round-trip
3. MUST NOT overwrite existing bridge data without merging

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Overwriting existing .rune/ files instead of appending | HIGH | Constraint 3: use Edit to append entries — never Write to overwrite existing state |
| Saving only a status line, missing decisions/conventions | HIGH | Constraint 1: all three files (decisions, conventions, progress) must be updated |
| Load mode presenting stale context without age marker | MEDIUM | Mark each loaded entry with its session date — caller knows how fresh it is |
| Silent failure when git unavailable | MEDIUM | Note "no git available" in report — do not fail silently or skip without logging |
| Loading poisoned .rune/ files without verification | CRITICAL | Step 1.5 integrity-check MUST run before loading — TAINTED = block load |
| Learnings JSONL grows unbounded | MEDIUM | Auto-compact at 100 entries — keep only latest-winner per key+type |
| Checkpoint stale after code changes | MEDIUM | Checkpoint includes git state — if branch/commit differ at resume, warn user that checkpoint may be outdated |
| Multiple checkpoints overwrite each other | LOW | By design — only one active checkpoint. Resolved ones archived with date suffix |

## Done When (Save Mode)

- decisions.md updated with all architectural decisions made this session
- conventions.md updated with all new patterns established
- progress.md updated with completed/in-progress/blocked task status
- session-log.md appended with one-line session summary
- learnings.jsonl appended with 1-3 structured entries (if transferable learnings exist)
- Git commit made (or "no git" noted in report)
- Session Bridge Saved report emitted

## Done When (Load Mode)

- .rune/*.md files found and read
- Checkpoint detected and presented (if exists)
- Learnings surfaced (top 5 if 10+ entries)
- Last session summary presented
- Current in-progress and blocked tasks identified
- Next task recommendation from progress.md (or checkpoint resume command)
- Session Bridge Loaded report emitted

## Done When (Checkpoint Mode)

- Git state captured (branch, commit, uncommitted files)
- Load-bearing decisions documented
- Remaining tasks listed in execution order
- Resume command written (specific enough for a fresh session to act on)
- checkpoint.md written to .rune/
- Checkpoint Saved report emitted

## Cost Profile

~100-300 tokens per save. ~500-1000 tokens per load. Always haiku. Negligible cost.
