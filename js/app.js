/* app.js v2 - Core: navigation, state, modal, toast */
const AppState = { currentPage: 'home', currentSubPage: {}, isDirty: false, dirtyContext: null, pendingNav: null, pendingModalClose: null };

function showToast(msg, type='', dur=2600) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
    t.textContent = msg; t.className = 'toast' + (type?' '+type:'');
    void t.offsetWidth; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove('show'), dur);
}

function navigateTo(pageId, subId=null) {
    if (AppState.isDirty) { AppState.pendingNav={pageId,subId}; showLeaveConfirm(); return; }
    _doNav(pageId, subId);
}

function _persistAdminNav() {
    try { localStorage.setItem('cbn_admin_navstate', JSON.stringify({ page: AppState.currentPage, sub: AppState.currentSubPage })); } catch(e) {}
}

function _doNav(pageId, subId) {
    if (pageId !== 'soal') { document.body.classList.remove('soal-building'); document.getElementById('page-soal')?.classList.remove('dock-avoid-center'); }
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.dock-item').forEach(d=>d.classList.remove('active-tab'));
    document.querySelectorAll('.dock-more-item').forEach(d=>d.classList.remove('active'));
    const page = document.getElementById('page-'+pageId);
    if (page) page.classList.add('active');
    const dock = document.querySelector(`[data-page="${pageId}"]`);
    if (dock) dock.classList.add('active-tab');
    AppState.currentPage = pageId;
    _persistAdminNav();
    if (typeof syncSideDockForPage === 'function') syncSideDockForPage(pageId);
    if (typeof syncLandingDockForPage === 'function') syncLandingDockForPage(pageId);
    closeDockMore();
    // subId (sub-tab) sengaja DITUNGGU sampai modul halaman ini selesai lazy-load
    // (lihat renderPage) sebelum switchSubPage dipanggil — kalau tidak, di koneksi
    // lambat fungsi renderAkunSub/renderTokenSub dkk bisa saja belum ke-define.
    renderPage(pageId, subId);
}

function renderPage(id, subId) {
    ensureAdminPageModule(id).then(() => {
        // PENTING: peta ini pakai NAMA (string), bukan referensi fungsi langsung.
        // Kalau ditulis { akun:renderAkun, token:renderToken, ... } maka SEMUA
        // identifier itu di-evaluasi saat baris ini jalan — padahal modul lazy-load
        // lain (yang belum pernah dibuka user) belum define fungsinya sama sekali,
        // jadi langsung ReferenceError sebelum sempat cek map[id]. Dengan string +
        // window[...], cuma nama fungsi utk id yang sedang aktif yang di-resolve,
        // dan modul-nya sudah pasti sudah dimuat oleh ensureAdminPageModule di atas.
        const map = { home:'renderHome', akun:'renderAkun', token:'renderToken', laporan:'renderLaporan', soal:'renderSoal', library:'renderLibrary', modul:'renderModul', landing:'renderLanding', keuangan:'renderKeuangan', 'akun-admin':'renderAkunAdmin', review:'renderReviewPage', buku:'renderBuku', 'ebook-library':'renderEbookLibrary', 'ebook-modul':'renderEbookModul', 'analisa-token':'renderAnalisaToken', 'analisa-token-detail':'renderAnalisaTokenDetail' };
        const fn = map[id] && window[map[id]];
        if (typeof fn === 'function') fn();
        if (subId) switchSubPage(id, subId);
    }).catch(err => {
        console.error('[lazy-load] Gagal memuat modul halaman "'+id+'":', err);
        showToast('Gagal memuat halaman ini, coba muat ulang', 'danger');
    });
}

