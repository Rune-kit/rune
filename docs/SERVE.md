# `rune serve` — one Rune for every agent and every machine

Install Rune once on a server (a VPS, a home box, a team machine). Every agent you use — Claude Code, Grok Build / Cursor, Codex, Antigravity / Gemini CLI, Grok Bot, a Telegram bot — connects to it over [MCP](https://modelcontextprotocol.io) and uses Rune skills **without installing Rune locally**. Update Rune on the server and every agent gets the new skills on its next call.

```
  laptop: Claude Code ─┐
  desktop: Grok Build ─┤  MCP (HTTPS + key)   ┌──────────────── VPS ────────────────┐
  phone: Grok Bot ─────┼────────────────────▶ │ rune serve → Free + Pro + Business │
  Telegram bot ────────┘                      └─────────────────────────────────────┘
```

> **Status:** new in the release after 2.33.0. The MCP server (tools, prompts, key auth) is stable; `--runner`, `--tunnel` and `serve install` are **experimental**.

## How it works

`rune serve` exposes the skills installed on that machine as an MCP server:

| Tool | What it does |
|---|---|
| `list_skills(filter?, tier?, kind?)` | Discover skills — keyword search over names and descriptions |
| `get_skill(name)` | The skill's `SKILL.md` (or a pack's `PACK.md`) plus its list of reference files |
| `get_reference(skill, path)` | One file from the skill's folder, e.g. `references/phase-3.md` |
| `run_skill(name, input?)` | The skill's instructions with your request framed for the calling agent to execute now |

It also publishes **MCP prompts**, which most clients show as slash commands: a generic `rune` (`skill` + `task`) and one `rune-<skill>` per user-invocable skill and pack (`rune-cook`, `rune-video-creator`, `rune-pro-media`, …).

The server's MCP *instructions* tell the agent that Rune skills live on this server, so "use the video skill", `/rune video …` or `rune:cook` makes the agent call `run_skill` instead of looking on disk. Names are forgiving: `cook`, `rune:cook`, `/rune cook`, `@rune-pro/media`, a pack's sub-skill (`image-generator`) and an unambiguous prefix (`video` → `video-creator`) all resolve.

What gets served:

- **Free** — the 67 core skills and 14 extension packs from the installed `@rune-kit/rune` package.
- **Pro / Business** — detected exactly like `rune setup` does: `$RUNE_PRO_ROOT` / `$RUNE_BUSINESS_ROOT`, a `../Pro` / `../Business` sibling, or `~/rune-pro` / `~/rune-business`. Override with `--pro-root` / `--business-root`, or skip with `--no-tiers`.
- **Your own** — `--skills-dir a,b` adds folders of `<name>/SKILL.md` skills (tier `custom`).

The catalog is re-scanned every 30 s, so a `git pull` in a tier repo shows up without a restart.

## 1. Set up the server

```bash
# on the VPS (Node 18+)
npm i -g @rune-kit/rune
git clone https://github.com/rune-kit/rune-pro ~/rune-pro            # optional, if you bought Pro
git clone https://github.com/rune-kit/rune-business ~/rune-business  # optional, Business

rune serve                       # http://127.0.0.1:8787/mcp
```

The first run prints a key **once**:

```
  New server key (shown ONCE — store it in your password manager):
    rune_sk_…
```

Only its SHA-256 hash is stored, in `~/.rune/serve.json` (mode `0600`). Lost it? `rune serve key rotate` prints a new one; the running server accepts the new key (and rejects the old one) on the next request. For containers, set `RUNE_SERVE_KEY` instead and nothing is written to disk.

### Put it behind HTTPS

`rune serve` binds to `127.0.0.1` by default and speaks plain HTTP. Do not expose it directly. Pick one:

```bash
# Caddy — automatic Let's Encrypt certificate
caddy reverse-proxy --from rune.example.com --to 127.0.0.1:8787

# Cloudflare Tunnel — no open port, no certificate to manage
cloudflared tunnel --url http://127.0.0.1:8787
```

Behind a proxy, add `--trust-proxy` so the rate limit counts real client IPs (`X-Forwarded-For` / `CF-Connecting-IP`).

### Keep it running

```ini
# /etc/systemd/system/rune-serve.service
[Unit]
Description=Rune skill server (MCP)
After=network-online.target

[Service]
User=rune
ExecStart=/usr/bin/env rune serve --port 8787 --trust-proxy
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

`sudo systemctl enable --now rune-serve`. Run `rune serve` once by hand first so the key is printed to your terminal and not to the journal.

## 2. Connect your agents

Below, `URL` is `https://rune.example.com/mcp` and `KEY` is your `rune_sk_…` key.

**Claude Code**

```bash
claude mcp add --transport http rune https://rune.example.com/mcp \
  --header "Authorization: Bearer $KEY" --scope user
```

