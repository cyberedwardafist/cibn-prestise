// admin/library.js
// Modul LIBRARY SOAL — lazy-load saat tab Library dibuka.
// Bergantung pada helper global dari js/app.js (showToast, openModal, navigateTo, dst)
// yang sudah dimuat lebih dulu lewat shell index_admin.html.

// ── LIBRARY ── (state ini dipindah dari admin/laporan.js — sebelumnya
// dideklarasikan di sana padahal cuma dipakai di sini, jadi kalau tab
// Soal/Library/Modul dibuka sebelum pernah buka tab Laporan/Token,
// identifier-nya belum exist sama sekali -> ReferenceError)
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
function _libCardHtml(s,i){const kode=s.kode||s.id;const kelNama=_soalKelompokNama(s.kelompok);const chk=_libSelected.has(kode)?'checked':'';const namaTampil=s.nama_internal?`${s.nama} <span style="font-weight:400;color:var(--text-sub)">| ${s.nama_internal}</span>`:s.nama;return `<div class="lib-card"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px"><div style="display:flex;align-items:flex-start;gap:10px;flex:1;min-width:0"><input type="checkbox" class="lib-row-check" data-kode="${kode}" ${chk} onchange="toggleLibSelect('${kode}',this.checked)" style="width:16px;height:16px;accent-color:var(--blue);cursor:pointer;margin-top:3px;flex-shrink:0"><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14px;color:var(--blue);margin-bottom:6px">${namaTampil}</div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="badge" style="background:rgba(26,90,160,0.1);color:var(--accent)">${(s.type||'').replace(/_/g,' ')}</span>${kelNama?`<span class="badge" style="background:rgba(19,50,89,0.08);color:var(--blue)">${kelNama}</span>`:''}<span style="font-size:11px;color:var(--text-sub)">${kode}</span><span style="font-size:11px;color:var(--text-sub)">${formatDate(s.created_at)}</span></div></div></div><div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap"><button class="btn btn-secondary btn-sm" onclick="previewLibSoal('${kode}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Preview</button><button class="btn btn-primary btn-sm" onclick="editSoalFromLibrary('${kode}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button><button class="btn btn-secondary btn-sm" onclick="exportLibSoalToExcel('${kode}')" title="Unduh soal ini sebagai file Excel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export</button><button class="btn-icon danger" onclick="deleteLibSoal('${kode}','${s.nama}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button></div></div></div>`;}
function _libSwipeCardHtml(s){const kode=s.kode||s.id;const sel=_libSelected.has(kode);return SwipeCards.buildSwipeCardHtml({
    title:s.nama_internal?`${s.nama} | ${s.nama_internal}`:s.nama,kode,selected:sel,
    sub:(s.type||'').replace(/_/g,' ')+(_soalKelompokNama(s.kelompok)?' · '+_soalKelompokNama(s.kelompok):'')+' · '+formatDate(s.created_at),
    leftActions:[
        {icon:'eye',label:'Lihat',cls:'act-secondary',onClick:`previewLibSoal('${kode}')`},
        {icon:'edit',label:'Edit',cls:'act-edit',onClick:`editSoalFromLibrary('${kode}')`},
        {icon:'download',label:'Export',cls:'act-secondary',onClick:`exportLibSoalToExcel('${kode}')`}
    ],
    rightActions:[{icon:'trash',label:'Hapus',cls:'act-danger',onClick:`deleteLibSoal('${kode}','${(s.nama||'').replace(/'/g,"\\'")}')`}]
});}
function _libGroupHtml(group){
    const cardsHtml=group.items.map(_libCardHtml).join('');
    const swipeHtml=group.items.map(_libSwipeCardHtml).join('');
    return `<div class="section-sub" style="font-weight:700;color:var(--blue);text-transform:none;margin:18px 0 8px">${group.label} <span style="font-weight:500;color:var(--text-sub);font-size:11px">(${group.items.length} soal)</span></div>
    <div class="aksi-swipe-wrap">${cardsHtml}</div>
    <div class="swipe-list">${swipeHtml}</div>`;
}
function _renderLibList(){
    let data=_libData;
    if(_libSearch)data=data.filter(s=>(s.nama||'').toLowerCase().includes(_libSearch.toLowerCase())||(s.type||'').toLowerCase().includes(_libSearch.toLowerCase())||(_soalKelompokNama(s.kelompok)||'').toLowerCase().includes(_libSearch.toLowerCase()));
    if(_libType!=='all')data=data.filter(s=>s.type===_libType);
    if(_libKelompokFilter==='none')data=data.filter(s=>!s.kelompok);
    else if(_libKelompokFilter!=='all')data=data.filter(s=>s.kelompok===_libKelompokFilter);
    const el=document.getElementById('library-groups');if(!el)return;
    if(!data.length){el.innerHTML='<div class="empty-state"><p>Belum ada soal di library</p></div>';_updateLibBulkBar();return;}
    // Kelompokkan per kelompok soal (pola sama seperti Token Terpakai yang dikelompokkan per hari)
    const groups={};
    data.forEach(s=>{ const k=s.kelompok||'__none__'; (groups[k]=groups[k]||[]).push(s); });
    const orderedKeys=[..._soalKelompokList.map(k=>k.kode).filter(k=>groups[k]), ...(groups.__none__?['__none__']:[])];
    const groupList=orderedKeys.map(k=>({key:k,label:k==='__none__'?'Tanpa Kelompok':_soalKelompokNama(k),items:groups[k]}));
    VirtualList.renderGroups(el,{
        items:groupList,
        estimateHeight:(g)=>40+g.items.length*96,
        renderItem:_libGroupHtml,
        emptyHtml:'<div class="empty-state"><p>Belum ada soal di library</p></div>',
        onRendered:()=>{ if(window.SwipeCards)el.querySelectorAll('.swipe-list').forEach(sw=>SwipeCards.bindSwipeList(sw,_libSelectOpts())); }
    });
    _updateLibBulkBar();
}

