---
name: research
description: Web search and external knowledge lookup. Gathers data on technologies, libraries, best practices, and competitor solutions.
metadata:
  author: runedev
  version: "0.4.0"
  layer: L3
  model: haiku
  group: knowledge
  tools: "Read, Glob, Grep, WebFetch, WebSearch"
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

### Step 2 — Search (Minimum 3 Complementary Sources)

<HARD-GATE>
Every research conclusion MUST be backed by at minimum 3 complementary sources from DIFFERENT source types.
Single-source conclusions are flagged as `low` confidence regardless of source authority.
</HARD-GATE>

Call `WebSearch` for each query. Collect result titles, URLs, and snippets. Identify the top 3-5 most relevant URLs prioritizing **source diversity**:

| Source Type | Examples | Why |
|-------------|----------|-----|
| **Official docs** | Framework docs, API reference, RFC | Authoritative but may lag behind reality |
| **Community** | Stack Overflow, GitHub Issues, Reddit | Real-world pain points, edge cases |
| **Technical blogs** | Dev.to, Medium engineering blogs, personal blogs | Practical experience, tutorials |
| **Repositories** | GitHub repos, npm packages, example code | Working implementations |

**Selection rules:**
- Source authority (official docs > major blogs > personal blogs)
- Recency (prefer 2025-2026)
- Relevance to the query
- **Diversity: never select 3+ URLs from the same domain** — spread across source types


### Step 2b — Diminishing Returns Detection

After each WebSearch call, evaluate whether additional searches are productive:

**Track across search results**:
- **Entity set**: Extract key entities from each result set (library names, API names, version numbers, technique names, company names)
- **New entity ratio**: `new_entities_in_this_search / total_entities_found_so_far`
- **Result overlap**: How many URLs from this search were already seen in previous searches

| Signal | Threshold | Action |
|--------|-----------|--------|
| New entity ratio < 10% | Last search added almost nothing new | Skip remaining queries, proceed to Step 3 with existing results |
| Result overlap > 60% | Most URLs already fetched or seen | Skip this query's results entirely |
| All 3 queries return same top 3 URLs | Search space is exhausted | Proceed directly to Step 3 — more queries won't help |

**Report when triggered**:
```
Note: Research saturation reached after [N] searches — [M] unique entities found.
Additional queries showed <10% new information. Proceeding with synthesis.
```

**Why**: Research skills commonly waste 2-3 WebFetch calls on pages that repeat information already gathered. Saturation detection saves tool calls and context tokens while preserving research quality — the first 3 sources typically contain 90%+ of available information.

### Step 3 — Deep Dive

Call `WebFetch` on the top 3-5 URLs identified in Step 2. Hard limit: **max 5 WebFetch calls** per research invocation. For each fetched page:
- Extract key facts, API signatures, code examples
- Note the source URL and publication date if visible
- Tag the source type (official/community/blog/repo) for Step 4 triangulation

### Step 4 — Synthesize (Triangulation)

Across all fetched content, **triangulate** — don't just aggregate:
- Identify points of consensus across sources (≥3 sources = strong signal)
- Flag any conflicting information explicitly (e.g., "Source A says X, Source B says Y")
- Check if conflicts are temporal (old vs new info) or genuine disagreement
- Assign confidence using source diversity:

| Confidence | Criteria |
|------------|----------|
| `high` | 3+ sources from different types agree |
| `medium` | 2 sources agree, or 3+ from same type |
| `low` | Single source, or sources conflict without resolution |
| `unverified` | No sources found — report this explicitly, NEVER fabricate |

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
| Single-source conclusions presented as fact | HIGH | HARD-GATE: minimum 3 complementary sources from different source types. Single source = `low` confidence |
| All sources from same domain (e.g., 3 Stack Overflow links) | MEDIUM | Source diversity rule: never 3+ URLs from the same domain. Spread across official/community/blog/repo |

## Done When

- 2-3 search queries formulated and executed
- Top 3-5 URLs identified and fetched (max 5 WebFetch calls)
- Conflicting information between sources explicitly flagged
- Confidence level assigned (high/medium/low) with rationale
- Research Results emitted with source URLs for every key finding

## Cost Profile

~300-800 tokens input, ~200-500 tokens output. Haiku. Fast and cheap.
