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

// Switch "MODUL"/"MENTORING" di panel Hak Akses (menggantikan checkbox header lama)
// selain menandai hak akses menu itu, juga jadi gerbang tampil/sembunyi konten
// (search+list dst) di bawahnya. _pfSyncHakContentWraps dipanggil tiap kali checked-
// state pf-hak di-set dari kode (bukan diklik user, mis. saat buka form Tambah/Edit
// atau pulihkan draft) supaya wrapper kontennya ikut sinkron.
function _pfSyncHakContentWraps(hakArr) {
    const mw = document.getElementById('pf-modul-content-wrap'); if (mw) mw.style.display = (hakArr || []).includes('modul') ? '' : 'none';
    const mtw = document.getElementById('pf-mentoring-content-wrap'); if (mtw) mtw.style.display = (hakArr || []).includes('mentoring') ? '' : 'none';
}
// Dipanggil dari onchange tiap switch pf-hak (CAT/HISTORI/MODUL/MENTORING) di
// admin/paket-form.html. wrapId opsional — cuma dipakai switch MODUL & MENTORING
// yang kontennya ikut perlu disembunyikan saat switch-nya dimatikan.
function onPfHakSwitchToggle(cb, wrapId) {
    setDirty('paket');
    if (!wrapId) return;
    const el = document.getElementById(wrapId);
    if (el) el.style.display = cb.checked ? '' : 'none';
}

/* ── DRAFT AUTO-SAVE — form Tambah/Edit Paket ──
   Sama seperti draft Soal Builder (js/soal.js, localStorage cbn_soal_draft):
   supaya (1) modal Tambah/Edit Paket TETAP TERBUKA & (2) isian yang sudah
   diketik TIDAK HILANG kalau halaman di-refresh / Ctrl+Shift+R.
   - Ditulis LANGSUNG (bukan debounce) sesaat modal dibuka (baseline), lalu
     di-refresh lewat debounce tiap ada perubahan (dipanggil dari setDirty('paket')
     di js/app.js).
   - Dipulihkan otomatis SEKALI tiap kali aplikasi baru dimuat, saat tab
     Keuangan > Paket dibuka (lihat admin/keuangan.js renderKeuanganSub).
   - Dihapus begitu modal ditutup dgn cara apa pun (Batal/X/backdrop/berhasil
     Simpan) — lihat hook di closeModal() (js/app.js). */
let _pfDraftTimer = null;
let _pfDraftRestoreChecked = false;
function _pfDraftSave() {
    const overlay = document.getElementById('paket-form-overlay');
    if (!overlay || !overlay.classList.contains('open')) return;
    try {
        const periodeSel = document.getElementById('pf-periode')?.value || '/bulan';
        const draft = {
            mode: _editPaketKode ? 'edit' : 'add',
            kode: _editPaketKode,
            nama: document.getElementById('pf-nama')?.value || '',
            icon: document.getElementById('pf-icon')?.value || '',
            harga: document.getElementById('pf-harga')?.value || '',
            periode: periodeSel,
            periodeCustomStart: (periodeSel === 'custom' && typeof PaketCalState !== 'undefined' && PaketCalState) ? _paketCalISO(PaketCalState.start) : null,
            periodeCustomEnd: (periodeSel === 'custom' && typeof PaketCalState !== 'undefined' && PaketCalState) ? _paketCalISO(PaketCalState.end) : null,
            desc: document.getElementById('pf-desc')?.value || '',
            fitur: document.getElementById('pf-fitur')?.value || '',
            warna: document.getElementById('pf-warna')?.value || 'blue',
            popular: !!document.getElementById('pf-popular')?.checked,
            linkLanding: document.getElementById('pf-link-landing')?.value || '',
            mentoringKuota: document.getElementById('pf-mentoring-kuota')?.value || '',
            hak: [...document.querySelectorAll('input[name="pf-hak"]:checked')].map(cb => cb.value),
            aturan: [...document.querySelectorAll('input[name="pf-aturan"]:checked')].map(cb => cb.value)
        };
        localStorage.setItem('cbn_paket_draft', JSON.stringify(draft));
    } catch (e) {}
}
function _pfQueueAutoSave() { clearTimeout(_pfDraftTimer); _pfDraftTimer = setTimeout(_pfDraftSave, 500); }
function _pfDraftClear() { clearTimeout(_pfDraftTimer); try { localStorage.removeItem('cbn_paket_draft'); } catch (e) {} }

