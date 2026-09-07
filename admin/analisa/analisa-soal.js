// admin/analisa/analisa-soal.js
// Halaman ANALISA > SOAL. Dibuka dari 2 arah, masing-masing render mode yang
// beda (toggle #as-list-wrap / #as-detail-wrap di analisa-soal.html):
//   1) Lewat panel slide-dock ANALISA (tombol "SOAL") — langsung, tanpa konteks
//      grup/soal tertentu -> MODE LIST: tampilkan daftar semua soal yang ada
//      (data sama dgn Library Soal, lihat _aslLoadAndRender di bawah). Klik
//      salah satu kartu soal di daftar ini TIDAK membuka editor soal (beda dgn
//      Library Soal) — malah membuka tab baru 'analisa-soal-detail'
//      (admin/analisa/analisa-soal-detail.html/.js). Untuk saat ini halaman
//      itu masih MOCKUP (cuma tombol kembali), isi detailnya menyusul.
//   2) Lewat klik nomor soal (sumbu-X) di grafik "Benar/Salah" atau "Nilai/
//      Skor Sendiri" pada admin/analisa/analisa-token-detail.js — lihat
//      _atdGoToSoalDetail() di sana. Konteksnya (grup asal + nomor + tipe
//      grafik yg diklik) dititip di window._analisaSoalDetail* sebelum
//      navigateTo('analisa-soal') dipanggil -> MODE DETAIL PER-NOMOR (perilaku
//      lama, tidak berubah).
//
// Tombol panah kembali di mode detail per-nomor: balik ke halaman detail grup
// token yang tadi dibuka (analisa-token-detail) — halaman ini cuma dicapai
// lewat jalur itu, jadi tidak pernah balik ke daftar grup (analisa-token).
//
// ── ISI HALAMAN — datanya diambil dari _ATD_DUMMY_BINARY / _ATD_DUMMY_SKOR
// (nama variabel dipertahankan, lihat analisa-token-detail.js) yang sekarang
// sudah membawa detail penuh per nomor soal (pertanyaan, pembahasan, & tiap
// opsi lengkap dgn teks/kunci/jumlah pemilih/nama pemilih) — dihitung sekali
// oleh server saat grup dibuka (GET /api/analisa/grup/:grubToken), BUKAN
// fabrikasi/dummy lagi. Kalau grup belum pernah dibuka sebelum halaman ini
// diakses (harusnya tidak mungkin lewat alur normal, karena satu2nya jalan
// masuk kesini adalah klik grafik di halaman itu), _asBuildOpsiData()
// otomatis balik null dan halaman ini nampilin empty-state.
//   - Kartu Soal, kartu Pilihan Jawaban, dan kartu Pembahasan didesain SAMA
//     PERSIS spt tampilan "MODE REVIEW" (review/riwayat/riwayat.js ->
//     renderRuvMC) — kotak huruf opsi 36x36, warna & badge kunci/nilai
//     mengikuti gaya yg sama, cuma di sini datanya agregat semua peserta
//     (bukan hasil 1 peserta), jadi tiap opsi SELALU tampil jumlah orang yg
//     memilihnya di kanan.
//   - Jumlah pilihan jawaban TIDAK dipatok A-E — bisa lebih atau kurang,
//     sesuai jumlah opsi asli soal tsb (persis array `options`/`opsi` yang
//     dikirim server). Urutan opsi persis urutan aslinya, tidak diacak.
//   - Tipe "Benar/Salah": opsi kunci ditandai badge kuning "Kunci" (gaya yg
//     sama dgn kunci-tapi-tidak-dipilih di mode-review).
//   - Tipe "Nilai/Skor Sendiri": tiap opsi tampil "Nilai X"-nya; opsi
//     bernilai tertinggi (nilai>0) ditandai warna aksen biru.
//   - Setelah "Pembahasan": daftar peserta — BUKAN grup ber-header per opsi,
//     tapi baris per PESERTA (kotak kecil huruf opsi + nama), diurut per
//     opsi dari yg pertama ke yg terakhir. Opsi yg tidak ada pemilihnya
//     TIDAK dibuatkan baris/kotak sama sekali. Warna kotak: hijau kalau opsi
//     itu kunci/bernilai, merah kalau bukan.
//   - Klik salah satu kartu opsi di atas -> daftar peserta di bawah/kanan
//     terfilter cuma opsi itu; kalau opsi itu tidak ada pemilihnya, cukup
//     tampil teks "Tidak ada yang memilih opsi ini". Klik opsi yg sama lagi
//     -> filter mati (tampil semua lagi), sama spt tombol "Tampilkan semua".
//   - Layout: mobile (≤768px) daftar peserta ditumpuk di BAWAH (lihat urutan
//     DOM as-col-main lalu as-col-side); desktop (>768px) daftar peserta
//     pindah ke KANAN lewat flex-direction:row (lihat css/chart.css).

