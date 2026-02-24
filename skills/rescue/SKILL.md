---
name: rescue
description: Legacy refactoring orchestrator. Multi-session workflow to safely modernize messy codebases — autopsy, safety net, incremental surgery, and progress tracking.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L1
  model: sonnet
  group: orchestrator
---

# rescue

## Purpose

Legacy refactoring orchestrator for safely modernizing messy codebases. Rescue runs a multi-session workflow: assess damage (autopsy), build safety nets (safeguard), perform incremental surgery (surgeon), and track progress (journal). Designed to handle the chaos of real-world legacy code without breaking everything.

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

## Called By (inbound)

- User: `/rune rescue` direct invocation
- `team` (L1): when team delegates rescue work

## Workflow

```
/rune rescue
│
├─ Phase 0: RECON (1 session)
│  ├─ autopsy → full health assessment
│  ├─ onboard → generate CLAUDE.md if missing
│  └─ journal → save RESCUE-STATE.md
│
├─ Phase 1: SAFETY NET (1-3 sessions)
│  ├─ safeguard → characterization tests
│  ├─ safeguard → boundary markers (@legacy, @new-v2, @bridge)
│  └─ safeguard → config freeze + rollback points
│
├─ Phase 2-N: SURGERY (1 module per session)
│  ├─ surgeon → apply refactoring pattern
│  │  ├─ Strangler Fig (module > 500 LOC)
│  │  ├─ Branch by Abstraction (replacing implementations)
│  │  ├─ Expand-Migrate-Contract (safe transitions)
│  │  └─ Extract & Simplify (cyclomatic > 10)
│  ├─ review → verify surgery quality
│  └─ journal → update progress
│
├─ Phase N+1: CLEANUP
│  └─ remove @legacy, @bridge markers
│
└─ Phase N+2: VERIFY
   ├─ full test suite
   └─ health score comparison (before vs after)
```

## Safety Rules

```
- NEVER refactor 2 coupled modules in same session
- ALWAYS run tests after each change
- Max blast radius: 5 files per session
- If context low → STOP, save state, commit partial
- Rollback point: git tag forge-rescue-baseline
```

## Status Command

`/rune rescue status` reads journal and shows:

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

## Cost Profile

~$0.10-0.30 per session. Sonnet for surgery, opus for autopsy. Multi-session workflow.
