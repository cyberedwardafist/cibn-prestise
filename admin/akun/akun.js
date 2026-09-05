/* akun.js v2 - Admin/Review/User account management */
function renderAkun(){const sub=AppState.currentSubPage['akun']||'admin';renderAkunSub(sub);}
function renderAkunSub(sub){
    AppState.currentSubPage['akun']=sub;
    if (typeof _persistAdminNav === 'function') _persistAdminNav();
    document.querySelectorAll('#page-akun .sub-tab').forEach(t=>t.classList.toggle('active',t.dataset.sub===sub));
    document.querySelectorAll('#page-akun .sub-page').forEach(p=>p.classList.toggle('active',p.id===`sub-akun-${sub}`));
    if(sub==='admin')renderAdminList();else if(sub==='review')renderReviewList();else if(sub==='user')renderUserList();else if(sub==='signup')renderSignupRequests();else if(sub==='paket-req')renderPaketRequests();
}

// ── ADMIN LIST ──
let _adminSearch='';
let _adminListCache=[];
function _adminRowHtml(a,i){const kode=a.kode||a.id;const chk=_akunSelected.admin.has(kode)?'checked':'';
    return `<tr><td class="akun-check"><input type="checkbox" class="akun-row-check" data-kode="${kode}" ${chk} onchange="toggleAkunSelect('admin','${kode}',this.checked)"></td><td>${i+1}</td><td><strong>${a.nama}</strong></td><td>${a.email}</td><td class="hide-mobile"><span class="badge badge-${a.status}">${a.status}</span></td><td><div style="display:flex;gap:6px"><button class="btn-icon" onclick="openEditUser('admin','${kode}','${a.nama}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn-icon danger" onclick="deleteUserAkun('${kode}','${a.nama}','admin')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button></div></td></tr>`;
}
function _adminCardHtml(a){const kode=a.kode||a.id;const sel=_akunSelected.admin.has(kode);
    return SwipeCards.buildSwipeCardHtml({
        title:a.nama,sub:a.email,kode,selected:sel,
        sideHtml:`<span class="badge badge-${a.status}" style="font-size:10px">${a.status}</span>`,
        leftActions:[{icon:'edit',label:'Edit',cls:'act-edit',onClick:`openEditUser('admin','${kode}','${a.nama}')`}],
        rightActions:[{icon:'trash',label:'Hapus',cls:'act-danger',onClick:`deleteUserAkun('${kode}','${a.nama}','admin')`}]
    });
}
async function renderAdminList(){
    const data=await UsersAPI.getByRole('admin').catch(()=>[]);
    const list=filterList(data,_adminSearch,['nama','email']);
    _adminListCache=list;
    const tb=document.getElementById('admin-tbody');if(!tb)return;
    tb.innerHTML=list.length?list.map(_adminRowHtml).join(''):`<tr><td colspan="6"><div class="empty-state"><p>Belum ada akun admin</p></div></td></tr>`;
    const swEl=document.getElementById('admin-swipe-list');
    if(swEl&&window.SwipeCards){
        swEl.innerHTML=list.length?list.map(_adminCardHtml).join(''):'<div class="swipe-card-empty">Belum ada akun admin</div>';
        SwipeCards.bindSwipeList(swEl,_akunSelectOpts('admin'));
    }
    _updateBulkBar('admin');
}

// ── REVIEW LIST ──
let _reviewSearch='';
let _reviewListCache=[];
function _reviewRowHtml(a,i){const kode=a.kode||a.id;const chk=_akunSelected.review.has(kode)?'checked':'';
    return `<tr><td class="akun-check"><input type="checkbox" class="akun-row-check" data-kode="${kode}" ${chk} onchange="toggleAkunSelect('review','${kode}',this.checked)"></td><td>${i+1}</td><td><strong>${a.nama}</strong></td><td>${a.email}</td><td class="hide-mobile"><span class="badge badge-${a.status}">${a.status}</span></td><td><div style="display:flex;gap:6px"><button class="btn-icon" onclick="openEditUser('review','${kode}','${a.nama}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn-icon danger" onclick="deleteUserAkun('${kode}','${a.nama}','review')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button></div></td></tr>`;
}
function _reviewCardHtml(a){const kode=a.kode||a.id;const sel=_akunSelected.review.has(kode);
    return SwipeCards.buildSwipeCardHtml({
        title:a.nama,sub:a.email,kode,selected:sel,
        sideHtml:`<span class="badge badge-${a.status}" style="font-size:10px">${a.status}</span>`,
        leftActions:[{icon:'edit',label:'Edit',cls:'act-edit',onClick:`openEditUser('review','${kode}','${a.nama}')`}],
        rightActions:[{icon:'trash',label:'Hapus',cls:'act-danger',onClick:`deleteUserAkun('${kode}','${a.nama}','review')`}]
    });
}
async function renderReviewList(){
    const data=await UsersAPI.getByRole('review').catch(()=>[]);
    const list=filterList(data,_reviewSearch,['nama','email']);
    _reviewListCache=list;
    const tb=document.getElementById('review-tbody');if(!tb)return;
    tb.innerHTML=list.length?list.map(_reviewRowHtml).join(''):`<tr><td colspan="6"><div class="empty-state"><p>Belum ada akun reviewer</p></div></td></tr>`;
    const swEl=document.getElementById('review-swipe-list');
    if(swEl&&window.SwipeCards){
        swEl.innerHTML=list.length?list.map(_reviewCardHtml).join(''):'<div class="swipe-card-empty">Belum ada akun reviewer</div>';
        SwipeCards.bindSwipeList(swEl,_akunSelectOpts('review'));
    }
    _updateBulkBar('review');
}