function renderAnalisaSoal() {
    const grup = window._analisaSoalDetailGrup || null;
    const nomor = window._analisaSoalDetailNomor || null;
    const kind = window._analisaSoalDetailKind || null;
    const listWrap = document.getElementById('as-list-wrap');
    const detailWrap = document.getElementById('as-detail-wrap');

    if (!nomor || !kind) {
        // Tidak ada konteks grafik yg dititip -> dibuka langsung dari
        // slide-dock ANALISA. Tampilkan MODE LIST (daftar semua soal).
        if (detailWrap) detailWrap.style.display = 'none';
        if (listWrap) listWrap.style.display = '';
        _aslLoadAndRender();
        return;
    }

    // Ada konteks grafik -> MODE DETAIL PER-NOMOR (perilaku lama). `grup`
    // BOLEH kosong sekarang — kosong berarti datang dari klik grafik di
    // Analisa > Soal (analisa-soal-detail.js -> _asdGoToButirDetail()),
    // bukan dari grup token (lihat window._analisaSoalDetailBackKode di
    // bawah & _asBack()).
    if (listWrap) listWrap.style.display = 'none';
    if (detailWrap) detailWrap.style.display = '';
    const sub = document.getElementById('as-sub');
    if (sub) sub.textContent = `Soal No. ${nomor}${kind ? ' · Tipe: ' + (kind === 'skor' ? 'Nilai/Skor Sendiri' : 'Benar/Salah') : ''}${grup ? ' · Grup: ' + grup : ''}`;
    _asActiveFilter = null; // reset filter tiap kali halaman ini dibuka ulang dari luar (klik grafik baru / kembali lalu masuk lagi)
    _asRenderContent(grup, nomor, kind);
}

// ── MODE LIST ────────────────────────────────────────────────────────────────
// Dibuka langsung dari slide-dock ANALISA > SOAL, tanpa konteks grup/nomor
// tertentu. Menampilkan daftar SEMUA soal yang ada — data & pola tampilannya
// SAMA PERSIS dengan Library Soal (dikelompokkan per kelompok soal + filter
// dropdown Tipe/Kelompok, lihat _renderLibFilters/_renderLibList di
// admin/soal/library.js), sumber datanya juga sama (SoalAPI.getAll() +
// SoalKelompokAPI.getAll(), keduanya didefinisikan global di js/api.js).
// Bedanya cuma di kartunya: di sini read-only (tanpa checkbox/aksi Preview-
// Edit-Export-Hapus), dan file ini sengaja TIDAK ikut nge-load
// admin/soal/soal.js / library.js supaya modul Analisa tetap ringan & berdiri
// sendiri — makanya semua state & helper di bawah dipakai nama sendiri
// (prefix _asl), bukan pinjam punya soal.js (_libData/_soalKelompokList dst,
// yg belum tentu sudah termuat kalau tab Soal/Library belum pernah dibuka).
// Klik satu kartu soal DI SINI *tidak* membuka editor soal (beda dgn Library
// Soal) — melainkan membuka tab 'analisa-soal-detail' yang untuk saat ini
// masih MOCKUP (lihat admin/analisa/analisa-soal-detail.html/.js).
let _aslData = null, _aslKelompokList = [], _aslSearch = '', _aslType = 'all', _aslKelompokFilter = 'all';
const _aslTypeOptions = [{ value: 'all', label: 'Semua Tipe' }, { value: 'multiple_choice', label: 'Multiple Choice' }, { value: 'linier', label: 'Linier' }, { value: 'sikap_kerja', label: 'Sikap Kerja' }];

