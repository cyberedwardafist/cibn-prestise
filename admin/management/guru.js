// ── MANAGEMENT > GURU (admin/management/guru.html) ──
// renderManagementGuru() dipanggil oleh renderPage() di js/app.js lewat
// map['management-guru'] = 'renderManagementGuru'.
//
// Sumber data:
//   - GuruPaketGrupAPI  -> tabel guru_paket_grup (grup: nama + akun_list + paket_list)
//   - UsersAPI.getByRole('review') -> akun guru/review (role='review' di tabel users)
//   - PaketAPI          -> tabel pakets (paket keanggotaan, dikelola di Keuangan)
//
// Ketiganya disimpan di variabel modul-level supaya bisa dipakai ulang oleh
// guru-paket-form.js & guru-paket-detail.js tanpa fetch berkali-kali (dibaca
// lewat fungsi _guruEnsureData() yang dipanggil dari kedua file itu juga).

let _guruGrupData = [], _guruReviewUsers = [], _guruPakets = [], _guruDataLoaded = false;

function _gEsc(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function _gEscHtml(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

// Dipanggil dari renderManagementGuru() DAN dari guru-paket-form.js/guru-paket-detail.js
// (keduanya bisa saja dibuka langsung tanpa pernah mampir ke slide GURU dulu, mis. lewat
// reload halaman di tengah alur — lihat _persistAdminNav). force=true dipakai setelah
// simpan/hapus grup supaya list-nya pasti sinkron.
async function _guruEnsureData(force) {
    if (_guruDataLoaded && !force) return;
    [_guruGrupData, _guruReviewUsers, _guruPakets] = await Promise.all([
        GuruPaketGrupAPI.getAll().catch(() => []),
        UsersAPI.getByRole('review').catch(() => []),
        PaketAPI.getAll().catch(() => [])
    ]);
    _guruDataLoaded = true;
}

async function renderManagementGuru() {
    await _guruEnsureData(true);
    document.getElementById('guru-top-search-input').value = '';
    document.getElementById('guru-top-search-results').style.display = 'none';
    _renderGuruPaketGrupList();
}

function _guruAkunNama(kode) { const u = _guruReviewUsers.find(x => x.kode === kode); return u ? u.nama : null; }
function _guruPaketNama(kode) { const p = _guruPakets.find(x => x.kode === kode); return p ? p.nama : null; }

// ── LIST UTAMA — dikelompokkan PER PAKET. Grup tanpa paket sama sekali
//    (paket_list kosong) ditaruh di bagian "Belum Ditautkan ke Paket" paling
//    bawah supaya tetap kelihatan (bukan hilang begitu saja). ──
function _renderGuruPaketGrupList() {
    const wrap = document.getElementById('guru-paket-grup-list');
    const empty = document.getElementById('mgmt-guru-empty');
    if (!wrap) return;

    if (!_guruGrupData.length) {
        wrap.innerHTML = '';
        empty.style.display = '';
        return;
    }
    empty.style.display = 'none';

    // paketKode -> [grup, grup, ...] (satu grup bisa nongol di banyak paket)
    const byPaket = new Map();
    const tanpaPaket = [];
    _guruGrupData.forEach(g => {
        const list = g.paket_list || [];
        if (!list.length) { tanpaPaket.push(g); return; }
        list.forEach(pk => { if (!byPaket.has(pk)) byPaket.set(pk, []); byPaket.get(pk).push(g); });
    });

    // Urutkan section sesuai urutan paket di Keuangan (bukan urutan kemunculan),
    // paket yang tidak lagi ada tetap ditampilkan pakai kodenya sbg fallback nama.
    const sections = [];
    _guruPakets.forEach(p => { if (byPaket.has(p.kode)) sections.push({ nama: p.nama, kode: p.kode, items: byPaket.get(p.kode) }); });
    byPaket.forEach((items, kode) => { if (!_guruPakets.some(p => p.kode === kode)) sections.push({ nama: kode, kode, items }); });

    let html = sections.map(sec => `
      <div style="margin-top:18px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span class="badge" style="background:rgba(19,50,89,0.08);color:var(--blue);font-size:12px">\u{1F4E6} ${_gEscHtml(sec.nama)}</span>
          <span style="font-size:11px;color:var(--text-sub)">${sec.items.length} grup</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">${sec.items.map(g => _guruGrupCardHtml(g)).join('')}</div>
      </div>`).join('');

    if (tanpaPaket.length) {
        html += `
      <div style="margin-top:18px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span class="badge" style="background:rgba(19,50,89,0.08);color:var(--text-sub);font-size:12px">Belum Ditautkan ke Paket</span>
          <span style="font-size:11px;color:var(--text-sub)">${tanpaPaket.length} grup</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">${tanpaPaket.map(g => _guruGrupCardHtml(g)).join('')}</div>
      </div>`;
    }

    wrap.innerHTML = html;
}

function _guruGrupCardHtml(g) {
    const kode = g.kode;
    const jumlahGuru = (g.akun_list || []).length;
    const namaTampil = g.nama_internal ? `${_gEscHtml(g.nama)} <span style="font-weight:400;color:var(--text-sub)">| ${_gEscHtml(g.nama_internal)}</span>` : _gEscHtml(g.nama);
    return `<div class="modul-card" style="cursor:pointer" onclick="openManagementGuruPaketDetail('${_gEsc(kode)}')">
      <div class="modul-card-left">
        <div class="modul-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
        <div><div style="font-weight:700;font-size:14px;color:var(--blue)">${namaTampil}</div><div style="font-size:11px;color:var(--text-sub)">${jumlahGuru} akun guru/review \u00B7 ${kode}</div></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-icon" onclick="event.stopPropagation();openEditGuruPaketGrup('${_gEsc(kode)}')" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="btn-icon danger" onclick="event.stopPropagation();deleteGuruPaketGrup('${_gEsc(kode)}','${_gEsc(g.nama)}')" title="Hapus"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
      </div>
    </div>`;
}

// ── Tombol "+ Paket" & aksi kartu ──
function openAddGuruPaketGrup() { window._guruPaketEditKode = null; navigateTo('management-guru-paket'); }
function openEditGuruPaketGrup(kode) { window._guruPaketEditKode = kode; navigateTo('management-guru-paket'); }
function openManagementGuruPaketDetail(kode) { window._guruPaketDetailKode = kode; navigateTo('management-guru-paket-detail'); }

function deleteGuruPaketGrup(kode, nama) {
    showConfirm('Hapus Grup', `Hapus grup "${nama}"? Guru/review & paketnya tidak ikut terhapus, cuma tautannya saja.`, 'danger', async () => {
        try {
            await GuruPaketGrupAPI.delete(kode);
            showToast('Grup berhasil dihapus', 'success');
            await _guruEnsureData(true);
            _renderGuruPaketGrupList();
        } catch (e) { showToast(e.message || 'Gagal menghapus grup', 'danger'); }
    });
}

// ── SEARCH BAR ATAS (cari nama guru/review ATAU nama grup/paket sekaligus) ──
// - Kalau query cocok ke nama grup/paket -> dropdown berisi grup2 itu, klik langsung buka detailnya.
// - Kalau query cocok ke nama guru/review -> dropdown berisi nama guru itu + baris
//   "Ikut di paket: ...". Klik: kalau guru itu cuma ada di 1 grup, langsung navigateTo
//   ke detail grup itu; kalau di >1 grup, buka popup (#guru-pilih-grup-overlay) suruh pilih.
function _guruGrupsForAkunKode(akunKode) { return _guruGrupData.filter(g => (g.akun_list || []).includes(akunKode)); }

function _guruTopSearchInput(val) {
    const q = (val || '').trim().toLowerCase();
    const resWrap = document.getElementById('guru-top-search-results');
    if (!q) { resWrap.style.display = 'none'; resWrap.innerHTML = ''; return; }

    // 1) cocokkan ke nama grup/paket dulu
    const matchGrup = _guruGrupData.filter(g => (g.nama || '').toLowerCase().includes(q) || (g.nama_internal || '').toLowerCase().includes(q));
    const matchPaketKode = _guruPakets.filter(p => (p.nama || '').toLowerCase().includes(q)).map(p => p.kode);
    const matchGrupByPaket = _guruGrupData.filter(g => (g.paket_list || []).some(pk => matchPaketKode.includes(pk)));
    const grupHits = Array.from(new Set([...matchGrup, ...matchGrupByPaket]));

    // 2) cocokkan ke nama guru/review
    const guruHits = _guruReviewUsers.filter(u => (u.nama || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));

    if (!grupHits.length && !guruHits.length) {
        resWrap.style.display = '';
        resWrap.innerHTML = `<div style="padding:14px;font-size:12px;color:var(--text-sub);text-align:center">Tidak ada guru/review maupun grup/paket yang cocok.</div>`;
        return;
    }

    let html = '';
    if (grupHits.length) {
        html += `<div style="padding:8px 12px 2px;font-size:10px;font-weight:700;color:var(--text-sub);text-transform:uppercase;letter-spacing:.06em">Grup / Paket</div>`;
        html += grupHits.map(g => {
            const paketNama = (g.paket_list || []).map(pk => _guruPaketNama(pk) || pk).join(', ') || '-';
            return `<div class="search-result-item" style="padding:9px 12px;cursor:pointer;border-top:1px solid rgba(19,50,89,0.06)" onclick="_guruTopSearchGoToGrup('${_gEsc(g.kode)}')">
              <div style="font-weight:600;font-size:13px;color:var(--blue)">${_gEscHtml(g.nama)}</div>
              <div style="font-size:11px;color:var(--text-sub)">Paket: ${_gEscHtml(paketNama)}</div>
            </div>`;
        }).join('');
    }
    if (guruHits.length) {
        html += `<div style="padding:8px 12px 2px;font-size:10px;font-weight:700;color:var(--text-sub);text-transform:uppercase;letter-spacing:.06em">Guru / Review</div>`;
        html += guruHits.map(u => {
            const grups = _guruGrupsForAkunKode(u.kode);
            const paketNamaList = Array.from(new Set(grups.flatMap(g => (g.paket_list || []).map(pk => _guruPaketNama(pk) || pk))));
            const sub = grups.length ? `Ikut di paket: ${_gEscHtml(paketNamaList.join(', ') || '-')}` : 'Belum ada di grup/paket manapun';
            return `<div class="search-result-item" style="padding:9px 12px;cursor:pointer;border-top:1px solid rgba(19,50,89,0.06)" onclick="_guruTopSearchClickAkun('${_gEsc(u.kode)}')">
              <div style="font-weight:600;font-size:13px;color:var(--blue)">${_gEscHtml(u.nama)}</div>
              <div style="font-size:11px;color:var(--text-sub)">${sub}</div>
            </div>`;
        }).join('');
    }
    resWrap.innerHTML = html;
    resWrap.style.display = '';
}

function _guruTopSearchGoToGrup(kode) {
    document.getElementById('guru-top-search-results').style.display = 'none';
    openManagementGuruPaketDetail(kode);
}

function _guruTopSearchClickAkun(akunKode) {
    document.getElementById('guru-top-search-results').style.display = 'none';
    const grups = _guruGrupsForAkunKode(akunKode);
    if (!grups.length) { showToast('Guru/review ini belum ada di grup/paket manapun', 'warning'); return; }
    if (grups.length === 1) { openManagementGuruPaketDetail(grups[0].kode); return; }
    _guruOpenPilihGrupPopup(akunKode, grups);
}

// Popup "pilih mau buka ke grup/paket yang mana" (#guru-pilih-grup-overlay, guru-modals.html)
// — cuma dipakai kalau 1 akun guru/review nyangkut di >1 grup.
function _guruOpenPilihGrupPopup(akunKode, grups) {
    const nama = _guruAkunNama(akunKode) || akunKode;
    document.getElementById('guru-pilih-grup-title').textContent = `${nama} \u2014 Pilih Paket`;
    document.getElementById('guru-pilih-grup-list').innerHTML = grups.map(g => {
        const paketNama = (g.paket_list || []).map(pk => _guruPaketNama(pk) || pk).join(', ') || 'Belum ditautkan paket';
        return `<div class="modul-card" style="cursor:pointer" onclick="closeModal('guru-pilih-grup-overlay');openManagementGuruPaketDetail('${_gEsc(g.kode)}')">
          <div class="modul-card-left"><div><div style="font-weight:700;font-size:13px;color:var(--blue)">${_gEscHtml(g.nama)}</div><div style="font-size:11px;color:var(--text-sub)">${_gEscHtml(paketNama)}</div></div></div>
        </div>`;
    }).join('');
    openModal('guru-pilih-grup-overlay');
}

// Tutup dropdown hasil pencarian kalau klik di luar search-bar
document.addEventListener('click', (e) => {
    const wrap = document.getElementById('guru-top-search-results');
    const input = document.getElementById('guru-top-search-input');
    if (!wrap || wrap.style.display === 'none') return;
    if (e.target === input || wrap.contains(e.target)) return;
    wrap.style.display = 'none';
});