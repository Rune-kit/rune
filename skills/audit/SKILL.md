---
name: audit
description: Comprehensive project audit — security, dependencies, code quality, architecture, performance, infra, and docs. Delegates to specialist skills and generates a 7-dimension health score.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L2
  model: sonnet
  group: quality
---

# audit

## Purpose

Comprehensive project health audit across 7 dimensions. Delegates security scanning to `sentinel`, dependency analysis to `dependency-doctor`, and code complexity to `autopsy`, then directly audits architecture, performance, infrastructure, and documentation. Applies framework-specific checks (React/Next.js, Node.js, Python, Go, Rust, React Native/Flutter) based on detected stack. Produces a consolidated health score and prioritized action plan saved to `AUDIT-REPORT.md`.

## Triggers

- `/rune audit` — manual invocation
- User says "audit", "review project", "health check", "project assessment"

## Calls (outbound)

- `scout` (L2): Phase 0 — project structure and stack discovery
- `dependency-doctor` (L3): Phase 1 — vulnerability scan and outdated dependency check
- `sentinel` (L2): Phase 2 — security audit (OWASP Top 10, secrets, config)
- `autopsy` (L2): Phase 3 — code quality and complexity assessment
- `perf` (L2): Phase 4 — performance regression check
- `db` (L2): Phase 5 — database health dimension (schema, migrations, indexes)
- `journal` (L3): record audit date, overall score, and verdict

## Called By (inbound)

- `cook` (L1): pre-implementation audit gate
- `launch` (L1): pre-launch health check
- User: `/rune audit` direct invocation

## Executable Instructions

### Phase 0: Project Discovery

Call `rune:scout` for a full project map. Then use `Read` on:
- `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `.editorconfig` (if they exist)

Determine:
- Language(s) and version(s)
- Framework(s) — determines which Framework-Specific Checks below apply
- Package manager, build tool(s), test framework(s), linter/formatter config
- Project type: `API/backend` | `frontend/SPA` | `fullstack` | `CLI tool` | `library` | `mobile` | `infra/IaC`
- Monorepo setup (workspaces, turborepo, nx, etc.)

**Output before proceeding:** Brief project profile, stack summary, and which Framework-Specific Checks will be applied.

---

### Phase 1: Dependency Audit

Delegate to `dependency-doctor`. The dependency-doctor report covers:
- Vulnerability scan (CVEs by severity)
- Outdated packages (patch / minor / major)
- Unused dependencies
- Dependency health score

Pass the full dependency-doctor report through to the final audit.

---

### Phase 2: Security Audit

Delegate to `sentinel`. Request a full security scan covering:
- Hardcoded secrets, API keys, tokens, passwords in source code
- OWASP Top 10: injection, broken auth, sensitive data exposure, XSS, CSRF, insecure deserialization, broken access control
- Configuration security (debug mode in prod, CORS `*`, missing HTTP security headers)
- Input validation at API boundaries
- `.gitignore` coverage of sensitive files

Pass the full sentinel report through to the final audit.

---

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

### Phase 7: Documentation Audit

Use `Glob` and `Read` to check:

**7.1 Project Documentation**
- README completeness: description, prerequisites, setup, usage, deployment, contributing
- API documentation (OpenAPI/Swagger spec, or documented endpoints)
- Can a new developer get running from README alone?
- Architecture Decision Records (ADRs) for non-obvious choices

**7.2 Code Documentation**
- Public API / exported functions documented
- Complex business logic with explanatory comments
- `CHANGELOG.md` maintained
- `LICENSE` file present

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

### Final Report

After all 7 phases complete:

Use `Write` to save `AUDIT-REPORT.md` to the project root with the full findings from all phases.

Call `rune:journal` to record: audit date, overall health score, verdict, and CRITICAL count.

## Severity Levels

```
CRITICAL — Must fix immediately. Security vulnerabilities, data loss, broken builds.
HIGH     — Should fix soon. Performance bottlenecks, CVEs, major code smells.
MEDIUM   — Plan to fix. Code duplication, missing tests, outdated deps.
LOW      — Nice to have. Style inconsistencies, minor refactors, doc gaps.
INFO     — Observation only. Architecture notes, tech debt acknowledgment.
```

Apply confidence filtering: only report findings with >80% confidence. Consolidate similar issues (e.g., "12 functions missing error handling in src/services/" — not 12 separate findings). Adapt judgment to project type (a `console.log` in a CLI tool is fine; in a production API handler, it's not).

## Output Format

```
## Audit Report: [Project Name]

