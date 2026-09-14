// scripts/migrate-mentoring-materi.js
//
// LATAR BELAKANG: "Materi sesi mentoring" di paket-form (Keuangan) dulu dirakit
// manual per-paket (nama sesi bebas + daftar modul), disimpan di pakets.aturan_akses
// sbg string:
//   - "mentoring.materi.<id_lokal>.nama::<nama_encoded>"
//   - "mentoring.materi.<id_lokal>.modul.<kode_modul>"
//   - (format lebih lama lagi, flat) "mentoring.modul.<kode_modul>"
// Sekarang diganti: admin pilih LANGSUNG dari master data Management > Materi
// (tabel `materi`), disimpan sbg:
//   - "mentoring.materi.<kode_materi>"   (kode_materi = kode ASLI di tabel materi)
// id_lokal lama TIDAK bisa dipetakan otomatis ke kode_materi asli (tidak ada
// relasinya sama sekali) — satu-satunya cara mencocokkan adalah lewat NAMA yang
// pernah diketik admin dulu. Script ini:
//   1. Cari semua paket yang masih punya entri format lama di aturan_akses.
//   2. Untuk tiap "materi" lama (nama.:: ...), cocokkan nama itu (case-insensitive,
//      trim) ke nama/nama_internal materi asli di tabel `materi`.
//   3. Kalau ketemu PERSIS 1 kecocokan -> ganti entri lama punya paket itu dgn
//      "mentoring.materi.<kode_materi_asli>".
//   4. Kalau TIDAK ketemu, atau ketemu >1 kecocokan (ambigu) -> entri lama itu
//      dibuang (tidak dipakai UI baru sama sekali, jadi aman dibuang) dan
//      dicatat di ringkasan akhir buat admin pilih ulang manual di paket-form.
//   5. Entri format flat lama "mentoring.modul.<kode>" (tanpa nama materi sama
//      sekali) TIDAK bisa dicocokkan apa pun -> selalu masuk daftar "perlu
//      dicek manual".
//
// CARA PAKAI (dari folder project, sejajar dengan server.js):
//   node scripts/migrate-mentoring-materi.js            -> DRY RUN (cuma preview,
//                                                           tidak mengubah DB)
//   node scripts/migrate-mentoring-materi.js --apply     -> BENERAN mengubah DB
// (Pastikan .env / DATABASE_URL sudah di-set, sama seperti menjalankan server.js)
//
// Aman dijalankan berkali-kali: paket yang aturan_akses-nya sudah bersih dari
// format lama otomatis dilewati.

require('dotenv').config();
const { pool, db } = require('../db/pool');

const APPLY = process.argv.includes('--apply');

function parseOldMentoring(aturanArr) {
    const map = {}, order = [];
    for (const v of aturanArr) {
        let m = v.match(/^mentoring\.materi\.([^.]+)\.nama::(.*)$/);
        if (m) {
            if (!map[m[1]]) { map[m[1]] = { id: m[1], nama: '', modul: [] }; order.push(m[1]); }
            map[m[1]].nama = decodeURIComponent(m[2] || '');
            continue;
        }
        m = v.match(/^mentoring\.materi\.([^.]+)\.modul\.(.+)$/);
        if (m) {
            if (!map[m[1]]) { map[m[1]] = { id: m[1], nama: '', modul: [] }; order.push(m[1]); }
            map[m[1]].modul.push(m[2]);
            continue;
        }
    }
    const grup = order.map(id => map[id]);
    const legacyFlat = aturanArr.filter(v => v.startsWith('mentoring.modul.'));
    return { grup, legacyFlat };
}

// Baris ini sengaja SAMA PERSIS dgn regex yang dipakai buat deteksi format BARU
// (lihat _pfParseMentoringAturan di paket-form.js) — kalau sebuah baris cocok
// pola ini, berarti paket itu sudah pakai format baru, jangan disentuh.
function isNewFormat(v) {
    return v.startsWith('mentoring.materi.') && !v.includes('::') && !v.includes('.modul.');
}

