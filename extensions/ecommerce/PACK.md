---
name: "@rune/ecommerce"
description: E-commerce patterns — Shopify development, payment integration, subscription billing, shopping cart, inventory management, order lifecycle, and tax compliance.
metadata:
  author: runedev
  version: "0.3.0"
  layer: L4
  price: "$12"
  target: E-commerce developers
---

# @rune/ecommerce

## Purpose

E-commerce codebases fail at the seams between systems: payment intents that succeed but order records that don't get created, inventory counts that go negative during flash sales, subscription proration that charges the wrong amount mid-cycle, tax calculations that use cart-time rates instead of checkout-time rates, carts that lose items when users sign in, and webhook handlers that process the same event twice. This pack addresses the full order lifecycle — storefront to payment to fulfillment — with patterns that handle the race conditions, state machines, and distributed system problems that every commerce platform eventually hits.

## Triggers

- Auto-trigger: when `shopify.app.toml`, `*.liquid`, `cart`, `checkout`, `stripe` in payment context, `inventory` schema detected
- `/rune shopify-dev` — audit Shopify theme or app architecture
- `/rune payment-integration` — set up or audit payment flows
- `/rune subscription-billing` — set up or audit recurring billing
- `/rune cart-system` — build or audit cart architecture
- `/rune inventory-mgmt` — audit inventory tracking and stock management
- `/rune order-management` — audit order lifecycle and fulfillment
- `/rune tax-compliance` — set up or audit tax calculation
- Called by `cook` (L1) when e-commerce project detected
- Called by `launch` (L1) when preparing storefront for production

## Skills Summary

| Skill | Layer | Model | Purpose |
|-------|-------|-------|---------|
| shopify-dev | L4 | sonnet | Shopify theme, Hydrogen, app architecture |
| payment-integration | L4 | sonnet | Stripe, 3DS, webhooks, fraud detection |
| subscription-billing | L4 | sonnet | Trials, proration, dunning, plan changes |
| cart-system | L4 | sonnet | Persistent carts, merging, coupon engine |
| inventory-mgmt | L4 | sonnet | Atomic stock, reservations, alerts |
| order-management | L4 | sonnet | State machine, fulfillment, reconciliation |
| tax-compliance | L4 | sonnet | Tax APIs, VAT, audit trail |

## Common Workflows

| Workflow | Skills Involved | Description |
|----------|----------------|-------------|
| Full checkout | cart-system → tax-compliance → payment-integration → order-management | Complete purchase from cart to confirmation |
| Flash sale | inventory-mgmt → cart-system → payment-integration | High-concurrency stock control |
| Subscription signup | cart-system → payment-integration → subscription-billing | Free trial with payment method upfront |
| Plan upgrade | subscription-billing → payment-integration → tax-compliance | Mid-cycle upgrade with proration invoice |
| Order cancellation | order-management → inventory-mgmt → payment-integration | Cancel + release stock + issue refund |
| New market launch | tax-compliance → payment-integration (multi-currency) → shopify-dev | Localization, VAT, FX pricing |
| Fraud review | payment-integration (fraud patterns) → order-management | Risk scoring before order fulfilment |
| Product catalog | shopify-dev → inventory-mgmt | Variant structure + stock sync |

---

## Skills Included

### shopify-dev

Shopify development patterns — Liquid templates, Shopify API, Hydrogen/Remix storefronts, metafields, theme architecture, webhook HMAC verification.

#### Workflow

**Step 1 — Detect Shopify architecture**
Use Glob to find `shopify.app.toml`, `*.liquid`, `remix.config.*`, `hydrogen.config.*`. Use Grep to find Storefront API queries (`#graphql`), Admin API calls, metafield references, and API version strings. Classify: theme app extension, custom app, or Hydrogen storefront.

**Step 2 — Audit theme and API usage**
Check for:
- Liquid templates without `| escape` filter on user-generated metafield content (XSS vulnerability)
- Storefront API queries without pagination (`first: 250` max — cursor-based pagination required for larger sets)
- Hardcoded product IDs or variant IDs (break when products are recreated)
- Missing metafield type validation (metafield can be deleted/recreated with different type)
- Theme sections without `schema` blocks (limits merchant customization)
- Deprecated API version usage (Shopify deprecates versions on a rolling 12-month cycle)
- Webhook handlers without HMAC signature verification (anyone can POST fake events)

**Step 3 — Emit optimized patterns**
For Hydrogen: emit typed Storefront API loader with proper caching and pagination. For theme: emit section schema with metafield integration. For apps: emit webhook handler with HMAC verification and idempotency.

#### Example

```typescript
// Hydrogen — typed Storefront API loader with caching + pagination
import { json, type LoaderFunctionArgs } from '@shopify/remix-oxygen';

const PRODUCTS_QUERY = `#graphql
  query Products($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id handle title
        variants(first: 10) {
          nodes { id title price { amount currencyCode } availableForSale }
        }
        metafield(namespace: "custom", key: "care_instructions") { value type }
      }
    }
  }
` as const;

export async function loader({ context }: LoaderFunctionArgs) {
  const { products } = await context.storefront.query(PRODUCTS_QUERY, {
    variables: { first: 24 },
    cache: context.storefront.CacheLong(),
  });
  return json({ products });
}

// Webhook handler with HMAC verification (Express)
import crypto from 'crypto';

function verifyShopifyWebhook(req: Request, secret: string): boolean {
  const hmac = req.headers['x-shopify-hmac-sha256'] as string;
  const body = (req as any).rawBody; // Must capture raw body before JSON parse
  const hash = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmac));
}
```

---

### payment-integration

Payment integration — Stripe Payment Intents, 3D Secure, webhook handling, refunds, idempotency, PCI compliance, multi-currency, fraud detection.

#### Workflow