- **Verdict**: PASS | WARNING | FAIL
- **Overall Health**: [score]/10
- **Total Findings**: [n] (CRITICAL: [n], HIGH: [n], MEDIUM: [n], LOW: [n])
- **Framework Checks Applied**: [list]

### Health Score
| Dimension      | Score    | Notes              |
|----------------|:--------:|--------------------|
| Security       |   ?/10   | [brief note]       |
| Code Quality   |   ?/10   | [brief note]       |
| Architecture   |   ?/10   | [brief note]       |
| Performance    |   ?/10   | [brief note]       |
| Dependencies   |   ?/10   | [brief note]       |
| Infrastructure |   ?/10   | [brief note]       |
| Documentation  |   ?/10   | [brief note]       |
| **Overall**    | **?/10** | **[verdict]**      |

### Phase Breakdown
| Phase          | Issues |
|----------------|--------|
| Dependencies   | [n]    |
| Security       | [n]    |
| Code Quality   | [n]    |
| Architecture   | [n]    |
| Performance    | [n]    |
| Infrastructure | [n]    |
| Documentation  | [n]    |

### Top Priority Actions
1. [action] — [file:line] — [why it matters]

### Positive Findings
- [at least 3 things the project does well]

### Follow-up Timeline
- FAIL → re-audit in 1-2 weeks after CRITICAL fixes
- WARNING → re-audit in 1 month
- PASS → routine audit in 3 months

Report saved to: AUDIT-REPORT.md
```

## Constraints

1. MUST complete all 7 phases — if any phase is skipped, state explicitly which phase and why
2. MUST delegate Phase 1 to dependency-doctor and Phase 2 to sentinel — no manual replacements
3. MUST apply confidence filter — only report findings with >80% confidence; consolidate similar issues
4. MUST include at least 3 positive findings — an audit with no positives is incomplete
5. MUST produce quantified health scores (1-10 per dimension) — not vague "needs work"
6. MUST NOT fabricate findings — every finding requires a specific file:line citation
7. MUST save AUDIT-REPORT.md before declaring completion

## Mesh Gates

| Gate | Requires | If Missing |
|------|----------|------------|
| Discovery Gate | Phase 0 project profile completed before Phase 1 | Run scout and read config files first |
| Security Gate | sentinel report received before assembling final report | Invoke rune:sentinel — do not skip |
| Deps Gate | dependency-doctor report received before assembling final report | Invoke rune:dependency-doctor — do not skip |
| Report Gate | All 7 phases completed before writing AUDIT-REPORT.md | Complete all phases, note skipped ones |

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Generating health scores from file name patterns instead of actual reads | CRITICAL | Phase 0 scout run is mandatory — never score without reading actual code |
| Skipping a phase because "there are no changes in that area" | HIGH | All 7 phases run for every audit — partial audits produce misleading scores |
| Health score inflation — no negative findings in any dimension | MEDIUM | CONSTRAINT: minimum 3 positive AND 3 improvement areas required |
| Dependency-doctor or sentinel sub-call times out → skipped silently | MEDIUM | Mark phase as "incomplete — tool timeout" with N/A score, do not fabricate |

## Done When

- All 7 phases completed (or explicitly marked N/A with reason)
- Health score calculated from actual file reads per dimension (not estimated)
- At least 3 positive findings and 3 improvement areas documented
- AUDIT-REPORT.md written to project root
- Journal entry recorded with audit date, score, and CRITICAL count
- Structured report emitted with overall health score and verdict

## Cost Profile

~8000-20000 tokens input, ~3000-6000 tokens output. Sonnet orchestrating; sentinel (sonnet/opus) and autopsy (opus) are the expensive sub-calls. Full audit runs 4 sub-skills. Most thorough L2 skill — run on demand, not on every cycle.
