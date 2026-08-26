/* =============================================
   SOAL.JS v2 - Question Builder (Fixed)
   ============================================= */

const SoalState = {
    mode: 'setup', kode: null, editMode: false,
    nama: '', nama_internal: '', type: 'multiple_choice', skor_type: 'benar_salah',
    opsi_jawaban: 1, timer: { jam: 0, menit: 30, detik: 0 },
    kelompok: '',   // kelompok = kode referensi ke soal_kelompok ('' = tanpa kelompok)
    pertanyaan: [], kolom: null, currentIdx: 0, navOpen: true,
    _editors: {},
};

// Daftar kelompok soal yg sudah pernah di-fetch (dipakai bareng oleh setup form, edit info, & library)
let _soalKelompokList = [];
async function _loadSoalKelompokList() {
    _soalKelompokList = await SoalKelompokAPI.getAll().catch(() => []);
    return _soalKelompokList;
}
function _soalKelompokNama(kode) {
    if (!kode) return null;
    const k = _soalKelompokList.find(x => x.kode === kode);
    return k ? k.nama : null;
}

/* ── DRAFT AUTO-SAVE — builder soal (Buat/Edit Soal) ──
   Supaya kerjaan yang sedang diketik TIDAK hilang kalau halaman ke-refresh/Ctrl+Shift+R.
   Disimpan ke localStorage tiap ada perubahan (debounce ringan), dipulihkan otomatis
   SEKALI saat aplikasi baru dimuat (bukan tiap kali pindah ke halaman soal dalam sesi
   yang sama — supaya "Batal" tetap terasa seperti membatalkan, bukan draf balik lagi). */
let _soalDraftTimer = null;
let _soalDraftRestoreChecked = false;
function _soalDraftSave() {
    if (SoalState.mode !== 'build') return;
    try {
        localStorage.setItem('cbn_soal_draft', JSON.stringify({
            kode: SoalState.kode, editMode: SoalState.editMode,
            nama: SoalState.nama, nama_internal: SoalState.nama_internal, type: SoalState.type, skor_type: SoalState.skor_type,
            opsi_jawaban: SoalState.opsi_jawaban, timer: SoalState.timer,
            pertanyaan: SoalState.pertanyaan, kolom: SoalState.kolom, currentIdx: SoalState.currentIdx,
            _sikapView: (typeof _sikapView !== 'undefined') ? _sikapView : 'list',
            _sikapKolIdx: (typeof _sikapKolIdx !== 'undefined') ? _sikapKolIdx : 0,
        }));
    } catch(e) {}
}
function _soalQueueAutoSave() { clearTimeout(_soalDraftTimer); _soalDraftTimer = setTimeout(_soalDraftSave, 500); }
function _soalDraftClear() { clearTimeout(_soalDraftTimer); try { localStorage.removeItem('cbn_soal_draft'); } catch(e) {} }

function _tryRestoreSoalDraft() {
    let raw;
    try { raw = localStorage.getItem('cbn_soal_draft'); } catch(e) { return false; }
    if (!raw) return false;
    let d;
    try { d = JSON.parse(raw); } catch(e) { return false; }
    if (!d || !d.nama || (!d.pertanyaan?.length && !d.kolom?.length)) return false;

    SoalState.kode = d.kode || null; SoalState.editMode = !!d.editMode;
    SoalState.nama = d.nama; SoalState.nama_internal = d.nama_internal || ''; SoalState.type = d.type; SoalState.skor_type = d.skor_type;
    SoalState.opsi_jawaban = d.opsi_jawaban; SoalState.timer = d.timer || { jam:0, menit:30, detik:0 };
    SoalState.pertanyaan = d.pertanyaan || []; SoalState.kolom = d.kolom || null;
    SoalState.currentIdx = d.currentIdx || 0; SoalState._editors = {}; SoalState.mode = 'build';
    if (typeof d._sikapView === 'string') _sikapView = d._sikapView;
    if (typeof d._sikapKolIdx === 'number') _sikapKolIdx = d._sikapKolIdx;

    setDirty(SoalState.editMode ? 'edit soal' : 'pembuatan soal');
    showToast('Draf soal yang belum tersimpan berhasil dipulihkan ✓', 'success');
    if (SoalState.type === 'sikap_kerja') {
        if (_sikapView === 'detail') _renderSikapDetail(_sikapKolIdx); else _renderSikapList();
    } else {
        _renderMCHtml();
    }
    return true;
}

function renderSoal() {
    if (!_soalDraftRestoreChecked) {
        _soalDraftRestoreChecked = true;
        if (_tryRestoreSoalDraft()) return;
    }
    SoalState.mode = 'setup'; SoalState.kode = null;
    SoalState.editMode = false; SoalState._editors = {}; SoalState.kelompok = '';
    showSoalSetup();
}

async function _populateSoalKelompokSelect() {
    const sel = document.getElementById('soal-kelompok-select'); if (!sel) return;
    await _loadSoalKelompokList();
    sel.innerHTML = '<option value="">-- Tanpa Kelompok --</option>' +
        _soalKelompokList.map(k => `<option value="${k.kode}">${k.nama}</option>`).join('');
    sel.value = SoalState.kelompok || '';
}

function showSoalSetup() {
    // Layar setup ini form full-width juga (bukan cuma builder) — kasih dock-avoid
    // supaya kotaknya ikut bergeser/menyempit menjauhi slide dock di layar sempit,
    // sama seperti perilaku Library/Modul/Laporan/Review (bukan disembunyikan).
    document.body.classList.remove('soal-building');
    const pg = document.getElementById('page-soal');
    if (pg) pg.classList.add('dock-avoid-center');
    const c = document.getElementById('soal-page-content');
    if (!c) return;
    c.style.opacity = '0'; c.style.transform = 'translateY(16px)';
    c.innerHTML = `
<div class="section-title">Buat Soal</div>
<div class="section-sub">Buat soal baru untuk ditambahkan ke library</div>
<div class="card" style="max-width:560px;margin:0 auto 14px">
  <div style="font-weight:700;font-size:13px;margin-bottom:10px">⚡ Cara Cepat: Upload File Soal</div>
  <button class="btn btn-primary" style="width:100%;padding:12px" onclick="triggerUploadSoal()">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
    Upload Soal
  </button>
  <div style="text-align:center;margin-top:8px">
    <span onclick="openModal('template-soal-overlay')" style="font-size:12px;color:var(--accent);font-weight:600;cursor:pointer;text-decoration:underline">Unduh Template</span>
  </div>
  <input type="file" id="upload-soal-file" accept=".xlsx,.xls" style="display:none" onchange="onUploadSoalFile(this)">
</div>
<div style="text-align:center;color:var(--text-sub);font-size:11px;margin:-4px 0 14px">— atau isi manual di bawah —</div>
<div class="card" style="max-width:560px;margin:0 auto">
  <div class="form-group">
    <label class="form-label">Nama Soal</label>
    <input id="soal-nama" class="form-input" type="text" placeholder="Contoh: Tes Pengetahuan Umum" oninput="setDirty('pembuatan soal')">
  </div>
  <div class="form-group">
    <label class="form-label">Nama Internal <span style="font-weight:400;color:var(--text-sub)">(opsional, hanya terlihat di admin)</span></label>
    <input id="soal-nama-internal" class="form-input" type="text" placeholder="Contoh: Versi A - revisi Juli" oninput="setDirty('pembuatan soal')">
  </div>
  <div class="form-group">
    <label class="form-label">Kelompok <span style="font-weight:400;color:var(--text-sub)">(opsional)</span></label>
    <select id="soal-kelompok-select" class="form-input" onchange="SoalState.kelompok=this.value;setDirty('pembuatan soal')"><option value="">-- Tanpa Kelompok --</option></select>
  </div>
  <div class="form-group">
    <label class="form-label">Tipe Soal</label>
    <select id="soal-type" class="form-select" onchange="onSoalTypeChange()">
      <option value="multiple_choice">Multiple Choice</option>
      <option value="linier">Linier (tidak bisa kembali)</option>
      <option value="sikap_kerja">Sikap Kerja</option>
    </select>
  </div>
  <div id="soal-skor-wrap">
    <div class="form-group">
      <label class="form-label">Sistem Penilaian</label>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <label style="flex:1;min-width:130px;display:flex;align-items:flex-start;gap:8px;padding:12px;border:1.5px solid rgba(19,50,89,0.12);border-radius:12px;cursor:pointer;background:rgba(255,255,255,0.6)">
          <input type="radio" name="skor_type" value="benar_salah" checked onchange="onSkorTypeChange()" style="margin-top:2px;accent-color:var(--blue)">
          <div><div style="font-weight:700;font-size:13px">Benar / Salah</div><div style="font-size:11px;color:var(--text-sub)">Ada kunci jawaban</div></div>
        </label>
        <label style="flex:1;min-width:130px;display:flex;align-items:flex-start;gap:8px;padding:12px;border:1.5px solid rgba(19,50,89,0.12);border-radius:12px;cursor:pointer;background:rgba(255,255,255,0.6)">
          <input type="radio" name="skor_type" value="nilai_sendiri" onchange="onSkorTypeChange()" style="margin-top:2px;accent-color:var(--blue)">
          <div><div style="font-weight:700;font-size:13px">Nilai per Jawaban</div><div style="font-size:11px;color:var(--text-sub)">Tiap pilihan punya skor</div></div>
        </label>
      </div>
    </div>
    <div id="soal-opsi-wrap" style="display:none">
      <div class="form-group">
        <label class="form-label">Jumlah Jawaban yang Boleh Dipilih Peserta</label>
        <input id="soal-opsi-jawaban" class="form-input" type="number" value="1" min="1" style="max-width:120px">
      </div>
    </div>
  </div>
  <div class="form-group">
    <label class="form-label">Timer Pengerjaan</label>
    <div style="display:flex;gap:10px;align-items:center">
      <div style="text-align:center;flex:1"><input id="soal-jam" class="form-input" type="number" value="0" min="0" max="23" style="text-align:center"><div style="font-size:10px;color:var(--text-sub);margin-top:3px;font-weight:600">JAM</div></div>
      <span style="color:var(--text-sub);font-weight:700;font-size:18px;margin-bottom:18px">:</span>
      <div style="text-align:center;flex:1"><input id="soal-menit" class="form-input" type="number" value="30" min="0" max="59" style="text-align:center"><div style="font-size:10px;color:var(--text-sub);margin-top:3px;font-weight:600">MENIT</div></div>
      <span style="color:var(--text-sub);font-weight:700;font-size:18px;margin-bottom:18px">:</span>
      <div style="text-align:center;flex:1"><input id="soal-detik" class="form-input" type="number" value="0" min="0" max="59" style="text-align:center"><div style="font-size:10px;color:var(--text-sub);margin-top:3px;font-weight:600">DETIK</div></div>
    </div>
  </div>
  <button class="btn btn-primary" style="width:100%;padding:13px" onclick="startBuatSoal()">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    Mulai Buat Soal
  </button>
</div>`;
    _populateSoalKelompokSelect();
    requestAnimationFrame(() => {
        c.style.transition = 'opacity 0.35s cubic-bezier(.4,0,.2,1), transform 0.35s cubic-bezier(.4,0,.2,1)';
        c.style.opacity = '1'; c.style.transform = 'translateY(0)';
    });
}

