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
const JDW_STATUS_LABEL = { pending: 'Menunggu', acc: 'Disetujui', ditolak: 'Ditolak', berlangsung: 'Berlangsung', selesai: 'Selesai', pengajuan_pembatalan: 'Pengajuan Pembatalan', resejuel: 'Jadwal Ulang dari Tentor', batal: 'Dibatalkan', butuh_persetujuan: 'Butuh Persetujuan' };
const JDW_DAY_NAMES = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const JDW_DAY_SHORT = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const JDW_MONTH_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

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
            { id: 'seed_batal', tanggal: _todayIso(1), slotId: 'slot4', materiId: 'toefl_listening', tentorId: 'chika', status: 'pengajuan_pembatalan', alasanBatal: 'Ada jadwal ujian sekolah yang bentrok', createdAt: Date.now() - 60000000 },
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
            // tombol aksi (kayak "selesai"), TAPI beda dari entri lampau biasa:
            // sengaja TETAP nongol di "Minggu Ini" (home) pada tanggal aslinya
            // walau tanggalnya sudah lewat, TIDAK otomatis pindah ke Riwayat.
            { id: 'seed_batal_tentor', tanggal: _todayIso(-1), slotId: 'slot3', materiId: 'tkp', tentorId: 'albert', status: 'batal', batalOleh: 'tentor', alasanBatal: 'Tentor berhalangan hadir', createdAt: Date.now() - 20000000 },
            // batal, DIBATALKAN OLEH USER (field batalOleh:'user') -> kebalikannya:
            // walau tanggalnya masih di depan (belum lewat), langsung kepindah ke
            // Riwayat & sama sekali tidak nongol lagi di "Minggu Ini".
            { id: 'seed_batal_user', tanggal: _todayIso(3), slotId: 'slot6', materiId: 'twk', tentorId: 'angga', status: 'batal', batalOleh: 'user', alasanBatal: 'Berhalangan hadir', createdAt: Date.now() - 10000000 },
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
const JDW_FULLSCREEN_OVERLAY_IDS = ['jdw-ajukan-overlay', 'jdw-tentor-overlay', 'jdw-sesi-overlay', 'jdw-resejuel-overlay'];
// jdw-batal-overlay & jdw-lewat-overlay ikut dikunci juga (backdrop-nya blur
// transparan, bukan solid, jadi tidak menghasilkan tampilan 2 scrollbar
// bertumpuk yang sama parahnya kayak overlay fullscreen di atas) TAPI
// #page-jadwal di baliknya tetap ikut dikunci scroll-nya biar konsisten -
// tidak masuk akal halaman di belakang masih bisa discroll pas ada dialog
// konfirmasi kecil nongol di tengah layar.
const JDW_SCROLL_LOCK_OVERLAY_IDS = [...JDW_FULLSCREEN_OVERLAY_IDS, 'jdw-batal-overlay', 'jdw-tarikbatal-overlay', 'jdw-lewat-overlay', 'jdw-tolak-ajukan-overlay', 'jdw-keluar-ajukan-overlay', 'jdw-batal-pilihan-overlay', 'jdw-reschedule-harih-overlay'];
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
}
function _jdwSlotIsOver(e) {
    const end = _jdwSlotEndDate(e.tanggal, e.slotId);
    return !!(end && end <= new Date());
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
    if (st.pickedTentor) JadwalPage.pickTentor(st.pickedTentor);
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
    _jdwRenderNextWeekCard();
    _jdwRestoreViewState();
    _jdwRenderStatusList();
    _jdwRestoreState();

    // Cek berkala selama tab Jadwal kebuka, supaya pengajuan yang jam-mulai/
    // jam-selesai slotnya baru lewat SAAT halaman ini sedang dibuka (bukan
    // cuma pas reload/buka ulang) tetap otomatis pindah status (ditolak /
    // berlangsung / selesai) tanpa perlu refresh manual.
    if (_jdwAutoExpireTimer) clearInterval(_jdwAutoExpireTimer);
    _jdwAutoExpireTimer = setInterval(() => {
        const expired = _jdwAutoExpirePending();
        const advanced = _jdwAutoAdvanceStatus();
        // Kalender "Ajukan minggu depan" dicek tiap tick juga (bukan cuma pas
        // ada expired/advanced) supaya pas jam 00:00 Minggu->Senin lewat SAAT
        // tab ini kebuka, kalendernya otomatis hilang tanpa perlu refresh.
        _jdwRenderNextWeekCard();
        if (expired || advanced) {
            _jdwRenderWeek();
            _jdwRenderStatusList();
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
            <td><span class="jdw-status-badge ${e.status}">${JDW_STATUS_LABEL[e.status] || e.status}</span></td>
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
// inline lama supaya bisa nangani status "batal" secara khusus:
//   - dibatalkan TENTOR (batalOleh:'tentor') -> cuma boleh nongol di tab
//     "Minggu Ini" (home), TIDAK PERNAH di tab "Riwayat", terlepas tanggalnya
//     sudah lewat atau belum.
//   - dibatalkan USER (batalOleh:'user') -> kebalikannya, cuma boleh nongol
//     di tab "Riwayat", TIDAK PERNAH di "Minggu Ini", terlepas tanggalnya
//     sudah lewat atau belum.
// Status "resejuel" (jadwal ulang dari tentor) ikut tampil normal di sini,
// sama seperti status lain (pending/acc/dst) — kartunya nongol di tanggal
// jadwal LAMA-nya (field tanggal/slotId/materiId entri ini sendiri, BUKAN
// tanggal jadwal baru usulan tentor yang tersimpan di field `reschedule`),
// cuma aksinya beda: tombol "Cek" yang buka halaman bandingkan jadwal lama
// vs baru, lihat JadwalPage.bukaResejuel().
function _jdwStatusListEntriesForDate(iso) {
    const isRiwayat = JadwalPage.currentView === 'riwayat';
    return JadwalStore.byDate(iso)
        .filter(e => {
            if (e.status === 'pending' || e.status === 'acc' || e.status === 'berlangsung' || e.status === 'selesai' || e.status === 'pengajuan_pembatalan' || e.status === 'resejuel' || e.status === 'butuh_persetujuan') return true;
            if (e.status === 'batal') return isRiwayat ? e.batalOleh === 'user' : e.batalOleh === 'tentor';
            return false;
        })
        .sort((a, b) => _jdwSlotIndex(a.slotId) - _jdwSlotIndex(b.slotId));
}

function _jdwRenderStatusList() {
    const wrap = document.getElementById('jdw-status-list');
    if (!wrap) return;
    const todayIso = _jdwToIso(new Date());
    let weekDates;
    if (JadwalPage.currentView === 'riwayat') {
        const minOffset = _jdwMinRiwayatOffset();
        if (JadwalPage.riwayatWeekOffset < minOffset) JadwalPage.riwayatWeekOffset = minOffset;
        if (JadwalPage.riwayatWeekOffset === 0) {
            // Offset 0 = "minggu ini, bagian yg sudah lewat" (belum genap 1 minggu).
            weekDates = _jdwWeekDates(new Date());
        } else {
            const ref = new Date();
            ref.setDate(ref.getDate() - (JadwalPage.riwayatWeekOffset * 7));
            weekDates = _jdwWeekDates(ref);
        }
        const cap = document.getElementById('jdw-riwayat-caption');
        if (cap) cap.textContent = JadwalPage.riwayatWeekOffset === 0 ? `${_jdwFmtWeekRange(weekDates)} · berjalan` : _jdwFmtWeekRange(weekDates);
        const nextBtn = document.getElementById('jdw-riwayat-next-btn');
        if (nextBtn) nextBtn.disabled = JadwalPage.riwayatWeekOffset <= minOffset;
    } else {
        weekDates = _jdwWeekDates(new Date());
    }
    wrap.innerHTML = weekDates.map(d => {
        const iso = _jdwToIso(d);
        const entries = _jdwStatusListEntriesForDate(iso);
        // "Minggu Ini" hanya nampilin hari ini & seterusnya — tanggal yang sudah
        // lewat dihilangkan dari sini, pindah ke Riwayat (offset 0). KECUALI ada
        // entri "batal" dibatalkan TENTOR di tanggal itu — sengaja tetap nongol
        // walau tanggalnya sudah lewat (lihat _jdwStatusListEntriesForDate).
        if (JadwalPage.currentView === 'minggu' && iso < todayIso && !entries.some(e => e.status === 'batal')) return '';
        // Riwayat cuma boleh isi hari yang SUDAH LEWAT — hari ini (masih berjalan)
        // dan hari yang belum sampai tidak dimasukkan sama sekali (bukan cuma
        // ditampilkan kosong, tapi memang tidak dirender ke listnya). KECUALI ada
        // entri "batal" dibatalkan USER di tanggal itu — sengaja langsung nongol
        // di Riwayat walau tanggalnya belum lewat.
        if (JadwalPage.currentView === 'riwayat' && iso >= todayIso && !entries.some(e => e.status === 'batal')) return '';
        return _jdwDayGroupHtml(d, entries, iso === todayIso);
    }).filter(Boolean).join('');
    // Kartu swipe-list yang punya aksi (Edit/Jadwal Ulang/Batal) perlu di-bind gesture-nya.
    wrap.querySelectorAll('.swipe-list').forEach(el => { if (window.SwipeCards) SwipeCards.bindSwipeList(el); });
}

/* ── Kalender ke-2: "Ajukan minggu depan" — cuma nongol kalau HARI INI hari
   Minggu, isinya tanggal Senin-Minggu minggu depan, tiap tanggal bisa di-tap
   langsung buka form Ajukan (persis kayak tap tanggal di kalender utama).
   Begitu hari Minggu ini lewat (sudah masuk Senin), kalender ini otomatis
   balik hilang -> tinggal 1 kalender (yang di atas / "Minggu Ini"). ── */
function _jdwRenderNextWeekCard() {
    const card = document.getElementById('jdw-nextweek-card');
    const strip = document.getElementById('jdw-nextweek-strip');
    const hint = document.getElementById('jdw-nextweek-hint');
    if (!card || !strip) return;
    const isSunday = new Date().getDay() === 0;
    card.style.display = isSunday ? '' : 'none';
    if (hint) hint.style.display = isSunday ? '' : 'none';
    if (!isSunday) return;
    const nextWeekRef = new Date();
    nextWeekRef.setDate(nextWeekRef.getDate() + 7);
    const weekDates = _jdwWeekDates(nextWeekRef);
    strip.innerHTML = weekDates.map(d => {
        const iso = _jdwToIso(d);
        const hasEntries = JadwalStore.byDate(iso).length > 0;
        return `<div class="jdw-day${hasEntries ? ' has-entries' : ''}" onclick="JadwalPage.openDay('${iso}')">
            <div class="jdw-day-name">${JDW_DAY_SHORT[d.getDay()]}</div>
            <div class="jdw-day-num-wrap"><span>${d.getDate()}</span></div>
        </div>`;
    }).join('');
}

function _jdwRenderWeek() {
    const strip = document.getElementById('jdw-week-strip');
    const caption = document.getElementById('jdw-week-caption');
    if (!strip) return;
    const weekDates = _jdwWeekDates(new Date());
    const todayIso = _jdwToIso(new Date());
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
    currentView: 'minggu',   // 'minggu' | 'riwayat' — toggle di atas list status
    riwayatWeekOffset: 1,    // dipakai saat currentView='riwayat': 0 = minggu ini (belum genap), 1 = minggu lalu, 2 = 2 minggu lalu, dst

    /* ── Toggle Minggu Ini / Riwayat (di bawah kalender) ── */
    setView(view) {
        this.currentView = view === 'riwayat' ? 'riwayat' : 'minggu';
        document.querySelectorAll('#jdw-view-toggle .jdw-view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === this.currentView));
        const nav = document.getElementById('jdw-riwayat-nav');
        if (nav) nav.style.display = this.currentView === 'riwayat' ? 'flex' : 'none';
        _jdwRenderStatusList();
        _jdwSaveViewState();
    },
    riwayatNav(dir) {
        const minOffset = _jdwMinRiwayatOffset();
        if (dir === 'older') this.riwayatWeekOffset = Math.min(260, this.riwayatWeekOffset + 1);
        else if (dir === 'newer') this.riwayatWeekOffset = Math.max(minOffset, this.riwayatWeekOffset - 1);
        _jdwRenderStatusList();
        _jdwSaveViewState();
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
            sideHtml: `<span class="jdw-status-badge ${e.status}">${JDW_STATUS_LABEL[e.status] || e.status}</span>`,
            kode: e.id,
            leftActions: left, rightActions: right,
        });
    },

    /* ── Halaman ajukan jadwal (pilih jam + materi) ── */
    _isReschedule: false,   // true kalau overlay ini lagi mode "Jadwal Ulang" (entri berstatus acc)
    rescheduleDate: null,   // tanggal BARU yang dipilih lewat kalender mini di overlay (mode Jadwal Ulang saja)
    rescheduleWeekRef: null,// tanggal acuan minggu yang lagi ditampilkan di kalender mini itu
    openAjukanOverlay(entryId, lockTentor) {
        _jdwAutoExpirePending(); // bebasin slot yang barusan auto-tertolak sebelum dihitung "terisi"
        _jdwAutoAdvanceStatus();
        this.editingId = entryId || null;
        this._tentorLocked = !!lockTentor;
        const existing = entryId ? JadwalStore.get(entryId) : null;
        // Selalu selaraskan selectedDate dengan tanggal entri yang diedit (kalau ada) —
        // ini yang jadi acuan tanggal buat cek jam terisi/lewat, bukan cuma tanggal
        // yang kebetulan lagi kesorot di kalender minggu ini.
        if (existing) this.selectedDate = existing.tanggal;
        this.pickedSlot = existing ? existing.slotId : null;
        this.pickedMateri = existing ? existing.materiId : null;
        this.pickedTentor = existing ? (existing.tentorId || null) : null;
        // "butuh_persetujuan" ikut dianggap mode Jadwal Ulang (bukan cuma
        // "acc") — ini kejadian pas user balik lagi lewat tombol "Cek" buat
        // NERUSIN pengajuan jadwal-ulang yang sempat ditinggal keluar
        // (lihat JadwalPage.cekButuhPersetujuan & confirmKeluarAjukan).
        const isReschedule = !!(existing && (existing.status === 'acc' || existing.status === 'butuh_persetujuan'));
        this._isReschedule = isReschedule;
        this.rescheduleDate = isReschedule ? existing.tanggal : null;
        this.rescheduleWeekRef = isReschedule ? new Date(existing.tanggal + 'T00:00:00') : null;
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
            const sub = noSlots ? 'Tidak ada jadwal tersedia' : _jdwTentorMateriLabel(t);
            return `<div class="jdw-tentor-item${selected ? ' selected' : ''}${noSlots ? ' disabled' : ''}" onclick="${noSlots ? '' : `JadwalPage.pickTentor('${t.id}')`}">
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
       ulang materi yang memang diajar tentor ini. ── */
    pickTentor(id) {
        const t = JDW_TENTOR.find(x => x.id === id);
        if (t && _jdwTentorHasNoSlots(t)) return; // jaga-jaga, harusnya sudah tidak punya onclick
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
    /* ── Kalender mini di dalam overlay Jadwal Ulang — pilih tanggal baru. ── */
    _renderRescheduleCalendar() {
        const strip = document.getElementById('jdw-reschedule-strip');
        const caption = document.getElementById('jdw-reschedule-caption');
        if (!strip) return;
        const weekDates = _jdwWeekDates(this.rescheduleWeekRef || new Date());
        const todayIso = _jdwToIso(new Date());
        if (caption) caption.textContent = _jdwFmtWeekRange(weekDates);
        strip.innerHTML = weekDates.map(d => {
            const iso = _jdwToIso(d);
            const isSelected = iso === this.rescheduleDate;
            const isPast = iso < todayIso;
            const hasEntries = JadwalStore.byDate(iso).filter(e => e.id !== this.editingId).length > 0;
            const onclick = isPast ? `JadwalPage.openPastDayInfo()` : `JadwalPage.pickRescheduleDate('${iso}')`;
            return `<div class="jdw-day${isSelected ? ' is-today' : ''}${hasEntries ? ' has-entries' : ''}${isPast ? ' is-past' : ''}" onclick="${onclick}">
                <div class="jdw-day-name">${JDW_DAY_SHORT[d.getDay()]}</div>
                <div class="jdw-day-num-wrap"><span>${d.getDate()}</span></div>
            </div>`;
        }).join('');
    },
    rescheduleWeekNav(dir) {
        const ref = new Date(this.rescheduleWeekRef || new Date());
        ref.setDate(ref.getDate() + (dir === 'older' ? -7 : 7));
        this.rescheduleWeekRef = ref;
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
                    JadwalStore.update(this.editingId, {
                        slotId: this.pickedSlot, materiId: this.pickedMateri, tentorId: this.pickedTentor,
                        status: 'pending', tanggal: this.rescheduleDate, alasanReschedule: alasan,
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
        _jdwRenderNextWeekCard();
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
        JadwalStore.update(this._resejuelTargetId, { status: 'acc', reschedule: null });
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
        JadwalStore.update(this._resejuelTargetId, { tanggal: e.reschedule.tanggal, slotId: e.reschedule.slotId, materiId: e.reschedule.materiId, status: 'acc', reschedule: null });
        this.closeResejuelOverlay();
        showToast('✓ Jadwal ulang disetujui, jadwal baru sudah aktif');
        _jdwRenderWeek();
        _jdwRenderStatusList();
    },

    _batalTargetId: null,
    batalEntry(id) {
        const e = JadwalStore.get(id);
        // Jadwal yang sudah DISETUJUI tidak langsung dibatalkan begitu saja —
        // harus lewat halaman pengajuan pembatalan (rekap + alasan + persetujuan).
        if (e && e.status === 'acc') { this.openBatalPengajuan(id); return; }
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
        _jdwRenderNextWeekCard();
        _jdwRenderStatusList();
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
        JadwalStore.update(this._sesiEntryId, { status: 'pengajuan_pembatalan', alasanBatal: alasan });
        this.closeSesiOverlay();
        showToast('✓ Pengajuan pembatalan dikirim, menunggu persetujuan');
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
        JadwalStore.update(this._tarikBatalTargetId, { status: 'acc', alasanBatal: null });
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
       batal-user) — dipakai buat cek seluruh tampilan tanpa harus ajukan
       manual satu-satu. Aman dipanggil kapan saja, langsung reload halaman. ── */
    resetDummy() {
        try { localStorage.removeItem('cbn_jadwal_pengajuan_dummy_v1'); } catch (e) {}
        showToast('Data dummy direset — semua status jadwal dimuat ulang');
        setTimeout(() => location.reload(), 400);
    },
};