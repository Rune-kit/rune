---
name: deploy
description: "Deploy application to target platform. Use when user explicitly says 'deploy', 'push to production', 'ship it'. Handles Vercel, Netlify, AWS, GCP, DigitalOcean, and VPS with pre-deploy verification and health checks."
disable-model-invocation: true
metadata:
  author: runedev
  version: "0.4.0"
  layer: L2
  model: sonnet
  group: delivery
  tools: "Read, Write, Edit, Bash, Glob, Grep"
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

- `test` (L2): pre-deploy full test suite
- `db` (L2): pre-deploy migration safety check
- `perf` (L2): pre-deploy performance regression check
- `verification` (L2): pre-deploy build + lint + type check
- `sentinel` (L2): pre-deploy security scan
- `browser-pilot` (L3): verify live deployment visually
- `watchdog` (L3): setup post-deploy monitoring
- `journal` (L3): record deploy decision, rollback plan, and post-deploy status
- `incident` (L2): if post-deploy health check fails → triage and contain
- L4 extension packs: domain-specific deploy patterns when context matches (e.g., @rune/devops for infrastructure)

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

### Step 1.5 — Release Checklist (Production Deploys Only)

**Skip for**: staging, preview, development deploys.

Before production deploy, verify ALL items:

| # | Check | How | Gate |
|---|-------|-----|------|
| 1 | Version bumped | `package.json`/`pyproject.toml` version matches release | BLOCK if unchanged |
| 2 | Changelog updated | `CHANGELOG.md` has entry for this version | WARN if missing |
| 3 | Breaking changes documented | RFC artifact exists for each breaking change | BLOCK if RFC missing |
| 4 | Migration scripts ready | DB migrations tested on staging first | BLOCK if untested migration |
| 5 | Rollback plan documented | `.rune/deploy/rollback-<version>.md` exists | WARN if missing |
| 6 | Release notes drafted | Customer-facing notes for release-comms | WARN if missing |
| 7 | Dependencies locked | Lock file committed, no floating versions | BLOCK if unlocked |

**Rollback Plan Template** (`.rune/deploy/rollback-<version>.md`):

```markdown
# Rollback Plan: v<version>

## Trigger Conditions
- [When to rollback — e.g., error rate >5%, P0 incident, data corruption]

## Steps
1. [Revert command — e.g., `vercel rollback`, `fly releases rollback`]
2. [DB rollback — e.g., `npm run migrate:rollback` or "N/A — no migration"]
3. [Cache invalidation if needed]
4. [Notify stakeholders]

## Verification
- [ ] Previous version serving traffic
- [ ] Health check passing
- [ ] No data loss confirmed

## Post-Rollback
- [ ] Incident created for root cause analysis
- [ ] Fix branch created from rolled-back commit
```

If any BLOCK item fails → STOP deploy. Fix before retrying.
If WARN items missing → proceed but flag in deploy report.

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

## Output Format

Deploy Report with platform, status (success/failed/rollback), deployed URL, build time, and checks (tests, security, HTTP, visual, monitoring). See Step 6 Report above for full template.

## Constraints

1. MUST verify tests + sentinel pass before deploying — non-negotiable
2. MUST have rollback strategy documented before production deploy
3. MUST verify deploy is live and responding before declaring success
4. MUST NOT deploy with known CRITICAL security findings
5. MUST log deploy metadata (version, timestamp, commit hash)
6. MUST complete release checklist for production deploys — version bump, changelog, rollback plan
7. MUST create rollback plan artifact before first production deploy of a version

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| Deploy report | Markdown | inline (chat output) |
| Deploy status (success/failed/rollback) | Text | inline |
| Health check results (HTTP status, visual) | Markdown | inline |
| Rollback plan document | Markdown | `.rune/deploy/rollback-<version>.md` |
| Monitoring confirmation | Text | inline |

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
