// admin/analisa/analisa-soal-sampel.js
// Halaman pemilihan TESTER MANUAL utk 1 soal, dibuka dari kartu "Sampel" di
// admin/analisa/analisa-soal-detail.js (_asdOpenSampel(mode)) lewat tombol
// "+ Tester Individu" / "+ Tester Grup". Konteks dititip di
// window._analisaSoalSampelKode (kode soal) & window._analisaSoalSampelMode
// ('individu' | 'grup') sebelum navigateTo('analisa-soal-sampel') dipanggil.
//
// BEDA DGN ALUR TOKEN: di analisa-token-detail, daftar peserta datanya
// otomatis ikut GRUP TOKEN yang dipilih (siapapun yang memakai token grup
// itu). Di sini TIDAK ADA token — admin mencari & menceklis sendiri akun
// mana saja yang jadi sampel, lewat 2 mode:
//
//   MODE 'individu': checklist per akun (search + filter Status/Grup),
//   pola kartu SAMA seperti picker soal saat Buat Modul (lihat
//   _buildModulPickCard di admin/soal/modul.js) — cuma isinya akun user,
//   bukan soal.
//
//   MODE 'grup': checklist per GRUP (Grubs, dikelola di Akun > Kelola
//   Grup) — centang 1 grup akan membuka daftar anggotanya di bawah kartu
//   grup itu, tiap anggota punya SWITCH (default menyala = diikutkan).
//   Admin bisa matikan switch anggota tertentu yang tidak mau dimasukkan
//   sbg tester, tanpa perlu keluar dari grup itu. Centang grup lain akan
//   nambah blok baru terpisah (datanya tidak tercampur antar grup).
//
// Klik "Simpan" menulis balik ke localStorage (lihat _asdSaveSampel di
// analisa-soal-detail.js) HANYA bagian yang sedang diedit (individu ATAU
// grup, sesuai window._analisaSoalSampelMode) — bagian yang lain (kalau
// ada) dibiarkan seperti sebelumnya — lalu kembali ke halaman detail soal.

// Helper baca/tulis localStorage sampel — SENGAJA diduplikasi persis sama
// dgn _asdLoadSampel/_asdSaveSampel di analisa-soal-detail.js (bukan dipanggil
// lintas file), supaya halaman ini tetap benar walau suatu saat dibuka lazy
// sendirian (mis. lewat _restoreAnalisaCtx setelah refresh langsung di
// halaman ini, tanpa analisa-soal-detail.js sempat ke-load duluan).
function _asdSampelStorageKey(kode) { return `cbn_soal_sampel_${kode}`; }
function _asdLoadSampel(kode) {
    try { return JSON.parse(localStorage.getItem(_asdSampelStorageKey(kode)) || 'null') || { individu: [], grup: [] }; }
    catch (e) { return { individu: [], grup: [] }; }
}
function _asdSaveSampel(kode, data) {
    try { localStorage.setItem(_asdSampelStorageKey(kode), JSON.stringify(data)); } catch (e) {}
}

let _assKode = null, _assMode = 'individu';
let _assSearch = '';
let _assStatusFilter = 'all', _assGrubFilterIndividu = 'all'; // filter mode individu
let _assUserList = [], _assGrubList = [];

// state ceklis mode individu: Set kode user yang diceklis
let _assIndividuSelected = new Set();
// state mode grup: Map grub_kode -> { grub_nama, members:[{kode,nama,included}] } — cuma
// berisi entry utk grup yang SEDANG diceklis/dibuka bloknya.
let _assGrupSelected = new Map();

async function renderAnalisaSoalSampel() {
    _assKode = window._analisaSoalSampelKode || null;
    _assMode = window._analisaSoalSampelMode || 'individu';
    _assSearch = ''; _assStatusFilter = 'all'; _assGrubFilterIndividu = 'all';
    const si = document.getElementById('ass-search-input'); if (si) si.value = '';

    const titleEl = document.getElementById('ass-title');
    const subEl = document.getElementById('ass-sub');
    if (titleEl) titleEl.textContent = _assMode === 'grup' ? 'Pilih Tester Grup' : 'Pilih Tester Individu';
    if (subEl) subEl.textContent = _assKode ? `Soal: ${_assKode}` : '-';

    const wrap = document.getElementById('ass-list-wrap');
    if (!_assKode) { if (wrap) wrap.innerHTML = '<div class="empty-state"><p>Soal tidak ditemukan</p></div>'; return; }

    const [users, grubs] = await Promise.all([
        UsersAPI.getByRole('user').catch(() => []),
        GrubsAPI.getAll().catch(() => [])
    ]);
    _assUserList = users || [];
    _assGrubList = grubs || [];

    const sampel = _asdLoadSampel(_assKode);
    if (_assMode === 'individu') {
        _assIndividuSelected = new Set((sampel.individu || []).map(u => u.kode));
    } else {
        _assGrupSelected = new Map();
        (sampel.grup || []).forEach(g => _assGrupSelected.set(g.grub_kode, { grub_nama: g.grub_nama, members: (g.members || []).map(m => ({ ...m })) }));
    }

    _assRenderFilters();
    _assRenderList();
}