// ── LAZY-LOAD PER TAB ──────────────────────────────────────────────────────
// Peta tab admin -> fragmen HTML + file JS yang dibutuhkannya. 'home' sengaja
// tidak ada di sini karena sudah dimuat eager (lihat admin/home/home.js di shell).
// Beberapa tab berbagi 1 file JS yang sama (mis. buku/ebook-library/ebook-modul
// sama-sama pakai js/ebook.js) — LazyLoader.loadMany men-dedup per-URL otomatis,
// jadi file itu cuma benar-benar di-fetch sekali walau 3 tab memakainya.
// RAPI PER FUNGSI DOCK: tiap tab kini disimpan satu folder bareng fragmen
// dan JS-nya sendiri (mis. admin/akun/akun.html + admin/akun/akun.js),
// bukan tercecer di admin/ langsung. Tab yang satu grup dock (CAT: token/
// laporan/review, SOAL: soal/library/modul, E-BOOK: buku/ebook-library/
// ebook-modul) tetap satu folder gabungan karena JS-nya memang saling
// dipakai bersama.
const ADMIN_PAGE_MODULES = {
    akun:            { html: 'admin/akun/akun.html',            js: ['admin/akun/akun.js', 'admin/akun/akun-signup.js'], modals: 'admin/akun/akun-modals.html' },
    'akun-admin':    { html: 'admin/akun-admin/akun-admin.html',js: ['admin/akun-admin/akun-admin.js'] },
    // token butuh admin/cat/laporan.js + shared-export.js juga: modal "detail token
    // terpakai" punya tombol Review yang manggil openReviewLaporan() (didefinisikan
    // di laporan.js), dan tombol unduh di dalamnya butuh shared-export.js.
    token:           { html: 'admin/cat/token.html',            js: ['admin/cat/shared-export.js', 'admin/cat/laporan.js', 'admin/cat/token.js'], modals: 'admin/cat/token-modals.html' },
    laporan:         { html: 'admin/cat/laporan.html',          js: ['admin/cat/shared-export.js', 'admin/cat/laporan.js'], modals: 'admin/cat/laporan-modals.html' },
    review:          { html: 'admin/cat/review.html',           js: ['admin/cat/shared-export.js', 'admin/cat/review.js'], modals: 'admin/cat/review-modals.html' },
    // soal/library/modul (fitur bank-soal) saling panggil fungsi satu sama lain
    // (mis. library.js pakai helper dari soal.js, modul.js pakai helper dari
    // library.js, soal.js refresh renderLibrary), jadi ketiganya dimuat sebagai
    // satu bundel JS+modal supaya tidak ada risiko "function is not defined" —
    // tapi fragmen HTML halamannya sendiri tetap terpisah per tab.
    soal:            { html: 'admin/soal/soal.html',            js: ['admin/soal/editor.js', 'admin/soal/soal.js', 'admin/soal/library.js', 'admin/soal/modul.js'], modals: 'admin/soal/soal-modals.html' },
    library:         { html: 'admin/soal/library.html',         js: ['admin/soal/editor.js', 'admin/soal/soal.js', 'admin/soal/library.js', 'admin/soal/modul.js'], modals: 'admin/soal/soal-modals.html' },
    modul:           { html: 'admin/soal/modul.html',           js: ['admin/soal/editor.js', 'admin/soal/soal.js', 'admin/soal/library.js', 'admin/soal/modul.js'], modals: 'admin/soal/soal-modals.html' },
    buku:            { html: 'admin/ebook/buku.html',           js: ['admin/ebook/ebook.js'], modals: 'admin/ebook/ebook-modals.html' },
    'ebook-library': { html: 'admin/ebook/ebook-library.html',  js: ['admin/ebook/ebook.js'], modals: 'admin/ebook/ebook-modals.html' },
    'ebook-modul':   { html: 'admin/ebook/ebook-modul.html',    js: ['admin/ebook/ebook.js'], modals: 'admin/ebook/ebook-modals.html' },
    landing:         { html: 'admin/landing/landing.html',      js: ['admin/landing/landing.js'], modals: 'admin/landing/landing-modals.html' },
    'analisa-token':        { html: 'admin/analisa/analisa-token.html',        js: ['admin/analisa/analisa-token.js'] },
    'analisa-token-detail': { html: 'admin/analisa/analisa-token-detail.html', js: ['admin/analisa/analisa-token-detail.js'] },    // Form Tambah/Edit Paket dipisah dari keuangan.js/keuangan-modals.html jadi
    // admin/keuangan/paket-form.js + admin/keuangan/paket-form.html (tampil
    // fullscreen) — biar file keuangan.js tetap ringan tiap kali cuma form
    // paket-nya yang diubah.
    keuangan:        { html: 'admin/keuangan/keuangan.html',    js: ['admin/keuangan/keuangan.js', 'admin/keuangan/paket-form.js', 'admin/keuangan/paket-daterange.js'], modals: 'admin/keuangan/paket-form.html' },
};
function ensureAdminPageModule(pageId) {
    const spec = ADMIN_PAGE_MODULES[pageId];
    if (!spec) return Promise.resolve(); // 'home' atau id tak dikenal — tidak ada yang perlu dimuat
    const container = document.getElementById('page-' + pageId);
    const assets = [];
    if (container) assets.push({ url: '/' + spec.html, container });
    spec.js.forEach(url => assets.push({ url: '/' + url }));
    if (spec.modals) {
        const slot = document.getElementById('lazy-modals-slot');
        if (slot) assets.push({ url: '/' + spec.modals, container: slot, append: true });
    }
    return LazyLoader.loadMany(assets);
}

