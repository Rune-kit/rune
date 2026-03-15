---
name: "@rune/ecommerce"
description: E-commerce patterns — Shopify development, payment integration, shopping cart, and inventory management.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L4
  price: "$12"
  target: E-commerce developers
---

# @rune/ecommerce

## Purpose

E-commerce codebases fail at the seams between systems: payment intents that succeed but order records that don't get created, inventory counts that go negative during flash sales, carts that lose items when users sign in, and Shopify themes that break on metafield updates. This pack addresses the full order lifecycle — storefront to payment to fulfillment — with patterns that handle the race conditions, state machines, and distributed system problems that every commerce platform eventually hits.

## Triggers

- Auto-trigger: when `shopify.app.toml`, `*.liquid`, `cart`, `checkout`, `stripe` in payment context, `inventory` schema detected
- `/rune shopify-dev` — audit Shopify theme or app architecture
- `/rune payment-integration` — set up or audit payment flows
- `/rune cart-system` — build or audit cart architecture
- `/rune inventory-mgmt` — audit inventory tracking and stock management
- Called by `cook` (L1) when e-commerce project detected
- Called by `launch` (L1) when preparing storefront for production

## Skills Included

### shopify-dev

Shopify development patterns — Liquid templates, Shopify API, Hydrogen/Remix storefronts, metafields, theme architecture.

#### Workflow

**Step 1 — Detect Shopify architecture**
Use Glob to find `shopify.app.toml`, `*.liquid`, `remix.config.*`, `hydrogen.config.*`. Use Grep to find Storefront API queries (`#graphql`), Admin API calls, and metafield references. Classify: theme app extension, custom app, or Hydrogen storefront.

**Step 2 — Audit theme and API usage**
Check for: Liquid templates without `| escape` filter (XSS), Storefront API queries without pagination, hardcoded product IDs, missing metafield type validation, theme sections without `schema` blocks, and deprecated API version usage.

**Step 3 — Emit optimized patterns**
For Hydrogen: emit typed Storefront API loader with proper caching. For theme: emit section schema with metafield integration. For apps: emit webhook handler with HMAC verification.

#### Example

```typescript
// Hydrogen — typed Storefront API loader with caching
import { json, type LoaderFunctionArgs } from '@shopify/remix-oxygen';

const PRODUCT_QUERY = `#graphql
  query Product($handle: String!) {
    product(handle: $handle) {
      id title description
      variants(first: 10) {
        nodes { id title price { amount currencyCode } availableForSale }
      }
      metafield(namespace: "custom", key: "care_instructions") { value type }
    }
  }
` as const;

export async function loader({ params, context }: LoaderFunctionArgs) {
  const { product } = await context.storefront.query(PRODUCT_QUERY, {
    variables: { handle: params.handle! },
    cache: context.storefront.CacheLong(),
  });
  if (!product) throw new Response('Not Found', { status: 404 });
  return json({ product });
}
```

---

### payment-integration

Payment integration — Stripe Payment Intents, 3D Secure, webhook handling, refunds, PCI compliance.

#### Workflow

**Step 1 — Detect payment setup**
Use Grep to find `stripe`, `paypal`, `@stripe/stripe-js`, payment-related endpoints. Read checkout handlers and webhook processors to understand: payment flow type, webhook events handled, and error recovery.

**Step 2 — Audit payment security**
Check for: missing idempotency keys on payment creation, webhook signature not verified, payment amount calculated client-side (manipulation risk), no 3D Secure handling, secret keys in client bundle, and missing failed payment recovery flow.

**Step 3 — Emit robust payment flow**
Emit: server-side Payment Intent creation with idempotency, 3D Secure handling, comprehensive webhook handler, and refund flow with audit trail.

#### Example

```typescript
// Stripe Payment Intent — server-side, idempotent, 3DS-ready
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

app.post('/api/checkout', async (req, res) => {
  const { cartId, paymentMethodId } = req.body;
  const cart = await cartService.getVerified(cartId); // server-side price calculation

  const intent = await stripe.paymentIntents.create({
    amount: cart.totalInCents, // ALWAYS server-calculated
    currency: cart.currency,
    payment_method: paymentMethodId,
    confirm: true,
    return_url: `${process.env.APP_URL}/checkout/complete`,
    metadata: { cartId, userId: req.user.id },
    idempotencyKey: `checkout-${cartId}-${Date.now()}`,
  });

  if (intent.status === 'requires_action') {
    return res.json({ requiresAction: true, clientSecret: intent.client_secret });
  }
  if (intent.status === 'succeeded') {
    await orderService.create(cart, intent.id);
    return res.json({ success: true, orderId: intent.metadata.orderId });
  }
  res.status(400).json({ error: { code: 'PAYMENT_FAILED', message: 'Payment could not be processed' } });
});
```

