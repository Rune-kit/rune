---
name: marketing
description: Create marketing assets and execute launch strategy. Generates landing copy, social banners, SEO meta, blog posts, and video scripts.
metadata:
  author: runedev
  version: "0.4.0"
  layer: L2
  model: sonnet
  group: delivery
  tools: "Read, Write, Edit, Glob, Grep, WebFetch, WebSearch"
---

# marketing

## Purpose

Create marketing assets and execute launch strategy. Marketing generates landing page copy, social media banners, SEO metadata, blog posts, and video scripts. Analyzes the project to create authentic, data-driven marketing content.

## Called By (inbound)

- `launch` (L1): Phase 4 MARKET — marketing phase of launch pipeline
- User: `/rune marketing` direct invocation

## Calls (outbound)

- `scout` (L2): scan codebase for features, README, value props
- `trend-scout` (L3): market trends, competitor positioning
- `research` (L3): competitor analysis, SEO keyword data
- `asset-creator` (L3): generate OG images, social cards, banners
- `video-creator` (L3): create demo/explainer video plan
- `slides` (L3): generate presentation decks for launches and demos
- `doc-processor` (L3): export marketing deliverables as PDF/DOCX (press kits, one-pagers, sponsor decks)
- `browser-pilot` (L3): capture screenshots for marketing assets
- L4 extension packs: domain-specific content when context matches (e.g., @rune/content for blog posts, @rune/analytics for campaign measurement)
- `@rune-pro/growth/content-scorer` (L4 Pro, optional): 5-dimension content quality gate — if available, score all generated copy for AI phrase contamination and humanity
- `@rune-pro/growth/cro-analyst` (L4 Pro, optional): psychology-driven CRO analysis for landing pages — if available, audit generated landing copy through 7 behavioral lenses

## Execution Steps

### Step 1 — Understand the product

Call `rune:scout` to scan the codebase. Ask scout to extract:
- Feature list (what the product actually does)
- README summary
- Target audience signals (from code, comments, config)
- Tech stack (relevant for developer marketing)

Read any existing `marketing/`, `docs/`, or `landing/` directories if present.

### Step 2 — Research market

Call `rune:trend-scout` with the product category to identify:
- Top 3 competitors and their positioning
- Current market trends relevant to this product
- Differentiators to emphasize

Call `rune:research` for:
- SEO keyword opportunities (volume vs. competition)
- Competitor messaging patterns to avoid or counter

### Step 2.5 — Establish Brand Voice

Before generating any copy, define the brand voice contract. This prevents inconsistent tone across marketing assets.

**Brand Voice Matrix** — answer these for the product:

| Dimension | Spectrum | This product |
|-----------|----------|--------------|
| Formality | Casual ←→ Formal | [position] |
| Humor | Serious ←→ Playful | [position] |
| Authority | Peer ←→ Expert | [position] |
| Warmth | Clinical ←→ Friendly | [position] |
| Urgency | Patient ←→ Urgent | [position] |

**Voice rules** (generate 3-5):
- "We say [X], never [Y]" — e.g., "We say 'start free', never 'sign up now'"
- "Our tone is [X] because our users are [Y]"
- "Avoid [specific words/phrases] because [reason]"

**Vocabulary list** (5-10 terms):
- Preferred terms: [words this brand uses]
- Forbidden terms: [words to avoid and why]
- Jargon policy: [use/avoid/explain technical terms]

Save voice contract to `marketing/brand-voice.md`. All subsequent copy MUST follow this voice.

If `marketing/brand-voice.md` already exists → Read it and apply. Do NOT regenerate without user request.

### Step 3 — Generate copy

Using product understanding, market research, and **brand voice contract**, produce:

**Anti-AI Copy Rules** (apply to ALL generated copy):
- NEVER open with "In today's...", "Are you struggling with...", "Have you ever wondered..."
- NEVER use: "game-changer", "revolutionary", "seamlessly", "leverage", "unlock the power of", "dive deep into", "delve", "robust", "streamline", "cutting-edge"
- MUST use one of 5 hook types for headlines: Provocative Question, Specific Scenario, Surprising Statistic, Bold Statement, or Counterintuitive Claim
- MUST include specific numbers, names, or outcomes — not vague claims ("many users love it")
- If the copy sounds like it was written by a generic AI → rewrite until it has personality

