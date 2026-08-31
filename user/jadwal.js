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
const JDW_STATUS_LABEL = { pending: 'Menunggu', acc: 'Disetujui', ditolak: 'Ditolak' };
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

/* ══════════════════════════════════════════
   PAGE UTAMA — KALENDER 1 MINGGU (ala kalender iPhone)
   ══════════════════════════════════════════ */
function loadJadwal() {
    _jdwRenderWeek();
}

function _jdwRenderWeek() {
    const strip = document.getElementById('jdw-week-strip');
    const caption = document.getElementById('jdw-week-caption');
    if (!strip) return;
    const weekDates = _jdwWeekDates(new Date());
    const todayIso = _jdwToIso(new Date());
    const first = weekDates[0], last = weekDates[6];
    if (caption) {
        const sameMonth = first.getMonth() === last.getMonth();
        caption.textContent = sameMonth
            ? `${first.getDate()} - ${last.getDate()} ${JDW_MONTH_SHORT[first.getMonth()]} ${first.getFullYear()}`
            : `${first.getDate()} ${JDW_MONTH_SHORT[first.getMonth()]} - ${last.getDate()} ${JDW_MONTH_SHORT[last.getMonth()]} ${last.getFullYear()}`;
    }
    strip.innerHTML = weekDates.map(d => {
        const iso = _jdwToIso(d);
        const isToday = iso === todayIso;
        const hasEntries = JadwalStore.byDate(iso).length > 0;
        return `<div class="jdw-day${isToday ? ' is-today' : ''}${hasEntries ? ' has-entries' : ''}" onclick="JadwalPage.openDay('${iso}')">
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

    /* ── Halaman detail tanggal ── */
    openDay(iso) {
        this.selectedDate = iso;
        document.getElementById('jdw-day-title').textContent = _jdwFmtDateLong(iso);
        this._renderDayContent();
        document.getElementById('jdw-day-overlay').classList.add('open');
    },
    closeDayOverlay() {
        document.getElementById('jdw-day-overlay').classList.remove('open');
        _jdwRenderWeek();
    },
    _renderDayContent() {
        const wrap = document.getElementById('jdw-day-content');
        const cornerBtn = document.getElementById('jdw-ajukan-corner-btn');
        const entries = JadwalStore.byDate(this.selectedDate);
        if (!entries.length) {
            cornerBtn.classList.remove('show');
            wrap.innerHTML = `<div class="jdw-day-empty-cta">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <p>Belum ada jadwal di tanggal ini</p>
                <small>Ajukan jam & materi mentoring yang kamu mau</small>
                <button class="jdw-btn jdw-btn-primary" onclick="JadwalPage.openAjukanOverlay()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" width="13" height="13"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Ajukan Jadwal
                </button>
            </div>`;
            return;
        }
        cornerBtn.classList.add('show');
        const sorted = entries.slice().sort((a, b) => a.slotId.localeCompare(b.slotId));
        // Tabel (desktop) — dipasangkan dengan swipe-list (mobile), pola sama seperti daftar aksi lain di aplikasi ini.
        const rows = sorted.map(e => {
            const slot = JDW_SLOTS.find(s => s.id === e.slotId);
            const materi = JDW_MATERI.find(m => m.id === e.materiId);
            return `<tr>
                <td>${slot ? slot.label : '-'}</td>
                <td>${materi ? materi.label : '-'}</td>
                <td><span class="jdw-status-badge ${e.status}">${JDW_STATUS_LABEL[e.status] || e.status}</span></td>
                <td><div style="display:flex;gap:6px;flex-wrap:wrap">
                    <button class="jdw-btn jdw-btn-secondary jdw-btn-sm" onclick="JadwalPage.editEntry('${e.id}')">Edit</button>
                    ${e.status === 'acc' ? `<button class="jdw-btn jdw-btn-secondary jdw-btn-sm" onclick="JadwalPage.resejadwalEntry('${e.id}')">Jadwal Ulang</button>` : ''}
                    <button class="jdw-btn jdw-btn-danger jdw-btn-sm" onclick="JadwalPage.batalEntry('${e.id}')">Batal</button>
                </div></td>
            </tr>`;
        }).join('');
        const cards = sorted.map(e => this._entryCardHtml(e)).join('');
        wrap.innerHTML = `
            <div class="aksi-swipe-wrap"><div class="glass" style="padding:0;overflow:hidden"><table class="jdw-entry-table"><thead><tr><th>Jam</th><th>Materi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table></div></div>
            <div class="swipe-list">${cards}</div>`;
        const swEl = wrap.querySelector('.swipe-list');
        if (swEl && window.SwipeCards) SwipeCards.bindSwipeList(swEl);
    },
    _entryCardHtml(e) {
        const slot = JDW_SLOTS.find(s => s.id === e.slotId);
        const materi = JDW_MATERI.find(m => m.id === e.materiId);
        const rightActions = [{ icon: 'edit', label: 'Edit', cls: 'act-edit', onClick: `JadwalPage.editEntry('${e.id}')` }];
        if (e.status === 'acc') rightActions.push({ icon: 'refresh', label: 'Jadwal Ulang', cls: 'act-primary', onClick: `JadwalPage.resejadwalEntry('${e.id}')` });
        const leftActions = [{ icon: 'trash', label: 'Batal', cls: 'act-danger', onClick: `JadwalPage.batalEntry('${e.id}')` }];
        return SwipeCards.buildSwipeCardHtml({
            title: slot ? slot.label : '-',
            sub: materi ? materi.label : '-',
            sideHtml: `<span class="jdw-status-badge ${e.status}">${JDW_STATUS_LABEL[e.status] || e.status}</span>`,
            kode: e.id,
            leftActions, rightActions,
        });
    },

    /* ── Halaman ajukan jadwal (pilih jam + materi) ── */
    openAjukanOverlay(entryId) {
        this.editingId = entryId || null;
        const existing = entryId ? JadwalStore.get(entryId) : null;
        this.pickedSlot = existing ? existing.slotId : null;
        this.pickedMateri = existing ? existing.materiId : null;
        document.getElementById('jdw-ajukan-title').textContent = existing ? (existing.status === 'acc' ? 'Jadwal Ulang' : 'Ubah Pengajuan') : 'Ajukan Jadwal';

        // Jam yang sudah dipakai entri lain (selain yang sedang diedit) di tanggal ini -> dikunci, tidak boleh dobel.
        const takenSlotIds = new Set(
            JadwalStore.byDate(this.selectedDate)
                .filter(e => e.id !== this.editingId && e.status !== 'ditolak')
                .map(e => e.slotId)
        );
        document.getElementById('jdw-slot-grid').innerHTML = JDW_SLOTS.map(s => {
            const disabled = takenSlotIds.has(s.id);
            const selected = this.pickedSlot === s.id;
            return `<div class="jdw-chip${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}" ${disabled ? '' : `onclick="JadwalPage.pickSlot('${s.id}')"`}>
                <span>${s.label}${disabled ? ' <small>(terisi)</small>' : ''}</span>
                <span class="jdw-chip-check"></span>
            </div>`;
        }).join('');
        document.getElementById('jdw-materi-grid').innerHTML = JDW_MATERI.map(m => {
            const selected = this.pickedMateri === m.id;
            return `<div class="jdw-materi-chip${selected ? ' selected' : ''}" onclick="JadwalPage.pickMateri('${m.id}')">${m.label}</div>`;
        }).join('');
        this._refreshSubmitBtn();
        document.getElementById('jdw-ajukan-overlay').classList.add('open');
    },
    closeAjukanOverlay() {
        document.getElementById('jdw-ajukan-overlay').classList.remove('open');
    },
    pickSlot(id) {
        this.pickedSlot = id;
        document.querySelectorAll('#jdw-slot-grid .jdw-chip').forEach(el => el.classList.remove('selected'));
        JDW_SLOTS.forEach((s, i) => { if (s.id === id) document.querySelectorAll('#jdw-slot-grid .jdw-chip')[i].classList.add('selected'); });
        this._refreshSubmitBtn();
    },
    pickMateri(id) {
        this.pickedMateri = id;
        document.querySelectorAll('#jdw-materi-grid .jdw-materi-chip').forEach(el => el.classList.remove('selected'));
        JDW_MATERI.forEach((m, i) => { if (m.id === id) document.querySelectorAll('#jdw-materi-grid .jdw-materi-chip')[i].classList.add('selected'); });
        this._refreshSubmitBtn();
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
        this._renderDayContent();
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
        this._renderDayContent();
    },
};