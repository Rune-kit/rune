# Wave-Based Task Grouping

> Reference for `plan` skill — Step 3 (Decompose into Phases).
> Load this when writing wave-structured task lists inside a phase.

## Wave Format

Tasks inside a phase MUST be organized into **waves** based on dependency analysis. Independent tasks within the same wave can execute in parallel.

```
## Tasks

### Wave 1 (parallel — no dependencies)
- [ ] Task 1 — Create types/interfaces
  - File: `src/types.ts` (new)
  - ...
- [ ] Task 2 — Create validation schema
  - File: `src/validation.ts` (new)
  - ...

### Wave 2 (depends on Wave 1)
- [ ] Task 3 — Implement core logic (imports types from Task 1)
  - File: `src/core.ts` (new)
  - depends_on: [Task 1]
  - ...

### Wave 3 (depends on Wave 2)
- [ ] Task 4 — Wire into API endpoint (imports core from Task 3)
  - File: `src/routes/api.ts` (modify)
  - depends_on: [Task 3]
  - ...
- [ ] Task 5 — Write integration tests (tests core from Task 3)
  - File: `tests/core.test.ts` (new)
  - depends_on: [Task 3]
  - ...
```

## Wave Rules

- **Wave 1** = tasks with zero dependencies (types, schemas, configs) — always first
- **Subsequent waves**: a task goes in the earliest wave where ALL its `depends_on` tasks are in prior waves
- Tasks within the same wave have NO dependencies on each other → safe for parallel dispatch
- `depends_on` field is MANDATORY for Wave 2+ tasks — explicit is better than implicit
- `team` orchestrator can dispatch wave tasks as parallel subagents; solo `cook` executes sequentially within a wave but respects wave ordering
