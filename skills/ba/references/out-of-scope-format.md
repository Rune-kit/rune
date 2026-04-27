# `.out-of-scope/` Knowledge Base — Format & Matching

A persistent record of rejected feature requests so AI agents stop re-litigating the same decision across sessions. Project-scoped, version-controlled, durable.

## Where it lives

```
<repo-root>/
├── .out-of-scope/
│   ├── dark-mode.md
│   ├── plugin-system.md
│   └── graphql-api.md
```

One file per **concept**, not per issue. Multiple incoming requests for the same thing are appended to a single concept file's `prior_requests` list.

## File format

YAML frontmatter (for machine parsing) + Markdown body (for humans).

```markdown
---
concept: dark-mode
aliases: [night-theme, dark-theme, theme-switcher]
decision: rejected
rejected_at: 2026-04-27
rejected_by: review-intake
priority_to_revisit: low      # low | medium | high
prior_requests:
  - id: gh-issue-42
    summary: Add dark mode support
    closed_at: 2025-08-01
  - id: discord-thread-2026-02-14
    summary: Night theme for accessibility
    closed_at: 2026-02-15
conflicts_with: []            # paths to ADRs that this rejection contradicts
revisit_if:
  - "team adds front-end engineer"
  - "user count crosses 50k"
---

# Dark Mode

This project does not support runtime dark mode.

## Why out of scope

[Substantive reasoning — references project scope, technical constraints, or strategic decisions. NOT temporary circumstances ("we're busy now" — that's a deferral, not a rejection).]

The rendering pipeline assumes a single color palette resolved at build time. Adding runtime theming would require:

- A theme context provider wrapping every render
- Per-component theme-aware style resolution
- A persistence layer for user theme preferences

This is a significant architectural change that conflicts with the project's focus on author-time content and downstream-consumer flexibility.

## What would change our mind

- A user paying for theme switcher specifically (revenue signal)
- A team member with deep expertise on theme-aware CSS pipelines
- A platform requirement (e.g., partner integration mandates dark mode)
```

## Frontmatter fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `concept` | string | ✅ | kebab-case slug; matches filename without `.md` |
| `aliases` | string[] | ✅ | Other phrasings of the same concept; used by similarity matcher |
| `decision` | enum | ✅ | `rejected` (only — deferrals do not belong here) |
| `rejected_at` | ISO date | ✅ | When the decision was made |
| `rejected_by` | enum | ✅ | `ba` \| `review-intake` \| `incident` \| `cook` |
| `priority_to_revisit` | enum | optional | `low` \| `medium` \| `high`; default `low` |
| `prior_requests` | object[] | ✅ | At least one entry; appended on every re-request |
| `conflicts_with` | string[] | optional | Paths to ADRs this contradicts (rare, surface for review) |
| `revisit_if` | string[] | optional | Concrete signals that should trigger re-evaluation |

## Slug rules

- kebab-case, lowercase
- max 40 chars
- recognizable without opening the file (`dark-mode` good; `feature-x-v2` bad)
- distinct from existing concepts — if a new slug has ≥0.7 alias overlap with an existing one, the writer MUST prompt: merge or pick distinct slug.

## Concept-similarity matching

When `ba` Step 1.5 runs intake on a new request, it builds a hash-keyed map:

```
Map<lowercased_token, [concept_slugs]>
```

For each `.out-of-scope/*.md` file, it indexes:
- `concept` field tokens (split on `-`)
- `aliases` field tokens
- 1–3-word phrases from the body's title and first paragraph

For incoming request, it tokenizes the same way, computes overlap with each indexed concept, and returns:

| Confidence | Range | Action |
|------------|-------|--------|
| Exact match | ≥0.8 | Surface immediately: "This matches a prior rejection (`<slug>`). Do you still feel the same way?" |
| Similar | 0.5–0.79 | Mention as similar prior decision, offer to read the file together |
| Weak / no match | <0.5 | Ignore (don't pollute conversation with low-confidence matches) |

The matcher is purely lexical — agents do NOT call out to a model to compute similarity. Lexical is fast (~1ms per file), deterministic, and good enough for the ≥0.8 threshold. Domain-specific concept clustering is a future enrichment.

## When to write a new file

Only when:
1. An **enhancement** (not a bug) is rejected as `wontfix` / `out of scope`
2. The reasoning is **durable** (project-scope, technical constraint, strategic decision) — NOT a temporary deferral
3. A future similar request would benefit from finding this record

If the rejection reason is "we're busy this quarter" → that's a deferral, route to a backlog issue, not `.out-of-scope/`.

## When to append to an existing file

When the matcher finds an exact concept match, append to `prior_requests`:

```yaml
prior_requests:
  - id: gh-issue-42
    summary: Add dark mode support
    closed_at: 2025-08-01
  - id: gh-issue-87        # <-- new
    summary: Night theme for accessibility
    closed_at: 2026-02-15  # <-- new
```

Do NOT create a duplicate file. Update the existing one.

## When to delete a file

When the maintainer decides to actually build the rejected feature. The file gets deleted in the same commit that opens the new tracking issue. Historical issues (in `prior_requests`) are not reopened — they're snapshots.

## Conflicts with ADRs

If a rejection contradicts an existing ADR (e.g., ADR says "we use REST" but a request asks for GraphQL and the rejection cites different reasons), populate `conflicts_with: [docs/adr/0007-rest-only.md]`. `audit` later flags this for cross-reference.

## Validation (compiler test)

`compiler/__tests__/out-of-scope-format.test.js` validates:
- Frontmatter parses as YAML
- Required fields present
- `decision == "rejected"`
- `concept` matches filename
- `prior_requests` has ≥1 entry
- Slug rules pass

Failures here block the merge that introduced the broken file.
