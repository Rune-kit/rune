---
name: mcp-builder
description: Build Model Context Protocol servers from specifications. Generates tool definitions, resource handlers, and test suites for MCP servers in TypeScript or Python (FastMCP).
metadata:
  author: runedev
  version: "0.2.0"
  layer: L2
  model: sonnet
  group: creation
  tools: "Read, Write, Edit, Bash, Glob, Grep"
---

# mcp-builder

## Purpose

MCP server builder. Generates complete, tested MCP servers from a natural language description or specification. Handles tool definitions, resource handlers, input validation, error handling, configuration, tests, and documentation. Supports TypeScript (official SDK) and Python (FastMCP).

## Triggers

- Called by `cook` when MCP-related task detected (keywords: "MCP server", "MCP tool", "model context protocol")
- Called by `scaffold` when MCP Server template selected
- `/rune mcp-builder <description>` — manual invocation
- Auto-trigger: when project contains `mcp.json`, `@modelcontextprotocol/sdk`, or `fastmcp` in dependencies

## Calls (outbound)

- `ba` (L2): if user description is vague — elicit requirements for what tools/resources the server should expose
- `research` (L3): look up target API documentation, existing MCP servers for reference
- `test` (L2): generate and run test suite for the server
- `docs` (L2): generate server documentation (tool catalog, installation, configuration)
- `verification` (L3): verify server builds and tests pass

## Called By (inbound)

- `cook` (L1): when MCP-related task detected
- `scaffold` (L1): MCP Server template in Phase 5
- User: `/rune mcp-builder` direct invocation

## Executable Steps

### Step 1 — Spec Elicitation

If description is detailed enough (tools, resources, target API specified), proceed.
If vague, ask targeted questions:

1. **What tools should this MCP server expose?** (actions the AI can perform)
2. **What resources does it manage?** (data the AI can read)
3. **What external APIs does it connect to?** (if any)
4. **TypeScript or Python?** (default: TypeScript with @modelcontextprotocol/sdk)
5. **Authentication?** (API keys, OAuth, none)

If user provides a detailed spec or existing API docs → extract answers, confirm.

### Step 2 — Architecture Design

Determine server structure based on spec:

**TypeScript (default):**
```
mcp-server-<name>/
├── src/
│   ├── index.ts          — server entry point, tool/resource registration
│   ├── tools/
│   │   ├── <tool-name>.ts — one file per tool
│   │   └── index.ts       — tool registry
│   ├── resources/
│   │   ├── <resource>.ts  — one file per resource type
│   │   └── index.ts       — resource registry
│   ├── lib/
│   │   ├── client.ts      — external API client (if applicable)
│   │   └── types.ts       — shared types
│   └── config.ts          — environment variable validation
├── tests/
│   ├── tools/
│   │   └── <tool-name>.test.ts
│   └── resources/
│       └── <resource>.test.ts
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

**Python (FastMCP):**
```
mcp-server-<name>/
├── src/
│   ├── server.py          — FastMCP server with tool/resource decorators
│   ├── tools/
│   │   └── <tool_name>.py
│   ├── resources/
│   │   └── <resource>.py
│   ├── lib/
│   │   ├── client.py      — external API client
│   │   └── types.py       — Pydantic models
│   └── config.py          — settings via pydantic-settings
├── tests/
│   ├── test_<tool_name>.py
│   └── test_<resource>.py
├── pyproject.toml
├── .env.example
└── README.md
```

### Step 3 — Generate Server Code

#### Tool Generation

For each tool:

**TypeScript:**
```typescript
import { z } from 'zod';

export const toolName = {
  name: 'tool_name',
  description: 'What this tool does — used by AI to decide when to call it',
  inputSchema: z.object({
    param1: z.string().describe('Description for AI'),
    param2: z.number().optional().describe('Optional parameter'),
  }),
  async handler(input: { param1: string; param2?: number }) {
    // Implementation
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  },
};
```

**Python (FastMCP):**
```python
from fastmcp import FastMCP

mcp = FastMCP("server-name")

@mcp.tool()
async def tool_name(param1: str, param2: int | None = None) -> str:
    """What this tool does — used by AI to decide when to call it."""
    # Implementation
    return json.dumps(result)
```

#### Resource Generation

For each resource:
- URI template with parameters
- Read handler that returns structured content
- List handler for collections

#### Configuration

Generate `.env.example` with all required environment variables:
```env
# Required
API_KEY=your_api_key_here
API_BASE_URL=https://api.example.com

# Optional
LOG_LEVEL=info
CACHE_TTL=300
```

Generate config validation:
```typescript
// config.ts
import { z } from 'zod';

