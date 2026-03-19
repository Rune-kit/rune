// ─── Mesh Canvas Animation ───
(function initMesh() {
  const canvas = document.getElementById('mesh-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, nodes, animId;

  function resize() {
    w = canvas.width = canvas.parentElement.offsetWidth;
    h = canvas.height = canvas.parentElement.offsetHeight;
  }

  function createNodes(count) {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2 + 1
      });
    }
    return arr;
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const maxDist = 160;

    // move nodes
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;
    }

    // draw connections
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist) {
          const alpha = (1 - dist / maxDist) * 0.5;
          ctx.strokeStyle = `rgba(60, 85, 50, ${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    // draw nodes
    for (const n of nodes) {
      ctx.fillStyle = 'rgba(60, 85, 50, 0.7)';
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }

    animId = requestAnimationFrame(draw);
  }

  function start() {
    resize();
    const density = Math.min(60, Math.floor((w * h) / 15000));
    nodes = createNodes(density);
    if (animId) cancelAnimationFrame(animId);
    draw();
  }

  // respect reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    resize();
    nodes = createNodes(30);
    // draw one static frame
    draw();
    cancelAnimationFrame(animId);
    return;
  }

  start();
  window.addEventListener('resize', () => { start(); });
})();

// ─── Scroll-triggered animations ───
(function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animationPlayState = 'running';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.layer, .feature-card, .workflow-card, .compare-card, .ext-card, .install-card, .pricing-card, .stat').forEach(el => {
    el.style.animationPlayState = 'paused';
    observer.observe(el);
  });
})();

// ─── Counter animation ───
(function initCounters() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.target, 10);
        const duration = 1200;
        const start = performance.now();

        function tick(now) {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          // ease out cubic
          const eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.round(target * eased);
          if (progress < 1) requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.stat-num[data-target]').forEach(el => observer.observe(el));
})();

// ─── Payment Flow ───
const PAY_API = 'https://pay.theio.vn';
const BANK_ID = 'tpbank';
const BANK_ACCOUNT = '04162263666';
const ACCOUNT_NAME = 'NGUYEN VIET NAM';

// Launch promo: 50% off for 7 days
const PROMO = {
  discount: 0.5,
  endsAt: new Date('2026-03-25T23:59:59+07:00').getTime(),
};

function isPromoActive() {
  return Date.now() < PROMO.endsAt;
}

function fmtVND(n) {
  return n.toLocaleString('vi-VN') + ' VND';
}

const PRODUCT_INFO = {
  'rune-pro': {
    title: 'Get Rune Pro', titleShort: 'Rune Pro',
    basePrice: 1190000, baseIntl: 49,
    btnClass: 'btn-pro',
  },
  'rune-biz': {
    title: 'Get Rune Business', titleShort: 'Rune Business',
    basePrice: 3590000, baseIntl: 149,
    btnClass: 'btn-biz',
  },
};

function getProductPricing(key) {
  const info = PRODUCT_INFO[key];
  const promo = isPromoActive();
  const price = promo ? Math.round(info.basePrice * (1 - PROMO.discount)) : info.basePrice;
  const intl = promo ? Math.round(info.baseIntl * (1 - PROMO.discount)) : info.baseIntl;
  return {
    ...info,
    priceVN: fmtVND(price),
    priceIntl: '$' + intl + ' USD',
    amountLabel: fmtVND(price) + ' (~$' + intl + ' USD)',
    promo,
    originalVN: fmtVND(info.basePrice),
    originalIntl: '$' + info.baseIntl + ' USD',
  };
}

let payState = { product: null, orderCode: null, pollTimer: null };

function openPayment(product) {
  const info = getProductPricing(product);
  if (!info) return;

  payState = { product, orderCode: null, pollTimer: null };

  document.getElementById('pay-title').textContent = info.title;
  document.getElementById('pay-title-2').textContent = info.title;
  document.getElementById('pay-amount-2').textContent = info.amountLabel;

  const vnPriceEl = document.getElementById('pay-price-vn');
  const intlPriceEl = document.getElementById('pay-price-intl');
  if (info.promo) {
    vnPriceEl.innerHTML = '<s style="opacity:.5">' + info.originalVN + '</s> ' + info.priceVN;
    intlPriceEl.innerHTML = '<s style="opacity:.5">' + info.originalIntl + '</s> ' + info.priceIntl;
  } else {
    vnPriceEl.textContent = info.priceVN;
    intlPriceEl.textContent = info.priceIntl;
  }

  document.getElementById('pay-github').value = '';
  document.getElementById('pay-email').value = '';
  document.getElementById('pay-error').hidden = true;

  const submitBtn = document.getElementById('pay-submit');
  submitBtn.className = 'btn ' + info.btnClass;
  submitBtn.style.width = '100%';
  submitBtn.style.marginTop = '16px';

  showPayStep(1);
  document.getElementById('pay-modal').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closePayment() {
  document.getElementById('pay-modal').hidden = true;
  document.body.style.overflow = '';
  if (payState.pollTimer) {
    clearInterval(payState.pollTimer);
    payState.pollTimer = null;
  }
}

function showPayStep(n) {
  for (let i = 1; i <= 5; i++) {
    document.getElementById('pay-step-' + i).hidden = (i !== n);
  }
}

function showVNPayment() {
  showPayStep(2);
  document.getElementById('pay-github').focus();
}

function showIntlPayment() {
  const info = getProductPricing(payState.product);
  document.getElementById('pay-title-5').textContent = info.title;
  document.getElementById('pay-amount-5').textContent = info.priceIntl;
  document.getElementById('pay-intl-github').value = '';
  document.getElementById('pay-intl-email').value = '';
  document.getElementById('pay-intl-error').hidden = true;

  const btn = document.getElementById('pay-intl-submit');
  btn.className = 'btn ' + info.btnClass;
  btn.style.width = '100%';
  btn.style.marginTop = '16px';

  showPayStep(5);
  document.getElementById('pay-intl-github').focus();
}

async function startPolarCheckout() {
  const github = document.getElementById('pay-intl-github').value.trim();
  const email = document.getElementById('pay-intl-email').value.trim();
  const errorEl = document.getElementById('pay-intl-error');

  if (!github) {
    errorEl.textContent = 'Please enter your GitHub username';
    errorEl.hidden = false;
    return;
  }

  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(github)) {
    errorEl.textContent = 'Invalid GitHub username format';
    errorEl.hidden = false;
    return;
  }

  errorEl.hidden = true;
  const btn = document.getElementById('pay-intl-submit');
  btn.disabled = true;
  btn.textContent = 'Redirecting to checkout...';

  try {
    const res = await fetch(PAY_API + '/checkout/polar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product: payState.product,
        githubUsername: github,
        email: email || undefined,
      }),
    });

    const data = await res.json();
    if (!data.success || !data.url) throw new Error(data.error || 'Failed to create checkout');

    // Redirect to Polar checkout page
    window.location.href = data.url;
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Pay with Card / PayPal';
  }
}

async function createOrder() {
  const github = document.getElementById('pay-github').value.trim();
  const email = document.getElementById('pay-email').value.trim();
  const errorEl = document.getElementById('pay-error');

  if (!github) {
    errorEl.textContent = 'Please enter your GitHub username';
    errorEl.hidden = false;
    return;
  }

  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(github)) {
    errorEl.textContent = 'Invalid GitHub username format';
    errorEl.hidden = false;
    return;
  }

  errorEl.hidden = true;
  const submitBtn = document.getElementById('pay-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating order...';

  try {
    const res = await fetch(PAY_API + '/order/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: payState.product, githubUsername: github, email: email || undefined }),
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to create order');

    payState.orderCode = data.orderCode;

    const qrUrl = `https://img.vietqr.io/image/${BANK_ID}-${BANK_ACCOUNT}-compact.png`
      + `?amount=${data.amount}&addInfo=${encodeURIComponent(data.orderCode)}`
      + `&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;

    document.getElementById('pay-qr-img').src = qrUrl;
    document.getElementById('pay-detail-amount').textContent = data.amount.toLocaleString('vi-VN') + ' VND';
    document.getElementById('pay-detail-code').textContent = data.orderCode;

    showPayStep(3);
    startPolling(github);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Continue to Payment';
  }
}

function startPolling(github) {
  if (payState.pollTimer) clearInterval(payState.pollTimer);

  payState.pollTimer = setInterval(async () => {
    try {
      const res = await fetch(PAY_API + '/order/' + payState.orderCode);
      const data = await res.json();

      if (data.status === 'delivered') {
        clearInterval(payState.pollTimer);
        payState.pollTimer = null;
        document.getElementById('pay-success-user').textContent = github;
        showPayStep(4);
      } else if (data.status === 'underpaid') {
        document.getElementById('pay-status').innerHTML =
          '<span style="color:var(--loss)">&#9888; Amount too low. Please transfer the exact amount.</span>';
      }
    } catch (_) {
      // silent retry
    }
  }, 5000);
}

// ─── Promo Countdown ───
(function initPromoCountdown() {
  if (!isPromoActive()) return;

  // Add "50% OFF" ribbon to Pro and Business cards
  ['.pricing-pro', '.pricing-biz'].forEach(sel => {
    const card = document.querySelector(sel);
    if (!card) return;
    const ribbon = document.createElement('div');
    ribbon.className = 'promo-ribbon';
    ribbon.textContent = '50% OFF';
    card.appendChild(ribbon);
  });

  // Update pricing cards with promo prices + save badge
  const proCard = document.querySelector('.pricing-pro .pricing-price');
  const bizCard = document.querySelector('.pricing-biz .pricing-price');
  if (proCard) proCard.innerHTML = '<s style="opacity:.35;font-size:.55em">$49</s> $25<span class="pricing-period"> lifetime</span><br><span class="promo-save">Save $24</span>';
  if (bizCard) bizCard.innerHTML = '<s style="opacity:.35;font-size:.55em">$149</s> $75<span class="pricing-period"> lifetime</span><br><span class="promo-save">Save $74</span>';

  // Update "What's Included" values in Business card
  document.querySelectorAll('.includes-value').forEach(el => {
    if (el.textContent.includes('$49')) el.innerHTML = '<s>$49</s> $25 value';
    if (el.textContent.includes('$100')) el.innerHTML = '<s>$100</s> $50 value';
  });

  // Update buttons
  const proBtn = document.querySelector('.pricing-pro .btn-pro');
  const bizBtn = document.querySelector('.pricing-biz .btn-biz');
  if (proBtn) proBtn.innerHTML = 'Get Rune Pro &mdash; <s style="opacity:.6">$49</s>&nbsp;$25';
  if (bizBtn) bizBtn.innerHTML = 'Get Rune Business &mdash; <s style="opacity:.6">$149</s>&nbsp;$75';

  // Update comparison table
  document.querySelectorAll('.table-price').forEach(el => {
    if (el.textContent.includes('$49')) el.innerHTML = '<s style="opacity:.5">$49</s>&nbsp;$25';
    if (el.textContent.includes('$149')) el.innerHTML = '<s style="opacity:.5">$149</s>&nbsp;$75';
  });

  // Create countdown banner (sticky bottom)
  const banner = document.createElement('div');
  banner.id = 'promo-banner';
  banner.style.cssText = `
    position:fixed;bottom:0;left:0;right:0;z-index:9999;
    background:linear-gradient(135deg,#4a6843 0%,#5b7852 50%,#7a9e6e 100%);
    color:#fff;text-align:center;padding:10px 16px;
    font:600 14px/1.4 "Space Grotesk",sans-serif;
    display:flex;align-items:center;justify-content:center;gap:16px;
    box-shadow:0 -4px 20px rgba(91,120,82,.2);
  `.replace(/\n\s+/g, '');
  banner.innerHTML = ''
    + '<span style="font-size:18px">&#9889;</span>'
    + '<span><strong>Launch Week</strong> &mdash; 50% OFF all paid packs</span>'
    + '<span id="promo-timer" style="font-family:JetBrains Mono,monospace;font-weight:700;background:rgba(0,0,0,.2);padding:5px 12px;border-radius:6px;letter-spacing:.5px;min-width:150px"></span>'
    + '<a href="#pricing" style="background:#f5f0e8;color:#4a6843;text-decoration:none;font-weight:700;padding:6px 16px;border-radius:6px;font-size:13px;white-space:nowrap">Grab the deal &rarr;</a>';
  document.body.appendChild(banner);
  document.body.style.paddingBottom = '52px';

  function tick() {
    const diff = PROMO.endsAt - Date.now();
    if (diff <= 0) { banner.remove(); document.body.style.paddingBottom = ''; return; }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const timer = document.getElementById('promo-timer');
    if (timer) timer.textContent = d + 'd ' + h + 'h ' + m + 'm ' + s + 's';
  }
  tick();
  setInterval(tick, 1000);
})();

// ─── Polar Success Return ───
(function checkPolarReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('polar') === 'success') {
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
    // Show success message
    const modal = document.getElementById('pay-modal');
    if (modal) {
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      document.getElementById('pay-success-user').textContent = 'you';
      for (let i = 1; i <= 5; i++) {
        document.getElementById('pay-step-' + i).hidden = (i !== 4);
      }
    }
  }
})();
