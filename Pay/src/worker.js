/**
 * Rune Pay — Cloudflare Worker
 * SePay webhook → auto-deliver Rune Pro (GitHub repo invite)
 *
 * Endpoints:
 *   POST /webhook/sepay   — SePay bank transfer webhook
 *   GET  /order/:code     — Check order status
 *   GET  /health          — Health check
 *
 * Env secrets (set via `wrangler secret put`):
 *   SEPAY_API_KEY         — SePay API key for verification
 *   GITHUB_TOKEN          — GitHub PAT with repo collaborator invite permission
 *   WEBHOOK_SECRET        — Shared secret for webhook verification
 *
 * KV namespace:
 *   ORDERS                — Order state tracking
 */

const PRODUCTS = {
  'RUNE-PRO': {
    name: 'Rune Pro',
    price: 1190000, // ~$49 USD in VND
    repo: 'rune-kit/rune-pro',
    permission: 'pull',
  },
  'RUNE-BIZ': {
    name: 'Rune Business',
    price: 3590000, // ~$149 USD in VND
    repo: 'rune-kit/rune-pro',
    permission: 'pull',
  },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Secret-Key',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health check
      if (path === '/health') {
        return json({ status: 'ok', service: 'rune-pay' }, corsHeaders);
      }

      // SePay webhook
      if (path === '/webhook/sepay' && request.method === 'POST') {
        return handleSepayWebhook(request, env, corsHeaders);
      }

      // Order status check
      if (path.startsWith('/order/') && request.method === 'GET') {
        const code = path.replace('/order/', '');
        return handleOrderStatus(code, env, corsHeaders);
      }

      // Create order (from landing page)
      if (path === '/order/create' && request.method === 'POST') {
        return handleCreateOrder(request, env, corsHeaders);
      }

      return json({ error: 'Not found' }, corsHeaders, 404);
    } catch (err) {
      return json({ error: 'Internal error', message: err.message }, corsHeaders, 500);
    }
  },
};

// --- Handlers ---

async function handleSepayWebhook(request, env, headers) {
  // Verify webhook secret (SePay sends API Key via Authorization header)
  const secretKey = request.headers.get('Authorization');
  if (!secretKey || secretKey !== env.WEBHOOK_SECRET) {
    return json({ error: 'Unauthorized' }, headers, 401);
  }

  const body = await request.json();

  // SePay bank transfer webhook payload
  const { id, transferAmount, content, transferType, referenceCode } = body;

  // Only process incoming transfers
  if (transferType !== 'in') {
    return json({ success: true, message: 'Ignored outgoing transfer' }, headers);
  }

  // Extract order code from transfer content
  // Expected format: "RUNE-PRO-abc123" or "RUNE-BIZ-abc123"
  const orderCode = extractOrderCode(content);
  if (!orderCode) {
    return json({ success: true, message: 'No matching order code found' }, headers);
  }

  // Check if already processed (idempotency)
  const existing = await env.ORDERS.get(orderCode, 'json');
  if (existing && existing.status === 'delivered') {
    return json({ success: true, message: 'Already delivered' }, headers);
  }

  if (!existing) {
    return json({ success: true, message: 'Order not found' }, headers);
  }

  // Determine product type from order code prefix
  const productKey = orderCode.startsWith('RUNE-BIZ') ? 'RUNE-BIZ' : 'RUNE-PRO';
  const product = PRODUCTS[productKey];

  // Verify amount (allow 1% tolerance for bank rounding)
  const tolerance = product.price * 0.01;
  if (transferAmount < product.price - tolerance) {
    await updateOrder(env, orderCode, {
      ...existing,
      status: 'underpaid',
      received: transferAmount,
      sepayId: id,
      referenceCode,
    });
    return json({ success: true, message: 'Underpaid' }, headers);
  }

  // Invite to GitHub repo
  let inviteResult = null;
  if (existing.githubUsername) {
    inviteResult = await inviteToRepo(
      env.GITHUB_TOKEN,
      product.repo,
      existing.githubUsername,
      product.permission
    );
  }

  // Update order status
  await updateOrder(env, orderCode, {
    ...existing,
    status: 'delivered',
    received: transferAmount,
    sepayId: id,
    referenceCode,
    deliveredAt: new Date().toISOString(),
    githubInvite: inviteResult,
  });

  return json({ success: true, message: 'Delivered', orderCode, githubInvite: inviteResult }, headers);
}

async function handleCreateOrder(request, env, headers) {
  const { product, githubUsername, email } = await request.json();

  if (!product || !githubUsername) {
    return json({ error: 'Missing product or githubUsername' }, headers, 400);
  }

  const productKey = product.toUpperCase();
  const productInfo = PRODUCTS[productKey];
  if (!productInfo) {
    return json({ error: 'Invalid product' }, headers, 400);
  }

  // Generate unique order code
  const suffix = generateCode(8);
  const orderCode = `${productKey}-${suffix}`;

  const order = {
    code: orderCode,
    product: productKey,
    productName: productInfo.name,
    price: productInfo.price,
    githubUsername,
    email: email || null,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  // Store in KV (TTL 7 days for pending orders)
  await env.ORDERS.put(orderCode, JSON.stringify(order), {
    expirationTtl: 7 * 24 * 60 * 60,
  });

  return json({
    success: true,
    orderCode,
    amount: productInfo.price,
    transferContent: orderCode,
    message: `Transfer ${productInfo.price.toLocaleString('vi-VN')}đ with content: ${orderCode}`,
  }, headers);
}

async function handleOrderStatus(code, env, headers) {
  const order = await env.ORDERS.get(code, 'json');
  if (!order) {
    return json({ error: 'Order not found' }, headers, 404);
  }

  // Don't expose sensitive fields
  return json({
    code: order.code,
    product: order.productName,
    status: order.status,
    createdAt: order.createdAt,
    deliveredAt: order.deliveredAt || null,
  }, headers);
}

// --- Helpers ---

function extractOrderCode(content) {
  if (!content) return null;
  // Match RUNE-PRO-xxxxxxxx or RUNE-BIZ-xxxxxxxx
  const match = content.match(/RUNE-(PRO|BIZ)-[A-Z0-9]{8}/i);
  return match ? match[0].toUpperCase() : null;
}

function generateCode(length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1
  let result = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (const byte of array) {
    result += chars[byte % chars.length];
  }
  return result;
}

async function inviteToRepo(token, repo, username, permission) {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/collaborators/${username}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'rune-pay-worker',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ permission }),
    }
  );

  const status = response.status;
  // 201 = invited, 204 = already collaborator
  if (status === 201 || status === 204) {
    return { success: true, status };
  }

  const body = await response.text();
  return { success: false, status, error: body };
}

async function updateOrder(env, code, order) {
  // Delivered orders: keep for 90 days
  const ttl = order.status === 'delivered' ? 90 * 24 * 60 * 60 : 7 * 24 * 60 * 60;
  await env.ORDERS.put(code, JSON.stringify(order), { expirationTtl: ttl });
}

function json(data, extraHeaders = {}, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}
