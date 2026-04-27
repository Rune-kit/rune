# Mocking Policy

Mocking is a precision tool, not a default. Tests that mock heavily verify that the mocks work, not that the system works. Use this policy to decide *whether* to mock and *what* to mock.

## When to mock

Mock only at **system boundaries** — places where the test cannot afford to use the real thing.

| Boundary | Mock? | Why |
|---|---|---|
| Third-party paid APIs (Stripe, Twilio) | Yes | Cost, side effects, slow |
| External services you don't own | Yes | Reliability, contract not under your control |
| Real database in unit tests | Sometimes | Prefer test DB / in-memory variant if speed permits |
| Time, randomness, file system | Sometimes | Determinism |
| Your own classes / modules | **No** | If your test depends on internal collaborator behavior, you're testing implementation, not behavior |
| Internal collaborators in the same module | **No** | Same reason — couples test to internal shape |

The rule of thumb: if you control the code, don't mock it. Test through it.

## Designing for mockability (at boundaries that DO need mocks)

When a boundary genuinely needs a mock, design the interface so mocking is trivial:

### Inject dependencies (don't construct them)

```ts
// Easy to test — payment client passed in
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total)
}

// Hard to test — payment client created internally
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY)
  return client.charge(order.total)
}
```

### Prefer SDK-style interfaces over generic fetchers

```ts
// GOOD — each function independently mockable
const api = {
  getUser:     (id)      => fetch(`/users/${id}`),
  getOrders:   (userId)  => fetch(`/users/${userId}/orders`),
  createOrder: (data)    => fetch('/orders', { method: 'POST', body: data }),
}

// BAD — mocks need conditional logic to vary by endpoint
const api = {
  fetch: (endpoint, options) => fetch(endpoint, options),
}
```

The SDK shape means each mock returns one specific shape, no `if endpoint === '/users/...'` branching in test setup, and the test is type-safe per endpoint.

## The complete-mock iron rule

Never mock just the fields your immediate test reads. Production code reads other fields downstream and crashes when they're missing. **Mock the entire shape as it exists in reality.**

```ts
// WRONG — incomplete mock
const userMock = { id: 1, name: 'Alice' }
// passes the test, but production reads user.preferences.theme → crash

// RIGHT — complete mock matches the real type
const userMock: User = {
  id: 1,
  name: 'Alice',
  email: 'alice@example.com',
  preferences: { theme: 'dark', timezone: 'UTC' },
  createdAt: new Date('2026-01-01'),
}
```

Use a fixture factory if the type is large. Don't hand-build partials.

## The "is this mock setup longer than the test" smell

If your mock setup is 30 lines and the actual test is 3 lines, the test is testing infrastructure — not behavior. Two options:

1. **Test at a higher level** — promote to integration where the real collaborators do the real thing.
2. **Extract a fixture factory** — `makeFakeUser({ name: 'Alice' })` returns a complete object with sensible defaults; test stays readable.

If neither helps, the abstraction is wrong. Reshape the boundary so it doesn't need this much priming to test.

## Side-effect awareness

Before mocking a real function, understand its full side effects:

- Does the real function write a config file?
- Does it emit events that downstream code listens to?
- Does it update a cache, increment a counter, or hold a lock?

If your test depends on any side effect, your mock must replicate it. The way to find out: run the real function once with logging on, observe what changes, then mock with that knowledge.

## Replace, don't layer

When refactoring tests after a deepening (see `improve-architecture` skill), do not keep the old shallow-module unit tests *and* add new deepened-interface tests. The old tests become waste — delete them. The interface is the test surface; you only need tests at one surface.

## Anti-patterns to avoid

| Pattern | Problem |
|---|---|
| Mocking your own class | Tests prove the mock works, not the class |
| `expect(mock.fn).toHaveBeenCalledTimes(2)` | Asserts implementation detail (call count), not outcome |
| Test-only methods (`destroy()`, `__reset()`) on production classes | Production code knows tests exist — leak |
| Mocking what you're testing | "Test passes because the mock returned what I told it to" |
| Partial mocks missing downstream fields | Test passes; production crashes on the missing field |

## Self-check before approving a mock

```
[ ] This mock is at a system boundary I don't own
[ ] The mock returns the COMPLETE shape, not just fields the test asserts on
[ ] I've observed the real function's side effects (if any) and replicated them
[ ] My mock setup is shorter than the test logic
[ ] I'm not mocking the unit under test
```

If any check fails, rework before merging.
