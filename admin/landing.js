// ── EDITOR LANDING PAGE (desain baru, sections: Hero / Teknologi / Video Promo / Footer) ──
// Data disimpan sebagai satu JSON di tabel `landing` (lewat /api/landing, GET & PUT
// sudah generik/merge di server — lihat server.js). index.html membaca data ini
// saat halaman dibuka dan menimpa teks default kalau field-nya diisi admin.
let _ldData = {};
let _ldLoaded = false;
let _ldSub = 'hero';

// URL media (logo Hero, video Hero, video Video Promo) yang sedang aktif dipakai —
// diisi dari data tersimpan saat load, diperbarui begitu upload baru sukses,
// dan baru benar-benar disimpan ke DB saat tombol "Simpan Bagian ..." ditekan.
let _ldPendingMedia = { heroLogo: '', heroVideo: '', videoPromo: '' };

const LD_TEK_DEFAULTS = [
  { title: 'Analisis Bertenaga AI', desc: 'Model prediktif membaca ribuan titik data pasar setiap detik untuk menyaring sinyal yang relevan.' },
  { title: 'Data Real-Time Multi-Bursa', desc: 'Feed harga dan likuiditas tersinkron langsung dari berbagai bursa global tanpa jeda berarti.' },
  { title: 'Keamanan Tingkat Bank', desc: 'Enkripsi end-to-end dan audit berkala menjaga data serta strategi keanggotaan Anda tetap privat.' },
  { title: 'Infrastruktur Cloud Global', desc: 'Server terdistribusi menjaga latensi rendah dan keandalan akses di manapun Anda berada.' }
];

// Data awal (sama seperti konten statis di testimoni.html) supaya saat admin pertama
// kali membuka tab Testimoni, daftarnya sudah terisi dan tinggal disunting/diatur
// centangnya, bukan mulai dari kosong.
const LD_TESTI_DEFAULTS = [
  { name: 'Raka Adiputra', role: 'Trader Retail, Surabaya', accepted: 'Bergabung sejak 2023', photo: 'https://i.pravatar.cc/300?img=13', quote: 'Pendampingan di CIBN PRESTISE mengubah cara saya membaca pasar. Analisisnya tajam dan disiplin risikonya benar-benar ditekankan.', sorotan: true, semua: true, marquee: true },
  { name: 'Amelia Putri', role: 'Konsultan Keuangan, Jakarta', accepted: 'Diterima di Elite Circle', photo: 'https://i.pravatar.cc/300?img=32', quote: 'Kualitas risetnya di atas rata-rata. Setiap sinyal disertai alasan yang jelas, bukan sekadar rekomendasi tanpa konteks.', sorotan: true, semua: true, marquee: true },
  { name: 'Bima Prasetyo', role: 'Trader Purnawaktu, Bandung', accepted: 'Alumni Private Mentorship', photo: 'https://i.pravatar.cc/300?img=51', quote: 'Mentorship privatnya sangat personal. Strategi saya benar-benar disesuaikan dengan gaya trading dan toleransi risiko saya sendiri.', sorotan: true, semua: true, marquee: true },
  { name: 'Sarah Wijaya', role: 'Pemilik Bisnis, Semarang', accepted: 'Bergabung sejak 2024', photo: 'https://i.pravatar.cc/300?img=45', quote: 'Komunitasnya suportif dan materinya runtut. Sebagai pemula saya merasa terbimbing, bukan dilepas begitu saja.', sorotan: true, semua: true, marquee: true },
  { name: 'Dimas Nugroho', role: 'Trader Institusi, Jakarta', accepted: 'Diterima di Prestise Pro', photo: 'https://i.pravatar.cc/300?img=60', quote: 'Kecepatan dan akurasi sinyal real-time-nya membantu saya mengambil keputusan lebih percaya diri di jam-jam sibuk pasar.', sorotan: false, semua: true, marquee: true },
  { name: 'Nadia Kirana', role: 'Freelancer & Investor, Yogyakarta', accepted: 'Bergabung sejak 2022', photo: 'https://i.pravatar.cc/300?img=47', quote: 'Tiga tahun bersama CIBN PRESTISE, laporan performa berkala benar-benar membantu saya mengevaluasi progres secara objektif.', sorotan: false, semua: true, marquee: true },
  { name: 'Fajar Ramadhan', role: 'Trader Retail, Medan', accepted: 'Bergabung sejak 2024', photo: 'https://i.pravatar.cc/300?img=14', quote: 'Indikator premiumnya presisi dan mudah dipahami meski saya bukan latar belakang finansial.', sorotan: false, semua: true, marquee: true },
  { name: 'Clara Situmorang', role: 'Manajer Investasi, Jakarta', accepted: 'Diterima di Elite Circle', photo: 'https://i.pravatar.cc/300?img=44', quote: 'Ruang diskusi privatnya diisi orang-orang serius. Kualitas percakapannya jauh di atas grup trading pada umumnya.', sorotan: false, semua: true, marquee: true }
];

