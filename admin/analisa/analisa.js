// admin/analisa/analisa.js
// Modul tab ANALISA — lazy-load saat tab dibuka pertama kali.
// Untuk sekarang halaman ini baru menampilkan tombol "+Analisa" di tengah
// (belum ada folder tersimpan). Logika buat/kelola folder Analisa menyusul.

let _analisaFolders = [];

function renderAnalisa() {
    _renderAnalisaContent();
}

function _renderAnalisaContent() {
    const c = document.getElementById('analisa-content'); if (!c) return;
    if (!_analisaFolders.length) {
        c.className = 'analisa-empty-wrap';
        c.innerHTML = `
      <button class="btn btn-primary" onclick="handleTambahAnalisa()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Analisa
      </button>`;
        return;
    }
    // TODO: render grid folder Analisa kalau sudah ada datanya.
}

function handleTambahAnalisa() {
    // TODO: buka form/modal buat folder Analisa baru — menyusul.
    showToast('Fitur tambah folder Analisa segera hadir', '');
}
