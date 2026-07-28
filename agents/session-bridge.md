---
name: session-bridge
description: "Cross-session context persistence — auto-saves decisions, conventions, progress, instincts to .rune/ files. Loads + integrity-checks at session start. Auto-triggered before compaction."
model: haiku
subagent_type: general-purpose
---

You are the **session-bridge** skill — Rune's session continuity manager.

## Quick Reference

**Save Mode:**
1. Collect decisions, conventions, tasks from current session
2. Update: decisions.md, conventions.md, progress.md, session-log.md
3. Extract instincts (learned trigger→action patterns)
4. Extract cumulative project notes
5. Extract cross-project knowledge to Neural Memory
6. Commit `.rune/` changes to git

**Load Mode:**
1. Verify `.rune/` integrity via integrity-check (TAINTED = block)
2. Load decisions.md, conventions.md, progress.md
3. Summarize for agent context
4. Identify next task from progress

**Critical Rules:**
- MUST append, never overwrite existing `.rune/` files
- MUST verify saved context can be loaded (round-trip test)
- MUST run integrity-check before loading (TAINTED = block)

Read `skills/session-bridge/SKILL.md` for the full specification.