async function _tryRestorePaketDraft() {
    if (_pfDraftRestoreChecked) return;
    _pfDraftRestoreChecked = true;
    let raw;
    try { raw = localStorage.getItem('cbn_paket_draft'); } catch (e) { return; }
    if (!raw) return;
    let d;
    try { d = JSON.parse(raw); } catch (e) { return; }
    if (!d || !d.mode) { _pfDraftClear(); return; }
    if (d.mode === 'edit' && !_paketData.find(x => (x.kode || x.id) == d.kode)) {
        // Paketnya sudah tidak ada (mis. dihapus admin lain) -> draft basi, buang.
        _pfDraftClear();
        return;
    }
    if (d.mode === 'edit') await openEditPaket(d.kode); else await openAddPaket();
    // openAddPaket/openEditPaket di atas mengisi form dari data ASLI (server) &
    // langsung menulis draft baseline baru (lihat pemanggilan _pfDraftSave() di
    // ujung fungsi keduanya) — timpa lagi di sini dgn nilai draft yg belum
    // sempat ke-Simpan sebelum halaman di-refresh.
    const setVal = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined && v !== null) el.value = v; };
    setVal('pf-nama', d.nama); setVal('pf-icon', d.icon); setVal('pf-harga', d.harga);
    setVal('pf-desc', d.desc); setVal('pf-fitur', d.fitur); setVal('pf-warna', d.warna);
    setVal('pf-link-landing', d.linkLanding); setVal('pf-mentoring-kuota', d.mentoringKuota);
    const popEl = document.getElementById('pf-popular'); if (popEl) popEl.checked = !!d.popular;
    if (d.periode) {
        const perEl = document.getElementById('pf-periode'); if (perEl) perEl.value = d.periode;
        if (d.periode === 'custom' && d.periodeCustomStart && d.periodeCustomEnd) {
            const dr = document.getElementById('pf-periode-daterange'); if (dr) dr.style.display = 'block';
            initPaketDateRange(d.periodeCustomStart, d.periodeCustomEnd);
        }
    }
    document.querySelectorAll('input[name="pf-hak"]').forEach(cb => { cb.checked = (d.hak || []).includes(cb.value); });
    _pfSyncHakContentWraps(d.hak || []);
    const aturan = d.aturan || [];
    // modul.item.* & mentoring.modul.* dipulihkan lewat picker-nya masing-masing
    // (bukan di-set manual checked) supaya kartu (nama modul, dst) ikut ke-render.
    await Promise.all([
        _pfLoadModulPicker(aturan.filter(v => v.startsWith('modul.item.'))),
        _pfLoadMentoringPicker(aturan.filter(v => v.startsWith('mentoring.modul.')))
    ]);
    document.querySelectorAll('input[name="pf-aturan"]').forEach(cb => {
        if (cb.value.startsWith('modul.item.') || cb.value.startsWith('mentoring.modul.')) return;
        cb.checked = aturan.includes(cb.value);
    });
    setDirty('paket');
    showToast('Draf paket yang belum tersimpan berhasil dipulihkan ✓', 'success');
}

// ── PICKER "Modul / Materi" (hak akses -> pilih Modul E-Book tertentu) ──
// Dipakai ulang polanya dari picker "Pilih Buku" di Modul E-Book (js/ebook.js),
// tapi disederhanakan: cuma list + cari + filter kelompok, tanpa langkah urutan
// & tanpa nilai/bobot (karena di sini cuma menentukan HAK AKSES, bukan menyusun modul).
// Nilai terpilih disimpan sbg checkbox name="pf-aturan" value="modul.item.<kode>"
// supaya ikut kekumpul otomatis lewat mekanisme aturan_akses yang sudah ada.
let _pfModulEbookList = [], _pfModulEkelompokList = [];
let _pfModulPickerSearch = '', _pfModulPickerKelompokFilter = 'all';
let _pfModulPickerSelected = new Set();
let _pfModulPickerStep = 'select';

