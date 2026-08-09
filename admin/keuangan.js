// admin/keuangan.js
// Modul KEUANGAN (paket/harga, gateway, transaksi) — lazy-load saat tab Keuangan dibuka.
// (populateLinkLandingDropdown versi lama di sini TIDAK dipindah — dead code,
// selalu ketiban definisi lain yang dimuat belakangan di shell index_admin.html)
// Bergantung pada helper global dari js/app.js (showToast, openModal, navigateTo, dst)
// yang sudah dimuat lebih dulu lewat shell index_admin.html.

function renderKeuangan() {
    // _keuanganSub dideklarasikan (let) di admin/landing.js — kalau tab Landing
    // belum pernah dibuka, identifier itu belum exist sama sekali, jadi jangan
    // baca langsung (ReferenceError). typeof aman dipakai untuk identifier
    // yang belum pernah dideklarasikan.
    renderKeuanganSub(typeof _keuanganSub !== 'undefined' ? _keuanganSub : 'paket');
}

function renderKeuanganSub(sub) {
    _keuanganSub = sub;
    document.querySelectorAll('#page-keuangan .sub-tab').forEach(t => t.classList.toggle('active', t.dataset.sub === sub));
    document.querySelectorAll('#page-keuangan .sub-page').forEach(p => p.classList.toggle('active', p.id === `sub-keuangan-${sub}`));
    if (sub === 'paket') renderPaketGrid();
    else if (sub === 'gateway') loadGatewayConfig();
    else if (sub === 'transaksi') renderTrxList();
}