function switchSubPage(pageId, subId) {
    const cont = document.getElementById('page-'+pageId); if(!cont) return;
    cont.querySelectorAll('.sub-tab').forEach(t=>t.classList.toggle('active', t.dataset.sub===subId));
    cont.querySelectorAll('.sub-page').forEach(p=>p.classList.toggle('active', p.id===`sub-${pageId}-${subId}`));
    AppState.currentSubPage[pageId] = subId;
    _persistAdminNav();
    // render sub
    if (pageId==='akun') renderAkunSub(subId);
    else if (pageId==='token') renderTokenSub(subId);
}

function setDirty(ctx='perubahan') {
    AppState.isDirty=true; AppState.dirtyContext=ctx;
    // Form Tambah/Edit Paket punya draft sendiri (localStorage cbn_paket_draft,
    // lihat admin/keuangan/paket-form.js) yang di-refresh tiap ada perubahan di form itu,
    // sama seperti pola draft Soal Builder di bawah.
    if (ctx === 'paket' && typeof _pfQueueAutoSave === 'function') _pfQueueAutoSave();
}
function clearDirty() { AppState.isDirty=false; AppState.dirtyContext=null; }

// Peringatan bawaan browser saat mau refresh/tutup tab padahal ada form yang
// masih "kotor" (belum diklik Simpan). Teks dialognya sendiri tidak bisa
// dikustomisasi (dibatasi browser demi keamanan) — cuma bisa memicu/tidak.
window.addEventListener('beforeunload', (e) => {
    if (!AppState.isDirty) return;
    e.preventDefault();
    e.returnValue = '';
});

function showLeaveConfirm() {
    document.getElementById('leave-msg').textContent = `Yakin ingin membatalkan proses ${AppState.dirtyContext||'perubahan'}? Data yang diisi akan hilang.`;
    document.getElementById('leave-overlay').classList.add('open');
}
function closeLeaveConfirm() { document.getElementById('leave-overlay').classList.remove('open'); AppState.pendingNav=null; AppState.pendingModalClose=null; }
function confirmLeave() {
    // Soal Builder punya draft tersendiri di localStorage (cbn_soal_draft) yang
    // dipulihkan otomatis sekali tiap kali aplikasi di-reload (lihat js/soal.js).
    // Kalau user membatalkan lewat popup navigasi generik ini (bukan lewat tombol
    // "Batal" di dalam builder), draft itu HARUS ikut dibersihkan di sini juga —
    // kalau tidak, draft basi itu akan "hidup lagi" saat reload berikutnya dan
    // langsung menandai isDirty=true meski user belum melakukan apa-apa, sehingga
    // popup konfirmasi ini muncul lagi padahal user cuma mau pindah halaman.
    if (typeof _soalDraftClear === 'function') _soalDraftClear();
    if (typeof SoalState !== 'undefined') { SoalState.mode = 'setup'; SoalState._editors = {}; }
    clearDirty();
    // Sumber trigger dialog ini ada 2 kemungkinan (saling eksklusif): pindah tab
    // (pendingNav, lewat navigateTo) ATAU menutup modal form (pendingModalClose,
    // lewat closeModalCheckDirty). closeLeaveConfirm() di bawah ini mereset
    // keduanya, jadi baca dulu sebelum dipanggil.
    const modalToClose = AppState.pendingModalClose;
    const nav = AppState.pendingNav;
    closeLeaveConfirm();
    if (modalToClose) { closeModal(modalToClose); return; }
    if (nav) { _doNav(nav.pageId, nav.subId); }
}

