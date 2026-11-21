---
name: "edge-serverless"
pack: "@rune/devops"
description: "Edge and serverless deployment patterns — Cloudflare Workers, Vercel Edge Functions, AWS Lambda, Deno Deploy. Covers runtime constraints, cold starts, streaming, state management, binding patterns, and common anti-patterns that cause production failures in serverless environments."
model: sonnet
tools: [Read, Edit, Write, Grep, Glob, Bash]
---

# edge-serverless

Edge and serverless deployment patterns — Cloudflare Workers, Vercel Edge Functions, AWS Lambda, Deno Deploy. Covers runtime constraints, cold starts, streaming, state management, binding patterns, and common anti-patterns that cause production failures in serverless environments.

#### Workflow

**Step 1 — Detect serverless platform**
Read `package.json`, `wrangler.toml`/`wrangler.jsonc`, `vercel.json`, `netlify.toml`, `serverless.yml`, `sam-template.yaml`, `deno.json`. Identify: platform (Cloudflare/Vercel/AWS/Deno), runtime (Node.js/Deno/Bun), entry points, bindings/integrations, and environment configuration.

**Step 2 — Audit against serverless anti-patterns**
Check for patterns that work in traditional servers but fail in serverless:

| Anti-Pattern | Why It Fails | Fix |
|---|---|---|
| `await response.text()` on unbounded data | Memory limit (128MB Workers, 1024MB Lambda) — OOM on large responses | Stream responses: pipe readable to writable without buffering |
| Module-level mutable variables | Serverless instances are shared across requests — cross-request data leaks | Use request-scoped variables or platform state primitives (KV, DurableObjects) |
| Floating promises (no await, no waitUntil) | Promise runs after response sent — errors swallowed, work may be killed | Every Promise must be `await`ed, `return`ed, or passed to `ctx.waitUntil()` |
| `Math.random()` for security tokens | Not cryptographically secure — predictable in serverless edge environments | Use `crypto.randomUUID()` or `crypto.getRandomValues()` |
| Direct database connections | Serverless creates a new connection per invocation — exhausts connection pool | Use connection pooling proxy (Hyperdrive, PgBouncer, Neon serverless driver) |
| `setTimeout`/`setInterval` for background work | Execution stops after response — timers are killed | Use platform queues (Cloudflare Queues, SQS) or `waitUntil` for fire-and-forget |
| Large `node_modules` bundled | Cold start penalty — 50ms per 1MB on Lambda, Workers have 10MB limit | Tree-shake, use ESM, consider edge-native alternatives to heavy packages |
| REST API calls to own platform services | Unnecessary network hop from inside the platform | Use in-process bindings (KV, R2, D1) not HTTP endpoints |

**Step 3 — Platform decision tree**
When deploying a new project, select the right platform:

```
What are you deploying?
├─ Static site + API routes → Vercel / Cloudflare Pages
├─ API-only (REST/GraphQL) → Cloudflare Workers / AWS Lambda
├─ Real-time (WebSocket) → Cloudflare Durable Objects / Fly.io
├─ Background jobs/queues → AWS SQS+Lambda / Cloudflare Queues
├─ Full-stack SSR → Vercel (Next.js) / Cloudflare Pages (any framework)
├─ Scheduled tasks (cron) → Cloudflare Cron Triggers / AWS EventBridge
├─ AI inference at edge → Cloudflare Workers AI / Vercel AI SDK
└─ Container workloads → Fly.io / Railway / Cloud Run
```

```
Where to store data?
├─ Key-value (sessions, config, cache) → Cloudflare KV / Vercel KV / DynamoDB
├─ Relational SQL → Cloudflare D1 / Neon / PlanetScale / Turso
├─ Object/file storage → Cloudflare R2 / S3 / Vercel Blob
├─ Vector embeddings → Cloudflare Vectorize / Pinecone / Turbopuffer
├─ Message queue → Cloudflare Queues / SQS / Upstash QStash
└─ Strongly consistent per-entity → Durable Objects / DynamoDB
```

**Step 4 — Emit deployment configuration**
Based on detected platform, emit production-ready config:

```toml
# wrangler.jsonc — Cloudflare Workers production config
{
  "name": "api-production",
  "main": "src/index.ts",
  "compatibility_date": "2025-03-15",
  "compatibility_flags": ["nodejs_compat"],
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1
  },
  "kv_namespaces": [
    { "binding": "CACHE", "id": "abc123" }
  ],
  "d1_databases": [
    { "binding": "DB", "database_name": "prod-db", "database_id": "def456" }
  ]
}
```

```json
// vercel.json — Vercel Edge Functions config
{
  "functions": {
    "api/**/*.ts": {
      "runtime": "edge",
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "s-maxage=60, stale-while-revalidate=300" }
      ]
    }
  ]
}
```

**Step 5 — Streaming and response patterns**
Emit correct streaming patterns for the detected platform:

```typescript
// Cloudflare Workers — streaming response (never buffer large data)
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const data = await env.R2_BUCKET.get('large-file.csv');
    if (!data) return new Response('Not found', { status: 404 });

    // CORRECT: stream the body directly — no buffering
    return new Response(data.body, {
      headers: { 'Content-Type': 'text/csv' },
    });
  },
};

// WRONG: buffering entire response in memory
// const text = await data.text(); // OOM on large files
// return new Response(text);
```

```typescript
// Vercel Edge Function — streaming AI response
import { OpenAI } from 'openai';

export const runtime = 'edge';

export async function POST(req: Request) {
  const { prompt } = await req.json();
  const openai = new OpenAI();

  const stream = await openai.chat.completions.create({
    model: 'gpt-6-luna',
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });

  // Stream chunks as they arrive — no buffering
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        controller.enqueue(encoder.encode(`data: ${text}\n\n`));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

#### Sharp Edges

| Failure Mode | Mitigation |
|---|---|
| Cold start exceeds timeout on first request | Pre-warm with scheduled pings; minimize bundle size; use edge runtime where possible |
| Connection pool exhaustion from serverless fan-out | Use connection pooling proxy (Hyperdrive, PgBouncer); limit concurrency |
| `ctx` destructuring loses `this` binding in Workers | Never destructure `ctx` — always call `ctx.waitUntil()` directly |
| Environment variable vs binding confusion | Workers use `env.SECRET` (binding), not `process.env.SECRET` — detect platform and emit correct pattern |
