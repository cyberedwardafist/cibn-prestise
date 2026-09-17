// ── MANAGEMENT_API: pengaturan integrasi (dock sub EMAIL/Resend | GMEET) ──
// Namanya sengaja dipakai "ManagementAPI"/"management_API" (bukan cuma
// "Management" polos) karena akan ada dock utama baru "Management" khusus utk
// management guru — fungsi & id di sini diberi akhiran API biar tidak tabrakan.
// Data disimpan sebagai satu JSON di tabel `pengaturan_integrasi` (lewat
// /api/pengaturan/integrasi, GET & PUT khusus admin — beda dgn /api/landing yang
// publik, karena di sini ada kredensial (API Key Resend, client secret Google)
// yang tidak boleh ikut bocor). Pola load/merge/save-nya sama persis spt
// admin/landing/landing.js (LandingAPI -> ManagementAPI, lihat js/api.js).
let _mgmtData = {};
let _mgmtLoaded = false;
let _mgmtSub = 'gmail';

function renderManagementAPISub(sub) {
  _mgmtSub = sub;
  document.querySelectorAll('#mgmt-sub-tabs-items .dock-item').forEach(b => b.classList.toggle('active-tab', b.dataset.sub === sub));
  document.querySelectorAll('#page-management_API .sub-page').forEach(p => p.classList.remove('active'));
  document.getElementById('sub-management-api-' + sub)?.classList.add('active');
  document.querySelector(`#mgmt-sub-tabs-items .dock-item[data-sub="${sub}"]`)
    ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  // Log baru dimuat begitu tab GMEET dibuka (bukan tiap kali dock ini
  // dibuka lewat tab GMAIL) — data-nya lumayan bisa berubah tiap saat (room
  // baru nyala/mati kapan aja) jadi selalu tarik ulang tiap kali tab-nya dibuka.
  if (sub === 'gmeet') mgmtLoadGmeetLog();
}

async function renderManagementAPI() {
  if (!_mgmtLoaded) {
    try { _mgmtData = await ManagementAPI.get() || {}; }
    catch (e) { console.error('[management_API] Gagal memuat pengaturan integrasi:', e); _mgmtData = {}; }
    _mgmtLoaded = true;
  }
  _mgmtFillGmail();
  _mgmtFillGmeet();
  renderManagementAPISub(_mgmtSub || 'gmail');
}

// ── EMAIL (Resend) ───────────────────────────────────────────────────────────
// Catatan: kunci data JSON-nya tetap `resend` (dulu `gmail`) di
// pengaturan_integrasi — lihat lib/mailer.js. ID elemen HTML & nama fungsi di
// bawah sengaja dibiarkan pakai akhiran "gmail"/"Gmail" supaya tidak perlu
// mengubah referensi di admin/index_admin.html (dock nav) & tempat lain.
function _mgmtFillGmail() {
  const g = _mgmtData.resend || {};
  const email = document.getElementById('mgmt-gmail-email');
  const key = document.getElementById('mgmt-gmail-app-password');
  const nama = document.getElementById('mgmt-gmail-nama');
  const aktif = document.getElementById('mgmt-gmail-aktif');
  if (email) email.value = g.from_email || '';
  if (key) key.value = g.api_key || '';
  if (nama) nama.value = g.nama_pengirim || '';
  if (aktif) aktif.checked = !!g.aktif;
  _mgmtUpdateGmailBadge(g);
}

function _mgmtUpdateGmailBadge(g) {
  const el = document.getElementById('mgmt-gmail-status-badge');
  if (!el) return;
  if (g && g.from_email && g.aktif && g.terverifikasi) { el.className = 'badge-success'; el.textContent = 'Aktif & Terverifikasi'; }
  else if (g && g.from_email && g.aktif) { el.className = 'badge-success'; el.textContent = 'Aktif'; }
  else if (g && g.from_email) { el.className = 'badge-pending'; el.textContent = 'Tersimpan, Belum Aktif'; }
  else { el.className = 'badge-failed'; el.textContent = 'Belum Diatur'; }
}