**Step 1 — Detect payment setup**
Use Grep to find `stripe`, `paypal`, `@stripe/stripe-js`, `@stripe/react-stripe-js`, payment-related endpoints. Read checkout handlers and webhook processors to understand: payment flow type (Payment Intents vs Checkout Sessions), webhook events handled, and error recovery.

**Step 2 — Audit payment security**
Check for:
- Missing idempotency keys on payment creation (double charges on retry)
- Webhook signature not verified (`stripe.webhooks.constructEvent` with `req.rawBody` — NOT parsed JSON body)
- Payment amount calculated client-side (price manipulation risk)
- No 3D Secure handling (`requires_action` status not handled in frontend)
- Secret keys in client bundle (check for `sk_live_` or `sk_test_` in frontend code)
- Missing failed payment recovery flow (no retry or dunning)
- Webhook processing not idempotent (same event processed twice creates duplicate orders)
- `req.body` used instead of `req.rawBody` for webhook signature verification (always fails)

**Step 3 — Emit robust payment flow**
Emit: server-side Payment Intent creation with idempotency, 3D Secure handling loop, comprehensive webhook handler with event deduplication, and refund flow with audit trail.

#### Example

```typescript
// Stripe Payment Intent — server-side, idempotent, 3DS-ready
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

app.post('/api/checkout', async (req, res) => {
  const { cartId, paymentMethodId } = req.body;
  const cart = await cartService.getVerified(cartId); // server-side price calculation

  // Idempotency key derived from CART, not timestamp — prevents double charge on retry
  const idempotencyKey = `checkout-${cartId}-v${cart.version}`;

  const intent = await stripe.paymentIntents.create({
    amount: cart.totalInCents, // ALWAYS server-calculated
    currency: cart.currency,
    payment_method: paymentMethodId,
    confirm: true,
    return_url: `${process.env.APP_URL}/checkout/complete`,
    metadata: { cartId, userId: req.user.id },
    idempotencyKey,
  });

  if (intent.status === 'requires_action') {
    return res.json({ requiresAction: true, clientSecret: intent.client_secret });
  }
  if (intent.status === 'succeeded') {
    await orderService.create(cart, intent.id);
    return res.json({ success: true, orderId: intent.metadata.orderId });
  }
  res.status(400).json({ error: 'PAYMENT_FAILED' });
});

// Webhook — MUST use raw body for signature, deduplicate events
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']!;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return res.status(400).send('Signature verification failed');
  }

  // Deduplicate: check if event already processed
  const existing = await db.webhookEvent.findUnique({ where: { stripeEventId: event.id } });
  if (existing) return res.json({ received: true, duplicate: true });

  // Process within transaction
  await db.$transaction(async (tx) => {
    await tx.webhookEvent.create({ data: { stripeEventId: event.id, type: event.type } });

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      await orderService.confirmPayment(tx, intent.metadata.cartId, intent.id);
    }
  });

  res.json({ received: true });
});
```

#### Multi-Currency & Localization

```typescript
// Locale-aware price formatting — ALWAYS use Intl, never manual toFixed()
function formatPrice(amountInCents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountInCents / 100);
}

// Examples
formatPrice(1999, 'USD', 'en-US');  // $19.99
formatPrice(1999, 'EUR', 'de-DE');  // 19,99 €
formatPrice(1999, 'JPY', 'ja-JP');  // ¥1,999  (JPY has no minor units)

// Currency conversion with FX rate cache
interface FxRate { from: string; to: string; rate: number; fetchedAt: Date }

class FxService {
  private cache = new Map<string, FxRate>();

  async convert(amountInCents: number, from: string, to: string): Promise<number> {
    if (from === to) return amountInCents;
    const key = `${from}:${to}`;
    let rate = this.cache.get(key);

    // Refresh if stale (>15 min)
    if (!rate || Date.now() - rate.fetchedAt.getTime() > 15 * 60 * 1000) {
      const fresh = await this.fetchRate(from, to);
      rate = { from, to, rate: fresh, fetchedAt: new Date() };
      this.cache.set(key, rate);
    }
    return Math.round(amountInCents * rate.rate);
  }

  private async fetchRate(from: string, to: string): Promise<number> {
    // Use a reliable FX API (e.g., Frankfurter, Open Exchange Rates)
    const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
    const data = await res.json();
    return data.rates[to];
  }
}

// Locale-aware pricing: show price in user's currency, charge in store's base currency
interface LocalizedPrice {
  displayAmount: string;   // "€18.45" — shown to user
  chargeAmount: number;    // 1999 cents USD — what actually gets charged
  currency: string;        // 'USD'
  displayCurrency: string; // 'EUR'
  exchangeRate: number;
}

async function getLocalizedPrice(
  amountInCents: number,
  storeCurrency: string,
  userLocale: string,
  userCurrency: string
): Promise<LocalizedPrice> {
  const fx = new FxService();
  const displayAmountInCents = await fx.convert(amountInCents, storeCurrency, userCurrency);
  return {
    displayAmount: formatPrice(displayAmountInCents, userCurrency, userLocale),
    chargeAmount: amountInCents,      // charge in store base currency
    currency: storeCurrency,
    displayCurrency: userCurrency,
    exchangeRate: displayAmountInCents / amountInCents,
  };
}
```

#### Fraud Detection

