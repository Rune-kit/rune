---
name: "@rune/saas"
description: SaaS patterns — multi-tenancy, billing integration, subscription management, feature flags, team permissions, and user onboarding flows.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L4
  price: "$12"
  target: SaaS builders
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

- Auto-trigger: when `tenant`, `subscription`, `billing`, `stripe`, `paddle`, `lemonsqueezy`, `plan`, `pricing`, `featureFlag`, `rbac`, `permission`, `onboarding` patterns detected in codebase
- `/rune multi-tenant` — audit or implement tenant isolation
- `/rune billing-integration` — set up or audit billing provider integration
- `/rune subscription-flow` — build subscription management UI
- `/rune feature-flags` — implement feature flag system
- `/rune team-management` — build org/team RBAC and invite flows
- `/rune onboarding-flow` — build or audit user onboarding
- Called by `cook` (L1) when SaaS project patterns detected

## Skills Included

### multi-tenant

Multi-tenancy patterns — database isolation strategies, tenant context middleware, data partitioning, cross-tenant query prevention, tenant-aware background jobs, and GDPR data export.

#### Isolation Strategy Comparison

| Strategy | Cost | Isolation | Migration Difficulty | When to Use |
|---|---|---|---|---|
| Shared DB, tenant column | Low | Weak (app-enforced) | Easy | Early-stage, <1000 tenants |
| Shared DB + PostgreSQL RLS | Low | Strong (DB-enforced) | Easy | Best default for most SaaS |
| Schema-per-tenant | Medium | Strong | Medium | When tenants need schema customization |
| DB-per-tenant | High | Perfect | Hard | Enterprise, compliance (HIPAA, SOC2) |

#### Workflow

**Step 1 — Detect current isolation strategy**
Use Grep to find tenant-related code: `tenantId`, `organizationId`, `workspaceId`, `x-tenant-id` header, RLS policies, schema-per-tenant patterns, database switching logic. Read the database schema and middleware to classify the isolation strategy in use.

**Step 2 — Audit isolation boundaries**
Check for: queries without tenant filter (data leak risk), missing tenant context in middleware, no RLS policies on shared tables, admin endpoints that bypass tenant isolation, background jobs processing cross-tenant data without scoping. Flag each with severity.

**Step 3 — Emit tenant-safe patterns**
Based on detected strategy, emit: tenant middleware (extract from JWT/header, set on request context), RLS policies for shared-schema approach, scoped repository pattern that injects tenant filter on every query, and tenant-aware test fixtures.

**Step 4 — Tenant-aware background jobs**
Every background job MUST carry `tenantId`. Use BullMQ job data to pass tenant context, then initialize a scoped repository inside the job processor. Never process tenant data in a job without an explicit `tenantId` guard.

**Step 5 — Tenant data export (GDPR portability)**
Implement `/api/tenants/:id/export` that collects all data rows belonging to a tenant across all tables, serializes to JSON or CSV, and streams the result as a download. Log the export event in the audit trail with timestamp and requesting user.

#### Example

```typescript
// Tenant middleware — extract from JWT, inject into request context
const tenantMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const tenantId = req.user?.tenantId ?? req.headers['x-tenant-id'] as string;
  if (!tenantId) return res.status(403).json({ error: { code: 'TENANT_REQUIRED', message: 'Tenant context missing' } });
  req.tenantId = tenantId;
  next();
};

// Scoped repository — every query automatically filtered by tenant
class ScopedRepository<T extends { tenantId: string }> {
  constructor(private model: PrismaModel<T>, private tenantId: string) {}

  async findMany(where: Partial<Omit<T, 'tenantId'>> = {}) {
    return this.model.findMany({ where: { ...where, tenantId: this.tenantId } });
  }

  async create(data: Omit<T, 'tenantId' | 'id' | 'createdAt' | 'updatedAt'>) {
    return this.model.create({ data: { ...data, tenantId: this.tenantId } as any });
  }
}

// PostgreSQL RLS — DB-enforced isolation, safest approach
-- Enable RLS on every shared table
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Set tenant context before query (from app middleware)
SET LOCAL app.tenant_id = '550e8400-e29b-41d4-a716-446655440000';

-- Policy reads from session variable — automatic for all queries
CREATE POLICY tenant_isolation ON projects
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Set in Prisma $executeRaw before each query block:
-- await prisma.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;

// BullMQ — tenant-aware background job
const emailQueue = new Queue('emails');

// Producer: always pass tenantId in job data
await emailQueue.add('send-invoice', { tenantId, invoiceId, recipientEmail });

// Consumer: initialize scoped context from job data
const worker = new Worker('emails', async (job) => {
  const { tenantId, invoiceId } = job.data;
  const invoices = new ScopedRepository(prisma.invoice, tenantId);
  const invoice = await invoices.findMany({ id: invoiceId });
  // process...
});

// GDPR export — stream all tenant data
app.get('/api/tenants/:id/export', requireOwner, async (req, res) => {
  const { id: tenantId } = req.params;
  const [projects, members, invoices] = await Promise.all([
    prisma.project.findMany({ where: { tenantId } }),
    prisma.member.findMany({ where: { tenantId } }),
    prisma.invoice.findMany({ where: { tenantId } }),
  ]);
  await prisma.auditLog.create({ data: { tenantId, action: 'DATA_EXPORT', actorId: req.user.id } });
  res.setHeader('Content-Disposition', `attachment; filename="export-${tenantId}.json"`);
  res.json({ exportedAt: new Date(), projects, members, invoices });
});
```

