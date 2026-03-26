---
name: "@rune/zalo"
description: Zalo platform integration — Official Account API (OAuth2, messaging, webhooks, MCP server) and personal account automation (zca-js). Dual-track with explicit risk gating.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L4
  price: free
  target: Vietnamese developers building Zalo bots, OA automation, and AI agent integrations
  format: split
---

# @rune/zalo

## Purpose

Zalo is Vietnam's dominant messaging platform (~75M users) but its developer ecosystem has critical gaps: no Node.js SDK, zero webhook handling in official SDKs, undocumented rate limits, and confusing dual-token OAuth2 flows. This pack provides production-ready guidance for two tracks:

**Track A — Official Account API** (production-safe): OAuth2 PKCE, 8 message types, webhook server, token lifecycle, and MCP server blueprint for AI agent integration. Use this for business chatbots, customer support automation, and notification systems.

**Track B — Personal Account via zca-js** (unofficial, risk-gated): QR login, personal/group messaging, media handling. Use this for personal bots, group utilities, and rapid prototyping before committing to OA.

Both tracks share a rate limiting skill — the #1 cause of account bans.

## Best Fit

- Vietnamese dev teams building Zalo OA chatbots or customer support automation
- AI agent projects that need Zalo as a communication channel (MCP server pattern)
- Personal automation: group bots, notification forwarders, quick prototypes
- Projects migrating from unofficial to official Zalo API

## Not a Fit

- Facebook Messenger, Telegram, or Discord bots — different APIs entirely
- ZaloPay payment integration (separate API surface, not covered here)
- Zalo Mini App development (JSAPI bridge, not OA/personal messaging)

## Triggers

- Auto-trigger: when `zalo`, `zca-js`, `@anthropic-ai/sdk` + Zalo context detected
- `/rune zalo-oa` — Official Account setup and messaging
- `/rune zalo-personal` — Personal account automation
- `/rune zalo-mcp` — MCP server for AI agent ↔ Zalo
- `/rune zalo-rate` — Rate limiting and anti-ban strategies
- Called by `cook` (L1) when Zalo integration task detected
- Called by `mcp-builder` (L2) when building Zalo MCP server

## Skills Included

| Skill | Model | Track | Description |
|-------|-------|-------|-------------|
| [zalo-oa-setup](skills/zalo-oa-setup.md) | sonnet | A | OAuth2 PKCE flow, dual token management (User vs OA), app registration, appsecret_proof signing, token auto-refresh middleware. |
| [zalo-oa-messaging](skills/zalo-oa-messaging.md) | sonnet | A | All 8 OA message types (text, image, file, sticker, list, template, transaction, promotion), follower management, broadcast with demographic targeting. |
| [zalo-oa-webhook](skills/zalo-oa-webhook.md) | sonnet | A | Webhook server setup, event routing, signature verification, retry handling, event type catalog, Express/Fastify/Hono patterns. |
| [zalo-oa-mcp](skills/zalo-oa-mcp.md) | sonnet | A | MCP server blueprint — tools for read/send/broadcast, webhook-to-MCP bridge, credential storage, AI agent conversation loop. |
| [zalo-personal-setup](skills/zalo-personal-setup.md) | sonnet | B | zca-js setup, QR login flow, credential persistence, session management, WebSocket listener, keepAlive, anti-detection baseline. |
| [zalo-personal-messaging](skills/zalo-personal-messaging.md) | sonnet | B | Personal/group messaging, media (image/video/voice/sticker), reactions, group management (create, members, settings), mention gating, message buffer. |
| [zalo-rate-guard](skills/zalo-rate-guard.md) | sonnet | Shared | Rate limiting patterns for both tracks — token bucket per endpoint, exponential backoff, queue management, quota monitoring, anti-ban strategies. |

## Risk Gate — Track B (Personal Account)

<HARD-GATE>
Track B skills use unofficial reverse-engineered APIs via zca-js.
Before ANY Track B implementation, the developer MUST acknowledge:

