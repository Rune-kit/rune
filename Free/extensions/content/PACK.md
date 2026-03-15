---
name: "@rune/content"
description: Content platform patterns — blog systems, CMS integration, MDX authoring, internationalization, and SEO.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L4
  price: "$9"
  target: Content creators
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
- Called by `cook` (L1) when content project detected
- Called by `marketing` (L2) when creating blog content

## Skills Summary

| Skill | Layer | Model | Purpose |
|-------|-------|-------|---------|
| blog-patterns | L4 | sonnet | Post management, RSS, pagination, categories |
| cms-integration | L4 | sonnet | Sanity/Contentful/Strapi, preview, webhooks |
| mdx-authoring | L4 | sonnet | Custom components, TOC, syntax highlighting |
| i18n | L4 | sonnet | Locale routing, translations, hreflang, RTL |
| seo-patterns | L4 | sonnet | JSON-LD, sitemap, meta tags, Core Web Vitals |

## Workflows

Common multi-skill workflows for real content projects:

| Workflow | Skills Invoked | Trigger |
|----------|----------------|---------|
| New blog from scratch | blog-patterns → mdx-authoring → seo-patterns | `/rune blog-patterns` on empty project |
| CMS migration | cms-integration → seo-patterns → blog-patterns | New CMS detected, old slugs present |
| Launch-ready audit | seo-patterns + blog-patterns + i18n (parallel) | Pre-deploy checklist |
| Multilingual blog | i18n → blog-patterns → seo-patterns | `next-intl` or i18next detected |
| MDX component library | mdx-authoring → blog-patterns | `*.mdx` files without component registry |
| Performance audit | seo-patterns (CWV check) + blog-patterns (images) | LCP > 2.5s detected |
| Search setup | cms-integration + blog-patterns → search integration | Algolia/Meilisearch env vars detected |

---

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

// Related posts by tag overlap — score by number of shared tags
function getRelatedPosts(current: Post, all: Post[], limit = 3): Post[] {
  const currentTags = new Set(current.tags ?? []);
  return all
    .filter(p => p.slug !== current.slug && p.status === 'published')
    .map(p => ({ post: p, score: (p.tags ?? []).filter(t => currentTags.has(t)).length }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ post }) => post);
}

// Paginated listing
const PAGE_SIZE = 10;
function paginatePosts(posts: Post[], page: number) {
  const start = (page - 1) * PAGE_SIZE;
  return {
    posts: posts.slice(start, start + PAGE_SIZE),
    total: posts.length,
    totalPages: Math.ceil(posts.length / PAGE_SIZE),
    hasNext: start + PAGE_SIZE < posts.length,
    hasPrev: page > 1,
  };
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

#### Example — Sanity

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

#### Example — Contentful

```typescript
// Contentful — typed GraphQL with draft/published switching
import { createClient } from 'contentful';

const client = createClient({
  space: process.env.CONTENTFUL_SPACE_ID!,
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN!,
});

const previewClient = createClient({
  space: process.env.CONTENTFUL_SPACE_ID!,
  accessToken: process.env.CONTENTFUL_PREVIEW_TOKEN!,
  host: 'preview.contentful.com',
});

export async function getArticle(slug: string, preview = false) {
  const c = preview ? previewClient : client;
  const entries = await c.getEntries({
    content_type: 'article',
    'fields.slug': slug,
    include: 2,
    limit: 1,
  });
  if (!entries.items.length) return null;
  const entry = entries.items[0];
  return {
    title: entry.fields.title as string,
    slug: entry.fields.slug as string,
    body: entry.fields.body,
    publishedAt: entry.sys.createdAt,
  };
}
```

#### Example — Strapi

```typescript
// Strapi v5 — REST with populate and draft/live modes
const STRAPI = process.env.STRAPI_URL ?? 'http://localhost:1337';
const TOKEN = process.env.STRAPI_API_TOKEN!;

async function strapiGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${STRAPI}/api${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${TOKEN}` },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Strapi error: ${res.status}`);
  return res.json();
}

export const getArticles = () =>
  strapiGet<{ data: StrapiArticle[] }>('/articles', {
    'filters[publishedAt][$notNull]': 'true',
    'populate': 'cover,author,category',
    'sort': 'publishedAt:desc',
  });
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

#### Example — Component Registry

```tsx
// MDX component registry with safe fallback
import { type MDXComponents } from 'mdx/types';
import { Callout } from '@/components/callout';
import { CodeBlock } from '@/components/code-block';
import Image from 'next/image';

