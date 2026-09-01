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
const JDW_STATUS_LABEL = { pending: 'Menunggu', acc: 'Disetujui', ditolak: 'Ditolak', berlangsung: 'Berlangsung', selesai: 'Selesai' };
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
        // Contoh data awal biar semua status (menunggu/disetujui/ditolak) kelihatan
        // di demo pertama kali — sekali dibuat, tidak akan ditimpa lagi.
        const arr = [
            { id: 'seed1', tanggal: _todayIso(0), slotId: 'slot2', materiId: 'twk', status: 'acc', createdAt: Date.now() - 86400000 },
            { id: 'seed2', tanggal: _todayIso(1), slotId: 'slot4', materiId: 'toefl_listening', status: 'pending', createdAt: Date.now() - 40000000 },
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
    // official (belum ada editingId) tapi jam/materinya sudah sempat dipilih.
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
        const { left, right } = JadwalPage._entryActions(e);
        const btnCls = (a) => a.cls === 'act-danger' ? 'jdw-btn-danger' : (a.cls === 'act-primary' ? 'jdw-btn-primary' : 'jdw-btn-secondary');
        const btns = [...right, ...left].map(a => `<button class="jdw-btn ${btnCls(a)} jdw-btn-sm" onclick="${a.onClick}">${a.label}</button>`).join('');
        return `<tr>
            <td>${slot ? slot.label : '-'}</td>
            <td>${materi ? materi.label : '-'}</td>
            <td><span class="jdw-status-badge ${e.status}">${JDW_STATUS_LABEL[e.status] || e.status}</span></td>
            <td><div style="display:flex;gap:6px;flex-wrap:wrap">${btns}</div></td>
        </tr>`;
    }).join('');
    const cards = entries.map(e => JadwalPage._entryCardHtml(e)).join('');
    return `<div class="jdw-status-day">${head}
        <div class="aksi-swipe-wrap"><div class="glass" style="padding:0;overflow:hidden"><table class="jdw-entry-table"><thead><tr><th>Jam</th><th>Materi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table></div></div>
        <div class="swipe-list">${cards}</div>
    </div>`;
}