async function _pfLoadModulPicker(selectedKodes = []) {
    _pfModulPickerSelected = new Set(selectedKodes);
    _pfModulPickerSearch = ''; _pfModulPickerKelompokFilter = 'all';
    const si = document.getElementById('pf-modul-picker-search-input'); if (si) si.value = '';
    [_pfModulEbookList, _pfModulEkelompokList] = await Promise.all([
        (typeof EbookModulAPI !== 'undefined' ? EbookModulAPI.getAll().catch(() => []) : Promise.resolve([])),
        (typeof EbookModulKelompokAPI !== 'undefined' ? EbookModulKelompokAPI.getAll().catch(() => []) : Promise.resolve([]))
    ]);
    _pfModulInitPickerUI();
}
// Reset picker "E-BOOK" balik ke tahap 1 (cari & pilih) — dipanggil tiap kali
// picker dimuat ulang (buka form Tambah/Edit) & saat tombol "Kembali" di tahap
// "Lihat E-BOOK" diklik.
function _pfModulInitPickerUI() {
    _pfModulPickerStep = 'select';
    const sb = document.getElementById('pf-modul-picker-searchbar'); if (sb) sb.style.display = '';
    const hint = document.getElementById('pf-modul-picker-hint'); if (hint) hint.textContent = 'User dengan paket ini akan mengakses menu E-BOOK. Pilih modul e-book mana saja yang boleh diakses:';
    const nb = document.getElementById('pf-modul-next-btn'); if (nb) nb.style.display = '';
    const bb = document.getElementById('pf-modul-back-btn'); if (bb) bb.style.display = 'none';
    _renderPfModulPickerFilters();
    _renderPfModulPicker();
}
// Tahap 2 "Lihat E-BOOK": tampilkan HANYA modul e-book yang sudah dicentang,
// sbg ringkasan sebelum Simpan. Bukan langkah atur urutan (e-book tidak
// punya urutan tampil) — checkbox di sini tetap aktif, jadi masih bisa
// dilepas centangnya dari tahap ini juga (tetap sinkron 2 arah dgn tahap 1).
function _pfModulGoToViewStep() {
    if (!_pfModulPickerSelected.size) { showToast('Pilih minimal 1 modul e-book dulu', 'danger'); return; }
    _pfModulPickerStep = 'view';
    const sb = document.getElementById('pf-modul-picker-searchbar'); if (sb) sb.style.display = 'none';
    const hint = document.getElementById('pf-modul-picker-hint'); if (hint) hint.textContent = `${_pfModulPickerSelected.size} modul e-book terpilih untuk paket ini:`;
    const nb = document.getElementById('pf-modul-next-btn'); if (nb) nb.style.display = 'none';
    const bb = document.getElementById('pf-modul-back-btn'); if (bb) bb.style.display = '';
    _renderPfModulViewList();
}
function _pfModulGoToSelectStep() { _pfModulInitPickerUI(); }
function _renderPfModulViewList() {
    const el = document.getElementById('pf-modul-picker-list'); if (!el) return;
    if (!_pfModulPickerSelected.size) { el.innerHTML = '<p style="color:var(--text-sub);font-size:12px">Belum ada modul e-book dipilih. Klik "Kembali" untuk memilih.</p>'; return; }
    const kodes = [..._pfModulPickerSelected].map(v => v.replace('modul.item.', ''));
    el.innerHTML = kodes.map(kode => {
        const m = _pfModulEbookList.find(x => (x.kode || x.id) === kode);
        if (!m) return '';
        return _pfModulPickCardHtml(m);
    }).join('');
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
    setDirty('paket');
    // Tahap "Lihat E-BOOK" cuma nampilin yg terpilih — kalau dilepas centangnya
    // di situ, kartunya harus langsung hilang (render ulang list, bukan cuma
    // toggle class .checked kayak di tahap "select").
    if (_pfModulPickerStep === 'view') { _renderPfModulViewList(); return; }
    const el = document.getElementById(`pfmpick-${kode}`); if (el) el.classList.toggle('checked', ck);
}

