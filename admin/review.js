// admin/review.js
// Modul REVIEW (daftar akun review + laporan per-user) — lazy-load saat tab Review dibuka. Butuh admin/shared-export.js (adminDoDownloadExcel/Word) yang dimuat bersamaan.
// Bergantung pada helper global dari js/app.js (showToast, openModal, navigateTo, dst)
// yang sudah dimuat lebih dulu lewat shell index_admin.html.

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
