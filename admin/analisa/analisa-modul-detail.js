// admin/analisa/analisa-modul-detail.js
// Halaman detail 1 MODUL, dibuka dari daftar Analisa > Modul (klik salah
// satu kartu modul di admin/analisa/analisa-modul.js -> _amlOpenDetail()).
// Kode modul yang diklik dititip di window._analisaModulListDetailKode
// sebelum navigateTo('analisa-modul-detail') dipanggil (lihat juga
// _persistAnalisaCtx/_restoreAnalisaCtx di js/app.js utk kasus refresh).
//
// Isi halaman — GABUNGAN pola dari 2 halaman yang sudah ada:
//   1) Kartu Ringkasan (amod-content): Nama modul, jumlah soal, daftar soal
//      di dalamnya — gaya SAMA PERSIS dgn blok "Modul & Soal yang Digunakan"
//      di kartu Ringkasan Grup punya analisa-token-detail.js
//      (_atdRenderRingkasan), cuma di sini datanya 1 modul langsung dari
//      ModulAPI.getOne-setara (ModulAPI.getAll() lalu cari by kode, karena
//      tidak ada endpoint getOne tersendiri), bukan dari grup token.
//   2) Kartu "Sampel" (amod-sampel-card): tester yang DIPILIH MANUAL oleh
//      admin (BUKAN otomatis dari grup token seperti di analisa-token-
//      detail.js) utk dijadikan sumber data analisa modul ini. Polanya
//      DISALIN PERSIS dari kartu "Sampel" di analisa-soal-detail.js
//      (_asdRenderSampel/_asdOpenSampel/_asdHapusIndividu/_asdHapusGrup),
//      cuma:
//        - prefix fungsi diganti _amod (biar tidak bentrok nama global dgn
//          punya soal, walau isinya sengaja disalin)
//        - key penyimpanan localStorage per MODUL_KODE (cbn_modul_sampel_
//          <kode>), bukan per soal_kode
//        - tombol "+ Tester Individu"/"+ Tester Grup" membuka halaman baru
//          admin/analisa/analisa-modul-sampel.html/.js (bukan analisa-soal-
//          sampel.js) — isinya juga hasil salin persis, lihat komentar di
//          file itu.
//   3) Kartu Grafik PER SOAL (amod-charts-wrap): SATU kartu per soal
//      bernama dlm modul (urut sesuai modul.soal_list), TEMPLATE grafiknya
//      (line chart Benar/Salah, line chart Nilai/Skor Sendiri, median-chart
//      Sikap Kerja) & fungsi rendernya DISALIN PERSIS dari _atdRenderCharts
//      di analisa-token-detail.js — BEDANYA cuma sumber datanya: di token-
//      detail data brasal dari 1 grup token (otomatis semua peserta yang
//      memakai token grup itu), di sini dari SAMPEL MANUAL (individu/grup)
//      yang dipilih admin lewat kartu Sampel di atas — sama pola bedanya
//      dgn kartu "Grafik" di analisa-soal-detail.js (yg juga pakai Sampel
//      manual utk 1 soal). Datanya dihitung SERVER dari jawaban ASLI
//      peserta yg kode akunnya ada di Sampel (bukan localStorage) — lihat
//      _amodSampelUserKodes() & POST /api/analisa/modul/:kode/hitung ->
//      computeAnalisaGrupAggregate() di server.js (fungsi yg SAMA dgn yang
//      dipakai token, cuma di sini laporanRows-nya difilter dari sampel,
//      bukan dari 1 grup token).
//
// Klik sumbu-X grafik di sini (drill-down ke 1 butir soal) -> _amodGoToButirDetail()
// -> buka admin/analisa/analisa-soal.js MODE DETAIL PER-NOMOR, dgn
// window._analisaSoalDetailBackModulKode dititip (BUKAN
// window._analisaSoalDetailGrup, karena tidak ada grup token di sini) supaya
// tombol kembali di sana (_asBack(), analisa-soal.js) tahu harus balik ke
// halaman modul ini, bukan ke alur token/soal biasa.