---

### cart-system

Shopping cart architecture — state management, persistent carts, guest checkout, coupon/discount engine, tax calculation.

#### Workflow

**Step 1 — Detect cart architecture**
Use Grep to find cart state: `cartStore`, `useCart`, `addToCart`, `localStorage.*cart`, `session.*cart`. Read cart-related components and API routes to understand: client vs server cart, persistence strategy, and discount handling.

**Step 2 — Audit cart integrity**
Check for: cart total calculated client-side only (price manipulation), no cart TTL (stale carts), missing guest-to-authenticated cart merge, race conditions on concurrent cart updates, coupons validated client-side, and no stock check at add-to-cart time.

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
    // Optimistic update
    set(state => ({ items: [...state.items, { productId, variantId, qty, pending: true }] }));
    // Server reconciliation (validates stock, calculates price)
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
```

---

### inventory-mgmt

Inventory management — stock tracking with optimistic locking, variant management, low stock alerts, backorder handling.

#### Workflow

**Step 1 — Detect inventory model**
Use Grep to find stock-related code: `stock`, `inventory`, `quantity`, `variant`, `warehouse`, `sku`. Read schema files to understand: single vs multi-warehouse, variant structure, and reservation model.

**Step 2 — Audit stock integrity**
Check for: stock decremented without transaction (oversell risk), no optimistic locking on concurrent updates, inventory checked at cart-add but not at checkout (stale check), missing low-stock alerts, and no backorder handling for out-of-stock items.

**Step 3 — Emit inventory patterns**
Emit: atomic stock reservation with optimistic locking (version field), reservation expiry for abandoned checkouts, low-stock alert trigger, and backorder queue.

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
```

---

## Connections

```
Calls → sentinel (L2): PCI compliance audit on payment code
Calls → db (L2): schema design for orders, inventory, carts
Called By ← cook (L1): when e-commerce project detected
Called By ← launch (L1): pre-launch checkout verification
Called By ← review (L2): when payment or cart code under review
```

## Tech Stack Support

| Platform | Framework | Payment | Notes |
|----------|-----------|---------|-------|
| Shopify | Hydrogen 2.x (Remix) | Shopify Payments | Storefront + Admin API |
| Custom | Next.js 16 / SvelteKit | Stripe | Most flexible |
| Headless | Any frontend | Stripe / PayPal | API-first commerce |
| Medusa.js | Next.js | Stripe / PayPal | Open-source alternative |

## Constraints

1. MUST calculate all prices server-side — never trust client-submitted amounts for payment.
2. MUST use idempotency keys on all payment creation API calls — prevent double charges.
3. MUST use optimistic locking or database transactions for inventory updates — prevent overselling.
4. MUST verify webhook signatures before processing any payment events.
5. MUST validate coupons and discounts server-side — client-side validation is bypassable.

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Double charge from retried Payment Intent without idempotency key | CRITICAL | Always pass idempotencyKey derived from cartId; check for existing successful intent before creating new one |
| Overselling during flash sale (stock goes negative) | CRITICAL | Use optimistic locking with version field; serializable isolation for high-contention items |
| Webhook processes `payment_intent.succeeded` but order creation fails (payment taken, no order) | HIGH | Wrap order creation in transaction; implement reconciliation job that matches intents to orders |
| Guest cart items lost on login (separate cart created for auth user) | HIGH | Implement cart merge in auth callback; prefer server cart state over local |
| Tax calculated at cart time but rate changed by checkout (wrong amount charged) | MEDIUM | Recalculate tax at payment creation time, not at cart add time |
| Liquid template outputs unescaped metafield content (XSS in Shopify theme) | HIGH | Always use `| escape` filter on user-generated metafield values |

## Done When

- Checkout flow completes end-to-end: cart → payment → order confirmation
- Inventory accurately tracks stock with no overselling under concurrent load
- Webhooks are idempotent and handle all payment lifecycle events
- Guest-to-authenticated cart merge works without data loss
- All prices and discounts validated server-side
- Structured report emitted for each skill invoked

## Cost Profile

~8,000–14,000 tokens per full pack run (all 4 skills). Individual skill: ~2,000–4,000 tokens. Sonnet default. Use haiku for detection scans; escalate to sonnet for payment flow and inventory pattern generation.
