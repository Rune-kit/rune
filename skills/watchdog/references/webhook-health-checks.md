# Webhook Health Checks

> Diagnose and verify webhook integrations end-to-end — from endpoint reachability through secret validation, event subscription, and data persistence. Covers Polar, Stripe, SePay, and generic Standard Webhooks providers.

---

## Pre-Flight Checklist

Run every check before going live. A single missed item can silently break the entire integration — the incident that informed this guide took hours to trace because three independent issues coexisted.

| # | Check | How to Verify | Pass Condition |
|---|-------|---------------|----------------|
| 1 | Endpoint reachable | `curl -X POST https://your-domain/webhooks/polar` | HTTP response is not 404 or 502 |
| 2 | Events subscribed | Open provider dashboard → webhook config → event list | At least one event selected (defaults to none on Polar) |
| 3 | Secret format matches code | Compare `WEBHOOK_SECRET` env value prefix with provider docs | Prefix matches expected format (e.g., `polar_whs_` not `whsec_`) |
| 4 | Test event returns 200 | Use provider dashboard "Send test event" button | Handler responds 200; no 4xx in delivery log |
| 5 | Data store receives test record | Query KV/DB after test event | Record count increases by 1; not still zero |

---

## Webhook Provider Cheat Sheet

### Polar

**Secret format**: `polar_whs_*`

Do NOT use Standard Webhooks format (`whsec_`) — Polar has its own prefix. Using the wrong format causes HMAC verification to fail silently with 403 on every delivery.

**How Polar SDK signs requests**:

Polar's SDK double-encodes the secret before passing it to the Standard Webhooks verifier:

```ts
Buffer.from(secret, 'utf-8').toString('base64')
```

Standard Webhooks then base64-decodes that value to recover the HMAC key. The net effect: the HMAC key equals the raw UTF-8 bytes of the full secret string, including the `polar_whs_` prefix. Your verification code must provide the entire secret string as-is — never strip the prefix, never re-encode it.

**Events**: Polar defaults to zero events selected. You must explicitly tick each event in the dashboard under the webhook configuration. Forgetting this means the endpoint is registered but no payloads are ever sent.

| Event | Trigger |
|-------|---------|
| `order.paid` | One-time purchase completed |
| `subscription.active` | New subscription activated |
| `subscription.canceled` | Subscription canceled |
| `subscription.revoked` | Access revoked (e.g., refund) |

**Signature headers**:

| Header | Description |
|--------|-------------|
| `webhook-id` | Unique delivery ID |
| `webhook-timestamp` | Unix timestamp (seconds) |
| `webhook-signature` | Space-separated HMAC signatures |

---

### Stripe

**Secret format**: `whsec_*`

Stripe uses Standard Webhooks format. Copy the signing secret from the dashboard exactly — it starts with `whsec_`.

**Events**: Selected per endpoint in the Stripe dashboard. Each endpoint can subscribe to different event sets.

**Signature header**: `stripe-signature` (single header, not split into three).

**Verification**: HMAC-SHA256 over `{timestamp}.{raw_body}`. Always verify using the raw request body before any JSON parsing — body parsing middleware can alter whitespace and break the signature.

| Event | Trigger |
|-------|---------|
| `payment_intent.succeeded` | Payment captured |
| `checkout.session.completed` | Checkout flow finished |
| `customer.subscription.created` | Subscription started |
| `customer.subscription.deleted` | Subscription ended |
| `invoice.payment_failed` | Renewal payment failed |

---

### SePay (Vietnam bank transfer)

**Secret format**: None — SePay does not sign webhook payloads.

**Verification method**: IP whitelist instead of HMAC. Accept only requests from SePay's published IP ranges. Reject all others at the firewall or handler level.

**Event model**: SePay fires on bank transfer match. One event per matched transaction. No retry logic — if your endpoint is down, the event is lost.

**Key fields in payload**:

| Field | Description |
|-------|-------------|
| `transferAmount` | Amount received (VND) |
| `content` | Transfer description (used for order matching) |
| `transactionDate` | Bank transaction timestamp |
| `referenceCode` | Unique reference for deduplication |

---

### Generic Standard Webhooks

**Secret format**: `whsec_<base64>`

The portion after `whsec_` is a base64-encoded byte sequence used as the raw HMAC key. Standard Webhooks libraries handle the decode automatically — pass the full `whsec_*` string.

**Required headers**:

| Header | Description |
|--------|-------------|
| `webhook-id` | Unique message ID (use for deduplication) |
| `webhook-timestamp` | Unix timestamp (seconds) |
| `webhook-signature` | `v1,<base64_hmac>` — may include multiple space-separated values |

**Signing algorithm**: HMAC-SHA256 over the string `{webhook-id}.{webhook-timestamp}.{raw_body}`.

**Replay protection**: Reject events where `webhook-timestamp` is more than 5 minutes from server time.

---

## Diagnosis Flowchart

