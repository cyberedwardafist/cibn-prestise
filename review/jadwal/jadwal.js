// review/jadwal/jadwal.js
// Modul JADWAL sisi REVIEW/GURU (tentor) — lazy-load saat tab Jadwal dibuka.
//
// CATATAN: masih fase "tampilan dulu, sistem dummy" sama seperti sisi user
// (lihat user/jadwal/jadwal.js) — baca/tulis dari localStorage KEY YANG SAMA
// (cbn_jadwal_pengajuan_dummy_v1) supaya pengajuan yang dibuat user di tab/
// browser yang sama langsung kelihatan di sisi guru tanpa backend sama
// sekali. Konstanta referensi (slot/materi/tentor/label status) & seed dummy
// SENGAJA diduplikasi persis sama dengan user/jadwal/jadwal.js (bukan
// di-share lewat 1 file) supaya modul ini tetap bisa lazy-load independen
// dari sisi user — kalau salah satu sisi diubah (mis. nambah tentor baru),
// sisi satunya HARUS ikut diupdate manual.
//
// PENAUTAN AKUN REVIEW <-> TENTOR: karena tabel users belum punya kolom
// tentor (lihat db/schema.sql), pemetaan "akun review ini = tentor yang
// mana" untuk sementara disimpan di localStorage sendiri
// (cbn_review_tentor_map_v1, key per kode akun) — 1 akun review = 1 tentor
// spesifik, dipilih sekali lewat kartu "Pilih identitas tentor kamu" lalu
// diingat otomatis. Tombol "Ganti" di dashboard bisa dipakai buat ganti
// identitas kalau perlu (misal testing multi-tentor di akun review yang
// sama).

const RJW_SLOTS = [
    { id: 'slot1', label: '07.45 - 09.15' },
    { id: 'slot2', label: '09.45 - 11.15' },
    { id: 'slot3', label: '11.45 - 13.15' },
    { id: 'slot4', label: '13.45 - 15.15' },
    { id: 'slot5', label: '15.45 - 17.15' },
    { id: 'slot6', label: '17.45 - 19.15' },
    { id: 'slot7', label: '19.45 - 20.15' },
];
const RJW_MATERI = [
    { id: 'twk', label: 'TWK' },
    { id: 'tiu', label: 'TIU' },
    { id: 'tkp', label: 'TKP' },
    { id: 'toefl_struktur', label: 'TOEFL Struktur' },
    { id: 'toefl_listening', label: 'TOEFL Listening' },
    { id: 'toefl_reading', label: 'TOEFL Reading' },
];
const RJW_TENTOR = [
    { id: 'albert', name: 'ALBERT' },
    { id: 'chika', name: 'CHIKA' },
    { id: 'pram', name: 'PRAM' },
    { id: 'angga', name: 'ANGGA' },
    { id: 'raffi', name: 'RAFFI' },
];
const RJW_STATUS_LABEL = { pending: 'Menunggu', acc: 'Disetujui', ditolak: 'Ditolak', berlangsung: 'Berlangsung', feedback: 'Feedback', selesai: 'Selesai', pengajuan_pembatalan: 'Pengajuan Pembatalan', resejuel: 'Jadwal Ulang dari Tentor', batal: 'Dibatalkan', butuh_persetujuan: 'Butuh Persetujuan', pengajuan_batal_tentor: 'Pengajuan Batal dari Tentor' };
const RJW_DAY_SHORT = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const RJW_MONTH_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

/* ══════════════════════════════════════════
   DATA LAYER DUMMY (localStorage, key sama dengan sisi user)
   ══════════════════════════════════════════ */
const RJW_STORE_KEY = 'cbn_jadwal_pengajuan_dummy_v1';
const RjwStore = (function () {
    function _load() {
        try {
            const arr = JSON.parse(localStorage.getItem(RJW_STORE_KEY));
            return Array.isArray(arr) ? arr : [];
        } catch (e) { return []; }
    }
    function _save(arr) { try { localStorage.setItem(RJW_STORE_KEY, JSON.stringify(arr)); } catch (e) {} }
    return {
        all() { return _load(); },
        get(id) { return _load().find(j => j.id === id) || null; },
        update(id, patch) {
            const arr = _load();
            const idx = arr.findIndex(j => j.id === id);
            if (idx < 0) return null;
            arr[idx] = Object.assign({}, arr[idx], patch);
            _save(arr);
            return arr[idx];
        },
    };
})();

/* ══════════════════════════════════════════
   PENAUTAN AKUN REVIEW <-> TENTOR (localStorage terpisah)
   ══════════════════════════════════════════ */
