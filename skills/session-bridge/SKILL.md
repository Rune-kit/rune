---
name: session-bridge
description: Universal context persistence across sessions. Auto-saves decisions, conventions, and progress to .rune/ files. Loads state at session start. Use when any skill makes architectural decisions or establishes patterns that must survive session boundaries.
metadata:
  author: runedev
  version: "0.1.0"
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
- `team` (L1): coordinate state across parallel agents
- `context-engine` (L3): save state before compaction

## State Files Managed

```
.rune/
├── decisions.md      — Architectural decisions log
├── conventions.md    — Established patterns & style
├── progress.md       — Task progress tracker
└── session-log.md    — Brief log of each session
```

## Workflow

### Save (auto-triggered or manual)

1. **Detect save trigger** — decision made, pattern established, or session ending
2. **Classify content**:
   - Architecture/tech choice → `decisions.md`
   - Naming/pattern convention → `conventions.md`
   - Task completion/progress → `progress.md`
   - Session summary → `session-log.md`
3. **Append to file** — never overwrite, always append with timestamp
4. **Confirm save** — brief message: "Rune: Saved decision to .rune/decisions.md"

### Load (session start)

1. **Check .rune/ exists** — if not, suggest `/rune onboard`
2. **Read all state files** — decisions, conventions, progress, session-log
3. **Inject as context** — "Here's what happened in previous sessions: ..."
4. **Resume work** — AI knows exactly where to continue

### Decision Log Format

```markdown
## [YYYY-MM-DD HH:MM] Decision: <title>

**Context:** Why this decision was needed
**Decision:** What was decided
**Rationale:** Why this approach over alternatives
**Impact:** What files/modules are affected
```

### Convention Log Format

```markdown
## [YYYY-MM-DD] Convention: <title>

**Pattern:** Description of the convention
**Example:** Code example showing the pattern
**Applies to:** Where this convention should be followed
```

### Progress Log Format

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

## Cost Profile

~100-300 tokens per save. ~500-1000 tokens per load. Always haiku. Negligible cost.
