// review/bahas/bahas.js
// Dock BAHAS — kartu ringkas sesi mentoring yang AKAN DIMULAI dalam waktu
// dekat, dipakai guru buat lompat cepat ke link Gmeet + Mode Review siswa
// yang jadwalnya udah deket, tanpa harus buka tab Jadwal atau nyari manual
// di tab Riwayat. Bergantung pada JadwalStore/JDW_SLOTS/JDW_MATERI/
// JDW_STATUS_LABEL/_jdw* (dari review/jadwal/jadwal.js) dan openReviewUjian
// (dari review/riwayat/riwayat.js) — lihat REVIEW_PAGE_MODULES.bahas di
// review/index_review.html.
//
// CATATAN STATUS UJIAN (belum mulai / sedang ujian / sudah ada laporan):
// JadwalStore MASIH dummy (localStorage, lihat catatan panjang di
// review/jadwal/jadwal.js) dan entrinya BELUM punya userKode/modulKode ASLI
// yang bisa dicocokkan ke tabel tokens/laporan sungguhan (cuma materiId
// topik + nama siswa bebas ketik). Jadi status ujian di sini SENGAJA dummy
// juga (dihitung deterministik dari id entri, lihat _bahasEntryExamStatus/
// _bahasEntryLaporanKode) — begitu Jadwal sudah tersambung ke akun siswa
// asli, tinggal ganti isi 2 fungsi itu jadi query API asli (mis. GET
// /api/tokens/used, dicocokkan user_kode & modul_kode), tanpa perlu ubah
// UI/alur klik (bahasHandleClick -> openReviewUjian) sama sekali.

const BAHAS_THRESHOLD_MENIT = 15; // seberapa dekat ke jam mulai baru kartu ini muncul

/* ── Jam mulai/selesai slot sebagai objek Date sungguhan (gabungan tanggal
   entri + label jam slot, mis. "07.45 - 09.15") — dipakai buat hitung
   "berapa menit lagi" & kapan kartu ini harus hilang lagi. ── */
function _bahasSlotTime(slotId, which) {
    const slot = JDW_SLOTS.find(s => s.id === slotId);
    if (!slot) return null;
    const parts = slot.label.split(' - ');
    const str = (which === 'end' ? parts[1] : parts[0]).trim();
    const [h, m] = str.split('.').map(Number);
    return { h, m };
}
function _bahasEntryDateTime(e, which) {
    const t = _bahasSlotTime(e.slotId, which);
    if (!t) return null;
    const d = new Date(e.tanggal + 'T00:00:00');
    d.setHours(t.h, t.m, 0, 0);
    return d;
}

/* Cari 1 entri JadwalStore (status acc/berlangsung) yang jam mulainya
   PALING DEKAT dengan sekarang DAN sisa waktunya <= BAHAS_THRESHOLD_MENIT
   (atau malah sudah berjalan tapi belum lewat jam selesai). Kalau tidak ada
   yang masuk window itu, return null (kartu disembunyikan). */
function _bahasFindEntry() {
    if (typeof JadwalStore === 'undefined') return null;
    if (typeof _jdwAutoExpirePending === 'function') _jdwAutoExpirePending();
    if (typeof _jdwAutoAdvanceStatus === 'function') _jdwAutoAdvanceStatus();
    const now = new Date();
    let best = null, bestStart = null;
    JadwalStore.all()
        .filter(e => e.status === 'acc' || e.status === 'berlangsung')
        .forEach(e => {
            const start = _bahasEntryDateTime(e, 'start');
            const end = _bahasEntryDateTime(e, 'end');
            if (!start || !end || now >= end) return;
            if (!best || start < bestStart) { best = e; bestStart = start; }
        });
    if (!best) return null;
    const diffMin = (bestStart - now) / 60000;
    if (diffMin > BAHAS_THRESHOLD_MENIT) return null;
    return best;
}

