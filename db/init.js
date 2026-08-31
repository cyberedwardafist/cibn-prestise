// db/init.js — Membuat skema (jika belum ada) + seed data awal (jika DB masih kosong).
// Dipanggil sekali saat server.js start. Aman dijalankan berkali-kali (idempotent):
// semua CREATE TABLE pakai IF NOT EXISTS, dan seed hanya jalan kalau belum ada admin.

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool, db, transaction } = require('./pool');

async function initSchema() {
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schemaSql);
}

async function seedIfEmpty() {
    const adminExists = await db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
    if (adminExists) return;

    await transaction(async (tdb) => {
        await tdb.prepare("INSERT INTO users (kode,nama,email,password,role,status) VALUES (?,?,?,?,?,?)")
            .run('ADM001', 'Super Admin', 'admin@cibnprestise.id', bcrypt.hashSync('Admin@123', 10), 'admin', 'aktif');
        await tdb.prepare("INSERT INTO users (kode,nama,email,password,role,status) VALUES (?,?,?,?,?,?)")
            .run('REV001', 'Reviewer 1', 'guru@cibnprestise.id', bcrypt.hashSync('Review@123', 10), 'review', 'aktif');
        await tdb.prepare("INSERT INTO grubs (kode,nama) VALUES (?,?)").run('GRP001', 'Kelompok A');
        await tdb.prepare("INSERT INTO grubs (kode,nama) VALUES (?,?)").run('GRP002', 'Kelompok B');
        await tdb.prepare("INSERT INTO modul (kode,nama,soal_list) VALUES (?,?,?)").run('MOD001', 'Modul Demo', JSON.stringify([]));
        await tdb.prepare("INSERT INTO pakets (kode,nama,deskripsi,periode_tipe,periode_hari,harga,status) VALUES (?,?,?,?,?,?,?)")
            .run('PKT001', 'Paket Bulanan', 'Akses penuh selama 30 hari', 'bulan', 30, 50000, 'aktif');
        await tdb.prepare("INSERT INTO pakets (kode,nama,deskripsi,periode_tipe,periode_hari,harga,status) VALUES (?,?,?,?,?,?,?)")
            .run('PKT002', 'Paket Tahunan', 'Akses penuh selama 365 hari', 'tahun', 365, 500000, 'aktif');
        await tdb.prepare("INSERT INTO landing (id,data) VALUES (1,?)").run(JSON.stringify({
            hero_title: 'CIBN PRESTISE', hero_sub: 'Platform Ujian & Asesmen Modern',
            show_hero: true, show_fitur: true, show_cta: true,
            fitur: [
                { icon: '🎯', judul: 'Ujian Online', deskripsi: 'Ujian real-time dengan keamanan tinggi' },
                { icon: '📊', judul: 'Laporan Detail', deskripsi: 'Analisis hasil ujian secara mendalam' },
                { icon: '🔐', judul: 'Token Aman', deskripsi: 'Kontrol akses peserta dengan mudah' },
            ],
        }));
    });
    console.log('✅ Database di-seed dengan data awal');
}

// Sanity check yang sama seperti versi lama: file ebook ada di disk tapi baris DB kosong.
async function sanityCheckEbooks(UPLOAD_EBOOK) {
    try {
        const ebookRowCount = (await db.prepare('SELECT COUNT(*) c FROM ebooks').get()).c;
        const fs2 = require('fs');
        const ebookFolders = fs2.existsSync(UPLOAD_EBOOK)
            ? fs2.readdirSync(UPLOAD_EBOOK, { withFileTypes: true }).filter(d => d.isDirectory())
            : [];
        if (ebookFolders.length > 0 && Number(ebookRowCount) === 0) {
            console.warn(`[WARNING] Ditemukan ${ebookFolders.length} folder file ebook di disk (uploads/ebook/) tapi tabel 'ebooks' di database KOSONG.`);
            console.warn('[WARNING] Jalankan: node scripts/rebuild-orphan-ebooks.js untuk memulihkan data dari folder yang ada.');
        }
    } catch (e) {
        console.error('[SANITY CHECK ERROR]', e.message);
    }
}

// Pastikan baris konfigurasi payment gateway (id=1) selalu ada. Dijalankan setiap
// start (bukan cuma di seedIfEmpty), supaya instalasi LAMA yang sudah punya admin
// tetap otomatis kebagian baris config ini saat pertama kali update ke versi ini.
async function ensureGatewayConfig() {
    const row = await db.prepare('SELECT id FROM payment_gateway_config WHERE id=1').get();
    if (!row) {
        await db.prepare("INSERT INTO payment_gateway_config (id,active_provider,midtrans_mode) VALUES (1,'none','sandbox')").run();
        console.log('✅ Baris konfigurasi payment_gateway_config (id=1) dibuat');
    }
}

module.exports = { initSchema, seedIfEmpty, sanityCheckEbooks, ensureGatewayConfig };