// ── OPTIMASI: cache in-memory + index pencarian ─────────────────────────────
// Sebelumnya SoalAPI.getAll()/SoalKelompokAPI.getAll() ditarik ulang dari
// server SETIAP KALI slide-dock ANALISA > SOAL dibuka (termasuk kalau baru
// saja ditutup lalu dibuka lagi tanpa ada perubahan data sama sekali), dan
// halaman selalu nampilin "Memuat daftar soal…" dari nol. Sekarang: begitu
// data pernah diambil sekali (_aslLoaded=true), buka ulang halaman ini
// langsung render dari cache (_aslData/_aslKelompokList) TANPA nunggu network
// -> instan, tidak ada flicker "Memuat...". Data tetap disegarkan di
// belakang layar tiap dibuka (stale-while-revalidate) supaya kalau ada soal
// baru/berubah dari tab lain, list ikut update begitu fetch selesai — jadi
// tidak ada fungsi yg hilang, cuma pengguna tidak perlu nunggu spinner tiap
// kali pindah-pindah tab.
let _aslLoaded = false;
let _aslKelompokMap = new Map(); // kode -> nama, O(1) lookup (dulu Array.find tiap panggil)
let _aslSearchTimer = null;

async function _aslLoadAndRender() {
    const wrap = document.getElementById('as-list-wrap');
    if (!wrap) return;

    if (_aslLoaded) {
        // Cache sudah ada -> render instan, lalu refresh diam-diam di belakang.
        _aslEnsureShell(wrap);
        _aslRenderFilters();
        _aslRenderList();
        _aslFetchData().catch(() => {}); // silent background refresh
        return;
    }

    _aslEnsureShell(wrap, true);
    await _aslFetchData();
    _aslRenderFilters();
    _aslRenderList();
}

// Bangun shell (search bar + filter + kontainer list) sekali saja. Dipanggil
// tiap _aslLoadAndRender supaya aman kalau DOM #as-list-wrap sempat dikosongkan
// navigasi lain, tapi tidak menimpa isi #as-list-groups kalau sudah ada isinya
// (mencegah kedip "Memuat..." saat data sudah di-cache).
function _aslEnsureShell(wrap, showLoading) {
    const already = wrap.querySelector('#as-list-groups');
    if (already && !showLoading) return; // shell sudah ada & kita punya cache -> tidak perlu dibangun ulang
    wrap.innerHTML = `
      <div class="section-title">Analisa · Soal</div>
      <div class="section-sub">Pilih salah satu soal untuk melihat analisanya</div>
      <div class="search-bar" style="flex-wrap:wrap;gap:8px;margin-top:10px">
        <div class="search-input-wrap" style="min-width:150px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input class="search-input" type="text" placeholder="Cari nama / tipe..." value="${_asEsc(_aslSearch)}" oninput="_aslOnSearchInput(this.value)"></div>
        <div id="as-list-filters"></div>
      </div>
      <div id="as-list-groups"><div class="empty-state"><p>Memuat daftar soal…</p></div></div>`;
}

async function _aslFetchData() {
    const [data, kelompok] = await Promise.all([
        SoalAPI.getAll().catch(() => []),
        SoalKelompokAPI.getAll().catch(() => [])
    ]);
    _aslData = data;
    _aslKelompokList = kelompok;
    _aslLoaded = true;
    _aslBuildIndex();
    // Kalau halaman ini masih terbuka saat refresh belakang-layar selesai,
    // render ulang supaya data terbaru langsung tampil (mis. soal baru dari
    // tab lain). Aman dipanggil berulang — cuma menimpa innerHTML kontainer
    // yg relevan, bukan seluruh halaman.
    if (document.getElementById('as-list-groups')) {
        _aslRenderFilters();
        _aslRenderList();
    }
}

