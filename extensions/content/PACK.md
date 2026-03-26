---
name: "@rune/content"
description: Content platform patterns — blog systems, CMS integration, MDX authoring, internationalization, SEO, video repurposing pipelines, and content scoring.
metadata:
  author: runedev
  version: "0.3.0"
  layer: L4
  price: "$9"
  target: Content creators
  format: split
---

# @rune/content

## Purpose

Content-driven sites break in ways that don't show up until production: blog pages that return 404 after a CMS slug change, MDX files that crash the build when a custom component is missing, translations that show raw keys because the fallback chain is misconfigured, and pages that rank poorly because structured data is malformed or canonical URLs point to the wrong locale. This pack covers the full content stack — authoring, management, localization, discovery, performance, and analytics — with patterns that keep content sites correct, fast, and findable.

## Triggers

- Auto-trigger: when `contentlayer`, `@sanity`, `contentful`, `strapi`, `mdx`, `next-intl`, `i18next`, `*.mdx` detected
- `/rune blog-patterns` — build or audit blog architecture
- `/rune cms-integration` — set up or audit headless CMS
- `/rune mdx-authoring` — configure MDX pipeline with custom components
- `/rune i18n` — implement or audit internationalization
- `/rune seo-patterns` — audit SEO, structured data, and meta tags
- `/rune video-repurpose` — build long-to-short video repurposing pipeline
- `/rune content-scoring` — implement engagement/virality scoring for content
- Called by `cook` (L1) when content project detected
- Called by `marketing` (L2) when creating blog content

## Skills Included

| Skill | Model | Description |
|-------|-------|-------------|
| [blog-patterns](skills/blog-patterns.md) | sonnet | Post management, RSS, pagination, categories |
| [cms-integration](skills/cms-integration.md) | sonnet | Sanity/Contentful/Strapi, preview, webhooks |
| [mdx-authoring](skills/mdx-authoring.md) | sonnet | Custom components, TOC, syntax highlighting |
| [i18n](skills/i18n.md) | sonnet | Locale routing, translations, hreflang, RTL |
| [seo-patterns](skills/seo-patterns.md) | sonnet | JSON-LD, sitemap, meta tags, Core Web Vitals |
| [video-repurpose](skills/video-repurpose.md) | sonnet | Long→short video pipeline, captions, face-crop |
| [content-scoring](skills/content-scoring.md) | sonnet | Virality scoring, engagement metrics, hook analysis |
| [reference](skills/reference.md) | — | Shared patterns: migration, search, email, perf, analytics, scheduling, a11y, rich media |

## Workflows

| Workflow | Skills Invoked | Trigger |
|----------|----------------|---------|
| New blog from scratch | blog-patterns → mdx-authoring → seo-patterns | `/rune blog-patterns` on empty project |
| CMS migration | cms-integration → seo-patterns → blog-patterns | New CMS detected, old slugs present |
| Launch-ready audit | seo-patterns + blog-patterns + i18n (parallel) | Pre-deploy checklist |
| Multilingual blog | i18n → blog-patterns → seo-patterns | `next-intl` or i18next detected |
| MDX component library | mdx-authoring → blog-patterns | `*.mdx` files without component registry |
| Performance audit | seo-patterns (CWV check) + blog-patterns (images) | LCP > 2.5s detected |
| Search setup | cms-integration + blog-patterns → search integration | Algolia/Meilisearch env vars detected |

## Connections

```
Calls → research (L3): SEO data and competitor analysis
Calls → marketing (L2): content promotion
Calls → @rune/ui (L4): typography system, article layout patterns, palette for content sites
Called By ← cook (L1): when content project detected
Called By ← marketing (L2): when creating blog content
```

| Pack | Connection | When |
|------|-----------|------|
| `@rune/analytics` | Page views, scroll depth, read time events → analytics pipeline | Any content site with tracking |
| `@rune/ui` | Article layout components, image galleries, typography system | Custom component-heavy MDX sites |
| `@rune/saas` | Auth-gated content (members-only posts), subscription paywalls | Premium content model |
| `@rune/ecommerce` | Product-linked blog posts, shoppable content, affiliate links | Commerce + content hybrid sites |

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| CMS slug change breaks all inbound links (404 on old URLs) | HIGH | Implement redirect map in CMS; check for broken links on content publish webhook |
| Missing translation key shows raw key string to users | HIGH | Configure fallback to default locale; run missing key detection in CI |
| MDX build crashes because custom component removed but still referenced | HIGH | Register fallback component that renders warning in dev, empty div in prod |
| Search index out of sync after CMS publish | HIGH | Trigger index update in CMS publish webhook, same endpoint as ISR revalidation |
| Whisper large-v3 halluccinates on audio silence | HIGH | Preprocess audio: detect silence > 2s, split segments, skip silent chunks |
| yt-dlp breaks on YouTube bot detection (HTTP 429) | HIGH | Use browser-mimicking headers, exponential backoff, rotate user agents |
| Sitemap includes draft/unpublished pages | MEDIUM | Filter sitemap to `status === 'published'` only; add `noindex` to draft preview pages |
| `hreflang` tags point to wrong locale | MEDIUM | Generate hreflang from route params, not hardcoded; test with hreflang validator |

## Done When

- Blog architecture set up with pagination, RSS feed, and canonical URLs all resolving correctly
- CMS integration live with preview mode, publish webhooks triggering ISR revalidation and search index updates
- All translation keys resolved with fallback locale — no raw keys visible in any locale
- SEO audit passing: valid JSON-LD structured data, complete sitemap (published pages only), and hreflang tags verified

## Cost Profile

~16,000–28,000 tokens per full pack run (all 7 skills). Individual skill: ~2,000–5,000 tokens. Sonnet default. Use haiku for detection scans and alt-text audits; escalate to sonnet for CMS integration, SEO audit, video pipeline, and content scoring.