---

### billing-integration

Billing integration — Stripe and LemonSqueezy (Stripe alternative for Vietnam/non-US sellers). Subscription lifecycle, webhook handling, usage-based billing, dunning management, and tax handling.

> **Vietnam note**: Stripe requires a US/EU entity and is unavailable for direct signup from Vietnam. LemonSqueezy acts as Merchant of Record — handles VAT, tax compliance, and payouts globally. Prefer LemonSqueezy for solo founders and small teams in Vietnam/Southeast Asia.

#### Workflow

**Step 1 — Detect billing provider**
Use Grep to find billing code: `stripe`, `lemonsqueezy`, `@stripe/stripe-js`, webhook endpoints (`/webhook`, `/billing/webhook`), subscription models. Read payment configuration and webhook handlers.

**Step 2 — Audit webhook reliability**
Check for: missing webhook signature verification, no idempotency handling, missing event types (subscription deleted, payment failed, invoice paid), no dead-letter queue for failed webhook processing, subscription state stored only in payment provider (no local sync).

**Step 3 — Emit robust billing integration**
Emit: webhook handler with signature verification, idempotent event processing (store processed event IDs), subscription state sync (local DB mirrors provider state).

**Step 4 — Usage-based billing (metered)**
For products where billing scales with usage (API calls, seats, storage): create a Stripe Meter, report usage records incrementally using `stripe.billing.meterEvents.create`, and handle overage pricing in the subscription's price tiers. Display current-period usage in the billing portal. For LemonSqueezy, use quantity-based subscriptions with a per-unit price and update quantity on usage checkpoints.

**Step 5 — Dunning management flow**
When `invoice.payment_failed` fires: Day 0 — notify customer, retry in 3 days. Day 3 — retry + second email. Day 7 — retry + urgent email + in-app warning banner. Day 14 — suspend account (read-only mode), email with payment link. Day 21 — cancel subscription, archive data with 30-day recovery window. Never hard-delete on cancellation.

#### Example

```typescript
// Stripe webhook — verified, idempotent, full lifecycle
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

app.post('/billing/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']!;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const processed = await db.webhookEvent.findUnique({ where: { eventId: event.id } });
  if (processed) return res.json({ received: true, skipped: true });

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await syncSubscription(event.data.object as Stripe.Subscription); break;
    case 'customer.subscription.deleted':
      await cancelSubscription(event.data.object as Stripe.Subscription); break;
    case 'invoice.payment_failed':
      await startDunningFlow(event.data.object as Stripe.Invoice); break;
    case 'invoice.payment_succeeded':
      await clearDunningState((event.data.object as Stripe.Invoice).customer as string); break;
  }

  await db.webhookEvent.create({ data: { eventId: event.id, type: event.type, processedAt: new Date() } });
  res.json({ received: true });
});

// LemonSqueezy webhook — alternative for Vietnam-based sellers
import crypto from 'crypto';

app.post('/billing/webhook/lemonsqueezy', express.raw({ type: 'application/json' }), async (req, res) => {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!;
  const hmac = crypto.createHmac('sha256', secret);
  const digest = Buffer.from(hmac.update(req.body).digest('hex'), 'utf8');
  const signature = Buffer.from(req.headers['x-signature'] as string ?? '', 'utf8');

  if (!crypto.timingSafeEqual(digest, signature)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const payload = JSON.parse(req.body.toString());
  const eventName: string = payload.meta.event_name;

  switch (eventName) {
    case 'subscription_created':
    case 'subscription_updated':
      await syncLSSubscription(payload.data); break;
    case 'subscription_cancelled':
      await cancelLSSubscription(payload.data); break;
    case 'subscription_payment_failed':
      await startDunningFlow({ customerId: payload.data.attributes.customer_id }); break;
  }

  res.json({ received: true });
});

// Usage-based billing — report metered usage to Stripe
const reportUsage = async (tenantId: string, quantity: number) => {
  const subscription = await db.subscription.findUnique({ where: { tenantId } });
  await stripe.billing.meterEvents.create({
    event_name: 'api_call',
    payload: { stripe_customer_id: subscription!.stripeCustomerId, value: String(quantity) },
  });
};

// Dunning state machine
const startDunningFlow = async ({ customer }: { customer?: string | null; customerId?: string }) => {
  const tenantId = await getTenantByCustomer(customer ?? '');
  await db.tenant.update({ where: { id: tenantId }, data: { dunningStartedAt: new Date(), status: 'PAYMENT_FAILED' } });
  await emailQueue.add('dunning-day0', { tenantId }, { delay: 0 });
  await emailQueue.add('dunning-day3', { tenantId }, { delay: 3 * 24 * 60 * 60 * 1000 });
  await emailQueue.add('dunning-day7', { tenantId }, { delay: 7 * 24 * 60 * 60 * 1000 });
  await emailQueue.add('dunning-suspend', { tenantId }, { delay: 14 * 24 * 60 * 60 * 1000 });
  await emailQueue.add('dunning-cancel', { tenantId }, { delay: 21 * 24 * 60 * 60 * 1000 });
};
```

