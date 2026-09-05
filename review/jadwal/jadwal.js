// user/jadwal.js
// Modul JADWAL — lazy-load saat tab Jadwal dibuka.
// Bergantung pada helper global dari shell index_user.html (showToast, dst) dan
// js/swipe.js (SwipeCards, dimuat eager di shell) yang sudah dimuat lebih dulu.
//
// CATATAN: Ini "tampilan dulu, sistem dummy" — semua data pengajuan jadwal disimpan
// di localStorage lewat JadwalStore (bukan lewat server). Struktur data & nama
// fungsi (add/update/remove/byDate) sengaja dibuat mirip pola CRUD API supaya nanti
// gampang tinggal diganti jadi apiFetch('/user/jadwal', ...) tanpa ubah UI di atasnya.

/* ══════════════════════════════════════════
   DATA REFERENSI (nanti gampang disambung ke tabel master di backend)
   ══════════════════════════════════════════ */
const JDW_SLOTS = [
    { id: 'slot1', label: '07.45 - 09.15' },
    { id: 'slot2', label: '09.45 - 11.15' },
    { id: 'slot3', label: '11.45 - 13.15' },
    { id: 'slot4', label: '13.45 - 15.15' },
    { id: 'slot5', label: '15.45 - 17.15' },
    { id: 'slot6', label: '17.45 - 19.15' },
    { id: 'slot7', label: '19.45 - 20.15' },
];
const JDW_MATERI = [
    { id: 'twk', label: 'TWK' },
    { id: 'tiu', label: 'TIU' },
    { id: 'tkp', label: 'TKP' },
    { id: 'toefl_struktur', label: 'TOEFL Struktur' },
    { id: 'toefl_listening', label: 'TOEFL Listening' },
    { id: 'toefl_reading', label: 'TOEFL Reading' },
];
// Daftar tentor + materi & jam yang mereka ajar/available. `materi:'ALL'` /
// `slots:'ALL'` artinya tanpa batasan sama sekali buat sisi itu. `slots:[]`
// artinya tentor itu belum ada jam available sama sekali (semua jam
// dikunci). CATATAN: materi ALBERT & PRAM belum ditentukan secara eksplisit
// — untuk sementara disamakan dengan tentor sejenis (ALBERT ikut TWK/TIU/TKP
// kayak RAFFI, PRAM ikut TOEFL kayak CHIKA). Gampang diubah, tinggal edit
// array di bawah ini.
const JDW_TENTOR = [
    { id: 'albert', name: 'ALBERT', materi: ['twk', 'tiu', 'tkp'], slots: [] },
    { id: 'chika', name: 'CHIKA', materi: ['toefl_struktur', 'toefl_listening', 'toefl_reading'], slots: ['slot4', 'slot5'] },
    { id: 'pram', name: 'PRAM', materi: ['toefl_struktur', 'toefl_listening', 'toefl_reading'], slots: 'ALL' },
    { id: 'angga', name: 'ANGGA', materi: 'ALL', slots: ['slot1', 'slot6', 'slot7'] },
    { id: 'raffi', name: 'RAFFI', materi: ['twk', 'tiu', 'tkp'], slots: ['slot2', 'slot6'] },
];
const JDW_STATUS_LABEL = { pending: 'Menunggu', acc: 'Disetujui', ditolak: 'Ditolak', berlangsung: 'Berlangsung', feedback: 'Feedback', selesai: 'Selesai', pengajuan_pembatalan: 'Pengajuan Pembatalan', resejuel: 'Jadwal Ulang dari Tentor', batal: 'Dibatalkan', butuh_persetujuan: 'Butuh Persetujuan', pengajuan_batal_tentor: 'Pengajuan Batal dari Tentor' };
// Kuota pengajuan jadwal per user (dummy — nanti gampang disambung ke angka
// beneran dari backend/paket bimbingan user, tinggal ganti sumber angka
// TOTAL-nya, logika hitungnya di bawah (_jdwKuotaTerpakai/_jdwKuotaSisa)
// TIDAK perlu diubah). Kuota TERPAKAI dihitung LANGSUNG dari status
// pengajuan yang lagi aktif (dummy, bukan angka tersimpan terpisah) —
// jadi otomatis nambah/berkurang sendiri ngikutin perubahan status, tanpa
// perlu ada kode terpisah buat nambah/kurangin manual tiap ada aksi:
//   - MENGURANGI kuota (masih dianggap "aktif", 1 slot lagi kepakai): pending
//     (menunggu), acc (disetujui), berlangsung, pengajuan_pembatalan (masih
//     nunggu keputusan batal/tidak), butuh_persetujuan, resejuel (jadwal
//     ulang dari tentor, masih berbasis entri "acc" yang sama),
//     pengajuan_batal_tentor (pengajuan pembatalan dari tentor, masih
//     berbasis entri "acc" yang sama, belum diputuskan Setuju/Tolak).
//   - TIDAK/SUDAH TIDAK LAGI mengurangi kuota (otomatis balik nambah kuota
//     begitu status masuk salah satu ini): ditolak (pengajuan ditolak),
//     batal (dibatalkan), selesai (sesi sudah tuntas).
const JDW_KUOTA_TOTAL = 10;
function _jdwKuotaTerpakai() {
    return JadwalStore.all().filter(e => e.status !== 'ditolak' && e.status !== 'batal' && e.status !== 'selesai').length;
}
function _jdwKuotaSisa() {
    return Math.max(0, JDW_KUOTA_TOTAL - _jdwKuotaTerpakai());
}
// Kuota PEMBATALAN (beda dari kuota pengajuan di atas) — jatah user
// membatalkan jadwal yang SUDAH disetujui (acc), maksimal 3x total selama
// user aktif (dummy — nanti gampang disambung ke angka beneran dari
// backend, tinggal ganti sumber angka TOTAL-nya di bawah, logika hitungnya
// TIDAK perlu diubah). Pembatalan pada jadwal yang BELUM di-acc (masih
// "pending"/menunggu) TIDAK menyentuh kuota ini sama sekali — begitu
// dibatalkan entrinya langsung dihapus (JadwalStore.remove, lihat
// JadwalPage.confirmBatal) dan otomatis balik jadi slot kosong di kuota
// PENGAJUAN di atas, bukan di kuota pembatalan ini.
//
// Kuota TERPAKAI dihitung dari entri yang statusnya lagi
// "pengajuan_pembatalan" (masih menunggu keputusan) ATAU sudah "batal" oleh
// user (batalOleh:'user'), DAN field pembatalanDihitung-nya true. Field
// pembatalanDihitung ini yang nentuin APAKAH pembatalan itu ikut motong
// kuota atau tidak — diisi sekali pas user submit pengajuan pembatalan
// (lihat JadwalPage.submitBatalPengajuan), berdasar flag freeCancelEligible
// entri itu SAAT DIBATALKAN:
//   - freeCancelEligible FALSE (kasus normal) -> pembatalanDihitung TRUE,
//     IKUT motong kuota ini.
//   - freeCancelEligible TRUE -> pembatalanDihitung FALSE, TIDAK motong
//     kuota (gratis). Ini kejadian kalau posisi user membatalkan jadwal
//     PERSIS setelah ada pengajuan jadwal ulang dari TENTOR (status
//     "resejuel") yang baru saja diputuskan (disetujui ATAU ditolak
//     sekalipun) — jadwal jadi berantakan gara-gara tentor, bukan salah
//     user, jadi user "dimaafkan" sekali buat pembatalan berikutnya. Flag
//     freeCancelEligible ini yang di-set di JadwalPage.setujuResejuel &
//     JadwalPage.tolakResejuel.
// "Tarik Pembatalan" (JadwalPage.confirmTarikBatal) otomatis ngebalikin
// kuota juga — statusnya balik jadi "acc" jadi otomatis nggak lolos filter
// status di bawah lagi, TIDAK perlu kode tambahan buat nambah manual.
const JDW_KUOTA_BATAL_TOTAL = 3;
function _jdwKuotaBatalTerpakai() {
    return JadwalStore.all().filter(e =>
        e.pembatalanDihitung === true &&
        (e.status === 'pengajuan_pembatalan' || (e.status === 'batal' && e.batalOleh === 'user'))
    ).length;
}
function _jdwKuotaBatalSisa() {
    return Math.max(0, JDW_KUOTA_BATAL_TOTAL - _jdwKuotaBatalTerpakai());
}
// Render KEDUA badge kuota di header (id=jdw-kuota-value & id=jdw-kuota-batal-value)
// — dipanggil dari dalam _jdwRenderStatusList() (satu-satunya titik render
// yang SUDAH dipanggil di SEMUA tempat sesudah status pengajuan/pembatalan
// berubah, lihat semua pemanggil _jdwRenderStatusList() di file ini) supaya
// kedua badge ini otomatis ikut ter-update tiap ada perubahan, TIDAK perlu
// ditambah manual di tiap pemanggil satu-satu.
function _jdwRenderKuota() {
    const el = document.getElementById('jdw-kuota-value');
    if (el) el.textContent = `${_jdwKuotaSisa()}/${JDW_KUOTA_TOTAL}`;
    const elBatal = document.getElementById('jdw-kuota-batal-value');
    if (elBatal) elBatal.textContent = `${_jdwKuotaBatalSisa()}/${JDW_KUOTA_BATAL_TOTAL}`;
}
const JDW_DAY_NAMES = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const JDW_DAY_SHORT = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const JDW_MONTH_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const JDW_MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

/* ══════════════════════════════════════════
   DATA LAYER DUMMY (localStorage) — ganti isi fungsi2 ini kalau sudah ada backend
   ══════════════════════════════════════════ */
