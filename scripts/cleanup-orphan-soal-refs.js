// scripts/cleanup-orphan-soal-refs.js  (versi PostgreSQL)
//
// MASALAH LAMA: sebelum fix ini ada, menghapus soal dari Library TIDAK ikut
// membersihkan referensinya di dalam modul.soal_list. Akibatnya modul lama bisa
// menyimpan "kode soal hantu" (soal_kode yang sudah tidak ada di tabel `soal`).
// Ini bikin jumlah soal yang ditampilkan di kartu modul tidak sama dengan yang
// benar-benar bisa dikerjakan siswa saat ujian.
//
// SCRIPT INI: scan semua modul, buang entri soal_list yang soal_kode-nya sudah
// tidak ada di tabel soal, lalu simpan ulang. Aman dijalankan berkali-kali —
// modul yang sudah bersih tidak akan diubah/dilaporkan.
//
// CARA PAKAI (dari folder project, sejajar dengan server.js):
//   node scripts/cleanup-orphan-soal-refs.js
// (Pastikan .env / DATABASE_URL sudah di-set, sama seperti menjalankan server.js)

require('dotenv').config();
const { pool, db } = require('../db/pool');

(async () => {
    const soalRows = await db.prepare('SELECT kode FROM soal').all();
    const validKodes = new Set(soalRows.map(s => s.kode));

    const modRows = await db.prepare('SELECT kode, nama, soal_list FROM modul').all();
    let modulDiperbaiki = 0, totalReferensiHantuDibuang = 0;

    for (const m of modRows) {
        let list; try { list = JSON.parse(m.soal_list || '[]'); } catch (e) { list = []; }
        const filtered = list.filter(sl => validKodes.has(sl.soal_kode));
        const dibuang = list.length - filtered.length;

        if (dibuang > 0) {
            await db.prepare('UPDATE modul SET soal_list=? WHERE kode=?').run(JSON.stringify(filtered), m.kode);
            console.log(`[DIPERBAIKI] Modul "${m.nama}" (${m.kode}): ${dibuang} referensi soal hantu dibuang (sisa ${filtered.length} soal valid).`);
            modulDiperbaiki++;
            totalReferensiHantuDibuang += dibuang;
        }
    }

    console.log(`\nSelesai. ${modulDiperbaiki} modul diperbaiki, total ${totalReferensiHantuDibuang} referensi soal hantu dibuang.`);
    if (modulDiperbaiki === 0) console.log('Tidak ada data yang perlu dibersihkan — semua modul sudah sinkron dengan library soal.');
    await pool.end();
})();