// Index pencarian: hitung SEKALI per item (bukan tiap keystroke) gabungan
// nama+nama_internal+type+nama kelompok yg sudah di-lowercase, dipakai
// _aslRenderList() supaya filter pencarian tinggal 1x .includes() per item
// alih-alih 4x toLowerCase()+lookup kelompok (Array.find) per item per huruf
// yg diketik. _aslKelompokMap juga dibangun di sini (Map, O(1)) mengganti
// Array.find yg dipakai _aslKelompokNama sebelumnya (O(n) tiap panggil).
function _aslBuildIndex() {
    _aslKelompokMap = new Map((_aslKelompokList || []).map(k => [k.kode, k.nama]));
    (_aslData || []).forEach(s => {
        const kelompokNama = s.kelompok ? (_aslKelompokMap.get(s.kelompok) || '') : '';
        s._aslSearchIdx = [s.nama, s.nama_internal, s.type, kelompokNama].filter(Boolean).join(' ').toLowerCase();
    });
}

// Debounce input pencarian (150ms) — ketikan tetap terasa instan (nilai
// input dikontrol native oleh browser), tapi filter+render ulang daftar
// (yg jauh lebih berat utk library soal besar) ditunda sampai user berhenti
// mengetik sejenak, bukan dieksekusi tiap 1 huruf.
function _aslOnSearchInput(val) {
    _aslSearch = val;
    clearTimeout(_aslSearchTimer);
    _aslSearchTimer = setTimeout(_aslRenderList, 150);
}

function _aslKelompokNama(kode) {
    if (!kode) return null;
    // O(1) via Map (dibangun di _aslBuildIndex) — dulu Array.find, O(n) tiap
    // panggil, dipanggil berulang kali tiap render grup.
    return _aslKelompokMap.get(kode) || null;
}

function _aslRenderFilters() {
    if (!document.getElementById('as-list-filters')) return;
    const kelompokOptions = [{ value: 'all', label: 'Semua Kelompok' }, { value: 'none', label: 'Tanpa Kelompok' }, ..._aslKelompokList.map(k => ({ value: k.kode, label: k.nama }))];
    renderFilterDropdown('as-list-filters', {
        title: 'Filter', groups: [
            { title: 'Tipe Soal', options: _aslTypeOptions, current: _aslType, onSelect: v => { _aslType = v; _aslRenderFilters(); _aslRenderList(); } },
            { title: 'Kelompok', options: kelompokOptions, current: _aslKelompokFilter, onSelect: v => { _aslKelompokFilter = v; _aslRenderFilters(); _aslRenderList(); } }
        ]
    });
}

function _aslCardHtml(s) {
    const kode = s.kode || s.id;
    const namaTampil = _asEsc(s.nama_internal ? `${s.nama} | ${s.nama_internal}` : s.nama);
    return `
    <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px;border:1.5px solid rgba(19,50,89,0.09);background:rgba(255,255,255,0.55);cursor:pointer;margin-bottom:8px" onclick="_aslOpenDetail('${kode}')">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:14px;color:var(--blue);margin-bottom:6px;overflow-wrap:break-word">${namaTampil}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <span class="badge" style="background:rgba(26,90,160,0.1);color:var(--accent)">${_asEsc((s.type || '').replace(/_/g, ' '))}</span>
          <span style="font-size:11px;color:var(--text-sub)">${_asEsc(kode)}</span>
        </div>
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="color:var(--text-sub);flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`;
}

// Header per grup kelompok — pola sama seperti _libGroupHtml di library.js
// (nama kelompok + jumlah soal di dalamnya, urutan sesuai _aslKelompokList,
// grup "Tanpa Kelompok" selalu diletakkan paling akhir).
function _aslGroupHtml(group) {
    return `<div class="section-sub" style="font-weight:700;color:var(--blue);text-transform:none;margin:18px 0 8px">${_asEsc(group.label)} <span style="font-weight:500;color:var(--text-sub);font-size:11px">(${group.items.length} soal)</span></div>
    ${group.items.map(_aslCardHtml).join('')}`;
}

