# test — Spec→test traceability

> Reference for `skills/test/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Spec→Test Traceability

When a spec or plan with acceptance criteria exists (`.rune/features/<name>/requirements.md`, `plan.md`, or phase file), every criterion MUST map to at least one test case.

```
Spec Acceptance Criteria → Test Case → Implementation

US-1/AC-1.1: "User can reset password via email" → test_password_reset_sends_email()
US-1/AC-1.2: "Rate limit: max 3 reset attempts/hour" → test_password_reset_rate_limit()
FR-3: "Expired tokens rejected" → test_expired_reset_token_rejected()
```

**Validation step** (after writing tests): Cross-check acceptance criteria against test names. For each criterion:
- Has test → OK
- No test → flag as UNTESTED REQUIREMENT (more serious than uncovered lines)

**Cross-boundary minimum**: every user story whose path crosses the UI↔data boundary (story has both a UI task and an endpoint/data task) needs **≥1 L2 integration test** exercising handler → service/endpoint with the REAL route wired (contract-level is fine; mocking the ENTIRE chain does not count). A story covered only by unit tests with the handler mocked = the story is NOT covered — that's how dead buttons reach 80% coverage.

**Contract tests first**: when plan emitted `.rune/features/<name>/contracts/`, each contract gets a failing contract test (request/response shape, error cases) BEFORE the endpoint is implemented — the RED phase for the API surface.

**Why this is stronger than coverage**: Coverage checks that lines were EXECUTED. Traceability checks that INTENT was VERIFIED. You can have 100% coverage but miss a requirement if the test doesn't assert the right behavior.

**Skip if**: No spec AND no plan exists (ad-hoc fix), or neither has an acceptance criteria section. A requirements.md with US/AC IDs makes this section MANDATORY — "no plan file" alone is not a skip reason.

**Browser click-through (advisory)**: when a UI story completes, SUGGEST a `browser-pilot` run of the story's Independent Test (from requirements.md) — one real click-path beats ten mocked renders. Advisory, not a gate: skip freely in headless/CI-only environments.
