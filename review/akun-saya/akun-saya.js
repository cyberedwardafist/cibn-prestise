// review/akun-saya.js
// Modul AKUN SAYA (profil reviewer sendiri) — lazy-load saat tab Akun Saya dibuka.
// Bergantung pada helper global dari shell index_review.html (showToast, openModal,
// navigateTo, apiFetch, formatDate, dst) yang sudah dimuat lebih dulu.

function renderAkunSaya() {
  const user = getMe();
  if (user) {
    document.getElementById('profile-nama').value = user.nama || '';
    document.getElementById('profile-email').value = user.email || '';
    document.getElementById('profile-avatar').textContent = (user.nama || 'R').charAt(0).toUpperCase();
  }
}

async function simpanProfil() {
  const nama = document.getElementById('profile-nama').value.trim();
  const pw = document.getElementById('profile-pw').value;
  if (!nama) { showToast('Nama wajib diisi', 'danger'); return; }
  try {
    const body = { nama };
    if (pw) body.password = pw;
    await fetch(API_BASE + '/me', { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(body) });
    const user = getMe();
    if (user) { user.nama = nama; localStorage.setItem('cbn_user', JSON.stringify(user)); }
    showToast('Profil diperbarui!', 'success');
    document.getElementById('profile-pw').value = '';
  } catch(e) { showToast('Gagal menyimpan', 'danger'); }
}