function _assEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function _assUserKode(u) { return u.kode || u.id; }
function _assGrubKode(g) { return g.kode || g.id; }
function _assGrubNama(kode) { const g = _assGrubList.find(x => _assGrubKode(x) === kode); return g ? g.nama : kode; }

// ── FILTER (dropdown) — cuma dipakai di mode individu: Status akun & Grup
// asal akun (bukan grup TESTER yang lagi dipilih — ini cuma filter pencarian).
function _assRenderFilters() {
    const el = document.getElementById('ass-filters');
    if (!el) return;
    if (_assMode !== 'individu') { el.innerHTML = ''; return; }
    const statusOptions = [{ value: 'all', label: 'Semua Status' }, { value: 'aktif', label: 'Aktif' }, { value: 'nonaktif', label: 'Nonaktif' }];
    const grubOptions = [{ value: 'all', label: 'Semua Grup' }, { value: 'none', label: 'Tanpa Grup' }, ..._assGrubList.map(g => ({ value: _assGrubKode(g), label: g.nama }))];
    renderFilterDropdown('ass-filters', {
        title: 'Filter', groups: [
            { title: 'Status', options: statusOptions, current: _assStatusFilter, onSelect: v => { _assStatusFilter = v; _assRenderFilters(); _assRenderList(); } },
            { title: 'Grup', options: grubOptions, current: _assGrubFilterIndividu, onSelect: v => { _assGrubFilterIndividu = v; _assRenderFilters(); _assRenderList(); } }
        ]
    });
}

function _assRenderList() {
    const wrap = document.getElementById('ass-list-wrap');
    if (!wrap) return;
    wrap.innerHTML = _assMode === 'grup' ? _assRenderGrupMode() : _assRenderIndividuMode();
}

