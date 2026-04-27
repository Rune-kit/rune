# Deepening

How to deepen a cluster of shallow modules safely, given its dependencies. Assumes the vocabulary in [language.md](language.md) — module, interface, seam, adapter.

## Dependency categories

When assessing a candidate for deepening, classify its external dependencies. The category determines how the deepened module is tested across its seam.

### 1. In-process

Pure computation, in-memory state, no I/O. **Always deepenable** — merge the modules and test through the new interface directly. No adapter needed; no port needed.

Test strategy: direct invocation of the deepened module. Inputs in, outputs out, assertion on outputs.

### 2. Local-substitutable

Dependencies with local test stand-ins (PGLite for Postgres, in-memory filesystem, NodeFS for fs). Deepenable if the stand-in exists.

Test strategy: stand-in runs in the test suite alongside the deepened module. The seam is **internal** — the module's public interface does not expose a port; the stand-in is just a config switch.

### 3. Remote-owned (Ports & Adapters)

Your own modules deployed across a network seam (HTTP / gRPC / queue, internal APIs). Define a **port** (interface) at the seam. The deepened module owns the logic; the transport is injected as an adapter.

Recommended adapter set:
- Production: HTTP / gRPC / message queue adapter
- Test: in-memory adapter

Recommendation phrasing in proposal: *"Define a port at the seam, implement an HTTP adapter for production and an in-memory adapter for testing, so the logic sits in one deep module even though it's deployed across a network."*

### 4. True-external

Third-party services you don't control (Stripe, Twilio, Auth0, OpenAI). The deepened module takes the external dependency as an injected port; tests provide a mock adapter.

Test strategy: mock the port, assert the deepened module's logic responds correctly to mocked outcomes (success / failure / timeout / rate-limit).

Special concern: external dependencies have undocumented quirks. Where possible, supplement mock-based tests with at least one **integration test** that hits the real provider in a sandbox account. Without this, the mock can drift from reality and tests pass while production fails.

## Seam discipline

- **One adapter = hypothetical seam. Two = real one.** Don't introduce a port unless ≥2 adapters are justified. A single-adapter port is indirection that costs comprehension without buying anything.
- **Internal vs external seams.** A deep module can have internal seams (private to its implementation, used by its own tests) AND the external seam at its public interface. Don't expose internal seams through the public interface just because tests use them.

## Testing strategy: replace, don't layer

Old tests on shallow modules become **waste** once tests at the deepened interface exist. The instinct to "keep them just in case" produces:
- Double coverage on the same behavior, presented two ways
- Tests that break together when implementation changes (because they're testing structure, not behavior)
- Maintenance burden — a refactor must update both sets

Right move:
1. Write new tests at the deepened interface.
2. Delete old shallow-module tests in the same commit.
3. Net coverage stays the same; surface area is now correct.

## When NOT to deepen

Sometimes shallowness is correct. Resist deepening when:

- The "shallow" modules each represent a **distinct use case** with its own audience. Collapsing them obscures intent.
- The dependency is **truly external** AND **stateful** in a way that doesn't separate cleanly (legacy systems with implicit shared state). Forced deepening leaks the external state through the port.
- An ADR explicitly chose the current shape for a load-bearing reason. Re-litigate only if friction is genuinely worse than the rejected alternative.

In each of these cases, document the deletion-test verdict as `vanish` or `redistribute` — don't pretend the deepening is wrong, just acknowledge it isn't right *now*.

## Worked example: deepening an auth flow

Initial state: `src/auth/login.ts`, `src/auth/refresh.ts`, `src/auth/logout.ts`. Each is 30 lines, calls a `database.users.get()` and a `crypto.compare()`. Logic about session lifecycle is split across all three.

Scores:
- Depth: 2 (interface ≈ 50% of impl)
- Leverage: 2 (3 functions, ~3 callers each, but caller has to learn 3 surfaces)
- Locality: 2 (lifecycle logic spread across 3 files)
- Deletion test: redistribute (functions ARE doing work, just thinly)
- Dependency category: in-process (database is local-substitutable in tests)

Proposed deepening: `AuthPort` interface with `authenticate`, `revoke`, `verify`. Single deep module owns the lifecycle. Adapters:
- `PostgresAuthAdapter` (prod)
- `InMemoryAuthAdapter` (test)
2 adapters → real seam ✅.

After:
- Depth: 4
- Leverage: 4 (3 entry points learn-once)
- Locality: 4 (lifecycle in one file)

Tests: write `AuthPort.test.ts` against the in-memory adapter; delete `login.test.ts`, `refresh.test.ts`, `logout.test.ts`. Net coverage same; one surface.
