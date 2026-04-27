# Context Preview Gate

## Purpose

Pre-flight cost check for expensive escalations. Before any caller bundles a large context for dispatch (oracle-mode second-opinion, parallel workstream spawn, multi-file review, cross-pack audit), `context-engine` emits `context.preview` with a token-cost estimate and an action recommendation. The caller decides whether to proceed, warn, or abort.

## Why

Without a preview gate:
- Callers learn about budget overruns only after dispatch — too late to prune
- `team` parallel workstreams can blow $20 of Opus tokens silently
- Users have no way to enforce per-call cost ceilings

With the preview gate:
- Costs are visible at decision time, not bill time
- Per-caller thresholds enforce different budgets per use case
- Hard `block` action prevents accidental runaway

## Token Estimation

```
estimated_tokens = total_chars × 0.25
```

Where `total_chars` includes:
- The bundle's `[SYSTEM]` line
- The `[USER]` problem statement
- Every `### File N: <path>` header
- Every file body (post-truncation, post-redaction)

The `0.25` ratio is calibrated for English code/markdown:

| Content type | Calibration |
|--------------|-------------|
| English code (TypeScript/Python/JS) | accurate ±10% |
| English markdown / docs | accurate ±5% |
| Japanese / Chinese / Korean | underestimates by 30-50% |
| Highly-repetitive (lots of imports) | overestimates by 20-30% |

Both error directions are safe:
- Overestimate → over-cautious block, caller can manually override
- Underestimate → caller still hits the dispatch-time hard cap (e.g. adversary's 100k token limit) and aborts with `oracle.failed`

## Threshold Defaults

| Caller | warn-at | block-at | Rationale |
|--------|---------|----------|-----------|
| `adversary` oracle-mode | 50,000 | 100,000 | Single-shot diagnosis; 100k matches second-model context budget |
| `team` parallel workstream (per worker) | 30,000 | 80,000 | Per-worker; total may be 5x if 5 workers spawn |
| `review` multi-file | 40,000 | 100,000 | Code review benefits from breadth; cap protects opus budget |
| `audit` cross-pack | 60,000 | 120,000 | Audit is intentionally broad; raised cap reflects intent |

### Override

Set environment variables to override per-caller thresholds:

```
RUNE_CONTEXT_THRESHOLDS_ADVERSARY=warn:60000,block:120000
RUNE_CONTEXT_THRESHOLDS_TEAM=warn:40000,block:100000
RUNE_CONTEXT_THRESHOLDS_REVIEW=warn:50000,block:130000
RUNE_CONTEXT_THRESHOLDS_AUDIT=warn:80000,block:150000
```

## Action Decision

```
if estimated_tokens >= block_at:
    action = "block"
elif estimated_tokens >= warn_at:
    action = "warn"
else:
    action = "proceed"
```

## Caller Integration

### `adversary` oracle-mode

```
Phase 0 (pre-bundle): emit context.preview { caller: adversary, files: [...], prompt: "..." }
  context-engine returns { action: "proceed" }     → continue with bundle build
  context-engine returns { action: "warn" }        → log warning, continue
  context-engine returns { action: "block" }       → abort, emit oracle.failed reason=context_budget_exceeded
```

### `team` parallel workstream

```
Phase 2 ASSIGN (per worker): emit context.preview { caller: team, files: [...] }
  proceed → spawn worker
  warn    → log warning, spawn worker
  block   → reduce worker scope or split into 2 smaller workers
```

### `review` multi-file

```
Entry step: emit context.preview { caller: review, files: [...] }
  proceed → run review
  warn    → log warning, run review
  block   → ask user to narrow file scope (e.g. specific subdirectory)
```

### `audit` cross-pack

```
Entry step: emit context.preview { caller: audit, files: [...] }
  proceed → run audit
  warn    → log warning, run audit
  block   → reduce audit scope (e.g. one pack at a time)
```

## Signal Payload

```yaml
context.preview:
  caller: adversary | team | review | audit
  estimated_tokens: 73000
  file_count: 8
  top_5_files_by_size:
    - { path: "src/auth/login.ts", chars: 12400 }
    - { path: "src/middleware/auth.ts", chars: 9800 }
    - { path: "src/services/session.ts", chars: 8200 }
    - { path: "tests/auth.test.ts", chars: 6100 }
    - { path: "src/types/user.ts", chars: 4500 }
  threshold:
    warn_at: 50000
    block_at: 100000
  action: warn
```

## Failure Modes

| Symptom | Reason | Mitigation |
|---------|--------|------------|
| Caller bundles before preview | Caller didn't follow contract | context-engine rejects late preview requests with explicit error |
| Estimate way off for non-English content | Tokenizer ratio assumes English | Document limitation; safe both directions due to dispatch-time hard cap |
| Block action ignored by caller | Caller bug | Each caller's Done When MUST verify `action != block` before dispatch |
| Threshold env-var malformed | User typo | context-engine logs warning, falls back to default |
