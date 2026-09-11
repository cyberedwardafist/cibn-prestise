// server.js — Backend Express + PostgreSQL + Supabase Storage (Vercel Ready)

const express   = require('express');
const cors      = require('cors');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const path      = require('path');
const crypto    = require('crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const { db, transaction } = require('./db/pool');
const { initSchema, seedIfEmpty, sanityCheckEbooks, ensureGatewayConfig } = require('./db/init');
const { kirimEmail, invalidateMailerCache, verifikasiDanKirimTes } = require('./lib/mailer');
const { mulaiScheduler, jalankanCekReminder } = require('./lib/kelas-reminder');

const app       = express();
const PORT      = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET || 'cbn_secret_2025_admin';
if (!process.env.JWT_SECRET) {
    console.warn('[WARNING] JWT_SECRET belum di-set lewat environment variable.');
}

// ── SETUP SUPABASE STORAGE ──────────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const BUCKET_NAME = process.env.SUPABASE_BUCKET || 'cibn-uploads';

if (!supabaseUrl || !supabaseKey) {
    console.warn('[WARNING] SUPABASE_URL atau SUPABASE_KEY belum di-set. Fitur upload file tidak akan berfungsi.');
}
const supabase = createClient(supabaseUrl || 'https://dummy.supabase.co', supabaseKey || 'dummy');

function safeFolderName(name) {
    return (name || 'Tanpa_Nama').replace(/[^a-zA-Z0-9_-]/g, '_');
}

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// ── REDIRECT URL LAMA (*.html) → URL BARU TANPA EKSTENSI ────────────────────
// Semua URL halaman publik sekarang TANPA ekstensi .html (mis. /index_admin,
// bukan /index_admin.html). Supaya link lama yang masih nyantol (bookmark,
// hasil Google, dll) tidak mati, path *.html yang dikenal di sini di-301-
// redirect ke versi bersihnya, query string ikut dibawa. Ditaruh PALING ATAS
// (sebelum static/route lain) supaya static middleware tidak keburu serve
// file *.html-nya langsung sebelum sempat di-redirect. Fetch fragmen internal
// lazy-loader (mis. /admin/soal/soal.html) tidak kena karena path-nya selalu
// berprefix folder modul, bukan salah satu key di bawah ini.
const OLD_HTML_REDIRECTS = {
    '/index_admin.html': '/index_admin',
    '/index_review.html': '/index_review',
    '/index_user.html': '/index_user',
    '/ujian.html': '/ujian',
    '/landing.html': '/landing',
    '/login.html': '/masuk',
    '/masuk.html': '/masuk',
    '/daftar.html': '/daftar',
    '/otp.html': '/otp',
    '/index.html': '/',
    '/info-paket.html': '/info-paket',
    '/kebijakan-privasi.html': '/kebijakan-privasi',
    '/materi.html': '/materi',
    '/paket.html': '/paket',
    '/syarat-ketentuan.html': '/syarat-ketentuan',
    '/tentang.html': '/tentang',
    '/testimoni.html': '/testimoni',
    '/pembayaran.html': '/pembayaran',
    '/qris.html': '/qris',
};
app.use((req, res, next) => {
    const target = OLD_HTML_REDIRECTS[req.path];
    if (!target || (req.method !== 'GET' && req.method !== 'HEAD')) return next();
    const qs = req.url.slice(req.path.length);
    res.redirect(301, target + qs);
});

// ── UPLOAD CONFIG (SEMUA UPLOAD FILE PAKAI PRESIGNED URL — LIHAT BAGIAN "GENERIC
//    PRESIGNED UPLOAD" DI BAWAH). Tidak ada lagi multer/memoryStorage: server
//    TIDAK PERNAH menerima isi file (foto/video/PDF) di body request-nya sendiri.
//    Browser upload LANGSUNG ke Supabase Storage pakai signed URL, sehingga:
//      - beban CPU/RAM server untuk parsing multipart & buffer file hilang total
//      - request ke server kita cuma JSON kecil (metadata), jauh di bawah limit
//        body serverless (mis. ±4.5MB di Vercel) berapa pun besar file aslinya
//      - upload besar (video/PDF) tidak numpuk di RAM/bandwidth server kita
const ALLOWED_IMAGE_MIME = {
    'image/jpeg': '.jpg',
    'image/png':  '.png',
    'image/gif':  '.gif',
    'image/webp': '.webp'
};
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB (gambar)
const ALLOWED_PDF_MIME = { 'application/pdf': '.pdf' };
const MAX_EBOOK_PDF_SIZE = 80 * 1024 * 1024; // 80MB (PDF e-book)
const ALLOWED_LANDING_VIDEO_MIME = { 'video/mp4': '.mp4', 'video/webm': '.webm' };
const MAX_LANDING_VIDEO_SIZE = 40 * 1024 * 1024; // 40MB (video landing)

// Setiap "kind" = 1 jenis upload yang boleh diminta lewat /api/upload-init.
// folder      → folder utama di bucket Supabase.
// allowedMime → whitelist MIME (server yang menentukan ekstensi file akhir,
//               BUKAN dari nama file yang dikirim klien, supaya aman).
// maxSize     → batas ukuran file (divalidasi juga di sini, bukan cuma di UI).
// roles       → role yang boleh minta signed URL jenis ini.
const UPLOAD_KINDS = {
    'soal-image':         { folder: 'soal',       allowedMime: ALLOWED_IMAGE_MIME,         maxSize: MAX_UPLOAD_SIZE,       roles: ['admin'] },
    'ebook-pdf':          { folder: 'ebooks',      allowedMime: ALLOWED_PDF_MIME,           maxSize: MAX_EBOOK_PDF_SIZE,    roles: ['admin'] },
    'ebook-poster':       { folder: 'ebooks',      allowedMime: ALLOWED_IMAGE_MIME,         maxSize: MAX_UPLOAD_SIZE,       roles: ['admin'] },
    'ebook-modul-poster': { folder: 'ebook-modul', allowedMime: ALLOWED_IMAGE_MIME,         maxSize: MAX_UPLOAD_SIZE,       roles: ['admin'] },
    'landing-image':      { folder: 'landing',     allowedMime: ALLOWED_IMAGE_MIME,         maxSize: MAX_UPLOAD_SIZE,       roles: ['admin'] },
    'landing-video':      { folder: 'landing',     allowedMime: ALLOWED_LANDING_VIDEO_MIME, maxSize: MAX_LANDING_VIDEO_SIZE, roles: ['admin'] }
};

// ── UPLOAD CLEANUP HELPERS (SUPABASE) ─────────────────────────────────────────
function extractUploadFilenames(text) {
    if (!text) return new Set();
    const set = new Set();
    // Menangkap path file relatif dari URL publik Supabase
    const re = new RegExp(`${BUCKET_NAME}/(soal/[a-zA-Z0-9_/-]+\\.[a-zA-Z0-9]+)`, 'g');
    let m;
    while ((m = re.exec(text)) !== null) set.add(m[1]);
    return set;
}

async function getAllReferencedUploadFilenames() {
    const rows = await db.prepare('SELECT data FROM soal').all();
    const all = new Set();
    for (const r of rows) {
        if (!r.data) continue;
        for (const f of extractUploadFilenames(r.data)) all.add(f);
    }
    return all;
}

async function cleanupOrphanedUploads(candidatePaths) {
    if (!candidatePaths || candidatePaths.size === 0) return;
    const stillUsed = await getAllReferencedUploadFilenames();
    const toDelete = [];
    for (const filePath of candidatePaths) {
        if (!stillUsed.has(filePath)) toDelete.push(filePath);
    }
    
    if (toDelete.length > 0) {
        const { error } = await supabase.storage.from(BUCKET_NAME).remove(toDelete);
        if (error) console.error('[CLEANUP] Gagal hapus file orphan di Supabase:', error.message);
        else console.log(`[CLEANUP] ${toDelete.length} file orphan dihapus dari Supabase.`);
    }
}

async function deleteUploadedFileByUrl(url) {
    if (!url || typeof url !== 'string') return;
    const parts = url.split(`/public/${BUCKET_NAME}/`);
    if (parts.length === 2) {
        const filePath = parts[1];
        await supabase.storage.from(BUCKET_NAME).remove([filePath]);
    }
}

// CATATAN: penghitung jumlah halaman PDF (dulu di sini, jalan di atas Buffer hasil
// multer) sudah dipindah ke browser (lihat js/api.js: countPdfPagesClient) karena
// server sekarang tidak lagi menerima isi file PDF sama sekali — file di-upload
// langsung dari browser ke Supabase Storage lewat signed URL.

// ── HELPERS ──────────────────────────────────────────────────────────────────
// BUG YANG DIPERBAIKI: versi lama membaca kode terakhir via "SELECT ... ORDER BY
// id DESC LIMIT 1" lalu +1 di JavaScript — RACY di bawah beban bersamaan. Kalau
// dua request datang nyaris berbarengan (mis. banyak peserta submit ujian di
// waktu yang sama), keduanya bisa membaca kode terakhir yang SAMA dan menghasilkan
// kode berikutnya yang SAMA juga, lalu INSERT kedua kena unique-constraint error
// (23505) -> diterjemahkan error handler global jadi HTTP 400 "Data duplikat" ->
// retry otomatis di client tetap gagal berulang kali kalau submission bersamaan
// lain masih berlangsung (persis pola "Submit gagal (percobaan 1/6, 2/6, ...)").
// Sekarang pakai tabel kode_counters + UPDATE ... RETURNING (jalur cepat) yang
// atomik secara native di Postgres (baris counter otomatis terkunci selama
// UPDATE, request bersamaan antre dan masing-masing pasti dapat angka berbeda).
// Jalur lambat (INSERT ber-fallback dari MAX(kode) tabel aslinya) hanya jalan
// SEKALI per tabel, saat kode_counters belum punya baris utk tabel itu —
// supaya nomor lanjut sambung dari data lama, bukan mulai dari 1 lagi.
async function genKode(prefix, table) {
    let row = await db.prepare(
        `UPDATE kode_counters SET counter = counter + 1 WHERE table_name = ? RETURNING counter`
    ).get(table);
    if (!row) {
        const like = prefix + '%';
        row = await db.prepare(`
            INSERT INTO kode_counters (table_name, counter)
            SELECT ?, COALESCE((SELECT MAX(CAST(SUBSTRING(kode FROM ?) AS INTEGER)) FROM ${table} WHERE kode LIKE ?), 0) + 1
            ON CONFLICT (table_name) DO UPDATE SET counter = kode_counters.counter + 1
            RETURNING counter
        `).get(table, prefix.length + 1, like);
    }
    return prefix + String(row.counter).padStart(3, '0');
}
function genTokenKode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const seg   = () => Array.from({length:4}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
    return `${seg()}-${seg()}-${seg()}`;
}
// Kode "Master Grup" — sengaja dibuat dgn format TEKS PERSIS SAMA dgn token asli
// (pakai genTokenKode() yang sama, BUKAN prefix/format khusus) supaya di mata
// peserta tidak ada bedanya sama sekali. Pembeda cuma internal (kolom is_master
// di DB) — dipakai admin di panel (badge "Master Grup") dan dipakai server utk
// tahu kapan harus jalanin logic pencarian/reservasi token asli saat validasi.
// Lihat komentar kolom is_master di db/schema.sql utk alur lengkapnya.
// ID unik per BATCH generate token (grup) — lihat komentar kolom `grub_id` di
// db/schema.sql. Timestamp (base36) + acak: praktis tidak pernah tabrakan
// tanpa perlu cek unik ke DB (beda dgn genTokenKode() yg di-retry oleh
// pemanggilnya kalau bentrok — grub_id tidak perlu itu, ini bukan constraint
// UNIQUE, cuma nilai pengelompokan).
function genGrubId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const seg   = () => Array.from({length:6}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
    return `GB${Date.now().toString(36).toUpperCase()}${seg()}`;
}
// Kunci grup yang dipakai di seluruh dock ANALISA (frontend & backend harus
// SEPAKAT konvensi yang sama persis — lihat _atGrupKey() di
// admin/analisa/analisa-token.js untuk versi frontend-nya):
//   - kalau token itu punya grub_id (dibuat setelah kolom ini ada) -> pakai grub_id itu apa adanya
//   - kalau tidak (token lama, grub_id NULL) -> fallback "legacy:<grub_token>",
//     supaya data lama tetap bisa diakses (dikelompokkan spt sebelumnya,
//     berdasarkan nama), tanpa bisa collide dgn grub_id asli manapun (grub_id
//     asli selalu diawali "GB", tidak pernah "legacy:").
function grupKeyOf(t) { return t.grub_id ? t.grub_id : `legacy:${t.grub_token}`; }

// ── AUTH MIDDLEWARE ───────────────────────────────────────────────────────────
function auth(roles = []) {
    return async (req, res, next) => {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (e) { return res.status(401).json({ error: 'Token invalid' }); }
        try {
            const current = await db.prepare('SELECT kode,nama,email,role,status FROM users WHERE kode=?').get(decoded.kode);
            if (!current) {
                return res.status(401).json({ error: 'Akun tidak ditemukan (mungkin sudah dihapus). Silakan login ulang.' });
            }
            if (current.status === 'suspend') {
                return res.status(403).json({ error: 'Akun Anda di-suspend oleh admin.' });
            }
            if (current.status === 'pending') {
                return res.status(403).json({ error: 'Akun Anda belum diaktifkan.' });
            }
            if (roles.length && !roles.includes(current.role))
                return res.status(403).json({ error: 'Forbidden' });
            req.user = { id: decoded.id, kode: current.kode, email: current.email, nama: current.nama, role: current.role };
            next();
        } catch (e) { next(e); }
    };
}

function ah(fn) {
    return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// ── PAKET HELPERS ─────────────────────────────────────────────────────────────
async function hitungMulaiAkhirPaket(user_kode, paket_kode, periodeHari) {
    const today = new Date(); today.setHours(0,0,0,0);
    if (paket_kode && paket_kode !== 'CUSTOM') {
        const samePaket = await db.prepare(
            `SELECT * FROM user_pakets WHERE user_kode=? AND paket_kode=? AND akhir::date >= CURRENT_DATE ORDER BY akhir DESC LIMIT 1`
        ).get(user_kode, paket_kode);
        if (samePaket) {
            const mulai = new Date(samePaket.akhir);
            mulai.setHours(0,0,0,0); mulai.setDate(mulai.getDate()+1);
            const akhir = new Date(mulai); akhir.setDate(akhir.getDate()+periodeHari-1);
            return { mulai: mulai.toISOString().split('T')[0], akhir: akhir.toISOString().split('T')[0], extended: true, from: samePaket.akhir };
        }
    }
    const mulai = new Date(today);
    const akhir = new Date(today); akhir.setDate(akhir.getDate()+periodeHari-1);
    return { mulai: mulai.toISOString().split('T')[0], akhir: akhir.toISOString().split('T')[0], extended: false };
}

async function upsertManualPaket(tdb, user_kode, paket_nama, langganan_mulai, langganan_akhir) {
    const manualKode = 'MANUAL-' + user_kode;
    if (paket_nama && langganan_akhir) {
        const mulai = langganan_mulai || langganan_akhir;
        const periodeHari = Math.max(1, Math.round((new Date(langganan_akhir) - new Date(mulai)) / 86400000) + 1);
        const exists = await tdb.prepare('SELECT kode FROM user_pakets WHERE kode=?').get(manualKode);
        if (exists) {
            await tdb.prepare('UPDATE user_pakets SET paket_nama=?,periode_hari=?,mulai=?,akhir=? WHERE kode=?')
                .run(paket_nama, periodeHari, mulai, langganan_akhir, manualKode);
        } else {
            await tdb.prepare('INSERT INTO user_pakets (kode,user_kode,paket_kode,paket_nama,periode_hari,mulai,akhir,status) VALUES (?,?,?,?,?,?,?,?)')
                .run(manualKode, user_kode, 'MANUAL', paket_nama, periodeHari, mulai, langganan_akhir, 'aktif');
        }
    } else {
        await tdb.prepare('DELETE FROM user_pakets WHERE kode=?').run(manualKode);
    }
}

async function syncUserPaketLegacy(user_kode, tdb) {
    const q = tdb || db;
    const latest = await q.prepare("SELECT * FROM user_pakets WHERE user_kode=? ORDER BY akhir DESC LIMIT 1").get(user_kode);
    if (latest) {
        await q.prepare('UPDATE users SET paket_nama=?,langganan_mulai=?,langganan_akhir=? WHERE kode=?')
            .run(latest.paket_nama, latest.mulai, latest.akhir, user_kode);
    } else {
        await q.prepare('UPDATE users SET paket_nama=NULL,langganan_mulai=NULL,langganan_akhir=NULL WHERE kode=?').run(user_kode);
    }
}

// Aktivasi paket otomatis (dipakai oleh approve manual admin & webhook payment gateway asli).
// WAJIB dipanggil di dalam transaction() dan diberi `tdb` yang sama supaya atomik.
async function aktivasiPaketOtomatis(user_kode, paket_kode, paket_nama, tdb) {
    const paket = paket_kode ? await tdb.prepare('SELECT * FROM pakets WHERE kode=?').get(paket_kode) : null;
    if (paket) {
        const { mulai, akhir } = await hitungMulaiAkhirPaket(user_kode, paket_kode, paket.periode_hari);
        const upKode = await genKode('UP', 'user_pakets');
        await tdb.prepare('INSERT INTO user_pakets (kode,user_kode,paket_kode,paket_nama,periode_hari,mulai,akhir,status) VALUES (?,?,?,?,?,?,?,?)')
            .run(upKode, user_kode, paket_kode, paket.nama, paket.periode_hari, mulai, akhir, 'aktif');
    } else {
        const today = new Date(); const mulai = today.toISOString().split('T')[0];
        const ak = new Date(today); ak.setDate(ak.getDate() + 29);
        await upsertManualPaket(tdb, user_kode, paket_nama, mulai, ak.toISOString().split('T')[0]);
    }
    await syncUserPaketLegacy(user_kode, tdb);
}

// ── PAYMENT GATEWAY (KONEKSI PIHAK KE-3 ASLI: MIDTRANS / XENDIT) ────────────
// Konfigurasi disimpan di tabel payment_gateway_config (1 baris, id=1), diisi
// admin lewat panel Keuangan > Payment Gateway. Server Key/Secret Key TIDAK
// PERNAH dikirim balik ke browser dalam bentuk asli — hanya versi masked.
async function getGatewayConfig() {
    let cfg = await db.prepare('SELECT * FROM payment_gateway_config WHERE id=1').get();
    if (!cfg) {
        await db.prepare("INSERT INTO payment_gateway_config (id,active_provider,midtrans_mode) VALUES (1,'none','sandbox') ON CONFLICT (id) DO NOTHING").run();
        cfg = await db.prepare('SELECT * FROM payment_gateway_config WHERE id=1').get();
    }
    return cfg || { active_provider: 'none', midtrans_mode: 'sandbox' };
}
function maskGatewayKey(k) {
    if (!k) return '';
    return k.length <= 8 ? '••••••••' : k.slice(0, 6) + '••••••••' + k.slice(-4);
}
function genOrderId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// Switch "Review" di Hak Akses Paket (Laporan & Statistik) — kalau aktif, SELURUH
// laporan/token user dgn paket ini bisa direview, walau token/laporan itu sendiri
// tidak disetel izinkan_review saat dibuat. Dicek dari paket AKTIF user (user_pakets),
// bukan dari token, jadi override-nya berlaku di level langganan.
async function userPunyaReviewOverride(user_kode) {
    const rows = await db.prepare(`SELECT p.aturan_akses FROM user_pakets up JOIN pakets p ON up.paket_kode = p.kode WHERE up.user_kode=? AND up.status='aktif' AND up.akhir::date >= CURRENT_DATE`).all(user_kode);
    for (const r of rows) {
        if (!r.aturan_akses) continue;
        try { if (JSON.parse(r.aturan_akses).includes('laporan.review_override')) return true; } catch (e) {}
    }
    return false;
}

// ── PERHITUNGAN SKOR UJIAN ───────────────────────────────────────────────────
function stripKunci(node) {
    if (Array.isArray(node)) return node.map(stripKunci);
    if (node && typeof node === 'object') {
        const out = {};
        for (const k of Object.keys(node)) {
            if (k === 'kunci' || k === 'kunci_huruf') continue;
            out[k] = stripKunci(node[k]);
        }
        return out;
    }
    return node;
}

// Soal Sikap Kerja: tiap soal yang digenerate cukup menyimpan {id, kunci_idx,
// urutan} — field semua/tampil/kunci/kunci_huruf bisa dihitung ulang dari 5 item
// kolomnya, jadi tidak perlu disalin berulang ke tiap soal (dulu ini penyebab
// payload membengkak dan gagal simpan / HTTP 413). `urutan` = urutan index item
// asli (selain kunci_idx) yang dipakai untuk menyusun `tampil` — WAJIB disimpan
// (tidak bisa dihitung ulang cuma dari kunci_idx) karena sejak perbaikan generator
// (lihat admin/soal/soal.js: _genSikapSoalBatch), urutan tampilnya diacak dan
// dijamin beda dari soal sebelumnya di kolom yang sama (dulu urutannya SELALU
// sama persis tiap kali kunci yang sama muncul lagi, karena cuma difilter dari
// urutan asli items — celah ini bikin peserta bisa hafal pola tanpa benar-benar
// membandingkan tiap item). Fungsi ini mengembalikan bentuk lengkap seperti
// sebelumnya, supaya semua kode yang sudah ada (ujian, laporan, export, review)
// tetap jalan tanpa perlu diubah sama sekali.
function expandSikapKerja(type, data) {
    if (type !== 'sikap_kerja' || !Array.isArray(data)) return data;
    return data.map(kolom => {
        if (!kolom || !Array.isArray(kolom.soal) || !Array.isArray(kolom.items)) return kolom;
        const items = kolom.items;
        const soal = kolom.soal.map(s => {
            if (s && s.tampil !== undefined) return s; // data lama/format lengkap, biarkan apa adanya
            const kIdx = s ? s.kunci_idx : undefined;
            if (kIdx === undefined || kIdx === null || !items[kIdx]) return s;
            // Data lama (sebelum ada `urutan`) tidak punya info urutan acak — fallback
            // ke urutan asli minus kunci_idx, persis perilaku sebelumnya, supaya soal
            // lama yang sudah pernah digenerate tidak berubah/rusak tampilannya.
            const urutan = Array.isArray(s.urutan) && s.urutan.length === items.length - 1
                ? s.urutan
                : items.map((_, j) => j).filter(j => j !== kIdx);
            return {
                id: s.id,
                semua: items.map(it => it.nilai),
                tampil: urutan.map(j => items[j] ? items[j].nilai : undefined),
                kunci: items[kIdx].nilai,
                kunci_idx: kIdx,
                kunci_huruf: String.fromCharCode(65 + kIdx)
            };
        });
        return { ...kolom, soal };
    });
}

async function buildSoalDetail(modul, { withKunci = false } = {}) {
    let soal_list = []; try { soal_list = JSON.parse(modul.soal_list || '[]'); } catch (e) {}
    const soalDetail = [];
    for (const sl of soal_list) {
        const s = await db.prepare('SELECT * FROM soal WHERE kode=?').get(sl.soal_kode);
        if (s) {
            let data = null; try { data = JSON.parse(s.data || 'null'); } catch (e) {}
            data = expandSikapKerja(s.type, data);
            if (!withKunci) data = stripKunci(data);
            soalDetail.push({ kode:s.kode, nama:s.nama, type:s.type, skor_type:s.skor_type, opsi_jawaban:s.opsi_jawaban, timer_jam:s.timer_jam, timer_menit:s.timer_menit, timer_detik:s.timer_detik, data, acak_soal:sl.acak_soal, acak_jawaban:sl.acak_jawaban, persen:sl.persen||100 });
        }
    }
    return soalDetail;
}

async function hitungSkorUjianServer(modul_kode, jawaban) {
    jawaban = jawaban || {};
    const modul = await db.prepare('SELECT soal_list FROM modul WHERE kode=?').get(modul_kode);
    if (!modul) throw new Error('Modul tidak ditemukan saat menghitung skor');
    let soalList = []; try { soalList = JSON.parse(modul.soal_list || '[]'); } catch (e) {}

    let totalBobot = 0, totalTerbobot = 0;
    for (const sl of soalList) {
        const s = await db.prepare('SELECT * FROM soal WHERE kode=?').get(sl.soal_kode);
        if (!s || s.type === 'sikap_kerja') continue;

        let data = []; try { data = JSON.parse(s.data || '[]'); } catch (e) {}
        if (!Array.isArray(data) || !data.length) continue;

        const isNilaiSendiri = s.skor_type === 'nilai_sendiri';
        let benar = 0, total = 0, nilaiDapat = 0, nilaiMaks = 0;

        data.forEach((q, qIdx) => {
            const key = `${s.kode}_${qIdx}`;
            const ans = jawaban[key];
            const jawabanOpsi = Array.isArray(q.jawaban) ? q.jawaban : [];

            if (isNilaiSendiri) {
                total++;
                const opsi = s.opsi_jawaban || 1;
                const sortedNilai = jawabanOpsi.map(j => parseFloat(j.nilai) || 0).sort((a, b) => b - a);
                const maks = sortedNilai.slice(0, opsi).reduce((a, b) => a + b, 0);
                nilaiMaks += maks;
                if (ans != null && ans !== '') {
                    const pilihanIds = Array.isArray(ans) ? ans : [ans];
                    const dapat = pilihanIds.reduce((sum, pid) => {
                        const j = jawabanOpsi.find(jj => String(jj.id) === String(pid));
                        return sum + (parseFloat(j?.nilai) || 0);
                    }, 0);
                    nilaiDapat += dapat;
                }
            } else {
                total++;
                const kunciRaw = q.kunci;
                const kunci = Array.isArray(kunciRaw) ? kunciRaw.map(String) : (kunciRaw != null ? [String(kunciRaw)] : []);
                if (ans != null && ans !== '') {
                    let isBenar;
                    if (Array.isArray(ans)) {
                        isBenar = ans.length === kunci.length && ans.every(a => kunci.includes(String(a)));
                    } else {
                        isBenar = kunci.includes(String(ans));
                    }
                    if (isBenar) benar++;
                }
            }
        });

        const skorSoal = isNilaiSendiri
            ? (nilaiMaks > 0 ? (nilaiDapat / nilaiMaks * 100) : 0)
            : (total > 0 ? (benar / total * 100) : 0);

        const bobot = (sl.persen != null && sl.persen !== '') ? Number(sl.persen) : 100;
        totalBobot += bobot;
        totalTerbobot += skorSoal * bobot;
    }

    return totalBobot > 0 ? Math.round(totalTerbobot / totalBobot) : 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGREGASI ANALISA GRUP — dipakai oleh GET /api/analisa/grup/:grubToken
// ─────────────────────────────────────────────────────────────────────────────
// Porting dari logika hitungHasil() di ujian/hasil.js (yang sebelumnya cuma
// jalan di browser peserta, untuk 1 orang), supaya bisa dipakai di server utk
// menghitung BANYAK peserta sekaligus dari laporan.jawaban yang tersimpan.
// Konvensi key jawaban PERSIS sama dgn yang dipakai hitungSkorUjianServer():
//   - soal biasa (benar_salah / nilai_sendiri): `${soal_kode}_${qIdx}`
//   - soal sikap_kerja: `${soal_kode}_${kolomIdx}_${qIdxDalamKolom}`
// (Ini sudah dipakai konsisten sejak submit ujian — lihat ujian/ujian.html —
// jadi aman dipakai ulang di sini tanpa migrasi data apapun.)
//
// KEPUTUSAN PRODUK (multi-modul per grup): analisa-token.js sendiri sudah
// mengasumsikan 1 grup BISA berisi token dari beberapa modul berbeda
// (_atModulLabel menggabung nama modul kalau lebih dari 1). Tapi grafik
// per-nomor-soal & per-kolom Sikap Kerja di halaman detail cuma make sense
// kalau strukturnya 1 modul yang konsisten. Supaya tidak memblokir/mengubah
// perilaku Ringkasan Grup yang sudah menghitung SEMUA token apa adanya,
// keputusan pragmatis yang diambil di sini: 3 grafik (Benar/Salah, Nilai/
// Skor Sendiri, Sikap Kerja) dihitung HANYA dari modul yang paling banyak
// dipakai token dalam grup itu (mayoritas) — modul lain diabaikan utk grafik,
// tapi tetap terhitung di Ringkasan (total/terpakai/hangus) & daftar Modul.
// Kalau ternyata grup memang campur modul, field `multi_modul` dikirim ke
// frontend supaya bisa ditandai jelas ke admin (bukan disembunyikan diam2).
// Ini BISA direvisit nanti (mis. grafik terpisah per modul) tanpa perlu
// migrasi data apapun — murni perubahan agregasi di endpoint ini.
//
// CATATAN (setelah kolom grub_id ada): 1 grup (per grub_id) sekarang SELALU
// 1 modul murni by design — POST /api/tokens/generate cuma menerima 1
// modul_kode per request, dan grub_id baru dibuat sekali per request itu
// (lihat genGrubId()). Jadi utk grup BARU (grub_id terisi), "mayoritas" di
// atas otomatis = satu-satunya modul yang ada, tidak akan pernah ambigu.
// Logika mayoritas ini sekarang murni jaring pengaman utk grup LAMA (fallback
// "legacy:<nama>", grub_id NULL, dikelompokkan by nama) yang mungkin memang
// campur modul dari sebelum kolom ini ada.
function _analisaSoalButir(type, data) {
    if (!Array.isArray(data)) return 0;
    if (type === 'sikap_kerja') return data.reduce((a, kol) => a + ((kol && Array.isArray(kol.soal)) ? kol.soal.length : 0), 0);
    return data.length;
}

async function computeAnalisaGrupAggregate(modul_kode, laporanRows) {
    const modul = await db.prepare('SELECT * FROM modul WHERE kode=?').get(modul_kode);
    if (!modul) return { modul: null, binaryChart: [], skorChart: [], sikapRaw: [], tipeSoal: { binary: false, skor: false, sikap: false }, perSoal: [] };

    let soal_list = []; try { soal_list = JSON.parse(modul.soal_list || '[]'); } catch (e) {}
    const soalRows = [];
    for (const sl of soal_list) {
        const s = await db.prepare('SELECT * FROM soal WHERE kode=?').get(sl.soal_kode);
        if (!s) continue;
        let data = null; try { data = JSON.parse(s.data || 'null'); } catch (e) {}
        data = expandSikapKerja(s.type, data);
        soalRows.push({ kode: s.kode, nama: s.nama, type: s.type, skor_type: s.skor_type, data });
    }

    // Jawaban semua peserta (parse sekali di awal, urutan sejajar dgn laporanRows)
    const jawabanList = laporanRows.map(l => {
        try { return typeof l.jawaban === 'string' ? JSON.parse(l.jawaban || '{}') : (l.jawaban || {}); }
        catch (e) { return {}; }
    });
    const totalPeserta = jawabanList.length;

    const ringkasanSoal = [];
    // `binaryChart`/`skorChart`/`sikapRaw` TETAP dipertahankan sbg array
    // GABUNGAN se-modul dgn PENOMORAN GLOBAL (nomor jalan terus lintas soal,
    // tidak pernah reset) — dipakai APA ADANYA oleh konsumer lain yg memang
    // sudah benar mengasumsikan 1 modul = 1 seri nomor unik: lookup detail 1
    // butir soal by nomor (admin/analisa/analisa-soal.js, _asBuildOpsiData)
    // & sheet Excel gabungan (admin/analisa/analisa-export.js). JANGAN diubah
    // jadi nomor lokal per soal di sini, itu akan mematahkan kedua konsumer
    // itu (nomor jadi tidak unik lagi kalau 2 soal sama2 py butir no.1).
    //
    // `perSoal` di bawah adalah data BARU utk kartu "Grafik Per Soal" di
    // admin/analisa/analisa-token-detail.js — 1 ENTRI PER SOAL BERNAMA dlm
    // modul (persis urutan modul.soal_list), bukan lagi digabung jadi cuma 3
    // kartu tetap (binary/skor/sikap) utk SELURUH modul. Tiap entri bawa
    // nomor LOKAL (`local`, reset ke 1 tiap ganti soal) dipakai FE sbg label
    // sumbu-X grafik (biar tidak numpuk sampai >100 kalau modul py byk soal
    // digabung jadi 1 sumbu spt sebelumnya) + `nomor` GLOBAL yg sama dgn di
    // atas (dipakai FE saat klik sumbu-X utk drill-down ke halaman detail
    // butir soal, supaya lookup by-nomor itu tetap tepat sasaran).
    const binaryChart = [];   // [{nomor, local, soal_kode, soal_nama, benar, salah}]
    const skorChart = [];     // [{nomor, local, soal_kode, soal_nama, opsi:[{nilai,jumlah}]}]
    const sikapRaw = [];      // [kolomGlobalIdx] -> [{benar,salah,nama,id}] per peserta
    const perSoal = [];       // 1 entri per soal bernama, urut sesuai modul

    // Komposisi TIPE soal modul ini — dihitung dari `soalRows` (susunan modul
    // itu sendiri), BUKAN dari isi binaryChart/skorChart/sikapRaw di bawah.
    // Alasannya: binaryChart dkk bisa kosong walau modul MEMANG punya soal
    // tipe itu (mis. belum ada satu pun peserta yang menyelesaikan ujian) —
    // itu beda kasus dgn modul yg SUNGGUH-SUNGGUH tidak punya soal tipe itu
    // sama sekali. Frontend (analisa-token-detail.js) pakai flag ini utk
    // memutuskan apakah kartu grafik tipe tsb perlu ditampilkan sama sekali,
    // terpisah dari soal isinya (kosong data vs kosong tipe).
    const tipeSoal = { binary: false, skor: false, sikap: false };

    let binNomor = 0, skorNomor = 0, sikapGlobalKi = 0;

    for (const s of soalRows) {
        const data = Array.isArray(s.data) ? s.data : [];
        ringkasanSoal.push({ nama: s.nama, butir: _analisaSoalButir(s.type, data) });

        if (s.type === 'sikap_kerja') {
            tipeSoal.sikap = true;
            // `localKi` = indeks kolom LOKAL soal ini (K1, K2, ... dari 0 lagi
            // tiap soal Sikap Kerja baru), dipetakan ke slot GLOBAL
            // `sikapGlobalKi` yg TIDAK PERNAH direset lintas soal — supaya 2
            // soal Sikap Kerja terpisah dlm 1 modul tidak numpuk data kolom
            // yg sama (dulu `ki` lokal dipakai LANGSUNG sbg indeks sikapRaw,
            // jadi kolom-0 soal ke-2 ikut nimbun ke sikapRaw[0] milik soal
            // pertama — salah gabung 2 populasi peserta yg beda soal).
            const kolomLokalList = [];
            data.forEach((kol, localKi) => {
                const gk = sikapGlobalKi++;
                sikapRaw[gk] = [];
                const kolSoal = Array.isArray(kol.soal) ? kol.soal : [];
                jawabanList.forEach((jw, pi) => {
                    let benar = 0, salah = 0;
                    kolSoal.forEach((q, qi) => {
                        const ans = jw[`${s.kode}_${localKi}_${qi}`];
                        if (ans) { const k = q.kunci_huruf || q.kunci; if (ans === k) benar++; else salah++; }
                    });
                    const namaPeserta = (laporanRows[pi] && laporanRows[pi].user_nama) || `Peserta ${pi + 1}`;
                    // `id` = kode laporan (1 baris = 1 pengerjaan/token, BUKAN 1 akun).
                    // Kalau 1 akun mengerjakan token berbeda lebih dari sekali, nama
                    // yg sama bisa muncul di beberapa baris `pi` yg berbeda di sini —
                    // tanpa `id` ini, frontend (analisa-grafik.js) tidak bisa
                    // membedakan pengerjaan mana yg diklik saat overlay grafik
                    // per-orang dibangun, dan akan salah gabung data antar
                    // pengerjaan yg berbeda hanya krn nama sama. `id` dipakai
                    // frontend sbg kunci pencarian (bukan `nama`, yg boleh dobel).
                    const idPengerjaan = (laporanRows[pi] && laporanRows[pi].laporan_kode) || ('idx:' + pi);
                    sikapRaw[gk].push({ benar, salah, nama: namaPeserta, id: idPengerjaan });
                });
                kolomLokalList.push(gk);
            });
            if (kolomLokalList.length) {
                perSoal.push({
                    soal_kode: s.kode, soal_nama: s.nama, tipe: 'sikap',
                    categories: kolomLokalList.map((_, i) => 'K' + (i + 1)),
                    catRaw: kolomLokalList.map(gk => sikapRaw[gk])
                });
            }
            continue;
        }

        const isNilaiSendiri = s.skor_type === 'nilai_sendiri';
        if (isNilaiSendiri) tipeSoal.skor = true; else tipeSoal.binary = true;
        let localNomor = 0;
        const soalBinaryItems = [], soalSkorItems = [];
        data.forEach((q, qi) => {
            const jawabanOpsi = Array.isArray(q.jawaban) ? q.jawaban : [];
            const pertanyaan = q.soal || '';
            const pembahasan = q.pembahasan || '';
            localNomor++;

            // Nama peserta yang memilih tiap opsi — dipakai halaman detail soal
            // (admin/analisa/analisa-soal.js). Dihitung sekali per opsi di sini
            // (bukan dikirim ulang jawaban mentah ke frontend), jadi tetap sesuai
            // prinsip "server yang agregasi" walau detailnya cukup dalam.
            const pemilihOpsi = (optId) => {
                const names = [];
                jawabanList.forEach((jw, pi) => {
                    const ans = jw[`${s.kode}_${qi}`];
                    if (ans == null || ans === '') return;
                    const ids = Array.isArray(ans) ? ans : [ans];
                    if (ids.some(pid => String(pid) === String(optId))) {
                        names.push((laporanRows[pi] && laporanRows[pi].user_nama) || `Peserta ${pi + 1}`);
                    }
                });
                return names;
            };

            if (isNilaiSendiri) {
                skorNomor++;
                const options = jawabanOpsi.map(j => {
                    const names = pemilihOpsi(j.id);
                    return { id: j.id, teks: j.teks || '', nilai: parseFloat(j.nilai) || 0, isKunci: (parseFloat(j.nilai) || 0) > 0, count: names.length, jumlah: names.length, names };
                });
                const item = { nomor: skorNomor, local: localNomor, soal_kode: s.kode, soal_nama: s.nama, pertanyaan, pembahasan, opsi: options.map(o => ({ nilai: o.nilai, jumlah: o.jumlah })), options };
                skorChart.push(item);
                soalSkorItems.push(item);
            } else {
                binNomor++;
                const kunciRaw = q.kunci;
                const kunci = Array.isArray(kunciRaw) ? kunciRaw.map(String) : (kunciRaw != null ? [String(kunciRaw)] : []);
                let benar = 0;
                jawabanList.forEach(jw => {
                    const ans = jw[`${s.kode}_${qi}`];
                    if (ans == null || ans === '') return;
                    let isBenar;
                    if (Array.isArray(ans)) isBenar = ans.length === kunci.length && ans.every(a => kunci.includes(String(a)));
                    else isBenar = kunci.includes(String(ans));
                    if (isBenar) benar++;
                });
                const options = jawabanOpsi.map(j => {
                    const names = pemilihOpsi(j.id);
                    return { id: j.id, teks: j.teks || '', isKunci: kunci.includes(String(j.id)), count: names.length, names };
                });
                const item = { nomor: binNomor, local: localNomor, soal_kode: s.kode, soal_nama: s.nama, benar, salah: totalPeserta - benar, pertanyaan, pembahasan, options };
                binaryChart.push(item);
                soalBinaryItems.push(item);
            }
        });
        if (soalBinaryItems.length) perSoal.push({ soal_kode: s.kode, soal_nama: s.nama, tipe: 'binary', items: soalBinaryItems });
        if (soalSkorItems.length) perSoal.push({ soal_kode: s.kode, soal_nama: s.nama, tipe: 'skor', items: soalSkorItems });
    }

    return {
        modul: { kode: modul.kode, nama: modul.nama, soal: ringkasanSoal },
        binaryChart, skorChart, sikapRaw, tipeSoal, perSoal
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGREGASI ANALISA SOAL TUNGGAL (ITEM DATA) — dipakai oleh
// POST /api/analisa/soal/:kode/hitung (admin/analisa/analisa-soal-detail.js,
// kartu "Grafik"). BEDA dengan computeAnalisaGrupAggregate() di atas:
//   - Sumber pesertanya BUKAN 1 grup token, tapi SAMPEL MANUAL (individu/grup)
//     yang dipilih admin di kartu "Sampel" halaman itu — daftar user_kode
//     final (individu + anggota grup yang tidak dikeluarkan) dikirim FE lewat
//     body request, lalu di sini ditarik ULANG laporannya dari DB (bukan
//     percaya jawaban mentah dari client) supaya tetap 1 sumber kebenaran.
//   - Hanya 1 soal (bukan seluruh soal_list 1 modul), jadi tidak perlu loop
//     banyak soal / hitung modul mayoritas — nomor grafik SELALU mulai dari 1
//     lagi khusus utk soal ini (butir-butir DALAM soal ini saja, kalau
//     tipenya multiple_choice/linier dengan lebih dari 1 butir).
//   - Sengaja DIPISAH dari computeAnalisaGrupAggregate (bukan dipanggil dari
//     situ dengan soal_list 1 elemen) supaya perubahan/perbaikan salah satu
//     tidak berisiko mengubah perilaku yang lain tanpa sengaja — sedikit
//     duplikasi logika per-butir, tapi 2 sumber data (grup token vs sampel
//     manual per-soal) memang berbeda konteks & lebih aman dijaga terpisah.
async function computeAnalisaSoalAggregate(soalKode, laporanRows) {
    const s = await db.prepare('SELECT * FROM soal WHERE kode=?').get(soalKode);
    if (!s) return { binaryChart: [], skorChart: [], sikapRaw: [], tipeSoal: { binary: false, skor: false, sikap: false } };

    let data = null; try { data = JSON.parse(s.data || 'null'); } catch (e) {}
    data = expandSikapKerja(s.type, data);
    data = Array.isArray(data) ? data : [];

    const jawabanList = laporanRows.map(l => {
        try { return typeof l.jawaban === 'string' ? JSON.parse(l.jawaban || '{}') : (l.jawaban || {}); }
        catch (e) { return {}; }
    });
    const totalPeserta = jawabanList.length;

    const binaryChart = [], skorChart = [], sikapRaw = [];
    const tipeSoal = { binary: false, skor: false, sikap: false };
    let binNomor = 0, skorNomor = 0;

    if (s.type === 'sikap_kerja') {
        tipeSoal.sikap = true;
        data.forEach((kol, ki) => {
            sikapRaw[ki] = [];
            const kolSoal = Array.isArray(kol.soal) ? kol.soal : [];
            jawabanList.forEach((jw, pi) => {
                let benar = 0, salah = 0;
                kolSoal.forEach((q, qi) => {
                    const ans = jw[`${s.kode}_${ki}_${qi}`];
                    if (ans) { const k = q.kunci_huruf || q.kunci; if (ans === k) benar++; else salah++; }
                });
                const namaPeserta = (laporanRows[pi] && laporanRows[pi].user_nama) || `Peserta ${pi + 1}`;
                const idPengerjaan = (laporanRows[pi] && laporanRows[pi].laporan_kode) || ('idx:' + pi);
                sikapRaw[ki].push({ benar, salah, nama: namaPeserta, id: idPengerjaan });
            });
        });
        return { binaryChart, skorChart, sikapRaw, tipeSoal };
    }

    const isNilaiSendiri = s.skor_type === 'nilai_sendiri';
    if (isNilaiSendiri) tipeSoal.skor = true; else tipeSoal.binary = true;

    data.forEach((q, qi) => {
        const jawabanOpsi = Array.isArray(q.jawaban) ? q.jawaban : [];
        const pertanyaan = q.soal || '';
        const pembahasan = q.pembahasan || '';

        const pemilihOpsi = (optId) => {
            const names = [];
            jawabanList.forEach((jw, pi) => {
                const ans = jw[`${s.kode}_${qi}`];
                if (ans == null || ans === '') return;
                const ids = Array.isArray(ans) ? ans : [ans];
                if (ids.some(pid => String(pid) === String(optId))) {
                    names.push((laporanRows[pi] && laporanRows[pi].user_nama) || `Peserta ${pi + 1}`);
                }
            });
            return names;
        };

        if (isNilaiSendiri) {
            skorNomor++;
            const options = jawabanOpsi.map(j => {
                const names = pemilihOpsi(j.id);
                return { id: j.id, teks: j.teks || '', nilai: parseFloat(j.nilai) || 0, isKunci: (parseFloat(j.nilai) || 0) > 0, count: names.length, jumlah: names.length, names };
            });
            skorChart.push({ nomor: skorNomor, materi: q.materi || null, pertanyaan, pembahasan, opsi: options.map(o => ({ nilai: o.nilai, jumlah: o.jumlah })), options });
        } else {
            binNomor++;
            const kunciRaw = q.kunci;
            const kunci = Array.isArray(kunciRaw) ? kunciRaw.map(String) : (kunciRaw != null ? [String(kunciRaw)] : []);
            let benar = 0;
            jawabanList.forEach(jw => {
                const ans = jw[`${s.kode}_${qi}`];
                if (ans == null || ans === '') return;
                let isBenar;
                if (Array.isArray(ans)) isBenar = ans.length === kunci.length && ans.every(a => kunci.includes(String(a)));
                else isBenar = kunci.includes(String(ans));
                if (isBenar) benar++;
            });
            const options = jawabanOpsi.map(j => {
                const names = pemilihOpsi(j.id);
                return { id: j.id, teks: j.teks || '', isKunci: kunci.includes(String(j.id)), count: names.length, names };
            });
            binaryChart.push({ nomor: binNomor, materi: q.materi || null, benar, salah: totalPeserta - benar, pertanyaan, pembahasan, options });
        }
    });

    return { binaryChart, skorChart, sikapRaw, tipeSoal };
}


// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES: AUTH & USERS
// ═══════════════════════════════════════════════════════════════════════════════
app.post('/api/login', ah(async (req, res) => {
    const { password } = req.body;
    const email = normEmail(req.body.email);
    const user = await db.prepare('SELECT * FROM users WHERE email=?').get(email);
    if (!user)                           return res.status(401).json({ error: 'Email tidak ditemukan' });
    if (user.status === 'suspend')       return res.status(403).json({ error: 'Akun di-suspend' });
    if (user.status === 'pending')       return res.status(403).json({ error: 'Akun menunggu aktivasi' });
    if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Password salah' });
    const token = jwt.sign(
        { id: user.id, kode: user.kode, email: user.email, nama: user.nama, role: user.role },
        JWT_SECRET, { expiresIn: '7d' }
    );
    res.json({ token, user: { kode: user.kode, nama: user.nama, email: user.email, role: user.role } });
}));

// Catatan alur baru (landing "animation frame" + konfirmasi OTP): akun TIDAK
// lagi langsung dibuat begitu form daftar disubmit. POST /api/signup cuma
// memvalidasi data & menyimpannya sementara di tabel signup_otps sambil
// mengirim kode OTP 6 digit ke email (lewat Resend, lib/mailer.js — sama
// seperti alur lupa kata sandi). Baris `users` yang sesungguhnya baru ditulis
// oleh POST /api/signup/verify-otp setelah kode OTP dicocokkan, dan baru saat
// itu token login diterbitkan (bisa langsung login). TIDAK lagi masuk antrian
// signup_requests. Kalau user memilih paket saat daftar, itu dicatat sebagai
// permintaan aktivasi paket terpisah (paket_requests) yang menunggu verifikasi
// admin — akun tetap bisa dipakai login walau paketnya belum aktif. Endpoint
// signup_requests/approve/reject lama TETAP dibiarkan ada (tidak dihapus)
// untuk kompatibilitas data lama, tapi alur baru ini tidak lagi menulis ke
// tabel itu.
app.post('/api/signup', ah(async (req, res) => {
    const { nama, password } = req.body;
    const email = normEmail(req.body.email);
    if (!nama || !email || !password) return res.status(400).json({ error: 'Data tidak lengkap' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Kata sandi minimal 8 karakter' });
    try {
        if (await db.prepare('SELECT id FROM users WHERE email=?').get(email))
            return res.status(400).json({ error: 'Email sudah terdaftar' });
        const hash = bcrypt.hashSync(password, 10);
        await kirimSignupOtp(nama, email, hash);
        res.json({ message: 'Kode OTP telah dikirim ke email Anda.', email });
    } catch (e) { res.status(500).json({ error: e.message }); }
}));

// Buat/kirim ulang kode OTP pendaftaran + simpan data pendaftaran (dipakai oleh
// /api/signup di atas dan /api/signup/resend-otp di bawah).
async function kirimSignupOtp(nama, email, passwordHash) {
    const otp = genOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await db.prepare('INSERT INTO signup_otps (nama,email,password,otp,expires_at) VALUES (?,?,?,?,?)')
        .run(nama, email, passwordHash, otp, expiresAt);
    console.log(`[OTP] Kode konfirmasi pendaftaran untuk ${email}: ${otp} (berlaku 10 menit)`);
    // PENTING (Vercel serverless): HARUS di-await sebelum function ini selesai.
    // Kalau fire-and-forget, function bisa dibekukan/dimatikan begitu response
    // terkirim, sebelum request HTTP ke Resend sempat selesai — akibatnya email
    // TIDAK PERNAH benar-benar terkirim walau tidak ada error yang kelihatan.
    await kirimEmailAman({
        to: email,
        subject: 'Kode OTP Konfirmasi Pendaftaran — CIBN PRESTISE',
        html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">
            <p>Halo ${nama || ''},</p>
            <p>Kode OTP untuk mengonfirmasi pendaftaran akun kamu di CIBN PRESTISE:</p>
            <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${otp}</p>
            <p>Kode ini berlaku 10 menit. Kalau kamu tidak merasa mendaftar, abaikan email ini.</p>
        </div>`,
    }, 'signup OTP'); // Kegagalan kirim tidak boleh menggagalkan response ke user, tapi tetap dicatat di log.
}

app.post('/api/signup/resend-otp', ah(async (req, res) => {
    const email = normEmail(req.body.email);
    if (!email) return res.status(400).json({ error: 'Email wajib diisi' });
    try {
        if (await db.prepare('SELECT id FROM users WHERE email=?').get(email))
            return res.status(400).json({ error: 'Email sudah terdaftar' });
        const row = await db.prepare('SELECT nama,password FROM signup_otps WHERE email=? ORDER BY id DESC LIMIT 1').get(email);
        if (!row) return res.status(400).json({ error: 'Tidak ada pendaftaran yang menunggu untuk email ini. Silakan isi ulang form pendaftaran.' });
        await kirimSignupOtp(row.nama, email, row.password);
        res.json({ message: 'Kode OTP baru telah dikirim.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
}));

app.post('/api/signup/verify-otp', ah(async (req, res) => {
    const { otp } = req.body;
    const email = normEmail(req.body.email);
    if (!email || !otp) return res.status(400).json({ error: 'Data tidak lengkap' });
    try {
        const row = await db.prepare('SELECT * FROM signup_otps WHERE email=? AND otp=? ORDER BY id DESC LIMIT 1').get(email, otp);
        if (!row) return res.status(400).json({ error: 'Kode OTP salah' });
        if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'Kode OTP sudah kedaluwarsa' });
        if (await db.prepare('SELECT id FROM users WHERE email=?').get(email)) {
            await db.prepare('DELETE FROM signup_otps WHERE email=?').run(email);
            return res.status(400).json({ error: 'Email sudah terdaftar' });
        }
        const kode = await genKode('USR', 'users');
        await db.prepare('INSERT INTO users (kode,nama,email,password,role,status) VALUES (?,?,?,?,?,?)')
            .run(kode, row.nama, row.email, row.password, 'user', 'aktif');
        await db.prepare('DELETE FROM signup_otps WHERE email=?').run(email);
        // Catatan: pemilihan/aktivasi paket TIDAK lagi ditulis di sini. Kalau user
        // memilih paket saat daftar, permintaan aktivasinya baru dibuat di halaman
        // pembayaran.html/qris.html (lewat POST /api/user/paket-requests) setelah
        // token login di bawah ini dipakai — supaya akun-baru maupun akun-lama yang
        // login ulang untuk beli/perpanjang paket sama-sama lewat satu jalur yang sama.
        const token = jwt.sign({ id: kode, kode, email: row.email, nama: row.nama, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ message: 'Pendaftaran berhasil. Akun Anda sudah aktif.', token, user: { kode, nama: row.nama, email: row.email, role: 'user' } });
    } catch (e) { res.status(500).json({ error: e.message }); }
}));

// Permintaan aktivasi paket dari user yang SUDAH login (mis. login lalu pilih
// paket, atau ganti/perpanjang paket) — dipakai oleh pembayaran.html/qris.html.
app.post('/api/user/paket-requests', auth(['user','admin','review']), ah(async (req, res) => {
    const { paket_kode, paket_nama, metode_bayar } = req.body;
    if (!paket_kode && !paket_nama) return res.status(400).json({ error: 'Paket wajib dipilih' });
    let namaFinal = paket_nama || null;
    if (paket_kode) {
        const p = await db.prepare('SELECT nama FROM pakets WHERE kode=?').get(paket_kode);
        if (p) namaFinal = p.nama;
    }
    if (!namaFinal) return res.status(400).json({ error: 'Paket tidak ditemukan' });
    const kode = await genKode('PREQ', 'paket_requests');
    await db.prepare('INSERT INTO paket_requests (kode,user_kode,paket_kode,paket_nama,metode_bayar,status) VALUES (?,?,?,?,?,?)')
        .run(kode, req.user.kode, paket_kode || null, namaFinal, metode_bayar || null, 'pending');
    res.json({ kode, message: 'Konfirmasi pembayaran diterima. Menunggu verifikasi admin untuk mengaktifkan paket.' });
}));

// ── Admin: daftar & verifikasi permintaan aktivasi paket ──
app.get('/api/paket-requests', auth(['admin']), ah(async (req, res) => {
    res.json(await db.prepare(`SELECT pr.*, u.nama as user_nama, u.email as user_email FROM paket_requests pr LEFT JOIN users u ON pr.user_kode=u.kode WHERE pr.status='pending' ORDER BY pr.created_at DESC`).all());
}));
app.post('/api/paket-requests/:kode/approve', auth(['admin']), ah(async (req, res) => {
    const r = await db.prepare('SELECT * FROM paket_requests WHERE kode=?').get(req.params.kode);
    if (!r) return res.status(404).json({ error: 'Tidak ditemukan' });
    try {
        await transaction(async (tdb) => {
            await aktivasiPaketOtomatis(r.user_kode, r.paket_kode, r.paket_nama, tdb);
            await tdb.prepare(`UPDATE paket_requests SET status='aktif' WHERE kode=?`).run(r.kode);
        });
        res.json({ message: 'Paket berhasil diaktifkan' });
    } catch (e) { res.status(500).json({ error: e.message }); }
}));
app.delete('/api/paket-requests/:kode', auth(['admin']), ah(async (req, res) => {
    await db.prepare(`UPDATE paket_requests SET status='ditolak' WHERE kode=?`).run(req.params.kode);
    res.json({ message: 'Ditolak' });
}));

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT GATEWAY ASLI (Midtrans / Xendit) — koneksi pihak ke-3 sungguhan.
// ═══════════════════════════════════════════════════════════════════════════

// ── Admin: lihat & simpan konfigurasi gateway ──
app.get('/api/admin/gateway', auth(['admin']), ah(async (req, res) => {
    const cfg = await getGatewayConfig();
    const host = `${req.protocol}://${req.get('host')}`;
    res.json({
        active_provider: cfg.active_provider || 'none',
        midtrans: {
            configured: !!(cfg.midtrans_server_key && cfg.midtrans_client_key),
            server_key_masked: maskGatewayKey(cfg.midtrans_server_key),
            client_key_masked: maskGatewayKey(cfg.midtrans_client_key),
            mode: cfg.midtrans_mode || 'sandbox',
            webhook_url: `${host}/api/pembayaran/notify/midtrans`
        },
        xendit: {
            configured: !!cfg.xendit_secret_key,
            secret_key_masked: maskGatewayKey(cfg.xendit_secret_key),
            callback_token_configured: !!cfg.xendit_callback_token,
            webhook_url: `${host}/api/pembayaran/notify/xendit`
        }
    });
}));
app.post('/api/admin/gateway', auth(['admin']), ah(async (req, res) => {
    const b = req.body || {};
    const cfg = await getGatewayConfig();
    const next = {
        active_provider: b.active_provider !== undefined ? String(b.active_provider) : (cfg.active_provider || 'none'),
        midtrans_server_key: b.midtrans_server_key ? String(b.midtrans_server_key).trim() : cfg.midtrans_server_key || null,
        midtrans_client_key: b.midtrans_client_key ? String(b.midtrans_client_key).trim() : cfg.midtrans_client_key || null,
        midtrans_mode: b.midtrans_mode || cfg.midtrans_mode || 'sandbox',
        xendit_secret_key: b.xendit_secret_key ? String(b.xendit_secret_key).trim() : cfg.xendit_secret_key || null,
        xendit_callback_token: b.xendit_callback_token ? String(b.xendit_callback_token).trim() : cfg.xendit_callback_token || null,
    };
    if (!['none', 'midtrans', 'xendit'].includes(next.active_provider))
        return res.status(400).json({ error: 'active_provider tidak valid' });
    if (next.active_provider === 'midtrans' && !(next.midtrans_server_key && next.midtrans_client_key))
        return res.status(400).json({ error: 'Isi Server Key & Client Key Midtrans dulu sebelum mengaktifkannya sebagai gateway aktif' });
    if (next.active_provider === 'xendit' && !next.xendit_secret_key)
        return res.status(400).json({ error: 'Isi Secret Key Xendit dulu sebelum mengaktifkannya sebagai gateway aktif' });
    await db.prepare(`UPDATE payment_gateway_config SET active_provider=?, midtrans_server_key=?, midtrans_client_key=?, midtrans_mode=?, xendit_secret_key=?, xendit_callback_token=?, updated_at=CURRENT_TIMESTAMP WHERE id=1`)
        .run(next.active_provider, next.midtrans_server_key, next.midtrans_client_key, next.midtrans_mode, next.xendit_secret_key, next.xendit_callback_token);
    res.json({ message: 'Konfigurasi payment gateway disimpan', active_provider: next.active_provider });
}));

// ── Admin: daftar transaksi ASLI dari gateway (bukan lagi localStorage demo) ──
app.get('/api/admin/transaksi', auth(['admin']), ah(async (req, res) => {
    res.json(await db.prepare(`SELECT t.*, u.nama as user_nama, u.email as user_email FROM transaksi t LEFT JOIN users u ON t.user_kode = u.kode ORDER BY t.created_at DESC LIMIT 300`).all());
}));

// ── Publik: status gateway aktif saja (TANPA kredensial) — dipakai pembayaran.html/qris.html
// untuk tahu apakah harus memakai alur real-time atau fallback konfirmasi manual. ──
app.get('/api/pembayaran/gateway-status', ah(async (req, res) => {
    const cfg = await getGatewayConfig();
    res.json({ active_provider: cfg.active_provider || 'none' });
}));

// ── User: buat transaksi pembayaran REAL ke Midtrans/Xendit ──
// body: { paket_kode, metode: 'snap'|'qris'|'invoice' }
app.post('/api/pembayaran/create', auth(['user', 'admin', 'review']), ah(async (req, res) => {
    const { paket_kode, metode } = req.body || {};
    if (!paket_kode) return res.status(400).json({ error: 'Paket wajib dipilih' });
    const paket = await db.prepare("SELECT * FROM pakets WHERE kode=? AND status='aktif'").get(paket_kode);
    if (!paket) return res.status(404).json({ error: 'Paket tidak ditemukan atau tidak aktif' });
    const cfg = await getGatewayConfig();
    const provider = cfg.active_provider || 'none';
    if (provider === 'none') return res.status(400).json({ error: 'Payment gateway belum diaktifkan admin. Gunakan konfirmasi manual (Saya Sudah Bayar).' });
    const user = await db.prepare('SELECT * FROM users WHERE kode=?').get(req.user.kode);
    if (!user) return res.status(404).json({ error: 'Akun tidak ditemukan' });
    const orderId = genOrderId('CIBN');
    const jumlah  = parseInt(paket.harga || 0, 10);
    const host    = `${req.protocol}://${req.get('host')}`;
    const namaSplit = (user.nama || 'Pengguna').trim().split(/\s+/);
    const firstName = namaSplit[0] || 'Pengguna';
    const lastName  = namaSplit.slice(1).join(' ') || undefined;

    try {
        if (provider === 'midtrans') {
            if (!cfg.midtrans_server_key) return res.status(400).json({ error: 'Server Key Midtrans belum diisi admin' });
            const isProd = cfg.midtrans_mode === 'production';
            const authHeader = 'Basic ' + Buffer.from(cfg.midtrans_server_key + ':').toString('base64');

            if (metode === 'qris') {
                const base = isProd ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
                const r = await fetch(`${base}/v2/charge`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': authHeader },
                    body: JSON.stringify({
                        payment_type: 'qris',
                        transaction_details: { order_id: orderId, gross_amount: jumlah },
                        qris: { acquirer: 'gopay' },
                        customer_details: { first_name: firstName, last_name: lastName, email: user.email }
                    })
                });
                const result = await r.json();
                if (!r.ok) throw new Error(result.status_message || 'Gagal membuat transaksi QRIS Midtrans');
                const qrAction = (result.actions || []).find(a => a.name === 'generate-qr-code');
                await db.prepare(`INSERT INTO transaksi (order_id,user_kode,paket_kode,paket_nama,gateway,metode,jumlah,status,qr_string,raw_response) VALUES (?,?,?,?,?,?,?,?,?,?)`)
                    .run(orderId, req.user.kode, paket.kode, paket.nama, 'midtrans', 'qris', jumlah, 'pending', qrAction ? qrAction.url : null, JSON.stringify(result));
                return res.json({ order_id: orderId, gateway: 'midtrans', metode: 'qris', qr_image_url: qrAction ? qrAction.url : null, jumlah, paket_nama: paket.nama });
            } else {
                const base = isProd ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
                const r = await fetch(`${base}/snap/v1/transactions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': authHeader },
                    body: JSON.stringify({
                        transaction_details: { order_id: orderId, gross_amount: jumlah },
                        customer_details: { first_name: firstName, last_name: lastName, email: user.email },
                        callbacks: { finish: `${host}/pembayaran?status=selesai&order_id=${orderId}` }
                    })
                });
                const result = await r.json();
                if (!r.ok) throw new Error((result.error_messages || []).join(', ') || 'Gagal membuat transaksi Midtrans');
                await db.prepare(`INSERT INTO transaksi (order_id,user_kode,paket_kode,paket_nama,gateway,metode,jumlah,status,redirect_url,raw_response) VALUES (?,?,?,?,?,?,?,?,?,?)`)
                    .run(orderId, req.user.kode, paket.kode, paket.nama, 'midtrans', 'snap', jumlah, 'pending', result.redirect_url, JSON.stringify(result));
                return res.json({ order_id: orderId, gateway: 'midtrans', metode: 'snap', snap_token: result.token, redirect_url: result.redirect_url, client_key: cfg.midtrans_client_key, is_production: isProd, jumlah, paket_nama: paket.nama });
            }
        } else if (provider === 'xendit') {
            if (!cfg.xendit_secret_key) return res.status(400).json({ error: 'Secret Key Xendit belum diisi admin' });
            const authHeader = 'Basic ' + Buffer.from(cfg.xendit_secret_key + ':').toString('base64');

            if (metode === 'qris') {
                const r = await fetch('https://api.xendit.co/qr_codes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
                    body: JSON.stringify({ external_id: orderId, type: 'DYNAMIC', callback_url: `${host}/api/pembayaran/notify/xendit`, amount: jumlah })
                });
                const result = await r.json();
                if (!r.ok) throw new Error(result.message || 'Gagal membuat QRIS Xendit');
                await db.prepare(`INSERT INTO transaksi (order_id,user_kode,paket_kode,paket_nama,gateway,metode,jumlah,status,external_id,qr_string,raw_response) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
                    .run(orderId, req.user.kode, paket.kode, paket.nama, 'xendit', 'qris', jumlah, 'pending', result.id || null, result.qr_string || null, JSON.stringify(result));
                return res.json({ order_id: orderId, gateway: 'xendit', metode: 'qris', qr_string: result.qr_string, jumlah, paket_nama: paket.nama });
            } else {
                const r = await fetch('https://api.xendit.co/v2/invoices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
                    body: JSON.stringify({
                        external_id: orderId, amount: jumlah, payer_email: user.email,
                        description: `Pembayaran paket ${paket.nama} - CIBN PRESTISE`,
                        success_redirect_url: `${host}/pembayaran?status=selesai&order_id=${orderId}`,
                        failure_redirect_url: `${host}/pembayaran?status=gagal&order_id=${orderId}`
                    })
                });
                const result = await r.json();
                if (!r.ok) throw new Error(result.message || 'Gagal membuat invoice Xendit');
                await db.prepare(`INSERT INTO transaksi (order_id,user_kode,paket_kode,paket_nama,gateway,metode,jumlah,status,external_id,redirect_url,raw_response) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
                    .run(orderId, req.user.kode, paket.kode, paket.nama, 'xendit', 'invoice', jumlah, 'pending', result.id || null, result.invoice_url || null, JSON.stringify(result));
                return res.json({ order_id: orderId, gateway: 'xendit', metode: 'invoice', redirect_url: result.invoice_url, jumlah, paket_nama: paket.nama });
            }
        }
        return res.status(400).json({ error: 'Provider gateway tidak dikenali' });
    } catch (e) {
        console.error('[PEMBAYARAN CREATE ERROR]', e.message);
        return res.status(502).json({ error: 'Gagal menghubungi payment gateway: ' + e.message });
    }
}));

// ── User/Admin: cek status transaksi (untuk polling di halaman qris.html/pembayaran.html) ──
app.get('/api/pembayaran/status/:order_id', auth(['user', 'admin', 'review']), ah(async (req, res) => {
    const trx = await db.prepare('SELECT * FROM transaksi WHERE order_id=?').get(req.params.order_id);
    if (!trx) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    if (req.user.role === 'user' && trx.user_kode !== req.user.kode) return res.status(403).json({ error: 'Forbidden' });
    res.json({ order_id: trx.order_id, status: trx.status, paket_nama: trx.paket_nama, jumlah: trx.jumlah, gateway: trx.gateway });
}));

// ── Webhook Midtrans (dipanggil server Midtrans, BUKAN oleh browser — tanpa JWT) ──
// Daftarkan URL ini ("<host>/api/pembayaran/notify/midtrans") di dashboard Midtrans:
// Settings > Configuration > Payment Notification URL.
app.post('/api/pembayaran/notify/midtrans', ah(async (req, res) => {
    const body = req.body || {};
    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status } = body;
    if (!order_id) return res.status(400).json({ error: 'order_id wajib' });
    const cfg = await getGatewayConfig();
    if (!cfg.midtrans_server_key) return res.status(400).json({ error: 'Gateway Midtrans belum dikonfigurasi' });
    const expectedSig = crypto.createHash('sha512').update(`${order_id}${status_code}${gross_amount}${cfg.midtrans_server_key}`).digest('hex');
    if (signature_key !== expectedSig) {
        console.warn('[MIDTRANS NOTIFY] Signature tidak valid untuk order_id', order_id);
        return res.status(403).json({ error: 'Signature tidak valid' });
    }
    const trx = await db.prepare('SELECT * FROM transaksi WHERE order_id=?').get(order_id);
    if (!trx) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    let newStatus = trx.status;
    if (transaction_status === 'capture' || transaction_status === 'settlement') {
        newStatus = (fraud_status && fraud_status !== 'accept') ? 'pending' : 'success';
    } else if (transaction_status === 'expire') newStatus = 'expired';
    else if (['deny', 'cancel', 'failure'].includes(transaction_status)) newStatus = 'failed';
    if (newStatus !== trx.status) {
        if (newStatus === 'success') {
            await transaction(async (tdb) => {
                await tdb.prepare('UPDATE transaksi SET status=?, raw_response=?, updated_at=CURRENT_TIMESTAMP WHERE order_id=?').run(newStatus, JSON.stringify(body), order_id);
                await aktivasiPaketOtomatis(trx.user_kode, trx.paket_kode, trx.paket_nama, tdb);
            });
        } else {
            await db.prepare('UPDATE transaksi SET status=?, raw_response=?, updated_at=CURRENT_TIMESTAMP WHERE order_id=?').run(newStatus, JSON.stringify(body), order_id);
        }
    }
    res.json({ message: 'OK' });
}));

// ── Webhook Xendit (dipanggil server Xendit — verifikasi via header x-callback-token) ──
// Daftarkan URL ini di dashboard Xendit: Settings > Developers > Webhooks (Invoice
// Paid & QR Code Payment), lalu tempel "Verification Token" yang sama ke panel admin.
app.post('/api/pembayaran/notify/xendit', ah(async (req, res) => {
    const cfg = await getGatewayConfig();
    const token = req.headers['x-callback-token'];
    if (cfg.xendit_callback_token && token !== cfg.xendit_callback_token) {
        console.warn('[XENDIT NOTIFY] Callback token tidak valid');
        return res.status(403).json({ error: 'Callback token tidak valid' });
    }
    const body = req.body || {};
    let externalId = body.external_id;
    let paid = false;
    if (body.event && body.data) {
        // Callback QR Code (event: 'qr.payment')
        externalId = body.data.reference_id || body.data.external_id || externalId;
        paid = true;
    } else if (body.status) {
        // Callback Invoice
        paid = ['PAID', 'SETTLED', 'COMPLETED'].includes(body.status);
    }
    if (!externalId) return res.status(400).json({ error: 'external_id wajib' });
    const trx = await db.prepare('SELECT * FROM transaksi WHERE order_id=?').get(externalId);
    if (!trx) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    let newStatus = trx.status;
    if (paid) newStatus = 'success';
    else if (body.status === 'EXPIRED') newStatus = 'expired';
    else if (body.status === 'FAILED') newStatus = 'failed';
    if (newStatus !== trx.status) {
        if (newStatus === 'success') {
            await transaction(async (tdb) => {
                await tdb.prepare('UPDATE transaksi SET status=?, raw_response=?, updated_at=CURRENT_TIMESTAMP WHERE order_id=?').run(newStatus, JSON.stringify(body), externalId);
                await aktivasiPaketOtomatis(trx.user_kode, trx.paket_kode, trx.paket_nama, tdb);
            });
        } else {
            await db.prepare('UPDATE transaksi SET status=?, raw_response=?, updated_at=CURRENT_TIMESTAMP WHERE order_id=?').run(newStatus, JSON.stringify(body), externalId);
        }
    }
    res.json({ message: 'OK' });
}));

// ── Lupa kata sandi via OTP (halaman otp.html) ──
// Kode OTP sekarang benar-benar dikirim lewat Resend (lib/mailer.js), memakai
// kredensial yang diisi admin di dock Management > EMAIL. Kalau Resend belum
// diisi/diaktifkan, kirimEmail() otomatis fallback mencatat ke console.log
// server (lihat lib/mailer.js) supaya alur tetap bisa dites tanpa Resend nyata.
function genOtp() { return String(Math.floor(100000 + Math.random() * 900000)); }

// Normalisasi email (trim + lowercase) supaya "User@Gmail.com" dan
// " user@gmail.com " dianggap akun yang sama saat daftar/login/lupa password.
// Tanpa ini, email yang cocok persis-case bisa gagal ditemukan diam-diam.
function normEmail(email) { return String(email || '').trim().toLowerCase(); }

// Bungkus kirimEmail() supaya kegagalan tetap tidak menggagalkan response ke
// user, TAPI tidak lagi ditelan diam-diam — selalu tercatat jelas di log
// server dengan konteks (untuk siapa/tujuan apa) supaya gampang di-grep.
function kirimEmailAman(payload, konteks) {
    kirimEmail(payload).then((r) => {
        if (!r.sent) console.error(`[MAIL] Gagal kirim (${konteks}) ke ${payload.to}: ${r.reason}`);
    }).catch((e) => console.error(`[MAIL] Exception saat kirim (${konteks}) ke ${payload.to}:`, e.message));
}

app.post('/api/password/forgot', ah(async (req, res) => {
    const email = normEmail(req.body.email);
    if (!email) return res.status(400).json({ error: 'Email wajib diisi' });
    const user = await db.prepare('SELECT kode,nama FROM users WHERE email=?').get(email);
    if (user) {
        const otp = genOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await db.prepare('INSERT INTO password_resets (email,otp,expires_at) VALUES (?,?,?)').run(email, otp, expiresAt);
        console.log(`[OTP] Kode reset kata sandi untuk ${email}: ${otp} (berlaku 10 menit)`);
        // PENTING (Vercel serverless): HARUS di-await — lihat catatan di kirimSignupOtp().
        // Fire-and-forget adalah penyebab paling mungkin kenapa OTP lupa password
        // tidak pernah nyampe: function di Vercel keburu dibekukan sebelum fetch()
        // ke Resend selesai, begitu res.json() dikirim.
        await kirimEmailAman({
            to: email,
            subject: 'Kode OTP Reset Kata Sandi — CIBN PRESTISE',
            html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">
                <p>Halo ${user.nama || ''},</p>
                <p>Kode OTP untuk mengatur ulang kata sandi akun kamu:</p>
                <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${otp}</p>
                <p>Kode ini berlaku 10 menit. Kalau kamu tidak meminta reset kata sandi, abaikan email ini.</p>
            </div>`,
        }, 'reset password OTP'); // Kegagalan kirim dicatat di log, tidak menggagalkan balasan generik di bawah.
    } else {
        console.log(`[OTP] Lupa password: email "${email}" TIDAK ditemukan di tabel users — OTP tidak dikirim.`);
    }
    // Selalu balas sukses (tidak membocorkan apakah email terdaftar atau tidak).
    res.json({ message: 'Jika email terdaftar, kode OTP telah dikirim.' });
}));

app.post('/api/password/verify-otp', ah(async (req, res) => {
    const { otp } = req.body;
    const email = normEmail(req.body.email);
    if (!email || !otp) return res.status(400).json({ error: 'Data tidak lengkap' });
    const row = await db.prepare('SELECT * FROM password_resets WHERE email=? AND otp=? ORDER BY id DESC LIMIT 1').get(email, otp);
    if (!row) return res.status(400).json({ error: 'Kode OTP salah' });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'Kode OTP sudah kedaluwarsa' });
    await db.prepare('UPDATE password_resets SET verified=1 WHERE id=?').run(row.id);
    res.json({ message: 'Kode terverifikasi' });
}));

app.post('/api/password/reset', ah(async (req, res) => {
    const { otp, password } = req.body;
    const email = normEmail(req.body.email);
    if (!email || !otp || !password) return res.status(400).json({ error: 'Data tidak lengkap' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Kata sandi minimal 8 karakter' });
    const row = await db.prepare('SELECT * FROM password_resets WHERE email=? AND otp=? AND verified=1 ORDER BY id DESC LIMIT 1').get(email, otp);
    if (!row) return res.status(400).json({ error: 'Verifikasi OTP terlebih dahulu' });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'Kode OTP sudah kedaluwarsa' });
    const hash = bcrypt.hashSync(password, 10);
    await db.prepare('UPDATE users SET password=? WHERE email=?').run(hash, email);
    await db.prepare('DELETE FROM password_resets WHERE email=?').run(email);
    res.json({ message: 'Kata sandi berhasil diubah' });
}));

app.get('/api/users/:role', auth(['admin']), ah(async (req, res) => {
    const users = await db.prepare(
        'SELECT id,kode,nama,email,grub,status,paket_nama,langganan_mulai,langganan_akhir,created_at FROM users WHERE role=? ORDER BY id'
    ).all(req.params.role);

    if (req.params.role === 'user') {
        const today = new Date(); today.setHours(0,0,0,0);
        for (const u of users) {
            const pakets = await db.prepare(
                `SELECT up.*, p.periode_tipe as template_tipe FROM user_pakets up LEFT JOIN pakets p ON up.paket_kode=p.kode WHERE up.user_kode=? ORDER BY up.akhir ASC`
            ).all(u.kode);
            pakets.forEach(p => {
                const akhir = new Date(p.akhir); akhir.setHours(0,0,0,0);
                p.sisa_hari       = Math.ceil((akhir - today) / (1000*60*60*24));
                p.is_expired      = p.sisa_hari < 0;
                p.is_soon_expired = p.sisa_hari >= 0 && p.sisa_hari <= 7;
            });
            u.pakets = pakets;
        }
    }
    res.json(users);
}));

app.post('/api/users', auth(['admin']), ah(async (req, res) => {
    const { nama, password, role, grub, status, paket_nama, langganan_mulai, langganan_akhir } = req.body;
    const email = normEmail(req.body.email);
    try {
        const kode = await genKode(role === 'admin' ? 'ADM' : role === 'review' ? 'REV' : 'USR', 'users');
        const hash = bcrypt.hashSync(password || 'Default@123', 10);
        await transaction(async (tdb) => {
            await tdb.prepare('INSERT INTO users (kode,nama,email,password,role,grub,status) VALUES (?,?,?,?,?,?,?)')
                .run(kode, nama, email, hash, role, grub || null, status || 'aktif');
            if (role === 'user') {
                await upsertManualPaket(tdb, kode, paket_nama, langganan_mulai, langganan_akhir);
                await syncUserPaketLegacy(kode, tdb);
            }
        });
        res.json({ kode, message: 'Berhasil' });
    } catch (e) { res.status(500).json({ error: e.message }); }
}));

app.put('/api/users/bulk', auth(['admin']), ah(async (req, res) => {
    const { kodes, data } = req.body;
    if (!Array.isArray(kodes) || !kodes.length) return res.status(400).json({ error: 'Tidak ada akun dipilih' });
    const allowed = ['grub', 'status', 'paket_nama', 'langganan_mulai', 'langganan_akhir'];
    const fields = allowed.filter(f => data && Object.prototype.hasOwnProperty.call(data, f));
    if (!fields.length) return res.status(400).json({ error: 'Tidak ada field yang diubah' });
    const directFields = fields.filter(f => f === 'grub' || f === 'status');
    const paketTouched = fields.includes('paket_nama') || fields.includes('langganan_mulai') || fields.includes('langganan_akhir');
    try {
        await transaction(async (tdb) => {
            if (directFields.length) {
                const setClause = directFields.map(f => `${f}=?`).join(',');
                const stmt = tdb.prepare(`UPDATE users SET ${setClause} WHERE kode=?`);
                for (const kode of kodes) await stmt.run(...directFields.map(f => data[f] ?? null), kode);
            }
            if (paketTouched) {
                for (const kode of kodes) {
                    const u = await tdb.prepare('SELECT role FROM users WHERE kode=?').get(kode);
                    if (u && u.role === 'user') {
                        await upsertManualPaket(tdb, kode, data.paket_nama, data.langganan_mulai, data.langganan_akhir);
                        await syncUserPaketLegacy(kode, tdb);
                    }
                }
            }
        });
        res.json({ message: `Berhasil memperbarui ${kodes.length} akun`, count: kodes.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
}));

app.put('/api/users/:kode', auth(['admin']), ah(async (req, res) => {
    const { nama, password, grub, status, paket_nama, langganan_mulai, langganan_akhir } = req.body;
    const email = normEmail(req.body.email);
    try {
        await transaction(async (tdb) => {
            if (password) {
                const hash = bcrypt.hashSync(password, 10);
                await tdb.prepare('UPDATE users SET nama=?,email=?,password=?,grub=?,status=? WHERE kode=?')
                    .run(nama, email, hash, grub || null, status, req.params.kode);
            } else {
                await tdb.prepare('UPDATE users SET nama=?,email=?,grub=?,status=? WHERE kode=?')
                    .run(nama, email, grub || null, status, req.params.kode);
            }
            const u = await tdb.prepare('SELECT role FROM users WHERE kode=?').get(req.params.kode);
            if (u && u.role === 'user') {
                await upsertManualPaket(tdb, req.params.kode, paket_nama, langganan_mulai, langganan_akhir);
                await syncUserPaketLegacy(req.params.kode, tdb);
            }
        });
        res.json({ message: 'Berhasil' });
    } catch (e) { res.status(500).json({ error: e.message }); }
}));

app.delete('/api/users/bulk', auth(['admin']), ah(async (req, res) => {
    const { kodes } = req.body;
    if (!Array.isArray(kodes) || !kodes.length) return res.status(400).json({ error: 'Tidak ada akun dipilih' });
    try {
        await transaction(async (tdb) => {
            const delUser = tdb.prepare('DELETE FROM users WHERE kode=?');
            const delPakets = tdb.prepare('DELETE FROM user_pakets WHERE user_kode=?');
            for (const kode of kodes) { await delUser.run(kode); await delPakets.run(kode); }
        });
        res.json({ message: `Berhasil menghapus ${kodes.length} akun`, count: kodes.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
}));

app.delete('/api/users/:kode', auth(['admin']), ah(async (req, res) => {
    await transaction(async (tdb) => {
        await tdb.prepare('DELETE FROM users WHERE kode=?').run(req.params.kode);
        await tdb.prepare('DELETE FROM user_pakets WHERE user_kode=?').run(req.params.kode);
    });
    res.json({ message: 'Berhasil' });
}));

app.get('/api/signup-requests', auth(['admin']), ah(async (req, res) =>
    res.json(await db.prepare('SELECT * FROM signup_requests ORDER BY created_at DESC').all())));

app.post('/api/signup-requests/:id/approve', auth(['admin']), ah(async (req, res) => {
    const r = await db.prepare('SELECT * FROM signup_requests WHERE id=?').get(req.params.id);
    if (!r) return res.status(404).json({ error: 'Tidak ditemukan' });
    const kode = await genKode('USR', 'users');
    const now = new Date(), mulai = now.toISOString().split('T')[0];
    const ak = new Date(now); ak.setMonth(ak.getMonth()+1);
    const akhir = ak.toISOString().split('T')[0];
    try {
        await transaction(async (tdb) => {
            await tdb.prepare('INSERT INTO users (kode,nama,email,password,role,status) VALUES (?,?,?,?,?,?)')
                .run(kode, r.nama, r.email, r.password, 'user', 'aktif');
            await upsertManualPaket(tdb, kode, r.paket_nama || 'Paket Awal', mulai, akhir);
            await syncUserPaketLegacy(kode, tdb);
            await tdb.prepare('DELETE FROM signup_requests WHERE id=?').run(req.params.id);
        });
        res.json({ message: 'Akun diaktifkan', kode });
    } catch (e) { res.status(500).json({ error: e.message }); }
}));

app.delete('/api/signup-requests/:id', auth(['admin']), ah(async (req, res) => {
    await db.prepare('DELETE FROM signup_requests WHERE id=?').run(req.params.id);
    res.json({ message: 'Ditolak' });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES: PAKET TEMPLATE & USER PAKETS
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/pakets', auth(['admin']), ah(async (req, res) => {
    const rows = await db.prepare('SELECT * FROM pakets ORDER BY id').all();
    rows.forEach(r => {
        if (r.fitur) try { r.fitur = JSON.parse(r.fitur); } catch (e) { r.fitur = []; }
        r.popular = !!r.popular;
        if (r.hak_akses) try { r.hak_akses = JSON.parse(r.hak_akses); } catch(e) { r.hak_akses = []; }
        if (r.aturan_akses) try { r.aturan_akses = JSON.parse(r.aturan_akses); } catch(e) { r.aturan_akses = []; }
    });
    res.json(rows);
}));
app.get('/api/pakets/public', ah(async (req, res) => {
    const rows = await db.prepare("SELECT kode,nama,deskripsi,periode_tipe,periode_hari,harga,fitur,status,link_landing,warna,icon,popular,periode FROM pakets WHERE status='aktif' ORDER BY harga ASC").all();
    rows.forEach(r => {
        if (r.fitur) try { r.fitur = JSON.parse(r.fitur); } catch (e) { r.fitur = []; }
        r.popular = !!r.popular;
    });
    res.json(rows);
}));
app.get('/api/pakets/:kode', auth(['admin']), ah(async (req, res) => {
    const p = await db.prepare('SELECT * FROM pakets WHERE kode=?').get(req.params.kode);
    if (!p) return res.status(404).json({ error: 'Tidak ditemukan' });
    if (p.fitur) try { p.fitur = JSON.parse(p.fitur); } catch (e) { p.fitur = []; }
    res.json(p);
}));
app.post('/api/pakets', auth(['admin']), ah(async (req, res) => {
    const { nama, deskripsi, periode_tipe, periode_hari, harga, fitur, status, link_landing, warna, icon, popular, periode, hak_akses, aturan_akses, maks_ujian, durasi_hari, hak_notes, mentoring_kuota } = req.body;
    const kode = await genKode('PKT', 'pakets');
    try {
        await db.prepare(`INSERT INTO pakets (kode,nama,deskripsi,periode_tipe,periode_hari,harga,fitur,status,link_landing,warna,icon,popular,periode,hak_akses,aturan_akses,maks_ujian,durasi_hari,hak_notes,mentoring_kuota) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
            .run(kode, nama, deskripsi || null, periode_tipe || 'bulan', periode_hari || 30, harga || 0, fitur ? (typeof fitur === 'string' ? fitur : JSON.stringify(fitur)) : null, status || 'aktif', link_landing || null, warna || 'blue', icon || '📦', popular ? 1 : 0, periode || '/bulan', hak_akses || null, aturan_akses || null, maks_ujian || null, durasi_hari || null, hak_notes || null, mentoring_kuota || null);
        res.json({ kode, message: 'Berhasil' });
    } catch (e) { res.status(500).json({ error: e.message }); }
}));
app.put('/api/pakets/:kode', auth(['admin']), ah(async (req, res) => {
    const { nama, deskripsi, periode_tipe, periode_hari, harga, fitur, status, link_landing, warna, icon, popular, periode, hak_akses, aturan_akses, maks_ujian, durasi_hari, hak_notes, mentoring_kuota } = req.body;
    await db.prepare(`UPDATE pakets SET nama=?,deskripsi=?,periode_tipe=?,periode_hari=?,harga=?,fitur=?,status=?,link_landing=?,warna=?,icon=?,popular=?,periode=?,hak_akses=?,aturan_akses=?,maks_ujian=?,durasi_hari=?,hak_notes=?,mentoring_kuota=? WHERE kode=?`)
        .run(nama, deskripsi || null, periode_tipe || 'bulan', periode_hari || 30, harga || 0, fitur ? (typeof fitur === 'string' ? fitur : JSON.stringify(fitur)) : null, status || 'aktif', link_landing || null, warna || 'blue', icon || '📦', popular ? 1 : 0, periode || '/bulan', hak_akses || null, aturan_akses || null, maks_ujian || null, durasi_hari || null, hak_notes || null, mentoring_kuota || null, req.params.kode);
    res.json({ message: 'Berhasil' });
}));
app.delete('/api/pakets/:kode', auth(['admin']), ah(async (req, res) => {
    await db.prepare('DELETE FROM pakets WHERE kode=?').run(req.params.kode);
    res.json({ message: 'Berhasil' });
}));

app.get('/api/users/:kode/pakets', auth(['admin']), ah(async (req, res) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const rows = await db.prepare(`SELECT up.*, p.periode_tipe as template_tipe FROM user_pakets up LEFT JOIN pakets p ON up.paket_kode=p.kode WHERE up.user_kode=? ORDER BY up.akhir ASC`).all(req.params.kode);
    rows.forEach(r => {
        const akhir = new Date(r.akhir); akhir.setHours(0,0,0,0);
        r.sisa_hari       = Math.ceil((akhir - today) / (1000*60*60*24));
        r.is_expired      = r.sisa_hari < 0;
        r.is_soon_expired = r.sisa_hari >= 0 && r.sisa_hari <= 7;
    });
    res.json(rows);
}));

app.post('/api/users/:kode/pakets', auth(['admin']), ah(async (req, res) => {
    const user_kode = req.params.kode;
    const { paket_kode, paket_nama_custom, periode_tipe, periode_custom_hari } = req.body;
    try {
        let paketNama, periodeHari, kodeRef;
        if (paket_kode) {
            const p = await db.prepare("SELECT * FROM pakets WHERE kode=? AND status='aktif'").get(paket_kode);
            if (!p) return res.status(404).json({ error: 'Paket tidak ditemukan' });
            paketNama = p.nama; periodeHari = p.periode_hari; kodeRef = paket_kode;
        } else {
            paketNama = paket_nama_custom || 'Custom';
            periodeHari = periode_tipe === 'hari' ? 1 : periode_tipe === 'minggu' ? 7 : periode_tipe === 'tahun' ? 365 : periode_tipe === 'custom' ? (parseInt(periode_custom_hari) || 30) : 30;
            kodeRef = 'CUSTOM';
        }
        const { mulai, akhir, extended } = await hitungMulaiAkhirPaket(user_kode, kodeRef, periodeHari);
        const kode = await genKode('UP', 'user_pakets');
        await transaction(async (tdb) => {
            await tdb.prepare('INSERT INTO user_pakets (kode,user_kode,paket_kode,paket_nama,periode_hari,mulai,akhir,status) VALUES (?,?,?,?,?,?,?,?)')
                .run(kode, user_kode, kodeRef, paketNama, periodeHari, mulai, akhir, 'aktif');
            await syncUserPaketLegacy(user_kode, tdb);
        });
        res.json({ kode, mulai, akhir, extended, paket_nama: paketNama, message: `Paket "${paketNama}" berhasil diaktifkan` });
    } catch (e) { res.status(500).json({ error: e.message }); }
}));

app.delete('/api/users/:kode/pakets/:up_kode', auth(['admin']), ah(async (req, res) => {
    await transaction(async (tdb) => {
        await tdb.prepare('DELETE FROM user_pakets WHERE kode=? AND user_kode=?').run(req.params.up_kode, req.params.kode);
        await syncUserPaketLegacy(req.params.kode, tdb);
    });
    res.json({ message: 'Berhasil' });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES: GRUBS
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/grubs', auth(['admin','review']), ah(async (req, res) =>
    res.json(await db.prepare('SELECT * FROM grubs ORDER BY LOWER(nama)').all())));
app.post('/api/grubs', auth(['admin']), ah(async (req, res) => {
    const nama = req.body.nama;
    if (!nama || !nama.trim()) return res.status(400).json({ error: 'Nama grup wajib diisi' });
    const dup = await db.prepare('SELECT id FROM grubs WHERE LOWER(nama)=LOWER(?)').get(nama.trim());
    if (dup) return res.status(400).json({ error: 'Grup dengan nama ini sudah ada' });
    const kode = await genKode('GRP', 'grubs');
    await db.prepare('INSERT INTO grubs (kode,nama) VALUES (?,?)').run(kode, nama.trim());
    res.json(await db.prepare('SELECT * FROM grubs WHERE kode=?').get(kode));
}));
app.put('/api/grubs/:kode', auth(['admin']), ah(async (req, res) => {
    const nama = req.body.nama;
    if (!nama || !nama.trim()) return res.status(400).json({ error: 'Nama grup wajib diisi' });
    const dup = await db.prepare('SELECT id FROM grubs WHERE LOWER(nama)=LOWER(?) AND kode<>?').get(nama.trim(), req.params.kode);
    if (dup) return res.status(400).json({ error: 'Grup dengan nama ini sudah ada' });
    const info = await db.prepare('UPDATE grubs SET nama=? WHERE kode=?').run(nama.trim(), req.params.kode);
    if (info.changes === 0) return res.status(404).json({ error: 'Grup tidak ditemukan' });
    res.json(await db.prepare('SELECT * FROM grubs WHERE kode=?').get(req.params.kode));
}));
app.delete('/api/grubs/:kode', auth(['admin']), ah(async (req, res) => {
    await transaction(async (tdb) => {
        await tdb.prepare('DELETE FROM grubs WHERE kode=?').run(req.params.kode);
        await tdb.prepare('UPDATE users SET grub=NULL WHERE grub=?').run(req.params.kode);
    });
    res.json({ message: 'Berhasil' });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// GENERIC PRESIGNED UPLOAD — DIRECT-TO-SUPABASE (SEMUA JENIS FILE: gambar soal,
// PDF/poster e-book, gambar/video landing, dst). Menggantikan seluruh upload lama
// yang lewat multer (server menerima file di body-nya sendiri).
//
// Alurnya selalu 2 langkah, sama untuk semua jenis file:
//  1) POST /api/upload-init     → server memvalidasi kind/mimetype/size (server
//     TIDAK menerima isi file sama sekali, jadi tidak numpuk RAM & tidak kena
//     limit body platform serverless mis. ±4.5MB di Vercel — berapa pun besar
//     file aslinya), lalu minta "signed upload URL" ke Supabase Storage dan
//     balikin signedUrl+path+url ke browser.
//  2) Browser PUT file itu LANGSUNG ke signedUrl (ke Supabase, bukan ke server
//     kita) — beban transfer file besar sepenuhnya di luar server kita.
//  3) POST /api/upload-finalize → dipanggil browser setelah PUT sukses, cuma
//     untuk beres-beres (hapus file lama/oldUrl kalau ini upload pengganti).
//     Endpoint ini pun tidak menerima file, jadi sangat ringan.
// ═══════════════════════════════════════════════════════════════════════════════
app.post('/api/upload-init', auth(['admin']), ah(async (req, res) => {
    const { kind, subfolder, filename, mimetype, size } = req.body || {};
    const cfg = UPLOAD_KINDS[kind];
    if (!cfg) return res.status(400).json({ error: 'Jenis upload tidak dikenal' });
    if (cfg.roles && !cfg.roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });

    const ext = cfg.allowedMime[mimetype];
    if (!ext) return res.status(400).json({ error: 'Format file tidak didukung' });
    if (typeof size === 'number' && size > cfg.maxSize) {
        return res.status(400).json({ error: `File terlalu besar (maks ${Math.round(cfg.maxSize / (1024 * 1024))}MB)` });
    }

    const parts = [cfg.folder];
    if (subfolder) parts.push(safeFolderName(subfolder));
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    parts.push(fileName);
    const filePath = parts.join('/');

    const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUploadUrl(filePath);
    if (error) return res.status(500).json({ error: 'Gagal membuat signed URL', details: error.message });

    const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
    res.json({ signedUrl: data.signedUrl, token: data.token, path: filePath, url: publicUrlData.publicUrl });
}));

app.post('/api/upload-finalize', auth(['admin']), ah(async (req, res) => {
    const { oldUrl } = req.body || {};
    if (oldUrl) deleteUploadedFileByUrl(oldUrl).catch(() => {});
    res.json({ ok: true });
}));

app.get('/api/soal', auth(['admin']), ah(async (req, res) => {
    const rows = await db.prepare('SELECT * FROM soal ORDER BY id').all();
    rows.forEach(r => {
        if (r.data) try { r.data = expandSikapKerja(r.type, JSON.parse(r.data)); } catch (e) {}
        if (r.materi_list) try { r.materi_list = JSON.parse(r.materi_list); } catch (e) { r.materi_list = []; }
    });
    res.json(rows);
}));
app.get('/api/soal/:kode', auth(['admin','review']), ah(async (req, res) => {
    const s = await db.prepare('SELECT * FROM soal WHERE kode=?').get(req.params.kode);
    if (!s) return res.status(404).json({ error: 'Tidak ditemukan' });
    if (s.data) try { s.data = expandSikapKerja(s.type, JSON.parse(s.data)); } catch (e) {}
    if (s.materi_list) try { s.materi_list = JSON.parse(s.materi_list); } catch (e) { s.materi_list = []; }
    if (req.user.role !== 'admin') delete s.nama_internal;
    res.json(s);
}));
app.post('/api/soal', auth(['admin']), ah(async (req, res) => {
    const { nama, nama_internal, type, skor_type, opsi_jawaban, timer_jam, timer_menit, timer_detik, kelompok, data, materi_list } = req.body;
    const kode = await genKode('SOL', 'soal');
    await db.prepare('INSERT INTO soal (kode,nama,nama_internal,type,skor_type,opsi_jawaban,timer_jam,timer_menit,timer_detik,kelompok,data,materi_list) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(kode, nama, (nama_internal || '').trim() || null, type, skor_type || null, opsi_jawaban || null, timer_jam || 0, timer_menit || 30, timer_detik || 0,
             (kelompok || '').trim() || null, data ? JSON.stringify(data) : null, (materi_list && materi_list.length) ? JSON.stringify(materi_list) : null);
    res.json({ kode, message: 'Berhasil' });
}));
app.put('/api/soal/:kode', auth(['admin']), ah(async (req, res) => {
    const oldRow = await db.prepare('SELECT * FROM soal WHERE kode=?').get(req.params.kode);
    if (!oldRow) return res.status(404).json({ error: 'Soal tidak ditemukan' });
    const oldRefs = extractUploadFilenames(oldRow.data);

    // Partial update: field yang tidak dikirim di body akan tetap pakai nilai lama,
    // bukan ditimpa NULL (mencegah 400 "Kolom wajib diisi" saat update parsial, mis. bulk set kelompok).
    const b = req.body || {};
    const nama          = b.nama          !== undefined ? b.nama : oldRow.nama;
    const nama_internal = b.nama_internal !== undefined ? ((b.nama_internal || '').trim() || null) : oldRow.nama_internal;
    const type          = b.type         !== undefined ? b.type : oldRow.type;
    const skor_type     = b.skor_type    !== undefined ? (b.skor_type || null) : oldRow.skor_type;
    const opsi_jawaban  = b.opsi_jawaban !== undefined ? (b.opsi_jawaban || null) : oldRow.opsi_jawaban;
    const timer_jam     = b.timer_jam    !== undefined ? (b.timer_jam || 0) : oldRow.timer_jam;
    const timer_menit   = b.timer_menit  !== undefined ? (b.timer_menit || 30) : oldRow.timer_menit;
    const timer_detik   = b.timer_detik  !== undefined ? (b.timer_detik || 0) : oldRow.timer_detik;
    const kelompok      = b.kelompok     !== undefined ? ((b.kelompok || '').trim() || null) : oldRow.kelompok;
    const data          = b.data         !== undefined ? JSON.stringify(b.data) : oldRow.data;
    const materi_list   = b.materi_list  !== undefined ? ((b.materi_list && b.materi_list.length) ? JSON.stringify(b.materi_list) : null) : oldRow.materi_list;

    await db.prepare('UPDATE soal SET nama=?,nama_internal=?,type=?,skor_type=?,opsi_jawaban=?,timer_jam=?,timer_menit=?,timer_detik=?,kelompok=?,data=?,materi_list=? WHERE kode=?')
        .run(nama, nama_internal, type, skor_type, opsi_jawaban, timer_jam, timer_menit, timer_detik, kelompok, data, materi_list, req.params.kode);

    res.json({ message: 'Berhasil' });
    cleanupOrphanedUploads(oldRefs);
}));
app.delete('/api/soal/:kode', auth(['admin']), ah(async (req, res) => {
    const oldRow = await db.prepare('SELECT data FROM soal WHERE kode=?').get(req.params.kode);
    const oldRefs = extractUploadFilenames(oldRow?.data);

    await transaction(async (tdb) => {
        await tdb.prepare('DELETE FROM soal WHERE kode=?').run(req.params.kode);
        const modRows = await tdb.prepare('SELECT kode, soal_list FROM modul').all();
        for (const m of modRows) {
            let list; try { list = JSON.parse(m.soal_list || '[]'); } catch (e) { list = []; }
            const filtered = list.filter(sl => sl.soal_kode !== req.params.kode);
            if (filtered.length !== list.length) {
                await tdb.prepare('UPDATE modul SET soal_list=? WHERE kode=?').run(JSON.stringify(filtered), m.kode);
            }
        }
    });

    res.json({ message: 'Berhasil' });
    cleanupOrphanedUploads(oldRefs);
}));

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES: KELOMPOK SOAL & MODUL (Disederhanakan untuk ringkasan - logika tetap sama)
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/soal-kelompok', auth(['admin', 'review']), ah(async (req, res) => { res.json(await db.prepare('SELECT * FROM soal_kelompok ORDER BY LOWER(nama)').all()); }));
app.post('/api/soal-kelompok', auth(['admin']), ah(async (req, res) => { const kode = await genKode('SKL', 'soal_kelompok'); await db.prepare('INSERT INTO soal_kelompok (kode,nama) VALUES (?,?)').run(kode, req.body.nama.trim()); res.json(await db.prepare('SELECT * FROM soal_kelompok WHERE kode=?').get(kode)); }));
app.put('/api/soal-kelompok/:kode', auth(['admin']), ah(async (req, res) => { await db.prepare('UPDATE soal_kelompok SET nama=? WHERE kode=?').run(req.body.nama.trim(), req.params.kode); res.json(await db.prepare('SELECT * FROM soal_kelompok WHERE kode=?').get(req.params.kode)); }));
app.delete('/api/soal-kelompok/:kode', auth(['admin']), ah(async (req, res) => { await transaction(async (tdb) => { await tdb.prepare('DELETE FROM soal_kelompok WHERE kode=?').run(req.params.kode); await tdb.prepare('UPDATE soal SET kelompok=NULL WHERE kelompok=?').run(req.params.kode); }); res.json({ message: 'Berhasil' }); }));

app.get('/api/modul-kelompok', auth(['admin', 'review']), ah(async (req, res) => { res.json(await db.prepare('SELECT * FROM modul_kelompok ORDER BY LOWER(nama)').all()); }));
app.post('/api/modul-kelompok', auth(['admin']), ah(async (req, res) => { const kode = await genKode('MKL', 'modul_kelompok'); await db.prepare('INSERT INTO modul_kelompok (kode,nama) VALUES (?,?)').run(kode, req.body.nama.trim()); res.json(await db.prepare('SELECT * FROM modul_kelompok WHERE kode=?').get(kode)); }));
app.put('/api/modul-kelompok/:kode', auth(['admin']), ah(async (req, res) => { await db.prepare('UPDATE modul_kelompok SET nama=? WHERE kode=?').run(req.body.nama.trim(), req.params.kode); res.json(await db.prepare('SELECT * FROM modul_kelompok WHERE kode=?').get(req.params.kode)); }));
app.delete('/api/modul-kelompok/:kode', auth(['admin']), ah(async (req, res) => { await transaction(async (tdb) => { await tdb.prepare('DELETE FROM modul_kelompok WHERE kode=?').run(req.params.kode); await tdb.prepare('UPDATE modul SET kelompok=NULL WHERE kelompok=?').run(req.params.kode); }); res.json({ message: 'Berhasil' }); }));

app.get('/api/modul', auth(['admin','review']), ah(async (req, res) => { const rows = await db.prepare('SELECT * FROM modul ORDER BY id').all(); rows.forEach(r => { if (r.soal_list) try { r.soal_list = JSON.parse(r.soal_list); } catch (e) { r.soal_list = []; } if (req.user.role !== 'admin') delete r.nama_internal; }); res.json(rows); }));
// Mode Bebas Pindah Soal hanya boleh aktif kalau SELURUH soal di modul
// ber-tipe multiple_choice (tidak ada linier/sikap_kerja) — dicek ulang di
// server supaya tidak bisa dilewati walau validasi di admin (frontend) entah
// bagaimana terlewat/di-bypass.
async function assertModeBebasValid(modeBebas, soalList) {
    if (!modeBebas) return;
    if (!Array.isArray(soalList) || !soalList.length) {
        throw Object.assign(new Error('Mode Bebas butuh minimal 1 soal'), { status: 400 });
    }
    for (const sl of soalList) {
        const s = await db.prepare('SELECT type FROM soal WHERE kode=?').get(sl.soal_kode);
        if (!s || s.type !== 'multiple_choice') {
            throw Object.assign(new Error('Mode Bebas Pindah Soal hanya bisa diaktifkan jika semua soal di modul bertipe Multiple Choice'), { status: 400 });
        }
    }
}

app.post('/api/modul', auth(['admin']), ah(async (req, res) => {
    const soal_list = req.body.soal_list || [];
    const mode_bebas = req.body.mode_bebas ? 1 : 0;
    try { await assertModeBebasValid(mode_bebas, soal_list); }
    catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
    const kode = await genKode('MOD', 'modul');
    await db.prepare('INSERT INTO modul (kode,nama,nama_internal,kelompok,soal_list,mode_bebas,timer_utama_jam,timer_utama_menit,timer_utama_detik) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(kode, req.body.nama, (req.body.nama_internal || '').trim() || null, (req.body.kelompok || '').trim() || null,
             JSON.stringify(soal_list), mode_bebas, req.body.timer_utama_jam || 0, req.body.timer_utama_menit || 0, req.body.timer_utama_detik || 0);
    res.json({ kode, message: 'Berhasil' });
}));
app.put('/api/modul/:kode', auth(['admin']), ah(async (req, res) => {
    const oldRow = await db.prepare('SELECT * FROM modul WHERE kode=?').get(req.params.kode);
    if (!oldRow) return res.status(404).json({ error: 'Modul tidak ditemukan' });

    // Partial update: field yang tidak dikirim di body akan tetap pakai nilai lama,
    // bukan ditimpa NULL (mencegah data modul hilang saat update parsial, mis. bulk set kelompok).
    const b = req.body || {};
    let oldSoalList; try { oldSoalList = JSON.parse(oldRow.soal_list || '[]'); } catch (e) { oldSoalList = []; }
    const nama              = b.nama              !== undefined ? b.nama : oldRow.nama;
    const nama_internal     = b.nama_internal      !== undefined ? ((b.nama_internal || '').trim() || null) : oldRow.nama_internal;
    const kelompok          = b.kelompok           !== undefined ? ((b.kelompok || '').trim() || null) : oldRow.kelompok;
    const soal_list         = b.soal_list          !== undefined ? (b.soal_list || []) : oldSoalList;
    const mode_bebas        = b.mode_bebas         !== undefined ? (b.mode_bebas ? 1 : 0) : oldRow.mode_bebas;
    const timer_utama_jam   = b.timer_utama_jam    !== undefined ? (b.timer_utama_jam || 0) : oldRow.timer_utama_jam;
    const timer_utama_menit = b.timer_utama_menit  !== undefined ? (b.timer_utama_menit || 0) : oldRow.timer_utama_menit;
    const timer_utama_detik = b.timer_utama_detik  !== undefined ? (b.timer_utama_detik || 0) : oldRow.timer_utama_detik;

    try { await assertModeBebasValid(mode_bebas, soal_list); }
    catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
    await db.prepare('UPDATE modul SET nama=?,nama_internal=?,kelompok=?,soal_list=?,mode_bebas=?,timer_utama_jam=?,timer_utama_menit=?,timer_utama_detik=? WHERE kode=?')
        .run(nama, nama_internal, kelompok, JSON.stringify(soal_list), mode_bebas, timer_utama_jam, timer_utama_menit, timer_utama_detik, req.params.kode);
    res.json({ message: 'Berhasil' });
}));
app.delete('/api/modul/:kode', auth(['admin']), ah(async (req, res) => { await transaction(async (tdb) => { await tdb.prepare('DELETE FROM modul WHERE kode=?').run(req.params.kode); await tdb.prepare('DELETE FROM tokens WHERE modul_kode=? AND digunakan=0').run(req.params.kode); }); res.json({ message: 'Berhasil' }); }));

app.get('/api/ebook-kelompok', auth(['admin', 'review', 'user']), ah(async (req, res) => { res.json(await db.prepare('SELECT * FROM ebook_kelompok ORDER BY LOWER(nama)').all()); }));
app.post('/api/ebook-kelompok', auth(['admin']), ah(async (req, res) => { const kode = await genKode('EBKL', 'ebook_kelompok'); await db.prepare('INSERT INTO ebook_kelompok (kode,nama) VALUES (?,?)').run(kode, req.body.nama.trim()); res.json(await db.prepare('SELECT * FROM ebook_kelompok WHERE kode=?').get(kode)); }));
app.put('/api/ebook-kelompok/:kode', auth(['admin']), ah(async (req, res) => { await db.prepare('UPDATE ebook_kelompok SET nama=? WHERE kode=?').run(req.body.nama.trim(), req.params.kode); res.json(await db.prepare('SELECT * FROM ebook_kelompok WHERE kode=?').get(req.params.kode)); }));
app.delete('/api/ebook-kelompok/:kode', auth(['admin']), ah(async (req, res) => { await transaction(async (tdb) => { await tdb.prepare('DELETE FROM ebook_kelompok WHERE kode=?').run(req.params.kode); await tdb.prepare('UPDATE ebooks SET kelompok=NULL WHERE kelompok=?').run(req.params.kode); }); res.json({ message: 'Berhasil' }); }));

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES: E-BOOK (SUPABASE INTEGRATION)
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/ebook', auth(['admin', 'review', 'user']), ah(async (req, res) => {
    const rows = await db.prepare('SELECT * FROM ebooks ORDER BY id DESC').all();
    if (req.user.role === 'user') rows.forEach(r => { delete r.file_pdf; });
    res.json(rows);
}));

app.get('/api/ebook/:kode', auth(['admin', 'review', 'user']), ah(async (req, res) => {
    const e = await db.prepare('SELECT * FROM ebooks WHERE kode=?').get(req.params.kode);
    if (!e) return res.status(404).json({ error: 'Tidak ditemukan' });
    if (req.user.role === 'user') delete e.file_pdf;
    res.json(e);
}));

// Menampilkan / Redirect PDF langsung ke Supabase URL
app.get('/api/ebook/:kode/file', auth(['admin', 'review', 'user']), ah(async (req, res) => {
    const e = await db.prepare('SELECT * FROM ebooks WHERE kode=?').get(req.params.kode);
    if (!e || !e.file_pdf) return res.status(404).json({ error: 'Tidak ditemukan' });
    
    // Redirect langsung ke URL Publik Supabase
    res.redirect(e.file_pdf);
}));

// CATATAN: PDF & poster SUDAH diupload langsung dari browser ke Supabase Storage
// lewat /api/upload-init (signed URL) SEBELUM endpoint ini dipanggil. Body di sini
// cuma metadata JSON kecil (url, nama file asli, ukuran, jumlah halaman yang
// dihitung di browser) — server tidak lagi menerima/membaca isi file sama sekali.
app.post('/api/ebook', auth(['admin']), ah(async (req, res) => {
    const { nama, kelompok, pdf, poster } = req.body || {};
    if (!nama || !nama.trim()) return res.status(400).json({ error: 'Nama buku wajib diisi' });
    if (!pdf || !pdf.url) return res.status(400).json({ error: 'File PDF buku wajib diupload' });

    const kode = await genKode('EBK', 'ebooks');
    await db.prepare(`INSERT INTO ebooks (kode,nama,kelompok,poster,file_pdf,file_nama_asli,jumlah_halaman,ukuran_bytes) VALUES (?,?,?,?,?,?,?,?)`)
        .run(kode, nama.trim(), (kelompok || '').trim() || null, poster?.url || null, pdf.url, pdf.originalName || null, pdf.pages || 0, pdf.size || 0);

    res.json(await db.prepare('SELECT * FROM ebooks WHERE kode=?').get(kode));
}));

app.put('/api/ebook/:kode', auth(['admin']), ah(async (req, res) => {
    const old = await db.prepare('SELECT * FROM ebooks WHERE kode=?').get(req.params.kode);
    if (!old) return res.status(404).json({ error: 'Tidak ditemukan' });

    const { nama, kelompok, pdf, poster } = req.body || {};

    let newPdfUrl = old.file_pdf, newPdfName = old.file_nama_asli, newJumlahHalaman = old.jumlah_halaman, newUkuran = old.ukuran_bytes;
    if (pdf && pdf.url) {
        newPdfUrl = pdf.url;
        newPdfName = pdf.originalName || null;
        newJumlahHalaman = pdf.pages || 0;
        newUkuran = pdf.size || 0;
        if (old.file_pdf) deleteUploadedFileByUrl(old.file_pdf).catch(() => {}); // Hapus PDF lama dari cloud
    }

    let newPosterUrl = old.poster;
    if (poster && poster.url) {
        newPosterUrl = poster.url;
        if (old.poster) deleteUploadedFileByUrl(old.poster).catch(() => {}); // Hapus Poster lama dari cloud
    }

    await db.prepare(`UPDATE ebooks SET nama=?,kelompok=?,poster=?,file_pdf=?,file_nama_asli=?,jumlah_halaman=?,ukuran_bytes=? WHERE kode=?`)
        .run((nama || old.nama).trim(), (kelompok !== undefined ? (kelompok || '').trim() || null : old.kelompok), newPosterUrl, newPdfUrl, newPdfName, newJumlahHalaman, newUkuran, req.params.kode);

    res.json(await db.prepare('SELECT * FROM ebooks WHERE kode=?').get(req.params.kode));
}));

app.delete('/api/ebook/:kode', auth(['admin']), ah(async (req, res) => {
    const old = await db.prepare('SELECT * FROM ebooks WHERE kode=?').get(req.params.kode);

    await transaction(async (tdb) => {
        await tdb.prepare('DELETE FROM ebooks WHERE kode=?').run(req.params.kode);
        const modRows = await tdb.prepare('SELECT kode, ebook_list FROM ebook_modul').all();
        for (const m of modRows) {
            let list; try { list = JSON.parse(m.ebook_list || '[]'); } catch (e) { list = []; }
            if (list.includes(req.params.kode)) {
                await tdb.prepare('UPDATE ebook_modul SET ebook_list=? WHERE kode=?').run(JSON.stringify(list.filter(k => k !== req.params.kode)), m.kode);
            }
        }
    });

    if (old && old.poster) deleteUploadedFileByUrl(old.poster);
    if (old && old.file_pdf) deleteUploadedFileByUrl(old.file_pdf);

    res.json({ message: 'Berhasil' });
}));

app.get('/api/ebook-modul-kelompok', auth(['admin', 'review', 'user']), ah(async (req, res) => { res.json(await db.prepare('SELECT * FROM ebook_modul_kelompok ORDER BY LOWER(nama)').all()); }));
app.post('/api/ebook-modul-kelompok', auth(['admin']), ah(async (req, res) => { const kode = await genKode('EMKL', 'ebook_modul_kelompok'); await db.prepare('INSERT INTO ebook_modul_kelompok (kode,nama) VALUES (?,?)').run(kode, req.body.nama.trim()); res.json(await db.prepare('SELECT * FROM ebook_modul_kelompok WHERE kode=?').get(kode)); }));
app.put('/api/ebook-modul-kelompok/:kode', auth(['admin']), ah(async (req, res) => { await db.prepare('UPDATE ebook_modul_kelompok SET nama=? WHERE kode=?').run(req.body.nama.trim(), req.params.kode); res.json(await db.prepare('SELECT * FROM ebook_modul_kelompok WHERE kode=?').get(req.params.kode)); }));
app.delete('/api/ebook-modul-kelompok/:kode', auth(['admin']), ah(async (req, res) => { await transaction(async (tdb) => { await tdb.prepare('DELETE FROM ebook_modul_kelompok WHERE kode=?').run(req.params.kode); await tdb.prepare('UPDATE ebook_modul SET kelompok=NULL WHERE kelompok=?').run(req.params.kode); }); res.json({ message: 'Berhasil' }); }));

app.get('/api/ebook-modul', auth(['admin', 'review', 'user']), ah(async (req, res) => { const rows = await db.prepare('SELECT * FROM ebook_modul ORDER BY id').all(); rows.forEach(r => { if (r.ebook_list) try { r.ebook_list = JSON.parse(r.ebook_list); } catch (e) { r.ebook_list = []; } }); res.json(rows); }));

// CATATAN: poster (kalau ada) SUDAH diupload langsung ke Supabase lewat
// /api/upload-init sebelum endpoint ini dipanggil — body di sini cuma JSON kecil.
app.post('/api/ebook-modul', auth(['admin']), ah(async (req, res) => {
    const { nama, kelompok, poster } = req.body || {};
    if (!nama || !nama.trim()) return res.status(400).json({ error: 'Nama modul wajib diisi' });
    let ebook_list = []; try { ebook_list = Array.isArray(req.body.ebook_list) ? req.body.ebook_list : JSON.parse(req.body.ebook_list || '[]'); } catch (e) { ebook_list = []; }

    const kode = await genKode('EBM', 'ebook_modul');
    await db.prepare('INSERT INTO ebook_modul (kode,nama,kelompok,ebook_list,poster) VALUES (?,?,?,?,?)')
        .run(kode, nama.trim(), (kelompok || '').trim() || null, JSON.stringify(ebook_list), poster?.url || null);
    res.json(await db.prepare('SELECT * FROM ebook_modul WHERE kode=?').get(kode));
}));

app.put('/api/ebook-modul/:kode', auth(['admin']), ah(async (req, res) => {
    const old = await db.prepare('SELECT * FROM ebook_modul WHERE kode=?').get(req.params.kode);
    if (!old) return res.status(404).json({ error: 'Tidak ditemukan' });

    const { nama, kelompok, poster } = req.body || {};
    let ebook_list = []; try { ebook_list = Array.isArray(req.body.ebook_list) ? req.body.ebook_list : JSON.parse(req.body.ebook_list || '[]'); } catch (e) { ebook_list = []; }

    let newPosterUrl = old.poster;
    if (poster && poster.url) {
        newPosterUrl = poster.url;
        if (old.poster) deleteUploadedFileByUrl(old.poster).catch(() => {});
    }

    await db.prepare('UPDATE ebook_modul SET nama=?,kelompok=?,ebook_list=?,poster=? WHERE kode=?')
        .run((nama || old.nama).trim(), (kelompok !== undefined ? (kelompok || '').trim() || null : old.kelompok), JSON.stringify(ebook_list), newPosterUrl, req.params.kode);
    res.json(await db.prepare('SELECT * FROM ebook_modul WHERE kode=?').get(req.params.kode));
}));

app.delete('/api/ebook-modul/:kode', auth(['admin']), ah(async (req, res) => {
    const old = await db.prepare('SELECT * FROM ebook_modul WHERE kode=?').get(req.params.kode);
    await db.prepare('DELETE FROM ebook_modul WHERE kode=?').run(req.params.kode);
    if (old && old.poster) deleteUploadedFileByUrl(old.poster);
    res.json({ message: 'Berhasil' });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES: TOKENS, LAPORAN, UJIAN
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/tokens', auth(['admin']), ah(async (req, res) => res.json(await db.prepare("SELECT * FROM tokens WHERE digunakan=0 ORDER BY created_at DESC").all())));
app.get('/api/tokens/used', auth(['admin']), ah(async (req, res) => {
    const rows = await db.prepare(`SELECT t.kode, t.modul_kode, t.aktivasi, t.expired, t.digunakan_oleh, t.izinkan_review, t.grub_token, t.grub_id, t.created_at as token_created_at, l.kode as laporan_kode, l.tgl_selesai, l.waktu_pengerjaan, l.skor, l.created_at as laporan_created_at, u.nama as user_nama, m.nama as modul_nama, m.nama_internal as modul_nama_internal FROM tokens t LEFT JOIN laporan l ON l.token_kode = t.kode LEFT JOIN users u ON t.digunakan_oleh = u.kode LEFT JOIN modul m ON t.modul_kode = m.kode WHERE t.digunakan = 1 ORDER BY COALESCE(l.tgl_selesai, l.created_at::text, t.created_at::text) DESC`).all();
    res.json(rows);
}));
// Hitungan jumlah_token sengaja MENGECUALIKAN baris Kode Master Grup (is_master=1)
// supaya angkanya tetap mencerminkan jumlah token ASLI di grup itu (mis. tetap
// tampil "10", bukan "11" gara-gara ikut menghitung 1 kode master-nya).
app.get('/api/tokens/grub-list', auth(['admin','review']), ah(async (req, res) => { res.json(await db.prepare(`SELECT grub_token, COUNT(*) as jumlah_token FROM tokens WHERE grub_token IS NOT NULL AND TRIM(grub_token) <> '' AND (is_master=0 OR is_master IS NULL) GROUP BY grub_token ORDER BY LOWER(grub_token)`).all()); }));
app.post('/api/tokens/generate', auth(['admin']), ah(async (req, res) => {
    const { modul_kode, jumlah, mode, aktivasi, expired, izinkan_review, grub_token, batas_keluar } = req.body;
    const izinReview = izinkan_review ? 1 : 0;
    const grubToken = (grub_token && String(grub_token).trim()) ? String(grub_token).trim() : null;
    // grub_id: SELALU digenerate baru per batch (per klik "Generate Token"),
    // walau `grubToken` (nama) yang diketik admin sama persis dgn grup yang
    // sudah ada — lihat komentar genGrubId()/grupKeyOf() & kolom grub_id di
    // db/schema.sql. Ini yg jadi kunci pengelompokan sesungguhnya, BUKAN nama.
    // PENTING: sejak perubahan ini, grub_id (dan Kode Master-nya) dibuat untuk
    // SETIAP batch yang menghasilkan >1 token asli — TIDAK LAGI cuma kalau
    // switch "Aktifkan Grup Token" (grubToken/nama) dinyalakan admin. Nama grup
    // (grubToken) sekarang murni LABEL opsional, terpisah dari mekanisme
    // bundling-nya sendiri. Batch dgn jumlah=1 tetap tanpa grub_id/master (1
    // token tunggal tidak butuh dibundel apa pun).
    const jumlahCount = Math.min(Math.max(parseInt(jumlah) || 1, 1), 200);
    const grubId = (jumlahCount > 1) ? genGrubId() : null;
    // batas_keluar: null/undefined = perlindungan keluar DIMATIKAN. Angka = batas maksimal
    // pelanggaran (keluar dari ujian) yang ditoleransi sebelum ujian otomatis diselesaikan.
    const batasKeluar = (batas_keluar === null || batas_keluar === undefined || batas_keluar === '') ? null : Math.max(1, parseInt(batas_keluar) || 3);
    let akt = null, exp = null; const now = new Date();
    if (mode === 'hari_ini') { akt = now.toISOString(); const e = new Date(now); e.setHours(23, 59, 59, 0); exp = e.toISOString(); }
    else if (mode === 'custom' && aktivasi && expired) { akt = new Date(aktivasi).toISOString(); exp = new Date(expired).toISOString(); }
    try {
        const tokens = await transaction(async (tdb) => {
            const insert = tdb.prepare('INSERT INTO tokens (kode,modul_kode,aktivasi,expired,izinkan_review,grub_token,batas_keluar,grub_id,is_master) VALUES (?,?,?,?,?,?,?,?,?)');
            const checkExist = tdb.prepare('SELECT id FROM tokens WHERE kode=?');
            const count = jumlahCount; const result = [];
            for (let i = 0; i < count; i++) {
                let kode, tries = 0; do { kode = genTokenKode(); tries++; } while ((await checkExist.get(kode)) && tries < 10);
                await insert.run(kode, modul_kode, akt, exp, izinReview, grubToken, batasKeluar, grubId, 0); result.push({ kode, modul_kode, aktivasi: akt, expired: exp, izinkan_review: izinReview, grub_token: grubToken, batas_keluar: batasKeluar, grub_id: grubId, is_master: false });
            }
            // Kode Master Grup: 1 baris tambahan per batch, HANYA kalau batch ini
            // menghasilkan >1 token asli (grubId terisi — lihat komentar di atas).
            // Bukan salah satu dari `jumlah` token asli yang diminta admin — teksnya
            // sengaja dibuat dgn genTokenKode() yang sama persis dgn token asli (tidak
            // ada embel-embel/prefix apa pun), pembeda cuma internal (is_master=1).
            // Lihat komentar kolom is_master di db/schema.sql utk alur lengkapnya.
            if (grubId) {
                let masterKode, tries = 0; do { masterKode = genTokenKode(); tries++; } while ((await checkExist.get(masterKode)) && tries < 10);
                await insert.run(masterKode, modul_kode, akt, exp, izinReview, grubToken, batasKeluar, grubId, 1);
                result.push({ kode: masterKode, modul_kode, aktivasi: akt, expired: exp, izinkan_review: izinReview, grub_token: grubToken, batas_keluar: batasKeluar, grub_id: grubId, is_master: true });
            }
            return result;
        });
        res.json(tokens);
    } catch (e) { res.status(500).json({ error: e.message }); }
}));
app.delete('/api/tokens/:kode', auth(['admin']), ah(async (req, res) => { await db.prepare('DELETE FROM tokens WHERE kode=?').run(req.params.kode); res.json({ message: 'Berhasil' }); }));

app.get('/api/laporan', auth(['admin','review']), ah(async (req, res) => {
    const rows = await db.prepare('SELECT l.*,u.nama as user_nama,m.nama as modul_nama,m.nama_internal as modul_nama_internal,t.grub_token FROM laporan l LEFT JOIN users u ON l.user_kode=u.kode LEFT JOIN modul m ON l.modul_kode=m.kode LEFT JOIN tokens t ON l.token_kode=t.kode ORDER BY l.created_at DESC').all();
    rows.forEach(r => { if (r.jawaban) try { r.jawaban = JSON.parse(r.jawaban); } catch (e) {} if (req.user.role !== 'admin') delete r.modul_nama_internal; });
    res.json(rows);
}));
app.get('/api/laporan/:kode', auth(['admin','review']), ah(async (req, res) => {
    const lap = await db.prepare('SELECT l.*,u.nama as user_nama,m.nama as modul_nama,m.nama_internal as modul_nama_internal,t.grub_token FROM laporan l LEFT JOIN users u ON l.user_kode=u.kode LEFT JOIN modul m ON l.modul_kode=m.kode LEFT JOIN tokens t ON l.token_kode=t.kode WHERE l.kode=?').get(req.params.kode);
    if (!lap) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
    if (req.user.role !== 'admin') delete lap.modul_nama_internal;
    if (lap.jawaban) try { lap.jawaban = JSON.parse(lap.jawaban); } catch (e) {}
    if (lap.urutan_tampil) try { lap.urutan_tampil = JSON.parse(lap.urutan_tampil); } catch (e) { lap.urutan_tampil = null; }
    const modul = lap.modul_kode ? await db.prepare('SELECT * FROM modul WHERE kode=?').get(lap.modul_kode) : null;
    let soal_list = []; if (modul) { try { soal_list = JSON.parse(modul.soal_list || '[]'); } catch (e) {} }
    const soalDetail = [];
    for (const sl of soal_list) {
        const s = await db.prepare('SELECT * FROM soal WHERE kode=?').get(sl.soal_kode);
        if (s) { let data = null; try { data = JSON.parse(s.data || 'null'); } catch (e) {} data = expandSikapKerja(s.type, data); if (req.user.role !== 'admin') delete s.nama_internal; soalDetail.push({ ...s, data }); }
    }
    lap.soal_detail = soalDetail; res.json(lap);
}));

// GET /api/analisa/grup/:grubKey — endpoint agregasi khusus dock ANALISA
// (admin/analisa/analisa-token-detail.js). SEMUA filter & perhitungan jalan
// DI SERVER (bukan browser admin narik seluruh /api/laporan lalu filter
// sendiri) — supaya jawaban mentah peserta di luar grup ini tidak pernah
// terkirim ke browser admin, dan supaya perhitungan Benar/Salah/Nilai/Sikap
// Kerja konsisten dgn rumus otoritatif yang sama dgn hitungSkorUjianServer().
//
// `grubKey` di sini BUKAN nama grup (grub_token) — itu cuma label yang BOLEH
// diulang (mis. 2 batch beda tanggal/modul sama2 dinamai "SMA1"). Kuncinya
// grub_id (lihat genGrubId()/grupKeyOf() & komentar kolom grub_id di
// db/schema.sql), supaya 2 grup senama TIDAK PERNAH tercampur hasil
// analisanya walau modulnya kebetulan sama & peserta yg mengerjakan kebetulan
// orang yang sama — datanya tetap harus ditarik HANYA dari grup yang diklik,
// bukan grup lain. Prefix "legacy:" = fallback utk token yang dibuat SEBELUM
// kolom grub_id ada (grub_id NULL), dikelompokkan spt sebelumnya (by nama).
app.get('/api/analisa/grup/:grubKey', auth(['admin','review']), ah(async (req, res) => {
    const rawKey = req.params.grubKey;
    const isLegacy = rawKey.startsWith('legacy:');
    const legacyNama = isLegacy ? rawKey.slice('legacy:'.length) : null;
    const tokens = await db.prepare(`
        SELECT t.kode, t.modul_kode, t.digunakan, t.expired, t.grub_id, t.grub_token,
               l.kode as laporan_kode, l.jawaban, l.skor as laporan_skor, l.created_at as laporan_created_at,
               u.nama as user_nama, m.nama as modul_nama
        FROM tokens t
        LEFT JOIN laporan l ON l.token_kode = t.kode
        LEFT JOIN users u ON t.digunakan_oleh = u.kode
        LEFT JOIN modul m ON t.modul_kode = m.kode
        WHERE ${isLegacy ? '(t.grub_id IS NULL AND t.grub_token = ?)' : 't.grub_id = ?'} AND (t.is_master=0 OR t.is_master IS NULL)
    `).all(isLegacy ? legacyNama : rawKey);

    if (!tokens.length) {
        return res.json({ grub_key: rawKey, grub_token: legacyNama, ringkasan: { total: 0, used: 0, hangus: 0, modul: null }, peserta: [], charts: { binary: [], skor: [], sikap: [] }, per_soal: [], tipe_soal: { binary: false, skor: false, sikap: false }, multi_modul: false, modul_list: [] });
    }

    const now = Date.now();
    const total = tokens.length;
    const used = tokens.filter(t => t.digunakan).length;
    const hangus = tokens.filter(t => !t.digunakan && t.expired && new Date(t.expired).getTime() < now).length;

    // Tentukan modul mayoritas dalam grup ini (lihat komentar keputusan produk
    // di computeAnalisaGrupAggregate) — dipakai KHUSUS utk 3 grafik per-soal.
    const modulCount = {};
    tokens.forEach(t => { if (t.modul_kode) modulCount[t.modul_kode] = (modulCount[t.modul_kode] || 0) + 1; });
    const modulKodes = Object.keys(modulCount).sort((a, b) => modulCount[b] - modulCount[a]);
    const majorModul = modulKodes[0] || null;
    const multiModul = modulKodes.length > 1;

    // Peserta = token yang SUDAH dipakai & sudah ada laporannya. Sengaja
    // dihitung dari SEMUA modul (bukan cuma mayoritas) supaya daftar Peserta
    // tetap lengkap merepresentasikan grup, walau grafik per-soal cuma dari 1 modul.
    const laporanAllRows = tokens.filter(t => t.laporan_kode);
    const peserta = laporanAllRows
        .slice()
        .sort((a, b) => new Date(b.laporan_created_at || 0) - new Date(a.laporan_created_at || 0))
        .map(r => ({ nama: r.user_nama || '-', skor: r.laporan_skor != null ? r.laporan_skor : null }));

    let agg = { modul: null, binaryChart: [], skorChart: [], sikapRaw: [], tipeSoal: { binary: false, skor: false, sikap: false }, perSoal: [] };
    if (majorModul) {
        const laporanMajor = tokens.filter(t => t.laporan_kode && t.modul_kode === majorModul);
        agg = await computeAnalisaGrupAggregate(majorModul, laporanMajor);
    }

    res.json({
        grub_key: rawKey,
        grub_token: (tokens[0] && tokens[0].grub_token) || legacyNama,
        ringkasan: { total, used, hangus, modul: agg.modul },
        peserta,
        charts: { binary: agg.binaryChart, skor: agg.skorChart, sikap: agg.sikapRaw },
        // per_soal: kartu "Grafik Per Soal" versi baru — 1 entri per SOAL
        // BERNAMA dlm modul (lihat komentar perSoal di computeAnalisaGrupAggregate).
        // `charts` di atas TETAP dikirim apa adanya (dipakai analisa-soal.js
        // utk lookup by-nomor & analisa-export.js utk sheet Excel gabungan).
        per_soal: agg.perSoal || [],
        tipe_soal: agg.tipeSoal || { binary: false, skor: false, sikap: false },
        multi_modul: multiModul,
        modul_list: modulKodes.map(k => ({ kode: k, nama: (tokens.find(t => t.modul_kode === k) || {}).modul_nama || k, jumlah_token: modulCount[k] }))
    });
}));

// POST /api/analisa/soal/:kode/hitung — endpoint agregasi khusus kartu
// "Grafik" di admin/analisa/analisa-soal-detail.js (halaman ITEM DATA 1
// soal, dibuka dari slide-dock ANALISA > SOAL). Polanya sama dengan
// GET /api/analisa/grup/:grubKey di atas (SEMUA filter & hitungan jalan DI
// SERVER, jawaban mentah peserta tidak pernah dikirim ke browser admin),
// tapi sumber pesertanya beda: bukan 1 grup token, melainkan sampel manual
// (individu/grup) yang dipilih admin — dikirim FE sbg daftar `user_kodes`
// yang SUDAH final (individu + anggota grup yang tidak dikeluarkan/exclude).
// Body: { user_kodes: string[] }.
app.post('/api/analisa/soal/:kode/hitung', auth(['admin','review']), ah(async (req, res) => {
    const kode = req.params.kode;
    const soal = await db.prepare('SELECT kode FROM soal WHERE kode=?').get(kode);
    if (!soal) return res.status(404).json({ error: 'Soal tidak ditemukan' });

    const userKodes = Array.isArray(req.body.user_kodes) ? [...new Set(req.body.user_kodes.filter(Boolean))] : [];
    if (!userKodes.length) {
        return res.json({ jumlah_peserta: 0, charts: { binary: [], skor: [], sikap: [] }, tipe_soal: { binary: false, skor: false, sikap: false } });
    }

    // Cari semua modul yang memuat soal ini (logika sama dgn kartu "Modul" di
    // analisa-soal-detail.js) — laporan ujian tersimpan per modul_kode, jadi
    // jawaban utk soal ini bisa muncul di laporan modul manapun yang
    // menyertakan soal ini.
    const semuaModul = await db.prepare('SELECT kode FROM modul WHERE soal_list LIKE ?').all(`%"soal_kode":"${kode}"%`);
    const modulKodes = semuaModul.map(m => m.kode);
    if (!modulKodes.length) {
        return res.json({ jumlah_peserta: 0, charts: { binary: [], skor: [], sikap: [] }, tipe_soal: { binary: false, skor: false, sikap: false } });
    }

    const placeholdersUser = userKodes.map(() => '?').join(',');
    const placeholdersModul = modulKodes.map(() => '?').join(',');
    const laporanRows = await db.prepare(`
        SELECT l.kode as laporan_kode, l.jawaban, u.nama as user_nama
        FROM laporan l
        LEFT JOIN users u ON l.user_kode = u.kode
        WHERE l.user_kode IN (${placeholdersUser}) AND l.modul_kode IN (${placeholdersModul})
        ORDER BY l.created_at DESC
    `).all(...userKodes, ...modulKodes);

    const agg = await computeAnalisaSoalAggregate(kode, laporanRows);
    res.json({
        jumlah_peserta: laporanRows.length,
        charts: { binary: agg.binaryChart, skor: agg.skorChart, sikap: agg.sikapRaw },
        tipe_soal: agg.tipeSoal
    });
}));

// POST /api/analisa/modul/:kode/hitung — endpoint agregasi khusus kartu
// "Grafik" di admin/analisa/analisa-modul-detail.js (halaman detail 1 MODUL,
// dibuka dari slide-dock ANALISA > MODUL). Polanya SAMA PERSIS dengan
// POST /api/analisa/soal/:kode/hitung di atas (sampel manual dikirim FE sbg
// `user_kodes` yang sudah final, SEMUA filter & hitungan jalan DI SERVER) —
// BEDANYA: soal/:kode/hitung menghitung 1 soal (lintas SEMUA modul yang
// memuatnya), di sini SEBALIKNYA — menghitung SEMUA soal dalam 1 modul
// (gaya sama dgn GET /api/analisa/grup/:grubKey punya token, cuma sumber
// pesertanya sampel manual, bukan otomatis dari 1 grup token) — makanya
// dipakai computeAnalisaGrupAggregate() (fungsi yg SAMA dgn yg dipakai
// token), bukan computeAnalisaSoalAggregate(). Body: { user_kodes: string[] }.
app.post('/api/analisa/modul/:kode/hitung', auth(['admin','review']), ah(async (req, res) => {
    const kode = req.params.kode;
    const modul = await db.prepare('SELECT kode FROM modul WHERE kode=?').get(kode);
    if (!modul) return res.status(404).json({ error: 'Modul tidak ditemukan' });

    const userKodes = Array.isArray(req.body.user_kodes) ? [...new Set(req.body.user_kodes.filter(Boolean))] : [];
    if (!userKodes.length) {
        return res.json({ jumlah_peserta: 0, charts: { binary: [], skor: [], sikap: [] }, per_soal: [], tipe_soal: { binary: false, skor: false, sikap: false } });
    }

    const placeholdersUser = userKodes.map(() => '?').join(',');
    const laporanRows = await db.prepare(`
        SELECT l.kode as laporan_kode, l.jawaban, u.nama as user_nama
        FROM laporan l
        LEFT JOIN users u ON l.user_kode = u.kode
        WHERE l.user_kode IN (${placeholdersUser}) AND l.modul_kode = ?
        ORDER BY l.created_at DESC
    `).all(...userKodes, kode);

    const agg = await computeAnalisaGrupAggregate(kode, laporanRows);
    res.json({
        jumlah_peserta: laporanRows.length,
        charts: { binary: agg.binaryChart, skor: agg.skorChart, sikap: agg.sikapRaw },
        per_soal: agg.perSoal || [],
        tipe_soal: agg.tipeSoal
    });
}));

app.post('/api/exam/validate-token', auth(['user','admin','review']), ah(async (req, res) => {
    const { kode } = req.body;
    if (!kode) return res.status(400).json({ error: 'Kode token diperlukan' });
    let token = await db.prepare('SELECT * FROM tokens WHERE kode=?').get(kode.trim().toUpperCase());
    if (!token) return res.status(404).json({ error: 'Token tidak ditemukan' });
    const now = new Date();
    // Jendela waktu (aktivasi/expired) kode master SELALU identik dgn seluruh
    // anggota grupnya (dibuat dalam 1 batch yang sama) — jadi cukup dicek sekali
    // di sini, tidak perlu dicek ulang per-token asli saat direservasi di bawah.
    if (token.aktivasi && new Date(token.aktivasi) > now) return res.status(400).json({ error: `Token belum aktif. Aktif mulai ${new Date(token.aktivasi).toLocaleString('id-ID')}` });
    if (token.expired && new Date(token.expired) < now) return res.status(400).json({ error: 'Token sudah expired' });

    if (token.is_master) {
        // Kode Master Grup: boleh divalidasi berulang oleh banyak peserta berbeda.
        // Setiap kali, "pinjamkan" 1 token asli yang masih nganggur di grup yang sama
        // ke peserta yang barusan validasi — LANGSUNG dikunci (digunakan=1) di sini,
        // pada saat validasi, bukan menunggu sampai ujian selesai/submit. Ini yang
        // mencegah 2 peserta kebagian token asli yang sama kalau mereka validasi kode
        // master ini nyaris bersamaan.
        //
        // Atomisitas dijamin oleh Postgres sendiri: UPDATE...WHERE id=(SELECT...FOR
        // UPDATE SKIP LOCKED) adalah 1 statement tunggal, otomatis atomik walau
        // dijalankan tanpa BEGIN/COMMIT eksplisit. SKIP LOCKED membuat request lain
        // yang datang persis bersamaan otomatis MELEWATI baris yang sedang "dipegang"
        // request ini (bukan menunggu lalu ikut mengambil baris yang sama).
        const claimed = await db.prepare(`
            UPDATE tokens SET digunakan=1, digunakan_oleh=?
            WHERE id = (
                SELECT id FROM tokens
                WHERE grub_id=? AND is_master=0 AND digunakan=0
                ORDER BY id ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING *
        `).get(req.user.kode, token.grub_id);
        // Semua token asli di grup ini sudah habis dipakai — kode master tetap ada
        // (tidak pernah dihapus/dinonaktifkan sendiri), validasi cuma otomatis gagal
        // di sini karena tidak ada lagi token asli tersisa utk di-assign.
        if (!claimed) return res.status(400).json({ error: 'Semua token pada grup ini sudah habis dipakai' });
        token = claimed;
    } else if (token.digunakan) {
        return res.status(400).json({ error: 'Token sudah digunakan' });
    }

    const modul = await db.prepare('SELECT * FROM modul WHERE kode=?').get(token.modul_kode);
    if (!modul) return res.status(404).json({ error: 'Modul tidak ditemukan' });
    const soalDetail = await buildSoalDetail(modul);
    if (!soalDetail.length) return res.status(400).json({ error: 'Modul tidak memiliki soal' });
    res.json({ token: { kode: token.kode, aktivasi: token.aktivasi, expired: token.expired, batas_keluar: token.batas_keluar }, modul: { kode: modul.kode, nama: modul.nama, mode_bebas: !!modul.mode_bebas, timer_utama_jam: modul.timer_utama_jam || 0, timer_utama_menit: modul.timer_utama_menit || 0, timer_utama_detik: modul.timer_utama_detik || 0 }, soal: soalDetail });
}));

app.post('/api/exam/submit', auth(['user','admin','review']), ah(async (req, res) => {
    const { token_kode, waktu_pengerjaan, jawaban, urutan_tampil } = req.body;
    const user_kode = req.user.kode;

    // ── PERBAIKAN CELAH SUNTIK-NILAI ────────────────────────────────────────
    // SEBELUMNYA: modul_kode diambil LANGSUNG dari req.body (dikirim client),
    // dan kalau hitungSkorUjianServer() gagal (mis. modul_kode itu tidak valid/
    // tidak ada di DB), server DIAM-DIAM memakai `skor_detail` — juga dari
    // req.body — sebagai skor akhir yang tersimpan. Ini celah nyata: peserta
    // yang mengubah request submit lewat devtools/proxy (mengirim modul_kode
    // asal-asalan + skor_detail besar) bisa membuat server MENYIMPAN skor
    // buatannya sendiri sebagai skor resmi ujian, bukan hasil hitungan server.
    // SEKARANG: modul_kode SELALU diambil dari token.modul_kode (satu-satunya
    // sumber sah — ditentukan sejak token dibuat, bukan dari body request), dan
    // skor SELALU hasil hitungSkorUjianServer(). Kalau perhitungan itu gagal
    // (mis. data modul benar-benar rusak di DB), submit dianggap GAGAL (error
    // 500 -> ditangani retry otomatis client di ujian/hasil.js) — TIDAK PERNAH
    // diam-diam menerima angka kiriman client sebagai skor resmi.
    //
    // ── PERBAIKAN RACE CONDITION SUBMIT GANDA ───────────────────────────────
    // SEBELUMNYA: status token.digunakan dibaca via SELECT biasa (tanpa kunci)
    // SEBELUM transaksi INSERT/UPDATE. Kalau dua request submit utk token yang
    // SAMA datang nyaris bersamaan (mis. timer "waktu habis" & klik tombol
    // "Selesai" peserta race di sisi client, atau tab ganda/double-klik),
    // KEDUANYA bisa membaca "belum digunakan" sebelum salah satu commit, lalu
    // KEDUANYA lolos membuat baris laporan sendiri-sendiri untuk 1x pengerjaan
    // ujian yang sama (laporan ganda, salah satunya "phantom"). SEKARANG: baris
    // token dikunci (SELECT ... FOR UPDATE) di dalam transaksi SEJAK AWAL —
    // request kedua otomatis menunggu request pertama selesai commit, baru boleh
    // membaca status digunakan-nya (yang saat itu sudah ter-update), sehingga
    // jalur idempotensi (kembalikan laporan yang sudah ada) yang menanganinya,
    // bukan membuat baris baru.
    // ── PERBAIKAN "kode_counters KETINGGALAN DARI DATA LAMA" ────────────────
    // AKAR MASALAH (BUKAN race condition — kode_counters + UPDATE...RETURNING
    // di genKode() sudah atomik dgn benar): kode_counters bisa punya baris
    // 'laporan' dengan `counter` LEBIH KECIL drpd kode TERBESAR yang sudah ADA
    // beneran di tabel laporan (mis. setelah db/migrate-from-sqlite.js
    // meng-INSERT data laporan lama LANGSUNG dgn kode aslinya, TANPA lewat
    // genKode() — lihat db/migrate-from-sqlite.js — sementara baris
    // kode_counters utk 'laporan' sudah lebih dulu ada dgn angka kecil, mis.
    // dari beberapa submit asli sebelum migrasi dijalankan). Akibatnya
    // genKode('LAP','laporan') terus menghasilkan kode yang KEBETULAN SUDAH
    // DIPAKAI data lama (mis. LAP034) berkali-kali berturut-turut sampai
    // counter akhirnya lewat angka terbesar yang ada — persis pola bertubi²
    // "duplicate key value violates unique constraint laporan_kode_key" yang
    // terlihat di log. Selama itu, tiap percobaan (asli & retry otomatis
    // client di ujian/hasil.js) GAGAL 400, padahal isi jawabannya valid.
    // SEKARANG: kalau INSERT gagal spesifik krn tabrakan kode (23505 pada
    // constraint laporan_kode_key), seluruh transaksi ini diulang dari awal
    // (genKode() dipanggil ulang -> dapat angka baru yang sudah lanjut dari
    // percobaan gagal sebelumnya, krn counter tetap naik walau INSERT-nya
    // gagal) — TANPA peserta perlu menunggu client-side retry (yang tetap
    // ada sbg pengaman lapis kedua kalau penyebabnya justru gangguan
    // jaringan/server, bukan ini). Lihat juga scripts/fix-kode-counters.js
    // utk menyamakan ulang seluruh kode_counters dgn data yang sudah ada
    // (perbaikan satu-kali, dijalankan manual, tidak otomatis di sini).
    const MAX_KODE_CLASH_RETRY = 8;
    let result;
    for (let clashAttempt = 1; clashAttempt <= MAX_KODE_CLASH_RETRY; clashAttempt++) {
        try {
            result = await submitUjianTransaksi();
            break;
        } catch (e) {
            const isKodeClash = e && e.code === '23505' && /laporan_kode_key/.test(e.constraint || e.message || '');
            if (!isKodeClash || clashAttempt === MAX_KODE_CLASH_RETRY) throw e;
            console.warn(`[exam/submit] Tabrakan kode laporan (percobaan ${clashAttempt}/${MAX_KODE_CLASH_RETRY}), mengulang dgn kode baru...`);
        }
    }

    res.status(result.status).json(result.body);

    async function submitUjianTransaksi() {
    return await transaction(async (tdb) => {
        const token = await tdb.prepare('SELECT * FROM tokens WHERE kode=? FOR UPDATE').get(token_kode);
        if (!token) return { status: 404, body: { error: 'Token tidak ditemukan' } };

        if (token.digunakan) {
            // Status `digunakan=1` di sini bisa berarti 2 hal BERBEDA yang HARUS
            // dibedakan (BUG YANG DIPERBAIKI — sebelumnya disamakan, membuat
            // submit PERTAMA KALI dari token hasil klaim KODE MASTER selalu
            // gagal 400 "Token sudah digunakan" walau peserta belum pernah
            // submit sama sekali, bahkan di percobaan pertama):
            //   1) Token ASLI hasil klaim KODE MASTER GRUP (lihat POST
            //      /api/exam/validate-token) — `digunakan=1` DITULIS DI AWAL saat
            //      validasi/reservasi token (mencegah 2 peserta kebagian token
            //      sama), BUKAN saat submit. Peserta pemilik reservasi ini
            //      (`digunakan_oleh===user_kode`) yang belum pernah submit (belum
            //      ada baris `laporan`) HARUS tetap boleh lanjut submit seperti
            //      biasa di bawah, bukan ditolak.
            //   2) Token yang MEMANG sudah beneran pernah submit (baris `laporan`
            //      sudah ada) — inilah kasus IDEMPOTENSI SUBMIT asli: kalau submit
            //      SEBELUMNYA sebenarnya sukses tersimpan di server, tapi
            //      responsnya tidak sempat sampai ke browser (koneksi putus di
            //      tengah jalan) — kirimHasilUjian() di client lalu otomatis retry
            //      (lihat ujian/hasil.js) memakai token yang sama. Solusinya:
            //      kalau ownernya cocok, kembalikan laporan yang SUDAH ada apa
            //      adanya (bukan generate baru); kalau ownernya beda (token benar2
            //      dipakai/direservasi orang lain), baru tolak 400.
            const existing = await tdb.prepare('SELECT * FROM laporan WHERE token_kode=? ORDER BY created_at DESC LIMIT 1').get(token_kode);
            if (existing) {
                if (token.digunakan_oleh === user_kode) {
                    let soalDenganKunci = [];
                    try {
                        const modulExisting = await db.prepare('SELECT * FROM modul WHERE kode=?').get(existing.modul_kode);
                        if (modulExisting) soalDenganKunci = await buildSoalDetail(modulExisting, { withKunci: true });
                    } catch (e) {}
                    return { status: 200, body: { kode: existing.kode, skor: existing.skor, soal: soalDenganKunci, message: 'Ujian berhasil disimpan' } };
                }
                return { status: 400, body: { error: 'Token sudah digunakan' } };
            }
            // Belum ada laporan sama sekali utk token ini — kasus (1) di atas:
            // hanya lanjut kalau reservasinya memang milik peserta yang submit
            // sekarang. Kalau `digunakan_oleh` terisi tapi beda user (atau token
            // biasa/non-master yang entah kenapa `digunakan=1` tanpa laporan &
            // tanpa owner cocok), baru dianggap konflik asli & ditolak.
            if (token.digunakan_oleh && token.digunakan_oleh !== user_kode) {
                return { status: 400, body: { error: 'Token sudah digunakan' } };
            }
        }

        const modul_kode = token.modul_kode;
        const skor = await hitungSkorUjianServer(modul_kode, jawaban);

        const kode = await genKode('LAP', 'laporan');
        const tgl_selesai = new Date().toISOString().slice(0, 10);
        const izinReview = token.izinkan_review ? 1 : 0;
        await tdb.prepare('INSERT INTO laporan (kode,token_kode,user_kode,modul_kode,tgl_selesai,waktu_pengerjaan,skor,jawaban,urutan_tampil,izinkan_review) VALUES (?,?,?,?,?,?,?,?,?,?)')
            .run(kode, token_kode, user_kode, modul_kode, tgl_selesai, waktu_pengerjaan, skor, JSON.stringify(jawaban), urutan_tampil ? JSON.stringify(urutan_tampil) : null, izinReview);
        await tdb.prepare('UPDATE tokens SET digunakan=1,digunakan_oleh=? WHERE kode=?').run(user_kode, token_kode);

        let soalDenganKunci = [];
        try { const modul = await db.prepare('SELECT * FROM modul WHERE kode=?').get(modul_kode); if (modul) soalDenganKunci = await buildSoalDetail(modul, { withKunci: true }); } catch (e) {}
        return { status: 200, body: { kode, skor, soal: soalDenganKunci, message: 'Ujian berhasil disimpan' } };
    });
    }
}));


app.get('/api/notifikasi/expired-soon', auth(['admin']), ah(async (req, res) => { res.json(await db.prepare(`SELECT u.kode, u.nama, u.email, u.langganan_akhir, (u.langganan_akhir::date - CURRENT_DATE) as sisa_hari FROM users u WHERE u.role='user' AND u.langganan_akhir IS NOT NULL AND u.langganan_akhir::date >= CURRENT_DATE AND (u.langganan_akhir::date - CURRENT_DATE) <= 7 ORDER BY sisa_hari ASC`).all()); }));
app.get('/api/landing', ah(async (req, res) => { const row = await db.prepare('SELECT data FROM landing WHERE id=1').get(); res.json(row ? JSON.parse(row.data) : {}); }));
app.put('/api/landing', auth(['admin']), ah(async (req, res) => { const existing = await db.prepare('SELECT data FROM landing WHERE id=1').get(); const merged = { ...(existing ? JSON.parse(existing.data) : {}), ...req.body }; await db.prepare('INSERT INTO landing (id,data) VALUES (1,?) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data').run(JSON.stringify(merged)); res.json({ message: 'Berhasil' }); }));
// ── Pengaturan Integrasi (tab MANAGEMENT admin: dock GMAIL | GMEET) ──
// Sama pola merge spt /api/landing di atas, tapi GET-nya JUGA dikunci auth(['admin'])
// (bukan publik) karena data.resend bisa memuat API Key Resend.
app.get('/api/pengaturan/integrasi', auth(['admin']), ah(async (req, res) => { const row = await db.prepare('SELECT data FROM pengaturan_integrasi WHERE id=1').get(); res.json(row ? JSON.parse(row.data) : {}); }));
app.put('/api/pengaturan/integrasi', auth(['admin']), ah(async (req, res) => {
    const existing = await db.prepare('SELECT data FROM pengaturan_integrasi WHERE id=1').get();
    const merged = { ...(existing ? JSON.parse(existing.data) : {}), ...req.body };
    await db.prepare('INSERT INTO pengaturan_integrasi (id,data) VALUES (1,?) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data').run(JSON.stringify(merged));
    // Kredensial Resend bisa berubah di sini (from_email/api_key/aktif) — invalidateMailerCache()
    // dipertahankan utk kompatibilitas (lihat lib/mailer.js) walau sekarang no-op.
    if (req.body.resend) invalidateMailerCache();
    res.json({ message: 'Berhasil' });
}));
// Tombol "Tes Koneksi & Kirim Email Percobaan" di dock EMAIL — verifikasi
// beneran ke Resend (bukan cuma simpan field) lalu kirim 1 email percobaan ke
// alamat pengirim yang sama (atau ke `to` di body kalau mau tes ke alamat lain).
app.post('/api/pengaturan/integrasi/test-email', auth(['admin']), ah(async (req, res) => {
    try {
        await verifikasiDanKirimTes(req.body?.to);
        res.json({ message: 'Berhasil! Email percobaan sudah dikirim — cek inbox (atau folder spam).' });
    } catch (e) {
        res.status(400).json({ error: e.message || 'Gagal terhubung ke Resend. Cek lagi API Key-nya.' });
    }
}));

// ── JADWAL SESI KELAS (sumber data nyata utk pengingat email H-1/mulai) ──
// Vokabuler status sengaja selaras JDW_STATUS_LABEL di user/jadwal/jadwal.js
// (yang saat ini masih dummy/localStorage) supaya nanti gampang disambung —
// lihat catatan lengkap di lib/kelas-reminder.js.
app.get('/api/jadwal-sesi', auth(['admin','review','user']), ah(async (req, res) => {
    let rows;
    if (req.user.role === 'user') {
        rows = await db.prepare('SELECT * FROM jadwal_sesi WHERE user_kode=? ORDER BY waktu_mulai DESC').all(req.user.kode);
    } else if (req.user.role === 'review') {
        rows = await db.prepare('SELECT * FROM jadwal_sesi WHERE tentor_id=? ORDER BY waktu_mulai DESC').all(req.user.kode);
    } else {
        rows = await db.prepare('SELECT * FROM jadwal_sesi ORDER BY waktu_mulai DESC').all();
    }
    res.json(rows);
}));
app.post('/api/jadwal-sesi', auth(['admin','user']), ah(async (req, res) => {
    const { tentor_id, tentor_nama, materi_id, materi_nama, tanggal, slot_id, slot_label, waktu_mulai, waktu_selesai, meet_link } = req.body || {};
    if (!tentor_id || !tanggal || !waktu_mulai) return res.status(400).json({ error: 'tentor_id, tanggal, dan waktu_mulai wajib diisi' });
    const user_kode = req.user.role === 'admin' && req.body.user_kode ? req.body.user_kode : req.user.kode;
    const kode = await genKode('JDS', 'jadwal_sesi');
    await db.prepare(`INSERT INTO jadwal_sesi
        (kode,user_kode,tentor_id,tentor_nama,materi_id,materi_nama,tanggal,slot_id,slot_label,waktu_mulai,waktu_selesai,meet_link,status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(kode, user_kode, tentor_id, tentor_nama || null, materi_id || null, materi_nama || null, tanggal, slot_id || null, slot_label || null, waktu_mulai, waktu_selesai || null, meet_link || null, 'pending');
    res.json(await db.prepare('SELECT * FROM jadwal_sesi WHERE kode=?').get(kode));
}));
app.put('/api/jadwal-sesi/:kode', auth(['admin','review']), ah(async (req, res) => {
    const existing = await db.prepare('SELECT * FROM jadwal_sesi WHERE kode=?').get(req.params.kode);
    if (!existing) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
    if (req.user.role === 'review' && existing.tentor_id !== req.user.kode) return res.status(403).json({ error: 'Forbidden' });
    const { status, waktu_mulai, waktu_selesai, meet_link, catatan } = req.body || {};
    // Kalau jam mulai berubah, reset flag pengingat supaya H-1/notif-mulai
    // dihitung ulang dari jam yang baru (bukan tetap dianggap "sudah dikirim").
    const jamBerubah = waktu_mulai && waktu_mulai !== existing.waktu_mulai;
    await db.prepare(`UPDATE jadwal_sesi SET
        status = COALESCE(?, status),
        waktu_mulai = COALESCE(?, waktu_mulai),
        waktu_selesai = COALESCE(?, waktu_selesai),
        meet_link = COALESCE(?, meet_link),
        catatan = COALESCE(?, catatan),
        reminder_h1_sent = CASE WHEN ? THEN false ELSE reminder_h1_sent END,
        reminder_mulai_sent = CASE WHEN ? THEN false ELSE reminder_mulai_sent END,
        updated_at = CURRENT_TIMESTAMP
        WHERE kode = ?`)
        .run(status || null, waktu_mulai || null, waktu_selesai || null, meet_link || null, catatan || null, jamBerubah, jamBerubah, req.params.kode);
    res.json(await db.prepare('SELECT * FROM jadwal_sesi WHERE kode=?').get(req.params.kode));
}));
app.delete('/api/jadwal-sesi/:kode', auth(['admin','user']), ah(async (req, res) => {
    const existing = await db.prepare('SELECT * FROM jadwal_sesi WHERE kode=?').get(req.params.kode);
    if (!existing) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
    if (req.user.role === 'user' && existing.user_kode !== req.user.kode) return res.status(403).json({ error: 'Forbidden' });
    await db.prepare('DELETE FROM jadwal_sesi WHERE kode=?').run(req.params.kode);
    res.json({ message: 'Dihapus' });
}));
// Pemicu manual siklus pengecekan H-1/kelas-dimulai — dipakai kalau server
// dijalankan sbg serverless (Vercel, dst) di mana setInterval di kelas-reminder.js
// tidak jalan terus; jadwalkan cron eksternal (mis. Vercel Cron / cron-job.org)
// memanggil endpoint ini tiap beberapa menit.
app.post('/api/cron/jadwal-reminder', auth(['admin']), ah(async (req, res) => {
    res.json(await jalankanCekReminder());
}));
app.put('/api/me', auth(['admin','review','user']), ah(async (req, res) => { await db.prepare('UPDATE users SET nama=?,email=? WHERE kode=?').run(req.body.nama, normEmail(req.body.email), req.user.kode); res.json({ message: 'OK' }); }));
app.get('/api/review/users', auth(['review','admin']), ah(async (req, res) => res.json(await db.prepare("SELECT id,kode,nama,email,grub,status FROM users WHERE role='user' ORDER BY id").all())));
app.get('/api/review/laporan/:user_kode', auth(['review','admin']), ah(async (req, res) => { const rows = await db.prepare('SELECT * FROM laporan WHERE user_kode=? ORDER BY created_at DESC').all(req.params.user_kode); rows.forEach(r => { if (r.jawaban) try { r.jawaban = JSON.parse(r.jawaban); } catch (e) {} }); res.json(rows); }));
app.get('/api/user/riwayat', auth(['user','admin','review']), ah(async (req, res) => { const rows = await db.prepare('SELECT l.*,m.nama as modul_nama FROM laporan l LEFT JOIN modul m ON l.modul_kode=m.kode WHERE l.user_kode=? ORDER BY l.created_at DESC').all(req.user.kode); rows.forEach(r => { if (r.jawaban) try { r.jawaban = JSON.parse(r.jawaban); } catch (e) {} }); if (req.user.role === 'user' && rows.some(r => !r.izinkan_review) && await userPunyaReviewOverride(req.user.kode)) { rows.forEach(r => { r.izinkan_review = 1; }); } res.json(rows); }));
app.get('/api/user/riwayat/:kode', auth(['user','admin','review']), ah(async (req, res) => { const lap = await db.prepare('SELECT * FROM laporan WHERE kode=?').get(req.params.kode); if (!lap) return res.status(404).json({ error: 'Laporan tidak ditemukan' }); if (req.user.role === 'user') { if (lap.user_kode !== req.user.kode) return res.status(403).json({ error: 'Forbidden' }); if (!lap.izinkan_review && !(await userPunyaReviewOverride(req.user.kode))) return res.status(403).json({ error: 'Review untuk kode ini belum diizinkan' }); } if (lap.jawaban) try { lap.jawaban = JSON.parse(lap.jawaban); } catch (e) {} if (lap.urutan_tampil) try { lap.urutan_tampil = JSON.parse(lap.urutan_tampil); } catch (e) { lap.urutan_tampil = null; } const modul = lap.modul_kode ? await db.prepare('SELECT * FROM modul WHERE kode=?').get(lap.modul_kode) : null; if (modul) delete modul.nama_internal; let soalDetail = []; if (modul) { let soal_list = []; try { soal_list = JSON.parse(modul.soal_list || '[]'); } catch (e) {} for (const sl of soal_list) { const s = await db.prepare('SELECT * FROM soal WHERE kode=?').get(sl.soal_kode); if (s) { let data = null; try { data = JSON.parse(s.data || 'null'); } catch (e) {} data = expandSikapKerja(s.type, data); delete s.nama_internal; soalDetail.push({...s, data}); } } } res.json({ laporan: lap, modul, soal: soalDetail }); }));
app.get('/api/user/jadwal', auth(['user','admin','review']), ah(async (req, res) => { const me = await db.prepare('SELECT grub FROM users WHERE kode=?').get(req.user.kode); const rows = await db.prepare(`SELECT t.kode as token_kode, t.modul_kode, t.aktivasi as waktu_mulai, t.expired as waktu_selesai, t.digunakan, t.digunakan_oleh, m.nama as modul_nama, m.nama as nama FROM tokens t LEFT JOIN modul m ON t.modul_kode = m.kode WHERE (t.digunakan_oleh = ? AND (t.is_master=0 OR t.is_master IS NULL)) OR (t.grub_token IS NOT NULL AND t.grub_token = ? AND t.digunakan = 0 AND (t.is_master=0 OR t.is_master IS NULL)) ORDER BY t.aktivasi DESC NULLS LAST, t.created_at DESC`).all(req.user.kode, me?.grub || null); res.json(rows); }));
app.put('/api/user/password', auth(['user','admin','review']), ah(async (req, res) => { if (!req.body.password || req.body.password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' }); await db.prepare('UPDATE users SET password=? WHERE kode=?').run(bcrypt.hashSync(req.body.password, 10), req.user.kode); res.json({ message: 'Password berhasil diubah' }); }));
app.get('/api/user/me', auth(['user','admin','review']), ah(async (req, res) => { const user = await db.prepare('SELECT id,kode,nama,email,grub,status FROM users WHERE kode=?').get(req.user.kode); if (!user) return res.status(404).json({ error: 'User tidak ditemukan' }); if (user.grub) { const g = await db.prepare('SELECT nama FROM grubs WHERE kode=?').get(user.grub); user.grub_nama = g?.nama || user.grub; } res.json(user); }));
// Hak akses DOCK user, digabung dari SELURUH paket aktif (belum expired) milik
// user tsb — kalau salah satu paket aktif mengizinkan (mis. 'modul' utk E-BOOK),
// user dapat akses walau paket lain miliknya tidak. CAT ('ujian') & HISTORI
// ('laporan') SELALU ikut dikembalikan aktif — akses dasar, tidak bergantung
// hak_akses paket manapun (selaras dgn switch CAT/HISTORI yg dikunci ON di
// admin/paket-form.html). Dipakai index_user.html utk sembunyikan/kunci dock
// E-BOOK & JADWAL kalau user tidak/belum punya paket yang mengizinkannya.
app.get('/api/user/akses', auth(['user','admin','review']), ah(async (req, res) => {
    const rows = await db.prepare(`SELECT p.hak_akses FROM user_pakets up JOIN pakets p ON up.paket_kode = p.kode WHERE up.user_kode=? AND up.status='aktif' AND up.akhir::date >= CURRENT_DATE`).all(req.user.kode);
    // User tanpa paket aktif sama sekali -> perilaku lama (sebelum fitur Hak
    // Akses Paket ada): dock nggak dibatasi. Konsisten dgn UJIAN yg selama ini
    // dibuka pakai token, bukan lewat kepemilikan paket.
    if (!rows.length) return res.json({ hak_akses: ['ujian', 'laporan', 'modul', 'mentoring'] });
    const hak = new Set();
    rows.forEach(r => {
        // hak_akses NULL/kosong = paket lama yg belum pernah disimpan lewat form
        // "Hak Akses Paket" (switch-nya default semua menyala) -> anggap penuh,
        // BUKAN dibaca sbg array kosong = semua mati.
        if (r.hak_akses === null || r.hak_akses === undefined || r.hak_akses === '') {
            hak.add('ujian'); hak.add('laporan'); hak.add('modul'); hak.add('mentoring');
            return;
        }
        let arr = [];
        try { arr = JSON.parse(r.hak_akses); } catch (e) { arr = []; }
        (arr || []).forEach(v => hak.add(v));
    });
    res.json({ hak_akses: [...hak] });
}));
app.get('/api/public/pakets', auth(['user','admin','review']), ah(async (req, res) => { const rows = await db.prepare("SELECT kode,nama,deskripsi,periode_tipe,periode_hari,harga,fitur FROM pakets WHERE status='aktif' ORDER BY harga ASC").all(); rows.forEach(r => { if (r.fitur) try { r.fitur = JSON.parse(r.fitur); } catch (e) { r.fitur = []; } }); res.json(rows); }));
app.get('/api/user/pakets', auth(['user','admin','review']), ah(async (req, res) => { const today = new Date(); today.setHours(0,0,0,0); const rows = await db.prepare(`SELECT up.*, p.periode_tipe as template_tipe FROM user_pakets up LEFT JOIN pakets p ON up.paket_kode=p.kode WHERE up.user_kode=? ORDER BY up.akhir ASC`).all(req.user.kode); rows.forEach(r => { const akhir = new Date(r.akhir); akhir.setHours(0,0,0,0); r.sisa_hari = Math.ceil((akhir - today) / (1000*60*60*24)); r.is_expired = r.sisa_hari < 0; r.is_soon_expired = r.sisa_hari >= 0 && r.sisa_hari <= 7; }); res.json(rows); }));
app.post('/api/user/pakets', auth(['user']), ah(async (req, res) => { const user_kode = req.user.kode; const { paket_kode } = req.body; if (!paket_kode) return res.status(400).json({ error: 'Paket wajib dipilih' }); const paket = await db.prepare("SELECT * FROM pakets WHERE kode=? AND status='aktif'").get(paket_kode); if (!paket) return res.status(404).json({ error: 'Paket tidak ditemukan atau tidak aktif' }); const { mulai, akhir, extended } = await hitungMulaiAkhirPaket(user_kode, paket_kode, paket.periode_hari); const kode = await genKode('UP', 'user_pakets'); try { await transaction(async (tdb) => { await tdb.prepare('INSERT INTO user_pakets (kode,user_kode,paket_kode,paket_nama,periode_hari,mulai,akhir,status) VALUES (?,?,?,?,?,?,?,?)').run(kode, user_kode, paket_kode, paket.nama, paket.periode_hari, mulai, akhir, 'aktif'); await syncUserPaketLegacy(user_kode, tdb); }); res.json({ kode, mulai, akhir, extended, paket_nama: paket.nama, message: `Paket "${paket.nama}" berhasil diaktifkan` }); } catch (e) { res.status(500).json({ error: e.message }); } }));
app.get('/api/user/notifikasi-expired', auth(['user','admin','review']), ah(async (req, res) => { res.json(await db.prepare(`SELECT up.kode as up_kode, up.paket_nama, up.paket_kode, up.mulai, up.akhir, (up.akhir::date - CURRENT_DATE) as sisa_hari FROM user_pakets up WHERE up.user_kode=? AND up.status='aktif' AND up.akhir::date >= CURRENT_DATE AND (up.akhir::date - CURRENT_DATE) <= 7 ORDER BY sisa_hari ASC`).all(req.user.kode)); }));

// ═══════════════════════════════════════════════════════════════════════════════
// STATIC FILES & ERROR HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

// ── LAZY-LOAD MODULE FRAGMENTS ───────────────────────────────────────────────
// Setiap halaman utama (ujian, admin, review, user, landing) dipecah jadi folder
// berisi fragmen HTML+JS per tampilan/tab. Browser (lewat js/lazy-loader.js)
// fetch fragmen ini hanya saat tampilan itu benar-benar dibuka — jadi shell HTML
// awal (ujian.html, index_admin.html, dst) jauh lebih ringan, dan kalau ada
// perbaikan di satu tampilan, browser cukup ambil ulang file itu saja (bukan
// seluruh halaman) berkat cache singkat di bawah.
//
// Didaftarkan sebagai mount terpisah (bukan cuma ikut app.use(express.static(__dirname))
// di bawah) supaya bisa dikasih header cache yang sesuai: pendek, karena modul-
// modul ini masih sering direvisi, tapi tetap ada supaya browser tidak fetch
// ulang fragmen yang sama berkali-kali dalam sesi yang sama.
const LAZY_MODULES = ['ujian', 'admin', 'review', 'user', 'landing'];
LAZY_MODULES.forEach((mod) => {
    app.use('/' + mod, express.static(path.join(__dirname, mod), {
        maxAge: '5m',
        setHeaders(res) { res.setHeader('X-Lazy-Module', mod); }
    }));
});

// ── RAPIKAN FOLDER: shell tiap modul kini disimpan SATU FOLDER bareng
// fragmen-nya sendiri (mis. admin/index_admin.html satu tempat dengan
// admin/home.js, dst) — bukan lagi tercecer di root.
// URL publik SEKARANG TANPA ekstensi .html (mis. /index_admin, bukan lagi
// /index_admin.html) — file fisiknya tetap .html seperti biasa (cuma URL-nya
// yang "bersih"), jadi res.sendFile() di bawah tetap mengarah ke *.html asli.
app.get('/index_admin',  (req, res) => res.sendFile(path.join(__dirname, 'admin',  'index_admin.html')));
app.get('/index_review', (req, res) => res.sendFile(path.join(__dirname, 'review', 'index_review.html')));
app.get('/index_user',   (req, res) => res.sendFile(path.join(__dirname, 'user',   'index_user.html')));
app.get('/ujian',        (req, res) => res.sendFile(path.join(__dirname, 'ujian',  'ujian.html')));
app.get('/landing',      (req, res) => res.sendFile(path.join(__dirname, 'landing','landing.html')));

// /login tetap di-redirect di server SEBELUM static folder auth/ dipasang,
// supaya perilakunya sama persis seperti sebelumnya (redirect beneran di
// server, bukan halaman meta-refresh yang ke-serve duluan).
app.get('/login', (req, res) => res.redirect('/masuk'));

// Banyak halaman (admin/user/review/public) punya link/redirect relatif ke
// "index" (bekas "index.html") — dari URL root manapun (semua halaman kini
// path-nya rata di root, tanpa subfolder), relatif itu resolve ke /index.
// Arahkan balik ke beranda sebenarnya di /.
app.get('/index', (req, res) => res.redirect(301, '/'));

// ── Halaman publik (sebelum login), alur masuk/daftar, dan alur
// pembayaran kini dikelompokkan per folder (public/, auth/, payment/)
// supaya lebih mudah ditemukan & di-maintain. Dipasang tanpa prefix di
// URL (persis seperti dulu semua file ini ada langsung di root). Opsi
// `extensions:['html']` bikin request TANPA ekstensi (mis. /paket,
// /masuk, /pembayaran) otomatis resolve ke file *.html aslinya, jadi
// URL publiknya bersih tanpa perlu route manual satu-satu per halaman.
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use(express.static(path.join(__dirname, 'auth'), { extensions: ['html'] }));
app.use(express.static(path.join(__dirname, 'payment'), { extensions: ['html'] }));

app.use(express.static(__dirname));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js',  express.static(path.join(__dirname, 'js')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));
app.use((err, req, res, next) => {
    // Log detail lengkap (constraint/kolom/tabel yg bentrok) — SEBELUMNYA cuma
    // err.message yg dicatat, tidak cukup utk mendiagnosis error 23502/23505 di
    // Vercel Function Logs (mis. "Data duplikat" tanpa tahu constraint/kolom
    // mana yg sebenarnya bentrok, krn pesan generik itu yg dikirim ke client).
    console.error('[SERVER ERROR]', err.message, {
        code: err.code, constraint: err.constraint, detail: err.detail,
        table: err.table, column: err.column, path: req.path
    });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Format data tidak valid' });
    if (err.code === '23502') return res.status(400).json({ error: `Kolom "${err.column || ''}" wajib diisi` });
    if (err.code === '23505') return res.status(400).json({ error: 'Data duplikat' });
    res.status(500).json({ error: 'Terjadi kesalahan pada server' });
});

// ── START / EXPORT UNTUK VERCEL ───────────────────────────────────────────────
(async () => {
    try {
        await initSchema();
        await seedIfEmpty();
        await ensureGatewayConfig();

        // Scheduler pengingat kelas (H-1 & kelas dimulai) — jalan tiap 5 menit via
        // setInterval. Kalau dijalankan sbg serverless (VERCEL), setInterval tidak
        // bisa diandalkan hidup terus; pakai cron eksternal memanggil
        // POST /api/cron/jadwal-reminder sebagai gantinya (lihat server.js).
        if (!process.env.VERCEL) mulaiScheduler();

        // Server hanya menggunakan app.listen jika dijalankan secara lokal (bukan Vercel)
        if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
            app.listen(PORT, () => {
                console.log(`\n🚀 Server berjalan di http://localhost:${PORT}`);
                console.log(`📊 Database: PostgreSQL Ready`);
                console.log(`☁️ Storage: Supabase Cloud Storage Ready\n`);
            });
        }
    } catch (e) {
        console.error('[FATAL] Gagal inisialisasi database:', e.message);
    }
})();

// Wajib ditambahkan agar Vercel mengenali aplikasi Express
module.exports = app;