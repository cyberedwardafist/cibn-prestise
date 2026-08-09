// admin/modul.js
// Modul MODUL (paket soal) — lazy-load saat tab Modul dibuka.
// Bergantung pada helper global dari js/app.js (showToast, openModal, navigateTo, dst)
// yang sudah dimuat lebih dulu lewat shell index_admin.html.

async function renderModul(){
    [_modulData,_soalForModul]=await Promise.all([ModulAPI.getAll().catch(()=>[]),SoalAPI.getAll().catch(()=>[]),_loadSoalKelompokList(),_loadModulKelompokList()]);
    _renderModulKelompokFilters();
    _renderModulList();
}
// NB: _loadModulKelompokList sebelumnya dipanggil di file ini tapi belum pernah
// didefinisikan di manapun (bug lama) — ditambahkan di sini supaya kelompok MODUL
// (beda dengan kelompok soal di Library) benar-benar termuat.
async function _loadModulKelompokList(){_modulKelompokList=await ModulKelompokAPI.getAll().catch(()=>[]);return _modulKelompokList;}
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

// ── PILIH SOAL & URUTAN TAMPIL (2 tahap: pilih -> urutkan) ──
// Tahap 1 "select": cari & centang soal dari seluruh library (dengan filter tipe & kelompok).
// Tahap 2 "order": hanya menampilkan soal yang sudah dipilih, tinggal diseret naik/turun
// (atau pakai tombol panah) untuk menentukan urutan tampil, baru "Simpan Modul".
let _modulPickerStep='select',_modulPickerSearch='',_modulPickerType='all',_modulPickerKelompokFilter='all';
let _modulOrder=[],_modulOpts={},_modulDragFrom=null;

function _modulResetPickerState(existing=[]){
    _modulOrder=[];_modulOpts={};
    _modulPickerSearch='';_modulPickerType='all';_modulPickerKelompokFilter='all';
    const si=document.getElementById('modul-picker-search-input');if(si)si.value='';
    existing.forEach(e=>{
        const sk=e.soal_kode;if(!sk)return;
        _modulOrder.push(sk);
        _modulOpts[sk]={acak_soal:!!e.acak_soal,acak_jawaban:!!e.acak_jawaban,persen:e.persen||100};
    });
}
function _modulInitPickerUI(){
    _modulPickerStep='select';
    const sb=document.getElementById('modul-picker-searchbar');if(sb)sb.style.display='';
    const hint=document.getElementById('modul-picker-hint');if(hint)hint.textContent='Cari & pilih soal yang ingin dimasukkan ke modul';
    const nb=document.getElementById('modul-next-btn');if(nb)nb.style.display='';
    const bb=document.getElementById('modul-back-btn');if(bb)bb.style.display='none';
    const sv=document.getElementById('modul-save-btn');if(sv)sv.style.display='none';
    _renderModulPickerFilters();
    _renderModulSoalPickerList();
}
function openAddModul(){document.getElementById('modul-form-mode').value='add';document.getElementById('modul-form-id').value='';document.getElementById('modul-form-title').textContent='Buat Modul Baru';document.getElementById('modul-nama-input').value='';document.getElementById('modul-nilai-min-input').value=60;_populateModulKelompokSelect('');_modulResetPickerState([]);_modulInitPickerUI();openModal('modul-form-overlay');}
function openEditModul(kode){const m=_modulData.find(x=>(x.kode||x.id)==kode);if(!m)return;document.getElementById('modul-form-mode').value='edit';document.getElementById('modul-form-id').value=kode;document.getElementById('modul-form-title').textContent='Edit Modul';document.getElementById('modul-nama-input').value=m.nama;_populateModulKelompokSelect(m.kelompok||'');_modulResetPickerState(m.soal_list||[]);_modulInitPickerUI();openModal('modul-form-overlay');}

