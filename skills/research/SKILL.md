---
name: research
description: Web search and external knowledge lookup. Gathers data on technologies, libraries, best practices, and competitor solutions.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L3
  model: haiku
  group: knowledge
---

# research

## Purpose

Web search and external knowledge lookup. Research gathers data on technologies, libraries, best practices, and competitor solutions. Called by planning and creative skills when internal knowledge is insufficient.

## Triggers

- Called by L2 skills needing external information
- Auto-trigger: when task involves unfamiliar technology

## Calls (outbound)

None — pure L3 utility using WebSearch and WebFetch tools.

## Called By (inbound)

- `plan` (L2): external knowledge for architecture decisions
- `brainstorm` (L2): data for informed ideation
- `marketing` (L2): competitor analysis, SEO data
- `hallucination-guard` (L3): verify package existence on npm/pypi
- `autopsy` (L2): research best practices for legacy patterns

## Workflow

1. **Parse query** — understand what information is needed
2. **Search** — web search for relevant results
3. **Extract** — pull key findings, code examples, documentation links
4. **Summarize** — structured output for calling skill

## Output Format

```
## Research Results: [Query]
- **Sources**: [count]

### Key Findings
- [finding with source link]

### Code Examples
- [relevant snippet if applicable]

### Recommendations
- [suggestion based on findings]
```

## Cost Profile

~300-800 tokens input, ~200-500 tokens output. Haiku. Fast and cheap.