// ── BULK SELECT & EDIT MASSAL (Admin/Reviewer/User) ──
// Field yang boleh diedit lewat mode massal cuma: Grup, Aktivasi/Status Akun, & Paket Langganan
// (nama/email/password sengaja tidak, karena wajib unik per akun & rawan salah kalau disamain).
const _akunSelected={admin:new Set(),review:new Set(),user:new Set()};
function toggleAkunSelect(role,kode,checked){
    const set=_akunSelected[role];if(!set)return;
    if(checked)set.add(kode);else set.delete(kode);
    _updateBulkBar(role);
}
function toggleSelectAllAkun(role,checked){
    // Pakai cache list HASIL FILTER per role (_adminListCache/_reviewListCache/_userListCache) —
    // seluruh data, bukan cuma baris yang kebetulan lagi dirender virtual-scroll ke DOM — supaya
    // "Pilih Semua" beneran pilih semua data (mis. grup A 25 + grup B 50 = 75 tercentang), bukan
    // cuma yang lagi kelihatan di layar.
    const list=role==='admin'?_adminListCache:role==='review'?_reviewListCache:_userListCache;
    const set=_akunSelected[role];
    if(set){
        list.forEach(a=>{
            const kode=a.kode||a.id;
            if(checked)set.add(kode);else set.delete(kode);
        });
    }
    // DOM di sini cuma perlu disinkronkan buat baris yang KEBETULAN lagi ada di layar; baris lain
    // otomatis kebawa checked/selected pas ke-scroll & dirender ulang (baca dari _akunSelected).
    document.querySelectorAll(`#${role}-tbody .akun-row-check`).forEach(cb=>{cb.checked=checked;});
    document.querySelectorAll(`#${role}-swipe-list .swipe-card`).forEach(card=>{
        card.querySelector('.swipe-card-body')?.classList.toggle('selected',checked);
    });
    _updateBulkBar(role);
}
function clearAkunSelection(role){
    const set=_akunSelected[role];if(set)set.clear();
    document.querySelectorAll(`#${role}-tbody .akun-row-check`).forEach(cb=>cb.checked=false);
    document.querySelectorAll(`#${role}-swipe-list .swipe-card-body`).forEach(b=>b.classList.remove('selected'));
    _updateBulkBar(role);
}
// Mode pilih massal ala galeri foto di kartu mobile: tahan lama 1 kartu -> masuk mode pilih
// (kartu dikasih border biru), abis itu tinggal TAP kartu lain buat ikut milih/batal milih.
function _akunSelectOpts(role){
    return {
        selectable:true,
        isSelectMode:()=>_akunSelected[role].size>0,
        onLongPress:(kode,card)=>{
            toggleAkunSelect(role,kode,true);
            card.querySelector('.swipe-card-body')?.classList.add('selected');
        },
        onTapSelect:(kode,card)=>{
            const willSelect=!_akunSelected[role].has(kode);
            toggleAkunSelect(role,kode,willSelect);
            card.querySelector('.swipe-card-body')?.classList.toggle('selected',willSelect);
        }
    };
}
function _updateBulkBar(role){
    const set=_akunSelected[role];const n=set?set.size:0;
    const bar=document.getElementById(`bulk-bar-${role}`);if(bar)bar.style.display=n?'flex':'none';
    const cnt=document.getElementById(`bulk-count-${role}`);if(cnt)cnt.textContent=n;
    const selAll=document.getElementById(`${role}-select-all`);
    if(selAll){
        // Dicek terhadap SELURUH data hasil filter (list cache per role), bukan cuma baris yang
        // lagi ada di DOM — biar centang "Pilih Semua" akurat walau belum semua data pernah discroll.
        const list=role==='admin'?_adminListCache:role==='review'?_reviewListCache:_userListCache;
        selAll.checked=list.length>0&&set&&list.every(a=>set.has(a.kode||a.id));
    }
}
let _bueRole='';
async function openBulkEditAkun(role){
    const set=_akunSelected[role];
    if(!set||!set.size){showToast('Pilih minimal 1 akun dulu','danger');return;}
    if(!await _ensureAkunModals())return;
    _bueRole=role;
    document.getElementById('bue-role').value=role;
    document.getElementById('bue-title').textContent=`Edit Massal — ${role==='admin'?'Admin':role==='review'?'Reviewer':'User'}`;
    document.getElementById('bue-count').textContent=set.size;
    const isUser=role==='user';
    document.getElementById('bue-grub-wrap').style.display=isUser?'block':'none';
    document.getElementById('bue-paket-wrap').style.display=isUser?'block':'none';
    document.getElementById('bue-grub-on').checked=false;document.getElementById('bue-grub').disabled=true;
    document.getElementById('bue-status-on').checked=false;document.getElementById('bue-status').disabled=true;document.getElementById('bue-status').value='aktif';
    document.getElementById('bue-paket-on').checked=false;
    const pf=document.getElementById('bue-paket-fields');pf.style.opacity='.45';pf.style.pointerEvents='none';
    document.getElementById('bue-paket-nama').value='';document.getElementById('bue-durasi').value='';
    document.getElementById('bue-langganan-mulai').value='';document.getElementById('bue-langganan-akhir').value='';
    document.getElementById('bue-langganan-range-wrap').style.display='none';
    document.getElementById('bue-durasi-preview').style.display='none';
    if(isUser){
        await _loadUserGrubList();
        document.getElementById('bue-grub').innerHTML=`<option value="">-- Tanpa Grup --</option>${_userGrubList.map(g=>`<option value="${g.kode||g.id}">${g.nama}</option>`).join('')}`;
    }
    openModal('bulk-edit-overlay');
}
function _bueToggle(kind){
    if(kind==='grub'){document.getElementById('bue-grub').disabled=!document.getElementById('bue-grub-on').checked;}
    else if(kind==='status'){document.getElementById('bue-status').disabled=!document.getElementById('bue-status-on').checked;}
    else if(kind==='paket'){
        const on=document.getElementById('bue-paket-on').checked;
        const wrap=document.getElementById('bue-paket-fields');
        wrap.style.opacity=on?'1':'.45';wrap.style.pointerEvents=on?'auto':'none';
    }
}
function _onBueDurasiChange(){
    const durasi=document.getElementById('bue-durasi').value;
    const rangeWrap=document.getElementById('bue-langganan-range-wrap');
    const preview=document.getElementById('bue-durasi-preview');
    if(durasi==='range'){rangeWrap.style.display='flex';preview.style.display='none';}
    else if(durasi&&_DURASI_HARI[durasi]){
        rangeWrap.style.display='none';
        const hasil=_hitungDurasiLangganan(durasi);
        document.getElementById('bue-langganan-mulai').value=hasil.mulai;
        document.getElementById('bue-langganan-akhir').value=hasil.akhir;
        preview.style.display='block';preview.textContent=`Aktif ${formatDate(hasil.mulai)} s/d ${formatDate(hasil.akhir)} — berlaku sama untuk semua akun terpilih`;
    }else{
        rangeWrap.style.display='none';preview.style.display='none';
        document.getElementById('bue-langganan-mulai').value='';document.getElementById('bue-langganan-akhir').value='';
    }
}
async function submitBulkEditAkun(){
    const role=_bueRole;const kodes=Array.from(_akunSelected[role]||[]);
    if(!kodes.length){showToast('Tidak ada akun terpilih','danger');return;}
    const data={};
    if(document.getElementById('bue-grub-on').checked)data.grub=document.getElementById('bue-grub').value||null;
    if(document.getElementById('bue-status-on').checked)data.status=document.getElementById('bue-status').value;
    if(role==='user'&&document.getElementById('bue-paket-on').checked){
        data.paket_nama=document.getElementById('bue-paket-nama').value.trim()||null;
        const durasiSel=document.getElementById('bue-durasi').value;
        let mulai=document.getElementById('bue-langganan-mulai').value||null;
        let akhir=document.getElementById('bue-langganan-akhir').value||null;
        if(durasiSel&&_DURASI_HARI[durasiSel]){const hasil=_hitungDurasiLangganan(durasiSel);mulai=hasil.mulai;akhir=hasil.akhir;}
        data.langganan_mulai=mulai;data.langganan_akhir=akhir;
    }
    if(!Object.keys(data).length){showToast('Centang minimal 1 field yang mau diubah','danger');return;}
    try{
        const res=await UsersAPI.bulkUpdate(kodes,data);
        showToast(res?.message||`Berhasil memperbarui ${kodes.length} akun`,'success');
        closeModal('bulk-edit-overlay');
        clearAkunSelection(role);
        if(role==='admin')await renderAdminList();else if(role==='review')await renderReviewList();else await renderUserList();
    }catch(e){showToast('Gagal: '+e.message,'danger');}
}

