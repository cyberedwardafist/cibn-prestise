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

-- grub_id: ID UNIK per BATCH pembuatan token (1x klik "Generate Token" dgn
-- Grup Token aktif = 1 grub_id baru), digenerate server (genGrubId() di
-- server.js) — SELALU baru walau nama grup (grub_token) yang diketik admin
-- SAMA PERSIS dgn grup yang sudah ada sebelumnya (mis. "SMA1" dibuat lagi
-- bulan depan utk angkatan yg beda). grub_token tetap murni LABEL tampilan
-- (boleh diulang bebas, dipakai jg utk datalist saran nama di halaman Buat
-- Token) — grub_id lah yang jadi kunci pengelompokan sesungguhnya di mana pun
-- statistik/analisa dihitung per grup (lihat computeAnalisaGrupAggregate &
-- GET /api/analisa/grup/:grubKey), supaya 2 batch yang kebetulan senama TIDAK
-- PERNAH tercampur datanya. Token yang dibuat SEBELUM kolom ini ada akan
-- punya grub_id NULL — utk data lama itu, pengelompokan fallback ke
-- grub_token (perilaku lama, satu-satunya cara yg tersedia utk data lama).
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS grub_id TEXT;

-- is_master: menandai 1 baris token per batch sebagai "Kode Master Grup" (BUKAN
-- token asli), dibuat otomatis oleh POST /api/tokens/generate setiap kali admin
-- mengaktifkan switch "Aktifkan Grup Token" di Buat Token. Kode master dibuat
-- oleh genGrupMasterKode() (format beda: diawali "GRUP-", supaya gampang dibedain
-- dari token asli baik oleh admin maupun sistem). Kode master TIDAK PERNAH
-- ditandai digunakan=1 pada dirinya sendiri — dia dipakai berulang oleh banyak
-- peserta berbeda; setiap kali divalidasi (POST /api/exam/validate-token) dia
-- otomatis "meminjamkan" 1 token asli yang masih nganggur (digunakan=0, is_master=0)
-- di grup yang sama (grub_id sama) ke peserta yang barusan validasi, dan token
-- asli itulah yang benar-benar dikunci/dipakai. Reservasi dilakukan ATOMIK lewat
-- `UPDATE tokens ... WHERE id=(SELECT ... FOR UPDATE SKIP LOCKED)` supaya 2
-- peserta yang validasi kode master ini nyaris bersamaan TIDAK PERNAH kebagian
-- token asli yang sama. Kalau seluruh token asli di grup sudah habis dipakai,
-- validasi kode master otomatis gagal (tidak ada baris tersisa utk direservasi)
-- — sengaja tidak ada logic tambahan apa pun utk kasus ini.
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS is_master SMALLINT DEFAULT 0;

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