// Dipakai oleh tombol X / Batal / klik-di-luar pada modal FORM yang mengisi
// AppState.isDirty lewat setDirty() (lihat DIRTY_TRACKED_OVERLAYS di bawah).
// Kalau form-nya masih "kotor", tampilkan dialog konfirmasi yang sama dengan
// yang dipakai navigateTo() — supaya saat dialog muncul, formnya MASIH terlihat
// di belakang (bukan setelah modal sudah tertutup duluan). Modal yang memang
// tidak pernah dirty (mis. modal hapus/detail) tetap pakai closeModal() biasa.
function closeModalCheckDirty(id) {
    if (AppState.isDirty) { AppState.pendingModalClose = id; showLeaveConfirm(); return; }
    closeModal(id);
}
// Daftar id overlay form yang input-nya memanggil setDirty() — dipakai supaya
// klik di luar modal (backdrop) juga lewat pengecekan dirty yang sama, bukan
// langsung closeOverlay() mentah-mentah.
const DIRTY_TRACKED_OVERLAYS = ['user-form-overlay', 'paket-form-overlay', 'modul-form-overlay', 'ebook-modul-form-overlay'];

function toggleDockMore() { document.getElementById('dock-more-menu')?.classList.toggle('open'); }
function closeDockMore() { document.getElementById('dock-more-menu')?.classList.remove('open'); }
document.addEventListener('click', e=>{
    const btn=document.getElementById('btn-dock-more'), menu=document.getElementById('dock-more-menu');
    if(menu&&!menu.contains(e.target)&&btn&&!btn.contains(e.target)) closeDockMore();
    // math-editor-overlay dikecualikan: overlay itu punya listener backdrop-click
    // sendiri di admin/soal/editor.js (_mathEditorRequestClose) yang juga menangani
    // konfirmasi "rumus akan hilang" kalau lagi ada isinya — supaya tidak dobel
    // handler yang saling berebut menutup modal yang sama.
    if(e.target.classList.contains('overlay')&&e.target.id!=='leave-overlay'&&e.target.id!=='math-editor-overlay'){
        if (DIRTY_TRACKED_OVERLAYS.includes(e.target.id)) closeModalCheckDirty(e.target.id);
        else closeOverlay(e.target);
    }
});

function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) {
    document.getElementById(id)?.classList.remove('open');
    // Modal ditutup (Batal/X/backdrop/berhasil Simpan) -> draft refresh-nya sudah
    // tidak relevan lagi, buang supaya tidak "hidup lagi" & salah nandain dirty
    // saat modal ini dibuka lagi dari nol nanti (lihat admin/keuangan/paket-form.js).
    if (id === 'paket-form-overlay' && typeof _pfDraftClear === 'function') _pfDraftClear();
    if (typeof _closeAllFilterDD === 'function') _closeAllFilterDD();
}
function openOverlay(el) { el.classList.add('open'); }
function closeOverlay(el) { el.classList.remove('open'); }

let _confirmCb = null;
let _confirmNoCb = null;
// opts opsional: { yesLabel, noLabel, noCb } — dipakai buat dialog custom (mis. "Ganti" / "Batal")
// tanpa mengubah pemanggilan showConfirm(title,msg,type,cb) yang sudah ada di seluruh project.
function showConfirm(title, msg, type='danger', cb=null, opts={}) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-msg').textContent = msg;
    document.getElementById('confirm-icon').className = 'confirm-icon ' + type;
    const yesBtn = document.getElementById('confirm-yes-btn');
    if (yesBtn) yesBtn.textContent = (opts && opts.yesLabel) || 'Ya, Lanjutkan';
    const noBtn = document.querySelector('#confirm-overlay .confirm-btns .btn-secondary');
    if (noBtn) noBtn.textContent = (opts && opts.noLabel) || 'Batal';
    _confirmCb = cb; _confirmNoCb = (opts && opts.noCb) || null;
    openModal('confirm-overlay');
}
async function handleConfirmYes() {
    closeModal('confirm-overlay');
    const cb = _confirmCb; _confirmCb = null; _confirmNoCb = null;
    if (cb) {
        try { await cb(); }
        catch (e) { showToast('Gagal: ' + (e.message || 'Terjadi kesalahan'), 'danger'); }
    }
}
function handleConfirmNo() {
    closeModal('confirm-overlay');
    const noCb = _confirmNoCb;
    _confirmCb = null; _confirmNoCb = null;
    if (noCb) { try { noCb(); } catch (e) {} }
}

