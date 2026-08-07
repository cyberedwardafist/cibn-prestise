/* =============================================
   EBOOK.JS - Grup dock "E-BOOK": Buat Buku, Library, Modul (paket buku)
   ============================================= */

// ── STATE: form Buat/Edit Buku ──
const EbookFormState = {
    mode: 'add', kode: null,
    nama: '', kelompok: '',   // kelompok = kode referensi ke ebook_kelompok ('' = tanpa kelompok)
    posterFile: null, posterPreviewUrl: null,           // File baru (jika diganti) & url utk preview (data: atau /uploads/...)
    pdfFile: null, pdfExistingUrl: null, pdfExistingName: null, pdfExistingHalaman: 0
};

// Daftar kelompok e-book yg sudah pernah di-fetch (dipakai bareng oleh form Buat Buku & Library)
let _ebookKelompokList = [];
async function _loadEbookKelompokList() {
    _ebookKelompokList = await EbookKelompokAPI.getAll().catch(() => []);
    return _ebookKelompokList;
}
function _ebookKelompokNama(kode) {
    if (!kode) return null;
    const k = _ebookKelompokList.find(x => x.kode === kode);
    return k ? k.nama : null;
}

// Dipakai saat klik "Edit" dari Library: simpan kode yg mau diedit lalu navigateTo('buku')
// (renderBuku() akan cek variabel ini & mengisi form, bukan mereset ke kosong).
let _ebookPendingEditKode = null;

function openEditBuku(kode) {
    _ebookPendingEditKode = kode;
    navigateTo('buku');
}

async function renderBuku() {
    if (_ebookPendingEditKode) {
        const kode = _ebookPendingEditKode; _ebookPendingEditKode = null;
        const list = await EbookAPI.getAll().catch(() => []);
        const b = list.find(x => x.kode === kode);
        if (b) {
            EbookFormState.mode = 'edit'; EbookFormState.kode = kode;
            EbookFormState.nama = b.nama; EbookFormState.kelompok = b.kelompok || '';
            EbookFormState.posterFile = null; EbookFormState.posterPreviewUrl = b.poster || null;
            EbookFormState.pdfFile = null; EbookFormState.pdfExistingUrl = b.file_pdf || null;
            EbookFormState.pdfExistingName = b.file_nama_asli || null; EbookFormState.pdfExistingHalaman = b.jumlah_halaman || 0;
            _renderBukuForm();
            return;
        }
        showToast('Buku tidak ditemukan', 'danger');
    }
    EbookFormState.mode = 'add'; EbookFormState.kode = null;
    EbookFormState.nama = ''; EbookFormState.kelompok = '';
    EbookFormState.posterFile = null; EbookFormState.posterPreviewUrl = null;
    EbookFormState.pdfFile = null; EbookFormState.pdfExistingUrl = null;
    EbookFormState.pdfExistingName = null; EbookFormState.pdfExistingHalaman = 0;
    _renderBukuForm();
}