const JadwalStore = (function () {
    const KEY = 'cbn_jadwal_pengajuan_dummy_v1';
    let _cache = null;

    function _toIso(d) {
        const x = new Date(d);
        x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
        return x.toISOString().slice(0, 10);
    }
    function _todayIso(offsetDays) {
        const d = new Date();
        d.setDate(d.getDate() + (offsetDays || 0));
        d.setHours(0, 0, 0, 0);
        return _toIso(d);
    }
    function _seed() {
        // Contoh data awal biar SEMUA status & SEMUA variasi tombol aksi
        // (menunggu/disetujui/ditolak/berlangsung-Masuk/berlangsung-Feedback/
        // selesai/pengajuan-pembatalan) kelihatan sekaligus di demo pertama
        // kali — sekali dibuat, tidak akan ditimpa lagi. Tanggal sengaja
        // diatur relatif ke hari ini (bukan hardcode) supaya
        // _jdwAutoExpirePending()/_jdwAutoAdvanceStatus() tidak langsung
        // mengubah status pending->ditolak atau acc->berlangsung/selesai
        // saat pertama kali dibuka (lihat catatan status per-entry di bawah).
        // Cek juga _entryActions() buat lihat tombol persis apa yang muncul
        // di tiap status.
        const arr = [
            // pending (menunggu) -> tombol Edit + Batal. 2 entri di HARI YANG SAMA
            // (besok) buat sekalian tes tampilan 2 kartu numpuk di satu tanggal.
            { id: 'seed_pending1', tanggal: _todayIso(1), slotId: 'slot1', materiId: 'tiu', tentorId: 'angga', status: 'pending', createdAt: Date.now() - 110000000 },
            { id: 'seed_pending2', tanggal: _todayIso(1), slotId: 'slot3', materiId: 'twk', tentorId: 'albert', status: 'pending', createdAt: Date.now() - 100000000 },
            // acc (disetujui) -> tombol Jadwal Ulang + Batal (Batal disini buka
            // overlay Ajukan Pembatalan, BUKAN dialog konfirmasi kecil). Dua
            // tanggal beda minggu buat sekalian tes nav minggu di kalender.
            { id: 'seed_acc1', tanggal: _todayIso(1), slotId: 'slot6', materiId: 'tkp', tentorId: 'raffi', status: 'acc', createdAt: Date.now() - 90000000 },
            { id: 'seed_acc2', tanggal: _todayIso(8), slotId: 'slot4', materiId: 'toefl_struktur', tentorId: 'chika', status: 'acc', createdAt: Date.now() - 85000000 },
            // acc, tanggal HARI INI (hari H) -> khusus buat tes popup "Tidak Bisa
            // Dijadwalkan Ulang" (batas H-1 sudah lewat): klik tombol "Jadwal
            // Ulang" di kartu ini harus munculkan popup, form Ajukan Jadwal
            // Ulang TIDAK boleh kebuka. Lihat JadwalPage.resejadwalEntry &
            // _jdwCanReschedule.
            { id: 'seed_acc_harih', tanggal: _todayIso(0), slotId: 'slot5', materiId: 'toefl_reading', tentorId: 'chika', status: 'acc', createdAt: Date.now() - 87000000 },
            // berlangsung, jam BELUM lewat -> tombol "Masuk" (slot malam, jadi
            // biasanya masih kelihatan "Masuk" kecuali kamu tes di atas jam
            // 20.15). Kalau pas dites udah lewat jam segitu, otomatis kegantian jadi
            // tombol "Feedback" sendiri — itu bukan bug, hitungannya emang
            // berdasar jam saat ini, bukan status tersimpan.
            { id: 'seed_berlangsung_masuk', tanggal: _todayIso(0), slotId: 'slot7', materiId: 'tiu', tentorId: 'angga', status: 'berlangsung', createdAt: Date.now() - 80000000 },
            // berlangsung, jam SUDAH lewat -> tombol "Feedback" (slot pagi, jadi
            // biasanya udah lewat kecuali kamu tes sebelum jam 09.15).
            { id: 'seed_berlangsung_feedback', tanggal: _todayIso(0), slotId: 'slot1', materiId: 'twk', tentorId: 'raffi', status: 'berlangsung', createdAt: Date.now() - 75000000 },
            // ditolak -> tanpa tombol aksi sama sekali. Satu hari ini, satu di
            // riwayat (buat tes toggle Minggu Ini/Riwayat).
            { id: 'seed_ditolak1', tanggal: _todayIso(0), slotId: 'slot2', materiId: 'tkp', tentorId: 'angga', status: 'ditolak', createdAt: Date.now() - 70000000 },
            { id: 'seed_ditolak2', tanggal: _todayIso(-2), slotId: 'slot2', materiId: 'tiu', tentorId: 'raffi', status: 'ditolak', createdAt: Date.now() - 65000000 },
            // pengajuan_pembatalan -> tombol "Tarik Pembatalan" (balik ke acc).
            // pembatalanDihitung:true -> ini pembatalan NORMAL (bukan gratis),
            // ikut motong kuota pembatalan (lihat JDW_KUOTA_BATAL_TOTAL &
            // _jdwKuotaBatalTerpakai) — sekalian jadi contoh badge "Batal: 2/3"
            // begitu digabung sama seed_batal_user di bawah.
            { id: 'seed_batal', tanggal: _todayIso(1), slotId: 'slot4', materiId: 'toefl_listening', tentorId: 'chika', status: 'pengajuan_pembatalan', alasanBatal: 'Ada jadwal ujian sekolah yang bentrok', pembatalanDihitung: true, createdAt: Date.now() - 60000000 },
            // selesai -> tanpa tombol aksi sama sekali, terlepas feedbackDone
            // sudah diisi atau belum (beda dari "berlangsung" yang jam sudah
            // lewat, itu MASIH ada tombol Feedback). Dua entri riwayat, beda
            // status feedbackDone, buat tes tampilan kartu selesai.
            { id: 'seed_selesai1', tanggal: _todayIso(-1), slotId: 'slot3', materiId: 'toefl_reading', tentorId: 'pram', status: 'selesai', feedbackDone: true, feedback: { paham: 4, kualitas: 5, catatan: 'Penjelasannya jelas & mudah diikuti', filledAt: Date.now() - 50000000 }, createdAt: Date.now() - 55000000 },
            { id: 'seed_selesai2', tanggal: _todayIso(-3), slotId: 'slot5', materiId: 'twk', tentorId: 'albert', status: 'selesai', feedbackDone: false, createdAt: Date.now() - 40000000 },
            // resejuel (jadwal ulang DARI TENTOR, beda dari "Jadwal Ulang" biasa
            // yang diajukan user) -> kartunya tampil normal di list tanggal
            // jadwal LAMA-nya (sama seperti status lain), tombolnya cuma "Cek"
            // yang membuka halaman fullscreen bandingkan jadwal lama vs baru.
            // Field tanggal/slotId/materiId di entri ini TETAP jadwal LAMA (yang
            // diajukan user) — jadwal BARU dari tentor disimpan terpisah di
            // field `reschedule` (termasuk alasan tentor mengajukan jadwal
            // ulang), biar gampang balik ke lama kalau ditolak.
            { id: 'seed_resejuel', tanggal: _todayIso(2), slotId: 'slot2', materiId: 'tiu', tentorId: 'raffi', status: 'resejuel', reschedule: { tanggal: _todayIso(4), slotId: 'slot5', materiId: 'tiu', alasan: 'Tentor ada keperluan mendadak di jam yang sama' }, createdAt: Date.now() - 30000000 },
            // batal, DIBATALKAN OLEH TENTOR (field batalOleh:'tentor') -> tanpa
            // tombol aksi (kayak "selesai"). Tanggalnya KEMARIN (sudah lewat) ->
            // sekarang ikut aturan tanggal biasa, jadi sudah pindah ke Riwayat,
            // TIDAK nongol lagi di "Minggu Ini" (beda dari perilaku lama).
            { id: 'seed_batal_tentor', tanggal: _todayIso(-1), slotId: 'slot3', materiId: 'tkp', tentorId: 'albert', status: 'batal', batalOleh: 'tentor', alasanBatal: 'Tentor berhalangan hadir', createdAt: Date.now() - 20000000 },
            // batal, DIBATALKAN OLEH USER (field batalOleh:'user'), tanggalnya
            // masih DI DEPAN (belum lewat) & slotnya belum ditimpa pengajuan baru
            // -> sekarang TETAP nongol di "Minggu Ini" (murni ikut tanggal, tidak
            // lagi otomatis lompat ke Riwayat cuma karena dibatalkan user).
            // pembatalanDihitung:true -> pembatalan normal, ikut motong kuota.
            { id: 'seed_batal_user', tanggal: _todayIso(3), slotId: 'slot6', materiId: 'twk', tentorId: 'angga', status: 'batal', batalOleh: 'user', alasanBatal: 'Berhalangan hadir', pembatalanDihitung: true, createdAt: Date.now() - 10000000 },
            // batal, DIBATALKAN OLEH USER hari ini, TAPI slotnya sudah "ditimpa"
            // pengajuan baru (seed_batal_ditimpa_baru di jam & tanggal yang
            // sama persis) -> ini langsung dianggap Riwayat SAAT INI JUGA walau
            // tanggalnya belum lewat, karena user sudah mengajukan ulang di jam
            // itu. Pasangan seed di bawah adalah pengajuan barunya (status acc,
            // tanggal & slotId sama).
            { id: 'seed_batal_ditimpa', tanggal: _todayIso(0), slotId: 'slot4', materiId: 'tiu', tentorId: 'pram', status: 'batal', batalOleh: 'user', alasanBatal: 'Salah pilih jam, ajukan ulang', pembatalanDihitung: false, createdAt: Date.now() - 9000000 },
            { id: 'seed_batal_ditimpa_baru', tanggal: _todayIso(0), slotId: 'slot4', materiId: 'tiu', tentorId: 'pram', status: 'acc', createdAt: Date.now() - 8000000 },
            // acc, BEKAS RESEJUEL YANG DISETUJUI (freeCancelEligible:true) ->
            // contoh siap-pakai buat tes pembatalan GRATIS: tekan "Batal" pada
            // kartu ini harus langsung masuk halaman Ajukan Pembatalan dengan
            // catatan biru "tidak akan mengurangi kuota", TANPA kena cek kuota
            // habis sama sekali walau kuota di atas sudah kepakai 2/3. Lihat
            // JadwalPage.batalEntry & openBatalPengajuan.
            { id: 'seed_acc_bekas_resejuel', tanggal: _todayIso(5), slotId: 'slot2', materiId: 'tkp', tentorId: 'raffi', status: 'acc', freeCancelEligible: true, createdAt: Date.now() - 5000000 },
            // pengajuan_batal_tentor -> tombol "Cek" (buka halaman fullscreen
            // resume + alasan tentor, lihat JadwalPage.bukaBatalTentor), lalu
            // Setuju/Tolak. Contoh 1: TOLAK di kartu ini akan menemukan tentor
            // pengganti yang cocok (ANGGA: materi ALL & punya slot6), jadi
            // otomatis diajukan ulang ke ANGGA, bukan menunggu tanpa tentor.
            { id: 'seed_batal_tentor1', tanggal: _todayIso(1), slotId: 'slot6', materiId: 'tkp', tentorId: 'raffi', status: 'pengajuan_batal_tentor', alasanBatalTentor: 'Tentor ada acara keluarga mendadak', createdAt: Date.now() - 4000000 },
            // Contoh 2: TOLAK di kartu ini TIDAK akan menemukan tentor pengganti
            // (kombinasi materi TWK & slot3 tidak dicover tentor mana pun selain
            // ANGGA sendiri) -> jadi tetap "menunggu" tanpa tentor (tentorId
            // null) sampai ada tentor yang cocok nanti.
            { id: 'seed_batal_tentor2', tanggal: _todayIso(6), slotId: 'slot3', materiId: 'twk', tentorId: 'angga', status: 'pengajuan_batal_tentor', alasanBatalTentor: 'Tentor sedang sakit', createdAt: Date.now() - 3000000 },
            // butuh_persetujuan -> jadwal LAMA (acc) yang masih berlaku, tapi
            // user sempat mulai ajukan jadwal ulang lalu KELUAR sebelum
            // selesai (lihat JadwalPage.confirmKeluarAjukan). Tombol "Cek"
            // balikin ke form Jadwal Ulang yang sama buat nerusin
            // (JadwalPage.cekButuhPersetujuan), "Batal" buka pilihan
            // batalkan-jadwal-ulang-saja atau batalkan-jadwalnya-sekalian
            // (JadwalPage.openBatalPilihan).
            { id: 'seed_butuh_persetujuan', tanggal: _todayIso(2), slotId: 'slot5', materiId: 'tiu', tentorId: 'pram', status: 'butuh_persetujuan', createdAt: Date.now() - 2000000 },
        ];
        localStorage.setItem(KEY, JSON.stringify(arr));
        return arr;
    }
    function _load() {
        if (_cache) return _cache;
        try { _cache = JSON.parse(localStorage.getItem(KEY)); } catch (e) { _cache = null; }
        if (!Array.isArray(_cache)) _cache = _seed();
        return _cache;
    }
    function _save() { try { localStorage.setItem(KEY, JSON.stringify(_cache)); } catch (e) {} }

    return {
        all() { return _load().slice(); },
        byDate(tanggal) { return _load().filter(j => j.tanggal === tanggal); },
        get(id) { return _load().find(j => j.id === id) || null; },
        add(entry) {
            const arr = _load();
            const item = Object.assign({ id: 'jdw_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), status: 'pending', createdAt: Date.now() }, entry);
            arr.push(item);
            _save();
            return item;
        },
        update(id, patch) {
            const arr = _load();
            const idx = arr.findIndex(j => j.id === id);
            if (idx < 0) return null;
            arr[idx] = Object.assign({}, arr[idx], patch);
            _save();
            return arr[idx];
        },
        remove(id) {
            const arr = _load();
            const idx = arr.findIndex(j => j.id === id);
            if (idx < 0) return;
            arr.splice(idx, 1);
            _save();
        },
    };
})();

/* ══════════════════════════════════════════
   HELPERS TANGGAL
   ══════════════════════════════════════════ */
function _jdwToIso(d) {
    const x = new Date(d);
    x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
    return x.toISOString().slice(0, 10);
}
// Kumpulin SEMUA tanggal unik yang punya minimal 1 entri di JadwalStore
// (bukan cuma 7 hari minggu berjalan) -> dipakai #jdw-status-list view
// "minggu" biar seluruh data (termasuk seed dummy semua status) langsung
// kelihatan tanpa perlu geser minggu. Diurutkan lama -> baru (ASC), sama
// seperti urutan _jdwWeekDates biasa.
function _jdwAllEntryDates() {
    const isoSet = new Set(JadwalStore.all().map(e => e.tanggal));
    return Array.from(isoSet).sort().map(iso => new Date(iso + 'T00:00:00'));
}
function _jdwWeekDates(ref) {
    const d = new Date(ref || new Date());
    const day = d.getDay(); // 0=Min ... 6=Sab
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const days = [];
    for (let i = 0; i < 7; i++) { const dd = new Date(monday); dd.setDate(monday.getDate() + i); days.push(dd); }
    return days;
}
function _jdwFmtDateLong(iso) {
    const d = new Date(iso + 'T00:00:00');
    return `${JDW_DAY_NAMES[d.getDay()]}, ${d.getDate()} ${JDW_MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}
function _jdwFmtWeekRange(weekDates) {
    const first = weekDates[0], last = weekDates[6];
    const sameMonth = first.getMonth() === last.getMonth();
    return sameMonth
        ? `${first.getDate()} - ${last.getDate()} ${JDW_MONTH_SHORT[first.getMonth()]} ${first.getFullYear()}`
        : `${first.getDate()} ${JDW_MONTH_SHORT[first.getMonth()]} - ${last.getDate()} ${JDW_MONTH_SHORT[last.getMonth()]} ${last.getFullYear()}`;
}
// Grid tanggal tampilan SEBULAN — selalu 42 sel (6 baris x 7 kolom, Senin
// paling kiri) biar tinggi kartunya konsisten tiap bulan (ada bulan yang
// kalau apa adanya cuma butuh 4-5 baris). Sel yang bukan bagian bulan `ref`
// (numpang dari bulan sebelum/sesudah, buat rapiin grid) ditandai lewat
// perbandingan getMonth() di _jdwMonthGridHtml, BUKAN di sini.
function _jdwMonthGridDates(ref) {
    const r = new Date(ref || new Date());
    const firstOfMonth = new Date(r.getFullYear(), r.getMonth(), 1);
    const day = firstOfMonth.getDay(); // 0=Min ... 6=Sab
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() + diffToMonday);
    const days = [];
    for (let i = 0; i < 42; i++) { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); days.push(d); }
    return days;
}
// Bulan depan sudah bisa diklik begitu MINGGU TERAKHIR bulan berjalan sudah
// "nyambung" ke tanggal 1 bulan depan — bukan lagi patokan tanggal tetap
// (H>=22), tapi dihitung dari kalender itu sendiri: begitu hari ini masuk ke
// minggu (Senin-Minggu) yang di dalamnya ada tanggal 1 bulan depan, bulan
// depan langsung kebuka. Misal tanggal 1 bulan depan jatuh di hari Kamis,
// mingguan itu mulai dari Senin sebelumnya (bisa jadi tanggal 28/29/30/31
// bulan berjalan, tergantung berapa hari mundur ke Senin) — begitu hari ini
// sudah masuk Senin itu (atau lewat), bulan depan kebuka. Ini otomatis
// menyesuaikan tiap bulan (jumlah hari beda-beda, hari pertama beda-beda),
// nggak lagi hardcode ke tanggal 22. Dipakai gantiin kalender ke-2 "Ajukan
// minggu depan" yang dulu cuma nongol tiap hari Minggu (sudah dihapus,
// lihat catatan lama di histori file ini).
function _jdwNextMonthUnlockDate(refMonth) {
    const nextMonthFirst = new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 1);
    const day = nextMonthFirst.getDay(); // 0=Min ... 6=Sab
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    const weekStart = new Date(nextMonthFirst);
    weekStart.setDate(nextMonthFirst.getDate() + diffToMonday);
    return weekStart;
}
// Dipakai buat nge-cek sel "numpang" bulan depan di grid bulan berjalan
// (lihat _jdwMonthGridHtml) — cuma berlaku kalau grid yang lagi ditampilkan
// (`ref`) memang bulan berjalan SEKARANG — kalau user udah maju ke bulan
// depan/lebih (lewat tombol navigasi), sel "numpang" di situ tetap terkunci
// seperti biasa (tidak ada gunanya buka H+2 bulan sekaligus).
function _jdwNextMonthUnlockedFor(ref) {
    const now = new Date();
    if (now.getFullYear() !== ref.getFullYear() || now.getMonth() !== ref.getMonth()) return false;
    return _jdwToIso(now) >= _jdwToIso(_jdwNextMonthUnlockDate(ref));
}
// Sama kayak _jdwNextMonthUnlockedFor di atas, tapi buat grid yang REF-nya
// sendiri sudah bulan depan (bukan lagi ngecek sel "numpang" di grid bulan
// berjalan) — dipakai pas user maju ke grid bulan depan lewat tombol nav
// (">" / calendarMonthNav('newer') & rescheduleNav('newer')). Tanpa fungsi
// ini, begitu grid-nya sudah pindah ke bulan depan, semua tanggalnya lolos
// dari pengecekan isPast (karena memang belum lewat) jadi bisa diklik bebas
// walau minggu terakhir bulan berjalan belum nyambung ke bulan depan —
// padahal seharusnya sama-sama terkunci kayak sel "numpang" di grid bulan
// berjalan. Bulan LEBIH dari 1 bulan ke depan (+2 dst) SELALU terkunci
// apapun tanggal sekarang — cuma bulan depan yang persis 1 bulan yang bisa
// kebuka, itu pun cuma mulai minggu terakhir bulan berjalan.
function _jdwIsFutureMonthLocked(ref) {
    const now = new Date();
    const monthsAhead = (ref.getFullYear() - now.getFullYear()) * 12 + (ref.getMonth() - now.getMonth());
    if (monthsAhead <= 0) return false; // bulan berjalan / sudah lewat, bukan urusan fungsi ini (dicek lewat isPast)
    if (monthsAhead === 1) return _jdwToIso(now) < _jdwToIso(_jdwNextMonthUnlockDate(now)); // bulan depan: terkunci SELAMA minggu terakhir bulan berjalan belum nyambung ke bulan depan
    return true; // +2 bulan atau lebih: selalu terkunci
}
// Render HTML grid kalender sebulan (header nama hari + 42 sel tanggal),
// dipakai bareng buat kalender utama (#jdw-month-grid) & kalender mini di
// form Jadwal Ulang (#jdw-reschedule-month-grid) — bedanya cuma lewat `opts`:
//   opts.selectedIso   : tanggal yang lagi kepilih (kasih class is-selected), boleh kosong
//   opts.hasEntriesFn(iso) : buat titik penanda "ada jadwal" di bawah angka
//   opts.onClickFn(iso)    : onclick buat tanggal bulan `ref` yang BELUM lewat
//   opts.pastClickFn(iso)  : onclick buat tanggal bulan `ref` yang SUDAH lewat
// Tanggal "numpang lewat" dari bulan SEBELUMNYA (.is-outside) & yang sudah
// lewat (.is-past) sengaja TIDAK dikasih atribut onclick sama sekali (kecuali
// pastClickFn disediakan) — sama-sama tidak bisa diklik selayaknya kalender
// biasa. Tanggal numpang dari bulan SESUDAHNYA beda cerita: begitu masuk
// hari ini masuk minggu terakhir bulan berjalan yang nyambung ke bulan
// depan (lihat _jdwNextMonthUnlockedFor), sel-sel itu
// otomatis kebuka (.is-outside-unlocked, tetap bisa diklik lewat onClickFn)
// biar user bisa langsung ajukan jadwal bulan depan dari grid yang sama.
function _jdwMonthGridHtml(ref, opts) {
    opts = opts || {};
    const todayIso = _jdwToIso(new Date());
    const days = _jdwMonthGridDates(ref);
    const lastOfMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    const nextMonthUnlocked = _jdwNextMonthUnlockedFor(ref);
    // Berlaku buat SEMUA tanggal bulan `ref` (bukan cuma sel "numpang") kalau
    // grid yang lagi ditampilkan sendiri sudah bulan depan/lebih & belum
    // kebuka (lihat catatan _jdwIsFutureMonthLocked) — user bisa nyampe grid
    // ini lewat tombol nav ">" walau minggu terakhir bulan berjalan belum
    // nyambung ke bulan depan.
    const monthLocked = _jdwIsFutureMonthLocked(ref);
    const weekdayRow = JDW_DAY_SHORT.slice(1).concat(JDW_DAY_SHORT[0]).map(n => `<span>${n}</span>`).join('');
    const cells = days.map(d => {
        const iso = _jdwToIso(d);
        const isOutside = d.getMonth() !== ref.getMonth();
        const isTrailingNextMonth = isOutside && d > lastOfMonth; // numpang dari bulan SESUDAHNYA (bukan sebelumnya)
        const isUnlockedNextMonth = isTrailingNextMonth && nextMonthUnlocked;
        const isToday = iso === todayIso;
        const isPast = iso < todayIso;
        const isSelected = !!opts.selectedIso && iso === opts.selectedIso;
        const hasEntries = (!isOutside || isUnlockedNextMonth) && opts.hasEntriesFn ? !!opts.hasEntriesFn(iso) : false;
        let cls = 'jdw-mcell';
        if (isToday) cls += ' is-today';
        if (isSelected) cls += ' is-selected';
        if (hasEntries) cls += ' has-entries';
        let onclick = '';
        if (isOutside) {
            if (isUnlockedNextMonth) {
                cls += ' is-outside-unlocked';
                onclick = opts.onClickFn ? opts.onClickFn(iso) : '';
            } else {
                cls += ' is-outside';
            }
        } else if (isPast) {
            cls += ' is-past';
            onclick = opts.pastClickFn ? opts.pastClickFn(iso) : '';
        } else if (monthLocked) {
            // Tampil SAMA kayak tanggal sudah lewat (redup, class is-past yang
            // dipakai) — cuma onclick-nya beda, nunjukin popup "belum bisa
            // dipilih" (bukan "sudah lewat"), lihat opts.futureLockedClickFn.
            cls += ' is-past';
            onclick = opts.futureLockedClickFn ? opts.futureLockedClickFn(iso) : '';
        } else {
            onclick = opts.onClickFn ? opts.onClickFn(iso) : '';
        }
        return `<div class="${cls}"${onclick ? ` onclick="${onclick}"` : ''}><span class="jdw-mcell-num">${d.getDate()}</span></div>`;
    }).join('');
    return `<div class="jdw-month-weekdays">${weekdayRow}</div><div class="jdw-month-cells">${cells}</div>`;
}
// Batas maksimal pengajuan Jadwal Ulang: H-1 (selama tanggal sesi masih
// SETELAH hari ini, boleh, terlepas jam berapa pun saat ini di H-1 —
// cutoff-nya persis di jam 00.00 begitu tanggal sesi == hari ini / sudah
// lewat, BUKAN dihitung mundur 24 jam dari jam sesi). Dipakai di
// JadwalPage.resejadwalEntry().
function _jdwCanReschedule(tanggalSesi) {
    return tanggalSesi > _jdwToIso(new Date());
}
// Label materi yang diajar seorang tentor, buat ditampilkan di box picker &
// list "Pilih Tentor" -> "TWK | TIU | TKP" atau "SEMUA" kalau materi:'ALL'.
function _jdwTentorMateriLabel(t) {
    if (!t) return '-';
    if (t.materi === 'ALL') return 'SEMUA';
    return t.materi.map(id => { const m = JDW_MATERI.find(x => x.id === id); return m ? m.label.toUpperCase() : id; }).join(' | ');
}
// Cek apakah tentor cocok sama kata kunci pencarian — nama ATAU materi yang
// diajar. Tentor yang materi:'ALL' (ngajar SEMUA, misal ANGGA) dianggap
// otomatis cocok buat pencarian materi apa pun (misal dicari "twk" -> ANGGA
// tetap ikut muncul walau sub-labelnya cuma nulis "SEMUA", karena dia emang
// ngajar semua materi termasuk TWK).
function _jdwTentorMatchesQuery(t, query) {
    if (!query) return true;
    if (t.name.toLowerCase().includes(query)) return true;
    if (t.materi === 'ALL') {
        // Tentor "SEMUA" otomatis cocok kalau kata kuncinya memang nyambung ke
        // pencarian materi (nama materi apa pun, atau kata "semua" itu sendiri)
        // -- bukan buat kata kunci ngasal yang nggak nyambung ke materi/nama.
        return 'semua'.includes(query) || JDW_MATERI.some(m => m.label.toLowerCase().includes(query));
    }
    return t.materi.some(id => {
        const m = JDW_MATERI.find(x => x.id === id);
        return m && m.label.toLowerCase().includes(query);
    });
}
// Cek apakah tentor tertentu ngajar materi tertentu -> dipakai buat nge-abu-
// abukan chip materi yang bukan diajar tentor yang lagi kepilih. Belum pilih
// tentor sama sekali (tentorId null) -> semua materi masih kelihatan aktif.
function _jdwTentorAllowsMateri(tentorId, materiId) {
    if (!tentorId) return true;
    const t = JDW_TENTOR.find(x => x.id === tentorId);
    if (!t) return true;
    if (t.materi === 'ALL') return true;
    return t.materi.includes(materiId);
}
// Sama seperti _jdwTentorAllowsMateri tapi buat jam (JDW_SLOTS) -> dipakai
// buat ngunci chip jam yang bukan available buat tentor yang lagi kepilih.
function _jdwTentorAllowsSlot(tentorId, slotId) {
    if (!tentorId) return true;
    const t = JDW_TENTOR.find(x => x.id === tentorId);
    if (!t) return true;
    if (t.slots === 'ALL') return true;
    return Array.isArray(t.slots) && t.slots.includes(slotId);
}
// Cek apakah tentor ini SAMA SEKALI tidak punya jam available (slots:[] kosong)
// -> dipakai buat nge-abu-abukan & nge-nonaktifin item-nya di list "Pilih Tentor".
function _jdwTentorHasNoSlots(t) {
    return Array.isArray(t.slots) && t.slots.length === 0;
}
// Urutan slot jam (index di JDW_SLOTS) dipakai buat ngurutin entri dalam 1 hari
// dari jam paling awal, TERLEPAS dari urutan kapan entrinya diajukan/diinput.
function _jdwSlotIndex(slotId) {
    const i = JDW_SLOTS.findIndex(s => s.id === slotId);
    return i < 0 ? 999 : i;
}
// Ambil Date() persis jam MULAI suatu slot di suatu tanggal, dari label
// "07.45 - 09.15" -> 07:45. Dipakai buat (1) ngunci slot yang jamnya udah
// lewat hari ini di form Ajukan, dan (2) auto-tolak pengajuan yang masih
// "menunggu" pas jam mulainya udah kelewatan.
function _jdwSlotStartDate(tanggal, slotId) {
    const slot = JDW_SLOTS.find(s => s.id === slotId);
    if (!slot || !tanggal) return null;
    const startStr = slot.label.split('-')[0].trim(); // "07.45"
    const [hh, mm] = startStr.split('.').map(Number);
    const d = new Date(tanggal + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    d.setHours(hh || 0, mm || 0, 0, 0);
    return d;
}
// Sama seperti _jdwSlotStartDate tapi ambil jam SELESAI slot, dari label
// "07.45 - 09.15" -> 09.15. Dipakai buat nentuin kapan sesi yang "berlangsung"
// sudah lewat jamnya (tombol "Masuk" -> "Feedback").
function _jdwSlotEndDate(tanggal, slotId) {
    const slot = JDW_SLOTS.find(s => s.id === slotId);
    if (!slot || !tanggal) return null;
    const parts = slot.label.split('-');
    const endStr = (parts[1] || '').trim(); // "09.15"
    const [hh, mm] = endStr.split('.').map(Number);
    const d = new Date(tanggal + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    d.setHours(hh || 0, mm || 0, 0, 0);
    return d;
}
// Halaman #page-jadwal di belakang ikut punya scrollbar sendiri (overflow-y:auto
// dari .page). Begitu salah satu overlay fullscreen jadwal (Ajukan/Jadwal
// Ulang/Edit, Pilih Tentor, Sesi/Masuk/Feedback/Ajukan Pembatalan) kebuka di
// atasnya, scrollbar halaman itu masih aktif walau ketutup rapat -> muncul 2
// scrollbar bertumpuk. Kunci overflow #page-jadwal selama salah satu dari
// overlay-overlay itu masih "open", baru dilepas begitu semuanya ketutup
// (bukan asal unlock di tiap close, soalnya Pilih Tentor bisa numpuk KE ATAS
// overlay Ajukan yang masih terbuka di belakangnya).
const JDW_FULLSCREEN_OVERLAY_IDS = ['jdw-ajukan-overlay', 'jdw-tentor-overlay', 'jdw-sesi-overlay', 'jdw-resejuel-overlay', 'jdw-batal-tentor-overlay'];
// jdw-batal-overlay & jdw-lewat-overlay ikut dikunci juga (backdrop-nya blur
// transparan, bukan solid, jadi tidak menghasilkan tampilan 2 scrollbar
// bertumpuk yang sama parahnya kayak overlay fullscreen di atas) TAPI
// #page-jadwal di baliknya tetap ikut dikunci scroll-nya biar konsisten -
// tidak masuk akal halaman di belakang masih bisa discroll pas ada dialog
// konfirmasi kecil nongol di tengah layar.
const JDW_SCROLL_LOCK_OVERLAY_IDS = [...JDW_FULLSCREEN_OVERLAY_IDS, 'jdw-batal-overlay', 'jdw-tarikbatal-overlay', 'jdw-lewat-overlay', 'jdw-tolak-ajukan-overlay', 'jdw-keluar-ajukan-overlay', 'jdw-batal-pilihan-overlay', 'jdw-reschedule-harih-overlay', 'jdw-batal-kuota-habis-overlay', 'jdw-tentor-ganti-confirm-overlay', 'jdw-tentor-ganti-terpakai-overlay', 'jdw-batal-tentor-setuju-overlay'];
// Ada popup/overlay APAPUN di halaman Jadwal yang lagi kebuka (dialog kecil
// maupun fullscreen, semuanya sudah kedaftar di JDW_SCROLL_LOCK_OVERLAY_IDS
// di atas) -> dipakai buat nahan render kalender/list minggu di BELAKANG
// popup selama popup itu masih kebuka, lihat _jdwPendingBgRender di bawah.
function _jdwAnyOverlayOpen() {
    return JDW_SCROLL_LOCK_OVERLAY_IDS.some(id => document.getElementById(id)?.classList.contains('open'));
}
// Kalau ada perubahan status (auto-expire/auto-advance) kejadian SELAGI ada
// popup kebuka, render-nya jangan langsung dieksekusi (supaya tampilan di
// belakang popup diem, tidak ikut "kelap-kelip"/loncat begitu popup masih
// dibaca user) -> ditahan dulu lewat flag ini, baru benar-benar dirender
// begitu popup terakhir ketutup (lihat pengecekannya di
// _jdwSyncPageScrollLock, yang memang sudah kepanggil di SETIAP buka/tutup
// overlay jadwal).
let _jdwPendingBgRender = false;
function _jdwSyncPageScrollLock() {
    const pageEl = document.getElementById('page-jadwal');
    const anyLockOpen = JDW_SCROLL_LOCK_OVERLAY_IDS.some(id => document.getElementById(id)?.classList.contains('open'));
    if (pageEl) pageEl.style.overflow = anyLockOpen ? 'hidden' : '';
    // Dock cuma dinaikkan di atas overlay yang BENERAN fullscreen (halaman
    // penuh) — dialog konfirmasi kecil (batal/lewat) sengaja TIDAK ikutan,
    // dock redup di baliknya itu wajar sama kayak dialog konfirmasi lain di
    // seluruh app, bukan bug yang perlu ditambal.
    const anyFullscreenOpen = JDW_FULLSCREEN_OVERLAY_IDS.some(id => document.getElementById(id)?.classList.contains('open'));
    document.body.classList.toggle('jdw-fullscreen-open', anyFullscreenOpen);
    // Popup terakhir baru saja ketutup (tidak ada lagi yang "open") DAN ada
    // render yang sempat ditahan selama popup itu kebuka -> baru sekarang
    // kalender/list minggu di belakang boleh di-refresh.
    if (!anyLockOpen && _jdwPendingBgRender) {
        _jdwPendingBgRender = false;
        _jdwRenderWeek();
        _jdwRenderStatusList();
    }
}
function _jdwSlotIsOver(e) {
    const end = _jdwSlotEndDate(e.tanggal, e.slotId);
    return !!(end && end <= new Date());
}
// Status yang dipakai buat BADGE (bukan status data sebenarnya di
// JadwalStore). Entri "berlangsung" yang jam sesinya sudah lewat -> sama
// kayak tombol aksinya yang udah ganti jadi "Feedback" (bukan "Masuk"
// lagi, lihat JadwalPage._entryActions), badge status ikut disesuaikan
// jadi "Feedback" biar tidak menyesatkan (masih kebaca "Berlangsung"
// padahal harusnya udah isi feedback). Status data ASLI-nya (e.status)
// tetap "berlangsung" sampai feedback beneran diisi / harinya lewat
// (lihat _jdwAutoAdvanceStatus) — cuma tampilannya saja yang beda.
function _jdwBadgeStatus(e) {
    return (e.status === 'berlangsung' && _jdwSlotIsOver(e)) ? 'feedback' : e.status;
}
// Ada berapa hari di minggu berjalan (Senin-Minggu) yang tanggalnya sudah
// lewat dari hari ini -> dipakai buat nentuin apakah "riwayat minggu ini
// (belum genap)" perlu ditampilkan/dinavigasi (kalender ke-2 + offset 0).
function _jdwHasPastDaysThisWeek() {
    const todayIso = _jdwToIso(new Date());
    return _jdwWeekDates(new Date()).some(d => _jdwToIso(d) < todayIso);
}
// Batas paling "baru" (paling dekat ke sekarang) yang boleh dinavigasi di
// Riwayat: 0 (minggu berjalan, bagian yg sudah lewat) kalau memang ada
// harinya yang sudah lewat, atau 1 (minggu lalu yang sudah genap) kalau
// belum ada (mis. hari ini masih Senin).
function _jdwMinRiwayatOffset() {
    return _jdwHasPastDaysThisWeek() ? 0 : 1;
}
// Batas paling "lama" (paling jauh ke belakang) yang boleh dinavigasi di
// Riwayat: minggu yang berisi entri PALING LAMA di JadwalStore (mis. entri
// pertama kali akun ini mengajukan jadwal). Tidak boleh navigasi lebih jauh
// dari itu — kalau belum ada entri sama sekali, batasnya sama dengan
// _jdwMinRiwayatOffset() (tidak bisa mundur sama sekali).
function _jdwMaxRiwayatOffset() {
    const minOffset = _jdwMinRiwayatOffset();
    const all = JadwalStore.all();
    if (!all.length) return minOffset;
    const earliestIso = all.map(e => e.tanggal).sort()[0];
    const earliestMonday = _jdwWeekDates(new Date(earliestIso + 'T00:00:00'))[0];
    const thisMonday = _jdwWeekDates(new Date())[0];
    const diffWeeks = Math.round((thisMonday - earliestMonday) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(minOffset, diffWeeks);
}

/* ══════════════════════════════════════════
   AUTO-TOLAK PENGAJUAN YANG KELEWATAN JAM
   Pengajuan berstatus "menunggu" yang jam-mulai slotnya sudah lewat dari
   sekarang (baik karena harinya sudah lewat, ATAUPUN masih hari yang sama
   tapi jamnya sudah kelewatan) otomatis diubah jadi "ditolak" — karena
   sudah tidak mungkin lagi dijalani. Entri yang sudah "acc"/"ditolak" tidak
   disentuh.
   ══════════════════════════════════════════ */
function _jdwAutoExpirePending() {
    const now = new Date();
    let changed = false;
    JadwalStore.all().forEach(e => {
        if (e.status !== 'pending') return;
        const start = _jdwSlotStartDate(e.tanggal, e.slotId);
        if (start && start <= now) {
            JadwalStore.update(e.id, { status: 'ditolak' });
            changed = true;
        }
    });
    return changed;
}

/* ══════════════════════════════════════════
   AUTO-MAJU STATUS SESI YANG SUDAH "DISETUJUI"
   disetujui -> berlangsung : begitu jam mulai slotnya tiba (hari ini).
   berlangsung -> selesai   : begitu feedback sudah diisi, ATAU tanggalnya
                               sudah lewat hari (sesi dianggap tuntas / hangus,
                               apapun keadaannya, sesuai kartu tidak boleh lagi
                               tampil tombol apapun begitu hari sudah lewat).
   disetujui -> selesai     : kalau entrinya baru sempat kelihatan setelah
                               tanggalnya sendiri sudah lewat (mis. app tidak
                               dibuka sepanjang hari itu) -> langsung selesai,
                               tidak usah lewat fase berlangsung dulu.
   ══════════════════════════════════════════ */
function _jdwAutoAdvanceStatus() {
    const now = new Date();
    const todayIso = _jdwToIso(now);
    let changed = false;
    JadwalStore.all().forEach(e => {
        if (e.status === 'acc') {
            if (e.tanggal < todayIso) {
                JadwalStore.update(e.id, { status: 'selesai' });
                changed = true;
                return;
            }
            const start = _jdwSlotStartDate(e.tanggal, e.slotId);
            if (start && start <= now) {
                JadwalStore.update(e.id, { status: 'berlangsung' });
                changed = true;
            }
        } else if (e.status === 'berlangsung') {
            if (e.tanggal < todayIso || e.feedbackDone) {
                JadwalStore.update(e.id, { status: 'selesai' });
                changed = true;
            }
        } else if (e.status === 'pengajuan_pembatalan') {
            // Kalau tanggalnya sudah lewat sebelum sempat diputuskan (acc/tolak
            // pembatalan), anggap sesi tuntas begitu saja seperti entri "acc" lain.
            if (e.tanggal < todayIso) {
                JadwalStore.update(e.id, { status: 'selesai' });
                changed = true;
            }
        } else if (e.status === 'butuh_persetujuan') {
            // Sama seperti "pengajuan_pembatalan": tanggal/slotId entri ini
            // masih tanggal jadwal LAMA (belum ketimpa, karena pengajuan
            // jadwal-ulangnya sendiri belum sempat disubmit — lihat
            // JadwalPage.confirmKeluarAjukan). Kalau jadwal lama itu keburu
            // lewat hari sebelum user sempat balik nerusin/membatalkan
            // pengajuannya, jangan sampai macet nyangkut "Butuh Persetujuan"
            // selamanya — anggap tuntas begitu saja seperti entri "acc" lain.
            if (e.tanggal < todayIso) {
                JadwalStore.update(e.id, { status: 'selesai' });
                changed = true;
            }
        }
    });
    return changed;
}

/* ══════════════════════════════════════════
   DUMMY: LINK GMEET & TOKEN SESI
   Belum ada backend, jadi link/token dibangkitkan deterministik dari id
   entri (bukan disimpan) — konsisten tiap dibuka tapi tetap gampang nanti
   diganti jadi field asli dari server (mis. e.gmeetLink / e.token).
   ══════════════════════════════════════════ */
function _jdwPseudoCode(seedStr, pattern) {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return pattern.replace(/x/g, () => {
        hash = (Math.imul(hash, 1103515245) + 12345) >>> 0;
        return chars[hash % chars.length];
    });
}
function _jdwEntryGmeetLink(e) {
    if (e.gmeetLink) return e.gmeetLink;
    return `https://meet.google.com/${_jdwPseudoCode(e.id + '-meet', 'xxx-xxxx-xxx').toLowerCase()}`;
}
function _jdwEntryToken(e) {
    if (e.token) return e.token;
    return _jdwPseudoCode(e.id + '-token', 'xxxxxx');
}
function _jdwCopyIconHtml() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
}

/* ══════════════════════════════════════════
   STATE PERSISTENCE — supaya posisi (overlay tanggal / form ajukan +
   jam & materi yang lagi dipilih) TIDAK hilang & TIDAK balik ke kalender
   kalau halaman di-refresh / Ctrl+Shift+R. Disimpan tiap ada perubahan,
   dipulihkan otomatis tiap kali loadJadwal() jalan (dipanggil dari
   shell index_user.html saat tab Jadwal dibuka, termasuk sesaat setelah
   reload penuh lewat cbn_user_lastpage).
   ══════════════════════════════════════════ */
const JDW_STATE_KEY = 'cbn_user_jadwal_state';
function _jdwSaveState() {
    try {
        const ajukanOv = document.getElementById('jdw-ajukan-overlay');
        if (!ajukanOv || !ajukanOv.classList.contains('open')) { localStorage.removeItem(JDW_STATE_KEY); return; }
        localStorage.setItem(JDW_STATE_KEY, JSON.stringify({
            selectedDate: JadwalPage.selectedDate,
            editingId: JadwalPage.editingId,
            pickedSlot: JadwalPage.pickedSlot,
            pickedMateri: JadwalPage.pickedMateri,
            pickedTentor: JadwalPage.pickedTentor,
            rescheduleDate: JadwalPage.rescheduleDate,
        }));
    } catch (e) {}
}
function _jdwRestoreState() {
    let raw;
    try { raw = localStorage.getItem(JDW_STATE_KEY); } catch (e) { return; }
    if (!raw) return;
    let st;
    try { st = JSON.parse(raw); } catch (e) { return; }
    if (!st || !st.selectedDate) return;
    JadwalPage.selectedDate = st.selectedDate;
    JadwalPage.openAjukanOverlay(st.editingId || null);
    // Timpa pilihan default hasil lookup entri (di atas) dengan yang persis
    // lagi dipilih user sebelum refresh — termasuk pengajuan baru yang belum
    // official (belum ada editingId) tapi jam/materi/tentor-nya sudah sempat
    // dipilih. Urutan penting: TENTOR dipulihkan duluan sebelum SLOT/MATERI,
    // karena pickTentor() otomatis nge-reset slot/materi yang ternyata bukan
    // diajar/available buat tentor itu — kalau dipulihkan belakangan, pilihan
    // slot/materi yang sudah benar bisa ketiban reset percuma.
    if (JadwalPage._isReschedule && st.rescheduleDate) JadwalPage.pickRescheduleDate(st.rescheduleDate);
    // Restore tentor pakai _applyPickTentor LANGSUNG (bukan pickTentor()) —
    // ini cuma memulihkan pilihan yang SUDAH sempat dipilih sebelum refresh,
    // BUKAN usaha ganti tentor baru, jadi tidak boleh memicu popup konfirmasi
    // "Ganti Tentor?" lagi. Kalau tentor yang dipulihkan ini ternyata beda
    // dari tentor asli (berarti sebelum refresh user memang SUDAH konfirmasi
    // ganti), _rescheduleTentorAlreadyChanged ikut disetel true supaya
    // batasan 1x-ganti-tentor tetap konsisten kalau dia coba ganti lagi.
    if (st.pickedTentor) {
        if (JadwalPage._isReschedule && st.pickedTentor !== JadwalPage._rescheduleOriginalTentor) {
            JadwalPage._rescheduleTentorAlreadyChanged = true;
        }
        JadwalPage._applyPickTentor(st.pickedTentor);
    }
    if (st.pickedSlot) JadwalPage.pickSlot(st.pickedSlot);
    if (st.pickedMateri) JadwalPage.pickMateri(st.pickedMateri);
}

/* ══════════════════════════════════════════
   PAGE UTAMA — KALENDER 1 MINGGU (ala kalender iPhone)
   ══════════════════════════════════════════ */
let _jdwAutoExpireTimer = null;
function loadJadwal() {
    _jdwAutoExpirePending();
    _jdwAutoAdvanceStatus();
    _jdwRenderWeek();
    _jdwRestoreViewState();
    _jdwRenderStatusList();
    _jdwRestoreState();

    // Cek berkala selama tab Jadwal kebuka, supaya pengajuan yang jam-mulai/
    // jam-selesai slotnya baru lewat SAAT halaman ini sedang dibuka (bukan
    // cuma pas reload/buka ulang) tetap otomatis pindah status (ditolak /
    // berlangsung / selesai) tanpa perlu refresh manual. Ikut dicek juga
    // buat kalender bulan (kalau lagi kebuka) supaya begitu lewat tengah
    // malam tanggal "bulan depan yang sudah kebuka" (lihat _jdwNextMonthUnlockedFor)
    // otomatis nge-refresh sendiri tanpa perlu reload manual.
    if (_jdwAutoExpireTimer) clearInterval(_jdwAutoExpireTimer);
    _jdwAutoExpireTimer = setInterval(() => {
        const expired = _jdwAutoExpirePending();
        const advanced = _jdwAutoAdvanceStatus();
        if (expired || advanced) {
            // Kalau lagi ada popup/overlay kebuka (mis. user lagi ngisi form
            // Ajukan Jadwal / Feedback), JANGAN langsung render kalender/list
            // di belakangnya sekarang — bisa bikin tampilan di baliknya
            // berubah/loncat pas lagi dibaca user. Tahan dulu, baru dirender
            // begitu popup-nya ketutup (lihat _jdwSyncPageScrollLock).
            if (_jdwAnyOverlayOpen()) {
                _jdwPendingBgRender = true;
            } else {
                _jdwRenderWeek();
                _jdwRenderStatusList();
            }
        }
    }, 30000);
}

/* ══════════════════════════════════════════
   LIST PENGAJUAN MENUNGGU/DISETUJUI — DI BAWAH KALENDER
   Dipisah per hari (ala "Token Terpakai" di admin: tabel di desktop,
   kartu .swipe-card-body di mobile), diurutkan dari jam paling awal dalam
   1 hari (bukan urutan input), dan bar tanggal tetap tampil walau kosong.
   Toggle "Minggu Ini" (minggu berjalan) / "Riwayat" (minggu-minggu
   sebelumnya, bisa dinavigasi mundur/maju per minggu).
   ══════════════════════════════════════════ */
const JDW_VIEW_STATE_KEY = 'cbn_user_jadwal_view_state';
function _jdwSaveViewState() {
    try {
        localStorage.setItem(JDW_VIEW_STATE_KEY, JSON.stringify({
            view: JadwalPage.currentView,
            riwayatWeekOffset: JadwalPage.riwayatWeekOffset,
        }));
    } catch (e) {}
}
function _jdwRestoreViewState() {
    let raw;
    try { raw = localStorage.getItem(JDW_VIEW_STATE_KEY); } catch (e) { return; }
    if (!raw) return;
    let st;
    try { st = JSON.parse(raw); } catch (e) { return; }
    if (!st) return;
    JadwalPage.currentView = st.view === 'riwayat' ? 'riwayat' : 'minggu';
    JadwalPage.riwayatWeekOffset = (typeof st.riwayatWeekOffset === 'number' && st.riwayatWeekOffset >= 0) ? st.riwayatWeekOffset : 1;
    document.querySelectorAll('#jdw-view-toggle .jdw-view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === JadwalPage.currentView));
    const nav = document.getElementById('jdw-riwayat-nav');
    if (nav) nav.style.display = JadwalPage.currentView === 'riwayat' ? 'flex' : 'none';
}

// Konten "detail tanggal" (tabel desktop + kartu .swipe-card-body dengan
// aksi Edit/Jadwal Ulang/Batal) — dulu cuma kelihatan kalau tanggal di
// kalender di-tap (overlay id="jdw-day-content"). Sekarang tampil langsung
// di depan, jadi tap Edit/Jadwal Ulang di sini langsung ke halaman Ajukan
// Jadwal yang sudah disiapkan (lihat JadwalPage.editEntry/resejadwalEntry).
function _jdwDayGroupHtml(d, entries, isToday) {
    const iso = _jdwToIso(d);
    const label = _jdwFmtDateLong(iso);
    const head = `<div class="jdw-status-day-head">
        <div class="jdw-status-day-label">${label}${isToday ? '<span class="jdw-status-day-today">Hari ini</span>' : ''}</div>
        <div class="jdw-status-day-count">${entries.length ? entries.length + ' pengajuan' : ''}</div>
    </div>`;
    if (!entries.length) {
        return `<div class="jdw-status-day">${head}<div class="jdw-status-day-empty">Belum ada pengajuan</div></div>`;
    }
    const rows = entries.map(e => {
        const slot = JDW_SLOTS.find(s => s.id === e.slotId);
        const materi = JDW_MATERI.find(m => m.id === e.materiId);
        const tentor = JDW_TENTOR.find(t => t.id === e.tentorId);
        const { left, right } = JadwalPage._entryActions(e);
        const btnCls = (a) => a.cls === 'act-danger' ? 'jdw-btn-danger' : (a.cls === 'act-primary' ? 'jdw-btn-primary' : 'jdw-btn-secondary');
        const btns = [...right, ...left].map(a => `<button class="jdw-btn ${btnCls(a)} jdw-btn-sm" onclick="${a.onClick}">${a.label}</button>`).join('');
        return `<tr>
            <td>${slot ? slot.label : '-'}</td>
            <td>${tentor ? tentor.name : '-'}</td>
            <td>${materi ? materi.label : '-'}</td>
            <td><span class="jdw-status-badge ${_jdwBadgeStatus(e)}">${JDW_STATUS_LABEL[_jdwBadgeStatus(e)] || e.status}</span></td>
            <td><div style="display:flex;gap:6px;flex-wrap:wrap">${btns}</div></td>
        </tr>`;
    }).join('');
    const cards = entries.map(e => JadwalPage._entryCardHtml(e)).join('');
    return `<div class="jdw-status-day">${head}
        <div class="aksi-swipe-wrap"><div class="glass" style="padding:0;overflow:hidden"><table class="jdw-entry-table"><thead><tr><th>Jam</th><th>Tentor</th><th>Materi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table></div></div>
        <div class="swipe-list">${cards}</div>
    </div>`;
}

// Entri utk 1 tanggal di list per-hari — SENGAJA dipisah dari filter status
// inline lama. Aturan Minggu Ini vs Riwayat MURNI berdasar TANGGAL (bukan
// siapa yang membatalkan lagi):
//   - Status yang masih AKTIF/belum final (pending/acc/berlangsung/
//     pengajuan_pembatalan/resejuel/butuh_persetujuan) -> selalu di "Minggu
//     Ini", tidak pernah di "Riwayat" (kalau tanggalnya sudah lewat tapi
//     statusnya masih salah satu ini, harusnya sudah dikonversi otomatis
//     oleh _jdwAutoAdvanceStatus — lihat fungsi itu).
//   - Status FINAL ("selesai" & "batal", baik dibatalkan user maupun
//     tentor) -> ikut tanggal: masih di "Minggu Ini" selama tanggalnya
//     belum lewat, pindah ke "Riwayat" begitu tanggalnya sudah lewat hari
//     ini. Khusus "batal": kalau di tanggal & jam (slotId) yang sama sudah
//     ada pengajuan AKTIF baru (misal user batal lalu ajukan ulang di jam
//     yang sama persis), entri batal yang lama itu langsung dianggap
//     riwayat SAAT ITU JUGA, walau tanggalnya sendiri belum lewat — karena
//     sudah "ketimpa" pengajuan baru.
// Status "resejuel" (jadwal ulang dari tentor) tetap tampil normal di sini
// (kartunya nongol di tanggal jadwal LAMA-nya, field tanggal/slotId/
// materiId milik entri ini sendiri, BUKAN tanggal jadwal baru usulan tentor
// yang tersimpan di field `reschedule`), cuma aksinya beda: tombol "Cek"
// yang buka halaman bandingkan jadwal lama vs baru, lihat
// JadwalPage.bukaResejuel().
function _jdwStatusListEntriesForDate(iso) {
    const isRiwayat = JadwalPage.currentView === 'riwayat';
    const todayIso = _jdwToIso(new Date());
    const dateEntries = JadwalStore.byDate(iso);
    return dateEntries
        .filter(e => {
            if (e.status === 'pending' || e.status === 'acc' || e.status === 'berlangsung' || e.status === 'pengajuan_pembatalan' || e.status === 'resejuel' || e.status === 'butuh_persetujuan' || e.status === 'pengajuan_batal_tentor') {
                return !isRiwayat;
            }
            if (e.status === 'selesai' || e.status === 'batal') {
                let sudahLewat = iso < todayIso;
                if (e.status === 'batal' && !sudahLewat) {
                    // Ditimpa pengajuan aktif baru di jam yang sama -> langsung riwayat.
                    sudahLewat = dateEntries.some(o => o.id !== e.id && o.slotId === e.slotId && o.status !== 'batal' && o.status !== 'ditolak');
                }
                return isRiwayat ? sudahLewat : !sudahLewat;
            }
            return false;
        })
        .sort((a, b) => _jdwSlotIndex(a.slotId) - _jdwSlotIndex(b.slotId));
}

// Ambil 7 tanggal minggu yang lagi ditampilkan di Riwayat (sesuai
// JadwalPage.riwayatWeekOffset saat ini, sudah di-clamp ke batas
// min/max) -> dipakai bareng oleh _jdwRenderStatusList (daftar) DAN
// _jdwRenderWeek (kalender strip di atas, biar keduanya selalu nunjukin
// minggu yang SAMA persis waktu currentView === 'riwayat').
function _jdwRiwayatWeekDates() {
    const minOffset = _jdwMinRiwayatOffset();
    const maxOffset = _jdwMaxRiwayatOffset();
    if (JadwalPage.riwayatWeekOffset < minOffset) JadwalPage.riwayatWeekOffset = minOffset;
    if (JadwalPage.riwayatWeekOffset > maxOffset) JadwalPage.riwayatWeekOffset = maxOffset;
    if (JadwalPage.riwayatWeekOffset === 0) return _jdwWeekDates(new Date());
    const ref = new Date();
    ref.setDate(ref.getDate() - (JadwalPage.riwayatWeekOffset * 7));
    return _jdwWeekDates(ref);
}

function _jdwRenderStatusList() {
    _jdwRenderKuota();
    const wrap = document.getElementById('jdw-status-list');
    if (!wrap) return;
    const todayIso = _jdwToIso(new Date());
    let weekDates;
    if (JadwalPage.currentView === 'riwayat') {
        const minOffset = _jdwMinRiwayatOffset();
        const maxOffset = _jdwMaxRiwayatOffset();
        weekDates = _jdwRiwayatWeekDates();
        const cap = document.getElementById('jdw-riwayat-caption');
        if (cap) cap.textContent = JadwalPage.riwayatWeekOffset === 0 ? `${_jdwFmtWeekRange(weekDates)} · berjalan` : _jdwFmtWeekRange(weekDates);
        const nextBtn = document.getElementById('jdw-riwayat-next-btn');
        if (nextBtn) nextBtn.disabled = JadwalPage.riwayatWeekOffset <= minOffset;
        const prevBtn = document.getElementById('jdw-riwayat-prev-btn');
        if (prevBtn) prevBtn.disabled = JadwalPage.riwayatWeekOffset >= maxOffset;
        // Kalau lagi difilter ke 1 tanggal spesifik (tap tanggal di kalender
        // atas, lihat JadwalPage.filterRiwayatDate) -> list di bawah cuma
        // nampilin tanggal itu SAJA, bukan seluruh minggu. Kalau tanggal
        // yang difilter ternyata sudah di luar minggu yang lagi ditampilkan
        // (misal habis pindah minggu pakai tombol older/newer), filter-nya
        // otomatis diabaikan di sini (tetap tampil 1 minggu penuh) —
        // resetnya sendiri sudah ditangani riwayatNav().
        if (JadwalPage.riwayatDateFilter && weekDates.some(d => _jdwToIso(d) === JadwalPage.riwayatDateFilter)) {
            weekDates = weekDates.filter(d => _jdwToIso(d) === JadwalPage.riwayatDateFilter);
        }
    } else {
        // Dulu cuma nampilin 7 hari minggu berjalan (_jdwWeekDates), jadi
        // entri di luar rentang itu (misal seed dummy yang tanggalnya
        // beberapa hari ke depan/lampau) tidak kelihatan sama sekali di
        // #jdw-status-list. Sekarang tampilkan SEMUA tanggal yang punya
        // entri apa pun di JadwalStore, diurutkan tanggal terlama -> baru,
        // biar seluruh list (semua status) selalu kelihatan tanpa perlu
        // navigasi minggu. Filter status aktif/riwayat per-entri tetap
        // ditangani _jdwStatusListEntriesForDate seperti biasa.
        weekDates = _jdwAllEntryDates();
    }
    wrap.innerHTML = weekDates.map(d => {
        const iso = _jdwToIso(d);
        const entries = _jdwStatusListEntriesForDate(iso);
        // Tanggal yang sama sekali tidak punya jadwal/pengajuan/status TIDAK
        // perlu ditampilkan di list ini (dulu masih nongol dengan placeholder
        // "Belum ada pengajuan") — langsung skip di sini sebelum cek lainnya.
        if (!entries.length) return '';
        // Catatan: filter mana yang boleh nongol di "Minggu Ini" vs "Riwayat"
        // (termasuk tanggal yang sudah lewat, dan entri "batal" yang ketimpa
        // pengajuan baru di jam yang sama) sudah sepenuhnya ditangani per-entri
        // di dalam _jdwStatusListEntriesForDate. Kalau `entries` di tanggal ini
        // sudah kosong untuk view sekarang, langsung ke-skip lewat pengecekan
        // `!entries.length` di atas — tidak perlu pengecekan tanggal lagi di sini.
        return _jdwDayGroupHtml(d, entries, iso === todayIso);
    }).filter(Boolean).join('');
    // Kartu swipe-list yang punya aksi (Edit/Jadwal Ulang/Batal) perlu di-bind gesture-nya.
    wrap.querySelectorAll('.swipe-list').forEach(el => { if (window.SwipeCards) SwipeCards.bindSwipeList(el); });
}

// Kalender utama ("Minggu Ini") — dua mode: strip 1 minggu (default) atau
// grid sebulan (JadwalPage.calendarExpanded, dibuka lewat tombol "1 Bulan").
// Fungsi ini yang jadi satu-satunya titik render dipanggil dari mana-mana
// tiap ada perubahan data (lihat semua pemanggil _jdwRenderWeek() di file
// ini) — jadi cukup ubah JadwalPage.calendarExpanded lalu panggil ini lagi,
// TIDAK perlu ubah tiap pemanggil satu-satu.
function _jdwRenderWeek() {
    const strip = document.getElementById('jdw-week-strip');
    const monthGrid = document.getElementById('jdw-month-grid');
    const caption = document.getElementById('jdw-week-caption');
    const navWrap = document.getElementById('jdw-cal-nav');
    const monthCaption = document.getElementById('jdw-cal-month-caption');
    const toggleLabel = document.getElementById('jdw-cal-toggle-label');
    const toggleBtn = document.getElementById('jdw-cal-toggle-btn');
    if (!strip) return;
    const todayIso = _jdwToIso(new Date());

    // ── Mode Riwayat: kalender ikut minggu yang lagi dibuka di Riwayat
    // (bukan selalu minggu berjalan), tanggal yang tidak punya riwayat
    // tidak bisa diklik, dan tap tanggal yang punya riwayat memfilter
    // daftar di bawah ke tanggal itu saja (tap lagi = batal filter).
    // Grid-sebulan tidak dipakai di mode ini -> tombol "1 Bulan" disembunyikan.
    if (JadwalPage.currentView === 'riwayat') {
        if (monthGrid) monthGrid.style.display = 'none';
        if (navWrap) navWrap.style.display = 'none';
        if (caption) caption.style.display = '';
        if (toggleBtn) toggleBtn.style.display = 'none';
        strip.style.display = '';
        const weekDates = _jdwRiwayatWeekDates();
        if (caption) caption.textContent = _jdwFmtWeekRange(weekDates);
        strip.innerHTML = weekDates.map(d => {
            const iso = _jdwToIso(d);
            const isToday = iso === todayIso;
            const hasEntries = _jdwStatusListEntriesForDate(iso).length > 0;
            const isSelected = JadwalPage.riwayatDateFilter === iso;
            const onclick = hasEntries ? `JadwalPage.filterRiwayatDate('${iso}')` : '';
            const cls = `jdw-day${isToday ? ' is-today' : ''}${hasEntries ? ' has-entries' : ''}${isSelected ? ' is-riwayat-selected' : ''}${hasEntries ? '' : ' is-riwayat-disabled'}`;
            return `<div class="${cls}"${onclick ? ` onclick="${onclick}"` : ''}>
                <div class="jdw-day-name">${JDW_DAY_SHORT[d.getDay()]}</div>
                <div class="jdw-day-num-wrap"><span>${d.getDate()}</span></div>
            </div>`;
        }).join('');
        return;
    }
    if (toggleBtn) toggleBtn.style.display = '';

    if (JadwalPage.calendarExpanded) {
        if (!JadwalPage.calendarMonthRef) JadwalPage.calendarMonthRef = new Date();
        const ref = JadwalPage.calendarMonthRef;
        strip.style.display = 'none';
        if (monthGrid) monthGrid.style.display = '';
        if (navWrap) navWrap.style.display = 'flex';
        if (caption) caption.style.display = 'none';
        if (monthCaption) monthCaption.textContent = `${JDW_MONTH_NAMES[ref.getMonth()]} ${ref.getFullYear()}`;
        const now = new Date();
        const prevBtn = document.getElementById('jdw-cal-prev-btn');
        // Nggak bisa mundur ke bulan sebelum bulan berjalan — tanggal2nya
        // toh semua sudah lewat & memang tidak bisa diklik.
        if (prevBtn) prevBtn.disabled = ref.getFullYear() === now.getFullYear() && ref.getMonth() === now.getMonth();
        if (toggleLabel) toggleLabel.textContent = '1 Minggu';
        if (toggleBtn) toggleBtn.classList.add('active');
        if (monthGrid) monthGrid.innerHTML = _jdwMonthGridHtml(ref, {
            hasEntriesFn: iso => JadwalStore.byDate(iso).length > 0,
            onClickFn: iso => `JadwalPage.openDay('${iso}')`,
            pastClickFn: iso => `JadwalPage.openPastDayInfo('${iso}')`,
            futureLockedClickFn: iso => `JadwalPage.openFutureLockedDayInfo('${iso}')`,
        });
        return;
    }
    if (monthGrid) monthGrid.style.display = 'none';
    if (navWrap) navWrap.style.display = 'none';
    if (caption) caption.style.display = '';
    if (toggleLabel) toggleLabel.textContent = '1 Bulan';
    if (toggleBtn) toggleBtn.classList.remove('active');
    strip.style.display = '';
    const weekDates = _jdwWeekDates(new Date());
    if (caption) caption.textContent = _jdwFmtWeekRange(weekDates);
    strip.innerHTML = weekDates.map(d => {
        const iso = _jdwToIso(d);
        const isToday = iso === todayIso;
        const isPast = iso < todayIso;
        const hasEntries = JadwalStore.byDate(iso).length > 0;
        const onclick = isPast ? `JadwalPage.openPastDayInfo('${iso}')` : `JadwalPage.openDay('${iso}')`;
        return `<div class="jdw-day${isToday ? ' is-today' : ''}${hasEntries ? ' has-entries' : ''}${isPast ? ' is-past' : ''}" onclick="${onclick}">
            <div class="jdw-day-name">${JDW_DAY_SHORT[d.getDay()]}</div>
            <div class="jdw-day-num-wrap"><span>${d.getDate()}</span></div>
        </div>`;
    }).join('');
}

/* ══════════════════════════════════════════
   JadwalPage — kontrol halaman detail-tanggal & form ajukan
   ══════════════════════════════════════════ */
const JadwalPage = {
    selectedDate: null,   // 'YYYY-MM-DD' tanggal yang lagi dibuka
    editingId: null,      // id entri yang lagi diedit/dijadwal-ulang (null = pengajuan baru)
    pickedSlot: null,
    pickedMateri: null,
    pickedTentor: null,
    // Diisi cuma lewat openAjukanGantiSetelahBatalTentor -> tentorId yang
    // TIDAK BOLEH dipilih lagi di form Ajukan Jadwal ini (tentor yang barusan
    // mengajukan pembatalan). Selalu direset ke null tiap openAjukanOverlay
    // dibuka ulang (lihat di situ), supaya tidak "nempel" ke sesi form lain.
    _excludedTentorId: null,
    currentView: 'minggu',   // 'minggu' | 'riwayat' — toggle di atas list status
    riwayatWeekOffset: 1,    // dipakai saat currentView='riwayat': 0 = minggu ini (belum genap), 1 = minggu lalu, 2 = 2 minggu lalu, dst
    riwayatDateFilter: null, // 'YYYY-MM-DD' kalau lagi difilter ke 1 tanggal spesifik (tap tanggal di kalender atas saat Riwayat), null = tampil 1 minggu penuh

    /* ── Kalender utama: toggle strip 1 minggu <-> grid 1 bulan ── */
    calendarExpanded: false, // true = lagi nampilin grid sebulan (bukan strip minggu)
    calendarMonthRef: null,  // tanggal acuan bulan yang lagi ditampilkan pas grid sebulan kebuka
    toggleCalendarExpand() {
        this.calendarExpanded = !this.calendarExpanded;
        if (this.calendarExpanded && !this.calendarMonthRef) this.calendarMonthRef = new Date();
        _jdwRenderWeek();
    },
    calendarMonthNav(dir) {
        const ref = new Date(this.calendarMonthRef || new Date());
        ref.setMonth(ref.getMonth() + (dir === 'older' ? -1 : 1));
        const now = new Date();
        // Nggak boleh mundur ke bulan sebelum bulan berjalan (lihat catatan
        // di _jdwRenderWeek soal prevBtn.disabled — ini jaga-jaga di sisi
        // logic-nya juga, bukan cuma ngandelin tombolnya kedisable).
        if (ref.getFullYear() < now.getFullYear() || (ref.getFullYear() === now.getFullYear() && ref.getMonth() < now.getMonth())) return;
        this.calendarMonthRef = ref;
        _jdwRenderWeek();
    },

    /* ── Toggle Minggu Ini / Riwayat (di bawah kalender) ── */
    setView(view) {
        this.currentView = view === 'riwayat' ? 'riwayat' : 'minggu';
        this.riwayatDateFilter = null;
        document.querySelectorAll('#jdw-view-toggle .jdw-view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === this.currentView));
        const nav = document.getElementById('jdw-riwayat-nav');
        if (nav) nav.style.display = this.currentView === 'riwayat' ? 'flex' : 'none';
        _jdwRenderStatusList();
        _jdwRenderWeek();
        _jdwSaveViewState();
    },
    riwayatNav(dir) {
        const minOffset = _jdwMinRiwayatOffset();
        const maxOffset = _jdwMaxRiwayatOffset();
        if (dir === 'older') this.riwayatWeekOffset = Math.min(maxOffset, this.riwayatWeekOffset + 1);
        else if (dir === 'newer') this.riwayatWeekOffset = Math.max(minOffset, this.riwayatWeekOffset - 1);
        // Pindah minggu -> filter tanggal spesifik (kalau ada) sudah tidak
        // relevan lagi (tanggalnya bisa jadi di luar minggu yang baru).
        this.riwayatDateFilter = null;
        _jdwRenderStatusList();
        _jdwRenderWeek();
        _jdwSaveViewState();
    },
    // Tap tanggal di kalender atas SAAT currentView='riwayat' (lihat
    // _jdwRenderWeek): kalau tanggal itu punya riwayat, tap pertama
    // filter list di bawah jadi cuma tanggal itu saja; tap tanggal yang
    // sama sekali lagi -> balikin lagi ke tampilan 1 minggu penuh.
    filterRiwayatDate(iso) {
        this.riwayatDateFilter = (this.riwayatDateFilter === iso) ? null : iso;
        _jdwRenderStatusList();
        _jdwRenderWeek();
    },

    /* ── Tap tanggal di kalender -> langsung ke halaman Ajukan Jadwal.
       (Daftar jadwal tanggal ini sudah tampil di depan, lihat #jdw-status-list,
       jadi tidak perlu lagi lewat halaman "detail tanggal" sebelum ajukan.) ── */
    openDay(iso) {
        this.selectedDate = iso;
        this.openAjukanOverlay();
    },
    /* ── Tap tanggal yang SUDAH LEWAT di kalender -> tidak buka form Ajukan,
       cuma info kalau tanggal itu tidak bisa dipilih lagi. ── */
    openPastDayInfo() {
        const titleEl = document.getElementById('jdw-lewat-title');
        const msgEl = document.getElementById('jdw-lewat-msg');
        if (titleEl) titleEl.textContent = 'Tidak Bisa Dipilih';
        if (msgEl) msgEl.textContent = 'Tidak bisa dipilih karena sudah lewat hari.';
        document.getElementById('jdw-lewat-overlay').classList.add('open');
        _jdwSyncPageScrollLock();
    },
    /* ── Tap tanggal bulan DEPAN (atau lebih) yang BELUM kebuka -> sama kayak
       openPastDayInfo di atas (dipakai bareng overlay id=jdw-lewat-overlay,
       tanggalnya juga ditampilkan meredup sama persis kayak tanggal lewat,
       lihat class is-past di _jdwMonthGridHtml), cuma pesannya beda supaya
       user ngerti itu BUKAN tanggal yang sudah lewat, tapi jadwal bulan
       depan yang baru bisa diajukan begitu minggu terakhir bulan berjalan
       (yang nyambung ke tanggal 1 bulan depan) sudah kesampaian. ── */
    openFutureLockedDayInfo() {
        const titleEl = document.getElementById('jdw-lewat-title');
        const msgEl = document.getElementById('jdw-lewat-msg');
        if (titleEl) titleEl.textContent = 'Tanggal Belum Bisa Dipilih';
        if (msgEl) msgEl.textContent = 'Tanggal belum bisa dipilih. Jadwal bulan depan baru bisa diajukan begitu minggu terakhir bulan ini sudah nyambung ke tanggal 1 bulan depan.';
        document.getElementById('jdw-lewat-overlay').classList.add('open');
        _jdwSyncPageScrollLock();
    },
    /* ── Aksi (Edit/Jadwal Ulang/Batal/Masuk/Feedback/Buka) sesuai status sesi saat ini ──
       pending      -> Edit (kiri) + Batal (kanan)
       acc          -> Jadwal Ulang (kiri) + Batal (kanan)
       berlangsung  -> Masuk (kiri) kalau jam sesinya belum lewat, atau
                       Feedback (kiri) kalau sudah lewat — tanpa Batal sama sekali
       resejuel     -> Cek (KANAN, makanya didaftarkan lewat key `left` — lihat
                       catatan di swipe.js: actions yang didaftarkan lewat
                       leftActions dirender pakai class sw-left {right:0},
                       jadi VISUALNYA malah nongol di kanan, bukan kiri;
                       key `right`/rightActions {left:0} justru nongol di
                       kiri. Sempat kebalik & ketauan dari screenshot user.)
                       — buka halaman fullscreen bandingkan jadwal lama vs
                       jadwal baru dari tentor, lihat JadwalPage.bukaResejuel
       pengajuan_batal_tentor -> Cek juga (sama pola dengan resejuel di
                       atas) — buka halaman fullscreen resume jadwal +
                       alasan tentor mengajukan pembatalan, lihat
                       JadwalPage.bukaBatalTentor
       butuh_persetujuan -> Cek (kiri, lanjutin pengajuan jadwal ulang yang
                       sempat ditinggal) + Batal (kanan, buka pilihan
                       batalkan jadwal-ulang saja / batalkan jadwalnya)
       selesai/batal/lain -> tanpa aksi apa pun (sweep/tombol dihilangkan total) ── */
    _entryActions(e) {
        if (e.status === 'resejuel') {
            return {
                left: [{ icon: 'check', label: 'Cek', cls: 'act-primary', onClick: `JadwalPage.bukaResejuel('${e.id}')` }],
                right: [],
            };
        }
        if (e.status === 'pengajuan_batal_tentor') {
            // Pengajuan pembatalan DARI TENTOR (beda dari "pengajuan_pembatalan"
            // yang diajukan user) -> satu-satunya aksi cuma "Cek", buka halaman
            // fullscreen resume jadwal + alasan tentor, lalu Setuju/Tolak. Lihat
            // JadwalPage.bukaBatalTentor.
            return {
                left: [{ icon: 'check', label: 'Cek', cls: 'act-primary', onClick: `JadwalPage.bukaBatalTentor('${e.id}')` }],
                right: [],
            };
        }
        if (e.status === 'pending') {
            return {
                left: [{ icon: 'edit', label: 'Edit', cls: 'act-edit', onClick: `JadwalPage.editEntry('${e.id}')` }],
                right: [{ icon: 'trash', label: 'Batal', cls: 'act-danger', onClick: `JadwalPage.batalEntry('${e.id}')` }],
            };
        }
        if (e.status === 'acc') {
            return {
                left: [{ icon: 'refresh', label: 'Jadwal Ulang', cls: 'act-primary', onClick: `JadwalPage.resejadwalEntry('${e.id}')` }],
                right: [{ icon: 'trash', label: 'Batal', cls: 'act-danger', onClick: `JadwalPage.batalEntry('${e.id}')` }],
            };
        }
        if (e.status === 'berlangsung') {
            const over = _jdwSlotIsOver(e);
            return {
                left: [over
                    ? { icon: 'doc', label: 'Feedback', cls: 'act-primary', onClick: `JadwalPage.feedbackEntry('${e.id}')` }
                    : { icon: 'login', label: 'Masuk', cls: 'act-primary', onClick: `JadwalPage.masukEntry('${e.id}')` }],
                right: [],
            };
        }
        if (e.status === 'butuh_persetujuan') {
            // Entri jadwal-ulang yang sempat ditinggal keluar sebelum selesai
            // diajukan (lihat JadwalPage.confirmKeluarAjukan). "Cek" balikin
            // user ke form Ajukan Jadwal Ulang yang sama (tentor tetap
            // dikunci) buat lanjutin, "Batal" buka pilihan mau batalin
            // jadwal-ulangnya saja atau jadwalnya sekalian (lihat
            // JadwalPage.openBatalPilihan).
            return {
                left: [{ icon: 'check', label: 'Cek', cls: 'act-primary', onClick: `JadwalPage.cekButuhPersetujuan('${e.id}')` }],
                right: [{ icon: 'trash', label: 'Batal', cls: 'act-danger', onClick: `JadwalPage.openBatalPilihan('${e.id}')` }],
            };
        }
        if (e.status === 'pengajuan_pembatalan') {
            // Sudah dalam proses pengajuan pembatalan -> satu-satunya aksi yang
            // tersisa cuma "Tarik Pembatalan" (batal-membatalkan, balik ke acc).
            return {
                left: [{ icon: 'refresh', label: 'Tarik Pembatalan', cls: 'act-primary', onClick: `JadwalPage.tarikBatal('${e.id}')` }],
                right: [],
            };
        }
        return { left: [], right: [] }; // 'selesai' (atau status lain) -> tanpa tombol
    },
    _entryCardHtml(e) {
        const slot = JDW_SLOTS.find(s => s.id === e.slotId);
        const materi = JDW_MATERI.find(m => m.id === e.materiId);
        const tentor = JDW_TENTOR.find(t => t.id === e.tentorId);
        const { left, right } = this._entryActions(e);
        const subParts = [materi ? materi.label : '-', tentor ? tentor.name : null].filter(Boolean);
        return SwipeCards.buildSwipeCardHtml({
            title: slot ? slot.label : '-',
            sub: subParts.join(' · '),
            sideHtml: `<span class="jdw-status-badge ${_jdwBadgeStatus(e)}">${JDW_STATUS_LABEL[_jdwBadgeStatus(e)] || e.status}</span>`,
            kode: e.id,
            leftActions: left, rightActions: right,
        });
    },

    /* ── Halaman ajukan jadwal (pilih jam + materi) ── */
    _isReschedule: false,   // true kalau overlay ini lagi mode "Jadwal Ulang" (entri berstatus acc)
    rescheduleDate: null,   // tanggal BARU yang dipilih lewat kalender mini di overlay (mode Jadwal Ulang saja)
    rescheduleWeekRef: null,// tanggal acuan minggu yang ditampilkan di strip kalender mini —
                             // TETAP (tidak bisa dinavigasi kiri/kanan lagi, lihat rescheduleNav),
                             // cuma dipakai sebagai titik awal: minggu yang berisi tanggal sesi
                             // yang lagi di-jadwal-ulang (diisi di openAjukanOverlay).
    rescheduleExpanded: false, // sama kayak calendarExpanded tapi buat kalender mini form Jadwal Ulang
    rescheduleMonthRef: null,  // tanggal acuan bulan yang lagi ditampilkan pas grid sebulan kalender mini kebuka
    // ── Batas GANTI TENTOR pas mode Jadwal Ulang (beda dari kuota
    // pengajuan/pembatalan di atas — ini bukan soal kuota sama sekali,
    // reschedule TIDAK PERNAH motong kuota pengajuan, mau ganti tentor
    // ataupun tetap tentor yang sama, karena masih pakai "tiket" yang sama
    // dari pengajuan awal). Batasnya murni: tentor cuma boleh diganti
    // MAKSIMAL 1 KALI per sesi/jadwal (per entri), lihat JadwalPage.pickTentor.
    _rescheduleOriginalTentor: null, // tentorId SEBELUM form Jadwal Ulang ini dibuka — jadi acuan "ganti" atau "tetap sama"
    _rescheduleTentorAlreadyChanged: false, // true kalau tentor SUDAH pernah diganti (baik sesi sebelumnya yang tersimpan di entri, ATAU baru saja dikonfirmasi di sesi form ini)
    _pendingTentorChangeId: null, // tentorId yang lagi nunggu konfirmasi popup "Yakin Ganti Tentor?"
    openAjukanOverlay(entryId, lockTentor) {
        _jdwAutoExpirePending(); // bebasin slot yang barusan auto-tertolak sebelum dihitung "terisi"
        _jdwAutoAdvanceStatus();
        this.editingId = entryId || null;
        this._tentorLocked = !!lockTentor;
        this._excludedTentorId = null;
        const existing = entryId ? JadwalStore.get(entryId) : null;
        // Selalu selaraskan selectedDate dengan tanggal entri yang diedit (kalau ada) —
        // ini yang jadi acuan tanggal buat cek jam terisi/lewat, bukan cuma tanggal
        // yang kebetulan lagi kesorot di kalender minggu ini.
        if (existing) this.selectedDate = existing.tanggal;
        this.pickedSlot = existing ? existing.slotId : null;
        this.pickedMateri = existing ? existing.materiId : null;
        this.pickedTentor = existing ? (existing.tentorId || null) : null;
        // Reset acuan ganti-tentor tiap form ini dibuka ulang — acuan "tentor
        // asli" (buat nentuin "tetap sama" vs "ganti") & apakah tentor SUDAH
        // pernah diganti sebelumnya (dibaca dari field persisten
        // tentorPernahDiganti di entri, kalau ada — biar tetap "ingat" walau
        // form ditutup-buka lagi lewat tombol "Cek" tanpa sempat submit).
        this._rescheduleOriginalTentor = existing ? (existing.tentorId || null) : null;
        this._rescheduleTentorAlreadyChanged = !!(existing && existing.tentorPernahDiganti);
        this._pendingTentorChangeId = null;
        // "butuh_persetujuan" ikut dianggap mode Jadwal Ulang (bukan cuma
        // "acc") — ini kejadian pas user balik lagi lewat tombol "Cek" buat
        // NERUSIN pengajuan jadwal-ulang yang sempat ditinggal keluar
        // (lihat JadwalPage.cekButuhPersetujuan & confirmKeluarAjukan).
        const isReschedule = !!(existing && (existing.status === 'acc' || existing.status === 'butuh_persetujuan'));
        this._isReschedule = isReschedule;
        this.rescheduleDate = isReschedule ? existing.tanggal : null;
        this.rescheduleWeekRef = isReschedule ? new Date(existing.tanggal + 'T00:00:00') : null;
        // Selalu balik ke tampilan strip minggu tiap form ini dibuka ulang
        // (bukan nerusin grid sebulan dari sesi sebelumnya).
        this.rescheduleExpanded = false;
        this.rescheduleMonthRef = null;
        document.getElementById('jdw-ajukan-title').textContent = existing ? (isReschedule ? 'Jadwal Ulang' : 'Ubah Pengajuan') : 'Ajukan Jadwal';
        document.getElementById('jdw-submit-btn').textContent = existing ? (isReschedule ? 'AJUKAN ULANG' : 'EDIT PENGAJUAN') : 'AJUKAN';
        this._updateAjukanDateLabel();

        // Kalender pilih-tanggal & bagian alasan cuma nongol pas mode Jadwal Ulang.
        const dateSection = document.getElementById('jdw-reschedule-date-section');
        const alasanSection = document.getElementById('jdw-reschedule-alasan-section');
        if (dateSection) dateSection.style.display = isReschedule ? '' : 'none';
        if (alasanSection) alasanSection.style.display = isReschedule ? '' : 'none';
        const alasanEl = document.getElementById('jdw-reschedule-alasan');
        if (alasanEl) alasanEl.value = '';
        if (isReschedule) this._renderRescheduleCalendar();

        this._renderTentorPicker();
        this._renderSlotGrid();
        this._renderMateriGrid();
        this._refreshSubmitBtn();
        const overlay = document.getElementById('jdw-ajukan-overlay');
        overlay.classList.add('open');
        _jdwSyncPageScrollLock();
        const body = overlay.querySelector('.jdw-modal-body');
        if (body) body.scrollTop = 0;
        _jdwSaveState();
    },
    closeAjukanOverlay() {
        document.getElementById('jdw-ajukan-overlay').classList.remove('open');
        _jdwSyncPageScrollLock();
        _jdwSaveState();
    },
    // Dipanggil dari tombol X di header form Ajukan Jadwal. Untuk pengajuan
    // biasa/edit/jadwal-ulang normal, keluar langsung seperti biasa. TAPI
    // kalau ini form Jadwal Ulang yang tentornya DIKUNCI (this._tentorLocked
    // — dibuka lewat confirmAjukanSetelahTolak/cekButuhPersetujuan setelah
    // user menolak jadwal ulang dari tentor), keluar harus dikonfirmasi dulu
    // lewat popup "Yakin Keluar?" karena akan mengubah status pengajuan.
    closeAjukanOverlayRequest() {
        if (this._tentorLocked) {
            document.getElementById('jdw-keluar-ajukan-overlay').classList.add('open');
            _jdwSyncPageScrollLock();
            return;
        }
        this.closeAjukanOverlay();
    },
    // User pilih "Ya, Keluar" di popup "Yakin Keluar?" — form ditutup TANPA
    // menyimpan pengajuan jadwal-ulang baru, tapi entri lama (yang lagi
    // dalam proses jadwal-ulang, editingId) statusnya diubah dari "acc"
    // jadi "butuh_persetujuan" biar user tahu masih ada pengajuan jadwal
    // ulang yang belum selesai dan perlu ditindaklanjuti (lewat "Cek" atau
    // "Batal" di kartu status — lihat _entryActions & cekButuhPersetujuan).
    confirmKeluarAjukan() {
        document.getElementById('jdw-keluar-ajukan-overlay').classList.remove('open');
        const id = this.editingId;
        this.closeAjukanOverlay();
        if (!id) return;
        JadwalStore.update(id, { status: 'butuh_persetujuan' });
        showToast('Keluar dari pengajuan jadwal ulang, status: Butuh Persetujuan');
        _jdwRenderWeek();
        _jdwRenderStatusList();
    },
    // Tombol "Cek" di kartu status "butuh_persetujuan" — balik ke form
    // Jadwal Ulang yang sama persis (tentor tetap dikunci) buat NERUSIN
    // pengajuan yang sempat ditinggal, bukan mulai dari awal lagi.
    cekButuhPersetujuan(id) {
        this.openAjukanOverlay(id, true);
    },
    /* ── Popup pilihan saat tombol "Batal" ditekan di kartu status
       "butuh_persetujuan" — TANPA pertanyaan, langsung 2 pilihan tindakan:
       "Batalkan Jadwal Ulang" (persis seperti Tolak di awal: jadwal LAMA
       tetap berlaku, pengajuan jadwal-ulangnya saja yang batal) atau
       "Batalkan Jadwal" (jadwalnya sekalian dibatalkan, lewat alur
       Pengajuan Pembatalan yang sama dengan entri "acc" biasa). ── */
    _batalPilihanTargetId: null,
    openBatalPilihan(id) {
        this._batalPilihanTargetId = id;
        document.getElementById('jdw-batal-pilihan-overlay').classList.add('open');
        _jdwSyncPageScrollLock();
    },
    closeBatalPilihan() {
        document.getElementById('jdw-batal-pilihan-overlay').classList.remove('open');
        this._batalPilihanTargetId = null;
        _jdwSyncPageScrollLock();
    },
    // "Batalkan Jadwal Ulang" -> sama seperti tolakResejuel: cuma lepas
    // proses jadwal-ulangnya, jadwal lama (entri ini sendiri) balik "acc"
    // seperti semula. BUKAN membuka lagi form "Ajukan Jadwal Lain?".
    batalPilihanJadwalUlang() {
        const id = this._batalPilihanTargetId;
        this.closeBatalPilihan();
        if (!id) return;
        JadwalStore.update(id, { status: 'acc' });
        showToast('Jadwal ulang dibatalkan, jadwal lama tetap berlaku');
        _jdwRenderWeek();
        _jdwRenderStatusList();
    },
    // "Batalkan Jadwal" -> jadwalnya sekalian, lewat alur formal Pengajuan
    // Pembatalan yang sama dipakai entri "acc" (rekap + alasan + centang
    // persetujuan), karena di baliknya jadwal ini memang masih "acc".
    batalPilihanJadwal() {
        const id = this._batalPilihanTargetId;
        this.closeBatalPilihan();
        if (!id) return;
        // Sama seperti batalEntry() buat entri "acc" biasa — cek dulu kuota
        // pembatalan (maksimal 3x) sebelum buka halaman pengajuan pembatalan,
        // kecuali entrinya "gratis" (freeCancelEligible).
        const e = JadwalStore.get(id);
        if (e && !e.freeCancelEligible && _jdwKuotaBatalSisa() <= 0) { this.openBatalKuotaHabis(); return; }
        this.openBatalPengajuan(id);
    },
    /* ── Tanggal aktif yang jadi acuan grid jam: tanggal baru hasil pilih di
       kalender mini (mode Jadwal Ulang), atau tanggal biasa (ajukan baru/edit). ── */
    _activeDate() { return this._isReschedule ? this.rescheduleDate : this.selectedDate; },
    // Label tanggal-bulan-tahun yang nongol di bawah judul overlay ajukan —
    // ngikutin tanggal yang lagi aktif (selectedDate biasa, atau rescheduleDate
    // begitu user pilih tanggal baru di kalender mini mode Jadwal Ulang).
    _updateAjukanDateLabel() {
        const el = document.getElementById('jdw-ajukan-date');
        if (!el) return;
        const iso = this._activeDate();
        el.textContent = iso ? _jdwFmtDateLong(iso) : '';
    },
    _renderSlotGrid() {
        const activeDate = this._activeDate();
        // Jam yang sudah dipakai entri lain (selain yang sedang diedit) di tanggal ini -> dikunci, tidak boleh dobel.
        const takenSlotIds = new Set(
            JadwalStore.byDate(activeDate)
                .filter(e => e.id !== this.editingId && e.status !== 'ditolak' && e.status !== 'batal')
                .map(e => e.slotId)
        );
        // Kalau tanggal yang dipilih adalah HARI INI, jam yang jam-mulainya sudah
        // lewat dari sekarang ikut dikunci — nggak masuk akal ngajuin jam yang
        // udah kelewatan.
        const isToday = activeDate === _jdwToIso(new Date());
        const now = new Date();
        document.getElementById('jdw-slot-grid').innerHTML = JDW_SLOTS.map(s => {
            const taken = takenSlotIds.has(s.id);
            const past = isToday && (() => { const start = _jdwSlotStartDate(activeDate, s.id); return start && start <= now; })();
            const tentorBlocked = !_jdwTentorAllowsSlot(this.pickedTentor, s.id);
            const disabled = taken || past || tentorBlocked;
            const selected = this.pickedSlot === s.id;
            const tag = taken ? ' <small>(terisi)</small>' : (past ? ' <small>(sudah lewat)</small>' : (tentorBlocked ? ' <small>(sudah terisi)</small>' : ''));
            return `<div class="jdw-chip${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}" ${disabled ? '' : `onclick="JadwalPage.pickSlot('${s.id}')"`}>
                <span>${s.label}${tag}</span>
                <span class="jdw-chip-check"></span>
            </div>`;
        }).join('');
    },
    /* ── Box "Pilih Tentor" di halaman Ajukan Jadwal — nampilin placeholder
       "+ Pilih Tentor" kalau belum kepilih, atau kartu nama tentor + materi
       yang diajar kalau sudah. Box ini sendiri yang jadi tombol buka/ganti
       tentor (tap kapan aja, baik masih kosong atau sudah kepilih) —
       KECUALI kalau this._tentorLocked true (dibuka lewat
       JadwalPage.confirmAjukanSetelahTolak(), habis Tolak jadwal ulang dari
       tentor) — dalam kondisi itu tentor WAJIB tetap sama kayak jadwal yang
       barusan ditolak reschedule-nya, jadi onclick-nya dilepas total & boxnya
       digelapkan (lihat CSS .jdw-tentor-picker-selected.locked). ── */
    _tentorLocked: false,
    _renderTentorPicker() {
        const wrap = document.getElementById('jdw-tentor-picker');
        if (!wrap) return;
        const t = JDW_TENTOR.find(x => x.id === this.pickedTentor);
        const locked = this._tentorLocked;
        if (!t) {
            wrap.innerHTML = `<div class="jdw-tentor-picker-empty"${locked ? '' : ' onclick="JadwalPage.openTentorOverlay()"'}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Pilih Tentor
            </div>`;
            return;
        }
        wrap.innerHTML = `<div class="jdw-tentor-picker-selected${locked ? ' locked' : ''}"${locked ? '' : ' onclick="JadwalPage.openTentorOverlay()"'}>
            <div class="jdw-tentor-avatar">${t.name.charAt(0)}</div>
            <div class="jdw-tentor-picker-info">
                <div class="jdw-tentor-picker-name">${t.name}</div>
                <div class="jdw-tentor-picker-sub">${locked ? 'Tentor tidak bisa diganti' : _jdwTentorMateriLabel(t)}</div>
            </div>
            ${locked
                ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14" style="flex-shrink:0;color:var(--text-sub)"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`
                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="15" height="15" style="flex-shrink:0;color:var(--text-sub)"><polyline points="9 18 15 12 9 6"/></svg>`}
        </div>`;
    },
    /* ── Halaman "Pilih Tentor" (search + list nama tentor) — dibuka dari box
       di atas. Milih salah satu langsung balik ke halaman Ajukan Jadwal.
       Guard this._tentorLocked di sini juga (bukan cuma lepas onclick di
       box-nya) — jaga-jaga kalau ada jalan lain buat manggil fungsi ini
       selagi tentor lagi dikunci. ── */
    openTentorOverlay() {
        if (this._tentorLocked) return;
        const search = document.getElementById('jdw-tentor-search');
        if (search) search.value = '';
        this._renderTentorList('');
        document.getElementById('jdw-tentor-overlay').classList.add('open');
        _jdwSyncPageScrollLock();
        if (search) search.focus();
    },
    closeTentorOverlay() {
        document.getElementById('jdw-tentor-overlay').classList.remove('open');
        _jdwSyncPageScrollLock();
    },
    filterTentor(q) { this._renderTentorList(q); },
    _renderTentorList(q) {
        const wrap = document.getElementById('jdw-tentor-list');
        if (!wrap) return;
        const query = (q || '').trim().toLowerCase();
        const list = JDW_TENTOR.filter(t => _jdwTentorMatchesQuery(t, query));
        if (!list.length) {
            wrap.innerHTML = `<div class="jdw-tentor-empty">Tentor "${q}" tidak ditemukan</div>`;
            return;
        }
        wrap.innerHTML = list.map(t => {
            const selected = this.pickedTentor === t.id;
            const noSlots = _jdwTentorHasNoSlots(t);
            // Tentor yang barusan mengajukan pembatalan (this._excludedTentorId,
            // diisi lewat openAjukanGantiSetelahBatalTentor) tidak boleh dipilih
            // lagi di form pengganti ini.
            const excluded = !!this._excludedTentorId && t.id === this._excludedTentorId;
            const disabled = noSlots || excluded;
            const sub = excluded ? 'Baru saja mengajukan pembatalan jadwal ini' : (noSlots ? 'Tidak ada jadwal tersedia' : _jdwTentorMateriLabel(t));
            return `<div class="jdw-tentor-item${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}" onclick="${disabled ? '' : `JadwalPage.pickTentor('${t.id}')`}">
                <div class="jdw-tentor-avatar">${t.name.charAt(0)}</div>
                <div class="jdw-tentor-item-info">
                    <div class="jdw-tentor-item-name">${t.name}</div>
                    <div class="jdw-tentor-item-sub">${sub}</div>
                </div>
                <span class="jdw-tentor-item-check"></span>
            </div>`;
        }).join('');
    },
    /* ── Milih tentor: kalau materi yang sebelumnya kepilih ternyata bukan
       diajar tentor baru ini, lepas pilihan materi itu -> user wajib pilih
       ulang materi yang memang diajar tentor ini.
       KHUSUS mode Jadwal Ulang (this._isReschedule, tentor TIDAK dikunci) —
       milih tentor yang BEDA dari tentor asli (this._rescheduleOriginalTentor)
       dianggap "GANTI tentor" dan dibatasi maksimal 1x per sesi/jadwal:
         - Belum pernah ganti (_rescheduleTentorAlreadyChanged false) -> buka
           dulu popup konfirmasi "Yakin Ganti Tentor?" (openTentorGantiConfirm),
           BELUM langsung diterapkan sampai user pilih "Ya" (confirmTentorGanti).
         - Sudah pernah ganti sekali -> popup info "tidak bisa ganti lagi"
           (openTentorGantiTerpakai), TIDAK diterapkan sama sekali.
       Milih tentor yang SAMA dengan tentor asli (balik ke tentor semula,
       atau memang belum diganti) TIDAK dianggap "ganti" -> langsung
       diterapkan seperti biasa, tanpa popup apa pun. Mode BUKAN Jadwal
       Ulang (Ajukan Jadwal baru / Edit pengajuan pending) juga tidak kena
       batasan ini sama sekali -- milih tentor apa pun bebas seperti biasa. ── */
    pickTentor(id) {
        if (this._isReschedule && !this._tentorLocked && id !== this.pickedTentor && id !== this._rescheduleOriginalTentor) {
            if (this._rescheduleTentorAlreadyChanged) {
                this.openTentorGantiTerpakai();
                return;
            }
            this._pendingTentorChangeId = id;
            this.openTentorGantiConfirm();
            return;
        }
        this._applyPickTentor(id);
    },
    _applyPickTentor(id) {
        const t = JDW_TENTOR.find(x => x.id === id);
        if (t && _jdwTentorHasNoSlots(t)) return; // jaga-jaga, harusnya sudah tidak punya onclick
        if (this._excludedTentorId && id === this._excludedTentorId) return; // jaga-jaga, harusnya sudah tidak punya onclick
        this.pickedTentor = id;
        if (this.pickedMateri && !_jdwTentorAllowsMateri(id, this.pickedMateri)) this.pickedMateri = null;
        if (this.pickedSlot && !_jdwTentorAllowsSlot(id, this.pickedSlot)) this.pickedSlot = null;
        this._renderTentorPicker();
        this._renderSlotGrid();
        this._renderMateriGrid();
        this._refreshSubmitBtn();
        this.closeTentorOverlay();
        _jdwSaveState();
    },
    /* ── Popup konfirmasi "Yakin Ganti Tentor?" — dipicu dari pickTentor() di
       atas SEBELUM tentor beneran diganti. "Ya" -> tentor diganti (lewat
       _applyPickTentor) & _rescheduleTentorAlreadyChanged dikunci true (jatah
       ganti tentor buat sesi ini abis dipakai). "Tidak"/tap backdrop -> popup
       ditutup doang, tentor TIDAK jadi diganti, tetap di halaman/list tentor
       yang sama seperti sebelum popup ini muncul (tidak ada perubahan
       tampilan lain). ── */
    openTentorGantiConfirm() {
        document.getElementById('jdw-tentor-ganti-confirm-overlay').classList.add('open');
        _jdwSyncPageScrollLock();
    },
    closeTentorGantiConfirm() {
        document.getElementById('jdw-tentor-ganti-confirm-overlay').classList.remove('open');
        this._pendingTentorChangeId = null;
        _jdwSyncPageScrollLock();
    },
    confirmTentorGanti() {
        document.getElementById('jdw-tentor-ganti-confirm-overlay').classList.remove('open');
        _jdwSyncPageScrollLock();
        const id = this._pendingTentorChangeId;
        this._pendingTentorChangeId = null;
        if (!id) return;
        this._rescheduleTentorAlreadyChanged = true;
        this._applyPickTentor(id);
    },
    /* ── Popup info "Tidak Bisa Ganti Tentor Lagi" — muncul kalau user coba
       pilih tentor lain (beda dari tentor yang lagi aktif) padahal jatah
       ganti tentor (1x per sesi/jadwal) sudah kepakai. Cuma 1 tombol
       "Mengerti", tentor TIDAK berubah sama sekali. ── */
    openTentorGantiTerpakai() {
        document.getElementById('jdw-tentor-ganti-terpakai-overlay').classList.add('open');
        _jdwSyncPageScrollLock();
    },
    closeTentorGantiTerpakai() {
        document.getElementById('jdw-tentor-ganti-terpakai-overlay').classList.remove('open');
        _jdwSyncPageScrollLock();
    },
    /* ── Kalender mini di dalam overlay Jadwal Ulang — pilih tanggal baru.
       Sama kayak kalender utama, dua mode: strip 1 minggu (default) atau
       grid sebulan (this.rescheduleExpanded, dibuka lewat tombol "1 Bulan"
       di jdw-reschedule-toggle-btn). Satu-satunya titik render dipanggil
       tiap ada perubahan (buka overlay/pilih tanggal/nav), lihat pemanggilnya
       di openAjukanOverlay, pickRescheduleDate, & rescheduleNav di bawah. ── */
    _renderRescheduleCalendar() {
        const strip = document.getElementById('jdw-reschedule-strip');
        const monthGrid = document.getElementById('jdw-reschedule-month-grid');
        const caption = document.getElementById('jdw-reschedule-caption');
        const toggleLabel = document.getElementById('jdw-reschedule-toggle-label');
        const toggleBtn = document.getElementById('jdw-reschedule-toggle-btn');
        const prevBtn = document.getElementById('jdw-reschedule-prev-btn');
        // Nav kiri/kanan (id=jdw-reschedule-cal-nav) — SAMA PERSIS kayak
        // jdw-cal-nav di kalender utama (lihat _jdwRenderWeek): cuma nongol
        // & aktif pas mode grid sebulan. Di mode strip 1 minggu, wrapper ini
        // disembunyikan total (bukan cuma disabled) supaya benar-benar tidak
        // bisa diklik kiri/kanan — sebelumnya tombol ini selalu kelihatan
        // walau lagi mode minggu, jadi bisa dipakai "loncat" minggu demi
        // minggu tembus ke bulan depan yang seharusnya belum boleh diakses.
        const navWrap = document.getElementById('jdw-reschedule-cal-nav');
        if (!strip) return;
        const todayIso = _jdwToIso(new Date());
        if (this.rescheduleExpanded) {
            if (!this.rescheduleMonthRef) this.rescheduleMonthRef = new Date(this.rescheduleDate ? this.rescheduleDate + 'T00:00:00' : new Date());
            const ref = this.rescheduleMonthRef;
            strip.style.display = 'none';
            if (monthGrid) monthGrid.style.display = '';
            if (navWrap) navWrap.style.display = 'flex';
            if (caption) caption.textContent = `${JDW_MONTH_NAMES[ref.getMonth()]} ${ref.getFullYear()}`;
            const now = new Date();
            if (prevBtn) prevBtn.disabled = ref.getFullYear() === now.getFullYear() && ref.getMonth() === now.getMonth();
            if (toggleLabel) toggleLabel.textContent = '1 Minggu';
            if (toggleBtn) toggleBtn.classList.add('active');
            if (monthGrid) monthGrid.innerHTML = _jdwMonthGridHtml(ref, {
                selectedIso: this.rescheduleDate,
                hasEntriesFn: iso => JadwalStore.byDate(iso).filter(e => e.id !== this.editingId).length > 0,
                onClickFn: iso => `JadwalPage.pickRescheduleDate('${iso}')`,
                pastClickFn: iso => `JadwalPage.openPastDayInfo('${iso}')`,
                futureLockedClickFn: iso => `JadwalPage.openFutureLockedDayInfo('${iso}')`,
            });
            return;
        }
        if (monthGrid) monthGrid.style.display = 'none';
        if (navWrap) navWrap.style.display = 'none';
        if (toggleLabel) toggleLabel.textContent = '1 Bulan';
        if (toggleBtn) toggleBtn.classList.remove('active');
        strip.style.display = '';
        const weekDates = _jdwWeekDates(this.rescheduleWeekRef || new Date());
        if (caption) caption.textContent = _jdwFmtWeekRange(weekDates);
        strip.innerHTML = weekDates.map(d => {
            const iso = _jdwToIso(d);
            const isSelected = iso === this.rescheduleDate;
            const isPast = iso < todayIso;
            const hasEntries = JadwalStore.byDate(iso).filter(e => e.id !== this.editingId).length > 0;
            const onclick = isPast ? `JadwalPage.openPastDayInfo('${iso}')` : `JadwalPage.pickRescheduleDate('${iso}')`;
            return `<div class="jdw-day${isSelected ? ' is-today' : ''}${hasEntries ? ' has-entries' : ''}${isPast ? ' is-past' : ''}" onclick="${onclick}">
                <div class="jdw-day-name">${JDW_DAY_SHORT[d.getDay()]}</div>
                <div class="jdw-day-num-wrap"><span>${d.getDate()}</span></div>
            </div>`;
        }).join('');
    },
    toggleRescheduleExpand() {
        this.rescheduleExpanded = !this.rescheduleExpanded;
        if (this.rescheduleExpanded && !this.rescheduleMonthRef) {
            this.rescheduleMonthRef = new Date(this.rescheduleDate ? this.rescheduleDate + 'T00:00:00' : new Date());
        }
        this._renderRescheduleCalendar();
    },
    // Kiri/kanan cuma berfungsi pas mode grid sebulan (this.rescheduleExpanded)
    // — SAMA PERSIS kayak JadwalPage.calendarMonthNav di kalender utama,
    // termasuk batas tidak boleh mundur ke bulan sebelum bulan berjalan.
    // Mode strip 1 minggu SENGAJA tidak punya navigasi apapun (lihat
    // navWrap.style.display di _renderRescheduleCalendar, tombolnya
    // disembunyikan total di mode ini) — dijaga di sisi logic juga lewat
    // guard clause di bawah, bukan cuma ngandelin tombolnya kesembunyi,
    // supaya tidak ada jalan pintas ke bulan yang belum boleh diakses.
    rescheduleNav(dir) {
        if (!this.rescheduleExpanded) return;
        const ref = new Date(this.rescheduleMonthRef || new Date());
        ref.setMonth(ref.getMonth() + (dir === 'older' ? -1 : 1));
        const now = new Date();
        if (ref.getFullYear() < now.getFullYear() || (ref.getFullYear() === now.getFullYear() && ref.getMonth() < now.getMonth())) return;
        this.rescheduleMonthRef = ref;
        this._renderRescheduleCalendar();
    },
    pickRescheduleDate(iso) {
        const todayIso = _jdwToIso(new Date());
        if (iso < todayIso) return; // tanggal sudah lewat, tidak bisa dipilih
        this.rescheduleDate = iso;
        // Kalau jam yang sebelumnya kepilih ternyata sudah "terisi" di tanggal
        // baru ini, lepas pilihan jam itu -> user wajib pilih ulang jamnya.
        const takenSlotIds = new Set(
            JadwalStore.byDate(iso).filter(e => e.id !== this.editingId && e.status !== 'ditolak' && e.status !== 'batal').map(e => e.slotId)
        );
        if (this.pickedSlot && takenSlotIds.has(this.pickedSlot)) this.pickedSlot = null;
        this._renderRescheduleCalendar();
        this._renderSlotGrid();
        this._updateAjukanDateLabel();
        this._refreshSubmitBtn();
        _jdwSaveState();
    },
    pickSlot(id) {
        this.pickedSlot = id;
        this._renderSlotGrid();
        this._refreshSubmitBtn();
        _jdwSaveState();
    },
    /* ── Grid "Pilih Materi" — materi yang bukan diajar tentor yang lagi
       kepilih dikunci (abu-abu, tidak bisa diklik), sama kayak jam yang
       sudah terisi di grid Pilih Jam. Belum pilih tentor -> semua materi
       masih aktif normal. ── */
    _renderMateriGrid() {
        const grid = document.getElementById('jdw-materi-grid');
        if (!grid) return;
        grid.innerHTML = JDW_MATERI.map(m => {
            const selected = this.pickedMateri === m.id;
            const allowed = _jdwTentorAllowsMateri(this.pickedTentor, m.id);
            return `<div class="jdw-materi-chip${selected ? ' selected' : ''}${!allowed ? ' disabled' : ''}" ${allowed ? `onclick="JadwalPage.pickMateri('${m.id}')"` : ''}>${m.label}</div>`;
        }).join('');
    },
    pickMateri(id) {
        if (!_jdwTentorAllowsMateri(this.pickedTentor, id)) return; // jaga-jaga, harusnya sudah tidak punya onclick
        this.pickedMateri = id;
        this._renderMateriGrid();
        this._refreshSubmitBtn();
        _jdwSaveState();
    },
    _refreshSubmitBtn() {
        const btn = document.getElementById('jdw-submit-btn');
        let ok = !!(this.pickedTentor && this.pickedSlot && this.pickedMateri);
        if (this._isReschedule) {
            const alasanEl = document.getElementById('jdw-reschedule-alasan');
            ok = ok && !!this.rescheduleDate && !!(alasanEl && alasanEl.value.trim());
        }
        btn.disabled = !ok;
    },
    submitAjukan() {
        if (!this.pickedTentor || !this.pickedSlot || !this.pickedMateri) return;
        // Simulasi race-condition ala server: cek ULANG persis saat mau submit (bukan
        // cuma pas grid dirender tadi) apakah jam+tanggal ini KEBURU diambil pengajuan
        // lain (mis. dari tab/device lain yang submit lebih dulu, sekarang statusnya
        // sudah bukan "ditolak" lagi di JadwalStore).
        const targetDate = this._activeDate();
        const raceLost = JadwalStore.byDate(targetDate).some(e =>
            e.id !== this.editingId && e.slotId === this.pickedSlot && e.status !== 'ditolak' && e.status !== 'batal'
        );
        if (this.editingId) {
            const existing = JadwalStore.get(this.editingId);
            const wasAcc = existing && existing.status === 'acc';
            if (this._isReschedule) {
                if (!this.rescheduleDate) return;
                const alasanEl = document.getElementById('jdw-reschedule-alasan');
                const alasan = alasanEl ? alasanEl.value.trim() : '';
                if (!alasan) return;
                if (raceLost) {
                    // PENTING: jam tujuan jadwal-ulang keburu diambil pengajuan lain ->
                    // jadwal LAMA (entri asli, masih "acc") TIDAK BOLEH ikut ditimpa/
                    // hilang. JadwalStore.update ke editingId SENGAJA tidak dipanggil
                    // sama sekali di sini — entri asli tetap utuh persis seperti semula
                    // (tanggal lama, jam lama, status tetap "acc"). Percobaan jadwal-
                    // ulang yang gagal ini dicatat sebagai entri BARU terpisah berstatus
                    // "ditolak", biar tetap ada jejaknya di JadwalStore.
                    JadwalStore.add({
                        tanggal: this.rescheduleDate, slotId: this.pickedSlot, materiId: this.pickedMateri,
                        tentorId: this.pickedTentor, status: 'ditolak',
                        alasanReschedule: alasan, rescheduleOf: this.editingId,
                    });
                    showToast('✗ Jam tujuan baru saja diambil pengajuan lain — jadwal lama kamu tetap seperti semula');
                } else {
                    // freeCancelEligible di-reset ke false: ini pengajuan jadwal
                    // ulang VERSI USER SENDIRI (bukan dari tentor), jadi "maaf
                    // pembatalan gratis" dari resejuel tentor sebelumnya (kalau
                    // ada) tidak ikut kebawa lagi ke pengajuan baru ini.
                    // tentorPernahDiganti: begitu this._rescheduleTentorAlreadyChanged
                    // true (tentor SUDAH dikonfirmasi ganti di form ini, lewat
                    // JadwalPage.confirmTentorGanti), baru di sini dipatenkan
                    // ke entrinya SECARA PERMANEN — jatah ganti tentor (1x per
                    // sesi/jadwal) resmi kepakai & tidak reset lagi walau nanti
                    // entri ini dibuka ulang buat jadwal-ulang berikutnya (lihat
                    // openAjukanOverlay & JadwalPage.pickTentor).
                    JadwalStore.update(this.editingId, {
                        slotId: this.pickedSlot, materiId: this.pickedMateri, tentorId: this.pickedTentor,
                        status: 'pending', tanggal: this.rescheduleDate, alasanReschedule: alasan,
                        freeCancelEligible: false,
                        tentorPernahDiganti: existing.tentorPernahDiganti || this._rescheduleTentorAlreadyChanged,
                    });
                    showToast('✓ Jadwal ulang diajukan, menunggu persetujuan');
                }
            } else {
                // Sama seperti Jadwal Ulang di atas: entri ASLI (masih "pending", jam/
                // materi/tentor SEBELUM diedit) TIDAK ikut ditimpa/hilang kalau jam BARU
                // hasil edit ternyata keburu diambil pengajuan lain. Entri asli tetap
                // utuh persis seperti semula (kembali seperti sebelum diedit), percobaan
                // edit yang gagal dicatat sebagai entri baru terpisah berstatus "ditolak".
                if (raceLost) {
                    JadwalStore.add({
                        tanggal: this.selectedDate, slotId: this.pickedSlot, materiId: this.pickedMateri,
                        tentorId: this.pickedTentor, status: 'ditolak', editOf: this.editingId,
                    });
                    showToast('✗ Jam ini baru saja terisi pengajuan lain — pengajuan lama kamu tetap seperti semula');
                } else {
                    // Kuota TIDAK dipotong di sini — sama seperti mode Jadwal
                    // Ulang di atas, edit ini nge-update ENTRI YANG SAMA
                    // (this.editingId, masih "tiket" pengajuan yang sudah
                    // terlanjur kepakai/terhitung dari awal), bukan bikin
                    // entri baru. _jdwKuotaTerpakai() cuma ngitung JUMLAH
                    // entri aktif, bukan berapa kali entrinya diedit — jadi
                    // status tetap "pending" & id-nya tetap sama, otomatis
                    // tidak nambah hitungan kuota terpakai sama sekali.
                    JadwalStore.update(this.editingId, {
                        slotId: this.pickedSlot, materiId: this.pickedMateri, tentorId: this.pickedTentor,
                        status: 'pending',
                    });
                    showToast('✓ Pengajuan jadwal diperbarui');
                }
            }
        } else {
            JadwalStore.add({ tanggal: this.selectedDate, slotId: this.pickedSlot, materiId: this.pickedMateri, tentorId: this.pickedTentor, status: raceLost ? 'ditolak' : 'pending' });
            showToast(raceLost ? '✗ Jam ini baru saja diambil orang lain, pengajuan otomatis ditolak' : '✓ Jadwal berhasil diajukan');
        }
        this.closeAjukanOverlay();
        _jdwRenderWeek();
        _jdwRenderStatusList();
        _jdwSaveState();
    },

    /* ── Aksi list (dipanggil dari sweep card / tombol tabel) ── */
    editEntry(id) { this.openAjukanOverlay(id); },
    // Tombol "Jadwal Ulang" (entri status "acc") -> batas maksimal pengajuan
    // jadwal ulang adalah H-1: selama tanggal sesi masih BESOK atau lebih
    // (belum masuk hari H, walau jamnya sudah malam sekalipun, mis. jam
    // 20.00 di H-1 masih boleh), form Ajukan Jadwal Ulang tetap kebuka
    // normal. Begitu tanggal SEKARANG sudah sama dengan tanggal sesi
    // (sudah masuk hari H, dari jam 00.00), munculkan popup info & form
    // TIDAK dibuka sama sekali.
    resejadwalEntry(id) {
        const e = JadwalStore.get(id);
        if (e && !_jdwCanReschedule(e.tanggal)) {
            this.openRescheduleHariHInfo();
            return;
        }
        this.openAjukanOverlay(id);
    },
    // Popup info "batas H-1 sudah lewat" — cuma 1 tombol "Mengerti", sama
    // pola kayak jdw-lewat-overlay (info tanggal sudah lewat di kalender).
    openRescheduleHariHInfo() {
        document.getElementById('jdw-reschedule-harih-overlay').classList.add('open');
        _jdwSyncPageScrollLock();
    },
    closeRescheduleHariHInfo() {
        document.getElementById('jdw-reschedule-harih-overlay').classList.remove('open');
        _jdwSyncPageScrollLock();
    },

    /* ── Halaman fullscreen "Jadwal Ulang dari Tentor" (status "resejuel") —
       sama pola dengan halaman Ajukan Jadwal (jdw-ajukan-overlay): header
       sticky + body scroll + tombol aksi di ujung bawah body (di atas dock
       utama). Isinya bandingkan resume jadwal LAMA (diajukan user, disimpan
       di tanggal/slotId/materiId entri ini sendiri) di atas, lalu resume
       jadwal BARU (diajukan tentor, disimpan terpisah di field `reschedule`,
       termasuk alasan tentor mengajukan jadwal ulang) di bawah — tiap resume
       ikut nampilin nama tentornya. Di layar desktop (lihat CSS
       .jdw-resejuel-compare @media min-width:769px) keduanya disusun
       berdampingan (lama di kiri, baru di kanan) dengan panah horizontal di
       antaranya, bukan ditumpuk vertikal kayak mobile. Lalu Setuju/Tolak. ── */
    _resejuelTargetId: null,
    bukaResejuel(id) {
        const e = JadwalStore.get(id);
        if (!e || !e.reschedule) return;
        this._resejuelTargetId = id;
        const itemHtml = (tanggal, slotId, materiId, tentorId, label, cls, alasan) => {
            const slot = JDW_SLOTS.find(s => s.id === slotId);
            const materi = JDW_MATERI.find(m => m.id === materiId);
            const tentor = JDW_TENTOR.find(t => t.id === tentorId);
            return `<div class="jdw-resejuel-item ${cls}">
                <div class="jdw-resejuel-item-label">${label}</div>
                <div class="jdw-resejuel-item-date">${_jdwFmtDateLong(tanggal)}</div>
                <div class="jdw-resejuel-item-row"><span>${slot ? slot.label : '-'}</span><span class="jdw-resejuel-item-dot">•</span><span>${materi ? materi.label : '-'}</span></div>
                <div class="jdw-resejuel-item-tentor">${tentor ? tentor.name : '-'}</div>
                ${alasan ? `<div class="jdw-resejuel-item-alasan"><span class="jdw-resejuel-item-alasan-label">Alasan tentor mengajukan jadwal ulang</span>${alasan}</div>` : ''}
            </div>`;
        };
        document.getElementById('jdw-resejuel-compare').innerHTML = `
            ${itemHtml(e.tanggal, e.slotId, e.materiId, e.tentorId, 'Jadwal Lama (diajukan kamu)', 'old')}
            <div class="jdw-resejuel-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="4" x2="12" y2="20"/><polyline points="6 14 12 20 18 14"/></svg></div>
            ${itemHtml(e.reschedule.tanggal, e.reschedule.slotId, e.reschedule.materiId, e.reschedule.tentorId || e.tentorId, 'Jadwal Baru (diajukan tentor)', 'new', e.reschedule.alasan)}`;
        document.getElementById('jdw-resejuel-overlay').classList.add('open');
        _jdwSyncPageScrollLock();
        const body = document.querySelector('#jdw-resejuel-overlay .jdw-modal-body');
        if (body) body.scrollTop = 0;
    },
    closeResejuelOverlay() {
        document.getElementById('jdw-resejuel-overlay').classList.remove('open');
        _jdwSyncPageScrollLock();
        this._resejuelTargetId = null;
    },
    // Tolak -> jadwal LAMA tidak berubah sama sekali, cuma lepas status
    // "resejuel" & buang pengajuan jadwal barunya, balik jadi "acc" seperti
    // semula. Setelah itu tawarkan dialog "Ajukan Jadwal Lain?" — kalau user
    // pilih "Ya, Ajukan", lanjut buka halaman Ajukan Jadwal mode Jadwal Ulang
    // buat entri yang sama TAPI dengan tentor DIKUNCI (lihat
    // confirmAjukanSetelahTolak & openAjukanOverlay(entryId, true)).
    //
    // PENTING (fix bug tampilan): overlay #jdw-resejuel-overlay SENGAJA
    // TIDAK ditutup di sini — dibiarkan tetap "open" di belakang popup
    // "Ajukan Jadwal Lain?" (jdw-tolak-ajukan-overlay, z-index lebih
    // tinggi, lihat css/modal.css). Kalau resejuel overlay ditutup duluan,
    // halaman di baliknya (list Jadwal) sempat kelihatan sekilas SEBELUM
    // popup pertanyaan muncul di atasnya — tampilan jadi "loncat" ke
    // halaman jadwal dulu baru muncul popup, padahal seharusnya diam.
    // Overlay resejuel baru benar-benar ditutup belakangan, dalam
    // confirmAjukanSetelahTolak() (lanjut ke form Ajukan Jadwal Ulang) atau
    // dismissTolakAjukan() (batal, balik ke halaman Jadwal) — keduanya
    // menutup resejuel overlay TEPAT saat popup ini juga ditutup, jadi
    // tidak ada jeda/flash tampilan sama sekali.
    _tolakAjukanEntryId: null,
    tolakResejuel() {
        if (!this._resejuelTargetId) return;
        // freeCancelEligible: true -> jadwal ini baru saja "diutak-atik" tentor
        // (diajukan jadwal ulang lalu DITOLAK user, balik ke jadwal lama).
        // Kalau abis ini user memilih membatalkan jadwal (bukan tentornya lagi
        // yang salah, tapi tetap gara-gara ulahnya tentor duluan), pembatalan
        // berikutnya TIDAK memotong kuota pembatalan (lihat
        // JadwalPage.submitBatalPengajuan & _jdwKuotaBatalTerpakai).
        JadwalStore.update(this._resejuelTargetId, { status: 'acc', reschedule: null, freeCancelEligible: true });
        this._tolakAjukanEntryId = this._resejuelTargetId;
        // Toast SENGAJA belum ditampilkan di sini — popup fullscreen "Ajukan
        // Jadwal Lain?" langsung terbuka di atasnya di baris bawah ini, jadi
        // toast kecil di pojok bawah gampang ketutup fokus popup & kelihatan
        // "nggak muncul". Toast baru ditembak di dismissTolakAjukan() /
        // confirmAjukanSetelahTolak() (begitu popup ini tertutup), supaya
        // pasti kelihatan tanpa tumpang tindih dengan popup.
        _jdwRenderWeek();
        _jdwRenderStatusList();
        const ov = document.getElementById('jdw-tolak-ajukan-overlay');
        if (ov) { ov.classList.add('open'); _jdwSyncPageScrollLock(); }
    },
    // User pilih "Ya, Ajukan" -> tutup popup pertanyaan SEKALIGUS overlay
    // resejuel di baliknya dalam tick yang sama (lihat catatan di atas),
    // langsung lanjut ke form Ajukan Jadwal Ulang (fullscreen juga) tentor
    // terkunci, jadi transisinya mulus dari satu halaman fullscreen ke
    // halaman fullscreen berikutnya tanpa sempat balik ke list Jadwal dulu.
    confirmAjukanSetelahTolak() {
        const ov = document.getElementById('jdw-tolak-ajukan-overlay');
        if (ov) ov.classList.remove('open');
        this.closeResejuelOverlay();
        const id = this._tolakAjukanEntryId;
        this._tolakAjukanEntryId = null;
        showToast('Jadwal ulang dari tentor ditolak, jadwal lama tetap berlaku');
        if (!id) return;
        this.openAjukanOverlay(id, true);
    },
    // User pilih "Tidak" (atau tap backdrop) di popup "Ajukan Jadwal Lain?"
    // -> tidak ada pengajuan baru, tutup popup DAN overlay resejuel-nya
    // sekaligus, balik bersih ke halaman Jadwal — toast baru muncul di sini.
    dismissTolakAjukan() {
        const ov = document.getElementById('jdw-tolak-ajukan-overlay');
        if (ov) ov.classList.remove('open');
        this.closeResejuelOverlay();
        this._tolakAjukanEntryId = null;
        showToast('Jadwal ulang dari tentor ditolak, jadwal lama tetap berlaku');
    },
    // Setuju -> jadwal ikut yang BARU (diajukan tentor). Bentrok dengan jadwal
    // lain di akun user SENGAJA tidak dicek di sini — itu urusan akun guru/
    // review nanti, di sisi user cukup langsung terapkan jadwal barunya.
    setujuResejuel() {
        if (!this._resejuelTargetId) return;
        const e = JadwalStore.get(this._resejuelTargetId);
        if (!e || !e.reschedule) return;
        // freeCancelEligible: true -> sama seperti di tolakResejuel(), jadwal
        // ini baru saja diajukan jadwal ulang oleh tentor (di sini malah
        // DISETUJUI, jadwal barunya langsung dipakai). Kalau abis ini user
        // memilih membatalkan jadwal (jam/tanggal baru dari tentor ternyata
        // tetap tidak cocok buat user), pembatalan berikutnya TIDAK memotong
        // kuota pembatalan — lihat JadwalPage.submitBatalPengajuan.
        JadwalStore.update(this._resejuelTargetId, { tanggal: e.reschedule.tanggal, slotId: e.reschedule.slotId, materiId: e.reschedule.materiId, status: 'acc', reschedule: null, freeCancelEligible: true });
        this.closeResejuelOverlay();
        showToast('✓ Jadwal ulang disetujui, jadwal baru sudah aktif');
        _jdwRenderWeek();
        _jdwRenderStatusList();
    },

    /* ── Halaman fullscreen "Pengajuan Pembatalan dari Tentor" (status
       "pengajuan_batal_tentor") — pola sama dengan #jdw-resejuel-overlay
       (header sticky + body scroll + tombol aksi di ujung bawah body),
       BEDANYA cuma satu resume (jadwal yang mau dibatalkan tentor, TANPA
       jadwal baru — tentor tidak menawarkan jadwal pengganti sama sekali,
       cuma minta izin batal), lengkap alasan tentornya. Dipicu dari tombol
       "Cek" di kartu status "pengajuan_batal_tentor" — lihat _entryActions. ── */
    _batalTentorTargetId: null,
    bukaBatalTentor(id) {
        const e = JadwalStore.get(id);
        if (!e) return;
        this._batalTentorTargetId = id;
        const slot = JDW_SLOTS.find(s => s.id === e.slotId);
        const materi = JDW_MATERI.find(m => m.id === e.materiId);
        const tentor = JDW_TENTOR.find(t => t.id === e.tentorId);
        document.getElementById('jdw-batal-tentor-compare').innerHTML = `
            <div class="jdw-resejuel-item">
                <div class="jdw-resejuel-item-label">Jadwal yang Diajukan Batal</div>
                <div class="jdw-resejuel-item-date">${_jdwFmtDateLong(e.tanggal)}</div>
                <div class="jdw-resejuel-item-row"><span>${slot ? slot.label : '-'}</span><span class="jdw-resejuel-item-dot">•</span><span>${materi ? materi.label : '-'}</span></div>
                <div class="jdw-resejuel-item-tentor">${tentor ? tentor.name : '-'}</div>
                ${e.alasanBatalTentor ? `<div class="jdw-resejuel-item-alasan"><span class="jdw-resejuel-item-alasan-label">Alasan tentor mengajukan pembatalan</span>${e.alasanBatalTentor}</div>` : ''}
            </div>`;
        document.getElementById('jdw-batal-tentor-overlay').classList.add('open');
        _jdwSyncPageScrollLock();
        const body = document.querySelector('#jdw-batal-tentor-overlay .jdw-modal-body');
        if (body) body.scrollTop = 0;
    },
    closeBatalTentorOverlay() {
        document.getElementById('jdw-batal-tentor-overlay').classList.remove('open');
        _jdwSyncPageScrollLock();
        this._batalTentorTargetId = null;
    },
    // Tolak -> jadwal TIDAK jadi dibatalkan, tapi tentor yang lama sudah
    // menyatakan tidak bisa, jadi status balik jadi "menunggu" (pending) &
    // diajukan ulang OTOMATIS ke tentor lain di jam & materi yang SAMA
    // persis (cuma tentornya yang beda) — tidak perlu user mengajukan dari
    // awal lagi. Kalau tidak ada tentor lain yang cocok (materi & jam-nya
    // sama-sama tersedia), tentorId dilepas (null) & statusnya tetap
    // "menunggu" tanpa tentor sampai ada yang cocok nanti.
    tolakBatalTentor() {
        if (!this._batalTentorTargetId) return;
        const id = this._batalTentorTargetId;
        const e = JadwalStore.get(id);
        if (!e) { this.closeBatalTentorOverlay(); return; }
        const pengganti = JDW_TENTOR.find(t => t.id !== e.tentorId && !_jdwTentorHasNoSlots(t) && _jdwTentorAllowsMateri(t.id, e.materiId) && _jdwTentorAllowsSlot(t.id, e.slotId));
        JadwalStore.update(id, { status: 'pending', tentorId: pengganti ? pengganti.id : null, alasanBatalTentor: null });
        this.closeBatalTentorOverlay();
        showToast(pengganti ? `Ditolak — jadwal otomatis diajukan ulang ke ${pengganti.name}` : 'Ditolak — jadwal menunggu tentor pengganti');
        _jdwRenderWeek();
        _jdwRenderStatusList();
    },
    // Setuju -> jadwal LANGSUNG dibatalkan (status "batal", batalOleh:
    // 'tentor') & kuota pembatalan TIDAK dipotong sama sekali
    // (pembatalanDihitung: false, "dikembalikan" — bukan salah/pilihan
    // user, jadi wajar tidak dianggap jatah user yang terpakai). Overlay
    // resume ini SENGAJA belum ditutup di sini (sama pola dengan
    // tolakResejuel — lihat catatan di situ), biar popup pilihan lanjutan
    // di bawah bisa langsung numpuk di atasnya tanpa "loncat" balik ke
    // halaman Jadwal dulu.
    setujuBatalTentor() {
        if (!this._batalTentorTargetId) return;
        const e = JadwalStore.get(this._batalTentorTargetId);
        if (!e) { this.closeBatalTentorOverlay(); return; }
        JadwalStore.update(this._batalTentorTargetId, { status: 'batal', batalOleh: 'tentor', alasanBatal: e.alasanBatalTentor || null, alasanBatalTentor: null, pembatalanDihitung: false });
        _jdwRenderWeek();
        _jdwRenderStatusList();
        const ov = document.getElementById('jdw-batal-tentor-setuju-overlay');
        if (ov) { ov.classList.add('open'); _jdwSyncPageScrollLock(); }
    },
    // Popup pilihan setelah Setuju: "Ganti ke Jadwal Lain" (langsung buka
    // form Ajukan Jadwal baru, pre-filled tanggal/jam/materi yang barusan
    // dibatalkan, tentor DIKOSONGKAN & tentor yang barusan batal DIKECUALIKAN
    // dari pilihan — lihat openAjukanGantiSetelahBatalTentor) atau "Selesai"
    // (tutup semua, balik ke halaman Jadwal, status sudah "batal").
    gantiJadwalSetelahBatalTentor() {
        const ov = document.getElementById('jdw-batal-tentor-setuju-overlay');
        if (ov) ov.classList.remove('open');
        const sourceId = this._batalTentorTargetId;
        this.closeBatalTentorOverlay();
        showToast('Jadwal dibatalkan, silakan ajukan jadwal pengganti');
        if (!sourceId) return;
        this.openAjukanGantiSetelahBatalTentor(sourceId);
    },
    selesaiBatalTentor() {
        const ov = document.getElementById('jdw-batal-tentor-setuju-overlay');
        if (ov) ov.classList.remove('open');
        this.closeBatalTentorOverlay();
        showToast('✓ Jadwal sudah dibatalkan');
    },
    // Buka form Ajukan Jadwal BARU (bukan edit entri lama — entri lama sudah
    // final "batal", dibiarkan begitu saja sebagai riwayat) dengan
    // tanggal/jam/materi ikut jadwal yang barusan dibatalkan, tentor
    // dikosongkan, DAN this._excludedTentorId dikunci ke tentor yang barusan
    // mengajukan batal (supaya tidak bisa dipilih lagi di jam yang sama —
    // lihat _renderTentorList) — biar user tidak perlu bolak-balik isi
    // tanggal/jam/materi dari awal, cukup pilih tentor pengganti saja.
    openAjukanGantiSetelahBatalTentor(sourceId) {
        const source = JadwalStore.get(sourceId);
        this.openAjukanOverlay(null);
        if (source) {
            this.selectedDate = source.tanggal;
            this.pickedSlot = source.slotId;
            this.pickedMateri = source.materiId;
            this.pickedTentor = null;
            this._excludedTentorId = source.tentorId;
        }
        this._updateAjukanDateLabel();
        this._renderTentorPicker();
        this._renderSlotGrid();
        this._renderMateriGrid();
        this._refreshSubmitBtn();
        _jdwSaveState();
    },

    _batalTargetId: null,
    batalEntry(id) {
        const e = JadwalStore.get(id);
        // Jadwal yang sudah DISETUJUI tidak langsung dibatalkan begitu saja —
        // harus lewat halaman pengajuan pembatalan (rekap + alasan + persetujuan).
        // TAPI dicek dulu kuota pembatalannya (maksimal 3x) — kecuali kalau
        // entri ini "gratis" (freeCancelEligible, baru saja kena pengajuan
        // jadwal ulang dari tentor), popup kuota habis TIDAK berlaku buat dia
        // sama sekali, langsung lanjut ke halaman pengajuan pembatalan seperti
        // biasa (lihat _jdwKuotaBatalSisa & JadwalPage.openBatalKuotaHabis).
        if (e && e.status === 'acc') {
            if (!e.freeCancelEligible && _jdwKuotaBatalSisa() <= 0) { this.openBatalKuotaHabis(); return; }
            this.openBatalPengajuan(id);
            return;
        }
        this._batalTargetId = id;
        // Entri "pending" bisa berarti dua hal: pengajuan jadwal baru yang
        // belum pernah disetujui, ATAU jadwal-ULANG dari entri yang tadinya
        // sudah "acc" (ditandai field alasanReschedule) yang lagi menunggu
        // persetujuan. Teksnya dibedain biar user ngerti konsekuensinya:
        // batalin jadwal-ulang yang masih pending = "tidak jadi jadwal ulang".
        const isRescheduling = !!(e && e.alasanReschedule);
        document.getElementById('jdw-batal-title').textContent = isRescheduling ? 'Batalkan Jadwal Ulang?' : 'Batalkan Jadwal?';
        document.getElementById('jdw-batal-msg').textContent = isRescheduling
            ? 'Yakin tidak jadi jadwal ulang? Pengajuan jadwal ulang yang masih menunggu persetujuan ini akan dibatalkan.'
            : 'Jadwal yang dibatalkan tidak bisa dikembalikan.';
        document.getElementById('jdw-batal-overlay').classList.add('open');
        _jdwSyncPageScrollLock();
    },
    confirmBatal() {
        document.getElementById('jdw-batal-overlay').classList.remove('open');
        _jdwSyncPageScrollLock();
        if (!this._batalTargetId) return;
        JadwalStore.remove(this._batalTargetId);
        this._batalTargetId = null;
        showToast('Jadwal dibatalkan');
        _jdwRenderWeek();
        _jdwRenderStatusList();
    },

    /* ── Popup: KUOTA PEMBATALAN SUDAH HABIS — muncul kalau tombol "Batal"
       ditekan pada jadwal berstatus "acc" (atau "Batalkan Jadwal" dari
       pilihan di status "butuh_persetujuan") padahal jatah membatalkan (3x)
       sudah terpakai semua, DAN entrinya bukan pembatalan gratis
       (freeCancelEligible). Cuma 1 tombol "Mengerti", sama pola kayak
       jdw-lewat-overlay/jdw-reschedule-harih-overlay. Halaman pengajuan
       pembatalan (jdw-sesi-overlay) TIDAK dibuka sama sekali kalau ini
       muncul — lihat JadwalPage.batalEntry & batalPilihanJadwal. ── */
    openBatalKuotaHabis() {
        document.getElementById('jdw-batal-kuota-habis-overlay').classList.add('open');
        _jdwSyncPageScrollLock();
    },
    closeBatalKuotaHabis() {
        document.getElementById('jdw-batal-kuota-habis-overlay').classList.remove('open');
        _jdwSyncPageScrollLock();
    },

    /* ── Halaman PENGAJUAN PEMBATALAN (khusus jadwal berstatus "acc") — pakai
       overlay generik jdw-sesi-overlay yang sama dengan Masuk/Feedback, isinya
       diganti: rekap (tanggal/jam/materi) + alasan + centang persetujuan. ── */
    openBatalPengajuan(id) {
        const e = JadwalStore.get(id);
        if (!e) return;
        this._sesiEntryId = id;
        const slot = JDW_SLOTS.find(s => s.id === e.slotId);
        const materi = JDW_MATERI.find(m => m.id === e.materiId);
        const tentor = JDW_TENTOR.find(t => t.id === e.tentorId);
        // Catatan kuota pembatalan — beda isi tergantung entrinya "gratis"
        // (freeCancelEligible, abis kena pengajuan jadwal ulang dari tentor)
        // atau pembatalan normal biasa yang ikut motong kuota 3x.
        const kuotaNoteHtml = e.freeCancelEligible
            ? `<div class="jdw-form-section">
                 <div class="jdw-sesi-hint" style="color:var(--accent);font-weight:600">Pembatalan ini <u>tidak akan mengurangi</u> kuota pembatalan kamu, karena jadwal ini baru saja mengalami pengajuan jadwal ulang dari tentor.</div>
               </div>`
            : `<div class="jdw-form-section">
                 <div class="jdw-sesi-hint">Sisa jatah membatalkan jadwal kamu: <strong>${_jdwKuotaBatalSisa()}/${JDW_KUOTA_BATAL_TOTAL}</strong>. Pembatalan ini akan memotong 1 jatah.</div>
               </div>`;
        document.getElementById('jdw-sesi-title').textContent = 'Ajukan Pembatalan';
        document.getElementById('jdw-sesi-body').innerHTML = `
            <div class="jdw-form-section">
                <div class="jdw-sesi-item-label" style="margin-bottom:10px">Rekap Jadwal</div>
                <div class="jdw-sesi-item" style="margin-bottom:0">
                    <div style="display:flex;flex-direction:column;gap:8px">
                        <div style="display:flex;justify-content:space-between;gap:10px;font-size:13px"><span style="color:var(--text-sub)">Tanggal</span><span style="font-weight:700;color:var(--blue);text-align:right">${_jdwFmtDateLong(e.tanggal)}</span></div>
                        <div style="display:flex;justify-content:space-between;gap:10px;font-size:13px"><span style="color:var(--text-sub)">Jam</span><span style="font-weight:700;color:var(--blue)">${slot ? slot.label : '-'}</span></div>
                        <div style="display:flex;justify-content:space-between;gap:10px;font-size:13px"><span style="color:var(--text-sub)">Tentor</span><span style="font-weight:700;color:var(--blue)">${tentor ? tentor.name : '-'}</span></div>
                        <div style="display:flex;justify-content:space-between;gap:10px;font-size:13px"><span style="color:var(--text-sub)">Materi</span><span style="font-weight:700;color:var(--blue)">${materi ? materi.label : '-'}</span></div>
                    </div>
                </div>
            </div>
            ${kuotaNoteHtml}
            <div class="jdw-form-section">
                <div class="jdw-form-label">Alasan Pembatalan</div>
                <textarea class="jdw-textarea" id="jdw-batalulang-alasan" placeholder="Tulis alasan kamu mengajukan pembatalan..." oninput="JadwalPage._refreshBatalUlangBtn()"></textarea>
            </div>
            <div class="jdw-form-section" style="margin-bottom:0">
                <label style="display:flex;align-items:flex-start;gap:.5rem;font-size:12.5px;color:var(--text-sub);font-weight:600;cursor:pointer;line-height:1.5">
                    <input type="checkbox" id="jdw-batalulang-setuju" style="accent-color:var(--accent);margin-top:2px;flex-shrink:0;width:16px;height:16px" onchange="JadwalPage._refreshBatalUlangBtn()">
                    Saya menyetujui dan yakin ingin membatalkan jadwal mentoring ini.
                </label>
            </div>`;
        // Tombol AJUKAN PEMBATALAN ikut ditaruh DI DALAM area scroll (bukan
        // footer sticky lagi) — sama kayak tombol AJUKAN di halaman Ajukan
        // Jadwal, biar ikut kescroll dan berhenti di atas dock utama.
        document.getElementById('jdw-sesi-body').insertAdjacentHTML('beforeend', `
            <div class="jdw-form-section jdw-ajukan-submit-section" style="margin-bottom:0">
                <button class="jdw-btn jdw-btn-danger jdw-btn-block" id="jdw-batalulang-submit" onclick="JadwalPage.submitBatalPengajuan()" disabled>AJUKAN PEMBATALAN</button>
            </div>`);
        const sesiFooter = document.getElementById('jdw-sesi-footer');
        if (sesiFooter) { sesiFooter.innerHTML = ''; sesiFooter.style.display = 'none'; }
        document.getElementById('jdw-sesi-body').style.paddingBottom = 'calc(200px + env(safe-area-inset-bottom))';
        document.getElementById('jdw-sesi-overlay').classList.add('open');
        _jdwSyncPageScrollLock();
    },
    _refreshBatalUlangBtn() {
        const btn = document.getElementById('jdw-batalulang-submit');
        if (!btn) return;
        const alasanEl = document.getElementById('jdw-batalulang-alasan');
        const setujuEl = document.getElementById('jdw-batalulang-setuju');
        btn.disabled = !(alasanEl && alasanEl.value.trim() && setujuEl && setujuEl.checked);
    },
    submitBatalPengajuan() {
        if (!this._sesiEntryId) return;
        const alasanEl = document.getElementById('jdw-batalulang-alasan');
        const setujuEl = document.getElementById('jdw-batalulang-setuju');
        const alasan = alasanEl ? alasanEl.value.trim() : '';
        if (!alasan || !setujuEl || !setujuEl.checked) return;
        const e = JadwalStore.get(this._sesiEntryId);
        // isFreeCancel: entri ini baru saja kena pengajuan jadwal ulang dari
        // tentor (freeCancelEligible) -> pembatalanDihitung disimpan FALSE
        // biar _jdwKuotaBatalTerpakai() TIDAK ikut menghitungnya (gratis,
        // tidak memotong jatah 3x). Kalau bukan, pembatalanDihitung TRUE ->
        // ikut motong kuota seperti biasa.
        const isFreeCancel = !!(e && e.freeCancelEligible);
        JadwalStore.update(this._sesiEntryId, { status: 'pengajuan_pembatalan', alasanBatal: alasan, pembatalanDihitung: !isFreeCancel });
        this.closeSesiOverlay();
        showToast(isFreeCancel
            ? '✓ Pengajuan pembatalan dikirim (tidak mengurangi kuota pembatalan)'
            : '✓ Pengajuan pembatalan dikirim, menunggu persetujuan');
        _jdwRenderWeek();
        _jdwRenderStatusList();
    },
    /* ── "Tarik Pembatalan" — batal-membatalkan, jadwal balik jadi acc lagi.
       Dikonfirmasi dulu lewat dialog kecil (jdw-tarikbatal-overlay) sebelum
       benar-benar dieksekusi, sama polanya kayak konfirmasi Batal biasa. ── */
    _tarikBatalTargetId: null,
    tarikBatal(id) {
        this._tarikBatalTargetId = id;
        document.getElementById('jdw-tarikbatal-overlay').classList.add('open');
        _jdwSyncPageScrollLock();
    },
    confirmTarikBatal() {
        document.getElementById('jdw-tarikbatal-overlay').classList.remove('open');
        _jdwSyncPageScrollLock();
        if (!this._tarikBatalTargetId) return;
        // pembatalanDihitung direset ke false juga — pengajuan pembatalannya
        // ditarik (dianggap tidak pernah kejadian), jadi jatah kuota
        // pembatalan yang sempat "kepotong" kembali utuh (status sudah balik
        // "acc" jadi otomatis lolos dari filter _jdwKuotaBatalTerpakai(), ini
        // cuma buat jaga-jaga kalau field ini kebaca ulang lain kali).
        JadwalStore.update(this._tarikBatalTargetId, { status: 'acc', alasanBatal: null, pembatalanDihitung: false });
        this._tarikBatalTargetId = null;
        showToast('Pembatalan ditarik, jadwal kembali disetujui');
        _jdwRenderWeek();
        _jdwRenderStatusList();
    },

    /* ── Halaman SESI: "Masuk" (jam mulai sudah tiba) — tampil Link Gmeet + Token,
       masing2 dengan tombol salin (svg copy) ── */
    _sesiEntryId: null,
    _feedbackRating: { paham: null, kualitas: null },
    masukEntry(id) {
        const e = JadwalStore.get(id);
        if (!e) return;
        this._sesiEntryId = id;
        const link = _jdwEntryGmeetLink(e);
        const token = _jdwEntryToken(e);
        document.getElementById('jdw-sesi-title').textContent = 'Sesi Berlangsung';
        document.getElementById('jdw-sesi-body').innerHTML = `
            <div class="jdw-sesi-item">
                <div class="jdw-sesi-item-label">Link Google Meet</div>
                <div class="jdw-sesi-item-row">
                    <div class="jdw-sesi-item-value">${link}</div>
                    <button type="button" class="jdw-sesi-copy-btn" onclick="JadwalPage.copySesiValue('${link}','Link Gmeet')" aria-label="Salin link Gmeet">${_jdwCopyIconHtml()}</button>
                </div>
            </div>
            <div class="jdw-sesi-item">
                <div class="jdw-sesi-item-label">Token Sesi</div>
                <div class="jdw-sesi-item-row">
                    <div class="jdw-sesi-item-value mono">${token}</div>
                    <button type="button" class="jdw-sesi-copy-btn" onclick="JadwalPage.copySesiValue('${token}','Token')" aria-label="Salin token">${_jdwCopyIconHtml()}</button>
                </div>
            </div>
            <div class="jdw-sesi-hint">Salin link Gmeet & token di atas, lalu gunakan untuk masuk ke sesi mentoring sesuai jadwal.</div>
            <div class="jdw-form-section jdw-ajukan-submit-section" style="margin-bottom:0">
                <a class="jdw-btn jdw-btn-primary jdw-btn-block" style="text-decoration:none;justify-content:center;text-align:center" href="${link}" target="_blank" rel="noopener">BUKA GOOGLE MEET</a>
            </div>`;
        const sesiFooter1 = document.getElementById('jdw-sesi-footer');
        if (sesiFooter1) { sesiFooter1.innerHTML = ''; sesiFooter1.style.display = 'none'; }
        document.getElementById('jdw-sesi-body').style.paddingBottom = 'calc(200px + env(safe-area-inset-bottom))';
        document.getElementById('jdw-sesi-overlay').classList.add('open');
        _jdwSyncPageScrollLock();
    },
    copySesiValue(text, label) {
        if (!navigator.clipboard || !navigator.clipboard.writeText) return;
        navigator.clipboard.writeText(text).then(() => showToast(`${label} disalin!`));
    },

    /* ── Halaman SESI: "Feedback" (jam sesi sudah lewat) — form pertanyaan + Simpan ── */
    feedbackEntry(id) {
        const e = JadwalStore.get(id);
        if (!e) return;
        this._sesiEntryId = id;
        this._feedbackRating = { paham: null, kualitas: null };
        document.getElementById('jdw-sesi-title').textContent = 'Feedback Sesi';
        document.getElementById('jdw-sesi-body').innerHTML = `
            <div class="jdw-form-section">
                <div class="jdw-form-label">Seberapa paham kamu dengan materi sesi ini?</div>
                <div class="jdw-rating-grid" id="jdw-fb-paham"></div>
            </div>
            <div class="jdw-form-section">
                <div class="jdw-form-label">Bagaimana kualitas mentoring hari ini?</div>
                <div class="jdw-rating-grid" id="jdw-fb-kualitas"></div>
            </div>
            <div class="jdw-form-section">
                <div class="jdw-form-label">Catatan / masukan (opsional)</div>
                <textarea class="jdw-textarea" id="jdw-fb-catatan" placeholder="Tulis masukan kamu di sini..."></textarea>
            </div>
            <div class="jdw-form-section jdw-ajukan-submit-section" style="margin-bottom:0">
                <button class="jdw-btn jdw-btn-primary jdw-btn-block" id="jdw-fb-submit" onclick="JadwalPage.simpanFeedback()" disabled>SIMPAN</button>
            </div>`;
        this._renderFbRating('paham');
        this._renderFbRating('kualitas');
        const sesiFooter2 = document.getElementById('jdw-sesi-footer');
        if (sesiFooter2) { sesiFooter2.innerHTML = ''; sesiFooter2.style.display = 'none'; }
        document.getElementById('jdw-sesi-body').style.paddingBottom = 'calc(200px + env(safe-area-inset-bottom))';
        document.getElementById('jdw-sesi-overlay').classList.add('open');
        _jdwSyncPageScrollLock();
    },
    _renderFbRating(field) {
        const wrap = document.getElementById(field === 'paham' ? 'jdw-fb-paham' : 'jdw-fb-kualitas');
        if (!wrap) return;
        wrap.innerHTML = [1, 2, 3, 4, 5].map(n => {
            const selected = this._feedbackRating[field] === n;
            return `<div class="jdw-materi-chip${selected ? ' selected' : ''}" onclick="JadwalPage.pickFbRating('${field}',${n})">${n}</div>`;
        }).join('');
    },
    pickFbRating(field, n) {
        this._feedbackRating[field] = n;
        this._renderFbRating(field);
        const btn = document.getElementById('jdw-fb-submit');
        if (btn) btn.disabled = !(this._feedbackRating.paham && this._feedbackRating.kualitas);
    },
    simpanFeedback() {
        if (!this._sesiEntryId || !this._feedbackRating.paham || !this._feedbackRating.kualitas) return;
        const catatanEl = document.getElementById('jdw-fb-catatan');
        JadwalStore.update(this._sesiEntryId, {
            feedbackDone: true,
            feedback: { paham: this._feedbackRating.paham, kualitas: this._feedbackRating.kualitas, catatan: catatanEl ? catatanEl.value : '', filledAt: Date.now() },
            status: 'selesai',
        });
        this.closeSesiOverlay();
        showToast('✓ Feedback tersimpan');
        _jdwRenderWeek();
        _jdwRenderStatusList();
    },
    closeSesiOverlay() {
        document.getElementById('jdw-sesi-overlay').classList.remove('open');
        _jdwSyncPageScrollLock();
        this._sesiEntryId = null;
    },

    /* ── Dev helper: hapus data dummy tersimpan & bikin ulang seed lengkap
       (semua status: pending, acc, berlangsung-masuk, berlangsung-feedback,
       ditolak, pengajuan_pembatalan, selesai, resejuel, batal-tentor,
       batal-user, batal-ditimpa, pengajuan_batal_tentor) — dipakai buat cek
       seluruh tampilan tanpa harus ajukan manual satu-satu. Aman dipanggil
       kapan saja, langsung reload halaman. ── */
    resetDummy() {
        try { localStorage.removeItem('cbn_jadwal_pengajuan_dummy_v1'); } catch (e) {}
        showToast('Data dummy direset — semua status jadwal dimuat ulang');
        setTimeout(() => location.reload(), 400);
    },
};