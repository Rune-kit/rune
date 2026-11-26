# Test-integrity gate

A mechanical hook — not just a skill checklist — inspects test-file diffs before an Edit/Write lands (preflight) and before `git commit` (sentinel). It is the same check as `rune verify --integrity`. Under the `strict` hook preset, high-severity findings **block**; under `gentle` they warn. The agent cannot satisfy a failing test by weakening the test.

## What blocks (strict)

| Rule | Meaning |
|---|---|
| `assert-removed` | An assertion was deleted (not moved or rewritten in place) |
| `skip-added` | A test was skipped / xfailed (`it.skip`, `@pytest.mark.skip`, `t.Skip`, `#[ignore]`, `@Disabled`, …) |
| `expected-changed` | An expected literal changed (especially together with implementation) |
| `frozen-path` | An edit under a frozen path (see below) |

Warnings (do not block on their own): loosened matchers (`toEqual` → `toBeTruthy`, exact → contains, widened tolerance), commented-out asserts, `.only` / `.todo`, snapshot / golden updates, deleted tests, net assertion-count drop, mocks that replace a previously real call.

Fingerprints are `{file, line, rule, before, after}`. `rune verify --integrity --json` prints them; `--staged` matches what a commit would land; `--base <ref>` diffs against that ref.

## Frozen paths — characterization and holdout

Default (override in `.rune/test-integrity.json` → `frozenPaths`):

- `tests/char/**` — characterization tests written by `safeguard` before surgery. They capture **current** behavior and must not be edited to follow a rewrite.
- `tests/holdout/**` — a holdout suite the implementer does not own. Prefer a second model (`adversary --mode=oracle`) or a human to author or review these.

Any modification is BLOCK under `strict`, WARN under `gentle`.

## Override (auditable)

If a test change is intentional (safeguard re-baseline, a human approved a new expected value):

```
# environment, for a single hook invocation
RUNE_TEST_CHANGE_APPROVED="<reason>"

# or a git commit trailer
git commit -m "test(char): rebase billing characterization" \
  -m "Test-Change-Approved: safeguard rebase after approved behavior change"
```

The reason must be at least three characters. The hook logs `outcome: overridden` plus the reason to `.rune/metrics/gate-outcomes.jsonl`. An override without a reason is ignored.

## Agent rules

- `fix` never edits test files to make them pass, and **never** edits frozen paths. If the test-integrity hook blocks, fix the code or ask a human — do not disable the hook.
- `verification` cannot report PASS when this diff changed tests and `rune verify --integrity` (or the hook) would block, unless a recorded override is present.
- Adding tests and assertions, renaming a test, and reformatting are allowed and should stay clean.
