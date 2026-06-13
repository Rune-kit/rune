---
name: deploy
description: "Deploy application to target platform. Use when user explicitly says 'deploy', 'push to production', 'ship it'. Handles Vercel, Netlify, AWS, GCP, DigitalOcean, and VPS with pre-deploy verification and health checks. Enforces cost allocation tags + Managed-vs-Self-Host crossover decisions so deploy choices map to actual unit economics, not hand-waved 'we'll optimize later'."
disable-model-invocation: true
metadata:
  author: runedev
  version: "0.7.0"
  layer: L2
  model: sonnet
  group: delivery
  tools: "Read, Write, Edit, Bash, Glob, Grep"
  emit: deploy.complete
  listen: security.passed, tests.passed, docs.updated, audit.complete, db.migrated
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

### Step 4.5 — Post-Deploy Health Thresholds

After deploy is live, compare metrics against pre-deploy baseline for a 15-minute observation window:

| Metric | ADVANCE (healthy) | HOLD & INVESTIGATE | ROLLBACK IMMEDIATELY |
|--------|--------------------|--------------------|----------------------|
| Error rate | ≤ 10% above baseline | 10–100% above baseline | > 2× baseline |
| Latency (p95) | ≤ 20% above baseline | 20–100% above baseline | > 2× baseline |
| Availability | ≥ 99.5% | 98–99.5% | < 98% |

**Decision rules:**
- ANY metric hits ROLLBACK → execute rollback plan immediately, invoke `rune:incident`
- ANY metric hits HOLD → extend monitoring to 30 minutes, alert user with specific metric
- ADVANCE only when ALL metrics are healthy for the full observation window
- If no baseline exists (first deploy), use absolute thresholds: error rate < 1%, p95 < 2s, availability > 99%

For progressive rollouts (feature-flag mode), apply the tighter thresholds defined in the Progressive Rollout Chain section instead.

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

## Progressive Rollout / Feature Flag Mode

When deploying high-risk changes (new features, migrations, architectural changes), use staged rollout instead of all-at-once deploy. Triggered by: user says "canary", "rollout", "feature flag", "staged", or "progressive" — or when release checklist item 3 (breaking changes) fires.

### Progressive Rollout Chain

```
Stage 1: CANARY (5% traffic)
  → deploy to production with feature flag OFF
  → enable flag for 5% of users (staff, beta users, or random sample)
  → watchdog: monitor error rate, latency, conversions for 15-30 minutes
  → GATE: error rate < 0.5% AND latency ≤ baseline × 1.2

Stage 2: EXPAND (25% → 50% → 100%)
  → for each step: enable flag for N%, wait 15 min, check watchdog metrics
  → GATE: same thresholds at each step
  → At 100%: cleanup flag (remove feature flag code, ship cleanup PR)

ROLLBACK TRIGGER: any stage fails watchdog gate → immediately set flag to 0%, incident auto-created
```

### Feature Flag Integration

| Platform | Flag Mechanism | Cleanup Step |
|----------|---------------|-------------|
| Vercel | Edge Config or `@vercel/flags` | Remove flag key after 100% rollout |
| LaunchDarkly | SDK variation check | Archive flag, clean up `variation()` calls |
| Growthbook | Feature flag SDK | Deactivate + remove SDK calls |
| DIY `.env` flag | `FEATURE_X_ENABLED=true` env var | Remove env var + conditional after 100% |

**Minimum feature flag implementation** (no platform dependency):
```typescript
// Simple env-based flag — works anywhere
const FEATURE_X = process.env.FEATURE_X_ENABLED === 'true';
if (FEATURE_X) { /* new path */ } else { /* old path */ }
// Cleanup: when flag reaches 100% → inline the new path, delete the conditional
```

### Skip if
- Hotfix deploy (urgency outweighs staged rollout)
- Static site deploy with no user-state impact
- Non-production deploy (staging, preview)

## Managed vs Self-Host Crossover

Production deploys frequently default to "managed" (Vercel, Cloudflare Workers, Supabase, etc.) for speed-of-setup, then quietly bleed budget as scale grows. The opposite mistake — self-hosting at 10K MAU "to save money" — wastes more engineering time than the bill it saves. The crossover point is workload-dependent. Defaults below are heuristic; verify against operator's actual bill before recommending a switch.

| Workload | Stay managed until ~ | Self-host above | Reason |
|---|---|---|---|
| **Auth (Clerk, Auth0, Supabase auth)** | 200K MAU | 200K+ MAU AND auth-customization needs | Per-MAU pricing kicks 5-10× at scale; OSS alternatives (better-auth, Keycloak) have mature implementations |
| **Search (Algolia, Typesense Cloud)** | 500K records OR 100K queries/mo | Beyond either | Per-record + per-query stacks; OpenSearch/Meilisearch self-host crosses over at this volume |
| **Database (managed Postgres — Supabase, Neon, RDS)** | $500/mo bill | $500+ bill AND ops capacity exists | Below $500 the on-call burden of self-host dominates; above $500 the savings cover an engineer's bandwidth |
| **Object storage (S3, R2, Backblaze)** | Almost never self-host | Petabyte-scale + bandwidth-heavy use | S3-class storage is hard to beat below 10PB; cross-region egress is usually the real cost lever |
| **Email (SendGrid, Resend, Postmark)** | Almost never self-host | Compliance-driven requirement only | SMTP reputation + deliverability take years to build; running mail server for cost is false economy |
| **CDN (Cloudflare, Fastly)** | Almost never self-host | Edge-compute customization + > 100TB/mo egress | Cloudflare free tier alone covers most projects; CDN self-host is rarely the right answer |
| **Compute (Vercel/Netlify/Workers)** | $300-500/mo bill | $500+/mo AND traffic stable | Below $500 the operational overhead of K8s/Fly/VPS dominates; above, dedicated container hosting wins |
| **Vector DB (Pinecone, Weaviate Cloud)** | $200/mo OR < 10M vectors | $200+ AND vectors > 10M | Self-hosted Qdrant/Milvus crosses over at moderate scale |
| **Queue (SQS, Cloud Tasks)** | Almost never self-host | Latency-critical sub-5ms only | Per-message pricing is low; self-host (RabbitMQ, NATS) only when latency SLO < 5ms |

