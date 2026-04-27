# Test Quality — Behavior over Shape

A test is good when it would survive a complete internal rewrite. A test is bad when it breaks the moment you rename a private function. The difference is whether the test asserts on **observable behavior** through the public interface, or on **implementation shape** behind it.

## The principle

> The interface is the test surface.

Tests and callers cross the same seam. If you have to test *past* the interface — query the database directly, inspect a private field, count internal calls — the module is the wrong shape, or you're testing the wrong thing. Re-shape the interface before re-shaping the test.

## Behavior-words vs shape-words (smell list)

Behavior-words describe what the system *does*. Shape-words describe what the system *looks like*.

| Behavior-words (good) | Shape-words (smell) |
|---|---|
| accepts | returns an object |
| rejects | has property |
| produces | is type of |
| notifies | should be defined |
| persists | exports |
| retries | implements interface |
| times out | calls method N times |
| validates | sets state to |
| recovers | invokes constructor |

If your test names use shape-words, rewrite to behavior. "should return an object with `success: true`" is a shape claim. "accepts a valid login and returns the user's session" is a behavior claim. The behavior version survives renames; the shape version doesn't.

## Good vs bad tests (worked examples)

### Good — integration through public interface

```ts
test('user can checkout with a valid cart', async () => {
  const cart = createCart()
  cart.add(product)
  const result = await checkout(cart, paymentMethod)
  expect(result.status).toBe('confirmed')
})
```

This test:
- Calls only public functions (`createCart`, `checkout`)
- Asserts on the observable outcome (`result.status`)
- Survives if the cart's internal data structure changes
- Survives if the checkout pipeline is reorganized
- Reads like a specification

### Bad — implementation detail

```ts
test('checkout calls paymentService.process', async () => {
  const mockPayment = jest.mock(paymentService)
  await checkout(cart, payment)
  expect(mockPayment.process).toHaveBeenCalledWith(cart.total)
})
```

Red flags:
- Mocks an internal collaborator (`paymentService` is your own code)
- Asserts on a call (verb-on-mock), not an outcome (state of the system)
- Renaming `process` to `submit` breaks this test even though behavior is identical
- Test name describes HOW (calls X) not WHAT (charges the customer)

### Bad — bypasses the interface

```ts
test('createUser saves to database', async () => {
  await createUser({ name: 'Alice' })
  const row = await db.query("SELECT * FROM users WHERE name = ?", ['Alice'])
  expect(row).toBeDefined()
})
```

Bypasses the interface to verify through the database. If `createUser` is the right shape, the test should read back through the interface:

```ts
test('createUser makes the user retrievable', async () => {
  const user = await createUser({ name: 'Alice' })
  const retrieved = await getUser(user.id)
  expect(retrieved.name).toBe('Alice')
})
```

The good version doesn't care whether storage is Postgres, SQLite, or an in-memory map.

## Test-as-spec smell test (mechanical gate)

Post-GREEN, scan test names for the shape-word list above. Hits = candidates for rewrite. This isn't always a bug — sometimes you're testing a serializer's exact output and "returns an object with X" is the actual contract. Use judgment, but treat shape-word hits as "needs review" not "always wrong".

## Replace, don't layer (after refactor)

When `improve-architecture` deepens a module, the old tests on the (now-collapsed) shallow modules become waste. Two failure modes to avoid:

1. **Layering** — keeping old shallow-module tests AND adding new deepened-interface tests. Now you have 2x the tests, half of which test internal structure that no longer should be visible.
2. **Backfill panic** — deleting all old tests and not writing new ones. Loss of coverage.

Right move: identify the deepened interface, write tests at that surface, delete the old tests in the same commit. Net coverage stays the same; surface area is now correct.

## Coverage vs traceability

80% line coverage is necessary but not sufficient. Coverage proves lines were *executed* during a test run; it does not prove the right *behavior* was verified.

When a plan with acceptance criteria exists (`.rune/features/<name>/plan.md`), every criterion must map to at least one test. Untested criteria are a more serious gap than uncovered lines — coverage misses obvious blanks; traceability misses semantic gaps.

```
AC-1: "User can reset password via email" → test_password_reset_sends_email
AC-2: "Rate limit: max 3 reset attempts/hour" → test_password_reset_rate_limit
AC-3: "Expired tokens rejected" → test_expired_reset_token_rejected
```

Run a cross-check: read the plan's AC list, find a matching test name for each. AC without test = UNTESTED REQUIREMENT.

## Self-check before declaring tests "good"

```
[ ] Test names describe behavior, not shape
[ ] Tests use only the module's public interface
[ ] Tests do NOT mock internal collaborators
[ ] Tests do NOT bypass the interface to verify through the database / file system
[ ] Tests would survive a complete internal rewrite that preserves behavior
[ ] Every plan AC maps to at least one test
[ ] Coverage ≥80%, gaps documented
```
