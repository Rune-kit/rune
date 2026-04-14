---
name: docs-seeker
description: Find documentation for APIs, libraries, and error messages. Looks up official docs, changelog entries, and migration guides.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L3
  model: haiku
  group: knowledge
  tools: "Read, Glob, Grep, WebFetch, WebSearch"
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
- `adversary` (L2): verify framework/API assumptions in plan are correct

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

### Step 2 — Try Context7 MCP (fastest)

Attempt Context7 MCP lookup first (faster, higher quality):

1. Call `mcp__plugin_context7_context7__resolve-library-id` with the library name and query
2. Select the best matching library ID from results (prioritize: name match, source reputation, snippet count)
3. Call `mcp__plugin_context7_context7__query-docs` with the resolved library ID and the specific query
4. If Context7 returns a satisfactory answer with code examples, proceed to Step 5

### Step 3 — Try llms.txt Discovery

If Context7 MCP is unavailable or insufficient, try llms.txt (AI-optimized documentation):

**For GitHub repos** — pattern: `https://context7.com/{org}/{repo}/llms.txt`
```
github.com/vercel/next.js    → context7.com/vercel/next.js/llms.txt
github.com/shadcn-ui/ui      → context7.com/shadcn-ui/ui/llms.txt
```

**For doc sites** — pattern: `https://context7.com/websites/{normalized-domain}/llms.txt`
```
docs.imgix.com               → context7.com/websites/imgix/llms.txt
ffmpeg.org/doxygen/8.0        → context7.com/websites/ffmpeg_doxygen_8_0/llms.txt
```

**Topic-specific** — append `?topic={query}` for focused results:
```
context7.com/shadcn-ui/ui/llms.txt?topic=date-picker
context7.com/vercel/next.js/llms.txt?topic=cache
```

**Traditional llms.txt fallback**: `WebSearch "[library] llms.txt"` → common paths: `docs.[lib].com/llms.txt`, `[lib].dev/llms.txt`

Use `WebFetch` on the resolved llms.txt URL. If it contains multiple section URLs (3+), launch parallel Explorer agents (one per section, max 5).

### Step 4 — Fallback to Web Search

If neither Context7 nor llms.txt available:

1. Use `WebSearch` with queries:
   - "[library] [api/method] official documentation"
   - "[library] [version] [query]"
   - "[error message] [library] fix"
2. Identify official documentation URLs (docs.*, official GitHub, npm/pypi pages)
3. Call `WebFetch` on the top 1-3 official sources

**Repository analysis fallback** (when docs are sparse but code is available):
```bash
npx repomix --output /tmp/repomix-output.xml   # in the cloned repo
```
Read the repomix output to extract API patterns, usage examples, and internal documentation.

### Step 5 — Extract Answer

From Context7, llms.txt, or fetched pages, extract:
- Exact API signature with parameter types and return type
- Minimal working code example
- Version-specific notes (deprecated in X, changed in Y)
- Known issues or common pitfalls mentioned in docs

### Step 6 — Report

Return structured documentation in the output format below.

## Constraints

- Prefer Context7 MCP → llms.txt → WebSearch (in that priority order)
- Only fall back to web if Context7 and llms.txt both lack coverage
- Use `?topic=` parameter on llms.txt URLs for targeted results
- Always include source URL so callers can verify
- If the API is deprecated, say so explicitly and link to the replacement
- For parallel fetching: 1-3 URLs = single agent, 4-10 = 3-5 Explorer agents, 11+ = 5-7 agents

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
| Skipping Context7 and going directly to web search | MEDIUM | Constraint: Context7 MCP → llms.txt → WebSearch — follow the priority chain |
| Not using ?topic= on llms.txt for focused queries | LOW | Topic parameter dramatically reduces noise — always append when query is specific |
| Returning docs without source URL | MEDIUM | Constraint: always include source URL so callers can verify |

## Done When

- Context7 attempted first (resolve-library-id + query-docs)
- If Context7 insufficient: top 1-3 official doc URLs fetched via WebFetch
- API signature extracted with parameter types and return type
- Minimal working code example included
- Deprecation/version notes included if applicable
- Source URL provided
- Documentation emitted in output format

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| API reference (signature + params) | Markdown | inline |
| Minimal working code example | Code block | inline |
| Deprecation / version notes | Markdown | inline |
| Source URL | Plain text | inline |

## Cost Profile

~300-600 tokens input, ~200-400 tokens output. Haiku. Fast lookup.

**Scope guardrail:** docs-seeker looks up documentation only — it does not apply changes, write code, or interpret whether the API fits the caller's use case.
