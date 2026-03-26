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

- [ ] Task 1 — Create calculateProfit function
  - Req: REQ-001 (P&L calculation)
  - File: `src/foo/bar.ts` (new)
  - Test: `tests/foo/bar.test.ts` (new)
  - Verify: `npm test -- --grep "calculateProfit"`
  - Commit: `feat(trading): add calculateProfit with fee calculation`
  - Logic: sum entries by side, apply fees (0.1% per trade), return net P&L
  - Edge: empty array → return { netPnL: 0, totalFees: 0, winRate: 0 }
- [ ] Task 2 — Add input validation
  - Req: REQ-002 (input validation)
  - File: `src/foo/baz.ts` (modify)
  - Test: `tests/foo/baz.test.ts` (new)
  - Verify: `npm test -- --grep "validateInput"`
  - Commit: `feat(trading): add input validation for trade entries`
  - Logic: check side is 'long'|'short', prices > 0, quantity > 0
- [ ] Task 3 — Write integration tests
  - Req: REQ-001, REQ-002 (integration coverage)
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
| REQ-001 | P&L calculation with fees | Task 1 | `tests/foo/bar.test.ts` | ⬚ |
| REQ-002 | Input validation | Task 2 | `tests/foo/baz.test.ts` | ⬚ |

Every requirement from BA's Requirements Document MUST appear in this matrix. Missing requirement = incomplete phase. `completion-gate` checks this matrix during verification.

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
