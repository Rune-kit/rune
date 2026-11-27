# Mechanical verification (`rune verify`)

These commands are evidence, the same way a test-runner transcript is evidence. A green suite alone is not.

## When to run which mode

| Situation | Command | Fail means |
|---|---|---|
| This diff touched test files | `rune verify --integrity` (and `--junk`) | The suite was weakened, or a new test is vacuous |
| Tests are green after a rewrite / port | `rune verify --oracle <legacy> --candidate <new> --corpus <dir>` | Candidate diverges from the reference on the corpus |
| Recurring review comments or a preventable failure | `rune verify --reflect` (from `.rune/review-findings.jsonl`) | A generated project lint failed, or no findings were eligible |
| Project already has `.rune/lints/rules.json` | `rune verify --lints` | A recorded convention was violated |

`--integrity` / `--junk` / `--lints` / `--reflect` may be combined. `--oracle` is exclusive. Exit 2 is a gate failure (not a usage error). Full flags, corpus format, baseline, and false-positive notes: `docs/VERIFY.md`.

## Junk-match and ship-worthiness

After tests are green, run `rune verify --junk` on the same diff. A HIGH finding (`expect-true`, `tautology`, `empty-snapshot`) means Overall cannot be PASS: the suite can stay green without checking the behavior under test. WARN findings (catch-all regex, mock-echo, status-only, fixture-in-src) must be called out in the Verification Report; they are not automatic PASS.

`expect(isValid(x)).toBe(true)` is a real assertion. A mock plus an assertion about the system under test is not mock-echo. See `docs/VERIFY.md`.

## Oracle (rewrites)

When `safeguard` / `surgeon` / `rescue` is porting or rewriting a running service, the second source of truth is the **old binary, a prod URL, or recorded fixtures** — not the test suite the implementer just edited.

```bash
rune verify --oracle './legacy --json' --candidate './candidate --json' --corpus tests/oracle
# or recorded fixtures:
rune verify --oracle tests/oracle --candidate './candidate --json'
```

NEW fingerprint clusters (not in `.rune/oracle/baseline.json`) are failures. Hand each cluster to `fix` the way `converge` already assigns remediation tasks. Do not add a fingerprint to the baseline without human approval.

## Integrity reminder

If test files changed, `rune verify --integrity` must be clean or a recorded `Test-Change-Approved` / `RUNE_TEST_CHANGE_APPROVED` override must exist. See [test-integrity-gate](../../test/references/test-integrity-gate.md).
