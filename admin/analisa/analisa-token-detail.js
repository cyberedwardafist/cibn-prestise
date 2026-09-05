// admin/analisa/analisa-token-detail.js
// Halaman detail Analisa untuk 1 token — dibuka dari admin/analisa/analisa-token.js
// lewat openAnalisaTokenDetail(kode). File ini SENGAJA dipisah dari analisa-token.js
// dan TIDAK didaftarkan sebagai item di SIDE_DOCK_GROUPS.analisa (lihat
// admin/index_admin.html): begitu halaman ini aktif, panel slide-dock ANALISA
// otomatis tertutup (groupForPage() tidak menemukan grupnya), dan tombol panah
// kembali di atas yang membawa balik ke page-analisa-token — yang otomatis
// membuka lagi panel slide-dock-nya.
//
// Isi analisa sebenarnya untuk token ini masih kosong, menyusul instruksi berikutnya.

function renderAnalisaTokenDetail() {
    const kode = window._analisaTokenDetailKode || null;
    const sub = document.getElementById('atd-kode-sub');
    if (sub) sub.textContent = kode ? `Kode Token: ${kode}` : '-';
    // TODO: render analisa sebenarnya untuk token ini di sini.
}
