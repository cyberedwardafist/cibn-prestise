// admin/analisa/analisa-modul.js
// Halaman ANALISA > MODUL — dibuka dari panel slide-dock ANALISA (tombol
// "MODUL"). Menampilkan daftar SEMUA modul yang ada (sumber data ModulAPI,
// sama dgn Manajemen Modul admin/soal/modul.js) — read-only, dikelompokkan
// per Kelompok Modul (ModulKelompokAPI), pola & optimasi (cache in-memory +
// index pencarian + stale-while-revalidate) SENGAJA disalin PERSIS dari
// mode LIST di admin/analisa/analisa-soal.js (_asl*), cuma prefix fungsi
// diganti _aml (Analisa Modul List) & sumber datanya modul bukan soal.
//
// File ini sengaja TIDAK ikut nge-load admin/soal/modul.js (beda modul lazy-
// load, lihat ADMIN_PAGE_MODULES di js/app.js) supaya tab Analisa tetap
// ringan & berdiri sendiri.
//
// Klik 1 kartu modul -> _amlOpenDetail() -> buka tab 'analisa-modul-detail'
// (admin/analisa/analisa-modul-detail.html/.js), yang isinya: Ringkasan +
// kartu "Sampel" (tester manual, sama pola dgn kartu "Sampel" di
// analisa-soal-detail.js tapi key-nya per modul_kode) + grafik AGREGAT
// gabungan semua soal dlm modul itu (gaya sama dgn analisa-token-detail.js,
// cuma sumber pesertanya sampel manual, bukan otomatis dari 1 grup token).

let _amlData = null, _amlKelompokList = [];
let _amlSearch = '';
let _amlKelompokFilter = 'all';
let _amlLoaded = false;
let _amlKelompokMap = new Map(); // kode -> nama, O(1) lookup
let _amlSearchTimer = null;

function renderAnalisaModul() {
    _amlLoadAndRender();
}

async function _amlLoadAndRender() {
    const wrap = document.getElementById('aml-list-wrap');
    if (!wrap) return;

    if (_amlLoaded) {
        // Cache sudah ada -> render instan, lalu refresh diam-diam di belakang.
        _amlEnsureShell(wrap);
        _amlRenderFilters();
        _amlRenderList();
        _amlFetchData().catch(() => {}); // silent background refresh
        return;
    }

    _amlEnsureShell(wrap, true);
    await _amlFetchData();
    _amlRenderFilters();
    _amlRenderList();
}

// Bangun shell (search bar + filter + kontainer list) sekali saja — pola
// sama persis dgn _aslEnsureShell() di analisa-soal.js.
function _amlEnsureShell(wrap, showLoading) {
    const already = wrap.querySelector('#aml-list-groups');
    if (already && !showLoading) return;
    wrap.innerHTML = `
      <div class="section-title">Analisa · Modul</div>
      <div class="section-sub">Pilih salah satu modul untuk melihat analisanya</div>
      <div class="search-bar" style="flex-wrap:wrap;gap:8px;margin-top:10px">
        <div class="search-input-wrap" style="min-width:150px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input class="search-input" type="text" placeholder="Cari nama modul..." value="${_amlEsc(_amlSearch)}" oninput="_amlOnSearchInput(this.value)"></div>
        <div id="aml-list-filters"></div>
      </div>
      <div id="aml-list-groups"><div class="empty-state"><p>Memuat daftar modul…</p></div></div>`;
}

async function _amlFetchData() {
    const [data, kelompok] = await Promise.all([
        ModulAPI.getAll().catch(() => []),
        (typeof ModulKelompokAPI !== 'undefined' ? ModulKelompokAPI.getAll().catch(() => []) : Promise.resolve([]))
    ]);
    _amlData = data || [];
    _amlKelompokList = kelompok || [];
    _amlLoaded = true;
    _amlBuildIndex();
    if (document.getElementById('aml-list-groups')) {
        _amlRenderFilters();
        _amlRenderList();
    }
}

// Index pencarian: nama+nama_internal+kode+nama kelompok digabung &
// di-lowercase sekali per item — sama pola dgn _aslBuildIndex().
function _amlBuildIndex() {
    _amlKelompokMap = new Map((_amlKelompokList || []).map(k => [k.kode, k.nama]));
    (_amlData || []).forEach(m => {
        const kode = m.kode || m.id;
        const kelompokNama = m.kelompok ? (_amlKelompokMap.get(m.kelompok) || '') : '';
        m._amlSearchIdx = [m.nama, m.nama_internal, kode, kelompokNama].filter(Boolean).join(' ').toLowerCase();
    });
}

