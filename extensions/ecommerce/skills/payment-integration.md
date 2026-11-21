---
name: "payment-integration"
pack: "@rune/ecommerce"
description: "Payment integration — Stripe Payment Intents, 3D Secure, webhook handling, refunds, idempotency, PCI compliance, multi-currency, fraud detection, Vietnamese payment gateways (SePay, VNPay, MoMo)."
model: sonnet
tools: [Read, Edit, Write, Grep, Glob, Bash]
---

# payment-integration

Payment integration — Stripe Payment Intents, 3D Secure, webhook handling, refunds, idempotency, PCI compliance, multi-currency, fraud detection, Vietnamese payment gateways (SePay, VNPay, MoMo).

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

#### Vietnamese Payment Gateways (SePay, VNPay, MoMo, ZaloPay)

Vietnam market uses QR-based bank transfers and e-wallets instead of card payments. SePay is the simplest (webhook on bank transfer), VNPay is the most widely adopted gateway, MoMo/ZaloPay are e-wallet leaders.

**SePay — QR Bank Transfer (simplest integration)**

```typescript
// SePay: generate QR code for bank transfer, webhook on payment received
// Docs: https://my.sepay.vn/docs

interface SePayConfig {
  apiKey: string;
  bankAccount: string;  // your receiving bank account
  bankCode: string;     // e.g., 'MB', 'VCB', 'TCB', 'ACB'
  webhookSecret: string;
}

// Generate payment QR — user scans with banking app
async function createSePayQR(orderId: string, amountVND: number, config: SePayConfig) {
  // SePay uses structured transfer content for auto-matching
  const transferContent = `DH${orderId}`;  // prefix for order matching

  return {
    bankCode: config.bankCode,
    bankAccount: config.bankAccount,
    amount: amountVND,
    content: transferContent,
    // QR follows VietQR standard (NAPAS)
    qrUrl: `https://qr.sepay.vn/img?acc=${config.bankAccount}&bank=${config.bankCode}&amount=${amountVND}&des=${transferContent}`,
  };
}

// Webhook — SePay calls this when bank transfer is detected
app.post('/api/webhooks/sepay', async (req, res) => {
  // Verify webhook signature
  const signature = req.headers['x-sepay-signature'] as string;
  const payload = JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', process.env.SEPAY_WEBHOOK_SECRET!)
    .update(payload).digest('hex');

  if (signature !== expected) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { transferAmount, transferContent, transactionDate, id } = req.body;

  // Deduplicate
  const existing = await db.payment.findFirst({ where: { externalId: String(id) } });
  if (existing) return res.json({ success: true, duplicate: true });

  // Match order by transfer content (DH{orderId})
  const orderIdMatch = transferContent.match(/DH(\w+)/);
  if (!orderIdMatch) {
    console.error('SePay: unmatched transfer', { transferContent, id });
    return res.json({ success: true, matched: false });
  }

  await db.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        orderId: orderIdMatch[1],
        amount: transferAmount,
        method: 'BANK_TRANSFER',
        provider: 'sepay',
        externalId: String(id),
        paidAt: new Date(transactionDate),
      },
    });
    await tx.order.update({
      where: { id: orderIdMatch[1] },
      data: { status: 'PAID', paidAt: new Date(transactionDate) },
    });
  });

  res.json({ success: true });
});
```

**VNPay — Vietnam's largest payment gateway**

```typescript
// VNPay: redirect-based payment with HMAC-SHA512 signature
// Docs: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html

import crypto from 'crypto';
import qs from 'qs';

interface VNPayConfig {
  tmnCode: string;      // merchant code
  hashSecret: string;   // secret key
  vnpUrl: string;       // 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html' (sandbox)
  returnUrl: string;    // your callback URL
}

function createVNPayUrl(orderId: string, amountVND: number, ipAddr: string, config: VNPayConfig): string {
  const now = new Date();
  const createDate = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

  const params: Record<string, string> = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: config.tmnCode,
    vnp_Locale: 'vn',
    vnp_CurrCode: 'VND',
    vnp_TxnRef: orderId,
    vnp_OrderInfo: `Thanh toan don hang ${orderId}`,
    vnp_OrderType: 'other',
    vnp_Amount: String(amountVND * 100),  // VNPay uses smallest unit (x100)
    vnp_ReturnUrl: config.returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: createDate,
  };

  // Sort params alphabetically — REQUIRED by VNPay
  const sortedParams = Object.keys(params).sort().reduce((acc, key) => {
    acc[key] = params[key];
    return acc;
  }, {} as Record<string, string>);

  const signData = qs.stringify(sortedParams, { encode: false });
  const hmac = crypto.createHmac('sha512', config.hashSecret);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

  return `${config.vnpUrl}?${signData}&vnp_SecureHash=${signed}`;
}