export function useMDXComponents(): MDXComponents {
  return {
    img: ({ src, alt, ...props }) => (
      <Image src={src!} alt={alt || ''} width={800} height={400} className="rounded-lg" {...props} />
    ),
    pre: ({ children, ...props }) => <CodeBlock {...props}>{children}</CodeBlock>,
    Callout,
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

#### Example — Shiki Syntax Highlighting

```typescript
// rehype-shiki integration in contentlayer or next.config.mjs
import { rehypeShiki } from '@shikijs/rehype';
import { defineDocumentType, makeSource } from 'contentlayer/source-files';

export default makeSource({
  mdxOptions: {
    rehypePlugins: [
      [rehypeShiki, {
        themes: { light: 'github-light', dark: 'github-dark' },
        addLanguageClass: true,
      }],
    ],
  },
});

// CodeBlock component with copy-to-clipboard
'use client';
import { useState } from 'react';

export function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const code = typeof children === 'string' ? children : '';

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative group">
      <pre className={className}>{children}</pre>
      <button
        onClick={copy}
        aria-label="Copy code"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 text-xs bg-gray-700 text-white rounded"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}
```

#### Example — Frontmatter Validation

```typescript
// contentlayer.config.ts — Zod-like validation via defineDocumentType
import { defineDocumentType } from 'contentlayer/source-files';

export const Post = defineDocumentType(() => ({
  name: 'Post',
  filePathPattern: 'posts/**/*.mdx',
  contentType: 'mdx',
  fields: {
    title:  { type: 'string',  required: true },
    date:   { type: 'date',    required: true },
    status: { type: 'enum',    options: ['draft', 'published'], required: true },
    tags:   { type: 'list',    of: { type: 'string' }, default: [] },
    excerpt:{ type: 'string',  required: false },
    ogImage:{ type: 'string',  required: false },
  },
  computedFields: {
    url:         { type: 'string', resolve: d => `/blog/${d._raw.flattenedPath.replace('posts/', '')}` },
    readingTime: { type: 'string', resolve: d => {
      const words = d.body.raw.split(/\s+/).length;
      return `${Math.ceil(words / 238)} min read`;
    }},
  },
}));
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

// CI script — detect missing translation keys
// scripts/check-translations.ts
import en from '../messages/en.json';
import vi from '../messages/vi.json';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null
      ? flattenKeys(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`]
  );
}

