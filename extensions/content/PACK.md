---
name: "@rune/content"
description: Content platform patterns — blog systems, CMS integration, MDX authoring, internationalization, and SEO.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L4
  price: "$9"
  target: Content creators
---

# @rune/content

## Purpose

Content-driven sites break in ways that don't show up until production: blog pages that return 404 after a CMS slug change, MDX files that crash the build when a custom component is missing, translations that show raw keys because the fallback chain is misconfigured, and pages that rank poorly because structured data is malformed or canonical URLs point to the wrong locale. This pack covers the full content stack — authoring, management, localization, and discovery — with patterns that keep content sites correct, fast, and findable.

## Triggers

- Auto-trigger: when `contentlayer`, `@sanity`, `contentful`, `strapi`, `mdx`, `next-intl`, `i18next`, `*.mdx` detected
- `/rune blog-patterns` — build or audit blog architecture
- `/rune cms-integration` — set up or audit headless CMS
- `/rune mdx-authoring` — configure MDX pipeline with custom components
- `/rune i18n` — implement or audit internationalization
- `/rune seo-patterns` — audit SEO, structured data, and meta tags
- Called by `cook` (L1) when content project detected
- Called by `marketing` (L2) when creating blog content

## Skills Included

### blog-patterns

Blog system patterns — post management, categories/tags, pagination, RSS feeds, reading time, related posts, comment systems.

#### Workflow

**Step 1 — Detect blog architecture**
Use Glob to find blog-related files: `blog/`, `posts/`, `articles/`, `*.mdx`, `*.md` in content directories. Use Grep to find blog utilities: `getStaticPaths`, `generateStaticParams`, `allPosts`, `contentlayer`, `reading-time`. Read the post listing page and individual post page to understand: data source, routing strategy, and rendering pipeline.

**Step 2 — Audit blog completeness**
Check for: missing RSS feed (`feed.xml` or `/api/rss`), no reading time estimation, pagination absent on listing pages (all posts loaded at once), no category/tag filtering, missing related posts, no draft/published state, and OG images not generated per-post.

**Step 3 — Emit blog patterns**
Emit: typed post schema with frontmatter validation, paginated listing with category filter, RSS feed generator, reading time calculator, and related posts by tag similarity.

#### Example

```typescript
// Next.js App Router — blog listing with pagination and categories
import { allPosts, type Post } from 'contentlayer/generated';

function getPublishedPosts(category?: string): Post[] {
  return allPosts
    .filter(p => p.status === 'published')
    .filter(p => !category || p.category === category)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Reading time utility
function readingTime(content: string): string {
  const words = content.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / 238);
  return `${minutes} min read`;
}

// RSS feed — app/feed.xml/route.ts
export async function GET() {
  const posts = getPublishedPosts();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>My Blog</title>
    <link>${process.env.SITE_URL}</link>
    <atom:link href="${process.env.SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    ${posts.slice(0, 20).map(p => `<item>
      <title>${escapeXml(p.title)}</title>
      <link>${process.env.SITE_URL}${p.url}</link>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
      <description>${escapeXml(p.excerpt)}</description>
    </item>`).join('\n')}
  </channel>
</rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
```

---

### cms-integration

CMS integration — Sanity, Contentful, Strapi, PocketBase. Content modeling, preview mode, webhook-triggered rebuilds, draft/published workflows.

#### Workflow

**Step 1 — Detect CMS setup**
Use Grep to find CMS SDK usage: `createClient` (Sanity), `contentful`, `strapi`, `PocketBase`, `GROQ`, `graphql` in content-fetching files. Read the CMS client initialization and content queries to understand: CMS provider, content types, preview mode setup, and caching strategy.