async function mgmtSaveGmail() {
  const from_email = document.getElementById('mgmt-gmail-email')?.value.trim() || '';
  const api_key = document.getElementById('mgmt-gmail-app-password')?.value.trim() || '';
  const nama_pengirim = document.getElementById('mgmt-gmail-nama')?.value.trim() || '';
  const aktif = !!document.getElementById('mgmt-gmail-aktif')?.checked;
  if (aktif && !from_email) { showToast('Isi alamat email pengirim dulu sebelum mengaktifkan', 'danger'); return; }
  if (aktif && !api_key) { showToast('Isi API Key Resend dulu sebelum mengaktifkan', 'danger'); return; }

  const btn = document.getElementById('mgmt-gmail-save-btn');
  const label = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
  try {
    // Kalau email/api_key beda dari yang tersimpan sebelumnya, buang status
    // "terverifikasi" lama — itu cuma berlaku utk kredensial yang sudah dites persis.
    const lama = _mgmtData.resend || {};
    const masihSama = lama.from_email === from_email && lama.api_key === api_key;
    const resend = { from_email, api_key, nama_pengirim, aktif, terverifikasi: masihSama ? !!lama.terverifikasi : false };
    await ManagementAPI.save({ resend });
    _mgmtData.resend = resend;
    _mgmtUpdateGmailBadge(resend);
    showToast('Pengaturan Email tersimpan!', 'success');
  } catch (e) {
    showToast('Gagal menyimpan: ' + e.message, 'danger');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }
}

// Tombol "Tes Koneksi & Kirim Email Percobaan" — beda dari Simpan di atas: ini
// benar-benar menghubungi Resend lalu kirim 1 email percobaan, supaya admin
// tahu API Key yang diisi bener-bener valid, bukan cuma tersimpan ke DB.
// Simpan dulu sebelum tes, supaya yang diverifikasi adalah nilai yang baru
// diketik (bukan nilai lama yang masih tersimpan di server).
async function mgmtTestGmail() {
  const btn = document.getElementById('mgmt-gmail-test-btn');
  const label = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Menguji koneksi...'; }
  try {
    await mgmtSaveGmail();
    const res = await ManagementAPI.testEmail();
    // Tandai terverifikasi & simpan, supaya badge "Aktif & Terverifikasi" tetap
    // muncul walau admin buka ulang halaman ini nanti (bukan cuma sesi ini saja).
    const resend = { ..._mgmtData.resend, terverifikasi: true };
    await ManagementAPI.save({ resend });
    _mgmtData.resend = resend;
    _mgmtUpdateGmailBadge(resend);
    showToast(res?.message || 'Email percobaan terkirim!', 'success');
  } catch (e) {
    showToast('Gagal: ' + e.message, 'danger');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }
}

// ── GMEET (integrasi ASLI — OAuth Google + Calendar API, lihat lib/gmeet.js &
// GET/PUT /api/pengaturan/integrasi, GET /api/gmeet/oauth/url|callback,
// POST /api/gmeet/oauth/disconnect di server.js) ──
function _mgmtFillGmeet() {
  const g = _mgmtData.gmeet || {};
  const cid = document.getElementById('mgmt-gmeet-client-id');
  const secret = document.getElementById('mgmt-gmeet-client-secret');
  const cal = document.getElementById('mgmt-gmeet-calendar-id');
  const durasi = document.getElementById('mgmt-gmeet-durasi');
  if (cid) cid.value = g.client_id || '';
  // client_secret & refresh_token SENGAJA tidak pernah dikirim balik oleh
  // server (lihat GET /api/pengaturan/integrasi) — field ini dibiarkan kosong
  // kalau memang sudah pernah diisi sebelumnya, placeholder-nya menandakan itu
  // supaya admin tidak salah kira belum pernah disimpan.
  if (secret) secret.placeholder = g.client_id ? '•••••••• (tersimpan, isi ulang kalau mau ganti)' : 'Client secret dari Google Cloud Console';
  if (cal) cal.value = g.calendar_id || 'primary';
  if (durasi) durasi.value = g.durasi_default || 60;
  _mgmtUpdateGmeetBadge(g);
  const connectBtn = document.getElementById('mgmt-gmeet-connect-btn');
  if (connectBtn) connectBtn.textContent = (g.status === 'terhubung') ? 'Hubungkan Ulang Akun Google' : 'Hubungkan Akun Google';
  const disconnectBtn = document.getElementById('mgmt-gmeet-disconnect-btn');
  if (disconnectBtn) disconnectBtn.style.display = (g.status === 'terhubung') ? '' : 'none';
}

