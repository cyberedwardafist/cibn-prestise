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

-- Penghitung nomor urut ATOMIK per tabel, dipakai genKode() di server.js.
-- Menggantikan pola lama "SELECT kode ... ORDER BY id DESC LIMIT 1" lalu +1 di
-- JavaScript, yang RACY di bawah beban bersamaan (mis. banyak peserta submit
-- ujian nyaris berbarengan): dua request bisa membaca kode terakhir yang SAMA
-- lalu keduanya coba INSERT kode yang SAMA persis -> yang kedua kena error
-- unique-constraint (23505) -> oleh error handler global diterjemahkan jadi
-- HTTP 400 "Data duplikat" -> muncul di client sebagai "Submit gagal". Retry
-- otomatis TIDAK menolong karena race-nya bisa terjadi lagi di percobaan
-- berikutnya kalau submission bersamaan lain masih berlangsung. Dengan tabel
-- ini, setiap pemanggilan genKode() melakukan satu UPDATE ... RETURNING atomik
-- (Postgres mengunci baris counter selama update, jadi request yang datang
-- bersamaan otomatis antre dan masing-masing dapat angka berbeda -- tidak
-- mungkin tabrakan lagi).
CREATE TABLE IF NOT EXISTS kode_counters (
    table_name TEXT PRIMARY KEY,
    counter    INTEGER NOT NULL DEFAULT 0
);

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
-- mengaktifkan switch "Aktifkan Grup Token" di Buat Token. Teks kode-nya sengaja
-- dibuat PERSIS SAMA formatnya dgn token asli (pakai genTokenKode() yang sama,
-- tanpa prefix/embel-embel apa pun) — jadi di mata peserta kode master ini
-- tidak kelihatan beda sama sekali dari token asli biasa. Pembeda cuma internal
-- lewat kolom is_master ini (dipakai admin di panel: badge "Master Grup", dan
-- dipakai server utk tahu kapan harus jalanin logic pencarian/reservasi di bawah).
-- Kode master TIDAK PERNAH ditandai digunakan=1 pada dirinya sendiri — dia dipakai berulang oleh banyak
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
-- materi_list: daftar "materi" LOKAL milik soal ini saja (JSON array {id,nama}), dipakai sebagai
-- penanda internal per-pertanyaan (lihat kolom "materi" di tiap item soal.data). Tidak berhubungan
-- dengan soal lain, dan tidak pernah tampil saat ujian/review — disiapkan utk Dock Analisa nanti.
ALTER TABLE soal  ADD COLUMN IF NOT EXISTS materi_list TEXT;
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

-- Pengaturan integrasi pihak ketiga (tab MANAGEMENT di admin: dock GMAIL | GMEET).
-- Sama pola dgn tabel `landing` di atas (1 baris, kolom data berisi JSON, di-merge
-- lewat PUT), bedanya endpoint-nya (/api/pengaturan/integrasi) KHUSUS admin (GET
-- maupun PUT) karena isinya bisa memuat kredensial (mis. app password Gmail) —
-- tidak boleh ikut publik seperti /api/landing.
-- Struktur data.gmail: { email, app_password, nama_pengirim, aktif } — dipakai utk
-- kirim OTP (lupa kata sandi) & notifikasi/pesan lain ke user (lihat server.js).
-- Struktur data.gmeet: { client_id, client_secret, calendar_id, durasi_default,
-- status } — MASIH DUMMY/PLACEHOLDER, disiapkan utk fitur Jadwal di halaman user
-- & review (belum ada alur OAuth Google / pembuatan link Meet asli).
CREATE TABLE IF NOT EXISTS pengaturan_integrasi (
    id   INTEGER PRIMARY KEY DEFAULT 1,
    data TEXT
);