/* ── DUMMY status ujian siswa (lihat catatan panjang di atas file) ── */
function _bahasEntryExamStatus(e) {
    if (e.examStatus) return e.examStatus;
    const cycle = ['belum', 'sedang', 'selesai'];
    let hash = 0;
    const seed = e.id + '-examstatus';
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    return cycle[hash % cycle.length];
}
function _bahasEntryLaporanKode(e) {
    if (e.laporanKode) return e.laporanKode;
    return _jdwPseudoCode(e.id + '-laporan', 'LAPxxx');
}

function _bahasFmtCountdown(startDate) {
    const diffMs = startDate - new Date();
    if (diffMs <= 0) return 'Sedang berlangsung';
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return 'Kurang dari 1 menit lagi';
    return `${mins} menit lagi`;
}

function renderBahas() {
    const entry = _bahasFindEntry();
    const empty = document.getElementById('bahas-empty');
    const card = document.getElementById('bahas-card');
    if (!entry) {
        if (empty) empty.style.display = '';
        if (card) card.style.display = 'none';
        return;
    }
    if (empty) empty.style.display = 'none';
    if (card) card.style.display = '';

    const materi = JDW_MATERI.find(m => m.id === entry.materiId);
    const slot = JDW_SLOTS.find(s => s.id === entry.slotId);
    const start = _bahasEntryDateTime(entry, 'start');
    const status = entry.status === 'berlangsung' ? 'berlangsung' : 'acc';

    const statusEl = document.getElementById('bahas-status');
    statusEl.className = 'jdw-status-badge ' + status;
    statusEl.textContent = JDW_STATUS_LABEL[status] || status;
    document.getElementById('bahas-countdown').textContent = _bahasFmtCountdown(start);
    document.getElementById('bahas-nama').textContent = entry.nama || 'Murid';
    document.getElementById('bahas-tanggal').textContent = _jdwFmtDateLong(entry.tanggal);
    document.getElementById('bahas-slot').textContent = slot ? slot.label : '-';
    document.getElementById('bahas-materi').textContent = materi ? materi.label : '-';
    document.getElementById('bahas-gmeet-link').href = _jdwEntryGmeetLink(entry);

    const btn = document.getElementById('bahas-btn');
    if (btn) btn.onclick = () => bahasHandleClick(entry.id);
}

// Tombol "BAHAS": status ujian siswa (belum/sedang/selesai) SENGAJA baru
// dicek sekali di sini, PAS tombolnya diklik — bukan dicek terus-menerus di
// background (mis. lewat setInterval), supaya tidak membebani sistem dgn
// polling yang kebanyakan tidak perlu. Kalau belum mulai / lagi ujian ->
// tampilkan pesan singkat saja (datanya memang belum ada apa-apanya buat
// direview). Kalau sudah selesai -> buka MODE REVIEW yang persis sama
// dengan tombol "Review" di tab Riwayat (openReviewUjian), otomatis pakai
// laporan hasil ujian sesi ini tanpa guru perlu cari manual.
//
// CATATAN ARAH KE DEPAN: begitu backend beneran sudah nyambung, cek
// "selesai" idealnya BUKAN client yang nebak/nanya berulang, tapi SERVER
// yang kasih tahu (mis. laporan.created_at nongol lewat notifikasi/event
// begitu peserta submit ujian dari token itu) — jadi 1x query on-demand pas
// diklik ini sudah cukup & tetap konsisten dgn prinsip "jangan polling".
function bahasHandleClick(entryId) {
    const e = JadwalStore.get(entryId);
    if (!e) return;
    const status = _bahasEntryExamStatus(e);
    if (status === 'belum') {
        showToast('Maaf, data belum tersedia karena user belum memulai ujian.', 'danger');
        return;
    }
    if (status === 'sedang') {
        showToast('Maaf, data belum tersedia, user sedang ujian.', 'danger');
        return;
    }
    const materi = JDW_MATERI.find(m => m.id === e.materiId);
    openReviewUjian(_bahasEntryLaporanKode(e), materi ? materi.label : 'Ujian', e.nama || 'Murid');
}
