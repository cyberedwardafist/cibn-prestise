// admin/paket-form.js
// Form Tambah/Edit Paket (fullscreen) — dipisah dari admin/keuangan.js supaya
// file keuangan.js tetap ringan; ini isinya cuma logic buka/isi/submit form.
// Markup-nya ada di admin/paket-form.html (dimuat bareng sebagai 'modals'
// lewat ADMIN_PAGE_MODULES.keuangan di js/app.js).
// Butuh _paketData & _ldPaketCache (dideklarasikan di admin/keuangan.js) serta
// helper global dari js/app.js (showToast, openModal, closeModal, dst).
// Widget kalender utk Periode=Custom ada di admin/paket-daterange.js (fungsi
// onPaketPeriodeChange/initPaketDateRange/paketPeriodeDiffDays dipakai di sini).

const PAKET_PERIODE_PRESET = ['/bulan', '/tahun', '/hari', 'sekali bayar'];

let _editPaketKode = null;

// ── PICKER "Modul / Materi" (hak akses -> pilih Modul E-Book tertentu) ──
// Dipakai ulang polanya dari picker "Pilih Buku" di Modul E-Book (js/ebook.js),
// tapi disederhanakan: cuma list + cari + filter kelompok, tanpa langkah urutan
// & tanpa nilai/bobot (karena di sini cuma menentukan HAK AKSES, bukan menyusun modul).
// Nilai terpilih disimpan sbg checkbox name="pf-aturan" value="modul.item.<kode>"
// supaya ikut kekumpul otomatis lewat mekanisme aturan_akses yang sudah ada.
let _pfModulEbookList = [], _pfModulEkelompokList = [];
let _pfModulPickerSearch = '', _pfModulPickerKelompokFilter = 'all';
let _pfModulPickerSelected = new Set();

async function _pfLoadModulPicker(selectedKodes = []) {
    _pfModulPickerSelected = new Set(selectedKodes);
    _pfModulPickerSearch = ''; _pfModulPickerKelompokFilter = 'all';
    const si = document.getElementById('pf-modul-picker-search-input'); if (si) si.value = '';
    [_pfModulEbookList, _pfModulEkelompokList] = await Promise.all([
        (typeof EbookModulAPI !== 'undefined' ? EbookModulAPI.getAll().catch(() => []) : Promise.resolve([])),
        (typeof EbookModulKelompokAPI !== 'undefined' ? EbookModulKelompokAPI.getAll().catch(() => []) : Promise.resolve([]))
    ]);
    _renderPfModulPickerFilters();
    _renderPfModulPicker();
}
function _renderPfModulPickerFilters() {
    if (!document.getElementById('pf-modul-picker-filters')) return;
    const options = [{ value: 'all', label: 'Semua Kelompok' }, { value: 'none', label: 'Tanpa Kelompok' }, ..._pfModulEkelompokList.map(k => ({ value: k.kode, label: k.nama }))];
    renderFilterDropdown('pf-modul-picker-filters', { title: 'Kelompok', options, current: _pfModulPickerKelompokFilter, onSelect: v => { _pfModulPickerKelompokFilter = v; _renderPfModulPickerFilters(); _renderPfModulPicker(); } });
}
function _renderPfModulPicker() {
    const el = document.getElementById('pf-modul-picker-list'); if (!el) return;
    if (!_pfModulEbookList.length) { el.innerHTML = '<p style="color:var(--text-sub);font-size:12px">Belum ada modul e-book. Buat dulu di menu Modul E-Book.</p>'; return; }
    let data = _pfModulEbookList;
    const q = (_pfModulPickerSearch || '').toLowerCase();
    if (q) data = data.filter(m => (m.nama || '').toLowerCase().includes(q));
    if (_pfModulPickerKelompokFilter === 'none') data = data.filter(m => !m.kelompok);
    else if (_pfModulPickerKelompokFilter !== 'all') data = data.filter(m => m.kelompok === _pfModulPickerKelompokFilter);
    el.innerHTML = data.length ? data.map(m => _pfModulPickCardHtml(m)).join('') : '<p style="color:var(--text-sub);font-size:12px">Tidak ada modul e-book yang cocok.</p>';
}
function _pfModulKelompokNama(kode) { const k = _pfModulEkelompokList.find(x => x.kode === kode); return k ? k.nama : ''; }
function _pfModulPickCardHtml(m) {
    const kode = m.kode || m.id;
    const val = 'modul.item.' + kode;
    const ck = _pfModulPickerSelected.has(val);
    const kelNama = _pfModulKelompokNama(m.kelompok);
    return `<label class="ebook-pick-item${ck ? ' checked' : ''}" id="pfmpick-${kode}">
      <input type="checkbox" name="pf-aturan" value="${val}" ${ck ? 'checked' : ''} onchange="_pfToggleModulPick('${kode}',this.checked)" style="accent-color:var(--blue);width:16px;height:16px;flex-shrink:0">
      <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px;color:var(--blue);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.nama}</div><div style="font-size:11px;color:var(--text-sub)">${(m.ebook_list || []).length} buku${kelNama ? ' · ' + kelNama : ''}</div></div>
    </label>`;
}
function _pfToggleModulPick(kode, ck) {
    const val = 'modul.item.' + kode;
    if (ck) _pfModulPickerSelected.add(val); else _pfModulPickerSelected.delete(val);
    const el = document.getElementById(`pfmpick-${kode}`); if (el) el.classList.toggle('checked', ck);
    setDirty('paket');
}