```typescript
// Risk scoring before order fulfilment
interface FraudSignals {
  ipAddress: string;
  userAgent: string;
  deviceFingerprint: string;
  email: string;
  billingCountry: string;
  shippingCountry: string;
  orderAmountCents: number;
  isFirstOrder: boolean;
}

interface RiskScore {
  score: number;       // 0–100, higher = riskier
  action: 'allow' | 'review' | 'block';
  reasons: string[];
}

async function scoreFraudRisk(signals: FraudSignals): Promise<RiskScore> {
  const reasons: string[] = [];
  let score = 0;

  // Velocity check — same IP, multiple orders in short window
  const recentOrdersFromIp = await db.order.count({
    where: { ipAddress: signals.ipAddress, createdAt: { gte: new Date(Date.now() - 3600_000) } },
  });
  if (recentOrdersFromIp >= 3) { score += 30; reasons.push('HIGH_VELOCITY_IP'); }

  // Card BIN country mismatch
  if (signals.billingCountry !== signals.shippingCountry) {
    score += 15; reasons.push('BILLING_SHIPPING_MISMATCH');
  }

  // High-value first order — common pattern for stolen cards
  if (signals.isFirstOrder && signals.orderAmountCents > 50000) {
    score += 25; reasons.push('HIGH_VALUE_FIRST_ORDER');
  }

  // Email domain is disposable (temp-mail.org, mailinator.com, etc.)
  const domain = signals.email.split('@')[1];
  const isDisposable = await disposableEmailService.check(domain);
  if (isDisposable) { score += 20; reasons.push('DISPOSABLE_EMAIL'); }

  // Device fingerprint seen with multiple different emails (account farm)
  const fingerprintEmails = await db.order.findMany({
    where: { deviceFingerprint: signals.deviceFingerprint },
    select: { email: true },
    distinct: ['email'],
  });
  if (fingerprintEmails.length > 5) { score += 25; reasons.push('FINGERPRINT_MULTI_ACCOUNT'); }

  const action = score >= 70 ? 'block' : score >= 40 ? 'review' : 'allow';
  return { score, action, reasons };
}

// Apply fraud check in checkout flow
app.post('/api/checkout/confirm', async (req, res) => {
  const { cartId } = req.body;
  const signals = extractFraudSignals(req);
  const risk = await scoreFraudRisk(signals);

  if (risk.action === 'block') {
    await db.fraudAttempt.create({ data: { ...signals, score: risk.score, reasons: risk.reasons } });
    return res.status(403).json({ error: 'ORDER_BLOCKED', code: 'FRAUD_RISK' });
  }
  if (risk.action === 'review') {
    // Proceed but flag for manual review after payment
    await db.order.create({ data: { cartId, fraudScore: risk.score, requiresReview: true } });
  }
  // ... normal checkout flow
});
```

---

### subscription-billing

Subscription billing — trial management, proration, dunning (failed payment retry), plan changes mid-cycle, usage-based billing, cancellation flows.

#### Workflow

**Step 1 — Detect subscription setup**
Use Grep to find: `stripe.subscriptions`, `subscription`, `recurring`, `billing_cycle`, `trial`, `prorate`, `dunning`. Check for Stripe Billing Portal, customer portal redirect, and subscription lifecycle webhook handlers.

**Step 2 — Audit subscription lifecycle**
Check for:
- Trial-to-paid transition: is payment method collected during trial signup? (If not, 60%+ of trials churn at conversion — Stripe data)
- Proration on plan change: `proration_behavior` defaults to `create_prorations` — mid-cycle upgrade charges immediately. Must explicitly choose behavior and communicate to user
- Failed payment handling: Stripe retries automatically per Smart Retries settings, but app must handle `invoice.payment_failed` webhook to notify user, restrict access, or trigger custom retry
- Cancellation: `cancel_at_period_end` vs immediate cancel — immediate loses remaining period revenue. Most SaaS should use `cancel_at_period_end` and show countdown
- Missing webhook handlers for: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.paid`
- Usage-based billing: meter events must be sent before invoice finalization (not after) — late events are lost

**Step 3 — Emit subscription patterns**
Emit: subscription creation with trial + payment method upfront, plan change with explicit proration, dunning webhook handler, and cancellation flow.

#### Example

```typescript
// Create subscription with trial — collect payment method upfront
async function createSubscription(customerId: string, priceId: string, trialDays: number) {
  // Verify customer has payment method BEFORE creating subscription
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId, type: 'card',
  });
  if (paymentMethods.data.length === 0) {
    throw new Error('Payment method required before starting trial');
  }

  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    trial_period_days: trialDays,
    payment_settings: {
      payment_method_types: ['card'],
      save_default_payment_method: 'on_subscription',
    },
    trial_settings: {
      end_behavior: { missing_payment_method: 'cancel' }, // Auto-cancel if no card at trial end
    },
    expand: ['latest_invoice.payment_intent'],
  });
}

// Plan change with explicit proration
async function changePlan(subscriptionId: string, newPriceId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return stripe.subscriptions.update(subscriptionId, {
    items: [{ id: subscription.items.data[0].id, price: newPriceId }],
    proration_behavior: 'always_invoice', // Charge/credit immediately
    payment_behavior: 'error_if_incomplete', // Fail if upgrade payment fails
  });
}

// Dunning webhook — restrict access after payment failure
app.post('/webhooks/subscription', async (req, res) => {
  const event = verifyStripeEvent(req);

  switch (event.type) {
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const attempt = invoice.attempt_count;
      if (attempt >= 3) {
        // After 3 failed retries, restrict access (don't cancel yet)
        await userService.setStatus(invoice.customer as string, 'past_due');
        await emailService.send(invoice.customer_email!, 'payment-failed-final');
      } else {
        await emailService.send(invoice.customer_email!, 'payment-failed-retry', { attempt });
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await userService.deactivate(sub.customer as string);
      break;
    }
  }
  res.json({ received: true });
});
```

---

### cart-system

Shopping cart architecture — state management, persistent carts, guest checkout, coupon/discount engine, guest-to-auth cart merge.

#### Workflow

**Step 1 — Detect cart architecture**
Use Grep to find cart state: `cartStore`, `useCart`, `addToCart`, `localStorage.*cart`, `session.*cart`. Read cart-related components and API routes to understand: client vs server cart, persistence strategy, and discount handling.

**Step 2 — Audit cart integrity**
Check for:
- Cart total calculated client-side only (price manipulation — attacker changes localStorage price)
- No cart TTL (stale carts hold inventory reservations indefinitely)
- Missing guest-to-authenticated cart merge (items lost on login)
- Race conditions on concurrent cart updates (two tabs adding items, last write wins)
- Coupons validated client-side (attacker applies any discount code)
- No stock check at add-to-cart time (user adds 100 items, stock is 3)
- Cart stored in localStorage only (lost on device switch, no cross-device)

**Step 3 — Emit cart patterns**
Emit: server-authoritative cart with client cache, guest-to-auth merge flow, coupon validation middleware, and optimistic UI with server reconciliation.

#### Example

```typescript
// Server-authoritative cart with Zustand client cache
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartStore {
  items: CartItem[];
  cartId: string | null;
  addItem: (productId: string, variantId: string, qty: number) => Promise<void>;
  mergeGuestCart: (userId: string) => Promise<void>;
}

