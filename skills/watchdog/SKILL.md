---
name: watchdog
description: Post-deploy monitoring setup. Configures error tracking, health endpoints, alert rules, and smoke tests for deployed applications.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L3
  model: sonnet
  group: monitoring
---

# watchdog

## Purpose

Post-deploy monitoring setup. Configures error tracking (Sentry), health endpoints, alert rules, and smoke tests. Ensures deployed applications are monitored and issues are caught quickly.

## Triggers

- Called by deploy after successful deployment
- Called by launch for monitoring setup

## Calls (outbound)

None — pure L3 utility.

## Called By (inbound)

- `deploy` (L2): post-deploy monitoring setup
- `launch` (L1): monitoring as part of launch pipeline

## Capabilities

```
MONITORING      — Sentry integration, error tracking setup
HEALTH ENDPOINT — generate /health and /ready endpoints
ALERT RULES     — error rate, response time, uptime thresholds
SMOKE TEST      — verify critical endpoints after deploy
```

## Workflow

1. Receive deployment URL and list of health endpoints from calling skill
2. Run availability checks — HTTP status, load time, /health and /ready responses
3. Monitor error rates and response times against configured thresholds
4. Compare results against baseline metrics to detect regressions
5. Return monitoring report with smoke test results, alert rules configured, and any triggered alerts

## Output Format

```
## Watchdog Setup
- **Monitoring**: [configured | skipped]
- **Health Endpoint**: [path]
- **Alerts**: [count rules configured]

### Smoke Test Results
- [endpoint] — [status] ([response time]ms)

### Alert Rules
- Error rate > 1% → alert
- Response time > 2s → alert
- Uptime < 99.9% → alert
```

## Cost Profile

~500-1500 tokens input, ~300-800 tokens output. Sonnet for configuration quality.