function onSoalTypeChange() {
    const t = document.getElementById('soal-type')?.value;
    const w = document.getElementById('soal-skor-wrap');
    if (w) w.style.display = t === 'sikap_kerja' ? 'none' : 'block';
}
function onSkorTypeChange() {
    const v = document.querySelector('input[name="skor_type"]:checked')?.value;
    const w = document.getElementById('soal-opsi-wrap');
    if (w) w.style.display = v === 'nilai_sendiri' ? 'block' : 'none';
}

function startBuatSoal() {
    const nama = document.getElementById('soal-nama')?.value?.trim();
    if (!nama) { showToast('Nama soal wajib diisi', 'danger'); return; }
    SoalState.nama = nama;
    SoalState.nama_internal = document.getElementById('soal-nama-internal')?.value?.trim() || '';
    SoalState.kelompok = document.getElementById('soal-kelompok-select')?.value || '';
    SoalState.type = document.getElementById('soal-type').value;
    SoalState.skor_type = document.querySelector('input[name="skor_type"]:checked')?.value || 'benar_salah';
    SoalState.opsi_jawaban = parseInt(document.getElementById('soal-opsi-jawaban')?.value) || 1;
    SoalState.timer = { jam: parseInt(document.getElementById('soal-jam')?.value)||0, menit: parseInt(document.getElementById('soal-menit')?.value)||30, detik: parseInt(document.getElementById('soal-detik')?.value)||0 };
    SoalState.mode = 'build'; SoalState._editors = {};
    if (SoalState.type === 'sikap_kerja') {
        SoalState.kolom = Array.from({length:10},(_,i)=>({id:`KOL${String(i+1).padStart(2,'0')}`,no:i+1,items:Array.from({length:5},(_,j)=>({id:`I${i}${j}`,nilai:''})),soal:[]}));
        SoalState.pertanyaan = [];
    } else {
        SoalState.pertanyaan = [_newQ()]; SoalState.currentIdx = 0; SoalState.kolom = null;
    }
    setDirty('pembuatan soal');
    _animateTo(() => SoalState.type === 'sikap_kerja' ? _renderSikapList() : _renderMCHtml());
}

function _newQ() {
    return { id:'Q_'+Date.now()+'_'+Math.random().toString(36).slice(2,6), soal:'', jawaban:[{id:'A_'+Date.now(),teks:'',nilai:0},{id:'B_'+(Date.now()+1),teks:'',nilai:0}], kunci:[], pembahasan:'' };
}

function cancelBuild() {
    if (AppState.isDirty) {
        showConfirm('Batalkan Pembuatan Soal','Yakin batalkan? Data yang belum disimpan akan hilang.','warning',()=>{
            clearDirty(); _soalDraftClear(); SoalState._editors={}; SoalState.mode='setup'; showSoalSetup();
        });
    } else { clearDirty(); _soalDraftClear(); SoalState._editors={}; SoalState.mode='setup'; showSoalSetup(); }
}

function _animateTo(fn) {
    const c = document.getElementById('soal-page-content');
    if (!c) { fn(); return; }
    c.style.transition='opacity 0.22s ease,transform 0.22s ease';
    c.style.opacity='0'; c.style.transform='translateY(12px)';
    setTimeout(()=>{ fn(); requestAnimationFrame(()=>{ c.style.opacity='1'; c.style.transform='translateY(0)'; }); }, 220);
}

// ══════════════ MC BUILD ══════════════
function _renderMCHtml() {
    document.getElementById('page-soal')?.classList.remove('dock-avoid-center');
    document.body.classList.add('soal-building');
    _soalDraftSave();
    const c = document.getElementById('soal-page-content');
    if (!c) return;
    const q = SoalState.pertanyaan[SoalState.currentIdx];
    const isNilai = SoalState.skor_type === 'nilai_sendiri';
    const total = SoalState.pertanyaan.length;

    c.innerHTML = `
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:10px;flex-wrap:wrap">
  <div>
    <div class="section-title" style="margin-bottom:2px">${SoalState.nama}</div>
    <div class="section-sub" style="margin-bottom:0">${SoalState.type==='linier'?'Linier':'Multiple Choice'} · Soal ${SoalState.currentIdx+1}/${total}</div>
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn btn-secondary btn-sm" onclick="cancelBuild()">← Batal</button>
    <button class="btn btn-secondary btn-sm" onclick="openEditSoalInfoModal()">✏ Edit Info</button>
    <button class="btn btn-secondary btn-sm" onclick="showPreview()">👁 Preview</button>
    <button class="btn btn-secondary btn-sm" onclick="exportCurrentSoalToExcel()" title="Unduh soal ini sebagai file Excel">⬇ Export</button>
    <button class="btn btn-primary btn-sm" onclick="simpanSoal()">💾 Simpan</button>
  </div>
</div>
<div style="display:flex;gap:16px;align-items:flex-start">
  <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:14px">
    <div class="card" style="padding:16px">
      <div class="form-label" style="margin-bottom:8px">Pertanyaan</div>
      <div id="editor-soal-wrap"></div>
    </div>
    <div class="card" style="padding:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div class="form-label" style="margin:0">Pilihan Jawaban ${isNilai?'<span style="font-size:10px;color:var(--text-sub);font-weight:400">(isi skor tiap pilihan)</span>':'<span style="font-size:10px;color:var(--text-sub);font-weight:400">(✓ = kunci jawaban)</span>'}</div>
        <button class="btn btn-secondary btn-sm" onclick="tambahJawaban()">+ Jawaban</button>
      </div>
      <div id="jawaban-list" style="display:flex;flex-direction:column;gap:10px">
        ${q.jawaban.map((j,i)=>_jawabanItemHTML(j,i,isNilai,q.kunci)).join('')}
      </div>
    </div>
    <div class="card" style="padding:16px">
      <div class="form-label" style="margin-bottom:8px">Pembahasan <span style="font-size:10px;color:var(--text-sub);font-weight:400">(opsional)</span></div>
      <div id="editor-pembahasan-wrap"></div>
    </div>
  </div>
  <div class="soal-nav-side" id="soal-nav-side">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <span style="font-size:11px;font-weight:700;color:var(--text-sub);text-transform:uppercase;letter-spacing:0.06em">Soal</span>
      <button class="btn-icon" onclick="toggleNavSide()" style="width:24px;height:24px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px">
      ${SoalState.pertanyaan.map((p,i)=>`
        <div style="position:relative">
          <button class="soal-nav-btn ${i===SoalState.currentIdx?'active':(p.soal?'filled':'')}" onclick="goToSoal(${i})" draggable="true" ondragstart="dragStart(event,${i})" ondragover="event.preventDefault()" ondrop="dropSoal(event,${i})">${i+1}</button>
          <button onclick="hapusSoalNav(${i})" class="soal-nav-del">×</button>
        </div>`).join('')}
    </div>
    <button class="btn btn-secondary btn-sm" style="width:100%;margin-bottom:10px" onclick="tambahSoalBaru()">+ Soal Baru</button>
    <div style="display:flex;gap:6px">
      <button class="btn btn-secondary btn-sm" style="flex:1" onclick="goToSoal(${SoalState.currentIdx-1})" ${SoalState.currentIdx===0?'disabled':''}>← Prev</button>
      <button class="btn btn-secondary btn-sm" style="flex:1" onclick="goToSoal(${SoalState.currentIdx+1})" ${SoalState.currentIdx>=total-1?'disabled':''}>Next →</button>
    </div>
  </div>
</div>`;
    setTimeout(_initMCEditors, 60);
}

