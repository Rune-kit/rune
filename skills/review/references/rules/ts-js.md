# TypeScript / JavaScript

Blocking here: async sequencing bugs, unvalidated input reaching a sink, and type escapes on values
that cross a boundary. Formatting and idiom are non-blocking — a linter already owns them, and
repeating it spends the report's credibility on findings the author has already seen.

## Async sequencing

- A promise-returning call whose result decides correctness, invoked without `await` or `.then`
- `await` inside a loop over independent iterations — serial latency for no reason
- `Promise.all` over operations that must not partially apply: one rejects, the rest still land
- An `async` function passed where a sync callback is expected (`forEach`, most event emitters) —
  the caller cannot await it, so a rejection is unobserved
- `.catch` on a promise that is never returned, so the caller is told it succeeded

Do not report when the call is deliberately fire-and-forget **and** carries its own rejection
handler, or when the return value is genuinely unused and failure is non-fatal — name which of the
two you read.

## Type escapes

- `any` on a value crossing a module, API, or storage boundary
- Non-null assertion `!` on something the path does not prove is present
- `as` casts that widen or re-label a shape rather than narrow a checked union
- `@ts-ignore` / `@ts-expect-error` with no comment naming what it suppresses

Do not report when the escape stays inside one function whose inputs are all typed, or when the
project's own config already permits it (`strict: false`, the rule disabled in its lint config) —
that is a project decision, not a defect introduced by this diff.

## Null and equality semantics

- `==` / `!=` where a side can be `null`, `undefined`, `0`, or `''` and the coercion changes the outcome
- `||` for defaulting where `0`, `''`, or `false` are legitimate values (`??` is the intent)
- Optional chaining that stops short — `a?.b.c` still throws when `b` is nullish
- `JSON.parse` on untrusted or possibly-empty input with no `try`

Do not report when the value is narrowed earlier in the same path, or when the loose comparison is
against a literal that makes the coercion unambiguous.

## Mutation and shared state

- Mutating a parameter, prop, or module-level object the caller still holds
- `sort`, `reverse`, `splice` on an array received from outside the function
- A closure capturing a variable reassigned before the closure runs

Do not report when the object is constructed inside the same function, or when in-place mutation
with an explicit ownership comment is the visible convention in neighbouring files.

## React rendering

- `useEffect` missing a dependency its body reads — a stale closure, not a lint nit
- An effect that sets state it also depends on, unguarded — render loop
- Array index as `key` on a list that reorders, filters, or inserts
- `useState` / `useEffect` / event handlers in a Server Component (Next.js App Router)
- State written during render rather than in an effect or a handler

Do not report when the dependency is stable (a `useRef`, a `useState` setter, a module constant),
when the list is append-only and static, or when the file declares `'use client'`.

## Server-side request handling

- `req.body`, params, or query reaching a query, file path, template, or shell unvalidated
- A new route with no auth check where its siblings in the same router have one
- A public endpoint that authenticates, sends mail, or costs money per call, with no rate limit
- Synchronous filesystem, crypto, or large-payload serialization inside a request handler
- User-controlled input concatenated into a redirect target or an HTML string

Do not report when a validation schema, auth middleware, or rate limiter runs earlier in the chain,
or when rate limiting is applied at a gateway or reverse proxy the repo also owns — open the router
or that config and confirm, or file it `ASSUMED` naming the file you did not read.

## Errors and resources

- `catch` that swallows: an empty block, or one that logs and continues as though it succeeded
- Errors re-thrown without preserving `cause` or the original stack
- `setInterval`, listeners, subscriptions, or streams opened with no matching teardown

Do not report a swallowed error when the catch is a fallback path whose recovery behaviour is
visible in the same block.
