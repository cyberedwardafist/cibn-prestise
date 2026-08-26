// admin/laporan.js
// Modul LAPORAN — lazy-load saat tab Laporan dibuka. Butuh admin/shared-export.js (adminDoDownloadExcel/Word) yang dimuat bersamaan.
// Bergantung pada helper global dari js/app.js (showToast, openModal, navigateTo, dst)
// yang sudah dimuat lebih dulu lewat shell index_admin.html.

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
    const namaTampilRv = s.nama_internal ? `${s.nama} <span style="font-weight:400;color:var(--text-sub)">| ${s.nama_internal}</span>` : s.nama;

    if (s.type === 'sikap_kerja') {
        return `<div class="card" style="padding:14px;margin-bottom:12px">
            <div style="font-weight:700;color:var(--blue);margin-bottom:4px">${namaTampilRv} <span class="badge" style="background:rgba(19,50,89,0.08);color:var(--text-sub);margin-left:6px">Sikap Kerja</span></div>
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
        <div style="font-weight:700;color:var(--blue);margin-bottom:10px">${namaTampilRv}${isNS ? ' <span class="badge" style="background:rgba(26,90,160,0.1);color:var(--accent)">Nilai per Jawaban</span>' : ''}</div>
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
                <span style="flex:1;font-size:12px;font-weight:600;color:var(--blue)">${s.nama_internal ? `${s.nama} <span style="font-weight:400;color:var(--text-sub)">| ${s.nama_internal}</span>` : s.nama}</span>
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
                <span style="flex:1;font-size:12px;font-weight:600;color:var(--blue)">${s.nama_internal ? `${s.nama} <span style="font-weight:400;color:var(--text-sub)">| ${s.nama_internal}</span>` : s.nama}</span>
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

// (state LIBRARY dipindah ke admin/library.js — dulu salah taruh di sini,
// jadi ReferenceError kalau tab Soal/Library/Modul dibuka sebelum pernah
// buka tab Laporan/Token)