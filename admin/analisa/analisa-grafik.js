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
// SENGAJA masih kosong (cuma tombol kembali) — isi halamannya menyusul di
// instruksi berikutnya.

function renderAnalisaGrafik() {
    const grup = window._analisaGrafikDetailGrup || null;
    const kind = window._analisaGrafikDetailKind || null;
    const sub = document.getElementById('ag-sub');
    if (sub) {
        sub.textContent = grup ? `Grup: ${grup}${kind ? ' · Grafik: ' + kind : ''}` : '-';
    }
}

function _agBack() {
    navigateTo(window._analisaGrafikDetailGrup ? 'analisa-token-detail' : 'analisa-token');
}
