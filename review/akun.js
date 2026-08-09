// review/akun.js
// Modul AKUN (kelola daftar reviewer/akun) — lazy-load saat tab Akun dibuka.
// Bergantung pada helper global dari shell index_review.html (showToast, openModal,
// navigateTo, apiFetch, formatDate, dst) yang sudah dimuat lebih dulu.

async function renderAkun() {
  try {
    [_allUsers, _allGrubs] = await Promise.all([
      apiFetch('/review/users').catch(() => []),
      apiFetch('/grubs').catch(() => [])
    ]);
    const sel = document.getElementById('akun-grub-filter');
    sel.innerHTML = '<option value="">Semua Grup</option>' + _allGrubs.map(g => `<option value="${g.kode||g.id}">${g.nama}</option>`).join('');
    renderAkunList();
  } catch (e) { console.warn(e); }
}

function filterAkun(val) {
  if (val !== undefined) _akunSearch = val;
  _akunGrub = document.getElementById('akun-grub-filter')?.value || '';
  renderAkunList();
}

function renderAkunList() {
  let users = _allUsers;
  if (_akunSearch) {
    const q = _akunSearch.toLowerCase();
    users = users.filter(u => u.nama?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }
  if (_akunGrub) users = users.filter(u => u.grub === _akunGrub);

  // Group by grub
  const grouped = {};
  users.forEach(u => {
    const grubKode = u.grub || '__none__';
    if (!grouped[grubKode]) grouped[grubKode] = [];
    grouped[grubKode].push(u);
  });

  const wrap = document.getElementById('akun-list-wrap');
  if (!Object.keys(grouped).length) {
    wrap.innerHTML = '<div class="empty-state"><p>Tidak ada user ditemukan</p></div>';
    return;
  }

  wrap.innerHTML = Object.entries(grouped).map(([grubKode, users]) => {
    const grubNama = grubKode === '__none__' ? 'Tanpa Grup' : (_allGrubs.find(g => (g.kode||g.id) === grubKode)?.nama || grubKode);
    const items = users.map((u, i) => {
      const initials = (u.nama || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      return `<div class="review-user-card" style="animation:fadeUp 0.2s ${i*0.03}s both">
        <div class="user-avatar">${initials}</div>
        <div class="user-info">
          <div class="user-name">${u.nama}</div>
          <div class="user-email">${u.email}</div>
        </div>
        <div class="user-actions">
          <button class="btn btn-secondary btn-sm" onclick="openRiwayatUser('${u.kode||u.id}','${u.nama}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span class="hide-mobile">Riwayat</span>
          </button>
        </div>
      </div>`;
    }).join('');

    return `<div class="grub-header">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      ${grubNama} <span class="grub-badge">${users.length} user</span>
    </div>${items}`;
  }).join('');
}

/* ── RIWAYAT USER MODAL ── */
let _currentUserKode = null;