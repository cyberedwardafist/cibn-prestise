// ── MANAGEMENT > MATERI (admin/management/materi.html) ──
// renderManagementMateri() dipanggil oleh renderPage() di js/app.js lewat
// map['management-materi'] = 'renderManagementMateri'.
//
// Satu "materi" = nama + daftar modul (dari bank modul CAT/SOAL yang sudah
// ada, lewat ModulAPI) dengan urutan tampilnya sendiri. Pola CRUD & UI
// (picker 2 tahap select -> order, drag/panah utk urutkan) copy dari
// "Modul E-Book" (admin/ebook/ebook.js), disederhanakan (tanpa kelompok,
// tanpa poster) — lihat db/schema.sql tabel `materi` (kolom modul_list).
// Modal formnya ada di admin/management/management-modals.html.

let _materiData = [], _modulForMateri = [], _materiModulKelompokList = [];

async function renderManagementMateri() {
    [_materiData, _modulForMateri] = await Promise.all([
        MateriAPI.getAll().catch(() => []),
        ModulAPI.getAll().catch(() => []),
        _loadMateriModulKelompokList()
    ]);
    _renderMateriList();
}
// Kelompok modul (ModulKelompokAPI, sama dgn yg dipakai di Manajemen Modul) —
// dipakai cuma sbg filter di picker modul materi, tidak dipakai/ditampilkan
// di kartu materi itu sendiri (materi tidak punya kelompoknya sendiri).
async function _loadMateriModulKelompokList() { _materiModulKelompokList = await ModulKelompokAPI.getAll().catch(() => []); return _materiModulKelompokList; }
function _materiModulKelompokNama(kode) { if (!kode) return null; const k = _materiModulKelompokList.find(x => x.kode === kode); return k ? k.nama : null; }

function _materiModulIcon(size) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="${size}" height="${size}"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`;
}

// ── LIST (kartu wide + swipe utk mobile) ──
function _materiCardHtml(m, i) {
    const kode = m.kode || m.id;
    const jumlah = (m.modul_list || []).length;
    const namaTampil = m.nama_internal ? `${m.nama} <span style="font-weight:400;color:var(--text-sub)">| ${m.nama_internal}</span>` : m.nama;
    return `<div class="modul-card" style="animation:fadeUp 0.25s ${i * 0.05}s both">
      <div class="modul-card-left">
        <div class="modul-card-icon">${_materiModulIcon(20)}</div>
        <div><div style="font-weight:700;font-size:14px;color:var(--blue)">${namaTampil}</div><div style="font-size:11px;color:var(--text-sub)">${jumlah} modul · ${kode}</div></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-icon" onclick="openEditMateri('${kode}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="btn-icon danger" onclick="deleteMateriItem('${kode}','${(m.nama || '').replace(/'/g, "\\'")}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
      </div>
    </div>`;
}
function _materiSwipeCardHtml(m) {
    const kode = m.kode || m.id;
    const jumlah = (m.modul_list || []).length;
    return SwipeCards.buildSwipeCardHtml({
        title: m.nama_internal ? `${m.nama} | ${m.nama_internal}` : m.nama, kode,
        sub: jumlah + ' modul · ' + kode,
        leftActions: [{ icon: 'edit', label: 'Edit', cls: 'act-edit', onClick: `openEditMateri('${kode}')` }],
        rightActions: [{ icon: 'trash', label: 'Hapus', cls: 'act-danger', onClick: `deleteMateriItem('${kode}','${(m.nama || '').replace(/'/g, "\\'")}')` }]
    });
}
function _renderMateriList() {
    const el = document.getElementById('materi-list'); if (!el) return;
    el.innerHTML = _materiData.length ? _materiData.map(_materiCardHtml).join('') : '<div class="empty-state"><p>Belum ada materi</p></div>';

    const swEl = document.getElementById('materi-swipe-list');
    if (swEl && window.SwipeCards) {
        swEl.innerHTML = _materiData.length ? _materiData.map(_materiSwipeCardHtml).join('') : '<div class="swipe-card-empty">Belum ada materi</div>';
        SwipeCards.bindSwipeList(swEl);
    }
}