**Step 2 — Audit CMS integration**
Check for: no preview/draft mode (editors can't preview before publish), missing webhook for on-demand ISR (content updates require full rebuild), no content validation (malformed CMS data crashes the page), stale cache without revalidation strategy, images served from CMS without optimization (no next/image or equivalent), and missing error boundary for CMS fetch failures.

**Step 3 — Emit CMS patterns**
For Sanity: emit typed GROQ queries with Zod validation, preview mode toggle, and webhook handler. For Contentful: emit typed GraphQL queries, draft/published content switching. For any CMS: emit ISR revalidation endpoint and image optimization pipeline.

#### Example

```typescript
// Sanity — typed client with preview mode and ISR webhook
import { createClient, type QueryParams } from '@sanity/client';
import { z } from 'zod';

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: true,
});

const previewClient = client.withConfig({ useCdn: false, token: process.env.SANITY_PREVIEW_TOKEN });

const PostSchema = z.object({
  _id: z.string(),
  title: z.string(),
  slug: z.string(),
  body: z.array(z.any()),
  publishedAt: z.string().datetime(),
  author: z.object({ name: z.string(), image: z.string().url().optional() }),
});

export async function getPost(slug: string, preview = false) {
  const query = `*[_type == "post" && slug.current == $slug][0]{
    _id, title, "slug": slug.current, body, publishedAt,
    "author": author->{ name, "image": image.asset->url }
  }`;
  const result = await (preview ? previewClient : client).fetch(query, { slug });
  return PostSchema.parse(result);
}

// Webhook handler for on-demand ISR — app/api/revalidate/route.ts
export async function POST(req: Request) {
  const body = await req.json();
  const secret = req.headers.get('x-sanity-webhook-secret');
  if (secret !== process.env.SANITY_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }
  const { revalidatePath } = await import('next/cache');
  revalidatePath(`/blog/${body.slug.current}`);
  return Response.json({ revalidated: true });
}
```

---

### mdx-authoring

MDX authoring patterns — custom components in markdown, code blocks with syntax highlighting, interactive examples, table of contents generation.

#### Workflow

**Step 1 — Detect MDX setup**
Use Grep to find MDX configuration: `@next/mdx`, `mdx-bundler`, `next-mdx-remote`, `contentlayer`, `rehype`, `remark`. Read the MDX pipeline config to understand: compilation method, custom components registered, and remark/rehype plugin chain.

**Step 2 — Audit MDX pipeline**
Check for: no custom component fallback (missing component crashes build), code blocks without syntax highlighting (plain text), no table of contents generation (long articles hard to navigate), missing image optimization in MDX (raw `<img>` tags), no frontmatter validation (typos in dates or categories silently pass), and no interactive component sandboxing.

**Step 3 — Emit MDX patterns**
Emit: MDX component registry with fallback for missing components, code block with syntax highlighting (Shiki or Prism), auto-generated TOC from headings, frontmatter schema validation, and callout/admonition components.

#### Example

```tsx
// MDX component registry with safe fallback
import { type MDXComponents } from 'mdx/types';
import { Callout } from '@/components/callout';
import { CodeBlock } from '@/components/code-block';
import Image from 'next/image';

export function useMDXComponents(): MDXComponents {
  return {
    // Override default elements
    img: ({ src, alt, ...props }) => (
      <Image src={src!} alt={alt || ''} width={800} height={400} className="rounded-lg" {...props} />
    ),
    pre: ({ children, ...props }) => <CodeBlock {...props}>{children}</CodeBlock>,
    // Custom components available in MDX
    Callout,
    // Fallback for unknown components — warn instead of crash
  };
}

// Auto-generated TOC from MDX content
interface TocItem { id: string; text: string; level: number }

function extractToc(raw: string): TocItem[] {
  const headingRegex = /^(#{2,4})\s+(.+)$/gm;
  const items: TocItem[] = [];
  let match;
  while ((match = headingRegex.exec(raw))) {
    const text = match[2].replace(/[`*_~]/g, '');
    items.push({ id: text.toLowerCase().replace(/\s+/g, '-'), text, level: match[1].length });
  }
  return items;
}

