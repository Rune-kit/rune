---
name: marketing
description: Create marketing assets and execute launch strategy. Generates landing copy, social banners, SEO meta, blog posts, and video scripts.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L2
  model: sonnet
  group: delivery
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
- `browser-pilot` (L3): capture screenshots for marketing assets
- L4 extension packs: domain-specific content when context matches (e.g., @rune/content for blog posts, @rune/analytics for campaign measurement)

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

### Step 3 — Generate copy

Using product understanding and market research, produce:

**Hero section**
- Headline (under 10 words, outcome-focused)
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

### Step 6 — Visual assets

Call `rune:asset-creator` to generate:
- OG image (1200x630px) — product name, tagline, brand colors
- Twitter card image (1200x628px)
- Product Hunt thumbnail (240x240px)

Call `rune:video-creator` to produce:
- 60-second demo video script (screen recording plan)
- Shot list with timestamps

If `rune:browser-pilot` is available, capture screenshots of the running app to use as real product imagery.

### Step 7 — Present for approval

Output all assets as structured markdown sections. Present to user for review before saving files.

After user approves, use `Write` to save:
- `marketing/landing-copy.md` — all copy from Step 3
- `marketing/social-posts.md` — all posts from Step 4
- `marketing/seo-meta.json` — SEO data from Step 5
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
- Competitor/trend analysis done via trend-scout + research
- Hero copy, value props, social posts, and SEO metadata generated
- Visual assets requested from asset-creator
- Video script requested from video-creator (if requested)
- User has approved all content
- Files saved to marketing/ directory
- Marketing Assets report emitted with file list

## Cost Profile

~2000-5000 tokens input, ~1000-3000 tokens output. Sonnet for copywriting quality.
