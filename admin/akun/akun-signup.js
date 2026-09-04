// admin/akun-signup.js
// Bagian SIGNUP REQUESTS dari akun.js lama — di-lazy-load bersamaan dengan js/akun.js saat tab Akun dibuka (dipanggil dari renderAkunSub('signup') di js/akun.js).
// Bergantung pada helper global dari js/app.js (showToast, openModal, navigateTo, dst)
// yang sudah dimuat lebih dulu lewat shell index_admin.html.

// ── SIGNUP REQUESTS ──
let _signups=[];
function _signupRowHtml(r,i){return `<tr><td>${i+1}</td><td><strong>${r.nama}</strong></td><td>${r.email}</td><td class="hide-mobile">${r.paket_nama?`<span class="badge badge-aktif" style="font-size:10px">${r.paket_nama}</span>`:'<span style="color:#94a3b8;font-size:11px">-</span>'}</td><td style="font-size:11px">${formatDateTime(r.created_at)}</td><td><div style="display:flex;gap:6px"><button class="btn btn-primary btn-sm" onclick="approveSignup(${r.id})">✓ Aktivasi</button><button class="btn btn-danger btn-sm" onclick="rejectSignup(${r.id})">✗ Tolak</button></div></td></tr>`;}
function _signupCardHtml(r){return SwipeCards.buildSwipeCardHtml({
    title:r.nama,sub:r.email+(r.paket_nama?` · ${r.paket_nama}`:''),
    leftActions:[{icon:'check',label:'Aktivasi',cls:'act-primary',onClick:`approveSignup(${r.id})`}],
    rightActions:[{icon:'cross',label:'Tolak',cls:'act-danger',onClick:`rejectSignup(${r.id})`}]
});}
async function renderSignupRequests(){
    _signups=await UsersAPI.getSignupRequests().catch(()=>[]);
    const el=document.getElementById('signup-req-list');if(!el)return;
    VirtualList.render(el,{items:_signups,rowHeight:52,tag:'tr',colSpan:6,
        renderItem:_signupRowHtml,
        emptyHtml:`<tr><td colspan="6"><div class="empty-state"><p>Tidak ada permintaan pendaftaran</p></div></td></tr>`});
    const swEl=document.getElementById('signup-swipe-list');
    if(swEl&&window.SwipeCards){
        VirtualList.render(swEl,{items:_signups,rowHeight:78,tag:'div',
            renderItem:_signupCardHtml,
            emptyHtml:'<div class="swipe-card-empty">Tidak ada permintaan pendaftaran</div>',
            onRendered:()=>SwipeCards.bindSwipeList(swEl)});
    }
}
async function approveSignup(id){showConfirm('Aktivasi Akun','Yakin aktifkan akun ini?','warning',async()=>{try{await UsersAPI.approveSignup(id);showToast('Akun diaktifkan!','success');await renderSignupRequests();await renderHome();}catch(e){showToast('Gagal: '+e.message,'danger');}});}
async function rejectSignup(id){showConfirm('Tolak Pendaftaran','Yakin tolak pendaftaran ini?','danger',async()=>{try{await UsersAPI.rejectSignup(id);showToast('Ditolak','danger');await renderSignupRequests();}catch(e){showToast('Gagal','danger');}});}

// ── PAKET REQUESTS (aktivasi paket landing baru) ──
// Akun user dari landing baru sudah aktif sejak daftar; yang menunggu di sini
// hanyalah PAKET yang dipilih — admin memverifikasi bukti bayar lalu klik
// Aktivasi untuk mengisi user_pakets (lihat POST /api/paket-requests/:kode/approve).
let _paketReqs=[];
function _paketReqRowHtml(r,i){return `<tr><td>${i+1}</td><td><strong>${r.user_nama||r.user_kode}</strong></td><td>${r.user_email||'-'}</td><td class="hide-mobile"><span class="badge badge-aktif" style="font-size:10px">${r.paket_nama}</span></td><td class="hide-mobile">${r.metode_bayar||'-'}</td><td style="font-size:11px">${formatDateTime(r.created_at)}</td><td><div style="display:flex;gap:6px"><button class="btn btn-primary btn-sm" onclick="approvePaketRequest('${r.kode}')">✓ Aktivasi</button><button class="btn btn-danger btn-sm" onclick="rejectPaketRequest('${r.kode}')">✗ Tolak</button></div></td></tr>`;}
function _paketReqCardHtml(r){return SwipeCards.buildSwipeCardHtml({
    title:r.user_nama||r.user_kode,sub:(r.user_email||'-')+` · ${r.paket_nama}`,
    leftActions:[{icon:'check',label:'Aktivasi',cls:'act-primary',onClick:`approvePaketRequest('${r.kode}')`}],
    rightActions:[{icon:'cross',label:'Tolak',cls:'act-danger',onClick:`rejectPaketRequest('${r.kode}')`}]
});}
async function renderPaketRequests(){
    _paketReqs=await PaketRequestsAPI.getAll().catch(()=>[]);
    const el=document.getElementById('paket-req-list');if(!el)return;
    VirtualList.render(el,{items:_paketReqs,rowHeight:52,tag:'tr',colSpan:7,
        renderItem:_paketReqRowHtml,
        emptyHtml:`<tr><td colspan="7"><div class="empty-state"><p>Tidak ada permintaan aktivasi paket</p></div></td></tr>`});
    const swEl=document.getElementById('paket-req-swipe-list');
    if(swEl&&window.SwipeCards){
        VirtualList.render(swEl,{items:_paketReqs,rowHeight:78,tag:'div',
            renderItem:_paketReqCardHtml,
            emptyHtml:'<div class="swipe-card-empty">Tidak ada permintaan aktivasi paket</div>',
            onRendered:()=>SwipeCards.bindSwipeList(swEl)});
    }
}
async function approvePaketRequest(kode){showConfirm('Aktivasi Paket','Yakin sudah menerima pembayarannya? Paket akan langsung aktif untuk user ini.','warning',async()=>{try{await PaketRequestsAPI.approve(kode);showToast('Paket diaktifkan!','success');await renderPaketRequests();}catch(e){showToast('Gagal: '+e.message,'danger');}});}
async function rejectPaketRequest(kode){showConfirm('Tolak Permintaan','Yakin tolak permintaan aktivasi paket ini?','danger',async()=>{try{await PaketRequestsAPI.reject(kode);showToast('Ditolak','danger');await renderPaketRequests();}catch(e){showToast('Gagal','danger');}});}