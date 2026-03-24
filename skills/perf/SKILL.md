---
name: perf
description: Performance regression gate. Detects N+1 queries, sync-in-async, missing indexes, memory leaks, and bundle bloat before they reach production.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L2
  model: sonnet
  group: quality
  tools: "Read, Bash, Glob, Grep"
---

# perf

## Purpose

Performance regression gate. Analyzes code changes for patterns that cause measurable slowdowns — N+1 queries, sync operations in async handlers, unbounded DB queries, missing indexes, memory leaks, and bundle bloat. Not a profiler — a gate. Finds performance bugs with measurable/estimated impact before production, so developers fix them at the cheapest point in the cycle.

## Triggers

- `/rune perf` — manual invocation before commit
- Called by `cook` (L1): Phase 5 quality gate
- Called by `review` (L2): performance patterns detected in diff
- Called by `deploy` (L2): pre-deploy regression check
- Called by `audit` (L2): performance health dimension

## Calls (outbound)

- `scout` (L2): find hotpath files and identify framework in use
- `browser-pilot` (L3): run Lighthouse / Core Web Vitals for frontend projects
- `verification` (L3): run benchmark scripts if configured (e.g. `npm run bench`)
- `design` (L2): when Lighthouse Accessibility BLOCK — design system may lack a11y foundation

## Called By (inbound)

- `cook` (L1): Phase 5 quality gate before PR
- `audit` (L2): performance dimension delegation
- `review` (L2): performance patterns detected in diff
- `deploy` (L2): pre-deploy perf regression check

## References

- `references/cost-reference.md` — Cost priority hierarchy, quick wins checklist, instance right-sizing, data transfer traps, serverless optimization, observability cost control, managed vs self-hosted matrix, unit economics tracking. Load when cost analysis or FinOps context detected.
- `references/scalability-reference.md` — Bottleneck identification flow, performance thresholds, API patterns (cursor pagination, rate limiting, circuit breaker, graceful shutdown), caching strategies, queue-based load leveling, concurrency patterns, K8s HPA, CDN headers, load testing. Load when scaling or infrastructure optimization context detected.

## Executable Steps

### Step 1 — Scope

Determine what to analyze:
- If called with a file list or diff → analyze those files only
- If called standalone → invoke `scout` to identify top 10 hotpath files (entry points, routes, DB access layers, render-heavy components)
- Detect project type: **frontend** (React/Vue/Svelte) | **backend** (Node/Python/Go) | **fullstack** | **CLI**

### Step 2 — DB Query Patterns

Scan all in-scope files for:

**N+1 pattern** — loop containing ORM call:
```
# BAD: N+1
for user in users:
    orders = Order.objects.filter(user=user)  # N queries

# GOOD: prefetch
users = User.objects.prefetch_related('orders').all()
```
Finding: `N+1 DETECTED — [file:line] — loop over [collection] with [ORM call] inside — use prefetch/JOIN`

**Unbounded query** — no LIMIT/pagination:
```
# BAD
db.query("SELECT * FROM events")

# GOOD
db.query("SELECT * FROM events LIMIT 100 OFFSET ?", [offset])
```
Finding: `UNBOUNDED_QUERY — [file:line] — missing LIMIT on [table] — add pagination`

**SELECT \*** — fetching all columns when only some are needed:
Finding: `SELECT_STAR — [file:line] — select only needed columns`

### Step 3 — Async/Sync Violations

Scan for synchronous operations in async contexts:

**Blocking I/O in async handler:**
```javascript
// BAD: blocks event loop
async function handler(req) {
  const data = fs.readFileSync('./config.json')
}

// GOOD
async function handler(req) {
  const data = await fs.promises.readFile('./config.json')
}
```
Finding: `SYNC_IN_ASYNC — [file:line] — [readFileSync|execSync|etc] in async function — blocks event loop`

