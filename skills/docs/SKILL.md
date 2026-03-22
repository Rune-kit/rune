---
name: docs
description: Auto-generate and maintain project documentation. Creates README, API docs, architecture docs, changelogs, and keeps them in sync with code changes. The "docs are never outdated" skill.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L2
  model: sonnet
  group: delivery
  tools: "Read, Write, Edit, Glob, Grep"
---

# docs

## Purpose

Documentation lifecycle manager. Generates initial project documentation, keeps docs in sync with code changes, produces API references, and auto-generates changelogs. Solves the #1 documentation problem: docs that exist but are outdated.

<HARD-GATE>
Docs MUST be generated from actual code, not invented. Every statement in generated docs must be traceable to a specific file, function, or configuration in the codebase. If code doesn't exist yet, docs describe the PLAN, not the implementation.
</HARD-GATE>

## Triggers

- Called by `scaffold` Phase 7 for initial documentation generation
- Called by `cook` post-Phase 7 to update docs after feature implementation
- Called by `launch` pre-deploy to ensure docs are current
- `/rune docs init` — first-time documentation generation
- `/rune docs update` — sync docs with recent code changes
- `/rune docs api` — generate API documentation
- `/rune docs changelog` — auto-generate changelog from git history

## Calls (outbound)

- `scout` (L2): scan codebase for documentation targets (routes, exports, components, configs)
- `doc-processor` (L3): generate PDF/DOCX exports if requested
- `git` (L3): read commit history for changelog generation

## Called By (inbound)

- `scaffold` (L1): Phase 7 — generate initial docs for new project
- `cook` (L1): post-implementation — update docs for changed modules
- `launch` (L1): pre-deploy — verify docs are current
- `mcp-builder` (L2): generate MCP server documentation
- User: `/rune docs` direct invocation

## Modes

### Init Mode — `/rune docs init`

First-time documentation generation for a project.

### Update Mode — `/rune docs update`

Incremental sync — update only docs affected by recent code changes.

### API Mode — `/rune docs api`

Generate or update API documentation specifically.

### Changelog Mode — `/rune docs changelog`

Auto-generate changelog from git commit history.

## Executable Steps

### Init Mode

#### Step 1 — Scan Codebase

