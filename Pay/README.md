# Rune Pay

Cloudflare Worker for Rune Pro payment via SePay (VietQR bank transfer).

## Setup

```bash
# 1. Create KV namespace
wrangler kv namespace create ORDERS
# Copy the ID into wrangler.toml

# 2. Set secrets
wrangler secret put WEBHOOK_SECRET    # shared secret with SePay webhook config
wrangler secret put GITHUB_TOKEN      # GitHub PAT with collaborator invite permission
wrangler secret put SEPAY_API_KEY     # SePay API key (for future use)

# 3. Deploy
wrangler deploy

# 4. Configure SePay webhook
# URL: https://pay.theio.vn/webhook/sepay
# Header: X-Secret-Key = <your WEBHOOK_SECRET>
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhook/sepay` | SePay bank transfer webhook |
| POST | `/order/create` | Create new order (from landing page) |
| GET | `/order/:code` | Check order status |
| GET | `/health` | Health check |

## Flow

1. Buyer clicks "Buy" on landing page
2. Landing page calls `POST /order/create` with `{ product, githubUsername }`
3. Worker returns order code + amount
4. Buyer transfers exact amount with order code as content
5. SePay detects transfer → sends webhook to `/webhook/sepay`
6. Worker verifies amount → invites buyer to `rune-kit/rune-pro` GitHub repo
7. Buyer gets GitHub invitation email

## Products

| Code | Price (VND) | ~USD |
|------|------------|------|
| RUNE-PRO | 1,190,000 | $49 |
| RUNE-BIZ | 3,590,000 | $149 |
