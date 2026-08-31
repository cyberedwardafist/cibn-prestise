/* pages.js v2 - Home, Laporan, Library, Modul, Landing, Review, Akun Admin */

// ── HOME ──
async function renderHome() {
    const el=document.getElementById('home-stats'), recEl=document.getElementById('home-recent');
    if(!el) return;
    const [admins,reviews,users,tokens,laporan,moduls] = await Promise.all([
        UsersAPI.getByRole('admin').catch(()=>[]),UsersAPI.getByRole('review').catch(()=>[]),
        UsersAPI.getByRole('user').catch(()=>[]),TokensAPI.getAll().catch(()=>[]),
        LaporanAPI.getAll().catch(()=>[]),ModulAPI.getAll().catch(()=>[]),
    ]);
    const total=(admins?.length||0)+(reviews?.length||0)+(users?.length||0);
    const tkAktif=(tokens||[]).filter(t=>!t.digunakan).length;
    el.innerHTML=`
        <div class="stat-card" onclick="navigateTo('akun')" style="animation:fadeUp 0.3s 0.05s both"><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><div class="stat-num">${total}</div><div class="stat-label">Total Akun</div></div>
        <div class="stat-card" onclick="navigateTo('token')" style="animation:fadeUp 0.3s 0.1s both"><div class="stat-icon accent"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div><div class="stat-num">${tkAktif}</div><div class="stat-label">Token Aktif</div></div>
        <div class="stat-card" onclick="navigateTo('laporan')" style="animation:fadeUp 0.3s 0.15s both"><div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div class="stat-num">${laporan?.length||0}</div><div class="stat-label">Laporan</div></div>
        <div class="stat-card" onclick="navigateTo('modul')" style="animation:fadeUp 0.3s 0.2s both"><div class="stat-icon orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></div><div class="stat-num">${moduls?.length||0}</div><div class="stat-label">Modul</div></div>
    `;
    const recent=(laporan||[]).slice(0,5);
    if(recEl) recEl.innerHTML=recent.length?recent.map(l=>`<div class="recent-item" onclick="navigateTo('laporan')"><div class="recent-left"><div class="recent-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg></div><div><div style="font-weight:600;font-size:13px;color:var(--blue)">${l.modul_nama||l.modul_kode||'-'}</div><div style="font-size:11px;color:var(--text-sub)">${l.user_nama||l.user_kode||'-'} · ${formatDate(l.tgl_selesai)}</div></div></div><div class="skor-badge">${Math.round(l.skor||0)}</div></div>`).join(''):'<div class="empty-state" style="padding:24px"><p>Belum ada aktivitas</p></div>';
    // Signup notif
    const signups=await UsersAPI.getSignupRequests().catch(()=>[]);
    const nb=document.getElementById('home-signup-notif');
    if(nb&&signups&&signups.length>0){nb.style.display='block';nb.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px"><div style="display:flex;align-items:center;gap:10px"><div style="width:36px;height:36px;border-radius:10px;background:rgba(217,119,6,0.12);display:flex;align-items:center;justify-content:center;color:var(--warning)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><div><div style="font-weight:700;font-size:13px;color:var(--blue)">${signups.length} Permintaan Pendaftaran</div><div style="font-size:11px;color:var(--text-sub)">Menunggu aktivasi admin</div></div></div><button class="btn btn-primary btn-sm" onclick="navigateTo('akun');setTimeout(()=>renderAkunSub('signup'),300)">Lihat & Aktivasi</button></div>`;}
}

// ── LAPORAN ──
let _lapData = [], _lapSearch = '', _lapPage = 1, _lapGrubFilter = '';

async function renderLaporan() {
    _lapData = await LaporanAPI.getAll().catch(() => []);
    _renderLapGrubFilterOptions();
    _renderLapTable();
}

// Isi dropdown "Semua Grup Token" dari nilai grub_token unik yang ada di data laporan
function _renderLapGrubFilterOptions() {
    const sel = document.getElementById('laporan-grub-filter');
    if (!sel) return;
    const cur = _lapGrubFilter;
    const grubs = Array.from(new Set((_lapData || []).map(l => l.grub_token).filter(Boolean))).sort((a, b) => String(a).toLowerCase().localeCompare(String(b).toLowerCase()));
    sel.innerHTML = '<option value="">Semua Grup Token</option>' + grubs.map(g => `<option value="${String(g).replace(/"/g, '&quot;')}">${g}</option>`).join('');
    if (grubs.includes(cur)) sel.value = cur; else _lapGrubFilter = '';
}

function _renderLapTable() {
    let data = _lapData;
    if (_lapSearch) {
        const q = _lapSearch.toLowerCase();
        data = data.filter(l => (l.token_kode || '').toLowerCase().includes(q) || (l.modul_kode || '').toLowerCase().includes(q));
    }
    if (_lapGrubFilter) data = data.filter(l => l.grub_token === _lapGrubFilter);

    const dlBar = document.getElementById('laporan-grub-dl-bar');
    if (dlBar) {
        dlBar.style.display = _lapGrubFilter ? 'flex' : 'none';
        const cntEl = document.getElementById('laporan-grub-dl-count');
        if (cntEl && _lapGrubFilter) cntEl.textContent = `${data.length} laporan pada grup "${_lapGrubFilter}"`;
    }

    const total = data.length, totalPg = Math.max(1, Math.ceil(total / 20));
    if (_lapPage > totalPg) _lapPage = 1;
    const start = (_lapPage - 1) * 20, slice = data.slice(start, start + 20);
    const tb = document.getElementById('laporan-tbody');
    if (tb) tb.innerHTML = slice.map((l, i) => `
        <tr style="animation:fadeUp 0.2s ${i * 0.03}s both">
            <td>${start + i + 1}</td>
            <td><code style="font-size:11px;font-family:monospace">${l.token_kode || '-'}</code></td>
            <td>${l.modul_kode || '-'}</td>
            <td class="hide-mobile">${formatDate(l.tgl_selesai)}</td>
            <td class="hide-mobile">${l.waktu_pengerjaan || '-'}</td>
            <td><strong style="color:var(--blue)">${l.skor}</strong></td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="openReviewLaporan('${l.kode || l.id}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg> Review
                </button>
            </td>
        </tr>`).join('') || `<tr><td colspan="7"><div class="empty-state"><p>Belum ada laporan</p></div></td></tr>`;

    const swEl = document.getElementById('laporan-swipe-list');
    if (swEl && window.SwipeCards) {
        swEl.innerHTML = slice.length ? slice.map(l => SwipeCards.buildSwipeCardHtml({
            title: l.token_kode || '-',
            sub: (l.modul_kode || '-') + ' · ' + formatDate(l.tgl_selesai),
            sideHtml: `<strong style="color:var(--blue);font-size:15px">${l.skor}</strong>`,
            onTapAttr: `onclick="openReviewLaporan('${l.kode || l.id}')"`
        })).join('') : '<div class="swipe-card-empty">Belum ada laporan</div>';
        SwipeCards.bindSwipeList(swEl);
    }

    const pg = document.getElementById('laporan-pagination');
    if (pg && totalPg > 1) {
        let h = '<div class="pagination">';
        for (let i = 1; i <= totalPg; i++) h += `<button class="page-btn ${i === _lapPage ? 'active' : ''}" onclick="_lapPage=${i};_renderLapTable()">${i}</button>`;
        h += '</div>';
        pg.innerHTML = h;
    }
}