Invoke `rune:scout` to extract:
- Project name, description, tech stack
- Directory structure and key files
- Entry points (main, index, app)
- Public API surface (exports, routes, components)
- Configuration files (.env.example, config patterns)
- Existing docs (if any — merge, don't overwrite)

#### Step 2 — Generate README.md

Structure:
```markdown
# [Project Name]
[One-line description]

## Quick Start
[3-5 commands to get running: install, configure, start]

## Features
[Bullet list extracted from code — routes, components, capabilities]

## Tech Stack
[Detected from package.json, requirements.txt, Cargo.toml, etc.]

## Project Structure
[Key directories with one-line descriptions]

## Configuration
[Environment variables from .env.example with descriptions]

## Development
[Dev server, test, lint, build commands]

## API Reference
[Link to API.md if applicable, or inline summary]

## License
[Detected from LICENSE file or package.json]
```

#### Step 3 — Generate ARCHITECTURE.md (if project has 10+ files)

Structure:
```markdown
# Architecture

## Overview
[System diagram in text/mermaid — components and data flow]

## Key Decisions
[Detected patterns: framework choice, state management, DB, auth approach]

## Module Map
[Each top-level directory: purpose, key files, dependencies]

## Data Flow
[Request lifecycle or data pipeline description]
```

#### Step 4 — Generate API.md (if routes/endpoints detected)

Scan route files and extract:
- HTTP method + path
- Request parameters (path, query, body)
- Response shape
- Authentication requirements
- Error responses

Format as markdown table or OpenAPI-compatible reference.

#### Step 5 — Report

Present generated docs to user with summary:
- Files generated: [list]
- Coverage: [what's documented vs what exists]
- Gaps: [code areas without docs — suggest next steps]

### Update Mode

#### Step 1 — Detect Changes

Read `git diff` since last docs update (tracked via git log on doc files or `.rune/docs-sync.json`).

Identify:
- New files/modules → need new doc sections
- Changed functions/routes → need doc updates
- Deleted code → need doc removal
- New configuration → need config doc update

#### Step 2 — Update Affected Sections

For each changed area:
1. Read the changed code
2. Find corresponding doc section
3. Update doc to match current code
4. If doc section doesn't exist → create it
5. If code was deleted → remove or mark as deprecated in docs

<HARD-GATE>
Never silently remove doc content. If code was deleted, mark the doc section as "Removed in [commit]" or ask user before deleting the doc section.
</HARD-GATE>

#### Step 3 — Generate Changelog Entry

Delegate to `rune:git changelog` to produce a changelog entry from commits since last docs update.

#### Step 4 — Report

Show user: what was updated, what was added, what was flagged for review.

### API Mode

#### Step 1 — Detect API Framework

| Framework | Route Pattern | File Pattern |
|-----------|--------------|--------------|
| Express | `router.get/post/put/delete` | `routes/*.ts`, `*.router.ts` |
| FastAPI | `@app.get/post/put/delete` | `routers/*.py`, `main.py` |
| NestJS | `@Get/@Post/@Put/@Delete` | `*.controller.ts` |
| Next.js App | `export async function GET/POST` | `app/**/route.ts` |
| Next.js Pages | `export default function handler` | `pages/api/**/*.ts` |
| SvelteKit | `export function GET/POST` | `src/routes/**/+server.ts` |
| Hono | `app.get/post/put/delete` | `src/*.ts` |

#### Step 2 — Extract Endpoints

For each detected route:
- Method (GET, POST, PUT, DELETE, PATCH)
- Path (with parameters highlighted)
- Request: params, query, body shape (from Zod schemas, TypeScript types, Pydantic models)
- Response: shape (from return type or response helper)
- Auth: required? (detect middleware like `authMiddleware`, `@UseGuards`)
- Description: from JSDoc/docstring if available

#### Step 3 — Generate API Reference

Format as markdown:
```markdown
# API Reference

## Authentication
[Auth mechanism description]

## Endpoints

### `POST /api/auth/login`
**Description**: Authenticate user and return tokens
**Auth**: None
**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | yes | User email |
| password | string | yes | User password |

**Response** (200):
```json
{ "token": "string", "refreshToken": "string" }
```

**Errors**:
- 401: Invalid credentials
- 422: Validation error
```

#### Step 4 — Output

Save to `docs/API.md` or project-specific location. If OpenAPI requested, generate `openapi.yaml`.

### Changelog Mode

#### Step 1 — Delegate to Git

Invoke `rune:git changelog` to group commits by type and format as Keep a Changelog.

#### Step 2 — Enhance

Add context to raw changelog:
- Link PR numbers to actual descriptions
- Group related changes under feature headers
- Highlight breaking changes prominently

#### Step 3 — Output

Append to or update `CHANGELOG.md`.

## Output Format

### Init Mode Output
Files generated in project root:
- `README.md` — Quick Start, Features, Tech Stack, Structure, Config, Dev Commands
- `ARCHITECTURE.md` — Overview diagram, Key Decisions, Module Map, Data Flow (if 10+ files)
- `docs/API.md` — Endpoint reference with method, path, params, response, auth (if routes detected)

### Update Mode Output
Modified doc sections with change summary:
```
Docs Update Report:
- Updated: [list of doc sections modified]
- Added: [new sections for new code]
- Flagged: [stale sections referencing deleted code]
- Changelog: [entry appended to CHANGELOG.md]
```

### API Mode Output
`docs/API.md` — markdown reference per endpoint:
```
### `METHOD /path/:param`
**Description**: [from JSDoc/docstring]
**Auth**: [required/none]
**Request**: [params, query, body table]
**Response**: [shape with status codes]
**Errors**: [error codes and descriptions]
```

### Changelog Mode Output
`CHANGELOG.md` — Keep a Changelog format grouped by: Added, Fixed, Changed, Removed.

## Constraints

1. MUST generate docs from actual code — never invent features or APIs that don't exist
2. MUST preserve existing docs — update sections, don't overwrite entire files
3. MUST detect doc staleness — flag sections that reference deleted/changed code
4. MUST include Quick Start in every README — users need to get running in < 2 minutes
5. MUST NOT generate docs for code that doesn't exist yet (unless explicitly creating spec docs)
6. API docs MUST match actual route signatures — wrong API docs are worse than no docs

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| README.md | Markdown | project root |
| ARCHITECTURE.md | Markdown | project root (if 10+ files) |
| API reference | Markdown | `docs/API.md` |
| Changelog entry | Markdown (Keep a Changelog) | `CHANGELOG.md` |
| Docs update report | Markdown | inline (chat output) |

**Scope guardrail:** Documents only what exists in the codebase — never invents features, endpoints, or APIs.

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Inventing API endpoints that don't exist | CRITICAL | Constraint 1: scan actual route files, not guess |
| Overwriting user-written README sections | HIGH | Constraint 2: merge, don't overwrite — detect custom sections |
| Stale docs after code changes | HIGH | Update mode detects diffs and updates affected sections |
| API docs with wrong request/response shapes | HIGH | Extract from Zod/Pydantic/TypeScript types, not from memory |
| Missing Quick Start section | MEDIUM | Constraint 4: every README has Quick Start |
| Changelog with orphan PR links | LOW | Validate PR numbers exist before linking |

## Done When

### Init Mode
- Codebase scanned with scout
- README.md generated with Quick Start, Features, Tech Stack, Structure
- ARCHITECTURE.md generated (if 10+ files)
- API.md generated (if routes detected)
- Coverage report presented to user

### Update Mode
- Changes since last doc update detected
- Affected doc sections updated
- Changelog entry generated
- Update report presented to user

### API Mode
- API framework detected
- All endpoints extracted with method, path, request, response
- API reference generated in markdown
- Saved to docs/API.md

### Changelog Mode
- Commits grouped by type
- Formatted as Keep a Changelog
- CHANGELOG.md updated

## Cost Profile

~2000-5000 tokens input, ~1000-3000 tokens output. Sonnet — documentation requires understanding code patterns but not deep architectural reasoning.
