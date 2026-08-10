/* token.js v2 - Token management */
let _genTokens=[];
function renderToken(){const sub=AppState.currentSubPage['token']||'buat';renderTokenSub(sub);}
function renderTokenSub(sub){
    AppState.currentSubPage['token']=sub;
    if (typeof _persistAdminNav === 'function') _persistAdminNav();
    document.querySelectorAll('#page-token .sub-tab').forEach(t=>t.classList.toggle('active',t.dataset.sub===sub));
    document.querySelectorAll('#page-token .sub-page').forEach(p=>p.classList.toggle('active',p.id===`sub-token-${sub}`));
    if(sub==='buat')_initBuatToken();else if(sub==='list')_initListToken();else _initTokenUsed();
}
async function _initBuatToken(){
    const sel=document.getElementById('token-modul-sel');if(!sel)return;
    sel.value='';
    const dt=document.getElementById('token-modul-display-text');if(dt){dt.textContent='-- Pilih Modul --';dt.style.color='rgba(19,50,89,0.35)';}
    const tw0=document.getElementById('token-generated-table-wrap');if(tw0)tw0.innerHTML='';
    const sw0=document.getElementById('token-generated-swipe-list');if(sw0)sw0.innerHTML='';
    const pg0=document.getElementById('token-generated-pagination');if(pg0)pg0.innerHTML='';
    _genTokens=[];document.getElementById('token-dl-section').style.display='none';
    const irChk=document.getElementById('token-izinkan-review');if(irChk)irChk.checked=false;
    const grChk=document.getElementById('token-grub-aktif');if(grChk)grChk.checked=false;
    const grInp=document.getElementById('token-grub-nama');if(grInp)grInp.value='';
    _toggleTokenGrub(false);
    const bkChk=document.getElementById('token-batas-keluar-aktif');if(bkChk)bkChk.checked=true;
    const bkInp=document.getElementById('token-batas-keluar-jumlah');if(bkInp)bkInp.value=3;
    _toggleBatasKeluar(true);
    const pgChk=document.getElementById('token-pengaturan-aktif');if(pgChk)pgChk.checked=false;
    _setTokenPengaturanWrap(false);
    TokensAPI.getGrubList().then(function(list){
        var dl=document.getElementById('token-grub-suggest');
        if(dl)dl.innerHTML=(list||[]).map(function(g){return '<option value="'+String(g.grub_token||'').replace(/"/g,'&quot;')+'">';}).join('');
    }).catch(function(){});
    _setTokenMode('hari_ini');
}

function _toggleTokenGrub(on){
    var wrap=document.getElementById('token-grub-wrap');
    if(wrap)wrap.style.display=on?'block':'none';
}
function _toggleBatasKeluar(on){
    var wrap=document.getElementById('token-batas-keluar-wrap');
    if(wrap)wrap.style.display=on?'block':'none';
}
function _setTokenPengaturanWrap(on){
    var wrap=document.getElementById('token-pengaturan-wrap');
    if(wrap)wrap.style.display=on?'block':'none';
}
// Nilai default dari 3 opsi di dalam "Pengaturan" — dipakai untuk deteksi
// perubahan (dirty check) dan untuk reset saat switch "Pengaturan" dimatikan.
function _tokenPengaturanDefault(){
    return { izinkanReview:false, grubAktif:false, grubNama:'', batasKeluarAktif:true, batasKeluarJumlah:3 };
}
function _tokenPengaturanIsDirty(){
    const def=_tokenPengaturanDefault();
    const izinkanReview=!!document.getElementById('token-izinkan-review')?.checked;
    const grubAktif=!!document.getElementById('token-grub-aktif')?.checked;
    const grubNama=(document.getElementById('token-grub-nama')?.value||'').trim();
    const batasKeluarAktif=!!document.getElementById('token-batas-keluar-aktif')?.checked;
    const batasKeluarJumlah=parseInt(document.getElementById('token-batas-keluar-jumlah')?.value)||0;
    return izinkanReview!==def.izinkanReview||grubAktif!==def.grubAktif||grubNama!==def.grubNama||batasKeluarAktif!==def.batasKeluarAktif||batasKeluarJumlah!==def.batasKeluarJumlah;
}
function _tokenPengaturanReset(){
    const def=_tokenPengaturanDefault();
    const irChk=document.getElementById('token-izinkan-review');if(irChk)irChk.checked=def.izinkanReview;
    const grChk=document.getElementById('token-grub-aktif');if(grChk)grChk.checked=def.grubAktif;
    const grInp=document.getElementById('token-grub-nama');if(grInp)grInp.value=def.grubNama;
    _toggleTokenGrub(def.grubAktif);
    const bkChk=document.getElementById('token-batas-keluar-aktif');if(bkChk)bkChk.checked=def.batasKeluarAktif;
    const bkInp=document.getElementById('token-batas-keluar-jumlah');if(bkInp)bkInp.value=def.batasKeluarJumlah;
    _toggleBatasKeluar(def.batasKeluarAktif);
}
function _toggleTokenPengaturan(on){
    const pgChk=document.getElementById('token-pengaturan-aktif');
    if(on){ _setTokenPengaturanWrap(true); return; }
    // Mematikan "Pengaturan": kalau ada perubahan dari default, konfirmasi dulu
    // karena akan mengembalikan semua opsi di dalamnya ke pengaturan awal.
    if(_tokenPengaturanIsDirty()){
        showConfirm('Matikan Pengaturan?','Anda telah mengubah salah satu opsi (Izinkan Review, Aktifkan Grup Token, atau Batas Keluar Ujian). Mematikan "Pengaturan" akan mengembalikan semuanya ke pengaturan awal. Lanjutkan?','danger',()=>{
            _tokenPengaturanReset();
            _setTokenPengaturanWrap(false);
            if(pgChk)pgChk.checked=false;
        });
        // Batalkan (kembalikan switch ke aktif) sambil menunggu konfirmasi user;
        // kalau user pilih "Ya" di popup, _tokenPengaturanReset() di atas akan
        // mengembalikan opsi ke default meski switch sempat balik nyala.
        if(pgChk)pgChk.checked=true;
    } else {
        _setTokenPengaturanWrap(false);
    }
}

function _setTokenMode(mode){
    const wrap=document.getElementById('token-custom-wrap');
    document.querySelectorAll('.token-mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
    if(wrap) wrap.style.display=mode==='custom'?'block':'none';
    window._tokenMode=mode;
}
async function generateTokens(){
    const modul=document.getElementById('token-modul-sel').value;
    const jml=parseInt(document.getElementById('token-jumlah').value)||10;
    const mode=window._tokenMode||'hari_ini';
    const izinkanReview=document.getElementById('token-izinkan-review')?.checked?1:0;
    const grubAktif=document.getElementById('token-grub-aktif')?.checked;
    const grubNama=document.getElementById('token-grub-nama')?.value.trim()||'';
    const batasKeluarAktif=document.getElementById('token-batas-keluar-aktif')?.checked;
    const batasKeluarJumlah=Math.max(1,parseInt(document.getElementById('token-batas-keluar-jumlah')?.value)||3);
    if(!modul){showToast('Pilih modul terlebih dahulu','danger');return;}
    if(jml<1||jml>200){showToast('Jumlah token 1-200','danger');return;}
    if(grubAktif&&!grubNama){showToast('Nama grup token wajib diisi','danger');return;}

    const batasKeluar=batasKeluarAktif?batasKeluarJumlah:null;
    let payload={modul_kode:modul,jumlah:jml,mode,izinkan_review:izinkanReview,batas_keluar:batasKeluar};
    if(grubAktif)payload.grub_token=grubNama;
    if(mode==='custom'){
        const tglM=document.getElementById('token-tgl-mulai').value,tglA=document.getElementById('token-tgl-akhir').value,jamM=document.getElementById('token-jam-mulai')?.value||'08:00',jamA=document.getElementById('token-jam-akhir')?.value||'23:59';
        if(!tglM||!tglA){showToast('Tanggal wajib diisi','danger');return;}
        payload.aktivasi=`${tglM}T${jamM}`;payload.expired=`${tglA}T${jamA}`;
    }

    const btn=document.querySelector('#sub-token-buat .btn-primary');if(btn){btn.disabled=true;btn.textContent='Membuat...';}
    try{
        const result=await TokensAPI.generate(payload);
        if(!result||!result.length){showToast('Tidak ada token yang dibuat','danger');return;}
        // Server sekarang mengembalikan array objek {kode,modul_kode,aktivasi,expired}
        // Pastikan format konsisten
        _genTokens=result.map(t=>typeof t==='string'?{kode:t,modul_kode:modul,aktivasi:payload.aktivasi||null,expired:payload.expired||null,izinkan_review:izinkanReview,batas_keluar:batasKeluar}:t);
        _renderGenList(1);document.getElementById('token-dl-section').style.display='flex';
        showToast(`${_genTokens.length} token berhasil dibuat!`,'success');
    }catch(e){showToast('Gagal: '+e.message,'danger');}
    if(btn){btn.disabled=false;btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Buat Token';}
}
let _genPage=1;
function _renderGenList(pg){
    _genPage=pg;const PER=20,total=_genTokens.length,totalPg=Math.max(1,Math.ceil(total/PER)),start=(pg-1)*PER,slice=_genTokens.slice(start,start+PER);
    const tw=document.getElementById('token-generated-table-wrap');
    if(tw)tw.innerHTML=`<table><thead><tr><th>#</th><th>Kode Token</th><th>Modul</th><th class="hide-mobile">Aktivasi</th><th class="hide-mobile">Expired</th><th class="hide-mobile">Review</th><th>Aksi</th></tr></thead><tbody>${slice.map((tk,i)=>`<tr style="animation:fadeUp 0.15s ${i*0.02}s both"><td>${start+i+1}</td><td><code style="font-family:monospace;font-weight:700;color:var(--blue);letter-spacing:0.08em;font-size:12px">${tk.kode}</code></td><td style="font-size:12px">${tk.modul_kode||'-'}</td><td class="hide-mobile" style="font-size:11px">${tk.aktivasi?new Date(tk.aktivasi).toLocaleString('id-ID'):'-'}</td><td class="hide-mobile" style="font-size:11px">${tk.expired?new Date(tk.expired).toLocaleString('id-ID'):'-'}</td><td class="hide-mobile"><span class="history-badge" style="${tk.izinkan_review?'background:rgba(22,163,74,.12);color:#16a34a':'background:rgba(19,50,89,.08);color:var(--text-sub)'}">${tk.izinkan_review?'✓ Ya':'Tidak'}</span></td><td style="white-space:nowrap"><button class="btn btn-secondary btn-sm" onclick="openTokenQR('${tk.kode}','${tk.modul_kode||''}')">QR</button> <button class="btn btn-secondary btn-sm" onclick="openTokenCopy('${tk.kode}','${tk.modul_kode||''}','${tk.aktivasi||''}','${tk.expired||''}')">Copy</button></td></tr>`).join('')}</tbody></table>`;
    const swEl=document.getElementById('token-generated-swipe-list');
    if(swEl&&window.SwipeCards){
        swEl.innerHTML=slice.length?slice.map(tk=>SwipeCards.buildSwipeCardHtml({
            title:tk.kode,
            sub:(tk.modul_kode||'-')+(tk.expired?` · exp ${new Date(tk.expired).toLocaleString('id-ID')}`:''),
            leftActions:[{icon:'qr',label:'QRIS',cls:'act-secondary',onClick:`openTokenQR('${tk.kode}','${tk.modul_kode||''}')`}],
            rightActions:[{icon:'copy',label:'Copy',cls:'act-primary',onClick:`openTokenCopy('${tk.kode}','${tk.modul_kode||''}','${tk.aktivasi||''}','${tk.expired||''}')`}]
        })).join(''):'<div class="swipe-card-empty">Belum ada token</div>';
        SwipeCards.bindSwipeList(swEl);
    }
    const pgEl=document.getElementById('token-generated-pagination');
    if(pgEl)pgEl.innerHTML=totalPg>1?'<div class="pagination">'+Array.from({length:totalPg},(_,i)=>`<button class="page-btn ${i+1===pg?'active':''}" onclick="_renderGenList(${i+1})">${i+1}</button>`).join('')+'</div>':'';
}
// Bangun opsi filter "Grup Token" dari dataset yang BENERAN masih ada di list ini —
// bukan dari agregat server yang menghitung semua token (termasuk yg udah dipakai/expired).
// Jadi kalau satu grup tokennya udah abis semua kena filter (dipakai/expired), opsinya
// otomatis ilang dari dropdown karena toh percuma, gak ada datanya lagi buat difilter.
function _populateGrubFilterSelect(selId,data,currentVal){
    const sel=document.getElementById(selId);if(!sel)return currentVal;
    const counts={};let noneCount=0;
    data.forEach(t=>{ if(t.grub_token){counts[t.grub_token]=(counts[t.grub_token]||0)+1;} else noneCount++; });
    const names=Object.keys(counts).sort((a,b)=>a.localeCompare(b,'id'));
    let newVal=currentVal;
    if(newVal&&newVal!=='__none__'&&!counts[newVal])newVal='';
    if(newVal==='__none__'&&!noneCount)newVal='';
    let html='<option value="">Semua Grup Token</option>';
    if(noneCount)html+=`<option value="__none__">Tanpa Grup (${noneCount})</option>`;
    html+=names.map(n=>`<option value="${n.replace(/"/g,'&quot;')}">${n} (${counts[n]})</option>`).join('');
    sel.innerHTML=html;
    sel.value=newVal;
    return newVal;
}
async function _initListToken(){
    const [tokens,moduls]=await Promise.all([TokensAPI.getAll().catch(()=>[]),ModulAPI.getAll().catch(()=>[])]);
    const sel=document.getElementById('list-token-modul-filter');
    if(sel)sel.innerHTML='<option value="">Semua Modul</option>'+moduls.map(m=>`<option value="${m.kode||m.id}">${m.nama}</option>`).join('');
    const now=Date.now();
    const belumDipakai=tokens.filter(t=>!t.digunakan);
    // Token yang sudah lewat expired tapi belum sempat dipakai cuma jadi sampah — bersihkan otomatis
    // biar List Token gak penuh sesak, gak ada gunanya lagi disimpan karena udah gak bisa dipakai.
    const kadaluarsa=belumDipakai.filter(t=>t.expired&&new Date(t.expired).getTime()<now);
    const masihAktif=belumDipakai.filter(t=>!(t.expired&&new Date(t.expired).getTime()<now));
    _listTokenData=masihAktif.sort((a,b)=>new Date(b.aktivasi||0)-new Date(a.aktivasi||0));
    _ltGrubFilter=_populateGrubFilterSelect('list-token-grub-filter',_listTokenData,_ltGrubFilter);
    _renderListToken();
    if(kadaluarsa.length){
        Promise.all(kadaluarsa.map(t=>TokensAPI.delete(t.kode).catch(()=>{}))).then(()=>{
            showToast(`${kadaluarsa.length} token expired otomatis dibersihkan`,'success');
        });
    }
}
let _listTokenData=[],_ltSearch='',_ltFilter='',_ltGrubFilter='',_ltFilteredData=[];
function _ltDateKey(tk){ return _localDateStr(tk.created_at||tk.token_created_at)||'0000-00-00'; }
function _renderListToken(){
    let data=_listTokenData;
    if(_ltSearch){const q=_ltSearch.toLowerCase();data=data.filter(t=>(t.kode||'').toLowerCase().includes(q));}
    if(_ltFilter)data=data.filter(t=>t.modul_kode===_ltFilter);
    if(_ltGrubFilter){
        if(_ltGrubFilter==='__none__')data=data.filter(t=>!t.grub_token);
        else data=data.filter(t=>t.grub_token===_ltGrubFilter);
    }
    _ltFilteredData=data; // dataset yang SUDAH kena filter/pencarian, dipakai untuk unduh/salin massal (bukan cuma 1 kelompok)
    const dlSec=document.getElementById('list-token-dl-section'),dlCount=document.getElementById('list-token-dl-count');
    if(dlSec)dlSec.style.display=data.length?'flex':'none';
    if(dlCount)dlCount.textContent=data.length?`${data.length} token sesuai filter`:'';

    const wrap=document.getElementById('list-token-groups');
    if(!wrap)return;
    if(!data.length){wrap.innerHTML='<div class="empty-state"><p>Tidak ada token aktif</p></div>';return;}

    // Kelompokkan per hari token DIBUAT (bukan dipakai) — sama seperti pengelompokan di Token Terpakai
    const groups={};
    data.forEach(t=>{ const k=_ltDateKey(t); (groups[k]=groups[k]||[]).push(t); });
    const dayKeys=Object.keys(groups).sort((a,b)=>b.localeCompare(a));

    wrap.innerHTML=dayKeys.map(k=>{
        const items=groups[k];
        const label=k==='0000-00-00'?'Tanggal Tidak Diketahui':new Date(k).toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
        const rows=items.map((tk,i)=>`<tr style="animation:fadeUp 0.15s ${i*0.02}s both"><td>${i+1}</td><td><code style="font-family:monospace;font-weight:700;font-size:12px;color:var(--blue)">${tk.kode}</code></td><td class="hide-mobile" style="font-size:12px">${tk.modul_kode||'-'}</td><td class="hide-mobile" style="font-size:11px">${tk.aktivasi?new Date(tk.aktivasi).toLocaleDateString('id-ID'):'-'}</td><td class="hide-mobile" style="font-size:11px">${tk.expired?new Date(tk.expired).toLocaleDateString('id-ID'):'-'}</td><td class="hide-mobile"><span class="history-badge" style="${tk.izinkan_review?'background:rgba(22,163,74,.12);color:#16a34a':'background:rgba(19,50,89,.08);color:var(--text-sub)'}">${tk.izinkan_review?'✓ Ya':'Tidak'}</span></td><td style="white-space:nowrap"><button class="btn btn-secondary btn-sm" onclick="openTokenQR('${tk.kode}','${tk.modul_kode||''}')">QR</button> <button class="btn-icon danger" onclick="hapusListToken('${tk.kode}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button></td></tr>`).join('');
        const cards=items.map(tk=>SwipeCards.buildSwipeCardHtml({
            title:tk.kode,
            sub:(tk.modul_kode||'-')+(tk.expired?` · exp ${new Date(tk.expired).toLocaleDateString('id-ID')}`:''),
            leftActions:[{icon:'qr',label:'QR',cls:'act-secondary',onClick:`openTokenQR('${tk.kode}','${tk.modul_kode||''}')`}],
            rightActions:[{icon:'trash',label:'Hapus',cls:'act-danger',onClick:`hapusListToken('${tk.kode}')`}]
        })).join('');
        return `<div class="section-sub" style="font-weight:700;color:var(--blue);text-transform:none;margin:18px 0 8px">${label} <span style="font-weight:500;color:var(--text-sub);font-size:11px">(${items.length} token)</span></div>
        <div class="card" style="padding:0;overflow:hidden"><div class="table-wrap aksi-swipe-wrap"><table><thead><tr><th>#</th><th>Kode Token</th><th class="hide-mobile">Modul</th><th class="hide-mobile">Aktivasi</th><th class="hide-mobile">Expired</th><th class="hide-mobile">Review</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table></div><div class="swipe-list">${cards}</div></div>`;
    }).join('');

    wrap.querySelectorAll('.swipe-list').forEach(el=>{ if(window.SwipeCards)SwipeCards.bindSwipeList(el); });
}
async function hapusListToken(kode){showConfirm('Hapus Token','Yakin hapus token ini?','danger',async()=>{await TokensAPI.delete(kode);showToast('Token dihapus','danger');await _initListToken();});}
function openTokenQR(kode,modulKode){
    document.getElementById('qr-token-code').textContent=kode;
    document.getElementById('qr-modul-name').textContent=modulKode||'-';
    renderQrToCanvas(document.getElementById('qr-canvas-popup'),kode,200);
    openModal('token-qr-overlay');
}
function downloadTokenQR(){const c=document.getElementById('qr-canvas-popup'),code=document.getElementById('qr-token-code').textContent;const a=document.createElement('a');a.download=`qr-${code}.png`;a.href=c.toDataURL();a.click();}
function copyTokenCode(){navigator.clipboard.writeText(document.getElementById('qr-token-code').textContent).then(()=>showToast('Kode disalin!'));}
function openTokenCopy(kode,modulKode,aktivasi,expired){
    document.getElementById('copy-token-kode').textContent=kode;
    document.getElementById('copy-token-modul').textContent=modulKode||'-';
    document.getElementById('copy-token-waktu').textContent=`${aktivasi?new Date(aktivasi).toLocaleString('id-ID'):'-'} s/d ${expired?new Date(expired).toLocaleString('id-ID'):'-'}`;
    openModal('token-copy-overlay');
}
function copyKodeSaja(){navigator.clipboard.writeText(document.getElementById('copy-token-kode').textContent).then(()=>showToast('Kode disalin!'));}
function copyList(){const k=document.getElementById('copy-token-kode').textContent,m=document.getElementById('copy-token-modul').textContent,w=document.getElementById('copy-token-waktu').textContent;navigator.clipboard.writeText(`Kode: ${k}\nModul: ${m}\nWaktu: ${w}`).then(()=>showToast('Data disalin!'));}
async function downloadAllQR(tokens){
    tokens=tokens||_genTokens;
    if(!tokens.length){showToast('Tidak ada token untuk diunduh','danger');return;}
    showToast('Menyiapkan QR, harap tunggu...','');
    // Buat canvas sementara untuk render tiap QR lalu trigger download satu per satu
    const canvas=document.createElement('canvas');
    for(let i=0;i<tokens.length;i++){
        const tk=tokens[i];
        renderQrToCanvas(canvas,tk.kode,300);
        await new Promise(res=>setTimeout(res,80)); // delay kecil antar download
        const a=document.createElement('a');
        a.download=`qr-${tk.kode}.png`;
        a.href=canvas.toDataURL('image/png');
        a.click();
        await new Promise(res=>setTimeout(res,150));
    }
    showToast(`${tokens.length} QR berhasil diunduh!`,'success');
}
async function downloadTokenList(tokens){
    tokens=tokens||_genTokens;
    if(!tokens.length){showToast('Tidak ada token untuk diunduh','danger');return;}
    // Ambil nama modul untuk mapping kode→nama
    const moduls=await ModulAPI.getAll().catch(()=>[]);
    const getModulNama=kode=>moduls.find(m=>(m.kode||m.id)===kode)?.nama||kode||'-';
    // Escape CSV field (handle koma & petik)
    const esc=v=>{ const s=String(v==null?'':v); return (s.includes(',')||s.includes('"')||s.includes('\n'))?`"${s.replace(/"/g,'""')}"`:s; };
    const lines=['\uFEFFNo,Kode Token,Nama Modul,Tanggal Aktivasi,Tanggal Expired'];
    tokens.forEach((tk,i)=>{
        const aktStr=tk.aktivasi?new Date(tk.aktivasi).toLocaleString('id-ID'):'-';
        const expStr=tk.expired?new Date(tk.expired).toLocaleString('id-ID'):'-';
        lines.push([esc(i+1),esc(tk.kode),esc(getModulNama(tk.modul_kode)),esc(aktStr),esc(expStr)].join(','));
    });
    const blob=new Blob([lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`list-token-${new Date().toLocaleDateString('id-ID').replace(/\//g,'-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('List token diunduh!');
}
function copyKodeList(tokens){
    tokens=tokens||_genTokens;
    if(!tokens.length){showToast('Tidak ada token untuk disalin','danger');return;}
    navigator.clipboard.writeText(tokens.map(tk=>tk.kode).join('\n')).then(()=>showToast(`${tokens.length} kode token disalin!`,'success'));
}

/* ══════════════ TOKEN TERPAKAI ══════════════
   Daftar token yang sudah dipakai peserta, dipisah per hari (berdasarkan tanggal selesai
   ujian), dengan filter modul + pencarian (kode/nama akun) + filter rentang tanggal
   (Hari Ini / Kemarin / Range custom). Tiap kartu punya swipe: Data + Review (kiri),
   Hapus (kanan). */
let _tuData=[],_tuSearch='',_tuFilter='',_tuGrubFilter='',_tuRange='semua',_tuCustomFrom='',_tuCustomTo='';
function _localDateStr(d){ const x=new Date(d); if(isNaN(x))return null; return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; }
function _tuDateKey(tk){ return _localDateStr(tk.tgl_selesai||tk.laporan_created_at||tk.token_created_at||tk.created_at)||'0000-00-00'; }
function _tuMulaiSelesai(tk){
    if(!tk.tgl_selesai) return {mulai:'-',selesai:'-'};
    const selesai=new Date(tk.tgl_selesai);
    let mulaiStr='-';
    if(tk.waktu_pengerjaan&&!isNaN(selesai)){
        const p=String(tk.waktu_pengerjaan).split(':').map(Number);
        const secs=(p[0]||0)*3600+(p[1]||0)*60+(p[2]||0);
        mulaiStr=formatDateTime(new Date(selesai.getTime()-secs*1000).toISOString());
    }
    return {mulai:mulaiStr,selesai:formatDateTime(tk.tgl_selesai)};
}
async function _initTokenUsed(){
    const [tokens,moduls]=await Promise.all([TokensAPI.getUsed().catch(()=>[]),ModulAPI.getAll().catch(()=>[])]);
    const sel=document.getElementById('token-used-modul-filter');
    if(sel)sel.innerHTML='<option value="">Semua Modul</option>'+moduls.map(m=>`<option value="${m.kode||m.id}">${m.nama}</option>`).join('');
    _tuData=(tokens||[]).sort((a,b)=>new Date(b.tgl_selesai||b.laporan_created_at||0)-new Date(a.tgl_selesai||a.laporan_created_at||0));
    _tuGrubFilter=_populateGrubFilterSelect('token-used-grub-filter',_tuData,_tuGrubFilter);
    _renderTokenUsed();
}
function _setTuRange(range){
    _tuRange=range;
    document.querySelectorAll('#sub-token-used [data-range]').forEach(b=>b.classList.toggle('active',b.dataset.range===range));
    const w=document.getElementById('token-used-range-wrap');
    if(w)w.style.display=range==='range'?'block':'none';
    _renderTokenUsed();
}
function _renderTokenUsed(){
    let data=_tuData;
    if(_tuSearch){const q=_tuSearch.toLowerCase();data=data.filter(t=>(t.kode||'').toLowerCase().includes(q)||(t.user_nama||t.digunakan_oleh||'').toLowerCase().includes(q));}
    if(_tuFilter)data=data.filter(t=>t.modul_kode===_tuFilter);
    if(_tuGrubFilter){
        if(_tuGrubFilter==='__none__')data=data.filter(t=>!t.grub_token);
        else data=data.filter(t=>t.grub_token===_tuGrubFilter);
    }
    const today=_localDateStr(new Date());
    const kemarin=_localDateStr(new Date(Date.now()-86400000));
    if(_tuRange==='hari_ini')data=data.filter(t=>_tuDateKey(t)===today);
    else if(_tuRange==='kemarin')data=data.filter(t=>_tuDateKey(t)===kemarin);
    else if(_tuRange==='range'&&_tuCustomFrom&&_tuCustomTo)data=data.filter(t=>{const k=_tuDateKey(t);return k>=_tuCustomFrom&&k<=_tuCustomTo;});

    const wrap=document.getElementById('token-used-groups');
    if(!wrap)return;
    if(!data.length){wrap.innerHTML='<div class="empty-state"><p>Tidak ada token terpakai</p></div>';return;}

    // Kelompokkan per hari (tanggal selesai ujian)
    const groups={};
    data.forEach(t=>{ const k=_tuDateKey(t); (groups[k]=groups[k]||[]).push(t); });
    const dayKeys=Object.keys(groups).sort((a,b)=>b.localeCompare(a));

    wrap.innerHTML=dayKeys.map(k=>{
        const items=groups[k];
        const label=k==='0000-00-00'?'Tanggal Tidak Diketahui':new Date(k).toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
        const rows=items.map((tk,i)=>{
            const {mulai,selesai}=_tuMulaiSelesai(tk);
            return `<tr style="animation:fadeUp 0.15s ${i*0.02}s both"><td>${i+1}</td><td><code style="font-family:monospace;font-weight:700;color:var(--blue);letter-spacing:0.08em;font-size:12px">${tk.kode}</code></td><td class="hide-mobile" style="font-size:12px">${tk.modul_nama||tk.modul_kode||'-'}</td><td class="hide-mobile" style="font-size:12px">${tk.user_nama||tk.digunakan_oleh||'-'}</td><td class="hide-mobile" style="font-size:11px">${selesai}</td><td><strong style="color:var(--blue)">${tk.skor!=null?Math.round(tk.skor):'-'}</strong></td><td style="white-space:nowrap"><button class="btn btn-secondary btn-sm" onclick="openTokenUsedData('${tk.kode}')">Data</button> <button class="btn btn-secondary btn-sm" onclick="openTokenUsedReview('${tk.laporan_kode||''}')">Review</button> <button class="btn-icon danger" onclick="hapusTokenUsed('${tk.kode}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button></td></tr>`;
        }).join('');
        const cards=items.map(tk=>{
            const {mulai,selesai}=_tuMulaiSelesai(tk);
            return SwipeCards.buildSwipeCardHtml({
                title:tk.kode,
                sub:(tk.user_nama||tk.digunakan_oleh||'-')+' · '+(tk.modul_nama||tk.modul_kode||'-'),
                sideHtml:`<strong style="color:var(--blue);font-size:15px">${tk.skor!=null?Math.round(tk.skor):'-'}</strong>`,
                leftActions:[
                    {icon:'eye',label:'Data',cls:'act-secondary',onClick:`openTokenUsedData('${tk.kode}')`},
                    {icon:'doc',label:'Review',cls:'act-primary',onClick:`openTokenUsedReview('${tk.laporan_kode||''}')`}
                ],
                rightActions:[{icon:'trash',label:'Hapus',cls:'act-danger',onClick:`hapusTokenUsed('${tk.kode}')`}]
            });
        }).join('');
        return `<div class="section-sub" style="font-weight:700;color:var(--blue);text-transform:none;margin:18px 0 8px">${label} <span style="font-weight:500;color:var(--text-sub);font-size:11px">(${items.length} token)</span></div>
        <div class="card" style="padding:0;overflow:hidden"><div class="table-wrap aksi-swipe-wrap"><table><thead><tr><th>#</th><th>Kode Token</th><th class="hide-mobile">Modul</th><th class="hide-mobile">Digunakan Oleh</th><th class="hide-mobile">Selesai</th><th>Nilai</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table></div><div class="swipe-list">${cards}</div></div>`;
    }).join('');

    wrap.querySelectorAll('.swipe-list').forEach(el=>{ if(window.SwipeCards)SwipeCards.bindSwipeList(el); });
}
async function hapusTokenUsed(kode){showConfirm('Hapus Token','Yakin hapus data token ini? Riwayat pemakaiannya tidak lagi bisa dilihat dari sini.','danger',async()=>{await TokensAPI.delete(kode);showToast('Token dihapus','danger');await _initTokenUsed();});}
function openTokenUsedData(kode){
    const tk=_tuData.find(t=>t.kode===kode);
    if(!tk){showToast('Data token tidak ditemukan','danger');return;}
    const {mulai,selesai}=_tuMulaiSelesai(tk);
    document.getElementById('tud-kode').textContent=tk.kode;
    document.getElementById('tud-modul').textContent=tk.modul_nama||tk.modul_kode||'-';
    document.getElementById('tud-user').textContent=tk.user_nama||tk.digunakan_oleh||'-';
    document.getElementById('tud-waktu').textContent=`${mulai}  s/d  ${selesai}`;
    document.getElementById('tud-skor').textContent=tk.skor!=null?Math.round(tk.skor):'-';
    window._tudCurrentLaporanKode=tk.laporan_kode||null;
    openModal('token-used-data-overlay');
}
function _tudOpenReview(){
    closeModal('token-used-data-overlay');
    openTokenUsedReview(window._tudCurrentLaporanKode);
}
function openTokenUsedReview(laporanKode){
    if(!laporanKode){showToast('Data review tidak tersedia untuk token ini','danger');return;}
    openReviewLaporan(laporanKode);
}
// ── POPUP PILIH MODUL (search + filter kelompok) — dipakai di Buat Token ──
let _tokenModulPickerAll=[],_tokenModulPickerKelompok=[],_tokenModulPickerSearch='',_tokenModulPickerKelFilter='all',_tokenModulPickerLoaded=false;
function _tokenModulKelNama(kode){if(!kode)return null;const k=_tokenModulPickerKelompok.find(x=>x.kode===kode);return k?k.nama:null;}
async function openTokenModulPicker(){
    const si=document.getElementById('token-modul-picker-search-input');if(si)si.value='';
    _tokenModulPickerSearch='';_tokenModulPickerKelFilter='all';
    openModal('token-modul-picker-overlay');
    const listEl=document.getElementById('token-modul-picker-list');
    if(listEl)listEl.innerHTML='<p style="color:var(--text-sub);font-size:13px">Memuat modul...</p>';
    if(!_tokenModulPickerLoaded){
        const [moduls,kelompok]=await Promise.all([ModulAPI.getAll().catch(()=>[]),ModulKelompokAPI.getAll().catch(()=>[])]);
        _tokenModulPickerAll=moduls||[];_tokenModulPickerKelompok=kelompok||[];_tokenModulPickerLoaded=true;
    }
    _renderTokenModulPickerFilters();
    _renderTokenModulPickerList();
}
function _renderTokenModulPickerFilters(){
    const wrap=document.getElementById('token-modul-picker-filters');if(!wrap)return;
    const validKodes=_tokenModulPickerKelompok.map(k=>k.kode);
    if(_tokenModulPickerKelFilter!=='all'&&_tokenModulPickerKelFilter!=='none'&&!validKodes.includes(_tokenModulPickerKelFilter))_tokenModulPickerKelFilter='all';
    const options=[{value:'all',label:'Semua Kelompok'},{value:'none',label:'Tanpa Kelompok'},..._tokenModulPickerKelompok.map(k=>({value:k.kode,label:k.nama}))];
    renderFilterDropdown('token-modul-picker-filters',{title:'Kelompok',options,current:_tokenModulPickerKelFilter,onSelect:v=>{_tokenModulPickerKelFilter=v;_renderTokenModulPickerFilters();_renderTokenModulPickerList();}});
}
function _renderTokenModulPickerList(){
    const el=document.getElementById('token-modul-picker-list');if(!el)return;
    if(!_tokenModulPickerAll.length){el.innerHTML='<p style="color:var(--text-sub);font-size:13px">Belum ada modul. Buat modul dulu di menu Manajemen Modul.</p>';return;}
    let data=_tokenModulPickerAll;
    const q=(_tokenModulPickerSearch||'').toLowerCase();
    if(q)data=data.filter(m=>(m.nama||'').toLowerCase().includes(q)||(_tokenModulKelNama(m.kelompok)||'').toLowerCase().includes(q));
    if(_tokenModulPickerKelFilter==='none')data=data.filter(m=>!m.kelompok);
    else if(_tokenModulPickerKelFilter!=='all')data=data.filter(m=>m.kelompok===_tokenModulPickerKelFilter);
    el.innerHTML=data.length?data.map(m=>_buildTokenModulPickItem(m)).join(''):'<p style="color:var(--text-sub);font-size:13px">Tidak ada modul yang cocok dengan pencarian/filter.</p>';
}
function _buildTokenModulPickItem(m){
    const kode=m.kode||m.id;
    const current=document.getElementById('token-modul-sel')?.value;
    const ck=current&&String(current)===String(kode);
    const kelNama=_tokenModulKelNama(m.kelompok);
    const jmlSoal=(m.soal_list||[]).length;
    return `<div class="ebook-pick-item${ck?' checked':''}" style="cursor:pointer" onclick="selectTokenModul('${kode}')">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:13px;color:var(--blue);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.nama}</div>
        <div style="font-size:11px;color:var(--text-sub)">${kelNama||'Tanpa Kelompok'} · ${jmlSoal} soal</div>
      </div>
      ${ck?'<svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" width="18" height="18" style="flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>':''}
    </div>`;
}
function selectTokenModul(kode){
    const m=_tokenModulPickerAll.find(x=>String(x.kode||x.id)===String(kode));if(!m)return;
    const sel=document.getElementById('token-modul-sel');if(sel)sel.value=m.kode||m.id;
    const dt=document.getElementById('token-modul-display-text');if(dt){dt.textContent=m.nama;dt.style.color='var(--blue)';}
    closeModal('token-modul-picker-overlay');
}