When a webhook integration is not working, follow this order. Skipping ahead wastes time — each layer depends on the one before it.

```
1. Is the endpoint reachable?
   └─ No  → Fix DNS, reverse proxy config, or firewall rules first
   └─ Yes → continue

2. Are events subscribed in the provider dashboard?
   └─ No  → Select events; no payload will ever be sent otherwise
   └─ Yes → continue

3. Is signature verification passing?
   └─ No  → Check delivery logs for 403; verify secret format and value
   └─ Yes → continue

4. Is data being stored?
   └─ No  → Check KV/DB writes in handler; look for silent errors after 200
   └─ Yes → continue

5. Is business logic executing?
   └─ No  → Check downstream effects: emails sent, invites created, entitlements granted
   └─ Yes → Integration is healthy
```

### Symptom → Cause → Fix

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| No deliveries in provider log | Events not selected in dashboard | Enable events in webhook config |
| All deliveries return 403 | Secret format mismatch or wrong secret value | Verify env var matches provider format; rotate if needed |
| All deliveries return 400 | Body parsed before signature verification | Read raw body bytes before any middleware parsing |
| Deliveries return 200 but KV/DB is empty | Write logic not executing or throwing silently | Add error logging around KV/DB write; check handler catch blocks |
| Sporadic 500s | Unhandled edge cases in payload shape | Log raw payload on error; add null checks |
| Deliveries stopped after deploy | New env vars not picked up | Restart service; confirm env var is set in production |
| Duplicate records in DB | No idempotency key check | Deduplicate on `webhook-id` before writing |

---

## Delivery Log Analysis

### How to Read Logs

Every provider exposes a delivery log per webhook endpoint. Check it before digging into code — the HTTP status code tells you where the failure is.

| Status | Meaning | Where to Look |
|--------|---------|---------------|
| 200 | Handler accepted and processed | Check data store for records |
| 400 | Handler rejected payload | Raw body / JSON parse issue; check signature verification order |
| 403 | Signature verification failed | Secret format mismatch; wrong env var; body was pre-parsed |
| 404 | Endpoint not found | Wrong URL in provider config; routing issue |
| 408 / 504 | Handler timed out | Processing too slow; move heavy work to a queue |
| 500 | Unhandled exception in handler | Check application logs for stack trace |
| No attempts | Events not subscribed | Enable events in provider dashboard |

### Provider-Specific Log Access

| Provider | Path |
|----------|------|
| Polar | Dashboard → Webhooks → select endpoint → Deliveries tab |
| Stripe | Dashboard → Developers → Webhooks → select endpoint → Event deliveries |
| SePay | Admin panel → Webhook logs (if available; otherwise check application logs) |

---

## Secret Rotation Procedure

Rotate without downtime by accepting both old and new secrets during a transition window.

**Step 1**: Generate a new secret in the provider dashboard (do not save yet — the old secret is still active).

**Step 2**: Update your handler to accept both the old secret and the new one. Most Standard Webhooks libraries support an array of secrets. If not, attempt verification with each and pass if either succeeds:

```ts
function verifyWithFallback(payload, headers, oldSecret, newSecret) {
  try {
    return wh.verify(payload, headers, newSecret);
  } catch {
    return wh.verify(payload, headers, oldSecret); // fails loudly if both invalid
  }
}
```

**Step 3**: Deploy the updated handler.

**Step 4**: In the provider dashboard, activate the new secret (this invalidates the old one).

**Step 5**: Monitor delivery logs for 5–10 minutes. Confirm all deliveries return 200.

**Step 6**: Remove the old secret from your handler code and re-deploy.

**Step 7**: Update `WEBHOOK_SECRET` in your secrets manager / environment to the new value.

---

## Monitoring Checklist

Ongoing monitoring catches regressions before they affect revenue.

### Periodic Checks

| Frequency | Check | Where |
|-----------|-------|-------|
| Daily | Delivery success rate | Provider dashboard → webhook endpoint → metrics |
| Daily | KV/DB record count vs. provider order count | Query both; counts should match |
| Weekly | Review any 4xx or 5xx deliveries in logs | Provider delivery log |
| On deploy | Send a test event from provider dashboard | Verify 200 and data store record |

### Alerts to Configure

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Zero webhook events received | 24 hours with expected traffic | Investigate endpoint, event subscription |
| Sudden spike in 4xx responses | > 5% of deliveries | Check for secret rotation, code change, body-parsing issue |
| Sudden spike in 5xx responses | > 1% of deliveries | Check application logs for new exceptions |
| KV/DB record count diverges from provider | > 0 gap | Audit missed deliveries; consider replay |

### Replay Missed Events

Most providers allow replaying past events from the delivery log. Use this to recover from a handler outage rather than asking customers to re-purchase.

- **Polar**: Delivery log → failed delivery → Resend
- **Stripe**: Event detail page → Resend
- **SePay**: No replay — contact SePay support or reconcile manually via bank statement
