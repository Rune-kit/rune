# `rune verify`

Mechanical checks that do not take a green test suite at its word. These are the P0/P1 close of the verification audit: assertion integrity, junk matches, an independent oracle, and a review→rules→lint loop. None of them is a new skill — `review`, `verification`, `safeguard`, `rescue`, and `review-intake` call the same CLI.

```bash
rune verify --integrity [--staged|--base <ref>] [--json]
rune verify --junk        [--staged|--base <ref>] [--json]
rune verify --lints       [--staged|--base <ref>] [--json]
rune verify --reflect     [--findings <file>] [--json]
rune verify --oracle <cmd|url|fixtures-dir> [--candidate <cmd|url>] [--corpus <dir>] [--baseline <file>] [--json]
```

`--integrity`, `--junk`, `--lints`, and `--reflect` can be combined. `--oracle` is exclusive. Exit **0** when clean or warnings-only, **2** on a high-severity finding (the same code a strict hook uses to BLOCK), **1** for usage or runner errors.

`--staged` / `--base` have the same meaning as in the test-integrity gate: the index vs HEAD, or the worktree+index vs a ref. The default is the worktree+index vs HEAD.

## `--integrity` — test-diff weakening

See the [Test-integrity gate](HOOKS.md#test-integrity-gate) in `HOOKS.md`. Flags deleted or loosened assertions, new skips, changed expected literals, frozen-path edits under `tests/char/**` and `tests/holdout/**`, and related smells.

## `--junk` — “matches but junk”

Scans the same test (and production) diff for checks that can pass without exercising real behavior:

| Rule | Severity | What it catches |
|---|---|---|
| `expect-true` | high | `expect(true)`, `assert.ok(true)`, `assert True`, `assert!(true)` — the received value is a boolean literal |
| `tautology` | high | `expect(value).toBe(value)`, `assert_eq!(x, x)` |
| `empty-snapshot` | high | `toMatchInlineSnapshot(\`\`)` or a snapshot file that records empty output |
| `catchall-regex` | warn | `toMatch(/^.*$/)`, `/.*/`, `/./` as the matcher |
| `mock-echo` | warn | a mock is programmed to return a literal, and the test’s only asserts check that same literal |
| `status-only` | warn | a behavior test whose only assertion is an HTTP/status code |
| `fixture-in-src` | warn | production code imports `__fixtures__`, `__snapshots__`, or `evals/**/expected` |

**False-positive guards.** `expect(isValid(x)).toBe(true)` is a real assertion (the literal is the *expected* side, not the received value). A mock plus an assertion about the system under test is not `mock-echo`. A specific regex (`/expired.*card/i`) is not a catch-all. A test named after a status (`returns 401 unauthorized`) may only check status. Adding or renaming real asserts stays clean. Pre-existing junk on an untouched line is not re-reported when you add a real assert in the same file.

`review` and `verification` treat a junk-match HIGH the same way they treat a weakened suite: it is not evidence. Under **strict**, hook-dispatch BLOCKs high junk findings on Edit/Write of test files and on `git commit`; under **gentle**, it warns. Fail-open on crash, like the other gates.

## `--oracle` — independent reference

Compare a **candidate** implementation against a **reference** on a corpus of inputs. The reference is something the agent is not supposed to edit: an old binary, a production URL, or recorded fixtures.

```bash
# two commands (legacy vs new)
rune verify --oracle './legacy-cli --json' --candidate './new-cli --json' --corpus tests/oracle

# recorded fixtures (each case has expected output) vs a new command
rune verify --oracle tests/oracle --candidate './new-cli --json'

# two HTTP endpoints
rune verify --oracle https://prod.example/v1 --candidate http://127.0.0.1:8080/v1 --corpus tests/oracle
```

**Corpus.** A directory of cases (default `.rune/oracle/corpus`, or the fixture dir itself when `--oracle` is a directory):

- `case.json` — `{ "id", "args", "stdin", "method", "path", "headers", "body", "expected" }`
- `case.expected` — sidecar raw or JSON expected output
- `case.txt` — raw stdin (the file stem is the case id)

**Commands** receive the case on stdin (plus any `args`). `{id}`, `{file}`, and `{input}` in the command string are substituted. Commands are parsed with quoted-argument splitting — they are **not** run through a shell.

**URLs** are requested with the case `method` (default POST), `path`, `headers`, and `body`. JSON bodies are canonicalized (stable key order) before comparison. UUIDs and ISO timestamps are redacted in fingerprint ids so volatile fields do not explode the triage table.

Each mismatch is a fingerprint `{ input, expected, actual, diffKind }`. `diffKind` is one of `status`, `headers`, `body`, `exit`, `stdout`, `stderr`, `timeout`, `error`, `missing`. The report **aggregates** by fingerprint id and lists the cases in each cluster.

**Baseline.** New divergences fail the run (exit 2). Known, human-accepted mismatches go in `.rune/oracle/baseline.json` (or `--baseline`):

```json
{ "accepted": [{ "id": "a1b2c3d4e5f60789", "reason": "legacy date formatting" }] }
```

A run also writes `.rune/oracle/run-<timestamp>.jsonl` for triage. `rescue` / `safeguard` / `surgeon` should assign each NEW cluster to a `fix` child — the same loop `converge` already uses — rather than inventing a new orchestrator.

## `--reflect` and `--lints` — review comments → rules → lint

Anthropic’s loop was “~60 review comments → `CLAUDE.md` → lint.” Rune’s version:

1. The agent (or `review-intake`) appends recurring findings to `.rune/review-findings.jsonl`:

   ```json
   {"title":"Do not call eval","pattern":"\\beval\\(","message":"Use JSON.parse","files":"**/*.js","severity":"high","count":2}
   ```

   A finding is promoted when `count >= 2` or `"promote": true`. A title-only finding still becomes a convention; a `pattern` is required to generate a lint.

2. `rune verify --reflect` (optionally `--findings <file>`) dedupes those into `.rune/lints/rules.json`, appends a dated entry to `.rune/conventions.md`, and upserts a short pointer block in `AGENTS.md` / `CLAUDE.md` when those files exist. **Nothing is committed** — the command prints the paths to stage.

3. The same rules run as `rune verify --lints`, and in hook-dispatch preflight (Edit/Write) and sentinel (`git commit`). High-severity rules BLOCK under `strict` and warn under `gentle`. If `.rune/lints/rules.json` is absent, the lint gate is a no-op.

Do not weaken or delete a generated rule without human approval.
