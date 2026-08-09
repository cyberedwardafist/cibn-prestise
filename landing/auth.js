// landing/auth.js
// Modul LOGIN/REGISTER (termasuk openSignup dari tombol paket) — lazy-load saat salah satu dari openLogin()/openSignup() pertama kali dipanggil.
// Bergantung pada helper global dari shell landing.html yang sudah dimuat lebih dulu.

const API_BASE_LANDING = window.location.origin + '/api';

function openLogin() {
  document.getElementById('loginOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
  const b = document.getElementById('paketBanner');
  if (b) b.remove();
  showLogin();
}
function closeLogin() {
  document.getElementById('loginOverlay').classList.remove('show');
  document.body.style.overflow = '';
}
function showLogin() {
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('loginSubtitle').textContent = 'Masuk ke akun Anda';
  const b = document.getElementById('paketBanner');
  if (b) b.remove();
}
function showRegister() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
  document.getElementById('loginSubtitle').textContent = 'Buat akun baru';
}
function togglePass() {
  const p = document.getElementById('loginPass');
  const btn = document.getElementById('passToggleBtn');
  const showing = p.type === 'password';
  p.type = showing ? 'text' : 'password';
  if (btn) {
    btn.innerHTML = showing
      ? '<svg class="ico" viewBox="0 0 24 24"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.9 10.9 0 0 1 12 4c7 0 11 7 11 7a18.6 18.6 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
      : '<svg class="ico" viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  }
}

// Simpan paket yang dipilih user saat klik tombol paket
let _selectedPaket = null;

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  const err = document.getElementById('loginError');
  if (!email || !pass) { err.style.display='block'; err.textContent='Email dan password tidak boleh kosong.'; return; }
  if (!email.includes('@')) { err.style.display='block'; err.textContent='Format email tidak valid.'; return; }
  err.style.display = 'none';
  const btn = document.querySelector('#loginForm button[onclick="doLogin()"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span>Memproses...</span>'; }
  try {
    const res = await fetch(API_BASE_LANDING + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login gagal');
    // Simpan token & user ke localStorage (sama dengan admin panel)
    localStorage.setItem('cbn_token', data.token);
    localStorage.setItem('cbn_user', JSON.stringify(data.user));
    // Redirect sesuai role
    if (data.user.role === 'admin') window.location.href = 'index_admin.html';
    else if (data.user.role === 'review') window.location.href = 'index_review.html';
    else window.location.href = 'index_user.html';
  } catch(e) {
    err.style.display = 'block';
    err.textContent = e.message || 'Gagal terhubung ke server. Pastikan server aktif.';
    if (btn) { btn.disabled = false; btn.innerHTML = '<span>Masuk</span><svg class="ico" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>'; }
  }
}

async function doRegister() {
  const fn = document.getElementById('regFirstName').value.trim();
  const ln = document.getElementById('regLastName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass = document.getElementById('regPass').value;
  const agree = document.getElementById('regAgree').checked;
  const err = document.getElementById('regError');
  if (!fn || !email || !pass) { err.style.display='block'; err.textContent='Semua field wajib diisi.'; return; }
  if (!email.includes('@')) { err.style.display='block'; err.textContent='Format email tidak valid.'; return; }
  if (pass.length < 8) { err.style.display='block'; err.textContent='Password minimal 8 karakter.'; return; }
  if (!agree) { err.style.display='block'; err.textContent='Anda harus menyetujui Syarat & Ketentuan.'; return; }
  err.style.display = 'none';
  const btn = document.querySelector('#registerForm button[onclick="doRegister()"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span>Memproses...</span>'; }
  try {
    const nama = (fn + ' ' + ln).trim();
    const res = await fetch(API_BASE_LANDING + '/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama, email, password: pass, paket_nama: _selectedPaket || null })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Pendaftaran gagal');
    // Tampilkan pesan sukses di dalam modal
    const modal = document.querySelector('#loginOverlay .exam-modal');
    modal.innerHTML = `
      <div style="text-align:center;padding:2rem 1rem">
        <div style="width:64px;height:64px;border-radius:50%;background:rgba(28,63,115,0.1);display:flex;align-items:center;justify-content:center;margin:0 auto 1.2rem;color:#0d2038">
          <svg class="ico" viewBox="0 0 24 24" style="width:30px;height:30px"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:1.5rem;font-weight:700;color:#0d2038;margin-bottom:.5rem">Pendaftaran Berhasil</div>
        <p style="font-size:.88rem;color:#69768a;font-weight:300;line-height:1.7;margin-bottom:.5rem">
          Akun Anda sedang menunggu konfirmasi dari admin.<br>
          ${_selectedPaket ? `Paket yang dipilih: <strong>${_selectedPaket}</strong><br>` : ''}
          Anda akan dihubungi setelah diaktifkan.
        </p>
        <button onclick="closeLogin()" style="margin-top:1.5rem;background:#1c3f73;color:#fff;border:none;padding:.85rem 2.2rem;border-radius:50px;font-size:.95rem;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif">Tutup</button>
      </div>`;
    _selectedPaket = null;
  } catch(e) {
    err.style.display = 'block';
    err.textContent = e.message || 'Gagal terhubung ke server.';
    if (btn) { btn.disabled = false; btn.innerHTML = '<span>Buat Akun</span><svg class="ico" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>'; }
  }
}

function openSignup(paketName, paketPrice) {
  _selectedPaket = paketName;
  openLogin();
  showRegister();
  const regForm = document.getElementById('registerForm');
  const existing = document.getElementById('paketBanner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.id = 'paketBanner';
  banner.style.cssText = 'background:linear-gradient(135deg,#f3ecda,#eef1e0);border:1.5px solid rgba(28,63,115,0.16);border-radius:12px;padding:.9rem 1.1rem;display:flex;align-items:center;justify-content:space-between;margin-bottom:1.2rem';
  banner.innerHTML = '<div><div style="font-size:.7rem;font-weight:600;color:#1c3f73;letter-spacing:.08em;text-transform:uppercase;margin-bottom:.15rem">Paket Dipilih</div><div style="font-size:.92rem;font-weight:700;color:#0d2038">'+paketName+'</div></div><div style="font-size:.88rem;font-weight:600;color:#1c3f73">'+paketPrice+'</div>';
  regForm.insertBefore(banner, regForm.firstChild);
}

// ── DOC MODAL ──
// Data SK & KP diambil dari server. Fallback jika belum ada.