// GANTI fungsi openReviewLaporan di pages.js Anda dengan ini:
async function openReviewLaporan(id) {
    const body = document.getElementById('review-laporan-body'); 
    if (!body) return;

    body.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-sub)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32" style="animation:spin 1s linear infinite;display:block;margin:0 auto 8px"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><p style="font-size:13px">Memuat data...</p></div>`;
    openModal('review-laporan-overlay');

    let l = null;
    try { l = await apiGet('/laporan/' + id); } catch (e) {}
    if (!l) l = _lapData.find(x => (x.kode || x.id) == id) || null;
    if (!l) { body.innerHTML = `<div class="empty-state"><p>Data tidak ditemukan</p></div>`; return; }

    // Simpan ke state global agar bisa diakses fungsi download
    window._adminCurrentLaporan = l;

    const jawaban = typeof l.jawaban === 'string' ? JSON.parse(l.jawaban) : (l.jawaban || {});
    const soalAll = l.soal_detail || [];

    body.innerHTML = `
        <div style="background:linear-gradient(135deg,var(--blue),var(--accent));color:#fff;padding:18px;border-radius:14px;margin-bottom:16px;text-align:center">
            <div style="font-size:42px;font-weight:800;font-family:var(--font-head)">${Math.round(l.skor) || 0}</div>
            <div style="font-size:12px;opacity:0.75;margin-top:2px">Skor Akhir</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
            <div style="background:rgba(19,50,89,0.05);border-radius:10px;padding:12px;text-align:center">
                <div style="font-size:20px;font-weight:800;color:var(--blue)">${Object.keys(jawaban).length}</div>
                <div style="font-size:11px;color:var(--text-sub)">Dijawab</div>
            </div>
            <div style="background:rgba(19,50,89,0.05);border-radius:10px;padding:12px;text-align:center">
                <div style="font-size:20px;font-weight:800;color:var(--blue)">${soalAll.length}</div>
                <div style="font-size:11px;color:var(--text-sub)">Paket Soal</div>
            </div>
        </div>
        <!-- Pastikan memanggil downloadLaporan() bukan prepareDownloadOptions -->
        <button class="btn btn-primary" style="width:100%;margin-bottom:16px" onclick="downloadLaporan()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Unduh Laporan
        </button>
        ${soalAll.length ? '<div style="font-size:12px;font-weight:700;color:var(--text-sub);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">Detail Review Jawaban</div>' + soalAll.map(s => _buildSoalReviewBlock(s, jawaban, l.urutan_tampil)).join('') : '<div class="empty-state"><p>Detail soal tidak tersedia</p></div>'}
    `;
}

// Terapkan urutan tampil (acak soal & acak jawaban) tersimpan dari sesi ujian peserta,
// supaya tampilan review persis sama seperti yang dilihat peserta saat ujian.
function _applyUrutanTampil(dataSoal, ord) {
    const list = dataSoal || [];
    if (!ord || !Array.isArray(ord.qOrder) || !ord.qOrder.length) {
        return list.map((q, i) => ({ ...q, __qIdx: i }));
    }
    return ord.qOrder.filter(qi => list[qi]).map(qi => {
        const orig = list[qi];
        const optKey = orig.jawaban ? 'jawaban' : (orig.opsi ? 'opsi' : null);
        const q = { ...orig, __qIdx: qi };
        const jo = ord.jawOrder && ord.jawOrder[qi];
        if (optKey && Array.isArray(jo) && jo.length) {
            const opts = orig[optKey] || [];
            const ordered = jo.map(ref => opts.find((o, oi) => (o.id != null ? o.id : oi) === ref)).filter(Boolean);
            opts.forEach(o => { if (!ordered.includes(o)) ordered.push(o); }); // jaring pengaman
            q[optKey] = ordered;
        }
        return q;
    });
}

