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
  p.type = p.type === 'password' ? 'text' : 'password';
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
  if (btn) { btn.disabled = true; btn.textContent = 'Memproses...'; }
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
    if (btn) { btn.disabled = false; btn.textContent = 'Masuk →'; }
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
  if (btn) { btn.disabled = true; btn.textContent = 'Memproses...'; }
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
        <div style="font-size:3.5rem;margin-bottom:1rem">✅</div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:1.5rem;font-weight:700;color:#0f2d8a;margin-bottom:.5rem">Pendaftaran Berhasil!</div>
        <p style="font-size:.88rem;color:#64748b;font-weight:300;line-height:1.7;margin-bottom:.5rem">
          Akun Anda sedang menunggu konfirmasi dari admin.<br>
          ${_selectedPaket ? `Paket yang dipilih: <strong>${_selectedPaket}</strong><br>` : ''}
          Anda akan dihubungi setelah diaktifkan.
        </p>
        <button onclick="closeLogin()" style="margin-top:1.5rem;background:linear-gradient(135deg,#1a4fd6,#0f2d8a);color:#fff;border:none;padding:.85rem 2.2rem;border-radius:50px;font-size:.95rem;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif">Tutup</button>
      </div>`;
    _selectedPaket = null;
  } catch(e) {
    err.style.display = 'block';
    err.textContent = e.message || 'Gagal terhubung ke server.';
    if (btn) { btn.disabled = false; btn.textContent = 'Buat Akun →'; }
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
  banner.style.cssText = 'background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1.5px solid rgba(26,79,214,0.2);border-radius:12px;padding:.9rem 1.1rem;display:flex;align-items:center;justify-content:space-between;margin-bottom:1.2rem';
  banner.innerHTML = '<div><div style="font-size:.7rem;font-weight:600;color:#1a4fd6;letter-spacing:.08em;text-transform:uppercase;margin-bottom:.15rem">Paket Dipilih</div><div style="font-size:.92rem;font-weight:700;color:#0f2d8a">'+paketName+'</div></div><div style="font-size:.88rem;font-weight:600;color:#1a4fd6">'+paketPrice+'</div>';
  regForm.insertBefore(banner, regForm.firstChild);
}

// ── DOC MODAL ──
// Data SK & KP diambil dari server. Fallback jika belum ada.