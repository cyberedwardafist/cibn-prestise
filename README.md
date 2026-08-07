# CIBN PRESTISE - Platform Ujian Online

Website ujian online dengan 3 akun: **Admin**, **Peserta Ujian**, dan **Guru**.

## Fitur
- **Admin**: membuat soal ujian (pertanyaan, pilihan jawaban, kunci jawaban), atur timer ujian, buat & kelola akun Admin/Peserta/Guru (email + password), kelola modul, grup, dan paket.
- **Peserta Ujian**: mengerjakan ujian sesuai token/modul yang diberikan, dengan timer berjalan otomatis.
- **Guru**: melihat data & hasil ujian seluruh peserta, menganalisa hasil ujian, serta membahas hasil ujian peserta — tampilan seperti soal ujian asli namun dilengkapi jawaban peserta, kunci jawaban, dan pembahasan setiap soal.

Navigasi di ketiga dashboard menggunakan **floating dock** (bukan tab biasa) di bagian bawah layar.

> **Versi ini memakai PostgreSQL** (sebelumnya SQLite/better-sqlite3). Lihat
> [`README-POSTGRESQL.md`](./README-POSTGRESQL.md) untuk panduan setup database,
> migrasi data dari versi lama, dan deploy.

## Cara Menjalankan

### 1. Siapkan PostgreSQL & environment variable
```bash
cp .env.example .env
# lalu edit .env, isi DATABASE_URL & JWT_SECRET
```

### 2. Install dependencies
```bash
npm install
```

### 3. Jalankan server
```bash
npm start
```
Skema tabel & akun default dibuat **otomatis** saat pertama kali server jalan
(lihat `db/init.js`) — tidak perlu import SQL manual untuk instalasi baru.

Server berjalan di http://localhost:3000

> Sudah punya data lama di SQLite (`data/cibn_prestise.db`)? Jangan langsung `npm start`
> di database kosong — ikuti dulu langkah migrasi di
> [`README-POSTGRESQL.md`](./README-POSTGRESQL.md#migrasi-data-dari-sqlite-lama).

### 3. Buka browser
- Landing Page   : http://localhost:3000/landing.html
- Login          : http://localhost:3000/login.html
- Admin Panel    : http://localhost:3000/index_admin.html
- Peserta Ujian  : http://localhost:3000/index_user.html
- Guru (Review)  : http://localhost:3000/index_review.html

### Default Login (dibuat otomatis saat pertama kali server jalan)
| Role  | Email                   | Password    |
|-------|-------------------------|-------------|
| Admin | admin@cibnprestise.id   | Admin@123   |
| Guru  | guru@cibnprestise.id    | Review@123  |

> Akun Peserta Ujian dibuat oleh Admin melalui menu Akun di dashboard Admin.
> **Segera ganti password default setelah login pertama kali.**

## Struktur File
```
cibn-prestise/
├── server.js            <- Backend Express + PostgreSQL (pg)
├── package.json
├── .env.example          <- Contoh konfigurasi (salin ke .env)
├── db/
│   ├── schema.sql              <- Definisi seluruh tabel PostgreSQL
│   ├── pool.js                 <- Koneksi pg + shim gaya better-sqlite3 (async)
│   ├── init.js                 <- Membuat skema + seed data awal saat start
│   ├── migrate-from-sqlite.js  <- Migrasi data dari database SQLite lama
│   └── legacy-sqlite/           <- (opsional) taruh file .db lama di sini untuk migrasi
├── uploads/              <- File/gambar yang diupload
├── index_admin.html      <- Dashboard Admin
├── index_user.html       <- Dashboard Peserta Ujian
├── index_review.html     <- Dashboard Guru (rekap, analisa, pembahasan)
├── ujian.html             <- Halaman pengerjaan ujian (peserta)
├── login.html             <- Login & Signup
├── landing.html           <- Landing page
├── css/
│   ├── base.css
│   ├── taskbar.css        <- Floating dock navigation
│   └── modal.css
└── js/
    ├── api.js
    ├── editor.js
    ├── app.js
    ├── akun.js
    ├── token.js
    ├── soal.js
    └── pages.js
```

## Catatan Teknis
- Semua entitas (users, soal, modul, paket, token, laporan) menggunakan **ID** sebagai primary key di database.
- Database: **PostgreSQL** via driver `pg`, koneksi diatur lewat env `DATABASE_URL`.
- Auth berbasis JWT dengan role (`admin`, `user`, `review`).
- Detail lengkap perubahan dari versi SQLite → PostgreSQL: lihat `README-POSTGRESQL.md`.
