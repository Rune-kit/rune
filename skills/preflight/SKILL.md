---
name: preflight
description: Pre-commit quality gate that catches "almost right" code. Goes beyond linting — checks logic correctness, error handling, regressions, and completeness.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L2
  model: sonnet
  group: quality
---

# preflight

## Purpose

<HARD-GATE>
Preflight verdict of BLOCK stops the pipeline. The calling skill (cook, deploy, launch) MUST halt until all BLOCK findings are resolved and preflight re-runs clean.
</HARD-GATE>

Pre-commit quality gate that catches "almost right" code — the kind that compiles and passes linting but has logic errors, missing error handling, or incomplete implementations. Goes beyond static analysis to check data flow, edge cases, async correctness, and regression impact. The last defense before code enters the repository.

## Triggers

- Called automatically by `cook` before commit phase
- Called by `fix` after applying fixes (verify fix quality)
- `/rune preflight` — manual quality check
- Auto-trigger: when staged changes exceed 100 LOC

## Calls (outbound)

- `scout` (L2): find code affected by changes (dependency tracing)
- `sentinel` (L2): security sub-check on changed files
- `hallucination-guard` (L3): verify imports and API references exist
- `test` (L2): run test suite as pre-commit check

## Called By (inbound)

- `cook` (L1): before commit phase — mandatory gate

## Check Categories

```
LOGIC       — data flow errors, edge case misses, async bugs
ERROR       — missing try/catch, bare catches, unhelpful error messages
REGRESSION  — untested impact zones, breaking changes to public API
COMPLETE    — missing validation, missing loading states, missing tests
SECURITY    — delegated to sentinel
IMPORTS     — delegated to hallucination-guard
```

## Executable Steps

### Stage A — Spec Compliance (Plan vs Diff)

Before checking code quality, verify the code matches what was planned.

Use `Bash` to get the diff: `git diff --cached` (staged) or `git diff HEAD` (all changes).
Use `Read` to load the approved plan from the calling skill (cook passes plan context).

**Check each plan phase against the diff:**

| Plan says... | Diff shows... | Verdict |
|---|---|---|
| "Add function X to file Y" | Function X exists in file Y | PASS |
| "Add function X to file Y" | Function X missing | BLOCK — incomplete implementation |
| "Modify function Z" | Function Z untouched | BLOCK — planned change not applied |
| Nothing about file W | File W modified | WARN — out-of-scope change (scope creep) |

**Output**: List of plan-vs-diff mismatches. Any missing planned change = BLOCK. Any unplanned change = WARN.

If no plan is available (manual preflight invocation), skip Stage A and proceed to Step 1.

### Step 1 — Logic Review
Use `Read` to load each changed file. For every modified function or method:
- Trace the data flow from input to output. Identify where a `null`, `undefined`, empty array, or 0 value would cause a runtime error or wrong result.
- Check async/await: every `async` function that calls an async operation must `await` it. Identify missing `await` that would cause race conditions or unhandled promise rejections.
- Check boundary conditions: off-by-one in loops, array index out of bounds, division by zero.
- Check type coercions: implicit `==` comparisons that could produce wrong results, string-to-number conversions without validation.

**Common patterns to flag:**

```typescript
// BAD — missing await (race condition)
async function processOrder(orderId: string) {
  const order = db.orders.findById(orderId); // order is a Promise, not a value
  return calculateTotal(order.items); // crashes: order.items is undefined
}
// GOOD
async function processOrder(orderId: string) {
  const order = await db.orders.findById(orderId);
  return calculateTotal(order.items);
}
```

```typescript
// BAD — sequential independent I/O
const user = await fetchUser(id);
const permissions = await fetchPermissions(id); // waits unnecessarily
// GOOD — parallel
const [user, permissions] = await Promise.all([fetchUser(id), fetchPermissions(id)]);
```

Flag each issue with: file path, line number, category (null-deref | missing-await | off-by-one | type-coerce), and a one-line description.

### Step 2 — Error Handling
For every changed file, verify:
- Every `async` function has a `try/catch` block OR the caller explicitly handles the rejected promise.
- No bare `catch(e) {}` or `except: pass` — every catch must log or rethrow with context.
- Every `fetch` / HTTP client call checks the response status before consuming the body.
- Error messages are user-friendly: no raw stack traces, no internal variable names exposed to the client.
- API route handlers return appropriate HTTP status codes (4xx for client errors, 5xx for server errors).

**Common patterns to flag:**

```typescript
// BAD — swallowed exception
try {
  await saveUser(data);
} catch (e) {} // silent failure, caller never knows

// BAD — leaks internals to client
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.stack }); // exposes stack trace
});
// GOOD — log internally, generic message to client
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
```

