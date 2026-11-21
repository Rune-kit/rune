# audit — Phase 3–6 checklists and framework checks

> Reference for `skills/audit/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

### Phase 3: Code Quality Audit

Delegate to `autopsy` for codebase health (complexity, coupling, hotspots, dead code, health score per module).

In addition, use `Grep` to find supplementary issues autopsy may not cover:

```bash
# console.log in production code
grep -r "console\.log" src/ --include="*.ts" --include="*.js" -l

# TypeScript any types
grep -r ": any" src/ --include="*.ts" -n

# Empty catch blocks
grep -rn "catch.*{" src/ --include="*.ts" --include="*.js" -A 1 | grep -E "^\s*}"

# Python print() in production
grep -r "^print(" . --include="*.py" -l

# Rust .unwrap() outside tests
grep -rn "\.unwrap()" src/ --include="*.rs"
```

Merge autopsy report + supplementary findings.

**3.5 Zombie Code Detection**

Identify code that is effectively dead but hasn't been formally removed. Zombie code increases surface area, confuses contributors, and accumulates security debt.

| Signal | Detection Method | Severity |
|--------|-----------------|----------|
| No commits in 6+ months | `git log --since="6 months ago" -- <file>` returns empty | MEDIUM |
| No test coverage | File not imported by any test file (Grep for filename in `**/*.test.*` / `**/*.spec.*`) | MEDIUM |
| No owner | File not in CODEOWNERS, no author active in last 6 months | LOW |
| Failing tests referencing the module | Test suite has skipped/failing tests for this module | HIGH |
| Unpatched CVEs in dependencies only this module uses | Cross-reference dependency-doctor CVE list with per-file imports | HIGH |
| Orphaned docs | README/docs reference files or APIs that no longer exist | LOW |

**Zombie Code Verdict:**
- 3+ signals on same file/module → flag as **ZOMBIE** in audit report
- Recommend: archive (move to `_deprecated/`), delete, or assign owner
- Do NOT auto-delete — present zombie list to user for decision

---

### Phase 4: Architecture Audit

Use `Read` and `Grep` to evaluate structural health directly.

**4.1 Project Structure**
- Logical folder organization (business logic vs infrastructure vs presentation separated?)
- Circular dependencies between modules (A imports B, B imports A)
- Barrel file analysis (excessive re-exports causing bundle bloat)

**4.2 Design Patterns & Principles**
- Single Responsibility violations (route handlers with direct DB calls, fat controllers)
- Tight coupling between layers

```typescript
// BAD — route handler directly coupled to database
app.get('/users/:id', async (req, res) => {
  const user = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  res.json(user);
});
// GOOD — layered architecture
app.get('/users/:id', async (req, res) => {
  const user = await userService.getUser(req.params.id);
  res.json(user);
});
```

**4.3 API Design** (if applicable)
- Consistent naming conventions (camelCase vs snake_case in JSON responses)
- Correct HTTP method usage (GET reads, POST creates, PUT/PATCH updates, DELETE removes)
- Consistent error response format across endpoints
- Pagination on collection endpoints
- API versioning strategy

**4.4 Database Patterns** (if applicable)
- N+1 query patterns

```typescript
// BAD — N+1
const users = await db.query('SELECT * FROM users');
for (const user of users) {
  user.posts = await db.query('SELECT * FROM posts WHERE user_id = $1', [user.id]);
}
// GOOD — single JOIN
const usersWithPosts = await db.query(`
  SELECT u.*, json_agg(p.*) as posts
  FROM users u LEFT JOIN posts p ON p.user_id = u.id
  GROUP BY u.id
`);
```

- Missing indexes (check schema/migrations for columns used in WHERE/JOIN)
- Missing `LIMIT` on user-facing queries

**4.5 State Management** (frontend only)
- Global state pollution (local state handled globally)
- Prop drilling (>3 levels deep — use Context or composition)
- Data fetching patterns (caching, deduplication, stale-while-revalidate)

---

### Phase 5: Performance Audit

**5.1 Build & Bundle** (frontend)
- Tree-shaking effectiveness (importing entire libraries vs specific modules)

```typescript
// BAD — imports entire library
import _ from 'lodash';
// GOOD — tree-shakeable import
import get from 'lodash/get';
```

- Code splitting / lazy loading for routes
- Large unoptimized assets

**5.2 Runtime Performance**
- Synchronous operations that should be async (file I/O, network calls)
- Memory leak patterns (event listeners not cleaned up, growing caches, unclosed streams)
- Expensive operations in hot paths

```typescript
// BAD — regex compiled on every call
function validate(input: string) {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(input);
}
// GOOD — compile once at module level
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
function validate(input: string) { return EMAIL_REGEX.test(input); }
```

**5.3 Database & I/O**
- Missing connection pooling
- Unbounded queries (no `LIMIT` on user-facing endpoints)
- Sequential I/O that could be parallel

```typescript
// BAD — sequential when independent
const users = await fetchUsers();
const products = await fetchProducts();
// GOOD — parallel
const [users, products] = await Promise.all([fetchUsers(), fetchProducts()]);
```

---

### Phase 6: Infrastructure & DevOps Audit

Use `Glob` and `Read` to check:

**6.1 CI/CD Pipeline**
- CI config exists (`.github/workflows/`, `.gitlab-ci.yml`, `.circleci/`, `Jenkinsfile`)
- Tests running in CI
- Linting enforced in CI
- Security scanning in pipeline (Dependabot, Snyk, CodeQL)

**6.2 Environment Configuration**
- `.env.example` exists with placeholder values (not real secrets)
- Environment variables validated at startup

```typescript
// BAD — silently undefined
const port = process.env.PORT;
// GOOD — validate at startup
const port = process.env.PORT;
if (!port) throw new Error('PORT environment variable is required');
```

**6.3 Containerization** (if applicable)
- Dockerfile: multi-stage build, non-root user, minimal base image
- `.dockerignore` covers `node_modules`, `.git`, `.env`

**6.4 Logging & Monitoring**
- Structured logging (JSON format, not raw `console.log`)
- Error tracking integration (Sentry, Datadog, etc.)
- Health check endpoints (`/health`, `/ready`)
- No sensitive data in logs (passwords, tokens, PII)

---

### Framework-Specific Checks

Apply **only** if the framework was detected in Phase 0. Skip entirely if not relevant.

**React / Next.js** (detect: `react` or `next` in `package.json`)
- `useEffect` with missing dependencies (stale closures)
- State updates during render (infinite loop pattern)
- List items using index as key on reorderable lists
- Props drilled through 3+ levels
- Client-side hooks in Server Components (Next.js App Router)
- Components exceeding 200 JSX lines

**Node.js / Express / Fastify** (detect: `express`, `fastify`, `koa`, `@nestjs/core`)
- Missing rate limiting on public endpoints
- Missing request timeout configuration
- Error messages leaking internal details to clients
- Unbounded `SELECT *` without pagination
- Missing authentication middleware on protected routes
- Synchronous operations blocking the event loop

**Python (Django / Flask / FastAPI)** (detect: `django`, `flask`, `fastapi` in requirements)
- Django: missing `permission_classes`, `DEBUG=True` in production, missing CSRF middleware
- Flask: `app.run(debug=True)` without environment check
- FastAPI: missing Pydantic models for request/response
- Mutable default arguments (`def func(items=[])`)
- Missing type hints on public functions (if project uses mypy/pyright)

**Go** (detect: `go.mod`)
- Ignored errors (`file, _ := os.Open(filename)`)
- Goroutine leaks (goroutines without cancellation context)
- Missing `defer` for resource cleanup (files, locks, connections)
- Race conditions (shared state without mutex or channels)

**Rust** (detect: `Cargo.toml`)
- `.unwrap()` / `.expect()` in non-test production code (use `?` operator)
- `unsafe` blocks without safety comments

**Mobile (React Native / Flutter)** (detect: `react-native` in `package.json` or `pubspec.yaml`)
- FlatList without `keyExtractor` or `getItemLayout`
- Missing `React.memo` on list item components
- Flutter: missing `const` constructors, missing `dispose()` for controllers and streams

---