-- Konfigurasi Payment Gateway ASLI (Midtrans / Xendit) — 1 baris singleton (id=1),
-- diisi admin lewat panel Keuangan > Payment Gateway. Server Key/Secret Key
-- disimpan di sini (server-side saja) dan TIDAK PERNAH dikirim mentah ke browser.
CREATE TABLE IF NOT EXISTS payment_gateway_config (
    id                     INTEGER PRIMARY KEY DEFAULT 1,
    active_provider        TEXT DEFAULT 'none',
    midtrans_server_key    TEXT,
    midtrans_client_key    TEXT,
    midtrans_mode          TEXT DEFAULT 'sandbox',
    xendit_secret_key      TEXT,
    xendit_callback_token  TEXT,
    updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transaksi pembayaran REAL yang dibuat lewat Midtrans/Xendit (menggantikan
-- data demo localStorage). paket_requests (di atas) tetap dipakai untuk alur
-- konfirmasi MANUAL "Saya Sudah Bayar" saat gateway belum diaktifkan admin.
CREATE TABLE IF NOT EXISTS transaksi (
    id            SERIAL PRIMARY KEY,
    order_id      TEXT UNIQUE NOT NULL,
    user_kode     TEXT NOT NULL,
    paket_kode    TEXT,
    paket_nama    TEXT NOT NULL,
    gateway       TEXT NOT NULL,
    metode        TEXT,
    jumlah        INTEGER NOT NULL DEFAULT 0,
    status        TEXT DEFAULT 'pending',
    external_id   TEXT,
    redirect_url  TEXT,
    qr_string     TEXT,
    raw_response  TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_transaksi_user   ON transaksi(user_kode);
CREATE INDEX IF NOT EXISTS idx_transaksi_status ON transaksi(status);

-- Index untuk query yang sering dipanggil (sama seperti versi SQLite)
CREATE INDEX IF NOT EXISTS idx_users_role        ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email);
CREATE INDEX IF NOT EXISTS idx_tokens_kode       ON tokens(kode);
CREATE INDEX IF NOT EXISTS idx_tokens_digunakan  ON tokens(digunakan);
CREATE INDEX IF NOT EXISTS idx_laporan_user      ON laporan(user_kode);
CREATE INDEX IF NOT EXISTS idx_up_user           ON user_pakets(user_kode);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Index tambahan — OPTIMASI PERFORMA (ditambahkan setelah audit query di server.js)
-- Semua CREATE INDEX di bawah pakai IF NOT EXISTS & jalan di db/init.js setiap
-- server start (lihat initSchema()) — jadi otomatis diterapkan baik ke instalasi
-- BARU maupun instalasi LAMA yang sudah punya data, tanpa perlu migrasi manual.
--
-- Kategori 1 — kolom yang sering dipakai di WHERE/JOIN tapi belum ada index
-- (sebelumnya Postgres terpaksa Seq Scan / baca seluruh tabel baris demi baris
-- untuk query ini, persis pola "baca dari awal sampai ketemu" yang ingin dihindari):
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_tokens_modul          ON tokens(modul_kode);
CREATE INDEX IF NOT EXISTS idx_tokens_digunakan_oleh ON tokens(digunakan_oleh);
CREATE INDEX IF NOT EXISTS idx_tokens_grub_id        ON tokens(grub_id);
CREATE INDEX IF NOT EXISTS idx_tokens_grub_token     ON tokens(grub_token);
CREATE INDEX IF NOT EXISTS idx_laporan_token         ON laporan(token_kode);
CREATE INDEX IF NOT EXISTS idx_laporan_modul         ON laporan(modul_kode);
CREATE INDEX IF NOT EXISTS idx_laporan_created       ON laporan(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_up_paket              ON user_pakets(paket_kode);
CREATE INDEX IF NOT EXISTS idx_up_user_akhir         ON user_pakets(user_kode, akhir DESC);
CREATE INDEX IF NOT EXISTS idx_users_grub            ON users(grub);
CREATE INDEX IF NOT EXISTS idx_soal_kelompok         ON soal(kelompok);
CREATE INDEX IF NOT EXISTS idx_modul_kelompok        ON modul(kelompok);
CREATE INDEX IF NOT EXISTS idx_ebooks_kelompok       ON ebooks(kelompok);
CREATE INDEX IF NOT EXISTS idx_ebook_modul_kelompok  ON ebook_modul(kelompok);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Kategori 2 — index "text_pattern_ops" untuk kolom `kode` yang dipakai genKode()
-- (helper generator kode berurutan seperti SOL001, MOD002, EBK003, dst — dipanggil
-- di HAMPIR SETIAP endpoint "create" di server.js). Pola query-nya:
--     SELECT kode FROM <tabel> WHERE kode LIKE 'PREFIX%' ORDER BY id DESC LIMIT 1
-- Index UNIQUE biasa (dibuat otomatis oleh `kode TEXT UNIQUE`) HANYA bisa
-- mempercepat pencarian PERSIS SAMA (kode = 'SOL001'), TIDAK bisa dipakai untuk
-- LIKE 'PREFIX%' kecuali collation database = "C". Tanpa index tambahan ini,
-- genKode() akan Seq Scan (baca semua baris dari awal ke akhir, cek satu-satu)
-- setiap kali ada yang membuat soal/modul/ebook/token-grup/dll baru — ini
-- PERSIS pola "baca dari awal hingga akhir" yang disebutkan di pertanyaan.
-- Index text_pattern_ops di bawah membuat pencarian prefix ini langsung lompat
-- ke rentang data yang relevan (seperti buka halaman lewat daftar isi), bukan
-- membaca seluruh tabel dari baris pertama.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_users_kode_pattern              ON users(kode text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_pakets_kode_pattern              ON pakets(kode text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_up_kode_pattern                  ON user_pakets(kode text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_grubs_kode_pattern               ON grubs(kode text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_soal_kode_pattern                ON soal(kode text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_soal_kelompok_kode_pattern       ON soal_kelompok(kode text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_modul_kode_pattern               ON modul(kode text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_modul_kelompok_kode_pattern      ON modul_kelompok(kode text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_ebooks_kode_pattern              ON ebooks(kode text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_ebook_kelompok_kode_pattern      ON ebook_kelompok(kode text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_ebook_modul_kode_pattern         ON ebook_modul(kode text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_ebook_modul_kelompok_kode_pattern ON ebook_modul_kelompok(kode text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_laporan_kode_pattern             ON laporan(kode text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_paket_requests_kode_pattern      ON paket_requests(kode text_pattern_ops);

-- Kategori 3 — kolom tanggal yang dipakai untuk filter rentang (BETWEEN/<=/>=)
-- pada notifikasi langganan hampir habis (GET /api/notifikasi/expired-soon).
CREATE INDEX IF NOT EXISTS idx_users_langganan_akhir ON users(langganan_akhir) WHERE role = 'user';
