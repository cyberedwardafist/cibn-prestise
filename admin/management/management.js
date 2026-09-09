// ── MANAGEMENT: pengaturan integrasi (dock sub EMAIL/Resend | GMEET) ──
// Data disimpan sebagai satu JSON di tabel `pengaturan_integrasi` (lewat
// /api/pengaturan/integrasi, GET & PUT khusus admin — beda dgn /api/landing yang
// publik, karena di sini ada kredensial (API Key Resend, client secret Google)
// yang tidak boleh ikut bocor). Pola load/merge/save-nya sama persis spt
// admin/landing/landing.js (LandingAPI -> ManagementAPI, lihat js/api.js).
let _mgmtData = {};
let _mgmtLoaded = false;
let _mgmtSub = 'gmail';

function renderManagementSub(sub) {
  _mgmtSub = sub;
  document.querySelectorAll('#mgmt-sub-tabs-items .dock-item').forEach(b => b.classList.toggle('active-tab', b.dataset.sub === sub));
  document.querySelectorAll('#page-management .sub-page').forEach(p => p.classList.remove('active'));
  document.getElementById('sub-management-' + sub)?.classList.add('active');
  document.querySelector(`#mgmt-sub-tabs-items .dock-item[data-sub="${sub}"]`)
    ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

async function renderManagement() {
  if (!_mgmtLoaded) {
    try { _mgmtData = await ManagementAPI.get() || {}; }
    catch (e) { console.error('[management] Gagal memuat pengaturan integrasi:', e); _mgmtData = {}; }
    _mgmtLoaded = true;
  }
  _mgmtFillGmail();
  _mgmtFillGmeet();
  renderManagementSub(_mgmtSub || 'gmail');
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

// ── GMEET (masih dummy — lihat catatan di admin/management/management.html) ──
function _mgmtFillGmeet() {
  const g = _mgmtData.gmeet || {};
  const cid = document.getElementById('mgmt-gmeet-client-id');
  const secret = document.getElementById('mgmt-gmeet-client-secret');
  const cal = document.getElementById('mgmt-gmeet-calendar-id');
  const durasi = document.getElementById('mgmt-gmeet-durasi');
  if (cid) cid.value = g.client_id || '';
  if (secret) secret.value = g.client_secret || '';
  if (cal) cal.value = g.calendar_id || 'primary';
  if (durasi) durasi.value = g.durasi_default || 60;
  _mgmtUpdateGmeetBadge(g);
}

function _mgmtUpdateGmeetBadge(g) {
  const el = document.getElementById('mgmt-gmeet-status-badge');
  if (!el) return;
  const status = (g && g.status) || 'belum_terhubung';
  if (status === 'terhubung') { el.className = 'badge-success'; el.textContent = 'Terhubung'; }
  else { el.className = 'badge-pending'; el.textContent = 'Dummy / Belum Terhubung'; }
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
    const gmeet = { ..._mgmtData.gmeet, client_id, client_secret, calendar_id, durasi_default, status: (_mgmtData.gmeet && _mgmtData.gmeet.status) || 'belum_terhubung' };
    await ManagementAPI.save({ gmeet });
    _mgmtData.gmeet = gmeet;
    _mgmtUpdateGmeetBadge(gmeet);
    showToast('Pengaturan Gmeet tersimpan (masih dummy)!', 'success');
  } catch (e) {
    showToast('Gagal menyimpan: ' + e.message, 'danger');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }
}

// Tombol "Hubungkan Akun Google" — SENGAJA masih dummy: belum ada alur OAuth
// Google beneran di backend, jadi tombol ini cuma menandai status "terhubung"
// secara lokal (tersimpan ke DB) supaya bagian Jadwal (user/review) yang akan
// dibangun berikutnya sudah punya sinyal status utk ditampilkan, walau link
// Meet asli belum benar-benar dibuat. Ganti isi fungsi ini nanti begitu OAuth
// Google beneran dipasang (redirect ke consent screen, simpan refresh_token dst).
async function mgmtDummyConnectGmeet() {
  const btn = document.getElementById('mgmt-gmeet-connect-btn');
  const label = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Menghubungkan...'; }
  try {
    await new Promise(r => setTimeout(r, 600));
    const gmeet = { ..._mgmtData.gmeet, status: 'terhubung' };
    await ManagementAPI.save({ gmeet });
    _mgmtData.gmeet = gmeet;
    _mgmtUpdateGmeetBadge(gmeet);
    showToast('Status ditandai "Terhubung" — ini masih placeholder, integrasi asli menyusul', '');
  } catch (e) {
    showToast('Gagal update status: ' + e.message, 'danger');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }
}
