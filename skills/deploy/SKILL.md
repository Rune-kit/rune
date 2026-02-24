---
name: deploy
description: Deploy application to target platform. Handles Vercel, Netlify, AWS, GCP, DigitalOcean, and VPS deployments with pre-deploy verification and health checks.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L2
  model: sonnet
  group: delivery
---

# deploy

## Purpose

Deploy applications to target platforms. Handles the full deployment flow — environment configuration, build, push, verification, and rollback if needed. Supports Vercel, Netlify, AWS, GCP, DigitalOcean, and custom VPS via SSH.

## Triggers

- Called by `launch` as part of launch pipeline
- `/rune deploy` — manual deployment

## Calls (outbound)

- `test` (L2): pre-deploy verification (full test suite)
- `sentinel` (L2): pre-deploy security check
- `browser-pilot` (L3): verify live deployment visually
- `verification` (L3): post-deploy health checks
- `watchdog` (L3): setup monitoring after deploy

## Called By (inbound)

- `launch` (L1): deployment phase of launch pipeline
- User: `/rune deploy` direct invocation

## Cross-Hub Connections

- `deploy` → `test` — pre-deploy verification
- `deploy` → `sentinel` — pre-deploy security check

## Workflow

1. **Detect target** — identify deployment platform from config
2. **Pre-deploy checks** — call test for full suite, sentinel for security
3. **Build** — run project build command
4. **Deploy** — push to target platform
5. **Verify** — browser-pilot screenshots, verification health checks
6. **Monitor** — watchdog sets up post-deploy monitoring
7. **Report** — deployment URL, status, health

## Output Format

```
## Deploy Report
- **Platform**: [target]
- **Status**: success | failed | rollback
- **URL**: [deployed URL]
- **Build Time**: [duration]

### Checks
- Tests: [passed]/[total]
- Health: [status]
- Performance: [Lighthouse score if available]
```

## Cost Profile

~1000-3000 tokens input, ~500-1000 tokens output. Sonnet. Most time in build/deploy commands.