// ── USER LIST ──
let _userSearch='';
// Daftar grup user yg sudah pernah di-fetch (dipakai bareng oleh form akun, filter, & modal Kelola Grup)
let _userGrubList=[];
let _userGrubFilter='all';
async function _loadUserGrubList(){_userGrubList=await GrubsAPI.getAll().catch(()=>[]);return _userGrubList;}
function _userGrubNama(kode){if(!kode)return null;const g=_userGrubList.find(x=>(x.kode||x.id)===kode);return g?g.nama:null;}

function _renderUserGrubFilters(){
    if(!document.getElementById('user-grub-filters'))return;
    const validKodes=_userGrubList.map(g=>g.kode||g.id);
    if(_userGrubFilter!=='all'&&_userGrubFilter!=='none'&&!validKodes.includes(_userGrubFilter))_userGrubFilter='all';
    const options=[{value:'all',label:'Semua Grup'},{value:'none',label:'Tanpa Grup'},..._userGrubList.map(g=>({value:g.kode||g.id,label:g.nama}))];
    renderFilterDropdown('user-grub-filters',{options,current:_userGrubFilter,title:'Grup',onSelect:v=>{_userGrubFilter=v;_renderUserGrubFilters();renderUserList();}});
}

let _userListCache=[];
function _userRowHtml(u,i){
    const kode=u.kode||u.id;const chk=_akunSelected.user.has(kode)?'checked':'';
    const today=new Date(); today.setHours(0,0,0,0);
    const akhir=u.langganan_akhir?new Date(u.langganan_akhir):null;
    const langgananStatus=akhir?(akhir>=today?`<span style="color:#16a34a;font-size:11px">s/d ${formatDate(u.langganan_akhir)}</span>`:`<span style="color:#dc2626;font-size:11px">Exp ${formatDate(u.langganan_akhir)}</span>`):`<span style="color:#94a3b8;font-size:11px">-</span>`;
    const paketBadge=u.paket_nama?`<span class="badge badge-aktif" style="font-size:10px;padding:2px 8px">${u.paket_nama}</span>`:`<span style="color:#94a3b8;font-size:11px">-</span>`;
    return `<tr><td class="akun-check"><input type="checkbox" class="akun-row-check" data-kode="${kode}" ${chk} onchange="toggleAkunSelect('user','${kode}',this.checked)"></td><td>${i+1}</td><td><strong>${u.nama}</strong></td><td>${u.email}</td><td class="hide-mobile">${_userGrubNama(u.grub)||'-'}</td><td class="hide-mobile">${paketBadge}<br>${langgananStatus}</td><td class="hide-mobile"><span class="badge badge-${u.status}">${u.status}</span></td><td><div style="display:flex;gap:6px"><button class="btn-icon" onclick="openEditUser('user','${kode}','${u.nama}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn-icon danger" onclick="deleteUserAkun('${kode}','${u.nama}','user')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button></div></td></tr>`;
}
function _userCardHtml(u){
    const kode=u.kode||u.id;const sel=_akunSelected.user.has(kode);
    const subTxt=u.email+(u.paket_nama?` · ${u.paket_nama}`:'');
    return SwipeCards.buildSwipeCardHtml({
        title:u.nama,sub:subTxt,kode,selected:sel,
        sideHtml:`<span class="badge badge-${u.status}" style="font-size:10px">${u.status}</span>`,
        leftActions:[{icon:'edit',label:'Edit',cls:'act-edit',onClick:`openEditUser('user','${kode}','${u.nama}')`}],
        rightActions:[{icon:'trash',label:'Hapus',cls:'act-danger',onClick:`deleteUserAkun('${kode}','${u.nama}','user')`}]
    });
}
async function renderUserList(){
    const [users]=await Promise.all([UsersAPI.getByRole('user').catch(()=>[]),_loadUserGrubList()]);
    _renderUserGrubFilters();
    let list=filterList(users,_userSearch,['nama','email']);
    if(_userGrubFilter==='none')list=list.filter(u=>!u.grub);
    else if(_userGrubFilter!=='all')list=list.filter(u=>u.grub===_userGrubFilter);
    _userListCache=list;
    const tb=document.getElementById('user-tbody');if(!tb)return;
    tb.innerHTML=list.length?list.map(_userRowHtml).join(''):`<tr><td colspan="8"><div class="empty-state"><p>Belum ada user</p></div></td></tr>`;
    const swEl=document.getElementById('user-swipe-list');
    if(swEl&&window.SwipeCards){
        swEl.innerHTML=list.length?list.map(_userCardHtml).join(''):'<div class="swipe-card-empty">Belum ada user</div>';
        SwipeCards.bindSwipeList(swEl,_akunSelectOpts('user'));
    }
    _updateBulkBar('user');
}