let _amodKode = null, _amodModul = null, _amodSoalMap = new Map();
// Status buka/tutup kartu "Sampel" — direset tiap halaman ini dibuka dari
// nol, dipertahankan kalau cuma _amodRenderSampel() dipanggil ulang (mis.
// abis hapus 1 tester) — pola sama persis dgn _asdSampelOpen.
let _amodSampelOpen = false;

async function renderAnalisaModulDetail() {
    _amodKode = window._analisaModulListDetailKode || null;
    _amodSampelOpen = false;
    const sub = document.getElementById('amod-kode-sub');
    if (sub) sub.textContent = _amodKode ? `Kode: ${_amodKode}` : '-';

    if (!_amodKode) {
        _amodRenderRingkasan(null);
        _amodRenderSampel();
        _amodRenderCharts(null);
        return;
    }

    let modulList = [], soalList = [];
    try {
        [modulList, soalList] = await Promise.all([
            ModulAPI.getAll(),
            SoalAPI.getAll().catch(() => [])
        ]);
    } catch (e) {
        console.error('Gagal memuat daftar modul:', e);
        if (typeof showToast === 'function') showToast('Gagal memuat data modul', 'danger');
    }
    // modul.soal_list cuma menyimpan {soal_kode,...} — nama soal diambil live
    // dari SoalAPI.getAll() (sama pola dgn picker soal di admin/soal/modul.js),
    // bukan disimpan duplikat di modul itu sendiri.
    _amodSoalMap = new Map((soalList || []).map(s => [s.kode || s.id, s]));
    _amodModul = (modulList || []).find(m => (m.kode || m.id) === _amodKode) || null;
    if (_amodModul && sub) sub.textContent = `${_amodModul.nama_internal ? _amodModul.nama + ' | ' + _amodModul.nama_internal : _amodModul.nama} · ${_amodKode}`;

    _amodRenderRingkasan(_amodModul);
    _amodRenderSampel();
    _amodRenderCharts(null); // dikosongkan dulu; diisi ulang begitu Sampel & hitung selesai di bawah
    _amodFetchAndRenderCharts();
}

function _amodEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ── RINGKASAN: nama modul + daftar soal di dalamnya — gaya SAMA PERSIS dgn
// blok "Modul & Soal yang Digunakan" di _atdRenderRingkasan() (analisa-
// token-detail.js), cuma tanpa 3 stat-card token (tidak relevan di sini,
// tidak ada konsep token/grup) — cuma nama + daftar soal.
function _amodRenderRingkasan(modul) {
    const el = document.getElementById('amod-content');
    if (!el) return;
    if (!_amodKode) { el.innerHTML = '<div class="empty-state"><p>Modul tidak ditemukan</p></div>'; return; }
    if (!modul) { el.innerHTML = '<div class="empty-state"><p>Gagal memuat data modul, silakan coba lagi</p></div>'; return; }

    const soalList = modul.soal_list || [];
    const soalRows = soalList.length
        ? soalList.map((sl, i) => {
            const s = _amodSoalMap.get(sl.soal_kode);
            return `<div class="atd-soal-row">${i + 1}. ${_amodEsc(s ? s.nama : sl.soal_kode)}</div>`;
        }).join('')
        : '<div class="atd-soal-row" style="opacity:.6">Modul ini belum berisi soal</div>';

    el.innerHTML = `
        <div class="section-title" style="font-size:16px;margin-bottom:14px">Ringkasan Modul</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:18px">
            <div>
                <div style="font-size:11px;color:var(--text-sub);margin-bottom:2px">Nama</div>
                <div style="font-size:14px;font-weight:600;color:var(--blue)">${_amodEsc(modul.nama_internal ? `${modul.nama} (${modul.nama_internal})` : modul.nama)}</div>
            </div>
            <div>
                <div style="font-size:11px;color:var(--text-sub);margin-bottom:2px">Jumlah Soal</div>
                <div style="font-size:14px;font-weight:600;color:var(--blue)">${soalList.length} soal</div>
            </div>
        </div>
        <div style="font-size:13px;font-weight:700;color:var(--blue);margin-bottom:8px">Daftar Soal</div>
        <div class="atd-modul-wrap"><div class="atd-modul-block"><div class="atd-soal-list">${soalRows}</div></div></div>`;
}

