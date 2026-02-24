---
name: docs-seeker
description: Find documentation for APIs, libraries, and error messages. Looks up official docs, changelog entries, and migration guides.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L3
  model: haiku
  group: knowledge
---

# docs-seeker

## Purpose

Documentation lookup utility. Receives a library name, API reference, or error message, resolves the correct documentation, and returns API signatures, usage examples, and known issues. Stateless — no memory between calls.

## Calls (outbound)

None — pure L3 utility using `WebSearch`, `WebFetch`, and Context7 MCP tools directly.

## Called By (inbound)

- `debug` (L2): lookup API docs for unclear errors
- `fix` (L2): check correct API usage before applying changes
- `review` (L2): verify API usage is current and correct

## Execution

### Input

```
target: string         — library name, API endpoint, or error message
version: string        — (optional) specific version to look up
query: string          — specific question about the target (e.g., "how to configure retry")
```

### Step 1 — Identify Target

Parse the input to extract:
- Library or framework name (e.g., "react-query", "fastapi", "prisma")
- Version if specified
- The specific API, method, or error to look up

### Step 2 — Try Context7

Attempt Context7 MCP lookup first (faster, higher quality):

1. Call `mcp__plugin_context7_context7__resolve-library-id` with the library name and query
2. Select the best matching library ID from results (prioritize: name match, source reputation, snippet count)
3. Call `mcp__plugin_context7_context7__query-docs` with the resolved library ID and the specific query
4. If Context7 returns a satisfactory answer with code examples, proceed to Step 5

### Step 3 — Fallback to Web

If Context7 does not have the library or the answer is insufficient:

1. Use `WebSearch` with queries:
   - "[library] [api/method] official documentation"
   - "[library] [version] [query]"
   - "[error message] [library] fix"
2. Identify official documentation URLs (docs.*, official GitHub, npm/pypi pages)
3. Call `WebFetch` on the top 1-3 official sources

### Step 4 — Extract Answer

From Context7 or fetched pages, extract:
- Exact API signature with parameter types and return type
- Minimal working code example
- Version-specific notes (deprecated in X, changed in Y)
- Known issues or common pitfalls mentioned in docs

### Step 5 — Report

Return structured documentation in the output format below.

## Constraints

- Prefer Context7 over WebSearch — it provides curated, version-aware docs
- Only fall back to web if Context7 lacks coverage
- Always include source URL so callers can verify
- If the API is deprecated, say so explicitly and link to the replacement

## Output Format

```
## Documentation: [Library/API]
- **Version**: [detected or "latest"]
- **Source**: [official docs URL or "Context7"]

### API Reference
- **Signature**: `functionName(param1: Type, param2: Type): ReturnType`
- **Parameters**:
  - `param1` — description
  - `param2` — description
- **Returns**: description

### Usage Example
```[lang]
[minimal working code snippet from official docs]
```

### Known Issues / Deprecations
- [relevant warning, deprecation notice, or common mistake]
```

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Returning deprecated API without flagging it | HIGH | Must explicitly state "deprecated in X.Y, use Z instead" with replacement link |
| Wrong version docs returned when version specified | HIGH | Verify version match — if version-specific docs unavailable, state that explicitly |
| Skipping Context7 and going directly to web search | MEDIUM | Constraint: Context7 first always — web is fallback, not default |
| Returning docs without source URL | MEDIUM | Constraint: always include source URL so callers can verify |

## Done When

- Context7 attempted first (resolve-library-id + query-docs)
- If Context7 insufficient: top 1-3 official doc URLs fetched via WebFetch
- API signature extracted with parameter types and return type
- Minimal working code example included
- Deprecation/version notes included if applicable
- Source URL provided
- Documentation emitted in output format

## Cost Profile

~300-600 tokens input, ~200-400 tokens output. Haiku. Fast lookup.