function _bookIconSvg(w = 28) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="${w}" height="${w}"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;
}
function _pdfIconSvg(w = 22) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="${w}" height="${w}"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
}
function _ebookFmtBytes(n) {
    if (!n) return '';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

function _renderBukuForm() {
    const c = document.getElementById('buku-page-content'); if (!c) return;
    const isEdit = EbookFormState.mode === 'edit';
    const posterHtml = EbookFormState.posterPreviewUrl
        ? `<img src="${EbookFormState.posterPreviewUrl}" alt="poster">`
        : _bookIconSvg(34);
    const pdfName = EbookFormState.pdfFile ? EbookFormState.pdfFile.name : EbookFormState.pdfExistingName;
    const pdfSize = EbookFormState.pdfFile ? EbookFormState.pdfFile.size : null;
    const pdfHasFile = !!(EbookFormState.pdfFile || EbookFormState.pdfExistingUrl);
    const pdfMeta = pdfSize ? _ebookFmtBytes(pdfSize)
        : (EbookFormState.pdfExistingHalaman ? EbookFormState.pdfExistingHalaman + ' lembar' : 'Klik untuk ganti file');
    const pdfBoxContent = pdfHasFile
        ? `<div style="display:flex;align-items:center;gap:10px;justify-content:center;color:var(--blue)">${_pdfIconSvg()}<div style="text-align:left;min-width:0"><div style="font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:280px">${pdfName || 'file.pdf'}</div><div style="font-size:11px;color:var(--text-sub)">${pdfMeta}</div></div></div>`
        : `<div style="color:var(--text-sub)">${_pdfIconSvg()}<div style="font-size:12.5px;margin-top:6px">Klik untuk upload file PDF</div></div>`;

    c.innerHTML = `
<div class="section-title">${isEdit ? 'Edit Buku' : 'Buat Buku'}</div>
<div class="section-sub">${isEdit ? 'Perbarui detail buku ini' : 'Upload buku baru (PDF) ke library e-book'}</div>
<div class="card" style="max-width:520px;margin:0 auto">
  <div class="ebook-poster-preview" id="ebook-poster-preview" onclick="document.getElementById('ebook-poster-input').click()" style="cursor:pointer">${posterHtml}</div>
  <div style="text-align:center;margin-bottom:16px">
    <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('ebook-poster-input').click()">🖼️ ${EbookFormState.posterPreviewUrl ? 'Ganti Poster' : 'Upload Poster'}</button>
    <input type="file" id="ebook-poster-input" accept="image/*" style="display:none" onchange="onEbookPosterSelected(this)">
  </div>
  <div class="form-group"><label class="form-label">Nama Buku</label><input id="ebook-nama-input" class="form-input" type="text" placeholder="Nama buku" value="${(EbookFormState.nama || '').replace(/"/g, '&quot;')}" oninput="EbookFormState.nama=this.value;setDirty('buat buku')"></div>
  <div class="form-group">
    <label class="form-label">Kelompok <span style="font-weight:400;color:var(--text-sub)">(opsional)</span></label>
    <select id="ebook-kelompok-select" class="form-input" onchange="EbookFormState.kelompok=this.value;setDirty('buat buku')"><option value="">-- Tanpa Kelompok --</option></select>
  </div>
  <div class="form-group">
    <label class="form-label">File PDF</label>
    <div class="ebook-upload-box${pdfHasFile ? ' has-file' : ''}" id="ebook-pdf-box" onclick="document.getElementById('ebook-pdf-input').click()">${pdfBoxContent}</div>
    <input type="file" id="ebook-pdf-input" accept="application/pdf" style="display:none" onchange="onEbookPdfSelected(this)">
    <div style="font-size:11px;color:var(--text-sub);margin-top:6px">Jumlah lembar dihitung otomatis oleh sistem setelah disimpan.</div>
  </div>
  <div style="display:flex;gap:10px;margin-top:6px">
    ${isEdit ? `<button class="btn btn-secondary" style="flex:1" onclick="navigateTo('ebook-library')">Batal</button>` : ''}
    <button class="btn btn-primary" style="flex:2" onclick="submitBukuForm()">${isEdit ? 'Simpan Perubahan' : 'Simpan Buku'}</button>
  </div>
</div>`;
    _populateEbookKelompokSelect();
}

function onEbookPosterSelected(input) {
    const file = input.files[0]; if (!file) return;
    EbookFormState.posterFile = file;
    const reader = new FileReader();
    reader.onload = e => { EbookFormState.posterPreviewUrl = e.target.result; _renderBukuForm(); setDirty('buat buku'); };
    reader.readAsDataURL(file);
}
function onEbookPdfSelected(input) {
    const file = input.files[0]; if (!file) return;
    if (file.type !== 'application/pdf') { showToast('File harus berformat PDF', 'danger'); input.value = ''; return; }
    EbookFormState.pdfFile = file;
    setDirty('buat buku');
    _renderBukuForm();
}

async function _populateEbookKelompokSelect() {
    const sel = document.getElementById('ebook-kelompok-select'); if (!sel) return;
    await _loadEbookKelompokList();
    sel.innerHTML = '<option value="">-- Tanpa Kelompok --</option>' +
        _ebookKelompokList.map(k => `<option value="${k.kode}">${k.nama}</option>`).join('');
    sel.value = EbookFormState.kelompok || '';
}

async function submitBukuForm() {
    const nama = (document.getElementById('ebook-nama-input')?.value || '').trim();
    const kelompok = document.getElementById('ebook-kelompok-select')?.value || '';
    if (!nama) { showToast('Nama buku wajib diisi', 'danger'); return; }
    if (EbookFormState.mode === 'add' && !EbookFormState.pdfFile) { showToast('File PDF wajib diupload', 'danger'); return; }

    const fd = new FormData();
    fd.append('nama', nama);
    fd.append('kelompok', kelompok);
    if (EbookFormState.posterFile) fd.append('poster', EbookFormState.posterFile);
    if (EbookFormState.pdfFile) fd.append('pdf', EbookFormState.pdfFile);

    const btn = document.querySelector('#buku-page-content .btn-primary');
    const isEdit = EbookFormState.mode === 'edit';
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
    try {
        const result = isEdit ? await EbookAPI.update(EbookFormState.kode, fd) : await EbookAPI.create(fd);
        if (!result) { showToast('Gagal terhubung ke server. Fitur e-book butuh koneksi aktif.', 'danger'); return; }
        clearDirty();
        showToast(isEdit ? 'Buku berhasil diperbarui!' : 'Buku berhasil disimpan!', 'success');
        if (isEdit) navigateTo('ebook-library'); else renderBuku();
    } catch (e) {
        showToast('Gagal: ' + e.message, 'danger');
    }
    if (btn) { btn.disabled = false; btn.textContent = isEdit ? 'Simpan Perubahan' : 'Simpan Buku'; }
}

function deleteBukuItem(kode, nama) {
    showConfirm('Hapus Buku', `Yakin hapus "${nama}"? Buku ini juga akan dilepas dari modul yang memuatnya.`, 'danger', async () => {
        await EbookAPI.delete(kode);
        showToast('Buku dihapus', 'danger');
        await renderEbookLibrary();
    });
}

// ── LIBRARY E-BOOK ──
let _ebookLibData = [];
let _ebookSearch = '';
let _ebookKelompokFilter = 'all';

async function renderEbookLibrary() {
    const [libData] = await Promise.all([EbookAPI.getAll().catch(() => []), _loadEbookKelompokList()]);
    _ebookLibData = libData;
    _renderEbookKelompokFilters();
    _renderEbookLibList();
}

function _renderEbookKelompokFilters() {
    if (!document.getElementById('ebook-kelompok-filters')) return;
    const validKodes = _ebookKelompokList.map(k => k.kode);
    if (_ebookKelompokFilter !== 'all' && _ebookKelompokFilter !== 'none' && !validKodes.includes(_ebookKelompokFilter)) _ebookKelompokFilter = 'all';
    const options = [{ value: 'all', label: 'Semua Kelompok' }, { value: 'none', label: 'Tanpa Kelompok' }, ..._ebookKelompokList.map(k => ({ value: k.kode, label: k.nama }))];
    renderFilterDropdown('ebook-kelompok-filters', { options, current: _ebookKelompokFilter, title: 'Kelompok', onSelect: v => { _ebookKelompokFilter = v; _renderEbookKelompokFilters(); _renderEbookLibList(); } });
}

function _renderEbookLibList() {
    const el = document.getElementById('ebook-library-list'); if (!el) return;
    let data = _ebookLibData;
    if (_ebookKelompokFilter === 'none') data = data.filter(b => !b.kelompok);
    else if (_ebookKelompokFilter !== 'all') data = data.filter(b => b.kelompok === _ebookKelompokFilter);
    // search juga mencocokkan nama kelompok, bukan cuma kode mentahnya
    const dataWithKelompokNama = data.map(b => ({ ...b, _kelompokNama: _ebookKelompokNama(b.kelompok) || '' }));
    data = filterList(dataWithKelompokNama, _ebookSearch, ['nama', '_kelompokNama']);
    if (!data.length) {
        el.innerHTML = '<div class="empty-state"><p>Belum ada buku</p></div>';
        const swEl0 = document.getElementById('ebook-library-swipe-list');
        if (swEl0) swEl0.innerHTML = '<div class="swipe-card-empty">Belum ada buku</div>';
        return;
    }
    el.innerHTML = `<div class="ebook-grid">${data.map((b, i) => `
      <div class="ebook-card" style="animation:fadeUp 0.25s ${Math.min(i * 0.03, 0.3)}s both">
        <div class="ebook-poster">${b.poster ? `<img src="${b.poster}" alt="${b.nama}">` : _bookIconSvg(30)}</div>
        <div class="ebook-card-body">
          <div class="ebook-card-nama">${b.nama}</div>
          ${b._kelompokNama ? `<div class="ebook-card-kelompok">${b._kelompokNama}</div>` : ''}
          <div class="ebook-card-meta">${_pdfIconSvg(13)} ${b.jumlah_halaman ? b.jumlah_halaman + ' lembar' : 'PDF'}</div>
        </div>
        <div class="ebook-card-actions">
          <button class="btn-icon" title="Edit" onclick="openEditBuku('${b.kode}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn-icon danger" title="Hapus" onclick="deleteBukuItem('${b.kode}','${(b.nama || '').replace(/'/g, "\\'")}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
        </div>
      </div>`).join('')}</div>`;

    const swEl = document.getElementById('ebook-library-swipe-list');
    if (swEl && window.SwipeCards) {
        swEl.innerHTML = data.map(b => SwipeCards.buildSwipeCardHtml({
            title: b.nama,
            sub: (b._kelompokNama || 'Tanpa Kelompok') + ' · ' + (b.jumlah_halaman ? b.jumlah_halaman + ' lembar' : 'PDF'),
            sideHtml: b.poster ? `<div style="width:30px;height:40px;border-radius:5px;overflow:hidden;flex-shrink:0"><img src="${b.poster}" style="width:100%;height:100%;object-fit:cover"></div>` : '',
            leftActions: [{ icon: 'edit', label: 'Edit', cls: 'act-edit', onClick: `openEditBuku('${b.kode}')` }],
            rightActions: [{ icon: 'trash', label: 'Hapus', cls: 'act-danger', onClick: `deleteBukuItem('${b.kode}','${(b.nama || '').replace(/'/g, "\\'")}')` }]
        })).join('');
        SwipeCards.bindSwipeList(swEl);
    }
}

// ── MODUL E-BOOK (paket buku — "modul" di grup E-BOOK, beda dari Manajemen Modul ujian) ──
let _ebookModulData = [], _ebookForModul = [], _ebookModulKelompokList = [], _ebookModulKelompokFilter = 'all';
function _ebookModulKelompokNama(kode) { if (!kode) return null; const k = _ebookModulKelompokList.find(x => x.kode === kode); return k ? k.nama : null; }
async function _loadEbookModulKelompokList() { _ebookModulKelompokList = await EbookModulKelompokAPI.getAll().catch(() => []); return _ebookModulKelompokList; }

async function renderEbookModul() {
    [_ebookModulData, _ebookForModul] = await Promise.all([
        EbookModulAPI.getAll().catch(() => []),
        EbookAPI.getAll().catch(() => []),
        _loadEbookKelompokList(),
        _loadEbookModulKelompokList()
    ]);
    _renderEbookModulKelompokFilters();
    _renderEbookModulList();
}
function _renderEbookModulKelompokFilters() {
    if (!document.getElementById('ebook-modul-kelompok-filters')) return;
    const validKodes = _ebookModulKelompokList.map(k => k.kode);
    if (_ebookModulKelompokFilter !== 'all' && _ebookModulKelompokFilter !== 'none' && !validKodes.includes(_ebookModulKelompokFilter)) _ebookModulKelompokFilter = 'all';
    const options = [{ value: 'all', label: 'Semua Kelompok' }, { value: 'none', label: 'Tanpa Kelompok' }, ..._ebookModulKelompokList.map(k => ({ value: k.kode, label: k.nama }))];
    renderFilterDropdown('ebook-modul-kelompok-filters', { options, current: _ebookModulKelompokFilter, title: 'Kelompok', onSelect: v => { _ebookModulKelompokFilter = v; _renderEbookModulKelompokFilters(); _renderEbookModulList(); } });
}
function _renderEbookModulList() {
    let data = _ebookModulData;
    if (_ebookModulKelompokFilter === 'none') data = data.filter(m => !m.kelompok);
    else if (_ebookModulKelompokFilter !== 'all') data = data.filter(m => m.kelompok === _ebookModulKelompokFilter);
    const el = document.getElementById('ebook-modul-list'); if (!el) return;
    el.innerHTML = data.length ? data.map((m, i) => {
        const books = (m.ebook_list || []).map(k => _ebookForModul.find(b => b.kode === k)).filter(Boolean);
        const stack = books.slice(0, 4).map(b => `<div class="stk">${b.poster ? `<img src="${b.poster}">` : _bookIconSvg(14)}</div>`).join('');
        const kelNama = _ebookModulKelompokNama(m.kelompok);
        return `<div class="ebook-modul-card" style="animation:fadeUp 0.25s ${i * 0.05}s both">
          <div class="modul-card-left">
            <div class="ebook-modul-poster-stack">${stack || `<div class="stk">${_bookIconSvg(14)}</div>`}</div>
            <div><div style="font-weight:700;font-size:14px;color:var(--blue)">${m.nama}</div><div style="font-size:11px;color:var(--text-sub);display:flex;gap:6px;flex-wrap:wrap;align-items:center">${books.length} buku · ${m.kode}${kelNama ? ` · <span class="badge" style="background:rgba(19,50,89,0.08);color:var(--blue)">${kelNama}</span>` : ''}</div></div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn-icon" onclick="openEditEbookModul('${m.kode}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            <button class="btn-icon danger" onclick="deleteEbookModulItem('${m.kode}','${(m.nama || '').replace(/'/g, "\\'")}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
          </div>
        </div>`;
    }).join('') : '<div class="empty-state"><p>Belum ada modul e-book</p></div>';

    const swEl = document.getElementById('ebook-modul-swipe-list');
    if (swEl && window.SwipeCards) {
        swEl.innerHTML = data.length ? data.map(m => {
            const books = (m.ebook_list || []).map(k => _ebookForModul.find(b => b.kode === k)).filter(Boolean);
            return SwipeCards.buildSwipeCardHtml({
                title: m.nama,
                sub: books.length + ' buku' + (_ebookModulKelompokNama(m.kelompok) ? ' · ' + _ebookModulKelompokNama(m.kelompok) : '') + ' · ' + m.kode,
                leftActions: [{ icon: 'edit', label: 'Edit', cls: 'act-edit', onClick: `openEditEbookModul('${m.kode}')` }],
                rightActions: [{ icon: 'trash', label: 'Hapus', cls: 'act-danger', onClick: `deleteEbookModulItem('${m.kode}','${(m.nama || '').replace(/'/g, "\\'")}')` }]
            });
        }).join('') : '<div class="swipe-card-empty">Belum ada modul e-book</div>';
        SwipeCards.bindSwipeList(swEl);
    }
}
function _populateEbookModulKelompokSelect(selected) {
    const sel = document.getElementById('ebook-modul-kelompok-select'); if (!sel) return;
    sel.innerHTML = '<option value="">-- Tanpa Kelompok --</option>' + _ebookModulKelompokList.map(k => `<option value="${k.kode}">${k.nama}</option>`).join('');
    sel.value = selected || '';
}

function openAddEbookModul() {
    document.getElementById('ebook-modul-form-mode').value = 'add';
    document.getElementById('ebook-modul-form-id').value = '';
    document.getElementById('ebook-modul-form-title').textContent = 'Buat Modul E-Book';
    document.getElementById('ebook-modul-nama-input').value = '';
    _populateEbookModulKelompokSelect('');
    document.getElementById('ebook-modul-picker').innerHTML = _buildEbookPicker([]);
    openModal('ebook-modul-form-overlay');
}
function openEditEbookModul(kode) {
    const m = _ebookModulData.find(x => x.kode === kode); if (!m) return;
    document.getElementById('ebook-modul-form-mode').value = 'edit';
    document.getElementById('ebook-modul-form-id').value = kode;
    document.getElementById('ebook-modul-form-title').textContent = 'Edit Modul E-Book';
    document.getElementById('ebook-modul-nama-input').value = m.nama;
    _populateEbookModulKelompokSelect(m.kelompok || '');
    document.getElementById('ebook-modul-picker').innerHTML = _buildEbookPicker(m.ebook_list || []);
    openModal('ebook-modul-form-overlay');
}
function _buildEbookPicker(existingKodes) {
    if (!_ebookForModul.length) return '<p style="color:var(--text-sub);font-size:13px">Belum ada buku di library.</p>';
    return _ebookForModul.map(b => {
        const ck = existingKodes.includes(b.kode);
        return `<label class="ebook-pick-item${ck ? ' checked' : ''}" id="ebpick-${b.kode}">
          <input type="checkbox" data-ebook-kode="${b.kode}" ${ck ? 'checked' : ''} onchange="toggleEbookPick('${b.kode}',this.checked)" style="accent-color:var(--blue);width:16px;height:16px;flex-shrink:0">
          <div class="ebook-pick-thumb">${b.poster ? `<img src="${b.poster}">` : _bookIconSvg(16)}</div>
          <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px;color:var(--blue);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${b.nama}</div><div style="font-size:11px;color:var(--text-sub)">${_ebookKelompokNama(b.kelompok) || 'Tanpa Kelompok'} · ${b.jumlah_halaman ? b.jumlah_halaman + ' lembar' : 'PDF'}</div></div>
        </label>`;
    }).join('');
}
function toggleEbookPick(kode, ck) {
    const el = document.getElementById(`ebpick-${kode}`); if (el) el.classList.toggle('checked', ck);
}
async function submitEbookModulForm() {
    const mode = document.getElementById('ebook-modul-form-mode').value;
    const kode = document.getElementById('ebook-modul-form-id').value;
    const nama = document.getElementById('ebook-modul-nama-input').value.trim();
    if (!nama) { showToast('Nama modul wajib', 'danger'); return; }
    const kelompok = document.getElementById('ebook-modul-kelompok-select')?.value || '';
    const ebook_list = [...document.querySelectorAll('#ebook-modul-picker [data-ebook-kode]:checked')].map(cb => cb.dataset.ebookKode);
    try {
        if (mode === 'add') await EbookModulAPI.create({ nama, kelompok, ebook_list });
        else await EbookModulAPI.update(kode, { nama, kelompok, ebook_list });
        clearDirty(); closeModal('ebook-modul-form-overlay');
        showToast('Modul e-book disimpan!', 'success');
        await renderEbookModul();
    } catch (e) { showToast('Gagal: ' + e.message, 'danger'); }
}
function deleteEbookModulItem(kode, nama) {
    showConfirm('Hapus Modul', `Yakin hapus "${nama}"?`, 'danger', async () => {
        await EbookModulAPI.delete(kode);
        showToast('Modul e-book dihapus', 'danger');
        await renderEbookModul();
    });
}

// ── KELOLA KELOMPOK MODUL E-BOOK (dikelola dari Modul E-Book — opsional) ──
function openManageEbookModulKelompok() {
    const input = document.getElementById('ebook-modul-kelompok-new-input'); if (input) input.value = '';
    _renderEbookModulKelompokManageList();
    openModal('ebook-modul-kelompok-overlay');
}
function _renderEbookModulKelompokManageList() {
    const el = document.getElementById('ebook-modul-kelompok-manage-list'); if (!el) return;
    if (!_ebookModulKelompokList.length) { el.innerHTML = '<p style="color:var(--text-sub);font-size:13px">Belum ada kelompok. Tambahkan lewat kolom di atas.</p>'; return; }
    el.innerHTML = _ebookModulKelompokList.map(k => `
      <div class="ebook-pick-item" id="emkl-row-${k.kode}" style="justify-content:space-between">
        <span id="emkl-nama-${k.kode}" style="font-weight:600;font-size:13.5px;color:var(--blue)">${k.nama}</span>
        <div class="emkl-row-actions" style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn-icon" title="Ganti nama" onclick="_startRenameEbookModulKelompok('${k.kode}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn-icon danger" title="Hapus" onclick="deleteEbookModulKelompokItem('${k.kode}','${(k.nama || '').replace(/'/g, "\\'")}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
        </div>
      </div>`).join('');
}
async function addEbookModulKelompok() {
    const input = document.getElementById('ebook-modul-kelompok-new-input');
    const nama = (input?.value || '').trim();
    if (!nama) { showToast('Nama kelompok wajib diisi', 'danger'); return; }
    try { await EbookModulKelompokAPI.create({ nama }); if (input) input.value = ''; showToast('Kelompok ditambahkan', 'success'); await _afterEbookModulKelompokChange(); }
    catch (e) { showToast('Gagal: ' + e.message, 'danger'); }
}
function _startRenameEbookModulKelompok(kode) {
    const span = document.getElementById(`emkl-nama-${kode}`); if (!span) return;
    const current = span.textContent;
    span.outerHTML = `<input id="emkl-nama-${kode}" class="form-input" style="padding:6px 10px;font-size:13px" type="text" value="${current.replace(/"/g, '&quot;')}" onkeydown="if(event.key==='Enter')_saveRenameEbookModulKelompok('${kode}')">`;
    const row = document.getElementById(`emkl-row-${kode}`);
    const actionsWrap = row?.querySelector('.emkl-row-actions');
    if (actionsWrap) actionsWrap.innerHTML = `<button class="btn-icon" title="Simpan" onclick="_saveRenameEbookModulKelompok('${kode}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg></button>`;
    document.getElementById(`emkl-nama-${kode}`)?.focus();
}
async function _saveRenameEbookModulKelompok(kode) {
    const input = document.getElementById(`emkl-nama-${kode}`);
    const nama = (input?.value || '').trim();
    if (!nama) { showToast('Nama kelompok wajib diisi', 'danger'); return; }
    try { await EbookModulKelompokAPI.update(kode, { nama }); showToast('Kelompok diperbarui', 'success'); await _afterEbookModulKelompokChange(); }
    catch (e) { showToast('Gagal: ' + e.message, 'danger'); }
}
function deleteEbookModulKelompokItem(kode, nama) {
    showConfirm('Hapus Kelompok', `Yakin hapus kelompok "${nama}"? Modul e-book yang ada di kelompok ini akan menjadi tanpa kelompok.`, 'danger', async () => {
        await EbookModulKelompokAPI.delete(kode);
        showToast('Kelompok dihapus', 'danger');
        await _afterEbookModulKelompokChange();
    });
}
async function _afterEbookModulKelompokChange() {
    await _loadEbookModulKelompokList();
    _renderEbookModulKelompokManageList();
    if (document.getElementById('ebook-modul-kelompok-select')) _populateEbookModulKelompokSelect(document.getElementById('ebook-modul-kelompok-select').value);
    if (document.getElementById('ebook-modul-kelompok-filters')) { _renderEbookModulKelompokFilters(); _renderEbookModulList(); }
}

// ── KELOLA KELOMPOK E-BOOK (dikelola dari Library — opsional) ──
function openManageEbookKelompok() {
    const input = document.getElementById('ebook-kelompok-new-input'); if (input) input.value = '';
    _renderEbookKelompokManageList();
    openModal('ebook-kelompok-overlay');
}

function _renderEbookKelompokManageList() {
    const el = document.getElementById('ebook-kelompok-manage-list'); if (!el) return;
    if (!_ebookKelompokList.length) { el.innerHTML = '<p style="color:var(--text-sub);font-size:13px">Belum ada kelompok. Tambahkan lewat kolom di atas.</p>'; return; }
    el.innerHTML = _ebookKelompokList.map(k => `
      <div class="ebook-pick-item" id="ebkl-row-${k.kode}" style="justify-content:space-between">
        <span id="ebkl-nama-${k.kode}" style="font-weight:600;font-size:13.5px;color:var(--blue)">${k.nama}</span>
        <div class="ebkl-row-actions" style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn-icon" title="Ganti nama" onclick="_startRenameEbookKelompok('${k.kode}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn-icon danger" title="Hapus" onclick="deleteEbookKelompokItem('${k.kode}','${(k.nama || '').replace(/'/g, "\\'")}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
        </div>
      </div>`).join('');
}

async function addEbookKelompok() {
    const input = document.getElementById('ebook-kelompok-new-input');
    const nama = (input?.value || '').trim();
    if (!nama) { showToast('Nama kelompok wajib diisi', 'danger'); return; }
    try {
        await EbookKelompokAPI.create({ nama });
        if (input) input.value = '';
        showToast('Kelompok ditambahkan', 'success');
        await _afterEbookKelompokChange();
    } catch (e) { showToast('Gagal: ' + e.message, 'danger'); }
}

function _startRenameEbookKelompok(kode) {
    const span = document.getElementById(`ebkl-nama-${kode}`); if (!span) return;
    const current = span.textContent;
    span.outerHTML = `<input id="ebkl-nama-${kode}" class="form-input" style="padding:6px 10px;font-size:13px" type="text" value="${current.replace(/"/g, '&quot;')}" onkeydown="if(event.key==='Enter')_saveRenameEbookKelompok('${kode}')">`;
    const row = document.getElementById(`ebkl-row-${kode}`);
    const actionsWrap = row?.querySelector('.ebkl-row-actions');
    if (actionsWrap) actionsWrap.innerHTML = `<button class="btn-icon" title="Simpan" onclick="_saveRenameEbookKelompok('${kode}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg></button>`;
    document.getElementById(`ebkl-nama-${kode}`)?.focus();
}
async function _saveRenameEbookKelompok(kode) {
    const input = document.getElementById(`ebkl-nama-${kode}`);
    const nama = (input?.value || '').trim();
    if (!nama) { showToast('Nama kelompok wajib diisi', 'danger'); return; }
    try {
        await EbookKelompokAPI.update(kode, { nama });
        showToast('Kelompok diperbarui, semua buku terkait ikut berubah', 'success');
        await _afterEbookKelompokChange();
    } catch (e) { showToast('Gagal: ' + e.message, 'danger'); }
}
function deleteEbookKelompokItem(kode, nama) {
    showConfirm('Hapus Kelompok', `Yakin hapus kelompok "${nama}"? Buku yang ada di kelompok ini akan menjadi tanpa kelompok (bukan ikut terhapus).`, 'danger', async () => {
        await EbookKelompokAPI.delete(kode);
        showToast('Kelompok dihapus', 'danger');
        await _afterEbookKelompokChange();
    });
}

// Refresh semua bagian UI yang menampilkan/memakai daftar kelompok, di halaman mana pun sedang aktif
async function _afterEbookKelompokChange() {
    await _loadEbookKelompokList();
    _renderEbookKelompokManageList();
    if (document.getElementById('ebook-kelompok-select')) await _populateEbookKelompokSelect();
    if (document.getElementById('ebook-kelompok-filters')) await renderEbookLibrary();
}