**Missing await:**
```javascript
// BAD: fire-and-forget
async function save() {
  db.insert(record)  // no await
}
```
Finding: `MISSING_AWAIT — [file:line] — unresolved Promise may cause race condition`

### Step 4 — Memory Leak Patterns

Scan for:

**Event listener without cleanup:**
```javascript
// BAD: leak in React
useEffect(() => {
  window.addEventListener('resize', handler)
  // missing return cleanup
})

// GOOD
useEffect(() => {
  window.addEventListener('resize', handler)
  return () => window.removeEventListener('resize', handler)
}, [])
```
Finding: `MEMORY_LEAK — [file:line] — addEventListener without cleanup in useEffect`

**Growing collection without eviction:**
```python
# BAD: unbounded cache
cache = {}
def get(key):
    if key not in cache:
        cache[key] = expensive_compute(key)
    return cache[key]
```
Finding: `UNBOUNDED_CACHE — [file:line] — dict grows indefinitely — add LRU eviction or TTL`

### Step 5 — Bundle Analysis (frontend only)

If project type is frontend:
- Check for large direct imports that block tree-shaking:
  ```javascript
  // BAD: imports entire lodash
  import _ from 'lodash'
  // GOOD: named import
  import { debounce } from 'lodash'
  ```
  Finding: `BUNDLE_BLOAT — [file:line] — default import of [library] prevents tree-shaking`
- Check for missing React.memo / useMemo on expensive renders
- Check for component definitions inside render (recreated every render)

If `browser-pilot` is available and project has a URL: invoke it for Lighthouse score.

**Lighthouse Score Gates** (apply to any project with a public URL):

```
Performance:    ≥ 90 → PASS  |  70–89 → WARN  |  < 70 → BLOCK
Accessibility:  ≥ 95 → PASS  |  80–94 → WARN  |  < 80 → BLOCK
Best Practices: ≥ 90 → PASS  |  < 90  → WARN
SEO:            ≥ 80 → PASS  |  < 80  → WARN  (public-facing pages only)
```

**Core Web Vitals thresholds:**
```
LCP (Largest Contentful Paint):
  ≤ 2.5s → PASS  |  2.5–4s → WARN  |  > 4s → BLOCK

INP (Interaction to Next Paint, replaces FID):
  ≤ 200ms → PASS  |  200–500ms → WARN  |  > 500ms → BLOCK

CLS (Cumulative Layout Shift):
  ≤ 0.1 → PASS  |  0.1–0.25 → WARN  |  > 0.25 → BLOCK
```

<HARD-GATE>
Lighthouse Accessibility score < 80 = BLOCK regardless of other scores.
Accessibility regressions are legal liability and cannot be auto-fixed by the AI.
Do NOT downgrade this gate.
</HARD-GATE>

If no URL available (dev-only environment): log `INFO: no URL for Lighthouse — run manually before deploy`
If Lighthouse MCP not installed: log `INFO: Lighthouse MCP not available — run lighthouse [url] --output json manually`

### Step 6 — Framework-Specific Checks

**React:**
- `useEffect` without dependency array → runs every render
- Expensive computation directly in render (not wrapped in useMemo)
- Component created inside another component body

**Node.js / Express:**
- `require()` calls inside route handlers (should be top-level)
- Missing connection pool config (default pool size = 1 on some ORMs)
- Synchronous crypto operations (use `crypto.subtle` async API)

**Python / Django:**
- Missing `select_related` / `prefetch_related` on ForeignKey traversal
- `len(queryset)` instead of `queryset.count()` (loads all rows)
- Celery tasks without `bind=True` retried without backoff

**SQL:**
- JOIN without index on join column
- WHERE on non-indexed column in large table
- Cartesian product (missing JOIN condition)

### Step 7 — Benchmark Execution

If project has benchmark scripts (detected via `package.json` scripts, `Makefile`, or `pytest-benchmark`):
- Invoke `verification` to run them
- Compare output to baseline if `.perf-baseline.json` exists