// -- Tahap 1: daftar soal dgn search + filter tipe/kelompok (dipakai ulang dari Library) --
function _renderModulPickerFilters(){
    if(!document.getElementById('modul-picker-filters'))return;
    const validKodes=_soalKelompokList.map(k=>k.kode);
    if(_modulPickerKelompokFilter!=='all'&&_modulPickerKelompokFilter!=='none'&&!validKodes.includes(_modulPickerKelompokFilter))_modulPickerKelompokFilter='all';
    const kelompokOptions=[{value:'all',label:'Semua Kelompok'},{value:'none',label:'Tanpa Kelompok'},..._soalKelompokList.map(k=>({value:k.kode,label:k.nama}))];
    renderFilterDropdown('modul-picker-filters',{title:'Filter',groups:[
        {title:'Tipe Soal',options:_libTypeOptions,current:_modulPickerType,onSelect:v=>{_modulPickerType=v;_renderModulPickerFilters();_renderModulSoalPickerList();}},
        {title:'Kelompok',options:kelompokOptions,current:_modulPickerKelompokFilter,onSelect:v=>{_modulPickerKelompokFilter=v;_renderModulPickerFilters();_renderModulSoalPickerList();}}
    ]});
}
function _renderModulSoalPickerList(){
    const el=document.getElementById('modul-soal-picker');if(!el)return;
    if(!_soalForModul.length){el.innerHTML='<p style="color:var(--text-sub);font-size:13px">Belum ada soal di library.</p>';return;}
    let data=_soalForModul;
    const q=(_modulPickerSearch||'').toLowerCase();
    if(q)data=data.filter(s=>(s.nama||'').toLowerCase().includes(q)||(s.type||'').toLowerCase().includes(q)||(_soalKelompokNama(s.kelompok)||'').toLowerCase().includes(q));
    if(_modulPickerType!=='all')data=data.filter(s=>s.type===_modulPickerType);
    if(_modulPickerKelompokFilter==='none')data=data.filter(s=>!s.kelompok);
    else if(_modulPickerKelompokFilter!=='all')data=data.filter(s=>s.kelompok===_modulPickerKelompokFilter);
    el.innerHTML=data.length?data.map(s=>_buildModulPickCard(s)).join(''):'<p style="color:var(--text-sub);font-size:13px">Tidak ada soal yang cocok dengan pencarian/filter.</p>';
}
function _buildModulPickCard(s){
    const kode=s.kode||s.id,ck=_modulOrder.includes(kode),opt=_modulOpts[kode]||{},kelNama=_soalKelompokNama(s.kelompok);
    return `<div style="padding:12px;background:rgba(19,50,89,0.03);border-radius:12px;border:1.5px solid ${ck?'var(--accent)':'rgba(19,50,89,0.08)'};margin-bottom:8px;transition:border-color 0.2s" id="mpick-${kode}"><label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer"><input type="checkbox" data-soal-kode="${kode}" ${ck?'checked':''} onchange="toggleModulSoal('${kode}',this.checked)" style="margin-top:3px;accent-color:var(--blue);width:16px;height:16px;flex-shrink:0"><div style="flex:1"><div style="font-weight:700;font-size:13px;color:var(--blue)">${s.nama}</div><div style="font-size:11px;color:var(--text-sub);display:flex;gap:6px;flex-wrap:wrap"><span>${(s.type||'').replace(/_/g,' ')}</span>${kelNama?`<span>· ${kelNama}</span>`:''}</div></div></label><div id="mopts-${kode}" style="display:${ck?'block':'none'};margin-top:10px;padding:10px;background:rgba(255,255,255,0.7);border-radius:10px">${_buildModulOptsInner(s,kode,opt)}</div></div>`;
}
function _buildModulOptsInner(s,kode,opt){
    if(s.type==='sikap_kerja')return'<p style="font-size:12px;color:var(--text-sub)">Sikap kerja: laporan grafik terpisah.</p>';
    return `<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:8px"><label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" ${opt.acak_soal?'checked':''} onchange="_updateModulOpt('${kode}','acak_soal',this.checked)" style="accent-color:var(--blue)"> Acak Soal</label><label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" ${opt.acak_jawaban?'checked':''} onchange="_updateModulOpt('${kode}','acak_jawaban',this.checked)" style="accent-color:var(--blue)"> Acak Jawaban</label></div><label style="font-size:12px;color:var(--text-sub)">Bobot (%): <input type="number" value="${opt.persen??100}" min="0" max="100" class="form-input" style="width:80px;display:inline;padding:4px 8px;font-size:13px" oninput="_updateModulOpt('${kode}','persen',parseInt(this.value)||0)"></label>`;
}
function toggleModulSoal(kode,ck){
    if(ck){if(!_modulOrder.includes(kode))_modulOrder.push(kode);if(!_modulOpts[kode])_modulOpts[kode]={acak_soal:false,acak_jawaban:false,persen:100};}
    else{_modulOrder=_modulOrder.filter(k=>k!==kode);}
    const e=document.getElementById(`mopts-${kode}`),c=document.getElementById(`mpick-${kode}`);
    if(e)e.style.display=ck?'block':'none';
    if(c)c.style.borderColor=ck?'var(--accent)':'rgba(19,50,89,0.08)';
}
function _updateModulOpt(kode,prop,val){if(!_modulOpts[kode])_modulOpts[kode]={acak_soal:false,acak_jawaban:false,persen:100};_modulOpts[kode][prop]=val;}