// ── PICKER "Mentoring & Konsultasi" (hak akses -> tampilan saja, fungsi belum diaktifkan) ──
// Pola sama seperti picker Modul di atas, tapi listnya diambil dari data MODUL
// (paket soal ujian, admin/modul.js), bukan Modul E-Book. Sesuai arahan: baru
// tampilan search/filter/list-nya dulu, belum dihubungkan ke fungsi booking.
let _pfMentoringModulList = [], _pfMentoringKelompokList = [];
let _pfMentoringPickerSearch = '', _pfMentoringPickerKelompokFilter = 'all';
let _pfMentoringPickerSelected = new Set();

async function _pfLoadMentoringPicker(selectedKodes = []) {
    _pfMentoringPickerSelected = new Set(selectedKodes);
    _pfMentoringPickerSearch = ''; _pfMentoringPickerKelompokFilter = 'all';
    const si = document.getElementById('pf-mentoring-picker-search-input'); if (si) si.value = '';
    [_pfMentoringModulList, _pfMentoringKelompokList] = await Promise.all([
        (typeof ModulAPI !== 'undefined' ? ModulAPI.getAll().catch(() => []) : Promise.resolve([])),
        (typeof ModulKelompokAPI !== 'undefined' ? ModulKelompokAPI.getAll().catch(() => []) : Promise.resolve([]))
    ]);
    _renderPfMentoringPickerFilters();
    _renderPfMentoringPicker();
}
function _renderPfMentoringPickerFilters() {
    if (!document.getElementById('pf-mentoring-picker-filters')) return;
    const options = [{ value: 'all', label: 'Semua Kelompok' }, { value: 'none', label: 'Tanpa Kelompok' }, ..._pfMentoringKelompokList.map(k => ({ value: k.kode, label: k.nama }))];
    renderFilterDropdown('pf-mentoring-picker-filters', { title: 'Kelompok', options, current: _pfMentoringPickerKelompokFilter, onSelect: v => { _pfMentoringPickerKelompokFilter = v; _renderPfMentoringPickerFilters(); _renderPfMentoringPicker(); } });
}
function _renderPfMentoringPicker() {
    const el = document.getElementById('pf-mentoring-picker-list'); if (!el) return;
    if (!_pfMentoringModulList.length) { el.innerHTML = '<p style="color:var(--text-sub);font-size:12px">Belum ada modul. Buat dulu di menu Modul.</p>'; return; }
    let data = _pfMentoringModulList;
    const q = (_pfMentoringPickerSearch || '').toLowerCase();
    if (q) data = data.filter(m => (m.nama || '').toLowerCase().includes(q));
    if (_pfMentoringPickerKelompokFilter === 'none') data = data.filter(m => !m.kelompok);
    else if (_pfMentoringPickerKelompokFilter !== 'all') data = data.filter(m => m.kelompok === _pfMentoringPickerKelompokFilter);
    el.innerHTML = data.length ? data.map(m => _pfMentoringPickCardHtml(m)).join('') : '<p style="color:var(--text-sub);font-size:12px">Tidak ada modul yang cocok.</p>';
}
function _pfMentoringKelompokNama(kode) { const k = _pfMentoringKelompokList.find(x => x.kode === kode); return k ? k.nama : ''; }
function _pfMentoringPickCardHtml(m) {
    const kode = m.kode || m.id;
    const val = 'mentoring.modul.' + kode;
    const ck = _pfMentoringPickerSelected.has(val);
    const kelNama = _pfMentoringKelompokNama(m.kelompok);
    const namaTampil = m.nama_internal ? `${m.nama} | ${m.nama_internal}` : m.nama;
    return `<label class="ebook-pick-item${ck ? ' checked' : ''}" id="pfmentpick-${kode}">
      <input type="checkbox" name="pf-aturan" value="${val}" ${ck ? 'checked' : ''} onchange="_pfToggleMentoringPick('${kode}',this.checked)" style="accent-color:var(--blue);width:16px;height:16px;flex-shrink:0">
      <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px;color:var(--blue);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${namaTampil}</div><div style="font-size:11px;color:var(--text-sub)">${(m.soal_list || []).length} soal${kelNama ? ' · ' + kelNama : ''}</div></div>
    </label>`;
}
function _pfToggleMentoringPick(kode, ck) {
    const val = 'mentoring.modul.' + kode;
    if (ck) _pfMentoringPickerSelected.add(val); else _pfMentoringPickerSelected.delete(val);
    const el = document.getElementById(`pfmentpick-${kode}`); if (el) el.classList.toggle('checked', ck);
    setDirty('paket');
}

