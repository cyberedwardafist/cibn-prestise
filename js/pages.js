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
let _lapData = [], _lapSearch = '', _lapPage = 1;

async function renderLaporan() {
    _lapData = await LaporanAPI.getAll().catch(() => []);
    _renderLapTable();
}

function _renderLapTable() {
    let data = _lapData;
    if (_lapSearch) {
        const q = _lapSearch.toLowerCase();
        data = data.filter(l => (l.token_kode || '').toLowerCase().includes(q) || (l.modul_kode || '').toLowerCase().includes(q));
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
function handleLogout(){showConfirm('Keluar','Yakin ingin keluar?','warning',()=>{Auth.clearSession();showToast('Sampai jumpa!');setTimeout(()=>window.location.href='landing.html',1200);});}

// ── LANDING (Embedded editor — no iframe needed) ──
let _ldEditorInitialized = false;

function renderLanding() {
    // Panel navigasi landing (vertikal) tampil di samping — main-dock TIDAK disembunyikan,
    // jadi keluar dari mode landing cukup klik menu lain di main-dock.
    const ldWrap = document.getElementById('landing-dock-wrap');
    if (ldWrap) ldWrap.classList.add('open');

    // Sembunyikan page-container scroll
    const pc = document.querySelector('.page-container');
    if (pc) pc.style.overflow = 'hidden';

    // Init editor hanya sekali
    if (!_ldEditorInitialized) {
        _ldEditorInitialized = true;
        ldInitAllData();
    }

    // Aktifkan panel pertama (Hero) dan update dock
    ldShowPanel('hero');
}

function landingNav(panel) {
    ldShowPanel(panel);
    document.querySelectorAll('.landing-nav-btn').forEach(b =>
        b.classList.toggle('active-tab', b.dataset.panel === panel));
}

// ── AUTO-SAVE: setiap perubahan di editor landing langsung tersimpan ke server ──
// (tidak ada lagi tombol UPDATE manual — dipanggil dari listener input/change
// di ld-editor-main, dari tiap ldRender*(), dan dari upload/reset avatar)
let _ldDataReady = false;
let _ldAutoSaveTimer = null;
function ldQueueAutoSave() {
    if (!_ldDataReady) return; // jangan simpan saat data awal masih dimuat/dirender
    clearTimeout(_ldAutoSaveTimer);
    _ldAutoSaveTimer = setTimeout(() => ldExportHTML(true), 900);
}



// ── LD EDITOR: Panel navigation ──
function ldShowPanel(name) {
    document.querySelectorAll('.ld-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('ld-panel-' + name);
    if (panel) panel.classList.add('active');
    document.querySelectorAll('.landing-nav-btn').forEach(b =>
        b.classList.toggle('active-tab', b.dataset.panel === name));

}

// ── LD EDITOR: Data models ──
let ldFiturCards = [
    {icon:'🎯', title:'Bank Soal Adaptif', desc:'Sistem AI yang menyesuaikan tingkat kesulitan soal berdasarkan kemampuan real-time peserta.'},
    {icon:'📊', title:'Analitik Mendalam', desc:'Dashboard canggih dengan insight performa, tren belajar, dan rekomendasi peningkatan personal.'},
    {icon:'🔒', title:'Ujian Aman', desc:'Teknologi anti-kecurangan berlapis dengan pengawasan AI dan enkripsi data tingkat enterprise.'},
    {icon:'📱', title:'Multi-Platform', desc:'Belajar di mana saja – desktop, tablet, dan smartphone dengan sinkronisasi otomatis lintas perangkat.'},
    {icon:'🤖', title:'Asisten AI 24/7', desc:'Tanya jawab instan dengan AI tutor yang memahami konteks materi dan memberikan penjelasan mendalam.'},
    {icon:'🏅', title:'Sertifikat Digital', desc:'Sertifikat blockchain-verified yang dapat diverifikasi langsung oleh perusahaan dan institusi terkait.'},
];

let ldPaketData = [
    {name:'Starter', price:'Rp149K', unit:'/bulan', desc:'Cocok untuk pemula yang ingin mulai berlatih', featured:false,
     features:['Akses 50 soal per hari','5 simulasi ujian / bulan','Laporan dasar','Akses komunitas'], btnText:'Mulai Sekarang'},
    {name:'Professional', price:'Rp299K', unit:'/bulan', desc:'Solusi lengkap untuk profesional yang serius', featured:true,
     features:['Soal tanpa batas','Simulasi ujian tidak terbatas','Analitik mendalam','AI Tutor 24/7','Sertifikat digital','Mentoring 2x/bulan'], btnText:'Pilih Professional'},
    {name:'Enterprise', price:'Custom', unit:'', desc:'Untuk institusi dan perusahaan dengan kebutuhan khusus', featured:false,
     features:['Lisensi multi-pengguna','Dashboard admin khusus','Integrasi API','Pelatihan tim dedicated','SLA & dukungan prioritas'], btnText:'Hubungi Kami'},
];

let ldMateriData = [
    {title:'Akuntansi & Keuangan', desc:'PSAK, perpajakan, audit, dan manajemen keuangan', tag:'38 Modul'},
    {title:'Manajemen SDM', desc:'Rekrutmen, pelatihan, kompensasi, dan hubungan kerja', tag:'24 Modul'},
    {title:'Teknologi Informasi', desc:'Keamanan siber, cloud computing, dan tata kelola IT', tag:'42 Modul'},
    {title:'Hukum & Kepatuhan', desc:'Regulasi perbankan, pasar modal, dan hukum bisnis', tag:'30 Modul'},
    {title:'Perbankan & Fintech', desc:'Produk perbankan, digital payment, dan fintech regulation', tag:'36 Modul'},
    {title:'Manajemen Risiko', desc:'ERM, Basel III, stress testing, dan mitigasi risiko', tag:'28 Modul'},
    {title:'Kepemimpinan & Strategi', desc:'Leadership, strategic planning, dan change management', tag:'20 Modul'},
    {title:'Asuransi & Investasi', desc:'Produk asuransi, analisis investasi, dan portofolio', tag:'32 Modul'},
];

let ldTestiData = [
    {stars:5, text:'Platform yang luar biasa! Saya lulus ujian WMI dalam sekali coba setelah berlatih intensif di sini. Materinya sangat komprehensif.', initials:'AR', name:'Ahmad Rizky', role:'Wealth Manager · BRI'},
    {stars:5, text:'Analitik performanya sangat detail. Saya bisa tahu persis kelemahan saya di bagian mana dan fokus belajar di sana.', initials:'DP', name:'Dewi Puspita', role:'Compliance Officer · Mandiri'},
    {stars:5, text:'AI Tutor-nya sangat membantu! Kapanpun ada pertanyaan, langsung dijawab dengan penjelasan yang mudah dipahami.', initials:'BH', name:'Budi Hartono', role:'Risk Analyst · BNI'},
    {stars:4, text:'Soal-soalnya sangat relevan dengan ujian asli. Berasa seperti latihan sungguhan. Recommended banget untuk semua profesional.', initials:'SM', name:'Siti Mardiana', role:'Auditor · Deloitte Indonesia'},
    {stars:5, text:'Interface-nya elegan dan tidak membingungkan. Mudah digunakan bahkan untuk yang tidak terlalu melek teknologi sekalipun.', initials:'RN', name:'Rudi Nugroho', role:'Branch Manager · BCA'},
];

let ldFaqData = [
    {q:'Apakah saya bisa mencoba sebelum berlangganan?', a:'Ya! Kami menyediakan akses uji coba gratis dengan soal terbatas. Anda bisa langsung mencoba tanpa perlu mendaftar terlebih dahulu.'},
    {q:'Bagaimana sistem pembayaran berlaku?', a:'Kami menerima transfer bank, kartu kredit/debit, e-wallet (GoPay, OVO, Dana), dan QRIS. Pembayaran diproses secara aman dengan enkripsi SSL.'},
    {q:'Apakah materi selalu diperbarui?', a:'Ya, tim konten kami secara rutin memperbarui materi sesuai perkembangan regulasi dan standar industri terbaru.'},
    {q:'Apakah sertifikat dari CIBN Akademi diakui?', a:'Sertifikat kami diakui oleh berbagai institusi keuangan, perusahaan, dan lembaga pemerintah di Indonesia.'},
    {q:'Bagaimana jika tidak lulus ujian sertifikasi?', a:'Kami menawarkan program remedial gratis dan analisis mendalam tentang area yang perlu ditingkatkan.'},
    {q:'Berapa lama akses berlaku setelah berlangganan?', a:'Akses berlaku sesuai paket yang dipilih (bulanan atau tahunan). Paket tahunan mendapat diskon hingga 30%.'},
];

let ldSoalData = [
    {q:'Apa kepanjangan dari OJK dalam sistem keuangan Indonesia?', opts:['Otoritas Jasa Keuangan','Organisasi Jasa Keuangan','Otoritas Jaminan Keuangan','Operasional Jasa Keuangan'], ans:0},
    {q:'Rasio kecukupan modal minimum bank umum menurut regulasi Basel III adalah…', opts:['6%','8%','10%','12%'], ans:1},
    {q:'Manakah yang termasuk instrumen pasar uang?', opts:['Obligasi jangka panjang','Sertifikat Bank Indonesia (SBI)','Saham biasa','Reksadana saham'], ans:1},
    {q:"Prinsip 'Know Your Customer' (KYC) terutama bertujuan untuk…", opts:['Meningkatkan profit bank','Mencegah pencucian uang dan pendanaan terorisme','Mempercepat layanan nasabah','Mengurangi biaya operasional'], ans:1},
    {q:'Value at Risk (VaR) digunakan untuk mengukur…', opts:['Profitabilitas portofolio','Potensi kerugian maksimum pada tingkat kepercayaan tertentu','Kecepatan perputaran aset','Rasio likuiditas jangka pendek'], ans:1},
];

let ldFooterPlatform = [
    {text:'Fitur Unggulan',href:'#'},{text:'Bank Soal',href:'#'},{text:'Simulasi Ujian',href:'#'},{text:'AI Tutor',href:'#'},{text:'Sertifikasi',href:'#'},
];
let ldFooterPerusahaan = [
    {text:'Tentang Kami',href:'#'},{text:'Tim Pengajar',href:'#'},{text:'Blog & Artikel',href:'#'},{text:'Karir',href:'#'},{text:'Kebijakan Privasi',href:'#'},
];
let ldSocialData = [
    {label:'Instagram',short:'ig',href:'#'},{label:'LinkedIn',short:'in',href:'#'},{label:'YouTube',short:'yt',href:'#'},{label:'Twitter/X',short:'x',href:'#'},{label:'WhatsApp',short:'wa',href:'#'},
];
let ldChatQuickData = [
    {icon:'💎', text:'Info Paket', reply:'Kami memiliki 3 paket: Starter (Rp149K/bln), Professional (Rp299K/bln), dan Enterprise (custom).'},
    {icon:'📝', text:'Cara Daftar', reply:'Daftar sangat mudah! Klik tombol "Masuk" lalu pilih "Daftar Sekarang". Prosesnya hanya 2 menit.'},
    {icon:'📚', text:'Materi', reply:'Kami punya 200+ modul mencakup Akuntansi, SDM, IT, Hukum, Perbankan, dan banyak lagi!'},
    {icon:'▶', text:'Coba Ujian Gratis', reply:'Klik tombol "Coba Ujian Gratis" di halaman ini untuk mencoba 5 soal demo tanpa perlu daftar!'},
];
let ldKeywordData = [
    {keyword:'harga', reply:'Paket kami mulai dari Rp149K/bulan. Lihat detail lengkap di bagian Paket Harga!'},
    {keyword:'sertifikat', reply:'Sertifikat kami diakui berbagai institusi keuangan di Indonesia, dilengkapi teknologi blockchain.'},
    {keyword:'diskon', reply:'Kami menawarkan diskon hingga 30% untuk paket tahunan!'},
];
let ldAvatarData = null;

function ldInitAllData() {
    // Muat data dari SERVER via API /api/landing dan /api/pakets secara paralel
    Promise.all([
        fetch(window.location.origin + '/api/landing').then(r => r.json()).catch(() => null),
        PaketAPI.getAll().catch(() => [])
    ]).then(([saved, keuanganPakets]) => {
        _keuanganPaketsForLanding = keuanganPakets || [];
        _ldApplyLoadedData(saved || null);
    }).catch(() => { _ldApplyLoadedData(null); });
}

function _ldApplyLoadedData(saved) {
    try {
        if (saved && Object.keys(saved).length > 0) {
            const setV = (id, v) => { const el = document.getElementById(id); if(el && v != null) el.value = v; };
            // Nav
            if (saved.nav) {
                const n = saved.nav;
                setV('nav_brand', n.brand); setV('nav_subbrand', n.subbrand); setV('nav_cta', n.cta);
                if (n.menus && n.menus.length >= 5) {
                    setV('nav_m1_text', n.menus[0].text); setV('nav_m1_href', n.menus[0].href);
                    setV('nav_m2_text', n.menus[1].text); setV('nav_m2_href', n.menus[1].href);
                    setV('nav_m3_text', n.menus[2].text); setV('nav_m3_href', n.menus[2].href);
                    setV('nav_m4_text', n.menus[3].text); setV('nav_m4_href', n.menus[3].href);
                    setV('nav_m5_text', n.menus[4].text); setV('nav_m5_href', n.menus[4].href);
                }
            }
            if (saved.pageTitle) setV('page_title', saved.pageTitle);
            // Hero
            if (saved.hero) {
                const h = saved.hero;
                setV('hero_badge', h.badge); setV('hero_h1_1', h.h1?.[0]); setV('hero_h1_2', h.h1?.[1]); setV('hero_h1_3', h.h1?.[2]);
                setV('hero_sub', h.sub); setV('hero_btn1', h.btn1); setV('hero_btn2', h.btn2); setV('hero_btn2_href', h.btn2href);
                if (h.stats?.length >= 3) {
                    setV('stat1_num', h.stats[0].num); setV('stat1_label', h.stats[0].label);
                    setV('stat2_num', h.stats[1].num); setV('stat2_label', h.stats[1].label);
                    setV('stat3_num', h.stats[2].num); setV('stat3_label', h.stats[2].label);
                }
            }
            // Coba
            if (saved.coba) {
                const c = saved.coba;
                setV('coba_tag', c.tag); setV('coba_title', c.title); setV('coba_sub', c.sub);
                setV('coba_card_title', c.cardTitle); setV('coba_card_desc', c.cardDesc); setV('coba_btn', c.btn);
            }
            // Promo
            if (saved.promo) {
                const p = saved.promo;
                setV('promo_tag', p.tag); setV('promo_h2_1', p.h2_1); setV('promo_h2_2', p.h2_2); setV('promo_desc', p.desc);
            }
            // Mitra
            if (saved.mitra) {
                const m = saved.mitra;
                setV('mitra_tag', m.tag); setV('mitra_title', m.title); setV('mitra_sub', m.sub);
                if (m.list) setV('mitra_list', m.list.join('\n'));
            }
            // Fitur
            if (saved.fitur) {
                setV('fitur_tag', saved.fitur.tag); setV('fitur_title', saved.fitur.title); setV('fitur_sub', saved.fitur.sub);
                if (saved.fitur.cards) ldFiturCards = saved.fitur.cards;
            }
            // Paket
            if (saved.paket) {
                setV('paket_tag', saved.paket.tag); setV('paket_title', saved.paket.title); setV('paket_sub', saved.paket.sub);
                if (saved.paket.list) ldPaketData = saved.paket.list;
            }
            // Materi
            if (saved.materi) {
                setV('materi_tag', saved.materi.tag); setV('materi_title', saved.materi.title); setV('materi_sub', saved.materi.sub);
                if (saved.materi.list) ldMateriData = saved.materi.list;
            }
            // Testi
            if (saved.testi) {
                setV('testi_tag', saved.testi.tag); setV('testi_title', saved.testi.title);
                if (saved.testi.list) ldTestiData = saved.testi.list;
            }
            // FAQ
            if (saved.faq) {
                setV('faq_tag', saved.faq.tag); setV('faq_title', saved.faq.title);
                if (saved.faq.list) ldFaqData = saved.faq.list;
            }
            // Soal
            if (saved.soal) ldSoalData = saved.soal;
            // Footer
            if (saved.footer) {
                const f = saved.footer;
                setV('footer_brand_desc', f.brandDesc); setV('footer_copy', f.copy); setV('footer_reg', f.reg);
                setV('footer_phone', f.phone); setV('footer_email', f.email); setV('footer_address', f.address);
                setV('canvas_text', f.canvasText);
                if (f.platform) ldFooterPlatform = f.platform;
                if (f.perusahaan) ldFooterPerusahaan = f.perusahaan;
                if (f.social) ldSocialData = f.social;
            }
            // Chat
            if (saved.chat) {
                const c = saved.chat;
                setV('chat_name', c.name); setV('chat_status', c.status); setV('chat_greeting', c.greeting);
                setV('chat_placeholder', c.placeholder); setV('chat_default_reply', c.defaultReply);
                if (c.quickReplies) ldChatQuickData = Object.entries(c.quickReplies).map(([k,v])=>{const parts=k.split(' ');return{icon:parts[0]||'💬',text:parts.slice(1).join(' ')||k,reply:v};});
                if (c.keywords) ldKeywordData = c.keywords;
                if (c.avatar) { ldAvatarData = c.avatar; const preview = document.getElementById('avatar-preview'); if(preview) preview.innerHTML = `<img src="${c.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`; }
            }
            // SK & KP
            if (saved.sk) { setV('sk_title', saved.sk.title); setV('sk_content', saved.sk.content); }
            if (saved.kp) { setV('kp_title', saved.kp.title); setV('kp_content', saved.kp.content); }
        }
    } catch(e) { console.warn('[Landing Editor] Gagal muat data:', e); }

    ldRenderFiturCards();
    ldRenderPaket();
    ldRenderMateri();
    ldRenderTesti();
    ldRenderFaq();
    ldRenderSoal();
    ldRenderFooterLinks();
    ldRenderChatQuick();
    ldRenderKeywords();
    _ldDataReady = true;
}

// ── Fitur Cards ──
function ldRenderFiturCards() {
    const c = document.getElementById('fitur-cards-list'); if (!c) return;
    c.innerHTML = ldFiturCards.map((f, i) => `
        <div class="ld-repeat-item">
            <div class="ld-repeat-hd"><span class="ld-repeat-title">${f.icon} Kartu ${i+1}</span><button class="ld-btn-remove" onclick="ldFiturCards.splice(${i},1);ldRenderFiturCards()">Hapus</button></div>
            <div class="ld-field-group ld-cols-2">
                <div class="ld-field"><label>Ikon (emoji)</label><input type="text" value="${f.icon}" oninput="ldFiturCards[${i}].icon=this.value"></div>
                <div class="ld-field"><label>Judul</label><input type="text" value="${f.title}" oninput="ldFiturCards[${i}].title=this.value"></div>
                <div class="ld-field" style="grid-column:1/-1"><label>Deskripsi</label><textarea oninput="ldFiturCards[${i}].desc=this.value">${f.desc}</textarea></div>
            </div>
        </div>`).join('');
    ldQueueAutoSave();
}
function addFiturCard() { ldFiturCards.push({icon:'⭐',title:'Fitur Baru',desc:'Deskripsi fitur baru di sini.'}); ldRenderFiturCards(); }

// ── Paket ──
// Cache paket keuangan dari server (diisi oleh ldLoadKeuanganPakets)
let _keuanganPaketsForLanding = [];
async function ldLoadKeuanganPakets() {
    try {
        _keuanganPaketsForLanding = await PaketAPI.getAll().catch(() => []);
    } catch(e) { _keuanganPaketsForLanding = []; }
    ldRenderPaket();
}
function ldRenderPaket() {
    const c = document.getElementById('paket-list'); if (!c) return;
    // Ambil daftar paket keuangan dari server (cache)
    const keuanganPakets = _keuanganPaketsForLanding;
    c.innerHTML = ldPaketData.map((p, i) => {
        const linkVal = p.link_keuangan !== undefined ? p.link_keuangan : '';
        // Cari nama paket keuangan yang terhubung
        const linkedKeu = keuanganPakets.find(kp => (kp.kode||kp.id) === linkVal);
        const linkStatus = linkVal
            ? (linkedKeu
                ? `<div style="margin-top:6px;font-size:10px;color:#16a34a;background:rgba(22,163,74,0.08);border:1px solid rgba(22,163,74,0.2);border-radius:6px;padding:4px 8px">✅ Terhubung ke: <strong>${linkedKeu.nama}</strong> (Rp ${parseInt(linkedKeu.harga||0).toLocaleString('id-ID')})</div>`
                : `<div style="margin-top:6px;font-size:10px;color:#d97706;background:rgba(217,119,6,0.08);border:1px solid rgba(217,119,6,0.2);border-radius:6px;padding:4px 8px">⚠️ Paket keuangan tidak ditemukan</div>`)
            : '';
    return `
        <div class="ld-card">
            <div class="ld-card-hd">
                <div class="ld-sc-icon">${p.featured?'⭐':'📦'}</div>
                <div style="flex:1"><h3>Paket ${i+1}: ${p.name}${p.featured?' <span style="background:var(--blue,#133259);color:#fff;font-size:.6rem;padding:.1rem .4rem;border-radius:4px">Terpopuler</span>':''}</h3><p>Edit detail paket ini</p></div>
                ${ldPaketData.length>1?`<button class="ld-btn-remove" onclick="ldPaketData.splice(${i},1);ldRenderPaket()">🗑 Hapus</button>`:''}
            </div>
            <div class="ld-field-group">
                <!-- Link ke Paket Keuangan -->
                <div class="ld-field" style="background:rgba(26,90,160,0.05);border:1.5px solid rgba(26,90,160,0.15);border-radius:10px;padding:10px 12px">
                    <label style="display:flex;align-items:center;gap:5px">🔗 Hubungkan dengan Paket Keuangan <span style="font-size:.68rem;color:var(--text-sub);font-weight:400">(opsional)</span></label>
                    <select onchange="ldPaketData[${i}].link_keuangan=this.value;ldRenderPaket()" style="margin-top:4px">
                        <option value="" ${!linkVal?'selected':''}>-- Tidak dihubungkan --</option>
                        ${keuanganPakets.map(kp=>`<option value="${kp.kode||kp.id}" ${linkVal===(kp.kode||kp.id)?'selected':''}>${kp.nama}${kp.harga?' · Rp '+parseInt(kp.harga||0).toLocaleString('id-ID'):''}</option>`).join('')}
                        ${!keuanganPakets.length?'<option disabled>(Buat paket di menu Keuangan dulu)</option>':''}
                    </select>
                    ${linkStatus}
                    <div class="ld-hint">Pilih paket dari menu Keuangan. Harga & checkout akan terhubung otomatis.</div>
                </div>
            </div>
            <div class="ld-field-group ld-cols-2" style="margin-top:.8rem">
                <div class="ld-field"><label>Nama Paket</label><input type="text" value="${p.name}" oninput="ldPaketData[${i}].name=this.value"></div>
                <div class="ld-field"><label>Harga</label><input type="text" value="${p.price}" oninput="ldPaketData[${i}].price=this.value"></div>
                <div class="ld-field"><label>Satuan (misal: /bulan)</label><input type="text" value="${p.unit}" oninput="ldPaketData[${i}].unit=this.value"></div>
                <div class="ld-field"><label>Teks Tombol</label><input type="text" value="${p.btnText}" oninput="ldPaketData[${i}].btnText=this.value"></div>
                <div class="ld-field" style="grid-column:1/-1"><label>Deskripsi Singkat</label><input type="text" value="${p.desc}" oninput="ldPaketData[${i}].desc=this.value"></div>
                <div class="ld-field" style="grid-column:1/-1"><label>Fitur-fitur (satu per baris)</label><textarea oninput="ldPaketData[${i}].features=this.value.split('\\n').filter(x=>x.trim())">${Array.isArray(p.features)?p.features.join('\n'):p.features}</textarea></div>
                <div class="ld-field" style="grid-column:1/-1"><label>Tandai sebagai paket terpopuler?</label>
                    <select onchange="ldPaketData[${i}].featured=this.value==='ya';ldRenderPaket()">
                        <option value="tidak" ${!p.featured?'selected':''}>Tidak</option>
                        <option value="ya" ${p.featured?'selected':''}>Ya (badge Terpopuler)</option>
                    </select>
                </div>
            </div>
        </div>`}).join('') + `<div style="text-align:center;padding:.8rem 0"><button class="ld-btn-add" onclick="ldAddPaket()" style="max-width:260px">+ Tambah Paket Baru</button></div>`;
    ldQueueAutoSave();
}
function ldAddPaket() {
    ldPaketData.push({name:'Paket Baru',price:'Rp0',unit:'/bulan',desc:'Deskripsi paket baru',featured:false,features:['Fitur 1','Fitur 2','Fitur 3'],btnText:'Pilih Paket'});
    ldRenderPaket();
}

// ── Materi ──
function ldRenderMateri() {
    const c = document.getElementById('materi-list'); if (!c) return;
    c.innerHTML = ldMateriData.map((m, i) => `
        <div class="ld-repeat-item">
            <div class="ld-repeat-hd"><span class="ld-repeat-title">📖 Materi ${String(i+1).padStart(2,'0')}</span><button class="ld-btn-remove" onclick="ldMateriData.splice(${i},1);ldRenderMateri()">Hapus</button></div>
            <div class="ld-field-group ld-cols-2">
                <div class="ld-field"><label>Judul</label><input type="text" value="${m.title}" oninput="ldMateriData[${i}].title=this.value"></div>
                <div class="ld-field"><label>Tag Modul</label><input type="text" value="${m.tag}" oninput="ldMateriData[${i}].tag=this.value"></div>
                <div class="ld-field" style="grid-column:1/-1"><label>Deskripsi</label><input type="text" value="${m.desc}" oninput="ldMateriData[${i}].desc=this.value"></div>
            </div>
        </div>`).join('');
    ldQueueAutoSave();
}
function addMateri() { ldMateriData.push({title:'Materi Baru',desc:'Deskripsi materi baru',tag:'0 Modul'}); ldRenderMateri(); }

// ── Testimoni ──
function ldRenderTesti() {
    const c = document.getElementById('testi-list'); if (!c) return;
    c.innerHTML = ldTestiData.map((t, i) => `
        <div class="ld-repeat-item">
            <div class="ld-repeat-hd"><span class="ld-repeat-title">⭐ Testimoni ${i+1}</span><button class="ld-btn-remove" onclick="ldTestiData.splice(${i},1);ldRenderTesti()">Hapus</button></div>
            <div class="ld-field-group ld-cols-2">
                <div class="ld-field"><label>Nama</label><input type="text" value="${t.name}" oninput="ldTestiData[${i}].name=this.value"></div>
                <div class="ld-field"><label>Jabatan / Role</label><input type="text" value="${t.role}" oninput="ldTestiData[${i}].role=this.value"></div>
                <div class="ld-field"><label>Inisial Avatar (2 huruf)</label><input type="text" maxlength="2" value="${t.initials}" oninput="ldTestiData[${i}].initials=this.value.toUpperCase()"></div>
                <div class="ld-field"><label>Bintang (1-5)</label><input type="number" min="1" max="5" value="${t.stars}" oninput="ldTestiData[${i}].stars=parseInt(this.value)"></div>
                <div class="ld-field" style="grid-column:1/-1"><label>Teks Kutipan</label><textarea oninput="ldTestiData[${i}].text=this.value">${t.text}</textarea></div>
            </div>
        </div>`).join('');
    ldQueueAutoSave();
}
function addTesti() { ldTestiData.push({stars:5,text:'Testimoni baru di sini.',initials:'XX',name:'Nama Peserta',role:'Jabatan · Perusahaan'}); ldRenderTesti(); }

// ── FAQ ──
function ldRenderFaq() {
    const c = document.getElementById('faq-list'); if (!c) return;
    c.innerHTML = ldFaqData.map((f, i) => `
        <div class="ld-repeat-item">
            <div class="ld-repeat-hd"><span class="ld-repeat-title">❓ FAQ ${i+1}</span><button class="ld-btn-remove" onclick="ldFaqData.splice(${i},1);ldRenderFaq()">Hapus</button></div>
            <div class="ld-field-group">
                <div class="ld-field"><label>Pertanyaan</label><input type="text" value="${f.q.replace(/'/g,"&#39;")}" oninput="ldFaqData[${i}].q=this.value"></div>
                <div class="ld-field"><label>Jawaban</label><textarea oninput="ldFaqData[${i}].a=this.value">${f.a}</textarea></div>
            </div>
        </div>`).join('');
    ldQueueAutoSave();
}
function addFaq() { ldFaqData.push({q:'Pertanyaan baru?',a:'Jawaban di sini.'}); ldRenderFaq(); }

// ── Soal ──
function ldRenderSoal() {
    const c = document.getElementById('soal-list'); if (!c) return;
    const letters = ['A','B','C','D','E'];
    c.innerHTML = ldSoalData.map((s, i) => `
        <div class="ld-repeat-item">
            <div class="ld-repeat-hd"><span class="ld-repeat-title">📝 Soal ${i+1}</span><button class="ld-btn-remove" onclick="ldSoalData.splice(${i},1);ldRenderSoal()">Hapus</button></div>
            <div class="ld-field"><label>Pertanyaan</label><textarea oninput="ldSoalData[${i}].q=this.value">${s.q}</textarea></div>
            <div style="margin-top:.8rem">
                <label style="font-size:.7rem;font-weight:700;color:var(--blue,#133259);letter-spacing:.06em;text-transform:uppercase;display:block;margin-bottom:.5rem">Pilihan Jawaban (klik untuk tandai jawaban benar)</label>
                ${s.opts.map((opt, j) => `
                    <div class="ld-radio-option ${s.ans===j?'correct-ans':''}" onclick="ldSoalData[${i}].ans=${j};ldRenderSoal()">
                        <input type="radio" name="ldsoal_${i}" ${s.ans===j?'checked':''}>
                        <strong>${letters[j]||j+1}</strong>
                        <input type="text" value="${opt}" oninput="ldSoalData[${i}].opts[${j}]=this.value" style="border:none;outline:none;flex:1;font-size:.84rem;background:transparent;cursor:text" onclick="event.stopPropagation()">
                    </div>`).join('')}
                <button class="ld-btn-add" style="margin-top:.5rem;font-size:.76rem;padding:.4rem .8rem;width:auto" onclick="ldSoalData[${i}].opts.push('Pilihan baru');ldRenderSoal()">+ Tambah Pilihan</button>
            </div>
        </div>`).join('');
    ldQueueAutoSave();
}
function addSoal() { ldSoalData.push({q:'Soal baru di sini?',opts:['Pilihan A','Pilihan B','Pilihan C','Pilihan D'],ans:0}); ldRenderSoal(); }

// ── Footer Links ──
function ldRenderFooterLinks() {
    const fp = document.getElementById('footer-platform-list');
    if (fp) fp.innerHTML = ldFooterPlatform.map((l,i)=>`
        <div class="ld-repeat-item" style="padding:.7rem .9rem;margin-bottom:.45rem">
            <div class="ld-link-row">
                <div class="ld-field"><label>Teks Link</label><input type="text" value="${l.text}" oninput="ldFooterPlatform[${i}].text=this.value"></div>
                <div class="ld-field"><label>URL / Href</label><input type="text" value="${l.href}" oninput="ldFooterPlatform[${i}].href=this.value" placeholder="https:// atau #anchor"></div>
            </div>
            <button class="ld-btn-remove" style="margin-top:.4rem" onclick="ldFooterPlatform.splice(${i},1);ldRenderFooterLinks()">Hapus</button>
        </div>`).join('');
    const fe = document.getElementById('footer-perusahaan-list');
    if (fe) fe.innerHTML = ldFooterPerusahaan.map((l,i)=>`
        <div class="ld-repeat-item" style="padding:.7rem .9rem;margin-bottom:.45rem">
            <div class="ld-link-row">
                <div class="ld-field"><label>Teks Link</label><input type="text" value="${l.text}" oninput="ldFooterPerusahaan[${i}].text=this.value"></div>
                <div class="ld-field"><label>URL / Href</label><input type="text" value="${l.href}" oninput="ldFooterPerusahaan[${i}].href=this.value" placeholder="https:// atau #anchor"></div>
            </div>
            <button class="ld-btn-remove" style="margin-top:.4rem" onclick="ldFooterPerusahaan.splice(${i},1);ldRenderFooterLinks()">Hapus</button>
        </div>`).join('');
    const fs = document.getElementById('footer-social-list');
    if (fs) fs.innerHTML = ldSocialData.map((s,i)=>`
        <div class="ld-repeat-item" style="padding:.7rem .9rem;margin-bottom:.45rem">
            <div class="ld-field-group ld-cols-2">
                <div class="ld-field"><label>Label</label><input type="text" value="${s.label}" oninput="ldSocialData[${i}].label=this.value"></div>
                <div class="ld-field"><label>Singkatan (teks tombol)</label><input type="text" maxlength="3" value="${s.short}" oninput="ldSocialData[${i}].short=this.value"></div>
                <div class="ld-field" style="grid-column:1/-1"><label>URL / Link</label><input type="text" value="${s.href}" oninput="ldSocialData[${i}].href=this.value" placeholder="https://instagram.com/..."></div>
            </div>
        </div>`).join('');
    ldQueueAutoSave();
}
function addFooterLink(col) {
    if(col==='platform') ldFooterPlatform.push({text:'Link Baru',href:'#'});
    else ldFooterPerusahaan.push({text:'Link Baru',href:'#'});
    ldRenderFooterLinks();
}

// ── Chatbot ──
function ldRenderChatQuick() {
    const c = document.getElementById('chat-quick-list'); if (!c) return;
    c.innerHTML = ldChatQuickData.map((q,i)=>`
        <div class="ld-repeat-item" style="padding:.7rem .9rem;margin-bottom:.45rem">
            <div class="ld-repeat-hd"><span class="ld-repeat-title">${q.icon} Tombol ${i+1}</span>${ldChatQuickData.length>1?`<button class="ld-btn-remove" onclick="ldChatQuickData.splice(${i},1);ldRenderChatQuick()">Hapus</button>`:''}</div>
            <div class="ld-field-group ld-cols-2">
                <div class="ld-field"><label>Ikon</label><input type="text" value="${q.icon}" oninput="ldChatQuickData[${i}].icon=this.value;ldRenderChatQuick()"></div>
                <div class="ld-field"><label>Teks Tombol</label><input type="text" value="${q.text}" oninput="ldChatQuickData[${i}].text=this.value"></div>
                <div class="ld-field" style="grid-column:1/-1"><label>Jawaban Bot untuk Tombol Ini</label><textarea style="min-height:58px" oninput="ldChatQuickData[${i}].reply=this.value">${q.reply||''}</textarea></div>
            </div>
        </div>`).join('') + `<button class="ld-btn-add" onclick="ldChatQuickData.push({icon:'💬',text:'Pertanyaan Baru',reply:'Tulis jawaban bot di sini.'});ldRenderChatQuick()">+ Tambah Tombol Quick Reply</button>`;
    ldQueueAutoSave();
}

function ldRenderKeywords() {
    const c = document.getElementById('chat-keyword-list'); if (!c) return;
    c.innerHTML = ldKeywordData.map((k,i)=>`
        <div class="ld-repeat-item" style="padding:.7rem .9rem;margin-bottom:.45rem">
            <div class="ld-repeat-hd"><span class="ld-repeat-title">🔑 Kata Kunci ${i+1}</span><button class="ld-btn-remove" onclick="ldKeywordData.splice(${i},1);ldRenderKeywords()">Hapus</button></div>
            <div class="ld-field-group ld-cols-2">
                <div class="ld-field"><label>Kata Kunci</label><input type="text" value="${k.keyword}" oninput="ldKeywordData[${i}].keyword=this.value" placeholder="contoh: harga, daftar, promo"></div>
                <div class="ld-field" style="grid-column:1/-1"><label>Jawaban Bot</label><textarea style="min-height:58px" oninput="ldKeywordData[${i}].reply=this.value">${k.reply||''}</textarea></div>
            </div>
        </div>`).join('') + `<button class="ld-btn-add" onclick="ldKeywordData.push({keyword:'kata-kunci',reply:'Tulis jawaban bot di sini.'});ldRenderKeywords()">+ Tambah Kata Kunci</button>`;
    ldQueueAutoSave();
}

function handleAvatarUpload(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        ldAvatarData = e.target.result;
        const preview = document.getElementById('avatar-preview');
        if (preview) preview.innerHTML = `<img src="${ldAvatarData}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
        ldQueueAutoSave();
    };
    reader.readAsDataURL(file);
}
function resetAvatar() {
    ldAvatarData = null;
    const preview = document.getElementById('avatar-preview');
    if (preview) preview.innerHTML = '🤖';
    const up = document.getElementById('chat_avatar_upload');
    if (up) up.value = '';
    ldQueueAutoSave();
}

// ── Export HTML (sama persis dengan logic dari editor asli) ──
function ldG(id) { return document.getElementById(id)?.value || ''; }
function ldEsc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function ldExportHTML(auto=false) {
    // Kumpulkan semua data dari form editor
    const promoCards = Array.from(document.querySelectorAll('#promo-cards-list .ld-repeat-item')).map(item=>({
        icon: item.querySelector('.pc-icon')?.value||'',
        title: item.querySelector('.pc-title')?.value||'',
        desc: item.querySelector('.pc-desc')?.value||''
    }));
    const landingPayload = {
        nav: { brand:ldG('nav_brand'), subbrand:ldG('nav_subbrand'), cta:ldG('nav_cta'), menus:[
            {text:ldG('nav_m1_text'),href:ldG('nav_m1_href')},{text:ldG('nav_m2_text'),href:ldG('nav_m2_href')},
            {text:ldG('nav_m3_text'),href:ldG('nav_m3_href')},{text:ldG('nav_m4_text'),href:ldG('nav_m4_href')},{text:ldG('nav_m5_text'),href:ldG('nav_m5_href')}
        ]},
        pageTitle: ldG('page_title'),
        hero: { badge:ldG('hero_badge'), h1:[ldG('hero_h1_1'),ldG('hero_h1_2'),ldG('hero_h1_3')], sub:ldG('hero_sub'), btn1:ldG('hero_btn1'), btn2:ldG('hero_btn2'), btn2href:ldG('hero_btn2_href'), stats:[{num:ldG('stat1_num'),label:ldG('stat1_label')},{num:ldG('stat2_num'),label:ldG('stat2_label')},{num:ldG('stat3_num'),label:ldG('stat3_label')}] },
        coba: { tag:ldG('coba_tag'), title:ldG('coba_title'), sub:ldG('coba_sub'), cardTitle:ldG('coba_card_title'), cardDesc:ldG('coba_card_desc'), btn:ldG('coba_btn') },
        promo: { tag:ldG('promo_tag'), h2_1:ldG('promo_h2_1'), h2_2:ldG('promo_h2_2'), desc:ldG('promo_desc'), cards:promoCards },
        mitra: { tag:ldG('mitra_tag'), title:ldG('mitra_title'), sub:ldG('mitra_sub'), list:ldG('mitra_list').split('\n').filter(x=>x.trim()) },
        fitur: { tag:ldG('fitur_tag'), title:ldG('fitur_title'), sub:ldG('fitur_sub'), cards:ldFiturCards },
        paket: { tag:ldG('paket_tag'), title:ldG('paket_title'), sub:ldG('paket_sub'), list:ldPaketData },
        materi: { tag:ldG('materi_tag'), title:ldG('materi_title'), sub:ldG('materi_sub'), list:ldMateriData },
        testi: { tag:ldG('testi_tag'), title:ldG('testi_title'), list:ldTestiData },
        faq: { tag:ldG('faq_tag'), title:ldG('faq_title'), list:ldFaqData },
        soal: ldSoalData,
        footer: { 
            brandDesc: ldG('footer_brand_desc'), 
            copy: ldG('footer_copy'), 
            reg: ldG('footer_reg'), 
            phone: ldG('footer_phone'), 
            email: ldG('footer_email'), 
            address: ldG('footer_address'), 
            platform: ldFooterPlatform, 
            perusahaan: ldFooterPerusahaan, 
            social: ldSocialData,
            canvasText: ldG('canvas_text') // <-- TAMBAHKAN INI
        },
        chat: { name:ldG('chat_name'), status:ldG('chat_status'), greeting:ldG('chat_greeting'), placeholder:ldG('chat_placeholder'), quickReplies:Object.fromEntries(ldChatQuickData.map(c=>[(c.icon+' '+c.text).toLowerCase().trim(),c.reply||''])), keywords:ldKeywordData.map(k=>({keyword:k.keyword.toLowerCase().trim(),reply:k.reply||''})), defaultReply:ldG('chat_default_reply'), avatar:ldAvatarData },
        sk: { title:ldG('sk_title'), content:document.getElementById('sk_content')?.value||'' },
        kp: { title:ldG('kp_title'), content:document.getElementById('kp_content')?.value||'' },
    };

    // Simpan ke SERVER via API (bukan localStorage)
    const token = localStorage.getItem('cbn_token');
    fetch(window.location.origin + '/api/landing', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(landingPayload)
    })
    .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    })
    .then(() => {
        showToast(auto ? '💾 Tersimpan otomatis' : '✅ Data landing page tersimpan ke database! Landing page akan otomatis menampilkan konten terbaru.', 'success', auto ? 1400 : 2600);
    })
    .catch(err => {
        showToast('❌ Gagal menyimpan otomatis: ' + err.message, 'danger');
    });
}

function ldUpdateTaksabar() {
    const skTitle = document.getElementById('sk_title')?.value || '';
    const skContent = document.getElementById('sk_content')?.value || '';
    const kpTitle = document.getElementById('kp_title')?.value || '';
    const kpContent = document.getElementById('kp_content')?.value || '';
    const token = localStorage.getItem('cbn_token');
    fetch(window.location.origin + '/api/landing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ sk: { title: skTitle, content: skContent }, kp: { title: kpTitle, content: kpContent } })
    })
    .then(r => r.ok ? r.json() : Promise.reject('HTTP ' + r.status))
    .then(() => showToast('Syarat & Privasi diperbarui ke server!', 'success'))
    .catch(e => showToast('Gagal menyimpan: ' + e, 'danger'));
}


// ── KEUANGAN ──
let _paketData = [], _keuanganSub = 'paket';
// Cache paket landing (dari /api/landing) untuk dropdown link
let _ldPaketCache = [];

function renderKeuangan() {
    renderKeuanganSub(_keuanganSub || 'paket');
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

// Override fungsi lama dari index_admin.html agar pakai versi baru
function populateLinkLandingDropdown(currentVal) {
    _populateLinkLandingDropdown(currentVal);
}

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