function _mgmtUpdateGmeetBadge(g) {
  const el = document.getElementById('mgmt-gmeet-status-badge');
  if (!el) return;
  const status = (g && g.status) || 'belum_terhubung';
  if (status === 'terhubung') { el.className = 'badge-success'; el.textContent = 'Terhubung'; }
  else if (status === 'terputus') { el.className = 'badge-failed'; el.textContent = 'Terputus (token dicabut) — Hubungkan Ulang'; }
  else { el.className = 'badge-pending'; el.textContent = 'Belum Terhubung'; }
}

async function mgmtSaveGmeet() {
  const client_id = document.getElementById('mgmt-gmeet-client-id')?.value.trim() || '';
  const client_secret = document.getElementById('mgmt-gmeet-client-secret')?.value.trim() || '';
  const calendar_id = document.getElementById('mgmt-gmeet-calendar-id')?.value.trim() || 'primary';
  const durasi_default = Number(document.getElementById('mgmt-gmeet-durasi')?.value) || 60;

  const btn = document.getElementById('mgmt-gmeet-save-btn');
  const label = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
  try {
    // client_secret cuma dikirim kalau admin memang mengisi ulang field-nya
    // (dibiarkan kosong = pertahankan secret lama di server, lihat PUT
    // /api/pengaturan/integrasi yg meng-COALESCE lewat spread merge).
    const gmeet = { client_id, calendar_id, durasi_default };
    if (client_secret) gmeet.client_secret = client_secret;
    await ManagementAPI.save({ gmeet });
    _mgmtData.gmeet = { ..._mgmtData.gmeet, ...gmeet };
    _mgmtFillGmeet();
    showToast('Pengaturan Gmeet tersimpan!', 'success');
  } catch (e) {
    showToast('Gagal menyimpan: ' + e.message, 'danger');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }
}

// Tombol "Hubungkan Akun Google" — alur OAuth ASLI: minta URL consent ke
// server (butuh Client ID & Secret sudah tersimpan lebih dulu), lalu browser
// diarahkan PENUH ke layar consent Google (BUKAN fetch/AJAX biasa, harus
// navigasi browser sungguhan supaya admin bisa login & approve akunnya).
// Setelah admin approve, Google redirect balik ke /index_admin?gmeet=connected
// (lihat GET /api/gmeet/oauth/callback di server.js & handler query-string di
// admin/index_admin.html) — jadi TIDAK ada kode lanjutan di sini setelah
// window.location.href, halaman ini akan ditinggalkan sepenuhnya.
async function mgmtConnectGmeet() {
  const btn = document.getElementById('mgmt-gmeet-connect-btn');
  const label = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Menyiapkan...'; }
  try {
    // Simpan dulu pengaturan yang lagi diketik (client_id/secret/calendar_id/
    // durasi) supaya yang dipakai buat consent adalah nilai TERBARU di form,
    // bukan yang sempat tersimpan sebelumnya.
    await mgmtSaveGmeet();
    const { url } = await apiFetch('/gmeet/oauth/url');
    if (!url) throw new Error('Server tidak mengembalikan URL consent Google');
    window.location.href = url;
  } catch (e) {
    showToast('Gagal memulai koneksi Google: ' + e.message, 'danger');
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }
}

async function mgmtDisconnectGmeet() {
  if (!confirm('Putuskan koneksi akun Google untuk fitur Jadwal? Sesi yang sedang berlangsung tidak terpengaruh, tapi sesi baru tidak akan mendapat link Meet otomatis sampai dihubungkan ulang.')) return;
  const btn = document.getElementById('mgmt-gmeet-disconnect-btn');
  const label = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Memutuskan...'; }
  try {
    await apiFetch('/gmeet/oauth/disconnect', { method: 'POST' });
    _mgmtData.gmeet = { ..._mgmtData.gmeet, status: 'belum_terhubung' };
    _mgmtFillGmeet();
    showToast('Koneksi akun Google diputuskan', 'success');
  } catch (e) {
    showToast('Gagal memutuskan koneksi: ' + e.message, 'danger');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }
}