const useCart = create<CartStore>()(persist((set, get) => ({
  items: [], cartId: null,

  addItem: async (productId, variantId, qty) => {
    // Optimistic update (show item immediately)
    set(state => ({ items: [...state.items, { productId, variantId, qty, pending: true }] }));
    // Server reconciliation (validates stock, calculates price, applies discounts)
    const cart = await fetch('/api/cart/add', {
      method: 'POST',
      body: JSON.stringify({ cartId: get().cartId, productId, variantId, qty }),
    }).then(r => r.json());
    set({ items: cart.items, cartId: cart.id }); // server is source of truth
  },

  mergeGuestCart: async (userId) => {
    const { cartId } = get();
    if (!cartId) return;
    const merged = await fetch('/api/cart/merge', {
      method: 'POST', body: JSON.stringify({ guestCartId: cartId, userId }),
    }).then(r => r.json());
    set({ items: merged.items, cartId: merged.id });
  },
}), { name: 'cart-storage' }));

// Server — coupon validation (NEVER trust client)
app.post('/api/cart/apply-coupon', async (req, res) => {
  const { cartId, code } = req.body;
  const coupon = await couponService.validate(code); // checks: exists, not expired, usage limit
  if (!coupon) return res.status(400).json({ error: 'INVALID_COUPON' });

  const cart = await cartService.applyCoupon(cartId, coupon);
  // Recalculate totals server-side after discount
  res.json({ cart: cartService.calculateTotals(cart) });
});
```

---

### inventory-mgmt

Inventory management — stock tracking with optimistic locking, variant management, low stock alerts, backorder handling, reservation expiry.

#### Workflow

**Step 1 — Detect inventory model**
Use Grep to find stock-related code: `stock`, `inventory`, `quantity`, `variant`, `warehouse`, `sku`. Read schema files to understand: single vs multi-warehouse, variant structure, and reservation model.

**Step 2 — Audit stock integrity**
Check for:
- Stock decremented without transaction (oversell risk under concurrent load)
- No optimistic locking on concurrent updates (version field or `FOR UPDATE` lock)
- Inventory checked at cart-add but not at checkout (stale check — stock sold out between add and pay)
- Missing low-stock alerts (ops team discovers stockout from customer complaints)
- No reservation expiry for abandoned checkouts (stock locked forever)
- No backorder handling for out-of-stock items (zero stock = hard error vs queue)
- Flash sale race condition: 10 users checkout simultaneously with 3 items left = 7 oversold orders

**Step 3 — Emit inventory patterns**
Emit: atomic stock reservation with optimistic locking (version field), reservation expiry job for abandoned checkouts, low-stock alert trigger, and backorder queue.

#### Example

```typescript
// Atomic stock reservation with optimistic locking (Prisma)
async function reserveStock(variantId: string, qty: number, orderId: string) {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const variant = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } });

    if (variant.stock < qty && !variant.allowBackorder) {
      throw new Error(`Insufficient stock: ${variant.stock} available, ${qty} requested`);
    }

    try {
      const updated = await prisma.variant.update({
        where: { id: variantId, version: variant.version }, // optimistic lock
        data: {
          stock: { decrement: qty },
          version: { increment: 1 },
          reservations: { create: { orderId, qty, expiresAt: addMinutes(new Date(), 15) } },
        },
      });

      if (updated.stock <= updated.lowStockThreshold) {
        await alertService.trigger('LOW_STOCK', { variantId, currentStock: updated.stock });
      }
      return updated;
    } catch (e) {
      if (attempt === MAX_RETRIES - 1) throw new Error('Stock reservation failed: concurrent modification');
    }
  }
}

// Reservation expiry job — release stock from abandoned checkouts
async function releaseExpiredReservations() {
  const expired = await prisma.reservation.findMany({
    where: { expiresAt: { lt: new Date() }, status: 'PENDING' },
  });

  for (const reservation of expired) {
    await prisma.$transaction([
      prisma.variant.update({
        where: { id: reservation.variantId },
        data: { stock: { increment: reservation.qty } },
      }),
      prisma.reservation.update({
        where: { id: reservation.id },
        data: { status: 'EXPIRED' },
      }),
    ]);
  }
}