async function openAddPaket() {
    _editPaketKode = null;
    document.getElementById('paket-form-title').textContent = 'Tambah Paket';
    document.getElementById('pf-id').value = '';
    document.getElementById('pf-nama').value = '';
    document.getElementById('pf-icon').value = '📦';
    document.getElementById('pf-harga').value = '';
    document.getElementById('pf-periode').value = '/bulan';
    document.getElementById('pf-desc').value = '';
    document.getElementById('pf-fitur').value = '';
    document.getElementById('pf-warna').value = 'blue';
    document.getElementById('pf-popular').checked = false;
    var _dr = document.getElementById('pf-periode-daterange'); if(_dr) _dr.style.display = 'none';
    PaketCalState = null; // reset kalender, di-init ulang kalau user pilih Custom lagi
    document.querySelectorAll('input[name="pf-hak"]').forEach(cb=>cb.checked=false);
    document.querySelectorAll('input[name="pf-aturan"]').forEach(cb=>cb.checked=false);
    document.querySelectorAll('.hak-sub').forEach(s=>{s.style.display='none';});
    document.querySelectorAll('.hak-chevron').forEach(c=>{c.style.transform='';});
    var mn=document.getElementById('pf-maks-ujian');if(mn)mn.value='';
    var dh=document.getElementById('pf-durasi-hari');if(dh)dh.value='';
    var hn=document.getElementById('pf-hak-notes');if(hn)hn.value='';
    var mk=document.getElementById('pf-mentoring-kuota');if(mk)mk.value='';
    await Promise.all([_pfLoadModulPicker([]), _pfLoadMentoringPicker([])]);
    await _populateLinkLandingDropdown('');
    openModal('paket-form-overlay');
}

