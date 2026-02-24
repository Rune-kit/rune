---
name: session-bridge
description: Universal context persistence across sessions. Auto-saves decisions, conventions, and progress to .rune/ files. Loads state at session start. Use when any skill makes architectural decisions or establishes patterns that must survive session boundaries.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L3
  model: haiku
  group: state
---

# session-bridge

## Purpose

Solve the #1 developer complaint: context loss across sessions. Session-bridge auto-saves critical context to `.rune/` files in the project directory, and loads them at session start. Every new session knows exactly where the last one left off.

## Triggers

- Auto-trigger: when an architectural decision is made
- Auto-trigger: when a convention/pattern is established
- Auto-trigger: before context compaction
- Auto-trigger: at session end (stop hook)
- `/rune status` — manual state check

## Calls (outbound)

None — pure state management (read/write .rune/ files).

## Called By (inbound)

- `cook` (L1): auto-save decisions during feature implementation
- `rescue` (L1): state management throughout refactoring
- `context-engine` (L3): save state before compaction

## State Files Managed

```
.rune/
├── decisions.md      — Architectural decisions log
├── conventions.md    — Established patterns & style
├── progress.md       — Task progress tracker
└── session-log.md    — Brief log of each session
```

## Execution

### Save Mode (end of session or pre-compaction)

#### Step 1 — Gather state

Collect from the current session:
- All architectural or technology choices made (language, library, approach)
- Conventions established (naming patterns, file structure, coding style)
- Tasks completed, in-progress, and blocked
- A one-paragraph summary of what this session accomplished

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
```

#### Step 5 — Update .rune/session-log.md

Use `Glob` to check if `.rune/session-log.md` exists. If not, use `Write` to create it with a `# Session Log` header.

Use `Edit` to append a one-line entry to `.rune/session-log.md`:

```
[YYYY-MM-DD HH:MM] — [brief description of session accomplishments]
```

#### Step 6 — Commit

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

#### Step 2 — Load files

Use `Read` on all four state files in parallel:

```
Read: .rune/decisions.md
Read: .rune/conventions.md
Read: .rune/progress.md
Read: .rune/session-log.md
```

#### Step 3 — Summarize

Present the loaded context to the agent in a structured summary:

> "Here's what happened in previous sessions:"
> - Last session: [last line from session-log.md]
> - Key decisions: [last 3 entries from decisions.md]
> - Active conventions: [count from conventions.md]
> - Current progress: [in-progress and blocked items from progress.md]
> - Next task: [first item under "Next Session Should" from progress.md]

#### Step 4 — Resume

Identify the next concrete task from `progress.md` → "Next Session Should" section. Present it as the recommended starting point to the calling orchestrator.

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
- **Decisions on file**: [count]
- **Conventions on file**: [count]
- **Next task**: [task description]
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

## Done When (Save Mode)

- decisions.md updated with all architectural decisions made this session
- conventions.md updated with all new patterns established
- progress.md updated with completed/in-progress/blocked task status
- session-log.md appended with one-line session summary
- Git commit made (or "no git" noted in report)
- Session Bridge Saved report emitted

## Done When (Load Mode)

- .rune/*.md files found and read
- Last session summary presented
- Current in-progress and blocked tasks identified
- Next task recommendation from progress.md
- Session Bridge Loaded report emitted

## Cost Profile

~100-300 tokens per save. ~500-1000 tokens per load. Always haiku. Negligible cost.