// ── PILIH MASSAL (Library Soal) — pola sama seperti Manajemen Akun ──
function toggleLibSelect(kode,checked){
    if(checked)_libSelected.add(kode);else _libSelected.delete(kode);
    document.querySelector(`#library-groups .swipe-card[data-kode="${kode}"] .swipe-card-body`)?.classList.toggle('selected',checked);
    _updateLibBulkBar();
}
function toggleSelectAllLib(checked){
    document.querySelectorAll('#library-groups .lib-row-check').forEach(cb=>{
        cb.checked=checked;
        if(checked)_libSelected.add(cb.dataset.kode);else _libSelected.delete(cb.dataset.kode);
    });
    document.querySelectorAll('#library-groups .swipe-card').forEach(card=>{
        const kode=card.dataset.kode;if(!kode)return;
        if(checked)_libSelected.add(kode);else _libSelected.delete(kode);
        card.querySelector('.swipe-card-body')?.classList.toggle('selected',checked);
    });
    _updateLibBulkBar();
}
function clearLibSelection(){
    _libSelected.clear();
    document.querySelectorAll('#library-groups .lib-row-check').forEach(cb=>cb.checked=false);
    document.querySelectorAll('#library-groups .swipe-card-body').forEach(b=>b.classList.remove('selected'));
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
        const rows=Array.from(document.querySelectorAll('#library-groups .lib-row-check'));
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
        const wbBlob=await _buildSoalWorkbookBlob(s);
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
    let html=`<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap"><div><div style="font-family:var(--font-head);font-size:16px;font-weight:700;color:var(--blue)">${s.nama_internal?`${s.nama} <span style="font-weight:400;color:var(--text-sub)">| ${s.nama_internal}</span>`:s.nama}</div><div style="font-size:12px;color:var(--text-sub)">${s.type} · ${s.kode||s.id}</div></div><button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="closeModal('preview-soal-overlay');editSoalFromLibrary('${kode}')">✏ Edit Soal</button></div>`;
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