**Tax handling:**
- **Stripe Tax** — enable in Stripe dashboard, set `automatic_tax: { enabled: true }` on checkout sessions. Handles US state tax, EU VAT automatically.
- **Paddle** — acts as Merchant of Record (same as LemonSqueezy), handles all tax obligations. Good alternative if LemonSqueezy doesn't support your use case.
- **EU VAT** — if selling direct (not through MoR): collect VAT registration number, validate via VIES API, apply reverse charge for B2B EU transactions.

---

### subscription-flow

Subscription UI flows — pricing page, checkout, plan upgrades/downgrades, plan migration, annual/monthly toggle with proration preview, coupon codes, lifetime deal support, and cancellation with retention.

#### Workflow

**Step 1 — Detect subscription model**
Use Grep to find plan/tier definitions, feature flags, trial logic, checkout components. Read pricing config to understand: plan tiers, billing intervals, trial duration, feature gates, and upgrade/downgrade rules.

**Step 2 — Audit subscription UX**
Check for: pricing page without annual toggle, checkout without error recovery, no trial-to-paid conversion flow, plan change without proration explanation, cancellation without retention offer, missing feature gates on protected API routes.

**Step 3 — Emit subscription patterns**
Emit: type-safe plan configuration, feature gate middleware/hook, checkout flow with error handling, plan change with proration preview, cancellation flow with feedback collection, and trial expiry handling.

**Step 4 — Plan migration on downgrade**
When a user downgrades to a lower plan that has stricter limits (e.g., Pro 50 projects → Free 3 projects): DO NOT hard-delete over-limit data. Three options: (a) **Read-only grace period** — over-limit items become read-only for 30 days, user prompted to delete or upgrade; (b) **Hard limit** — block new item creation when at limit, existing items preserved; (c) **Grace period + export** — email user with export link, mark items for deletion after 60 days. Default recommendation: option (a) for good UX.

**Step 5 — Annual/monthly toggle + proration + coupons + lifetime deals**
Show annual price with savings badge ("Save 20%"). On plan change, call Stripe's proration preview endpoint and display "You'll be charged $X today" before confirming. For coupon codes: validate via `stripe.promotionCodes.list`, display discount amount/percentage and expiry. For lifetime deals (AppSumo, LemonSqueezy): create a one-time payment product, on `order_created` webhook set `subscription.plan = 'lifetime'` with `expiresAt = null` — lifetime access never expires.

#### Example

