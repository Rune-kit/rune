# Go

Blocking here: discarded errors, goroutine and resource leaks, data races, and nil semantics that
panic at runtime. Naming, comment style, and receiver conventions are non-blocking — `gofmt` and
`go vet` already cover the ground a reviewer would otherwise spend the report on.

## Error handling

- An error assigned to `_`, or a call whose error return is dropped entirely
- An error returned unwrapped where the caller needs to distinguish causes — no `%w`, no sentinel
- `err` shadowed by `:=` in an inner scope, so the outer check tests a stale value
- `panic` on a recoverable condition in library code

Do not report a discarded error on a call that cannot meaningfully fail in context — `fmt.Fprintf`
to a `strings.Builder`, a `Close` on a read-only handle already drained — provided the discard is
deliberate and local.

## Concurrency

- A goroutine with no exit path: it blocks forever on a channel nobody closes or writes
- `sync.WaitGroup` whose `Add` is inside the goroutine rather than before it starts
- A map or slice written from multiple goroutines without a mutex or channel discipline
- A mutex locked on a path that can `return` before `Unlock`, with no `defer`
- Sending on a channel that another path may have closed

Do not report loop-variable capture in a module whose `go.mod` declares `go 1.22` or later — the
per-iteration variable semantics make the classic capture bug impossible there.

## Context and timeouts

- `context.Background()` or `context.TODO()` inside a request path that already has a context
- An outbound HTTP, RPC, or DB call with no deadline and no context propagation
- A context cancel function from `WithCancel` / `WithTimeout` not deferred — a leak
- A context stored in a struct field rather than passed as the first parameter

Do not report a missing deadline on a call inside `main`, an init path, or a long-running worker
that is meant to run until cancelled.

## Resource lifecycle

- `defer resp.Body.Close()` missing after a successful HTTP call, or placed before the error check
- `defer` inside a loop where the resource must be released each iteration, not at function exit
- A file, rows handle, or connection opened on one branch and closed on only some of them
- `rows.Err()` never checked after a `sql.Rows` iteration

Do not report a missing `Close` when the value's lifetime is the process itself.

## Nil and slice semantics

- A write to a nil map — reads are fine, writes panic
- A nil pointer dereference on a path where the constructor can return `(nil, err)`
- `append` on a slice sharing a backing array with a caller's slice, silently overwriting
- A typed nil returned as an `error` interface — non-nil interface holding a nil pointer

Do not report slice aliasing when the source slice is built inside the same function and never
escapes it.

## Untrusted input

- A query assembled with `fmt.Sprintf` rather than placeholders
- `exec.Command` whose arguments derive from input, especially through a shell
- A path joined from input without `filepath.Clean` plus a base-directory check

Do not report `fmt.Sprintf` in a query when every interpolated value is a constant or comes from a
fixed allowlist in the same file.
