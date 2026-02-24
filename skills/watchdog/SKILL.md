---
name: watchdog
description: Post-deploy monitoring. Checks if deployed app is healthy — HTTP status, response times, error detection, and smoke test report.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L3
  model: sonnet
  group: monitoring
---

# watchdog

## Purpose

Post-deploy monitoring. Receives a deployed URL and list of expected endpoints, runs health checks, measures response times, detects errors, and returns a structured smoke test report.

## Called By (inbound)

- `deploy` (L2): post-deploy monitoring setup
- `launch` (L1): monitoring as part of launch pipeline
- `incident` (L2): current system state check during incident triage

## Calls (outbound)

None — pure L3 utility.

## Executable Instructions

### Step 1: Receive Target

Accept input from calling skill:
- `base_url` — deployed application URL (e.g. `https://myapp.com`)
- `endpoints` — list of paths to check (e.g. `["/", "/health", "/api/status"]`)

If no endpoints provided, default to: `["/", "/health", "/ready"]`

### Step 2: Health Check

For each endpoint, run an HTTP status check using `Bash`:

```bash
curl -s -o /dev/null -w "%{http_code}" https://myapp.com/health
```

- 2xx → HEALTHY
- 3xx → REDIRECT (note final destination)
- 4xx → CLIENT_ERROR (flag as alert)
- 5xx → SERVER_ERROR (flag as critical alert)
- Connection refused / timeout → UNREACHABLE (flag as critical)

### Step 3: Response Time

For each endpoint, measure latency using `Bash`:

```bash
curl -s -o /dev/null -w "%{time_total}" https://myapp.com/health
```

Thresholds:
- < 500ms → FAST
- 500ms–2000ms → ACCEPTABLE
- > 2000ms → SLOW (flag as alert)

### Step 4: Performance Signal Analysis

After collecting response times from Step 3, analyze for patterns that indicate root causes:

- **Consistently 2x+ slower than baseline** (or > 2000ms with no apparent load): flag with `PERF_WARN — investigate N+1 query or missing DB index`
- **Endpoint cluster degradation**: if 3+ endpoints share a pattern (all auth endpoints slow, all /api/* slow): flag `PERF_WARN — connection pool saturation likely`
- **Spike after deploy**: compare with previous watchdog run if available — if an endpoint that was FAST is now SLOW, flag `PERF_REGRESSION — correlate with recent git diff`

If no previous baseline exists, skip spike detection and note `INFO: no baseline — first run`.

Output performance signals into a `perf_signals` list (separate from `alerts`).

### Step 5: Error Detection

Scan responses for problems:
- 4xx/5xx HTTP codes → log endpoint + status code
- Response time > 2s → log endpoint + measured time
- Connection timeout (curl exits non-zero) → UNREACHABLE
- Empty response body on non-204 endpoints → flag as WARNING

Collect all flagged issues into an `alerts` list.

### Step 6: Report

Output the following report structure:

```
## Watchdog Report: [base_url]

### Smoke Test Results
- [endpoint] — [HTTP status] ([response_time]s) — [HEALTHY|REDIRECT|CLIENT_ERROR|SERVER_ERROR|UNREACHABLE]

### Alert Rules Applied
- Response time > 2s → alert
- Any 4xx on non-auth endpoint → alert
- Any 5xx → critical alert
- Unreachable → critical alert

### Alerts
- [CRITICAL|WARNING] [endpoint] — [reason]

### Performance Signals
- [PERF_WARN|PERF_REGRESSION|INFO] [endpoint] — [diagnosis]

### Summary
- Total endpoints checked: [n]
- Healthy: [n]
- Alerts: [n]
- Perf Signals: [n]
- Overall status: ALL_HEALTHY | DEGRADED | DOWN
```

If no alerts and no perf signals: output `Overall status: ALL_HEALTHY`.

## Output Format

```
## Watchdog Report: [base_url]
### Smoke Test Results
- / — 200 (0.231s) — HEALTHY
- /health — 200 (0.089s) — HEALTHY
- /api/status — 500 (1.203s) — SERVER_ERROR

### Alerts
- CRITICAL /api/status — HTTP 500

### Summary
- Total: 3 | Healthy: 2 | Alerts: 1
- Overall status: DEGRADED
```

## Constraints

1. MUST report with specific metrics — not vague "performance seems slow"
2. MUST include baseline comparison when available
3. MUST NOT generate false alarms — precision over recall
4. MUST separate perf signals from error alerts — they are different severity channels
5. MUST NOT call `perf` skill — watchdog is a detector, not a diagnoser

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| curl timeout treated as slow (not unreachable) | HIGH | Non-zero curl exit code = UNREACHABLE, not a response time measurement |
| PERF_REGRESSION reported without baseline | MEDIUM | Only flag regression if a previous run exists — otherwise INFO: first run |
| All endpoints flagged SLOW because test env is slow | MEDIUM | Note environment context — add `ENV: non-production detected` if URL contains dev/staging/localhost |
| Perf signal without actionable diagnosis | LOW | Every PERF_WARN must include a hypothesis (N+1, pool saturation, etc.) |

## Done When

- All specified endpoints checked (HTTP status + response time measured)
- All 4xx/5xx → `alerts` list, all SLOW → `alerts` list
- Performance patterns analyzed → `perf_signals` list (or INFO: first run)
- Structured Watchdog Report emitted with Alerts + Performance Signals + Summary
- Overall status is ALL_HEALTHY, DEGRADED, or DOWN (never ambiguous)

## Cost Profile

~500-1500 tokens input, ~300-800 tokens output. Sonnet for configuration quality.