**Hero section**
- Headline (under 10 words, outcome-focused, uses one of the 5 hook types above)
- Subheadline (1-2 sentences expanding the promise)
- Primary CTA button text

**Value propositions** (3 items)
- Icon/emoji, title, 1-sentence description each

**Feature list** (pulled from Step 1 scout output)
- Name + benefit phrasing for each feature

**Social proof section** (placeholder copy if no real testimonials)

**Secondary CTA** (bottom of page)

### Step 4 — Social posts

Produce ready-to-post content:

**Twitter/X thread** (5-7 tweets)
- Tweet 1: hook (the big claim)
- Tweets 2-5: one feature or benefit per tweet with specifics
- Tweet 6: social proof or stat
- Tweet 7: CTA with link

**LinkedIn post** (150-300 words)
- Professional tone, problem-solution-proof structure

**Product Hunt tagline** (under 60 characters)

### Step 5 — SEO metadata

Produce for the landing page:

```html
<title>[Meta title — under 60 chars, primary keyword first]</title>
<meta name="description" content="[150-160 chars, includes CTA]">
<meta property="og:title" content="[OG title]">
<meta property="og:description" content="[OG description]">
<meta property="og:image" content="[OG image path]">
<link rel="canonical" href="[canonical URL]">
```

Target keywords list (5-10 terms with rationale).

### Step 5.5 — SEO Audit (if existing site)

If the project already has a deployed site or existing pages, run a technical SEO audit before generating new metadata.

**Automated checks** (use Grep + Read on codebase):

1. **Meta tags completeness**: Every page has `<title>`, `<meta description>`, `og:title`, `og:description`, `og:image`. Flag pages missing any.
2. **Heading hierarchy**: Every page has exactly one `<h1>`. No skipped levels (h1→h3 without h2). Use Grep for `<h1`, `<h2`, `<h3` patterns.
3. **Image alt text**: Search for `<img` without `alt=` attribute. Every image needs descriptive alt text (not "image", not empty).
4. **Canonical URLs**: Check for `<link rel="canonical"`. Missing canonical = duplicate content risk.
5. **Structured data**: Check for `application/ld+json` or microdata. Recommend adding if missing (Product, Organization, Article schemas).
6. **Performance signals**: Check for `next/image` or lazy loading on images. Flag `<img>` without `loading="lazy"` below fold.
7. **Sitemap**: Check for `sitemap.xml` or sitemap generation in build config. Flag if missing.
8. **Robots**: Check for `robots.txt`. Verify it doesn't accidentally block important pages.

**9. Schema Markup**: Check for `application/ld+json` blocks. Recommend adding relevant types:

| Content Type | Schema Type | Key Properties |
|-------------|-------------|---------------|
| Product page | `Product` | name, description, offers, review, aggregateRating |
| Article/Blog | `Article` | headline, author, datePublished, dateModified, image |
| FAQ section | `FAQPage` | mainEntity[].name, mainEntity[].acceptedAnswer |
| How-to guide | `HowTo` | name, step[].name, step[].text, totalTime |
| Organization | `Organization` | name, url, logo, sameAs[] |
| Breadcrumbs | `BreadcrumbList` | itemListElement[].name, itemListElement[].item |
| Software | `SoftwareApplication` | name, operatingSystem, applicationCategory, offers |
| Review | `Review` | itemReviewed, reviewRating, author, reviewBody |
| Comparison | `ItemList` | itemListElement[] with individual Product/Review schemas |
| Local biz | `LocalBusiness` | name, address, telephone, openingHoursSpecification |

Use `@graph` pattern to combine multiple schema types on a single page:
```json
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", ... },
    { "@type": "WebPage", ... },
    { "@type": "BreadcrumbList", ... }
  ]
}
```

**10. Programmatic SEO awareness**: If the site has repeatable content patterns (product listings, city pages, comparison pages), note the opportunity for template-driven SEO pages. Common playbooks:
- **Templates**: `best [tool] for [persona]` pages across personas
- **Comparisons**: `[product A] vs [product B]` for all competitor pairs
- **Locations**: `[service] in [city]` for local reach
- **Integrations**: `[product] + [integration]` for every supported integration

