# Converge Eval Fixtures

> Behavioral test scenarios for `converge`. Each fixture defines inputs (spec + code state)
> and the EXACT expected verdict. Use these to verify converge behaves correctly after any
> edit to its SKILL.md — and as seeds for a future automated eval harness.

## Fixture 1 — Dead button (the canonical failure)

**Spec**: `US-1 [P1]` "submit an order", `AC-1.1: GIVEN valid items WHEN user clicks Save THEN order persisted and visible in list`. Contract `contracts/create-order.md` → `POST /api/orders`, Consumers: `OrderForm`.

**Code state**: `OrderForm.tsx` exists, renders `<button onClick={handleSave}>Save</button>`; `handleSave` calls `fetch('/api/orders', {method:'POST'})`. NO route file implements `POST /api/orders`.

**Expected**: `contract:create-order` → `missing` CRITICAL (P1). `US-1/AC-1.1` → `partial` (chain breaks at route-exists). Two `CV-1.*` tasks appended citing those keys. `convergence.gaps` emitted. **FAIL IF**: verdict is `implemented` because OrderForm exists, or converge edits OrderForm itself.

## Fixture 2 — Fully wired (clean pass)

**Spec**: same as Fixture 1.

**Code state**: `OrderForm.tsx` handler → `fetch POST /api/orders`; `src/api/orders.ts` implements the route, validates items, persists via `Order` model; `OrderList.tsx` fetches and renders.

**Expected**: all keys `implemented` with file:line evidence. ZERO writes — task file byte-identical. `convergence.clean` emitted. **FAIL IF**: any "improvement" task is appended (converge is not a reviewer), or the task file is touched at all.

## Fixture 3 — Contradicts a locked decision

**Spec**: requirements.md Decision (locked): "soft-delete only — records marked `deletedAt`, never removed". Plan Key Decisions repeats it.

**Code state**: `src/api/orders.ts` delete handler runs `DELETE FROM orders WHERE id = ?`.

**Expected**: `decision:soft-delete` → `contradicts`, CRITICAL if a P1 AC covers deletion (else HIGH). Task: `CV-1.1 [CRITICAL] Replace hard delete with deletedAt flag per decision:soft-delete (contradicts) — src/api/orders.ts`. **FAIL IF**: classified `implemented` because "a delete exists".

## Fixture 4 — Unrequested code (scope creep surfaced, not blocked)

**Spec**: stories US-1..US-3 cover order CRUD only.

**Code state**: everything from Fixture 2 PLUS `src/pages/admin-stats.tsx` (a dashboard no story mentions).

**Expected**: all spec keys `implemented`; one `unrequested` finding (LOW — isolated) listing admin-stats.tsx. `convergence.gaps` emitted (unrequested counts as a gap for reporting) BUT no CV task demanding deletion — the finding is informational for the user. **FAIL IF**: converge deletes the file, appends a "remove admin-stats" task, or hides the finding.

## Fixture 5 — Placeholder counted honestly

**Spec**: `US-2 [P2]` "browse products", AC-2.1 names a product grid.

**Code state**: `ProductGrid.tsx` renders `[ PLACEHOLDER: product-grid ]` boxes; `.rune/ui-spec.md` lists `product-grid` under `## Unwired Elements`.

**Expected**: `US-2/AC-2.1` → `missing` HIGH (P2) — Unwired Elements are auto-missing regardless of how substantive the placeholder markup looks. **FAIL IF**: `implemented` or `partial` (a designed placeholder is not "started work").

## Fixture 6 — No spec (honest refusal)

**Spec**: no `.rune/features/*/requirements.md` exists.

**Expected**: converge reports `NO_SPEC` and stops. No inventory invented from the code, no tasks appended. **FAIL IF**: converge scans the code and fabricates intent keys from what it finds.