// Callout component for MDX
function Callout({ type = 'info', children }: { type?: 'info' | 'warning' | 'error'; children: React.ReactNode }) {
  const styles = { info: 'bg-blue-50 border-blue-400', warning: 'bg-amber-50 border-amber-400', error: 'bg-red-50 border-red-400' };
  return <div className={`border-l-4 p-4 my-4 rounded-r ${styles[type]}`}>{children}</div>;
}
```

---

### i18n

Internationalization — locale routing, translation management, RTL support, date/number formatting, content translation workflows, language detection.

#### Workflow

**Step 1 — Detect i18n setup**
Use Grep to find i18n libraries: `next-intl`, `i18next`, `react-intl`, `@formatjs`, `lingui`, `paraglide`. Use Glob to find translation files: `locales/`, `messages/`, `translations/`, `*.json` in locale directories. Read the i18n configuration to understand: supported locales, default locale, routing strategy, and translation loading method.

**Step 2 — Audit i18n correctness**
Check for: missing translations (keys present in default locale but not in others), no fallback chain (missing key shows raw key to user), locale not in URL (breaks SEO — Google can't index per-locale pages), no `hreflang` tags (search engines don't know about locale variants), hardcoded strings in components (bypassing translation system), date/number formatting without locale context (`toLocaleDateString()` without explicit locale), and no RTL support for Arabic/Hebrew locales.

**Step 3 — Emit i18n patterns**
Emit: type-safe translation keys with IDE autocomplete, locale routing middleware, `hreflang` tag generator, date/number formatting utilities, missing translation detection script, and RTL-aware layout component.

#### Example

```typescript
// next-intl — type-safe translations with locale routing (Next.js App Router)
// messages/en.json: { "home": { "title": "Welcome", "posts": "Latest {count, plural, one {post} other {posts}}" } }
// messages/vi.json: { "home": { "title": "Chao mung", "posts": "{count} bai viet moi nhat" } }

// middleware.ts — locale routing
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'vi', 'ja'],
  defaultLocale: 'en',
  localePrefix: 'as-needed', // /en/about → /about (default), /vi/about stays
});

export const config = { matcher: ['/((?!api|_next|.*\\..*).*)'] };

// Hreflang tags — app/[locale]/layout.tsx
function HreflangTags({ locale, path }: { locale: string; path: string }) {
  const locales = ['en', 'vi', 'ja'];
  return (
    <>
      {locales.map(l => (
        <link key={l} rel="alternate" hrefLang={l} href={`${process.env.SITE_URL}/${l}${path}`} />
      ))}
      <link rel="alternate" hrefLang="x-default" href={`${process.env.SITE_URL}${path}`} />
    </>
  );
}

// Type-safe translations in components
import { useTranslations } from 'next-intl';

function HomePage() {
  const t = useTranslations('home');
  return <h1>{t('title')}</h1>; // IDE autocomplete for keys
}
```

---

### seo-patterns

SEO patterns — structured data (JSON-LD), sitemap generation, canonical URLs, meta tags, Open Graph, Twitter Cards, robots.txt, Core Web Vitals optimization.

#### Workflow

**Step 1 — Detect SEO implementation**
Use Grep to find SEO code: `generateMetadata`, `Head`, `next-seo`, `json-ld`, `sitemap`, `robots.txt`, `og:title`, `twitter:card`. Read the metadata configuration and sitemap generation to understand: current meta tag strategy, structured data presence, and sitemap coverage.

**Step 2 — Audit SEO completeness**
Check for: missing or duplicate `<title>` tags, no meta description (or same description on every page), no Open Graph tags (poor social sharing), missing canonical URL (duplicate content risk), no JSON-LD structured data (no rich snippets in search), sitemap not listing all public pages, robots.txt blocking important paths, missing `alt` text on images, and no Core Web Vitals monitoring (LCP, CLS, INP).

**Step 3 — Emit SEO patterns**
Emit: metadata generator with per-page overrides, JSON-LD templates (Article, Product, FAQ, BreadcrumbList), dynamic sitemap generator, canonical URL helper, and Core Web Vitals reporter.

#### Example

```typescript
// Next.js App Router — metadata + JSON-LD + sitemap
import { type Metadata } from 'next';

