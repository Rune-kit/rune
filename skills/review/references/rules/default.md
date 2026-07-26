# Default rules

Loaded for every review, alongside any language file that matches. These are the five dimensions
every changed file is judged on, regardless of language. Deliberately small — a language rule file
is more specific and therefore more trustworthy, so where the two overlap, prefer the language file.

## Correctness

- A condition inverted, off by one, or testing a different value than the one it guards
- An edge case the change introduces and does not handle: empty input, zero, a negative number, a
  single-element collection, a boundary date
- A failure path that leaves state half-written, with no rollback or compensating action
- A default or fallback that silently produces a plausible-but-wrong value

Do not report an unhandled edge case when the caller you read already excludes it — and if you did
not read the caller, that is an `ASSUMED` finding naming the caller, not an `OBSERVED` one.

## Security

- Input from outside the trust boundary reaching a query, path, command, template, or redirect
- A new entry point with no authorization check where comparable entry points have one
- A credential, token, or key with a literal value
- An error message or log line carrying a secret, a token, or personally identifying data

Do not report on code whose only inputs are internal constants or values already validated at a
boundary you read. Auth, crypto, and payment code still escalates to `rune:sentinel` regardless of
whether this rule fires.

## Performance

- Work inside a loop that does not depend on the loop: a repeated query, a re-read file, a
  recompiled pattern
- An operation whose cost grows with a collection that grows without bound
- A synchronous or blocking call on a latency-sensitive path

Do not report performance on a path that runs once at startup, in a script, or in a test — and do
not report a complexity concern without naming the input that makes it matter. An unmeasured
micro-optimization is a LOW finding at most.

## Maintainability

- A magic value repeated across call sites that should be a named constant
- A function doing several unrelated things, where the change made it worse rather than found it so
- Naming that contradicts what the code does — a `get` that writes, an `is` that returns a value
- Copy-pasted logic that now has to be corrected in more than one place

Do not report a maintainability concern that predates the diff. Pre-existing structure is a
footer follow-up, never a finding against this change — the author cannot act on it here.

## Test coverage

- New branching logic with no test exercising the new branch
- A bug fix with no test that fails without the fix
- A test changed to match new behaviour where the behaviour change itself was not requested

Do not report missing tests for pure config, generated files, or a change whose behaviour is
already covered by an existing test you located.
