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
          const alpha = (1 - dist / maxDist) * 0.35;
          ctx.strokeStyle = `rgba(16, 185, 129, ${alpha})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    // draw nodes
    for (const n of nodes) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.6)';
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
const BANK_ID = 'vpbank';
const BANK_ACCOUNT = '04162263666';
const ACCOUNT_NAME = 'NGUYEN CONG';

const PRODUCT_INFO = {
  'rune-pro': {
    title: 'Get Rune Pro', titleShort: 'Rune Pro',
    priceVN: '1,190,000 VND', priceIntl: '$49 USD',
    amountLabel: '1,190,000 VND (~$49 USD)',
    btnClass: 'btn-pro',
  },
  'rune-biz': {
    title: 'Get Rune Business', titleShort: 'Rune Business',
    priceVN: '3,590,000 VND', priceIntl: '$149 USD',
    amountLabel: '3,590,000 VND (~$149 USD)',
    btnClass: 'btn-biz',
  },
};

let payState = { product: null, orderCode: null, pollTimer: null };

function openPayment(product) {
  const info = PRODUCT_INFO[product];
  if (!info) return;

  payState = { product, orderCode: null, pollTimer: null };

  document.getElementById('pay-title').textContent = info.title;
  document.getElementById('pay-title-2').textContent = info.title;
  document.getElementById('pay-amount-2').textContent = info.amountLabel;
  document.getElementById('pay-price-vn').textContent = info.priceVN;
  document.getElementById('pay-price-intl').textContent = info.priceIntl;
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
  for (let i = 1; i <= 4; i++) {
    document.getElementById('pay-step-' + i).hidden = (i !== n);
  }
}

function showVNPayment() {
  showPayStep(2);
  document.getElementById('pay-github').focus();
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
