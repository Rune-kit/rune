# review — API checks

> Reference for `skills/review/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

### Step 4.5: API Pit-of-Success Check

For code that exposes APIs, shared utilities, or reusable interfaces, evaluate through 3 adversary personas:

| Adversary | Mindset | What They Reveal |
|-----------|---------|-----------------|
| **The Scoundrel** | Malicious — controls config, crafts inputs, exploits edge cases | Security holes, privilege escalation, injection surfaces |
| **The Lazy Developer** | Copy-pastes from docs, skips error handling, uses defaults | Unsafe defaults, missing validation, footgun APIs |
| **The Confused Developer** | Misunderstands API semantics, passes wrong types, ignores return values | Ambiguous interfaces, poor naming, missing type safety |

**Pit-of-Success principle**: Secure, correct usage should be the path of least resistance. If the API makes it EASIER to use it wrong than right → WARN.

Check: Does the API have sensible defaults? Does misuse fail loudly (not silently)? Is the happy path obvious from the signature?

**Skip if**: Code is internal-only (no external consumers), single-use utility, or test-only.

### Step 4.7: API Contract / Breaking Change Check

For any change that modifies exported functions, REST endpoints, event schemas, or shared types, check for backward-compatibility violations before proceeding.

**Breaking change signals** — flag any of these as HIGH:

| Signal | Example | Why it Breaks |
|--------|---------|---------------|
| Removed export | `export function getUser` deleted | Callers crash at import |
| Renamed parameter | `id: string` → `userId: string` | Named-argument callers break |
| Narrowed return type | `User \| null` → `User` (null removed) | Callers that handle null crash |
| Required arg added | `fn(a)` → `fn(a, b: string)` | All existing callers missing `b` |
| Status code changed | 200 → 204 on success | Clients checking for body break |
| Event schema changed | `{ userId }` → `{ user_id }` | Consumers miss the field |
| Endpoint path renamed | `/users/:id` → `/users/:userId` | All client URLs broken |

**Versioning check:**
1. Run `git diff main...HEAD` — list every changed exported symbol
2. For each changed export: check if old signature still exists as an alias or overload
3. If breaking and no version bump → WARN: "Breaking change detected in [symbol] — needs CHANGELOG entry and version bump"
4. If `CHANGELOG.md` found: check that breaking changes are documented in the current version entry

**Skip if**: Change is internal-only (no exports changed, no public API surface affected), or in test files only.