// ── SAMPEL: tester manual (individu/grup) — DISALIN dari _asdRenderSampel/
// _asdLoadSampel/_asdSaveSampel/_asdHapusIndividu/_asdHapusGrup/
// _asdSampelUserKodes di analisa-soal-detail.js, key localStorage diganti
// per modul_kode. Struktur data: { individu:[{kode,nama}], grup:[{grub_kode,
// grub_nama, members:[{kode,nama,included}]}] } — SAMA PERSIS strukturnya
// dgn punya soal (biar konsisten & gampang dipelihara).
function _amodSampelStorageKey(kode) { return `cbn_modul_sampel_${kode}`; }
function _amodLoadSampel(kode) {
    try { return JSON.parse(localStorage.getItem(_amodSampelStorageKey(kode)) || 'null') || { individu: [], grup: [] }; }
    catch (e) { return { individu: [], grup: [] }; }
}
function _amodSaveSampel(kode, data) {
    try { localStorage.setItem(_amodSampelStorageKey(kode), JSON.stringify(data)); } catch (e) {}
}

function _amodHapusIndividu(idx) {
    if (!_amodKode) return;
    const sampel = _amodLoadSampel(_amodKode);
    sampel.individu.splice(idx, 1);
    _amodSaveSampel(_amodKode, sampel);
    _amodRenderSampel();
    _amodFetchAndRenderCharts();
}
function _amodHapusGrup(idx) {
    if (!_amodKode) return;
    const sampel = _amodLoadSampel(_amodKode);
    sampel.grup.splice(idx, 1);
    _amodSaveSampel(_amodKode, sampel);
    _amodRenderSampel();
    _amodFetchAndRenderCharts();
}

// Daftar kode akun FINAL dari sampel (individu + anggota grup yang TIDAK
// dikeluarkan/exclude) — dikirim ke server (AnalisaAPI.hitungModul) supaya
// server menghitung ulang jawaban ASLI cuma dari akun-akun ini.
function _amodSampelUserKodes(sampel) {
    const kodes = new Set();
    (sampel.individu || []).forEach(u => { if (u.kode) kodes.add(u.kode); });
    (sampel.grup || []).forEach(g => (g.members || []).forEach(m => { if (m.included && m.kode) kodes.add(m.kode); }));
    return Array.from(kodes);
}

