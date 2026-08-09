/* app.js v2 - Core: navigation, state, modal, toast */
const AppState = { currentPage: 'home', currentSubPage: {}, isDirty: false, dirtyContext: null, pendingNav: null };

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
    // Jika keluar dari halaman landing, tutup panel editor landing (vertikal) — main-dock tidak pernah disembunyikan
    if (AppState.currentPage === 'landing' && pageId !== 'landing') {
        const ldWrap = document.getElementById('landing-dock-wrap');
        if (ldWrap) ldWrap.classList.remove('open');
        const pc = document.querySelector('.page-container');
        if (pc) pc.style.overflow = '';
    }
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
        const map = { home:'renderHome', akun:'renderAkun', token:'renderToken', laporan:'renderLaporan', soal:'renderSoal', library:'renderLibrary', modul:'renderModul', landing:'renderLanding', keuangan:'renderKeuangan', 'akun-admin':'renderAkunAdmin', review:'renderReviewPage', buku:'renderBuku', 'ebook-library':'renderEbookLibrary', 'ebook-modul':'renderEbookModul' };
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
// tidak ada di sini karena sudah dimuat eager (lihat admin/home.js di shell).
// Beberapa tab berbagi 1 file JS yang sama (mis. buku/ebook-library/ebook-modul
// sama-sama pakai js/ebook.js) — LazyLoader.loadMany men-dedup per-URL otomatis,
// jadi file itu cuma benar-benar di-fetch sekali walau 3 tab memakainya.
const ADMIN_PAGE_MODULES = {
    akun:            { html: 'admin/akun.html',           js: ['js/akun.js', 'admin/akun-signup.js'], modals: 'admin/akun-modals.html' },
    'akun-admin':    { html: 'admin/akun-admin.html',     js: ['admin/akun-admin.js'] },
    // token butuh admin/laporan.js + shared-export.js juga: modal "detail token
    // terpakai" punya tombol Review yang manggil openReviewLaporan() (didefinisikan
    // di laporan.js), dan tombol unduh di dalamnya butuh shared-export.js.
    token:           { html: 'admin/token.html',          js: ['admin/shared-export.js', 'admin/laporan.js', 'js/token.js'], modals: 'admin/token-modals.html' },
    laporan:         { html: 'admin/laporan.html',        js: ['admin/shared-export.js', 'admin/laporan.js'], modals: 'admin/laporan-modals.html' },
    review:          { html: 'admin/review.html',         js: ['admin/shared-export.js', 'admin/review.js'], modals: 'admin/review-modals.html' },
    // soal/library/modul (fitur bank-soal) saling panggil fungsi satu sama lain
    // (mis. library.js pakai helper dari soal.js, modul.js pakai helper dari
    // library.js, soal.js refresh renderLibrary), jadi ketiganya dimuat sebagai
    // satu bundel JS+modal supaya tidak ada risiko "function is not defined" —
    // tapi fragmen HTML halamannya sendiri tetap terpisah per tab.
    soal:            { html: 'admin/soal.html',           js: ['js/editor.js', 'js/soal.js', 'admin/library.js', 'admin/modul.js'], modals: 'admin/soal-modals.html' },
    library:         { html: 'admin/library.html',        js: ['js/editor.js', 'js/soal.js', 'admin/library.js', 'admin/modul.js'], modals: 'admin/soal-modals.html' },
    modul:           { html: 'admin/modul.html',          js: ['js/editor.js', 'js/soal.js', 'admin/library.js', 'admin/modul.js'], modals: 'admin/soal-modals.html' },
    buku:            { html: 'admin/buku.html',           js: ['js/ebook.js'], modals: 'admin/ebook-modals.html' },
    'ebook-library': { html: 'admin/ebook-library.html',  js: ['js/ebook.js'], modals: 'admin/ebook-modals.html' },
    'ebook-modul':   { html: 'admin/ebook-modul.html',    js: ['js/ebook.js'], modals: 'admin/ebook-modals.html' },
    landing:         { html: 'admin/landing.html',        js: ['admin/landing.js'] },
    keuangan:        { html: 'admin/keuangan.html',       js: ['admin/keuangan.js'], modals: 'admin/keuangan-modals.html' },
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

function setDirty(ctx='perubahan') { AppState.isDirty=true; AppState.dirtyContext=ctx; }
function clearDirty() { AppState.isDirty=false; AppState.dirtyContext=null; }

function showLeaveConfirm() {
    document.getElementById('leave-msg').textContent = `Yakin ingin membatalkan proses ${AppState.dirtyContext||'perubahan'}? Data yang diisi akan hilang.`;
    document.getElementById('leave-overlay').classList.add('open');
}
function closeLeaveConfirm() { document.getElementById('leave-overlay').classList.remove('open'); AppState.pendingNav=null; }
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
    clearDirty(); closeLeaveConfirm();
    if (AppState.pendingNav) { const {pageId,subId}=AppState.pendingNav; AppState.pendingNav=null; _doNav(pageId,subId); }
}

function toggleDockMore() { document.getElementById('dock-more-menu')?.classList.toggle('open'); }
function closeDockMore() { document.getElementById('dock-more-menu')?.classList.remove('open'); }
document.addEventListener('click', e=>{
    const btn=document.getElementById('btn-dock-more'), menu=document.getElementById('dock-more-menu');
    if(menu&&!menu.contains(e.target)&&btn&&!btn.contains(e.target)) closeDockMore();
    if(e.target.classList.contains('overlay')&&e.target.id!=='leave-overlay') closeOverlay(e.target);
});

function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
function openOverlay(el) { el.classList.add('open'); }
function closeOverlay(el) { el.classList.remove('open'); }

let _confirmCb = null;
function showConfirm(title, msg, type='danger', cb=null) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-msg').textContent = msg;
    document.getElementById('confirm-icon').className = 'confirm-icon ' + type;
    _confirmCb = cb; openModal('confirm-overlay');
}
async function handleConfirmYes() {
    closeModal('confirm-overlay');
    const cb = _confirmCb; _confirmCb = null;
    if (cb) {
        try { await cb(); }
        catch (e) { showToast('Gagal: ' + (e.message || 'Terjadi kesalahan'), 'danger'); }
    }
}
function handleConfirmNo() { closeModal('confirm-overlay'); _confirmCb=null; }

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
function _toggleFilterDD(containerId) {
    const panel = document.getElementById(`${containerId}-panel`); if (!panel) return;
    const willOpen = panel.style.display === 'none';
    document.querySelectorAll('.filter-dd-panel').forEach(p => p.style.display = 'none');
    panel.style.display = willOpen ? 'block' : 'none';
}
function _selectFilterDD(containerId, groupIdx, value) {
    const conf = _filterDD[containerId]; if (!conf) return;
    const panel = document.getElementById(`${containerId}-panel`); if (panel) panel.style.display = 'none';
    conf.groups[groupIdx].onSelect(value);
}
document.addEventListener('click', e => {
    if (!e.target.closest('.filter-dd-wrap')) document.querySelectorAll('.filter-dd-panel').forEach(p => p.style.display = 'none');
});