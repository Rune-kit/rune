# test — TEST.md plan and results

> Reference for `skills/test/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## TEST.md — Test Plan + Results Document

For non-trivial features (3+ test files or 20+ test cases), create a `TEST.md` in the test directory. This is BOTH a planning doc (written BEFORE tests) and results doc (appended AFTER tests pass).

### Before writing tests — write the plan:
```markdown
# Test Plan: [Feature Name]

## Test Inventory
- `test_core.py`: ~XX unit tests planned (L1)
- `test_integration.py`: ~XX integration tests planned (L2)
- `test_e2e.py`: ~XX E2E tests planned (L3/L4)

## Unit Test Plan (L1)
| Module | Functions | Edge Cases | Est. Tests | Req IDs |
|--------|-----------|------------|------------|---------|
| `core/auth.py` | login, register, refresh | expired token, invalid creds, rate limit | 12 | REQ-001, REQ-003 |

## E2E Scenarios (L3/L4)
| Workflow | Simulates | Operations | Verified | Req IDs |
|----------|-----------|------------|----------|---------|
| User signup | New user onboarding | register → verify → login | Token valid, profile created | REQ-005 |

## Realistic Workflow Scenarios
- **[Name]**: [Step 1] → [Step 2] → verify [output properties]
```

### After tests pass — append results:
```markdown
## Test Results
[Paste full `pytest -v --tb=no` or `npm test` output]

## Summary
- Total: XX | Passed: XX | Failed: 0
- Execution time: X.Xs | Coverage: XX%

## Requirement Coverage
| Req ID | Test File(s) | Status |
|--------|-------------|--------|
| REQ-001 | `test_auth.py::test_login` | ✅ Covered |
| REQ-002 | — | ❌ Not covered |

## Gaps
- [Areas not covered and why]
```

**Why TEST.md**: Planning tests before code catches missing edge cases early. Appending results creates permanent evidence. One document = complete testing story.
