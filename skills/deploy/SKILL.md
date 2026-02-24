---
name: deploy
description: Deploy application to target platform. Handles Vercel, Netlify, AWS, GCP, DigitalOcean, and VPS deployments with pre-deploy verification and health checks.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L2
  model: sonnet
  group: delivery
---

# deploy

## Purpose

Deploy applications to target platforms. Handles the full deployment flow — environment configuration, build, push, verification, and rollback if needed. Supports Vercel, Netlify, AWS, GCP, DigitalOcean, and custom VPS via SSH.

<HARD-GATE>
- Tests MUST pass (via `rune:verification`) before deploy runs
- Sentinel MUST pass (no CRITICAL issues) before deploy runs
- Both are non-negotiable. Failure = stop + report, never skip
</HARD-GATE>

## Called By (inbound)

- `launch` (L1): deployment phase of launch pipeline
- User: `/rune deploy` direct invocation

## Calls (outbound)

- `verification` (L2): pre-deploy tests + build check
- `sentinel` (L2): pre-deploy security scan
- `browser-pilot` (L3): verify live deployment visually
- `watchdog` (L3): setup post-deploy monitoring

## Cross-Hub Connections

- `deploy` → `verification` — pre-deploy tests + build must pass
- `deploy` → `sentinel` — security must pass before push

## Execution Steps

### Step 1 — Pre-deploy checks (HARD-GATE)

Call `rune:verification` to run the full test suite and build.

```
If verification fails → STOP. Do NOT proceed. Report failure with test output.
```

Call `rune:sentinel` to run security scan.

```
If sentinel returns CRITICAL issues → STOP. Do NOT proceed. Report issues.
```

Both gates MUST pass. No exceptions.

### Step 2 — Detect platform

Use `Bash` to inspect the project root for platform config files:

```bash
ls vercel.json netlify.toml Dockerfile fly.toml 2>/dev/null
cat package.json | grep -A5 '"scripts"'
```

Map findings to platform:

| File found | Platform |
|---|---|
| `vercel.json` | Vercel |
| `netlify.toml` | Netlify |
| `fly.toml` | Fly.io |
| `Dockerfile` | Docker / VPS |
| `package.json` deploy script | npm deploy |

If no config found, ask the user which platform to target before continuing.

### Step 3 — Deploy

Use `Bash` to run the platform-specific deploy command:

| Platform | Command |
|---|---|
| Vercel | `vercel --prod` |
| Netlify | `netlify deploy --prod` |
| Fly.io | `fly deploy` |
| Docker | `docker build -t app . && docker push <registry>/app` |
| npm script | `npm run deploy` |

Capture full command output. Extract deployed URL from output.

### Step 4 — Verify deployment

Use `Bash` to check the deployed URL returns HTTP 200:

```bash
curl -o /dev/null -s -w "%{http_code}" <deployed-url>
```

If status is not 200 → flag as WARNING, do not treat as hard failure unless 5xx.

If `rune:browser-pilot` is available, call it to take a screenshot of the deployed URL for visual confirmation.

### Step 5 — Monitor

Call `rune:watchdog` to set up post-deploy monitoring alerts on the deployed URL.

### Step 6 — Report

Output the deploy report:

```
## Deploy Report
- **Platform**: [target]
- **Status**: success | failed | rollback
- **URL**: [deployed URL]
- **Build Time**: [duration]

### Checks
- Tests: passed | failed
- Security: passed | failed ([count] issues)
- HTTP Status: [code]
- Visual: [screenshot path if browser-pilot ran]
- Monitoring: active | skipped
```

If any step failed, include the error output and recommended next action.

## Constraints

1. MUST verify tests + sentinel pass before deploying — non-negotiable
2. MUST have rollback strategy documented before production deploy
3. MUST verify deploy is live and responding before declaring success
4. MUST NOT deploy with known CRITICAL security findings
5. MUST log deploy metadata (version, timestamp, commit hash)

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Deploying without verification passing | CRITICAL | HARD-GATE blocks this — both verification AND sentinel must pass first |
| Platform auto-detected wrongly and wrong command runs | HIGH | Verify config files explicitly; ask user if multiple platforms detected |
| HTTP 5xx on live URL treated as non-critical | HIGH | 5xx = deployment likely failed — report FAILED, do not proceed to monitoring/marketing |
| Not setting up watchdog monitoring after deploy | MEDIUM | Step 5 is mandatory — post-deploy monitoring is part of deploy, not optional |
| Deploy metadata not logged (version, commit hash) | LOW | Constraint 5: log version + timestamp + commit hash in report |

## Done When

- verification PASS (tests, types, lint, build all green)
- sentinel PASS (no CRITICAL security findings)
- Deploy command succeeded with live URL captured
- Live URL returns HTTP 200
- watchdog monitoring active on deployed URL
- Deploy Report emitted with platform, URL, checks, and monitoring status

## Cost Profile

~1000-3000 tokens input, ~500-1000 tokens output. Sonnet. Most time in build/deploy commands.
