// admin/keuangan.js
// Modul KEUANGAN (paket/harga, gateway, transaksi) — lazy-load saat tab Keuangan dibuka.
// Logic form Tambah/Edit Paket (openAddPaket/openEditPaket/submitPaket/deletePaket)
// DIPINDAH ke admin/paket-form.js supaya file ini tetap ringan tiap kali form
// paket-nya diubah — di sini cuma render grid + tab gateway/transaksi.
// Bergantung pada helper global dari js/app.js (showToast, openModal, navigateTo, dst)
// yang sudah dimuat lebih dulu lewat shell index_admin.html.

let _paketData = [], _ldPaketCache = [];

function renderKeuangan() {
    // _keuanganSub dideklarasikan (let) di js/pages.js — kalau modul Keuangan
    // belum pernah dibuka, identifier itu belum exist sama sekali, jadi jangan
    // baca langsung (ReferenceError). typeof aman dipakai untuk identifier
    // yang belum pernah dideklarasikan.
    renderKeuanganSub(typeof _keuanganSub !== 'undefined' ? _keuanganSub : 'paket');
}

function renderKeuanganSub(sub) {
    _keuanganSub = sub;
    document.querySelectorAll('#page-keuangan .sub-tab').forEach(t => t.classList.toggle('active', t.dataset.sub === sub));
    document.querySelectorAll('#page-keuangan .sub-page').forEach(p => p.classList.toggle('active', p.id === `sub-keuangan-${sub}`));
    if (sub === 'paket') renderPaketGrid().then(() => { if (typeof _tryRestorePaketDraft === 'function') _tryRestorePaketDraft(); });
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

    _renderPaketCards();
}

// Gambar ulang grid paket dari _paketData/_ldPaketCache yang SUDAH ada di
// memori (tanpa fetch ulang ke server) — dipakai renderPaketGrid() setelah
// muat data, dan juga onTogglePaketTampilLanding() setelah toggle switch
// landing supaya tidak perlu reload seluruh grid + spinner cuma buat 1 switch.
function _renderPaketCards() {
    const grid = document.getElementById('paket-grid');
    if (!grid) return;

    if (!_paketData.length) {
        grid.innerHTML = `<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--text-sub)"><div style="font-size:3rem;margin-bottom:12px">💎</div><p style="font-weight:600;margin-bottom:6px">Belum ada paket harga</p><p style="font-size:12px">Klik "+ Paket Baru" untuk mulai membuat paket</p></div>`;
        return;
    }

    grid.innerHTML = _paketData.map((p, i) => {
        const fiturArr = Array.isArray(p.fitur) ? p.fitur : (p.fitur || '').split('\n');
        const fiturList = fiturArr.filter(f => (f || '').trim()).map(f => `<li>${f}</li>`).join('');
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
        // Ikon paket sekarang gambar (URL Supabase Storage) — teks emoji cuma
        // fallback utk paket lawas yg belum pernah diedit lewat form baru ini,
        // atau paket yang memang belum punya ikon sama sekali.
        const iconIsImg = typeof p.icon === 'string' && /^(https?:|data:)/i.test(p.icon);
        const iconHtml = iconIsImg
            ? `<img src="${p.icon}" alt="" style="width:2.4rem;height:2.4rem;border-radius:10px;object-fit:cover">`
            : `<div style="font-size:2rem">${p.icon || '📦'}</div>`;
        // Switch "tampil di landing" — MURNI visibilitas publik (dibaca oleh
        // GET /api/pakets/public, yaitu sumber data landing/paket.html/dst).
        // Kalau dimatikan, paket jadi "private": hilang dari landing page,
        // tapi fungsi sistemnya (akses materi/mentoring dst user yang SUDAH
        // punya paket ini) tetap jalan seperti biasa — lihat onTogglePaketTampilLanding().
        const tampilLanding = p.tampil_landing !== false && p.tampil_landing !== 0;
        const privateBadge = !tampilLanding ? `<div style="margin-top:8px;font-size:10px;background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.2);border-radius:8px;padding:4px 8px;display:flex;align-items:center;gap:5px;color:#dc2626">🔒 <span>Private — disembunyikan dari landing page</span></div>` : '';
        return `<div class="paket-card-admin ${p.popular ? 'popular' : ''}" style="animation:fadeUp 0.3s ${i * 0.06}s both;border-color:${p.popular ? accentColor : ''}">
            ${p.popular ? `<span class="paket-badge-popular" style="background:linear-gradient(90deg,${accentColor},${accentColor}cc)">⭐ ${p.popular}</span>` : ''}
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                ${iconHtml}
                <div style="display:flex;align-items:center;gap:10px">
                    <label class="switch" style="transform:scale(.82)" title="${tampilLanding ? 'Tampil di landing page — klik utk jadikan private (sembunyikan)' : 'Private (disembunyikan dari landing page) — klik utk tampilkan lagi'}">
                        <input type="checkbox" ${tampilLanding ? 'checked' : ''} onchange="onTogglePaketTampilLanding('${p.kode||p.id}',this.checked,this)">
                        <span class="switch-slider"></span>
                    </label>
                    <div style="display:flex;gap:6px">
                        <button class="btn-icon" onclick="openEditPaket('${p.kode||p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                        <button class="btn-icon danger" onclick="deletePaket('${p.kode||p.id}','${p.nama}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
                    </div>
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
            ${privateBadge}
        </div>`;
    }).join('');
}