// ── PAKET (disimpan ke server /api/pakets) ──
async function renderPaketGrid() {
    const grid = document.getElementById('paket-grid');
    if (!grid) return;
    grid.innerHTML = `<div style="grid-column:1/-1;padding:32px;text-align:center;color:var(--text-sub)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28" style="animation:spin 1s linear infinite;display:block;margin:0 auto 8px"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><p style="font-size:13px">Memuat paket...</p></div>`;

    // Muat paket keuangan dari server
    _paketData = await PaketAPI.getAll().catch(() => []);

    // Muat paket landing dari server (untuk badge link)
    try {
        const landingData = await LandingAPI.get().catch(() => ({}));
        _ldPaketCache = (landingData && landingData.paket && landingData.paket.list) ? landingData.paket.list : [];
    } catch(e) { _ldPaketCache = []; }

    if (!_paketData.length) {
        grid.innerHTML = `<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--text-sub)"><div style="font-size:3rem;margin-bottom:12px">💎</div><p style="font-weight:600;margin-bottom:6px">Belum ada paket harga</p><p style="font-size:12px">Klik "+ Paket Baru" untuk mulai membuat paket</p></div>`;
        return;
    }

    grid.innerHTML = _paketData.map((p, i) => {
        const fiturList = (p.fitur || '').split('\n').filter(f => f.trim()).map(f => `<li>${f}</li>`).join('');
        const colorMap = { gold: '#b8860b', green: '#16a34a', purple: '#7c3aed', blue: '#133259' };
        const accentColor = colorMap[p.warna] || colorMap.blue;
        const hakList = Array.isArray(p.hak_akses) ? p.hak_akses : (p.hak_akses ? JSON.parse(p.hak_akses) : []);
        const hakBadges = hakList.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">${hakList.map(h=>
            `<span style="font-size:9px;font-weight:600;padding:2px 7px;border-radius:10px;background:rgba(19,50,89,0.07);color:var(--blue)">${h}</span>`
        ).join('')}</div>` : '';
        // Tampilkan nama paket landing yang terhubung
        let linkBadge = '';
        if (p.link_landing) {
            const linkedLdPaket = _ldPaketCache.find((lp, idx) => (lp.kode || ('ldp_'+idx)) === p.link_landing || lp.name === p.link_landing);
            const linkLabel = linkedLdPaket ? linkedLdPaket.name : p.link_landing;
            linkBadge = `<div style="margin-top:8px;font-size:10px;background:rgba(26,90,160,0.08);border:1px solid rgba(26,90,160,0.2);border-radius:8px;padding:4px 8px;display:flex;align-items:center;gap:5px;color:var(--accent)">🔗 <span>Terhubung ke paket landing: <strong>${linkLabel}</strong></span></div>`;
        }
        return `<div class="paket-card-admin ${p.popular ? 'popular' : ''}" style="animation:fadeUp 0.3s ${i * 0.06}s both;border-color:${p.popular ? accentColor : ''}">
            ${p.popular ? `<span class="paket-badge-popular" style="background:linear-gradient(90deg,${accentColor},${accentColor}cc)">⭐ PALING POPULER</span>` : ''}
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <div style="font-size:2rem">${p.icon || '📦'}</div>
                <div style="display:flex;gap:6px">
                    <button class="btn-icon" onclick="openEditPaket('${p.kode||p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                    <button class="btn-icon danger" onclick="deletePaket('${p.kode||p.id}','${p.nama}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
                </div>
            </div>
            <div style="font-family:var(--font-head);font-size:15px;font-weight:700;color:var(--blue);margin-bottom:2px">${p.nama || 'Paket'}</div>
            <div style="font-size:10px;color:var(--text-sub);margin-bottom:6px;font-family:monospace">${p.kode||''}</div>
            <div style="font-size:11px;color:var(--text-sub);margin-bottom:10px">${p.deskripsi || p.desc || ''}</div>
            <div style="display:flex;align-items:baseline;gap:4px;margin-bottom:10px">
                <span class="paket-price" style="color:${accentColor}">Rp ${parseInt(p.harga || 0).toLocaleString('id-ID')}</span>
                <span class="paket-period">${p.periode || (p.periode_tipe ? '/'+p.periode_tipe : '/bulan')}</span>
            </div>
            <ul class="paket-features">${fiturList}</ul>
            ${hakBadges}
            ${linkBadge}
        </div>`;
    }).join('');
}

let _editPaketKode = null;
async function openAddPaket() {
    _editPaketKode = null;
    document.getElementById('paket-form-title').textContent = 'Tambah Paket';
    document.getElementById('pf-id').value = '';
    document.getElementById('pf-nama').value = '';
    document.getElementById('pf-icon').value = '📦';
    document.getElementById('pf-harga').value = '';
    document.getElementById('pf-periode').value = '/bulan';
    document.getElementById('pf-desc').value = '';
    document.getElementById('pf-fitur').value = '';
    document.getElementById('pf-warna').value = 'blue';
    document.getElementById('pf-popular').checked = false;
    var _ci = document.getElementById('pf-periode-custom'); if(_ci){_ci.style.display='none';_ci.value='';}
    document.querySelectorAll('input[name="pf-hak"]').forEach(cb=>cb.checked=false);
    document.querySelectorAll('input[name="pf-aturan"]').forEach(cb=>cb.checked=false);
    document.querySelectorAll('.hak-sub').forEach(s=>{s.style.display='none';});
    document.querySelectorAll('.hak-chevron').forEach(c=>{c.style.transform='';});
    var mn=document.getElementById('pf-maks-ujian');if(mn)mn.value='';
    var dh=document.getElementById('pf-durasi-hari');if(dh)dh.value='';
    var hn=document.getElementById('pf-hak-notes');if(hn)hn.value='';
    await _populateLinkLandingDropdown('');
    openModal('paket-form-overlay');
}

async function openEditPaket(kode) {
    const p = _paketData.find(x => (x.kode||x.id) == kode);
    if (!p) return;
    _editPaketKode = kode;
    document.getElementById('paket-form-title').textContent = 'Edit Paket';
    document.getElementById('pf-id').value = kode;
    document.getElementById('pf-nama').value = p.nama || '';
    document.getElementById('pf-icon').value = p.icon || '📦';
    document.getElementById('pf-harga').value = p.harga || '';
    var _pOpts = ['/bulan','/tahun','/hari','sekali bayar'];
    var _pVal = p.periode || (p.periode_tipe ? '/'+p.periode_tipe : '/bulan');
    var _pEl = document.getElementById('pf-periode');
    var _cEl = document.getElementById('pf-periode-custom');
    if(_pOpts.includes(_pVal)){if(_pEl)_pEl.value=_pVal;if(_cEl){_cEl.style.display='none';_cEl.value='';}}
    else{if(_pEl)_pEl.value='custom';if(_cEl){_cEl.style.display='block';_cEl.value=_pVal;}}
    document.getElementById('pf-desc').value = p.deskripsi || p.desc || '';
    document.getElementById('pf-fitur').value = Array.isArray(p.fitur) ? p.fitur.join('\n') : (p.fitur || '');
    document.getElementById('pf-warna').value = p.warna || 'blue';
    document.getElementById('pf-popular').checked = !!p.popular;
    const hakArr = Array.isArray(p.hak_akses) ? p.hak_akses : (p.hak_akses ? (() => { try { return JSON.parse(p.hak_akses); } catch(e) { return []; } })() : []);
    const aturanArr = Array.isArray(p.aturan_akses) ? p.aturan_akses : (p.aturan_akses ? (() => { try { return JSON.parse(p.aturan_akses); } catch(e) { return []; } })() : []);
    document.querySelectorAll('input[name="pf-hak"]').forEach(cb=>{cb.checked=hakArr.includes(cb.value);});
    document.querySelectorAll('input[name="pf-aturan"]').forEach(cb=>{cb.checked=aturanArr.includes(cb.value);});
    document.querySelectorAll('.hak-sub').forEach(s=>{s.style.display='none';});
    document.querySelectorAll('.hak-chevron').forEach(c=>{c.style.transform='';});
    var mn=document.getElementById('pf-maks-ujian');if(mn)mn.value=p.maks_ujian||'';
    var dh=document.getElementById('pf-durasi-hari');if(dh)dh.value=p.durasi_hari||'';
    var hn=document.getElementById('pf-hak-notes');if(hn)hn.value=p.hak_notes||'';
    await _populateLinkLandingDropdown(p.link_landing || '');
    openModal('paket-form-overlay');
}

// Populate dropdown link ke paket landing (membaca dari server)
async function _populateLinkLandingDropdown(currentVal) {
    const sel = document.getElementById('pf-link-landing');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Tidak dihubungkan / berdiri sendiri --</option>';
    // Muat paket landing dari server jika belum ada
    if (!_ldPaketCache.length) {
        try {
            const ld = await LandingAPI.get().catch(() => ({}));
            _ldPaketCache = (ld && ld.paket && ld.paket.list) ? ld.paket.list : [];
        } catch(e) { _ldPaketCache = []; }
    }
    if (_ldPaketCache.length) {
        _ldPaketCache.forEach((p, i) => {
            const val = p.kode || ('ldp_' + i);
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = (p.name || 'Paket ' + (i+1)) + (p.price ? ' · ' + p.price : '');
            if (currentVal && currentVal === val) opt.selected = true;
            sel.appendChild(opt);
        });
    } else {
        const opt = document.createElement('option');
        opt.disabled = true;
        opt.textContent = '(Belum ada paket di Landing Page Editor)';
        sel.appendChild(opt);
    }
    // Tetap support fungsi lama yang dipanggil dari index_admin.html
    if (typeof populateLinkLandingDropdown === 'function' && populateLinkLandingDropdown !== _populateLinkLandingDropdown) {
        // sudah di-override, tidak perlu panggil lagi
    }
}

// (Catatan: versi populateLinkLandingDropdown non-underscore yang tadinya ada di
// sini DIHAPUS saat pemecahan modul. Versi itu sebelumnya sudah jadi dead code —
// tertimpa definisi lain yang dimuat belakangan di shell index_admin.html — jadi
// menyimpannya di sini justru akan mengubah perilaku aslinya karena modul ini
// sekarang dimuat lazy, bisa jauh setelah shell selesai load.)

async function submitPaket() {
    const nama = document.getElementById('pf-nama').value.trim();
    if (!nama) { showToast('Nama paket wajib diisi', 'danger'); return; }
    const hak_akses = [...document.querySelectorAll('input[name="pf-hak"]:checked')].map(cb=>cb.value);
    const aturan_akses = [...document.querySelectorAll('input[name="pf-aturan"]:checked')].map(cb=>cb.value);
    const periodeVal = (function(){
        var sel = document.getElementById('pf-periode').value;
        if (sel === 'custom') { var c = document.getElementById('pf-periode-custom'); return (c && c.value.trim()) ? c.value.trim() : '/bulan'; }
        return sel;
    })();
    // Hitung periode_hari dari periodeVal
    const periodeToHari = {'/hari':1,'/minggu':7,'/bulan':30,'/tahun':365,'sekali bayar':36500};
    const periode_hari = periodeToHari[periodeVal] || 30;
    const paket = {
        nama,
        deskripsi: document.getElementById('pf-desc').value.trim(),
        icon: document.getElementById('pf-icon').value.trim() || '📦',
        harga: parseInt(document.getElementById('pf-harga').value || '0'),
        periode: periodeVal,
        periode_tipe: periodeVal.replace('/','').split(' ')[0] || 'bulan',
        periode_hari,
        fitur: document.getElementById('pf-fitur').value.trim(),
        warna: document.getElementById('pf-warna').value,
        popular: document.getElementById('pf-popular').checked,
        status: 'aktif',
        link_landing: (document.getElementById('pf-link-landing')?.value || ''),
        hak_akses: JSON.stringify(hak_akses),
        aturan_akses: JSON.stringify(aturan_akses),
        maks_ujian: document.getElementById('pf-maks-ujian')?.value || '',
        durasi_hari: document.getElementById('pf-durasi-hari')?.value || '',
        hak_notes: document.getElementById('pf-hak-notes')?.value?.trim() || ''
    };
    const btn = document.querySelector('#paket-form-overlay .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
    try {
        if (_editPaketKode) {
            await PaketAPI.update(_editPaketKode, paket);
            showToast('Paket diperbarui!', 'success');
        } else {
            await PaketAPI.create(paket);
            showToast('Paket ditambahkan!', 'success');
        }
        clearDirty();
        closeModal('paket-form-overlay');
        await renderPaketGrid();
    } catch(e) {
        showToast('Gagal: ' + e.message, 'danger');
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Simpan Paket'; }
}

function deletePaket(kode, nama) {
    showConfirm('Hapus Paket', `Yakin hapus paket "${nama}"?`, 'danger', async () => {
        try {
            await PaketAPI.delete(kode);
            showToast('Paket dihapus', 'danger');
            await renderPaketGrid();
        } catch(e) { showToast('Gagal hapus: ' + e.message, 'danger'); }
    });
}

// ── GATEWAY CONFIG ──
const GW_KEY = 'cbn_gateway_config';
function loadGatewayConfig() {
    try {
        const cfg = JSON.parse(localStorage.getItem(GW_KEY) || '{}');
        const msk = document.getElementById('gw-midtrans-sk');
        const mck = document.getElementById('gw-midtrans-ck');
        const xsk = document.getElementById('gw-xendit-sk');
        const xpk = document.getElementById('gw-xendit-pk');
        if (msk) msk.value = cfg.midtrans_sk || '';
        if (mck) mck.value = cfg.midtrans_ck || '';
        if (xsk) xsk.value = cfg.xendit_sk || '';
        if (xpk) xpk.value = cfg.xendit_pk || '';
        if (cfg.midtrans_mode) {
            const radio = document.querySelector(`input[name="midtrans-mode"][value="${cfg.midtrans_mode}"]`);
            if (radio) radio.checked = true;
        }
    } catch(e) {}
}
function saveGateway(provider) {
    try {
        const cfg = JSON.parse(localStorage.getItem(GW_KEY) || '{}');
        if (provider === 'midtrans') {
            cfg.midtrans_sk = document.getElementById('gw-midtrans-sk')?.value || '';
            cfg.midtrans_ck = document.getElementById('gw-midtrans-ck')?.value || '';
            cfg.midtrans_mode = document.querySelector('input[name="midtrans-mode"]:checked')?.value || 'sandbox';
        } else if (provider === 'xendit') {
            cfg.xendit_sk = document.getElementById('gw-xendit-sk')?.value || '';
            cfg.xendit_pk = document.getElementById('gw-xendit-pk')?.value || '';
        }
        localStorage.setItem(GW_KEY, JSON.stringify(cfg));
        clearDirty();
        showToast(`Konfigurasi ${provider} disimpan!`, 'success');
    } catch(e) { showToast('Gagal menyimpan', 'danger'); }
}

// ── TRANSAKSI ──
let _trxData = [], _trxSearch = '', _trxStatusFilter = '', _trxPage = 1;
function renderTrxList() {
    // Contoh data demo — nanti ganti dengan API call
    _trxData = JSON.parse(localStorage.getItem('cbn_transaksi') || '[]');
    filterTrx();
}
function filterTrx() {
    _trxSearch = (document.getElementById('trx-search')?.value || '').toLowerCase();
    _trxStatusFilter = document.getElementById('trx-status-filter')?.value || '';
    let data = _trxData;
    if (_trxSearch) data = data.filter(t =>
        (t.email || '').toLowerCase().includes(_trxSearch) ||
        (t.paket || '').toLowerCase().includes(_trxSearch));
    if (_trxStatusFilter) data = data.filter(t => t.status === _trxStatusFilter);
    const tb = document.getElementById('trx-tbody');
    if (!tb) return;
    const PER = 20, total = data.length, totalPg = Math.max(1, Math.ceil(total / PER));
    if (_trxPage > totalPg) _trxPage = 1;
    const slice = data.slice((_trxPage - 1) * PER, _trxPage * PER);
    if (!slice.length) {
        tb.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Belum ada transaksi</p></div></td></tr>`;
        return;
    }
    tb.innerHTML = slice.map((t, i) => `
        <tr style="animation:fadeUp 0.2s ${i * 0.03}s both">
            <td>${(_trxPage - 1) * PER + i + 1}</td>
            <td><strong>${t.nama || '-'}</strong><br><span style="font-size:10px;color:var(--text-sub)">${t.email || ''}</span></td>
            <td>${t.paket || '-'}</td>
            <td class="hide-mobile">${t.metode || '-'}</td>
            <td class="hide-mobile" style="font-size:11px">${formatDate(t.tgl)}</td>
            <td><strong>Rp ${parseInt(t.total || 0).toLocaleString('id-ID')}</strong></td>
            <td><span class="badge-${t.status || 'pending'}">${t.status || 'pending'}</span></td>
        </tr>`).join('');
    const pg = document.getElementById('trx-pagination');
    if (pg && totalPg > 1) {
        pg.innerHTML = '<div class="pagination">' + Array.from({ length: totalPg }, (_, i) =>
            `<button class="page-btn ${i + 1 === _trxPage ? 'active' : ''}" onclick="_trxPage=${i + 1};filterTrx()">${i + 1}</button>`
        ).join('') + '</div>';
    } else if (pg) pg.innerHTML = '';
}