function _jdwDayGroupHtmlBelumSampai(d) {
    // Placeholder buat hari di "Riwayat minggu ini (belum genap)" yang tanggalnya
    // belum sampai/lewat -> belum ada apa2 buat diriwayatkan, jadi kosong dulu
    // sampai harinya benar2 lewat (baru dia pindah dari Minggu Ini ke sini).
    const iso = _jdwToIso(d);
    const label = _jdwFmtDateLong(iso);
    return `<div class="jdw-status-day">
        <div class="jdw-status-day-head">
            <div class="jdw-status-day-label">${label}</div>
            <div class="jdw-status-day-count"></div>
        </div>
        <div class="jdw-status-day-empty">Belum sampai harinya</div>
    </div>`;
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
        // "Minggu Ini" hanya nampilin hari ini & seterusnya — tanggal yang sudah
        // lewat dihilangkan dari sini, pindah ke Riwayat (offset 0).
        if (JadwalPage.currentView === 'minggu' && iso < todayIso) return '';
        // "Riwayat minggu ini (offset 0)" untuk tanggal yang belum sampai harinya
        // -> belum ada riwayatnya, tampil placeholder kosong dulu.
        if (JadwalPage.currentView === 'riwayat' && JadwalPage.riwayatWeekOffset === 0 && iso > todayIso) {
            return _jdwDayGroupHtmlBelumSampai(d);
        }
        const entries = JadwalStore.byDate(iso)
            .filter(e => e.status === 'pending' || e.status === 'acc' || e.status === 'berlangsung' || e.status === 'selesai')
            .sort((a, b) => _jdwSlotIndex(a.slotId) - _jdwSlotIndex(b.slotId));
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
    },
    /* ── Aksi (Edit/Jadwal Ulang/Batal/Masuk/Feedback) sesuai status sesi saat ini ──
       pending      -> Edit (kiri) + Batal (kanan)
       acc          -> Jadwal Ulang (kiri) + Batal (kanan)
       berlangsung  -> Masuk (kiri) kalau jam sesinya belum lewat, atau
                       Feedback (kiri) kalau sudah lewat — tanpa Batal sama sekali
       selesai/lain -> tanpa aksi apa pun (sweep/tombol dihilangkan total) ── */
    _entryActions(e) {
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
        return { left: [], right: [] }; // 'selesai' (atau status lain) -> tanpa tombol
    },
    _entryCardHtml(e) {
        const slot = JDW_SLOTS.find(s => s.id === e.slotId);
        const materi = JDW_MATERI.find(m => m.id === e.materiId);
        const { left, right } = this._entryActions(e);
        return SwipeCards.buildSwipeCardHtml({
            title: slot ? slot.label : '-',
            sub: materi ? materi.label : '-',
            sideHtml: `<span class="jdw-status-badge ${e.status}">${JDW_STATUS_LABEL[e.status] || e.status}</span>`,
            kode: e.id,
            leftActions: left, rightActions: right,
        });
    },

    /* ── Halaman ajukan jadwal (pilih jam + materi) ── */
    openAjukanOverlay(entryId) {
        _jdwAutoExpirePending(); // bebasin slot yang barusan auto-tertolak sebelum dihitung "terisi"
        _jdwAutoAdvanceStatus();
        this.editingId = entryId || null;
        const existing = entryId ? JadwalStore.get(entryId) : null;
        this.pickedSlot = existing ? existing.slotId : null;
        this.pickedMateri = existing ? existing.materiId : null;
        const isReschedule = existing && existing.status === 'acc';
        document.getElementById('jdw-ajukan-title').textContent = existing ? (isReschedule ? 'Jadwal Ulang' : 'Ubah Pengajuan') : 'Ajukan Jadwal';
        document.getElementById('jdw-submit-btn').textContent = existing ? (isReschedule ? 'AJUKAN ULANG' : 'EDIT PENGAJUAN') : 'AJUKAN';

        // Jam yang sudah dipakai entri lain (selain yang sedang diedit) di tanggal ini -> dikunci, tidak boleh dobel.
        const takenSlotIds = new Set(
            JadwalStore.byDate(this.selectedDate)
                .filter(e => e.id !== this.editingId && e.status !== 'ditolak')
                .map(e => e.slotId)
        );
        // Kalau tanggal yang dipilih adalah HARI INI, jam yang jam-mulainya sudah
        // lewat dari sekarang ikut dikunci — nggak masuk akal ngajuin jam yang
        // udah kelewatan.
        const isToday = this.selectedDate === _jdwToIso(new Date());
        const now = new Date();
        document.getElementById('jdw-slot-grid').innerHTML = JDW_SLOTS.map(s => {
            const taken = takenSlotIds.has(s.id);
            const past = isToday && (() => { const start = _jdwSlotStartDate(this.selectedDate, s.id); return start && start <= now; })();
            const disabled = taken || past;
            const selected = this.pickedSlot === s.id;
            const tag = taken ? ' <small>(terisi)</small>' : (past ? ' <small>(sudah lewat)</small>' : '');
            return `<div class="jdw-chip${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}" ${disabled ? '' : `onclick="JadwalPage.pickSlot('${s.id}')"`}>
                <span>${s.label}${tag}</span>
                <span class="jdw-chip-check"></span>
            </div>`;
        }).join('');
        document.getElementById('jdw-materi-grid').innerHTML = JDW_MATERI.map(m => {
            const selected = this.pickedMateri === m.id;
            return `<div class="jdw-materi-chip${selected ? ' selected' : ''}" onclick="JadwalPage.pickMateri('${m.id}')">${m.label}</div>`;
        }).join('');
        this._refreshSubmitBtn();
        const overlay = document.getElementById('jdw-ajukan-overlay');
        overlay.classList.add('open');
        const body = overlay.querySelector('.jdw-modal-body');
        if (body) body.scrollTop = 0;
        _jdwSaveState();
    },
    closeAjukanOverlay() {
        document.getElementById('jdw-ajukan-overlay').classList.remove('open');
        _jdwSaveState();
    },
    pickSlot(id) {
        this.pickedSlot = id;
        document.querySelectorAll('#jdw-slot-grid .jdw-chip').forEach(el => el.classList.remove('selected'));
        JDW_SLOTS.forEach((s, i) => { if (s.id === id) document.querySelectorAll('#jdw-slot-grid .jdw-chip')[i].classList.add('selected'); });
        this._refreshSubmitBtn();
        _jdwSaveState();
    },
    pickMateri(id) {
        this.pickedMateri = id;
        document.querySelectorAll('#jdw-materi-grid .jdw-materi-chip').forEach(el => el.classList.remove('selected'));
        JDW_MATERI.forEach((m, i) => { if (m.id === id) document.querySelectorAll('#jdw-materi-grid .jdw-materi-chip')[i].classList.add('selected'); });
        this._refreshSubmitBtn();
        _jdwSaveState();
    },
    _refreshSubmitBtn() {
        const btn = document.getElementById('jdw-submit-btn');
        btn.disabled = !(this.pickedSlot && this.pickedMateri);
    },
    submitAjukan() {
        if (!this.pickedSlot || !this.pickedMateri) return;
        if (this.editingId) {
            const existing = JadwalStore.get(this.editingId);
            const wasAcc = existing && existing.status === 'acc';
            JadwalStore.update(this.editingId, { slotId: this.pickedSlot, materiId: this.pickedMateri, status: 'pending' });
            showToast(wasAcc ? '✓ Jadwal ulang diajukan, menunggu persetujuan' : '✓ Pengajuan jadwal diperbarui');
        } else {
            JadwalStore.add({ tanggal: this.selectedDate, slotId: this.pickedSlot, materiId: this.pickedMateri });
            showToast('✓ Jadwal berhasil diajukan');
        }
        this.closeAjukanOverlay();
        _jdwRenderWeek();
        _jdwRenderNextWeekCard();
        _jdwRenderStatusList();
        _jdwSaveState();
    },

    /* ── Aksi list (dipanggil dari sweep card / tombol tabel) ── */
    editEntry(id) { this.openAjukanOverlay(id); },
    resejadwalEntry(id) { this.openAjukanOverlay(id); },
    _batalTargetId: null,
    batalEntry(id) {
        this._batalTargetId = id;
        document.getElementById('jdw-batal-overlay').classList.add('open');
    },
    confirmBatal() {
        document.getElementById('jdw-batal-overlay').classList.remove('open');
        if (!this._batalTargetId) return;
        JadwalStore.remove(this._batalTargetId);
        this._batalTargetId = null;
        showToast('Jadwal dibatalkan');
        _jdwRenderWeek();
        _jdwRenderNextWeekCard();
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
            <div class="jdw-sesi-hint">Salin link Gmeet & token di atas, lalu gunakan untuk masuk ke sesi mentoring sesuai jadwal.</div>`;
        document.getElementById('jdw-sesi-footer').innerHTML = `<a class="jdw-btn jdw-btn-primary jdw-btn-block" style="text-decoration:none;justify-content:center;text-align:center" href="${link}" target="_blank" rel="noopener">BUKA GOOGLE MEET</a>`;
        document.getElementById('jdw-sesi-overlay').classList.add('open');
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
            </div>`;
        this._renderFbRating('paham');
        this._renderFbRating('kualitas');
        document.getElementById('jdw-sesi-footer').innerHTML = `<button class="jdw-btn jdw-btn-primary jdw-btn-block" id="jdw-fb-submit" onclick="JadwalPage.simpanFeedback()" disabled>SIMPAN</button>`;
        document.getElementById('jdw-sesi-overlay').classList.add('open');
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
        this._sesiEntryId = null;
    },
};