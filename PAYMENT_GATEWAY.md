# Payment Gateway Real (Midtrans / Xendit)

Fitur ini menghubungkan CIBN PRESTISE ke payment gateway sungguhan lewat panel
**Admin → Keuangan → Payment Gateway**. Selama gateway belum diaktifkan, sistem
tetap memakai alur lama (konfirmasi manual "Saya Sudah Bayar" → admin verifikasi).

## Yang berubah

- Tabel baru: `payment_gateway_config` (kredensial, tersimpan di server saja) dan
  `transaksi` (log transaksi asli dari Midtrans/Xendit).
- Endpoint baru di `server.js`:
  - `GET/POST /api/admin/gateway` — admin isi & aktifkan gateway.
  - `GET /api/admin/transaksi` — daftar transaksi asli.
  - `GET /api/pembayaran/gateway-status` — publik, cuma bilang provider mana yang aktif.
  - `POST /api/pembayaran/create` — bikin transaksi Snap/Invoice/QRIS asli.
  - `GET /api/pembayaran/status/:order_id` — cek status (dipakai polling di `qris.html`).
  - `POST /api/pembayaran/notify/midtrans` & `/notify/xendit` — webhook, otomatis
    mengaktifkan paket user begitu pembayaran sukses.
- `pembayaran.html` & `qris.html` otomatis pakai jalur real-time kalau gateway
  aktif & paket punya kode valid; kalau tidak, fallback ke alur manual seperti biasa.

## Langkah setup

### 1. Midtrans
1. Daftar/masuk ke [dashboard.midtrans.com](https://dashboard.midtrans.com) (Sandbox dulu untuk testing).
2. Ambil **Server Key** & **Client Key** di Settings → Access Keys.
3. Di Admin → Keuangan → Payment Gateway, isi kedua key itu + pilih mode
   Sandbox/Production, lalu **Simpan Konfigurasi Midtrans**.
4. Salin **Payment Notification URL** yang muncul di panel (`.../api/pembayaran/notify/midtrans`)
   dan tempel di dashboard Midtrans: Settings → Configuration → Payment Notification URL.
5. Set **Gateway Aktif** ke "Midtrans" lalu klik **Terapkan Gateway Aktif**.

### 2. Xendit
1. Daftar/masuk ke [dashboard.xendit.co](https://dashboard.xendit.co).
2. Ambil **Secret Key** di Settings → API Keys.
3. Buat **Verification Token** di Settings → Developers → Webhooks.
4. Di Admin → Keuangan → Payment Gateway, isi Secret Key + Verification Token,
   lalu **Simpan Konfigurasi Xendit**.
5. Salin **Callback URL** (`.../api/pembayaran/notify/xendit`) dan daftarkan di
   dashboard Xendit untuk event **Invoice Paid** dan **QR Code Payment**.
6. Set **Gateway Aktif** ke "Xendit" lalu klik **Terapkan Gateway Aktif**.

### 3. Wajib HTTPS publik untuk webhook
Midtrans & Xendit memanggil webhook dari server mereka, jadi domain aplikasi
harus bisa diakses dari internet (bukan `localhost`). Untuk testing lokal,
pakai tunnel seperti `ngrok`/`cloudflared` dan pastikan URL yang didaftarkan
ke dashboard Midtrans/Xendit adalah URL publik itu, bukan `localhost`.

### 4. Node.js
Kode payment gateway memakai `fetch` bawaan Node.js, jadi butuh **Node.js 18
ke atas** (sudah ditandai di `package.json` → `engines.node`).

## Catatan keamanan
- Server Key/Secret Key tidak pernah dikirim balik ke browser dalam bentuk
  asli — panel admin hanya menampilkan versi tersamar (mis. `SB-Mid-••••••••1234`).
  Field kosong saat disimpan berarti "jangan ganti key yang sudah tersimpan".
- Webhook Midtrans diverifikasi pakai signature SHA-512; webhook Xendit
  diverifikasi pakai header `x-callback-token`. Request tanpa verifikasi valid
  akan ditolak (403), tidak akan mengaktifkan paket siapa pun.
- Aktivasi paket otomatis hanya terjadi setelah gateway benar-benar mengonfirmasi
  status sukses lewat webhook — bukan dari respons `create` di sisi klien.
