---
name: journal
description: Rescue-specific state tracking across sessions. Manages RESCUE-STATE.md, module-status.json, dependency graphs, and Architecture Decision Records.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L3
  model: haiku
  group: state
---

# journal

## Purpose

Rescue-specific state tracking across sessions. Journal manages the persistent state files that allow rescue workflows to span multiple sessions without losing progress. Separate from session-bridge which handles general context — journal is specifically for rescue operations.

## Triggers

- Called by rescue skills after each phase completion
- Auto-trigger: after surgeon completes a module

## Calls (outbound)

None — pure L3 state management utility.

## Called By (inbound)

- `surgeon` (L2): update progress after each surgery session
- `rescue` (L1): read state for rescue dashboard
- `autopsy` (L2): save initial health assessment

## Files Managed

```
.rune/RESCUE-STATE.md      — Human-readable rescue progress (loaded into context)
.rune/module-status.json   — Machine-readable module states
.rune/dependency-graph.mmd — Mermaid diagram, color-coded by health
.rune/adr/                 — Architecture Decision Records (one per decision)
```

## Context Recovery (new session)

```
1. Read .rune/RESCUE-STATE.md   → full rescue history
2. Read .rune/module-status.json → module states and health scores
3. Read git log                  → latest changes since last session
4. Read CLAUDE.md               → project conventions
→ Result: Zero context loss across rescue sessions
```

## Workflow

1. Load RESCUE-STATE.md and module-status.json to reconstruct current rescue context
2. Identify the active rescue phase and which modules are in-progress or pending
3. Update module health scores and status for any modules completed in this session
4. Record key decisions and trade-offs in ADR format under .rune/adr/
5. Save updated state files so the next session starts with zero context loss

## Output Format

```
## Journal Update
- **Phase**: [current rescue phase]
- **Module**: [current module]
- **Health**: [before] → [after]
- **Files Updated**: [list of .rune/ files modified]
```

## Cost Profile

~200-500 tokens input, ~100-300 tokens output. Haiku. Pure file management.