// ── PILIH MODUL & URUTAN TAMPIL (2 tahap: pilih -> urutkan, pola sama dgn Modul E-Book) ──
let _materiPickerStep = 'select', _materiPickerSearch = '', _materiPickerKelompokFilter = 'all';
let _materiOrder = [], _materiDragFrom = null;

function _materiResetPickerState(existingKodes = []) {
    _materiOrder = [...existingKodes];
    _materiPickerSearch = ''; _materiPickerKelompokFilter = 'all';
    const si = document.getElementById('materi-picker-search-input'); if (si) si.value = '';
}
function _materiInitPickerUI() {
    _materiPickerStep = 'select';
    const sb = document.getElementById('materi-picker-searchbar'); if (sb) sb.style.display = '';
    const hint = document.getElementById('materi-picker-hint'); if (hint) hint.textContent = 'Cari & pilih modul yang ingin dimasukkan ke materi ini';
    const nb = document.getElementById('materi-next-btn'); if (nb) nb.style.display = '';
    const bb = document.getElementById('materi-back-btn'); if (bb) bb.style.display = 'none';
    const sv = document.getElementById('materi-save-btn'); if (sv) sv.style.display = 'none';
    _renderMateriPickerFilters();
    _renderMateriModulPickerList();
}
// Filter kelompok modul di picker (tahap select saja — ikut disembunyikan
// bareng search bar saat pindah ke tahap order, lihat _materiGoToOrderStep).
function _renderMateriPickerFilters() {
    if (!document.getElementById('materi-picker-filters')) return;
    const validKodes = _materiModulKelompokList.map(k => k.kode);
    if (_materiPickerKelompokFilter !== 'all' && _materiPickerKelompokFilter !== 'none' && !validKodes.includes(_materiPickerKelompokFilter)) _materiPickerKelompokFilter = 'all';
    const options = [{ value: 'all', label: 'Semua Kelompok' }, { value: 'none', label: 'Tanpa Kelompok' }, ..._materiModulKelompokList.map(k => ({ value: k.kode, label: k.nama }))];
    renderFilterDropdown('materi-picker-filters', { title: 'Kelompok Modul', options, current: _materiPickerKelompokFilter, onSelect: v => { _materiPickerKelompokFilter = v; _renderMateriPickerFilters(); _renderMateriModulPickerList(); } });
}
function openAddMateri() {
    document.getElementById('materi-form-mode').value = 'add';
    document.getElementById('materi-form-id').value = '';
    document.getElementById('materi-form-title').textContent = 'Buat Materi';
    document.getElementById('materi-nama-input').value = '';
    document.getElementById('materi-nama-internal-input').value = '';
    _materiResetPickerState([]);
    _materiInitPickerUI();
    openModal('materi-form-overlay');
}
function openEditMateri(kode) {
    const m = _materiData.find(x => (x.kode || x.id) == kode); if (!m) return;
    document.getElementById('materi-form-mode').value = 'edit';
    document.getElementById('materi-form-id').value = kode;
    document.getElementById('materi-form-title').textContent = 'Edit Materi';
    document.getElementById('materi-nama-input').value = m.nama;
    document.getElementById('materi-nama-internal-input').value = m.nama_internal || '';
    _materiResetPickerState(m.modul_list || []);
    _materiInitPickerUI();
    openModal('materi-form-overlay');
}

