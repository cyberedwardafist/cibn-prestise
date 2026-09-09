// js/glass-common.js
// Dipakai bersama oleh landing.html (landing utama) dan seluruh sub-landing
// (paket.html, materi.html, testimoni.html, tentang.html).
// Tugasnya: ambil data /api/landing sekali, isi navbar + footer yang seragam
// di semua halaman, jalankan reveal-on-scroll, FAQ toggle, dan animasi
// partikel canvas di footer. Konten spesifik tiap section diisi oleh script
// masing-masing halaman lewat callback window.onLandingData(data).

const GlassEsc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function glassApplyNav(D) {
  if (!D) return;
  if (D.pageTitle && !document.body.hasAttribute('data-keep-title')) {
    // Sub-halaman punya judul sendiri; landing utama pakai judul dari data.
  }
  const n = D.nav;
  if (n) {
    document.querySelectorAll('.nav-logo').forEach(el => {
      const alt = `${GlassEsc(n.brand || 'CIBN')} ${GlassEsc(n.subbrand || 'Akademi')}`;
      el.innerHTML = `<img src="logo/logo-full.png" alt="${alt}">`;
    });
    document.querySelectorAll('.nav-cta').forEach(el => { if (n.cta) el.textContent = n.cta; });
    if (n.menus && n.menus.length) {
      const isSub = document.body.getAttribute('data-page') !== 'landing';
      const buildHref = m => {
        if (!m.href) return '#';
        // Di sub-halaman, link anchor (#fitur dst) harus mengarah balik ke landing utama.
        if (isSub && m.href.startsWith('#')) return 'landing.html' + m.href;
        return m.href;
      };
      const renderLinks = (container, tag) => {
        if (!container) return;
        container.innerHTML = n.menus.map(m => `<${tag} href="${GlassEsc(buildHref(m))}">${GlassEsc(m.text)}</${tag}>`).join('');
      };
      renderLinks(document.querySelector('.nav-links'), 'a');
      const mobileMenu = document.getElementById('mobileMenu');
      if (mobileMenu) {
        const closeBtn = mobileMenu.querySelector('.nav-mobile-close');
        mobileMenu.innerHTML = n.menus.map(m => `<a href="${GlassEsc(buildHref(m))}" onclick="closeMobileMenu()">${GlassEsc(m.text)}</a>`).join('') +
          `<button class="btn-primary" onclick="closeMobileMenu();${isSub ? "location.href='landing.html'" : 'openLogin()'}" style="margin-top:1rem">${GlassEsc(n.cta || 'Masuk')}</button>`;
        if (closeBtn) mobileMenu.prepend(closeBtn);
      }
      // Tandai menu yang cocok dengan halaman saat ini sebagai "current"
      const page = document.body.getAttribute('data-subpage');
      if (page) {
        document.querySelectorAll('.nav-links a').forEach(a => {
          if (a.getAttribute('href') === page) a.classList.add('current');
        });
      }
    }
  }
  if (D.footer) {
    const f = D.footer;
    document.querySelectorAll('.footer-brand-name').forEach(el => {
      el.innerHTML = `<span>${GlassEsc(n?.brand || 'CIBN')}</span> ${GlassEsc(n?.subbrand || 'Akademi')}`;
    });
    if (f.brandDesc) document.querySelectorAll('.footer-brand p').forEach(el => el.textContent = f.brandDesc);
    const setContactText = (sel, v) => document.querySelectorAll(sel).forEach(el => {
      const span = el.querySelector('span');
      if (span) span.textContent = v; else el.textContent = v; // ikon SVG di dalamnya tetap utuh, hanya teksnya yang diganti
    });
    if (f.phone) setContactText('.footer-contact .f-phone', f.phone);
    if (f.email) setContactText('.footer-contact .f-email', f.email);
    if (f.address) setContactText('.footer-contact .f-address', f.address);
    document.querySelectorAll('.footer-copy.f-copy').forEach(el => { if (f.copy) el.textContent = f.copy; });
    document.querySelectorAll('.footer-copy.f-reg').forEach(el => { if (f.reg) el.textContent = f.reg; });
    if (f.platform && f.platform.length) {
      document.querySelectorAll('.footer-platform-list').forEach(ul => {
        ul.innerHTML = f.platform.map(l => `<li><a href="${GlassEsc(l.href)}">${GlassEsc(l.text)}</a></li>`).join('');
      });
    }
    if (f.perusahaan && f.perusahaan.length) {
      document.querySelectorAll('.footer-perusahaan-list').forEach(ul => {
        ul.innerHTML = f.perusahaan.map(l => `<li><a href="${GlassEsc(l.href)}">${GlassEsc(l.text)}</a></li>`).join('');
      });
    }
    if (f.social && f.social.length) {
      document.querySelectorAll('.social-links').forEach(sl => {
        sl.innerHTML = f.social.map(s => `<a href="${GlassEsc(s.href)}" class="social-btn" title="${GlassEsc(s.label)}">${GlassEsc(s.short)}</a>`).join('');
      });
    }
    if (f.canvasText) window._customCanvasText = f.canvasText;
  }
}

