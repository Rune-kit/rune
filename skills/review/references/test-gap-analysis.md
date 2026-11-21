# review — Per-function test gap analysis

> Reference for `skills/review/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

#### Per-Function Test Gap Analysis

Go beyond "test file exists" — check coverage at function granularity:

1. **Extract changed functions** — from the diff, list every function/method that was added or modified (name + file:line)
2. **Map to test assertions** — for each changed function, Grep the test file for its name. Count distinct test cases (look for `it(`, `test(`, `describe(` blocks that reference the function)
3. **Classify gap severity**:

| Function Type | 0 tests | 1 test | 2+ tests |
|--------------|---------|--------|----------|
| Business logic (money, auth, state) | BLOCK | WARN: "only happy path" | PASS |
| Data transform (parse, format, map) | HIGH | PASS | PASS |
| Event handler (onClick, onSubmit) | MEDIUM | PASS | PASS |
| Pure utility (string, math, date) | MEDIUM | PASS | PASS |

4. **Output per-function table** in review report:

```
### Test Gap Analysis
| Function | File | Tests Found | Verdict |
|----------|------|-------------|---------|
| calculateTotal | src/billing.ts:42 | 3 (happy, zero, overflow) | PASS |
| processRefund | src/billing.ts:89 | 0 | BLOCK — business logic untested |
| formatCurrency | src/utils.ts:12 | 1 | PASS |
```

5. **Flag untested edge cases** — for functions with only 1 test, check if the test covers: empty/null input, boundary values, error path. If only happy path → WARN: "only happy path tested for {function}"

**Skip if**: Diff only touches config, docs, styles, or test files themselves.
