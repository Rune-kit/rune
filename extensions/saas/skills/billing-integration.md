---
name: "billing-integration"
pack: "@rune/saas"
description: "Billing integration — Stripe, LemonSqueezy, and Polar. Subscription lifecycle, one-time checkout, webhook handling, Standard Webhooks verification, usage-based billing, dunning management, digital product delivery, and tax handling."
model: sonnet
tools: [Read, Edit, Write, Grep, Glob, Bash]
---

# billing-integration

Billing integration — Stripe, LemonSqueezy, and Polar. Subscription lifecycle, one-time payment checkout, webhook handling, Standard Webhooks signature verification, usage-based billing, dunning management, digital product delivery, and tax handling.

> **Provider selection**: Stripe requires a US/EU entity. LemonSqueezy and Polar act as Merchant of Record — handle VAT, tax compliance, and payouts globally. Prefer LemonSqueezy or Polar for solo founders in Vietnam/Southeast Asia. Polar is optimized for developer tools and digital products (open source monetization, one-time purchases, CLI tools).

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

**Step 6 — Hosted checkout flow (one-time + subscription)**
For products sold as one-time purchases (lifetime deals, digital products, CLI tools): create a checkout session server-side with product ID + metadata (user identifier, tier), redirect user to provider's hosted checkout page, listen for `order.paid` webhook to fulfill. This pattern works across all providers — only the API shape differs. Always pass fulfillment context (user ID, GitHub username, email) in checkout metadata so the webhook handler can deliver without a second lookup.

**Step 7 — Standard Webhooks signature verification**
Polar (and any provider using the Standard Webhooks spec via Svix) sends three headers: `webhook-id`, `webhook-timestamp`, `webhook-signature`. Verify with HMAC-SHA256: `sign(base64decode(secret), "{webhook-id}.{timestamp}.{rawBody}")`. Compare against all signatures in the header (space-separated `v1,{base64}`). Also check timestamp is within 5 minutes to prevent replay attacks. This is different from Stripe's `constructEvent` or LemonSqueezy's `x-signature` — detect which spec the provider uses.

**Step 8 — Digital product delivery**
After payment confirmation, deliver the product automatically. Three common patterns: (a) **Repo access** — call GitHub/GitLab API to add user as collaborator with `pull` permission. Pass username in checkout metadata. Handle 201 (invited) and 204 (already collaborator). (b) **License key** — generate unique key, store in DB with expiry + tier + features, email to customer. Provide public verification endpoint for the product to call at startup. (c) **Download link** — generate signed URL with expiry (S3 presigned, R2 signed). Email link + store for re-download. For all patterns: store delivery result alongside order, implement retry for partial failures, sync to central dashboard for tracking.

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

// Polar — hosted checkout for one-time purchases (developer tools, digital products)
// Create checkout session server-side, redirect client to checkout.url
app.post('/checkout/create', async (req, res) => {
  const { productId, githubUsername, email } = req.body;

  const checkout = await fetch('https://api.polar.sh/v1/checkouts/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      products: [productId],
      success_url: `${process.env.APP_URL}/checkout/success?checkout_id={CHECKOUT_ID}`,
      ...(email ? { customer_email: email } : {}),
      metadata: { github_username: githubUsername, tier: 'pro' }, // fulfillment context
    }),
  }).then(r => r.json());

  res.json({ url: checkout.url }); // redirect client to this URL
});

// Polar webhook — Standard Webhooks spec (also used by Svix, Resend, Clerk)
app.post('/billing/webhook/polar', express.raw({ type: 'application/json' }), async (req, res) => {
  const webhookId = req.headers['webhook-id'] as string;
  const timestamp = req.headers['webhook-timestamp'] as string;
  const signature = req.headers['webhook-signature'] as string;

  // Verify: HMAC-SHA256(base64decode(secret), "{id}.{timestamp}.{body}")
  const secret = Buffer.from(process.env.POLAR_WEBHOOK_SECRET!.replace(/^whsec_/, ''), 'base64');
  const content = `${webhookId}.${timestamp}.${req.body.toString()}`;
  const expected = crypto.createHmac('sha256', secret).update(content).digest('base64');

  const valid = signature.split(' ').some(s => {
    const parts = s.split(',');
    return parts.length === 2 && parts[1] === expected;
  });
  if (!valid) return res.status(403).json({ error: 'Invalid signature' });

  // Replay protection: reject timestamps older than 5 minutes
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    return res.status(403).json({ error: 'Timestamp too old' });
  }

  const event = JSON.parse(req.body.toString());
  if (event.type !== 'order.paid') return res.json({ received: true });

  const { metadata } = event.data;
  // Deliver based on product type using metadata set during checkout
  if (metadata.github_username) {
    await inviteToRepo(metadata.github_username, 'org/private-repo', 'pull');
  }

  res.json({ received: true });
});

// Digital product delivery — GitHub repo invite
const inviteToRepo = async (username: string, repo: string, permission: string) => {
  const res = await fetch(`https://api.github.com/repos/${repo}/collaborators/${username}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({ permission }),
  });
  // 201 = invited, 204 = already collaborator — both are success
  return { success: res.status === 201 || res.status === 204, status: res.status };
};

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
