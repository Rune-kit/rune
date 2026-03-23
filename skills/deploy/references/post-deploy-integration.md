# Post-Deploy Integration Verification

> After every deploy touching webhooks, payment providers, email services, or GitHub API — run this checklist. A Cloudflare Worker deployed cleanly does not mean integrations work. Polar's webhook defaults to zero events selected; zero events = zero orders = silent failure for days.

---

## Post-Deploy Integration Verification Matrix

| Integration Type | Verify | Command / Check | Expected Result |
|-----------------|--------|-----------------|-----------------|
| Webhook endpoint | HTTP reachability | `curl -X POST https://your-worker.dev/webhook/provider` | 200 or 400 (not 404/502) |
| Webhook secret | Signature validation | Send test event from provider dashboard | 200, no signature error in logs |
| Webhook events | Events subscribed | Provider dashboard → Webhook → Events tab | At least one event type selected |
| Email delivery | Send + delivery | Trigger a flow that sends email, check inbox | Email arrives within 60s |
| Email DNS | SPF / DKIM / DMARC | `dig TXT yourdomain.com` + MXToolbox | All three records resolve correctly |
| GitHub API | PAT scope + expiry | `curl -H "Authorization: Bearer $PAT" https://api.github.com/user` | 200 with user object |
| GitHub invites | Repo invite flow | Trigger invite, check pending invitations | Invitation appears in GitHub UI |
| KV / Database | State after transaction | `wrangler kv key list --namespace-id=XXX` | Keys present, count matches expected |
| DNS / routing | Worker route binding | `curl -I https://yourdomain.com/webhook/provider` | Response from worker (check CF-Ray header) |

---

## Smoke Test Script Pattern

Run immediately after every deploy that touches integrations.

```bash
WORKER_URL="https://your-worker.dev"
ADMIN_SECRET="$WORKER_ADMIN_SECRET"

# 1. Endpoint reachability — expect 200 or 400 (not 404/502)
echo "=== Endpoint reachability ==="
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST "$WORKER_URL/webhook/polar"
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST "$WORKER_URL/webhook/stripe"

# 2. Health endpoint — expect { status: "ok" }
echo "=== Health check ==="
curl -s "$WORKER_URL/health" | jq .

# 3. Admin orders count — expect number (0 is OK on fresh deploy)
echo "=== Orders in KV ==="
curl -s -H "Authorization: Bearer $ADMIN_SECRET" \
  "$WORKER_URL/admin/orders" | jq length

# 4. KV namespace populated
echo "=== KV key count ==="
npx wrangler kv key list --namespace-id="$KV_NAMESPACE_ID" | jq length

# 5. GitHub API access — expect login field
echo "=== GitHub PAT check ==="
curl -s -H "Authorization: Bearer $GITHUB_PAT" \
  https://api.github.com/user | jq .login
```

Expected output on healthy deploy:

```
=== Endpoint reachability ===
HTTP 400
HTTP 400
=== Health check ===
{ "status": "ok", "version": "1.0.0" }
=== Orders in KV ===
0
=== KV key count ===
0
=== GitHub PAT check ===
"your-github-username"
```

---

## Integration-Specific Checklists

### Payment Webhooks (Polar, Stripe, SePay)

- [ ] Webhook URL uses HTTPS, not HTTP
- [ ] Events selected in provider dashboard — **Polar defaults to NONE, must select manually**
- [ ] Secret copied exactly — no leading/trailing whitespace
- [ ] Secret format matches what code expects (raw string vs `whsec_` prefix for Stripe)
- [ ] `wrangler secret list` confirms secret is set in production environment
- [ ] Test delivery from provider dashboard returns 200
- [ ] After test delivery: order appears in KV or database
- [ ] After test delivery: confirmation email sent to test address
- [ ] Re-delivering the same event does not create a duplicate order (idempotency key check)
- [ ] Webhook signature verification rejects tampered payload (test with wrong secret)

**Polar-specific**: Settings → Webhooks → select your webhook → Events tab → check at least `order.created`, `subscription.created`, `subscription.updated`, `subscription.revoked` are checked.

**Stripe-specific**: Dashboard → Developers → Webhooks → endpoint → listen to events. Secret starts with `whsec_` — your code must pass the raw header value, not strip the prefix.

### Email Service (Resend, SES)

- [ ] API key is valid and not rotated since last deploy
- [ ] From address domain is verified in provider dashboard
- [ ] SPF record: `v=spf1 include:_spf.resend.com ~all` (or provider equivalent)
- [ ] DKIM record present and propagated (check with `dig TXT resend._domainkey.yourdomain.com`)
- [ ] DMARC record: `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com`
- [ ] Send a real test email after deploy, verify it lands in inbox (not spam)
- [ ] Email template renders variable substitution correctly (no `{{name}}` literals in output)
- [ ] Unsubscribe link resolves and triggers unsubscribe flow

### GitHub API (Repo Invites)

