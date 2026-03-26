---
name: "@rune/saas"
description: SaaS patterns — multi-tenancy, billing integration, subscription management, feature flags, team permissions, and user onboarding flows.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L4
  price: "$12"
  target: SaaS builders
  format: split
tools:
  - Read
  - Grep
  - Edit
  - Bash
---

# @rune/saas

## Purpose

SaaS applications share a common set of hard problems that most teams solve from scratch: tenant isolation that leaks data, billing webhooks that silently fail, subscription state that drifts from the payment provider, feature flags with no cleanup discipline, permission systems that escalate silently, and onboarding funnels that drop users before activation. This pack codifies production-tested patterns for each — detect the current architecture, audit for common SaaS pitfalls, and emit the correct implementation. These six skills are interdependent: tenant isolation shapes the billing model, billing drives feature gating, feature flags control gradual rollout, team permissions determine what each role can access, and gating plus permissions together determine the onboarding flow.

## Triggers

- Auto-trigger: when `tenant`, `subscription`, `billing`, `stripe`, `paddle`, `lemonsqueezy`, `polar`, `checkout`, `plan`, `pricing`, `featureFlag`, `rbac`, `permission`, `onboarding` patterns detected in codebase
- `/rune multi-tenant` — audit or implement tenant isolation
- `/rune billing-integration` — set up or audit billing provider integration
- `/rune subscription-flow` — build subscription management UI
- `/rune feature-flags` — implement feature flag system
- `/rune team-management` — build org/team RBAC and invite flows
- `/rune onboarding-flow` — build or audit user onboarding
- Called by `cook` (L1) when SaaS project patterns detected

## Skills Included

| Skill | Model | Description |
|-------|-------|-------------|
| [multi-tenant](skills/multi-tenant.md) | sonnet | Multi-tenancy patterns — database isolation strategies, tenant context middleware, data partitioning, cross-tenant query prevention, tenant-aware background jobs, and GDPR data export. |
| [billing-integration](skills/billing-integration.md) | sonnet | Billing integration — Stripe, LemonSqueezy, and Polar. Subscription + one-time checkout, Standard Webhooks verification, digital product delivery (repo invite, license key), dunning management, and tax handling. |
| [subscription-flow](skills/subscription-flow.md) | sonnet | Subscription UI flows — pricing page, checkout, plan upgrades/downgrades, plan migration, annual/monthly toggle with proration preview, coupon codes, lifetime deal support, and cancellation with retention. |
| [feature-flags](skills/feature-flags.md) | sonnet | Feature flag management — gradual rollouts, kill switches, A/B testing, user-segment targeting, and stale flag cleanup. |
| [team-management](skills/team-management.md) | sonnet | Organization, team, and member permissions — RBAC hierarchy, invite flow with expiry, permission checking at API and UI layers, and audit trail for permission changes. |
| [onboarding-flow](skills/onboarding-flow.md) | sonnet | User onboarding patterns — progressive disclosure, setup wizards, product tours, activation metrics (AARRR), empty states, re-engagement, and invite flows. |

## Workflows

| Workflow | Skills | Description |
|----------|--------|-------------|
| New SaaS setup | multi-tenant → billing-integration → team-management | Foundation: isolation + billing + RBAC |
| Feature launch | feature-flags → onboarding-flow | Gradual rollout with guided activation |
| Plan upgrade | subscription-flow → billing-integration | Proration preview + webhook sync |

## Tech Stack Support

| Billing Provider | SDK | Webhook Verification | Vietnam/Global | Best For |
|---|---|---|---|---|
| Stripe | stripe-node v17+ | Built-in `constructEvent` | Requires US/EU entity | Full-featured SaaS billing |
| LemonSqueezy | @lemonsqueezy/lemonsqueezy.js | HMAC SHA256 `x-signature` | ✅ MoR, global | Subscriptions, global sellers |
| Polar | @polar-sh/sdk | Standard Webhooks (HMAC SHA256) | ✅ MoR, global | Developer tools, one-time purchases, OSS monetization |
| Paddle | @paddle/paddle-node-sdk | Paddle webhook SDK | ✅ MoR, global | B2B SaaS, complex tax |