```typescript
// Type-safe plan configuration + feature gating
const PLANS = {
  free:     { price: 0,   limits: { projects: 3,   members: 1,   storage: '100MB' }, features: ['basic_analytics'] },
  pro:      { price: 29,  limits: { projects: 50,  members: 10,  storage: '10GB'  }, features: ['basic_analytics', 'advanced_analytics', 'api_access', 'priority_support'] },
  team:     { price: 79,  limits: { projects: -1,  members: -1,  storage: '100GB' }, features: ['basic_analytics', 'advanced_analytics', 'api_access', 'priority_support', 'sso', 'audit_log'] },
  lifetime: { price: 199, limits: { projects: -1,  members: 25,  storage: '50GB'  }, features: ['basic_analytics', 'advanced_analytics', 'api_access', 'priority_support'] },
} as const;

type PlanId = keyof typeof PLANS;
type Feature = typeof PLANS[PlanId]['features'][number];

function useFeatureGate(feature: Feature): { allowed: boolean; upgradeRequired: PlanId | null } {
  const { plan } = useSubscription();
  const allowed = (PLANS[plan].features as readonly string[]).includes(feature);
  if (allowed) return { allowed: true, upgradeRequired: null };
  const requiredPlan = (Object.entries(PLANS) as [PlanId, typeof PLANS[PlanId]][])
    .find(([_, p]) => (p.features as readonly string[]).includes(feature));
  return { allowed: false, upgradeRequired: requiredPlan?.[0] ?? null };
}

// Proration preview before plan change
const getProrationPreview = async (tenantId: string, newPriceId: string): Promise<number> => {
  const sub = await db.subscription.findUnique({ where: { tenantId } });
  const preview = await stripe.invoices.retrieveUpcoming({
    customer: sub!.stripeCustomerId,
    subscription: sub!.stripeSubscriptionId,
    subscription_items: [{ id: sub!.stripeItemId, price: newPriceId }],
    subscription_proration_behavior: 'create_prorations',
  });
  return preview.amount_due / 100; // dollars
};

// Coupon validation
const validateCoupon = async (code: string) => {
  const promos = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
  if (!promos.data.length) throw new Error('Invalid or expired coupon');
  const promo = promos.data[0];
  const coupon = promo.coupon;
  return {
    id: promo.id,
    discount: coupon.percent_off ? `${coupon.percent_off}% off` : `$${(coupon.amount_off! / 100).toFixed(2)} off`,
    duration: coupon.duration,
  };
};

// Lifetime deal — LemonSqueezy one-time payment webhook
app.post('/billing/webhook/lemonsqueezy', express.raw({ type: 'application/json' }), async (req, res) => {
  // ...signature check...
  const payload = JSON.parse(req.body.toString());
  if (payload.meta.event_name === 'order_created') {
    const email = payload.data.attributes.user_email;
    const user = await db.user.findUnique({ where: { email } });
    if (user) {
      await db.subscription.upsert({
        where: { userId: user.id },
        update: { plan: 'lifetime', expiresAt: null },
        create: { userId: user.id, plan: 'lifetime', expiresAt: null },
      });
    }
  }
  res.json({ received: true });
});
```

---

### feature-flags

Feature flag management — gradual rollouts, kill switches, A/B testing, user-segment targeting, and stale flag cleanup. Supports self-hosted (Unleash, custom Redis) and managed (LaunchDarkly, Statsig, Flagsmith).

#### Flag Types

| Type | Use Case | Example |
|---|---|---|
| Boolean | Simple on/off for a feature | `new_dashboard_ui` |
| Percentage rollout | Gradual release 1% → 100% | `redesigned_editor: 25%` |
| User segment | Specific users/orgs first | `beta_users`, `enterprise_plan` |
| A/B test | Compare variants with metrics | `checkout_flow: variant_a / variant_b` |
| Kill switch | Instant disable on failure | `payment_processor_v2` |
| Environment | Dev/staging/prod separation | Auto by `NODE_ENV` |

#### Rollout Pattern: Canary → Gradual → GA

```
1% (internal + beta users) → 10% → 25% → 50% → 100% → cleanup flag after 30 days at 100%
```

#### Workflow

**Step 1 — Identify feature boundary**
Before writing code, define the flag: name (kebab-case, descriptive), default value (false = safe default), targeting rules (who sees it first), and planned cleanup date. Document in your flag provider dashboard.

**Step 2 — Create flag with targeting rules**
In Unleash/LaunchDarkly/Flagsmith: create flag with gradual rollout strategy. Start at 0%. Add a "beta users" segment for internal testing before any percentage rollout. Set environment-specific defaults: always-on in dev, gradual in staging, starts at 0% in prod.

**Step 3 — Implement client/server evaluation**
Client: evaluate flag in a React hook, never inline. Server: evaluate in middleware or at request start, attach result to request context. Never evaluate flags inside hot loops — cache the result for the request lifetime.

**Step 4 — Add analytics event tracking**
Every flag evaluation on a user-facing feature should fire an analytics event: `feature_flag_evaluated` with `{ flag, variant, userId, tenantId }`. This enables funnel analysis by variant and measures the rollout's impact on key metrics.

**Step 5 — Schedule flag cleanup**
Flags that have been at 100% for >30 days are stale. Run a weekly lint job: grep all flag keys used in code, compare against provider's flag list, flag mismatches (code uses a flag that was deleted → runtime error, or flag exists but never referenced → cleanup candidate). Remove stale flags from both code and provider in the same PR.

#### Example