function initGlassChrome() {
  // Reveal-on-scroll
  const ro = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(r => ro.observe(r));

  // Nav shadow saat scroll
  const nav = document.querySelector('nav.gnav');
  if (nav) window.addEventListener('scroll', () => {
    nav.style.boxShadow = window.scrollY > 20 ? '0 16px 40px rgba(49,46,129,0.18)' : 'var(--glass-shadow)';
  });
}

function toggleMobileMenu() { document.getElementById('mobileMenu')?.classList.add('open'); }
function closeMobileMenu() { document.getElementById('mobileMenu')?.classList.remove('open'); }

function toggleFaq(el) {
  const item = el.parentElement;
  const wasOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
  if (!wasOpen) item.classList.add('open');
}

// ── Loader utama: ambil /api/landing sekali, jalankan callback halaman ──
function loadLandingData() {
  return fetch(window.location.origin + '/api/landing')
    .then(r => r.json())
    .catch(() => ({}))
    .then(D => {
      glassApplyNav(D);
      if (typeof window.onLandingData === 'function') window.onLandingData(D || {});
      initGlassChrome();
      if (typeof window.initCibnCanvas === 'function') window.initCibnCanvas(window._customCanvasText);
      return D;
    });
}

// ── Animasi partikel teks interaktif di atas footer (identik di semua halaman) ──
window.initCibnCanvas = function (customText) {
  const canvas = document.getElementById('cibn-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [], mouse = { x: -999, y: -999 };
  const TEXT = customText || document.querySelector('.nav-logo')?.textContent?.trim() || 'CIBN Akademi';
  const DENSITY = 4;
  if (window._cibnAnimFrame) cancelAnimationFrame(window._cibnAnimFrame);

  function resize() { W = canvas.offsetWidth; H = canvas.height; canvas.width = W; init(); }
  function getPixels() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const cx = c.getContext('2d');
    cx.fillStyle = '#fff';
    cx.font = 'bold ' + Math.min(H * .55, W * .12) + 'px Cormorant Garamond, serif';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText(TEXT, W / 2, H / 2);
    const data = cx.getImageData(0, 0, W, H).data;
    const pts = [];
    for (let y = 0; y < H; y += DENSITY)
      for (let x = 0; x < W; x += DENSITY) {
        const idx = (y * W + x) * 4;
        if (data[idx + 3] > 128) pts.push({ ox: x, oy: y });
      }
    return pts;
  }
  function init() {
    const pts = getPixels();
    particles = pts.map(p => ({ x: Math.random() * W, y: Math.random() * H, ox: p.ox, oy: p.oy, vx: 0, vy: 0, size: Math.random() * 1.2 + 0.6, opacity: Math.random() * .4 + .6 }));
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const r = 80, repel = 120, spring = .06, friction = .82, maxV = 8;
    particles.forEach(p => {
      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < r && dist > 0) {
        const force = (r - dist) / r;
        p.vx += (dx / dist) * force * repel * .1;
        p.vy += (dy / dist) * force * repel * .1;
      }
      p.vx += (p.ox - p.x) * spring; p.vy += (p.oy - p.y) * spring;
      p.vx *= friction; p.vy *= friction;
      const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (spd > maxV) { p.vx = p.vx / spd * maxV; p.vy = p.vy / spd * maxV; }
      p.x += p.vx; p.y += p.vy;
      const dh = Math.sqrt((p.x - p.ox) ** 2 + (p.y - p.oy) ** 2);
      const t = Math.min(1, dh / 40);
      const r1 = Math.round(129 + (79 - 129) * t), g1 = Math.round(140 + (70 - 140) * t), b1 = Math.round(248 + (229 - 248) * t);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r1},${g1},${b1},${p.opacity})`; ctx.fill();
    });
    window._cibnAnimFrame = requestAnimationFrame(draw);
  }
  canvas.addEventListener('mousemove', e => { const rect = canvas.getBoundingClientRect(); mouse.x = e.clientX - rect.left; mouse.y = e.clientY - rect.top; });
  canvas.addEventListener('mouseleave', () => { mouse.x = -999; mouse.y = -999; });
  canvas.addEventListener('touchmove', e => { e.preventDefault(); const rect = canvas.getBoundingClientRect(); mouse.x = e.touches[0].clientX - rect.left; mouse.y = e.touches[0].clientY - rect.top; }, { passive: false });
  canvas.addEventListener('touchend', () => { mouse.x = -999; mouse.y = -999; });
  window.addEventListener('resize', resize);
  resize(); draw();
};
