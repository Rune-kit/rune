# Detach Protocol — session-bridge oracle-mode integration

## Purpose

Decouple the primary AI agent from slow heavy-model second-opinion calls so the agent can continue with adjacent work instead of blocking 1-10 minutes on Opus-class reasoning.

## State Machine

```
                  oracle.dispatched
                        │
                        ▼
                  ┌──────────┐
                  │ pending  │◄────────┐
                  └──────────┘         │
                   │     │             │ poll (no timeout)
                   │     │             │
       reply       │     │  timeout    │
       arrives     │     │  exceeded   │
                   ▼     ▼             │
            ┌──────────┐ ┌──────────┐  │
            │ complete │ │  failed  │  │
            └──────────┘ └──────────┘  │
                   │           │       │
                   │           │       │
                   ▼           ▼       │
              consumed      cleaned    │
              (caller       up after   │
               reads        24h        │
               response)               │
                                       │
              ┌────────────────────────┘
              │
        reattach poll
        (every phase boundary)
```

## File Layout

```
.rune/
└── oracle-pending/
    ├── oracle-1714234500-abc123.json   # active dispatch
    ├── oracle-1714234600-def456.json   # active dispatch
    └── oracle-1714150000-old.json      # >24h, will be cleaned next session start
```

One file per dispatch. No master index — directory listing IS the queue.

## Dispatch Flow (D1-D4)

1. **D1 Receive**: `oracle.dispatched` arrives with `{sessionId, triggerSignal, sourceSkill, targetModel, bundleHash}`.

2. **D2 Idempotency**: Glob `.rune/oracle-pending/*.json`. If any pending record matches `bundleHash` → return its `sessionId` to caller. Skip D3-D4.

3. **D3 Write record**: Create `<sessionId>.json` with full schema. `status=pending`, `timeoutAt = dispatchedAt + 10min` (configurable via `RUNE_ORACLE_TIMEOUT_SEC`).

4. **D4 Return control**: Caller (`adversary`) returns the sessionId to its parent (`debug`/`fix`). Parent agent emits its non-blocking continuation marker and resumes adjacent work.

## Reattach Flow (D5)

Called by `cook` Phase 4 (between tasks) or `team` workstream coordinator (before next worker dispatch):

```
session-bridge --reattach <sessionId>
```

Returns one of:
- `{ status: "complete", responseExcerpt: "...", responseId: "..." }` — primary agent consumes the reply
- `{ status: "pending", remainingMs: 234000 }` — primary agent works on next independent task, polls again next phase boundary
- `{ status: "failed", reason: "timeout" | "rejected" | "no_citations" }` — primary agent continues without second opinion

After `complete` is consumed, the record is renamed `<sessionId>.consumed.json` and removed at next cleanup.

## Cleanup Flow (D6)

On every session start (load-mode entry), session-bridge scans `.rune/oracle-pending/`:
- For each `*.json` file: read `dispatchedAt`. If `now - dispatchedAt > 24h`, delete the file
- Log cleanup count to `session-log.md` (e.g. "cleaned 3 orphaned oracle-pending records")

## Concurrency Considerations

**Single primary agent** (typical Claude Code session): no concurrency concern. Sequential reads/writes.

**Multi-agent (`team` parallel workstreams)**: each workstream may have its own pending record. Idempotency in D2 prevents two workers from dispatching the same bundle. Different bundles produce different sessionIds → no collision.

**File-system write atomicity**: write to `<sessionId>.json.tmp` first, then `fs.rename` to final name (atomic on POSIX, atomic-enough on NTFS for our purposes).

## Failure Modes

| Symptom | Likely Cause | Recovery |
|---------|--------------|----------|
| Duplicate sessionIds in directory | Hash collision (unlikely) or clock skew | sessionId includes timestamp; collision in same millisecond = caller's bug |
| Pending record never reaches `complete` | Network failure, model timeout | D5 detects `timeoutAt` exceeded → emit `oracle.failed` reason=`timeout` |
| Pending record JSON corrupt | Disk full mid-write | D5 read fails → log warning, treat as `failed` reason=`corrupt`, primary continues |
| Cleanup deletes record while reattach polling | TOCTOU race | D6 only deletes records >24h old; active dispatches (<10min) safe |

## Configuration

Environment variables (all optional):

- `RUNE_ORACLE_TIMEOUT_SEC` — override default 600s timeout
- `RUNE_ORACLE_PENDING_DIR` — override `.rune/oracle-pending/` location
- `RUNE_ORACLE_CLEANUP_HOURS` — override default 24h orphan threshold

## Why Filesystem (vs in-memory queue)

1. **Survives session restart** — if Claude Code session is reloaded mid-dispatch, the pending record is still there
2. **No new infra** — no Redis, no SQLite, no external service
3. **Inspectable** — user can `cat .rune/oracle-pending/*.json` to debug
4. **Cross-process safe** — `team` parallel workstreams in different processes can coordinate via file system
