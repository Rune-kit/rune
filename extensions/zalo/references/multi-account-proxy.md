# Multi-Account & Proxy Management Reference

> Loaded by `@rune/zalo` when multi-account setup, proxy configuration, or production account management patterns detected.

---

## Multi-Account Architecture

Run multiple Zalo accounts on a single server — each with its own session, proxy, and WebSocket connection.

### Account Operations

| Command | Description |
|---------|-------------|
| `account list` | Show all registered accounts (ID, name, status, proxy) |
| `account login -n <name> -p <proxy>` | Login new account with proxy |
| `account switch <ownerId>` | Switch active account |
| `account remove <ownerId>` | Remove account and credentials |
| `account info <ownerId>` | Show account details |
| `account export -o <path>` | Export credentials for headless re-login |

### Login Flow

```bash
# First account — interactive QR login
zalo-agent login --qr-url
# Opens http://localhost:18927/qr — scan with Zalo app

# Additional accounts — with proxy
zalo-agent account login \
  -n "support-bot" \
  -p "socks5://user:pass@proxy1.example.com:1080"

# Headless re-login (VPS, CI/CD)
zalo-agent account export -o ./creds-support.json
zalo-agent login --credentials ./creds-support.json
```

### QR Server Ports

Port auto-tries in order: `18927 → 8080 → 3000 → 9000`. QR code expires after **60 seconds**.

For VPS without browser access:

```bash
# Start QR server accessible from outside
zalo-agent login --qr-url
# Access http://<VPS_IP>:18927/qr from your phone/laptop browser
```

---

## Proxy Configuration

### Why Proxies Are Required

Zalo detects multiple accounts from the same IP address. Without proxies:
- Accounts may be flagged for suspicious activity
- Rate limits are shared across all accounts on the same IP
- Ban on one account can cascade to others

### Rules

1. **1 unique proxy per account** — never share proxies between accounts
2. **Residential proxies preferred** — datacenter IPs are flagged more aggressively
3. **Vietnamese proxies recommended** — foreign IPs trigger additional verification
4. **Consistent proxy** — don't rotate proxies for the same account (triggers re-verification)

### Supported Formats

```
http://host:port
http://user:pass@host:port
https://user:pass@host:port
socks5://host:port
socks5://user:pass@host:port
```

### Implementation Pattern

```typescript
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'

function createProxyAgent(proxyUrl: string) {
  const url = new URL(proxyUrl)
  if (url.protocol.startsWith('socks')) {
    return new SocksProxyAgent(proxyUrl)
  }
  return new HttpsProxyAgent(proxyUrl)
}

// Per-account proxy assignment
const accounts: Map<string, { api: ZaloApi; proxy: string }> = new Map()

async function loginWithProxy(name: string, proxyUrl: string) {
  const agent = createProxyAgent(proxyUrl)
  const api = new ZaloApi({ proxy: agent, name })
  await api.login()
  accounts.set(api.ownerId, { api, proxy: proxyUrl })
}
```

---

## Credential Storage

```
~/.zalo-agent-cli/
├── credentials.json        # Default account
├── accounts/
│   ├── <ownerId1>.json     # Account 1 credentials
│   └── <ownerId2>.json     # Account 2 credentials
└── config.json             # Global config (proxies, defaults)
```

### Security Rules

- File permissions: `0600` (owner read/write only)
- **Never** log credential file contents
- **Never** commit to git (add to `.gitignore`)
- **Never** pass credentials as CLI arguments (visible in `ps aux`)
- Use environment variables or credential files for headless login

```bash
# .gitignore
.zalo-agent-cli/
*.zalo-creds.json
```

---

## Account Switching in Code

```typescript
class AccountManager {
  private accounts = new Map<string, ZaloApi>()
  private active: string | null = null

  async switch(ownerId: string): Promise<ZaloApi> {
    const api = this.accounts.get(ownerId)
    if (!api) throw new Error(`Account ${ownerId} not found`)
    this.active = ownerId
    return api
  }

  getActive(): ZaloApi {
    if (!this.active) throw new Error('No active account')
    return this.accounts.get(this.active)!
  }

  // Route messages to correct account
  async routeMessage(msg: InboundMessage) {
    const targetAccount = this.resolveAccount(msg.recipientId)
    const api = this.accounts.get(targetAccount)
    if (!api) return // account not managed

    await api.sendMessage(msg.response, msg.threadId, msg.type)
  }
}
```

---

## Production Multi-Account Setup

### pm2 Ecosystem

```javascript
// ecosystem.config.js — one process per account
module.exports = {
  apps: [
    {
      name: 'zalo-bot-main',
      script: 'zalo-agent',
      args: 'listen -w http://localhost:3001/webhook',
      env: { ZALO_ACCOUNT: 'main', ZALO_PROXY: 'socks5://user:pass@proxy1:1080' }
    },
    {
      name: 'zalo-bot-support',
      script: 'zalo-agent',
      args: 'listen -w http://localhost:3001/webhook',
      env: { ZALO_ACCOUNT: 'support', ZALO_PROXY: 'socks5://user:pass@proxy2:1080' }
    }
  ]
}
```

### Health Monitoring

```typescript
// Check all accounts periodically
async function healthCheck() {
  for (const [id, { api, proxy }] of accounts) {
    const connected = api.isConnected()
    const status = await api.getStatus().catch(() => 'error')

    if (!connected) {
      logger.error(`Account ${id} disconnected via ${proxy}`)
      await api.reconnect()
    }

    if (status === 'banned') {
      logger.critical(`Account ${id} BANNED — removing from rotation`)
      accounts.delete(id)
      // Alert operator
    }
  }
}

setInterval(healthCheck, 5 * 60_000) // every 5 minutes
```

---

## Sharp Edges

- **Proxy per account**: Sharing proxies between accounts = ban risk for ALL accounts on that proxy
- **QR expiry**: 60 seconds — have Zalo app ready before starting login
- **Session conflicts**: Only ONE active session per account — starting a new login invalidates existing sessions
- **Credential export**: Exported JSON contains session cookies — treat as sensitive as passwords
- **VPS QR access**: Firewall must allow inbound on QR port (18927) — close after login
- **Proxy rotation**: Do NOT rotate proxies for established sessions — Zalo treats IP change as suspicious
- **Rate limits per account**: Each account has independent rate limits — but shared IP without proxy means shared rate limit bucket