// ── PICKER "Mentoring & Konsultasi" (hak akses -> tampilan saja, fungsi belum diaktifkan) ──
// Pola sama seperti picker Modul di atas, tapi listnya diambil dari data MODUL
// (paket soal ujian, admin/modul.js), bukan Modul E-Book. Sesuai arahan: baru
// tampilan search/filter/list-nya dulu, belum dihubungkan ke fungsi booking.
// Sama seperti "Pilih Buku & Urutan Tampil" di Modul E-Book (js/ebook.js):
// Tahap 1 "select": cari & centang modul, dibatasi oleh Kuota (kalau diisi).
// Tahap 2 "order": hanya modul terpilih, diseret naik/turun (atau tombol panah)
// utk atur urutan tampil. Urutan+pilihan disimpan lewat hidden checkbox
// name="pf-aturan" (di #pf-mentoring-order-inputs) berurutan sesuai _pfMentoringOrder,
// jadi submitPaket() yg baca semua checkbox pf-aturan:checked otomatis dapat urutan
// yg benar tanpa perlu diubah.
let _pfMentoringModulList = [], _pfMentoringKelompokList = [];
let _pfMentoringPickerSearch = '', _pfMentoringPickerKelompokFilter = 'all';
let _pfMentoringPickerStep = 'select';
let _pfMentoringOrder = [];
let _pfMentoringDragFrom = null;

async function _pfLoadMentoringPicker(selectedKodes = []) {
    _pfMentoringOrder = selectedKodes.map(v => v.replace('mentoring.modul.', ''));
    _pfMentoringPickerSearch = ''; _pfMentoringPickerKelompokFilter = 'all';
    const si = document.getElementById('pf-mentoring-picker-search-input'); if (si) si.value = '';
    [_pfMentoringModulList, _pfMentoringKelompokList] = await Promise.all([
        (typeof ModulAPI !== 'undefined' ? ModulAPI.getAll().catch(() => []) : Promise.resolve([])),
        (typeof ModulKelompokAPI !== 'undefined' ? ModulKelompokAPI.getAll().catch(() => []) : Promise.resolve([]))
    ]);
    _pfMentoringInitPickerUI();
}
function _pfMentoringInitPickerUI() {
    _pfMentoringPickerStep = 'select';
    const sb = document.getElementById('pf-mentoring-picker-searchbar'); if (sb) sb.style.display = '';
    const hint = document.getElementById('pf-mentoring-picker-hint'); if (hint) hint.textContent = 'Cari & pilih modul untuk sesi mentoring';
    const nb = document.getElementById('pf-mentoring-next-btn'); if (nb) nb.style.display = '';
    const bb = document.getElementById('pf-mentoring-back-btn'); if (bb) bb.style.display = 'none';
    _renderPfMentoringPickerFilters();
    _renderPfMentoringPicker();
    _pfSyncMentoringHiddenInputs();
}

// Kuota = null artinya kosong/0 = tak terbatas (∞)
function _pfMentoringKuota() {
    const v = parseInt(document.getElementById('pf-mentoring-kuota')?.value || '');
    return (isNaN(v) || v <= 0) ? null : v;
}
function onPfMentoringKuotaChange() {
    setDirty('paket');
    const kuota = _pfMentoringKuota();
    // Kalau kuota diperkecil dan modul terpilih sudah kelebihan, potong dari yg paling akhir
    if (kuota !== null && _pfMentoringOrder.length > kuota) {
        _pfMentoringOrder = _pfMentoringOrder.slice(0, kuota);
        _pfSyncMentoringHiddenInputs();
        showToast(`Kuota diperkecil jadi ${kuota}, kelebihan pilihan modul otomatis dilepas`, 'info');
    }
    if (_pfMentoringPickerStep === 'select') _renderPfMentoringPicker(); else _renderPfMentoringOrderList();
}