// Toggle switch di kartu paket (samping tombol Edit) — cuma ubah kolom
// tampil_landing lewat endpoint kecil khusus (BUKAN lewat PUT /api/pakets/:kode
// yang dipakai form Edit lengkap), supaya menyimpan paket dari form Edit
// TIDAK ikut menimpa balik status switch ini. Nyala (default) = tampil di
// landing seperti sekarang; mati = hilang dari landing (private), tapi paket
// yang sudah dipegang user (user_pakets) & akses materi/mentoring-nya tetap
// jalan seperti biasa, dan admin tetap bisa assign paket ini manual ke user.
async function onTogglePaketTampilLanding(kode, checked, el) {
    const item = _paketData.find(p => (p.kode||p.id) === kode);
    const prev = item ? item.tampil_landing : true;
    if (item) item.tampil_landing = checked; // optimistic, dirapikan lagi kalau gagal
    try {
        await PaketAPI.setTampilLanding(kode, checked);
        showToast(checked ? 'Paket ditampilkan lagi di landing page' : 'Paket disembunyikan dari landing page (private)', 'success');
        _renderPaketCards();
    } catch (e) {
        if (item) item.tampil_landing = prev;
        if (el) el.checked = prev !== false && prev !== 0;
        showToast(e.message || 'Gagal mengubah status landing', 'danger');
    }
}

// ── Form Tambah/Edit/Hapus Paket: lihat admin/paket-form.js ──