// IPN (Instant Payment Notification) — VNPay server-to-server callback
app.get('/api/webhooks/vnpay-ipn', async (req, res) => {
  const vnpParams = { ...req.query } as Record<string, string>;
  const secureHash = vnpParams.vnp_SecureHash;
  delete vnpParams.vnp_SecureHash;
  delete vnpParams.vnp_SecureHashType;

  // Verify hash
  const sortedParams = Object.keys(vnpParams).sort().reduce((acc, key) => {
    acc[key] = vnpParams[key];
    return acc;
  }, {} as Record<string, string>);

  const signData = qs.stringify(sortedParams, { encode: false });
  const expectedHash = crypto.createHmac('sha512', process.env.VNPAY_HASH_SECRET!)
    .update(Buffer.from(signData, 'utf-8')).digest('hex');

  if (secureHash !== expectedHash) {
    return res.json({ RspCode: '97', Message: 'Invalid signature' });
  }

  const orderId = vnpParams.vnp_TxnRef;
  const responseCode = vnpParams.vnp_ResponseCode;

  if (responseCode === '00') {
    await orderService.confirmPayment(orderId, vnpParams.vnp_TransactionNo);
    return res.json({ RspCode: '00', Message: 'Confirm Success' });
  }

  await orderService.failPayment(orderId, responseCode);
  res.json({ RspCode: '00', Message: 'Confirm Success' });  // always return 00 to VNPay
});
```

**MoMo — E-wallet payment**

```typescript
// MoMo: QR or app-switch payment
// Docs: https://developers.momo.vn/v3/docs/payment/api/

interface MoMoConfig {
  partnerCode: string;
  accessKey: string;
  secretKey: string;
  endpoint: string;  // 'https://test-payment.momo.vn/v2/gateway/api/create'
  redirectUrl: string;
  ipnUrl: string;
}

async function createMoMoPayment(orderId: string, amountVND: number, config: MoMoConfig) {
  const requestId = `${config.partnerCode}-${Date.now()}`;
  const orderInfo = `Thanh toan don hang ${orderId}`;
  const extraData = '';  // base64 encoded extra data

  // HMAC SHA256 signature — order of fields matters!
  const rawSignature = [
    `accessKey=${config.accessKey}`,
    `amount=${amountVND}`,
    `extraData=${extraData}`,
    `ipnUrl=${config.ipnUrl}`,
    `orderId=${orderId}`,
    `orderInfo=${orderInfo}`,
    `partnerCode=${config.partnerCode}`,
    `redirectUrl=${config.redirectUrl}`,
    `requestId=${requestId}`,
    `requestType=payWithMethod`,
  ].join('&');

  const signature = crypto.createHmac('sha256', config.secretKey)
    .update(rawSignature).digest('hex');

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partnerCode: config.partnerCode,
      accessKey: config.accessKey,
      requestId,
      amount: amountVND,
      orderId,
      orderInfo,
      redirectUrl: config.redirectUrl,
      ipnUrl: config.ipnUrl,
      extraData,
      requestType: 'payWithMethod',
      signature,
      lang: 'vi',
    }),
  });

  const data = await response.json();
  return { payUrl: data.payUrl, qrCodeUrl: data.qrCodeUrl, deeplink: data.deeplink };
}
```

**Sharp Edges — VN Payment Gotchas:**
- SePay: transfer content MUST be exact match — users sometimes add extra text → payment not auto-matched. Always show exact content to copy.
- VNPay: `vnp_Amount` is multiplied by 100 (not cents — VND has no decimals). Common bug: double-multiplying.
- VNPay: ALWAYS return `RspCode: '00'` to IPN even on failure — otherwise VNPay retries indefinitely.
- MoMo: signature field order is strict — wrong order = invalid signature. Copy exact order from docs.
- ZaloPay: similar to MoMo but uses HMAC-SHA256 with different field ordering. Check docs at `https://docs.zalopay.vn/`.
- All VN gateways: amounts are in VND (integer, no decimals). Never use floating point for VND.
- Sandbox environments often have rate limits and expire — test with real small amounts (10,000 VND) before go-live.

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