function _renderPfMentoringPickerFilters() {
    if (!document.getElementById('pf-mentoring-picker-filters')) return;
    const options = [{ value: 'all', label: 'Semua Kelompok' }, { value: 'none', label: 'Tanpa Kelompok' }, ..._pfMentoringKelompokList.map(k => ({ value: k.kode, label: k.nama }))];
    renderFilterDropdown('pf-mentoring-picker-filters', { title: 'Kelompok', options, current: _pfMentoringPickerKelompokFilter, onSelect: v => { _pfMentoringPickerKelompokFilter = v; _renderPfMentoringPickerFilters(); _renderPfMentoringPicker(); } });
}
// -- Tahap 1: daftar modul dgn search + filter kelompok, dibatasi kuota --
function _renderPfMentoringPicker() {
    const el = document.getElementById('pf-mentoring-picker-list'); if (!el) return;
    if (!_pfMentoringModulList.length) { el.innerHTML = '<p style="color:var(--text-sub);font-size:12px">Belum ada modul. Buat dulu di menu Modul.</p>'; return; }
    let data = _pfMentoringModulList;
    const q = (_pfMentoringPickerSearch || '').toLowerCase();
    if (q) data = data.filter(m => (m.nama || '').toLowerCase().includes(q));
    if (_pfMentoringPickerKelompokFilter === 'none') data = data.filter(m => !m.kelompok);
    else if (_pfMentoringPickerKelompokFilter !== 'all') data = data.filter(m => m.kelompok === _pfMentoringPickerKelompokFilter);
    const kuota = _pfMentoringKuota();
    const kuotaInfo = kuota !== null ? `<div style="font-size:10px;color:var(--text-sub);margin-bottom:6px">Terpilih ${_pfMentoringOrder.length}/${kuota} modul${_pfMentoringOrder.length >= kuota ? ' — kuota penuh' : ''}</div>` : '';
    el.innerHTML = kuotaInfo + (data.length ? data.map(m => _pfMentoringPickCardHtml(m)).join('') : '<p style="color:var(--text-sub);font-size:12px">Tidak ada modul yang cocok.</p>');
}
function _pfMentoringKelompokNama(kode) { const k = _pfMentoringKelompokList.find(x => x.kode === kode); return k ? k.nama : ''; }
function _pfMentoringPickCardHtml(m) {
    const kode = m.kode || m.id;
    const ck = _pfMentoringOrder.includes(kode);
    const kuota = _pfMentoringKuota();
    const kuotaFull = kuota !== null && _pfMentoringOrder.length >= kuota;
    const disabled = !ck && kuotaFull;
    const kelNama = _pfMentoringKelompokNama(m.kelompok);
    const namaTampil = m.nama_internal ? `${m.nama} | ${m.nama_internal}` : m.nama;
    return `<label class="ebook-pick-item${ck ? ' checked' : ''}" id="pfmentpick-${kode}" style="${disabled ? 'opacity:.45;cursor:not-allowed' : ''}">
      <input type="checkbox" ${ck ? 'checked' : ''} ${disabled ? 'disabled' : ''} onchange="_pfToggleMentoringPick('${kode}',this.checked)" style="accent-color:var(--blue);width:16px;height:16px;flex-shrink:0">
      <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px;color:var(--blue);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${namaTampil}</div><div style="font-size:11px;color:var(--text-sub)">${(m.soal_list || []).length} soal${kelNama ? ' · ' + kelNama : ''}</div></div>
    </label>`;
}
function _pfToggleMentoringPick(kode, ck) {
    const kuota = _pfMentoringKuota();
    if (ck) {
        if (kuota !== null && _pfMentoringOrder.length >= kuota) { showToast(`Kuota cuma ${kuota} modul, sudah penuh`, 'danger'); _renderPfMentoringPicker(); return; }
        if (!_pfMentoringOrder.includes(kode)) _pfMentoringOrder.push(kode);
    } else {
        _pfMentoringOrder = _pfMentoringOrder.filter(k => k !== kode);
    }
    _pfSyncMentoringHiddenInputs();
    setDirty('paket');
    _renderPfMentoringPicker(); // render ulang supaya status disabled kartu lain ikut update
}