// Kartu bisa diklik (header) utk buka/tutup isinya — gaya PERSIS sama dgn
// _asdRenderSampel() (analisa-soal-detail.js).
function _amodRenderSampel() {
    const el = document.getElementById('amod-sampel-card');
    if (!el) return;
    if (!_amodKode) { el.innerHTML = ''; return; }

    const sampel = _amodLoadSampel(_amodKode);
    const adaData = (sampel.individu && sampel.individu.length) || (sampel.grup && sampel.grup.length);
    const totalTester = _amodSampelUserKodes(sampel).length;

    const tombolAksi = `
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:${adaData ? '14px' : '0'}">
            <button class="btn btn-secondary" onclick="_amodOpenSampel('individu')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                ${sampel.individu.length ? 'Ubah' : '+'} Tester Individu
            </button>
            <button class="btn btn-secondary" onclick="_amodOpenSampel('grup')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                ${sampel.grup.length ? 'Ubah' : '+'} Tester Grup
            </button>
        </div>`;

    let bodyHtml;
    if (!adaData) {
        bodyHtml = tombolAksi;
    } else {
        const individuRows = (sampel.individu || []).map((u, i) => `
            <div class="atd-peserta-row">
                <div class="atd-peserta-nama">${_amodEsc(u.nama)}</div>
                <button class="btn-icon danger" style="width:26px;height:26px" onclick="_amodHapusIndividu(${i})" title="Hapus dari sampel">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>`).join('');

        const grupBlocks = (sampel.grup || []).map((g, i) => {
            const included = (g.members || []).filter(m => m.included);
            const memberRows = (g.members || []).map(m => `
                <div class="atd-peserta-row" style="${m.included ? '' : 'opacity:.5'}">
                    <div class="atd-peserta-nama">${_amodEsc(m.nama)}</div>
                    <div class="atd-peserta-skor">${m.included ? 'Diikutkan' : 'Dikeluarkan'}</div>
                </div>`).join('');
            return `
            <div class="atd-modul-block" style="margin-bottom:10px">
                <div class="atd-modul-title" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                    <span>${_amodEsc(g.grub_nama)} <span style="font-weight:500;color:var(--text-sub);font-size:11px">(${included.length}/${(g.members || []).length} orang)</span></span>
                    <button class="btn-icon danger" style="width:26px;height:26px" onclick="_amodHapusGrup(${i})" title="Hapus grup ini dari sampel">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="atd-soal-list">${memberRows}</div>
            </div>`;
        }).join('');

        bodyHtml = `
            ${sampel.individu.length ? `<div style="font-size:13px;font-weight:700;color:var(--blue);margin-bottom:8px">Tester Individu (${sampel.individu.length})</div><div style="margin-bottom:14px">${individuRows}</div>` : ''}
            ${sampel.grup.length ? `<div style="font-size:13px;font-weight:700;color:var(--blue);margin-bottom:8px">Tester Grup</div>${grupBlocks}` : ''}
            ${tombolAksi}`;
    }

    el.innerHTML = `
        <div class="atd-peserta-header" onclick="_amodToggleSampel()">
            <div>
                <div class="section-title" style="font-size:16px;margin-bottom:2px">Sampel</div>
                <div class="section-sub" style="margin-bottom:0">${adaData ? `${totalTester} tester dipilih untuk modul ini` : 'Belum ada tester manual yang dipilih untuk modul ini'}</div>
            </div>
            <svg class="atd-peserta-chevron" id="amod-sampel-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="transition:transform .2s${_amodSampelOpen ? ';transform:rotate(180deg)' : ''}"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="atd-peserta-list" id="amod-sampel-list" style="display:${_amodSampelOpen ? 'block' : 'none'}">${bodyHtml}</div>`;
}

function _amodToggleSampel() {
    const list = document.getElementById('amod-sampel-list');
    const chev = document.getElementById('amod-sampel-chevron');
    if (!list) return;
    _amodSampelOpen = list.style.display === 'none';
    list.style.display = _amodSampelOpen ? 'block' : 'none';
    if (chev) chev.style.transform = _amodSampelOpen ? 'rotate(180deg)' : '';
}

// Pindah ke halaman pemilihan tester (admin/analisa/analisa-modul-sampel.js).
// `mode` menentukan tampilan awal di sana: 'individu' -> checklist per akun
// user; 'grup' -> checklist per grup (grub) + switch per anggota. Konteks
// dititip lewat window var, pola sama dgn _asdOpenSampel() di analisa-soal-
// detail.js.
function _amodOpenSampel(mode) {
    window._analisaModulSampelKode = _amodKode;
    window._analisaModulSampelMode = mode;
    if (typeof _persistAnalisaCtx === 'function') _persistAnalisaCtx();
    navigateTo('analisa-modul-sampel');
}

// ── GRAFIK PER SOAL — ambil hasil hitung dari server (berdasar Sampel yang
// sedang tersimpan), lalu render 1 kartu per soal bernama dlm modul. Dipisah
// dari _amodRenderCharts() (murni render dari data yg sudah ada) supaya bisa
// dipanggil ulang sendiri tiap Sampel berubah (tambah/hapus tester) tanpa
// perlu reload seluruh halaman.
async function _amodFetchAndRenderCharts() {
    if (!_amodKode || !_amodModul) { _amodRenderCharts(null); return; }

    const sampel = _amodLoadSampel(_amodKode);
    const userKodes = _amodSampelUserKodes(sampel);
    if (!userKodes.length) {
        _amodRenderChartsEmpty('Pilih Sampel (Tester Individu/Grup) dulu di atas untuk melihat grafik modul ini');
        return;
    }

    _amodRenderChartsEmpty('Memuat grafik…');

    let hasil = null;
    try { hasil = await AnalisaAPI.hitungModul(_amodKode, userKodes); }
    catch (e) {
        console.error('Gagal memuat grafik analisa modul:', e);
        _amodRenderChartsEmpty('Gagal memuat grafik, silakan coba lagi');
        return;
    }
    _amodRenderCharts(hasil);
}