| Feature Flag Provider | Self-hosted | Managed | Best For |
|---|---|---|---|
| Custom Redis | ✅ Free | — | Simple boolean + percentage flags |
| Unleash | ✅ Open source | ✅ Cloud | Full-featured, self-hosted option |
| Flagsmith | ✅ Open source | ✅ Cloud | Open source with good React SDK |
| LaunchDarkly | ❌ | ✅ Paid | Enterprise, advanced targeting |
| Statsig | ❌ | ✅ Freemium | A/B testing + analytics |

## Connections

```
Calls → sentinel (L2): security audit on billing, tenant isolation, and RBAC
Calls → docs-seeker (L3): lookup billing provider API documentation
Calls → git (L3): emit semantic commits for schema migrations and billing changes
Calls → @rune/backend (L4): API patterns, auth flows, caching strategies for SaaS services
Called By ← cook (L1): when SaaS project patterns detected
Called By ← review (L2): when subscription/billing/RBAC code under review
Called By ← audit (L2): SaaS architecture health dimension
Called By ← ba (L2): translating business requirements into SaaS implementation patterns
```

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Webhook processes same event twice causing duplicate charges or state corruption | CRITICAL | Idempotency check: store processed event IDs, skip duplicates |
| Tenant isolation bypassed in admin or reporting queries | CRITICAL | Audit ALL query paths including admin, cron jobs, and reporting; use RLS as safety net |
| Admin promotes themselves to Owner (permission escalation) | CRITICAL | Rule: you can only assign roles ≤ your own; enforce server-side |
| Feature flag evaluated on every iteration inside a hot loop | HIGH | Evaluate flag once before the loop, pass as parameter; cache with 30s stale time |
| Plan downgrade hard-deletes data created under higher plan | HIGH | Implement read-only grace period (30 days) — never delete on downgrade |
| Trial expiry races with checkout completion | HIGH | Use billing provider's trial management; sync state from webhook, not from timer |
| Invite token reused by two concurrent requests → duplicate memberships | HIGH | Unique constraint on `(userId, orgId, teamId)`; catch constraint error gracefully |
| Onboarding wizard loses progress on page refresh | MEDIUM | Persist wizard state to localStorage or backend; resume from last incomplete step |
| Feature gate checked client-side only (bypassed via API) | HIGH | Enforce feature gates in API middleware, not just UI components |
| Last org Owner removed (org locked out) | HIGH | Block role change that would leave org with zero Owners |
| Stale feature flags accumulate (>50 flags, no cleanup) | MEDIUM | Weekly CI job: detect flags in code not in provider and vice versa |
| Checkout metadata missing fulfillment context (no user ID, no GitHub username) | HIGH | Always pass user identifier in checkout metadata — webhook handler cannot look up user without it |
| GitHub invite fails silently, order marked delivered | HIGH | Check invite API response status; mark order as `partial` if any repo invite fails; implement admin retry endpoint |
| Standard Webhooks timestamp replay attack | MEDIUM | Reject webhook-timestamp older than 5 minutes; prevents replayed webhook payloads |

## Done When

- Tenant isolation audited: every query scoped, RLS or middleware enforced, background jobs carry tenantId, GDPR export endpoint implemented
- Billing webhooks verified (provider-specific signature or Standard Webhooks HMAC), idempotent, and handling all lifecycle events including dunning flow
- One-time checkout flow implemented with metadata-driven delivery (repo invite, license key, or download link)
- Subscription flow has pricing page, checkout, upgrade, downgrade, proration preview, coupon codes, cancellation, and lifetime deal support
- Feature flags implemented with evaluation caching, stale flag detection, and test mocking
- Team RBAC implemented with invite flow, permission middleware, and audit trail
- Onboarding wizard has progress persistence, empty states, product tour, activation metric tracking, and re-engagement detection
- Structured report emitted for each skill invoked

## Cost Profile

~12,000–22,000 tokens per full pack run (all 6 skills). Individual skill: ~2,000–4,000 tokens. Sonnet default for code generation and security patterns. Use haiku for pattern detection scans (Steps 1–2 of each skill); escalate to sonnet for code generation and security audit; escalate to opus for architectural decisions (isolation strategy selection, RBAC schema design).