function _aslRenderList() {
    const el = document.getElementById('as-list-groups'); if (!el) return;
    let data = _aslData || [];
    if (_aslSearch) {
        const q = _aslSearch.toLowerCase();
        // Pakai index yg sudah disiapkan di _aslBuildIndex (1x .includes() per
        // item) alih-alih 4x toLowerCase()+lookup kelompok per item tiap kali
        // fungsi ini jalan (yaitu tiap keystroke sebelum di-debounce).
        data = data.filter(s => (s._aslSearchIdx || '').includes(q));
    }
    if (_aslType !== 'all') data = data.filter(s => s.type === _aslType);
    if (_aslKelompokFilter === 'none') data = data.filter(s => !s.kelompok);
    else if (_aslKelompokFilter !== 'all') data = data.filter(s => s.kelompok === _aslKelompokFilter);
    if (!data.length) { el.innerHTML = '<div class="empty-state"><p>Belum ada soal di library</p></div>'; return; }
    // Kelompokkan per kelompok soal — pola sama persis seperti Library Soal.
    const groups = {};
    data.forEach(s => { const k = s.kelompok || '__none__'; (groups[k] = groups[k] || []).push(s); });
    const orderedKeys = [..._aslKelompokList.map(k => k.kode).filter(k => groups[k]), ...(groups.__none__ ? ['__none__'] : [])];
    const groupList = orderedKeys.map(k => ({ key: k, label: k === '__none__' ? 'Tanpa Kelompok' : _aslKelompokNama(k), items: groups[k] }));
    el.innerHTML = groupList.map(_aslGroupHtml).join('');
}

// Buka tab 'analisa-soal-detail' untuk 1 soal yang diklik dari daftar.
// Kodenya dititip lewat window (pola sama dgn window._analisaSoalDetail* di
// atas), dipakai nanti oleh analisa-soal-detail.js begitu isinya dibangun —
// untuk saat ini halaman itu masih mockup (cuma tombol kembali).
function _aslOpenDetail(kode) {
    window._analisaSoalListDetailKode = kode;
    navigateTo('analisa-soal-detail');
}

function _asBack() {
    // Datang dari klik grafik di Analisa > Soal (analisa-soal-detail.js,
    // TANPA grup token) -> balik ke halaman detail soal itu, bukan ke
    // alur token. Lihat _asdGoToButirDetail() di analisa-soal-detail.js.
    if (window._analisaSoalDetailBackKode) {
        window._analisaSoalListDetailKode = window._analisaSoalDetailBackKode;
        navigateTo('analisa-soal-detail');
        return;
    }
    navigateTo(window._analisaSoalDetailGrup ? 'analisa-token-detail' : 'analisa-token');
}

function _asEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }

// Huruf opsi TIDAK dipatok A-E: sama seperti admin/soal/soal.js (jawaban
// minimal 2 pilihan, jumlahnya bebas — huruf cuma hasil String.fromCharCode
// dari posisi asli array jawaban, bukan array label tetap).
function _asHuruf(idx) { return String.fromCharCode(65 + idx); }

// Ambil detail 1 nomor soal (pertanyaan, pembahasan, tiap opsi + nama
// pemilihnya) dari data yang sudah diisi server saat grup dibuka — lihat
// _atdRenderCharts() di analisa-token-detail.js. `pertanyaan`/`pembahasan`/
// `teks` opsi SENGAJA TIDAK di-escape (dirender apa adanya) karena isinya
// HTML dari rich-text editor admin/soal/soal.js — sama persis perlakuannya
// dgn q.soal/q.pembahasan/j.teks di halaman review lain (review/riwayat.js,
// user/riwayat.js, dst). Hanya nama peserta yang di-escape (_asEsc), karena
// itu teks polos, bukan HTML.
function _asBuildOpsiData(nomor, kind) {
    const arr = kind === 'skor' ? _ATD_DUMMY_SKOR : _ATD_DUMMY_BINARY;
    const src = (typeof arr !== 'undefined' && Array.isArray(arr)) ? arr.find(s => s.nomor === nomor) : null;
    if (!src || !Array.isArray(src.options)) return null;
    const options = src.options.map((o, idx) => ({
        huruf: _asHuruf(idx), idx,
        text: o.teks || `<em>Opsi ${_asHuruf(idx)} (kosong)</em>`,
        count: o.count || 0,
        nilai: o.nilai,
        isKunci: !!o.isKunci,
        names: o.names || []
    }));
    return {
        pertanyaan: src.pertanyaan || '<em>Teks soal ini belum diisi</em>',
        pembahasan: src.pembahasan || '',
        options
    };
}

// ── STATE FILTER ────────────────────────────────────────────────────────────
let _asActiveFilter = null; // index opsi yg sedang difilter di daftar peserta (0..jumlahOpsi-1), null = tampil semua

