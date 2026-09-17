// admin/laporan-jadwal/laporan-jadwal.js
// Dock LAPORAN (admin) — sub MAIL | TINDAKAN, lihat catatan lengkap di
// admin/laporan-jadwal/laporan-jadwal.html. Bergantung pada apiFetch/apiPost
// (js/api.js), showToast/showConfirm/openModal/closeModal (js/app.js) yang
// sudah dimuat global oleh shell admin.

let _lapjSub = 'mail';
function renderLaporanJadwalSub(sub) {
    _lapjSub = sub;
    document.querySelectorAll('#laporan-jadwal-sub-tabs-items .dock-item').forEach(b => b.classList.toggle('active-tab', b.dataset.sub === sub));
    document.querySelectorAll('#page-laporan-jadwal .sub-page').forEach(p => p.classList.remove('active'));
    document.getElementById('sub-laporan-jadwal-' + sub)?.classList.add('active');
    document.querySelector(`#laporan-jadwal-sub-tabs-items .dock-item[data-sub="${sub}"]`)
        ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

async function renderLaporanJadwal() {
    // Default rentang tanggal MAIL = hari ini, cuma diisi kalau field-nya
    // masih kosong (supaya filter yang sudah diketik admin tidak ke-reset
    // tiap kali dock ini dibuka ulang dalam 1 sesi kerja yang sama).
    const dari = document.getElementById('lapj-mail-dari');
    const sampai = document.getElementById('lapj-mail-sampai');
    if (dari && !dari.value) {
        const pad = n => String(n).padStart(2, '0');
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        dari.value = todayStr;
        if (sampai) sampai.value = '';
    }
    renderLaporanJadwalSub(_lapjSub || 'mail');
    await lapjLoadMail();
    if (_lapjSub === 'tindakan' && _lapjTargetKode) lapjLoadTindakHistory(_lapjTargetKode);
}

/* ══════════════════════════════════════════
   MAIL — log sesi jadwal berstatus "selesai"
   ══════════════════════════════════════════ */
let _lapjMailRows = [];
let _lapjTentorListLoaded = false;

async function _lapjLoadTentorList() {
    if (_lapjTentorListLoaded) return;
    const sel = document.getElementById('lapj-mail-tentor');
    if (!sel) return;
    try {
        const metaData = await apiFetch('/jadwal-meta');
        const gurus = (metaData && metaData.gurus) || [];
        gurus.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.kode; opt.textContent = g.nama;
            sel.appendChild(opt);
        });
        _lapjTentorListLoaded = true;
    } catch (e) { console.error('[laporan-jadwal] Gagal memuat daftar tentor:', e); }
}

let _lapjMuridDebounceTimer = null;
function _lapjMailMuridDebounced() {
    clearTimeout(_lapjMuridDebounceTimer);
    _lapjMuridDebounceTimer = setTimeout(lapjLoadMail, 450);
}

function lapjResetMailFilter() {
    const tentor = document.getElementById('lapj-mail-tentor');
    const murid = document.getElementById('lapj-mail-murid');
    const dari = document.getElementById('lapj-mail-dari');
    const sampai = document.getElementById('lapj-mail-sampai');
    const statusFilter = document.getElementById('lapj-mail-status-filter');
    if (tentor) tentor.value = '';
    if (murid) murid.value = '';
    if (statusFilter) statusFilter.value = '';
    const pad = n => String(n).padStart(2, '0');
    const d = new Date();
    if (dari) dari.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (sampai) sampai.value = '';
    lapjLoadMail();
}