function _amodRenderChartsEmpty(msg) {
    const wrap = document.getElementById('amod-charts-wrap');
    if (!wrap) return;
    wrap.innerHTML = `<div class="card atd-chart-card"><div class="empty-state"><p>${_amodEsc(msg)}</p></div></div>`;
}

// ── RENDER: 1 kartu per soal bernama dlm modul, TEMPLATE grafik & fungsinya
// DISALIN PERSIS dari _atdRenderCharts() di analisa-token-detail.js — lihat
// komentar lengkap di sana. `hasil` di sini = respons POST /api/analisa/
// modul/:kode/hitung (per_soal, charts, tipe_soal — bentuknya SAMA PERSIS dgn
// agg dari GET /api/analisa/grup/:grubToken, krn keduanya sama-sama dibangun
// dari computeAnalisaGrupAggregate() di server.js).
function _amodRenderCharts(hasil) {
    const wrap = document.getElementById('amod-charts-wrap');
    if (!wrap) return;

    if (!hasil) { wrap.innerHTML = ''; return; }

    // Diisi (nomor GLOBAL, sama pola dgn _ATD_DUMMY_* di analisa-token-
    // detail.js) — dibaca analisa-soal.js (lookup 1 butir soal via klik
    // sumbu-X, by nomor GLOBAL).
    _ATD_DUMMY_BINARY = (hasil.charts && hasil.charts.binary) || [];
    _ATD_DUMMY_SKOR = (hasil.charts && hasil.charts.skor) || [];
    _ATD_DUMMY_SIKAP_RAW = (hasil.charts && hasil.charts.sikap) || [];

    const perSoal = hasil.per_soal || [];
    window._amodSikapGroupsByKode = {};

    if (!perSoal.length) {
        wrap.innerHTML = '<div class="card atd-chart-card"><div class="empty-state"><p>Belum ada peserta (dari sampel) yang menyelesaikan ujian utk modul ini</p></div></div>';
        return;
    }

    wrap.innerHTML = perSoal.map((grp, gi) => `<div class="card atd-chart-card" id="amod-chart-${gi}"></div>`).join('');

    perSoal.forEach((grp, gi) => {
        const containerId = 'amod-chart-' + gi;
        const namaSoal = _amodEsc(grp.soal_nama);

        if (grp.tipe === 'binary') {
            const items = grp.items || [];
            if (!items.length) { _atdEmptyChartCard(containerId, `${grp.soal_nama}: belum ada data`); return; }
            const cats = items.map(it => it.local);
            const clickVals = items.map(it => it.nomor);
            const series = [
                { label: 'Benar', color: '#16a34a', values: items.map(it => it.benar) },
                { label: 'Salah', color: '#dc2626', values: items.map(it => it.salah) }
            ];
            const maxVal = Math.max.apply(null, items.flatMap(it => [it.benar, it.salah]));
            _atdSetChartPopupData(containerId, { items });
            _atdBuildLineChart(containerId, {
                title: `${namaSoal} — Grafik Per Soal (Tipe Benar/Salah)`,
                sub: 'Jumlah peserta (dari sampel) yang menjawab Benar / Salah, per nomor soal (nomor butir soal ini)',
                categories: cats, clickValues: clickVals, series, maxVal, kind: 'binary', xClickFn: '_amodGoToButirDetail'
            });
            const leg = document.getElementById(containerId + '-legend');
            if (leg) leg.innerHTML = _atdBinaryLegendHtml();
            _atdBindChartEvents(containerId, 'binary');

        } else if (grp.tipe === 'skor') {
            const items = grp.items || [];
            if (!items.length) { _atdEmptyChartCard(containerId, `${grp.soal_nama}: belum ada data`); return; }
            const { series, sortedPerSoal } = _atdBuildOpsiSeries(items);
            const cats = items.map(it => it.local);
            const clickVals = items.map(it => it.nomor);
            const maxVal = Math.max.apply(null, items.flatMap(it => it.opsi.map(o => o.jumlah)));
            _atdSetChartPopupData(containerId, { items, sortedPerSoal, seriesMeta: series });
            _atdBuildLineChart(containerId, {
                title: `${namaSoal} — Grafik Per Soal (Tipe Nilai/Skor Sendiri)`,
                sub: 'Jumlah peserta (dari sampel) yang memilih tiap opsi jawaban, per nomor soal (nomor butir soal ini) — opsi sesama nilai 0 tetap dipisah, bukan digabung',
                categories: cats, clickValues: clickVals, series, maxVal, kind: 'skor', xClickFn: '_amodGoToButirDetail'
            });
            const leg = document.getElementById(containerId + '-legend');
            if (leg) leg.innerHTML = _atdSkorLegendHtml(series);
            _atdBindChartEvents(containerId, 'skor');

        } else if (grp.tipe === 'sikap') {
            const cats = grp.categories || [];
            const catRaw = grp.catRaw || [];
            if (!cats.length) { _atdEmptyChartCard(containerId, `${grp.soal_nama}: belum ada data`); return; }
            const distBenar = _atdDistFromRaw(catRaw, r => r.benar);
            const distSalah = _atdDistFromRaw(catRaw, r => r.salah);
            const distDijawab = _atdDistFromRaw(catRaw, r => r.benar + r.salah);
            const catData = [
                { label: 'Benar', color: '#16a34a', key: 'benar', dist: distBenar },
                { label: 'Salah', color: '#dc2626', key: 'salah', dist: distSalah },
                { label: 'Jumlah Dijawab', color: '#2666b8', key: 'dijawab', dist: distDijawab }
            ];
            window._amodSikapGroupsByKode[grp.soal_kode] = { soal_nama: grp.soal_nama, categories: cats, raw: catRaw, catData };
            _atdSetChartPopupData(containerId, { cats, dist: catData });
            // hideAnalisaBtn: true — tombol "Analisa" (drill-down ke analisa-
            // grafik.js) SENGAJA disembunyikan di sini karena halaman itu
            // dibangun khusus utk alur grup token (window._analisaGrafikDetailGrup),
            // belum ada versi utk alur modul/sampel manual.
            _atdBuildSikapMedianChart(containerId, {
                title: `${namaSoal} — Grafik Sikap Kerja (Median & Sebaran, Per Kolom)`,
                sub: 'Tiap bola = jumlah orang yang dapat nilai itu; garis = median (bukan rata-rata) tiap kategori per kolom',
                categories: cats, catData, kind: 'sikap', hideAnalisaBtn: true
            });
            const leg = document.getElementById(containerId + '-legend');
            if (leg) leg.innerHTML = _atdSikapLegendHtml();
            _atdBindChartEvents(containerId, 'sikap');
        }
    });
}

// Klik sumbu-X grafik (drill-down ke 1 butir soal) -> analisa-soal.js MODE
// DETAIL PER-NOMOR. window._analisaSoalDetailGrup SENGAJA dikosongkan (tidak
// ada grup token di alur ini) — window._analisaSoalDetailBackModulKode
// dititip supaya _asBack() (analisa-soal.js) tahu harus balik ke halaman
// modul ini, bukan ke alur token/soal biasa. Pola sama persis dgn
// _asdGoToButirDetail() (analisa-soal-detail.js) yg pakai
// window._analisaSoalDetailBackKode utk kasus serupa (balik ke 1 soal).
function _amodGoToButirDetail(evt, kind, nomor) {
    if (evt) evt.stopPropagation();
    window._analisaSoalDetailGrup = null;
    window._analisaSoalDetailNomor = nomor;
    window._analisaSoalDetailKind = kind;
    window._analisaSoalDetailBackKode = null;
    window._analisaSoalDetailBackToMateri = false;
    window._analisaSoalDetailBackModulKode = _amodKode;
    if (typeof _persistAnalisaCtx === 'function') _persistAnalisaCtx();
    navigateTo('analisa-soal');
}
