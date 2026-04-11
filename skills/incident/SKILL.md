---
name: incident
description: "Structured incident response. Use when user reports an outage, production error, or says 'incident', 'something is down', 'users are affected'. Triage severity, contain blast radius, root-cause, document timeline, generate postmortem."
disable-model-invocation: true
metadata:
  author: runedev
  version: "0.2.0"
  layer: L2
  model: sonnet
  group: delivery
  tools: "Read, Write, Edit, Bash, Glob, Grep"
  listen: incident.detected
---

# incident

## Purpose

Structured incident response for production issues. Follows a strict order: triage first, contain before investigating, root-cause after stable, postmortem last. Prevents the most common incident anti-pattern — developers debugging while the system is still on fire. Covers P1 outages, P2 degraded service, and P3 minor issues with appropriate urgency at each level.

## Triggers

- `/rune incident "description of what's broken"` — direct user invocation
- Called by `launch` (L1): watchdog alerts during Phase 3 VERIFY
- Called by `deploy` (L2): health check fails post-deploy
- Signal: auto-triggers when `watchdog` emits `incident.detected` — no manual invocation needed

## Calls (outbound)

- `watchdog` (L3): current system state — which endpoints are down, response times
- `autopsy` (L2): root cause analysis after containment
- `journal` (L3): record incident timeline and decisions
- `sentinel` (L2): check for security dimension (data exposure, unauthorized access)
- `neural-memory` (ext): after resolution — capture incident root cause + fix pattern cross-session so the same failure mode is never diagnosed twice

## Called By (inbound)

- `launch` (L1): monitoring alert during production verification
- `deploy` (L2): post-deploy health check failure
- User: `/rune incident` direct invocation

## Executable Steps

### Step 1 — Triage

Classify severity using this matrix:

| Severity | Definition | Contain Within |
|----------|-----------|----------------|
| **P1** | Full outage — core feature unavailable for all users | 15 minutes |
| **P2** | Partial degradation — feature broken for subset of users or degraded for all | 1 hour |
| **P3** | Minor issue — cosmetic, edge case, or non-blocking degradation | 4 hours |

P1 indicators: 5xx on root `/`, auth endpoint down, payment flow broken, data loss detected
P2 indicators: elevated error rate (>1%) on key flow, 1+ regions down, performance >5x baseline
P3 indicators: UI glitch, non-critical feature broken, low error rate (<0.1%)

Emit: `TRIAGE: [P1|P2|P3] — [one-line impact description]`

### Step 2 — Contain

<HARD-GATE>
During active incident (before CONTAINED status), DO NOT attempt code fixes or root cause analysis.
Contain first. Ship code during active P1/P2 without containment = turning P2s into P1s.
</HARD-GATE>

Choose containment strategy based on what's available and severity:

| Strategy | When to Use |
|----------|------------|
| **Rollback** | Last deploy caused regression (check git log vs incident start time) |
| **Feature flag off** | Feature-gated code — disable without deploy |
| **Traffic shift** | Multi-region: route away from affected region |
| **Scale up** | Resource exhaustion (CPU/memory/connection pool) |
| **Rate limit** | Abuse pattern or traffic spike |
| **Manual intervention** | DB locked record, stuck job, cache corruption |

Execute containment action. Then invoke `watchdog` to verify system is stable before proceeding.

Emit: `CONTAINED: [strategy used] — [timestamp]` or `CONTAINMENT_FAILED: [what was tried] — escalate`

### Step 3 — Verify Containment

Invoke `watchdog` with current base_url and critical endpoints.

Proceed to Step 4 only if watchdog returns `ALL_HEALTHY` or `DEGRADED` with upward trend.
If watchdog returns `DOWN` — return to Step 2 with a different containment strategy.

### Step 4 — Security Check

Invoke `sentinel` to check if the incident has a security dimension:
- Data exposure (PII, credentials in logs/responses)
- Unauthorized access pattern in logs
- Injection attack vector triggered the incident
- Dependency with known CVE involved

If `sentinel` returns `BLOCK`: escalate to security incident — different protocol (notify security team, preserve logs, document access chain).
If `sentinel` returns `PASS` or `WARN`: continue to root cause.

### Step 5 — Root Cause Analysis

Invoke `autopsy` with context:
- Incident start timestamp
- Failing components identified in Step 2-3
- Recent deploy info (commit hash, deploy timestamp, changed files)

`autopsy` returns: root cause hypothesis with evidence, affected code paths, contributing factors.

Do not attempt fixes — `incident` only investigates. Any code changes are a separate task.

### Step 6 — Timeline Construction

Construct incident timeline using:
- Incident start time (when first detected)
- Triage time (when severity classified)
- Containment time (when system stabilized)
- RCA time (when root cause identified)
- Resolution time (when fully resolved)