// Inventory webhook — push stock changes to external systems (3PL, ERP)
async function emitInventoryWebhook(variantId: string, newStock: number, event: string) {
  const variant = await prisma.variant.findUniqueOrThrow({
    where: { id: variantId },
    include: { product: true },
  });
  const payload = {
    event,                          // 'STOCK_UPDATED' | 'LOW_STOCK' | 'OUT_OF_STOCK'
    sku: variant.sku,
    variantId,
    productId: variant.productId,
    stock: newStock,
    threshold: variant.lowStockThreshold,
    timestamp: new Date().toISOString(),
  };
  // Fan-out to all registered webhook endpoints
  await webhookFanOut(payload, 'inventory.*');
}
```

---

### order-management

Order lifecycle — state machine, fulfillment workflows, refund/return flows, email notifications, reconciliation, webhook fan-out.

#### Workflow

**Step 1 — Detect order model**
Use Grep to find: `order`, `fulfillment`, `shipment`, `refund`, `return`, `order_status`, `OrderStatus`. Read schema to understand: order states, fulfillment model (self-ship, 3PL, dropship), and refund handling.

**Step 2 — Audit order lifecycle**
Check for:
- No explicit state machine: order status updated with raw string assignment (typos, invalid transitions)
- Missing reconciliation: payment succeeded but order creation failed (payment taken, no order)
- Partial fulfillment not handled: multi-item order with one item backordered
- Refund without inventory return: money refunded but stock not incremented back
- No email notifications on state transitions (customer has no visibility)
- Cancellation after partial fulfillment: must refund only unfulfilled items

**Step 3 — Emit order patterns**
Emit: typed state machine with valid transitions, reconciliation job, partial fulfillment handler, and refund flow with inventory return.

#### Example

```typescript
// Order state machine with valid transitions
type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'partially_shipped' |
                   'shipped' | 'delivered' | 'cancelled' | 'refunded';

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['partially_shipped', 'shipped', 'cancelled'],
  partially_shipped: ['shipped', 'cancelled'],
  shipped: ['delivered', 'refunded'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

async function transitionOrder(orderId: string, newStatus: OrderStatus) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const currentStatus = order.status as OrderStatus;

  if (!VALID_TRANSITIONS[currentStatus]?.includes(newStatus)) {
    throw new Error(`Invalid transition: ${currentStatus} → ${newStatus}`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.order.update({
      where: { id: orderId },
      data: {
        status: newStatus,
        statusHistory: { push: { from: currentStatus, to: newStatus, at: new Date() } },
      },
    });

    // Side effects per transition
    if (newStatus === 'cancelled') {
      await releaseOrderReservations(tx, orderId);
    }
    if (newStatus === 'refunded') {
      await processRefund(tx, orderId);
      await returnInventory(tx, orderId);
    }

    return result;
  });

  // Notifications (outside transaction — don't block on email)
  await notificationService.orderStatusChanged(updated);
  return updated;
}

// Reconciliation job — find payments without orders
async function reconcilePayments() {
  const recentIntents = await stripe.paymentIntents.list({
    created: { gte: Math.floor(Date.now() / 1000) - 3600 }, // last hour
    limit: 100,
  });

  for (const intent of recentIntents.data) {
    if (intent.status !== 'succeeded') continue;
    const cartId = intent.metadata.cartId;
    const order = await prisma.order.findFirst({ where: { paymentIntentId: intent.id } });

    if (!order) {
      // Payment succeeded but order not created — create it now
      await orderService.createFromIntent(intent);
      await alertService.trigger('RECONCILED_ORDER', { intentId: intent.id, cartId });
    }
  }
}

// Webhook fan-out for order status changes — notify 3PLs, ERPs, analytics
async function webhookFanOut(payload: Record<string, unknown>, topic: string) {
  const endpoints = await db.webhookEndpoint.findMany({
    where: { topics: { has: topic }, active: true },
  });
  await Promise.allSettled(
    endpoints.map(ep =>
      fetch(ep.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Rune-Signature': signPayload(payload, ep.secret),
          'X-Rune-Topic': topic,
          'X-Rune-Timestamp': String(Date.now()),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      }).catch(err => {
        // Log failure but don't throw — one bad endpoint shouldn't block others
        console.error(`Webhook delivery failed for ${ep.url}:`, err.message);
      })
    )
  );
}
```

---

### tax-compliance

Tax calculation — sales tax API integration, VAT for EU, digital goods tax, tax-inclusive pricing, audit trail.

#### Workflow

**Step 1 — Detect tax setup**
Use Grep to find: `tax`, `vat`, `taxjar`, `avalara`, `tax_rate`, `taxAmount`, `tax_exempt`. Check if tax calculation exists and where it happens (cart time vs checkout time).

**Step 2 — Audit tax accuracy**
Check for:
- Tax calculated at cart time but not recalculated at checkout (rate may have changed, or user changed shipping address)
- Hardcoded tax rates instead of API-based calculation (rates change; nexus rules are complex)
- Missing tax on digital goods (many US states and all EU countries tax digital products)
- EU VAT: must charge buyer's country VAT rate for B2C digital sales (not seller's country)
- Tax-inclusive vs tax-exclusive display: must be consistent and clearly labeled
- No tax audit trail: amounts, rates, and jurisdiction must be stored per order for compliance
- Missing tax exemption handling (B2B customers with valid VAT number or tax-exempt certificate)

**Step 3 — Emit tax patterns**
Emit: tax calculation at checkout time (not cart time), API-based rate lookup, EU VAT reverse charge for B2B, and tax audit trail per order line item.

#### Example

```typescript
// Tax calculation at CHECKOUT time (not cart time) — rates may change
interface TaxLineItem {
  productId: string;
  amount: number;
  quantity: number;
  taxCode: string; // Product tax code (e.g., 'txcd_10000000' for general goods)
}

async function calculateTax(
  items: TaxLineItem[],
  shippingAddress: Address,
  customerTaxExempt: boolean
): Promise<TaxResult> {
  if (customerTaxExempt) {
    return { totalTax: 0, lineItems: items.map(i => ({ ...i, tax: 0, rate: 0 })) };
  }

  // Use tax API — never hardcode rates
  const calculation = await stripe.tax.calculations.create({
    currency: 'usd',
    line_items: items.map(item => ({
      amount: item.amount * item.quantity,
      reference: item.productId,
      tax_code: item.taxCode,
    })),
    customer_details: {
      address: {
        line1: shippingAddress.line1,
        city: shippingAddress.city,
        state: shippingAddress.state,
        postal_code: shippingAddress.postalCode,
        country: shippingAddress.country,
      },
      address_source: 'shipping',
    },
  });

  return {
    totalTax: calculation.tax_amount_exclusive,
    lineItems: calculation.line_items.data.map(li => ({
      productId: li.reference,
      tax: li.amount_tax,
      rate: li.tax_breakdown?.[0]?.rate ?? 0,
      jurisdiction: li.tax_breakdown?.[0]?.jurisdiction?.display_name ?? 'Unknown',
    })),
  };
}

