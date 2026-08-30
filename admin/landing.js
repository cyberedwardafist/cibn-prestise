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

function _ldTestiItemRow(t) {
  t = t || {};
  return `
    <div class="card ld-testi-item" style="margin:0 0 12px;padding:14px">
      <div class="form-row">
        <div class="form-group"><label class="form-label" style="font-size:11px">Nama</label><input class="form-input ld-ti-name" type="text" value="${_ldEsc(t.name)}" placeholder="Nama anggota"></div>
        <div class="form-group"><label class="form-label" style="font-size:11px">Peran / Kota</label><input class="form-input ld-ti-role" type="text" value="${_ldEsc(t.role)}" placeholder="Trader Retail, Surabaya"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label" style="font-size:11px">Status Keanggotaan</label><input class="form-input ld-ti-accepted" type="text" value="${_ldEsc(t.accepted)}" placeholder="Bergabung sejak 2024"></div>
        <div class="form-group"><label class="form-label" style="font-size:11px">URL Foto</label><input class="form-input ld-ti-photo" type="text" value="${_ldEsc(t.photo)}" placeholder="https://..."></div>
      </div>
      <div class="form-group"><label class="form-label" style="font-size:11px">Kutipan Testimoni</label><textarea class="form-input ld-ti-quote" rows="2" placeholder="Isi testimoni...">${_ldEsc(t.quote)}</textarea></div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:6px;align-items:center">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;cursor:pointer"><input type="checkbox" class="ld-ti-sorotan" ${t.sorotan ? 'checked' : ''}> Sorotan</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;cursor:pointer"><input type="checkbox" class="ld-ti-semua" ${t.semua !== false ? 'checked' : ''}> Semua Testimoni</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;cursor:pointer"><input type="checkbox" class="ld-ti-marquee" ${t.marquee !== false ? 'checked' : ''}> Marquee Berjalan</label>
        <button type="button" class="btn btn-danger" style="margin-left:auto;padding:6px 12px;font-size:12px" onclick="this.closest('.ld-testi-item').remove()">Hapus</button>
      </div>
    </div>`;
}

function _ldFillTestiItems(items) {
  const wrap = document.getElementById('ld-testi-items');
  if (!wrap) return;
  const list = (Array.isArray(items) && items.length) ? items : LD_TESTI_DEFAULTS;
  wrap.innerHTML = list.map(_ldTestiItemRow).join('');
}

function ldAddTestiItem() {
  const wrap = document.getElementById('ld-testi-items');
  if (!wrap) return;
  wrap.insertAdjacentHTML('beforeend', _ldTestiItemRow({ semua: true, marquee: true }));
  wrap.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

async function saveLandingTestimoni() {
  const items = [...document.querySelectorAll('#ld-testi-items .ld-testi-item')].map(row => ({
    name: row.querySelector('.ld-ti-name').value.trim(),
    role: row.querySelector('.ld-ti-role').value.trim(),
    accepted: row.querySelector('.ld-ti-accepted').value.trim(),
    photo: row.querySelector('.ld-ti-photo').value.trim(),
    quote: row.querySelector('.ld-ti-quote').value.trim(),
    sorotan: row.querySelector('.ld-ti-sorotan').checked,
    semua: row.querySelector('.ld-ti-semua').checked,
    marquee: row.querySelector('.ld-ti-marquee').checked
  })).filter(t => t.name && t.quote);

  if (!items.length) {
    showToast('Isi minimal satu testimoni (nama & kutipan) sebelum menyimpan.', 'danger');
    return;
  }

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
    items
  };
  try { await LandingAPI.save({ testimoni }); _ldData.testimoni = testimoni; showToast('Bagian Testimoni disimpan!', 'success'); }
  catch (e) { showToast('Gagal menyimpan: ' + e.message, 'danger'); }
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
