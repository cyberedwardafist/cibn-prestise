// admin/analisa/analisa-modul-sampel.js
// Halaman pemilihan TESTER MANUAL utk 1 modul, dibuka dari kartu "Sampel" di
// admin/analisa/analisa-modul-detail.js (_amodOpenSampel(mode)) lewat tombol
// "+ Tester Individu" / "+ Tester Grup". Konteks dititip di
// window._analisaModulSampelKode (kode modul) & window._analisaModulSampelMode
// ('individu' | 'grup') sebelum navigateTo('analisa-modul-sampel') dipanggil.
//
// FILE INI SENGAJA DISALIN PERSIS dari admin/analisa/analisa-soal-sampel.js
// (prefix fungsi diganti _amos, baca/tulis sampel diganti _amodLoadSampel/
// _amodSaveSampel dgn key per modul_kode) — lihat komentar lengkap alur
// individu/grup di file aslinya, tidak diulang di sini.
//
// Klik "Simpan" menulis balik ke localStorage (lihat _amodSaveSampel di
// analisa-modul-detail.js) HANYA bagian yang sedang diedit (individu ATAU
// grup, sesuai window._analisaModulSampelMode) — bagian lain (kalau ada)
// dibiarkan seperti sebelumnya — lalu kembali ke halaman detail modul & minta
// grafik dihitung ulang.

// Helper baca/tulis localStorage sampel — SENGAJA diduplikasi persis dgn
// _amodLoadSampel/_amodSaveSampel di analisa-modul-detail.js (bukan dipanggil
// lintas file), supaya halaman ini tetap benar walau suatu saat dibuka lazy
// sendirian (mis. lewat _restoreAnalisaCtx setelah refresh langsung di
// halaman ini, tanpa analisa-modul-detail.js sempat ke-load duluan).
function _amodSampelStorageKey(kode) { return `cbn_modul_sampel_${kode}`; }
function _amodLoadSampel(kode) {
    try { return JSON.parse(localStorage.getItem(_amodSampelStorageKey(kode)) || 'null') || { individu: [], grup: [] }; }
    catch (e) { return { individu: [], grup: [] }; }
}
function _amodSaveSampel(kode, data) {
    try { localStorage.setItem(_amodSampelStorageKey(kode), JSON.stringify(data)); } catch (e) {}
}

let _amosKode = null, _amosMode = 'individu';
let _amosSearch = '';
let _amosStatusFilter = 'all', _amosGrubFilterIndividu = 'all';
let _amosUserList = [], _amosGrubList = [];

// state ceklis mode individu: Set kode user yang diceklis
let _amosIndividuSelected = new Set();
// state mode grup: Map grub_kode -> { grub_nama, members:[{kode,nama,included}] }
let _amosGrupSelected = new Map();

async function renderAnalisaModulSampel() {
    _amosKode = window._analisaModulSampelKode || null;
    _amosMode = window._analisaModulSampelMode || 'individu';
    _amosSearch = ''; _amosStatusFilter = 'all'; _amosGrubFilterIndividu = 'all';
    const si = document.getElementById('amos-search-input'); if (si) si.value = '';

    const titleEl = document.getElementById('amos-title');
    const subEl = document.getElementById('amos-sub');
    if (titleEl) titleEl.textContent = _amosMode === 'grup' ? 'Pilih Tester Grup' : 'Pilih Tester Individu';
    if (subEl) subEl.textContent = _amosKode ? `Modul: ${_amosKode}` : '-';

    const wrap = document.getElementById('amos-list-wrap');
    if (!_amosKode) { if (wrap) wrap.innerHTML = '<div class="empty-state"><p>Modul tidak ditemukan</p></div>'; return; }

    const [users, grubs] = await Promise.all([
        UsersAPI.getByRole('user').catch(() => []),
        GrubsAPI.getAll().catch(() => [])
    ]);
    _amosUserList = users || [];
    _amosGrubList = grubs || [];

    const sampel = _amodLoadSampel(_amosKode);
    if (_amosMode === 'individu') {
        _amosIndividuSelected = new Set((sampel.individu || []).map(u => u.kode));
    } else {
        _amosGrupSelected = new Map();
        (sampel.grup || []).forEach(g => _amosGrupSelected.set(g.grub_kode, { grub_nama: g.grub_nama, members: (g.members || []).map(m => ({ ...m })) }));
    }

    _amosRenderFilters();
    _amosRenderList();
}