**Operator decision rule**: do NOT migrate to self-host purely on bill size. Verify all three:
1. **Bill threshold crossed** (per table above)
2. **Ops bandwidth exists** (someone on-call who can run the service)
3. **Customization need exists** (the managed service blocks something specific)

If only (1) is true, recommend WARN `MANAGED_OK_AT_SCALE — bill above crossover but ops bandwidth not validated — keep managed; revisit when (2)+(3) also true`.

**Reverse scenario**: prematurely self-hosting at < 10K MAU costs more engineering time than the managed bill it avoids. Flag with `PREMATURE_SELFHOST — [resource] self-hosted at [N] usage — managed equivalent < $X/mo + zero ops burden — strong recommendation: migrate to managed unless customization (3) is blocking`.

**Cost-allocation precondition**: even within managed services, ALL cloud resources must carry allocation tags (Environment, Team, Service, CostCenter). Without tags, anomaly detection is impossible and any "managed is expensive" claim is unfalsifiable. Step 1 pre-deploy check should add:

```bash
# Verify cost allocation tags exist on managed resources
# AWS: aws resourcegroupstaggingapi get-resources --tag-filters Key=Environment
# GCP: gcloud asset search-all-resources --query='labels:environment'
# Vercel: project settings → check team/project tagging
# If untagged → BLOCK with COST_UNATTRIBUTED finding
```

## Observability Cost in Deploys

Production observability (Datadog, Sentry, New Relic, Honeycomb, Logtail) bills can rival compute bills if shipped with default config. Verify before first prod deploy:

| Layer | Default that bleeds money | Correct config |
|---|---|---|
| Log retention | 30+ days at INFO | 7 days INFO, 30 days WARN+, archive cold for compliance |
| Trace sampling | Head-based 100% | Tail-based 5-10% normal + 100% on error/slow |
| Metrics | High-cardinality custom dims (user_id, trace_id) | Pre-aggregate at agent; per-event = log not metric |
| RUM (Real User Monitoring) | 100% session capture | 10-20% sample + 100% on rage-click/error |

This overlaps with `perf` Step 8.6 (Observability Cost Control). `perf` finds the code patterns that emit overheavy telemetry; `deploy` ensures the platform-side ingestion + retention defaults are configured before the first prod release where the bill compounds.

## Instrumentation Readiness (pre-prod advisory gate)

> Two observability concerns, kept separate: the section *above* ("Observability Cost in Deploys") gates the telemetry **bill** (retention/sampling/cardinality config). This section gates whether the telemetry **exists and works** at all. Both run; neither replaces the other.

Cost config (above) answers "is the telemetry *affordable*". This answers "does the telemetry *exist and work*". A feature with retries, queues, external calls, or new endpoints that ships **zero new telemetry** is shipping blind — the first incident becomes archaeology.

<MUST-READ path="references/observability.md" trigger="first prod deploy of a feature that adds I/O, endpoints, jobs, or external integrations"/>

Before the first production deploy of such a feature, verify the **Instrumentation Readiness Checklist** in `references/observability.md`. This is **advisory** (WARN, not BLOCK) — do not stop a deploy over missing telemetry, but surface the gap:

```
INSTRUMENTATION_GAP — feature adds [endpoint/job/integration] with no new
structured logs / RED metrics / correlation ID. First incident will be blind.
→ See deploy/references/observability.md before shipping.
```

Skip for: static sites, config-only changes, hotfixes (flag for follow-up), non-prod deploys.

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
| Resources deployed without cost-allocation tags | HIGH | Step 1 pre-deploy MUST verify Environment/Team/Service tags. Untagged = unfalsifiable cost claims downstream |
| Self-host migration recommended on bill threshold alone | HIGH | Crossover rule requires ALL 3 conditions: bill + ops bandwidth + customization need. Single-criterion recommendations produce engineering-debt swap |
| Defaults shipped on observability stack | MEDIUM | Verify retention + sampling + cardinality config BEFORE first prod deploy; defaults often bleed > compute bill |
| Feature ships with zero telemetry (logs/metrics/traces) | MEDIUM | Instrumentation Readiness advisory gate — WARN `INSTRUMENTATION_GAP` (skip for static sites/config-only/hotfix per section); first incident is blind without it. See `references/observability.md` |
| Premature self-host (< 10K MAU) | MEDIUM | Flag `PREMATURE_SELFHOST` — managed equivalent at this scale is cheaper than engineering time spent operating |

## Done When

- verification PASS (tests, types, lint, build all green)
- sentinel PASS (no CRITICAL security findings)
- Deploy command succeeded with live URL captured
- Live URL returns HTTP 200
- watchdog monitoring active on deployed URL
- Deploy Report emitted with platform, URL, checks, and monitoring status

## Cost Profile

~1000-3000 tokens input, ~500-1000 tokens output. Sonnet. Most time in build/deploy commands.
