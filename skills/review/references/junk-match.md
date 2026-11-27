# Junk-match and ship-worthiness (review)

After the suite is green, ask the second question: *does this match in a way worth shipping, or is it junk that satisfies the verifier?*

Run `rune verify --junk` (and `--integrity` if tests changed) on the review diff. Treat HIGH findings as blocking (REQUEST CHANGES). WARN findings are reportable; drop them only with a `Do not report when…` reason (for example a test literally named `returns 401 unauthorized`).

## What the scanner already flags

Tautological asserts (`expect(true)`, `expect(x).toBe(x)`), catch-all regex (`/^.*$/`), empty snapshots, mocks asserted only to return the value they were given, behavior tests that only check a status code, production code that imports `__fixtures__` / snapshots / `evals/**/expected`.

## Judgment the scanner cannot make

Look at the *production* diff for the Anthropic “copied tool descriptions into a file” class of match:

- New branches that compare against test fixtures or literal expected outputs
- Reads of `__fixtures__`, snapshot directories, or `evals/**/expected.json` from `src/` (the scanner’s `fixture-in-src` is the cheap half)
- Golden files copied into runtime paths
- A special-case `if` whose condition only exists in the test’s input set

If you find one, it is a correctness finding (blocking), not style. Cite the line and say why a production-as-oracle or a stronger assertion would have caught it.

## Learning loop

If the same class of finding appears twice (this PR, or this PR + evolutionary memory / prior review), append a line to `.rune/review-findings.jsonl` and tell the author to run `rune verify --reflect`. That promotes a dated convention and a regex lint the next agent cannot ignore. Do not auto-commit those files.

Full CLI: `docs/VERIFY.md`.