```typescript
// Custom Redis-based flag evaluation (self-hosted, zero SaaS dependency)
import { Redis } from 'ioredis';
const redis = new Redis(process.env.REDIS_URL!);

interface FlagConfig {
  enabled: boolean;
  percentage?: number;          // 0-100 for gradual rollout
  allowedUsers?: string[];      // canary user IDs
  allowedPlans?: string[];      // plan-based targeting
}

const evaluateFlag = async (
  flagKey: string,
  ctx: { userId: string; tenantId: string; plan: string }
): Promise<boolean> => {
  const raw = await redis.get(`flag:${flagKey}`);
  if (!raw) return false; // default off = safe
  const config: FlagConfig = JSON.parse(raw);
  if (!config.enabled) return false;
  if (config.allowedUsers?.includes(ctx.userId)) return true;
  if (config.allowedPlans?.includes(ctx.plan)) return true;
  if (config.percentage !== undefined) {
    // Deterministic: same user always gets same bucket
    const hash = parseInt(ctx.userId.slice(-8), 16) % 100;
    return hash < config.percentage;
  }
  return config.enabled;
};

// React hook — evaluate once per render cycle, never in loops
function useFlag(flagKey: string): boolean {
  const { user } = useAuth();
  const { data: enabled = false } = useQuery({
    queryKey: ['flag', flagKey, user?.id],
    queryFn: () => fetchFlag(flagKey),
    staleTime: 30_000, // cache 30s — flags don't change every millisecond
  });
  return enabled;
}

// Server middleware — evaluate at request boundary, attach to context
const flagMiddleware = (flagKey: string) => async (req: Request, res: Response, next: NextFunction) => {
  req.flags = req.flags ?? {};
  req.flags[flagKey] = await evaluateFlag(flagKey, {
    userId: req.user!.id,
    tenantId: req.tenantId!,
    plan: req.user!.plan,
  });
  next();
};

// Usage in route — flag already evaluated, no async needed
app.get('/api/checkout', flagMiddleware('new_checkout_v2'), (req, res) => {
  if (req.flags['new_checkout_v2']) {
    return checkoutV2Handler(req, res);
  }
  return checkoutV1Handler(req, res);
});

// Stale flag detection — run weekly in CI
import { execSync } from 'child_process';

const findStaleFlags = async () => {
  const flagsInCode = execSync('grep -r "useFlag\\|evaluateFlag" src/ --include="*.ts" -h')
    .toString()
    .match(/(?:useFlag|evaluateFlag)\(['"]([^'"]+)['"]/g)
    ?.map(m => m.match(/['"]([^'"]+)['"]/)?.[1])
    .filter(Boolean) ?? [];

  const flagsInProvider = await redis.keys('flag:*').then(keys => keys.map(k => k.replace('flag:', '')));
  const stale = flagsInProvider.filter(f => !flagsInCode.includes(f));
  const missing = flagsInCode.filter(f => !flagsInProvider.includes(f));
  return { stale, missing };
};
```

**Sharp edges for flags:**
- Never evaluate flags on hot paths (e.g., inside `Array.map` over 1000 items) — cache the flag state at the top of the function.
- In tests: mock flag evaluation at the provider level, not by conditionally skipping flag checks. Every code path should be testable with flags on and off.
- Flag dependency chains (flag A enables flag B) — avoid. If you need compound logic, evaluate both flags independently and combine in application code. Provider-level dependencies are invisible in code review.
- Percentage rollout is not the same as A/B test — percentage rollout has no control group. For A/B tests, always keep a 50/50 split or a defined control group.

---

### team-management

Organization, team, and member permissions — RBAC hierarchy, invite flow with expiry, permission checking at API and UI layers, and audit trail for permission changes.

#### Role Hierarchy

```
Owner (1 per org)
  └── Admin (multiple)
        └── Member (default role)
              └── Viewer (read-only)
```

Org-level roles apply across all teams. Team-level roles can be more restrictive (e.g., org Member can be team Admin for a specific team).

#### Permission Matrix

| Action | Owner | Admin | Member | Viewer |
|---|---|---|---|---|
| Delete organization | ✅ | ❌ | ❌ | ❌ |
| Manage billing | ✅ | ✅ | ❌ | ❌ |
| Invite members | ✅ | ✅ | ❌ | ❌ |
| Create teams | ✅ | ✅ | ❌ | ❌ |
| Create projects | ✅ | ✅ | ✅ | ❌ |
| View projects | ✅ | ✅ | ✅ | ✅ |
| Manage team members | ✅ | ✅ (own teams) | ❌ | ❌ |

#### Workflow

