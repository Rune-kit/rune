# Brief Template (v2)

Use this verbatim. Receivers expect every section. Sections marked optional may be omitted only if there's nothing to record (not because the writer didn't bother).

```markdown
## Context Packet

**Task**: [One-line behavioral description, verb-led: "Add rate limiting to login route"]
**Parent**: [delegating skill — e.g., cook]
**Scope**: [type names / module names — NOT file paths]

### Decisions Made
- [Decision]: chose [X] over [Y] because [reason]
- ...

### Constraints
- MUST: [behavioral assertion — "preserve existing 1hr rate-limit window"]
- MUST NOT: [behavioral prohibition — "modify the audit log writer"]
- BLOCKED BY: [contract dependency — "the auth.token-refresh contract finalized in PR #42"]

### Already Tried
- [Approach] — [observable failure mode]

### Type Surface (durable)
- `TypeName { field: type; field: type }` — what it represents
- `Module.method(input: T): Result<O, E>` — the contract
- `ErrorEnum = "case_a" | "case_b"` — what callers switch on

### Files Touched (locator-only, may rename)
- `path/to/file.ts` (TypeName, Module.method) — [behavioral hint]
- ...

### Acceptance Criteria
- [ ] [Verb-led testable statement — "Rejects login attempts with 429 after 5 failures within 1 hour"]
- [ ] ...

### Out of scope
- [Thing the receiver should NOT do]
- [Adjacent feature that might seem related but is separate]
- (or "(none)" if nothing to exclude)

### Progress
- [What's done so far, if partial handoff — omit if fresh start]
```

## Behavioral verb whitelist

Every Acceptance Criterion must start with one of these:

```
accepts          dispatches      logs              redirects        retrieves
rejects          throws          increments        retries           returns
produces         times-out       decrements        notifies          validates
persists         emits           caches            invalidates       authenticates
```

Verbs not on the whitelist may still be valid; check whether the criterion describes *observable behavior* (good) or *shape* ("is defined", "has property", "exists") — shape verbs are banned.

## Worked example

### ✅ Good packet

```markdown
## Context Packet

**Task**: Add device tracking to login flow
**Parent**: cook
**Scope**: AuthService, LoginInput, sessions table

### Decisions Made
- Track device_id at login: chose passing through to session storage over hashing in-app, because compliance requires preserving raw values for audit window
- Optional field: chose nullable rather than required, because mobile clients prior to v3.2 don't send it

### Constraints
- MUST: preserve backward-compatible login for clients without device_id
- MUST NOT: change rate-limit window (currently 1hr)

### Already Tried
- Storing in JWT claims — rejected because tokens grow past mobile size limit

### Type Surface (durable)
- `LoginInput { email: string; password: string; device_id?: string }` — payload accepted by login route
- `AuthService.authenticate(input: LoginInput): Result<Session, AuthError>` — primary contract
- `Session { user_id: string; created_at: Date; device_id: string | null }` — issued on success

### Files Touched (locator-only, may rename)
- `src/auth/login.ts` (LoginInput, AuthService.authenticate) — route handler
- `src/db/migrations/sessions.sql` (sessions table) — schema

### Acceptance Criteria
- [ ] Persists device_id to sessions table when login succeeds and device_id is provided
- [ ] Persists null when device_id is absent
- [ ] Returns AuthError 'invalid_credentials' on bad password (existing behavior unchanged)

### Out of scope
- Changing rate-limit window
- Updating mobile client SDKs
- Audit log writer
```

### ❌ Bad packet (would fail smell tests)

```markdown
## Context Packet

**Task**: fix the login

**Files**: src/auth/login.ts:42, src/types.ts:18

The function around line 100 has a bug. Add a device field. See `src/handlers/`.
```

Failures:
- No section structure
- File:line references (`login.ts:42`)
- "line 100" — line-number reference
- "around line" — narrative path
- No Type Surface
- No Out of scope
- No Acceptance Criteria with behavior verbs
- Vague task description ("fix the login")
