// admin/analisa/analisa-soal.js
// Halaman ANALISA > SOAL. Untuk sekarang SENGAJA DIKOSONGKAN (isinya menyusul) —
// dibuka dari 2 arah:
//   1) Lewat panel slide-dock ANALISA (tombol "SOAL") — langsung, tanpa konteks
//      grup/soal tertentu.
//   2) Lewat klik nomor soal (sumbu-X) di grafik "Benar/Salah" atau "Nilai/Skor
//      Sendiri" pada halaman admin/analisa/analisa-token-detail.js — lihat
//      _atdGoToSoalDetail() di sana. Konteksnya (grup asal + nomor + tipe
//      grafik yg diklik) disimpan di window._analisaSoalDetail* sebelum
//      navigateTo('analisa-soal') dipanggil.
//
// Tombol panah kembali di atas: kalau dibuka dari grafik (ada window._analisaSoalDetailGrup),
// balik ke halaman detail grup token yang tadi dibuka (analisa-token-detail) —
// datanya (window._analisaTokenDetailGrup/Items) masih utuh krn tidak direset di sini,
// jadi halaman itu langsung ke-render lagi persis grup yang sama. Kalau dibuka
// langsung dari slide-dock (tidak ada konteks grup), balik ke daftar grup (analisa-token).

function renderAnalisaSoal() {
    const grup = window._analisaSoalDetailGrup || null;
    const nomor = window._analisaSoalDetailNomor || null;
    const kind = window._analisaSoalDetailKind || null;
    const sub = document.getElementById('as-sub');
    if (sub) {
        sub.textContent = (grup && nomor)
            ? `Soal No. ${nomor} · Grup: ${grup}${kind ? ' · Tipe: ' + (kind === 'skor' ? 'Nilai/Skor Sendiri' : 'Benar/Salah') : ''}`
            : '-';
    }
    // TODO: render analisa per-soal beneran di #as-content menyusul instruksi berikutnya.
}

function _asBack() {
    navigateTo(window._analisaSoalDetailGrup ? 'analisa-token-detail' : 'analisa-token');
}
