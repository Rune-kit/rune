# session-bridge — Detach mode

> Reference for `skills/session-bridge/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Detach Mode (v0.8.0)

Triggered by `oracle.dispatched` from `adversary` oracle-mode. Decouples the primary agent from a slow heavy-model call so the agent can continue adjacent work while the second model reasons.

**Why**: Opus-class reasoning takes 1-10 minutes wall time. Synchronous waits kill primary-agent throughput, especially in `team` parallel workstreams.

### Step D1 — Receive dispatch

When `oracle.dispatched` arrives, payload contains:
- `sessionId` — caller-provided unique id
- `triggerSignal` — `agent.stuck` or manual
- `sourceSkill` — `debug` | `fix` | manual
- `targetModel` — concrete model name (e.g. `gpt-6.2-sol`, `gemini-4-carbon`, `claude-opus-5-5`, `claude-fable-5-2`)
- `bundleHash` — sha256 of the bundled context (idempotency key)

### Step D2 — Idempotency check

Look up `.rune/oracle-pending/<sessionId>.json` AND any pending file with matching `bundleHash`. If a pending record with status=`pending` and the same `bundleHash` exists, **return the existing sessionId** — do NOT dispatch a duplicate.

### Step D3 — Write pending record

Create `.rune/oracle-pending/<sessionId>.json`:

```json
{
  "sessionId": "oracle-1714234500-abc123",
  "dispatchedAt": "2026-04-27T12:34:56Z",
  "triggerSignal": "agent.stuck",
  "sourceSkill": "debug",
  "targetModel": "claude-opus-5-5",
  "bundleHash": "sha256:9f3a...",
  "status": "pending",
  "timeoutAt": "2026-04-27T12:44:56Z",
  "responseId": null,
  "responseExcerpt": null
}
```

`timeoutAt` defaults to `dispatchedAt + 10min`.

### Step D4 — Return control to caller

Caller (`adversary`) receives the sessionId and returns to the primary orchestrator. Primary agent (`cook`/`team`) continues adjacent phases.

### Step D5 — Reattach (called by primary agent between phases)

Invocation: `session-bridge --reattach <sessionId>` (or via `oracle.dispatched` listen → poll).

Behavior:
1. Read `.rune/oracle-pending/<sessionId>.json`
2. If `status=complete` → return `responseExcerpt` to caller, mark record as consumed
3. If `status=pending` AND `now >= timeoutAt` → set `status=failed`, emit `oracle.failed` reason=`timeout`
4. If `status=pending` AND `now < timeoutAt` → return `not_ready` to caller, primary agent works on next independent task

### Step D6 — Cleanup

On every session start, scan `.rune/oracle-pending/` for records older than 24h. Delete them — they are orphaned.

### Pending Record Schema

| Field | Type | Required |
|-------|------|----------|
| sessionId | string (matches `^oracle-\d+-[a-z0-9]+$`) | yes |
| dispatchedAt | ISO 8601 timestamp | yes |
| triggerSignal | string | yes |
| sourceSkill | enum: `debug` \| `fix` \| `manual` | yes |
| targetModel | string | yes |
| bundleHash | string (matches `^sha256:[a-f0-9]{8,64}$`) | yes |
| status | enum: `pending` \| `complete` \| `failed` | yes |
| timeoutAt | ISO 8601 timestamp | yes |
| responseId | string \| null | yes (null until status=complete) |
| responseExcerpt | string ≤500 chars \| null | yes |
