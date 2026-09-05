// admin/analisa/analisa-token-detail.js
// Halaman detail Analisa untuk 1 GRUP TOKEN — dibuka dari admin/analisa/analisa-token.js
// lewat openAnalisaTokenDetail(namaGrup). File ini SENGAJA dipisah dari analisa-token.js
// dan TIDAK didaftarkan sebagai item di SIDE_DOCK_GROUPS.analisa (lihat
// admin/index_admin.html): begitu halaman ini aktif, panel slide-dock ANALISA
// otomatis tertutup (groupForPage() tidak menemukan grupnya), dan tombol panah
// kembali di atas yang membawa balik ke page-analisa-token — yang otomatis
// membuka lagi panel slide-dock-nya.
//
// window._analisaTokenDetailGrup = nama grup yang diklik.
// window._analisaTokenDetailItems = seluruh token mentah dalam grup itu (siap
// dipakai untuk analisa lebih lanjut — mis. breakdown per token, per modul, dst).
//
// Isi analisa sebenarnya untuk grup ini masih kosong, menyusul instruksi berikutnya.

function renderAnalisaTokenDetail() {
    const grup = window._analisaTokenDetailGrup || null;
    const items = window._analisaTokenDetailItems || [];
    const sub = document.getElementById('atd-kode-sub');
    if (sub) sub.textContent = grup ? `Grup: ${grup} (${items.length} token)` : '-';
    // TODO: render analisa sebenarnya untuk grup ini di sini.
}