// -- Tahap 2: hanya modul terpilih, urutkan dgn drag naik/turun atau tombol panah --
function _pfMentoringGoToOrderStep() {
    if (!_pfMentoringOrder.length) { showToast('Pilih minimal 1 modul', 'danger'); return; }
    _pfMentoringPickerStep = 'order';
    const sb = document.getElementById('pf-mentoring-picker-searchbar'); if (sb) sb.style.display = 'none';
    const hint = document.getElementById('pf-mentoring-picker-hint'); if (hint) hint.textContent = 'Seret ke atas/bawah, atau pakai tombol panah untuk atur urutan tampil';
    document.getElementById('pf-mentoring-next-btn').style.display = 'none';
    document.getElementById('pf-mentoring-back-btn').style.display = '';
    _renderPfMentoringOrderList();
}
function _pfMentoringGoToSelectStep() { _pfMentoringInitPickerUI(); }
function _renderPfMentoringOrderList() {
    const el = document.getElementById('pf-mentoring-picker-list'); if (!el) return;
    if (!_pfMentoringOrder.length) { el.innerHTML = '<p style="color:var(--text-sub);font-size:12px">Belum ada modul dipilih. Klik "Kembali" untuk memilih modul.</p>'; return; }
    el.innerHTML = _pfMentoringOrder.map((kode, idx) => _buildPfMentoringOrderCard(kode, idx)).join('');
}
function _buildPfMentoringOrderCard(kode, idx) {
    const m = _pfMentoringModulList.find(x => (x.kode || x.id) === kode); if (!m) return '';
    const last = _pfMentoringOrder.length - 1;
    const namaTampil = m.nama_internal ? `${m.nama} | ${m.nama_internal}` : m.nama;
    return `<div class="modul-order-item" draggable="true" ondragstart="_pfMentoringDragStart(event,'${kode}')" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="event.preventDefault();this.classList.remove('drag-over');_pfMentoringDrop(event,'${kode}')" style="padding:10px;background:rgba(19,50,89,0.03);border-radius:10px;border:1.5px solid var(--accent);margin-bottom:6px" id="pfmentord-${kode}">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="cursor:grab;color:var(--text-sub);flex-shrink:0" title="Seret untuk urutkan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></span>
        <span style="font-weight:700;font-size:11px;color:var(--accent);width:18px;text-align:center;flex-shrink:0">${idx + 1}</span>
        <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:12px;color:var(--blue);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${namaTampil}</div></div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button type="button" class="btn-icon" title="Naik" ${idx === 0 ? 'disabled style="opacity:.35;cursor:not-allowed"' : ''} onclick="_pfMentoringMove('${kode}',-1)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg></button>
          <button type="button" class="btn-icon" title="Turun" ${idx === last ? 'disabled style="opacity:.35;cursor:not-allowed"' : ''} onclick="_pfMentoringMove('${kode}',1)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg></button>
          <button type="button" class="btn-icon danger" title="Batalkan pilihan" onclick="_pfMentoringRemoveSelected('${kode}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      </div>
    </div>`;
}
function _pfMentoringMove(kode, dir) {
    const idx = _pfMentoringOrder.indexOf(kode); if (idx < 0) return;
    const ni = idx + dir; if (ni < 0 || ni >= _pfMentoringOrder.length) return;
    [_pfMentoringOrder[idx], _pfMentoringOrder[ni]] = [_pfMentoringOrder[ni], _pfMentoringOrder[idx]];
    _pfSyncMentoringHiddenInputs();
    _renderPfMentoringOrderList();
}
function _pfMentoringRemoveSelected(kode) {
    _pfMentoringOrder = _pfMentoringOrder.filter(k => k !== kode);
    _pfSyncMentoringHiddenInputs();
    _renderPfMentoringOrderList();
}
function _pfMentoringDragStart(e, kode) { _pfMentoringDragFrom = kode; e.dataTransfer.effectAllowed = 'move'; }
function _pfMentoringDrop(e, kode) {
    if (_pfMentoringDragFrom === null || _pfMentoringDragFrom === kode) { _pfMentoringDragFrom = null; return; }
    const fromIdx = _pfMentoringOrder.indexOf(_pfMentoringDragFrom), toIdx = _pfMentoringOrder.indexOf(kode);
    _pfMentoringDragFrom = null;
    if (fromIdx < 0 || toIdx < 0) return;
    const moved = _pfMentoringOrder.splice(fromIdx, 1)[0];
    _pfMentoringOrder.splice(toIdx, 0, moved);
    _pfSyncMentoringHiddenInputs();
    _renderPfMentoringOrderList();
}
// Tulis ulang hidden checkbox name="pf-aturan" berurutan sesuai _pfMentoringOrder.
// submitPaket() baca semua input[name="pf-aturan"]:checked apa adanya sesuai urutan
// DOM, jadi urutan modul otomatis kebawa ke aturan_akses tanpa ubah logic submit.
function _pfSyncMentoringHiddenInputs() {
    const el = document.getElementById('pf-mentoring-order-inputs'); if (!el) return;
    el.innerHTML = _pfMentoringOrder.map(kode => `<input type="checkbox" name="pf-aturan" value="mentoring.modul.${kode}" checked style="display:none">`).join('');
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
    document.querySelectorAll('input[name="pf-hak"]').forEach(cb=>cb.checked=true);
    document.querySelectorAll('input[name="pf-aturan"]').forEach(cb=>cb.checked=false);
    document.querySelectorAll('.hak-sub').forEach(s=>{s.style.display='none';});
    document.querySelectorAll('.hak-chevron').forEach(c=>{c.style.transform='';});
    _pfSyncHakContentWraps(['ujian','laporan','modul','mentoring']);
    var mk=document.getElementById('pf-mentoring-kuota');if(mk)mk.value='';
    await Promise.all([_pfLoadModulPicker([]), _pfLoadMentoringPicker([])]);
    await _populateLinkLandingDropdown('');
    openModal('paket-form-overlay');
    _pfDraftSave();
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
    // CAT ('ujian') & HISTORI ('laporan') selalu ON — akses dasar yg nggak bisa
    // dimatikan per paket (switch-nya sendiri sudah disabled+checked di HTML),
    // jadi nggak baca dari hakArr sama sekali, termasuk utk paket lama yg belum
    // punya kedua value ini di hak_akses tersimpannya.
    document.querySelectorAll('input[name="pf-hak"]').forEach(cb=>{
        cb.checked = (cb.value === 'ujian' || cb.value === 'laporan') ? true : hakArr.includes(cb.value);
    });
    document.querySelectorAll('input[name="pf-aturan"]').forEach(cb=>{cb.checked=aturanArr.includes(cb.value);});
    document.querySelectorAll('.hak-sub').forEach(s=>{s.style.display='none';});
    document.querySelectorAll('.hak-chevron').forEach(c=>{c.style.transform='';});
    _pfSyncHakContentWraps(hakArr);
    var mk=document.getElementById('pf-mentoring-kuota');if(mk)mk.value=p.mentoring_kuota||'';
    await Promise.all([_pfLoadModulPicker(aturanArr.filter(v => v.startsWith('modul.item.'))), _pfLoadMentoringPicker(aturanArr.filter(v => v.startsWith('mentoring.modul.')))]);
    await _populateLinkLandingDropdown(p.link_landing || '');
    openModal('paket-form-overlay');
    _pfDraftSave();
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
