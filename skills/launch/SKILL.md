---
name: launch
description: Deploy + marketing orchestrator. Runs the full launch pipeline — pre-flight tests, deployment, live verification, marketing asset creation, and announcement.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L1
  model: sonnet
  group: orchestrator
---

# launch

## Purpose

Orchestrate the full deployment and marketing pipeline. Launch coordinates testing, deployment, live site verification, marketing asset creation, and public announcement. One command to go from "code ready" to "product live and marketed."

## Triggers

- `/rune launch` — manual invocation
- Called by `team` when delegating launch tasks

## Calls (outbound)

- `test` (L2): pre-deployment full test suite
- `deploy` (L2): push to target platform
- `browser-pilot` (L3): verify live site screenshots and performance
- `marketing` (L2): create launch assets (landing copy, social, SEO)
- `watchdog` (L3): setup post-deploy monitoring

## Called By (inbound)

- User: `/rune launch` direct invocation
- `team` (L1): when team delegates launch phase

## Workflow

```
/rune launch
│
├─ Phase 1: PRE-FLIGHT
│  └─ test → full test suite + verification checks
│
├─ Phase 2: DEPLOY
│  └─ deploy → push to target platform (Vercel, AWS, etc.)
│
├─ Phase 3: VERIFY LIVE
│  ├─ browser-pilot → screenshot live site
│  └─ watchdog → health checks + monitoring setup
│
├─ Phase 4: MARKET
│  └─ marketing → landing copy, social banners, SEO meta
│
└─ Phase 5: ANNOUNCE
   └─ marketing → publish content, social posts
```

## Output Format

```
## Launch Report
- **Status**: live | failed | partial
- **URL**: [deployed URL]
- **Tests**: [passed]/[total]

### Deployment
- Platform: [target]
- Build: [status]
- URL: [live URL]

### Monitoring
- Health endpoint: [path]
- Error tracking: [configured]

### Marketing Assets
- [list of generated assets]
```

## Cost Profile

~$0.08-0.15 per launch. Sonnet for coordination, delegates to haiku for scanning.
