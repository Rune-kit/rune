---
name: research
description: Web search and external knowledge lookup. Gathers data on technologies, libraries, best practices, and competitor solutions.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L3
  model: haiku
  group: knowledge
---

# research

## Purpose

Web research utility. Receives a research question, executes targeted searches, deep-dives into top results, and returns structured findings with sources. Stateless — no memory between calls.

## Calls (outbound)

None — pure L3 utility using `WebSearch` and `WebFetch` tools directly.

## Called By (inbound)

- `plan` (L2): external knowledge for architecture decisions
- `brainstorm` (L2): data for informed ideation
- `marketing` (L2): competitor analysis, SEO data
- `hallucination-guard` (L3): verify package existence on npm/pypi
- `autopsy` (L2): research best practices for legacy patterns

## Execution

### Input

```
research_question: string   — what to research
focus: string (optional)    — narrow the scope (e.g., "security", "performance")
```

### Step 1 — Formulate Queries

Generate 2-3 targeted search queries from the research question. Vary phrasing to cover different angles:
- Primary: direct question as search terms
- Secondary: "[topic] best practices 2026" or "[topic] vs alternatives"
- Tertiary: "[topic] example" or "[topic] tutorial" if implementation detail needed

### Step 2 — Search

Call `WebSearch` for each query. Collect result titles, URLs, and snippets. Identify the top 3-5 most relevant URLs based on:
- Source authority (official docs, major blogs, GitHub repos)
- Recency (prefer 2025-2026)
- Relevance to the query

### Step 3 — Deep Dive

Call `WebFetch` on the top 3-5 URLs identified in Step 2. Hard limit: **max 5 WebFetch calls** per research invocation. For each fetched page:
- Extract key facts, API signatures, code examples
- Note the source URL and publication date if visible

### Step 4 — Synthesize

Across all fetched content:
- Identify points of consensus across sources
- Flag any conflicting information explicitly (e.g., "Source A says X, Source B says Y")
- Assign confidence: `high` (3+ sources agree), `medium` (1-2 sources), `low` (single source or unclear)

### Step 5 — Report

Return structured findings in the output format below.

## Constraints

- Always cite source URL for every finding
- Flag conflicting information — never silently pick one side
- Max 5 WebFetch calls per invocation
- If no useful results found, report that explicitly rather than fabricating

## Output Format

```
## Research Results: [Query]
- **Sources fetched**: [n]
- **Confidence**: high | medium | low

### Key Findings
- [finding] — [source URL]
- [finding] — [source URL]

### Conflicts / Caveats
- [Source A] says X. [Source B] says Y. Recommend verifying against [authority].

### Code Examples
```[lang]
[relevant snippet]
```

### Recommendations
- [actionable suggestion based on findings]
```

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Fabricating findings when no useful results found | CRITICAL | Constraint: report "no useful results found" explicitly — never invent citations |
| Reporting conflicting sources without flagging the conflict | HIGH | Constraint: flag conflicting information explicitly, never silently pick one side |
| Assigning "high" confidence from a single source | MEDIUM | High = 3+ sources agree; 1-2 sources = medium confidence |
| Exceeding 5 WebFetch calls per invocation | MEDIUM | Hard limit: prioritize top 3-5 URLs from search, fetch only the most relevant |

## Done When

- 2-3 search queries formulated and executed
- Top 3-5 URLs identified and fetched (max 5 WebFetch calls)
- Conflicting information between sources explicitly flagged
- Confidence level assigned (high/medium/low) with rationale
- Research Results emitted with source URLs for every key finding

## Cost Profile

~300-800 tokens input, ~200-500 tokens output. Haiku. Fast and cheap.
