// admin/analisa/analisa-grafik.js
// Halaman ANALISA > GRAFIK. Dibuka lewat tombol "Analisa" di bawah legenda
// grafik "Sikap Kerja — Median & Sebaran, Per Kolom" pada
// admin/analisa/analisa-token-detail.js (lihat _atdGoToGrafikDetail() di
// sana). Konteksnya (grup asal + jenis grafik yg diklik) dititip di
// window._analisaGrafikDetail* sebelum navigateTo('analisa-grafik')
// dipanggil — pola sama persis dgn analisa-soal.js/_atdGoToSoalDetail().
//
// Tombol panah kembali di atas: balik ke halaman detail grup token yang
// tadi dibuka (analisa-token-detail), atau ke daftar grup (analisa-token)
// kalau entah kenapa dibuka tanpa konteks grup.
//
// ── ISI HALAMAN ──────────────────────────────────────────────────────────
// Sengaja dipakai ULANG data dummy + fungsi pembangun grafik yg SAMA PERSIS
// dgn admin/analisa/analisa-token-detail.js (_ATD_DUMMY_SIKAP_RAW,
// _atdDistFromRaw, _atdBuildSikapMedianChart, _atdSikapLegendHtml,
// _atdBindChartEvents, dst) — BUKAN disalin ulang — supaya grafiknya benar2
// identik dan otomatis ikut berubah kalau data dummy di sana diganti nanti.
// Aman dipanggil krn halaman ini cuma bisa dibuka lewat tombol "Analisa" yg
// ada di halaman analisa-token-detail, jadi js-nya sudah pasti sudah
// dimuat browser duluan.
//
// Tombol "Analisa" bawaan grafik (yg ada di halaman asal) DIMATIKAN di sini
// (opts.hideAnalisaBtn) supaya tidak ada tombol "Analisa" di dalam halaman
// Analisa itu sendiri.
//
// TODO: fungsi tambahan di halaman ini menyusul instruksi berikutnya.

function renderAnalisaGrafik() {
    const grup = window._analisaGrafikDetailGrup || null;
    const kind = window._analisaGrafikDetailKind || null;
    const sub = document.getElementById('ag-sub');
    if (sub) {
        sub.textContent = grup
            ? `Grup: ${grup}${kind ? ' · Grafik: ' + (kind === 'sikap' ? 'Sikap Kerja — Median & Sebaran' : kind) : ''}`
            : '-';
    }
    _agRenderContent(grup, kind);
}

function _agBack() {
    navigateTo(window._analisaGrafikDetailGrup ? 'analisa-token-detail' : 'analisa-token');
}

function _agRenderContent(grup, kind) {
    const el = document.getElementById('ag-content');
    if (!el) return;
    if (!grup || !kind) {
        el.innerHTML = '<div class="card"><div class="empty-state"><p>Analisa grafik akan segera hadir</p></div></div>';
        return;
    }
    if (kind === 'sikap') {
        _agRenderSikap(el);
        return;
    }
    el.innerHTML = '<div class="card"><div class="empty-state"><p>Analisa grafik ini belum tersedia</p></div></div>';
}

function _agRenderSikap(el) {
    if (typeof _atdBuildSikapMedianChart !== 'function' || typeof _ATD_DUMMY_SIKAP_RAW === 'undefined') {
        el.innerHTML = '<div class="card"><div class="empty-state"><p>Data grafik belum tersedia</p></div></div>';
        return;
    }
    el.innerHTML = '<div class="card atd-chart-card" id="ag-chart-sikap"></div>';

    // Hitung ulang sebaran dari sumber dummy yg sama (_ATD_DUMMY_SIKAP_RAW) —
    // bukan dari state global _atdSikapDist/_atdSikapCats, biar halaman ini
    // tetap benar walau dibuka lewat urutan apapun.
    const distBenar = _atdDistFromRaw(_ATD_DUMMY_SIKAP_RAW, r => r.benar);
    const distSalah = _atdDistFromRaw(_ATD_DUMMY_SIKAP_RAW, r => r.salah);
    const distDijawab = _atdDistFromRaw(_ATD_DUMMY_SIKAP_RAW, r => r.benar + r.salah);
    const cats = _ATD_DUMMY_SIKAP_RAW.map((_, i) => 'K' + (i + 1));
    const catData = [
        { label: 'Benar', color: '#16a34a', dist: distBenar },
        { label: 'Salah', color: '#dc2626', dist: distSalah },
        { label: 'Jumlah Dijawab', color: '#2666b8', dist: distDijawab }
    ];

    // Isi juga state global _atdSikapCats/_atdSikapDist (dideklarasikan di
    // analisa-token-detail.js) krn dipakai _atdRenderSikapStatPopup() saat
    // hover/klik kolom grafik — sama persis mekanismenya dgn di halaman asal.
    _atdSikapCats = cats;
    _atdSikapDist = catData;

    _atdBuildSikapMedianChart('ag-chart-sikap', {
        title: 'Grafik Sikap Kerja — Median & Sebaran, Per Kolom (dummy)',
        sub: 'Tiap bola = jumlah orang yang dapat nilai itu; garis = median (bukan rata-rata) tiap kategori per kolom',
        categories: cats, catData, kind: 'sikap',
        hideAnalisaBtn: true
    });
    const leg = document.getElementById('ag-chart-sikap-legend');
    if (leg) leg.innerHTML = _atdSikapLegendHtml();
    _atdBindChartEvents('ag-chart-sikap', 'sikap');
}
