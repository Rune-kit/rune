# MCP Server Production Reference

> Loaded by `@rune/zalo` when MCP server setup, production deployment, or cursor-based pagination patterns detected.

---

## MCP Server Modes

### Local (stdio)

```bash
# Start MCP server in stdio mode (for local Claude Code / AI IDE)
zalo-agent mcp start

# Connects via stdin/stdout — AI agent calls tools directly
```

### Remote (HTTP)

```bash
# Start MCP server in HTTP mode (for remote agents, multi-client)
zalo-agent mcp start --http 3847 --auth your-secret-token

# Clients connect via HTTP transport with Bearer auth
```

---

## Enhanced Tool Definitions

### zalo_get_messages — Cursor-Based Pagination

Replace simple queue polling with cursor-based pagination from a ring buffer:

```typescript
{
  name: 'zalo_get_messages',
  description: 'Get messages from ring buffer with cursor-based pagination.',
  inputSchema: {
    type: 'object',
    properties: {
      cursor: {
        type: 'string',
        description: 'Opaque cursor from previous response. Omit for latest messages.'
      },
      limit: {
        type: 'number',
        default: 20,
        maximum: 100,
        description: 'Max messages to return'
      },
      thread_id: {
        type: 'string',
        description: 'Filter by specific thread. Omit for all threads.'
      }
    }
  }
}
```

Returns:

```json
{
  "messages": [
    {
      "id": "msg_abc123",
      "thread_id": "user_456",
      "sender_name": "Nguyen Van A",
      "text": "Hello",
      "timestamp": 1711234567890,
      "type": "text",
      "attachments": []
    }
  ],
  "next_cursor": "eyJ0IjoxNzExMjM0NTY3ODkwfQ==",
  "has_more": true
}
```

### Implementation

```typescript
class RingBuffer {
  private buffer: Message[] = []
  private maxSize: number

  constructor(maxSize = 5000) {
    this.maxSize = maxSize
  }

  push(msg: Message) {
    this.buffer.push(msg)
    if (this.buffer.length > this.maxSize) {
      this.buffer = this.buffer.slice(-this.maxSize) // keep newest
    }
  }

  query(cursor?: string, limit = 20, threadId?: string): QueryResult {
    let startIdx = 0

    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString())
      startIdx = this.buffer.findIndex(m => m.timestamp > decoded.t)
      if (startIdx === -1) startIdx = this.buffer.length
    }

    let filtered = this.buffer.slice(startIdx)
    if (threadId) {
      filtered = filtered.filter(m => m.thread_id === threadId)
    }

    const page = filtered.slice(0, limit)
    const hasMore = filtered.length > limit

    const nextCursor = page.length > 0
      ? Buffer.from(JSON.stringify({ t: page[page.length - 1].timestamp })).toString('base64url')
      : cursor

    return { messages: page, next_cursor: nextCursor, has_more: hasMore }
  }
}
```

### zalo_list_threads — Active Conversations

```typescript
{
  name: 'zalo_list_threads',
  description: 'List active conversations with unread counts.',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', default: 20 },
      unread_only: { type: 'boolean', default: false }
    }
  }
}
```

Returns: `{ threads: [{ id, name, type, unread_count, last_message_at }] }`

### zalo_mark_read — Clear Buffer

```typescript
{
  name: 'zalo_mark_read',
  description: 'Mark messages as processed. Clears from unread count.',
  inputSchema: {
    type: 'object',
    required: ['thread_id'],
    properties: {
      thread_id: { type: 'string' },
      up_to_cursor: { type: 'string', description: 'Mark all messages up to this cursor as read' }
    }
  }
}
```

### zalo_view_image — Media Download

```typescript
{
  name: 'zalo_view_image',
  description: 'Download and view an image from a Zalo message locally.',
  inputSchema: {
    type: 'object',
    required: ['message_id'],
    properties: {
      message_id: { type: 'string' },
      save_to: { type: 'string', description: 'Local path to save. Default: temp directory.' }
    }
  }
}
```

---

## MCP Configuration

```json
// mcp-config.json
{
  "watchThreads": ["group_abc", "user_xyz"],
  "keywords": ["help", "support", "bug"],
  "buffer": {
    "maxSize": 5000,
    "persistPath": "./mcp-buffer.json"
  },
  "autoReconnect": true,
  "reconnectDelayMs": 5000
}
```

| Field | Description | Default |
|-------|-------------|---------|
| `watchThreads` | Only capture messages from these threads | All threads |
| `keywords` | Keyword triggers — only buffer matching messages | All messages |
| `buffer.maxSize` | Ring buffer capacity | 5000 |
| `buffer.persistPath` | Persist buffer to disk on shutdown | In-memory only |
| `autoReconnect` | Auto-reconnect WebSocket on disconnect | true |
| `reconnectDelayMs` | Delay before reconnect attempt | 5000 |

---

## Production Deployment

### pm2 (Recommended)

```bash
# ecosystem.config.js
module.exports = {
  apps: [{
    name: 'zalo-mcp',
    script: 'zalo-agent',
    args: 'mcp start --http 3847 --auth $MCP_AUTH_SECRET',
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    env: {
      NODE_ENV: 'production',
      MCP_AUTH_SECRET: 'your-secret'
    }
  }]
}

# Start
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### WebSocket Session Management

```
Key constraints:
1. ONE WebSocket connection per Zalo account — no parallelism
2. Browser Zalo and bot CANNOT coexist on same account
3. WebSocket drops on network change → auto-reconnect required
4. Session cookie expires → re-login with stored credentials
```

### Health Check Pattern

```typescript
// Periodic health check for MCP + WebSocket
setInterval(async () => {
  const wsAlive = api.isConnected()
  const lastMsg = ringBuffer.getLatest()?.timestamp ?? 0
  const silentMinutes = (Date.now() - lastMsg) / 60_000

  if (!wsAlive) {
    logger.error('WebSocket disconnected — attempting reconnect')
    await api.reconnect()
  }

  if (silentMinutes > 30 && wsAlive) {
    logger.warn(`No messages for ${silentMinutes.toFixed(0)}m — possible silent disconnect`)
    // Force reconnect if no messages for 60+ minutes
    if (silentMinutes > 60) await api.reconnect()
  }
}, 60_000) // check every minute
```

---

## Sharp Edges

- **Ring buffer vs queue**: Ring buffer overwrites oldest when full (no data loss notification). Queue drops with warning. Choose based on whether losing old messages is acceptable.
- **Cursor encoding**: Use `base64url` not `base64` — cursors appear in URLs and JSON, `+` and `/` cause issues
- **HTTP MCP auth**: `--auth` token is sent as `Bearer` header — use HTTPS in production or attacker can sniff the token
- **pm2 + credentials**: Never pass credentials as CLI args (visible in `ps aux`) — use env vars or credential file
- **Buffer persistence**: If `persistPath` is set, buffer writes to disk on SIGTERM — unclean kill loses buffered messages
- **WebSocket single-session**: Starting MCP server kicks out browser Zalo. Warn user before starting.