// -- Tahap 1: daftar modul dgn search (dari seluruh bank modul CAT/SOAL) --
function _renderMateriModulPickerList() {
    const el = document.getElementById('materi-modul-picker'); if (!el) return;
    if (!_modulForMateri.length) { el.innerHTML = '<p style="color:var(--text-sub);font-size:13px">Belum ada modul di bank modul. Buat modul dulu lewat SOAL &gt; Manajemen Modul.</p>'; return; }
    let data = _modulForMateri;
    const q = (_materiPickerSearch || '').toLowerCase();
    if (q) data = data.filter(m => (m.nama || '').toLowerCase().includes(q) || (m.nama_internal || '').toLowerCase().includes(q));
    if (_materiPickerKelompokFilter === 'none') data = data.filter(m => !m.kelompok);
    else if (_materiPickerKelompokFilter !== 'all') data = data.filter(m => m.kelompok === _materiPickerKelompokFilter);
    el.innerHTML = data.length ? data.map(m => _buildMateriModulPickCard(m)).join('') : '<p style="color:var(--text-sub);font-size:13px">Tidak ada modul yang cocok dengan pencarian/filter.</p>';
}
function _buildMateriModulPickCard(m) {
    const kode = m.kode || m.id, ck = _materiOrder.includes(kode), kelNama = _materiModulKelompokNama(m.kelompok);
    const namaTampil = m.nama_internal ? `${m.nama} <span style="font-weight:400;color:var(--text-sub)">| ${m.nama_internal}</span>` : m.nama;
    return `<label style="display:flex;align-items:center;gap:10px;padding:12px;background:rgba(19,50,89,0.03);border-radius:12px;border:1.5px solid ${ck ? 'var(--accent)' : 'rgba(19,50,89,0.08)'};cursor:pointer;transition:border-color 0.2s" id="mtpick-${kode}">
      <input type="checkbox" data-modul-kode="${kode}" ${ck ? 'checked' : ''} onchange="toggleMateriModul('${kode}',this.checked)" style="width:16px;height:16px;accent-color:var(--blue);flex-shrink:0">
      <div class="modul-card-icon" style="flex-shrink:0">${_materiModulIcon(16)}</div>
      <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px;color:var(--blue)">${namaTampil}</div><div style="font-size:11px;color:var(--text-sub);display:flex;gap:6px;flex-wrap:wrap">${(m.soal_list || []).length} soal · ${kode}${kelNama ? ` · <span class="badge" style="background:rgba(19,50,89,0.08);color:var(--blue)">${kelNama}</span>` : ''}</div></div>
    </label>`;
}
function toggleMateriModul(kode, ck) {
    if (ck) { if (!_materiOrder.includes(kode)) _materiOrder.push(kode); }
    else { _materiOrder = _materiOrder.filter(k => k !== kode); }
    const el = document.getElementById(`mtpick-${kode}`); if (el) el.style.borderColor = ck ? 'var(--accent)' : 'rgba(19,50,89,0.08)';
}

