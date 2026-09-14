// ── MANAGEMENT > GURU > + MATERI — wizard form (admin/management/guru-paket-form.html) ──
// renderManagementGuruPaketForm() dipanggil oleh renderPage() lewat
// map['management-guru-paket'] = 'renderManagementGuruPaketForm'.
// Mode buat-baru vs edit ditentukan oleh window._guruPaketEditKode (diisi
// openAddGuruPaketGrup()/openEditGuruPaketGrup() di admin/management/guru.js
// atau tombol Edit di guru-paket-detail.js sebelum navigateTo() ke sini).
//
// Step 3 (dulu "Pilih paket", sumbernya Keuangan) sekarang "Pilih materi",
// sumbernya slide dock Management > Materi (_guruMateris, dari MateriAPI —
// lihat _guruEnsureData() di guru.js). ID elemen HTML step 3 masih pakai
// awalan "gpf-paket-*" (id lama, tidak diganti supaya wiring tetap sama),
// tapi datanya sekarang materi.

let _gpfStep = 1;
let _gpfAkunSelected = new Set(), _gpfMateriSelected = new Set();
let _gpfAkunSearch = '', _gpfMateriSearch = '';

async function renderManagementGuruPaketForm() {
    await _guruEnsureData(); // dari guru.js — pakai cache kalau sudah pernah dimuat

    const editKode = window._guruPaketEditKode;
    const editing = !!editKode;
    const existing = editing ? _guruGrupData.find(g => g.kode === editKode) : null;

    document.getElementById('gpf-title').textContent = editing ? 'Edit Grup Guru' : 'Grup Guru Baru';
    document.getElementById('gpf-save-btn').textContent = editing ? 'Simpan Perubahan' : 'Simpan Grup';
    document.getElementById('gpf-nama').value = existing ? (existing.nama || '') : '';
    document.getElementById('gpf-nama-internal').value = existing ? (existing.nama_internal || '') : '';

    _gpfAkunSelected = new Set(existing ? (existing.akun_list || []) : []);
    _gpfMateriSelected = new Set(existing ? (existing.materi_list || []) : []);
    _gpfAkunSearch = ''; _gpfMateriSearch = '';
    document.getElementById('gpf-akun-search-input').value = '';
    document.getElementById('gpf-paket-search-input').value = '';

    _gpfGoStep(1);
}

// Dipanggil dari tombol "Lanjut"/"Kembali" tiap step. Validasi ringan: dari
// step 1 tidak bisa lanjut kalau nama belum diisi (mundur ke step manapun
// selalu boleh, tidak perlu divalidasi).
function _gpfGoStep(step) {
    if (_gpfStep === 1 && step > 1 && !document.getElementById('gpf-nama').value.trim()) {
        showToast('Nama grup wajib diisi', 'danger');
        return;
    }
    _gpfStep = step;
    [1, 2, 3].forEach(n => {
        document.getElementById(`gpf-step-${n}`).style.display = (n === step) ? '' : 'none';
        document.getElementById(`gpf-step-pill-${n}`).style.opacity = (n <= step) ? '1' : '.45';
        document.getElementById(`gpf-step-pill-${n}`).style.background = (n === step) ? 'var(--blue)' : 'rgba(19,50,89,0.08)';
        document.getElementById(`gpf-step-pill-${n}`).style.color = (n === step) ? '#fff' : 'var(--blue)';
    });
    if (step === 2) _gpfRenderAkunList();
    if (step === 3) _gpfRenderMateriList();
}