**Grok Build** (and Cursor, which Grok Build reads)

```bash
grok mcp add rune https://rune.example.com/mcp -H "Authorization: Bearer $KEY"
grok mcp doctor rune     # ✓ handshake OK, 4 tools discovered
```

For Cursor on its own, add to `~/.cursor/mcp.json`:

```json
{ "mcpServers": { "rune": { "url": "https://rune.example.com/mcp", "headers": { "Authorization": "Bearer rune_sk_…" } } } }
```

**OpenAI Codex**

```bash
export RUNE_KEY=rune_sk_…
codex mcp add rune --url https://rune.example.com/mcp --bearer-token-env-var RUNE_KEY
```

**Gemini CLI / Antigravity CLI**

```bash
gemini mcp add --transport http --scope user rune https://rune.example.com/mcp -H "Authorization: Bearer $KEY"
```

Antigravity IDE — add a remote MCP server with the same URL and `Authorization` header in its MCP settings.

**Grok Bot** — ask it: *"Add an MCP connector: URL `https://rune.example.com/mcp`, header `Authorization: Bearer <key>`."* Grok Bot adds remote MCP servers with a URL and headers; give it the key through its secure form rather than pasting it in chat. Grok Bot runs in the cloud, so the server must be reachable over public HTTPS (Caddy or Cloudflare Tunnel above), not `127.0.0.1`. After that, "use the Rune video skill to plan a teaser" works from any chat, including your phone.

**Telegram / custom bots** — use any MCP client SDK (TypeScript, Python, Go) with the Streamable HTTP transport and the `Authorization` header; call `run_skill` with the user's message.

**Clients without custom headers** — start the server with `--allow-query-key` and use `https://rune.example.com/mcp?key=…`. URLs end up in proxy and client logs, so prefer the header whenever the client supports one.

**No HTTP at all (stdio over SSH)** — `rune serve --stdio` speaks MCP on stdin/stdout with no key (SSH is the auth):

```bash
claude mcp add rune -- ssh my-vps rune serve --stdio
```

## 3. Use it

```
> use the rune video skill to plan a 30-second teaser for our launch
> /rune cook add rate limiting to the API
> /mcp__rune__rune-pro-media hero image for the pricing page      (Claude Code prompt syntax)
> which Rune skills help with GDPR?
```

## What runs where

`run_skill` returns instructions; **the calling agent does the work with its own tools**. That is the point: a skill that edits your repo (cook, fix, test, rescue …) still edits the repo on your machine — the server only supplies the playbook. Skills that produce a self-contained deliverable (a video plan, copy, a report) need nothing local at all.

Limits to know:

- **Hooks don't run remotely.** preflight / sentinel / completion-gate gating needs `rune hooks install` on the machine where the agent runs. Over MCP, skills are guidance only.
- **`scripts/` don't run remotely.** Skills that call a bundled script describe what it does; the agent emulates it or skips it.
- **User-invoked-only skills** (`launch`, `deploy`, `incident`) are served with a warning that the agent must have an explicit request from you.
- **No server, no skills.** If the VPS is down, agents lose Rune until it is back. Keep a local install where that matters.
- **Your license still applies.** Pro and Business are licensed to you (or your team). Serve them to your own agents, not to the public.

## Security

- Bearer key on every `/mcp` request (constant-time compare against the stored hash); `X-Rune-Key` is accepted too.
- `/health` is public and returns only name, version and skill count.
- Rate limit: 120 requests / minute / IP (`--rate-limit`), plus 10 failed-auth attempts / minute / IP.
- Request bodies over 1 MB are refused; file reads are capped at 256 KB (`--max-bytes`).
- Reads are confined to the skill's own folder: absolute paths, `..` and symlinks that leave the folder are rejected, and only text files are served.
- The MCP server never runs shell commands. (The experimental `--runner` below is the one opt-in exception.)

## Reference

```
rune serve [--port 8787] [--host 127.0.0.1]     Streamable HTTP at /mcp (bearer key)
           [--skills-dir <dir>[,<dir>]]         extra skill folders (tier "custom")
           [--pro-root <dir>] [--business-root <dir>] [--no-tiers]
           [--rate-limit 120] [--max-bytes 262144] [--trust-proxy]
           [--allow-query-key] [--config <file>] [--name rune]
rune serve --stdio                              MCP over stdio (local or via ssh)
rune serve key rotate                           mint a new key, print it once
rune serve key path                             where the key hash lives
```

Environment: `RUNE_SERVE_KEY` (fixed key, nothing stored), `RUNE_SERVE_CONFIG` (key file path), `RUNE_PRO_ROOT`, `RUNE_BUSINESS_ROOT`.

The server is stateless Streamable HTTP (JSON responses, no sessions), so it works behind any reverse proxy or load balancer.