// ── MODE INDIVIDU ────────────────────────────────────────────────────────
function _assRenderIndividuMode() {
    let data = _assUserList;
    if (_assSearch) {
        const q = _assSearch.toLowerCase();
        data = data.filter(u => (u.nama || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
    }
    if (_assStatusFilter !== 'all') data = data.filter(u => u.status === _assStatusFilter);
    if (_assGrubFilterIndividu === 'none') data = data.filter(u => !u.grub);
    else if (_assGrubFilterIndividu !== 'all') data = data.filter(u => u.grub === _assGrubFilterIndividu);

    if (!data.length) return '<div class="empty-state"><p>Tidak ada akun yang cocok dengan pencarian/filter</p></div>';
    return `<div class="section-sub" style="margin-bottom:10px">${_assIndividuSelected.size} akun diceklis</div>` +
        data.map(u => _assUserPickCard(u)).join('');
}

function _assUserPickCard(u) {
    const kode = _assUserKode(u);
    const ck = _assIndividuSelected.has(kode);
    const grubNama = u.grub ? _assGrubNama(u.grub) : null;
    return `<div style="padding:12px;background:rgba(19,50,89,0.03);border-radius:12px;border:1.5px solid ${ck ? 'var(--accent)' : 'rgba(19,50,89,0.08)'};margin-bottom:8px">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
            <input type="checkbox" ${ck ? 'checked' : ''} onchange="_assToggleIndividu('${kode}',this.checked)" style="accent-color:var(--blue);width:16px;height:16px;flex-shrink:0">
            <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:13px;color:var(--blue)">${_assEsc(u.nama)}</div>
                <div style="font-size:11px;color:var(--text-sub);display:flex;gap:6px;flex-wrap:wrap"><span>${_assEsc(u.email)}</span>${grubNama ? `<span>· ${_assEsc(grubNama)}</span>` : ''}</div>
            </div>
        </label>
    </div>`;
}

function _assToggleIndividu(kode, checked) {
    if (checked) _assIndividuSelected.add(kode); else _assIndividuSelected.delete(kode);
    // Cuma perlu update badge hitungan di atas + border kartu — render ulang seluruh
    // list biar sederhana (jumlah data tidak besar, pola sama spt toggleModulSoal).
    _assRenderList();
}

// ── MODE GRUP ────────────────────────────────────────────────────────────
function _assGrubMembers(grubKode) {
    return _assUserList.filter(u => u.grub === grubKode).map(u => ({ kode: _assUserKode(u), nama: u.nama, included: true }));
}

function _assRenderGrupMode() {
    let data = _assGrubList;
    if (_assSearch) {
        const q = _assSearch.toLowerCase();
        data = data.filter(g => (g.nama || '').toLowerCase().includes(q));
    }
    if (!data.length) return '<div class="empty-state"><p>Belum ada grup akun (kelola di Akun > Kelola Grup)</p></div>';
    return `<div class="section-sub" style="margin-bottom:10px">${_assGrupSelected.size} grup diceklis</div>` +
        data.map(g => _assGrubPickBlock(g)).join('');
}

function _assGrubPickBlock(g) {
    const kode = _assGrubKode(g);
    const ck = _assGrupSelected.has(kode);
    const totalAnggota = _assUserList.filter(u => u.grub === kode).length;
    const state = _assGrupSelected.get(kode);
    const memberRows = ck
        ? (state.members || []).map(m => `
            <div class="ag-switch-row" style="justify-content:space-between;padding:8px 0;border-top:1px solid rgba(19,50,89,0.06)">
                <span>${_assEsc(m.nama)}</span>
                <label class="ag-switch"><input type="checkbox" ${m.included ? 'checked' : ''} onchange="_assToggleAnggotaGrup('${kode}','${m.kode}',this.checked)"><span class="ag-switch-slider"></span></label>
            </div>`).join('')
        : '';
    return `<div style="padding:12px;background:rgba(19,50,89,0.03);border-radius:12px;border:1.5px solid ${ck ? 'var(--accent)' : 'rgba(19,50,89,0.08)'};margin-bottom:8px">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
            <input type="checkbox" ${ck ? 'checked' : ''} onchange="_assToggleGrup('${kode}',this.checked)" style="accent-color:var(--blue);width:16px;height:16px;flex-shrink:0">
            <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:13px;color:var(--blue)">${_assEsc(g.nama)}</div>
                <div style="font-size:11px;color:var(--text-sub)">${totalAnggota} anggota</div>
            </div>
        </label>
        ${ck ? `<div style="margin-top:8px;padding:0 4px">${memberRows || '<div class="empty-state" style="padding:10px"><p>Grup ini belum punya anggota</p></div>'}</div>` : ''}
    </div>`;
}

function _assToggleGrup(kode, checked) {
    if (checked) {
        // Baru pertama kali diceklis di sesi ini -> ambil anggota LIVE dari data user
        // (bukan dari state lama), semua default diikutkan (included:true).
        if (!_assGrupSelected.has(kode)) _assGrupSelected.set(kode, { grub_nama: _assGrubNama(kode), members: _assGrubMembers(kode) });
    } else {
        _assGrupSelected.delete(kode);
    }
    _assRenderList();
}

function _assToggleAnggotaGrup(grubKode, userKode, checked) {
    const state = _assGrupSelected.get(grubKode);
    if (!state) return;
    const m = (state.members || []).find(x => x.kode === userKode);
    if (m) m.included = checked;
    // Tidak perlu render ulang seluruh list (cukup switch-nya sendiri yg berubah
    // secara visual lewat CSS :checked) — dibiarkan apa adanya spy tidak reset
    // posisi scroll tiap toggle satu anggota.
}

// ── SIMPAN ───────────────────────────────────────────────────────────────
function _assSimpan() {
    if (!_assKode) return;
    const sampel = _asdLoadSampel(_assKode);
    if (_assMode === 'individu') {
        sampel.individu = Array.from(_assIndividuSelected).map(kode => {
            const u = _assUserList.find(x => _assUserKode(x) === kode);
            return { kode, nama: u ? u.nama : kode };
        });
    } else {
        sampel.grup = Array.from(_assGrupSelected.entries()).map(([grub_kode, state]) => ({
            grub_kode, grub_nama: state.grub_nama, members: state.members
        }));
    }
    _asdSaveSampel(_assKode, sampel);
    if (typeof showToast === 'function') showToast('Sampel disimpan', 'success');
    navigateTo('analisa-soal-detail');
}