Format:
```
[HH:MM] Incident detected — [who/what detected it]
[HH:MM] Triage: [P1/P2/P3] — [impact]
[HH:MM] Containment started — [strategy]
[HH:MM] CONTAINED — [watchdog confirms stable]
[HH:MM] RCA: [root cause summary]
[HH:MM] Resolution: [what was done]
```

Invoke `journal` to record the timeline and decisions in `.rune/adr/` as an incident ADR.

### Step 7 — Postmortem

Generate postmortem report and save as `.rune/incidents/INCIDENT-[YYYY-MM-DD]-[slug].md`:

```markdown
# Incident Report: [title]

**Severity**: [P1|P2|P3]
**Date**: [YYYY-MM-DD]
**Duration**: [time from detection to resolution]
**Impact**: [users affected, data affected, revenue impact if known]

## Timeline
[from Step 6]

## Root Cause
[from autopsy — specific, not vague]

## Contributing Factors
[from autopsy — what made this worse]

## What Went Well
[containment speed, detection, communication]

## What Went Wrong
[detection lag, failed first containment, etc.]

## Prevention Actions

| Action | Owner | Due | Priority |
|--------|-------|-----|----------|
| [specific action] | [team/person] | [date] | P1/P2/P3 |

## Lessons Learned
[3-5 bullet points]
```

## Output Format

```
## Incident Response: [title]

### Triage
P2 — Login service returning 503 for ~30% of users

### Containment
Strategy: Rollback to commit abc123 (pre-deploy from 14:32)
Status: CONTAINED at 15:07 — watchdog confirms ALL_HEALTHY

### Security Check
sentinel: PASS — no data exposure detected

### Root Cause (from autopsy)
Connection pool exhausted — new feature added synchronous DB call in middleware,
reducing available connections from 20 to 3 under load
File: src/middleware/auth.ts:47

### Timeline
14:32 Deploy completed
14:45 Alerts fired — 503 rate >1%
14:47 TRIAGE: P2
14:52 Containment: rollback initiated
15:07 CONTAINED
15:20 RCA complete
15:35 Postmortem drafted

### Postmortem saved
.rune/incidents/INCIDENT-2026-02-24-login-503.md
```

## Constraints

1. MUST triage before any other action — severity determines urgency, approach, and escalation path
2. MUST contain before root-cause — investigating while system is down prolongs the incident
3. MUST invoke watchdog to verify containment — never assume contained without measurement
4. MUST invoke sentinel before closing — every incident has a potential security dimension
5. MUST NOT make code changes during incident response — incident investigates only; fixes are a separate task
6. MUST generate postmortem for every P1 and P2 — P3 optional

## Mesh Gates (L1/L2 only)

| Gate | Requires | If Missing |
|------|----------|------------|
| Triage Gate | Severity classified (P1/P2/P3) before any other step | Classify before proceeding |
| Containment Gate | watchdog confirms HEALTHY/DEGRADED-improving before RCA | Return to containment if still DOWN |
| Security Gate | sentinel ran before closing incident | Run sentinel — do not skip |
| Postmortem Gate | All sections populated (Timeline, RCA, Prevention Actions) before status = Resolved | Complete or note as DRAFT |

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| Incident response report | Markdown | inline (chat output) |
| Incident timeline | Text (HH:MM format) | inline + postmortem |
| Postmortem document | Markdown | `.rune/incidents/INCIDENT-<date>-<slug>.md` |
| Prevention actions table | Markdown table | postmortem |
| Journal entry (incident ADR) | Text | `.rune/adr/` (via `rune:journal`) |

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Starting RCA before containment confirmed | CRITICAL | HARD-GATE: check CONTAINED status before calling autopsy |
| Declaring incident resolved without watchdog verification | HIGH | MUST call watchdog after containment — not just assume |
| Postmortem Prevention Actions without owners or dates | MEDIUM | Every action needs owner + due date — otherwise it never happens |
| Skipping sentinel because "looks like a performance issue" | HIGH | Security dimension is not always obvious — always run sentinel |
| P1 triage without 15-minute containment urgency | HIGH | P1 SLA = 15 min to contain — flag if containment exceeds threshold |

## Done When

- Severity triaged (P1/P2/P3) with impact description
- Containment executed and watchdog confirms stable
- sentinel ran and security dimension addressed (or escalated)
- Root cause identified via autopsy with file:line evidence
- Full timeline constructed
- Postmortem saved to .rune/incidents/ with Prevention Actions table
- journal entry recorded

## Cost Profile

~3000-8000 tokens input, ~1000-2500 tokens output. Sonnet for response coordination.