// EU VAT validation — B2B reverse charge
async function validateEuVat(vatNumber: string, buyerCountry: string): Promise<boolean> {
  // Use VIES (VAT Information Exchange System) API
  const res = await fetch(
    `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${buyerCountry}/vat/${vatNumber.replace(/^[A-Z]{2}/, '')}`
  );
  const data = await res.json();
  return data.isValid === true;
}

// Store tax audit trail per order (required for compliance)
interface OrderTaxRecord {
  orderId: string;
  lineItemId: string;
  taxAmount: number;
  taxRate: number;
  jurisdiction: string;
  calculatedAt: Date;
  taxApiTransactionId: string;
}

// Commit tax record immediately at payment creation — never calculate retroactively
async function commitTaxRecord(orderId: string, calculation: TaxResult, txnId: string) {
  await prisma.orderTaxRecord.createMany({
    data: calculation.lineItems.map(li => ({
      orderId,
      lineItemId: li.productId,
      taxAmount: li.tax,
      taxRate: li.rate,
      jurisdiction: li.jurisdiction,
      calculatedAt: new Date(),
      taxApiTransactionId: txnId,
    })),
  });
}
```

---

## Checkout Optimization Checklist

### Cart Abandonment Recovery
- [ ] Track `checkout.started` event when user enters checkout
- [ ] Set a 1-hour timer — send recovery email if no `order.confirmed` fires
- [ ] Recovery email includes direct link back to populated cart (use server-side cart ID, not localStorage)
- [ ] Show the exact items abandoned with updated stock status ("Only 2 left!")
- [ ] A/B test subject lines: discount vs urgency vs social proof
- [ ] SMS recovery for mobile checkouts (higher open rate than email for mobile users)

### One-Click Checkout
```typescript
// Save payment method + address after first successful order
async function saveCheckoutProfile(userId: string, orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { shippingAddress: true, paymentIntent: true },
  });
  const paymentIntent = await stripe.paymentIntents.retrieve(order.paymentIntentId);
  await prisma.checkoutProfile.upsert({
    where: { userId },
    create: {
      userId,
      stripePaymentMethodId: paymentIntent.payment_method as string,
      shippingAddressId: order.shippingAddressId,
    },
    update: {
      stripePaymentMethodId: paymentIntent.payment_method as string,
      shippingAddressId: order.shippingAddressId,
    },
  });
}

// One-click checkout endpoint — reuse saved profile
app.post('/api/checkout/one-click', requireAuth, async (req, res) => {
  const { cartId } = req.body;
  const profile = await prisma.checkoutProfile.findUnique({ where: { userId: req.user.id } });
  if (!profile) return res.status(400).json({ error: 'NO_SAVED_PROFILE' });

  const cart = await cartService.getVerified(cartId);
  const tax = await calculateTax(cart.items, profile.shippingAddress, false);

  const intent = await stripe.paymentIntents.create({
    amount: cart.totalInCents + tax.totalTax,
    currency: 'usd',
    customer: req.user.stripeCustomerId,
    payment_method: profile.stripePaymentMethodId,
    confirm: true,
    off_session: true,  // No 3DS prompt for returning customers
    idempotencyKey: `one-click-${cartId}-v${cart.version}`,
  });
  if (intent.status === 'succeeded') {
    const order = await orderService.create(cart, intent.id, profile.shippingAddressId);
    return res.json({ orderId: order.id });
  }
  res.status(400).json({ error: 'PAYMENT_FAILED', requiresAction: intent.status === 'requires_action' });
});
```

### Guest Checkout
- Never force account creation before purchase — every forced registration step loses ~20% of users
- Collect email first (for cart recovery), then shipping, then payment
- After order confirm, offer account creation with password only — pre-fill email from order
- Store guest cart server-side with TTL; link by `guestToken` cookie (not just localStorage)
- On account creation post-checkout, transfer order history to new account

### A/B Testing Checkout
```typescript
// Deterministic variant assignment — same user always sees same variant
function getCheckoutVariant(userId: string | null, experimentId: string): 'control' | 'treatment' {
  const seed = userId ?? crypto.randomUUID(); // guests get random assignment
  const hash = crypto.createHash('md5').update(`${experimentId}:${seed}`).digest('hex');
  const bucket = parseInt(hash.substring(0, 8), 16) % 100;
  return bucket < 50 ? 'control' : 'treatment';
}

// Track conversion per variant
async function trackCheckoutEvent(event: string, userId: string | null, experimentId: string) {
  const variant = getCheckoutVariant(userId, experimentId);
  await analytics.track({ event, properties: { experimentId, variant, userId } });
}
```

---

## Product Search & Filtering

### Faceted Search with Meilisearch

```typescript
import { MeiliSearch } from 'meilisearch';

const client = new MeiliSearch({ host: process.env.MEILI_HOST!, apiKey: process.env.MEILI_KEY! });
const index = client.index('products');

// Configure filterable and sortable attributes on index setup
async function configureSearchIndex() {
  await index.updateSettings({
    filterableAttributes: ['category', 'brand', 'inStock', 'priceRange', 'tags', 'rating'],
    sortableAttributes: ['price', 'createdAt', 'rating', 'salesCount'],
    searchableAttributes: ['name', 'description', 'brand', 'tags', 'sku'],
    rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
  });
}

// Faceted search query — build filter string from user selections
interface SearchFilters {
  category?: string[];
  brand?: string[];
  priceMin?: number;
  priceMax?: number;
  inStock?: boolean;
  rating?: number;
}