function _jawabanItemHTML(j, i, isNilai, kunci) {
    const isK = kunci && kunci.includes(j.id);
    return `<div class="jawaban-item" id="ji-${j.id}" style="display:flex;align-items:flex-start;gap:10px;padding:10px;background:rgba(19,50,89,0.03);border-radius:10px;border:1.5px solid ${isK?'var(--success)':'transparent'};transition:border-color 0.2s">
      ${!isNilai?`<input type="checkbox" ${isK?'checked':''} onchange="toggleKunci('${j.id}',this.checked)" style="margin-top:4px;accent-color:var(--success);width:16px;height:16px;flex-shrink:0;cursor:pointer">`
      :`<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0;margin-top:2px"><span style="font-size:9px;color:var(--text-sub);font-weight:600">SKOR</span><input type="number" value="${j.nilai||0}" onchange="updateNilaiJawaban('${j.id}',this.value)" style="width:52px;text-align:center;padding:4px 6px;border:1.5px solid rgba(19,50,89,0.12);border-radius:8px;font-size:13px;font-weight:700;background:white;outline:none;color:var(--blue)"></div>`}
      <div style="flex:1;min-width:0"><div id="editor-jawaban-${j.id}-wrap"></div></div>
      <div style="display:flex;flex-direction:column;gap:4px;align-items:center;flex-shrink:0">
        <span style="font-size:11px;font-weight:700;color:var(--text-sub)">${String.fromCharCode(65+i)}</span>
        ${i>=2?`<button class="btn-icon danger" onclick="hapusJawaban('${j.id}')" style="width:24px;height:24px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`:'<div style="width:24px;height:24px"></div>'}
      </div>
    </div>`;
}

function _initMCEditors() {
    const q = SoalState.pertanyaan[SoalState.currentIdx];
    if (!q) return;
    const soalWrap = document.getElementById('editor-soal-wrap');
    if (soalWrap) {
        const ed = new RichEditor(soalWrap,{placeholder:'Tulis pertanyaan di sini...',minHeight:100,uploadFn:typeof apiUploadImage!=='undefined'?apiUploadImage:null,onchange:html=>{q.soal=html;_soalQueueAutoSave();}});
        ed.setHTML(q.soal||''); SoalState._editors['soal']=ed;
    }
    const pembWrap = document.getElementById('editor-pembahasan-wrap');
    if (pembWrap) {
        const ed = new RichEditor(pembWrap,{placeholder:'Tulis pembahasan...',minHeight:80,uploadFn:typeof apiUploadImage!=='undefined'?apiUploadImage:null,onchange:html=>{q.pembahasan=html;_soalQueueAutoSave();}});
        ed.setHTML(q.pembahasan||''); SoalState._editors['pembahasan']=ed;
    }
    q.jawaban.forEach(j=>_initJawabanEditor(j,q));
}

function _initJawabanEditor(j,q) {
    const wrap = document.getElementById(`editor-jawaban-${j.id}-wrap`);
    if (!wrap) return;
    if (wrap._editorInit) return;
    wrap._editorInit = true;
    const ed = new RichEditor(wrap,{placeholder:'Teks pilihan jawaban...',minHeight:44,uploadFn:typeof apiUploadImage!=='undefined'?apiUploadImage:null,onchange:html=>{j.teks=html;_soalQueueAutoSave();}});
    ed.setHTML(j.teks||''); SoalState._editors[`jawaban_${j.id}`]=ed;
}

function syncEditors() {
    const q = SoalState.pertanyaan[SoalState.currentIdx];
    if (!q) return;
    Object.entries(SoalState._editors).forEach(([k,ed])=>{
        if (k==='soal') q.soal=ed.getHTML();
        else if (k==='pembahasan') q.pembahasan=ed.getHTML();
        else if (k.startsWith('jawaban_')) { const jaw=q.jawaban.find(j=>j.id===k.replace('jawaban_','')); if(jaw) jaw.teks=ed.getHTML(); }
    });
}

function goToSoal(idx) {
    if (idx<0||idx>=SoalState.pertanyaan.length) return;
    syncEditors(); SoalState.currentIdx=idx; SoalState._editors={};
    _animateTo(_renderMCHtml);
}
function tambahJawaban() {
    syncEditors();
    const q=SoalState.pertanyaan[SoalState.currentIdx]; if(!q) return;
    const nj={id:'J_'+Date.now(),teks:'',nilai:0}; q.jawaban.push(nj);
    const list=document.getElementById('jawaban-list');
    if(list){ const isNilai=SoalState.skor_type==='nilai_sendiri'; const div=document.createElement('div'); div.innerHTML=_jawabanItemHTML(nj,q.jawaban.length-1,isNilai,q.kunci); const el=div.firstElementChild; el.style.opacity='0'; el.style.transform='translateY(8px)'; list.appendChild(el); setTimeout(()=>{el.style.transition='all 0.25s ease';el.style.opacity='1';el.style.transform='translateY(0)';_initJawabanEditor(nj,q);},30); }
    _soalQueueAutoSave();
}
function hapusJawaban(jid) {
    const q=SoalState.pertanyaan[SoalState.currentIdx];
    if(!q||q.jawaban.length<=2){showToast('Minimal 2 pilihan jawaban','danger');return;}
    q.jawaban=q.jawaban.filter(j=>j.id!==jid); q.kunci=q.kunci.filter(k=>k!==jid);
    delete SoalState._editors[`jawaban_${jid}`];
    const el=document.getElementById(`ji-${jid}`);
    if(el){el.style.transition='all 0.2s ease';el.style.opacity='0';el.style.transform='translateX(16px)';setTimeout(()=>el.remove(),200);}
    _soalQueueAutoSave();
}
function toggleKunci(jid,checked) {
    const q=SoalState.pertanyaan[SoalState.currentIdx]; if(!q) return;
    if(checked){if(!q.kunci.includes(jid))q.kunci.push(jid);}else{q.kunci=q.kunci.filter(k=>k!==jid);}
    const item=document.getElementById(`ji-${jid}`); if(item) item.style.borderColor=checked?'var(--success)':'transparent';
    _soalQueueAutoSave();
}
function updateNilaiJawaban(jid,val) {
    const q=SoalState.pertanyaan[SoalState.currentIdx]; if(!q) return;
    const j=q.jawaban.find(j=>j.id===jid); if(j) j.nilai=parseFloat(val)||0;
    _soalQueueAutoSave();
}
function tambahSoalBaru() {
    syncEditors(); SoalState.pertanyaan.push(_newQ()); SoalState.currentIdx=SoalState.pertanyaan.length-1; SoalState._editors={};
    _animateTo(_renderMCHtml);
}
let _dragFrom=null;
function dragStart(e,idx){_dragFrom=idx;e.dataTransfer.effectAllowed='move';}
function dropSoal(e,idx){
    e.preventDefault(); if(_dragFrom===null||_dragFrom===idx)return;
    showConfirm('Pindah Soal',`Pindahkan soal ${_dragFrom+1} ke posisi ${idx+1}?`,'warning',()=>{
        syncEditors(); const it=SoalState.pertanyaan.splice(_dragFrom,1)[0]; SoalState.pertanyaan.splice(idx,0,it);
        SoalState.currentIdx=idx; SoalState._editors={}; _dragFrom=null; _animateTo(_renderMCHtml);
    }); _dragFrom=null;
}
function hapusSoalNav(idx) {
    if(SoalState.pertanyaan.length<=1){showToast('Minimal 1 soal','danger');return;}
    showConfirm('Hapus Soal',`Hapus soal nomor ${idx+1}?`,'danger',()=>{
        syncEditors(); SoalState.pertanyaan.splice(idx,1);
        if(SoalState.currentIdx>=SoalState.pertanyaan.length)SoalState.currentIdx=SoalState.pertanyaan.length-1;
        SoalState._editors={}; _animateTo(_renderMCHtml);
    });
}
function toggleNavSide(){
    const nav=document.getElementById('soal-nav-side'); if(!nav) return;
    SoalState.navOpen=!SoalState.navOpen;
    nav.style.transition='all 0.3s cubic-bezier(.4,0,.2,1)';
    nav.style.opacity=SoalState.navOpen?'1':'0'; nav.style.transform=SoalState.navOpen?'translateX(0)':'translateX(20px)';
    setTimeout(()=>{if(!SoalState.navOpen)nav.style.display='none';},300);
}

// ══════════════ SIKAP KERJA ══════════════
let _sikapView='list'; let _sikapKolIdx=0; let _editingItem=null;

function _renderSikapList(){
    document.getElementById('page-soal')?.classList.remove('dock-avoid-center');
    document.body.classList.add('soal-building');
    _soalDraftSave();
    const c=document.getElementById('soal-page-content'); if(!c) return;
    c.innerHTML=`
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
  <div><div class="section-title" style="margin-bottom:2px">${SoalState.nama}</div><div class="section-sub" style="margin-bottom:0">Sikap Kerja — 10 Kolom</div></div>
  <div style="display:flex;gap:8px"><button class="btn btn-secondary btn-sm" onclick="cancelBuild()">← Batal</button><button class="btn btn-secondary btn-sm" onclick="openEditSoalInfoModal()">✏ Edit Info</button><button class="btn btn-secondary btn-sm" onclick="exportCurrentSoalToExcel()" title="Unduh soal ini sebagai file Excel">⬇ Export</button><button class="btn btn-primary btn-sm" onclick="simpanSoal()">💾 Simpan ke Library</button></div>
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px">
  ${SoalState.kolom.map((k,i)=>`
    <div class="kolom-card" onclick="openKolom(${i})" style="animation:fadeUp 0.3s ${i*0.04}s both">
      <div style="font-size:11px;font-weight:700;color:var(--text-sub);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Kolom ${k.no}</div>
      <div style="font-family:var(--font-head);font-size:22px;font-weight:800;color:var(--blue);margin-bottom:8px">${k.soal.length}<span style="font-size:12px;font-weight:500;color:var(--text-sub)"> soal</span></div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">
        ${k.items.map(it=>`<div style="width:28px;height:28px;border-radius:6px;background:rgba(19,50,89,0.06);display:flex;align-items:center;justify-content:center;font-size:13px;overflow:hidden">${it.nilai?(it.nilai.startsWith('data:')||it.nilai.startsWith('/'))?`<img src="${it.nilai}" style="width:24px;height:24px;object-fit:cover;border-radius:4px">`:it.nilai:'<span style="color:rgba(19,50,89,0.2)">?</span>'}</div>`).join('')}
      </div>
      <div style="font-size:11px;color:var(--accent);font-weight:600">Edit →</div>
    </div>`).join('')}
</div>`;
}

function openKolom(idx){_sikapView='detail';_sikapKolIdx=idx;_animateTo(()=>_renderSikapDetail(idx));}

function _renderSikapDetail(idx){
    document.getElementById('page-soal')?.classList.remove('dock-avoid-center');
    document.body.classList.add('soal-building');
    _soalDraftSave();
    const c=document.getElementById('soal-page-content'); if(!c) return;
    const kolom=SoalState.kolom[idx];
    c.innerHTML=`
<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap">
  <button class="btn btn-secondary btn-sm" onclick="_sikapView='list';_animateTo(_renderSikapList)">← Kembali</button>
  <div><div class="section-title" style="margin-bottom:0">Kolom ${kolom.no}</div><div style="font-size:12px;color:var(--text-sub)">${SoalState.nama}</div></div>
</div>
<div class="card" style="margin-bottom:14px">
  <div class="form-label" style="margin-bottom:12px">5 Item Pilihan — teks, angka, simbol, emoji, atau gambar</div>
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px">
    ${kolom.items.map((item,i)=>`
      <div style="text-align:center">
        <div style="font-size:10px;font-weight:700;color:var(--text-sub);margin-bottom:6px;text-transform:uppercase">${String.fromCharCode(65+i)}</div>
        <div id="item-box-${idx}-${i}" class="item-box" onclick="openItemEditor(${idx},${i})" title="Klik untuk edit">
          ${_itemContent(item)}
        </div>
        <div style="font-size:10px;color:var(--accent);margin-top:4px;cursor:pointer;font-weight:600" onclick="openItemEditor(${idx},${i})">Edit</div>
      </div>`).join('')}
  </div>
  <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
    <div class="form-group" style="flex:1;min-width:120px;margin:0"><label class="form-label">Jumlah Soal Generate</label><input id="gen-jumlah" class="form-input" type="number" value="10" min="1" max="100"></div>
    <button class="btn btn-primary" onclick="generateKolomSoal(${idx})">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-4.65"/></svg>
      Generate
    </button>
  </div>
</div>
<div class="card">
  <div class="form-label" style="margin-bottom:12px">Hasil Generate — ${kolom.soal.length} soal</div>
  <div id="kolom-soal-list">
    ${kolom.soal.length?_kolomSoalTable(kolom):'<div class="empty-state" style="padding:24px"><p>Belum ada soal. Isi 5 item lalu Generate.</p></div>'}
  </div>
</div>`;
}

function _itemContent(item){
    if(!item.nilai) return '<div style="color:rgba(19,50,89,0.2);font-size:20px;text-align:center">?</div>';
    if(item.nilai.startsWith('data:')||item.nilai.startsWith('/')||item.nilai.startsWith('http'))
        return `<img src="${item.nilai}" style="max-width:100%;max-height:56px;border-radius:6px;object-fit:contain">`;
    return `<div style="font-size:20px;text-align:center;line-height:1.2;word-break:break-all">${item.nilai}</div>`;
}

function openItemEditor(kIdx,iIdx){
    _editingItem={kIdx,iIdx};
    const item=SoalState.kolom[kIdx].items[iIdx];
    document.getElementById('ie-label').textContent=`Edit Item ${String.fromCharCode(65+iIdx)} — Kolom ${kIdx+1}`;
    document.getElementById('ie-teks').value=(item.nilai&&!item.nilai.startsWith('data:')&&!item.nilai.startsWith('/')&&!item.nilai.startsWith('http'))?item.nilai:'';
    document.getElementById('ie-preview').innerHTML=_itemContent(item);
    document.getElementById('item-editor-overlay').classList.add('open');
}
function applyItemTeks(){
    if(!_editingItem) return;
    const val=document.getElementById('ie-teks').value.trim();
    const {kIdx,iIdx}=_editingItem;
    SoalState.kolom[kIdx].items[iIdx].nilai=val;
    document.getElementById('ie-preview').innerHTML=val?`<div style="font-size:24px">${val}</div>`:'<div style="color:rgba(19,50,89,0.2)">?</div>';
    _refreshItemBox(kIdx,iIdx);
    _soalQueueAutoSave();
}
function triggerItemImage(){document.getElementById('ie-img-input').click();}
function onItemImageSelected(input){
    const file=input.files[0]; if(!file||!_editingItem) return;
    const {kIdx,iIdx}=_editingItem;
    const reader=new FileReader();
    reader.onload=e=>{
        const url=e.target.result;
        SoalState.kolom[kIdx].items[iIdx].nilai=url;
        document.getElementById('ie-preview').innerHTML=`<img src="${url}" style="max-width:100%;max-height:80px;border-radius:8px">`;
        _refreshItemBox(kIdx,iIdx);
        _soalQueueAutoSave();
    };
    reader.readAsDataURL(file); input.value='';
}
function clearItemVal(){
    if(!_editingItem) return;
    const {kIdx,iIdx}=_editingItem;
    SoalState.kolom[kIdx].items[iIdx].nilai='';
    document.getElementById('ie-teks').value='';
    document.getElementById('ie-preview').innerHTML='<div style="color:rgba(19,50,89,0.2);font-size:24px">?</div>';
    _refreshItemBox(kIdx,iIdx);
    _soalQueueAutoSave();
}
function closeItemEditor(){document.getElementById('item-editor-overlay')?.classList.remove('open');_editingItem=null;}
function _refreshItemBox(kIdx,iIdx){
    const box=document.getElementById(`item-box-${kIdx}-${iIdx}`);
    if(box) box.innerHTML=_itemContent(SoalState.kolom[kIdx].items[iIdx]);
}

function generateKolomSoal(idx){
    const kolom=SoalState.kolom[idx];
    const jumlah=parseInt(document.getElementById('gen-jumlah')?.value)||10;
    const items=kolom.items;
    if(items.filter(i=>i.nilai?.trim()).length<5){showToast('Isi semua 5 item terlebih dahulu','danger');return;}
    const newSoal=[];
    for(let i=0;i<jumlah;i++){
        const kIdx=Math.floor(Math.random()*5);
        newSoal.push({id:`SK_${idx}_${Date.now()}_${i}`,semua:items.map(it=>it.nilai),tampil:items.filter((_,j)=>j!==kIdx).map(it=>it.nilai),kunci:items[kIdx].nilai,kunci_idx:kIdx,kunci_huruf:String.fromCharCode(65+kIdx)});
    }
    kolom.soal.push(...newSoal);
    const el=document.getElementById('kolom-soal-list');
    if(el){el.style.opacity='0';setTimeout(()=>{el.innerHTML=_kolomSoalTable(kolom);el.style.transition='opacity 0.25s';el.style.opacity='1';},150);}
    showToast(`${jumlah} soal digenerate!`,'success');
    _soalQueueAutoSave();
}

function _kolomSoalTable(kolom){
    return `<div class="table-wrap"><table>
        <thead><tr><th>#</th><th>4 Item Ditampilkan</th><th>Kunci</th><th></th></tr></thead>
        <tbody>${kolom.soal.map((s,i)=>`
            <tr>
                <td>${i+1}</td>
                <td>${s.tampil.map(v=>v&&(v.startsWith('data:')||v.startsWith('/'))?`<img src="${v}" style="height:24px;border-radius:4px;vertical-align:middle;margin:2px">`:`<span style="margin-right:6px">${v}</span>`).join('')}</td>
                <td>${s.kunci&&(s.kunci.startsWith('data:')||s.kunci.startsWith('/'))?`<img src="${s.kunci}" style="height:24px;border-radius:4px;vertical-align:middle"> (${s.kunci_huruf})`:`<strong style="color:var(--accent)">${s.kunci} (${s.kunci_huruf})</strong>`}</td>
                <td><button class="btn-icon danger" onclick="hapusKolomSoal(${_sikapKolIdx},${i})" style="width:24px;height:24px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button></td>
            </tr>`).join('')}
        </tbody>
    </table></div>`;
}

function hapusKolomSoal(kIdx,sIdx){
    showConfirm('Hapus Soal','Yakin hapus soal ini?','danger',()=>{
        SoalState.kolom[kIdx].soal.splice(sIdx,1);
        const el=document.getElementById('kolom-soal-list');
        if(el) el.innerHTML=_kolomSoalTable(SoalState.kolom[kIdx]);
        _soalQueueAutoSave();
    });
}

// ══════════════ PREVIEW ══════════════
function showPreview(){
    syncEditors();
    _animateTo(()=>{
        const c=document.getElementById('soal-page-content'); if(!c) return;
        let html=`<div style="display:flex;gap:10px;align-items:center;margin-bottom:20px;flex-wrap:wrap">
            <button class="btn btn-secondary" onclick="backToEdit()">← Edit</button>
            <div><div class="section-title" style="margin-bottom:0">${SoalState.nama}</div><div style="font-size:12px;color:var(--text-sub)">${SoalState.type} · ${SoalState.pertanyaan.length} soal · Preview</div></div>
            <button class="btn btn-primary" onclick="simpanSoal()" style="margin-left:auto">💾 Simpan ke Library</button>
        </div>`;
        html+=`<div style="background:linear-gradient(135deg,var(--blue),var(--accent));color:#fff;padding:16px 20px;border-radius:14px;margin-bottom:16px;display:flex;gap:20px;flex-wrap:wrap">
            <div><div style="font-size:10px;opacity:0.7">TIPE</div><div style="font-weight:700">${SoalState.type}</div></div>
            <div><div style="font-size:10px;opacity:0.7">PENILAIAN</div><div style="font-weight:700">${SoalState.skor_type==='nilai_sendiri'?'Nilai per jawaban':'Benar/Salah'}</div></div>
            <div><div style="font-size:10px;opacity:0.7">TIMER</div><div style="font-weight:700">${SoalState.timer.jam}j ${SoalState.timer.menit}m</div></div>
            <div><div style="font-size:10px;opacity:0.7">JUMLAH SOAL</div><div style="font-weight:700">${SoalState.pertanyaan.length}</div></div>
        </div>`;
        SoalState.pertanyaan.forEach((q,i)=>{
            html+=`<div class="card" style="margin-bottom:12px;animation:fadeUp 0.3s ${i*0.04}s both">
                <div style="font-weight:700;font-size:12px;color:var(--text-sub);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em">Soal ${i+1}</div>
                <div style="margin-bottom:12px;line-height:1.7">${q.soal||'<em style="color:var(--text-sub)">Pertanyaan kosong</em>'}</div>
                <div style="display:flex;flex-direction:column;gap:6px">
                    ${q.jawaban.map((j,ji)=>{const isK=q.kunci.includes(j.id);return`<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;border:1.5px solid ${isK?'var(--success)':'rgba(19,50,89,0.1)'};background:${isK?'rgba(22,163,74,0.06)':'rgba(255,255,255,0.5)'}"><span style="font-weight:700;font-size:12px;color:var(--text-sub);flex-shrink:0">${String.fromCharCode(65+ji)}.</span><div style="flex:1">${j.teks||'<em style="color:rgba(19,50,89,0.3)">Kosong</em>'}</div>${SoalState.skor_type==='nilai_sendiri'?`<span style="font-size:11px;font-weight:700;color:var(--accent);background:rgba(26,90,160,0.1);padding:2px 8px;border-radius:6px">${j.nilai}</span>`:''}${isK?'<svg viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>`;}).join('')}
                </div>
                ${q.pembahasan?`<div style="margin-top:10px;padding:10px;background:rgba(26,90,160,0.05);border-radius:8px;border-left:3px solid var(--accent)"><div style="font-size:10px;font-weight:700;color:var(--accent);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em">Pembahasan</div>${q.pembahasan}</div>`:''}
            </div>`;
        });
        c.innerHTML=html;
    });
}
function backToEdit(){SoalState._editors={};_animateTo(_renderMCHtml);}

// ══════════════ SAVE ══════════════
async function simpanSoal(){
    syncEditors();
    if(!SoalState.nama){showToast('Nama soal wajib','danger');return;}
    const payload={nama:SoalState.nama,nama_internal:SoalState.nama_internal||'',type:SoalState.type,skor_type:SoalState.skor_type,opsi_jawaban:SoalState.opsi_jawaban,timer_jam:SoalState.timer.jam,timer_menit:SoalState.timer.menit,timer_detik:SoalState.timer.detik,kelompok:SoalState.kelompok||'',data:SoalState.type==='sikap_kerja'?SoalState.kolom:SoalState.pertanyaan};
    try {
        if(SoalState.kode) await SoalAPI.update(SoalState.kode,payload);
        else await SoalAPI.create(payload);
        clearDirty(); showToast('Soal berhasil disimpan ke Library! ✓','success');
        _soalDraftClear();
        SoalState.mode='setup'; SoalState.kode=null; SoalState.editMode=false; SoalState._editors={}; _sikapView='list';
        showSoalSetup();
    } catch(e){ showToast('Gagal menyimpan: '+(e.message||'error'),'danger'); }
}

async function editSoalFromLibrary(kode){
    try {
        const soal=await SoalAPI.getOne(kode);
        if(!soal){showToast('Data tidak ditemukan','danger');return;}
        navigateTo('soal');
        setTimeout(()=>{
            SoalState.kode=kode; SoalState.editMode=true; SoalState.mode='build'; SoalState.nama=soal.nama;
            SoalState.nama_internal=soal.nama_internal||'';
            SoalState.kelompok=soal.kelompok||'';
            SoalState.type=soal.type; SoalState.skor_type=soal.skor_type||'benar_salah';
            SoalState.opsi_jawaban=soal.opsi_jawaban||1;
            SoalState.timer={jam:soal.timer_jam||0,menit:soal.timer_menit||30,detik:soal.timer_detik||0};
            SoalState._editors={};
            const rawData=soal.data;
            if(soal.type==='sikap_kerja'){SoalState.kolom=rawData||Array.from({length:10},(_,i)=>({id:`KOL${String(i+1).padStart(2,'0')}`,no:i+1,items:Array.from({length:5},(_,j)=>({id:`I${i}${j}`,nilai:''})),soal:[]}));SoalState.pertanyaan=[];}
            else{SoalState.pertanyaan=rawData||[_newQ()];SoalState.currentIdx=0;SoalState.kolom=null;}
            setDirty('edit soal');
            _animateTo(()=>SoalState.type==='sikap_kerja'?_renderSikapList():_renderMCHtml());
        },350);
    } catch(e){ showToast('Gagal memuat soal','danger'); }
}

// ══════════════ EDIT INFO SOAL (nama, timer, tipe) ══════════════
async function openEditSoalInfoModal(){
    document.getElementById('esi-nama').value = SoalState.nama || '';
    document.getElementById('esi-nama-internal').value = SoalState.nama_internal || '';
    const kelSel = document.getElementById('esi-kelompok-select');
    if (kelSel) {
        await _loadSoalKelompokList();
        kelSel.innerHTML = '<option value="">-- Tanpa Kelompok --</option>' +
            _soalKelompokList.map(k => `<option value="${k.kode}">${k.nama}</option>`).join('');
        kelSel.value = SoalState.kelompok || '';
    }
    document.getElementById('esi-jam').value = SoalState.timer?.jam ?? 0;
    document.getElementById('esi-menit').value = SoalState.timer?.menit ?? 0;
    document.getElementById('esi-detik').value = SoalState.timer?.detik ?? 0;
    const typeWrap = document.getElementById('esi-type-wrap');
    if (SoalState.type === 'sikap_kerja') {
        // Tipe Sikap Kerja tidak bisa diubah (struktur data berbeda total)
        if (typeWrap) typeWrap.style.display = 'none';
    } else {
        if (typeWrap) typeWrap.style.display = 'block';
        const sel = document.getElementById('esi-type');
        if (sel) sel.value = SoalState.type;
    }
    openModal('edit-soal-info-overlay');
}

function saveSoalInfo(){
    const nama = document.getElementById('esi-nama')?.value?.trim();
    if (!nama) { showToast('Nama soal wajib diisi', 'danger'); return; }
    SoalState.nama = nama;
    SoalState.nama_internal = document.getElementById('esi-nama-internal')?.value?.trim() || '';
    SoalState.kelompok = document.getElementById('esi-kelompok-select')?.value || '';
    SoalState.timer = {
        jam: parseInt(document.getElementById('esi-jam')?.value) || 0,
        menit: parseInt(document.getElementById('esi-menit')?.value) || 0,
        detik: parseInt(document.getElementById('esi-detik')?.value) || 0,
    };
    // Tipe hanya boleh ditukar antara multiple_choice <-> linier (data pertanyaan kompatibel)
    if (SoalState.type !== 'sikap_kerja') {
        const newType = document.getElementById('esi-type')?.value;
        if ((newType === 'multiple_choice' || newType === 'linier') && newType !== SoalState.type) {
            SoalState.type = newType;
        }
    }
    setDirty('edit soal');
    closeModal('edit-soal-info-overlay');
    showToast('Info soal diperbarui', 'success');
    if (SoalState.type === 'sikap_kerja') _renderSikapList(); else _renderMCHtml();
}

// ══════════════ TEMPLATE & UPLOAD SOAL (Import Excel) ══════════════
function onTplTypeChange() {
    const t = document.getElementById('tpl-type')?.value;
    const skorWrap = document.getElementById('tpl-skor-wrap');
    const jumlahLabel = document.querySelector('#tpl-jumlah-wrap .form-label');
    if (skorWrap) skorWrap.style.display = t === 'sikap_kerja' ? 'none' : 'block';
    if (jumlahLabel) jumlahLabel.textContent = t === 'sikap_kerja' ? 'Jumlah Soal Digenerate per Kolom' : 'Jumlah Baris Soal di Template';
}

function _escHtmlSoal(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
}

function downloadSoalTemplate() {
    if (typeof XLSX === 'undefined') { showToast('Modul Excel belum siap, muat ulang halaman', 'danger'); return; }
    const type = document.getElementById('tpl-type')?.value || 'multiple_choice';
    const skorType = document.querySelector('input[name="tpl_skor_type"]:checked')?.value || 'benar_salah';
    const jumlah = Math.max(1, parseInt(document.getElementById('tpl-jumlah')?.value) || 10);

    const wb = XLSX.utils.book_new();

    const infoRows = [
        ['Field', 'Isi'],
        ['Nama Soal', 'Contoh: Tes Wawasan Kebangsaan'],
        ['Tipe Soal', type],
        ['Sistem Penilaian', type === 'sikap_kerja' ? '-' : skorType],
        ['Jumlah Jawaban Dipilih Peserta', type === 'sikap_kerja' ? '-' : 1],
        ['Timer Jam', 0],
        ['Timer Menit', 30],
        ['Timer Detik', 0],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(infoRows), 'Info');

    if (type === 'sikap_kerja') {
        const kolomRows = [['Kolom', 'Item A', 'Item B', 'Item C', 'Item D', 'Item E']];
        for (let i = 1; i <= 10; i++) kolomRows.push([i, '', '', '', '', '']);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kolomRows), 'Kolom');

        const petunjuk = [
            ['PETUNJUK PENGISIAN — SIKAP KERJA'],
            ['1. Isi kelima Item (A-E) untuk tiap 10 baris Kolom. Boleh teks, angka, atau simbol/emoji.'],
            ['2. Isi item mulai dari A tanpa melompati kolom (jangan isi C jika B masih kosong).'],
            ['3. Gambar tidak bisa lewat Excel — tambahkan manual di aplikasi setelah upload.'],
            ['4. Kolom yang terisi lengkap (5 item) otomatis dibuatkan soal acak setelah file diupload.'],
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(petunjuk), 'Petunjuk');
    } else {
        let header, exampleRow;
        if (skorType === 'nilai_sendiri') {
            header = ['No', 'Pertanyaan', 'Pilihan A', 'Skor A', 'Pilihan B', 'Skor B', 'Pilihan C', 'Skor C', 'Pilihan D', 'Skor D', 'Pilihan E', 'Skor E', 'Pembahasan'];
            exampleRow = [1, 'Contoh: Apa sikap terbaik saat menghadapi rekan kerja yang lalai?', 'Menegur langsung dengan tegas', 10, 'Membiarkan saja', 0, 'Melapor ke atasan tanpa menegur', 5, '', '', '', '', 'Contoh pembahasan (opsional)'];
        } else {
            header = ['No', 'Pertanyaan', 'Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D', 'Pilihan E', 'Kunci Jawaban', 'Pembahasan'];
            exampleRow = [1, 'Contoh: Ibu kota Indonesia adalah?', 'Jakarta', 'Bandung', 'Surabaya', 'Medan', '', 'A', 'Contoh pembahasan (opsional)'];
        }
        const rows = [header, exampleRow];
        for (let i = 2; i <= jumlah; i++) {
            const r = new Array(header.length).fill('');
            r[0] = i;
            rows.push(r);
        }
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Soal');

        const petunjuk = [
            ['PETUNJUK PENGISIAN — ' + (type === 'linier' ? 'LINIER' : 'MULTIPLE CHOICE')],
            ['1. Kolom Pilihan C, D, E boleh dikosongkan jika soal hanya punya 2-3 pilihan.'],
            ['2. Isi pilihan berurutan dari A tanpa melompati kolom (jangan isi C jika B kosong).'],
            skorType === 'nilai_sendiri'
                ? ['3. Isi Skor untuk setiap pilihan yang diisi. Kosongkan Skor jika Pilihan kosong.']
                : ['3. Isi "Kunci Jawaban" dengan huruf pilihan yang benar (A/B/C/D/E). Pisahkan dengan koma jika lebih dari 1 kunci, contoh: A,C'],
            ['4. Kolom Pembahasan bersifat opsional.'],
            ['5. Kolom "No" hanya penomoran, tidak wajib berurutan.'],
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(petunjuk), 'Petunjuk');
    }

    XLSX.writeFile(wb, `Template_Soal_${type}_${skorType}.xlsx`);
    closeModal('template-soal-overlay');
    showToast('Template berhasil diunduh', 'success');
}

function triggerUploadSoal() {
    document.getElementById('upload-soal-file')?.click();
}

function onUploadSoalFile(input) {
    const file = input.files[0];
    if (!file) return;
    if (typeof XLSX === 'undefined') { showToast('Modul Excel belum siap, muat ulang halaman', 'danger'); input.value = ''; return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const buf = e.target.result;
            const wb = XLSX.read(buf, { type: 'array' });
            // Gambar di Excel disimpan sebagai objek "drawing" yang melayang di atas sel,
            // bukan sebagai isi sel — XLSX.js tidak membacanya. Kita bongkar file .xlsx
            // sebagai arsip zip (JSZip) untuk mengambil gambar & posisi selnya secara manual.
            const imageMap = await _extractSoalImageMap(buf);
            _importSoalFromWorkbook(wb, imageMap);
        } catch (err) {
            console.error(err);
            showToast('Gagal membaca file. Pastikan format sesuai template.', 'danger');
        }
        input.value = '';
    };
    reader.onerror = () => { showToast('Gagal membaca file', 'danger'); input.value = ''; };
    reader.readAsArrayBuffer(file);
}

// Resolusi path relasi OOXML (mendukung Target berupa path absolut "/xl/..." maupun relatif "../media/...")
function _resolveOoxmlPath(basePath, target) {
    if (target.startsWith('/')) return target.slice(1);
    const baseDir = basePath.split('/').slice(0, -1);
    target.split('/').forEach(p => {
        if (p === '..') baseDir.pop();
        else if (p !== '.' && p !== '') baseDir.push(p);
    });
    return baseDir.join('/');
}

// Membongkar gambar (drawing) di sheet "Soal" dari file .xlsx mentah (via JSZip),
// lalu memetakannya ke { [rowIndex0Based]: { [colIndex0Based]: dataUrl } }.
// rowIndex mengikuti indeks baris mentah sheet (0 = header), sama seperti indeks
// array hasil XLSX.utils.sheet_to_json({header:1}) — jadi tinggal dicocokkan langsung.
async function _extractSoalImageMap(arrayBuffer) {
    if (typeof JSZip === 'undefined') { console.warn('JSZip tidak tersedia, import gambar dilewati'); return {}; }
    try {
        const zip = await JSZip.loadAsync(arrayBuffer);
        const parser = new DOMParser();
        const readXml = async (path) => {
            const f = zip.file(path);
            if (!f) return null;
            const doc = parser.parseFromString(await f.async('string'), 'application/xml');
            return doc.getElementsByTagName('parsererror').length ? null : doc;
        };
        const readRelsFor = (path) => {
            const parts = path.split('/');
            const fname = parts.pop();
            return readXml(parts.join('/') + '/_rels/' + fname + '.rels');
        };
        const relMapOf = (relsDoc) => {
            const m = {};
            if (!relsDoc) return m;
            Array.from(relsDoc.getElementsByTagName('Relationship')).forEach(r => {
                m[r.getAttribute('Id')] = { target: r.getAttribute('Target'), type: r.getAttribute('Type') || '' };
            });
            return m;
        };

        const wbXml = await readXml('xl/workbook.xml');
        const wbRelMap = relMapOf(await readRelsFor('xl/workbook.xml'));
        if (!wbXml) return {};

        let soalSheetPath = null;
        Array.from(wbXml.getElementsByTagName('sheet')).forEach(s => {
            if (s.getAttribute('name') === 'Soal') {
                const rid = s.getAttribute('r:id') || s.getAttribute('id');
                const rel = rid && wbRelMap[rid];
                if (rel) soalSheetPath = _resolveOoxmlPath('xl/workbook.xml', rel.target);
            }
        });
        if (!soalSheetPath) return {};

        const sheetRelMap = relMapOf(await readRelsFor(soalSheetPath));
        let drawingPath = null;
        Object.values(sheetRelMap).forEach(rel => {
            if (rel.type.endsWith('/drawing')) drawingPath = _resolveOoxmlPath(soalSheetPath, rel.target);
        });
        if (!drawingPath) return {};

        const drawingXml = await readXml(drawingPath);
        if (!drawingXml) return {};
        const drawingRelMap = relMapOf(await readRelsFor(drawingPath));

        const map = {};
        const anchors = [
            ...Array.from(drawingXml.getElementsByTagName('oneCellAnchor')),
            ...Array.from(drawingXml.getElementsByTagName('twoCellAnchor')),
        ];
        for (const anchor of anchors) {
            const from = anchor.getElementsByTagName('from')[0];
            if (!from) continue;
            const col = parseInt(from.getElementsByTagName('col')[0]?.textContent || '0', 10);
            const row = parseInt(from.getElementsByTagName('row')[0]?.textContent || '0', 10);
            const blip = anchor.getElementsByTagName('a:blip')[0];
            const embedId = blip?.getAttribute('r:embed');
            if (!embedId) continue;
            const mediaRel = drawingRelMap[embedId];
            if (!mediaRel) continue;
            const mediaPath = _resolveOoxmlPath(drawingPath, mediaRel.target);
            const mf = zip.file(mediaPath);
            if (!mf) continue;
            const base64 = await mf.async('base64');
            const ext = (mediaPath.split('.').pop() || 'jpeg').toLowerCase();
            const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'bmp' ? 'image/bmp' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
            // Satu sel bisa punya lebih dari 1 gambar tertumpuk — simpan sebagai array, bukan ditimpa.
            if (!map[row]) map[row] = {};
            if (!map[row][col]) map[row][col] = [];
            map[row][col].push(`data:${mime};base64,${base64}`);
        }
        return map;
    } catch (err) {
        console.error('Gagal ekstrak gambar dari Excel:', err);
        return {};
    }
}

function _imgTagSoal(dataUrls) {
    const list = Array.isArray(dataUrls) ? dataUrls : [dataUrls];
    return list.map(u => `<br><img src="${u}" style="max-width:100%;height:auto;border-radius:8px;margin-top:6px">`).join('');
}

function _sheetToRowsSoal(wb, name) {
    const ws = wb.Sheets[name];
    if (!ws) return null;
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
}

function _readInfoSheetSoal(wb) {
    const rows = _sheetToRowsSoal(wb, 'Info') || [];
    const map = {};
    rows.slice(1).forEach(r => { if (r[0]) map[String(r[0]).trim()] = r[1]; });
    return map;
}

function _importSoalFromWorkbook(wb, imageMap) {
    imageMap = imageMap || {};
    const info = _readInfoSheetSoal(wb);
    const nama = (info['Nama Soal'] && String(info['Nama Soal']).trim()) || ('Soal Import ' + new Date().toLocaleDateString('id-ID'));
    let type = String(info['Tipe Soal'] || 'multiple_choice').trim();
    if (!['multiple_choice', 'linier', 'sikap_kerja'].includes(type)) type = 'multiple_choice';
    const skorType = String(info['Sistem Penilaian'] || 'benar_salah').trim() === 'nilai_sendiri' ? 'nilai_sendiri' : 'benar_salah';
    const opsiJawaban = parseInt(info['Jumlah Jawaban Dipilih Peserta']) || 1;
    const timerJam = parseInt(info['Timer Jam']) || 0;
    const timerMenit = (info['Timer Menit'] !== undefined && info['Timer Menit'] !== '') ? (parseInt(info['Timer Menit']) || 0) : 30;
    const timerDetik = parseInt(info['Timer Detik']) || 0;

    SoalState.mode = 'build'; SoalState.kode = null; SoalState.editMode = false; SoalState._editors = {};
    SoalState.nama = nama; SoalState.nama_internal = ''; SoalState.type = type; SoalState.skor_type = skorType;
    SoalState.opsi_jawaban = opsiJawaban;
    SoalState.timer = { jam: timerJam, menit: timerMenit, detik: timerDetik };

    if (type === 'sikap_kerja') {
        const rows = (_sheetToRowsSoal(wb, 'Kolom') || []).slice(1);
        const kolom = [];
        for (let i = 0; i < 10; i++) {
            const r = rows[i] || [];
            const items = [0, 1, 2, 3, 4].map(j => ({ id: `I${i}${j}`, nilai: r[j + 1] !== undefined ? String(r[j + 1]).trim() : '' }));
            kolom.push({ id: `KOL${String(i + 1).padStart(2, '0')}`, no: i + 1, items, soal: [] });
        }
        kolom.forEach((k, idx) => {
            const filled = k.items.filter(it => it.nilai).length;
            if (filled === 5) {
                const generated = [];
                for (let g = 0; g < 10; g++) {
                    const kIdx = Math.floor(Math.random() * 5);
                    const items = k.items;
                    generated.push({ id: `SK_${idx}_${Date.now()}_${g}`, semua: items.map(it => it.nilai), tampil: items.filter((_, j) => j !== kIdx).map(it => it.nilai), kunci: items[kIdx].nilai, kunci_idx: kIdx, kunci_huruf: String.fromCharCode(65 + kIdx) });
                }
                k.soal = generated;
            }
        });
        SoalState.kolom = kolom; SoalState.pertanyaan = [];
        const totalFilled = kolom.filter(k => k.soal.length).length;
        setDirty('import soal');
        showToast(`Import berhasil! ${totalFilled}/10 kolom siap (soal otomatis dibuat)`, 'success');
        _sikapView = 'list'; _animateTo(_renderSikapList);
    } else {
        // Simpan indeks baris asli (0-based, header=0) tiap baris SEBELUM difilter,
        // supaya bisa dicocokkan balik ke imageMap (posisi gambar diambil dari baris mentah Excel).
        const rawRows = _sheetToRowsSoal(wb, 'Soal') || [];
        const allRows = rawRows.slice(1).map((r, i) => ({ r, excelRow: i + 1 }));
        const rows = allRows.filter(({ r }) => String(r[1] || '').trim() !== '');
        if (!rows.length) { showToast('Sheet "Soal" kosong atau tidak ditemukan. Pastikan kolom Pertanyaan terisi.', 'danger'); return; }
        let totalGambar = 0;
        const pertanyaan = rows.map(({ r, excelRow }, idx) => {
            const rowImages = imageMap[excelRow] || {};
            const imgFor = (col) => rowImages[col];
            let q;
            if (skorType === 'nilai_sendiri') {
                const pairs = [[2, 3], [4, 5], [6, 7], [8, 9], [10, 11]];
                const jawaban = [];
                pairs.forEach(([ti, si], k) => {
                    let teks = r[ti] !== undefined ? String(r[ti]).trim() : '';
                    const img = imgFor(ti);
                    if (img) { totalGambar += img.length; teks = _escHtmlSoal(teks) + _imgTagSoal(img); } else { teks = teks ? _escHtmlSoal(teks) : ''; }
                    if (teks) jawaban.push({ id: 'A_' + idx + '_' + k, teks, nilai: parseFloat(r[si]) || 0 });
                });
                while (jawaban.length < 2) jawaban.push({ id: 'A_' + idx + '_x' + jawaban.length, teks: '', nilai: 0 });
                let soalTeks = _escHtmlSoal(r[1]);
                if (imgFor(1)) { totalGambar += imgFor(1).length; soalTeks += _imgTagSoal(imgFor(1)); }
                let pembahasanTeks = _escHtmlSoal(r[12] || '');
                if (imgFor(12)) { totalGambar += imgFor(12).length; pembahasanTeks += _imgTagSoal(imgFor(12)); }
                q = { id: 'Q_' + Date.now() + '_' + idx, soal: soalTeks, jawaban, kunci: [], pembahasan: pembahasanTeks };
            } else {
                const teksIdx = [2, 3, 4, 5, 6];
                const jawaban = [];
                teksIdx.forEach((ti, k) => {
                    let teks = r[ti] !== undefined ? String(r[ti]).trim() : '';
                    const img = imgFor(ti);
                    if (img) { totalGambar += img.length; teks = _escHtmlSoal(teks) + _imgTagSoal(img); } else { teks = teks ? _escHtmlSoal(teks) : ''; }
                    if (teks) jawaban.push({ id: 'A_' + idx + '_' + k, teks, nilai: 0 });
                });
                while (jawaban.length < 2) jawaban.push({ id: 'A_' + idx + '_x' + jawaban.length, teks: '', nilai: 0 });
                const kunciHuruf = String(r[7] || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
                const kunci = kunciHuruf.map(h => { const ki = h.charCodeAt(0) - 65; return jawaban[ki]?.id; }).filter(Boolean);
                let soalTeks = _escHtmlSoal(r[1]);
                if (imgFor(1)) { totalGambar += imgFor(1).length; soalTeks += _imgTagSoal(imgFor(1)); }
                let pembahasanTeks = _escHtmlSoal(r[8] || '');
                if (imgFor(8)) { totalGambar += imgFor(8).length; pembahasanTeks += _imgTagSoal(imgFor(8)); }
                q = { id: 'Q_' + Date.now() + '_' + idx, soal: soalTeks, jawaban, kunci, pembahasan: pembahasanTeks };
            }
            return q;
        });
        SoalState.pertanyaan = pertanyaan; SoalState.currentIdx = 0; SoalState.kolom = null;
        setDirty('import soal');
        showToast(`Import berhasil! ${pertanyaan.length} soal siap direview${totalGambar ? ` (${totalGambar} gambar ikut terbawa)` : ''}`, 'success');
        _animateTo(_renderMCHtml);
    }
}
// ══════════════ EXPORT SOAL KE EXCEL (kebalikan dari Upload/Import — ambil data keluar) ══════════════
// Isi konten soal/jawaban/pembahasan disimpan sebagai HTML (dari RichEditor) — diubah dulu jadi
// teks polos supaya rapi di Excel & kompatibel dibaca ulang lewat menu Upload Soal.
function _htmlToPlainSoal(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = String(html).replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/div>/gi, '\n');
    return (div.textContent || div.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
}

// ── Embed gambar ASLI ke .xlsx hasil export (kebalikan dari _extractSoalImageMap
// yang dipakai saat import). _htmlToPlainSoal() di atas buang tag <img> waktu convert
// ke plain text, jadi gambar di soal/opsi/pembahasan perlu ditempel manual di sini
// sebagai drawing OOXML supaya benar-benar tampil di Excel, bukan cuma hilang. ──

// Ambil semua src <img> dari sebuah string HTML.
function _extractImgSrcs(html) {
    if (!html) return [];
    const div = document.createElement('div');
    div.innerHTML = String(html);
    return Array.from(div.querySelectorAll('img')).map(img => img.getAttribute('src')).filter(Boolean);
}

function _soalAbsSrc(src) {
    if (!src) return src;
    if (src.startsWith('http') || src.startsWith('data:')) return src;
    try { return new URL(src, window.location.href).href; } catch (e) { return src; }
}

// Ambil bytes sebuah gambar (base64 + ekstensi) dari data URI atau URL/path server.
async function _fetchImageBytesSoal(src) {
    try {
        if (src.startsWith('data:')) {
            const m = /^data:image\/(\w+);base64,(.+)$/.exec(src);
            if (!m) return null;
            return { base64: m[2], ext: m[1] === 'jpg' ? 'jpeg' : m[1] };
        }
        const resp = await fetch(_soalAbsSrc(src));
        if (!resp.ok) return null;
        const blob = await resp.blob();
        let ext = (blob.type.split('/')[1] || 'jpeg').toLowerCase();
        if (ext === 'jpg') ext = 'jpeg';
        if (!['png', 'jpeg', 'gif', 'bmp'].includes(ext)) ext = 'jpeg';
        const base64 = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(String(r.result).split(',')[1] || '');
            r.onerror = rej;
            r.readAsDataURL(blob);
        });
        return { base64, ext };
    } catch (err) {
        console.warn('Gagal ambil gambar untuk export:', src, err);
        return null;
    }
}

// Kumpulkan posisi { row, col, srcs } gambar yang perlu ditempel, dengan row/col
// 0-based mengikuti indeks baris/kolom mentah sheet (0 = header) — sama persis dengan
// konvensi yang dipakai _extractSoalImageMap saat baca balik file ini via import.
function _collectSoalImagePositions(s) {
    const type = s.type || 'multiple_choice';
    const skorType = s.skor_type || 'benar_salah';
    const data = s.data || [];
    const positions = [];

    if (type === 'sikap_kerja') {
        data.forEach((k, i) => {
            const items = k.items || [];
            [0, 1, 2, 3, 4].forEach(j => {
                const v = items[j]?.nilai || '';
                if (v && (v.startsWith('data:') || v.startsWith('/') || v.startsWith('http'))) {
                    positions.push({ row: i + 1, col: j + 1, srcs: [v] });
                }
            });
        });
    } else {
        const pembahasanCol = skorType === 'nilai_sendiri' ? 12 : 8;
        data.forEach((q, idx) => {
            const row = idx + 1;
            const soalSrcs = _extractImgSrcs(q.soal);
            if (soalSrcs.length) positions.push({ row, col: 1, srcs: soalSrcs });

            const jawaban = q.jawaban || [];
            for (let k = 0; k < 5; k++) {
                const j = jawaban[k];
                if (!j) continue;
                const optSrcs = _extractImgSrcs(j.teks);
                if (optSrcs.length) {
                    const col = skorType === 'nilai_sendiri' ? 2 + k * 2 : 2 + k;
                    positions.push({ row, col, srcs: optSrcs });
                }
            }
            const pmSrcs = _extractImgSrcs(q.pembahasan);
            if (pmSrcs.length) positions.push({ row, col: pembahasanCol, srcs: pmSrcs });
        });
    }
    return positions;
}

// Suntik gambar sebagai drawing OOXML ke dalam file .xlsx yang sudah jadi (arrayBuffer
// hasil XLSX.write). sheetName = nama sheet yang berisi data soal ('Soal' atau 'Kolom').
async function _embedImagesIntoXlsx(arrayBuffer, sheetName, positions) {
    if (!positions.length) return arrayBuffer;
    if (typeof JSZip === 'undefined') { console.warn('JSZip tidak tersedia, gambar tidak bisa di-embed ke Excel'); return arrayBuffer; }

    const flat = [];
    positions.forEach(p => p.srcs.forEach(src => flat.push(src)));
    const bytesList = await Promise.all(flat.map(_fetchImageBytesSoal));

    const zip = await JSZip.loadAsync(arrayBuffer);
    const parser = new DOMParser();
    const serializer = new XMLSerializer();
    const readXml = async (path) => {
        const f = zip.file(path);
        if (!f) return null;
        const doc = parser.parseFromString(await f.async('string'), 'application/xml');
        return doc.getElementsByTagName('parsererror').length ? null : doc;
    };

    const wbXml = await readXml('xl/workbook.xml');
    if (!wbXml) return arrayBuffer;
    const wbRelsXml = await readXml('xl/_rels/workbook.xml.rels');
    const wbRelMap = {};
    if (wbRelsXml) Array.from(wbRelsXml.getElementsByTagName('Relationship')).forEach(r => { wbRelMap[r.getAttribute('Id')] = r.getAttribute('Target'); });

    let sheetPath = null;
    Array.from(wbXml.getElementsByTagName('sheet')).forEach(sh => {
        if (sh.getAttribute('name') === sheetName) {
            const rid = sh.getAttribute('r:id') || sh.getAttribute('id');
            const target = rid && wbRelMap[rid];
            if (target) sheetPath = _resolveOoxmlPath('xl/workbook.xml', target);
        }
    });
    if (!sheetPath) return arrayBuffer;

    const sheetParts = sheetPath.split('/');
    const sheetFile = sheetParts.pop();
    const sheetRelsPath = sheetParts.join('/') + '/_rels/' + sheetFile + '.rels';

    let drawingIdx = 1;
    while (zip.file(`xl/drawings/drawing${drawingIdx}.xml`)) drawingIdx++;
    const drawingPath = `xl/drawings/drawing${drawingIdx}.xml`;
    const drawingRelsPath = `xl/drawings/_rels/drawing${drawingIdx}.xml.rels`;

    const existingMedia = Object.keys(zip.files).filter(f => f.startsWith('xl/media/')).length;
    const drawingRels = [];
    const anchorsXml = [];
    let mediaCount = 0, anchorIdx = 0, fi = 0;

    for (const p of positions) {
        for (let si = 0; si < p.srcs.length; si++) {
            const bytes = bytesList[fi++];
            if (!bytes) continue;
            mediaCount++;
            const mediaName = `image${existingMedia + mediaCount}.${bytes.ext}`;
            zip.file(`xl/media/${mediaName}`, bytes.base64, { base64: true });
            const rid = `rIdImg${anchorIdx + 1}`;
            drawingRels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${mediaName}"/>`);
            const colOffset = si * 120000;
            anchorsXml.push(`
  <xdr:oneCellAnchor>
    <xdr:from><xdr:col>${p.col}</xdr:col><xdr:colOff>${colOffset}</xdr:colOff><xdr:row>${p.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:ext cx="600000" cy="600000"/>
    <xdr:pic>
      <xdr:nvPicPr><xdr:cNvPr id="${anchorIdx + 2}" name="Gambar${anchorIdx + 1}"/><xdr:cNvPicPr/></xdr:nvPicPr>
      <xdr:blipFill><a:blip xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" r:embed="${rid}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>
      <xdr:spPr><a:xfrm xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:off x="0" y="0"/><a:ext cx="600000" cy="600000"/></a:xfrm><a:prstGeom xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>
    </xdr:pic>
    <xdr:clientData/>
  </xdr:oneCellAnchor>`);
            anchorIdx++;
        }
    }
    if (!anchorIdx) return arrayBuffer;

    zip.file(drawingPath, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchorsXml.join('')}