function _amosEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function _amosUserKode(u) { return u.kode || u.id; }
function _amosGrubKode(g) { return g.kode || g.id; }
function _amosGrubNama(kode) { const g = _amosGrubList.find(x => _amosGrubKode(x) === kode); return g ? g.nama : kode; }

// ── FILTER (dropdown) — cuma dipakai di mode individu: Status akun & Grup
// asal akun (bukan grup TESTER yang lagi dipilih — ini cuma filter pencarian).
function _amosRenderFilters() {
    const el = document.getElementById('amos-filters');
    if (!el) return;
    if (_amosMode !== 'individu') { el.innerHTML = ''; return; }
    const statusOptions = [{ value: 'all', label: 'Semua Status' }, { value: 'aktif', label: 'Aktif' }, { value: 'nonaktif', label: 'Nonaktif' }];
    const grubOptions = [{ value: 'all', label: 'Semua Grup' }, { value: 'none', label: 'Tanpa Grup' }, ..._amosGrubList.map(g => ({ value: _amosGrubKode(g), label: g.nama }))];
    renderFilterDropdown('amos-filters', {
        title: 'Filter', groups: [
            { title: 'Status', options: statusOptions, current: _amosStatusFilter, onSelect: v => { _amosStatusFilter = v; _amosRenderFilters(); _amosRenderList(); } },
            { title: 'Grup', options: grubOptions, current: _amosGrubFilterIndividu, onSelect: v => { _amosGrubFilterIndividu = v; _amosRenderFilters(); _amosRenderList(); } }
        ]
    });
}

function _amosRenderList() {
    const wrap = document.getElementById('amos-list-wrap');
    if (!wrap) return;
    wrap.innerHTML = _amosMode === 'grup' ? _amosRenderGrupMode() : _amosRenderIndividuMode();
}

