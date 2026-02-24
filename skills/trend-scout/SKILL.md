---
name: trend-scout
description: Scan market trends, competitor activity, and emerging patterns. Monitors Product Hunt, GitHub Trending, HackerNews, and social platforms.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L3
  model: haiku
  group: knowledge
---

# trend-scout

## Purpose

Scan market trends, competitor activity, and emerging technology patterns. Monitors Product Hunt, GitHub Trending, HackerNews, X/Twitter, and Google Trends for product-oriented intelligence.

## Triggers

- Called by creative and marketing skills needing market context

## Calls (outbound)

None — pure L3 utility using WebSearch tools.

## Called By (inbound)

- `brainstorm` (L2): market context for product ideation
- `marketing` (L2): trend data for positioning and content
- `plan` (L2): technology trend validation
- `autopsy` (L2): identify if tech stack is outdated
- `autopsy` (L2): check if legacy tech is still maintained

## Workflow

1. **Define scope** — topic, market segment, timeframe
2. **Scan sources** — Product Hunt, GitHub Trending, HN, social platforms
3. **Analyze** — identify patterns, rising technologies, competitor moves
4. **Report** — structured trend analysis

## Output Format

```
## Trend Report: [Topic]
- **Period**: [timeframe]

### Trending
- [trend with evidence and source]

### Competitors
- [competitor activity]

### Emerging Patterns
- [pattern with implications]
```

## Cost Profile

~300-600 tokens input, ~200-400 tokens output. Haiku.