function deleteUserAkun(kode,nama,role){showConfirm('Hapus Akun',`Yakin hapus akun "${nama}"?`,'danger',async()=>{await UsersAPI.delete(kode);showToast('Akun dihapus','danger');if(role==='admin')await renderAdminList();else if(role==='review')await renderReviewList();else await renderUserList();});}

function deleteSelectedAkun(role){
    const kodes=Array.from(_akunSelected[role]||[]);
    if(!kodes.length){showToast('Pilih minimal 1 akun dulu','danger');return;}
    const roleLabel=role==='admin'?'admin':role==='review'?'reviewer':'user';
    showConfirm('Hapus Akun Massal',`Yakin hapus ${kodes.length} akun ${roleLabel} terpilih? Tindakan ini tidak bisa dibatalkan.`,'danger',async()=>{
        const res=await UsersAPI.bulkDelete(kodes);
        showToast(res?.message||`Berhasil menghapus ${kodes.length} akun`,'danger');
        clearAkunSelection(role);
        if(role==='admin')await renderAdminList();else if(role==='review')await renderReviewList();else await renderUserList();
    });
}

// ══════════════ TEMPLATE & UPLOAD AKUN (Import Excel — bulk create akun Admin/Reviewer/User) ══════════════
const _AKUN_ROLE_LABEL={admin:'Admin',review:'Reviewer',user:'User'};

function downloadAkunTemplate(role){
    if(typeof XLSX==='undefined'){showToast('Modul Excel belum siap, muat ulang halaman','danger');return;}
    const wb=XLSX.utils.book_new();
    let header,exampleRow;
    if(role==='user'){
        header=['Nama','Email','Password','Grup','Status','Nama Paket','Durasi Langganan','Langganan Mulai (isi jika Durasi=range)','Langganan Akhir (isi jika Durasi=range)'];
        exampleRow=['Contoh: Budi Santoso','budi@contoh.com','','Kelas A','aktif','Professional','1 bulan','',''];
    }else{
        header=['Nama','Email','Password','Status'];
        exampleRow=[`Contoh: ${_AKUN_ROLE_LABEL[role]||'Akun'} Satu`,'contoh@email.com','','aktif'];
    }
    const rows=[header,exampleRow];
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'Akun');
    const petunjuk=[
        ['PETUNJUK PENGISIAN — IMPORT AKUN '+(_AKUN_ROLE_LABEL[role]||'').toUpperCase()],
        ['1. Kolom Nama dan Email wajib diisi untuk setiap baris.'],
        ['2. Kolom Password boleh dikosongkan; jika kosong akan otomatis dipakaikan password default "Default@123" (bisa diganti user lewat menu Edit nanti).'],
        ['3. Kolom Status diisi "aktif" atau "nonaktif". Kosongkan jika ingin otomatis "aktif".'],
        role==='user'?['4. Kolom Grup diisi nama grup. Jika grup belum ada, akan dibuat otomatis. Kosongkan jika tidak ingin memasukkan user ke grup manapun.']:['4. Baris tanpa Nama atau Email akan dilewati saat proses upload.'],
        role==='user'?['5. Kolom Durasi Langganan diisi salah satu: "1 hari", "1 minggu", "1 bulan", "1 tahun", atau "range". Tanggal mulai dihitung otomatis dari hari file diupload.']:['5. Jangan mengubah nama kolom pada baris pertama (header).'],
        role==='user'?['6. Jika Durasi Langganan diisi "range", isi manual kolom Langganan Mulai & Langganan Akhir dengan format YYYY-MM-DD. Jika diisi preset (1 hari/minggu/bulan/tahun), kedua kolom tanggal itu boleh dikosongkan karena akan dihitung otomatis.']:[],
        role==='user'?['7. Kosongkan Durasi Langganan jika akun tidak ingin diberi langganan/paket saat ini.']:[],
        ['8. Jangan mengubah nama kolom pada baris pertama (header).'],
    ].filter(r=>r.length);
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(petunjuk),'Petunjuk');
    XLSX.writeFile(wb,`Template_Akun_${_AKUN_ROLE_LABEL[role]||role}.xlsx`);
    showToast('Template berhasil diunduh','success');
}