If no benchmarks configured: log `INFO: no benchmark scripts found — skipping`

### Step 8 — Report

Emit structured report:

```
## Perf Report: [scope]

### BLOCK (must fix before merge)
- [FINDING_TYPE] [file:line] — [description] — estimated impact: [Xms|X% bundle|X queries]

### WARN (should fix)
- [FINDING_TYPE] [file:line] — [description] — estimated impact: [...]

### PASS
- DB query patterns: clean
- Async/sync violations: none
- [etc.]

### Lighthouse (if ran)
- Performance: [score] [PASS|WARN|BLOCK]
- Accessibility: [score] [PASS|WARN|BLOCK]
- Best Practices: [score] [PASS|WARN]
- SEO: [score] [PASS|WARN]
- LCP: [Xs] [PASS|WARN|BLOCK] | INP: [Xms] [PASS|WARN|BLOCK] | CLS: [X] [PASS|WARN|BLOCK]

### Verdict: PASS | WARN | BLOCK
```

## Output Format

```
## Perf Report: src/api/users.ts, src/db/queries.ts

### BLOCK
- N+1_QUERY src/db/queries.ts:47 — loop over users with Order.find() inside — fix: use JOIN or prefetch — estimated: +200ms per 100 users

### WARN
- SYNC_IN_ASYNC src/api/users.ts:23 — readFileSync in async handler — fix: fs.promises.readFile

### PASS
- Memory leak patterns: clean
- Bundle analysis: N/A (backend project)

### Verdict: BLOCK
```

## Constraints

1. MUST cite file:line for every finding — "might be slow" without evidence is not a finding
2. MUST include estimated impact — impact-free findings are noise
3. MUST NOT fix code — perf investigates only, never edits files
4. MUST distinguish BLOCK (blocks merge) from WARN (should fix but doesn't block)
5. MUST run framework-specific checks for detected framework — not just generic patterns

## Mesh Gates (L1/L2 only)

| Gate | Requires | If Missing |
|------|----------|------------|
| Scope Gate | File list or scout result before scanning | Invoke scout to identify hotpath files |
| Evidence Gate | file:line + estimated impact for every BLOCK finding | Downgrade to WARN or remove finding |
| Framework Gate | Framework detected before framework-specific checks | Fall back to generic patterns only |

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| BLOCK finding without impact estimate | HIGH | Every BLOCK needs "estimated impact: X" — evidence gate enforces this |
| False N+1 on intentional batched loops | MEDIUM | Check if loop has a `batch_size` limiter or is already prefetched upstream |
| Skipping framework checks because framework not detected | MEDIUM | If scout returns unknown framework, run generic checks + note in report |
| Calling browser-pilot on backend-only project | LOW | Check project type in Step 1 — browser-pilot only for frontend/fullstack |
| Reporting WARN as BLOCK (severity inflation) | MEDIUM | BLOCK = measurable regression on hot path; WARN = pattern that could be slow |

## Done When

- All in-scope files analyzed for DB patterns, async/sync violations, memory leaks
- Framework-specific checks applied for detected framework
- Every finding has file:line + estimated impact
- Bundle analysis ran (frontend) or skipped with reason (backend)
- Benchmark scripts ran (if configured) or INFO: skipped
- Perf Report emitted with PASS/WARN/BLOCK verdict

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| Perf Report with verdict | Markdown (PASS/WARN/BLOCK) | inline |
| Per-finding details | Structured list (file:line + impact) | inline |
| Lighthouse scores (if ran) | Score table | inline |
| Framework-specific findings | Categorized list | inline |

## Cost Profile

~3000-8000 tokens input, ~500-1500 tokens output. Sonnet for pattern recognition.

**Scope guardrail:** perf investigates and reports only — it does not fix code. All fixes are delegated to `fix` (L2) after the report is reviewed.
