# team — Monorepo awareness

> Reference for `skills/team/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Monorepo Awareness

When the project is a monorepo (signals: `pnpm-workspace.yaml`, `turbo.json`, `nx.json`, or `packages/` directory with multiple `package.json`):

**Stream assignment rules for monorepos:**
- Assign streams by **package boundary**, not by file type — one stream per package (e.g., Stream A = `packages/api`, Stream B = `packages/web`)
- Cross-package changes (e.g., shared types in `packages/core` consumed by both api + web) must be in a **dependency stream** that completes before consumer streams start
- Use `turbo run test --filter=...[HEAD^1]` in Phase 5 (VERIFY) to test only affected packages — do NOT run the full test suite when only 1 package changed

**Dependency stream pattern for cross-package changes:**

```
Stream A (depends_on: []): packages/core — shared types + utilities
Stream B (depends_on: ["A"]): packages/api — consumes updated core types
Stream C (depends_on: ["A"]): packages/web — consumes updated core types
B and C run in parallel after A completes.
```