// Dipanggil dari admin/index_admin.html begitu halaman ini dimuat ulang
// setelah redirect balik dari Google (?gmeet=connected|error&msg=...) — lihat
// initGmeetOauthReturnHandler() di sana.
function _mgmtHandleGmeetOauthReturn(status, msg) {
  if (status === 'connected') {
    showToast('Akun Google berhasil terhubung! Room Meet otomatis kini aktif untuk fitur Jadwal.', 'success');
    _mgmtLoaded = false; // paksa reload data (status/refresh_token) dari server pas dock GMEET dibuka
  } else if (status === 'error') {
    showToast('Gagal terhubung ke Google: ' + (msg || 'Terjadi kesalahan'), 'danger');
  }
}

// ── LOG & RIWAYAT PENGGUNAAN GMEET ────────────────────────────────────────
// 1 baris tabel = 1 sesi jadwal_sesi. Default (tanpa filter Tentor/Murid,
// tanggal = hari ini) = log harian biasa (kalau jam 09.45 ada 6 tentor
// mengajar bersamaan, kelihatan 6 baris terpisah jam yang sama, masing2
// link/tentor/murid/materi sendiri2). Isi filter Tentor/Murid dan/atau
// lebarkan rentang tanggal (atau kosongkan) + centang "Riwayat penuh" buat
// memantau PERGERAKAN 1 guru/murid tertentu dari waktu ke waktu.
let _mgmtGmeetLogRows = [];
let _mgmtGmeetTentorListLoaded = false;

async function _mgmtLoadGmeetTentorList() {
  if (_mgmtGmeetTentorListLoaded) return;
  const sel = document.getElementById('mgmt-gmeet-log-tentor');
  if (!sel) return;
  try {
    const metaData = await apiFetch('/jadwal-meta');
    const gurus = (metaData && metaData.gurus) || [];
    gurus.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.kode; opt.textContent = g.nama;
      sel.appendChild(opt);
    });
    _mgmtGmeetTentorListLoaded = true;
  } catch (e) { console.error('[management_API] Gagal memuat daftar tentor:', e); }
}

// Debounce input "Cari Murid" — jangan tembak request tiap 1 huruf diketik.
let _mgmtGmeetMuridDebounceTimer = null;
function _mgmtGmeetLogMuridDebounced() {
  clearTimeout(_mgmtGmeetMuridDebounceTimer);
  _mgmtGmeetMuridDebounceTimer = setTimeout(mgmtLoadGmeetLog, 450);
}

function mgmtResetGmeetLogFilter() {
  const tentor = document.getElementById('mgmt-gmeet-log-tentor');
  const murid = document.getElementById('mgmt-gmeet-log-murid');
  const dari = document.getElementById('mgmt-gmeet-log-dari');
  const sampai = document.getElementById('mgmt-gmeet-log-sampai');
  const semua = document.getElementById('mgmt-gmeet-log-semua');
  const statusFilter = document.getElementById('mgmt-gmeet-log-status-filter');
  if (tentor) tentor.value = '';
  if (murid) murid.value = '';
  if (semua) semua.checked = false;
  if (statusFilter) statusFilter.value = '';
  const pad = n => String(n).padStart(2, '0');
  const d = new Date();
  const todayStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (dari) dari.value = todayStr;
  if (sampai) sampai.value = todayStr;
  mgmtLoadGmeetLog();
}

