# test — Testing anti-patterns

> Reference for `skills/test/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Testing Anti-Patterns (Gate Functions)

Before writing tests, check yourself against these 5 anti-patterns. Each has a **gate function** — a question you MUST answer before proceeding.

### Anti-Pattern 1: Testing Mock Behavior
Asserting that a mock exists (e.g., `testId="sidebar-mock"`) instead of testing real component behavior. You're proving the mock works, not the code.
**Gate**: "Am I testing real component behavior or just mock existence?" → If mock existence: STOP. Rewrite to test real behavior.

### Anti-Pattern 2: Test-Only Methods in Production
Adding `destroy()`, `reset()`, or `__testSetup()` methods to production classes that are ONLY called from test files. Production code should not know tests exist.
**Gate**: "Is this method only called by tests?" → If yes: STOP. Move to test utilities or test helper file, not production class.

### Anti-Pattern 3: Mocking Without Understanding Side Effects
Mocking a function without first understanding ALL its side effects. The real function may write config files, update caches, or emit events that downstream code depends on.
**Gate**: Before mocking, STOP and answer: "What side effects does the REAL function have? Does this test depend on any of those?" → Run with real implementation first, observe what happens, THEN add minimal mocking.

### Anti-Pattern 4: Incomplete Mocks
Partial mock missing fields that downstream code consumes. Your test passes because it only checks the fields you mocked, but production code reads fields your mock doesn't have → runtime crash.
**Iron Rule**: Mock the COMPLETE data structure as it exists in reality, not just fields your immediate test uses. Examine actual API response / real data shape before writing mock.

### Anti-Pattern 5: Mock Setup Longer Than Test Logic
If mock setup is 30 lines and the actual test assertion is 3 lines, the test is testing infrastructure, not behavior. This is a code smell that indicates wrong abstraction level.
**Gate**: "Is my mock setup longer than my test logic?" → If yes: test at a higher level (integration) or extract mock factories.

### Anti-Pattern 6: Test Slop (Framework-Behavior Tests)
Tests that verify the framework works rather than YOUR code works. If the test would still pass with an empty component/function, it's testing infrastructure.
**Gate**: "Would this test pass if I deleted my business logic?" → If yes: STOP. Rewrite to test behavior that YOUR code introduces.

Examples of test slop:
- "renders without crashing" (tests that React works, not your component)
- "route responds with 200" without checking response body (tests Express, not your handler)
- Asserting a mock was called N times without checking the RESULT of those calls
- Type existence tests (`typeof result === 'object'`) when you should test the actual value
- Component renders + handler fully mocked, presented as story coverage — the click path was never exercised; the story's dead button ships with "green" tests

**Red flags — any of these means STOP and rethink:**
- Mock setup longer than test logic
- `*-mock` test IDs in assertions
- Methods only called in test files
- Can't explain in one sentence why a mock is needed
- Test would pass with empty implementation (test slop)