// Export akun yang SEDANG TAMPIL di list (mengikuti pencarian/filter yang aktif) ke Excel,
// pakai format kolom yang sama dengan Template Upload Akun. Kolom Password sengaja dikosongkan
// (password lama tidak bisa diambil kembali demi keamanan — kalau nanti mau upload ulang, ingat
// bahwa tombol Upload Excel itu MEMBUAT akun baru, bukan meng-update yang sudah ada, jadi upload
// ulang file export ini apa adanya akan bikin akun duplikat, bukan menimpa data lama).
function exportAkunToExcel(role){
    if(typeof XLSX==='undefined'){showToast('Modul Excel belum siap, muat ulang halaman','danger');return;}
    const list=role==='admin'?_adminListCache:role==='review'?_reviewListCache:_userListCache;
    if(!list||!list.length){showToast('Tidak ada data akun untuk diekspor','danger');return;}
    const wb=XLSX.utils.book_new();
    let header,rows;
    if(role==='user'){
        header=['Nama','Email','Password','Grup','Status','Nama Paket','Durasi Langganan','Langganan Mulai (isi jika Durasi=range)','Langganan Akhir (isi jika Durasi=range)'];
        rows=[header,...list.map(u=>[
            u.nama||'',u.email||'','',_userGrubNama(u.grub)||'',u.status||'aktif',u.paket_nama||'',
            (u.langganan_mulai||u.langganan_akhir)?'range':'', u.langganan_mulai||'', u.langganan_akhir||''
        ])];
    }else{
        header=['Nama','Email','Password','Status'];
        rows=[header,...list.map(a=>[a.nama||'',a.email||'','',a.status||'aktif'])];
    }
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'Akun');
    const ket=[
        ['Diekspor pada '+new Date().toLocaleString('id-ID')+' — '+list.length+' akun '+(_AKUN_ROLE_LABEL[role]||role)],
        ['Kolom Password sengaja dikosongkan (password lama tidak bisa diambil kembali demi keamanan).'],
        ['PENTING: tombol "Upload Excel" di aplikasi MEMBUAT akun baru, bukan meng-update akun yang sudah ada.'],
        ['Upload ulang file ini apa adanya akan menghasilkan akun duplikat — file ini untuk backup/laporan, bukan untuk sinkronisasi dua arah.'],
    ];
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(ket),'Keterangan');
    XLSX.writeFile(wb,`Export_Akun_${_AKUN_ROLE_LABEL[role]||role}_${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast(`${list.length} akun ${_AKUN_ROLE_LABEL[role]||''} berhasil diekspor`,'success');
}

function triggerUploadAkun(role){
    document.getElementById(`upload-akun-${role}-file`)?.click();
}

function onUploadAkunFile(input,role){
    const file=input.files[0];
    if(!file)return;
    if(typeof XLSX==='undefined'){showToast('Modul Excel belum siap, muat ulang halaman','danger');input.value='';return;}
    const reader=new FileReader();
    reader.onload=(e)=>{
        try{
            const wb=XLSX.read(e.target.result,{type:'array'});
            const ws=wb.Sheets['Akun']||wb.Sheets[wb.SheetNames[0]];
            if(!ws){showToast('Sheet data tidak ditemukan pada file','danger');input.value='';return;}
            const allRows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
            const rows=allRows.slice(1).filter(r=>String(r[0]||'').trim()!==''||String(r[1]||'').trim()!=='');
            if(!rows.length){showToast('Tidak ada baris data pada file. Pastikan mengikuti format template.','danger');input.value='';return;}
            _processAkunImport(role,rows);
        }catch(err){
            console.error(err);
            showToast('Gagal membaca file. Pastikan format sesuai template.','danger');
        }
        input.value='';
    };
    reader.onerror=()=>{showToast('Gagal membaca file','danger');input.value='';};
    reader.readAsArrayBuffer(file);
}

async function _processAkunImport(role,rows){
    const progEl=document.getElementById(`akun-import-progress-${role}`);
    if(progEl){progEl.style.display='block';progEl.textContent=`Memproses 0/${rows.length}...`;}

    let grubCache=[];
    if(role==='user') grubCache=await GrubsAPI.getAll().catch(()=>[]);

    let sukses=0,gagal=0;const errors=[];
    for(let i=0;i<rows.length;i++){
        const r=rows[i];
        const nama=String(r[0]||'').trim();
        const email=String(r[1]||'').trim();
        if(progEl)progEl.textContent=`Memproses ${i+1}/${rows.length}: ${nama||email||'(baris '+(i+2)+')'}...`;
        if(!nama||!email){gagal++;errors.push(`Baris ${i+2}: Nama/Email kosong, dilewati`);continue;}
        const password=String(r[2]||'').trim()||undefined;
        let statusRaw=String(role==='user'?(r[4]||''):(r[3]||'')).trim().toLowerCase();
        const status=statusRaw==='nonaktif'?'nonaktif':'aktif';

        const data={nama,email,role,status};
        if(password)data.password=password;

        if(role==='user'){
            const grubNama=String(r[3]||'').trim();
            if(grubNama){
                let g=grubCache.find(x=>(x.nama||'').trim().toLowerCase()===grubNama.toLowerCase());
                if(!g){
                    try{ g=await GrubsAPI.create(grubNama); if(g&&(g.kode||g.id))grubCache.push({kode:g.kode||g.id,nama:grubNama}); }
                    catch(e){ /* jika gagal buat grup, lanjut tanpa grup */ }
                }
                if(g)data.grub=g.kode||g.id;
            }
            const paketNama=String(r[5]||'').trim();
            const durasiRaw=String(r[6]||'').trim().toLowerCase();
            const durasiKey=_normalizeDurasiKey(durasiRaw);
            if(paketNama)data.paket_nama=paketNama;
            if(durasiKey&&_DURASI_HARI[durasiKey]){
                const hasil=_hitungDurasiLangganan(durasiKey);
                data.langganan_mulai=hasil.mulai;data.langganan_akhir=hasil.akhir;
            }else{
                const langgananMulai=String(r[7]||'').trim();
                const langgananAkhir=String(r[8]||'').trim();
                if(langgananMulai)data.langganan_mulai=langgananMulai;
                if(langgananAkhir)data.langganan_akhir=langgananAkhir;
            }
        }

        try{ await UsersAPI.create(data); sukses++; }
        catch(e){ gagal++; errors.push(`Baris ${i+2} (${email}): ${e.message||'Gagal disimpan'}`); }
    }

    if(progEl){progEl.style.display='none';progEl.textContent='';}
    if(role==='admin')await renderAdminList();else if(role==='review')await renderReviewList();else{await _loadUserGrubList();_renderUserGrubFilters();await renderUserList();}

    if(gagal===0){
        showToast(`Import berhasil! ${sukses} akun ${_AKUN_ROLE_LABEL[role]||''} ditambahkan`,'success');
    }else{
        console.warn('Import akun — sebagian gagal:',errors);
        showToast(`Import selesai: ${sukses} berhasil, ${gagal} gagal/dilewati (lihat console untuk detail)`,'danger');
    }
}

// ── DURASI LANGGANAN (preset 1 hari/1 minggu/1 bulan/1 tahun, atau rentang tanggal custom) ──
const _DURASI_HARI={hari:1,minggu:7,bulan:30,tahun:365};
function _toIsoDate(d){return d.toISOString().split('T')[0];}
function _normalizeDurasiKey(raw){
    const s=String(raw||'').trim().toLowerCase();
    if(!s)return '';
    if(s.includes('hari'))return 'hari';
    if(s.includes('minggu'))return 'minggu';
    if(s.includes('bulan'))return 'bulan';
    if(s.includes('tahun'))return 'tahun';
    return ''; // "range"/"custom"/nilai lain → pakai kolom Langganan Mulai & Akhir manual
}
// mulaiIso opsional (default hari ini) — dipakai supaya import Excel & form pakai perhitungan yang sama
function _hitungDurasiLangganan(durasiKey,mulaiIso){
    const hari=_DURASI_HARI[durasiKey];
    if(!hari)return null;
    const mulai=mulaiIso?new Date(mulaiIso+'T00:00:00'):new Date();
    mulai.setHours(0,0,0,0);
    const akhir=new Date(mulai);akhir.setDate(akhir.getDate()+hari-1);
    return{mulai:_toIsoDate(mulai),akhir:_toIsoDate(akhir)};
}
function _onUfDurasiChange(){
    const durasi=document.getElementById('uf-durasi')?.value||'';
    const rangeWrap=document.getElementById('uf-langganan-range-wrap');
    const preview=document.getElementById('uf-durasi-preview');
    if(durasi==='range'){
        if(rangeWrap)rangeWrap.style.display='flex';
        if(preview)preview.style.display='none';
    }else if(durasi&&_DURASI_HARI[durasi]){
        if(rangeWrap)rangeWrap.style.display='none';
        const hasil=_hitungDurasiLangganan(durasi);
        document.getElementById('uf-langganan-mulai').value=hasil.mulai;
        document.getElementById('uf-langganan-akhir').value=hasil.akhir;
        if(preview){preview.style.display='block';preview.textContent=`Aktif ${formatDate?formatDate(hasil.mulai):hasil.mulai} s/d ${formatDate?formatDate(hasil.akhir):hasil.akhir}`;}
    }else{
        if(rangeWrap)rangeWrap.style.display='none';
        if(preview)preview.style.display='none';
        document.getElementById('uf-langganan-mulai').value='';
        document.getElementById('uf-langganan-akhir').value='';
    }
    setDirty();
}

// ── GENERIC USER FORM ──
let _ufRole='',_ufKode='';
// Modal form akun (#user-form-overlay, berisi #uf-title dkk) di-lazy-load lewat
// admin/akun-modals.html (lihat ADMIN_PAGE_MODULES di js/app.js) dan SEHARUSNYA
// sudah pasti ada di DOM begitu halaman Akun selesai dimuat. Tapi kalau proses
// lazy-load itu sempat gagal (koneksi putus di tengah, dsb) dan pengguna sempat
// melihat daftar akun dari render sebelumnya, klik Tambah/Edit bisa mendarat di
// elemen yang belum ada → error "Cannot set properties of null". Guard ini
// mendeteksi itu dan coba muat ulang modalnya dulu sebelum lanjut, alih-alih
// langsung crash tanpa penjelasan ke pengguna.
async function _ensureAkunModals(){
    if(document.getElementById('uf-title'))return true;
    if(typeof ensureAdminPageModule==='function'){
        try{ await ensureAdminPageModule('akun'); }catch(e){}
    }
    if(document.getElementById('uf-title'))return true;
    showToast('Gagal memuat form akun, silakan muat ulang halaman','danger');
    return false;
}
async function openAddUser(role){
    if(!await _ensureAkunModals())return;
    _ufRole=role;_ufKode='';
    document.getElementById('uf-title').textContent=`Tambah ${role==='admin'?'Admin':role==='review'?'Reviewer':'User'}`;
    document.getElementById('uf-mode').value='add';document.getElementById('uf-id').value='';document.getElementById('uf-role').value=role;
    const grubs=await GrubsAPI.getAll().catch(()=>[]);
    document.getElementById('uf-grub-wrap').style.display=role==='user'?'block':'none';
    document.getElementById('uf-paket-wrap').style.display=role==='user'?'block':'none';
    document.getElementById('uf-grub').innerHTML=`<option value="">-- Tanpa Grup --</option>${grubs.map(g=>`<option value="${g.kode||g.id}">${g.nama}</option>`).join('')}`;
    document.getElementById('uf-nama').value='';document.getElementById('uf-email').value='';document.getElementById('uf-password').value='';document.getElementById('uf-konfirm').value='';document.getElementById('uf-status').value='aktif';
    document.getElementById('uf-paket-nama').value='';document.getElementById('uf-durasi').value='';document.getElementById('uf-langganan-mulai').value='';document.getElementById('uf-langganan-akhir').value='';
    _onUfDurasiChange();
    document.getElementById('uf-form-body').style.display='block';
    openModal('user-form-overlay');
}
async function openEditUser(role,kode,nama){
    if(!await _ensureAkunModals())return;
    _ufRole=role;_ufKode=kode;
    document.getElementById('uf-title').textContent=`Edit ${nama}`;
    document.getElementById('uf-mode').value='edit';document.getElementById('uf-id').value=kode;document.getElementById('uf-role').value=role;
    const allUsers=await UsersAPI.getByRole(role).catch(()=>[]);
    const u=allUsers.find(x=>(x.kode||x.id)==kode);
    const grubs=await GrubsAPI.getAll().catch(()=>[]);
    document.getElementById('uf-grub-wrap').style.display=role==='user'?'block':'none';
    document.getElementById('uf-paket-wrap').style.display=role==='user'?'block':'none';
    document.getElementById('uf-grub').innerHTML=`<option value="">-- Tanpa Grup --</option>${grubs.map(g=>`<option value="${g.kode||g.id}" ${u?.grub===(g.kode||g.id)?'selected':''}>${g.nama}</option>`).join('')}`;
    if(u){
        document.getElementById('uf-nama').value=u.nama||'';
        document.getElementById('uf-email').value=u.email||'';
        document.getElementById('uf-status').value=u.status||'aktif';
        if(role==='user'){
            document.getElementById('uf-paket-nama').value=u.paket_nama||'';
            // Data lama disimpan sebagai tanggal eksplisit — tampilkan sebagai rentang custom agar tidak mengubah tanggal yang sudah berjalan tanpa sengaja.
            document.getElementById('uf-durasi').value=(u.langganan_mulai||u.langganan_akhir)?'range':'';
            document.getElementById('uf-langganan-mulai').value=u.langganan_mulai||'';
            document.getElementById('uf-langganan-akhir').value=u.langganan_akhir||'';
            _onUfDurasiChange();
        }
    }
    document.getElementById('uf-password').value='';document.getElementById('uf-konfirm').value='';document.getElementById('uf-form-body').style.display='block';
    openModal('user-form-overlay');
}
async function submitUserForm(){
    const mode=document.getElementById('uf-mode').value,kode=document.getElementById('uf-id').value,role=document.getElementById('uf-role').value;
    const nama=document.getElementById('uf-nama').value.trim(),email=document.getElementById('uf-email').value.trim();
    const pw=document.getElementById('uf-password').value,pwk=document.getElementById('uf-konfirm').value;
    const grub=document.getElementById('uf-grub')?.value||null,status=document.getElementById('uf-status').value;
    const paket_nama=role==='user'?(document.getElementById('uf-paket-nama')?.value.trim()||null):null;
    const durasiSel=role==='user'?(document.getElementById('uf-durasi')?.value||''):'';
    let langganan_mulai=role==='user'?(document.getElementById('uf-langganan-mulai')?.value||null):null;
    let langganan_akhir=role==='user'?(document.getElementById('uf-langganan-akhir')?.value||null):null;
    if(role==='user'&&durasiSel&&_DURASI_HARI[durasiSel]){
        const hasil=_hitungDurasiLangganan(durasiSel);
        langganan_mulai=hasil.mulai;langganan_akhir=hasil.akhir;
    }
    if(!nama||!email){showToast('Nama dan email wajib','danger');return;}
    if(mode==='add'&&!pw){showToast('Password wajib untuk akun baru','danger');return;}
    if(pw&&pw!==pwk){showToast('Konfirmasi password tidak cocok','danger');return;}
    if(pw&&pw.length<6){showToast('Password minimal 6 karakter','danger');return;}
    const body=document.getElementById('uf-form-body');body.style.display='none';
    setTimeout(async()=>{
        try{const d={nama,email,role,grub,status,paket_nama,langganan_mulai,langganan_akhir};if(pw)d.password=pw;if(mode==='add')await UsersAPI.create(d);else await UsersAPI.update(kode,d);
            showFormResult(document.getElementById('user-form-overlay').querySelector('.modal'),true,mode==='add'?'Akun berhasil ditambahkan!':'Akun berhasil diperbarui!');
            clearDirty();setTimeout(()=>{closeModal('user-form-overlay');body.style.display='block';if(role==='admin')renderAdminList();else if(role==='review')renderReviewList();else renderUserList();},1800);
        }catch(e){showFormResult(document.getElementById('user-form-overlay').querySelector('.modal'),false,'Gagal: '+e.message);setTimeout(()=>{body.style.display='block';},2000);}
    },300);
}

// ══════════════ KELOLA GRUP USER (dikelola dari Manajemen Akun → User) ══════════════
function openManageUserGrub(){
    const input=document.getElementById('user-grub-new-input');if(input)input.value='';
    _renderUserGrubManageList();
    openModal('user-grub-overlay');
}
function _renderUserGrubManageList(){
    const el=document.getElementById('user-grub-manage-list');if(!el)return;
    if(!_userGrubList.length){el.innerHTML='<p style="color:var(--text-sub);font-size:13px">Belum ada grup. Tambahkan lewat kolom di atas.</p>';return;}
    el.innerHTML=_userGrubList.map(g=>`
      <div class="ebook-pick-item" id="ugrb-row-${g.kode||g.id}" style="justify-content:space-between">
        <span id="ugrb-nama-${g.kode||g.id}" style="font-weight:600;font-size:13.5px;color:var(--blue)">${g.nama}</span>
        <div class="ugrb-row-actions" style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn-icon" title="Ganti nama" onclick="_startRenameUserGrub('${g.kode||g.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn-icon danger" title="Hapus" onclick="deleteUserGrubItem('${g.kode||g.id}','${(g.nama||'').replace(/'/g,"\\'")}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
        </div>
      </div>`).join('');
}
async function addUserGrub(){
    const input=document.getElementById('user-grub-new-input');
    const nama=(input?.value||'').trim();
    if(!nama){showToast('Nama grup wajib diisi','danger');return;}
    try{
        await GrubsAPI.create(nama);
        if(input)input.value='';
        showToast('Grup ditambahkan','success');
        await _afterUserGrubChange();
    }catch(e){showToast('Gagal: '+e.message,'danger');}
}
function _startRenameUserGrub(kode){
    const span=document.getElementById(`ugrb-nama-${kode}`);if(!span)return;
    const current=span.textContent;
    span.outerHTML=`<input id="ugrb-nama-${kode}" class="form-input" style="padding:6px 10px;font-size:13px" type="text" value="${current.replace(/"/g,'&quot;')}" onkeydown="if(event.key==='Enter')_saveRenameUserGrub('${kode}')">`;
    const row=document.getElementById(`ugrb-row-${kode}`);
    const actionsWrap=row?.querySelector('.ugrb-row-actions');
    if(actionsWrap)actionsWrap.innerHTML=`<button class="btn-icon" title="Simpan" onclick="_saveRenameUserGrub('${kode}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg></button>`;
    document.getElementById(`ugrb-nama-${kode}`)?.focus();
}
async function _saveRenameUserGrub(kode){
    const input=document.getElementById(`ugrb-nama-${kode}`);
    const nama=(input?.value||'').trim();
    if(!nama){showToast('Nama grup wajib diisi','danger');return;}
    try{
        await GrubsAPI.update(kode,nama);
        showToast('Grup diperbarui, semua user terkait ikut berubah','success');
        await _afterUserGrubChange();
    }catch(e){showToast('Gagal: '+e.message,'danger');}
}
function deleteUserGrubItem(kode,nama){
    showConfirm('Hapus Grup',`Yakin hapus grup "${nama}"? User yang ada di grup ini akan menjadi tanpa grup (bukan ikut terhapus).`,'danger',async()=>{
        await GrubsAPI.delete(kode);
        showToast('Grup dihapus','danger');
        await _afterUserGrubChange();
    });
}
// Refresh semua bagian UI yang menampilkan/memakai daftar grup user, di halaman mana pun sedang aktif
async function _afterUserGrubChange(){
    await _loadUserGrubList();
    _renderUserGrubManageList();
    if(document.getElementById('uf-grub'))document.getElementById('uf-grub').innerHTML=`<option value="">-- Tanpa Grup --</option>${_userGrubList.map(g=>`<option value="${g.kode||g.id}">${g.nama}</option>`).join('')}`;
    if(document.getElementById('user-grub-filters')){_renderUserGrubFilters();await renderUserList();}
}
