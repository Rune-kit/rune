---
name: "@rune/saas"
description: SaaS patterns — multi-tenancy, billing integration, subscription management, and user onboarding flows.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L4
  price: "$12"
  target: SaaS builders
---

# @rune/saas

## Purpose

SaaS applications share a common set of hard problems that most teams solve from scratch: tenant isolation that leaks data, billing webhooks that silently fail, subscription state that drifts from the payment provider, and onboarding funnels that drop users before activation. This pack codifies production-tested patterns for each — detect the current architecture, audit for common SaaS pitfalls, and emit the correct implementation. These four skills are interdependent: tenant isolation shapes the billing model, billing drives feature gating, and gating determines the onboarding flow.

## Triggers

- Auto-trigger: when `tenant`, `subscription`, `billing`, `stripe`, `paddle`, `plan`, `pricing` patterns detected in codebase
- `/rune multi-tenant` — audit or implement tenant isolation
- `/rune billing-integration` — set up or audit billing provider integration
- `/rune subscription-flow` — build subscription management UI
- `/rune onboarding-flow` — build or audit user onboarding
- Called by `cook` (L1) when SaaS project patterns detected

## Skills Included

### multi-tenant

Multi-tenancy patterns — database isolation strategies, tenant context middleware, data partitioning, cross-tenant query prevention.

#### Workflow

**Step 1 — Detect current isolation strategy**
Use Grep to find tenant-related code: `tenantId`, `organizationId`, `workspaceId`, `x-tenant-id` header, RLS (Row-Level Security) policies, schema-per-tenant patterns, database switching logic. Read the database schema and middleware to classify: shared database with tenant column, schema-per-tenant, or database-per-tenant.

**Step 2 — Audit isolation boundaries**
Check for: queries without tenant filter (data leak risk), missing tenant context in middleware (requests without tenant identification), no RLS policies on shared tables, admin endpoints that bypass tenant isolation, background jobs that process cross-tenant data without scoping. Flag each with severity.

**Step 3 — Emit tenant-safe patterns**
Based on detected strategy, emit: tenant middleware (extract from JWT/header, set on request context), RLS policies for shared-schema approach, scoped repository pattern that injects tenant filter on every query, and tenant-aware test fixtures.

#### Example

```typescript
// Tenant middleware — extract from JWT, inject into request context
const tenantMiddleware = async (req, res, next) => {
  const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
  if (!tenantId) return res.status(403).json({ error: { code: 'TENANT_REQUIRED', message: 'Tenant context missing' } });
  req.tenantId = tenantId;
  next();
};

// Scoped repository — every query automatically filtered by tenant
class ScopedRepository<T> {
  constructor(private model: Model<T>, private tenantId: string) {}

  async findMany(where: Partial<T> = {}) {
    return this.model.findMany({ where: { ...where, tenantId: this.tenantId } });
  }

  async create(data: Omit<T, 'tenantId'>) {
    return this.model.create({ data: { ...data, tenantId: this.tenantId } });
  }
}

// PostgreSQL RLS policy
-- Enable RLS on shared table
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON projects
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

---

### billing-integration

Billing integration — Stripe, Paddle, LemonSqueezy. Subscription lifecycle, webhook handling, invoice generation, usage-based billing, dunning management.

#### Workflow

**Step 1 — Detect billing provider**
Use Grep to find billing code: `stripe`, `paddle`, `lemonsqueezy`, `@stripe/stripe-js`, webhook endpoints (`/webhook`, `/billing/webhook`), subscription models. Read payment configuration and webhook handlers.

**Step 2 — Audit webhook reliability**
Check for: missing webhook signature verification (accepting unverified events), no idempotency handling (duplicate event processing), missing event types (subscription deleted, payment failed, invoice paid), no dead-letter queue for failed webhook processing, subscription state stored only in payment provider (no local sync).

**Step 3 — Emit robust billing integration**
Emit: webhook handler with signature verification, idempotent event processing (store processed event IDs), subscription state sync (local DB mirrors provider state), dunning flow (failed payment → retry → grace period → suspend → cancel), and usage metering pattern.

#### Example

```typescript
// Stripe webhook handler — verified, idempotent, comprehensive
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

