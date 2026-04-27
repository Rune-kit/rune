# Vertical TDD — Tracer-Bullet Cycles

The Iron Law catches "code before test." Vertical TDD catches the subtler failure: writing a *batch* of tests up front, then a batch of implementation. Tests written this way verify imagined behavior — the contract you *thought* the system would have — not actual behavior. Such tests pass, but they don't catch real bugs and they don't survive refactors.

## The Two Patterns

```
HORIZONTAL (forbidden):
  RED:    write test 1, test 2, test 3, test 4, test 5
  GREEN:  write impl 1, impl 2, impl 3, impl 4, impl 5

VERTICAL (required):
  cycle 1:  RED test 1 → GREEN impl 1 → COMMIT
  cycle 2:  RED test 2 → GREEN impl 2 → COMMIT
  cycle 3:  RED test 3 → GREEN impl 3 → COMMIT
```

The horizontal pattern looks productive — five tests! — but each test was written without learning anything from the previous implementation. The vertical pattern lets each test respond to what the prior cycle revealed about the interface.

## Why Horizontal Slicing Fails

1. **Tests verify shape, not behavior.** When you write 5 tests in a row before any code exists, you can only describe the *shape* of what you imagine — function signatures, return types, data structures. Behavior tests need to react to actual runtime feedback.
2. **Bulk tests outrun the headlights.** You commit to a test structure before learning what the implementation needs. The 4th test you wrote is now wrong because the 1st implementation taught you something — but the test is already written and you "have to" make it pass.
3. **Refactor brittleness.** Bulk-written tests share a mental model from one moment in time. Refactor the impl and many tests break together — not because behavior changed, but because the imagined shape did.

## The Cycle Counter (machine-checked)

Track these two integers per session:

```
cycle_count       = number of (RED → GREEN) pairs completed
bulk_test_count   = number of test files added since last GREEN
```

Pre-first-GREEN gate: `bulk_test_count` MUST stay <= 1 until the first cycle reaches GREEN. Adding a 2nd test before the 1st test reaches GREEN = HORIZONTAL VIOLATION.

Mid-session gate: after each GREEN, `bulk_test_count` resets to 0. Writing 2 tests before the next GREEN = HORIZONTAL VIOLATION.

Emit `tdd.horizontal.violation` signal when triggered. `completion-gate` blocks "tests pass" claims that lack a matching cycle count in git log.

## Git Audit Trail (verifiable claim)

Every cycle MUST produce a commit pair. Suggested message format:

```
test(<scope>): <behavior phrase>      ← RED commit
feat(<scope>): <behavior phrase>      ← GREEN commit
```

The receiving skill (`completion-gate`, `preflight`) reads `git log --oneline -n 20` and counts `test:` / `feat:` pairs. Claim "I did TDD" without paired commits = REJECTED.

This gate is honest because it's mechanical: git history doesn't lie about ordering. It also lets a parent agent verify a subagent's TDD claim without re-running the full pipeline.

## Right vs Wrong (worked examples)

### WRONG — horizontal slicing

```
> Write 5 tests for the password reset flow.

[creates test_request_reset.py, test_send_email.py, test_verify_token.py,
 test_set_new_password.py, test_rate_limit.py — all in one go]

> Now implement them all.

[writes 5 source files matching the imagined shape]
```

Symptom: tests pass. Real bug: rate-limit test asserts `429` but the actual middleware returns `503` under load. Test never caught it because the test was written from imagination, not observation.

### RIGHT — vertical tracer bullets

```
cycle 1:
  RED   test_request_reset_sends_email_to_user — fails (function not defined)
  GREEN minimal request_reset() that sends email — test passes
  COMMIT pair

cycle 2:
  RED   test_request_reset_rejects_unknown_email — fails (currently sends to anyone)
  GREEN add lookup; only send if user exists — test passes
  COMMIT pair
  ← user feedback: "we need rate limiting before this ships"
  ← cycle 3 plan adjusts based on what cycle 2 revealed

cycle 3:
  RED   test_request_reset_rate_limits_3_per_hour — fails (no limit)
  GREEN add rate limit middleware — test passes
  COMMIT pair
```

Each cycle reacts to the previous. The rate-limit test is now grounded in real middleware behavior, not imagination. If the rate-limit response code surprises you, you discover it in cycle 3 instead of in production.

## When Bulk Test Writing IS OK

Two narrow exceptions:

1. **Retrofitting tests for existing untested code** — characterization tests, written together, capture current behavior to enable safe refactor. Iron Law lifted; vertical slicing not required because behavior already exists to observe.
2. **Test scaffolding for a fixed external contract** — when implementing against an OpenAPI spec or a published wire protocol, tests can be generated from the spec en masse. The "imagination" risk is gone because the contract is external.

In both cases, document the exception in the test file header so future readers know why the cycle counter isn't expected to match.

## Recovery Procedure

If you catch yourself horizontal-slicing mid-session:

1. STOP. Do not write more tests, do not write any impl.
2. Identify which tests cover behavior you've actually verified vs which were written from imagination.
3. Keep the verified ones. Delete the rest.
4. Resume vertical: pick the next behavior, write 1 test, run it, see RED, write minimal impl, see GREEN, commit.
