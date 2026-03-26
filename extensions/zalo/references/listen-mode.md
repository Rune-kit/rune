# Listen Mode & Real-Time Events Reference

> Loaded by `@rune/zalo` when WebSocket listener, real-time events, or webhook integration patterns detected.

---

## Listen Mode Architecture

WebSocket-based real-time message listener — captures all inbound messages, events, and reactions.

```
Zalo Server → WebSocket → zca-js listener → Event Router
                                              ├─ Webhook POST (n8n, Make, Zapier)
                                              ├─ JSONL file logging
                                              └─ JSON pipe (stdout → jq)
```

### Start Listener

```bash
# Basic — output to stdout as JSON
zalo-agent listen

# With event filter
zalo-agent listen -e message,group_message,reaction

# Forward to webhook URL
zalo-agent listen -w https://your-server.com/webhook

# Filter by specific groups
zalo-agent listen -f "group:abc123,group:def456"

# Exclude self-sent messages
zalo-agent listen --no-self

# Auto-accept friend requests
zalo-agent listen --auto-accept

# Save media to local directory
zalo-agent listen --save ./media/
```

---

## Event Types

| Event | Description | Payload |
|-------|-------------|---------|
| `message` | 1:1 DM received | `{ threadId, sender, text, attachments, timestamp }` |
| `group_message` | Group message received | `{ threadId, sender, text, mentions, attachments }` |
| `reaction` | Someone reacted to a message | `{ threadId, messageId, reactor, type }` |
| `friend_request` | Incoming friend request | `{ sender, message }` |
| `group_invite` | Group join invitation | `{ groupId, inviter }` |
| `typing` | Someone is typing | `{ threadId, sender }` |
| `seen` | Message read receipt | `{ threadId, reader, messageId }` |
| `undo` | Message recalled/unsent | `{ threadId, messageId }` |

### Event Filter Flags

```bash
# Only listen for DMs and reactions
zalo-agent listen -e message,reaction

# Only group messages from specific groups
zalo-agent listen -e group_message -f "group:abc,group:def"
```

---

## Integration Modes

### 1. Webhook POST (Recommended for n8n, Make, Zapier)

```bash
zalo-agent listen -w https://your-n8n.example.com/webhook/zalo
```

Sends `POST` with JSON body:

```json
{
  "event": "message",
  "thread_id": "user_12345",
  "sender": { "id": "67890", "name": "Nguyen Van A" },
  "text": "Hello bot",
  "timestamp": 1711234567890,
  "attachments": []
}
```

### 2. JSONL File Logging

```bash
# Log all messages to JSONL files per thread
zalo-agent listen --save ./logs/

# Creates:
# ./logs/user_12345.jsonl
# ./logs/group_abc.jsonl
```

### 3. JSON Pipe (jq, scripts)

```bash
# Pipe to jq for real-time filtering
zalo-agent listen --raw | jq 'select(.event == "message") | .text'

# Pipe to custom handler script
zalo-agent listen --raw --supervised | node handler.js
```

`--supervised` flag: outputs structured JSON with lifecycle events (connect, disconnect, error) — required for process managers.

---

## Production Setup

### pm2 (Recommended)

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'zalo-listener',
    script: 'zalo-agent',
    args: 'listen -w http://localhost:3001/webhook --no-self --supervised',
    autorestart: true,
    max_restarts: 50,
    restart_delay: 5000,
    exp_backoff_restart_delay: 1000, // exponential backoff on crashes
    max_memory_restart: '200M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
```

### systemd (Linux)

```ini
[Unit]
Description=Zalo Bot Listener
After=network.target

[Service]
Type=simple
User=zalobot
ExecStart=/usr/bin/zalo-agent listen -w http://localhost:3001/webhook --supervised
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### Auto-Reconnect Behavior

```
WebSocket drops → wait 5s → reconnect → re-authenticate with stored credentials
  ↓ fails
wait 10s → retry
  ↓ fails
wait 20s → retry (exponential backoff, max 60s)
  ↓ 10 failures
log CRITICAL, stop retrying, alert operator
```

---

## Session Keepalive

```typescript
// Keep session alive during idle periods
const KEEPALIVE_INTERVAL = 5 * 60_000 // 5 minutes

setInterval(() => {
  if (api.isConnected()) {
    api.ping() // Lightweight heartbeat
  }
}, KEEPALIVE_INTERVAL)

// Handle session expiry
listener.on('session_expired', async () => {
  logger.warn('Session expired — attempting credential re-login')
  try {
    await api.loginWithCredentials(storedCreds)
    logger.info('Re-login successful')
  } catch (err) {
    logger.error('Re-login failed — manual QR login required', err)
    process.exit(1) // Let pm2 handle restart, operator must QR login
  }
})
```

---

## Anti-Detection for Listen Mode

| Strategy | Description |
|----------|-------------|
| Consistent User-Agent | Don't change UA between sessions |
| Rate throttle responses | 500–2000ms random delay before replying |
| Avoid 3–6 AM activity | Reduce or stop bot activity during these hours |
| Long-lived sessions | Don't restart frequently — keep sessions running |
| No rapid friend ops | Friend add/remove triggers ban fastest |
| Single device fingerprint | Consistent IMEI across sessions |

### Human-Like Response Timing

```typescript
async function humanDelay(): Promise<void> {
  const delay = 500 + Math.random() * 1500 // 500–2000ms
  await new Promise(resolve => setTimeout(resolve, delay))
}

// Apply before every bot response
listener.on('message', async (msg) => {
  const response = await generateResponse(msg)
  await humanDelay() // look human
  await api.sendMessage(response, msg.threadId, 'User')
})
```

---

## Sharp Edges

- **Single WebSocket**: ONE listener per account — cannot run listen mode + browser Zalo simultaneously
- **Session cookie refresh**: Cookies expire periodically — listener must persist refreshed cookies back to credential file
- **IMEI consistency**: Changing IMEI between sessions = new device = re-verification required
- **Webhook timeout**: If webhook endpoint doesn't respond in 5s, message is logged but not retried
- **--supervised flag**: Required for pm2/systemd — without it, lifecycle events (disconnect/reconnect) are not surfaced
- **Media save**: `--save` downloads all media (images, videos, files) — monitor disk space
- **DuplicateConnection error**: Means another session (browser or another bot) is active — close the other session first