**Step 1 — Design org/team schema**
Model: `Organization → Team → Membership (userId, orgId, teamId?, role)`. Org-level membership has `teamId = null`. Team-level membership scopes the role to a specific team. Use a single `Membership` table with nullable `teamId` rather than separate `OrgMember` and `TeamMember` tables.

**Step 2 — Implement RBAC middleware**
Create a `requirePermission(action)` middleware that reads `req.user.id` + `req.tenantId`, loads the user's role for that org, and checks against a permission map. Fail fast: return 403 immediately if permission not found. Never trust client-provided role claims.

**Step 3 — Build invite flow**
Invite: generate a signed token (`crypto.randomBytes(32).hex`), store with `{ email, orgId, role, invitedBy, expiresAt: +7d }`, send email with link. Accept: verify token not expired, not already accepted, create Membership record, mark invite as accepted. Resend: invalidate old token, create new one with fresh expiry. Pending invites visible to admins in settings.

**Step 4 — Add permission UI gates**
In React: `<CanAccess action="invite_members"><InviteButton /></CanAccess>` — hides UI elements the user can't use. Also disable + tooltip pattern: show the button but disable it with "Upgrade to invite members" tooltip (better UX than hiding, helps users understand what's possible). Enforce the same check in the API — UI gates are cosmetic only.

**Step 5 — Emit audit trail**
Every permission change, role assignment, invite, and removal MUST log to an `AuditLog` table: `{ orgId, actorId, targetId, action, before, after, ip, userAgent, timestamp }`. Surface the last 100 entries in the org settings Security tab. Retain for 90 days minimum (compliance requirement for SOC2).

#### Example

```typescript
// Prisma schema — org, team, membership
model Organization {
  id        String       @id @default(cuid())
  name      String
  slug      String       @unique
  members   Membership[]
  teams     Team[]
}

model Team {
  id      String       @id @default(cuid())
  orgId   String
  name    String
  org     Organization  @relation(fields: [orgId], references: [id])
  members Membership[]
}

model Membership {
  id        String       @id @default(cuid())
  userId    String
  orgId     String
  teamId    String?      // null = org-level role
  role      Role
  user      User         @relation(fields: [userId], references: [id])
  org       Organization @relation(fields: [orgId], references: [id])
  team      Team?        @relation(fields: [teamId], references: [id])

  @@unique([userId, orgId, teamId]) // one role per user per scope
}

enum Role { OWNER ADMIN MEMBER VIEWER }

// Permission map
const PERMISSIONS = {
  delete_org:      ['OWNER'],
  manage_billing:  ['OWNER', 'ADMIN'],
  invite_members:  ['OWNER', 'ADMIN'],
  create_projects: ['OWNER', 'ADMIN', 'MEMBER'],
  view_projects:   ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],
} as const;
type Action = keyof typeof PERMISSIONS;

// RBAC middleware — never trust client-provided role
const requirePermission = (action: Action) => async (req: Request, res: Response, next: NextFunction) => {
  const membership = await prisma.membership.findFirst({
    where: { userId: req.user!.id, orgId: req.tenantId!, teamId: null },
  });
  if (!membership || !(PERMISSIONS[action] as readonly string[]).includes(membership.role)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', action } });
  }
  req.userRole = membership.role;
  next();
};

// React permission hook
function usePermission(action: Action): boolean {
  const { membership } = useOrg();
  if (!membership) return false;
  return (PERMISSIONS[action] as readonly string[]).includes(membership.role);
}

// Invite flow
const createInvite = async (orgId: string, email: string, role: Role, invitedBy: string) => {
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.invite.create({
    data: { orgId, email, role, invitedBy, token, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  });
  await emailQueue.add('invite', { email, token, orgId });
  return token;
};

const acceptInvite = async (token: string, userId: string) => {
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw new Error('Invalid or expired invite');
  }
  await prisma.$transaction([
    prisma.membership.create({ data: { userId, orgId: invite.orgId, role: invite.role } }),
    prisma.invite.update({ where: { token }, data: { acceptedAt: new Date() } }),
    prisma.auditLog.create({ data: { orgId: invite.orgId, actorId: userId, action: 'MEMBER_JOINED', targetId: userId } }),
  ]);
};
```

**Sharp edges for team-management:**
- **Permission escalation**: an Admin inviting another Admin is fine, but an Admin promoting themselves to Owner must be blocked. Rule: you can only assign roles lower than your own.
- **Cross-org data leak**: when loading team resources, always filter by `orgId`. A user who belongs to two orgs must never see org B's data when acting in org A's context.
- **Invite token reuse**: after an invite is accepted, mark it accepted immediately in the same transaction as membership creation. Race condition: two tabs accepting the same invite → use `@@unique` on membership + catch unique constraint error.
- **Owner removal**: prevent the last Owner from being removed or downgraded. Always require at least one Owner per org. Check before processing the role change.

