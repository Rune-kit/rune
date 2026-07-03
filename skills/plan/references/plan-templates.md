# Plan Templates

> Reference for `plan` skill — Steps 4 and 5.
> Load this when writing master plan files or phase files.

## Master Plan Template

Save to `.rune/plan-<feature>.md`. Max 80 lines.

```markdown
# Feature: <name>

## Overview
<1-3 sentences: what and why>

## Phases
| # | Name | Status | Plan File | Summary |
|---|------|--------|-----------|---------|
| 1 | Foundation | ⬚ Pending | plan-X-phase1.md | Types, core engine, basic UI |
| 2 | Interaction | ⬚ Pending | plan-X-phase2.md | Dialogue, combat, items |
| 3 | Polish | ⬚ Pending | plan-X-phase3.md | Effects, sounds, game over |

## Key Decisions
- <decision 1 — chosen approach and why>
- <decision 2>

## Decision Compliance
- Decisions (locked): [list from requirements.md — plan MUST honor these]
- Discretion (agent): [list — agent chose X because Y]
- Deferred: [list — explicitly excluded from this feature]

## Coverage Summary
<!-- Step 5.7 — only when BA requirements exist. P1 zero-coverage = plan not presentable.
     Inserted AFTER phase files exist (task IDs come from them). If >15 rows, move the full
     table to .rune/plan-<feature>-coverage.md and keep only a pointer + ❌/deferred rows here. -->
| Key | Priority | Tasks | Covered |
|-----|----------|-------|---------|
| US-1 | P1 | P1-T2, P1-T3 | ✅ |
| FR-3 | — | P2-T4 | ✅ |
| US-3 | P2 | — | ❌ deferred to v2 (explicit) |

## Architecture
<brief system diagram or component list — NOT implementation detail>

## Dependencies
- <external dep>: <status>

## Risks
- <risk>: <mitigation>
```

No implementation details — that's what phase files are for.

---

## Phase File Template (Amateur-Proof)

Save to `.rune/plan-<feature>-phase<N>.md`. Max 200 lines.

Phase files follow the **Amateur-Proof Template** — designed so that even the weakest model (Haiku) can execute without guessing. Every section exists because an Amateur said "I need this to code correctly."

```markdown
# Phase N: <name>

## Goal
<What this phase delivers — 1-2 sentences>

## Data Flow
<5-line ASCII diagram showing how data moves through this phase's components>
```
User Input → validateInput() → calculateProfit() → formatResult() → API Response
                                      ↓
                                 TradeEntry[]
```

## Code Contracts
<Function signatures, interfaces, schemas that this phase MUST implement>
<This is the MOST IMPORTANT section — coder implements these contracts>

```typescript
interface TradeEntry {
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
}

interface ProfitResult {
  netPnL: number;
  totalFees: number;
  winRate: number;
}

