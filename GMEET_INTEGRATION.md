# Google Meet Real (OAuth 2.0 + Google Calendar API)

Fitur ini menghubungkan fitur **Jadwal** (halaman User & Review) ke akun Google
sungguhan lewat panel **Admin → Management → GMEET**. Selama belum terhubung,
sesi Jadwal tetap bisa berjalan seperti biasa — hanya saja link Google Meet-nya
tidak otomatis dibuat (lihat "Perilaku kalau belum/putus terhubung" di bawah).

## Cara kerja

1. Sesi Jadwal (`jadwal_sesi`) diajukan murid → disetujui tentor/admin →
   berstatus `pending`/`acc`.
2. Begitu jam mulai slot-nya tiba, entri otomatis "maju" jadi status
   `berlangsung` (client-side, lihat `_jdwAutoAdvanceStatus` di
   `user/jadwal/jadwal.js` & `review/jadwal/jadwal.js`) yang mengirim
   `PUT /api/jadwal-sesi/:kode`.
3. Server (lihat `generateMeetLinkSaatBerlangsung` di `server.js` &
   `lib/gmeet.js`) mendeteksi transisi itu, lalu — kalau akun Google sudah
   terhubung — membuat **1 event Google Calendar baru** lewat Calendar API
   dengan `conferenceData` (`hangoutsMeet`). Google sendiri yang membuatkan
   room Meet-nya, linknya disimpan ke kolom `meet_link`.
4. Karena tiap baris `jadwal_sesi` = 1 pasangan tentor+murid+jam yang beda,
   tiap sesi otomatis dapat link **berbeda** walau tanggal/jam-nya persis
   sama dengan sesi pasangan lain.
5. Link itu tampil ke murid & tentor yang bersangkutan di overlay
   "Sesi Berlangsung" masing-masing (tombol "Masuk"/"Mulai" pada kartu
   jadwal).
6. Durasi room Meet-nya (jam mulai s/d jam selesai event Calendar) memakai
   field **Durasi Default (menit)** yang diatur di panel GMEET — bukan durasi
   slot jadwal itu sendiri.

## Langkah setup

1. Buka [console.cloud.google.com](https://console.cloud.google.com), buat/pilih
   sebuah project, lalu aktifkan **Google Calendar API** (APIs & Services →
   Library → cari "Google Calendar API" → Enable).
2. APIs & Services → **OAuth consent screen**: isi info aplikasi dasar (nama,
   email support). Kalau app masih "Testing", tambahkan email akun Google
   yang akan dipakai (akun yang kalendernya jadi tempat event Meet dibuat)
   sebagai **Test user**.
3. APIs & Services → **Credentials** → Create Credentials → **OAuth client ID**
   → tipe **Web application**.
4. Di **Authorized redirect URIs**, tambahkan persis URL yang muncul di panel
   Admin → Management → GMEET (`https://domain-kamu.com/api/gmeet/oauth/callback`).
5. Salin **Client ID** & **Client Secret** yang muncul, tempel ke panel
   Admin → Management → GMEET, isi juga **Calendar ID** (biarkan `primary`
   kalau mau pakai kalender utama akun Google itu) & **Durasi Default**, lalu
   klik **Simpan Pengaturan Gmeet**.
6. Klik **Hubungkan Akun Google** — kamu akan diarahkan ke layar consent
   Google, login & approve akses "Google Calendar" dengan akun yang tadi
   didaftarkan sebagai test user. Setelah disetujui, kamu diarahkan balik ke
   panel admin dengan badge status berubah jadi **Terhubung**.

## Perilaku kalau belum/putus terhubung

`generateMeetLinkSaatBerlangsung` di `server.js` **best-effort**: kalau akun
Google belum terhubung, token kadaluarsa & gagal di-refresh (mis. akses
dicabut manual di myaccount.google.com/permissions), atau Google API sedang
bermasalah — `meet_link` dibiarkan kosong & sesi **tetap** boleh lanjut masuk
status "berlangsung" (error-nya cuma dicatat di log server). Murid/tentor akan
melihat status "Sedang disiapkan..." pada link Meet di overlay "Sesi
Berlangsung", dengan tombol **Cek Lagi** untuk memuat ulang begitu integrasi
sudah dibetulkan/terhubung kembali. Ini disengaja — jangan sampai gangguan
pihak ketiga memblokir kelas yang sudah waktunya mulai.

## Kredensial

- `client_id`, `calendar_id`, `durasi_default` tersimpan & bisa dibaca lagi di
  panel admin (`GET /api/pengaturan/integrasi`).
- `client_secret` & `refresh_token` **tidak pernah** dikirim balik ke
  browser begitu tersimpan — field Client Secret di panel akan kosong lagi
  setelah reload (placeholder menandakan sudah tersimpan), isi ulang cuma
  kalau memang mau menggantinya.
