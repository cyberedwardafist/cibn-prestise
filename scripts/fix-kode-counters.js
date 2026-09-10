// scripts/fix-kode-counters.js
//
// PERBAIKAN SATU-KALI untuk akar masalah "duplicate key value violates unique
// constraint laporan_kode_key" (dan potensi masalah sama di tabel ber-kode
// lain) yang muncul berulang di log /api/exam/submit.
//
// AKAR MASALAH:
// db/migrate-from-sqlite.js meng-INSERT data lama (laporan, users, dst)
// LANGSUNG dengan kode aslinya dari SQLite, TANPA lewat genKode() di
// server.js. Kalau tabel kode_counters untuk suatu tabel (mis. 'laporan')
// SUDAH punya baris counter dari sebelum migrasi dijalankan (mis. dari
// beberapa submit ujian asli di Postgres sebelum data lama di-import), maka
// setelah migrasi counter itu TIDAK otomatis ikut naik menyamai kode
// terbesar yang baru saja masuk dari data lama. Akibatnya genKode() terus
// menghasilkan kode yang KEBETULAN SUDAH DIPAKAI data lama, gagal 23505,
// berulang-ulang sampai counter akhirnya lewat angka terbesar yang ada.
//
// server.js sudah dipatch supaya /api/exam/submit otomatis mengulang dengan
// kode baru kalau ini terjadi (self-healing per-request), TAPI script ini
// tetap perlu dijalankan SEKALI di database produksi supaya kode_counters
// langsung benar dan tidak ada lagi percobaan gagal yang terbuang (submit
// pertama peserta langsung sukses, bukan sukses di percobaan ke-N setelah
// beberapa kali 400).
//
// CARA PAKAI (di server/lingkungan yang punya akses ke DATABASE_URL produksi):
//   node scripts/fix-kode-counters.js
//
// Aman dijalankan berkali-kali (idempotent) — hanya MENAIKKAN counter yang
// ketinggalan, tidak pernah menurunkan/mereset kode yang sudah lebih besar.

require('dotenv').config();
const { pool } = require('../db/pool');

// Sinkron dengan seluruh pasangan (prefix, table) yang dipakai genKode() di server.js.
const GENKODE_TABLES = [
    { prefix: 'UP',   table: 'user_pakets' },
    { prefix: 'USR',  table: 'users' },
    { prefix: 'PREQ', table: 'paket_requests' },
    { prefix: 'PKT',  table: 'pakets' },
    { prefix: 'GRP',  table: 'grubs' },
    { prefix: 'SOL',  table: 'soal' },
    { prefix: 'SKL',  table: 'soal_kelompok' },
    { prefix: 'MKL',  table: 'modul_kelompok' },
    { prefix: 'MOD',  table: 'modul' },
    { prefix: 'EBKL', table: 'ebook_kelompok' },
    { prefix: 'EBK',  table: 'ebooks' },
    { prefix: 'EMKL', table: 'ebook_modul_kelompok' },
    { prefix: 'EBM',  table: 'ebook_modul' },
    { prefix: 'LAP',  table: 'laporan' },   // <- penyebab error di log
    { prefix: 'JDS',  table: 'jadwal_sesi' },
];

(async () => {
    console.log('[FIX] Menyamakan kode_counters dgn kode terbesar yang sudah ada di tiap tabel...\n');
    let totalDiperbaiki = 0;

    for (const { prefix, table } of GENKODE_TABLES) {
        try {
            // Kode terbesar yang BENERAN ada di tabel (abaikan baris dgn format kode
            // yang tidak sesuai prefix+angka, mis. token master grup di tabel lain).
            const maxRes = await pool.query(
                `SELECT COALESCE(MAX(CAST(SUBSTRING(kode FROM $1) AS INTEGER)), 0) AS maxnum
                 FROM ${table} WHERE kode LIKE $2 AND SUBSTRING(kode FROM $1) ~ '^[0-9]+$'`,
                [prefix.length + 1, prefix + '%']
            );
            const maxNum = maxRes.rows[0].maxnum;

            const curRes = await pool.query(
                `SELECT counter FROM kode_counters WHERE table_name = $1`, [table]
            );
            const curCounter = curRes.rows[0] ? curRes.rows[0].counter : 0;

            if (curCounter >= maxNum) {
                console.log(`[OK]      ${table.padEnd(22)} counter=${curCounter} sudah >= data terbesar (${maxNum}) — tidak diubah.`);
                continue;
            }

            await pool.query(
                `INSERT INTO kode_counters (table_name, counter) VALUES ($1, $2)
                 ON CONFLICT (table_name) DO UPDATE SET counter = $2`,
                [table, maxNum]
            );
            console.log(`[DIPERBAIKI] ${table.padEnd(22)} counter: ${curCounter} -> ${maxNum} (kode berikutnya: ${prefix}${String(maxNum + 1).padStart(3, '0')})`);
            totalDiperbaiki++;
        } catch (e) {
            console.error(`[GAGAL] Tabel "${table}":`, e.message);
        }
    }

    console.log(`\n[SELESAI] ${totalDiperbaiki} tabel diperbaiki dari ${GENKODE_TABLES.length} yang dicek.`);
    await pool.end();
})();