function _amlOnSearchInput(val) {
    _amlSearch = val;
    clearTimeout(_amlSearchTimer);
    _amlSearchTimer = setTimeout(_amlRenderList, 150);
}

function _amlKelompokNama(kode) {
    if (!kode) return null;
    return _amlKelompokMap.get(kode) || null;
}

function _amlRenderFilters() {
    if (!document.getElementById('aml-list-filters')) return;
    const kelompokOptions = [{ value: 'all', label: 'Semua Kelompok' }, { value: 'none', label: 'Tanpa Kelompok' }, ..._amlKelompokList.map(k => ({ value: k.kode, label: k.nama }))];
    renderFilterDropdown('aml-list-filters', {
        title: 'Filter', groups: [
            { title: 'Kelompok', options: kelompokOptions, current: _amlKelompokFilter, onSelect: v => { _amlKelompokFilter = v; _amlRenderFilters(); _amlRenderList(); } }
        ]
    });
}

function _amlCardHtml(m) {
    const kode = m.kode || m.id;
    const namaTampil = _amlEsc(m.nama_internal ? `${m.nama} | ${m.nama_internal}` : m.nama);
    const jumlahSoal = (m.soal_list || []).length;
    return `
    <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px;border:1.5px solid rgba(19,50,89,0.09);background:rgba(255,255,255,0.55);cursor:pointer;margin-bottom:8px" onclick="_amlOpenDetail('${kode}')">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:14px;color:var(--blue);margin-bottom:6px;overflow-wrap:break-word">${namaTampil}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <span class="badge" style="background:rgba(26,90,160,0.1);color:var(--accent)">${jumlahSoal} soal</span>
          ${m.mode_bebas ? '<span class="badge" style="background:rgba(217,119,6,0.1);color:#d97706">⚡ Mode Bebas</span>' : ''}
          <span style="font-size:11px;color:var(--text-sub)">${_amlEsc(kode)}</span>
        </div>
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="color:var(--text-sub);flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`;
}

// Header per grup kelompok — pola sama seperti _aslGroupHtml di analisa-soal.js.
function _amlGroupHtml(group) {
    return `<div class="section-sub" style="font-weight:700;color:var(--blue);text-transform:none;margin:18px 0 8px">${_amlEsc(group.label)} <span style="font-weight:500;color:var(--text-sub);font-size:11px">(${group.items.length} modul)</span></div>
    ${group.items.map(_amlCardHtml).join('')}`;
}

function _amlRenderList() {
    const el = document.getElementById('aml-list-groups'); if (!el) return;
    let data = _amlData || [];
    if (_amlSearch) {
        const q = _amlSearch.toLowerCase();
        data = data.filter(m => (m._amlSearchIdx || '').includes(q));
    }
    if (_amlKelompokFilter === 'none') data = data.filter(m => !m.kelompok);
    else if (_amlKelompokFilter !== 'all') data = data.filter(m => m.kelompok === _amlKelompokFilter);
    if (!data.length) { el.innerHTML = '<div class="empty-state"><p>Belum ada modul</p></div>'; return; }
    // Kelompokkan per kelompok modul — pola sama persis seperti Manajemen Modul.
    const groups = {};
    data.forEach(m => { const k = m.kelompok || '__none__'; (groups[k] = groups[k] || []).push(m); });
    const orderedKeys = [..._amlKelompokList.map(k => k.kode).filter(k => groups[k]), ...(groups.__none__ ? ['__none__'] : [])];
    const groupList = orderedKeys.map(k => ({ key: k, label: k === '__none__' ? 'Tanpa Kelompok' : _amlKelompokNama(k), items: groups[k] }));
    el.innerHTML = groupList.map(_amlGroupHtml).join('');
}

// Buka tab 'analisa-modul-detail' untuk 1 modul yang diklik dari daftar.
// Kodenya dititip lewat window (pola sama dgn window._analisaSoalListDetailKode
// di analisa-soal.js), dipakai analisa-modul-detail.js begitu dibuka.
function _amlOpenDetail(kode) {
    window._analisaModulListDetailKode = kode;
    if (typeof _persistAnalisaCtx === 'function') _persistAnalisaCtx();
    navigateTo('analisa-modul-detail');
}

function _amlEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