const RJW_TENTOR_MAP_KEY = 'cbn_review_tentor_map_v1';
function _rjwGetTentorMap() {
    try { const m = JSON.parse(localStorage.getItem(RJW_TENTOR_MAP_KEY)); return (m && typeof m === 'object') ? m : {}; }
    catch (e) { return {}; }
}
function _rjwSetTentorMap(map) { try { localStorage.setItem(RJW_TENTOR_MAP_KEY, JSON.stringify(map)); } catch (e) {} }
function _rjwMyKode() { const u = (typeof getMe === 'function') ? getMe() : null; return (u && u.kode) || 'anon'; }
function _rjwMyTentorId() { return _rjwGetTentorMap()[_rjwMyKode()] || null; }
function _rjwSetMyTentor(tentorId) { const map = _rjwGetTentorMap(); map[_rjwMyKode()] = tentorId; _rjwSetTentorMap(map); }
function _rjwClearMyTentor() { const map = _rjwGetTentorMap(); delete map[_rjwMyKode()]; _rjwSetTentorMap(map); }

/* ══════════════════════════════════════════
   HELPERS TAMPILAN
   ══════════════════════════════════════════ */
function _rjwSlotLabel(id) { return (RJW_SLOTS.find(s => s.id === id) || {}).label || id || '-'; }
function _rjwMateriLabel(id) { return (RJW_MATERI.find(m => m.id === id) || {}).label || id || '-'; }
function _rjwFormatTanggal(iso) {
    if (!iso) return '-';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return `${RJW_DAY_SHORT[d.getDay()]}, ${d.getDate()} ${RJW_MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}
function _rjwFillTentorSelect() {
    const sel = document.getElementById('rjw-tentor-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Pilih Tentor --</option>' + RJW_TENTOR.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
}
function _rjwBadgeClass(status) {
    if (status === 'pending' || status === 'butuh_persetujuan' || status === 'pengajuan_pembatalan' || status === 'pengajuan_batal_tentor' || status === 'resejuel') return 'badge-pending';
    if (status === 'ditolak' || status === 'batal') return 'badge-suspend';
    return 'badge-active';
}
function _rjwEntryCard(e, opts) {
    opts = opts || {};
    const statusLabel = RJW_STATUS_LABEL[e.status] || e.status;
    let actions = '';
    if (opts.showApprove) {
        actions = `<button class="btn btn-primary btn-sm" onclick="RjwPage.terima('${e.id}')">Terima</button>
                   <button class="btn btn-danger btn-sm" onclick="RjwPage.openTolak('${e.id}')">Tolak</button>`;
    } else if (opts.showFeedback) {
        actions = e.feedbackTentor
            ? `<span class="badge badge-active">Feedback tersimpan</span>`
            : `<button class="btn btn-secondary btn-sm" onclick="RjwPage.openFeedback('${e.id}')">Isi Feedback</button>`;
    }
    return `<div class="card" style="margin-bottom:10px;padding:14px 16px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
            <div>
                <div style="font-weight:700;color:var(--blue);font-size:14px;">${_rjwMateriLabel(e.materiId)}</div>
                <div style="font-size:12px;color:var(--text-sub);margin-top:2px;">${_rjwFormatTanggal(e.tanggal)} · ${_rjwSlotLabel(e.slotId)}</div>
            </div>
            <span class="badge ${_rjwBadgeClass(e.status)}">${statusLabel}</span>
        </div>
        ${actions ? `<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">${actions}</div>` : ''}
    </div>`;
}

/* ══════════════════════════════════════════
   RENDER UTAMA
   ══════════════════════════════════════════ */
function renderJadwalReview() {
    const myId = _rjwMyTentorId();
    const picker = document.getElementById('rjw-tentor-picker');
    const dash = document.getElementById('rjw-dashboard');
    if (!myId) {
        if (picker) picker.style.display = '';
        if (dash) dash.style.display = 'none';
        _rjwFillTentorSelect();
        return;
    }
    if (picker) picker.style.display = 'none';
    if (dash) dash.style.display = '';

    const nameEl = document.getElementById('rjw-my-tentor-name');
    if (nameEl) nameEl.textContent = (RJW_TENTOR.find(t => t.id === myId) || {}).name || myId;

    const all = RjwStore.all().filter(e => e.tentorId === myId);
    const pending = all.filter(e => e.status === 'pending').sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    const aktifStatuses = ['acc', 'berlangsung', 'resejuel', 'butuh_persetujuan', 'pengajuan_pembatalan', 'pengajuan_batal_tentor'];
    const aktif = all.filter(e => aktifStatuses.includes(e.status)).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    const riwayat = all.filter(e => ['selesai', 'ditolak', 'batal'].includes(e.status)).sort((a, b) => b.tanggal.localeCompare(a.tanggal));

    const countEl = document.getElementById('rjw-count-pending');
    if (countEl) countEl.textContent = pending.length;

    const pendingEl = document.getElementById('rjw-list-pending');
    if (pendingEl) pendingEl.innerHTML = pending.length
        ? pending.map(e => _rjwEntryCard(e, { showApprove: true })).join('')
        : '<div class="empty-state" style="padding:20px 0;"><p>Tidak ada pengajuan baru</p></div>';

    const aktifEl = document.getElementById('rjw-list-aktif');
    if (aktifEl) aktifEl.innerHTML = aktif.length
        ? aktif.map(e => _rjwEntryCard(e, { showFeedback: e.status === 'berlangsung' })).join('')
        : '<div class="empty-state" style="padding:20px 0;"><p>Belum ada jadwal aktif</p></div>';

    const riwayatEl = document.getElementById('rjw-list-riwayat');
    if (riwayatEl) riwayatEl.innerHTML = riwayat.length
        ? riwayat.map(e => _rjwEntryCard(e, {})).join('')
        : '<div class="empty-state" style="padding:20px 0;"><p>Belum ada riwayat</p></div>';
}

/* ══════════════════════════════════════════
   AKSI
   ══════════════════════════════════════════ */
let _rjwTolakTargetId = null;
let _rjwFeedbackTargetId = null;

const RjwPage = {
    saveTentor() {
        const sel = document.getElementById('rjw-tentor-select');
        if (!sel || !sel.value) { showToast('Pilih salah satu tentor dulu', 'danger'); return; }
        _rjwSetMyTentor(sel.value);
        showToast('Identitas tentor disimpan');
        renderJadwalReview();
    },
    gantiTentor() {
        _rjwClearMyTentor();
        renderJadwalReview();
    },
    terima(id) {
        RjwStore.update(id, { status: 'acc' });
        showToast('Pengajuan diterima');
        renderJadwalReview();
    },
    openTolak(id) {
        _rjwTolakTargetId = id;
        const ta = document.getElementById('rjw-tolak-alasan');
        if (ta) ta.value = '';
        openModal('rjw-tolak-overlay');
    },
    confirmTolak() {
        if (!_rjwTolakTargetId) return;
        const alasanEl = document.getElementById('rjw-tolak-alasan');
        const alasan = alasanEl ? alasanEl.value.trim() : '';
        const patch = { status: 'ditolak' };
        if (alasan) patch.alasanTolakTentor = alasan;
        RjwStore.update(_rjwTolakTargetId, patch);
        closeModal('rjw-tolak-overlay');
        showToast('Pengajuan ditolak');
        _rjwTolakTargetId = null;
        renderJadwalReview();
    },
    openFeedback(id) {
        _rjwFeedbackTargetId = id;
        const e = RjwStore.get(id);
        const info = document.getElementById('rjw-feedback-info');
        if (info) info.textContent = e ? `${_rjwMateriLabel(e.materiId)} · ${_rjwFormatTanggal(e.tanggal)} · ${_rjwSlotLabel(e.slotId)}` : '';
        const prog = document.getElementById('rjw-feedback-progress');
        if (prog) prog.value = (e && e.feedbackTentor && e.feedbackTentor.progress) || 4;
        const cat = document.getElementById('rjw-feedback-catatan');
        if (cat) cat.value = (e && e.feedbackTentor && e.feedbackTentor.catatan) || '';
        openModal('rjw-feedback-overlay');
    },
    confirmFeedback() {
        if (!_rjwFeedbackTargetId) return;
        const progEl = document.getElementById('rjw-feedback-progress');
        const catEl = document.getElementById('rjw-feedback-catatan');
        RjwStore.update(_rjwFeedbackTargetId, {
            feedbackTentor: {
                progress: Number(progEl ? progEl.value : 4),
                catatan: catEl ? catEl.value.trim() : '',
                filledAt: Date.now(),
            },
        });
        closeModal('rjw-feedback-overlay');
        showToast('Feedback sesi tersimpan');
        _rjwFeedbackTargetId = null;
        renderJadwalReview();
    },
    toggleRiwayat() {
        const el = document.getElementById('rjw-list-riwayat');
        const btn = document.getElementById('rjw-riwayat-toggle');
        if (!el) return;
        const willShow = el.style.display === 'none';
        el.style.display = willShow ? '' : 'none';
        if (btn) btn.textContent = willShow ? 'Sembunyikan Riwayat' : 'Tampilkan Riwayat';
    },
};