function calculateProfit(entries: TradeEntry[]): ProfitResult;
function validateInput(raw: unknown): TradeEntry[];  // throws ValidationError
```

## Tasks

Each task MUST include: **File** (exact path), **Test** (test file or N/A), **Verify** (shell command), **Commit** (semantic message). Granularity: 2-5 min per task. If >10min, decompose.

**Task IDs**: label every task `P<phase>-T<seq>` (phase number + position within phase). Coverage Summary, Traceability Matrix, and `depends_on` reference these IDs.

**Req IDs**: when BA produced `FR-n`/`US-n` IDs, use THOSE IDs in the Req field and Traceability Matrix — do NOT renumber as REQ-n. The `REQ-n` format is only for ad-hoc plans with no BA spec.

When BA requirements exist, each task also carries **Story** (`US-n` it serves) — and UI tasks carry **Contract** (the `contracts/` file whose endpoint the UI invokes; see `references/boundary-artifacts.md`). A UI task with `Contract: none` MUST justify why (static UI, consumes prior slice's contract).

- [ ] P2-T1 — Create calculateProfit function
  - Req: FR-1 (P&L calculation)
  - Story: US-1
  - File: `src/foo/bar.ts` (new)
  - Test: `tests/foo/bar.test.ts` (new)
  - Verify: `npm test -- --grep "calculateProfit"`
  - Commit: `feat(trading): add calculateProfit with fee calculation`
  - Logic: sum entries by side, apply fees (0.1% per trade), return net P&L
  - Edge: empty array → return { netPnL: 0, totalFees: 0, winRate: 0 }
- [ ] P2-T2 — Add input validation
  - Req: FR-2 (input validation)
  - Story: US-1
  - File: `src/foo/baz.ts` (modify)
  - Test: `tests/foo/baz.test.ts` (new)
  - Verify: `npm test -- --grep "validateInput"`
  - Commit: `feat(trading): add input validation for trade entries`
  - Logic: check side is 'long'|'short', prices > 0, quantity > 0
- [ ] P2-T3 — Write integration tests
  - Req: FR-1, FR-2 (integration coverage)
  - Story: US-1
  - File: `tests/foo/bar.test.ts` (modify)
  - Test: N/A — this IS the test task
  - Verify: `npm test -- --grep "trading" && npx tsc --noEmit`
  - Commit: `test(trading): add integration tests for edge cases`
  - Cases: happy path, empty input, negative values, overflow

## Failure Scenarios
<What should happen when things go wrong — coder MUST implement these>

| When | Then | Error Type |
|------|------|-----------|
| entries is empty array | return zero-value ProfitResult | No error (valid edge case) |
| entry has negative price | throw ValidationError("price must be positive") | ValidationError |
| entry has quantity = 0 | throw ValidationError("quantity must be > 0") | ValidationError |
| calculation overflows Number.MAX_SAFE_INTEGER | use BigInt or throw OverflowError | OverflowError |

## Performance Constraints
<Non-functional requirements — skip if not applicable>

| Metric | Requirement | Why |
|--------|-------------|-----|
| Input size | Must handle 10,000 entries | Production data volume |
| Response time | < 100ms for 10K entries | Real-time dashboard |
| Memory | < 50MB for 10K entries | Container memory limit |

## Rejection Criteria (DO NOT)
<Anti-patterns the coder MUST avoid — things that seem right but are wrong>

- ❌ DO NOT use `toFixed()` for financial calculations — use Decimal.js or integer cents
- ❌ DO NOT mutate the input array — create new objects (immutability rule)
- ❌ DO NOT use `any` type — full TypeScript strict
- ❌ DO NOT import from Phase 2+ files — this phase is self-contained

## Cross-Phase Context
<What this phase assumes from previous phases / what future phases expect from this one>

- **Assumes**: Phase 1 created `src/shared/types.ts` with base types
- **Exports for Phase 3**: `calculateProfit()` will be imported by `src/dashboard/PnLCard.tsx`
- **Interface contract**: ProfitResult shape MUST NOT change — Phase 3 depends on it

## Acceptance Criteria
- [ ] All tasks marked done
- [ ] Tests pass with 80%+ coverage on new code
- [ ] No TypeScript errors (`tsc --noEmit` passes)
- [ ] Failure scenarios all handled (table above)
- [ ] Performance: calculateProfit(10K entries) < 100ms
- [ ] No `any` types, no mutation, no `toFixed()` for money

## Traceability Matrix
| Req ID | Requirement | Task(s) | Test(s) | Status |
|--------|-------------|---------|---------|--------|
| FR-1 | P&L calculation with fees | P2-T1 | `tests/foo/bar.test.ts` | ⬚ |
| FR-2 | Input validation | P2-T2 | `tests/foo/baz.test.ts` | ⬚ |

Every requirement from BA's Requirements Document MUST appear in this matrix, using BA's own IDs (`FR-n`/`US-n` — REQ-n only when no BA spec exists). Missing requirement = incomplete phase. `completion-gate` checks this matrix during verification.

## Files Touched
- `src/foo/bar.ts` — new
- `src/foo/baz.ts` — modify
- `tests/foo/bar.test.ts` — new
```

Must be self-contained — coder should NOT need to read master plan or other phases to execute.

---

## Inline Plan Template (Trivial Tasks)

For trivial tasks (1-2 phases, < 5 files, < 100 LOC):

```
## Plan: [Task Name]

### Changes
1. [file]: [what to change] — [function signature]
2. [file]: [what to change]

### Tests
- [test file]: [test cases]

### Risks
- [risk]: [mitigation]

Awaiting approval.
```