Flag programmatic SEO opportunities in the audit report. Execution details are in `@rune-pro/growth` pack.

**Output**: SEO Audit Report with pass/fail per check. Save to `marketing/seo-audit.md`.

Fix critical SEO issues (missing titles, broken heading hierarchy) in the implementation plan. Non-critical issues go to `marketing/seo-backlog.md`.

### Step 6 — Visual assets

Call `rune:asset-creator` to generate:
- OG image (1200x630px) — product name, tagline, brand colors
- Twitter card image (1200x628px)
- Product Hunt thumbnail (240x240px)

Call `rune:video-creator` to produce:
- 60-second demo video script (screen recording plan)
- Shot list with timestamps

Call `rune:slides` to generate presentation decks for launch demos, sprint reviews, or investor pitches.

If `rune:browser-pilot` is available, capture screenshots of the running app to use as real product imagery.

### Step 7 — Present for approval

Output all assets as structured markdown sections. Present to user for review before saving files.

After user approves, use `Write` to save:
- `marketing/brand-voice.md` — voice contract from Step 2.5
- `marketing/landing-copy.md` — all copy from Step 3
- `marketing/social-posts.md` — all posts from Step 4
- `marketing/seo-meta.json` — SEO data from Step 5
- `marketing/seo-audit.md` — SEO audit results from Step 5.5 (if existing site)
- `marketing/video-script.md` — video plan from Step 6

## Constraints

1. MUST base all claims on actual product capabilities — no aspirational features
2. MUST verify deploy is live before generating marketing materials
3. MUST NOT fabricate testimonials, stats, or benchmarks
4. MUST include accurate technical details — wrong tech specs destroy credibility

## Output Format

```
## Marketing Assets
- **Landing Copy**: [generated — headline, subheadline, value props, features, CTAs]
- **Social Posts**: Twitter thread (N tweets), LinkedIn post, PH tagline
- **SEO Metadata**: title, description, OG tags, N target keywords
- **Visuals**: OG image, Twitter card, PH thumbnail
- **Video**: 60s demo script with shot list

### Generated Files
- marketing/landing-copy.md
- marketing/social-posts.md
- marketing/seo-meta.json
- marketing/video-script.md
```

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Fabricating statistics, benchmarks, or testimonials | CRITICAL | Constraint 3: no fabrication — if no real stats exist, use honest placeholder copy |
| Generating copy before deploy verified live | HIGH | Constraint 2: deploy must be confirmed live before marketing runs |
| Copy not based on actual codebase features (invented value props) | HIGH | scout must run in Step 1 — features extracted from actual code, not assumptions |
| Missing SEO keyword analysis (no research call) | MEDIUM | Step 2: research call for keyword data is mandatory for SEO section |
| Files saved without user approval | MEDIUM | Step 7: present ALL assets to user, wait for approval before writing files |

## Done When

- scout completed and actual feature list extracted
- Brand voice contract established (or existing one loaded)
- Competitor/trend analysis done via trend-scout + research
- Hero copy, value props, social posts, and SEO metadata generated (following brand voice)
- SEO audit completed (if existing site) with pass/fail results
- Visual assets requested from asset-creator
- Video script requested from video-creator (if requested)
- User has approved all content
- Files saved to marketing/ directory
- Marketing Assets report emitted with file list

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| Brand voice contract | Markdown | `marketing/brand-voice.md` |
| Landing page copy | Markdown | `marketing/landing-copy.md` |
| Social media posts | Markdown | `marketing/social-posts.md` |
| SEO metadata | JSON | `marketing/seo-meta.json` |
| SEO audit report | Markdown | `marketing/seo-audit.md` |
| Video demo script | Markdown | `marketing/video-script.md` |

## Cost Profile

~2000-5000 tokens input, ~1000-3000 tokens output. Sonnet for copywriting quality.

**Scope guardrail:** marketing generates assets based on actual product capabilities only — no aspirational copy, no fabricated stats.