(async () => {
    const pakets = await db.prepare(`SELECT kode, nama, aturan_akses FROM pakets WHERE aturan_akses IS NOT NULL`).all();
    const materiRows = await db.prepare(`SELECT kode, nama, nama_internal FROM materi`).all();
    const norm = s => (s || '').trim().toLowerCase();
    // index nama -> [kode,...] (bisa >1 kalau ada nama kembar -> ambigu)
    const materiByNama = {};
    for (const m of materiRows) {
        for (const nm of [m.nama, m.nama_internal]) {
            if (!nm) continue;
            const key = norm(nm);
            if (!materiByNama[key]) materiByNama[key] = new Set();
            materiByNama[key].add(m.kode);
        }
    }

    let diubah = 0, tidakBerubah = 0;
    const perluDicekManual = []; // { paket, alasan }

    for (const p of pakets) {
        let arr;
        try { arr = JSON.parse(p.aturan_akses); } catch (e) { continue; }
        if (!Array.isArray(arr)) continue;

        const oldEntries = arr.filter(v => v.startsWith('mentoring.') && !isNewFormat(v));
        if (!oldEntries.length) { tidakBerubah++; continue; }

        const { grup, legacyFlat } = parseOldMentoring(oldEntries);
        const kodeBaruSet = new Set();

        for (const g of grup) {
            const key = norm(g.nama);
            const cocok = materiByNama[key];
            if (cocok && cocok.size === 1) {
                kodeBaruSet.add([...cocok][0]);
            } else {
                perluDicekManual.push({
                    paket: `${p.nama} (${p.kode})`,
                    alasan: !cocok
                        ? `nama materi lama "${g.nama}" tidak ketemu di Management > Materi`
                        : `nama materi lama "${g.nama}" cocok ke ${cocok.size} materi berbeda (ambigu)`,
                });
            }
        }
        if (legacyFlat.length) {
            perluDicekManual.push({
                paket: `${p.nama} (${p.kode})`,
                alasan: `${legacyFlat.length} modul dari format lama tanpa nama materi (flat) — tidak bisa dicocokkan sama sekali`,
            });
        }

        // Buang SEMUA entri lama, tambahkan entri baru hasil pencocokan (kalau ada)
        const sisaTanpaLama = arr.filter(v => !(v.startsWith('mentoring.') && !isNewFormat(v)));
        const entriBaru = [...kodeBaruSet].map(kode => `mentoring.materi.${kode}`);
        const arrBaru = [...sisaTanpaLama, ...entriBaru];

        diubah++;
        console.log(`${APPLY ? '[APPLY]' : '[DRY-RUN]'} ${p.nama} (${p.kode}): ${oldEntries.length} entri lama -> ${entriBaru.length} materi baru cocok otomatis${grup.length - entriBaru.length > 0 || legacyFlat.length ? ` (sisanya perlu dicek manual, lihat ringkasan)` : ''}`);

        if (APPLY) {
            await db.prepare(`UPDATE pakets SET aturan_akses=? WHERE kode=?`).run(JSON.stringify(arrBaru), p.kode);
        }
    }

    console.log('\n── RINGKASAN ──');
    console.log(`Paket diproses  : ${diubah}`);
    console.log(`Paket dilewati  : ${tidakBerubah} (tidak ada format lama)`);
    if (perluDicekManual.length) {
        console.log(`\nPerlu dicek/pilih ULANG MANUAL di paket-form (Keuangan) untuk:`);
        perluDicekManual.forEach(x => console.log(`  - ${x.paket}: ${x.alasan}`));
    } else {
        console.log('\nSemua materi lama berhasil dicocokkan otomatis, tidak ada yang perlu dicek manual.');
    }
    if (!APPLY) {
        console.log('\nIni baru DRY RUN — DB belum diubah. Jalankan ulang dgn --apply kalau hasilnya sudah sesuai.');
    }

    await pool.end();
})();