app.post('/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']!;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Idempotency: skip already-processed events
  const processed = await db.webhookEvent.findUnique({ where: { eventId: event.id } });
  if (processed) return res.json({ received: true, skipped: true });

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.deleted':
      await cancelSubscription(event.data.object as Stripe.Subscription);
      break;
    case 'invoice.payment_failed':
      await handleFailedPayment(event.data.object as Stripe.Invoice);
      break;
  }

  await db.webhookEvent.create({ data: { eventId: event.id, type: event.type, processedAt: new Date() } });
  res.json({ received: true });
});
```

---

### subscription-flow

Subscription UI flows — pricing page, checkout, plan upgrades/downgrades, cancellation, trial management, feature gating.

#### Workflow

**Step 1 — Detect subscription model**
Use Grep to find plan/tier definitions, feature flags, trial logic, checkout components. Read pricing config to understand: plan tiers, billing intervals, trial duration, feature gates, and upgrade/downgrade rules.

**Step 2 — Audit subscription UX**
Check for: pricing page without annual discount toggle, checkout without error recovery (failed payment leaves user in limbo), no trial-to-paid conversion flow, plan change without proration explanation, cancellation without retention offer, missing feature gates on protected routes.

**Step 3 — Emit subscription patterns**
Emit: type-safe plan configuration, feature gate middleware/hook, checkout flow with error handling, plan change with proration preview, cancellation flow with feedback collection, and trial expiry handling.

#### Example

```typescript
// Type-safe plan configuration + feature gating
const PLANS = {
  free:  { price: 0,  limits: { projects: 3, members: 1, storage: '100MB' }, features: ['basic_analytics'] },
  pro:   { price: 29, limits: { projects: 50, members: 10, storage: '10GB' }, features: ['basic_analytics', 'advanced_analytics', 'api_access', 'priority_support'] },
  team:  { price: 79, limits: { projects: -1, members: -1, storage: '100GB' }, features: ['basic_analytics', 'advanced_analytics', 'api_access', 'priority_support', 'sso', 'audit_log'] },
} as const;

type PlanId = keyof typeof PLANS;
type Feature = typeof PLANS[PlanId]['features'][number];

// Feature gate hook
function useFeatureGate(feature: Feature): { allowed: boolean; upgradeRequired: PlanId | null } {
  const { plan } = useSubscription();
  const allowed = PLANS[plan].features.includes(feature);
  if (allowed) return { allowed: true, upgradeRequired: null };
  const requiredPlan = Object.entries(PLANS).find(([_, p]) => p.features.includes(feature));
  return { allowed: false, upgradeRequired: requiredPlan?.[0] as PlanId ?? null };
}

// Usage in component
const { allowed, upgradeRequired } = useFeatureGate('advanced_analytics');
if (!allowed) return <UpgradePrompt plan={upgradeRequired} />;
```

---

### onboarding-flow

User onboarding patterns — progressive disclosure, setup wizards, product tours, activation metrics, empty states, invite flows.

#### Workflow

**Step 1 — Detect onboarding state**
Use Grep to find onboarding code: `onboarding`, `setup`, `wizard`, `tour`, `welcome`, `getting-started`, `empty-state`, `invite`. Read the signup/post-registration flow to understand what happens after account creation.

**Step 2 — Audit activation funnel**
Check for: signup → empty dashboard (no guidance), missing setup wizard for critical config, no progress indicator during multi-step setup, empty states without action prompts, invite flow that doesn't pre-populate team context, no activation metric tracking (user signed up but never completed key action).

**Step 3 — Emit onboarding patterns**
Emit: multi-step setup wizard with progress persistence (resume on reload), context-aware empty states with primary action, team invite flow with role selection, activation checklist component, and analytics event tracking for funnel steps.

#### Example

```typescript
// Onboarding wizard with progress persistence
const ONBOARDING_STEPS = ['profile', 'workspace', 'invite_team', 'first_project'] as const;
type Step = typeof ONBOARDING_STEPS[number];