---

### onboarding-flow

User onboarding patterns — progressive disclosure, setup wizards, product tours, activation metrics (AARRR), empty states, re-engagement, and invite flows.

#### Workflow

**Step 1 — Detect onboarding state**
Use Grep to find onboarding code: `onboarding`, `setup`, `wizard`, `tour`, `welcome`, `getting-started`, `empty-state`, `invite`. Read the signup/post-registration flow to understand what happens after account creation.

**Step 2 — Audit activation funnel**
Check for: signup → empty dashboard (no guidance), missing setup wizard for critical config, no progress indicator during multi-step setup, empty states without action prompts, invite flow that doesn't pre-populate team context, no activation metric tracking.

**Step 3 — Emit onboarding patterns**
Emit: multi-step setup wizard with progress persistence (resume on reload), context-aware empty states with primary action, team invite flow with role selection, activation checklist component, and analytics event tracking for funnel steps.

**Step 4 — Activation metric framework (AARRR)**
Define your "Aha moment" — the single action that correlates with long-term retention. Common patterns: "created first project + invited one teammate" (Slack), "connected data source" (analytics tools), "ran first workflow" (automation tools). Instrument this event explicitly: `analytics.track('activation_achieved', { userId, tenantId, daysFromSignup })`. Track activation rate weekly. If <40% of signups activate in 7 days, the onboarding is broken.

**Step 5 — Re-engagement for dormant users**
Detect dormant: user signed up but never achieved activation, OR activated user with no activity in 14 days. Trigger: Day 3 after signup with no activation → in-app banner + email tip. Day 7 → personalized email with "here's what you haven't tried yet". Day 14 → offer a guided setup call or live demo. Track re-engagement conversion rate separately from organic activation.

#### Example

```typescript
// Onboarding wizard with progress persistence + analytics
const ONBOARDING_STEPS = ['profile', 'workspace', 'invite_team', 'first_project'] as const;
type Step = typeof ONBOARDING_STEPS[number];

function useOnboarding() {
  const [progress, setProgress] = useLocalStorage<Record<Step, boolean>>('onboarding', {
    profile: false, workspace: false, invite_team: false, first_project: false,
  });

  const currentStep = ONBOARDING_STEPS.find(step => !progress[step]) ?? null;
  const complete = (step: Step) => {
    setProgress(prev => ({ ...prev, [step]: true }));
    analytics.track('onboarding_step_complete', { step, totalSteps: ONBOARDING_STEPS.length });
  };
  const isComplete = currentStep === null;
  const percentComplete = (Object.values(progress).filter(Boolean).length / ONBOARDING_STEPS.length) * 100;
  return { currentStep, complete, isComplete, percentComplete, progress };
}

// Empty state library — 5 common SaaS empty states
const EMPTY_STATES = {
  no_projects: {
    icon: 'FolderIcon',
    title: 'No projects yet',
    description: 'Create your first project to get started.',
    cta: { label: 'Create Project', href: '/projects/new' },
  },
  no_team_members: {
    icon: 'UsersIcon',
    title: 'You\'re working alone',
    description: 'Invite your team to collaborate.',
    cta: { label: 'Invite Teammates', href: '/settings/members' },
  },
  no_data: {
    icon: 'ChartIcon',
    title: 'No data yet',
    description: 'Connect your first data source to see analytics.',
    cta: { label: 'Connect Source', href: '/integrations' },
  },
  no_integrations: {
    icon: 'PlugIcon',
    title: 'No integrations connected',
    description: 'Connect your tools to unlock automation.',
    cta: { label: 'Browse Integrations', href: '/integrations' },
  },
  no_billing: {
    icon: 'CreditCardIcon',
    title: 'No payment method',
    description: 'Add a payment method to unlock Pro features.',
    cta: { label: 'Add Payment Method', href: '/settings/billing' },
  },
} as const;

// Product tour — step-by-step spotlight with dismiss/snooze
interface TourStep { target: string; title: string; description: string; position: 'top' | 'bottom' | 'left' | 'right'; }

function useProductTour(tourId: string, steps: TourStep[]) {
  const [state, setState] = useLocalStorage<{ completed: boolean; dismissed: boolean; step: number }>(`tour:${tourId}`, {
    completed: false, dismissed: false, step: 0,
  });

  const advance = () => {
    if (state.step + 1 >= steps.length) {
      setState(s => ({ ...s, completed: true }));
      analytics.track('product_tour_completed', { tourId });
    } else {
      setState(s => ({ ...s, step: s.step + 1 }));
    }
  };

  const dismiss = (snoozeMinutes?: number) => {
    if (snoozeMinutes) {
      const snoozeUntil = Date.now() + snoozeMinutes * 60_000;
      setState(s => ({ ...s, dismissed: true }));
      localStorage.setItem(`tour:${tourId}:snooze`, String(snoozeUntil));
    } else {
      setState(s => ({ ...s, dismissed: true }));
      analytics.track('product_tour_dismissed', { tourId, atStep: state.step });
    }
  };

  const isSnoozed = () => {
    const snoozeUntil = Number(localStorage.getItem(`tour:${tourId}:snooze`) ?? 0);
    return Date.now() < snoozeUntil;
  };

  const active = !state.completed && !state.dismissed && !isSnoozed();
  return { active, currentStep: steps[state.step], stepIndex: state.step, advance, dismiss };
}

// Re-engagement detection — server-side cron
const detectDormantUsers = async () => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const dormant = await prisma.user.findMany({
    where: {
      createdAt: { lt: sevenDaysAgo },
      activatedAt: null, // never completed activation
      lastReEngagementEmailAt: null,
    },
    take: 500,
  });
  for (const user of dormant) {
    await emailQueue.add('re-engagement', { userId: user.id });
    await prisma.user.update({ where: { id: user.id }, data: { lastReEngagementEmailAt: new Date() } });
  }
};
```