async function openEditPaket(kode) {
    const p = _paketData.find(x => (x.kode||x.id) == kode);
    if (!p) return;
    _editPaketKode = kode;
    document.getElementById('paket-form-title').textContent = 'Edit Paket';
    document.getElementById('pf-id').value = kode;
    document.getElementById('pf-nama').value = p.nama || '';
    document.getElementById('pf-icon').value = p.icon || '📦';
    document.getElementById('pf-harga').value = p.harga || '';
    var _pVal = p.periode || (p.periode_tipe ? '/'+p.periode_tipe : '/bulan');
    var _pEl = document.getElementById('pf-periode');
    var _dr = document.getElementById('pf-periode-daterange');
    if (PAKET_PERIODE_PRESET.includes(_pVal)) {
        if (_pEl) _pEl.value = _pVal;
        if (_dr) _dr.style.display = 'none';
        PaketCalState = null;
    } else {
        // Periode-nya dulu diisi lewat kalender (bukan salah satu preset) — buka
        // lagi kalendernya. Tanggal absolut aslinya nggak disimpan di database,
        // jadi direkonstruksi mulai hari ini sepanjang periode_hari yang tersimpan.
        if (_pEl) _pEl.value = 'custom';
        if (_dr) _dr.style.display = 'block';
        const durasi = parseInt(p.periode_hari) || 30;
        const todayISO = _paketCalISO(_paketCalToday());
        const endD = new Date(); endD.setDate(endD.getDate() + durasi - 1);
        initPaketDateRange(todayISO, _paketCalISO(endD));
    }
    document.getElementById('pf-desc').value = p.deskripsi || p.desc || '';
    document.getElementById('pf-fitur').value = Array.isArray(p.fitur) ? p.fitur.join('\n') : (p.fitur || '');
    document.getElementById('pf-warna').value = p.warna || 'blue';
    document.getElementById('pf-popular').checked = !!p.popular;
    const hakArr = Array.isArray(p.hak_akses) ? p.hak_akses : (p.hak_akses ? (() => { try { return JSON.parse(p.hak_akses); } catch(e) { return []; } })() : []);
    const aturanArr = Array.isArray(p.aturan_akses) ? p.aturan_akses : (p.aturan_akses ? (() => { try { return JSON.parse(p.aturan_akses); } catch(e) { return []; } })() : []);
    document.querySelectorAll('input[name="pf-hak"]').forEach(cb=>{cb.checked=hakArr.includes(cb.value);});
    document.querySelectorAll('input[name="pf-aturan"]').forEach(cb=>{cb.checked=aturanArr.includes(cb.value);});
    document.querySelectorAll('.hak-sub').forEach(s=>{s.style.display='none';});
    document.querySelectorAll('.hak-chevron').forEach(c=>{c.style.transform='';});
    var mn=document.getElementById('pf-maks-ujian');if(mn)mn.value=p.maks_ujian||'';
    var dh=document.getElementById('pf-durasi-hari');if(dh)dh.value=p.durasi_hari||'';
    var hn=document.getElementById('pf-hak-notes');if(hn)hn.value=p.hak_notes||'';
    var mk=document.getElementById('pf-mentoring-kuota');if(mk)mk.value=p.mentoring_kuota||'';
    await Promise.all([_pfLoadModulPicker(aturanArr.filter(v => v.startsWith('modul.item.'))), _pfLoadMentoringPicker(aturanArr.filter(v => v.startsWith('mentoring.modul.')))]);
    await _populateLinkLandingDropdown(p.link_landing || '');
    openModal('paket-form-overlay');
}

