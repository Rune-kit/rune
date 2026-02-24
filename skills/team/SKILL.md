---
name: team
description: Multi-agent meta-orchestrator. Decomposes large tasks into parallel workstreams, assigns to isolated cook instances, coordinates merging. Uses opus for strategic coordination.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L1
  model: opus
  group: orchestrator
---

# team

## Purpose

Meta-orchestrator for complex tasks requiring parallel workstreams. Team decomposes large features into independent subtasks, assigns each to an isolated cook instance (using git worktrees), coordinates progress, and merges results. Uses opus for strategic decomposition and conflict resolution.

## Triggers

- `/rune team <task>` — manual invocation for large features
- Auto-trigger: when task affects 5+ files or spans 3+ modules

## Calls (outbound)

- `plan` (L2): high-level task decomposition into independent workstreams
- `scout` (L2): understand full project scope and module boundaries
# Exception: L1→L1 meta-orchestration (team is the only L1 that calls other L1s)
- `cook` (L1): delegate feature tasks to parallel instances (worktree isolation)
- `launch` (L1): delegate deployment/marketing when build is complete

## Called By (inbound)

- User: `/rune team <task>` direct invocation only

## Workflow

```
/rune team "refactor auth system and add OAuth providers"
│
├─ Phase 1: DECOMPOSE
│  ├─ scout → map module boundaries, identify independence
│  └─ plan → break into parallel workstreams
│       ├─ Stream A: "refactor JWT middleware" (independent)
│       ├─ Stream B: "add Google OAuth" (independent)
│       └─ Stream C: "add GitHub OAuth" (depends on B patterns)
│
├─ Phase 2: ASSIGN
│  ├─ cook(A) → worktree-a (parallel)
│  ├─ cook(B) → worktree-b (parallel)
│  └─ cook(C) → waits for B, then worktree-c
│
├─ Phase 3: COORDINATE
│  ├─ monitor progress across streams
│  └─ resolve conflicts if streams touch same files
│
├─ Phase 4: MERGE
│  ├─ merge worktree-a → main
│  ├─ merge worktree-b → main
│  └─ merge worktree-c → main (resolve conflicts)
│
└─ Phase 5: VERIFY
   └─ full integration test suite on merged result
```

## Parallel Execution Rules

```
Independent streams  → PARALLEL (max 3 sonnet agents)
Dependent streams    → SEQUENTIAL (respecting dependency order)
All streams done     → MERGE sequentially (avoid conflicts)
```

## Output Format

```
## Team Report: [Task Name]
- **Streams**: [count]
- **Status**: complete | partial | blocked
- **Duration**: [time across streams]

### Streams
| Stream | Task | Status | Cook Report |
|--------|------|--------|-------------|
| A | [task] | complete | [summary] |
| B | [task] | complete | [summary] |
| C | [task] | complete | [summary] |

### Integration
- Merge conflicts: [count]
- Integration tests: [passed]/[total]
```

## Cost Profile

~$0.20-0.50 per session. Opus for coordination. Most expensive orchestrator but handles largest tasks.
