// scripts/backfill-laporan-izinkan-review.js  (versi PostgreSQL)
//
// MASALAH LAMA: sebelum kolom laporan.izinkan_review ada, izin review siswa dibaca
// LIVE dari tabel tokens setiap kali diminta — sehingga kalau token sudah dihapus
// admin, siswa kehilangan akses review permanen walau laporannya sendiri masih ada.
//
// SCRIPT INI: isi kolom laporan.izinkan_review yang masih NULL/kosong untuk data lama:
//   - Kalau token_kode-nya MASIH ADA di tabel tokens -> pakai nilai izinkan_review
//     token itu apa adanya (mencerminkan pengaturan asli saat token dibuat).
//   - Kalau token_kode-nya SUDAH TIDAK ADA (token sudah dihapus) -> default diizinkan
//     (1), supaya tidak menghukum siswa yang sebelumnya legal boleh review, hanya
//     karena baris tokennya sudah dibersihkan admin.
//
// CARA PAKAI (dari folder project, sejajar dengan server.js):
//   node scripts/backfill-laporan-izinkan-review.js
// (Pastikan .env / DATABASE_URL sudah di-set, sama seperti menjalankan server.js)
//
// Aman dijalankan berkali-kali: laporan yang izinkan_review-nya sudah terisi
// (bukan NULL) akan dilewati, tidak akan ditimpa ulang.

require('dotenv').config();
const { pool, db } = require('../db/pool');

(async () => {
    const rows = await db.prepare(`
        SELECT l.kode, l.token_kode, t.izinkan_review as token_izin
        FROM laporan l
        LEFT JOIN tokens t ON l.token_kode = t.kode
        WHERE l.izinkan_review IS NULL
    `).all();

    if (!rows.length) {
        console.log('Tidak ada laporan yang perlu di-backfill — semua sudah punya nilai izinkan_review.');
        await pool.end();
        return;
    }

    let dariToken = 0, defaultDiizinkan = 0;
    for (const r of rows) {
        const nilai = (r.token_izin !== null && r.token_izin !== undefined) ? (r.token_izin ? 1 : 0) : 1;
        if (r.token_izin !== null && r.token_izin !== undefined) dariToken++; else defaultDiizinkan++;
        await db.prepare('UPDATE laporan SET izinkan_review=? WHERE kode=?').run(nilai, r.kode);
    }

    console.log(`Selesai. ${rows.length} laporan di-backfill (${dariToken} mengikuti token yang masih ada, ${defaultDiizinkan} default diizinkan karena tokennya sudah terhapus).`);
    await pool.end();
})();