</xdr:wsDr>`);

    zip.file(drawingRelsPath, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${drawingRels.join('')}</Relationships>`);

    let sheetRelsDoc = await readXml(sheetRelsPath);
    let nextRid = 1;
    if (sheetRelsDoc) {
        Array.from(sheetRelsDoc.getElementsByTagName('Relationship')).forEach(r => {
            const idNum = parseInt((r.getAttribute('Id') || '').replace('rId', ''), 10);
            if (idNum >= nextRid) nextRid = idNum + 1;
        });
        const rel = sheetRelsDoc.createElement('Relationship');
        rel.setAttribute('Id', `rId${nextRid}`);
        rel.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing');
        rel.setAttribute('Target', `../drawings/drawing${drawingIdx}.xml`);
        sheetRelsDoc.documentElement.appendChild(rel);
        zip.file(sheetRelsPath, serializer.serializeToString(sheetRelsDoc));
    } else {
        zip.file(sheetRelsPath, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingIdx}.xml"/></Relationships>`);
        nextRid = 1;
    }
    const drawingRidOnSheet = `rId${nextRid}`;

    let sheetXmlStr = await zip.file(sheetPath).async('string');
    if (!sheetXmlStr.includes('<drawing ')) {
        sheetXmlStr = sheetXmlStr.replace('</worksheet>', `<drawing r:id="${drawingRidOnSheet}"/></worksheet>`);
        zip.file(sheetPath, sheetXmlStr);
    }

    let ctXmlStr = await zip.file('[Content_Types].xml').async('string');
    if (!ctXmlStr.includes(`/xl/drawings/drawing${drawingIdx}.xml`)) {
        ctXmlStr = ctXmlStr.replace('</Types>', `<Override PartName="/xl/drawings/drawing${drawingIdx}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
    }
    const mimeMap = { png: 'image/png', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp' };
    Object.keys(mimeMap).forEach(ext => {
        if (!ctXmlStr.includes(`Extension="${ext}"`)) {
            ctXmlStr = ctXmlStr.replace('</Types>', `<Default Extension="${ext}" ContentType="${mimeMap[ext]}"/></Types>`);
        }
    });
    zip.file('[Content_Types].xml', ctXmlStr);

    return await zip.generateAsync({ type: 'arraybuffer' });
}

// s = { nama, type, skor_type, opsi_jawaban, timer:{jam,menit,detik} atau timer_jam/menit/detik, data: [...] }
// Membangun workbook-nya saja (dipakai ulang baik untuk download tunggal maupun bundel ZIP massal)
function _buildSoalWorkbook(s) {
    const type = s.type || 'multiple_choice';
    const skorType = s.skor_type || 'benar_salah';
    const wb = XLSX.utils.book_new();

    const infoRows = [
        ['Field', 'Isi'],
        ['Nama Soal', s.nama || ''],
        ['Tipe Soal', type],
        ['Sistem Penilaian', type === 'sikap_kerja' ? '-' : skorType],
        ['Jumlah Jawaban Dipilih Peserta', type === 'sikap_kerja' ? '-' : (s.opsi_jawaban || 1)],
        ['Timer Jam', (s.timer && s.timer.jam) ?? s.timer_jam ?? 0],
        ['Timer Menit', (s.timer && s.timer.menit) ?? s.timer_menit ?? 30],
        ['Timer Detik', (s.timer && s.timer.detik) ?? s.timer_detik ?? 0],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(infoRows), 'Info');

    const data = s.data || [];
    if (type === 'sikap_kerja') {
        const kolomRows = [['Kolom', 'Item A', 'Item B', 'Item C', 'Item D', 'Item E']];
        data.forEach((k, i) => {
            const items = k.items || [];
            kolomRows.push([k.no || i + 1, ...[0, 1, 2, 3, 4].map(j => items[j]?.nilai || '')]);
        });
        while (kolomRows.length < 11) kolomRows.push([kolomRows.length, '', '', '', '', '']);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kolomRows), 'Kolom');
    } else {
        const header = skorType === 'nilai_sendiri'
            ? ['No', 'Pertanyaan', 'Pilihan A', 'Skor A', 'Pilihan B', 'Skor B', 'Pilihan C', 'Skor C', 'Pilihan D', 'Skor D', 'Pilihan E', 'Skor E', 'Pembahasan']
            : ['No', 'Pertanyaan', 'Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D', 'Pilihan E', 'Kunci Jawaban', 'Pembahasan'];
        const rows = [header];
        data.forEach((q, idx) => {
            const jawaban = q.jawaban || [];
            const r = [idx + 1, _htmlToPlainSoal(q.soal)];
            if (skorType === 'nilai_sendiri') {
                for (let k = 0; k < 5; k++) {
                    const j = jawaban[k];
                    r.push(j ? _htmlToPlainSoal(j.teks) : '');
                    r.push(j && j.teks ? (j.nilai ?? 0) : '');
                }
            } else {
                for (let k = 0; k < 5; k++) {
                    const j = jawaban[k];
                    r.push(j ? _htmlToPlainSoal(j.teks) : '');
                }
                const kunciHuruf = (q.kunci || []).map(id => {
                    const ki = jawaban.findIndex(j => j.id === id);
                    return ki >= 0 ? String.fromCharCode(65 + ki) : null;
                }).filter(Boolean);
                r.push(kunciHuruf.join(','));
            }
            r.push(_htmlToPlainSoal(q.pembahasan));
            rows.push(r);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Soal');
    }

    const ket = [
        ['Diekspor pada ' + new Date().toLocaleString('id-ID')],
        ['File ini memakai format yang sama dengan Template Upload Soal — bisa langsung diedit lalu diupload ulang lewat tombol "Upload Soal".'],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ket), 'Keterangan');
    return wb;
}

// Dipakai oleh Export Massal (ZIP) — workbook dalam bentuk array buffer, bukan langsung diunduh.
// Gambar di soal/opsi/pembahasan ikut di-embed sebagai drawing asli, sama seperti export tunggal.
async function _buildSoalWorkbookBlob(s) {
    const wb = _buildSoalWorkbook(s);
    let arr = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const positions = _collectSoalImagePositions(s);
    if (positions.length) {
        const sheetName = (s.type || 'multiple_choice') === 'sikap_kerja' ? 'Kolom' : 'Soal';
        arr = await _embedImagesIntoXlsx(arr, sheetName, positions);
    }
    return arr;
}

async function exportSoalDataToExcel(s) {
    if (typeof XLSX === 'undefined') { showToast('Modul Excel belum siap, muat ulang halaman', 'danger'); return; }
    const positions = _collectSoalImagePositions(s);
    if (positions.length) showToast('Menyiapkan gambar untuk Excel...', 'success');

    const wb = _buildSoalWorkbook(s);
    let arr = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    if (positions.length) {
        const sheetName = (s.type || 'multiple_choice') === 'sikap_kerja' ? 'Kolom' : 'Soal';
        arr = await _embedImagesIntoXlsx(arr, sheetName, positions);
    }

    const safeName = (s.nama || 'Soal').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
    const blob = new Blob([arr], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Export_Soal_${safeName}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast('Soal berhasil diekspor ke Excel', 'success');
}

// Export soal yang SUDAH TERSIMPAN di library (dipanggil dari kartu Bank Soal)
async function exportLibSoalToExcel(kode) {
    const s = await SoalAPI.getOne(kode).catch(() => null);
    if (!s) { showToast('Gagal memuat data soal', 'danger'); return; }
    await exportSoalDataToExcel(s);
}

// Export soal yang SEDANG dibuka di builder (dipanggil dari tombol di layar Buat/Edit Soal)
async function exportCurrentSoalToExcel() {
    await exportSoalDataToExcel({
        nama: SoalState.nama, type: SoalState.type, skor_type: SoalState.skor_type,
        opsi_jawaban: SoalState.opsi_jawaban, timer: SoalState.timer,
        data: SoalState.type === 'sikap_kerja' ? (SoalState.kolom || []) : (SoalState.pertanyaan || []),
    });
}

// ══════════════ KELOLA KELOMPOK SOAL (dikelola dari Buat Soal / Edit Info — opsional) ══════════════
function openManageSoalKelompok() {
    const input = document.getElementById('soal-kelompok-new-input'); if (input) input.value = '';
    _renderSoalKelompokManageList();
    openModal('soal-kelompok-overlay');
}

function _renderSoalKelompokManageList() {
    const el = document.getElementById('soal-kelompok-manage-list'); if (!el) return;
    if (!_soalKelompokList.length) { el.innerHTML = '<p style="color:var(--text-sub);font-size:13px">Belum ada kelompok. Tambahkan lewat kolom di atas.</p>'; return; }
    el.innerHTML = _soalKelompokList.map(k => `
      <div class="ebook-pick-item" id="skl-row-${k.kode}" style="justify-content:space-between">
        <span id="skl-nama-${k.kode}" style="font-weight:600;font-size:13.5px;color:var(--blue)">${k.nama}</span>
        <div class="skl-row-actions" style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn-icon" title="Ganti nama" onclick="_startRenameSoalKelompok('${k.kode}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn-icon danger" title="Hapus" onclick="deleteSoalKelompokItem('${k.kode}','${(k.nama || '').replace(/'/g, "\\'")}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
        </div>
      </div>`).join('');
}

async function addSoalKelompok() {
    const input = document.getElementById('soal-kelompok-new-input');
    const nama = (input?.value || '').trim();
    if (!nama) { showToast('Nama kelompok wajib diisi', 'danger'); return; }
    try {
        await SoalKelompokAPI.create({ nama });
        if (input) input.value = '';
        showToast('Kelompok ditambahkan', 'success');
        await _afterSoalKelompokChange();
    } catch (e) { showToast('Gagal: ' + e.message, 'danger'); }
}

function _startRenameSoalKelompok(kode) {
    const span = document.getElementById(`skl-nama-${kode}`); if (!span) return;
    const current = span.textContent;
    span.outerHTML = `<input id="skl-nama-${kode}" class="form-input" style="padding:6px 10px;font-size:13px" type="text" value="${current.replace(/"/g, '&quot;')}" onkeydown="if(event.key==='Enter')_saveRenameSoalKelompok('${kode}')">`;
    const row = document.getElementById(`skl-row-${kode}`);
    const actionsWrap = row?.querySelector('.skl-row-actions');
    if (actionsWrap) actionsWrap.innerHTML = `<button class="btn-icon" title="Simpan" onclick="_saveRenameSoalKelompok('${kode}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg></button>`;
    document.getElementById(`skl-nama-${kode}`)?.focus();
}
async function _saveRenameSoalKelompok(kode) {
    const input = document.getElementById(`skl-nama-${kode}`);
    const nama = (input?.value || '').trim();
    if (!nama) { showToast('Nama kelompok wajib diisi', 'danger'); return; }
    try {
        await SoalKelompokAPI.update(kode, { nama });
        showToast('Kelompok diperbarui, semua soal terkait ikut berubah', 'success');
        await _afterSoalKelompokChange();
    } catch (e) { showToast('Gagal: ' + e.message, 'danger'); }
}
function deleteSoalKelompokItem(kode, nama) {
    showConfirm('Hapus Kelompok', `Yakin hapus kelompok "${nama}"? Soal yang ada di kelompok ini akan menjadi tanpa kelompok (bukan ikut terhapus).`, 'danger', async () => {
        await SoalKelompokAPI.delete(kode);
        showToast('Kelompok dihapus', 'danger');
        await _afterSoalKelompokChange();
    });
}

// Refresh semua bagian UI yang menampilkan/memakai daftar kelompok soal, di halaman mana pun sedang aktif
async function _afterSoalKelompokChange() {
    await _loadSoalKelompokList();
    _renderSoalKelompokManageList();
    if (document.getElementById('soal-kelompok-select')) await _populateSoalKelompokSelect();
    if (document.getElementById('esi-kelompok-select')) {
        const kelSel = document.getElementById('esi-kelompok-select');
        kelSel.innerHTML = '<option value="">-- Tanpa Kelompok --</option>' +
            _soalKelompokList.map(k => `<option value="${k.kode}">${k.nama}</option>`).join('');
        kelSel.value = SoalState.kelompok || '';
    }
    if (document.getElementById('library-filters') && typeof renderLibrary === 'function') await renderLibrary();
}