// ── GATEWAY CONFIG (terhubung ke server — bukan lagi localStorage demo) ──
// Server Key/Secret Key TIDAK PERNAH dikirim balik dalam bentuk asli oleh backend
// (hanya versi masked), jadi field password di sini SENGAJA dikosongkan saat
// dimuat — kosong berarti "jangan ganti key yang sudah tersimpan di server".
async function loadGatewayConfig() {
    try {
        const cfg = await GatewayAPI.get();
        const provSel = document.getElementById('gw-active-provider');
        if (provSel) provSel.value = cfg.active_provider || 'none';
        const statusEl = document.getElementById('gw-active-status');
        if (statusEl) statusEl.textContent = cfg.active_provider === 'none'
            ? 'Transaksi user saat ini memakai konfirmasi manual.'
            : `Transaksi user saat ini diproses real-time lewat ${cfg.active_provider === 'midtrans' ? 'Midtrans' : 'Xendit'}.`;

        document.getElementById('gw-midtrans-sk').value = '';
        document.getElementById('gw-midtrans-sk').placeholder = cfg.midtrans?.server_key_masked || 'Kosongkan jika tidak diganti';
        document.getElementById('gw-midtrans-ck').value = '';
        document.getElementById('gw-midtrans-ck').placeholder = cfg.midtrans?.client_key_masked || 'Kosongkan jika tidak diganti';
        const mtMode = document.querySelector(`input[name="midtrans-mode"][value="${cfg.midtrans?.mode || 'sandbox'}"]`);
        if (mtMode) mtMode.checked = true;
        document.getElementById('gw-midtrans-webhook').value = cfg.midtrans?.webhook_url || '';
        const mtBadge = document.getElementById('gw-midtrans-badge');
        if (mtBadge) {
            mtBadge.textContent = cfg.midtrans?.configured ? 'Terhubung' : 'Belum diisi';
            mtBadge.style.background = cfg.midtrans?.configured ? 'rgba(22,163,74,0.12)' : 'rgba(0,0,0,0.05)';
            mtBadge.style.color = cfg.midtrans?.configured ? '#16a34a' : 'var(--text-sub)';
        }

        document.getElementById('gw-xendit-sk').value = '';
        document.getElementById('gw-xendit-sk').placeholder = cfg.xendit?.secret_key_masked || 'Kosongkan jika tidak diganti';
        document.getElementById('gw-xendit-token').value = '';
        document.getElementById('gw-xendit-token').placeholder = cfg.xendit?.callback_token_configured ? '••••••••' : 'Kosongkan jika tidak diganti';
        document.getElementById('gw-xendit-webhook').value = cfg.xendit?.webhook_url || '';
        const xdBadge = document.getElementById('gw-xendit-badge');
        if (xdBadge) {
            xdBadge.textContent = cfg.xendit?.configured ? 'Terhubung' : 'Belum diisi';
            xdBadge.style.background = cfg.xendit?.configured ? 'rgba(22,163,74,0.12)' : 'rgba(0,0,0,0.05)';
            xdBadge.style.color = cfg.xendit?.configured ? '#16a34a' : 'var(--text-sub)';
        }
    } catch (e) { showToast(e.message || 'Gagal memuat konfigurasi gateway', 'danger'); }
}
async function saveGateway(provider) {
    try {
        const payload = {};
        if (provider === 'midtrans') {
            payload.midtrans_server_key = document.getElementById('gw-midtrans-sk')?.value || '';
            payload.midtrans_client_key = document.getElementById('gw-midtrans-ck')?.value || '';
            payload.midtrans_mode = document.querySelector('input[name="midtrans-mode"]:checked')?.value || 'sandbox';
        } else if (provider === 'xendit') {
            payload.xendit_secret_key = document.getElementById('gw-xendit-sk')?.value || '';
            payload.xendit_callback_token = document.getElementById('gw-xendit-token')?.value || '';
        }
        await GatewayAPI.save(payload);
        clearDirty();
        showToast(`Konfigurasi ${provider === 'midtrans' ? 'Midtrans' : 'Xendit'} disimpan!`, 'success');
        await loadGatewayConfig();
    } catch (e) { showToast(e.message || 'Gagal menyimpan', 'danger'); }
}
async function saveActiveGateway() {
    try {
        const active_provider = document.getElementById('gw-active-provider')?.value || 'none';
        await GatewayAPI.save({ active_provider });
        clearDirty();
        showToast('Gateway aktif diterapkan!', 'success');
        await loadGatewayConfig();
    } catch (e) { showToast(e.message || 'Gagal mengaktifkan gateway', 'danger'); }
}
function copyGatewayUrl(inputId) {
    const el = document.getElementById(inputId);
    if (!el || !el.value) return;
    el.select();
    navigator.clipboard?.writeText(el.value).then(
        () => showToast('URL disalin', 'success'),
        () => document.execCommand('copy')
    );
}

// ── TRANSAKSI (data ASLI dari tabel transaksi via Midtrans/Xendit — bukan lagi localStorage demo) ──
let _trxData = [], _trxSearch = '', _trxStatusFilter = '', _trxPage = 1;
async function renderTrxList() {
    try {
        _trxData = await GatewayAPI.getTransaksi();
    } catch (e) {
        _trxData = [];
        showToast(e.message || 'Gagal memuat data transaksi', 'danger');
    }
    filterTrx();
}
function filterTrx() {
    _trxSearch = (document.getElementById('trx-search')?.value || '').toLowerCase();
    _trxStatusFilter = document.getElementById('trx-status-filter')?.value || '';
    let data = _trxData;
    if (_trxSearch) data = data.filter(t =>
        (t.user_email || '').toLowerCase().includes(_trxSearch) ||
        (t.paket_nama || '').toLowerCase().includes(_trxSearch));
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
            <td><strong>${t.user_nama || '-'}</strong><br><span style="font-size:10px;color:var(--text-sub)">${t.user_email || ''}</span></td>
            <td>${t.paket_nama || '-'}</td>
            <td class="hide-mobile">${(t.gateway || '-').toUpperCase()} · ${t.metode || '-'}</td>
            <td class="hide-mobile" style="font-size:11px">${formatDate(t.created_at)}</td>
            <td><strong>Rp ${parseInt(t.jumlah || 0).toLocaleString('id-ID')}</strong></td>
            <td><span class="badge-${t.status || 'pending'}">${t.status || 'pending'}</span></td>
        </tr>`).join('');
    const pg = document.getElementById('trx-pagination');
    if (pg && totalPg > 1) {
        pg.innerHTML = '<div class="pagination">' + Array.from({ length: totalPg }, (_, i) =>
            `<button class="page-btn ${i + 1 === _trxPage ? 'active' : ''}" onclick="_trxPage=${i + 1};filterTrx()">${i + 1}</button>`
        ).join('') + '</div>';
    } else if (pg) pg.innerHTML = '';
}
