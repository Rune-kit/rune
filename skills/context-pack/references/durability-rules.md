# Durability Rules — Why Briefs Rot, How to Stop It

A subagent receives a context packet. A day later, after a refactor, that packet's file paths point to renamed files, line numbers point to shifted code, and "the function in `src/auth/login.ts:42`" no longer exists. The subagent burns tokens grepping to recover or — worse — generates hallucinated edits matching the stale brief.

The fix is to write briefs that describe **types and contracts**, which survive moves, instead of **paths and line numbers**, which don't.

## The 5 rules

### 1. Behavioral over procedural

Describe what the system *does*, not *where* the code lives.

| ❌ Bad | ✅ Good |
|--------|---------|
| "Open `src/handlers/login.ts` and modify line 42" | "When a login fails 5 times, the rate limiter should reject the next attempt with a 429 response and a `Retry-After` header" |
| "Add the field to the type at `src/types.ts:18`" | "The `LoginInput` type should accept an optional `device_id: string`" |
| "Refactor the function around line 150 in `main.ts`" | "Extract the password-hashing path into its own module so it can be tested independently" |

### 2. Type names over file paths in narrative

When you must reference code in narrative prose, refer to **type names, function names, or contracts** — not file paths.

| ❌ Bad | ✅ Good |
|--------|---------|
| "Update the function in `src/auth/`" | "Update the `authenticate` method on `AuthService`" |
| "Modify `src/db/migrations/0042.sql`" | "The new migration should add a `device_id` column to the `sessions` table, nullable, with a default of `NULL`" |

File paths may appear in a clearly-marked `### Files Touched` table — never in narrative prose.

### 3. Type Surface section

Add a `### Type Surface` section listing the contracts that *won't* change even if files do. This is the durable spine of the brief.

```markdown
### Type Surface (durable)
- `LoginInput { email: string; password: string; device_id?: string }` — payload accepted by the login route
- `AuthService.authenticate(input: LoginInput): Result<Session, AuthError>` — primary contract
- `AuthError = "invalid_credentials" | "rate_limited" | "account_locked"` — error union the caller switches on
```

If a file gets renamed but `AuthService.authenticate` keeps its shape, the brief still applies. If the contract changes, the brief is invalidated — that's a feature, not a bug.

### 4. Out of scope is mandatory

Every brief includes `### Out of scope`. Receivers expand into adjacent work without this anchor. Empty list is fine *if explicitly empty* (`### Out of scope\n- (none)`); missing section is rejected by completion-gate.

```markdown
### Out of scope
- Changing the rate-limit window (currently 1 hour — keep it)
- Touching the audit log writer (separate ticket)
- Anything in `src/billing/` — different domain
```

### 5. Behavioral verbs in acceptance criteria

Each acceptance criterion must start with a verb from the whitelist:

```
accepts, rejects, produces, notifies, persists, retries, times-out, validates,
returns, dispatches, redirects, throws, logs, increments, decrements, retrieves
```

Banned verb-less constructs ("the field should be present", "the type is exported") describe shape, not behavior.

| ❌ Bad | ✅ Good |
|--------|---------|
| "The new field should exist" | "Persists the device_id when login succeeds" |
| "An error type should be defined" | "Returns AuthError 'rate_limited' when 5 failures occur within 1 hour" |

## Smell tests (mechanical regex gates)

`context-pack` Phase 4.5 runs these regex against the packet body before emit. Any BLOCK-tier hit fails the gate.

| Regex | Tier | Reason |
|-------|------|--------|
| `\b\S+\.[a-z]{1,4}:\d+\b` | BLOCK | file:line reference (e.g., `login.ts:42`) — line numbers go stale |
| `^- \S*[\\/]\S+\.(ts\|js\|py\|go\|rs\|java)\b` (in non-`Files Touched` sections) | BLOCK | Path-only bullet in narrative |
| `\b(line \|on line )\d+\b` | BLOCK | "line 42" / "on line 100" |
| `\b(src\|lib\|app)/\S+` (in narrative paragraphs) | WARN | Path mention; check if it's in the right section |

Whitelist for `### Files Touched` table — paths there must include the type/function name in parens for durability:

```
- `src/auth/login.ts` (LoginInput, AuthService.authenticate) — the route handler
```

Without the parens annotation, even the table entry is too brittle.

## When durability rules can be relaxed

Two narrow exceptions:

1. **Single-cycle short tasks** (<300 tokens, <3 files) — the brief lives only as long as one cycle, and the receiving agent will execute immediately. Type Surface section becomes optional.
2. **Bug-fix briefs with concrete repro** — sometimes the bug *is* on a specific line of a specific file as it exists right now. In that case, paths may appear in narrative IF accompanied by the type/function name. Example: *"In `AuthService.authenticate` (currently `src/auth/service.ts`), the comparison uses `<` instead of `<=`."*

The rules above are defaults; the exceptions are explicit and rare. When in doubt, follow the rules.

## Self-check before emit

```
[ ] Every narrative reference uses type/function names, not file paths
[ ] Type Surface section lists contracts that won't change with file moves
[ ] Out of scope section exists (even if "(none)")
[ ] Every Acceptance Criterion starts with a behavior verb
[ ] No file:line references appear anywhere
[ ] Files Touched table entries have (Type, function) annotations
```

If any check fails, fix before the receiving agent gets the packet. A stale brief is worse than no brief at all.
