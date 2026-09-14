// ── MANAGEMENT > GURU > DETAIL GRUP (admin/management/guru-paket-detail.html) ──
// renderManagementGuruPaketDetail() dipanggil oleh renderPage() lewat
// map['management-guru-paket-detail'] = 'renderManagementGuruPaketDetail'.
// window._guruPaketDetailKode diisi kode grup oleh pemanggil (kartu grup di
// guru.js, hasil pencarian, atau tombol Simpan di guru-paket-form.js).

let _gpdSearch = '';
let _gpdCurrentGrup = null;

async function renderManagementGuruPaketDetail() {
    await _guruEnsureData(); // dari guru.js — pakai cache kalau sudah pernah dimuat
    const kode = window._guruPaketDetailKode;
    const grup = _guruGrupData.find(g => g.kode === kode);

    if (!grup) {
        document.getElementById('gpd-title').textContent = 'Grup tidak ditemukan';
        document.getElementById('gpd-subtitle').textContent = 'Grup ini mungkin sudah dihapus.';
        document.getElementById('gpd-paket-badges').innerHTML = '';
        document.getElementById('gpd-guru-list').innerHTML = '';
        document.getElementById('gpd-guru-count').textContent = '0';
        document.getElementById('gpd-edit-btn').style.display = 'none';
        document.getElementById('gpd-delete-btn').style.display = 'none';
        return;
    }
    document.getElementById('gpd-edit-btn').style.display = '';
    document.getElementById('gpd-delete-btn').style.display = '';
    _gpdCurrentGrup = grup;
    _gpdSearch = '';
    document.getElementById('gpd-guru-search-input').value = '';

    document.getElementById('gpd-title').textContent = grup.nama;
    document.getElementById('gpd-subtitle').textContent = grup.nama_internal ? `Nama internal: ${grup.nama_internal} \u00B7 ${grup.kode}` : grup.kode;

    const paketList = grup.paket_list || [];
    document.getElementById('gpd-paket-badges').innerHTML = paketList.length
        ? paketList.map(pk => `<span class="badge" style="background:rgba(19,50,89,0.08);color:var(--blue);font-size:12px">\u{1F4E6} ${_gEscHtml(_guruPaketNama(pk) || pk)}</span>`).join('')
        : '<span style="font-size:12px;color:var(--text-sub)">Belum ditautkan ke paket manapun.</span>';

    _gpdRenderGuruList();
}

function _gpdRenderGuruList() {
    const grup = _gpdCurrentGrup;
    const el = document.getElementById('gpd-guru-list');
    if (!grup) return;
    const akunKodes = grup.akun_list || [];
    let akunRows = akunKodes.map(kode => _guruReviewUsers.find(u => u.kode === kode)).filter(Boolean);

    const q = (_gpdSearch || '').trim().toLowerCase();
    if (q) akunRows = akunRows.filter(u => (u.nama || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));

    document.getElementById('gpd-guru-count').textContent = (grup.akun_list || []).length;

    if (!akunKodes.length) { el.innerHTML = '<p style="color:var(--text-sub);font-size:12px">Belum ada akun guru/review di grup ini.</p>'; return; }
    if (!akunRows.length) { el.innerHTML = '<p style="color:var(--text-sub);font-size:12px">Tidak ada guru/review yang cocok dengan pencarian.</p>'; return; }

    el.innerHTML = akunRows.map(u => `
      <div class="modul-card">
        <div class="modul-card-left">
          <div class="modul-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
          <div><div style="font-weight:700;font-size:13px;color:var(--blue)">${_gEscHtml(u.nama)}</div><div style="font-size:11px;color:var(--text-sub)">${_gEscHtml(u.email || '')}</div></div>
        </div>
      </div>`).join('');
}

function _gpdEdit() {
    if (!_gpdCurrentGrup) return;
    window._guruPaketEditKode = _gpdCurrentGrup.kode;
    navigateTo('management-guru-paket');
}

function _gpdDelete() {
    if (!_gpdCurrentGrup) return;
    const g = _gpdCurrentGrup;
    showConfirm('Hapus Grup', `Hapus grup "${g.nama}"? Guru/review & paketnya tidak ikut terhapus, cuma tautannya saja.`, 'danger', async () => {
        try {
            await GuruPaketGrupAPI.delete(g.kode);
            showToast('Grup berhasil dihapus', 'success');
            await _guruEnsureData(true);
            navigateTo('management-guru');
        } catch (e) { showToast(e.message || 'Gagal menghapus grup', 'danger'); }
    });
}