async function searchProducts(query: string, filters: SearchFilters, page = 0, hitsPerPage = 24) {
  const filterParts: string[] = [];

  if (filters.category?.length) {
    filterParts.push(`category IN [${filters.category.map(c => `"${c}"`).join(', ')}]`);
  }
  if (filters.brand?.length) {
    filterParts.push(`brand IN [${filters.brand.map(b => `"${b}"`).join(', ')}]`);
  }
  if (filters.priceMin !== undefined) filterParts.push(`price >= ${filters.priceMin}`);
  if (filters.priceMax !== undefined) filterParts.push(`price <= ${filters.priceMax}`);
  if (filters.inStock) filterParts.push('inStock = true');
  if (filters.rating) filterParts.push(`rating >= ${filters.rating}`);

  return index.search(query, {
    filter: filterParts.join(' AND '),
    facets: ['category', 'brand', 'rating'],   // return facet counts for sidebar
    page,
    hitsPerPage,
    attributesToHighlight: ['name', 'description'],
    highlightPreTag: '<mark>',
    highlightPostTag: '</mark>',
  });
}

// Sync products to Meilisearch on save
async function syncProductToSearch(product: Product) {
  await index.addDocuments([{
    id: product.id,
    name: product.name,
    description: product.description,
    brand: product.brand,
    category: product.categoryPath, // ['Electronics', 'Phones', 'Smartphones']
    price: product.priceInCents / 100,
    priceRange: getPriceRange(product.priceInCents), // 'under-25' | '25-50' | '50-100' | 'over-100'
    inStock: product.stock > 0,
    rating: product.averageRating,
    salesCount: product.salesCount,
    tags: product.tags,
    sku: product.sku,
  }]);
}
```

### Algolia Integration Pattern

```typescript
import algoliasearch from 'algoliasearch';

const algolia = algoliasearch(process.env.ALGOLIA_APP_ID!, process.env.ALGOLIA_ADMIN_KEY!);
const productsIndex = algolia.initIndex('products');

// Instant search — debounce to avoid burning quota on every keystroke
import { useDeferredValue, useEffect, useState } from 'react';

function useProductSearch(query: string, filters: SearchFilters) {
  const deferredQuery = useDeferredValue(query); // built-in React debounce
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (!deferredQuery) { setResults([]); return; }
    productsIndex.search(deferredQuery, { filters: buildAlgoliaFilter(filters) })
      .then(res => setResults(res.hits as SearchResult[]));
  }, [deferredQuery, filters]);

  return results;
}
```

---

## Cross-Pack Connections

### @rune/analytics
- Track checkout funnel steps (cart → address → payment → confirm) for drop-off analysis
- Product view, add-to-cart, and purchase events feed cohort analysis
- Revenue reporting requires order line items with SKU, category, and margin data
- Subscription MRR/ARR dashboards fed from `invoice.paid` webhook events

### @rune/security
- `sentinel` audits payment endpoint for: amount manipulation, replay attacks, IDOR on cart/order IDs
- Webhook endpoint validation: ensure HMAC verification is present on ALL incoming webhooks
- Fraud detection logging must be append-only (no deletes) for audit compliance
- PCI DSS scope: never log raw card numbers or CVV; only log masked PAN and last4

### @rune/ui
- Cart drawer: optimistic updates via Zustand + skeleton loaders on async ops
- Checkout form: `react-hook-form` + Zod validation; inline errors per field
- Payment element: use Stripe's hosted `<PaymentElement>` — never build custom card inputs (PCI scope)
- Price display: always `Intl.NumberFormat`, monospace font for financial numbers
- Stock badge: green "In stock" / amber "Only N left" / red "Out of stock" — never color alone

### @rune/backend
- Order service uses repository pattern — `OrderRepository` with `findById`, `create`, `updateStatus`
- Queue jobs for: reservation expiry, reconciliation, webhook fan-out (never run in request thread)
- Rate limiting on `/api/cart/*` (10 req/s per user) and `/api/checkout/*` (3 req/s per user)
- Database: `orders`, `inventory`, `carts` tables need row-level locking strategy documented

### @rune/saas
- If product is a SaaS subscription, `subscription-billing` skill handles recurring billing
- Seat-based billing: `quantity` on Stripe subscription item = seat count
- Usage-based metering: send meter events to Stripe before invoice finalization window closes
- Customer portal: Stripe Billing Portal handles plan changes, payment method update, cancellation

---

## Webhook Patterns

### Centralized Webhook Router

```typescript
// Single endpoint, topic-based routing — more maintainable than one endpoint per provider
type WebhookTopic =
  | 'payment.succeeded' | 'payment.failed' | 'payment.refunded'
  | 'subscription.created' | 'subscription.updated' | 'subscription.cancelled'
  | 'order.confirmed' | 'order.shipped' | 'order.delivered'
  | 'inventory.low_stock' | 'inventory.out_of_stock';

interface WebhookHandler {
  verify: (req: Request) => boolean;
  normalize: (body: unknown) => { topic: WebhookTopic; payload: Record<string, unknown> };
}

const handlers: Record<string, WebhookHandler> = {
  stripe: {
    verify: (req) => verifyStripeSignature(req),
    normalize: (body) => normalizeStripeEvent(body as Stripe.Event),
  },
  shopify: {
    verify: (req) => verifyShopifyHmac(req),
    normalize: (body) => normalizeShopifyWebhook(body),
  },
};

app.post('/api/webhooks/:provider', express.raw({ type: '*/*' }), async (req, res) => {
  const handler = handlers[req.params.provider];
  if (!handler) return res.status(404).send('Unknown provider');
  if (!handler.verify(req)) return res.status(401).send('Signature invalid');

  const { topic, payload } = handler.normalize(JSON.parse(req.body.toString()));

  // Idempotency check
  const eventId = req.headers['x-event-id'] as string ?? generateEventId(req);
  const seen = await db.webhookEvent.findUnique({ where: { eventId } });
  if (seen) return res.json({ received: true, duplicate: true });

  await db.$transaction(async (tx) => {
    await tx.webhookEvent.create({ data: { eventId, topic, provider: req.params.provider } });
    await routeWebhookEvent(tx, topic, payload);
  });

  res.json({ received: true });
});