// Bangun blok HTML detail review 1 paket soal: pertanyaan, opsi jawaban + kunci/nilai,
// jawaban peserta, dan pembahasan. Dipakai oleh openReviewLaporan (Admin/Review).
function _buildSoalReviewBlock(s, jawabanUser, urutanTampil) {
    const kode = s.kode || s.id || s.nama;
    const dataSoalRaw = typeof s.data === 'string' ? (JSON.parse(s.data || '[]') || []) : (s.data || []);
    const isNS = s.skor_type === 'nilai_sendiri';

    if (s.type === 'sikap_kerja') {
        return `<div class="card" style="padding:14px;margin-bottom:12px">
            <div style="font-weight:700;color:var(--blue);margin-bottom:4px">${s.nama} <span class="badge" style="background:rgba(19,50,89,0.08);color:var(--text-sub);margin-left:6px">Sikap Kerja</span></div>
            <div style="font-size:12px;color:var(--text-sub)">Gunakan grafik Sikap Kerja pada laporan untuk detail kolom.</div>
        </div>`;
    }

    const ord = urutanTampil && urutanTampil[kode];
    const dataSoal = _applyUrutanTampil(dataSoalRaw, ord);

    // Kumpulkan semua jawaban peserta yang berhubungan dengan soal ini (anti-acak soal)
    let allUserAns = [];
    Object.keys(jawabanUser || {}).forEach(key => {
        if (key.startsWith(kode + '_')) {
            const a = jawabanUser[key];
            if (Array.isArray(a)) allUserAns.push(...a); else if (a != null) allUserAns.push(a);
        }
    });

    const qHtml = dataSoal.map((q, displayIdx) => {
        const qi = q.__qIdx;
        const qText = q.soal || q.pertanyaan || '';
        const opsi = q.jawaban || q.opsi || [];
        const validJids = opsi.map((j, i) => j.id != null ? String(j.id) : String(i));

        let userAns = [];
        if (jawabanUser[q.id]) {
            const a = jawabanUser[q.id];
            userAns = Array.isArray(a) ? a.map(String) : [String(a)];
        } else {
            userAns = allUserAns.map(String).filter(a => validJids.includes(a));
            if (!userAns.length && jawabanUser[kode + '_' + qi] != null) {
                const fb = jawabanUser[kode + '_' + qi];
                userAns = Array.isArray(fb) ? fb.map(String) : [String(fb)];
            }
        }

        const kunci = Array.isArray(q.kunci) ? q.kunci.map(String) : (q.kunci != null ? [String(q.kunci)] : []);

        const optHtml = opsi.map((j, i) => {
            const letter = String.fromCharCode(65 + i);
            const jid = j.id != null ? String(j.id) : String(i);
            const picked = userAns.includes(jid);
            let border = 'rgba(19,50,89,0.12)', bg = 'transparent', badge = '';
            if (isNS) {
                const nilai = j.nilai || 0;
                if (picked) { border = 'var(--accent)'; bg = 'rgba(26,90,160,0.07)'; badge = `<span style="margin-left:auto;font-size:10px;font-weight:700;color:var(--accent)">Dipilih peserta · ${nilai} poin</span>`; }
                else badge = `<span style="margin-left:auto;font-size:10px;color:var(--text-sub)">${nilai} poin</span>`;
            } else {
                const isKey = kunci.includes(jid);
                if (picked && isKey) { border = 'var(--success)'; bg = 'rgba(22,163,74,0.08)'; badge = '<span style="margin-left:auto;font-size:10px;font-weight:700;color:var(--success)">✓ Jawaban peserta (Benar)</span>'; }
                else if (picked && !isKey) { border = 'var(--danger)'; bg = 'rgba(220,38,38,0.07)'; badge = '<span style="margin-left:auto;font-size:10px;font-weight:700;color:var(--danger)">✗ Jawaban peserta (Salah)</span>'; }
                else if (!picked && isKey) { border = '#d97706'; bg = 'rgba(217,119,6,0.07)'; badge = '<span style="margin-left:auto;font-size:10px;font-weight:700;color:#d97706">Kunci Jawaban</span>'; }
            }
            return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1.5px solid ${border};background:${bg};border-radius:8px;margin-bottom:5px">
                <span style="font-weight:700;font-size:12px;color:var(--blue)">${letter}.</span>
                <span style="font-size:13px;flex:1">${j.teks || j.value || '-'}</span>
                ${badge}
            </div>`;
        }).join('');

        const pembahasan = q.pembahasan ? `<div style="background:rgba(26,90,160,0.05);border:1.5px solid rgba(26,90,160,0.12);border-radius:8px;padding:10px;margin-top:6px">
            <div style="font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;margin-bottom:4px">💡 Pembahasan</div>
            <div style="font-size:12px;line-height:1.6">${q.pembahasan}</div>
        </div>` : '';

        return `<div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid rgba(19,50,89,0.06)">
            <div style="font-size:13px;font-weight:600;margin-bottom:8px">${displayIdx + 1}. ${qText}</div>
            ${optHtml}
            ${pembahasan}
        </div>`;
    }).join('');

    return `<div class="card" style="padding:14px;margin-bottom:12px">
        <div style="font-weight:700;color:var(--blue);margin-bottom:10px">${s.nama}${isNS ? ' <span class="badge" style="background:rgba(26,90,160,0.1);color:var(--accent)">Nilai per Jawaban</span>' : ''}</div>
        ${qHtml || '<div style="font-size:12px;color:var(--text-sub)">Tidak ada soal.</div>'}
    </div>`;
}

// GANTI fungsi downloadLaporan di pages.js Anda dengan ini:
function downloadLaporan() {
    const lap = window._adminCurrentLaporan; // Data diset saat openReviewLaporan di pages.js
    if (!lap) { showToast('Data tidak ditemukan', 'danger'); return; }
    
    const container = document.getElementById('dl-per-soal-list');
    if (container) {
        container.innerHTML = (lap.soal_detail || []).map(s => `
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">
                <span style="flex:1;font-size:12px;font-weight:600;color:var(--blue)">${s.nama}</span>
                <button class="btn btn-secondary btn-sm" onclick="doDownloadAdmin('${s.kode}','word')">Word</button>
                <button class="btn btn-secondary btn-sm" onclick="doDownloadAdmin('${s.kode}','excel')" style="border-color:rgba(22,163,74,0.3);color:var(--success)">Excel</button>
            </div>`).join('');
    }
    openModal('download-overlay');
}
// Fungsi baru untuk memunculkan modal opsi download
function prepareDownloadOptions() {
    const lap = window._adminCurrentLaporan;
    if (!lap) return;
    
    const container = document.getElementById('dl-per-soal-list');
    if (container) {
        container.innerHTML = (lap.soal_detail || []).map(s => `
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px">
                <span style="flex:1;font-size:12px;font-weight:600;color:var(--blue)">${s.nama}</span>
                <button class="btn btn-secondary btn-sm" onclick="doDownloadAdmin('${s.kode}','word')">Word</button>
                <button class="btn btn-secondary btn-sm" onclick="doDownloadAdmin('${s.kode}','excel')" style="border-color:rgba(22,163,74,0.3);color:var(--success)">Excel</button>
            </div>`).join('');
    }
    openModal('download-overlay');
}

function doDownloadAdmin(which, format = 'word') {
    closeModal('download-overlay');
    const lap = window._adminCurrentLaporan;
    if (!lap) return;

    const jawaban = typeof lap.jawaban === 'string' ? JSON.parse(lap.jawaban) : (lap.jawaban || {});
    const soalAll = lap.soal_detail || [];
    const soalTampil = which === 'all' ? soalAll : soalAll.filter(s => s.kode === which);

    if (format === 'excel') {
        if (typeof adminDoDownloadExcel === 'function') adminDoDownloadExcel(lap, soalTampil, jawaban);
    } else {
        if (typeof adminDoDownloadWord === 'function') adminDoDownloadWord(lap, soalTampil, jawaban);
    }
}

// ── UNDUH LAPORAN GRUP (ZIP per grup token) — Admin ──
let _adminGrubDlFormat = 'word';

function openAdminUnduhLaporanGrup() {
    if (!_lapGrubFilter) { showToast('Pilih grup token terlebih dahulu', 'danger'); return; }
    const data = _lapData.filter(l => l.grub_token === _lapGrubFilter);
    if (!data.length) { showToast('Tidak ada laporan pada grup ini', 'danger'); return; }
    document.getElementById('admin-grub-dl-nama').textContent = _lapGrubFilter;
    document.getElementById('admin-grub-dl-count').textContent = `${data.length} laporan peserta`;
    _setAdminGrubDlFormat('word');
    const prog = document.getElementById('admin-grub-dl-progress');
    if (prog) { prog.style.display = 'none'; prog.textContent = ''; }
    const btn = document.getElementById('admin-grub-dl-btn'); if (btn) btn.disabled = false;
    openModal('admin-grub-dl-overlay');
}

function _setAdminGrubDlFormat(format) {
    _adminGrubDlFormat = format;
    document.getElementById('admin-grub-dl-format-word')?.classList.toggle('active', format === 'word');
    document.getElementById('admin-grub-dl-format-excel')?.classList.toggle('active', format === 'excel');
    const desc = document.getElementById('admin-grub-dl-format-desc');
    if (desc) desc.textContent = format === 'excel'
        ? 'Setiap laporan peserta akan disimpan sebagai file Excel (.xlsx) di dalam ZIP.'
        : 'Setiap laporan peserta akan disimpan sebagai file Word (.doc) di dalam ZIP.';
}

async function prosesAdminUnduhLaporanGrup() {
    const grubNama = _lapGrubFilter;
    const list = _lapData.filter(l => l.grub_token === grubNama);
    if (!list.length) { showToast('Tidak ada laporan pada grup ini', 'danger'); return; }
    if (typeof JSZip === 'undefined') { showToast('Gagal memuat pustaka ZIP, cek koneksi internet lalu coba lagi', 'danger'); return; }
    if (_adminGrubDlFormat === 'excel' && typeof XLSX === 'undefined') { showToast('Gagal memuat pustaka Excel, cek koneksi internet lalu coba lagi', 'danger'); return; }

    const btn = document.getElementById('admin-grub-dl-btn');
    const prog = document.getElementById('admin-grub-dl-progress');
    if (btn) btn.disabled = true;
    if (prog) prog.style.display = 'block';

    try {
        const zip = new JSZip();
        const usedNames = {};
        const ext = _adminGrubDlFormat === 'excel' ? 'xlsx' : 'doc';
        let sukses = 0;
        for (let i = 0; i < list.length; i++) {
            const row = list[i];
            const namaPeserta = row.user_nama || row.user_kode || 'Peserta';
            if (prog) prog.textContent = `Memproses ${i + 1}/${list.length}: ${namaPeserta}...`;

            const lap = await apiGet(`/laporan/${row.kode || row.id}`).catch(() => null);
            if (!lap || !lap.soal_detail || !lap.soal_detail.length) continue;
            const jawaban = typeof lap.jawaban === 'string' ? JSON.parse(lap.jawaban) : (lap.jawaban || {});
            const soalAll = lap.soal_detail || [];

            let baseName = `${(lap.user_nama || lap.user_kode || 'Peserta')}_${(lap.modul_nama || 'Ujian')}`.replace(/[\\/:*?"<>|]/g, '-').trim() || 'Peserta';
            let fname = `${baseName}.${ext}`, n = 1;
            while (usedNames[fname]) { n++; fname = `${baseName} (${n}).${ext}`; }
            usedNames[fname] = true;

            if (_adminGrubDlFormat === 'excel') {
                if (typeof adminBuildExcelWorkbook !== 'function') continue;
                const wb = adminBuildExcelWorkbook(lap, soalAll, jawaban);
                const arrBuf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                zip.file(fname, arrBuf);
            } else {
                if (typeof adminBuildLaporanWordHtml !== 'function') continue;
                const html = adminBuildLaporanWordHtml(lap, soalAll, jawaban);
                zip.file(fname, '\ufeff' + html);
            }
            sukses++;
        }

        if (!sukses) { showToast('Tidak ada laporan yang berhasil diproses', 'danger'); return; }

        if (prog) prog.textContent = 'Menyusun file ZIP...';
        const blob = await zip.generateAsync({ type: 'blob' });
        const tgl = new Date().toLocaleDateString('id-ID').replace(/\//g, '-');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Laporan_Grup_${String(grubNama).replace(/[\\/:*?"<>|]/g, '-')}_${tgl}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 3000);

        showToast(`Laporan grup berhasil diunduh (${sukses}/${list.length} peserta)`, 'success');
        closeModal('admin-grub-dl-overlay');
    } catch (e) {
        console.error(e);
        showToast('Gagal membuat file ZIP: ' + e.message, 'danger');
    } finally {
        if (btn) btn.disabled = false;
        if (prog) prog.style.display = 'none';
    }
}

// ── LIBRARY ──
let _libData=[],_libSearch='',_libType='all',_libKelompokFilter='all';
const _libSelected=new Set();
async function renderLibrary(){
    [_libData]=await Promise.all([SoalAPI.getAll().catch(()=>[]), _loadSoalKelompokList()]);
    // Buang seleksi lama yang kodenya sudah tidak ada lagi di data terbaru
    const validKodes=new Set(_libData.map(s=>s.kode||s.id));
    Array.from(_libSelected).forEach(k=>{if(!validKodes.has(k))_libSelected.delete(k);});
    _renderLibFilters();
    _renderLibList();
}
const _libTypeOptions=[{value:'all',label:'Semua Tipe'},{value:'multiple_choice',label:'Multiple Choice'},{value:'linier',label:'Linier'},{value:'sikap_kerja',label:'Sikap Kerja'}];
function _renderLibFilters(){
    if(!document.getElementById('library-filters'))return;
    const validKodes=_soalKelompokList.map(k=>k.kode);
    if(_libKelompokFilter!=='all'&&_libKelompokFilter!=='none'&&!validKodes.includes(_libKelompokFilter))_libKelompokFilter='all';
    const kelompokOptions=[{value:'all',label:'Semua Kelompok'},{value:'none',label:'Tanpa Kelompok'},..._soalKelompokList.map(k=>({value:k.kode,label:k.nama}))];
    renderFilterDropdown('library-filters',{title:'Filter',groups:[
        {title:'Tipe Soal',options:_libTypeOptions,current:_libType,onSelect:v=>{_libType=v;_renderLibFilters();_renderLibList();}},
        {title:'Kelompok',options:kelompokOptions,current:_libKelompokFilter,onSelect:v=>{_libKelompokFilter=v;_renderLibFilters();_renderLibList();}}
    ]});
}
function _renderLibList(){
    let data=_libData;
    if(_libSearch)data=data.filter(s=>(s.nama||'').toLowerCase().includes(_libSearch.toLowerCase())||(s.type||'').toLowerCase().includes(_libSearch.toLowerCase())||(_soalKelompokNama(s.kelompok)||'').toLowerCase().includes(_libSearch.toLowerCase()));
    if(_libType!=='all')data=data.filter(s=>s.type===_libType);
    if(_libKelompokFilter==='none')data=data.filter(s=>!s.kelompok);
    else if(_libKelompokFilter!=='all')data=data.filter(s=>s.kelompok===_libKelompokFilter);
    const el=document.getElementById('library-list');if(!el)return;
    el.innerHTML=data.length?data.map((s,i)=>{const kode=s.kode||s.id;const kelNama=_soalKelompokNama(s.kelompok);const chk=_libSelected.has(kode)?'checked':'';return `<div class="lib-card" style="animation:fadeUp 0.25s ${i*0.04}s both"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px"><div style="display:flex;align-items:flex-start;gap:10px;flex:1;min-width:0"><input type="checkbox" class="lib-row-check" data-kode="${kode}" ${chk} onchange="toggleLibSelect('${kode}',this.checked)" style="width:16px;height:16px;accent-color:var(--blue);cursor:pointer;margin-top:3px;flex-shrink:0"><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14px;color:var(--blue);margin-bottom:6px">${s.nama}</div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="badge" style="background:rgba(26,90,160,0.1);color:var(--accent)">${(s.type||'').replace(/_/g,' ')}</span>${kelNama?`<span class="badge" style="background:rgba(19,50,89,0.08);color:var(--blue)">${kelNama}</span>`:''}<span style="font-size:11px;color:var(--text-sub)">${kode}</span><span style="font-size:11px;color:var(--text-sub)">${formatDate(s.created_at)}</span></div></div></div><div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap"><button class="btn btn-secondary btn-sm" onclick="previewLibSoal('${kode}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Preview</button><button class="btn btn-primary btn-sm" onclick="editSoalFromLibrary('${kode}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button><button class="btn btn-secondary btn-sm" onclick="exportLibSoalToExcel('${kode}')" title="Unduh soal ini sebagai file Excel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export</button><button class="btn-icon danger" onclick="deleteLibSoal('${kode}','${s.nama}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button></div></div></div>`;}).join(''):'<div class="empty-state"><p>Belum ada soal di library</p></div>';
    const swEl=document.getElementById('library-swipe-list');
    if(swEl&&window.SwipeCards){
        swEl.innerHTML=data.length?data.map(s=>{const kode=s.kode||s.id;const sel=_libSelected.has(kode);return SwipeCards.buildSwipeCardHtml({
            title:s.nama,kode,selected:sel,
            sub:(s.type||'').replace(/_/g,' ')+(_soalKelompokNama(s.kelompok)?' · '+_soalKelompokNama(s.kelompok):'')+' · '+formatDate(s.created_at),
            leftActions:[
                {icon:'eye',label:'Lihat',cls:'act-secondary',onClick:`previewLibSoal('${kode}')`},
                {icon:'edit',label:'Edit',cls:'act-edit',onClick:`editSoalFromLibrary('${kode}')`},
                {icon:'download',label:'Export',cls:'act-secondary',onClick:`exportLibSoalToExcel('${kode}')`}
            ],
            rightActions:[{icon:'trash',label:'Hapus',cls:'act-danger',onClick:`deleteLibSoal('${kode}','${(s.nama||'').replace(/'/g,"\\'")}')`}]
        });}).join(''):'<div class="swipe-card-empty">Belum ada soal di library</div>';
        SwipeCards.bindSwipeList(swEl,_libSelectOpts());
    }
    _updateLibBulkBar();
}

// ── PILIH MASSAL (Library Soal) — pola sama seperti Manajemen Akun ──
function toggleLibSelect(kode,checked){
    if(checked)_libSelected.add(kode);else _libSelected.delete(kode);
    document.querySelector(`#library-swipe-list .swipe-card[data-kode="${kode}"] .swipe-card-body`)?.classList.toggle('selected',checked);
    _updateLibBulkBar();
}
function toggleSelectAllLib(checked){
    document.querySelectorAll('#library-list .lib-row-check').forEach(cb=>{
        cb.checked=checked;
        if(checked)_libSelected.add(cb.dataset.kode);else _libSelected.delete(cb.dataset.kode);
    });
    document.querySelectorAll('#library-swipe-list .swipe-card').forEach(card=>{
        const kode=card.dataset.kode;if(!kode)return;
        if(checked)_libSelected.add(kode);else _libSelected.delete(kode);
        card.querySelector('.swipe-card-body')?.classList.toggle('selected',checked);
    });
    _updateLibBulkBar();
}
function clearLibSelection(){
    _libSelected.clear();
    document.querySelectorAll('#library-list .lib-row-check').forEach(cb=>cb.checked=false);
    document.querySelectorAll('#library-swipe-list .swipe-card-body').forEach(b=>b.classList.remove('selected'));
    _updateLibBulkBar();
}
// Mode pilih massal ala galeri foto di kartu mobile: tahan lama 1 kartu -> masuk mode pilih
function _libSelectOpts(){
    return {
        selectable:true,
        isSelectMode:()=>_libSelected.size>0,
        onLongPress:(kode,card)=>{ toggleLibSelect(kode,true); card.querySelector('.swipe-card-body')?.classList.add('selected'); },
        onTapSelect:(kode,card)=>{ const willSelect=!_libSelected.has(kode); toggleLibSelect(kode,willSelect); card.querySelector('.swipe-card-body')?.classList.toggle('selected',willSelect); }
    };
}
function _updateLibBulkBar(){
    const n=_libSelected.size;
    const bar=document.getElementById('bulk-bar-lib');if(bar)bar.style.display=n?'flex':'none';
    const cnt=document.getElementById('bulk-count-lib');if(cnt)cnt.textContent=n;
    const selAll=document.getElementById('lib-select-all');
    if(selAll){
        const rows=Array.from(document.querySelectorAll('#library-list .lib-row-check'));
        selAll.checked=rows.length>0&&rows.every(cb=>_libSelected.has(cb.dataset.kode));
    }
}
function deleteSelectedLibSoal(){
    const kodes=Array.from(_libSelected);
    if(!kodes.length){showToast('Pilih minimal 1 soal dulu','danger');return;}
    showConfirm('Hapus Soal Massal',`Yakin hapus ${kodes.length} soal terpilih? Tindakan ini tidak bisa dibatalkan.`,'danger',async()=>{
        const results=await Promise.allSettled(kodes.map(k=>SoalAPI.delete(k)));
        const gagal=results.filter(r=>r.status==='rejected').length;
        clearLibSelection();
        await renderLibrary();
        if(gagal)showToast(`${kodes.length-gagal} soal terhapus, ${gagal} gagal`,'danger');
        else showToast(`${kodes.length} soal berhasil dihapus`,'danger');
    });
}
// Export beberapa soal terpilih sekaligus jadi 1 file .zip berisi banyak .xlsx (format sama dgn Template Upload Soal)
async function exportSelectedLibSoal(){
    const kodes=Array.from(_libSelected);
    if(!kodes.length){showToast('Pilih minimal 1 soal dulu','danger');return;}
    if(typeof JSZip==='undefined'){showToast('Gagal memuat pustaka ZIP, cek koneksi internet lalu coba lagi','danger');return;}
    if(typeof XLSX==='undefined'){showToast('Modul Excel belum siap, muat ulang halaman','danger');return;}
    if(!_soalKelompokList.length) await _loadSoalKelompokList();
    showToast(`Menyiapkan export ${kodes.length} soal...`,'success');
    const zip=new JSZip();
    const usedNames=new Set();
    for(const kode of kodes){
        const s=await SoalAPI.getOne(kode).catch(()=>null);
        if(!s)continue;
        const wbBlob=_buildSoalWorkbookBlob(s);
        let safeName=(s.nama||kode).replace(/[\\/:*?"<>|]/g,'_').slice(0,60)||kode;
        let finalName=safeName;let n=2;
        while(usedNames.has(finalName)){finalName=`${safeName}_${n++}`;}
        usedNames.add(finalName);
        zip.file(`${finalName}.xlsx`,wbBlob);
    }
    const blob=await zip.generateAsync({type:'blob'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`Export_Soal_${kodes.length}item_${new Date().toISOString().slice(0,10)}.zip`;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),2000);
    showToast(`${kodes.length} soal berhasil diekspor ke ZIP`,'success');
}
async function openBulkSetKelompokLib(){
    if(!_libSelected.size){showToast('Pilih minimal 1 soal dulu','danger');return;}
    await _loadSoalKelompokList();
    document.getElementById('bkl-count').textContent=_libSelected.size;
    document.getElementById('bkl-kelompok-select').innerHTML='<option value="">-- Tanpa Kelompok --</option>'+_soalKelompokList.map(k=>`<option value="${k.kode}">${k.nama}</option>`).join('');
    openModal('bulk-kelompok-lib-overlay');
}
async function submitBulkSetKelompokLib(){
    const kodes=Array.from(_libSelected);
    if(!kodes.length){showToast('Tidak ada soal terpilih','danger');return;}
    const kelompok=document.getElementById('bkl-kelompok-select').value||null;
    const results=await Promise.allSettled(kodes.map(k=>SoalAPI.update(k,{kelompok})));
    const gagal=results.filter(r=>r.status==='rejected').length;
    closeModal('bulk-kelompok-lib-overlay');
    clearLibSelection();
    await renderLibrary();
    if(gagal)showToast(`${kodes.length-gagal} soal dipindah, ${gagal} gagal`,'danger');
    else showToast(`${kodes.length} soal berhasil dipindah kelompok`,'success');
}

async function previewLibSoal(kode){
    const s=await SoalAPI.getOne(kode).catch(()=>null);if(!s){showToast('Gagal memuat','danger');return;}
    let html=`<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap"><div><div style="font-family:var(--font-head);font-size:16px;font-weight:700;color:var(--blue)">${s.nama}</div><div style="font-size:12px;color:var(--text-sub)">${s.type} · ${s.kode||s.id}</div></div><button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="closeModal('preview-soal-overlay');editSoalFromLibrary('${kode}')">✏ Edit Soal</button></div>`;
    const data=s.data;
    if(s.type==='sikap_kerja'&&Array.isArray(data)){
        html+=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">`;
        data.forEach(k=>{html+=`<div style="background:rgba(19,50,89,0.04);border-radius:12px;padding:12px;border:1.5px solid rgba(19,50,89,0.08)"><div style="font-weight:700;font-size:13px;color:var(--blue);margin-bottom:6px">Kolom ${k.no}</div><div style="font-size:11px;color:var(--text-sub);margin-bottom:8px">${k.soal.length} soal</div><div style="display:flex;gap:4px;flex-wrap:wrap">${(k.items||[]).map(item=>`<div style="width:32px;height:32px;border-radius:6px;background:rgba(19,50,89,0.06);display:flex;align-items:center;justify-content:center;font-size:14px;overflow:hidden">${item.nilai?(item.nilai.startsWith('data:')||item.nilai.startsWith('/'))?`<img src="${item.nilai}" style="width:28px;height:28px;object-fit:cover;border-radius:4px">`:item.nilai:'?'}</div>`).join('')}</div></div>`;});
        html+=`</div>`;
    } else if(Array.isArray(data)){
        data.slice(0,10).forEach((q,i)=>{
            html+=`<div style="margin-bottom:14px;padding:14px;background:rgba(19,50,89,0.03);border-radius:12px;border:1.5px solid rgba(19,50,89,0.06)"><div style="font-weight:600;font-size:13px;margin-bottom:8px">${i+1}. ${q.soal||'<em>Kosong</em>'}</div><div style="display:flex;flex-direction:column;gap:5px">${(q.jawaban||[]).map((j,ji)=>{const isK=(q.kunci||[]).includes(j.id);return`<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:8px;background:${isK?'rgba(22,163,74,0.08)':'rgba(255,255,255,0.6)'};border:1.5px solid ${isK?'var(--success)':'rgba(19,50,89,0.08)'}"><span style="font-size:11px;font-weight:700;color:var(--text-sub);width:14px">${String.fromCharCode(65+ji)}.</span><div style="flex:1;font-size:12px">${j.teks||'<em style="color:rgba(19,50,89,0.3)">Kosong</em>'}</div>${s.skor_type==='nilai_sendiri'?`<span style="font-size:11px;font-weight:700;color:var(--accent);background:rgba(26,90,160,0.1);padding:2px 7px;border-radius:6px">${j.nilai||0}</span>`:''} ${isK?'<svg viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>`;}).join('')}</div>${q.pembahasan?`<div style="margin-top:8px;padding:8px;background:rgba(26,90,160,0.05);border-radius:8px;font-size:12px;color:var(--text-sub);border-left:3px solid var(--accent)">💡 ${q.pembahasan}</div>`:''}</div>`;
        });
        if(data.length>10)html+=`<p style="text-align:center;color:var(--text-sub);font-size:12px">... dan ${data.length-10} soal lainnya</p>`;
    }
    document.getElementById('preview-soal-body').innerHTML=html;
    openModal('preview-soal-overlay');
}
function deleteLibSoal(kode,nama){
    showConfirm('Hapus Soal',`Yakin hapus "${nama}"?`,'danger',async()=>{await SoalAPI.delete(kode);showToast('Soal dihapus','danger');await renderLibrary();});
}

// ── MODUL ──
let _modulData=[],_soalForModul=[],_modulKelompokList=[],_modulKelompokFilter='all';
function _modulKelompokNama(kode){if(!kode)return null;const k=_modulKelompokList.find(x=>x.kode===kode);return k?k.nama:null;}
async function _loadModulKelompokList(){_modulKelompokList=await ModulKelompokAPI.getAll().catch(()=>[]);return _modulKelompokList;}
async function renderModul(){
    [_modulData,_soalForModul]=await Promise.all([ModulAPI.getAll().catch(()=>[]),SoalAPI.getAll().catch(()=>[])]);
    await _loadModulKelompokList();
    _renderModulKelompokFilters();
    _renderModulList();
}
function _renderModulKelompokFilters(){
    const validKodes=_modulKelompokList.map(k=>k.kode);
    if(_modulKelompokFilter!=='all'&&_modulKelompokFilter!=='none'&&!validKodes.includes(_modulKelompokFilter))_modulKelompokFilter='all';
    if(!document.getElementById('modul-kelompok-filters'))return;
    const options=[{value:'all',label:'Semua Kelompok'},{value:'none',label:'Tanpa Kelompok'},..._modulKelompokList.map(k=>({value:k.kode,label:k.nama}))];
    renderFilterDropdown('modul-kelompok-filters',{options,current:_modulKelompokFilter,title:'Kelompok',onSelect:v=>{_modulKelompokFilter=v;_renderModulKelompokFilters();_renderModulList();}});
}
function _renderModulList(){
    let data=_modulData;
    if(_modulKelompokFilter==='none')data=data.filter(m=>!m.kelompok);
    else if(_modulKelompokFilter!=='all')data=data.filter(m=>m.kelompok===_modulKelompokFilter);
    const el=document.getElementById('modul-list');if(!el)return;
    el.innerHTML=data.length?data.map((m,i)=>{const kelNama=_modulKelompokNama(m.kelompok);return `<div class="modul-card" style="animation:fadeUp 0.25s ${i*0.05}s both"><div class="modul-card-left"><div class="modul-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></div><div><div style="font-weight:700;font-size:14px;color:var(--blue)">${m.nama}</div><div style="font-size:11px;color:var(--text-sub);display:flex;gap:6px;flex-wrap:wrap;align-items:center">${(m.soal_list||[]).length} soal · ${m.kode||m.id}${kelNama?` · <span class="badge" style="background:rgba(19,50,89,0.08);color:var(--blue)">${kelNama}</span>`:''}</div></div></div><div style="display:flex;gap:8px"><button class="btn-icon" onclick="openEditModul('${m.kode||m.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn-icon danger" onclick="deleteModulItem('${m.kode||m.id}','${m.nama}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button></div></div>`;}).join(''):'<div class="empty-state"><p>Belum ada modul</p></div>';
    const swEl=document.getElementById('modul-swipe-list');
    if(swEl&&window.SwipeCards){
        swEl.innerHTML=data.length?data.map(m=>SwipeCards.buildSwipeCardHtml({
            title:m.nama,
            sub:(m.soal_list||[]).length+' soal'+(_modulKelompokNama(m.kelompok)?' · '+_modulKelompokNama(m.kelompok):'')+' · '+(m.kode||m.id),
            leftActions:[{icon:'edit',label:'Edit',cls:'act-edit',onClick:`openEditModul('${m.kode||m.id}')`}],
            rightActions:[{icon:'trash',label:'Hapus',cls:'act-danger',onClick:`deleteModulItem('${m.kode||m.id}','${(m.nama||'').replace(/'/g,"\\'")}')`}]
        })).join(''):'<div class="swipe-card-empty">Belum ada modul</div>';
        SwipeCards.bindSwipeList(swEl);
    }
}
function _populateModulKelompokSelect(selected){
    const sel=document.getElementById('modul-kelompok-select');if(!sel)return;
    sel.innerHTML='<option value="">-- Tanpa Kelompok --</option>'+_modulKelompokList.map(k=>`<option value="${k.kode}">${k.nama}</option>`).join('');
    sel.value=selected||'';
}
function openAddModul(){document.getElementById('modul-form-mode').value='add';document.getElementById('modul-form-id').value='';document.getElementById('modul-form-title').textContent='Buat Modul Baru';document.getElementById('modul-nama-input').value='';_populateModulKelompokSelect('');document.getElementById('modul-soal-picker').innerHTML=_buildSoalPicker([]);openModal('modul-form-overlay');}
function openEditModul(kode){const m=_modulData.find(x=>(x.kode||x.id)==kode);if(!m)return;document.getElementById('modul-form-mode').value='edit';document.getElementById('modul-form-id').value=kode;document.getElementById('modul-form-title').textContent='Edit Modul';document.getElementById('modul-nama-input').value=m.nama;_populateModulKelompokSelect(m.kelompok||'');document.getElementById('modul-soal-picker').innerHTML=_buildSoalPicker(m.soal_list||[]);openModal('modul-form-overlay');}
function _buildSoalPicker(existing=[]){
    if(!_soalForModul.length)return'<p style="color:var(--text-sub);font-size:13px">Belum ada soal di library.</p>';
    return _soalForModul.map(s=>{const ex=existing.find(e=>e.soal_kode===(s.kode||s.id))||{};const ck=!!ex.soal_kode;return`<div style="padding:12px;background:rgba(19,50,89,0.03);border-radius:12px;border:1.5px solid ${ck?'var(--accent)':'rgba(19,50,89,0.08)'};margin-bottom:8px;transition:border-color 0.2s" id="mpick-${s.kode||s.id}"><label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer"><input type="checkbox" data-soal-kode="${s.kode||s.id}" ${ck?'checked':''} onchange="toggleModulSoal('${s.kode||s.id}',this.checked)" style="margin-top:3px;accent-color:var(--blue);width:16px;height:16px;flex-shrink:0"><div style="flex:1"><div style="font-weight:700;font-size:13px;color:var(--blue)">${s.nama}</div><div style="font-size:11px;color:var(--text-sub)">${(s.type||'').replace(/_/g,' ')}</div></div></label><div id="mopts-${s.kode||s.id}" style="display:${ck?'block':'none'};margin-top:10px;padding:10px;background:rgba(255,255,255,0.7);border-radius:10px">${s.type!=='sikap_kerja'?`<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:8px"><label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-prop="acak_soal" data-skode="${s.kode||s.id}" ${ex.acak_soal?'checked':''} style="accent-color:var(--blue)"> Acak Soal</label><label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-prop="acak_jawaban" data-skode="${s.kode||s.id}" ${ex.acak_jawaban?'checked':''} style="accent-color:var(--blue)"> Acak Jawaban</label></div><label style="font-size:12px;color:var(--text-sub)">Bobot (%): <input type="number" data-prop="persen" data-skode="${s.kode||s.id}" value="${ex.persen||100}" min="0" max="100" class="form-input" style="width:80px;display:inline;padding:4px 8px;font-size:13px"></label>`:'<p style="font-size:12px;color:var(--text-sub)">Sikap kerja: laporan grafik terpisah.</p>'}</div></div>`;}).join('');
}
function toggleModulSoal(kode,ck){const e=document.getElementById(`mopts-${kode}`),c=document.getElementById(`mpick-${kode}`);if(e)e.style.display=ck?'block':'none';if(c)c.style.borderColor=ck?'var(--accent)':'rgba(19,50,89,0.08)';}
async function submitModulForm(){
    const mode=document.getElementById('modul-form-mode').value,kode=document.getElementById('modul-form-id').value;
    const nama=document.getElementById('modul-nama-input').value.trim();if(!nama){showToast('Nama modul wajib','danger');return;}
    const kelompok=document.getElementById('modul-kelompok-select')?.value||'';
    const soal_list=[];
    document.querySelectorAll('#modul-soal-picker [data-soal-kode]:checked').forEach(cb=>{const sk=cb.dataset.soalKode;soal_list.push({soal_kode:sk,acak_soal:document.querySelector(`[data-prop="acak_soal"][data-skode="${sk}"]`)?.checked||false,acak_jawaban:document.querySelector(`[data-prop="acak_jawaban"][data-skode="${sk}"]`)?.checked||false,persen:parseInt(document.querySelector(`[data-prop="persen"][data-skode="${sk}"]`)?.value)||100});});
    if(!soal_list.length){showToast('Pilih minimal 1 soal','danger');return;}
    try{if(mode==='add')await ModulAPI.create({nama,kelompok,soal_list});else await ModulAPI.update(kode,{nama,kelompok,soal_list});clearDirty();closeModal('modul-form-overlay');showToast('Modul disimpan!','success');await renderModul();}catch(e){showToast('Gagal: '+e.message,'danger');}
}
function deleteModulItem(kode,nama){showConfirm('Hapus Modul',`Yakin hapus "${nama}"?`,'danger',async()=>{await ModulAPI.delete(kode);showToast('Modul dihapus','danger');await renderModul();});}

// ── KELOLA KELOMPOK MODUL (opsional) ──
function openManageModulKelompok(){const input=document.getElementById('modul-kelompok-new-input');if(input)input.value='';_renderModulKelompokManageList();openModal('modul-kelompok-overlay');}
function _renderModulKelompokManageList(){
    const el=document.getElementById('modul-kelompok-manage-list');if(!el)return;
    if(!_modulKelompokList.length){el.innerHTML='<p style="color:var(--text-sub);font-size:13px">Belum ada kelompok. Tambahkan lewat kolom di atas.</p>';return;}
    el.innerHTML=_modulKelompokList.map(k=>`
      <div class="ebook-pick-item" id="mkl-row-${k.kode}" style="justify-content:space-between">
        <span id="mkl-nama-${k.kode}" style="font-weight:600;font-size:13.5px;color:var(--blue)">${k.nama}</span>
        <div class="mkl-row-actions" style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn-icon" title="Ganti nama" onclick="_startRenameModulKelompok('${k.kode}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn-icon danger" title="Hapus" onclick="deleteModulKelompokItem('${k.kode}','${(k.nama||'').replace(/'/g,"\\'")}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
        </div>
      </div>`).join('');
}
async function addModulKelompok(){
    const input=document.getElementById('modul-kelompok-new-input');const nama=(input?.value||'').trim();
    if(!nama){showToast('Nama kelompok wajib diisi','danger');return;}
    try{await ModulKelompokAPI.create({nama});if(input)input.value='';showToast('Kelompok ditambahkan','success');await _afterModulKelompokChange();}catch(e){showToast('Gagal: '+e.message,'danger');}
}
function _startRenameModulKelompok(kode){
    const span=document.getElementById(`mkl-nama-${kode}`);if(!span)return;const current=span.textContent;
    span.outerHTML=`<input id="mkl-nama-${kode}" class="form-input" style="padding:6px 10px;font-size:13px" type="text" value="${current.replace(/"/g,'&quot;')}" onkeydown="if(event.key==='Enter')_saveRenameModulKelompok('${kode}')">`;
    const row=document.getElementById(`mkl-row-${kode}`);const actionsWrap=row?.querySelector('.mkl-row-actions');
    if(actionsWrap)actionsWrap.innerHTML=`<button class="btn-icon" title="Simpan" onclick="_saveRenameModulKelompok('${kode}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg></button>`;
    document.getElementById(`mkl-nama-${kode}`)?.focus();
}
async function _saveRenameModulKelompok(kode){
    const input=document.getElementById(`mkl-nama-${kode}`);const nama=(input?.value||'').trim();
    if(!nama){showToast('Nama kelompok wajib diisi','danger');return;}
    try{await ModulKelompokAPI.update(kode,{nama});showToast('Kelompok diperbarui','success');await _afterModulKelompokChange();}catch(e){showToast('Gagal: '+e.message,'danger');}
}
function deleteModulKelompokItem(kode,nama){
    showConfirm('Hapus Kelompok',`Yakin hapus kelompok "${nama}"? Modul yang ada di kelompok ini akan menjadi tanpa kelompok.`,'danger',async()=>{
        await ModulKelompokAPI.delete(kode);showToast('Kelompok dihapus','danger');await _afterModulKelompokChange();
    });
}
async function _afterModulKelompokChange(){
    await _loadModulKelompokList();_renderModulKelompokManageList();
    if(document.getElementById('modul-kelompok-select'))_populateModulKelompokSelect(document.getElementById('modul-kelompok-select').value);
    if(document.getElementById('modul-kelompok-filters')){_renderModulKelompokFilters();_renderModulList();}
}

// ── AKUN ADMIN ──
function renderAkunAdmin(){
    const user=Auth.getUser();if(!user)return;
    const n=document.getElementById('akun-admin-nama'),e=document.getElementById('akun-admin-email');
    if(n)n.textContent=user.nama||'-';if(e)e.textContent=user.email||'-';
    const ni=document.getElementById('aa-nama'),ei=document.getElementById('aa-email');
    if(ni)ni.value=user.nama||'';if(ei)ei.value=user.email||'';
}
async function submitAkunAdmin(){
    const nama=document.getElementById('aa-nama')?.value.trim(),email=document.getElementById('aa-email')?.value.trim();
    const pw=document.getElementById('aa-pw')?.value,pwk=document.getElementById('aa-pwk')?.value;
    if(!nama||!email){showToast('Nama dan email wajib','danger');return;}
    if(pw&&pw!==pwk){showToast('Konfirmasi password tidak cocok','danger');return;}
    if(pw&&pw.length<6){showToast('Password minimal 6 karakter','danger');return;}
    try{const data={nama,email};if(pw)data.password=pw;await MeAPI.update(data);const u=Auth.getUser();Auth.setSession(Auth.getToken(),{...u,nama,email});clearDirty();renderAkunAdmin();showToast('Profil diperbarui!','success');if(document.getElementById('aa-pw'))document.getElementById('aa-pw').value='';if(document.getElementById('aa-pwk'))document.getElementById('aa-pwk').value='';}catch(e){showToast('Gagal: '+e.message,'danger');}
}
function handleLogout(){showConfirm('Keluar','Yakin ingin keluar?','warning',()=>{Auth.clearSession();showToast('Sampai jumpa!');setTimeout(()=>window.location.href='index.html',1200);});}


// (Modul KEUANGAN dipindah sepenuhnya ke admin/keuangan.js + admin/paket-form.js — real payment gateway, lihat file tsb)

// ── REVIEW PAGE ──
let _rvUsers=[],_rvSearch='';
async function renderReviewPage(){_rvUsers=await ReviewAPI.getUsers().catch(()=>[]);_renderRvList();}
function _renderRvList(){
    let data=_rvUsers;if(_rvSearch){const q=_rvSearch.toLowerCase();data=data.filter(u=>(u.nama||'').toLowerCase().includes(q)||(u.email||'').toLowerCase().includes(q));}
    const el=document.getElementById('review-user-list');if(!el)return;
    el.innerHTML=data.length?data.map((u,i)=>`<tr style="animation:fadeUp 0.2s ${i*0.04}s both"><td>${i+1}</td><td><strong>${u.nama}</strong></td><td>${u.email}</td><td class="hide-mobile"><span class="badge badge-${u.status}">${u.status}</span></td><td><button class="btn btn-secondary btn-sm" onclick="openRvUserLaporan('${u.kode||u.id}','${u.nama}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg> Laporan</button></td></tr>`).join(''):`<tr><td colspan="5"><div class="empty-state"><p>Belum ada user</p></div></td></tr>`;
    const swEl=document.getElementById('review-page-swipe-list');
    if(swEl&&window.SwipeCards){
        swEl.innerHTML=data.length?data.map(u=>SwipeCards.buildSwipeCardHtml({
            title:u.nama,sub:u.email,
            sideHtml:`<span class="badge badge-${u.status}" style="font-size:10px">${u.status}</span>`,
            onTapAttr:`onclick="openRvUserLaporan('${u.kode||u.id}','${u.nama}')"`
        })).join(''):'<div class="swipe-card-empty">Belum ada user</div>';
        SwipeCards.bindSwipeList(swEl);
    }
}
async function openRvUserLaporan(kode,nama){
    const lap=await ReviewAPI.getLaporanUser(kode).catch(()=>[]);
    const body=document.getElementById('review-user-laporan-body'),tl=document.getElementById('review-user-laporan-title');
    if(tl)tl.textContent=`Laporan — ${nama}`;
    if(!body)return;
    body.innerHTML=lap.length?`<div class="table-wrap"><table><thead><tr><th>#</th><th>Token</th><th>Modul</th><th>Tgl Selesai</th><th>Skor</th><th>Unduh</th></tr></thead><tbody>${lap.map((l,i)=>`<tr><td>${i+1}</td><td><code style="font-size:11px">${l.token_kode}</code></td><td>${l.modul_kode}</td><td>${formatDate(l.tgl_selesai)}</td><td><strong>${l.skor}</strong></td><td style="display:flex;gap:6px"><button class="btn btn-secondary btn-sm" onclick="downloadRvLaporan('${l.kode}','excel',this)" style="border-color:rgba(22,163,74,0.3);color:var(--success)">Excel</button><button class="btn btn-secondary btn-sm" onclick="downloadRvLaporan('${l.kode}','word',this)">Word</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state" style="padding:24px"><p>User belum mengikuti ujian apapun</p></div>';
    openModal('review-user-laporan-overlay');
}

// Mengunduh laporan hasil ujian (satu baris di tabel "Laporan User") sebagai file Excel/Word.
// Mengambil detail lengkap (termasuk soal & jawaban) lewat GET /api/laporan/:kode, lalu
// memakai fungsi export yang sudah ada (adminDoDownloadExcel/adminDoDownloadWord).
async function downloadRvLaporan(kode, format, btnEl) {
    if (format === 'excel' && typeof XLSX === 'undefined') {
        showToast('Library XLSX tidak termuat, coba muat ulang halaman', 'danger'); return;
    }
    if (typeof adminDoDownloadExcel !== 'function' || typeof adminDoDownloadWord !== 'function') {
        showToast('Fitur unduh laporan belum tersedia di halaman ini', 'danger'); return;
    }
    const originalLabel = btnEl ? btnEl.innerHTML : null;
    if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '...'; }
    try {
        const lap = await apiGet(`/laporan/${kode}`);
        if (!lap) { showToast('Data laporan tidak ditemukan', 'danger'); return; }
        const jawaban = typeof lap.jawaban === 'string' ? JSON.parse(lap.jawaban) : (lap.jawaban || {});
        const soalAll = lap.soal_detail || [];
        if (!soalAll.length) { showToast('Detail soal untuk laporan ini tidak ditemukan', 'danger'); return; }
        if (format === 'excel') adminDoDownloadExcel(lap, soalAll, jawaban);
        else adminDoDownloadWord(lap, soalAll, jawaban);
    } catch (e) {
        showToast('Gagal mengunduh laporan', 'danger');
    } finally {
        if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = originalLabel; }
    }
}

// ── SIGNUP REQUESTS ──
let _signups=[];
async function renderSignupRequests(){
    _signups=await UsersAPI.getSignupRequests().catch(()=>[]);
    const el=document.getElementById('signup-req-list');if(!el)return;
    el.innerHTML=_signups.length?_signups.map((r,i)=>`<tr style="animation:fadeUp 0.2s ${i*0.04}s both"><td>${i+1}</td><td><strong>${r.nama}</strong></td><td>${r.email}</td><td class="hide-mobile">${r.paket_nama?`<span class="badge badge-aktif" style="font-size:10px">${r.paket_nama}</span>`:'<span style="color:#94a3b8;font-size:11px">-</span>'}</td><td style="font-size:11px">${formatDateTime(r.created_at)}</td><td><div style="display:flex;gap:6px"><button class="btn btn-primary btn-sm" onclick="approveSignup(${r.id})">✓ Aktivasi</button><button class="btn btn-danger btn-sm" onclick="rejectSignup(${r.id})">✗ Tolak</button></div></td></tr>`).join(''):`<tr><td colspan="6"><div class="empty-state"><p>Tidak ada permintaan pendaftaran</p></div></td></tr>`;
    const swEl=document.getElementById('signup-swipe-list');
    if(swEl&&window.SwipeCards){
        swEl.innerHTML=_signups.length?_signups.map(r=>SwipeCards.buildSwipeCardHtml({
            title:r.nama,sub:r.email+(r.paket_nama?` · ${r.paket_nama}`:''),
            leftActions:[{icon:'check',label:'Aktivasi',cls:'act-primary',onClick:`approveSignup(${r.id})`}],
            rightActions:[{icon:'cross',label:'Tolak',cls:'act-danger',onClick:`rejectSignup(${r.id})`}]
        })).join(''):'<div class="swipe-card-empty">Tidak ada permintaan pendaftaran</div>';
        SwipeCards.bindSwipeList(swEl);
    }
}
async function approveSignup(id){showConfirm('Aktivasi Akun','Yakin aktifkan akun ini?','warning',async()=>{try{await UsersAPI.approveSignup(id);showToast('Akun diaktifkan!','success');await renderSignupRequests();await renderHome();}catch(e){showToast('Gagal: '+e.message,'danger');}});}
async function rejectSignup(id){showConfirm('Tolak Pendaftaran','Yakin tolak pendaftaran ini?','danger',async()=>{try{await UsersAPI.rejectSignup(id);showToast('Ditolak','danger');await renderSignupRequests();}catch(e){showToast('Gagal','danger');}});}