-- Sesi kelas online (booking user <-> tentor). Sumber data NYATA untuk pengingat
-- email H-1 & "kelas dimulai" (lib/kelas-reminder.js) — beda dari halaman Jadwal
-- di user/jadwal/jadwal.js & review/jadwal/jadwal.js yang SAAT INI masih dummy
-- (localStorage per-browser, lihat JadwalStore di file itu). Kolom & vokabuler
-- status (pending/acc/ditolak/berlangsung/selesai/batal/dst) sengaja dibuat
-- selaras dengan JDW_STATUS_LABEL di jadwal.js supaya nanti gampang disambung.
-- waktu_mulai/waktu_selesai adalah gabungan tanggal+slot dalam bentuk TIMESTAMP
-- asli (bukan cuma tanggal+kode slot) karena itu yang dipakai scheduler untuk
-- hitung "H-1" & "sudah mulai".
CREATE TABLE IF NOT EXISTS jadwal_sesi (
    id                   SERIAL PRIMARY KEY,
    kode                 TEXT UNIQUE NOT NULL,
    user_kode            TEXT NOT NULL REFERENCES users(kode),
    tentor_id            TEXT NOT NULL,
    tentor_nama          TEXT,
    materi_id            TEXT,
    materi_nama          TEXT,
    tanggal              DATE NOT NULL,
    slot_id              TEXT,
    slot_label           TEXT,
    waktu_mulai          TIMESTAMP NOT NULL,
    waktu_selesai        TIMESTAMP,
    status               TEXT NOT NULL DEFAULT 'pending',
    meet_link            TEXT,
    catatan              TEXT,
    reminder_h1_sent     BOOLEAN DEFAULT false,
    reminder_mulai_sent  BOOLEAN DEFAULT false,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jadwal_sesi_user   ON jadwal_sesi(user_kode);
CREATE INDEX IF NOT EXISTS idx_jadwal_sesi_waktu  ON jadwal_sesi(waktu_mulai);
CREATE INDEX IF NOT EXISTS idx_jadwal_sesi_status ON jadwal_sesi(status);

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
-- Dikirim via Gmail nyata (lib/mailer.js) begitu admin mengisi & mengaktifkan
-- Gmail di dock Management; kalau belum diaktifkan, kode tetap dicatat ke
-- server log (console.log) sebagai fallback saat /api/password/forgot dipanggil.
CREATE TABLE IF NOT EXISTS password_resets (
    id         SERIAL PRIMARY KEY,
    email      TEXT NOT NULL,
    otp        TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified   SMALLINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);
-- Hitung percobaan verifikasi kode SALAH utk baris OTP ini. Proteksi brute-force
-- tebak 6 digit: setelah MAX_OTP_VERIFY_ATTEMPTS (lihat server.js) kali salah,
-- baris ini dihapus paksa & user harus minta kode OTP baru (yang otomatis kena
-- jeda 1 menit / limit 3x sehari dari otp_request_limits) — jadi jauh lebih
-- sulit ditebak drpd 1.000.000 kemungkinan tanpa batas percobaan.
ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

-- Pendaftaran akun baru sekarang butuh konfirmasi OTP lewat email sebelum baris
-- di tabel `users` benar-benar dibuat. POST /api/signup menyimpan data
-- pendaftaran (nama/email/password sudah di-hash) + kode OTP di sini; baris
-- users baru baru ditulis oleh POST /api/signup/verify-otp setelah kode cocok.
CREATE TABLE IF NOT EXISTS signup_otps (
    id         SERIAL PRIMARY KEY,
    nama       TEXT NOT NULL,
    email      TEXT NOT NULL,
    password   TEXT NOT NULL,
    otp        TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_signup_otps_email ON signup_otps(email);
-- Sama seperti attempts di password_resets di atas — proteksi brute-force
-- tebak kode OTP pendaftaran.
ALTER TABLE signup_otps ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

-- Proteksi brute-force / pembobolan akun di POST /api/login. Satu baris per
-- email yang pernah gagal login. fail_count naik tiap gagal (email tidak
-- ditemukan / password salah); begitu mencapai 3x, locked_until diisi dan
-- POST /api/login menolak percobaan berikutnya dengan HTTP 429 sampai waktu
-- itu lewat. Kalau gagal LAGI setelah kunci sebelumnya habis, durasi kunci
-- berikutnya dilipatgandakan (1 menit -> 2 menit -> 4 menit -> ... terus x2).
-- Baris dihapus (DELETE, bukan cuma di-reset ke 0) begitu login berhasil ATAU
-- begitu user menyelesaikan reset kata sandi lewat alur OTP "Lupa kata sandi?"
-- (POST /api/password/reset) — jalur OTP itu sengaja dijadikan cara untuk
-- langsung melewati masa tunggu tanpa harus menunggu penuh.
CREATE TABLE IF NOT EXISTS login_lockouts (
    email        TEXT PRIMARY KEY,
    fail_count   INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jeda & limit permintaan kode OTP — dipakai bersama oleh alur pendaftaran
-- (POST /api/signup + /api/signup/resend-otp, purpose='signup') dan alur lupa
-- password (POST /api/password/forgot, purpose='password_reset'). Mencegah
-- spam pengiriman OTP: jeda 1 menit antar permintaan yang BERHASIL dikirim,
-- dan maksimal 3x permintaan per hari per email. Dihitung terpisah per
-- `purpose` supaya pendaftaran & lupa password tidak berbagi jatah yang sama.
-- Hitungan (request_count) otomatis dianggap 0 lagi begitu request_date sudah
-- bukan hari ini — dicek di kode (lib fungsi cekJedaOtp di server.js), bukan
-- lewat cron, supaya tidak perlu proses terjadwal terpisah.
CREATE TABLE IF NOT EXISTS otp_request_limits (
    email         TEXT NOT NULL,
    purpose       TEXT NOT NULL,
    request_date  DATE NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    last_sent_at  TIMESTAMP,
    PRIMARY KEY (email, purpose)
);

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