1. **ToS violation**: Personal account automation violates Zalo's Terms of Service
2. **Ban risk**: Account can be suspended without warning
3. **Single-session**: Cannot run bot + personal Zalo simultaneously on same account
4. **API instability**: Zalo can break the internal API at any time without notice
5. **No support**: Zalo will not help with issues caused by unofficial API usage

Track B is for: personal projects, prototypes, group utilities.
Track B is NOT for: production business systems, customer-facing bots, high-volume messaging.

For production use → Track A (Official Account API).
</HARD-GATE>

## Connections

```
Calls → mcp-builder (L2): zalo-oa-mcp uses mcp-builder patterns for server scaffolding
Calls → sentinel (L2): credential handling triggers security review
Calls → rate-guard (shared): all messaging skills call rate-guard before API calls
Calls → verification (L3): verify webhook server is running and receiving events
Called By ← cook (L1): when Zalo integration task detected in project
Called By ← scaffold (L1): when bootstrapping a Zalo bot project
Called By ← mcp-builder (L2): when building Zalo-specific MCP server
```

## Tech Stack

| Component | Recommended | Alternatives |
|-----------|-------------|--------------|
| Runtime | Node.js 20+ | Bun, Deno |
| OA HTTP client | undici / fetch | axios |
| Personal API | zca-js | none (only option) |
| Webhook server | Hono | Express, Fastify |
| MCP framework | @anthropic-ai/sdk | custom |
| Queue (rate limit) | p-queue | bottleneck, bull |
| Validation | zod | joi |

## Constraints

1. All skills MUST reference Zalo OA API v3 (not deprecated v2)
2. Track B skills MUST display HARD-GATE risk disclaimer before execution
3. Rate limiting MUST be implemented before any messaging — no fire-and-forget
4. Credentials (tokens, cookies, secrets) MUST never be logged or committed
5. Webhook signature verification MUST NOT be skipped — even in development

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| OAuth2 access token expires (1h) without auto-refresh causing silent API failures | HIGH | Implement token refresh middleware that intercepts 401 responses and retries with new token before propagating errors |
| zca-js session lost when running personal bot and Zalo app simultaneously on same account | HIGH | Use a dedicated account for bot automation — single-session limit is non-negotiable on Track B |
| Webhook signature verification skipped in development, then deployed to production unsigned | HIGH | Always validate `X-Zalo-Signature` header from first commit — skip in dev only via explicit `SKIP_WEBHOOK_VERIFY=true` env flag |
| Rate limit hit causes account ban with no warning (HTTP 429 mishandled as transient error) | HIGH | Implement token bucket per endpoint; treat sustained 429s as ban-risk signal and back off for 60+ seconds |

## References

| Reference | Trigger |
|-----------|---------|
| [VietQR & Banking](references/vietqr-banking.md) | Payment, bank transfer, QR code patterns detected |
| [Conversation Management](references/conversation-management.md) | Polls, auto-reply, mute/archive, advanced messaging |
| [MCP Production](references/mcp-production.md) | MCP server deployment, cursor pagination, pm2 setup |
| [Multi-Account & Proxy](references/multi-account-proxy.md) | Multi-account setup, proxy configuration, VPS deployment |
| [Listen Mode](references/listen-mode.md) | WebSocket listener, real-time events, webhook forwarding |
| [Eval Scenarios](references/eval-scenarios.md) | Quality gate — 24 test scenarios (functional + security) |

## Credits

This pack was originally inspired by and incorporates patterns from:

- **[zalo-agent-cli](https://github.com/PhucMPham/zalo-agent-cli)** by PhucMPham (MIT) — CLI tool for Zalo automation, 90+ commands, MCP server, VietQR banking integration
- **[openzalo](https://github.com/darkamenosa/openzalo)** by darkamenosa — OpenClaw channel plugin for Zalo personal accounts via openzca CLI
- **[zca-js](https://github.com/RFS-ADRENO/zca-js)** — Unofficial Zalo client library (reverse-engineered API)

## Done When

- OA OAuth2 flow working with auto-refresh
- All 8 message types documented with request/response examples
- Webhook server receiving and routing events correctly
- MCP server operational: agent can read and send Zalo messages
- Rate limiting active on all outbound API calls
- Track B: QR login + personal/group messaging working with risk gate shown
