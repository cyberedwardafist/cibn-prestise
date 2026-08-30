-- ═══════════════════════════════════════════════════════════════════════════════
-- CIBN PRESTISE — Skema PostgreSQL
-- Pengganti skema SQLite (better-sqlite3) lama. Struktur tabel & kolom dibuat
-- SAMA PERSIS (nama tabel, nama kolom, arti data) dengan versi SQLite supaya
-- seluruh endpoint & frontend TIDAK PERLU diubah kontrak datanya.
--
-- Perbedaan teknis dari versi SQLite (menyesuaikan dialek Postgres):
--   • INTEGER PRIMARY KEY AUTOINCREMENT  -> SERIAL PRIMARY KEY
--   • TEXT DEFAULT (datetime('now','localtime')) -> TIMESTAMP DEFAULT now()
--   • Kolom boolean 0/1 (popular, izinkan_review, digunakan) TETAP disimpan
--     sebagai SMALLINT (0/1) — bukan BOOLEAN — supaya perilaku JSON response
--     (angka 0/1) tetap identik dengan versi lama, tidak perlu ubah frontend.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    kode            TEXT UNIQUE,
    nama            TEXT NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    password        TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'user',
    grub            TEXT,
    status          TEXT DEFAULT 'aktif',
    paket_nama      TEXT,
    langganan_mulai TEXT,
    langganan_akhir TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grubs (
    id    SERIAL PRIMARY KEY,
    kode  TEXT UNIQUE,
    nama  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pakets (
    id            SERIAL PRIMARY KEY,
    kode          TEXT UNIQUE,
    nama          TEXT NOT NULL,
    deskripsi     TEXT,
    periode_tipe  TEXT NOT NULL DEFAULT 'bulan',
    periode_hari  INTEGER NOT NULL DEFAULT 30,
    harga         INTEGER DEFAULT 0,
    fitur         TEXT,
    status        TEXT DEFAULT 'aktif',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    link_landing  TEXT,
    warna         TEXT DEFAULT 'blue',
    icon          TEXT DEFAULT '📦',
    popular       SMALLINT DEFAULT 0,
    periode       TEXT DEFAULT '/bulan',
    hak_akses     TEXT,
    aturan_akses  TEXT,
    maks_ujian    TEXT,
    durasi_hari   TEXT,
    hak_notes     TEXT,
    mentoring_kuota TEXT
);

CREATE TABLE IF NOT EXISTS user_pakets (
    id           SERIAL PRIMARY KEY,
    kode         TEXT UNIQUE,
    user_kode    TEXT NOT NULL,
    paket_kode   TEXT NOT NULL,
    paket_nama   TEXT NOT NULL,
    periode_hari INTEGER NOT NULL,
    mulai        TEXT NOT NULL,
    akhir        TEXT NOT NULL,
    status       TEXT DEFAULT 'aktif',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS soal_kelompok (
    id         SERIAL PRIMARY KEY,
    kode       TEXT UNIQUE,
    nama       TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS soal (
    id            SERIAL PRIMARY KEY,
    kode          TEXT UNIQUE,
    nama          TEXT NOT NULL,
    nama_internal TEXT,
    type          TEXT NOT NULL,
    skor_type     TEXT,
    opsi_jawaban  INTEGER,
    timer_jam     INTEGER DEFAULT 0,
    timer_menit   INTEGER DEFAULT 30,
    timer_detik   INTEGER DEFAULT 0,
    kelompok      TEXT,
    data          TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS modul_kelompok (
    id         SERIAL PRIMARY KEY,
    kode       TEXT UNIQUE,
    nama       TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS modul (
    id                SERIAL PRIMARY KEY,
    kode              TEXT UNIQUE,
    nama              TEXT NOT NULL,
    nama_internal     TEXT,
    kelompok          TEXT,
    soal_list         TEXT,
    mode_bebas        SMALLINT DEFAULT 0,
    timer_utama_jam   INTEGER DEFAULT 0,
    timer_utama_menit INTEGER DEFAULT 0,
    timer_utama_detik INTEGER DEFAULT 0,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ebook_kelompok (
    id         SERIAL PRIMARY KEY,
    kode       TEXT UNIQUE,
    nama       TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ebooks (
    id             SERIAL PRIMARY KEY,
    kode           TEXT UNIQUE,
    nama           TEXT NOT NULL,
    kelompok       TEXT,
    poster         TEXT,
    file_pdf       TEXT,
    file_nama_asli TEXT,
    jumlah_halaman INTEGER DEFAULT 0,
    ukuran_bytes   BIGINT DEFAULT 0,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ebook_modul_kelompok (
    id         SERIAL PRIMARY KEY,
    kode       TEXT UNIQUE,
    nama       TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ebook_modul (
    id         SERIAL PRIMARY KEY,
    kode       TEXT UNIQUE,
    nama       TEXT NOT NULL,
    kelompok   TEXT,
    ebook_list TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tokens (
    id             SERIAL PRIMARY KEY,
    kode           TEXT UNIQUE NOT NULL,
    modul_kode     TEXT,
    aktivasi       TEXT,
    expired        TEXT,
    digunakan      SMALLINT DEFAULT 0,
    digunakan_oleh TEXT,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    izinkan_review SMALLINT DEFAULT 0,
    grub_token     TEXT,
    batas_keluar   INTEGER
);
-- Batas maksimal "keluar dari ujian" (tab switch/blur/keluar fullscreen) sebelum
-- ujian otomatis dianggap selesai. NULL = perlindungan keluar DIMATIKAN untuk
-- token ini (peserta bebas keluar tanpa batas). Angka (mis. 3) = jumlah maksimal
-- pelanggaran yang ditoleransi. Untuk instalasi lama yang tabel `tokens`-nya sudah
-- ada dari sebelum kolom ini dibuat — aman dijalankan berkali-kali.
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS batas_keluar INTEGER;

-- Nama internal (opsional) untuk soal & modul — HANYA ditampilkan di admin
-- (Library Soal dan saat menyusun Modul), tidak pernah dikirim ke peserta ujian.
-- Ditampilkan sebagai "nama soal | nama internal soal" di UI admin.
-- Untuk instalasi lama yang tabelnya sudah ada dari sebelum kolom ini dibuat —
-- aman dijalankan berkali-kali.
ALTER TABLE soal  ADD COLUMN IF NOT EXISTS nama_internal TEXT;
ALTER TABLE modul ADD COLUMN IF NOT EXISTS nama_internal TEXT;

-- Mode Bebas Pindah Soal (khusus modul yang SELURUH soalnya ber-tipe
-- multiple_choice): mengganti timer per-soal dengan 1 timer utama untuk
-- seluruh modul, dan mengizinkan peserta pindah antar bagian soal secara
-- bebas (bukan berurutan) sampai waktu utama habis.
-- Untuk instalasi lama yang tabelnya sudah ada dari sebelum kolom ini dibuat —
-- aman dijalankan berkali-kali.
ALTER TABLE modul ADD COLUMN IF NOT EXISTS mode_bebas        SMALLINT DEFAULT 0;
ALTER TABLE modul ADD COLUMN IF NOT EXISTS timer_utama_jam   INTEGER DEFAULT 0;
ALTER TABLE modul ADD COLUMN IF NOT EXISTS timer_utama_menit INTEGER DEFAULT 0;
ALTER TABLE modul ADD COLUMN IF NOT EXISTS timer_utama_detik INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS laporan (
    id                SERIAL PRIMARY KEY,
    kode              TEXT UNIQUE,
    token_kode        TEXT,
    user_kode         TEXT,
    modul_kode        TEXT,
    tgl_selesai       TEXT,
    waktu_pengerjaan  TEXT,
    skor              REAL DEFAULT 0,
    jawaban           TEXT,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    urutan_tampil     TEXT,
    izinkan_review    SMALLINT
);
-- Untuk instalasi lama yang tabel `laporan`-nya sudah ada dari sebelum kolom ini
-- dibuat (CREATE TABLE IF NOT EXISTS di atas tidak akan menambah kolom baru ke
-- tabel yang sudah ada) — aman dijalankan berkali-kali.
-- Kolom ini menyimpan izin-review SECARA PERMANEN di baris laporan itu sendiri
-- (disalin dari tokens.izinkan_review saat siswa submit ujian), supaya izin
-- review tidak lagi bergantung pada baris token yang bisa saja sudah dihapus
-- admin di kemudian hari (token sengaja dianggap data "sekali pakai/sampah",
-- laporan hasil ujian harus permanen).
-- SENGAJA tanpa DEFAULT: baris laporan LAMA (dari sebelum kolom ini ada) akan
-- tetap NULL sampai dijalankan node scripts/backfill-laporan-izinkan-review.js —
-- kalau dikasih DEFAULT, Postgres langsung mengisi semua baris lama saat ALTER
-- ini jalan, sehingga skrip backfill tidak akan bisa membedakan mana yang perlu
-- diisi ulang dari nilai token aslinya. Baris BARU selalu diisi eksplisit oleh
-- endpoint /api/exam/submit, jadi tidak pernah NULL untuk data baru.
ALTER TABLE laporan ADD COLUMN IF NOT EXISTS izinkan_review SMALLINT;

-- Poster modul e-book: modul e-book ditampilkan sebagai kartu poster tersendiri
-- di akun user/review (guru), terpisah dari poster masing-masing buku di dalamnya.
ALTER TABLE ebook_modul ADD COLUMN IF NOT EXISTS poster TEXT;
ALTER TABLE pakets ADD COLUMN IF NOT EXISTS mentoring_kuota TEXT;

CREATE TABLE IF NOT EXISTS landing (
    id   INTEGER PRIMARY KEY DEFAULT 1,
    data TEXT
);

CREATE TABLE IF NOT EXISTS signup_requests (
    id         SERIAL PRIMARY KEY,
    nama       TEXT,
    email      TEXT UNIQUE,
    password   TEXT,
    paket_nama TEXT,
    status     TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permintaan aktivasi PAKET (bukan akun) — dipakai oleh alur landing baru:
-- akun langsung aktif saat daftar (lihat /api/signup), tapi paket yang dipilih
-- baru resmi aktif (masuk ke user_pakets) setelah admin memverifikasi
-- pembayaran lewat panel admin. user_kode WAJIB mengacu ke akun yang sudah ada.
CREATE TABLE IF NOT EXISTS paket_requests (
    id           SERIAL PRIMARY KEY,
    kode         TEXT UNIQUE,
    user_kode    TEXT NOT NULL,
    paket_kode   TEXT,
    paket_nama   TEXT NOT NULL,
    metode_bayar TEXT,
    status       TEXT DEFAULT 'pending',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_paket_requests_user   ON paket_requests(user_kode);
CREATE INDEX IF NOT EXISTS idx_paket_requests_status ON paket_requests(status);

-- Kode OTP untuk fitur "Lupa Kata Sandi" (landing baru, halaman otp.html).
-- Belum ada layanan email/SMTP terpasang — kode saat ini dicatat ke server log
-- (console.log) saat /api/password/forgot dipanggil. Sambungkan ke SMTP asli
-- di titik yang sama begitu kredensial email tersedia.
CREATE TABLE IF NOT EXISTS password_resets (
    id         SERIAL PRIMARY KEY,
    email      TEXT NOT NULL,
    otp        TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified   SMALLINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);

-- Index untuk query yang sering dipanggil (sama seperti versi SQLite)
CREATE INDEX IF NOT EXISTS idx_users_role        ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email);
CREATE INDEX IF NOT EXISTS idx_tokens_kode       ON tokens(kode);
CREATE INDEX IF NOT EXISTS idx_tokens_digunakan  ON tokens(digunakan);
CREATE INDEX IF NOT EXISTS idx_laporan_user      ON laporan(user_kode);
CREATE INDEX IF NOT EXISTS idx_up_user           ON user_pakets(user_kode);