const enKeys = new Set(flattenKeys(en));
const viKeys = new Set(flattenKeys(vi));
const missing = [...enKeys].filter(k => !viKeys.has(k));
if (missing.length) {
  console.error('Missing vi translations:', missing);
  process.exit(1);
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

## Content Migration Checklist

Use when moving content between CMS platforms (e.g., WordPress → Sanity, Contentful → Strapi).

### Pre-Migration

- [ ] Export full content inventory — slugs, titles, dates, authors, categories, tags
- [ ] Map old content types to new schema — document every field mapping
- [ ] Identify broken or orphaned content before migrating (not worth moving)
- [ ] Capture all existing URLs for redirect mapping (critical for SEO)
- [ ] Screenshot or snapshot top-10 pages for visual regression after migration
- [ ] Check for custom fields or plugins in old CMS — equivalent needed in new CMS

### URL Redirect Strategy

```typescript
// Next.js next.config.ts — static redirect map from old CMS slugs
const redirects: { source: string; destination: string; permanent: boolean }[] = [
  { source: '/2023/01/my-old-post', destination: '/blog/my-old-post', permanent: true },
  { source: '/category/tech', destination: '/blog?category=tech', permanent: true },
  // WordPress date-based URLs → clean slugs
  { source: '/\\d{4}/\\d{2}/\\d{2}/:slug', destination: '/blog/:slug', permanent: true },
];

// For large sites: load from JSON file
import redirectMap from './redirects.json';

export default {
  async redirects() {
    return redirectMap.map(({ from, to }) => ({
      source: from,
      destination: to,
      permanent: true,
    }));
  },
};

// Validate no 404s after migration — scripts/check-redirects.ts
async function checkRedirects(redirects: Array<{ source: string; destination: string }>) {
  const results = await Promise.allSettled(
    redirects.map(async ({ source }) => {
      const res = await fetch(`${process.env.SITE_URL}${source}`, { redirect: 'manual' });
      if (res.status !== 301 && res.status !== 308) {
        throw new Error(`${source} returned ${res.status}`);
      }
    })
  );
  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length) console.error('Redirect failures:', failures);
}
```

### Data Mapping

```typescript
// WordPress XML → Sanity migration script (outline)
import { parse } from 'node-html-parser';
import { createClient } from '@sanity/client';

interface WpPost {
  title: string;
  slug: string;
  content: string;
  date: string;
  categories: string[];
  status: 'publish' | 'draft';
}

async function migratePost(wp: WpPost, client: ReturnType<typeof createClient>) {
  return client.create({
    _type: 'post',
    title: wp.title,
    slug: { _type: 'slug', current: wp.slug },
    publishedAt: new Date(wp.date).toISOString(),
    status: wp.status === 'publish' ? 'published' : 'draft',
    // Convert HTML body to Portable Text via @sanity/block-content-to-hyperscript
    body: htmlToPortableText(wp.content),
  });
}
```

### SEO Preservation

- [ ] Verify all old URLs return 301 (permanent redirect) not 302
- [ ] Check canonical tags update to new URLs after migration
- [ ] Re-submit sitemap to Google Search Console after go-live
- [ ] Monitor Google Search Console for coverage errors for 30 days post-migration
- [ ] Preserve `<meta name="description">` content — reuse from old CMS export
- [ ] Keep same `<title>` patterns where possible — Google re-evaluates after changes

---

## Search Integration

### Algolia

```typescript
// lib/search/algolia.ts — index content on publish
import algoliasearch from 'algoliasearch';

const client = algoliasearch(
  process.env.ALGOLIA_APP_ID!,
  process.env.ALGOLIA_ADMIN_KEY! // admin key for write; search key for frontend
);
const index = client.initIndex('posts');

export interface SearchRecord {
  objectID: string;
  title: string;
  excerpt: string;
  slug: string;
  category: string;
  tags: string[];
  publishedAt: number; // unix timestamp for range filtering
}

export async function indexPost(post: Post) {
  await index.saveObject({
    objectID: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    slug: post.slug,
    category: post.category,
    tags: post.tags,
    publishedAt: new Date(post.publishedAt).getTime() / 1000,
  } satisfies SearchRecord);
}

export async function removePost(slug: string) {
  await index.deleteObject(slug);
}

// Frontend search component with InstantSearch
import { InstantSearch, SearchBox, Hits, Highlight, Configure } from 'react-instantsearch';
import algoliasearch from 'algoliasearch/lite';

const searchClient = algoliasearch(
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
  process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY! // read-only key only
);

function BlogSearch() {
  return (
    <InstantSearch searchClient={searchClient} indexName="posts">
      <Configure hitsPerPage={8} />
      <SearchBox placeholder="Search posts..." />
      <Hits hitComponent={({ hit }) => (
        <a href={`/blog/${hit.slug}`}>
          <Highlight attribute="title" hit={hit} />
          <Highlight attribute="excerpt" hit={hit} />
        </a>
      )} />
    </InstantSearch>
  );
}
```

### Meilisearch

```typescript
// lib/search/meilisearch.ts — self-hosted, zero API cost
import { MeiliSearch } from 'meilisearch';

const client = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST ?? 'http://localhost:7700',
  apiKey: process.env.MEILISEARCH_MASTER_KEY,
});

const postsIndex = client.index('posts');

// Configure searchable and filterable attributes
await postsIndex.updateSettings({
  searchableAttributes: ['title', 'excerpt', 'tags', 'content'],
  filterableAttributes: ['category', 'tags', 'status'],
  sortableAttributes: ['publishedAt'],
  rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
});

// Search with filters
export async function searchPosts(query: string, category?: string) {
  return postsIndex.search(query, {
    filter: category ? `category = "${category}" AND status = "published"` : 'status = "published"',
    limit: 10,
    attributesToHighlight: ['title', 'excerpt'],
  });
}
```

### Typesense

```typescript
// lib/search/typesense.ts — typo-tolerant, fast, self-hosted
import Typesense from 'typesense';

const client = new Typesense.Client({
  nodes: [{ host: process.env.TYPESENSE_HOST!, port: 443, protocol: 'https' }],
  apiKey: process.env.TYPESENSE_API_KEY!,
  connectionTimeoutSeconds: 2,
});

const SCHEMA = {
  name: 'posts',
  fields: [
    { name: 'id',          type: 'string' as const },
    { name: 'title',       type: 'string' as const },
    { name: 'excerpt',     type: 'string' as const },
    { name: 'tags',        type: 'string[]' as const, facet: true },
    { name: 'category',    type: 'string' as const,   facet: true },
    { name: 'publishedAt', type: 'int64' as const,    sort: true },
  ],
  default_sorting_field: 'publishedAt',
};

export async function upsertPost(post: Post) {
  await client.collections('posts').documents().upsert({
    id: post.slug,
    title: post.title,
    excerpt: post.excerpt ?? '',
    tags: post.tags ?? [],
    category: post.category ?? 'uncategorized',
    publishedAt: Math.floor(new Date(post.publishedAt).getTime() / 1000),
  });
}
```

---

## Newsletter & Email Integration

### Resend — Transactional + Drip

```typescript
// lib/email/resend.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

// Add subscriber to audience
export async function subscribeToNewsletter(email: string, name?: string) {
  await resend.contacts.create({
    email,
    firstName: name?.split(' ')[0],
    audienceId: process.env.RESEND_AUDIENCE_ID!,
    unsubscribed: false,
  });
}

// Send new post notification
export async function sendNewPostEmail(post: Post, subscribers: string[]) {
  await resend.batch.send(
    subscribers.map(to => ({
      from: 'blog@yourdomain.com',
      to,
      subject: `New post: ${post.title}`,
      react: NewPostEmail({ post }),
    }))
  );
}

// Email capture form — app/api/subscribe/route.ts
export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email || !email.includes('@')) {
    return Response.json({ error: 'Invalid email' }, { status: 400 });
  }
  await subscribeToNewsletter(email);
  return Response.json({ success: true });
}
```

### RSS-to-Email (Mailchimp)

```typescript
// scripts/rss-to-email.ts — run via cron after new post published
import Parser from 'rss-parser';
import mailchimp from '@mailchimp/mailchimp_marketing';

mailchimp.setConfig({ apiKey: process.env.MAILCHIMP_API_KEY!, server: process.env.MAILCHIMP_SERVER! });

async function sendLatestPost() {
  const parser = new Parser();
  const feed = await parser.parseURL(`${process.env.SITE_URL}/feed.xml`);
  const latest = feed.items[0];
  if (!latest) return;

  // Check if we already sent this post (store last sent GUID)
  const lastSent = process.env.LAST_SENT_GUID;
  if (latest.guid === lastSent) return;

  await mailchimp.campaigns.create({
    type: 'regular',
    recipients: { list_id: process.env.MAILCHIMP_LIST_ID! },
    settings: {
      subject_line: latest.title ?? 'New post',
      from_name: 'Your Blog',
      reply_to: 'blog@yourdomain.com',
    },
  });
}
```

### Drip Sequence Pattern

```typescript
// lib/email/drip.ts — trigger drip on signup
const DRIP_SEQUENCE = [
  { delayDays: 0,  subject: 'Welcome! Start here',  template: 'welcome' },
  { delayDays: 3,  subject: 'Our most popular posts', template: 'best-of' },
  { delayDays: 7,  subject: 'Tips for getting started', template: 'tips' },
  { delayDays: 14, subject: 'Here\'s what\'s new',   template: 'digest' },
];

export async function startDripSequence(email: string) {
  for (const step of DRIP_SEQUENCE) {
    await resend.emails.send({
      from: 'hello@yourdomain.com',
      to: email,
      subject: step.subject,
      react: getDripTemplate(step.template),
      scheduledAt: new Date(Date.now() + step.delayDays * 86400_000).toISOString(),
    });
  }
}
```

---

## Content Performance Optimization

### Image Optimization

```typescript
// next.config.ts — image optimization config
const config = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.sanity.io' },
      { protocol: 'https', hostname: 'images.ctfassets.net' },
    ],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 1 week
  },
};

// Sharp preprocessing for CMS images
import sharp from 'sharp';
import { writeFile } from 'fs/promises';
import { join } from 'path';

async function optimizeCmsImage(url: string, slug: string): Promise<string> {
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  const outputPath = join('public', 'images', `${slug}.webp`);
  await sharp(buffer)
    .resize(1200, 630, { fit: 'cover', position: 'attention' }) // smart crop for OG
    .webp({ quality: 85 })
    .toFile(outputPath);
  return `/images/${slug}.webp`;
}

// BlurDataURL for all CMS images — prevents layout shift
async function getBlurDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  const { data, info } = await sharp(buffer)
    .resize(8, 8, { fit: 'inside' })
    .toBuffer({ resolveWithObject: true });
  return `data:image/${info.format};base64,${data.toString('base64')}`;
}
```

### ISR / SSG Strategy

```typescript
// ISR with smart revalidation windows
// High-traffic pages: short TTL. Archive pages: long TTL.
export async function generateStaticParams() {
  const posts = await getAllPublishedPosts();
  // Pre-render recent 50 posts; rest generated on-demand
  return posts.slice(0, 50).map(p => ({ slug: p.slug }));
}

export const revalidate = 3600; // 1h default — override per page

// app/blog/[slug]/page.tsx — dynamic revalidation based on post age
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.slug);
  const ageInDays = (Date.now() - new Date(post.publishedAt).getTime()) / 86400_000;
  // Older posts change less — handled via headers or route segment config
  return createMetadata({ title: post.title, description: post.excerpt, path: `/blog/${post.slug}` });
}

// On-demand revalidation endpoint (works with any CMS webhook)
// app/api/revalidate/route.ts
export async function POST(req: Request) {
  const { secret, paths } = await req.json();
  if (secret !== process.env.REVALIDATE_SECRET) {
    return Response.json({ error: 'Invalid secret' }, { status: 401 });
  }
  const { revalidatePath } = await import('next/cache');
  for (const path of paths as string[]) {
    revalidatePath(path);
  }
  return Response.json({ revalidated: paths });
}
```

### Core Web Vitals for Content Sites

```typescript
// lib/vitals.ts — report to analytics
import { onLCP, onINP, onCLS, onFCP, onTTFB, type Metric } from 'web-vitals';

function sendToAnalytics(metric: Metric) {
  navigator.sendBeacon('/api/vitals', JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
    path: window.location.pathname,
  }));
}

export function initVitals() {
  onLCP(sendToAnalytics);   // Largest Contentful Paint — target < 2.5s
  onINP(sendToAnalytics);   // Interaction to Next Paint — target < 200ms
  onCLS(sendToAnalytics);   // Cumulative Layout Shift — target < 0.1
  onFCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
}

// Common CLS fixes for content sites:
// 1. Reserve space for images: always set width + height on <img> or use aspect-ratio
// 2. Font loading: font-display: optional or swap + preload critical fonts
// 3. Ad slots: min-height: <expected-height>px before ad loads
// 4. Avoid inserting DOM nodes above fold after page load
```

---

## Content Analytics Integration

### Page Views + Read Time

```typescript
// lib/analytics/content.ts — track engagement without bloating bundle
export interface ContentEvent {
  type: 'view' | 'read_complete' | 'scroll_depth' | 'share';
  slug: string;
  value?: number; // scroll % for scroll_depth, read seconds for read_complete
}

// app/api/analytics/route.ts — lightweight ingestion endpoint
export async function POST(req: Request) {
  const event: ContentEvent = await req.json();
  // Write to your analytics DB (PocketBase, Supabase, Tinybird, etc.)
  await db.collection('content_events').create({
    ...event,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0],
    ua: req.headers.get('user-agent'),
    timestamp: new Date().toISOString(),
  });
  return new Response(null, { status: 204 });
}

// components/analytics/ReadTracker.tsx — client component
'use client';
import { useEffect, useRef } from 'react';

export function ReadTracker({ slug }: { slug: string }) {
  const startedAt = useRef(Date.now());
  const reported = useRef(false);

  useEffect(() => {
    // Fire view on mount
    navigator.sendBeacon('/api/analytics', JSON.stringify({ type: 'view', slug }));

    // Fire read_complete after 60% of estimated reading time on page
    return () => {
      if (!reported.current) {
        const seconds = Math.floor((Date.now() - startedAt.current) / 1000);
        navigator.sendBeacon('/api/analytics', JSON.stringify({ type: 'read_complete', slug, value: seconds }));
        reported.current = true;
      }
    };
  }, [slug]);

  return null;
}
```

### Scroll Depth Tracking

```typescript
// hooks/useScrollDepth.ts
'use client';
import { useEffect, useRef } from 'react';

const CHECKPOINTS = [25, 50, 75, 90, 100];

export function useScrollDepth(slug: string) {
  const reached = useRef(new Set<number>());

  useEffect(() => {
    function onScroll() {
      const el = document.documentElement;
      const pct = Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100);
      for (const checkpoint of CHECKPOINTS) {
        if (pct >= checkpoint && !reached.current.has(checkpoint)) {
          reached.current.add(checkpoint);
          navigator.sendBeacon('/api/analytics', JSON.stringify({
            type: 'scroll_depth', slug, value: checkpoint,
          }));
        }
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [slug]);
}
```

### Post View Counter

```typescript
// Display view counts — cached to avoid N+1 queries
// app/blog/[slug]/ViewCounter.tsx
import { unstable_cache } from 'next/cache';

const getViewCount = unstable_cache(
  async (slug: string) => {
    const result = await db.collection('content_events')
      .filter(`slug = "${slug}" && type = "view"`)
      .count();
    return result;
  },
  ['view-count'],
  { revalidate: 300 } // refresh every 5 minutes
);

export async function ViewCounter({ slug }: { slug: string }) {
  const count = await getViewCount(slug);
  return (
    <span className="text-sm text-gray-500">
      {new Intl.NumberFormat('en-US').format(count)} views
    </span>
  );
}
```

---

## Content Scheduling & Workflows

### Draft / Review / Publish Pipeline

```typescript
// Contentlayer — status field drives pipeline
// Statuses: draft → in-review → approved → scheduled → published → archived

// lib/content-workflow.ts
type ContentStatus = 'draft' | 'in-review' | 'approved' | 'scheduled' | 'published' | 'archived';

interface WorkflowTransition {
  from: ContentStatus;
  to: ContentStatus;
  requiredRole: 'author' | 'editor' | 'admin';
}

const ALLOWED_TRANSITIONS: WorkflowTransition[] = [
  { from: 'draft',      to: 'in-review', requiredRole: 'author' },
  { from: 'in-review',  to: 'approved',  requiredRole: 'editor' },
  { from: 'in-review',  to: 'draft',     requiredRole: 'editor' },  // request changes
  { from: 'approved',   to: 'scheduled', requiredRole: 'editor' },
  { from: 'approved',   to: 'published', requiredRole: 'editor' },
  { from: 'scheduled',  to: 'published', requiredRole: 'admin' },   // cron triggers this
  { from: 'published',  to: 'archived',  requiredRole: 'admin' },
];

export function canTransition(from: ContentStatus, to: ContentStatus, role: string): boolean {
  return ALLOWED_TRANSITIONS.some(t => t.from === from && t.to === to && t.requiredRole === role);
}
```

### Scheduled Publishing

```typescript
// app/api/cron/publish-scheduled/route.ts — trigger via Vercel Cron or GitHub Actions
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const now = new Date().toISOString();
  // Find posts scheduled to publish before now
  const due = await db.getScheduledPostsDue(now);

  const results = await Promise.allSettled(
    due.map(async post => {
      await db.updatePostStatus(post.id, 'published');
      await indexPost(post);           // add to search index
      await revalidatePath('/blog');   // clear ISR cache
      await revalidatePath(`/blog/${post.slug}`);
      await notifySubscribers(post);   // optional email blast
    })
  );

  return Response.json({ published: due.length, results: results.map(r => r.status) });
}

// vercel.json — schedule the cron
// { "crons": [{ "path": "/api/cron/publish-scheduled", "schedule": "*/15 * * * *" }] }
```

### Content Calendar (Minimal)

```typescript
// lib/content-calendar.ts — read from CMS, render calendar view
interface CalendarEntry {
  title: string;
  slug: string;
  scheduledAt: Date;
  status: ContentStatus;
  author: string;
}

export async function getContentCalendar(startDate: Date, endDate: Date): Promise<CalendarEntry[]> {
  const posts = await db.getPosts({
    status: ['draft', 'in-review', 'approved', 'scheduled', 'published'],
    dateRange: { start: startDate, end: endDate },
  });
  return posts.map(p => ({
    title: p.title,
    slug: p.slug,
    scheduledAt: new Date(p.scheduledAt ?? p.publishedAt),
    status: p.status,
    author: p.author.name,
  }));
}
```

---

## Accessibility for Content

### Alt Text Automation

```typescript
// scripts/audit-alt-text.ts — find images missing alt in MDX files
import { glob } from 'glob';
import { readFile } from 'fs/promises';

const IMG_REGEX = /!\[([^\]]*)\]\([^)]+\)|<img[^>]+>/g;

async function auditAltText(dir: string) {
  const files = await glob(`${dir}/**/*.mdx`);
  const issues: { file: string; line: number; src: string }[] = [];

  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      const matches = line.matchAll(IMG_REGEX);
      for (const match of matches) {
        const isMarkdown = match[0].startsWith('![');
        const isEmpty = isMarkdown ? match[1].trim() === '' : !match[0].includes('alt=') || match[0].includes('alt=""');
        if (isEmpty) issues.push({ file, line: i + 1, src: match[0].slice(0, 60) });
      }
    });
  }

  if (issues.length) {
    console.error(`Found ${issues.length} images with missing/empty alt text:`);
    issues.forEach(i => console.error(`  ${i.file}:${i.line} → ${i.src}`));
    process.exit(1);
  }
}

// Auto-generate alt text using AI (optional, for CMS images without alt)
async function suggestAltText(imageUrl: string): Promise<string> {
  // Call Claude claude-haiku-4-5 — fast, cheap for image description
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 100,
      messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'url', url: imageUrl } }, { type: 'text', text: 'Write a concise alt text for this image (max 125 chars, no "image of").' }] }],
    }),
  });
  const data = await res.json();
  return data.content[0].text.trim();
}
```

### Reading Level Analysis

```typescript
// lib/content/readability.ts — Flesch-Kincaid reading ease
export function fleschKincaid(text: string): { score: number; level: string } {
  const sentences = text.split(/[.!?]+/).filter(Boolean).length;
  const words     = text.trim().split(/\s+/).length;
  const syllables = countSyllables(text);

  if (words === 0 || sentences === 0) return { score: 0, level: 'unknown' };

  const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  const level =
    score >= 70 ? 'Easy (6th grade)'      :
    score >= 50 ? 'Moderate (10th grade)' :
    score >= 30 ? 'Difficult (College)'   : 'Very Difficult (Professional)';

  return { score: Math.round(score), level };
}

function countSyllables(text: string): number {
  return text
    .toLowerCase()
    .replace(/[^a-z]/g, ' ')
    .split(/\s+/)
    .reduce((acc, word) => {
      const count = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
        .replace(/^y/, '')
        .match(/[aeiouy]{1,2}/g)?.length ?? 1;
      return acc + count;
    }, 0);
}
```

### Semantic Markup for Articles

```tsx
// components/Article.tsx — correct semantic structure
export function Article({ post }: { post: Post }) {
  return (
    <article itemScope itemType="https://schema.org/BlogPosting">
      <header>
        <h1 itemProp="headline">{post.title}</h1>
        <p>
          By{' '}
          <span itemProp="author" itemScope itemType="https://schema.org/Person">
            <span itemProp="name">{post.author.name}</span>
          </span>
          {' · '}
          <time itemProp="datePublished" dateTime={post.publishedAt}>
            {new Date(post.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </time>
          {' · '}
          <span>{post.readingTime}</span>
        </p>
      </header>

      <nav aria-label="Table of contents">
        <ol>
          {post.toc.map(item => (
            <li key={item.id} style={{ paddingLeft: `${(item.level - 2) * 16}px` }}>
              <a href={`#${item.id}`}>{item.text}</a>
            </li>
          ))}
        </ol>
      </nav>

      <section itemProp="articleBody" aria-label="Article content">
        {post.content}
      </section>

      <footer>
        <nav aria-label="Post tags">
          {post.tags.map(tag => (
            <a key={tag} href={`/blog?tag=${tag}`} rel="tag">{tag}</a>
          ))}
        </nav>
      </footer>
    </article>
  );
}
```

---

## Rich Media Embedding

### Video Embeds in MDX

```tsx
// components/mdx/VideoEmbed.tsx — lazy, privacy-respecting YouTube embed
'use client';
import { useState } from 'react';
import Image from 'next/image';