const envSchema = z.object({
  API_KEY: z.string().min(1, 'API_KEY is required'),
  API_BASE_URL: z.string().url().default('https://api.example.com'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export const config = envSchema.parse(process.env);
```

### Step 4 — Generate Tests

For each tool:
- **Happy path**: valid input → expected output
- **Validation**: invalid input → proper error message
- **Error handling**: API failure → graceful error response
- **Edge cases**: empty input, max limits, special characters

For each resource:
- **Read**: valid URI → expected content
- **Not found**: invalid URI → proper error
- **List**: collection URI → paginated results

```typescript
describe('tool_name', () => {
  it('should return results for valid input', async () => {
    const result = await toolName.handler({ param1: 'test' });
    expect(result.content[0].type).toBe('text');
    // Assert expected structure
  });

  it('should handle API errors gracefully', async () => {
    // Mock API failure
    const result = await toolName.handler({ param1: 'trigger-error' });
    expect(result.isError).toBe(true);
  });
});
```

### Step 5 — Generate Documentation

Produce README.md with:
- Server description and purpose
- Tool catalog (name, description, parameters, example usage)
- Resource catalog (URI templates, content types)
- Installation instructions (npm/pip, Claude Code config, Cursor config)
- Configuration reference (all env vars with descriptions)
- Example usage showing AI interactions

Claude Code installation snippet:
```json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["path/to/dist/index.js"],
      "env": {
        "API_KEY": "your_key"
      }
    }
  }
}
```

### Step 6 — Verify

Invoke `rune:verification`:
- TypeScript: `tsc --noEmit` + `npm test`
- Python: `mypy src/` + `pytest`
- Ensure all tools respond correctly
- Ensure configuration validation works

## Output Format

### Generated Project Structure

**TypeScript:**
```
mcp-server-<name>/
├── src/
│   ├── index.ts          — server entry, tool/resource registration
│   ├── tools/<name>.ts   — one file per tool (Zod input schema + handler)
│   ├── resources/<name>.ts — one file per resource (URI template + reader)
│   ├── lib/client.ts     — external API client
│   ├── lib/types.ts      — shared TypeScript interfaces
│   └── config.ts         — env var validation (Zod schema)
├── tests/tools/<name>.test.ts — per-tool tests (happy, validation, error, edge)
├── tests/resources/<name>.test.ts
├── package.json, tsconfig.json, .env.example, README.md
```

**Python (FastMCP):**
```
mcp-server-<name>/
├── src/
│   ├── server.py         — FastMCP server with @mcp.tool() decorators
│   ├── tools/<name>.py   — tool implementations
│   ├── resources/<name>.py
│   ├── lib/client.py     — external API client
│   ├── lib/types.py      — Pydantic models
│   └── config.py         — pydantic-settings
├── tests/test_<name>.py
├── pyproject.toml, .env.example, README.md
```

### README Structure
- Server description + tool catalog (name, description, params, example)
- Resource catalog (URI templates, content types)
- Installation: Claude Code, Cursor, Windsurf config snippets
- Configuration reference (env vars with descriptions)

## Constraints

1. MUST validate all tool inputs with Zod (TS) or Pydantic (Python) — never trust AI-provided inputs
2. MUST handle API errors gracefully — return MCP error responses, don't crash the server
3. MUST generate .env.example — never hardcode API keys or secrets
4. MUST generate tests — no MCP server without test suite
5. MUST generate installation docs for at least Claude Code — other IDEs are bonus
6. MUST use official MCP SDK (@modelcontextprotocol/sdk for TS, fastmcp for Python)
7. Tool descriptions MUST be AI-friendly — clear, specific, include parameter semantics

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Tool descriptions too vague for AI to use effectively | HIGH | Step 3: descriptions must explain WHEN to use the tool, not just WHAT it does |
| Missing input validation → server crashes on bad input | HIGH | Constraint 1: Zod/Pydantic validation on all inputs |
| Hardcoded API keys in generated code | CRITICAL | Constraint 3: always use env vars + .env.example |
| Tests mock everything → no real integration coverage | MEDIUM | Generate both unit tests (mocked) and integration test template (real API) |
| Generated server doesn't match MCP spec | HIGH | Use official SDK — don't hand-roll protocol handling |
| Installation docs only for Claude Code | LOW | Include Cursor/Windsurf config examples too |

## Done When

- Server specification elicited (tools, resources, target API, language)
- Architecture designed (file structure, module boundaries)
- Server code generated (tools, resources, config, types)
- Test suite generated (happy path, validation, errors, edge cases)
- Documentation generated (README with tool catalog, installation, config)
- Verification passed (types + tests)
- Ready to install in Claude Code / Cursor / other IDEs

## Cost Profile

~3000-6000 tokens input, ~2000-5000 tokens output. Sonnet — MCP server generation is a structured code task, not architectural reasoning.
