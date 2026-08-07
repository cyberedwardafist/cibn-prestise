// db/migrate-from-sqlite.js
//
// Memindahkan SELURUH ISI DATA dari file database SQLite lama
// (data/cibn_prestise.db, format better-sqlite3) ke PostgreSQL yang baru.
//
// Struktur tabel PostgreSQL sudah dibuat otomatis oleh db/init.js (dipanggil
// juga oleh script ini), jadi tidak perlu bikin tabel manual dulu.
//
// CARA PAKAI:
//   1. Salin file database SQLite lama ke:  db/legacy-sqlite/cibn_prestise.db
//      (atau set env SQLITE_PATH ke lokasi file .db yang lain)
//   2. Pastikan .env sudah berisi DATABASE_URL yang mengarah ke PostgreSQL
//      TUJUAN (database kosong / baru, supaya tidak bentrok).
//   3. Install dependency migrasi (sekali saja, tidak perlu untuk run server):
//        npm install better-sqlite3
//   4. Jalankan:
//        node db/migrate-from-sqlite.js
//
// Script ini aman dijalankan ulang: akan menghapus (TRUNCATE) isi tabel tujuan
// dulu sebelum re-insert, supaya tidak terjadi duplikat kalau dijalankan 2x.
//
// CATATAN: better-sqlite3 sengaja TIDAK dimasukkan ke "dependencies" utama
// package.json (server produksi tidak butuh SQLite lagi), hanya perlu di-install
// sementara khusus untuk migrasi ini.

require('dotenv').config();
const path = require('path');
const fs = require('fs');

const SQLITE_PATH = process.env.SQLITE_PATH || path.join(__dirname, 'legacy-sqlite', 'cibn_prestise.db');

if (!fs.existsSync(SQLITE_PATH)) {
    console.error(`[GAGAL] File database SQLite lama tidak ditemukan di: ${SQLITE_PATH}`);
    console.error('        Salin file data/cibn_prestise.db (dari project lama) ke lokasi tersebut,');
    console.error('        atau set env SQLITE_PATH ke lokasi file .db yang benar.');
    process.exit(1);
}

let Database;
try {
    Database = require('better-sqlite3');
} catch (e) {
    console.error('[GAGAL] Module "better-sqlite3" belum terinstall.');
    console.error('        Jalankan sekali: npm install better-sqlite3');
    process.exit(1);
}

const { pool, db } = require('./pool');
const { initSchema } = require('./init');

// Urutan migrasi PENTING: tabel yang direferensikan tabel lain (lewat kode teks,
// bukan foreign key formal) sebaiknya duluan, walau di project ini tidak ada
// FK constraint formal jadi urutan sebenarnya bebas — tetap diurutkan logis.
const TABLES = [
    { name: 'users', cols: ['id','kode','nama','email','password','role','grub','status','paket_nama','langganan_mulai','langganan_akhir','created_at'] },
    { name: 'grubs', cols: ['id','kode','nama'] },
    { name: 'pakets', cols: ['id','kode','nama','deskripsi','periode_tipe','periode_hari','harga','fitur','status','created_at','link_landing','warna','icon','popular','periode','hak_akses','aturan_akses','maks_ujian','durasi_hari','hak_notes'] },
    { name: 'user_pakets', cols: ['id','kode','user_kode','paket_kode','paket_nama','periode_hari','mulai','akhir','status','created_at'] },
    { name: 'soal_kelompok', cols: ['id','kode','nama','created_at'] },
    { name: 'soal', cols: ['id','kode','nama','type','skor_type','opsi_jawaban','timer_jam','timer_menit','timer_detik','kelompok','data','created_at'] },
    { name: 'modul_kelompok', cols: ['id','kode','nama','created_at'] },
    { name: 'modul', cols: ['id','kode','nama','kelompok','soal_list','created_at'] },
    { name: 'ebook_kelompok', cols: ['id','kode','nama','created_at'] },
    { name: 'ebooks', cols: ['id','kode','nama','kelompok','poster','file_pdf','file_nama_asli','jumlah_halaman','ukuran_bytes','created_at'] },
    { name: 'ebook_modul_kelompok', cols: ['id','kode','nama','created_at'] },
    { name: 'ebook_modul', cols: ['id','kode','nama','kelompok','ebook_list','created_at'] },
    { name: 'tokens', cols: ['id','kode','modul_kode','aktivasi','expired','digunakan','digunakan_oleh','created_at','izinkan_review','grub_token'] },
    { name: 'laporan', cols: ['id','kode','token_kode','user_kode','modul_kode','tgl_selesai','waktu_pengerjaan','skor','jawaban','created_at','urutan_tampil'] },
    { name: 'landing', cols: ['id','data'] },
    { name: 'signup_requests', cols: ['id','nama','email','password','paket_nama','status','created_at'] },
];

(async () => {
    console.log(`[MIGRASI] Sumber SQLite : ${SQLITE_PATH}`);
    console.log(`[MIGRASI] Tujuan        : ${(process.env.DATABASE_URL || '').replace(/:[^:@]*@/, ':****@')}\n`);

    await initSchema();

    const sqlite = new Database(SQLITE_PATH, { readonly: true });

    for (const t of TABLES) {
        // Cek dulu tabel sumbernya ada (schema SQLite lama bisa jadi tidak lengkap
        // di database sangat lama sebelum fitur tertentu ditambahkan)
        const tableExists = sqlite.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
        ).get(t.name);
        if (!tableExists) {
            console.log(`[LEWATI] Tabel "${t.name}" tidak ada di database sumber.`);
            continue;
        }

        const sourceCols = sqlite.prepare(`PRAGMA table_info(${t.name})`).all().map(c => c.name);
        const cols = t.cols.filter(c => sourceCols.includes(c));
        const rows = sqlite.prepare(`SELECT ${cols.join(',')} FROM ${t.name}`).all();

        // Kosongkan dulu tabel tujuan (idempotent) — RESTART IDENTITY supaya SERIAL id
        // mulai dari 1 lagi, CASCADE untuk jaga-jaga kalau ada FK di masa depan.
        await pool.query(`TRUNCATE TABLE ${t.name} RESTART IDENTITY CASCADE`);

        if (!rows.length) {
            console.log(`[OK] ${t.name}: 0 baris (kosong)`);
            continue;
        }

        const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
        const insertSql = `INSERT INTO ${t.name} (${cols.join(',')}) VALUES (${placeholders})`;
        for (const row of rows) {
            const values = cols.map(c => row[c]);
            await pool.query(insertSql, values);
        }

        // Samakan sequence SERIAL id supaya insert berikutnya (lewat aplikasi) tidak
        // bentrok dengan id yang baru saja dimigrasikan.
        if (cols.includes('id')) {
            await pool.query(
                `SELECT setval(pg_get_serial_sequence('${t.name}', 'id'), COALESCE((SELECT MAX(id) FROM ${t.name}), 1))`
            );
        }

        console.log(`[OK] ${t.name}: ${rows.length} baris dipindahkan`);
    }

    sqlite.close();
    await pool.end();
    console.log('\n✅ Migrasi selesai. Silakan cek data di PostgreSQL sebelum menghapus database SQLite lama.');
})().catch((e) => {
    console.error('[FATAL]', e);
    process.exit(1);
});
