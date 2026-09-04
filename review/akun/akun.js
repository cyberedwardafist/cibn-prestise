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
  const swEl = document.getElementById('akun-swipe-list');
  if (!Object.keys(grouped).length) {
    if (wrap) wrap.innerHTML = '<div class="empty-state"><p>Tidak ada user ditemukan</p></div>';
    if (swEl) swEl.innerHTML = '<div class="swipe-card-empty">Tidak ada user ditemukan</div>';
    return;
  }

  const groupIconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>';

  // ── Tampilan tablet/desktop/wide (>768px): kartu per grup, seperti sebelumnya ──
  if (wrap) {
    wrap.innerHTML = Object.entries(grouped).map(([grubKode, groupUsers]) => {
      const grubNama = grubKode === '__none__' ? 'Tanpa Grup' : (_allGrubs.find(g => (g.kode||g.id) === grubKode)?.nama || grubKode);
      const items = groupUsers.map((u, i) => {
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
        ${groupIconSvg}
        ${grubNama} <span class="grub-badge">${groupUsers.length} user</span>
      </div>${items}`;
    }).join('');
  }

  // ── Tampilan hp (≤768px): kartu geser (swipe-to-reveal), pola sama seperti
  //    dipakai admin (js/swipe.js) — kartu bisa langsung ditap buat buka Riwayat. ──
  if (swEl && window.SwipeCards) {
    swEl.innerHTML = Object.entries(grouped).map(([grubKode, groupUsers]) => {
      const grubNama = grubKode === '__none__' ? 'Tanpa Grup' : (_allGrubs.find(g => (g.kode||g.id) === grubKode)?.nama || grubKode);
      const groupLabel = `<div class="grub-header" style="margin:14px 4px 6px">${groupIconSvg} ${grubNama} <span class="grub-badge">${groupUsers.length} user</span></div>`;
      const cards = groupUsers.map(u => SwipeCards.buildSwipeCardHtml({
        title: u.nama, sub: u.email, kode: u.kode || u.id,
        onTapAttr: `onclick="openRiwayatUser('${u.kode||u.id}','${(u.nama||'').replace(/'/g, "\\'")}')"`
      })).join('');
      return groupLabel + cards;
    }).join('');
    SwipeCards.bindSwipeList(swEl);
  }
}

/* ── RIWAYAT USER MODAL ── */
let _currentUserKode = null;