// -- Tahap 2: hanya soal terpilih, urutkan dgn drag naik/turun atau tombol panah --
function _modulGoToOrderStep(){
    if(!_modulOrder.length){showToast('Pilih minimal 1 soal','danger');return;}
    _modulPickerStep='order';
    const sb=document.getElementById('modul-picker-searchbar');if(sb)sb.style.display='none';
    const hint=document.getElementById('modul-picker-hint');if(hint)hint.textContent='Seret ke atas/bawah, atau pakai tombol panah untuk atur urutan tampil';
    document.getElementById('modul-next-btn').style.display='none';
    document.getElementById('modul-back-btn').style.display='';
    document.getElementById('modul-save-btn').style.display='';
    _renderModulOrderList();
}
function _modulGoToSelectStep(){_modulInitPickerUI();}
function _renderModulOrderList(){
    const el=document.getElementById('modul-soal-picker');if(!el)return;
    if(!_modulOrder.length){el.innerHTML='<p style="color:var(--text-sub);font-size:13px">Belum ada soal dipilih. Klik "Kembali" untuk memilih soal.</p>';return;}
    el.innerHTML=_modulOrder.map((kode,idx)=>_buildModulOrderCard(kode,idx)).join('');
}
function _buildModulOrderCard(kode,idx){
    const s=_soalForModul.find(x=>(x.kode||x.id)===kode);if(!s)return'';
    const opt=_modulOpts[kode]||{},last=_modulOrder.length-1;
    return `<div class="modul-order-item" draggable="true" ondragstart="_modulDragStart(event,'${kode}')" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="event.preventDefault();this.classList.remove('drag-over');_modulDrop(event,'${kode}')" style="padding:12px;background:rgba(19,50,89,0.03);border-radius:12px;border:1.5px solid var(--accent);margin-bottom:8px" id="mord-${kode}">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="cursor:grab;color:var(--text-sub);flex-shrink:0" title="Seret untuk urutkan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></span>
        <span style="font-weight:700;font-size:12px;color:var(--accent);width:22px;text-align:center;flex-shrink:0">${idx+1}</span>
        <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px;color:var(--blue)">${s.nama}</div><div style="font-size:11px;color:var(--text-sub)">${(s.type||'').replace(/_/g,' ')}</div></div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="btn-icon" title="Naik" ${idx===0?'disabled style="opacity:.35;cursor:not-allowed"':''} onclick="_modulMove('${kode}',-1)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg></button>
          <button class="btn-icon" title="Turun" ${idx===last?'disabled style="opacity:.35;cursor:not-allowed"':''} onclick="_modulMove('${kode}',1)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg></button>
          <button class="btn-icon danger" title="Batalkan pilihan" onclick="_modulRemoveSelected('${kode}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      </div>
      <div style="margin-top:10px;padding:10px;background:rgba(255,255,255,0.7);border-radius:10px">${_buildModulOptsInner(s,kode,opt)}</div>
    </div>`;
}
function _modulMove(kode,dir){
    const idx=_modulOrder.indexOf(kode);if(idx<0)return;
    const ni=idx+dir;if(ni<0||ni>=_modulOrder.length)return;
    [_modulOrder[idx],_modulOrder[ni]]=[_modulOrder[ni],_modulOrder[idx]];
    _renderModulOrderList();
}
function _modulRemoveSelected(kode){_modulOrder=_modulOrder.filter(k=>k!==kode);_renderModulOrderList();}
function _modulDragStart(e,kode){_modulDragFrom=kode;e.dataTransfer.effectAllowed='move';}
function _modulDrop(e,kode){
    if(_modulDragFrom===null||_modulDragFrom===kode){_modulDragFrom=null;return;}
    const fromIdx=_modulOrder.indexOf(_modulDragFrom),toIdx=_modulOrder.indexOf(kode);
    _modulDragFrom=null;
    if(fromIdx<0||toIdx<0)return;
    const moved=_modulOrder.splice(fromIdx,1)[0];
    _modulOrder.splice(toIdx,0,moved);
    _renderModulOrderList();
}

async function submitModulForm(){
    const mode=document.getElementById('modul-form-mode').value,kode=document.getElementById('modul-form-id').value;
    const nama=document.getElementById('modul-nama-input').value.trim();if(!nama){showToast('Nama modul wajib','danger');return;}
    const kelompok=document.getElementById('modul-kelompok-select')?.value||'';
    if(!_modulOrder.length){showToast('Pilih minimal 1 soal','danger');return;}
    const soal_list=_modulOrder.map(sk=>{const o=_modulOpts[sk]||{};return{soal_kode:sk,acak_soal:!!o.acak_soal,acak_jawaban:!!o.acak_jawaban,persen:o.persen||100};});
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