// ── MODE INDIVIDU ────────────────────────────────────────────────────────
function _amosRenderIndividuMode() {
    let data = _amosUserList;
    if (_amosSearch) {
        const q = _amosSearch.toLowerCase();
        data = data.filter(u => (u.nama || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
    }
    if (_amosStatusFilter !== 'all') data = data.filter(u => u.status === _amosStatusFilter);
    if (_amosGrubFilterIndividu === 'none') data = data.filter(u => !u.grub);
    else if (_amosGrubFilterIndividu !== 'all') data = data.filter(u => u.grub === _amosGrubFilterIndividu);

    if (!data.length) return '<div class="empty-state"><p>Tidak ada akun yang cocok dengan pencarian/filter</p></div>';
    return `<div class="section-sub" style="margin-bottom:10px">${_amosIndividuSelected.size} akun diceklis</div>` +
        data.map(u => _amosUserPickCard(u)).join('');
}

function _amosUserPickCard(u) {
    const kode = _amosUserKode(u);
    const ck = _amosIndividuSelected.has(kode);
    const grubNama = u.grub ? _amosGrubNama(u.grub) : null;
    return `<div style="padding:12px;background:rgba(19,50,89,0.03);border-radius:12px;border:1.5px solid ${ck ? 'var(--accent)' : 'rgba(19,50,89,0.08)'};margin-bottom:8px">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
            <input type="checkbox" ${ck ? 'checked' : ''} onchange="_amosToggleIndividu('${kode}',this.checked)" style="accent-color:var(--blue);width:16px;height:16px;flex-shrink:0">
            <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:13px;color:var(--blue)">${_amosEsc(u.nama)}</div>
                <div style="font-size:11px;color:var(--text-sub);display:flex;gap:6px;flex-wrap:wrap"><span>${_amosEsc(u.email)}</span>${grubNama ? `<span>· ${_amosEsc(grubNama)}</span>` : ''}</div>
            </div>
        </label>
    </div>`;
}

function _amosToggleIndividu(kode, checked) {
    if (checked) _amosIndividuSelected.add(kode); else _amosIndividuSelected.delete(kode);
    _amosRenderList();
}

// ── MODE GRUP ────────────────────────────────────────────────────────────
function _amosGrubMembers(grubKode) {
    return _amosUserList.filter(u => u.grub === grubKode).map(u => ({ kode: _amosUserKode(u), nama: u.nama, included: true }));
}

function _amosRenderGrupMode() {
    let data = _amosGrubList;
    if (_amosSearch) {
        const q = _amosSearch.toLowerCase();
        data = data.filter(g => (g.nama || '').toLowerCase().includes(q));
    }
    if (!data.length) return '<div class="empty-state"><p>Belum ada grup akun (kelola di Akun > Kelola Grup)</p></div>';
    return `<div class="section-sub" style="margin-bottom:10px">${_amosGrupSelected.size} grup diceklis</div>` +
        data.map(g => _amosGrubPickBlock(g)).join('');
}

function _amosGrubPickBlock(g) {
    const kode = _amosGrubKode(g);
    const ck = _amosGrupSelected.has(kode);
    const totalAnggota = _amosUserList.filter(u => u.grub === kode).length;
    const state = _amosGrupSelected.get(kode);
    const memberRows = ck
        ? (state.members || []).map(m => `
            <div class="ag-switch-row" style="justify-content:space-between;padding:8px 0;border-top:1px solid rgba(19,50,89,0.06)">
                <span>${_amosEsc(m.nama)}</span>
                <label class="ag-switch"><input type="checkbox" ${m.included ? 'checked' : ''} onchange="_amosToggleAnggotaGrup('${kode}','${m.kode}',this.checked)"><span class="ag-switch-slider"></span></label>
            </div>`).join('')
        : '';
    return `<div style="padding:12px;background:rgba(19,50,89,0.03);border-radius:12px;border:1.5px solid ${ck ? 'var(--accent)' : 'rgba(19,50,89,0.08)'};margin-bottom:8px">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
            <input type="checkbox" ${ck ? 'checked' : ''} onchange="_amosToggleGrup('${kode}',this.checked)" style="accent-color:var(--blue);width:16px;height:16px;flex-shrink:0">
            <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:13px;color:var(--blue)">${_amosEsc(g.nama)}</div>
                <div style="font-size:11px;color:var(--text-sub)">${totalAnggota} anggota</div>
            </div>
        </label>
        ${ck ? `<div style="margin-top:8px;padding:0 4px">${memberRows || '<div class="empty-state" style="padding:10px"><p>Grup ini belum punya anggota</p></div>'}</div>` : ''}
    </div>`;
}

function _amosToggleGrup(kode, checked) {
    if (checked) {
        if (!_amosGrupSelected.has(kode)) _amosGrupSelected.set(kode, { grub_nama: _amosGrubNama(kode), members: _amosGrubMembers(kode) });
    } else {
        _amosGrupSelected.delete(kode);
    }
    _amosRenderList();
}

function _amosToggleAnggotaGrup(grubKode, userKode, checked) {
    const state = _amosGrupSelected.get(grubKode);
    if (!state) return;
    const m = (state.members || []).find(x => x.kode === userKode);
    if (m) m.included = checked;
}

// ── SIMPAN ───────────────────────────────────────────────────────────────
function _amosSimpan() {
    if (!_amosKode) return;
    const sampel = _amodLoadSampel(_amosKode);
    if (_amosMode === 'individu') {
        sampel.individu = Array.from(_amosIndividuSelected).map(kode => {
            const u = _amosUserList.find(x => _amosUserKode(x) === kode);
            return { kode, nama: u ? u.nama : kode };
        });
    } else {
        sampel.grup = Array.from(_amosGrupSelected.entries()).map(([grub_kode, state]) => ({
            grub_kode, grub_nama: state.grub_nama, members: state.members
        }));
    }
    _amodSaveSampel(_amosKode, sampel);
    if (typeof showToast === 'function') showToast('Sampel disimpan', 'success');
    navigateTo('analisa-modul-detail');
}