interface VideoEmbedProps {
  id: string;
  title: string;
  provider?: 'youtube' | 'vimeo';
}

export function VideoEmbed({ id, title, provider = 'youtube' }: VideoEmbedProps) {
  const [loaded, setLoaded] = useState(false);

  const thumb = `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
  const src =
    provider === 'youtube'
      ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`
      : `https://player.vimeo.com/video/${id}?autoplay=1`;

  return (
    <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-900 my-6">
      {!loaded ? (
        <button
          className="w-full h-full group"
          aria-label={`Play video: ${title}`}
          onClick={() => setLoaded(true)}
        >
          <Image src={thumb} alt={title} fill className="object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6 ml-1" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </button>
      ) : (
        <iframe
          src={src}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      )}
    </div>
  );
}

// Usage in MDX:
// <VideoEmbed id="dQw4w9WgXcQ" title="Getting started with Next.js" />
```

### Image Gallery

```tsx
// components/mdx/Gallery.tsx — lightbox image gallery
'use client';
import { useState } from 'react';
import Image from 'next/image';

interface GalleryImage { src: string; alt: string; caption?: string }

export function Gallery({ images }: { images: GalleryImage[] }) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 my-6">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className="relative aspect-square rounded overflow-hidden group"
            aria-label={`View ${img.alt}`}
          >
            <Image src={img.src} alt={img.alt} fill className="object-cover group-hover:scale-105 transition-transform" />
          </button>
        ))}
      </div>

      {selected !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image lightbox"
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <Image
              src={images[selected].src}
              alt={images[selected].alt}
              width={1200}
              height={800}
              className="rounded-lg object-contain"
            />
            {images[selected].caption && (
              <p className="text-white/70 text-sm text-center mt-2">{images[selected].caption}</p>
            )}
            <button
              onClick={() => setSelected(null)}
              className="absolute top-2 right-2 text-white bg-black/50 rounded-full w-8 h-8 flex items-center justify-center"
              aria-label="Close lightbox"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

### Code Playground (Interactive)

```tsx
// components/mdx/CodePlayground.tsx — Sandpack integration
import { Sandpack } from '@codesandbox/sandpack-react';
import { githubLight } from '@codesandbox/sandpack-themes';

interface PlaygroundProps {
  files: Record<string, string>;
  entry?: string;
  template?: 'react' | 'react-ts' | 'vanilla' | 'nextjs';
}

export function CodePlayground({ files, entry = '/App.tsx', template = 'react-ts' }: PlaygroundProps) {
  return (
    <div className="my-6 rounded-lg overflow-hidden border border-gray-200">
      <Sandpack
        template={template}
        files={files}
        options={{
          showNavigator: false,
          showTabs: Object.keys(files).length > 1,
          editorHeight: 320,
          activeFile: entry,
        }}
        theme={githubLight}
      />
    </div>
  );
}

// Usage in MDX:
// <CodePlayground
//   files={{ '/App.tsx': "export default function App() { return <h1>Hello!</h1> }" }}
// />
```

---

## Connections

```
Calls → research (L3): SEO data and competitor analysis
Calls → marketing (L2): content promotion
Calls → @rune/ui (L4): typography system, article layout patterns, palette for content sites
Called By ← cook (L1): when content project detected
Called By ← marketing (L2): when creating blog content
```

## Cross-Pack Connections

| Pack | Connection | When |
|------|-----------|------|
| `@rune/analytics` | Page views, scroll depth, read time events → analytics pipeline | Any content site with tracking |
| `@rune/ui` | Article layout components, image galleries, typography system | Custom component-heavy MDX sites |
| `@rune/saas` | Auth-gated content (members-only posts), subscription paywalls | Premium content model |
| `@rune/ecommerce` | Product-linked blog posts, shoppable content, affiliate links | Commerce + content hybrid sites |

### Integration Patterns

**content + analytics**: Fire `content_view`, `scroll_depth`, and `read_complete` events from content pages into the analytics warehouse. Use `@rune/analytics` sql-patterns skill to build read-time dashboards.

**content + ui**: Share design tokens and typography scale. MDX custom components (Callout, CodeBlock, Gallery) follow the same design system as app UI components — import from shared `@/components/ui` rather than duplicating.

**content + saas**: Gate premium posts behind subscription check middleware. Redirect unauthenticated users to upgrade page. Use `@rune/saas` auth patterns for session validation in server components.

**content + ecommerce**: Inject product cards into MDX via `<ProductCard sku="...">` component that pulls live inventory data. Track affiliate link clicks as conversion events.

---

## Tech Stack Support

| Area | Options | Notes |
|------|---------|-------|
| Blog Framework | Contentlayer, MDX, Velite | Contentlayer most mature for Next.js |
| Headless CMS | Sanity, Contentful, Strapi, PocketBase | Sanity best DX; PocketBase self-hosted |
| MDX | next-mdx-remote, mdx-bundler, @next/mdx | next-mdx-remote for dynamic content |
| i18n | next-intl, i18next, Paraglide | next-intl for App Router |
| SEO | Next.js Metadata API, next-seo | Metadata API built-in since Next.js 13 |
| Search | Algolia, Meilisearch, Typesense | Meilisearch for self-hosted; Algolia for managed |
| Email | Resend, Mailchimp, ConvertKit | Resend for dev DX; Mailchimp for large lists |
| Images | sharp, next/image, Cloudinary | sharp for pre-processing; next/image for runtime |
| Analytics | Plausible, Tinybird, custom | Plausible for privacy-first; Tinybird for scale |
| Syntax | Shiki, Prism | Shiki recommended — themes match VS Code |
| Playground | Sandpack, CodeMirror | Sandpack for full browser environments |

## Constraints

1. MUST validate all CMS content against a schema before rendering — malformed data from CMS should not crash pages.
2. MUST include `hreflang` tags on all locale-specific pages — missing hreflang hurts international SEO ranking.
3. MUST NOT hardcode strings in components when i18n is configured — every user-visible string goes through the translation system.
4. MUST generate sitemap dynamically from actual content — static sitemaps go stale and list nonexistent pages.
5. MUST provide fallback for missing MDX components — a missing custom component should render a warning, not crash the build.
6. MUST set `width` + `height` on all images to prevent CLS — layout shift is a Core Web Vitals failure and SEO penalty.
7. MUST redirect old CMS URLs permanently (301) before go-live — 302 redirects are not followed by search engines for link equity.
8. MUST NOT expose Algolia/Meilisearch admin/write keys to the client — use separate search-only keys in frontend code.

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| CMS slug change breaks all inbound links (404 on old URLs) | HIGH | Implement redirect map in CMS; check for broken links on content publish webhook |
| Missing translation key shows raw key string (`home.title`) to users | HIGH | Configure fallback to default locale; run missing key detection in CI |
| MDX build crashes because custom component removed but still referenced in old posts | HIGH | Register fallback component that renders warning in dev, empty div in prod |
| Search index out of sync after CMS publish (new post not appearing in search) | HIGH | Trigger index update in CMS publish webhook, same endpoint as ISR revalidation |
| Sitemap includes draft/unpublished pages (indexed by Google before ready) | MEDIUM | Filter sitemap to `status === 'published'` only; add `noindex` to draft preview pages |
| `hreflang` tags point to wrong locale (en page links to vi version of different page) | MEDIUM | Generate hreflang from route params, not hardcoded; test with hreflang validator |
| JSON-LD structured data has schema errors (no rich snippets in search) | MEDIUM | Validate JSON-LD against Schema.org; test with Google Rich Results Test |
| Images without blurDataURL cause layout shift on slow connections | MEDIUM | Pre-generate blur placeholders during build; store alongside post metadata |
| Scheduled post fires twice if cron runs while previous invocation still running | LOW | Use idempotent status transition (published posts skip transition); add cron lock |

## Done When

- Blog system serves paginated posts with RSS feed and reading time
- CMS integration has preview mode, webhook revalidation, and content validation
- MDX pipeline renders custom components with fallback for missing ones
- All user-facing strings go through i18n with fallback chain configured
- Every public page has unique title, description, OG tags, canonical URL, and JSON-LD
- Search index stays in sync via publish webhook
- Newsletter capture and email delivery configured and tested
- Images optimized to WebP/AVIF with correct dimensions (no CLS)
- Core Web Vitals reporter active and LCP < 2.5s on key pages
- Structured report emitted for each skill invoked

## Cost Profile

~12,000–22,000 tokens per full pack run (all skills + new sections). Individual skill: ~2,000–4,000 tokens. Sonnet default. Use haiku for detection scans and alt-text audits; escalate to sonnet for CMS integration and SEO audit; use haiku for search indexing scripts.
