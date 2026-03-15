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
