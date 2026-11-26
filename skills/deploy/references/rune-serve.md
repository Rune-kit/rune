# Deploying a Rune skill server (`rune serve`) for the user

Use when the user asks you to "set up rune serve", "put Rune on my VPS", or "connect Grok Bot / my agents to Rune". Everything is non-interactive; run it over SSH. Full docs: `docs/SERVE.md`.

## 1. Install and set up (on the server)

```bash
ssh <user>@<host> 'npm i -g @rune-kit/rune'                       # Node 18+; global, not npx (services need a stable path)
# optional, only if the user owns them (private repos — use THEIR git credentials, never paste tokens into commands):
ssh <user>@<host> 'git clone https://github.com/rune-kit/rune-pro ~/rune-pro'
ssh <user>@<host> 'rune serve setup --yes --json --expose tunnel --key-out ~/.rune/serve.key'
```

- `--expose tunnel` = Cloudflare quick tunnel (downloads `cloudflared` to `~/.rune/bin` if missing; no root, no domain). Use `--expose domain --domain rune.example.com` when the user has a domain (then apply the printed `exposure.caddyfile`), `--expose tailscale` if Tailscale is installed, `--expose local` for agents on the same machine only.
- Pro/Business are auto-detected (`~/rune-pro`, `~/rune-business`, `$RUNE_PRO_ROOT`); force with `--pro-root`/`--business-root`, skip with `--no-tiers`.
- A systemd **user** service is installed automatically on a VPS with systemd (`--no-service` for a plain background process). If the report lists `sudo loginctl enable-linger …` under `next`, ask the user before running sudo.

## 2. Read the JSON report — and keep the key out of the transcript

Check: `ok: true`, `health.local.handshake.ok: true`, `health.public.reachable: true` (tunnel/domain), `exposure.publicUrl`.
`warnings[]` and `next[]` are things to tell the user.

With `--key-out` the key is in `~/.rune/serve.key` (0600) and **not** in the report. Do not `cat` it into your context. Tell the user:
"Your Rune key is in `~/.rune/serve.key` on the server — copy it into your password manager, then delete the file."
If the user explicitly wants you to wire clients up for them, read it once and pass it straight into the client config / secure form — never echo it into chat.

## 3. Connect the user's agents

```bash
ssh <user>@<host> 'rune serve connect all'          # or: grok-bot | claude | grok | codex | cursor | gemini | antigravity
```

The output never contains the key (it uses `$RUNE_KEY`). Grok Bot needs the public https URL; the key goes into Grok Bot's secure form, never into chat.

## 4. Verify and maintain

```bash
ssh <user>@<host> 'RUNE_KEY=$(cat ~/.rune/serve.key) rune serve doctor'   # exit 0 = local + public health, auth, MCP handshake OK
ssh <user>@<host> 'rune serve status --json'                              # running? pid, URLs, skill count
ssh <user>@<host> 'rune serve start'   # after a reboot without a service; re-applies the saved setup
ssh <user>@<host> 'rune serve stop'
ssh <user>@<host> 'rune serve key rotate'                                 # lost key — then update every client
```

Quick-tunnel URLs change on every restart: after one, run `rune serve connect grok-bot` and give the user the new URL. For a fixed URL use `--expose domain` or a named Cloudflare tunnel.

## Never

- Bind `--host 0.0.0.0` without HTTPS in front.
- Put the key in a URL, a commit, a log, or a chat message.
- Re-run `setup --rotate-key` unless the user asked — it breaks every connected client.
