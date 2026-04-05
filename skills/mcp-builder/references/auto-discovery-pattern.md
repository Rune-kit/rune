# Auto-Discovery Tool Registry Pattern

Reference architecture for MCP servers that support partial deployment — tools register automatically at startup, gracefully skipping those with missing API keys.

## Problem

MCP servers with 10+ tools often require 5+ API keys. Requiring ALL keys before the server starts means users can't use any tools until every key is configured. This kills adoption.

## Pattern: Scan → Validate → Register

```
tools/
├── web-search/
│   └── index.ts       # exports: definition, handler, requiredEnvVars
├── reddit-search/
│   └── index.ts
├── youtube-search/
│   └── index.ts
└── content-scorer/
    └── index.ts       # no requiredEnvVars → always available
```

### Startup Flow

```typescript
// lib/tool-registry.ts
import { glob } from 'fs';

interface ToolModule {
  definition: ToolDefinition;
  handler: (params: unknown) => Promise<unknown>;
  requiredEnvVars?: string[];
}

async function discoverTools(toolsDir: string): Promise<Map<string, ToolModule>> {
  const registered = new Map<string, ToolModule>();
  const skipped: string[] = [];

  const toolDirs = await glob(`${toolsDir}/*/index.ts`);

  for (const toolPath of toolDirs) {
    const mod: ToolModule = await import(toolPath);

    // Check env vars — skip if missing
    const missing = (mod.requiredEnvVars ?? [])
      .filter(key => !process.env[key]);

    if (missing.length > 0) {
      skipped.push(`${mod.definition.name} (missing: ${missing.join(', ')})`);
      continue;
    }

    registered.set(mod.definition.name, mod);
  }

  if (skipped.length > 0) {
    console.error(`[registry] Skipped ${skipped.length} tools: ${skipped.join('; ')}`);
  }

  console.error(`[registry] Registered ${registered.size} tools`);
  return registered;
}
```

### Per-Tool Module Contract

```typescript
// tools/reddit-search/index.ts
import { z } from 'zod';

export const requiredEnvVars = ['RAPIDAPI_KEY'];

export const definition = {
  name: 'reddit_search',
  description: 'Search Reddit posts and comments. Use when researching community sentiment, finding discussions about a topic, or gathering user feedback.',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    subreddit: z.string().optional().describe('Limit to specific subreddit'),
    sort: z.enum(['hot', 'top', 'new', 'relevance']).default('relevance'),
    time_filter: z.enum(['hour', 'day', 'week', 'month', 'year', 'all']).default('month'),
    limit: z.number().min(1).max(25).default(10),
  }),
};

export async function handler(params: z.infer<typeof definition.inputSchema>) {
  // Implementation...
}
```

### Tools Without API Keys (Always Available)

```typescript
// tools/content-scorer/index.ts — no external dependencies
export const requiredEnvVars = []; // or omit entirely

export const definition = {
  name: 'content_scorer',
  description: 'Score content items by engagement with time-decay. Pure computation, no API calls.',
  inputSchema: z.object({
    items: z.array(ContentItemSchema),
    recency_weight: z.number().default(0.1),
  }),
};
```

## Key Design Rules

### 1. Graceful Degradation (Non-Negotiable)
- Missing API keys = tool is skipped, NOT a server crash
- Server MUST boot with 0 API keys configured (local-only tools still work)
- Log skipped tools to stderr (not stdout — MCP uses stdout for protocol)

### 2. Adding New Tools = Zero Core Changes
- Create `tools/<name>/index.ts` with the module contract
- Export `definition`, `handler`, and optionally `requiredEnvVars`
- Registry auto-discovers at next startup

### 3. Provider Fallback (Optional, Recommended)
For tools with multiple data sources, support tiered fallback:

```typescript
export const requiredEnvVars = []; // none required — has fallback chain

export async function handler(params) {
  // Tier 1: Dedicated API (best quality)
  if (process.env.GETX_API_KEY) {
    return await fetchFromGetXAPI(params);
  }
  // Tier 2: RapidAPI (good quality, shared key)
  if (process.env.RAPIDAPI_KEY) {
    return await fetchFromRapidAPI(params);
  }
  // Tier 3: Web search fallback (approximate)
  return await fetchViaWebSearch(params);
}
```

Mark output with `data_source: "api" | "web_search" | "mixed"` so downstream consumers know the reliability level.

### 4. Status Endpoint
Expose a `server_status` tool (or MCP resource) that reports which tools are active, which are skipped, and why:

```json
{
  "registered": ["web_search", "content_scorer", "reddit_search"],
  "skipped": [
    { "tool": "youtube_search", "reason": "Missing YOUTUBE_API_KEY" },
    { "tool": "linkedin_search", "reason": "Missing RAPIDAPI_KEY" }
  ],
  "total": 5,
  "active": 3
}
```

## When to Use This Pattern

| Server Type | Use Auto-Discovery? |
|-------------|-------------------|
| Single-API wrapper (1-3 tools) | NO — overkill, just require the key |
| Multi-source aggregator (5+ tools, 3+ APIs) | YES — users rarely have ALL keys |
| Internal tools (no external APIs) | NO — no env vars to gate on |
| Plugin system (user adds custom tools) | YES — extensibility is the point |

## Anti-Patterns

- **Crashing on missing keys** — kills adoption for users who only need 2 of 10 tools
- **Requiring all keys in .env** — users give up during setup
- **Silent skip without logging** — users don't know why a tool isn't available
- **Dynamic import without validation** — malformed tool modules crash the entire server