async function mgmtLoadGmeetLog() {
  _mgmtLoadGmeetTentorList();
  const tbody = document.getElementById('mgmt-gmeet-log-tbody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Memuat...</p></div></td></tr>`;
  try {
    const dari = document.getElementById('mgmt-gmeet-log-dari')?.value || '';
    const sampai = document.getElementById('mgmt-gmeet-log-sampai')?.value || '';
    const tentorId = document.getElementById('mgmt-gmeet-log-tentor')?.value || '';
    const murid = document.getElementById('mgmt-gmeet-log-murid')?.value.trim() || '';
    const semua = document.getElementById('mgmt-gmeet-log-semua')?.checked;
    const params = new URLSearchParams();
    // dari === sampai (kasus umum: 1 tanggal spesifik) dikirim sbg `tanggal`
    // tunggal — lebih persis (server: WHERE tanggal = ?), bukan >= DAN <=.
    if (dari && dari === sampai) params.set('tanggal', dari);
    else {
      if (dari) params.set('dari', dari);
      if (sampai) params.set('sampai', sampai);
    }
    if (tentorId) params.set('tentor_id', tentorId);
    if (murid) params.set('murid', murid);
    if (semua) params.set('semua', '1');
    const qs = params.toString();
    _mgmtGmeetLogRows = await apiFetch('/admin/gmeet-log' + (qs ? '?' + qs : '')) || [];
  } catch (e) {
    _mgmtGmeetLogRows = [];
    if (tbody) tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Gagal memuat log: ${e.message}</p></div></td></tr>`;
    return;
  }
  mgmtRenderGmeetLog();
}

function _mgmtGmeetJamLabel(row) {
  const fmt = (iso) => {
    if (!iso) return '-';
    const t = String(iso).split('T')[1];
    return t ? t.slice(0, 5) : '-';
  };
  return `${fmt(row.waktu_mulai)}–${fmt(row.waktu_selesai)}`;
}

// Label & warna badge status — dipakai jga di sini, terpisah dari
// JDW_STATUS_LABEL milik user/jadwal/jadwal.js & review/jadwal/jadwal.js
// (halaman berbeda, tidak saling load file JS-nya) tapi teksnya SENGAJA
// disamakan biar konsisten dgn yang dilihat murid/tentor.
const MGMT_GMEET_STATUS_MAP = {
  berlangsung: { label: 'Menyala', cls: 'badge-success' },
  selesai: { label: 'Selesai', cls: 'badge-pending' },
  pending: { label: 'Menunggu', cls: 'badge-pending' },
  butuh_persetujuan: { label: 'Butuh Persetujuan', cls: 'badge-pending' },
  acc: { label: 'Disetujui', cls: 'badge-pending' },
  feedback: { label: 'Feedback', cls: 'badge-pending' },
  resejuel: { label: 'Jadwal Ulang', cls: 'badge-pending' },
  pengajuan_pembatalan: { label: 'Pengajuan Batal', cls: 'badge-pending' },
  pengajuan_batal_tentor: { label: 'Pengajuan Batal (Tentor)', cls: 'badge-pending' },
  murid_batal: { label: 'Pengajuan Batal (Murid)', cls: 'badge-pending' },
  murid_reschedule: { label: 'Pengajuan Jadwal Ulang', cls: 'badge-pending' },
  batal: { label: 'Dibatalkan', cls: 'badge-failed' },
  ditolak: { label: 'Ditolak', cls: 'badge-failed' },
};
function _mgmtGmeetStatusBadge(status) {
  const m = MGMT_GMEET_STATUS_MAP[status] || { label: status || '-', cls: 'badge-pending' };
  return `<span class="${m.cls}">${m.label}</span>`;
}

function mgmtRenderGmeetLog() {
  const tbody = document.getElementById('mgmt-gmeet-log-tbody');
  const summary = document.getElementById('mgmt-gmeet-log-summary');
  if (!tbody) return;
  const filter = document.getElementById('mgmt-gmeet-log-status-filter')?.value || '';
  let rows = _mgmtGmeetLogRows;
  if (filter === 'berlangsung') rows = rows.filter(r => r.status === 'berlangsung');
  else if (filter === 'lainnya') rows = rows.filter(r => r.status !== 'berlangsung');

  const menyalaCount = _mgmtGmeetLogRows.filter(r => r.status === 'berlangsung').length;
  if (summary) summary.textContent = `${_mgmtGmeetLogRows.length} baris tercatat — ${menyalaCount} sedang Menyala saat ini.`;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Tidak ada data pada tanggal/filter ini</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const link = r.meet_link
      ? `<a href="${r.meet_link}" target="_blank" rel="noopener" style="font-size:.8rem">${r.meet_link.replace('https://', '')}</a>`
      : '<span style="opacity:.6;font-size:.8rem">-</span>';
    return `<tr>
      <td class="hide-mobile">${r.tanggal || '-'}</td>
      <td class="mono">${_mgmtGmeetJamLabel(r)}</td>
      <td>${r.tentor_nama || '-'}</td>
      <td class="hide-mobile">${r.materi_nama || '-'}</td>
      <td>${r.nama || '-'}</td>
      <td>${_mgmtGmeetStatusBadge(r.status)}</td>
      <td>${link}</td>
    </tr>`;
  }).join('');
}
