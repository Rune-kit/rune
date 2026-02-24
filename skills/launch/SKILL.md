---
name: launch
description: Deploy + marketing orchestrator. Runs the full launch pipeline — pre-flight tests, deployment, live verification, marketing asset creation, and announcement.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L1
  model: sonnet
  group: orchestrator
---

# launch

## Purpose

Orchestrate the full deployment and marketing pipeline. Launch coordinates testing, deployment, live site verification, marketing asset creation, and public announcement. One command to go from "code ready" to "product live and marketed."

<HARD-GATE>
- ALL tests must pass before any deploy attempt. Zero exceptions. Block deploy if any of: tests failing, TypeScript errors present, build fails, or sentinel CRITICAL issues detected.
</HARD-GATE>

## Triggers

- `/rune launch` — manual invocation
- Called by `team` when delegating launch tasks

## Calls (outbound)

- `test` (L2): pre-deployment full test suite
- `deploy` (L2): push to target platform
- `browser-pilot` (L3): verify live site screenshots and performance
- `marketing` (L2): create launch assets (landing copy, social, SEO)
- `watchdog` (L3): setup post-deploy monitoring
- `video-creator` (L3): create launch/demo video content

## Called By (inbound)

- User: `/rune launch` direct invocation
- `team` (L1): when team delegates launch phase

---

## Execution

### Step 0 — Initialize TodoWrite

```
TodoWrite([
  { content: "PRE-FLIGHT: Run full test suite and verification", status: "pending", activeForm: "Running pre-flight checks" },
  { content: "DEPLOY: Detect platform and push to production", status: "pending", activeForm: "Deploying to production" },
  { content: "VERIFY LIVE: Check live URL and setup monitoring", status: "pending", activeForm: "Verifying live deployment" },
  { content: "MARKET: Generate landing copy and social assets", status: "pending", activeForm: "Generating marketing assets" },
  { content: "ANNOUNCE: Present all marketing assets to user", status: "pending", activeForm: "Preparing announcement" }
])
```

---

### Phase 1 — PRE-FLIGHT

Mark todo[0] `in_progress`.

```
REQUIRED SUB-SKILL: rune:verification
→ Invoke `verification` with scope: "full".
→ verification runs: type check, lint, unit tests, integration tests, build.
→ Capture: passed count, failed count, coverage %, build output.
```

```
HARD-GATE CHECK — block deploy if ANY of:
  [ ] Tests failing (failed count > 0)
  [ ] TypeScript errors present
  [ ] Build fails
  [ ] sentinel CRITICAL issues detected (invoke rune:sentinel if not already run)

If any check fails:
  → STOP immediately
  → Report: "PRE-FLIGHT FAILED — deploy blocked"
  → List all failures with file + line references
  → Do NOT proceed to Phase 2
```

Mark todo[0] `completed` only when ALL checks pass.

---

### Phase 2 — DEPLOY

Mark todo[1] `in_progress`.

**2a. Detect deployment platform.**

```
Bash: ls package.json
Read: package.json  (check "scripts" for deploy, build, start commands)

Platform detection (in order):
  1. Check package.json scripts for "vercel" → platform = Vercel
  2. Check package.json scripts for "netlify" → platform = Netlify
  3. Check for vercel.json or .vercel/ dir → platform = Vercel
  4. Check for netlify.toml → platform = Netlify
  5. Check for Dockerfile or fly.toml → platform = custom/fly.io
  6. Fallback: ask user for deploy command before continuing
```

**2b. Execute deploy command.**

```
Vercel:
  Bash: npx vercel --prod
  Capture: deployment URL from stdout

Netlify:
  Bash: npx netlify deploy --prod --dir=[build_output_dir]
  Capture: deployment URL from stdout

Custom (package.json script):
  Bash: npm run deploy
  Capture: deployment URL or status from stdout

Fly.io:
  Bash: flyctl deploy
  Capture: deployment URL from stdout
```

```
Error recovery:
  If deploy command exits non-zero:
    → Capture full stderr
    → Report: "DEPLOY FAILED: [error summary]"
    → Do NOT proceed to Phase 3
    → Present raw error to user for diagnosis
```

Mark todo[1] `completed` when deploy returns a live URL.

---

### Phase 3 — VERIFY LIVE

Mark todo[2] `in_progress`.

**3a. Verify live site.**

