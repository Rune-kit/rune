# Feature Map

Living document that grows with each plan invocation. Provides bird's-eye view of all features, their dependencies, and detected gaps.

## Location

`.rune/features.md` — auto-created on first plan run, updated on every subsequent run.

## Format

```markdown
# Feature Map
<!-- Auto-maintained by rune:plan. Do not edit manually. -->
<!-- Last updated: YYYY-MM-DD -->

## Features

| Feature | Status | Depends On | Consumed By | Key Files | Gaps |
|---------|--------|-----------|-------------|-----------|------|
| Auth | ✅ | Database, Email | Dashboard, API | src/auth/* | No 2FA |
| Dashboard | 🔄 70% | Auth, Analytics | — | src/dashboard/* | No export |

## Dependency Graph

<!-- ASCII or mermaid — keep under 20 lines -->
Auth ──→ Dashboard
  │         ↑
  └──→ API ─┘
Database ──→ Auth

## Detected Gaps

- [ ] Auth → Payments: dependency missing (payments needs auth but not wired)
- [ ] Dashboard depends on Analytics but Analytics not in feature map
- [ ] Email: single consumer — fragile if auth changes notification strategy

## Signals

- [ ] Feature X emits event.Y but no feature listens
- [ ] Feature Z listens for event.W but no feature emits it
```

## Feature Detection (First Run)

When `.rune/features.md` does not exist, reverse-engineer from codebase:

1. **Read scout output** — directory structure, modules, entry points
2. **Identify features** — each top-level module or bounded context = 1 feature
3. **Map dependencies** — imports between modules, shared types, API calls
4. **Assess status** — has tests? has docs? complete or partial?
5. **Write `.rune/features.md`** with detected features

Detection heuristics:
- `src/<name>/` or `app/<name>/` directories → likely features
- Route files (pages/, routes/, api/) → user-facing features
- Shared directories (utils/, lib/, shared/) → NOT features, but dependencies
- Package.json workspaces → monorepo features

## Feature Update (Subsequent Runs)

When `.rune/features.md` exists, update incrementally:

1. **Read existing map** — current features, deps, gaps
2. **Check new feature** — does the feature being planned already exist in map?
   - Yes → update status, deps, gaps
   - No → add new row
3. **Cross-reference** — does new feature create/resolve any gaps?
   - New dependency on existing feature → add to Depends On
   - New feature fills a gap → mark gap resolved
   - New feature creates orphan → add to Detected Gaps
4. **Write updated `.rune/features.md`**

## Gap Detection Rules

| Pattern | Gap Type | Severity |
|---------|----------|----------|
| Feature A depends on B, but B not in map | Missing feature | HIGH |
| Feature A has no consumers (nothing depends on it) | Orphan feature | MEDIUM |
| Feature A emits signal but nothing listens | Dead signal | MEDIUM |
| Feature A listens for signal but nothing emits | Missing producer | HIGH |
| Two features both write to same data store | Write conflict | HIGH |
| Feature has no tests | Quality gap | MEDIUM |
| Feature depends on deprecated module | Tech debt | LOW |
| Circular dependency: A → B → A | Coupling issue | HIGH |
