// admin/home.js
// Modul HOME — dimuat eager (bundled di shell) karena ini halaman default saat admin login.
// Bergantung pada helper global dari js/app.js (showToast, openModal, navigateTo, dst)
// yang sudah dimuat lebih dulu lewat shell index_admin.html.

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
    if(recEl) recEl.innerHTML=recent.length?recent.map(l=>{const modulTampil=l.modul_nama_internal?`${l.modul_nama} <span style="font-weight:400;color:var(--text-sub)">| ${l.modul_nama_internal}</span>`:(l.modul_nama||l.modul_kode||'-');return `<div class="recent-item" onclick="navigateTo('laporan')"><div class="recent-left"><div class="recent-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg></div><div><div style="font-weight:600;font-size:13px;color:var(--blue)">${modulTampil}</div><div style="font-size:11px;color:var(--text-sub)">${l.user_nama||l.user_kode||'-'} · ${formatDate(l.tgl_selesai)}</div></div></div><div class="skor-badge">${Math.round(l.skor||0)}</div></div>`;}).join(''):'<div class="empty-state" style="padding:24px"><p>Belum ada aktivitas</p></div>';
    // Signup notif
    const signups=await UsersAPI.getSignupRequests().catch(()=>[]);
    const nb=document.getElementById('home-signup-notif');
    if(nb&&signups&&signups.length>0){nb.style.display='block';nb.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px"><div style="display:flex;align-items:center;gap:10px"><div style="width:36px;height:36px;border-radius:10px;background:rgba(217,119,6,0.12);display:flex;align-items:center;justify-content:center;color:var(--warning)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><div><div style="font-weight:700;font-size:13px;color:var(--blue)">${signups.length} Permintaan Pendaftaran</div><div style="font-size:11px;color:var(--text-sub)">Menunggu aktivasi admin</div></div></div><button class="btn btn-primary btn-sm" onclick="navigateTo('akun');setTimeout(()=>renderAkunSub('signup'),300)">Lihat & Aktivasi</button></div>`;}
}

// ── LAPORAN ──
let _lapData = [], _lapSearch = '', _lapPage = 1, _lapGrubFilter = '';