---

## Connections

```
Calls → sentinel (L2): security audit on billing, tenant isolation, and RBAC
Calls → docs-seeker (L3): lookup billing provider API documentation
Calls → git (L3): emit semantic commits for schema migrations and billing changes
Called By ← cook (L1): when SaaS project patterns detected
Called By ← review (L2): when subscription/billing/RBAC code under review
Called By ← audit (L2): SaaS architecture health dimension
Called By ← ba (L2): translating business requirements into SaaS implementation patterns
```

## Tech Stack Support

| Billing Provider | SDK | Webhook Verification | Vietnam/Global |
|---|---|---|---|
| Stripe | stripe-node v17+ | Built-in `constructEvent` | Requires US/EU entity |
| LemonSqueezy | @lemonsqueezy/lemonsqueezy.js | HMAC SHA256 header | ✅ Works globally, Merchant of Record |
| Paddle | @paddle/paddle-node-sdk | Paddle webhook SDK | ✅ Works globally, Merchant of Record |

| Feature Flag Provider | Self-hosted | Managed | Best For |
|---|---|---|---|
| Custom Redis | ✅ Free | — | Simple boolean + percentage flags |
| Unleash | ✅ Open source | ✅ Cloud | Full-featured, self-hosted option |
| Flagsmith | ✅ Open source | ✅ Cloud | Open source with good React SDK |
| LaunchDarkly | ❌ | ✅ Paid | Enterprise, advanced targeting |
| Statsig | ❌ | ✅ Freemium | A/B testing + analytics |

## Constraints

1. MUST verify webhook signatures — never process unverified billing events.
2. MUST store subscription state locally — never rely solely on the payment provider API for access control decisions.
3. MUST scope every database query to tenant context — unscoped queries are data leak vulnerabilities.
4. MUST handle billing edge cases: failed payments, disputed charges, plan downgrades with active usage over new limits.
5. MUST NOT expose billing provider customer IDs or internal subscription IDs to end users.
6. MUST enforce RBAC at the API layer — client-side permission gates are cosmetic only.
7. MUST default feature flags to `false` — opt-in is safer than opt-out.
8. MUST clean up stale feature flags within 30 days of full rollout.

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

## Done When

- Tenant isolation audited: every query scoped, RLS or middleware enforced, background jobs carry tenantId, GDPR export endpoint implemented
- Billing webhooks verified, idempotent, and handling all lifecycle events including dunning flow
- Subscription flow has pricing page, checkout, upgrade, downgrade, proration preview, coupon codes, cancellation, and lifetime deal support
- Feature flags implemented with evaluation caching, stale flag detection, and test mocking
- Team RBAC implemented with invite flow, permission middleware, and audit trail
- Onboarding wizard has progress persistence, empty states, product tour, activation metric tracking, and re-engagement detection
- Structured report emitted for each skill invoked

## Cost Profile

~12,000–22,000 tokens per full pack run (all 6 skills). Individual skill: ~2,000–4,000 tokens. Sonnet default for code generation and security patterns. Use haiku for pattern detection scans (Steps 1–2 of each skill); escalate to sonnet for code generation and security audit; escalate to opus for architectural decisions (isolation strategy selection, RBAC schema design).