async function lapjLoadMail() {
    _lapjLoadTentorList();
    const tbody = document.getElementById('lapj-mail-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><p>Memuat...</p></div></td></tr>`;
    try {
        const dari = document.getElementById('lapj-mail-dari')?.value || '';
        const sampai = document.getElementById('lapj-mail-sampai')?.value || '';
        const tentorId = document.getElementById('lapj-mail-tentor')?.value || '';
        const murid = document.getElementById('lapj-mail-murid')?.value.trim() || '';
        const params = new URLSearchParams();
        if (dari) params.set('dari', dari);
        if (sampai) params.set('sampai', sampai);
        if (tentorId) params.set('tentor_id', tentorId);
        if (murid) params.set('murid', murid);
        const qs = params.toString();
        _lapjMailRows = await apiFetch('/admin/laporan-log' + (qs ? '?' + qs : '')) || [];
    } catch (e) {
        _lapjMailRows = [];
        if (tbody) tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><p>Gagal memuat: ${e.message}</p></div></td></tr>`;
        return;
    }
    lapjRenderMail();
}

function _lapjJamLabel(row) {
    const fmt = (iso) => {
        if (!iso) return '-';
        const t = String(iso).split('T')[1];
        return t ? t.slice(0, 5) : '-';
    };
    return `${fmt(row.waktu_mulai)}–${fmt(row.waktu_selesai)}`;
}

function _lapjYesNoBadge(done) {
    return done ? '<span class="badge-success">Sudah</span>' : '<span class="badge-pending">Belum</span>';
}

function lapjRenderMail() {
    const tbody = document.getElementById('lapj-mail-tbody');
    const summary = document.getElementById('lapj-mail-summary');
    if (!tbody) return;
    const filter = document.getElementById('lapj-mail-status-filter')?.value || '';
    let rows = _lapjMailRows;
    if (filter === 'belum_lapor') rows = rows.filter(r => !(r.meta && r.meta.laporanDone));
    else if (filter === 'belum_feedback') rows = rows.filter(r => !(r.meta && r.meta.feedbackDone));

    const belumLaporCount = _lapjMailRows.filter(r => !(r.meta && r.meta.laporanDone)).length;
    const belumFeedbackCount = _lapjMailRows.filter(r => !(r.meta && r.meta.feedbackDone)).length;
    if (summary) summary.textContent = `${_lapjMailRows.length} sesi selesai — ${belumLaporCount} guru belum lapor, ${belumFeedbackCount} murid belum feedback.`;

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><p>Tidak ada sesi pada tanggal/filter ini</p></div></td></tr>`;
        return;
    }
    tbody.innerHTML = rows.map(r => {
        const laporanDone = !!(r.meta && r.meta.laporanDone);
        const feedbackDone = !!(r.meta && r.meta.feedbackDone);
        return `<tr style="cursor:pointer" onclick="lapjOpenDetail('${r.kode}')">
            <td class="hide-mobile">${r.tanggal || '-'}</td>
            <td class="mono">${_lapjJamLabel(r)}</td>
            <td>${r.tentor_nama || '-'}</td>
            <td class="hide-mobile">${r.materi_nama || '-'}</td>
            <td>${r.nama || '-'}</td>
            <td class="hide-mobile">${_lapjYesNoBadge(laporanDone)}</td>
            <td class="hide-mobile">${_lapjYesNoBadge(feedbackDone)}</td>
            <td><button type="button" class="btn btn-secondary" style="padding:4px 10px;font-size:.75rem" onclick="event.stopPropagation();lapjOpenDetail('${r.kode}')">Lihat</button></td>
        </tr>`;
    }).join('');
}

// Bintang paham/kualitas (1-5) dari feedback murid -> teks singkat, bukan
// render bintang visual (cukup admin-facing, tidak perlu seindah tampilan
// murid di user/jadwal/jadwal.js).
function _lapjRatingLabel(n) {
    if (!n) return '-';
    return `${n} / 5`;
}

let _lapjDetailRow = null;
async function lapjOpenDetail(id) {
    openModal('lapj-detail-overlay');
    const body = document.getElementById('lapj-detail-body');
    document.getElementById('lapj-detail-title').textContent = 'Memuat...';
    if (body) body.innerHTML = `<div class="empty-state"><p>Memuat...</p></div>`;
    try {
        const r = await apiFetch('/admin/laporan-log/' + id);
        _lapjDetailRow = r;
        document.getElementById('lapj-detail-title').textContent = `${r.nama || 'Murid'} — ${r.tentor_nama || 'Tentor'}`;
        const meta = r.meta || {};
        const fb = meta.feedback || null;
        const linkHtml = r.meet_link
            ? `<a href="${r.meet_link}" target="_blank" rel="noopener">${r.meet_link}</a>`
            : '<span style="opacity:.6">Sesi ini tidak memiliki room Gmeet tercatat</span>';
        const laporanHtml = meta.laporanDone
            ? `<p style="white-space:pre-wrap;margin:.4rem 0 0">${(meta.laporanText || '').replace(/</g, '&lt;')}</p>`
            : `<p style="opacity:.6;margin:.4rem 0 0">Guru belum mengisi Laporan Pembelajaran untuk sesi ini.</p>`;
        const feedbackHtml = fb
            ? `<div style="margin-top:.4rem;display:grid;gap:4px;font-size:.85rem">
                 <div>Paham materi: <b>${_lapjRatingLabel(fb.paham)}</b></div>
                 <div>Kualitas mengajar: <b>${_lapjRatingLabel(fb.kualitas)}</b></div>
                 ${fb.catatan ? `<div>Catatan: <i>${String(fb.catatan).replace(/</g, '&lt;')}</i></div>` : ''}
               </div>`
            : `<p style="opacity:.6;margin:.4rem 0 0">Murid belum mengisi feedback untuk sesi ini.</p>`;
        const ujianHtml = r.ujian
            ? `<div style="margin-top:.4rem;display:grid;gap:4px;font-size:.85rem">
                 <div>Skor: <b>${r.ujian.skor ?? '-'}</b></div>
                 <div>Waktu pengerjaan: <b>${r.ujian.waktu_pengerjaan || '-'}</b></div>
                 <div>Tanggal selesai: <b>${r.ujian.tgl_selesai || '-'}</b></div>
               </div>`
            : `<p style="opacity:.6;margin:.4rem 0 0">Belum ada data pengerjaan ujian utk sesi ini (murid belum mulai/menyelesaikan ujian sesi ini).</p>`;

        body.innerHTML = `
            <div class="ld-notice" style="margin-bottom:1rem">
                <b>${r.tanggal || '-'}</b> · ${_lapjJamLabel(r)} · ${r.materi_nama || '-'}
            </div>
            <div class="lapj-detail-section"><h4>Link Bukti Google Meet</h4>${linkHtml}</div>
            <div class="lapj-detail-section"><h4>Laporan Pembelajaran (Guru)</h4>${laporanHtml}</div>
            <div class="lapj-detail-section"><h4>Feedback (Murid)</h4>${feedbackHtml}</div>
            <div class="lapj-detail-section"><h4>Data Pengerjaan Ujian (Murid)</h4>${ujianHtml}</div>
            <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-top:1.2rem">
                <button class="btn btn-secondary" onclick="lapjGoTindakan('review','${r.tentor_id}','${(r.tentor_nama || '').replace(/'/g, "\\'")}','${r.kode}')">Ambil Tindakan ke Guru</button>
                <button class="btn btn-secondary" onclick="lapjGoTindakan('user','${r.user_kode}','${(r.nama || '').replace(/'/g, "\\'")}','${r.kode}')">Ambil Tindakan ke Murid</button>
            </div>`;
    } catch (e) {
        body.innerHTML = `<div class="empty-state"><p>Gagal memuat detail: ${e.message}</p></div>`;
    }
}

/* ══════════════════════════════════════════
   TINDAKAN — cari akun, lihat riwayat, ambil tindakan baru
   ══════════════════════════════════════════ */
let _lapjTargetKode = null;
let _lapjTargetRole = null;
let _lapjLinkedSesiKode = null;
let _lapjUserListCache = {}; // { review: [...], user: [...] } — cache per role biar tidak fetch ulang tiap ketik

let _lapjTargetSearchTimer = null;
function _lapjTargetSearchDebounced() {
    clearTimeout(_lapjTargetSearchTimer);
    _lapjTargetSearchTimer = setTimeout(lapjSearchTarget, 350);
}

async function lapjSearchTarget() {
    const role = document.getElementById('lapj-tindak-role')?.value || 'review';
    const q = (document.getElementById('lapj-tindak-search')?.value || '').trim().toLowerCase();
    const resultsEl = document.getElementById('lapj-tindak-search-results');
    if (!resultsEl) return;
    if (!_lapjUserListCache[role]) {
        resultsEl.innerHTML = `<div class="empty-state" style="padding:12px"><p>Memuat daftar akun...</p></div>`;
        try {
            _lapjUserListCache[role] = await apiFetch('/users/' + role) || [];
        } catch (e) {
            resultsEl.innerHTML = `<div class="empty-state" style="padding:12px"><p>Gagal memuat: ${e.message}</p></div>`;
            return;
        }
    }
    if (!q) { resultsEl.innerHTML = ''; return; }
    const matches = _lapjUserListCache[role]
        .filter(u => (u.nama || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
        .slice(0, 20);
    if (!matches.length) {
        resultsEl.innerHTML = `<div class="empty-state" style="padding:12px"><p>Tidak ada akun cocok</p></div>`;
        return;
    }
    resultsEl.innerHTML = `<div class="card" style="padding:6px">${matches.map(u => `
        <div class="lapj-target-result-row" onclick="lapjSelectTarget('${u.kode}','${role}','${(u.nama || '').replace(/'/g, "\\'")}','${u.status || ''}')">
            <span>${u.nama || '-'} <span style="opacity:.6;font-size:.8rem">(${u.email || u.kode})</span></span>
            ${u.status === 'suspend' ? '<span class="badge-failed">Suspend</span>' : ''}
        </div>
    `).join('')}</div>`;
}

function lapjSelectTarget(kode, role, nama, status) {
    _lapjTargetKode = kode;
    _lapjTargetRole = role;
    document.getElementById('lapj-tindak-search-results').innerHTML = '';
    document.getElementById('lapj-tindak-search').value = nama;
    const panel = document.getElementById('lapj-tindak-target-panel');
    if (panel) panel.style.display = '';
    const info = document.getElementById('lapj-tindak-target-info');
    if (info) info.innerHTML = `<b>${nama}</b> (${role === 'review' ? 'Guru' : 'Murid'})${status === 'suspend' ? ' — <span style="color:var(--danger,#dc2626);font-weight:700">Akun ini sedang di-SUSPEND</span>' : ''}`;
    const jenisSel = document.getElementById('lapj-tindak-jenis');
    if (jenisSel) jenisSel.value = status === 'suspend' ? 'cabut_suspend' : 'peringatan';
    document.getElementById('lapj-tindak-alasan').value = '';
    lapjLoadTindakHistory(kode);
}

function lapjClearLinkedSesi() {
    _lapjLinkedSesiKode = null;
    document.getElementById('lapj-tindak-linked-sesi').style.display = 'none';
}

// Dipanggil dari tombol "Ambil Tindakan ke Guru/Murid" di overlay detail MAIL
// — pindah ke sub TINDAKAN, langsung pilih akunnya, & tautkan sesi pemicunya.
function lapjGoTindakan(role, kode, nama, jadwalKode) {
    closeModal('lapj-detail-overlay');
    renderLaporanJadwalSub('tindakan');
    document.getElementById('lapj-tindak-role').value = role;
    // Kalau daftar akun role ini sudah pernah dimuat (cache), ambil status
    // suspend-nya yang sebenarnya — supaya badge/info di panel target akurat
    // sejak awal, bukan nunggu diketik ulang di kotak pencarian dulu.
    const cached = (_lapjUserListCache[role] || []).find(u => u.kode === kode);
    lapjSelectTarget(kode, role, nama, (cached && cached.status) || '');
    _lapjLinkedSesiKode = jadwalKode || null;
    const linkedEl = document.getElementById('lapj-tindak-linked-sesi');
    if (_lapjLinkedSesiKode && linkedEl) {
        linkedEl.style.display = '';
        const r = (_lapjMailRows || []).find(x => x.kode === jadwalKode) || _lapjDetailRow;
        document.getElementById('lapj-tindak-linked-sesi-label').textContent = r
            ? `${r.tanggal || ''} ${_lapjJamLabel(r)} — ${r.materi_nama || ''}`
            : jadwalKode;
    } else if (linkedEl) {
        linkedEl.style.display = 'none';
    }
}

async function lapjLoadTindakHistory(targetKode) {
    const tbody = document.getElementById('lapj-tindak-history-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><p>Memuat...</p></div></td></tr>`;
    try {
        const rows = await apiFetch('/admin/tindakan?target_kode=' + encodeURIComponent(targetKode)) || [];
        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><p>Belum ada riwayat tindakan utk akun ini</p></div></td></tr>`;
            return;
        }
        const jenisLabel = { peringatan: 'Peringatan', suspend: 'Suspend', cabut_suspend: 'Cabut Suspend' };
        tbody.innerHTML = rows.map(t => `<tr>
            <td>${t.created_at ? String(t.created_at).slice(0, 16).replace('T', ' ') : '-'}</td>
            <td>${jenisLabel[t.jenis] || t.jenis}</td>
            <td>${(t.alasan || '-').replace(/</g, '&lt;')}</td>
            <td class="hide-mobile">${t.admin_nama || '-'}</td>
        </tr>`).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><p>Gagal memuat: ${e.message}</p></div></td></tr>`;
    }
}

function lapjSubmitTindakan() {
    if (!_lapjTargetKode || !_lapjTargetRole) { showToast('Pilih akun dulu', 'danger'); return; }
    const jenis = document.getElementById('lapj-tindak-jenis')?.value;
    const alasan = document.getElementById('lapj-tindak-alasan')?.value.trim() || '';
    if (jenis !== 'cabut_suspend' && !alasan) { showToast('Alasan wajib diisi', 'danger'); return; }
    const nama = document.getElementById('lapj-tindak-search')?.value || 'akun ini';
    const jenisLabel = { peringatan: 'memberi PERINGATAN ke', suspend: 'men-SUSPEND', cabut_suspend: 'mencabut suspend' };
    showConfirm(
        'Konfirmasi Tindakan',
        `Yakin ${jenisLabel[jenis] || 'mengambil tindakan ke'} "${nama}"?${jenis === 'suspend' ? ' Akun tidak akan bisa login sampai suspend dicabut kembali.' : ''}`,
        jenis === 'suspend' ? 'danger' : 'warning',
        async () => {
            try {
                await apiPost('/admin/tindakan', {
                    target_kode: _lapjTargetKode,
                    target_role: _lapjTargetRole,
                    jenis, alasan,
                    jadwal_kode: _lapjLinkedSesiKode || null,
                });
                showToast('✓ Tindakan tersimpan');
                document.getElementById('lapj-tindak-alasan').value = '';
                // Refresh cache status akun ini (badge suspend dkk) & riwayatnya.
                delete _lapjUserListCache[_lapjTargetRole];
                lapjLoadTindakHistory(_lapjTargetKode);
            } catch (e) {
                showToast('Gagal: ' + e.message, 'danger');
            }
        },
        { yesLabel: 'Ya, Lanjutkan' }
    );
}