// Reusable metadata generator
function createMetadata({ title, description, path, image, type = 'website' }: {
  title: string; description: string; path: string; image?: string; type?: string;
}): Metadata {
  const url = `${process.env.SITE_URL}${path}`;
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type, images: image ? [{ url: image, width: 1200, height: 630 }] : [] },
    twitter: { card: 'summary_large_image', title, description, images: image ? [image] : [] },
  };
}

// JSON-LD for blog posts
function ArticleJsonLd({ post }: { post: Post }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: { '@type': 'Person', name: post.author.name },
    image: post.ogImage,
    description: post.excerpt,
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />;
}

// Dynamic sitemap — app/sitemap.ts
export default async function sitemap() {
  const posts = await getAllPublishedPosts();
  const staticPages = ['', '/about', '/blog', '/contact'];
  return [
    ...staticPages.map(path => ({ url: `${process.env.SITE_URL}${path}`, lastModified: new Date(), changeFrequency: 'monthly' as const })),
    ...posts.map(post => ({ url: `${process.env.SITE_URL}/blog/${post.slug}`, lastModified: new Date(post.updatedAt || post.publishedAt), changeFrequency: 'weekly' as const })),
  ];
}
```

---

## Connections

```
Calls → research (L3): SEO data and competitor analysis
Calls → marketing (L2): content promotion
Called By ← cook (L1): when content project detected
Called By ← marketing (L2): when creating blog content
```

## Tech Stack Support

| Area | Options | Notes |
|------|---------|-------|
| Blog Framework | Contentlayer, MDX, Velite | Contentlayer most mature for Next.js |
| Headless CMS | Sanity, Contentful, Strapi, PocketBase | Sanity best DX; PocketBase self-hosted |
| MDX | next-mdx-remote, mdx-bundler, @next/mdx | next-mdx-remote for dynamic content |
| i18n | next-intl, i18next, Paraglide | next-intl for App Router |
| SEO | Next.js Metadata API, next-seo | Metadata API built-in since Next.js 13 |

## Constraints

1. MUST validate all CMS content against a schema before rendering — malformed data from CMS should not crash pages.
2. MUST include `hreflang` tags on all locale-specific pages — missing hreflang hurts international SEO ranking.
3. MUST NOT hardcode strings in components when i18n is configured — every user-visible string goes through the translation system.
4. MUST generate sitemap dynamically from actual content — static sitemaps go stale and list nonexistent pages.
5. MUST provide fallback for missing MDX components — a missing custom component should render a warning, not crash the build.

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| CMS slug change breaks all inbound links (404 on old URLs) | HIGH | Implement redirect map in CMS; check for broken links on content publish webhook |
| Missing translation key shows raw key string (`home.title`) to users | HIGH | Configure fallback to default locale; run missing key detection in CI |
| MDX build crashes because custom component removed but still referenced in old posts | HIGH | Register fallback component that renders warning in dev, empty div in prod |
| Sitemap includes draft/unpublished pages (indexed by Google before ready) | MEDIUM | Filter sitemap to `status === 'published'` only; add `noindex` to draft preview pages |
| `hreflang` tags point to wrong locale (en page links to vi version of different page) | MEDIUM | Generate hreflang from route params, not hardcoded; test with hreflang validator |
| JSON-LD structured data has schema errors (no rich snippets in search) | MEDIUM | Validate JSON-LD against Schema.org; test with Google Rich Results Test |

## Done When

- Blog system serves paginated posts with RSS feed and reading time
- CMS integration has preview mode, webhook revalidation, and content validation
- MDX pipeline renders custom components with fallback for missing ones
- All user-facing strings go through i18n with fallback chain configured
- Every public page has unique title, description, OG tags, canonical URL, and JSON-LD
- Structured report emitted for each skill invoked

## Cost Profile

~10,000–18,000 tokens per full pack run (all 5 skills). Individual skill: ~2,000–4,000 tokens. Sonnet default. Use haiku for detection scans; escalate to sonnet for CMS integration and SEO audit.