function _asToggleFilter(idx) {
    _asActiveFilter = (_asActiveFilter === idx) ? null : idx;
    _asRenderContent(window._analisaSoalDetailGrup || null, window._analisaSoalDetailNomor || null, window._analisaSoalDetailKind || null);
}

function _asClearFilter() {
    _asActiveFilter = null;
    _asRenderContent(window._analisaSoalDetailGrup || null, window._analisaSoalDetailNomor || null, window._analisaSoalDetailKind || null);
}

// ── RENDER ──────────────────────────────────────────────────────────────────
function _asRenderContent(grup, nomor, kind) {
    const el = document.getElementById('as-content');
    if (!el) return;
    if (!nomor || !kind) {
        el.innerHTML = '<div class="card"><div class="empty-state"><p>Analisa per-soal akan segera hadir</p></div></div>';
        return;
    }
    const data = _asBuildOpsiData(nomor, kind);
    if (!data) {
        el.innerHTML = '<div class="card"><div class="empty-state"><p>Data soal ini belum tersedia</p></div></div>';
        return;
    }
    el.innerHTML = _asLayoutHtml(nomor, kind, data);
}

function _asOpsiRowHtml(o, kind) {
    // Meniru persis gaya kartu pilihan jawaban di MODE REVIEW
    // (review/riwayat/riwayat.js -> renderRuvMC): kotak huruf 36x36 + teks +
    // badge di kanan. Bedanya di sini tidak ada "jawaban peserta tunggal" yg
    // dipilih (ini agregat semua peserta), jadi setiap opsi SELALU tampil
    // jumlah orangnya, dan pewarnaan cuma menandai kunci/opsi bernilai —
    // bukan status benar/salah 1 orang.
    let borderColor = 'rgba(19,50,89,0.09)', bgColor = 'rgba(255,255,255,0.5)', letterBg = 'rgba(255,255,255,0.8)', letterColor = 'var(--text-sub)';
    let leftBadge = '';
    if (kind === 'binary') {
        if (o.isKunci) {
            borderColor = '#d97706'; bgColor = 'rgba(217,119,6,0.07)'; letterBg = '#d97706'; letterColor = '#fff';
            leftBadge = '<span style="font-size:10px;color:#d97706;font-weight:700;white-space:nowrap;">Kunci</span>';
        }
    } else {
        leftBadge = `<span style="font-size:11px;font-weight:700;color:var(--text-sub);background:rgba(19,50,89,0.06);padding:3px 8px;border-radius:6px;white-space:nowrap;">Nilai ${o.nilai}</span>`;
        if (o.isKunci) {
            borderColor = 'var(--accent)'; bgColor = 'rgba(26,90,160,0.08)'; letterBg = 'var(--accent)'; letterColor = '#fff';
            leftBadge = `<span style="font-size:11px;font-weight:800;color:var(--accent);background:rgba(26,90,160,0.15);padding:3px 8px;border-radius:6px;white-space:nowrap;">Nilai ${o.nilai}</span>`;
        }
    }
    const activeOutline = _asActiveFilter === o.idx ? 'outline:2.5px solid var(--accent2);outline-offset:1px;' : '';
    const countBadge = `<span style="font-size:11px;font-weight:700;color:var(--blue);white-space:nowrap;">${o.count} orang</span>`;
    return `
    <div style="display:flex;align-items:center;gap:13px;padding:14px 16px;border-radius:12px;border:1.5px solid ${borderColor};background:${bgColor};min-height:52px;cursor:pointer;${activeOutline}" onclick="_asToggleFilter(${o.idx})" title="Klik untuk memfilter daftar peserta yang memilih opsi ${o.huruf}">
      <div style="width:36px;height:36px;flex-shrink:0;border-radius:9px;border:1.5px solid rgba(19,50,89,0.12);background:${letterBg};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:${letterColor};">${o.huruf}</div>
      <div style="flex:1;min-width:0;font-size:15px;line-height:1.5;color:var(--text-main);overflow-wrap:break-word;">${o.text}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-left:auto;flex-shrink:0;">${leftBadge}${countBadge}</div>
    </div>`;
}