```
REQUIRED SUB-SKILL: rune:browser-pilot
→ Invoke `browser-pilot` with the deployed URL.
→ browser-pilot checks: page loads (HTTP 200), no console errors, critical UI elements visible.
→ Capture: screenshot, status code, load time, any JS errors.
```

```
Error recovery:
  If browser-pilot returns non-200 or JS errors:
    → Report: "LIVE VERIFY FAILED: [details]"
    → Do NOT proceed to Phase 4
    → Present screenshot + error log to user
```

**3b. Setup monitoring.**

```
REQUIRED SUB-SKILL: rune:watchdog
→ Invoke `watchdog` with: url=[deployed URL], interval=5min, alert_on=[5xx, timeout].
→ watchdog configures health check endpoint monitoring.
→ Capture: monitoring confirmation + health endpoint path.
```

Mark todo[2] `completed` when live verification passes and monitoring is active.

---

### Phase 4 — MARKET

Mark todo[3] `in_progress`.

**4a. Generate marketing assets.**

```
REQUIRED SUB-SKILL: rune:marketing
→ Invoke `marketing` with: project context, deployed URL, key features.
→ marketing generates:
    - Landing page hero copy (headline, subheadline, CTA)
    - Twitter/X announcement thread (3-5 tweets)
    - LinkedIn post
    - Product Hunt tagline + description
    - SEO meta tags (title, description, og:image alt)
→ Capture: all generated copy as structured output.
```

**4b. Optional — launch video.**

```
If user requested video content:
  REQUIRED SUB-SKILL: rune:video-creator
  → Invoke `video-creator` with: deployed URL, feature list, target platform.
  → Capture: video script + asset manifest.
```

Mark todo[3] `completed` when all requested assets are generated.

---

### Phase 5 — ANNOUNCE

Mark todo[4] `in_progress`.

Present all assets to user in structured format. Do not auto-publish — user approves before posting.

```
Present:
  - Deployed URL (clickable)
  - Monitoring status
  - All marketing copy blocks (ready to copy-paste)
  - Video script (if generated)
  - Next steps checklist
```

Mark todo[4] `completed`.

---

## Constraints

1. MUST pass ALL tests before any deploy attempt — zero exceptions
2. MUST pass sentinel security scan before deploy — no CRITICAL findings allowed
3. MUST have rollback plan documented before deploying to production
4. MUST NOT deploy and run marketing simultaneously — deploy first, verify, then market
5. MUST verify deploy is live and healthy before triggering marketing skills

## Mesh Gates

| Gate | Requires | If Missing |
|------|----------|------------|
| Test Gate | verification output showing all green | Run rune:verification first |
| Security Gate | sentinel output with no CRITICAL findings | Run rune:sentinel first |
| Deploy Gate | Successful deploy confirmation before marketing | Deploy first |

## Output Format

```
## Launch Report
- **Status**: live | failed | partial
- **URL**: [deployed URL]
- **Tests**: [passed]/[total]

### Deployment
- Platform: [Vercel | Netlify | custom]
- Build: [success | failed]
- URL: [live URL]

### Monitoring
- Health endpoint: [path]
- Check interval: 5min
- Watchdog: active | failed

### Marketing Assets
- Hero copy: [ready | skipped]
- Twitter thread: [ready | skipped]
- LinkedIn post: [ready | skipped]
- Product Hunt: [ready | skipped]
- SEO meta: [ready | skipped]
- Launch video: [ready | skipped]
```

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Attempting deploy with failing tests or TypeScript errors | CRITICAL | HARD-GATE blocks this — pre-flight must be 100% green |
| Running marketing before deploy verified live | HIGH | Constraint 4: deploy → verify HTTP 200 → THEN market. Never simultaneous |
| No rollback plan before production deploy | MEDIUM | Constraint 3: document rollback strategy before running deploy command |
| Platform auto-detected incorrectly (wrong deploy command) | MEDIUM | Verify platform config files before running — ask if ambiguous |
| Marketing assets generated from assumptions rather than scout output | MEDIUM | Step 1 requires scout to run — copy based on actual features, not assumptions |

## Done When

- Pre-flight PASS: all tests, types, lint, build, and sentinel green
- Deploy command succeeded with live URL captured
- Live site returns HTTP 200 (curl or browser-pilot confirmed)
- watchdog monitoring active on deployed URL
- All requested marketing assets generated (or skipped with reason)
- User presented with all assets before any publishing
- Launch Report emitted with URL, monitoring status, and asset list

## Cost Profile

~$0.08-0.15 per launch. Sonnet for coordination, delegates to haiku for scanning.