function useOnboarding() {
  const [progress, setProgress] = useLocalStorage<Record<Step, boolean>>('onboarding', {
    profile: false, workspace: false, invite_team: false, first_project: false,
  });

  const currentStep = ONBOARDING_STEPS.find(step => !progress[step]) ?? null;
  const complete = (step: Step) => {
    setProgress(prev => ({ ...prev, [step]: true }));
    analytics.track('onboarding_step_complete', { step });
  };
  const isComplete = currentStep === null;
  const percentComplete = Object.values(progress).filter(Boolean).length / ONBOARDING_STEPS.length * 100;

  return { currentStep, complete, isComplete, percentComplete, progress };
}

// Empty state with action prompt
const EmptyProjects = () => (
  <EmptyState
    icon={<FolderIcon />}
    title="No projects yet"
    description="Create your first project to get started"
    action={<Button onClick={() => nav('/projects/new')}>Create Project</Button>}
  />
);
```

---

## Connections

```
Calls → sentinel (L2): security audit on billing and tenant isolation
Calls → docs-seeker (L3): lookup billing provider API documentation
Called By ← cook (L1): when SaaS project patterns detected
Called By ← review (L2): when subscription/billing code under review
Called By ← audit (L2): SaaS architecture health dimension
```

## Tech Stack Support

| Billing Provider | SDK | Webhook Library |
|-----------------|-----|-----------------|
| Stripe | stripe-node v17+ | Built-in signature verification |
| Paddle (Billing) | @paddle/paddle-node-sdk | Paddle webhook verification |
| LemonSqueezy | @lemonsqueezy/lemonsqueezy.js | Webhook signature in header |

## Constraints

1. MUST verify webhook signatures — never process unverified billing events.
2. MUST store subscription state locally — never rely solely on payment provider API for access control decisions.
3. MUST scope every database query to tenant context — unscoped queries are data leak vulnerabilities.
4. MUST handle billing edge cases: failed payments, disputed charges, plan downgrades with active usage over new limits.
5. MUST NOT expose billing provider customer IDs or internal subscription IDs to end users.

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Webhook processes same event twice causing duplicate charges or state corruption | CRITICAL | Idempotency check: store processed event IDs, skip duplicates |
| Tenant isolation bypassed in admin or reporting queries | CRITICAL | Audit ALL query paths including admin, cron jobs, and reporting; use RLS as safety net |
| Plan downgrade removes access to data created under higher plan | HIGH | Implement read-only access to over-limit data instead of hard deletion |
| Trial expiry races with checkout completion (user charged after trial ended differently) | HIGH | Use billing provider's trial management instead of custom timer; sync state from webhook |
| Onboarding wizard loses progress on page refresh | MEDIUM | Persist wizard state to localStorage or backend; resume from last incomplete step |
| Feature gate checked client-side only (bypassed via API) | HIGH | Enforce feature gates in API middleware, not just UI components |

## Done When

- Tenant isolation audited: every query scoped, RLS or middleware enforced
- Billing webhooks verified, idempotent, and handling all lifecycle events
- Subscription flow has pricing page, checkout, upgrade, downgrade, and cancellation
- Feature gating enforced at both API and UI layers
- Onboarding wizard implemented with progress persistence and activation tracking
- Structured report emitted for each skill invoked

## Cost Profile

~8,000–16,000 tokens per full pack run (all 4 skills). Individual skill: ~2,000–4,000 tokens. Sonnet default. Use haiku for pattern detection scans; escalate to sonnet for code generation and security audit.
