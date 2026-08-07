# Migrasi CIBN PRESTISE: SQLite → PostgreSQL

Dokumen ini menjelaskan apa saja yang berubah dari versi lama (better-sqlite3)
ke versi ini (PostgreSQL), dan cara menjalankan/migrasi datanya.

## Apa yang berubah, apa yang TIDAK berubah

**TIDAK berubah** (sengaja dipertahankan sama persis):
- Seluruh nama tabel & nama kolom.
- Seluruh endpoint REST API (`/api/...`) — request/response JSON identik.
- Seluruh file frontend (`*.html`, `css/`, `js/`) — **tidak ada satu baris pun
  yang diedit**, karena frontend hanya bicara ke REST API, bukan ke database
  secara langsung.
- Alur bisnis (login, ujian, token, paket, laporan, upload ebook/gambar, dll).
- Akun default (Admin: `admin@cibnprestise.id` / `Admin@123`, Guru:
  `guru@cibnprestise.id` / `Review@123`) — dibuat otomatis lewat `db/init.js`
  saat pertama kali server berjalan di database kosong.

**Berubah** (lapisan database saja):
- `better-sqlite3` (file lokal, sinkron) → `pg` / PostgreSQL (server, asinkron).
  Semua handler di `server.js` sekarang `async` dan memakai `await`.
- `data/cibn_prestise.db` sudah tidak dipakai lagi. Ganti dengan koneksi
  PostgreSQL lewat environment variable `DATABASE_URL`.
- Fungsi khusus SQLite diganti padanan PostgreSQL:
  | SQLite (lama)                              | PostgreSQL (baru)                                  |
  |---------------------------------------------|-----------------------------------------------------|
  | `INTEGER PRIMARY KEY AUTOINCREMENT`          | `SERIAL PRIMARY KEY`                                 |
  | `datetime('now','localtime')`                | `CURRENT_TIMESTAMP`                                   |
  | `julianday(a) - julianday(b)`                 | `a::date - b::date` (hasil integer langsung)          |
  | `date(x) >= date('now')`                      | `x::date >= CURRENT_DATE`                             |
  | `COLLATE NOCASE`                              | `LOWER(kolom) = LOWER(?)` / `ORDER BY LOWER(kolom)`    |
  | `INSERT OR REPLACE INTO landing ...`          | `INSERT ... ON CONFLICT (id) DO UPDATE SET ...`        |
  | `PRAGMA table_info(...)` (migrasi kolom)      | tidak perlu lagi — skema final langsung didefinisikan di `db/schema.sql` |
  | `db.transaction(fn)()`                        | `await transaction(async (tdb) => { ... })` (lihat `db/pool.js`) |
- Kolom boolean semu (`popular`, `izinkan_review`, `digunakan`) tetap disimpan
  sebagai angka `0`/`1` (SMALLINT), **bukan** tipe `BOOLEAN` — supaya response
  JSON ke frontend tidak berubah bentuk (frontend sudah terbiasa dengan `0`/`1`,
  bukan `true`/`false`).

## 1. Setup PostgreSQL

Pilih salah satu:
- **Lokal**: install PostgreSQL, lalu `createdb cibn_prestise`.
- **Managed** (lebih mudah untuk deploy): Railway, Render, Supabase, Neon, atau
  provider lain — buat database baru, salin *connection string*-nya.

## 2. Konfigurasi environment

```bash
cp .env.example .env
```
Edit `.env`:
- `DATABASE_URL` → connection string PostgreSQL tujuan.
- `JWT_SECRET` → isi string acak & rahasia (WAJIB diganti untuk produksi).
- `PGSSL=true` kalau providernya mewajibkan SSL (kebanyakan managed Postgres begitu).

## 3. Install dependency

```bash
npm install
```

## 4A. Instalasi BARU (belum punya data lama)

Langsung jalankan:
```bash
npm start
```
Tabel & akun default otomatis dibuat saat startup pertama. Selesai.

## 4B. Migrasi data dari SQLite LAMA (project yang sudah pernah dipakai)

Kalau project lama sudah punya data (akun peserta, soal, laporan ujian, dll)
di `data/cibn_prestise.db`, pindahkan datanya dulu sebelum dipakai:

1. File database SQLite lama dari project yang diupload **sudah ikut disalin**
   ke `db/legacy-sqlite/cibn_prestise.db` di paket ini. Kalau mau memakai file
   lain, timpa file tersebut atau set env `SQLITE_PATH` ke lokasi lain.

2. Install dependency migrasi (sekali saja, khusus untuk baca file SQLite lama):
   ```bash
   npm install better-sqlite3
   ```

3. Pastikan `DATABASE_URL` di `.env` mengarah ke database PostgreSQL **kosong**
   (tabel akan otomatis dibuat, isinya di-`TRUNCATE` dulu sebelum diisi ulang
   supaya aman dijalankan berkali-kali tanpa duplikat).

4. Jalankan migrasi:
   ```bash
   npm run migrate:from-sqlite
   ```
   Script akan menampilkan jumlah baris yang berhasil dipindahkan per tabel.

5. Cek beberapa data penting (jumlah user, soal, laporan) langsung di
   PostgreSQL sebelum menghapus backup SQLite lama.

6. Jalankan server seperti biasa:
   ```bash
   npm start
   ```

### File upload (gambar soal, poster & PDF ebook)
File-file di folder `uploads/` (gambar soal, poster ebook, PDF ebook) **bukan**
data database — sudah otomatis ikut ter-copy apa adanya di paket project ini,
tidak perlu dimigrasi terpisah. Kalau setelah migrasi menu **Library E-Book**
kosong padahal foldernya ada isinya, jalankan:
```bash
npm run rebuild-orphan-ebooks
```

## 5. Deploy ke server / hosting

Tidak ada perubahan cara deploy dibanding project Node.js/Express pada umumnya:
- Set environment variable (`DATABASE_URL`, `JWT_SECRET`, `PORT` kalau perlu)
  di dashboard hosting.
- `npm install && npm start`.
- Pastikan folder `uploads/` dipasang di **persistent storage** (bukan storage
  ephemeral) kalau hosting-nya container-based, supaya file yang diupload tidak
  hilang saat container di-restart/redeploy.

## Troubleshooting

- **`[FATAL] Environment variable DATABASE_URL belum di-set`** — cek file `.env`
  sudah ada dan terisi, dan project dijalankan dari folder yang sama dengan `.env`.
- **`self signed certificate` / SSL error saat connect** — set `PGSSL=true` di `.env`.
- **Error `relation "..." does not exist`** — schema belum sempat dibuat; pastikan
  `db/schema.sql` ikut ter-deploy dan proses startup (`db/init.js`) tidak error
  duluan (cek log server).
- **Duplikat data setelah migrasi dijalankan 2x** — tidak akan terjadi, karena
  `db/migrate-from-sqlite.js` selalu `TRUNCATE` tabel tujuan dulu sebelum insert ulang.