Flag each violation with: file path, line number, category (bare-catch | missing-status-check | raw-error-exposure), and description.

### Step 3 — Regression Check
Use `rune:scout` to identify all files that import or depend on the changed files/functions.
For each dependent file:
- Check if the changed function signature is still compatible (parameter count, types, return type).
- Check if the dependent file has tests that cover the interaction with the changed code.
- Flag untested impact zones: dependents with zero test coverage of the affected code path.

Flag each regression risk with: dependent file path, what changed, whether tests exist, severity (breaking | degraded | untested).

### Step 4 — Completeness Check
Verify that new code ships complete:
- New API endpoint → has input validation schema (Zod, Pydantic, Joi, etc.)
- New React/Svelte component → has loading state AND error state
- New feature → has at least one test file
- New configuration option → has documentation (inline comment or docs file)
- New database query → has corresponding migration file if schema changed

**Framework-specific completeness (apply only if detected):**
- React component with async data → must have `loading` state AND `error` state
- Next.js Server Action → must have `try/catch` and return typed result
- FastAPI endpoint → must have Pydantic request/response models
- Django ViewSet → must have explicit `permission_classes`
- Express route → must have input validation middleware before handler

If any completeness item is missing, flag as **WARN** with: what is missing, which file needs it.

### Step 5 — Security Sub-Check
Invoke `rune:sentinel` on the changed files. Attach sentinel's output verbatim under the "Security" section of the preflight report. If sentinel returns BLOCK, preflight verdict is also BLOCK.

### Step 6 — Generate Verdict
Aggregate all findings:
- Any BLOCK from sentinel OR a logic issue that would cause data corruption or security bypass → overall **BLOCK**
- Any missing error handling, regression risk with no tests, or incomplete feature → **WARN**
- Only style or best-practice suggestions → **PASS**

Report PASS, WARN, or BLOCK. For WARN, list each item the developer must acknowledge. For BLOCK, list each item that must be fixed before proceeding.

## Output Format

```
## Preflight Report
- **Status**: PASS | WARN | BLOCK
- **Files Checked**: [count]
- **Changes**: +[added] -[removed] lines across [files] files

### Logic Issues
- `path/to/file.ts:42` — null-deref: `user.name` accessed without null check
- `path/to/api.ts:85` — missing-await: async database call not awaited

### Error Handling
- `path/to/handler.ts:20` — bare-catch: error swallowed silently

### Regression Risk
- `utils/format.ts` — changed function used by 5 modules, 2 have tests, 3 untested (WARN)

### Completeness
- `api/users.ts` — new POST endpoint missing input validation schema
- `components/Form.tsx` — no loading state during submission

### Security (from sentinel)
- [sentinel findings if any]

### Verdict
WARN — 3 issues found (0 blocking, 3 must-acknowledge). Resolve before commit or explicitly acknowledge each WARN.
```

## Constraints

1. MUST check: logic errors, error handling, edge cases, type safety, naming conventions
2. MUST reference specific file:line for every finding
3. MUST NOT skip edge case analysis — "happy path works" is insufficient
4. MUST verify error messages are user-friendly and don't leak internal details
5. MUST check that async operations have proper error handling and cleanup

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Stopping at first BLOCK finding without checking remaining files | HIGH | Aggregate all findings first — developer needs the complete list, not just the first blocker |
| "Happy path works" accepted as sufficient | HIGH | CONSTRAINT blocks this — edge case analysis is mandatory on every function |
| Calling verification directly instead of the test skill | MEDIUM | Preflight calls rune:test for test suite execution; rune:verification for lint/type/build checks |
| Skipping sentinel sub-check because "this file doesn't look security-relevant" | HIGH | MUST invoke sentinel — security relevance is sentinel's job to determine, not preflight's |
| Skipping Stage A (spec compliance) when plan is available | HIGH | If cook provides an approved plan, Stage A is mandatory — catches incomplete implementations |
| Agent modified files not in plan without flagging | MEDIUM | Stage A flags unplanned file changes as WARN — scope creep detection |

## Done When

- Every changed function traced for null-deref, missing-await, and off-by-one
- Error handling verified on all async functions and HTTP calls
- Regression impact assessed — dependent files identified via scout
- Completeness checklist passed (validation schema, loading/error states, test file)
- Sentinel invoked and its output attached in Security section
- Structured report emitted with PASS / WARN / BLOCK verdict and file:line for every finding

## Cost Profile

~2000-4000 tokens input, ~500-1500 tokens output. Sonnet for logic analysis quality.