function showFormResult(el, ok, msg) {
    const svgOk=`<svg class="form-result-svg anim-check" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="28" stroke-width="2.5" stroke="var(--success)" fill="rgba(22,163,74,0.1)"/><path d="M20 32 L28 40 L44 24" stroke="var(--success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="60" stroke-dashoffset="60" style="animation:checkAnim 0.5s 0.1s forwards"/></svg>`;
    const svgNo=`<svg class="form-result-svg anim-cross" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="28" stroke-width="2.5" stroke="var(--danger)" fill="rgba(220,38,38,0.1)"/><path d="M22 22 L42 42 M42 22 L22 42" stroke="var(--danger)" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="40" stroke-dashoffset="40" style="animation:crossAnim 0.4s 0.1s forwards"/></svg>`;
    el.innerHTML=`<div class="form-result">${ok?svgOk:svgNo}<p class="form-result-text">${msg}</p></div>`;
}

function renderQrToCanvas(canvas, text, size=200) {
    // Generate QR Code SUNGGUHAN (bukan gambar acak) pakai qrcode-gen.js supaya bisa
    // benar-benar dipindai oleh scanner (mis. fitur Scan QR di halaman peserta).
    const ctx=canvas.getContext('2d'); canvas.width=size; canvas.height=size;
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,size,size);
    if (typeof qrcode === 'undefined') {
        ctx.fillStyle='#dc2626'; ctx.font='12px sans-serif'; ctx.textAlign='center';
        ctx.fillText('Gagal membuat QR', size/2, size/2);
        return;
    }
    try {
        const qr = qrcode(0, 'M'); // typeNumber 0 = auto pilih ukuran yang pas buat panjang teksnya
        qr.addData(String(text));
        qr.make();
        const count = qr.getModuleCount();
        const cell = size / count;
        ctx.fillStyle='#133259';
        for (let r = 0; r < count; r++) {
            for (let c = 0; c < count; c++) {
                if (qr.isDark(r, c)) ctx.fillRect(Math.floor(c*cell), Math.floor(r*cell), Math.ceil(cell), Math.ceil(cell));
            }
        }
    } catch(e) {
        ctx.fillStyle='#dc2626'; ctx.font='12px sans-serif'; ctx.textAlign='center';
        ctx.fillText('Gagal membuat QR', size/2, size/2);
    }
}

function filterList(arr, q, fields) {
    if(!q) return arr; const ql=q.toLowerCase();
    return arr.filter(item=>fields.some(f=>item[f]&&String(item[f]).toLowerCase().includes(ql)));
}
function togglePwVis(id, btn) {
    const inp=document.getElementById(id); if(!inp) return;
    inp.type = inp.type==='password'?'text':'password';
    btn.innerHTML = inp.type==='text'
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}
function formatDate(s) { if(!s) return '-'; const d=new Date(s); return isNaN(d)?s:d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}); }
function formatDateTime(s) { if(!s) return '-'; const d=new Date(s); return isNaN(d)?s:d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})+' '+d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}); }