// -- Tahap 2: hanya modul terpilih, urutkan dgn drag naik/turun atau tombol panah --
function _materiGoToOrderStep() {
    if (!_materiOrder.length) { showToast('Pilih minimal 1 modul', 'danger'); return; }
    _materiPickerStep = 'order';
    const sb = document.getElementById('materi-picker-searchbar'); if (sb) sb.style.display = 'none';
    const hint = document.getElementById('materi-picker-hint'); if (hint) hint.textContent = 'Seret ke atas/bawah, atau pakai tombol panah untuk atur urutan tampil';
    document.getElementById('materi-next-btn').style.display = 'none';
    document.getElementById('materi-back-btn').style.display = '';
    document.getElementById('materi-save-btn').style.display = '';
    _renderMateriOrderList();
}
function _materiGoToSelectStep() { _materiInitPickerUI(); }
function _renderMateriOrderList() {
    const el = document.getElementById('materi-modul-picker'); if (!el) return;
    if (!_materiOrder.length) { el.innerHTML = '<p style="color:var(--text-sub);font-size:13px">Belum ada modul dipilih. Klik "Kembali" untuk memilih modul.</p>'; return; }
    el.innerHTML = _materiOrder.map((kode, idx) => _buildMateriOrderCard(kode, idx)).join('');
}
function _buildMateriOrderCard(kode, idx) {
    const m = _modulForMateri.find(x => (x.kode || x.id) === kode); if (!m) return '';
    const last = _materiOrder.length - 1;
    const namaTampil = m.nama_internal ? `${m.nama} <span style="font-weight:400;color:var(--text-sub)">| ${m.nama_internal}</span>` : m.nama;
    return `<div class="modul-order-item" draggable="true" ondragstart="_materiDragStart(event,'${kode}')" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="event.preventDefault();this.classList.remove('drag-over');_materiDrop(event,'${kode}')" style="padding:12px;background:rgba(19,50,89,0.03);border-radius:12px;border:1.5px solid var(--accent);margin-bottom:8px" id="mtord-${kode}">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="cursor:grab;color:var(--text-sub);flex-shrink:0" title="Seret untuk urutkan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></span>
        <span style="font-weight:700;font-size:12px;color:var(--accent);width:22px;text-align:center;flex-shrink:0">${idx + 1}</span>
        <div class="modul-card-icon" style="flex-shrink:0">${_materiModulIcon(16)}</div>
        <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px;color:var(--blue)">${namaTampil}</div><div style="font-size:11px;color:var(--text-sub)">${(m.soal_list || []).length} soal</div></div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="btn-icon" title="Naik" ${idx === 0 ? 'disabled style="opacity:.35;cursor:not-allowed"' : ''} onclick="_materiMove('${kode}',-1)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg></button>
          <button class="btn-icon" title="Turun" ${idx === last ? 'disabled style="opacity:.35;cursor:not-allowed"' : ''} onclick="_materiMove('${kode}',1)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg></button>
          <button class="btn-icon danger" title="Batalkan pilihan" onclick="_materiRemoveSelected('${kode}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      </div>
    </div>`;
}
function _materiMove(kode, dir) {
    const idx = _materiOrder.indexOf(kode); if (idx < 0) return;
    const ni = idx + dir; if (ni < 0 || ni >= _materiOrder.length) return;
    [_materiOrder[idx], _materiOrder[ni]] = [_materiOrder[ni], _materiOrder[idx]];
    _renderMateriOrderList();
}
function _materiRemoveSelected(kode) {
    _materiOrder = _materiOrder.filter(k => k !== kode);
    _renderMateriOrderList();
    if (!_materiOrder.length) _materiGoToSelectStep();
}
function _materiDragStart(e, kode) { _materiDragFrom = kode; e.dataTransfer.effectAllowed = 'move'; }
function _materiDrop(e, kode) {
    if (_materiDragFrom === null || _materiDragFrom === kode) { _materiDragFrom = null; return; }
    const fromIdx = _materiOrder.indexOf(_materiDragFrom), toIdx = _materiOrder.indexOf(kode);
    _materiDragFrom = null;
    if (fromIdx < 0 || toIdx < 0) return;
    const moved = _materiOrder.splice(fromIdx, 1)[0];
    _materiOrder.splice(toIdx, 0, moved);
    _renderMateriOrderList();
}

async function submitMateriForm() {
    const mode = document.getElementById('materi-form-mode').value, kode = document.getElementById('materi-form-id').value;
    const nama = document.getElementById('materi-nama-input').value.trim();
    if (!nama) { showToast('Nama materi wajib', 'danger'); return; }
    if (!_materiOrder.length) { showToast('Pilih minimal 1 modul', 'danger'); return; }
    const nama_internal = document.getElementById('materi-nama-internal-input')?.value?.trim() || '';
    const modul_list = [..._materiOrder];
    const payload = { nama, nama_internal, modul_list };

    const saveBtn = document.getElementById('materi-save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Menyimpan...'; }
    try {
        if (mode === 'add') await MateriAPI.create(payload); else await MateriAPI.update(kode, payload);
        clearDirty(); closeModal('materi-form-overlay');
        showToast('Materi disimpan!', 'success');
        await renderManagementMateri();
    } catch (e) { showToast('Gagal: ' + e.message, 'danger'); }
    finally { if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Simpan'; } }
}
function deleteMateriItem(kode, nama) {
    showConfirm('Hapus Materi', `Yakin hapus "${nama}"?`, 'danger', async () => {
        await MateriAPI.delete(kode);
        showToast('Materi dihapus', 'danger');
        await renderManagementMateri();
    });
}
