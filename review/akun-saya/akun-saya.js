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
  _renderMateriSaya();
}

// "Materi Saya" — union SEMUA materi yang ditautkan ke akun ini lewat
// Management > Guru (guru_paket_grup.akun_list memuat kode akun ini), TANPA
// filter paket/user siapa pun (beda dari sisi murid yang materinya difilter
// per-paket lewat GET /api/jadwal-meta di server.js). Satu guru bisa masuk
// >1 grup — materinya digabung dari semua grup yang memuat dia.
async function _renderMateriSaya() {
  const el = document.getElementById('akunsaya-materi-list'); if (!el) return;
  const user = getMe(); if (!user) return;
  el.innerHTML = '<p style="color:var(--text-sub);font-size:12px">Memuat...</p>';
  try {
    const [grupList, materiList] = await Promise.all([
      apiFetch('/guru-paket-grup'),
      apiFetch('/materi')
    ]);
    const materiKode = new Set();
    (grupList || []).forEach(grup => {
      let akunList = [], materiListGrup = [];
      try { akunList = JSON.parse(grup.akun_list || '[]'); } catch (e) {}
      try { materiListGrup = JSON.parse(grup.materi_list || '[]'); } catch (e) {}
      if (akunList.includes(user.kode)) materiListGrup.forEach(mk => materiKode.add(mk));
    });
    const materiNama = (materiList || []).filter(m => materiKode.has(m.kode));
    if (!materiNama.length) { el.innerHTML = '<p style="color:var(--text-sub);font-size:12px">Belum ada materi yang ditautkan ke akun Anda.</p>'; return; }
    el.innerHTML = materiNama.map(m => `
      <div style="padding:10px;background:rgba(19,50,89,0.03);border-radius:10px;border:1.5px solid rgba(19,50,89,0.12)">
        <div style="font-weight:700;font-size:13px;color:var(--blue)">${m.nama_internal ? `${m.nama} | ${m.nama_internal}` : m.nama}</div>
      </div>`).join('');
  } catch (e) {
    el.innerHTML = '<p style="color:var(--text-sub);font-size:12px">Gagal memuat materi.</p>';
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
