# team — Output, returns, ownership and execution rules

> Reference for `skills/team/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Mesh Gates

| Gate | Requires | If Missing |
|------|----------|------------|
| Scope Gate | Each agent has explicit file ownership list | Define boundaries before dispatch |
| Conflict Gate | Zero merge conflicts after integration | Resolve all conflicts, re-verify |
| Verification Gate | All tests pass after merge | Fix regressions before completion |

## Output Format

```
## Team Report: [Task Name]
- **Streams**: [count]
- **Status**: complete | partial | blocked
- **Duration**: [time across streams]

### Streams
| Stream | Task | Status | Deliverables | Concerns |
|--------|------|--------|-------------|----------|
| A | [task] | DONE | 3/3 delivered | None |
| B | [task] | DONE_WITH_CONCERNS | 2/2 delivered | Perf regression on large input |
| C | [task] | DONE | 2/2 delivered | None |

### Acceptance Criteria
| # | Criterion | Stream | Evidence | Verdict |
|---|-----------|--------|----------|---------|
| 1 | Auth endpoints return JWT | A | Test stdout: "3 passed" | PASS |
| 2 | No SQL injection | A | Sentinel: PASS | PASS |
| 3 | Dashboard loads < 2s | B | No perf test run | UNVERIFIED |

### Integration
- Merge conflicts: [count]
- Integration tests: [passed]/[total]
- Coverage: [%]
- Unresolved concerns: [count — from DONE_WITH_CONCERNS streams]
```

---

## Parallel Execution Rules

```
Independent streams  → PARALLEL (max 3 sonnet agents)
Dependent streams    → SEQUENTIAL (respecting dependency order)
All streams done     → MERGE sequentially (avoid conflicts)
```

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| Workstream assignments | Markdown (inline) | NEXUS Handoff Templates emitted per stream |
| Cook Reports (per stream) | Markdown (inline) | Collected from each parallel cook instance |
| Merged implementation | Source files | `main` branch after Phase 4 merge |
| Integration test results | Inline stdout | Captured in Phase 5 verify |
| Team Report | Markdown (inline) | Emitted at end of session |

## Document Ownership

| Scope | Access | Files |
|-------|--------|-------|
| **Owns** (read + write) | `.rune/team-report-*.md`, worktree branches, merge commits |
| **Reads** (never writes) | `.rune/plan-*.md`, `.rune/contract.md`, `CLAUDE.md`, cook reports from sub-agents |
| **Never modifies** | Source files directly (delegates to cook instances), `SKILL.md` files, `compiler/**` |

Each cook instance owns its declared file set (disjoint). Team owns coordination artifacts only — never touches source code directly.

## Anti-Patterns

Common multi-agent orchestration failures. These cause the most expensive rework in team workflows.

| Anti-Pattern | Why It Fails | Correct Approach |
|---|---|---|
| **Overlapping file ownership** — two agents write to the same file | Merge conflicts, lost work, non-deterministic output | Enforce disjoint `touches[]` per stream. Move shared files to a single owner |
| **Blind merge** — merging cook reports without reviewing them | Poisoned output propagates. One bad stream corrupts the whole feature | `integrity-check` + `completion-gate` on every cook report before merge |
| **Over-parallelization** — launching 5+ agents for a 3-file task | Context fragmentation, coordination overhead > implementation time | Auto-detect: ≤5 files → lite mode (max 2 agents). Full mode caps at 3 |
| **Cross-domain implementation** — one agent implements both frontend and backend | Domain expertise diluted. Agent makes shallow choices in unfamiliar territory | Split by domain. Frontend agent ≠ backend agent. Each gets domain context |
| **Missing handoff context** — bare prompt to cook instance without scope/conventions | Agent guesses project conventions, uses wrong patterns, produces inconsistent code | NEXUS Handoff Template: always include metadata, deliverables, conventions, quality expectations |
| **Sequential when parallel is safe** — running independent streams one by one | Wastes time. 3 independent streams × 5min = 15min sequential vs 5min parallel | Check dependency graph. Independent streams → parallel. Dependent → sequential |
