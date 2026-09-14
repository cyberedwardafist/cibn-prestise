// admin/paket-form.js
// Form Tambah/Edit Paket (fullscreen) — dipisah dari admin/keuangan.js supaya
// file keuangan.js tetap ringan; ini isinya cuma logic buka/isi/submit form.
// Markup-nya ada di admin/paket-form.html (dimuat bareng sebagai 'modals'
// lewat ADMIN_PAGE_MODULES.keuangan di js/app.js).
// Butuh _paketData (dideklarasikan di admin/keuangan.js) serta
// helper global dari js/app.js (showToast, openModal, closeModal, dst).
// Widget kalender utk Periode=Custom ada di admin/paket-daterange.js (fungsi
// onPaketPeriodeChange/initPaketDateRange/paketPeriodeDiffDays dipakai di sini).

const PAKET_PERIODE_PRESET = ['/bulan', '/tahun', '/hari', 'sekali bayar'];

// ── PRATINJAU LANDING PAGE (kartu #pf-preview-card di admin/keuangan/paket-form.html) ──
// Markup yang dihasilkan di sini SENGAJA dibuat semirip mungkin dgn pkgCardHTML()
// di public/paket.html (class pkg-name/pkg-desc/pkg-price/pkg-features/pkg-cta,
// cuma dibungkus .pf-pkg-card supaya CSS-nya ke-scope terpisah) — biar admin bisa
// lihat kira-kira tampilan akhirnya sebelum Simpan, TANPA nyentuh section Hak Akses
// sama sekali (preview ini murni baca field2 non-hak-akses di atasnya).
function _pfEscHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── IKON PAKET (gambar square, menggantikan input teks emoji lama) ──
// Polanya SAMA PERSIS dengan upload gambar di Soal (admin/soal/soal.js,
// onItemImageSelected): begitu file dipilih, LANGSUNG di-upload ke server lewat
// apiUploadPaketIcon() (alur presigned: server cuma dimintai "link" via
// /api/upload-init, file-nya sendiri lewat langsung ke Supabase Storage) — yang
// akhirnya disimpan di #pf-icon (dan dikirim ke server saat Simpan Paket) adalah
// LINK hasil upload itu, bukan base64 mentah. Base64/data-url cuma dipakai
// SEMENTARA sbg preview instan sambil nunggu upload selesai, dan sbg fallback
// kalau server/storage tidak terjangkau (spt di Soal).
let _pfIconLiveUrl = null; // preview sementara (data-url) selama proses upload berlangsung
function _pfIconIsImageUrl(v) { return typeof v === 'string' && /^(https?:|data:)/i.test(v); }
// Nilai yg lagi "aktif" ditampilkan (preview sementara kalau lagi upload, kalau
// tidak ya nilai (link) yg sudah tersimpan di #pf-icon) — dipakai bareng oleh
// kotak upload kecil & kartu Pratinjau.
function _pfIconDisplayValue() { return _pfIconLiveUrl || document.getElementById('pf-icon')?.value || ''; }
function _pfRenderIconPreview() {
    const el = document.getElementById('pf-icon-preview'); if (!el) return;
    const val = _pfIconDisplayValue();
    if (_pfIconIsImageUrl(val)) {
        el.innerHTML = `<img src="${val}" alt="ikon paket">`;
    } else if (val) {
        // Ikon lawas berformat emoji/teks (dari sebelum fitur upload gambar ada) — tampilkan apa adanya.
        el.innerHTML = `<span>${_pfEscHtml(val)}</span>`;
    } else {
        el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="20" height="20"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="9" r="1.8"/><path d="M21 15l-5-5L5 21"/></svg>`;
    }
}
async function onPfIconFileSelected(input) {
    const file = input.files[0]; if (!file) return;
    input.value = ''; // biar pilih file yg sama lagi tetap memicu onchange

    // Preview instan pakai base64 SAMBIL nunggu upload ke server kelar.
    const reader = new FileReader();
    reader.onload = e => { _pfIconLiveUrl = e.target.result; _pfRenderIconPreview(); _pfUpdatePreview(); };
    reader.readAsDataURL(file);
    setDirty('paket');

    const box = document.getElementById('pf-icon-preview');
    if (box) box.style.opacity = '.5';
    // CATATAN: TIDAK kirim oldUrl di sini (beda dari ebook-modul-poster) — file
    // lama baru dihapus dari storage kalau paket-nya BENERAN disimpan (lihat
    // PUT /api/pakets/:kode di server.js, banding old.icon vs icon baru), bukan
    // langsung saat file dipilih. Kalau admin batal/tutup form tanpa Simpan,
    // ikon lama yg masih tersimpan di database jadi tidak ikut kehapus.
    const res = await apiUploadPaketIcon(file);
    if (box) box.style.opacity = '';

    if (res && res.url) {
        // Upload sukses -> simpan LINK-nya (bukan base64) di #pf-icon.
        document.getElementById('pf-icon').value = res.url;
        _pfIconLiveUrl = null;
        _pfRenderIconPreview();
        _pfUpdatePreview();
        return;
    }
    if (res && (res.rejected || res.error)) {
        showToast('Upload ikon ditolak: ' + (res.error || 'server menolak file ini'), 'danger');
        _pfIconLiveUrl = null;
        _pfRenderIconPreview();
        return;
    }
    // Server/storage tak terjangkau (offline dll) -> fallback tetap simpan base64
    // sementara (spt di Soal), biar gambar yg baru dipilih tidak hilang begitu saja.
    document.getElementById('pf-icon').value = _pfIconLiveUrl;
    _pfIconLiveUrl = null;
    _pfRenderIconPreview();
    _pfUpdatePreview();
}
function _pfPreviewPeriodeText() {
    const sel = document.getElementById('pf-periode');
    if (!sel) return '';
    if (sel.value === 'custom') {
        return (typeof PaketCalState !== 'undefined' && PaketCalState && typeof paketPeriodeDiffDays === 'function')
            ? ('/' + paketPeriodeDiffDays() + ' hari') : '';
    }
    return sel.value;
}
function _pfUpdatePreview() {
    const card = document.getElementById('pf-preview-card');
    if (!card) return;
    const nama = document.getElementById('pf-nama')?.value.trim() || 'Nama Paket';
    const icon = _pfIconDisplayValue();
    const iconHtml = _pfIconIsImageUrl(icon) ? `<img class="pkg-icon-img" src="${icon}" alt="">` : (icon ? _pfEscHtml(icon) + ' ' : '');
    const desc = document.getElementById('pf-desc')?.value.trim() || 'Deskripsi singkat paket akan tampil di sini.';
    const hargaRaw = parseInt(document.getElementById('pf-harga')?.value || '0') || 0;
    const popular = !!document.getElementById('pf-popular')?.checked;
    const fiturRaw = document.getElementById('pf-fitur')?.value || '';
    const fitur = fiturRaw.split('\n').map(s => s.trim()).filter(Boolean);
    const priceText = hargaRaw > 0 ? ('Rp ' + hargaRaw.toLocaleString('id-ID')) : 'Hubungi Kami';
    const periodeText = hargaRaw > 0 ? _pfPreviewPeriodeText() : '';

    card.classList.toggle('featured', popular);
    card.innerHTML = `
      ${popular ? '<div class="pkg-badge">Paling Diminati</div>' : ''}
      <div class="pkg-name serif">${iconHtml}${_pfEscHtml(nama)}</div>
      <p class="pkg-desc">${_pfEscHtml(desc)}</p>
      <div class="pkg-price"><b>${_pfEscHtml(priceText)}</b> <span>${_pfEscHtml(periodeText)}</span></div>
      <ul class="pkg-features">${fitur.length ? fitur.map(f => `<li>${_pfEscHtml(f)}</li>`).join('') : '<li style="opacity:.55">Belum ada fitur ditambahkan</li>'}</ul>
      <div class="pkg-cta">Pilih Paket</div>`;
}
// Swatch warna aksen (.pf-warna-dot) — select #pf-warna tetap satu2nya sumber
// nilai yang dibaca submitPaket(), swatch cuma UI cepat buat ganti isinya.
function _pfSetWarna(w) {
    const sel = document.getElementById('pf-warna');
    if (sel) sel.value = w;
    _pfSyncWarnaSwatch();
    setDirty('paket');
}
function _pfSyncWarnaSwatch() {
    const val = document.getElementById('pf-warna')?.value || 'blue';
    document.querySelectorAll('.pf-warna-dot').forEach(d => d.classList.toggle('active', d.dataset.w === val));
}

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
            mentoringKuotaBatal: document.getElementById('pf-mentoring-kuota-batal')?.value || '',
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
    // Draft cuma menyimpan link ikon yg SUDAH tersimpan di server (lihat catatan
    // di _pfDraftSave) — link ini sudah final (upload terjadi instan saat file
    // dipilih), jadi cukup di-render ulang, tidak ada file pending yg perlu diurus.
    _pfIconLiveUrl = null; _pfRenderIconPreview();
    setVal('pf-desc', d.desc); setVal('pf-fitur', d.fitur); setVal('pf-warna', d.warna);
    setVal('pf-link-landing', d.linkLanding); setVal('pf-mentoring-kuota', d.mentoringKuota); setVal('pf-mentoring-kuota-batal', d.mentoringKuotaBatal);
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
        _pfLoadMentoringPicker(aturan.filter(v => v.startsWith('mentoring.')))
    ]);
    document.querySelectorAll('input[name="pf-aturan"]').forEach(cb => {
        if (cb.value.startsWith('modul.item.') || cb.value.startsWith('mentoring.')) return;
        cb.checked = aturan.includes(cb.value);
    });
    _pfSyncWarnaSwatch();
    _pfUpdatePreview();
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
    if (q) data = data.filter(m => (m.nama || '').toLowerCase().includes(q) || (m.nama_internal || '').toLowerCase().includes(q));
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

// ── PICKER "Mentoring & Konsultasi" — materi sesi mentoring sekarang dipilih
// LANGSUNG dari master data Management > Materi (tabel `materi`), BUKAN lagi
// dirakit manual dari modul per-paket seperti sebelumnya. Dengan begini,
// materi yang dicentang di sini otomatis "membawa" guru yang sudah ditautkan
// ke materi itu di Management > Guru (tabel guru_paket_grup) — lihat GET
// /api/jadwal-meta di server.js buat logic penggabungan materi guru per user
// (irisan materi guru dgn union materi semua paket aktif user, lihat
// materiPaketAktifUser()). Modul DI DALAM tiap materi (buat nanti generate
// token otomatis per-modul ke user) SENGAJA belum disentuh di sini — scope
// update ini cuma sampai level materi dulu.
// Materi terpilih disimpan lewat hidden checkbox name="pf-aturan" value=
// "mentoring.materi.<kode_materi>" (1 baris per materi, kode_materi = kode
// asli dari tabel `materi`) — submitPaket() baca semua checkbox pf-aturan:
// checked apa adanya, jadi format ini otomatis kebawa ke aturan_akses tanpa
// ubah logic submit.
let _pfMentoringMateriMaster = [], _pfMentoringKelompokList = [];
let _pfMentoringPickerSearch = '', _pfMentoringPickerKelompokFilter = 'all';
let _pfMentoringSelected = []; // kode materi terpilih buat paket ini

// Parse checkbox pf-aturan (mentoring.materi.*) balik jadi array kode materi.
// Data lama (format "mentoring.materi.<id>.nama::..." / ".modul.<kode>", dari
// sebelum picker ini diganti ke master materi) SENGAJA tidak dipetakan —
// id lokal lama tidak nyambung ke kode materi asli di tabel `materi`, jadi
// diabaikan; admin perlu pilih ulang materinya lewat picker baru ini kalau
// paket lama masih pakai format lama.
function _pfParseMentoringAturan(aturanArr = []) {
    return aturanArr
        .filter(v => v.startsWith('mentoring.materi.') && !v.includes('::') && !v.includes('.modul.'))
        .map(v => v.replace('mentoring.materi.', ''));
}

async function _pfLoadMentoringPicker(mentoringAturan = []) {
    _pfMentoringSelected = _pfParseMentoringAturan(mentoringAturan);
    [_pfMentoringMateriMaster, _pfMentoringKelompokList] = await Promise.all([
        MateriAPI.getAll().catch(() => []),
        MateriKelompokAPI.getAll().catch(() => [])
    ]);
    // Info guru per materi (read-only) DIHAPUS dari picker ini — sekarang guru
    // sudah dikelola sbg "paket" tersendiri di slide dock Management > Guru
    // (guru-paket-grup), jadi gaperlu ditampilin lagi per-materi di sini juga
    // (dulu dicoba lewat GuruPaketGrupAPI + UsersAPI.getByRole('review'), sudah
    // dibuang berikut variabel _pfMentoringGuruPerMateri-nya).
    _pfSyncMentoringHiddenInputs();
    _renderPfMentoringPickerFilters();
    _renderPfMentoringPicker();
}

function _renderPfMentoringPickerFilters() {
    if (!document.getElementById('pf-mentoring-picker-filters')) return;
    const options = [{ value: 'all', label: 'Semua Kelompok' }, { value: 'none', label: 'Tanpa Kelompok' }, ..._pfMentoringKelompokList.map(k => ({ value: k.kode, label: k.nama }))];
    renderFilterDropdown('pf-mentoring-picker-filters', { title: 'Kelompok', options, current: _pfMentoringPickerKelompokFilter, onSelect: v => { _pfMentoringPickerKelompokFilter = v; _renderPfMentoringPickerFilters(); _renderPfMentoringPicker(); } });
}
// Daftar materi (master, dari Management > Materi) dgn search + filter kelompok
// — centang buat memasukkan materi itu ke paket ini. Info guru per materi
// SENGAJA tidak ditampilkan lagi di sini (lihat catatan di _pfLoadMentoringPicker);
// guru sekarang dikelola per-paket di Management > Guru, bukan per-materi.
function _renderPfMentoringPicker() {
    const el = document.getElementById('pf-mentoring-picker-list'); if (!el) return;
    if (!_pfMentoringMateriMaster.length) { el.innerHTML = '<p style="color:var(--text-sub);font-size:12px">Belum ada materi. Buat dulu di menu Management &gt; Materi.</p>'; return; }
    let data = _pfMentoringMateriMaster;
    const q = (_pfMentoringPickerSearch || '').toLowerCase();
    if (q) data = data.filter(m => (m.nama || '').toLowerCase().includes(q) || (m.nama_internal || '').toLowerCase().includes(q));
    if (_pfMentoringPickerKelompokFilter === 'none') data = data.filter(m => !m.kelompok);
    else if (_pfMentoringPickerKelompokFilter !== 'all') data = data.filter(m => m.kelompok === _pfMentoringPickerKelompokFilter);
    const info = `<div style="font-size:10px;color:var(--text-sub);margin-bottom:6px">Terpilih ${_pfMentoringSelected.length} materi</div>`;
    el.innerHTML = info + (data.length ? data.map(m => _pfMentoringPickCardHtml(m)).join('') : '<p style="color:var(--text-sub);font-size:12px">Tidak ada materi yang cocok.</p>');
}
function _pfMentoringKelompokNama(kode) { const k = _pfMentoringKelompokList.find(x => x.kode === kode); return k ? k.nama : ''; }
function _pfMentoringPickCardHtml(m) {
    const kode = m.kode;
    const ck = _pfMentoringSelected.includes(kode);
    const kelNama = _pfMentoringKelompokNama(m.kelompok);
    const namaTampil = m.nama_internal ? `${m.nama} | ${m.nama_internal}` : m.nama;
    return `<label class="ebook-pick-item${ck ? ' checked' : ''}" id="pfmentpick-${kode}">
      <input type="checkbox" ${ck ? 'checked' : ''} onchange="_pfToggleMentoringPick('${kode}',this.checked)" style="accent-color:var(--blue);width:16px;height:16px;flex-shrink:0">
      <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px;color:var(--blue);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${namaTampil}</div><div style="font-size:11px;color:var(--text-sub)">${kelNama || kode}</div></div>
    </label>`;
}
function _pfToggleMentoringPick(kode, ck) {
    if (ck) { if (!_pfMentoringSelected.includes(kode)) _pfMentoringSelected.push(kode); }
    else { _pfMentoringSelected = _pfMentoringSelected.filter(k => k !== kode); }
    _pfSyncMentoringHiddenInputs();
    setDirty('paket');
    const elc = document.getElementById(`pfmentpick-${kode}`); if (elc) elc.classList.toggle('checked', ck);
}
function onPfMentoringKuotaChange() { setDirty('paket'); }

// Tulis ulang hidden checkbox name="pf-aturan" sesuai _pfMentoringSelected —
// submitPaket() baca semua input[name="pf-aturan"]:checked apa adanya
// (document order), jadi materi terpilih otomatis kebawa ke aturan_akses
// tanpa ubah logic submit.
function _pfSyncMentoringHiddenInputs() {
    const el = document.getElementById('pf-mentoring-order-inputs'); if (!el) return;
    el.innerHTML = _pfMentoringSelected.map(kode => `<input type="checkbox" name="pf-aturan" value="mentoring.materi.${kode}" checked style="display:none">`).join('');
}

async function openAddPaket() {
    _editPaketKode = null;
    document.getElementById('paket-form-title').textContent = 'Tambah Paket';
    document.getElementById('pf-id').value = '';
    document.getElementById('pf-nama').value = '';
    document.getElementById('pf-icon').value = '';
    _pfIconLiveUrl = null; _pfRenderIconPreview();
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
    // Konten Hak Akses (.hak-sub) sekarang SELALU tampil di markup (bukan accordion
    // klik-buka lagi — lihat admin/keuangan/paket-form.html), jadi tidak perlu di-reset
    // ke display:none / transform chevron di sini seperti sebelumnya.
    _pfSyncHakContentWraps(['ujian','laporan','modul','mentoring']);
    var mk=document.getElementById('pf-mentoring-kuota');if(mk)mk.value='';
    var mkb=document.getElementById('pf-mentoring-kuota-batal');if(mkb)mkb.value='';
    await Promise.all([_pfLoadModulPicker([]), _pfLoadMentoringPicker([])]);
    document.getElementById('pf-link-landing').value = ''; // paket baru: belum pernah dihubungkan
    _pfSyncWarnaSwatch();
    _pfUpdatePreview();
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
    document.getElementById('pf-icon').value = p.icon || '';
    _pfIconLiveUrl = null; _pfRenderIconPreview();
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
    // Paket lama yang belum pernah disimpan lewat form "Hak Akses Paket" ini
    // punya hak_akses NULL di database -> hakArr jadi [] kalau dibaca apa
    // adanya, padahal SEMUA switch defaultnya menyala. Jadi khusus utk kasus
    // "belum pernah disimpan sama sekali" (p.hak_akses kosong/null), anggap
    // semua switch menyala (bukan hasil interpretasi array kosong = semua mati).
    const hakBelumPernahDisimpan = !p.hak_akses;
    document.querySelectorAll('input[name="pf-hak"]').forEach(cb=>{
        cb.checked = hakBelumPernahDisimpan ? true : hakArr.includes(cb.value);
    });
    document.querySelectorAll('input[name="pf-aturan"]').forEach(cb=>{cb.checked=aturanArr.includes(cb.value);});
    // Konten Hak Akses (.hak-sub) sekarang SELALU tampil di markup (bukan accordion
    // klik-buka lagi — lihat admin/keuangan/paket-form.html), jadi tidak perlu di-reset
    // ke display:none / transform chevron di sini seperti sebelumnya.
    _pfSyncHakContentWraps(hakArr);
    var mk=document.getElementById('pf-mentoring-kuota');if(mk)mk.value=p.mentoring_kuota||'';
    var mkb=document.getElementById('pf-mentoring-kuota-batal');if(mkb)mkb.value=p.mentoring_kuota_batal||'';
    await Promise.all([_pfLoadModulPicker(aturanArr.filter(v => v.startsWith('modul.item.'))), _pfLoadMentoringPicker(aturanArr.filter(v => v.startsWith('mentoring.')))]);
    // Field "Gabungkan dengan Paket Landing Page" sudah dihilangkan dari
    // tampilan form ini — hidden input #pf-link-landing cuma mempertahankan
    // nilai lama paket ini apa adanya (kalau sebelumnya sudah pernah
    // dihubungkan) supaya tidak ke-reset kosong saat disimpan ulang.
    document.getElementById('pf-link-landing').value = p.link_landing || '';
    _pfSyncWarnaSwatch();
    _pfUpdatePreview();
    openModal('paket-form-overlay');
    _pfDraftSave();
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
        icon: document.getElementById('pf-icon').value.trim() || null,
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
        mentoring_kuota: document.getElementById('pf-mentoring-kuota')?.value || '',
        mentoring_kuota_batal: document.getElementById('pf-mentoring-kuota-batal')?.value || ''
    };
    const btn = document.querySelector('#paket-form-overlay .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
    try {
        // Ikon paket SUDAH diupload duluan (link-nya sudah ada di #pf-icon)
        // begitu file dipilih di kotak upload — lihat onPfIconFileSelected().
        // Sama seperti gambar di editor Soal: yang dikirim ke sini tinggal link-nya.
        if (_editPaketKode) {
            await PaketAPI.update(_editPaketKode, paket);
            showToast('Paket diperbarui!', 'success');
        } else {
            await PaketAPI.create(paket);
            showToast('Paket ditambahkan!', 'success');
        }
        _pfIconLiveUrl = null;
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