// Daftar peserta: BUKAN grup ber-header per opsi, tapi baris per PESERTA —
// tiap baris = kotak kecil berisi huruf opsi yang dipilih peserta itu +
// namanya, ditata mirip kartu opsi di atas (kotak huruf + isi). Diurut per
// opsi (A -> opsi terakhir, sesuai urutan asli array opsi soal, BUKAN
// diacak); opsi yang tidak ada pemilihnya otomatis TIDAK menghasilkan baris
// sama sekali (tidak dibuatkan kotak kosong). Warna: hijau kalau opsi itu
// kunci/bernilai, merah kalau bukan.
function _asUserRowHtml(o, name) {
    const isCorrect = o.isKunci;
    const borderColor = isCorrect ? 'var(--success)' : 'var(--danger)';
    const bgColor = isCorrect ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.07)';
    const letterBg = isCorrect ? 'var(--success)' : 'var(--danger)';
    return `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;border:1.5px solid ${borderColor};background:${bgColor};">
      <div style="width:26px;height:26px;flex-shrink:0;border-radius:7px;border:1.5px solid rgba(19,50,89,0.12);background:${letterBg};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;color:#fff;">${o.huruf}</div>
      <div style="flex:1;min-width:0;font-size:13px;color:var(--text-main);overflow-wrap:break-word;">${_asEsc(name)}</div>
    </div>`;
}

function _asUserListHtml(data) {
    let rows = [];
    data.options.forEach(o => { o.names.forEach(name => rows.push({ o, name })); });
    if (_asActiveFilter !== null) {
        rows = rows.filter(r => r.o.idx === _asActiveFilter);
        if (!rows.length) return '<div class="as-user-empty-msg">Tidak ada yang memilih opsi ini</div>';
    }
    return `<div class="as-user-rows">${rows.map(r => _asUserRowHtml(r.o, r.name)).join('')}</div>`;
}

function _asLayoutHtml(nomor, kind, data) {
    const opsiRows = data.options.map(o => _asOpsiRowHtml(o, kind)).join('');
    const filterActive = _asActiveFilter !== null;
    const clearBtn = filterActive
        ? `<button class="as-clear-filter" onclick="_asClearFilter()">Tampilkan semua &times;</button>`
        : '';
    const userSub = filterActive
        ? `Menampilkan peserta yang memilih opsi <b>${_asHuruf(_asActiveFilter)}</b> saja`
        : 'Semua peserta, diurut per pilihan jawaban';

    return `
    <div class="as-layout">
      <div class="as-col-main">
        <div style="background:rgba(255,255,255,0.72);border:1.5px solid rgba(255,255,255,0.9);border-radius:16px;padding:22px 24px;box-shadow:0 4px 16px rgba(19,50,89,0.06);margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;color:var(--text-sub);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Soal No. ${nomor}</div>
          <div style="font-size:16px;line-height:1.8;color:var(--text-main);overflow-wrap:break-word;">${data.pertanyaan}</div>
        </div>
        <div style="background:rgba(255,255,255,0.6);border:1.5px solid rgba(255,255,255,0.85);border-radius:16px;padding:18px 20px;box-shadow:0 4px 14px rgba(19,50,89,0.05);display:flex;flex-direction:column;gap:9px;overflow-wrap:break-word;margin-bottom:8px;">${opsiRows}</div>
        <div class="as-opsi-hint">Klik salah satu pilihan untuk memfilter daftar peserta; klik lagi untuk menampilkan semua</div>
        ${data.pembahasan ? `<div style="background:rgba(26,90,160,0.06);border:1.5px solid rgba(26,90,160,0.12);border-radius:12px;padding:14px;overflow-wrap:break-word;margin-top:14px;">
          <div style="font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px;">💡 Pembahasan</div>
          <div style="font-size:14px;line-height:1.7;color:var(--text-main);">${data.pembahasan}</div>
        </div>` : ''}
      </div>
      <div class="as-col-side">
        <div class="card as-user-card">
          <div class="as-user-head">
            <div class="section-title" style="font-size:15px;margin-bottom:2px">Daftar Jawaban Peserta</div>
            ${clearBtn}
          </div>
          <div class="section-sub" style="margin-bottom:12px">${userSub}</div>
          ${_asUserListHtml(data)}
        </div>
      </div>
    </div>`;
}
