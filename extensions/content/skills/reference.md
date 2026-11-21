---
name: "reference"
pack: "@rune/content"
description: "Shared reference patterns: content migration, search integration, newsletter/email, performance optimization, analytics, scheduling, accessibility, and rich media."
model: sonnet
tools: [Read, Edit, Write, Grep, Glob, Bash]
---

# @rune/content — Shared Reference Patterns

Supplementary patterns shared across multiple skills in this pack.

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
  // Call Claude claude-haiku-5-5 — fast, cheap for image description
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-5-5',
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

## Integration Patterns

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

---

## Constraints

1. MUST validate all CMS content against a schema before rendering — malformed data from CMS should not crash pages.
2. MUST include `hreflang` tags on all locale-specific pages — missing hreflang hurts international SEO ranking.
3. MUST NOT hardcode strings in components when i18n is configured — every user-visible string goes through the translation system.
4. MUST generate sitemap dynamically from actual content — static sitemaps go stale and list nonexistent pages.
5. MUST provide fallback for missing MDX components — a missing custom component should render a warning, not crash the build.
6. MUST set `width` + `height` on all images to prevent CLS — layout shift is a Core Web Vitals failure and SEO penalty.
7. MUST redirect old CMS URLs permanently (301) before go-live — 302 redirects are not followed by search engines for link equity.
8. MUST NOT expose Algolia/Meilisearch admin/write keys to the client — use separate search-only keys in frontend code.

---

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
- Video repurposing pipeline producing platform-ready vertical clips with captions
- Content scoring providing actionable improvement suggestions per dimension
- Structured report emitted for each skill invoked