- [ ] PAT (`GITHUB_PAT`) has scopes: `repo`, `admin:org` (for org repos)
- [ ] PAT expiry date is in the future — classic PATs can expire silently
- [ ] Target repos exist and PAT owner has admin access
- [ ] Invite flow creates a pending invitation (visible at `https://github.com/orgs/ORG/people`)
- [ ] Invited user receives GitHub notification email within 5 minutes
- [ ] Accepting invite grants correct permission level (read / write / admin per plan)
- [ ] Revoking access removes user from repo collaborators within expected SLA

**Check PAT expiry:**
```bash
curl -s -H "Authorization: Bearer $GITHUB_PAT" \
  https://api.github.com/rate_limit | jq .rate
# If you get 401, the PAT is expired or revoked
```

---

## Common Failure Patterns

| Pattern | Symptom | Root Cause | Fix |
|---------|---------|------------|-----|
| Silent webhook failure | No errors in logs, no data in KV, zero orders | Events not selected in provider dashboard | Go to provider dashboard → webhook settings → select event types |
| All webhook requests 403 | `invalid signature` in logs, every delivery fails | Secret in worker env doesn't match secret shown in provider | Copy secret again, `wrangler secret put SECRET_NAME`, redeploy |
| Partial integration failure | Some repos invited, email never sends | `catch` block swallowing the email error, only repo invite logged | Add explicit error logging inside each catch; never swallow errors silently |
| Works in local dev, fails in production | 500s on webhook, env var undefined errors | Secret set in `.dev.vars` but not in production via `wrangler secret put` | Run `wrangler secret list`, add any missing secrets |
| First webhook succeeds, subsequent are rejected | Duplicate order prevented, but also valid re-deliveries blocked | Idempotency key stored permanently; provider retries are rejected | Use TTL on idempotency keys, or check event timestamp before rejecting |
| Email sends but lands in spam | Delivery confirmed by API, user never sees it | Missing or misconfigured SPF/DKIM/DMARC | Verify all three DNS records, wait propagation, retest |
| GitHub invite 422 | `already a collaborator` error | User was previously invited and accepted | Check existing collaborators before sending invite |
| KV reads return stale data | Data visible in `wrangler kv key get` but worker returns old value | Worker cached old KV binding; binding namespace-id mismatch in wrangler.toml | Verify `wrangler.toml` `kv_namespaces` points to production namespace ID |

---

## Environment Variable Audit

Before every deploy, confirm all required secrets exist in the production environment:

```bash
# List all secrets currently set for the worker
npx wrangler secret list --name your-worker-name
```

| Environment Variable | Purpose | How to Verify It Works |
|---------------------|---------|------------------------|
| `POLAR_WEBHOOK_SECRET` | Validates Polar webhook signature | Send test event from Polar dashboard → expect 200 |
| `STRIPE_WEBHOOK_SECRET` | Validates Stripe webhook signature (`whsec_...`) | Stripe CLI `stripe trigger payment_intent.created` |
| `RESEND_API_KEY` | Sends transactional email | `curl -X POST api.resend.com/emails` with test recipient |
| `GITHUB_PAT` | Invites users to repos on purchase | `curl api.github.com/user` → expect 200 with login |
| `ADMIN_SECRET` | Protects `/admin/*` endpoints | `curl /admin/orders -H "Authorization: Bearer $SECRET"` → expect 200 |
| `KV_NAMESPACE_ID` | Bound KV namespace for order persistence | `wrangler kv key list --namespace-id=$ID` → no error |

If any secret is missing from `wrangler secret list` output, add it before considering the deploy complete:

```bash
npx wrangler secret put POLAR_WEBHOOK_SECRET --name your-worker-name
# Paste the secret value when prompted (no echo to terminal)
```

---

## Rollback Triggers

| Situation | Decision | Reasoning |
|-----------|----------|-----------|
| Data corruption in KV (duplicate orders, wrong amounts) | Rollback immediately | Data integrity takes priority; forward-fix risks compounding the damage |
| Webhook returning 5xx consistently | Fix-forward (no rollback) | Provider retries automatically; rollback doesn't fix misconfiguration |
| Wrong webhook secret | Fix-forward: update secret + redeploy | Secret is env-level, rollback doesn't change env vars |
| Events not selected in Polar | Fix-forward: configure in provider dashboard | No code change needed; dashboard-only fix, deploy not required |
| Email API key invalid | Fix-forward: rotate key + `wrangler secret put` | Key lives in secrets, not code; redeploy takes 30s |
| GitHub PAT expired | Fix-forward: generate new PAT + update secret | Same as above |
| Health endpoint returning 500 on all routes | Rollback immediately | Worker itself is broken; users are hitting errors |
| Invite flow broken for subset of users | Fix-forward with hotfix | Partial breakage; rollback removes working functionality too |

**Rollback command (Cloudflare Workers):**
```bash
# List recent deployments
npx wrangler deployments list --name your-worker-name

# Rollback to a specific deployment
npx wrangler rollback --deployment-id <id> --name your-worker-name
```

**Fix-forward checklist before re-deploy:**
1. Identify root cause (check logs via `wrangler tail`)
2. Fix in code or secrets
3. Run smoke test locally against staging
4. Deploy to production
5. Re-run smoke test script above
6. Confirm provider dashboard shows successful test delivery
