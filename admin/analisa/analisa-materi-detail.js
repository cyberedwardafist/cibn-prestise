// admin/analisa/analisa-materi-detail.js
// Halaman detail 1 MATERI, dibuka dari klik salah satu lingkaran di baris
// "Ringkasan Per Materi" pada kartu "Grafik" admin/analisa/analisa-soal-
// detail.js (lihat _asdGoToMateriDetail() di sana). Konteksnya (kode soal +
// id/nama materi + kind grafik binary/skor) dititip di window._analisaMateri
// Detail* sebelum navigateTo('analisa-materi-detail') dipanggil — pola sama
// persis dgn window._analisaSoalListDetailKode di analisa-soal.js /
// window._analisaSoalDetail* di analisa-token-detail.js (lihat juga
// _persistAnalisaCtx/_restoreAnalisaCtx di js/app.js utk kasus refresh).
//
// Isinya SAMA PERSIS strukturnya dgn kartu "Grafik" di analisa-soal-detail.js
// (grafik garis, sumbu-X = nomor, klik nomor -> analisa-soal.js MODE DETAIL
// PER-NOMOR) — bedanya di sini datanya SUDAH DIFILTER cuma butir yang
// materi-nya sama dgn yang diklik, dan penomoran sumbu-X-nya LOKAL (reset
// mulai 1 lagi khusus materi ini, bukan nomor global soal) — sesuai
// keputusan yg sudah dikonfirmasi. Data mentahnya TETAP ditarik ulang dari
// POST /api/analisa/soal/:kode/hitung (Sampel manual yg sama dgn yg sudah
// diatur di kartu "Sampel" analisa-soal-detail.js) — bukan dari
// window._analisaSoalDetailHasil punya halaman asal, supaya halaman ini
// tetap benar walau dibuka langsung / di-refresh browser.
//
// Reuse total fungsi grafik SVG + popup dari admin/analisa/analisa-chart-
// shared.js (_atdBuildLineChart, _atdSetChartPopupData, dst) — sama seperti
// "Grafik Per Soal" (1 kartu per soal) di analisa-token-detail.js, karena
// kasusnya identik: index grafik di sini (0..N-1 butir materi ini) BEDA dari
// index di array _ATD_DUMMY_BINARY/_ATD_DUMMY_SKOR global (yang tetap harus
// diisi LENGKAP semua nomor soal, dipakai analisa-soal.js saat klik 1 nomor)
// — makanya popup hover per-titik WAJIB dititip lewat _atdSetChartPopupData,
// bukan mengandalkan variabel global itu apa adanya.

let _amdSoalKode = null, _amdMateriId = null, _amdMateriNama = null, _amdKind = null, _amdSoal = null;

async function renderAnalisaMateriDetail() {
    _amdSoalKode = window._analisaMateriDetailSoalKode || null;
    _amdMateriId = window._analisaMateriDetailMateriId || null;
    _amdMateriNama = window._analisaMateriDetailMateriNama || null;
    _amdKind = window._analisaMateriDetailKind || null;
    _amdSoal = null;

    const sub = document.getElementById('amd-sub');
    if (sub) sub.textContent = _amdMateriNama ? `Materi: ${_amdMateriNama}` : '-';

    if (!_amdSoalKode || !_amdMateriId) {
        _atdEmptyChartCard('amd-chart-container', 'Data materi tidak ditemukan, silakan buka lagi dari halaman Analisa Soal');
        return;
    }

    try { _amdSoal = await SoalAPI.getOne(_amdSoalKode); }
    catch (e) { console.error('Gagal memuat data soal utk Analisa Materi:', e); }

    if (sub) {
        const namaSoal = _amdSoal ? (_amdSoal.nama_internal ? `${_amdSoal.nama} (${_amdSoal.nama_internal})` : _amdSoal.nama) : _amdSoalKode;
        sub.textContent = `${_amdEsc(_amdMateriNama || 'Materi')} · ${_amdEsc(namaSoal)}`;
    }

    await _amdRenderChart();
}

function _amdEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Tombol panah kembali -> selalu balik ke halaman detail soal asalnya
// (analisa-soal-detail), bukan ke daftar Analisa > Soal — halaman ini cuma
// bisa dicapai lewat kartu "Grafik" di sana.
function _amdBack() {
    if (_amdSoalKode) window._analisaSoalListDetailKode = _amdSoalKode;
    navigateTo('analisa-soal-detail');
}

// ── SAMPEL — baca-saja dari localStorage, KUNCI & LOGIKA SAMA PERSIS dgn
// _asdSampelStorageKey/_asdSampelUserKodes di analisa-soal-detail.js.
// SENGAJA DITULIS ULANG (bukan panggil lintas file) supaya halaman ini tetap
// benar walau dibuka langsung/di-refresh sebelum analisa-soal-detail.js
// sempat ter-load duluan oleh browser.
function _amdLoadSampel(kode) {
    try { return JSON.parse(localStorage.getItem(`cbn_soal_sampel_${kode}`) || 'null') || { individu: [], grup: [] }; }
    catch (e) { return { individu: [], grup: [] }; }
}
function _amdSampelUserKodes(sampel) {
    const kodes = new Set();
    (sampel.individu || []).forEach(u => { if (u.kode) kodes.add(u.kode); });
    (sampel.grup || []).forEach(g => (g.members || []).forEach(m => { if (m.included && m.kode) kodes.add(m.kode); }));
    return Array.from(kodes);
}