async function routeWebhookEvent(
  tx: Prisma.TransactionClient,
  topic: WebhookTopic,
  payload: Record<string, unknown>
) {
  switch (topic) {
    case 'payment.succeeded':
      return orderService.confirmFromPayment(tx, payload);
    case 'subscription.cancelled':
      return subscriptionService.deactivate(tx, payload.customerId as string);
    case 'inventory.low_stock':
      return alertService.notifyOps(payload);
    // ... more cases
  }
}
```

---

## Connections

```
Calls → sentinel (L2): PCI compliance audit on payment code, webhook security
Calls → db (L2): schema design for orders, inventory, carts, subscriptions
Calls → perf (L2): audit checkout page load, cart update latency
Calls → verification (L3): run payment flow integration tests
Called By ← cook (L1): when e-commerce project detected
Called By ← launch (L1): pre-launch checkout verification
Called By ← review (L2): when payment or cart code under review
Called By ← ba (L2): requirements elicitation for e-commerce features
```

## Tech Stack Support

| Platform | Framework | Payment | Notes |
|----------|-----------|---------|-------|
| Shopify | Hydrogen 2.x (Remix) | Shopify Payments | Storefront + Admin API |
| Custom | Next.js 16 / SvelteKit | Stripe | Most flexible |
| Headless | Any frontend | Stripe / PayPal | API-first commerce |
| Medusa.js | Next.js | Stripe / PayPal | Open-source alternative |
| Saleor | React / Next.js | Stripe / Braintree | GraphQL-first |

## Constraints

1. MUST calculate all prices server-side — never trust client-submitted amounts for payment.
2. MUST use idempotency keys on all payment creation API calls — derive from cart ID + version, not timestamp.
3. MUST use optimistic locking or database transactions for inventory updates — prevent overselling.
4. MUST verify webhook signatures using raw body (not parsed JSON) before processing any payment events.
5. MUST validate coupons and discounts server-side — client-side validation is bypassable.
6. MUST deduplicate webhook events — same event can be delivered multiple times by Stripe.
7. MUST recalculate tax at checkout time, not at cart-add time — rates and addresses change.
8. MUST store tax audit trail per order line item (amount, rate, jurisdiction, timestamp).

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Double charge from retried Payment Intent without idempotency key | CRITICAL | Derive idempotencyKey from `cartId-v${version}`, not timestamp; check for existing succeeded intent |
| Webhook signature fails because `req.body` is parsed JSON instead of raw bytes | CRITICAL | Use `express.raw({ type: 'application/json' })` for webhook route; verify with `req.body` as Buffer |
| Overselling during flash sale (stock goes negative) | CRITICAL | Use optimistic locking with version field; serializable isolation for high-contention items |
| Payment succeeded but order creation fails (money taken, no order record) | HIGH | Wrap in transaction; run reconciliation job matching payment intents to orders every hour |
| Same webhook processed twice creates duplicate orders | HIGH | Store `event.id` in database; check before processing; wrap in transaction |
| Guest cart items lost on login (separate cart created for auth user) | HIGH | Implement cart merge in auth callback; prefer server cart state over local |
| Subscription proration charges wrong amount on mid-cycle plan change | HIGH | Explicitly set `proration_behavior`; preview proration with `stripe.invoices.retrieveUpcoming` |
| Trial-to-paid conversion fails silently (no payment method on file) | HIGH | Require payment method at trial signup; set `missing_payment_method: 'cancel'` in trial settings |
| Tax calculated at cart time but rate changed by checkout (wrong amount charged) | MEDIUM | Recalculate tax at payment creation time using shipping address, not cart-add time |
| Liquid template outputs unescaped metafield content (XSS in Shopify theme) | HIGH | Always use `| escape` filter on user-generated metafield values |
| Cancelled order stock not returned to inventory | MEDIUM | Use order state machine with side effects — cancellation always triggers `releaseOrderReservations` |
| Reservation never expires for abandoned checkout (stock locked forever) | MEDIUM | Run reservation expiry job every 5 minutes; default reservation TTL = 15 minutes |
| Stolen card fraud passes payment but triggers chargeback later | HIGH | Apply fraud scoring before confirmation; hold high-risk orders for manual review |
| FX rate stale on multi-currency display — user sees wrong price | MEDIUM | Cache FX rates max 15 minutes; show rate timestamp to user; always charge in store base currency |

## Done When

- Checkout flow completes end-to-end: cart → tax → payment → order confirmation
- Subscription lifecycle handles trial → active → past_due → cancelled with proper dunning
- Inventory accurately tracks stock with no overselling under concurrent load
- Order state machine enforces valid transitions with side effects (stock release, refunds, notifications)
- Webhooks are idempotent, signature-verified, and handle all payment/subscription lifecycle events
- Tax calculated at checkout with audit trail stored per order line item
- Guest-to-authenticated cart merge works without data loss
- All prices, discounts, and coupons validated server-side
- Reconciliation job catches payment/order mismatches
- Fraud scoring applied to all orders; high-risk orders flagged for review
- Multi-currency display works with cached FX rates; charges always in base currency
- Product search configured with faceted filtering and relevance ranking
- Structured report emitted for each skill invoked

## Cost Profile

~14,000–26,000 tokens per full pack run (all 7 skills). Individual skill: ~2,000–4,000 tokens. Sonnet default. Use haiku for detection scans; escalate to sonnet for payment flow, subscription lifecycle, and order state machine generation.
