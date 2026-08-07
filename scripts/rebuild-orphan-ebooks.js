// scripts/rebuild-orphan-ebooks.js  (versi PostgreSQL)
//
// MASALAH: file PDF/poster ebook sudah ada di uploads/ebook/<folder>/, tapi baris
// datanya di tabel `ebooks` hilang/tidak pernah ada.
//
// SCRIPT INI: scan folder uploads/ebook/, cari folder yang TIDAK punya baris cocok di
// tabel `ebooks`, lalu otomatis daftarkan sebagai buku baru (pakai nama folder sebagai
// nama sementara — silakan diedit lagi nama & kelompoknya lewat menu Admin setelah ini).
//
// CARA PAKAI (dari folder project, sejajar dengan server.js):
//   node scripts/rebuild-orphan-ebooks.js
// (Pastikan .env / DATABASE_URL sudah di-set, sama seperti menjalankan server.js)
//
// Aman dijalankan berkali-kali: folder yang sudah punya baris di DB akan dilewati,
// tidak akan didaftarkan dobel.

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { pool, db, transaction } = require('../db/pool');
const { initSchema } = require('../db/init');

const ROOT = path.join(__dirname, '..');
const UPLOAD_EBOOK = path.join(ROOT, 'uploads', 'ebook');

function safeFolderName(name) {
    return (name || 'Tanpa_Nama').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function countPdfPages(filePath) {
    try {
        const buf = fs.readFileSync(filePath);
        const str = buf.toString('latin1');
        const countMatches = [...str.matchAll(/\/Type\s*\/Pages\b[\s\S]{0,300}?\/Count\s+(\d+)/g)];
        const countMatches2 = [...str.matchAll(/\/Count\s+(\d+)[\s\S]{0,300}?\/Type\s*\/Pages\b/g)];
        const all = [...countMatches, ...countMatches2].map(m => parseInt(m[1], 10)).filter(n => !isNaN(n));
        if (all.length) return Math.max(...all);
        const pageMatches = str.match(/\/Type\s*\/Page(?![a-zA-Z])/g);
        return pageMatches ? pageMatches.length : 0;
    } catch (e) {
        return 0;
    }
}

async function genKode(prefix, table) {
    const row = await db.prepare(`SELECT kode FROM ${table} WHERE kode LIKE ? ORDER BY id DESC LIMIT 1`).get(prefix + '%');
    if (!row) return prefix + '001';
    const num = parseInt(row.kode.replace(prefix, '')) + 1;
    return prefix + String(num).padStart(3, '0');
}

(async () => {
    if (!fs.existsSync(UPLOAD_EBOOK)) {
        console.log('[INFO] Folder uploads/ebook tidak ada — tidak ada yang perlu dipulihkan.');
        process.exit(0);
    }

    await initSchema(); // memastikan tabel ebooks ada (aman/idempotent kalau sudah ada)

    const existingRows = await db.prepare('SELECT nama, file_pdf FROM ebooks').all();
    const registeredFolders = new Set(existingRows.map(r => safeFolderName(r.nama)));

    const folders = fs.readdirSync(UPLOAD_EBOOK, { withFileTypes: true }).filter(d => d.isDirectory());
    let recovered = 0, skipped = 0;

    for (const folder of folders) {
        const folderName = folder.name;
        if (registeredFolders.has(folderName)) { skipped++; continue; }

        const folderPath = path.join(UPLOAD_EBOOK, folderName);
        const files = fs.readdirSync(folderPath);
        const pdfFile = files.find(f => f.toLowerCase().endsWith('.pdf'));
        const imgFile = files.find(f => /\.(png|jpe?g|gif|webp)$/i.test(f));

        if (!pdfFile) {
            console.log(`[LEWATI] "${folderName}" tidak punya file .pdf sama sekali — dilewati (mungkin cuma poster yatim).`);
            continue;
        }

        const pdfPath = path.join(folderPath, pdfFile);
        const namaTebakan = folderName.replace(/_/g, ' ').trim();
        const kode = await genKode('EBK', 'ebooks');
        const jumlahHalaman = countPdfPages(pdfPath);
        const ukuranBytes = fs.statSync(pdfPath).size;

        await db.prepare(`INSERT INTO ebooks (kode,nama,kelompok,poster,file_pdf,file_nama_asli,jumlah_halaman,ukuran_bytes)
                    VALUES (?,?,?,?,?,?,?,?)`)
            .run(kode, namaTebakan, null,
                 imgFile ? `/uploads/ebook/${folderName}/${imgFile}` : null,
                 `/uploads/ebook/${folderName}/${pdfFile}`, pdfFile, jumlahHalaman, ukuranBytes);

        console.log(`[PULIH] "${namaTebakan}" -> ${kode} (${jumlahHalaman} halaman) — edit nama/kelompoknya lewat menu Admin kalau perlu.`);
        recovered++;
    }

    console.log(`\nSelesai. ${recovered} buku dipulihkan, ${skipped} folder sudah terdaftar sebelumnya.`);
    await pool.end();
})();