// Populate dropdown link ke paket landing (membaca dari server)
async function _populateLinkLandingDropdown(currentVal) {
    const sel = document.getElementById('pf-link-landing');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Tidak dihubungkan / berdiri sendiri --</option>';
    // Muat paket landing dari server jika belum ada
    if (!_ldPaketCache.length) {
        try {
            const ld = await LandingAPI.get().catch(() => ({}));
            _ldPaketCache = (ld && ld.paket && ld.paket.list) ? ld.paket.list : [];
        } catch(e) { _ldPaketCache = []; }
    }
    if (_ldPaketCache.length) {
        _ldPaketCache.forEach((p, i) => {
            const val = p.kode || ('ldp_' + i);
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = (p.name || 'Paket ' + (i+1)) + (p.price ? ' · ' + p.price : '');
            if (currentVal && currentVal === val) opt.selected = true;
            sel.appendChild(opt);
        });
    } else {
        const opt = document.createElement('option');
        opt.disabled = true;
        opt.textContent = '(Belum ada paket di Landing Page Editor)';
        sel.appendChild(opt);
    }
}

async function submitPaket() {
    const nama = document.getElementById('pf-nama').value.trim();
    if (!nama) { showToast('Nama paket wajib diisi', 'danger'); return; }
    const hak_akses = [...document.querySelectorAll('input[name="pf-hak"]:checked')].map(cb=>cb.value);
    const aturan_akses = [...document.querySelectorAll('input[name="pf-aturan"]:checked')].map(cb=>cb.value);
    const periodeSel = document.getElementById('pf-periode').value;
    let periodeVal, periode_hari, periode_tipe;
    if (periodeSel === 'custom') {
        if (!PaketCalState || PaketCalState.end < PaketCalState.start) {
            showToast('Pilih tanggal mulai & selesai di kalender dulu', 'danger');
            return;
        }
        periode_hari = paketPeriodeDiffDays();
        periodeVal = `/${periode_hari} hari`;
        periode_tipe = 'hari';
    } else {
        periodeVal = periodeSel;
        const periodeToHari = {'/hari':1,'/minggu':7,'/bulan':30,'/tahun':365,'sekali bayar':36500};
        periode_hari = periodeToHari[periodeVal] || 30;
        periode_tipe = periodeVal.replace('/','').split(' ')[0] || 'bulan';
    }
    const paket = {
        nama,
        deskripsi: document.getElementById('pf-desc').value.trim(),
        icon: document.getElementById('pf-icon').value.trim() || '📦',
        harga: parseInt(document.getElementById('pf-harga').value || '0'),
        periode: periodeVal,
        periode_tipe,
        periode_hari,
        fitur: document.getElementById('pf-fitur').value.trim(),
        warna: document.getElementById('pf-warna').value,
        popular: document.getElementById('pf-popular').checked,
        status: 'aktif',
        link_landing: (document.getElementById('pf-link-landing')?.value || ''),
        hak_akses: JSON.stringify(hak_akses),
        aturan_akses: JSON.stringify(aturan_akses),
        maks_ujian: document.getElementById('pf-maks-ujian')?.value || '',
        durasi_hari: document.getElementById('pf-durasi-hari')?.value || '',
        hak_notes: document.getElementById('pf-hak-notes')?.value?.trim() || '',
        mentoring_kuota: document.getElementById('pf-mentoring-kuota')?.value || ''
    };
    const btn = document.querySelector('#paket-form-overlay .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
    try {
        if (_editPaketKode) {
            await PaketAPI.update(_editPaketKode, paket);
            showToast('Paket diperbarui!', 'success');
        } else {
            await PaketAPI.create(paket);
            showToast('Paket ditambahkan!', 'success');
        }
        clearDirty();
        closeModal('paket-form-overlay');
        await renderPaketGrid();
    } catch(e) {
        showToast('Gagal: ' + e.message, 'danger');
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Simpan Paket'; }
}

function deletePaket(kode, nama) {
    showConfirm('Hapus Paket', `Yakin hapus paket "${nama}"?`, 'danger', async () => {
        try {
            await PaketAPI.delete(kode);
            showToast('Paket dihapus', 'danger');
            await renderPaketGrid();
        } catch(e) { showToast('Gagal hapus: ' + e.message, 'danger'); }
    });
}