// ── STEP 2: akun guru/review ──
function _gpfRenderAkunList() {
    const el = document.getElementById('gpf-akun-list');
    document.getElementById('gpf-akun-count').textContent = _gpfAkunSelected.size;
    if (!_guruReviewUsers.length) { el.innerHTML = '<p style="color:var(--text-sub);font-size:12px">Belum ada akun Reviewer. Buat dulu di menu Akun &gt; Reviewer.</p>'; return; }
    const q = (_gpfAkunSearch || '').toLowerCase();
    let data = _guruReviewUsers;
    if (q) data = data.filter(u => (u.nama || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
    el.innerHTML = data.length ? data.map(u => _gpfAkunRowHtml(u)).join('') : '<p style="color:var(--text-sub);font-size:12px">Tidak ada akun yang cocok.</p>';
}
function _gpfAkunRowHtml(u) {
    const ck = _gpfAkunSelected.has(u.kode);
    return `<label class="ebook-pick-item${ck ? ' checked' : ''}" id="gpf-akun-row-${u.kode}">
      <input type="checkbox" ${ck ? 'checked' : ''} onchange="_gpfToggleAkun('${_gEsc(u.kode)}',this.checked)" style="accent-color:var(--blue);width:16px;height:16px;flex-shrink:0">
      <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px;color:var(--blue);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_gEscHtml(u.nama)}</div><div style="font-size:11px;color:var(--text-sub)">${_gEscHtml(u.email || '')}</div></div>
    </label>`;
}
function _gpfToggleAkun(kode, ck) {
    if (ck) _gpfAkunSelected.add(kode); else _gpfAkunSelected.delete(kode);
    document.getElementById('gpf-akun-count').textContent = _gpfAkunSelected.size;
    const row = document.getElementById(`gpf-akun-row-${kode}`); if (row) row.classList.toggle('checked', ck);
}

// ── STEP 3: materi ──
function _gpfRenderMateriList() {
    const el = document.getElementById('gpf-paket-list');
    document.getElementById('gpf-paket-count').textContent = _gpfMateriSelected.size;
    if (!_guruMateris.length) { el.innerHTML = '<p style="color:var(--text-sub);font-size:12px">Belum ada materi. Buat dulu di slide dock Materi.</p>'; return; }
    const q = (_gpfMateriSearch || '').toLowerCase();
    let data = _guruMateris;
    if (q) data = data.filter(m => (m.nama || '').toLowerCase().includes(q));
    el.innerHTML = data.length ? data.map(m => _gpfMateriRowHtml(m)).join('') : '<p style="color:var(--text-sub);font-size:12px">Tidak ada materi yang cocok.</p>';
}
function _gpfMateriRowHtml(m) {
    const ck = _gpfMateriSelected.has(m.kode);
    return `<label class="ebook-pick-item${ck ? ' checked' : ''}" id="gpf-paket-row-${m.kode}">
      <input type="checkbox" ${ck ? 'checked' : ''} onchange="_gpfToggleMateri('${_gEsc(m.kode)}',this.checked)" style="accent-color:var(--blue);width:16px;height:16px;flex-shrink:0">
      <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px;color:var(--blue);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\u{1F4D6} ${_gEscHtml(m.nama)}</div><div style="font-size:11px;color:var(--text-sub)">${m.kode}</div></div>
    </label>`;
}
function _gpfToggleMateri(kode, ck) {
    if (ck) _gpfMateriSelected.add(kode); else _gpfMateriSelected.delete(kode);
    document.getElementById('gpf-paket-count').textContent = _gpfMateriSelected.size;
    const row = document.getElementById(`gpf-paket-row-${kode}`); if (row) row.classList.toggle('checked', ck);
}

// ── SIMPAN ──
async function _gpfSubmit() {
    const nama = document.getElementById('gpf-nama').value.trim();
    if (!nama) { showToast('Nama grup wajib diisi', 'danger'); _gpfGoStep(1); return; }
    const nama_internal = document.getElementById('gpf-nama-internal').value.trim();
    const data = { nama, nama_internal, akun_list: Array.from(_gpfAkunSelected), materi_list: Array.from(_gpfMateriSelected) };

    const btn = document.getElementById('gpf-save-btn');
    btn.disabled = true;
    try {
        const editKode = window._guruPaketEditKode;
        const saved = editKode ? await GuruPaketGrupAPI.update(editKode, data) : await GuruPaketGrupAPI.create(data);
        showToast('Grup berhasil disimpan', 'success');
        await _guruEnsureData(true);
        window._guruPaketDetailKode = saved.kode;
        window._guruPaketEditKode = null;
        navigateTo('management-guru-paket-detail');
    } catch (e) {
        showToast(e.message || 'Gagal menyimpan grup', 'danger');
    } finally { btn.disabled = false; }
}