function _ldEsc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderLandingSub(sub) {
  _ldSub = sub;
  document.querySelectorAll('#ld-sub-tabs-items .dock-item').forEach(b => b.classList.toggle('active-tab', b.dataset.sub === sub));
  document.querySelectorAll('#page-landing .sub-page').forEach(p => p.classList.remove('active'));
  document.getElementById('sub-landing-' + sub)?.classList.add('active');
  // Geser panel supaya item aktif selalu terlihat penuh — berguna saat panel di-scroll
  // vertikal (desktop, banyak section) maupun horizontal (jadi strip di layar sempit).
  document.querySelector(`#ld-sub-tabs-items .dock-item[data-sub="${sub}"]`)
    ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

// ── Sub-tab di dalam LEGAL: Syarat & Ketentuan / Kebijakan Privasi ──
// Pola sama seperti class="sub-tabs" di tab lain (Token/Akun/Keuangan), supaya
// 2 form panjang (syarat-ketentuan.html & kebijakan-privasi.html) tidak lagi
// ditumpuk dalam satu scroll panjang, tapi dipilih lewat pill tab.
function renderLandingLegalSub(sub) {
  document.querySelectorAll('#sub-landing-legal .sub-tab').forEach(t => t.classList.toggle('active', t.dataset.legalSub === sub));
  document.querySelectorAll('#sub-landing-legal .ld-legal-panel').forEach(p => p.classList.toggle('active', p.id === 'ld-legal-' + sub));
}

// ── UPLOAD MEDIA (Logo Hero, Video Hero, Video Promo) ──
function ldRenderMediaPreview(previewId, kind, url) {
  const el = document.getElementById(previewId);
  if (!el) return;
  if (!url) { el.innerHTML = ''; return; }
  el.innerHTML = kind === 'video'
    ? `<video src="${url}" muted loop autoplay playsinline></video>`
    : `<img src="${url}" alt="">`;
}

async function ldHandleMediaUpload(input, kind, slot, previewId) {
  const file = input.files[0];
  if (!file) return;
  const maxMB = kind === 'video' ? 40 : 10;
  if (file.size > maxMB * 1024 * 1024) {
    showToast(`File terlalu besar (maks ${maxMB}MB)`, 'danger');
    input.value = '';
    return;
  }
  const oldUrl = _ldPendingMedia[slot] || '';
  input.disabled = true;
  try {
    const result = await apiUploadLandingMedia(file, kind, slot, oldUrl);
    if (!result || result.error || result.rejected) {
      showToast('Gagal upload: ' + (result?.error || 'tidak diketahui'), 'danger');
    } else if (result.networkError) {
      showToast('Gagal terhubung ke server. Coba lagi.', 'danger');
    } else if (result.url) {
      _ldPendingMedia[slot] = result.url;
      ldRenderMediaPreview(previewId, kind, result.url);
      showToast('File terunggah — klik "Simpan Bagian" untuk menerapkan', 'success');
    }
  } catch (e) {
    showToast('Gagal upload: ' + e.message, 'danger');
  }
  input.disabled = false;
  input.value = '';
}

function ldClearMedia(slot, previewId, btnEl) {
  _ldPendingMedia[slot] = '';
  ldRenderMediaPreview(previewId, slot === 'heroLogo' ? 'image' : 'video', '');
  showToast('Diset ke bawaan — klik "Simpan Bagian" untuk menerapkan', 'success');
}

function _ldFillTeknologiCards(cards) {
  const wrap = document.getElementById('ld-tek-cards');
  if (!wrap) return;
  const list = (Array.isArray(cards) && cards.length === 4) ? cards : LD_TEK_DEFAULTS;
  wrap.innerHTML = list.map((c, i) => `
    <div class="form-row" style="align-items:flex-end">
      <div class="form-group"><label class="form-label" style="font-size:11px">Judul Kartu ${i+1}</label><input class="form-input ld-tek-title" data-i="${i}" type="text" value="${(c.title||'').replace(/"/g,'&quot;')}"></div>
      <div class="form-group"><label class="form-label" style="font-size:11px">Deskripsi Kartu ${i+1}</label><input class="form-input ld-tek-desc" data-i="${i}" type="text" value="${(c.desc||'').replace(/"/g,'&quot;')}"></div>
    </div>`).join('');
}

// ── Sub-tab di dalam TESTIMONI: Teks / Isi Testimoni ──
// Pola sama seperti class="sub-tabs" di tab lain (Token/Akun/Keuangan/Legal) —
// panel dibedakan pakai class "ld-testi-panel" (BUKAN "sub-page") supaya tidak
// ikut ke-reset oleh renderLandingSub() yang membersihkan #page-landing .sub-page.
function renderLandingTestiSub(sub) {
  document.querySelectorAll('#sub-landing-testimoni .sub-tab').forEach(t => t.classList.toggle('active', t.dataset.testiSub === sub));
  document.querySelectorAll('#sub-landing-testimoni .ld-testi-panel').forEach(p => p.classList.toggle('active', p.id === 'ld-testi-panel-' + sub));
}

// ── DAFTAR TESTIMONI (list ala Library Soal/Modul: search + filter kelompok +
// Kelola Kelompok) — kelompok "pendaftaran" & item testimoni disimpan sebagai
// bagian dari JSON `testimoni` yang sama (lewat /api/landing, tanpa tabel baru). ──
let _ldTestiItemsData = [];
let _ldTestiKelompok = [];
let _ldTestiSearch = '';
let _ldTestiKelompokFilter = 'all';
let _ldTestiPendingPhoto = '';

function _ldTestiKelompokNama(kode) {
  if (!kode) return null;
  const k = _ldTestiKelompok.find(x => x.kode === kode);
  return k ? k.nama : null;
}

function _ldFillTestiItems(items) {
  _ldTestiItemsData = (Array.isArray(items) && items.length) ? items.map(t => ({ ...t })) : LD_TESTI_DEFAULTS.map(t => ({ ...t }));
  _renderLdTestiFilters();
  _renderLdTestiList();
}

function _renderLdTestiFilters() {
  if (!document.getElementById('ld-testi-filters')) return;
  const validKodes = _ldTestiKelompok.map(k => k.kode);
  if (_ldTestiKelompokFilter !== 'all' && _ldTestiKelompokFilter !== 'none' && !validKodes.includes(_ldTestiKelompokFilter)) _ldTestiKelompokFilter = 'all';
  const options = [{ value: 'all', label: 'Semua Kelompok' }, { value: 'none', label: 'Tanpa Kelompok' }, ..._ldTestiKelompok.map(k => ({ value: k.kode, label: k.nama }))];
  renderFilterDropdown('ld-testi-filters', { options, current: _ldTestiKelompokFilter, title: 'Kelompok', onSelect: v => { _ldTestiKelompokFilter = v; _renderLdTestiFilters(); _renderLdTestiList(); } });
}

function _renderLdTestiList() {
  const wrap = document.getElementById('ld-testi-list');
  if (!wrap) return;
  let data = _ldTestiItemsData.map((t, i) => ({ ...t, _idx: i }));
  if (_ldTestiSearch) {
    const q = _ldTestiSearch.toLowerCase();
    data = data.filter(t => (t.name || '').toLowerCase().includes(q) || (t.quote || '').toLowerCase().includes(q) || (t.tahun || '').toString().toLowerCase().includes(q) || (_ldTestiKelompokNama(t.kelompokKode) || '').toLowerCase().includes(q));
  }
  if (_ldTestiKelompokFilter === 'none') data = data.filter(t => !t.kelompokKode);
  else if (_ldTestiKelompokFilter !== 'all') data = data.filter(t => t.kelompokKode === _ldTestiKelompokFilter);

  if (!data.length) { wrap.innerHTML = '<div class="empty-state"><p>Belum ada testimoni</p></div>'; return; }

  wrap.innerHTML = data.map((t, i) => {
    const kelNama = _ldTestiKelompokNama(t.kelompokKode);
    const quoteShort = t.quote ? (t.quote.length > 140 ? t.quote.slice(0, 140) + '…' : t.quote) : '';
    const badges = [
      t.sorotan ? '<span class="badge" style="background:rgba(26,90,160,0.1);color:var(--accent)">Sorotan</span>' : '',
      t.semua !== false ? '<span class="badge" style="background:rgba(19,50,89,0.08);color:var(--blue)">Semua Testimoni</span>' : '',
      t.marquee !== false ? '<span class="badge" style="background:rgba(19,50,89,0.08);color:var(--blue)">Marquee</span>' : ''
    ].filter(Boolean).join('');
    return `<div class="card ld-testi-card" style="margin:0 0 12px;padding:14px;animation:fadeUp 0.25s ${i * 0.04}s both">
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div class="ld-media-preview ld-media-preview-square" style="flex-shrink:0">${t.photo ? `<img src="${_ldEsc(t.photo)}" alt="">` : ''}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:14px;color:var(--blue)">${_ldEsc(t.name) || '(Tanpa nama)'}</div>
          <div style="font-size:11px;color:var(--text-sub);margin:2px 0 6px">${_ldEsc(t.role) || ''}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:6px">
            ${kelNama ? `<span class="badge" style="background:rgba(19,50,89,0.08);color:var(--blue)">${_ldEsc(kelNama)}</span>` : '<span class="badge" style="background:rgba(19,50,89,0.06);color:var(--text-sub)">Tanpa Kelompok</span>'}
            ${t.tahun ? `<span style="font-size:11px;color:var(--text-sub)">Diterima ${_ldEsc(t.tahun)}</span>` : ''}
          </div>
          <p style="font-size:12.5px;color:var(--text-sub);margin:0 0 8px;line-height:1.5">${quoteShort ? '"' + _ldEsc(quoteShort) + '"' : ''}</p>
          <div style="display:flex;gap:6px;flex-wrap:wrap">${badges}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn-icon" title="Edit" onclick="openEditTesti(${t._idx})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn-icon danger" title="Hapus" onclick="deleteTestiItem(${t._idx})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Modal Tambah/Edit Testimoni ──
function _populateTestiKelompokSelect(selected) {
  const sel = document.getElementById('ld-testi-form-kelompok'); if (!sel) return;
  sel.innerHTML = '<option value="">-- Pilih Kelompok --</option>' + _ldTestiKelompok.map(k => `<option value="${k.kode}">${_ldEsc(k.nama)}</option>`).join('');
  sel.value = selected || '';
}
function openAddTesti() {
  document.getElementById('ld-testi-form-id').value = '';
  document.getElementById('ld-testi-form-title').textContent = 'Tambah Testimoni';
  document.getElementById('ld-testi-form-name').value = '';
  document.getElementById('ld-testi-form-role').value = '';
  document.getElementById('ld-testi-form-tahun').value = '';
  document.getElementById('ld-testi-form-quote').value = '';
  document.getElementById('ld-testi-form-sorotan').checked = false;
  document.getElementById('ld-testi-form-semua').checked = true;
  document.getElementById('ld-testi-form-marquee').checked = true;
  _ldTestiPendingPhoto = '';
  ldRenderMediaPreview('ld-testi-form-photo-preview', 'image', '');
  _populateTestiKelompokSelect('');
  openModal('ld-testi-form-overlay');
}
function openEditTesti(idx) {
  const t = _ldTestiItemsData[idx]; if (!t) return;
  document.getElementById('ld-testi-form-id').value = idx;
  document.getElementById('ld-testi-form-title').textContent = 'Edit Testimoni';
  document.getElementById('ld-testi-form-name').value = t.name || '';
  document.getElementById('ld-testi-form-role').value = t.role || '';
  document.getElementById('ld-testi-form-tahun').value = t.tahun || '';
  document.getElementById('ld-testi-form-quote').value = t.quote || '';
  document.getElementById('ld-testi-form-sorotan').checked = !!t.sorotan;
  document.getElementById('ld-testi-form-semua').checked = t.semua !== false;
  document.getElementById('ld-testi-form-marquee').checked = t.marquee !== false;
  _ldTestiPendingPhoto = t.photo || '';
  ldRenderMediaPreview('ld-testi-form-photo-preview', 'image', _ldTestiPendingPhoto);
  _populateTestiKelompokSelect(t.kelompokKode || '');
  openModal('ld-testi-form-overlay');
}
async function ldTestiPhotoUpload(input) {
  const file = input.files[0]; if (!file) return;
  if (file.size > 10 * 1024 * 1024) { showToast('File terlalu besar (maks 10MB)', 'danger'); input.value = ''; return; }
  input.disabled = true;
  try {
    const result = await apiUploadLandingMedia(file, 'image', 'testiPhoto-' + Date.now().toString(36), _ldTestiPendingPhoto);
    if (!result || result.error || result.rejected) showToast('Gagal upload: ' + (result?.error || 'tidak diketahui'), 'danger');
    else if (result.networkError) showToast('Gagal terhubung ke server. Coba lagi.', 'danger');
    else if (result.url) { _ldTestiPendingPhoto = result.url; ldRenderMediaPreview('ld-testi-form-photo-preview', 'image', result.url); showToast('Foto terunggah', 'success'); }
  } catch (e) { showToast('Gagal upload: ' + e.message, 'danger'); }
  input.disabled = false; input.value = '';
}
async function submitTestiForm() {
  const idxRaw = document.getElementById('ld-testi-form-id').value;
  const name = document.getElementById('ld-testi-form-name').value.trim();
  const quote = document.getElementById('ld-testi-form-quote').value.trim();
  if (!name || !quote) { showToast('Nama & kutipan testimoni wajib diisi', 'danger'); return; }
  const kelompokKode = document.getElementById('ld-testi-form-kelompok').value || '';
  const sorotanChecked = document.getElementById('ld-testi-form-sorotan').checked;
  const editIdx = idxRaw !== '' ? parseInt(idxRaw) : -1;

  // Sorotan sekarang boleh lebih dari 4, TAPI tidak boleh 2 testimoni dari kelompok
  // pendaftaran yang sama sama-sama jadi Sorotan. Kalau bentrok, tanya dulu (Ganti | Batal)
  // sebelum benar-benar disimpan.
  if (sorotanChecked && kelompokKode) {
    const conflict = _ldTestiItemsData.find((t, i) => i !== editIdx && t.sorotan && t.kelompokKode === kelompokKode);
    if (conflict) {
      const kelNama = _ldTestiKelompokNama(kelompokKode);
      showConfirm(
        'Kelompok Sudah Ada di Sorotan',
        `Kelompok "${kelNama}" sudah punya testimoni Sorotan, yaitu "${conflict.name}". Ganti testimoni sorotan kelompok ini dengan yang baru?`,
        'warning',
        async () => {
          // Ganti: matikan Sorotan milik testimoni lama di kelompok ini, lalu simpan yang baru dengan Sorotan aktif.
          _ldTestiItemsData.forEach(t => { if (t.sorotan && t.kelompokKode === kelompokKode) t.sorotan = false; });
          await _doSubmitTestiForm(editIdx, true);
        },
        {
          yesLabel: 'Ganti',
          noLabel: 'Batal',
          noCb: () => {
            // Batal: tutup pertanyaan, matikan switch Sorotan di form, TIDAK jadi disimpan.
            // Admin harus klik Simpan lagi kalau mau menyimpan (kali ini tanpa Sorotan).
            const sw = document.getElementById('ld-testi-form-sorotan');
            if (sw) sw.checked = false;
          }
        }
      );
      return;
    }
  }
  await _doSubmitTestiForm(editIdx, sorotanChecked);
}
async function _doSubmitTestiForm(editIdx, sorotanValue) {
  const name = document.getElementById('ld-testi-form-name').value.trim();
  const quote = document.getElementById('ld-testi-form-quote').value.trim();
  const kelompokKode = document.getElementById('ld-testi-form-kelompok').value || '';
  const tahun = document.getElementById('ld-testi-form-tahun').value.trim();
  const kelNama = _ldTestiKelompokNama(kelompokKode);
  const item = {
    name,
    role: document.getElementById('ld-testi-form-role').value.trim(),
    photo: _ldTestiPendingPhoto,
    quote,
    kelompokKode,
    tahun,
    accepted: kelNama ? `Diterima di ${kelNama}${tahun ? ' · ' + tahun : ''}` : (tahun ? `Bergabung sejak ${tahun}` : ''),
    sorotan: sorotanValue,
    semua: document.getElementById('ld-testi-form-semua').checked,
    marquee: document.getElementById('ld-testi-form-marquee').checked
  };
  const isEdit = editIdx !== -1;
  if (isEdit) _ldTestiItemsData[editIdx] = item;
  else _ldTestiItemsData.push(item);
  try {
    await saveLandingTestimoni(true);
    closeModal('ld-testi-form-overlay');
    _renderLdTestiList();
    showToast(isEdit ? 'Testimoni diperbarui!' : 'Testimoni ditambahkan!', 'success');
  } catch (e) {
    showToast('Gagal menyimpan: ' + e.message, 'danger');
  }
}
function deleteTestiItem(idx) {
  const t = _ldTestiItemsData[idx]; if (!t) return;
  showConfirm('Hapus Testimoni', `Yakin hapus testimoni "${t.name}"?`, 'danger', async () => {
    const backup = t;
    _ldTestiItemsData.splice(idx, 1);
    _renderLdTestiList();
    try { await saveLandingTestimoni(true); showToast('Testimoni dihapus', 'danger'); }
    catch (e) { _ldTestiItemsData.splice(idx, 0, backup); _renderLdTestiList(); showToast('Gagal menghapus: ' + e.message, 'danger'); }
  });
}

// ── KELOLA KELOMPOK PENDAFTARAN (khusus Testimoni) — pola sama seperti
// "Kelola Kelompok" Soal/Modul, tapi disimpan di dalam JSON testimoni.kelompok
// (bukan tabel DB terpisah) supaya tetap lewat /api/landing generik yang sudah ada. ──
function openTestiKelompokManage() {
  const input = document.getElementById('ld-testi-kelompok-new-input'); if (input) input.value = '';
  _renderTestiKelompokManageList();
  openModal('ld-testi-kelompok-overlay');
}
function _renderTestiKelompokManageList() {
  const el = document.getElementById('ld-testi-kelompok-manage-list'); if (!el) return;
  if (!_ldTestiKelompok.length) { el.innerHTML = '<p style="color:var(--text-sub);font-size:13px">Belum ada kelompok. Tambahkan lewat kolom di atas.</p>'; return; }
  el.innerHTML = _ldTestiKelompok.map(k => `
    <div class="ebook-pick-item" id="ldtkl-row-${k.kode}" style="justify-content:space-between">
      <span id="ldtkl-nama-${k.kode}" style="font-weight:600;font-size:13.5px;color:var(--blue)">${_ldEsc(k.nama)}</span>
      <div class="ldtkl-row-actions" style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn-icon" title="Ganti nama" onclick="_startRenameTestiKelompok('${k.kode}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="btn-icon danger" title="Hapus" onclick="deleteTestiKelompokItem('${k.kode}','${(k.nama || '').replace(/'/g, "\\'")}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
      </div>
    </div>`).join('');
}
async function addTestiKelompok() {
  const input = document.getElementById('ld-testi-kelompok-new-input');
  const nama = (input?.value || '').trim();
  if (!nama) { showToast('Nama kelompok wajib diisi', 'danger'); return; }
  const kode = 'kel_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  _ldTestiKelompok.push({ kode, nama });
  if (input) input.value = '';
  await _afterTestiKelompokChange('Kelompok ditambahkan', 'success');
}
function _startRenameTestiKelompok(kode) {
  const span = document.getElementById(`ldtkl-nama-${kode}`); if (!span) return;
  const current = span.textContent;
  span.outerHTML = `<input id="ldtkl-nama-${kode}" class="form-input" style="padding:6px 10px;font-size:13px" type="text" value="${current.replace(/"/g, '&quot;')}" onkeydown="if(event.key==='Enter')_saveRenameTestiKelompok('${kode}')">`;
  const row = document.getElementById(`ldtkl-row-${kode}`); const actionsWrap = row?.querySelector('.ldtkl-row-actions');
  if (actionsWrap) actionsWrap.innerHTML = `<button class="btn-icon" title="Simpan" onclick="_saveRenameTestiKelompok('${kode}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg></button>`;
  document.getElementById(`ldtkl-nama-${kode}`)?.focus();
}
async function _saveRenameTestiKelompok(kode) {
  const input = document.getElementById(`ldtkl-nama-${kode}`); const nama = (input?.value || '').trim();
  if (!nama) { showToast('Nama kelompok wajib diisi', 'danger'); return; }
  const k = _ldTestiKelompok.find(x => x.kode === kode); if (k) k.nama = nama;
  await _afterTestiKelompokChange('Kelompok diperbarui', 'success');
}
function deleteTestiKelompokItem(kode, nama) {
  showConfirm('Hapus Kelompok', `Yakin hapus kelompok "${nama}"? Testimoni yang ada di kelompok ini akan menjadi tanpa kelompok.`, 'danger', async () => {
    _ldTestiKelompok = _ldTestiKelompok.filter(x => x.kode !== kode);
    _ldTestiItemsData.forEach(t => { if (t.kelompokKode === kode) t.kelompokKode = ''; });
    await _afterTestiKelompokChange('Kelompok dihapus', 'danger');
  });
}
async function _afterTestiKelompokChange(msg, type) {
  _renderTestiKelompokManageList();
  if (document.getElementById('ld-testi-form-kelompok')) _populateTestiKelompokSelect(document.getElementById('ld-testi-form-kelompok').value);
  _renderLdTestiFilters();
  _renderLdTestiList();
  try { await saveLandingTestimoni(true); showToast(msg, type); }
  catch (e) { showToast('Gagal menyimpan: ' + e.message, 'danger'); }
}

async function renderLanding() {
  renderLandingSub(_ldSub || 'hero');
  try {
    _ldData = await LandingAPI.get() || {};
  } catch (e) {
    _ldData = {};
    showToast('Gagal memuat data landing: ' + e.message, 'danger');
  }
  _ldLoaded = true;

  const h = _ldData.hero || {};
  document.getElementById('ld-hero-eyebrow').value = h.eyebrow || '';
  document.getElementById('ld-hero-title-main').value = h.titleMain || '';
  document.getElementById('ld-hero-title-em').value = h.titleEm || '';
  document.getElementById('ld-hero-lead').value = h.lead || '';
  document.getElementById('ld-hero-cta1').value = h.ctaPrimaryText || '';
  document.getElementById('ld-hero-cta2').value = h.ctaSecondaryText || '';
  const stats = Array.isArray(h.stats) && h.stats.length === 3 ? h.stats : [{},{},{}];
  stats.forEach((s, i) => {
    document.getElementById(`ld-hero-stat${i+1}-value`).value = s.value || '';
    document.getElementById(`ld-hero-stat${i+1}-label`).value = s.label || '';
  });
  _ldPendingMedia.heroLogo = h.logoUrl || '';
  _ldPendingMedia.heroVideo = h.videoUrl || '';
  ldRenderMediaPreview('ld-hero-logo-preview', 'image', _ldPendingMedia.heroLogo);
  ldRenderMediaPreview('ld-hero-video-preview', 'video', _ldPendingMedia.heroVideo);

  const t = _ldData.teknologi || {};
  document.getElementById('ld-tek-eyebrow').value = t.eyebrow || '';
  document.getElementById('ld-tek-heading').value = t.heading || '';
  document.getElementById('ld-tek-desc').value = t.desc || '';
  _ldFillTeknologiCards(t.cards);

  const v = _ldData.videoPromo || {};
  document.getElementById('ld-vp-eyebrow').value = v.eyebrow || '';
  document.getElementById('ld-vp-heading').value = v.heading || '';
  document.getElementById('ld-vp-desc').value = v.desc || '';
  document.getElementById('ld-vp-cta').value = v.ctaText || '';
  _ldPendingMedia.videoPromo = v.videoUrl || '';
  ldRenderMediaPreview('ld-vp-video-preview', 'video', _ldPendingMedia.videoPromo);

  const pk = _ldData.paket || {};
  document.getElementById('ld-paket-eyebrow').value = pk.eyebrow || '';
  document.getElementById('ld-paket-title').value = pk.title || '';
  document.getElementById('ld-paket-desc').value = pk.desc || '';
  document.getElementById('ld-paket-prev-eyebrow').value = pk.previewEyebrow || '';
  document.getElementById('ld-paket-prev-heading').value = pk.previewHeading || '';
  document.getElementById('ld-paket-prev-desc').value = pk.previewDesc || '';

  const ts = _ldData.testimoni || {};
  document.getElementById('ld-testi-eyebrow').value = ts.eyebrow || '';
  document.getElementById('ld-testi-title').value = ts.title || '';
  document.getElementById('ld-testi-desc').value = ts.desc || '';
  document.getElementById('ld-testi-prev-eyebrow').value = ts.previewEyebrow || '';
  document.getElementById('ld-testi-prev-heading').value = ts.previewHeading || '';
  document.getElementById('ld-testi-prev-desc').value = ts.previewDesc || '';
  document.getElementById('ld-testi-sorotan-eyebrow').value = ts.sorotanEyebrow || '';
  document.getElementById('ld-testi-sorotan-heading').value = ts.sorotanHeading || '';
  document.getElementById('ld-testi-sorotan-desc').value = ts.sorotanDesc || '';
  document.getElementById('ld-testi-semua-eyebrow').value = ts.semuaEyebrow || '';
  document.getElementById('ld-testi-semua-heading').value = ts.semuaHeading || '';
  document.getElementById('ld-testi-semua-desc').value = ts.semuaDesc || '';
  _ldTestiKelompok = Array.isArray(ts.kelompok) ? ts.kelompok.map(k => ({ ...k })) : [];
  _ldFillTestiItems(ts.items);

  const lg1 = _ldData.legalSyarat || {};
  document.getElementById('ld-syarat-eyebrow').value = lg1.eyebrow || '';
  document.getElementById('ld-syarat-title').value = lg1.title || '';
  document.getElementById('ld-syarat-updated').value = lg1.updated || '';
  document.getElementById('ld-syarat-content').value = lg1.content || '';

  const lg2 = _ldData.legalPrivasi || {};
  document.getElementById('ld-privasi-eyebrow').value = lg2.eyebrow || '';
  document.getElementById('ld-privasi-title').value = lg2.title || '';
  document.getElementById('ld-privasi-updated').value = lg2.updated || '';
  document.getElementById('ld-privasi-content').value = lg2.content || '';

  const f = _ldData.footer || {};
  document.getElementById('ld-footer-desc').value = f.brandDesc || '';
  document.getElementById('ld-footer-email').value = f.email || '';
  document.getElementById('ld-footer-phone').value = f.phone || '';
  document.getElementById('ld-footer-address').value = f.address || '';
  document.getElementById('ld-footer-ig').value = f.instagram || '';
  document.getElementById('ld-footer-tw').value = f.twitter || '';
  document.getElementById('ld-footer-li').value = f.linkedin || '';
  document.getElementById('ld-footer-copy').value = f.copyright || '';
}

async function saveLandingHero() {
  const hero = {
    eyebrow: document.getElementById('ld-hero-eyebrow').value.trim(),
    titleMain: document.getElementById('ld-hero-title-main').value.trim(),
    titleEm: document.getElementById('ld-hero-title-em').value.trim(),
    lead: document.getElementById('ld-hero-lead').value.trim(),
    ctaPrimaryText: document.getElementById('ld-hero-cta1').value.trim(),
    ctaSecondaryText: document.getElementById('ld-hero-cta2').value.trim(),
    stats: [1,2,3].map(i => ({
      value: document.getElementById(`ld-hero-stat${i}-value`).value.trim(),
      label: document.getElementById(`ld-hero-stat${i}-label`).value.trim()
    })),
    logoUrl: _ldPendingMedia.heroLogo,
    videoUrl: _ldPendingMedia.heroVideo
  };
  try { await LandingAPI.save({ hero }); _ldData.hero = hero; showToast('Bagian Hero disimpan!', 'success'); }
  catch (e) { showToast('Gagal menyimpan: ' + e.message, 'danger'); }
}

async function saveLandingTeknologi() {
  const cards = [0,1,2,3].map(i => ({
    title: document.querySelector(`.ld-tek-title[data-i="${i}"]`).value.trim(),
    desc: document.querySelector(`.ld-tek-desc[data-i="${i}"]`).value.trim()
  }));
  const teknologi = {
    eyebrow: document.getElementById('ld-tek-eyebrow').value.trim(),
    heading: document.getElementById('ld-tek-heading').value.trim(),
    desc: document.getElementById('ld-tek-desc').value.trim(),
    cards
  };
  try { await LandingAPI.save({ teknologi }); _ldData.teknologi = teknologi; showToast('Bagian Teknologi disimpan!', 'success'); }
  catch (e) { showToast('Gagal menyimpan: ' + e.message, 'danger'); }
}

async function saveLandingVideoPromo() {
  const videoPromo = {
    eyebrow: document.getElementById('ld-vp-eyebrow').value.trim(),
    heading: document.getElementById('ld-vp-heading').value.trim(),
    desc: document.getElementById('ld-vp-desc').value.trim(),
    ctaText: document.getElementById('ld-vp-cta').value.trim(),
    videoUrl: _ldPendingMedia.videoPromo
  };
  try { await LandingAPI.save({ videoPromo }); _ldData.videoPromo = videoPromo; showToast('Bagian Video Promo disimpan!', 'success'); }
  catch (e) { showToast('Gagal menyimpan: ' + e.message, 'danger'); }
}

async function saveLandingPaket() {
  const paket = {
    eyebrow: document.getElementById('ld-paket-eyebrow').value.trim(),
    title: document.getElementById('ld-paket-title').value.trim(),
    desc: document.getElementById('ld-paket-desc').value.trim(),
    previewEyebrow: document.getElementById('ld-paket-prev-eyebrow').value.trim(),
    previewHeading: document.getElementById('ld-paket-prev-heading').value.trim(),
    previewDesc: document.getElementById('ld-paket-prev-desc').value.trim()
  };
  try { await LandingAPI.save({ paket }); _ldData.paket = paket; showToast('Bagian Paket disimpan!', 'success'); }
  catch (e) { showToast('Gagal menyimpan: ' + e.message, 'danger'); }
}

async function saveLandingTestimoni(silent) {
  const testimoni = {
    eyebrow: document.getElementById('ld-testi-eyebrow').value.trim(),
    title: document.getElementById('ld-testi-title').value.trim(),
    desc: document.getElementById('ld-testi-desc').value.trim(),
    previewEyebrow: document.getElementById('ld-testi-prev-eyebrow').value.trim(),
    previewHeading: document.getElementById('ld-testi-prev-heading').value.trim(),
    previewDesc: document.getElementById('ld-testi-prev-desc').value.trim(),
    sorotanEyebrow: document.getElementById('ld-testi-sorotan-eyebrow').value.trim(),
    sorotanHeading: document.getElementById('ld-testi-sorotan-heading').value.trim(),
    sorotanDesc: document.getElementById('ld-testi-sorotan-desc').value.trim(),
    semuaEyebrow: document.getElementById('ld-testi-semua-eyebrow').value.trim(),
    semuaHeading: document.getElementById('ld-testi-semua-heading').value.trim(),
    semuaDesc: document.getElementById('ld-testi-semua-desc').value.trim(),
    kelompok: _ldTestiKelompok,
    items: _ldTestiItemsData
  };
  try {
    await LandingAPI.save({ testimoni });
    _ldData.testimoni = testimoni;
    if (!silent) showToast('Bagian Testimoni disimpan!', 'success');
  } catch (e) {
    if (!silent) showToast('Gagal menyimpan: ' + e.message, 'danger');
    else throw e;
  }
}

async function saveLandingSyarat() {
  const legalSyarat = {
    eyebrow: document.getElementById('ld-syarat-eyebrow').value.trim(),
    title: document.getElementById('ld-syarat-title').value.trim(),
    updated: document.getElementById('ld-syarat-updated').value.trim(),
    content: document.getElementById('ld-syarat-content').value.trim()
  };
  try { await LandingAPI.save({ legalSyarat }); _ldData.legalSyarat = legalSyarat; showToast('Syarat & Ketentuan disimpan!', 'success'); }
  catch (e) { showToast('Gagal menyimpan: ' + e.message, 'danger'); }
}

async function saveLandingPrivasi() {
  const legalPrivasi = {
    eyebrow: document.getElementById('ld-privasi-eyebrow').value.trim(),
    title: document.getElementById('ld-privasi-title').value.trim(),
    updated: document.getElementById('ld-privasi-updated').value.trim(),
    content: document.getElementById('ld-privasi-content').value.trim()
  };
  try { await LandingAPI.save({ legalPrivasi }); _ldData.legalPrivasi = legalPrivasi; showToast('Kebijakan Privasi disimpan!', 'success'); }
  catch (e) { showToast('Gagal menyimpan: ' + e.message, 'danger'); }
}

async function saveLandingFooter() {
  const footer = {
    brandDesc: document.getElementById('ld-footer-desc').value.trim(),
    email: document.getElementById('ld-footer-email').value.trim(),
    phone: document.getElementById('ld-footer-phone').value.trim(),
    address: document.getElementById('ld-footer-address').value.trim(),
    instagram: document.getElementById('ld-footer-ig').value.trim(),
    twitter: document.getElementById('ld-footer-tw').value.trim(),
    linkedin: document.getElementById('ld-footer-li').value.trim(),
    copyright: document.getElementById('ld-footer-copy').value.trim()
  };
  try { await LandingAPI.save({ footer }); _ldData.footer = footer; showToast('Bagian Footer disimpan!', 'success'); }
  catch (e) { showToast('Gagal menyimpan: ' + e.message, 'danger'); }
}