document.addEventListener('DOMContentLoaded', () => {
    let lastPage = 'home', lastSub = null;
    try {
        const saved = JSON.parse(localStorage.getItem('cbn_admin_navstate') || 'null');
        if (saved && saved.page && document.getElementById('page-' + saved.page)) {
            lastPage = saved.page;
            if (saved.sub && typeof saved.sub === 'object') AppState.currentSubPage = saved.sub;
            lastSub = AppState.currentSubPage[lastPage] || null;
        }
    } catch(e) {}
    _doNav(lastPage, lastSub);
});
// ══════════════ GENERIC FILTER DROPDOWN (ikon corong, hemat tempat) ══════════════
// Dipakai untuk filter kelompok (soal/modul/e-book) & filter tipe soal di Library Soal.
// Beberapa dropdown bisa hidup bersamaan; tiap satu diingat state-nya lewat containerId.
const _filterDD = {};
function renderFilterDropdown(containerId, { options, current, onSelect, title, groups }) {
    const wrap = document.getElementById(containerId); if (!wrap) return;
    // Bentuk lama (satu grup): options/current/onSelect langsung. Bentuk baru (multi-grup): groups[].
    const grpList = groups || [{ title, options, current, onSelect }];
    _filterDD[containerId] = { groups: grpList };
    const isActive = grpList.some(g => g.current && g.current !== 'all');
    // Panel lama (kalau lagi kebuka) sempat dipindah ke <body> oleh _toggleFilterDD — buang dulu biar gak dobel/nyangkut.
    const strayPanel = document.getElementById(`${containerId}-panel`);
    if (strayPanel && strayPanel.parentElement === document.body) strayPanel.remove();
    wrap.innerHTML = `<div class="filter-dd-wrap">
      <button type="button" class="filter-dd-btn${isActive ? ' active' : ''}" title="${title || 'Filter'}" onclick="_toggleFilterDD('${containerId}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        ${isActive ? '<span class="filter-dd-dot"></span>' : ''}
      </button>
      <div class="filter-dd-panel" id="${containerId}-panel" style="display:none">
        ${grpList.map((g, gi) => `${g.title ? `<div class="filter-dd-title">${g.title}</div>` : ''}${g.options.map(o => `<div class="filter-dd-item${o.value === g.current ? ' active' : ''}" onclick="_selectFilterDD('${containerId}',${gi},'${o.value}')">${o.label}</div>`).join('')}`).join('')}
      </div>
    </div>`;
}
// Panel dipindah ke <body> + position:fixed saat dibuka, supaya gak kepotong sama
// overflow-y:auto / transform milik ancestor-nya (mis. .modal), berapapun tinggi/pendek modal-nya.
function _closeAllFilterDD() {
    document.querySelectorAll('.filter-dd-panel').forEach(p => { p.style.display = 'none'; });
}
function _toggleFilterDD(containerId) {
    const panel = document.getElementById(`${containerId}-panel`); if (!panel) return;
    const willOpen = panel.style.display !== 'block';
    _closeAllFilterDD();
    if (!willOpen) return;
    // Cari tombol lewat containerId (bukan closest() dari panel), soalnya panel bisa udah
    // kepindah ke <body> dari kali sebelumnya dibuka — closest('.filter-dd-wrap') bakal null
    // dan jatuh ke fallback yang salah, bikin posisi ngaco (kepojok kiri-atas).
    const containerEl = document.getElementById(containerId);
    const btn = containerEl ? containerEl.querySelector('.filter-dd-btn') : null;
    if (btn) {
        const rect = btn.getBoundingClientRect();
        document.body.appendChild(panel);
        panel.style.position = 'fixed';
        panel.style.zIndex = '600';
        panel.style.top = (rect.bottom + 8) + 'px';
        panel.style.left = '-9999px';
        panel.style.right = 'auto';
        panel.style.display = 'block';
        const pw = panel.offsetWidth;
        let left = rect.right - pw; // rata kanan ke tombol, kayak posisi absolute lama
        if (left < 8) left = 8;
        if (left + pw > window.innerWidth - 8) left = Math.max(8, window.innerWidth - pw - 8);
        panel.style.left = left + 'px';
        // kalau kepanjangan ke bawah viewport, buka ke atas tombol aja
        const maxH = parseFloat(getComputedStyle(panel).maxHeight) || 280;
        if (rect.bottom + 8 + Math.min(panel.scrollHeight, maxH) > window.innerHeight - 8) {
            panel.style.top = Math.max(8, rect.top - 8 - Math.min(panel.scrollHeight, maxH)) + 'px';
        }
    } else {
        panel.style.display = 'block';
    }
}
function _selectFilterDD(containerId, groupIdx, value) {
    const conf = _filterDD[containerId]; if (!conf) return;
    const panel = document.getElementById(`${containerId}-panel`); if (panel) panel.style.display = 'none';
    conf.groups[groupIdx].onSelect(value);
}
document.addEventListener('click', e => {
    if (!e.target.closest('.filter-dd-wrap') && !e.target.closest('.filter-dd-panel')) _closeAllFilterDD();
});
window.addEventListener('resize', _closeAllFilterDD);
document.addEventListener('scroll', e => {
    // reposisi ketutup aja kalau area yg discroll bukan si panel-nya sendiri (biar list di dalam panel tetep bisa discroll)
    if (!e.target.closest || !e.target.closest('.filter-dd-panel')) _closeAllFilterDD();
}, true);