// ── GRAFIK: 1 grafik per-nomor, KHUSUS butir yang materinya = materi yang
// diklik — sumbu-X pakai nomor LOKAL (reset 1,2,3,... khusus materi ini),
// klik titiknya tetap kirim nomor GLOBAL asli (lihat `clickVals` di bawah)
// supaya _asBuildOpsiData() di analisa-soal.js tetap tepat sasaran.
async function _amdRenderChart() {
    const el = document.getElementById('amd-chart-container');
    if (!el) return;
    if (!_amdSoalKode || !_amdMateriId) { el.style.display = 'none'; el.innerHTML = ''; return; }

    const sampel = _amdLoadSampel(_amdSoalKode);
    const userKodes = _amdSampelUserKodes(sampel);
    if (!userKodes.length) {
        el.style.display = '';
        el.innerHTML = '<div class="empty-state" style="padding:24px"><p>Sampel soal ini masih kosong — atur dulu di kartu "Sampel" pada halaman Analisa Soal</p></div>';
        return;
    }

    el.style.display = '';
    el.innerHTML = '<div class="empty-state" style="padding:24px"><p>Memuat grafik…</p></div>';

    let hasil = null;
    try { hasil = await AnalisaAPI.hitungSoal(_amdSoalKode, userKodes); }
    catch (e) {
        console.error('Gagal memuat grafik Analisa Materi:', e);
        _atdEmptyChartCard('amd-chart-container', 'Gagal memuat grafik, silakan coba lagi');
        return;
    }

    const charts = hasil.charts || { binary: [], skor: [] };
    // WAJIB diisi LENGKAP (semua nomor soal, bukan cuma materi ini) — masih
    // dipakai analisa-soal.js (_asBuildOpsiData, lookup by nomor GLOBAL)
    // begitu 1 titik grafik di bawah diklik.
    _ATD_DUMMY_BINARY = charts.binary || [];
    _ATD_DUMMY_SKOR = charts.skor || [];

    const kind = _amdKind === 'skor' ? 'skor' : 'binary';
    const fullData = kind === 'skor' ? _ATD_DUMMY_SKOR : _ATD_DUMMY_BINARY;
    const filtered = fullData.filter(e => e.materi === _amdMateriId);

    if (!filtered.length) {
        _atdEmptyChartCard('amd-chart-container', 'Belum ada data untuk materi ini (butir soal belum dijawab peserta pada sampel yang dipilih)');
        return;
    }

    const items = filtered.map((e, i) => Object.assign({}, e, { local: i + 1 }));
    const cats = items.map(it => it.local);
    const clickVals = items.map(it => it.nomor);
    const namaMateri = _amdEsc(_amdMateriNama || 'Materi');

    if (kind === 'skor') {
        const { series, sortedPerSoal } = _atdBuildOpsiSeries(items);
        const maxVal = Math.max.apply(null, items.flatMap(it => it.opsi.map(o => o.jumlah)));
        _atdSetChartPopupData('amd-chart-container', { items, sortedPerSoal, seriesMeta: series });
        _atdBuildLineChart('amd-chart-container', {
            title: `${namaMateri} — Grafik Per Nomor (Tipe Nilai/Skor Sendiri)`,
            sub: 'Jumlah peserta (dari sampel) yang memilih tiap opsi jawaban, per nomor butir pada materi ini',
            categories: cats, clickValues: clickVals, series, maxVal, kind: 'skor', xClickFn: '_amdGoToButirDetail'
        });
        const leg = document.getElementById('amd-chart-container-legend');
        if (leg) leg.innerHTML = _atdSkorLegendHtml(series);
        _atdBindChartEvents('amd-chart-container', 'skor');
    } else {
        const series = [
            { label: 'Benar', color: '#16a34a', values: items.map(it => it.benar) },
            { label: 'Salah', color: '#dc2626', values: items.map(it => it.salah) }
        ];
        const maxVal = Math.max.apply(null, items.flatMap(it => [it.benar, it.salah]));
        _atdSetChartPopupData('amd-chart-container', { items });
        _atdBuildLineChart('amd-chart-container', {
            title: `${namaMateri} — Grafik Per Nomor (Tipe Benar/Salah)`,
            sub: 'Jumlah peserta (dari sampel) yang menjawab Benar / Salah, per nomor butir pada materi ini',
            categories: cats, clickValues: clickVals, series, maxVal, kind: 'binary', xClickFn: '_amdGoToButirDetail'
        });
        const leg = document.getElementById('amd-chart-container-legend');
        if (leg) leg.innerHTML = _atdBinaryLegendHtml();
        _atdBindChartEvents('amd-chart-container', 'binary');
    }
}

// Klik nomor butir (sumbu-X, nomor LOKAL tapi kirim nomor GLOBAL lewat
// `clickValues`) -> pindah ke analisa-soal.js MODE DETAIL PER-NOMOR, sama
// persis pola & tampilannya dgn _asdGoToButirDetail() di analisa-soal-
// detail.js / _atdGoToSoalDetail() di analisa-token-detail.js.
// `_analisaSoalDetailBackToMateri` (BUKAN BackKode) dititip supaya tombol
// kembali di sana (_asBack(), analisa-soal.js) balik ke HALAMAN INI
// (analisa-materi-detail), bukan ke analisa-soal-detail.
function _amdGoToButirDetail(evt, kind, nomor) {
    if (evt) evt.stopPropagation();
    window._analisaSoalDetailGrup = null;
    window._analisaSoalDetailNomor = nomor;
    window._analisaSoalDetailKind = kind;
    window._analisaSoalDetailBackKode = null;
    window._analisaSoalDetailBackToMateri = true;
    if (typeof _persistAnalisaCtx === 'function') _persistAnalisaCtx();
    navigateTo('analisa-soal');
}
