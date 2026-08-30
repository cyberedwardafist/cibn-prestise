// server.js — Backend Express + PostgreSQL + Supabase Storage (Vercel Ready)

const express   = require('express');
const cors      = require('cors');
const multer    = require('multer');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const path      = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const { db, transaction } = require('./db/pool');
const { initSchema, seedIfEmpty, sanityCheckEbooks } = require('./db/init');

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

// ── MULTER MEMORY STORAGE (VERCEL COMPATIBLE) ────────────────────────────────
const ALLOWED_IMAGE_MIME = {
    'image/jpeg': '.jpg',
    'image/png':  '.png',
    'image/gif':  '.gif',
    'image/webp': '.webp'
};
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_PDF_MIME = { 'application/pdf': '.pdf' };
const MAX_EBOOK_PDF_SIZE = 80 * 1024 * 1024; // 80MB

const memoryStorage = multer.memoryStorage(); // Menyimpan file sebagai buffer di RAM sementara

const upload = multer({
    storage: memoryStorage,
    limits: { fileSize: MAX_UPLOAD_SIZE },
    fileFilter: (req, file, cb) => {
        if (!ALLOWED_IMAGE_MIME[file.mimetype]) return cb(new Error('INVALID_FILE_TYPE'));
        cb(null, true);
    }
});

const uploadEbook = multer({
    storage: memoryStorage,
    limits: { fileSize: MAX_EBOOK_PDF_SIZE },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'pdf') {
            if (!ALLOWED_PDF_MIME[file.mimetype]) return cb(new Error('INVALID_PDF_TYPE'));
        } else if (file.fieldname === 'poster') {
            if (!ALLOWED_IMAGE_MIME[file.mimetype]) return cb(new Error('INVALID_FILE_TYPE'));
        }
        cb(null, true);
    }
});

// Upload media Editor Landing (logo Hero = gambar, video Hero & Video Promo = video)
const ALLOWED_LANDING_VIDEO_MIME = { 'video/mp4': '.mp4', 'video/webm': '.webm' };
const MAX_LANDING_VIDEO_SIZE = 40 * 1024 * 1024; // 40MB (video)
const uploadLandingMedia = multer({
    storage: memoryStorage,
    limits: { fileSize: MAX_LANDING_VIDEO_SIZE },
    fileFilter: (req, file, cb) => {
        const kind = req.query.kind === 'video' ? 'video' : 'image';
        if (kind === 'video') {
            if (!ALLOWED_LANDING_VIDEO_MIME[file.mimetype]) return cb(new Error('INVALID_VIDEO_TYPE'));
        } else {
            if (!ALLOWED_IMAGE_MIME[file.mimetype]) return cb(new Error('INVALID_FILE_TYPE'));
        }
        cb(null, true);
    }
});

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

// ── HITUNG JUMLAH HALAMAN PDF DARI BUFFER ────────────────────────────────────
function countPdfPages(buffer) {
    try {
        const str = buffer.toString('latin1');
        const countMatches = [...str.matchAll(/\/Type\s*\/Pages\b[\s\S]{0,300}?\/Count\s+(\d+)/g)];
        const countMatches2 = [...str.matchAll(/\/Count\s+(\d+)[\s\S]{0,300}?\/Type\s*\/Pages\b/g)];
        const all = [...countMatches, ...countMatches2].map(m => parseInt(m[1], 10)).filter(n => !isNaN(n));
        if (all.length) return Math.max(...all);
        const pageMatches = str.match(/\/Type\s*\/Page(?![a-zA-Z])/g);
        return pageMatches ? pageMatches.length : 0;
    } catch (e) {
        console.error('[EBOOK] Gagal hitung halaman PDF:', e.message);
        return 0;
    }
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
async function genKode(prefix, table) {
    const row = await db.prepare(`SELECT kode FROM ${table} WHERE kode LIKE ? ORDER BY id DESC LIMIT 1`)
        .get(prefix + '%');
    if (!row) return prefix + '001';
    const num = parseInt(row.kode.replace(prefix, '')) + 1;
    return prefix + String(num).padStart(3, '0');
}
function genTokenKode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const seg   = () => Array.from({length:4}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
    return `${seg()}-${seg()}-${seg()}`;
}

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

// Soal Sikap Kerja: tiap soal yang digenerate cukup menyimpan {id, kunci_idx} —
// field semua/tampil/kunci/kunci_huruf bisa dihitung ulang dari 5 item kolomnya,
// jadi tidak perlu disalin berulang ke tiap soal (dulu ini penyebab payload
// membengkak dan gagal simpan / HTTP 413). Fungsi ini mengembalikan bentuk
// lengkap seperti sebelumnya, supaya semua kode yang sudah ada (ujian, laporan,
// export, review) tetap jalan tanpa perlu diubah sama sekali.
function expandSikapKerja(type, data) {
    if (type !== 'sikap_kerja' || !Array.isArray(data)) return data;
    return data.map(kolom => {
        if (!kolom || !Array.isArray(kolom.soal) || !Array.isArray(kolom.items)) return kolom;
        const items = kolom.items;
        const soal = kolom.soal.map(s => {
            if (s && s.tampil !== undefined) return s; // data lama/format lengkap, biarkan apa adanya
            const kIdx = s ? s.kunci_idx : undefined;
            if (kIdx === undefined || kIdx === null || !items[kIdx]) return s;
            return {
                id: s.id,
                semua: items.map(it => it.nilai),
                tampil: items.filter((_, j) => j !== kIdx).map(it => it.nilai),
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
// ROUTES: AUTH & USERS
// ═══════════════════════════════════════════════════════════════════════════════
app.post('/api/login', ah(async (req, res) => {
    const { email, password } = req.body;
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

// Catatan alur baru (landing "animation frame"): akun langsung AKTIF begitu
// daftar (bisa langsung login), TIDAK lagi masuk antrian signup_requests.
// Kalau user memilih paket saat daftar, itu dicatat sebagai permintaan aktivasi
// paket terpisah (paket_requests) yang menunggu verifikasi admin — akun tetap
// bisa dipakai login walau paketnya belum aktif. Endpoint signup_requests/
// approve/reject lama TETAP dibiarkan ada (tidak dihapus) untuk kompatibilitas
// data lama, tapi alur baru ini tidak lagi menulis ke tabel itu.
app.post('/api/signup', ah(async (req, res) => {
    const { nama, email, password } = req.body;
    if (!nama || !email || !password) return res.status(400).json({ error: 'Data tidak lengkap' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Kata sandi minimal 8 karakter' });
    try {
        if (await db.prepare('SELECT id FROM users WHERE email=?').get(email))
            return res.status(400).json({ error: 'Email sudah terdaftar' });
        const hash = bcrypt.hashSync(password, 10);
        const kode = await genKode('USR', 'users');
        await db.prepare('INSERT INTO users (kode,nama,email,password,role,status) VALUES (?,?,?,?,?,?)')
            .run(kode, nama, email, hash, 'user', 'aktif');
        // Catatan: pemilihan/aktivasi paket TIDAK lagi ditulis di sini. Kalau user
        // memilih paket saat daftar, permintaan aktivasinya baru dibuat di halaman
        // pembayaran.html/qris.html (lewat POST /api/user/paket-requests) setelah
        // token login di bawah ini dipakai — supaya akun-baru maupun akun-lama yang
        // login ulang untuk beli/perpanjang paket sama-sama lewat satu jalur yang sama.
        const token = jwt.sign({ id: kode, kode, email, nama, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ message: 'Pendaftaran berhasil. Akun Anda sudah aktif.', token, user: { kode, nama, email, role: 'user' } });
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
            const paket = r.paket_kode ? await tdb.prepare('SELECT * FROM pakets WHERE kode=?').get(r.paket_kode) : null;
            if (paket) {
                const { mulai, akhir } = await hitungMulaiAkhirPaket(r.user_kode, r.paket_kode, paket.periode_hari);
                const upKode = await genKode('UP', 'user_pakets');
                await tdb.prepare('INSERT INTO user_pakets (kode,user_kode,paket_kode,paket_nama,periode_hari,mulai,akhir,status) VALUES (?,?,?,?,?,?,?,?)')
                    .run(upKode, r.user_kode, r.paket_kode, paket.nama, paket.periode_hari, mulai, akhir, 'aktif');
            } else {
                // Paket custom/tanpa kode template (mis. "Hubungi Kami") — aktifkan manual 30 hari.
                const today = new Date(); const mulai = today.toISOString().split('T')[0];
                const ak = new Date(today); ak.setDate(ak.getDate() + 29);
                await upsertManualPaket(tdb, r.user_kode, r.paket_nama, mulai, ak.toISOString().split('T')[0]);
            }
            await syncUserPaketLegacy(r.user_kode, tdb);
            await tdb.prepare(`UPDATE paket_requests SET status='aktif' WHERE kode=?`).run(r.kode);
        });
        res.json({ message: 'Paket berhasil diaktifkan' });
    } catch (e) { res.status(500).json({ error: e.message }); }
}));
app.delete('/api/paket-requests/:kode', auth(['admin']), ah(async (req, res) => {
    await db.prepare(`UPDATE paket_requests SET status='ditolak' WHERE kode=?`).run(req.params.kode);
    res.json({ message: 'Ditolak' });
}));

// ── Lupa kata sandi via OTP (halaman otp.html) ──
// PENTING: belum ada layanan email/SMTP terpasang di server ini. Kode OTP
// dicatat ke console.log server sebagai pengganti sementara — sambungkan ke
// layanan email asli (mis. nodemailer + SMTP) tepat di baris console.log di
// bawah begitu kredensialnya tersedia.
function genOtp() { return String(Math.floor(100000 + Math.random() * 900000)); }

app.post('/api/password/forgot', ah(async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email wajib diisi' });
    const user = await db.prepare('SELECT kode FROM users WHERE email=?').get(email);
    if (user) {
        const otp = genOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await db.prepare('INSERT INTO password_resets (email,otp,expires_at) VALUES (?,?,?)').run(email, otp, expiresAt);
        console.log(`[OTP] Kode reset kata sandi untuk ${email}: ${otp} (berlaku 10 menit)`);
    }
    // Selalu balas sukses (tidak membocorkan apakah email terdaftar atau tidak).
    res.json({ message: 'Jika email terdaftar, kode OTP telah dikirim.' });
}));

app.post('/api/password/verify-otp', ah(async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Data tidak lengkap' });
    const row = await db.prepare('SELECT * FROM password_resets WHERE email=? AND otp=? ORDER BY id DESC LIMIT 1').get(email, otp);
    if (!row) return res.status(400).json({ error: 'Kode OTP salah' });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'Kode OTP sudah kedaluwarsa' });
    await db.prepare('UPDATE password_resets SET verified=1 WHERE id=?').run(row.id);
    res.json({ message: 'Kode terverifikasi' });
}));

app.post('/api/password/reset', ah(async (req, res) => {
    const { email, otp, password } = req.body;
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
    const { nama, email, password, role, grub, status, paket_nama, langganan_mulai, langganan_akhir } = req.body;
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
    const { nama, email, password, grub, status, paket_nama, langganan_mulai, langganan_akhir } = req.body;
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
// ROUTES: UPLOAD IMAGE & SOAL (SUPABASE INTEGRATION)
// ═══════════════════════════════════════════════════════════════════════════════
app.post('/api/upload', auth(['admin']), (req, res) => {
    upload.single('image')(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'Tidak ada file' });
        
        try {
            const typeSoal = safeFolderName(req.query.type || 'umum');
            const ext = ALLOWED_IMAGE_MIME[req.file.mimetype] || '.jpg';
            const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
            const filePath = `soal/${typeSoal}/${fileName}`;

            const { error } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });

            if (error) throw error;
            const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
            
            res.json({ url: publicUrlData.publicUrl });
        } catch (e) {
            res.status(500).json({ error: 'Gagal upload ke Supabase', details: e.message });
        }
    });
});

// Upload media Editor Landing → folder baru "landing/" di bucket Supabase yang sama.
// ?kind=image (logo Hero) atau ?kind=video (Video Latar Hero / Video Promo)
// ?slot=heroLogo|heroVideo|videoPromo → dipakai sbg awalan nama file
// ?oldUrl=... (opsional) → file lama dihapus dari Supabase begitu upload baru sukses
app.post('/api/upload-landing', auth(['admin']), (req, res) => {
    uploadLandingMedia.single('file')(req, res, async (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File terlalu besar (maks 40MB untuk video, 10MB untuk gambar)' });
            if (err.message === 'INVALID_VIDEO_TYPE') return res.status(400).json({ error: 'Format video tidak didukung (gunakan MP4/WEBM)' });
            if (err.message === 'INVALID_FILE_TYPE') return res.status(400).json({ error: 'Format gambar tidak didukung' });
            return res.status(400).json({ error: err.message });
        }
        if (!req.file) return res.status(400).json({ error: 'Tidak ada file' });

        const kind = req.query.kind === 'video' ? 'video' : 'image';
        if (kind === 'image' && req.file.size > MAX_UPLOAD_SIZE) {
            return res.status(400).json({ error: 'Gambar terlalu besar (maks 10MB)' });
        }

        try {
            const slot = safeFolderName(req.query.slot || 'media');
            const ext = (kind === 'video' ? ALLOWED_LANDING_VIDEO_MIME[req.file.mimetype] : ALLOWED_IMAGE_MIME[req.file.mimetype]) || '';
            const fileName = `${slot}-${Date.now()}${ext}`;
            const filePath = `landing/${fileName}`;

            const { error } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });
            if (error) throw error;

            const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

            // Bersihkan file lama (kalau ada) supaya storage tidak menumpuk file yatim
            if (req.query.oldUrl) deleteUploadedFileByUrl(req.query.oldUrl).catch(() => {});

            res.json({ url: publicUrlData.publicUrl });
        } catch (e) {
            res.status(500).json({ error: 'Gagal upload ke Supabase', details: e.message });
        }
    });
});

app.get('/api/soal', auth(['admin']), ah(async (req, res) => {
    const rows = await db.prepare('SELECT * FROM soal ORDER BY id').all();
    rows.forEach(r => { if (r.data) try { r.data = expandSikapKerja(r.type, JSON.parse(r.data)); } catch (e) {} });
    res.json(rows);
}));
app.get('/api/soal/:kode', auth(['admin','review']), ah(async (req, res) => {
    const s = await db.prepare('SELECT * FROM soal WHERE kode=?').get(req.params.kode);
    if (!s) return res.status(404).json({ error: 'Tidak ditemukan' });
    if (s.data) try { s.data = expandSikapKerja(s.type, JSON.parse(s.data)); } catch (e) {}
    if (req.user.role !== 'admin') delete s.nama_internal;
    res.json(s);
}));
app.post('/api/soal', auth(['admin']), ah(async (req, res) => {
    const { nama, nama_internal, type, skor_type, opsi_jawaban, timer_jam, timer_menit, timer_detik, kelompok, data } = req.body;
    const kode = await genKode('SOL', 'soal');
    await db.prepare('INSERT INTO soal (kode,nama,nama_internal,type,skor_type,opsi_jawaban,timer_jam,timer_menit,timer_detik,kelompok,data) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .run(kode, nama, (nama_internal || '').trim() || null, type, skor_type || null, opsi_jawaban || null, timer_jam || 0, timer_menit || 30, timer_detik || 0,
             (kelompok || '').trim() || null, data ? JSON.stringify(data) : null);
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

    await db.prepare('UPDATE soal SET nama=?,nama_internal=?,type=?,skor_type=?,opsi_jawaban=?,timer_jam=?,timer_menit=?,timer_detik=?,kelompok=?,data=? WHERE kode=?')
        .run(nama, nama_internal, type, skor_type, opsi_jawaban, timer_jam, timer_menit, timer_detik, kelompok, data, req.params.kode);

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

app.post('/api/ebook', auth(['admin']), (req, res) => {
    uploadEbook.fields([{ name: 'poster', maxCount: 1 }, { name: 'pdf', maxCount: 1 }])(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.message });
        try {
            const { nama, kelompok } = req.body;
            if (!nama || !nama.trim()) return res.status(400).json({ error: 'Nama buku wajib diisi' });
            
            const pdfFile = req.files?.pdf?.[0];
            if (!pdfFile) return res.status(400).json({ error: 'File PDF buku wajib diupload' });
            const posterFile = req.files?.poster?.[0];

            const folderName = safeFolderName(nama);
            
            // Upload PDF ke Supabase Storage
            const pdfExt = ALLOWED_PDF_MIME[pdfFile.mimetype] || '.pdf';
            const pdfFileName = `ebooks/${folderName}/${Date.now()}-${Math.random().toString(36).slice(2)}${pdfExt}`;
            await supabase.storage.from(BUCKET_NAME).upload(pdfFileName, pdfFile.buffer, { contentType: pdfFile.mimetype });
            const pdfUrl = supabase.storage.from(BUCKET_NAME).getPublicUrl(pdfFileName).data.publicUrl;

            // Upload Poster (Jika ada)
            let posterUrl = null;
            if (posterFile) {
                const imgExt = ALLOWED_IMAGE_MIME[posterFile.mimetype] || '.jpg';
                const posterFileName = `ebooks/${folderName}/poster-${Date.now()}${imgExt}`;
                await supabase.storage.from(BUCKET_NAME).upload(posterFileName, posterFile.buffer, { contentType: posterFile.mimetype });
                posterUrl = supabase.storage.from(BUCKET_NAME).getPublicUrl(posterFileName).data.publicUrl;
            }

            const jumlahHalaman = countPdfPages(pdfFile.buffer);
            const kode = await genKode('EBK', 'ebooks');

            await db.prepare(`INSERT INTO ebooks (kode,nama,kelompok,poster,file_pdf,file_nama_asli,jumlah_halaman,ukuran_bytes) VALUES (?,?,?,?,?,?,?,?)`)
                .run(kode, nama.trim(), (kelompok || '').trim() || null, posterUrl, pdfUrl, pdfFile.originalname, jumlahHalaman, pdfFile.size);

            res.json(await db.prepare('SELECT * FROM ebooks WHERE kode=?').get(kode));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
});

app.put('/api/ebook/:kode', auth(['admin']), (req, res) => {
    uploadEbook.fields([{ name: 'poster', maxCount: 1 }, { name: 'pdf', maxCount: 1 }])(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.message });
        try {
            const old = await db.prepare('SELECT * FROM ebooks WHERE kode=?').get(req.params.kode);
            if (!old) return res.status(404).json({ error: 'Tidak ditemukan' });

            const { nama, kelompok } = req.body;
            const pdfFile = req.files?.pdf?.[0];
            const posterFile = req.files?.poster?.[0];
            const folderName = safeFolderName(nama);

            let newPdfUrl = old.file_pdf;
            let newPdfName = old.file_nama_asli;
            let newJumlahHalaman = old.jumlah_halaman;
            let newUkuran = old.ukuran_bytes;
            let newPosterUrl = old.poster;

            if (pdfFile) {
                const pdfExt = ALLOWED_PDF_MIME[pdfFile.mimetype] || '.pdf';
                const pdfFileName = `ebooks/${folderName}/${Date.now()}-${Math.random().toString(36).slice(2)}${pdfExt}`;
                await supabase.storage.from(BUCKET_NAME).upload(pdfFileName, pdfFile.buffer, { contentType: pdfFile.mimetype });
                newPdfUrl = supabase.storage.from(BUCKET_NAME).getPublicUrl(pdfFileName).data.publicUrl;
                newPdfName = pdfFile.originalname;
                newJumlahHalaman = countPdfPages(pdfFile.buffer);
                newUkuran = pdfFile.size;
                if (old.file_pdf) deleteUploadedFileByUrl(old.file_pdf); // Hapus PDF lama dari cloud
            }

            if (posterFile) {
                const imgExt = ALLOWED_IMAGE_MIME[posterFile.mimetype] || '.jpg';
                const posterFileName = `ebooks/${folderName}/poster-${Date.now()}${imgExt}`;
                await supabase.storage.from(BUCKET_NAME).upload(posterFileName, posterFile.buffer, { contentType: posterFile.mimetype });
                newPosterUrl = supabase.storage.from(BUCKET_NAME).getPublicUrl(posterFileName).data.publicUrl;
                if (old.poster) deleteUploadedFileByUrl(old.poster); // Hapus Poster lama dari cloud
            }

            await db.prepare(`UPDATE ebooks SET nama=?,kelompok=?,poster=?,file_pdf=?,file_nama_asli=?,jumlah_halaman=?,ukuran_bytes=? WHERE kode=?`)
                .run(nama.trim(), (kelompok || '').trim() || null, newPosterUrl, newPdfUrl, newPdfName, newJumlahHalaman, newUkuran, req.params.kode);

            res.json(await db.prepare('SELECT * FROM ebooks WHERE kode=?').get(req.params.kode));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
});

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

app.post('/api/ebook-modul', auth(['admin']), (req, res) => {
    uploadEbook.fields([{ name: 'poster', maxCount: 1 }])(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.message });
        try {
            const { nama, kelompok } = req.body;
            if (!nama || !nama.trim()) return res.status(400).json({ error: 'Nama modul wajib diisi' });
            let ebook_list = []; try { ebook_list = JSON.parse(req.body.ebook_list || '[]'); } catch (e) { ebook_list = []; }

            const folderName = safeFolderName(nama);
            let posterUrl = null;
            const posterFile = req.files?.poster?.[0];
            if (posterFile) {
                const imgExt = ALLOWED_IMAGE_MIME[posterFile.mimetype] || '.jpg';
                const posterFileName = `ebook-modul/${folderName}/poster-${Date.now()}${imgExt}`;
                await supabase.storage.from(BUCKET_NAME).upload(posterFileName, posterFile.buffer, { contentType: posterFile.mimetype });
                posterUrl = supabase.storage.from(BUCKET_NAME).getPublicUrl(posterFileName).data.publicUrl;
            }

            const kode = await genKode('EBM', 'ebook_modul');
            await db.prepare('INSERT INTO ebook_modul (kode,nama,kelompok,ebook_list,poster) VALUES (?,?,?,?,?)')
                .run(kode, nama.trim(), (kelompok || '').trim() || null, JSON.stringify(ebook_list), posterUrl);
            res.json(await db.prepare('SELECT * FROM ebook_modul WHERE kode=?').get(kode));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
});

app.put('/api/ebook-modul/:kode', auth(['admin']), (req, res) => {
    uploadEbook.fields([{ name: 'poster', maxCount: 1 }])(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.message });
        try {
            const old = await db.prepare('SELECT * FROM ebook_modul WHERE kode=?').get(req.params.kode);
            if (!old) return res.status(404).json({ error: 'Tidak ditemukan' });

            const { nama, kelompok } = req.body;
            let ebook_list = []; try { ebook_list = JSON.parse(req.body.ebook_list || '[]'); } catch (e) { ebook_list = []; }
            const folderName = safeFolderName(nama);

            let newPosterUrl = old.poster;
            const posterFile = req.files?.poster?.[0];
            if (posterFile) {
                const imgExt = ALLOWED_IMAGE_MIME[posterFile.mimetype] || '.jpg';
                const posterFileName = `ebook-modul/${folderName}/poster-${Date.now()}${imgExt}`;
                await supabase.storage.from(BUCKET_NAME).upload(posterFileName, posterFile.buffer, { contentType: posterFile.mimetype });
                newPosterUrl = supabase.storage.from(BUCKET_NAME).getPublicUrl(posterFileName).data.publicUrl;
                if (old.poster) deleteUploadedFileByUrl(old.poster);
            }

            await db.prepare('UPDATE ebook_modul SET nama=?,kelompok=?,ebook_list=?,poster=? WHERE kode=?')
                .run(nama.trim(), (kelompok || '').trim() || null, JSON.stringify(ebook_list), newPosterUrl, req.params.kode);
            res.json(await db.prepare('SELECT * FROM ebook_modul WHERE kode=?').get(req.params.kode));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
});

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
    const rows = await db.prepare(`SELECT t.kode, t.modul_kode, t.aktivasi, t.expired, t.digunakan_oleh, t.izinkan_review, t.grub_token, t.created_at as token_created_at, l.kode as laporan_kode, l.tgl_selesai, l.waktu_pengerjaan, l.skor, l.created_at as laporan_created_at, u.nama as user_nama, m.nama as modul_nama, m.nama_internal as modul_nama_internal FROM tokens t LEFT JOIN laporan l ON l.token_kode = t.kode LEFT JOIN users u ON t.digunakan_oleh = u.kode LEFT JOIN modul m ON t.modul_kode = m.kode WHERE t.digunakan = 1 ORDER BY COALESCE(l.tgl_selesai, l.created_at::text, t.created_at::text) DESC`).all();
    res.json(rows);
}));
app.get('/api/tokens/grub-list', auth(['admin','review']), ah(async (req, res) => { res.json(await db.prepare(`SELECT grub_token, COUNT(*) as jumlah_token FROM tokens WHERE grub_token IS NOT NULL AND TRIM(grub_token) <> '' GROUP BY grub_token ORDER BY LOWER(grub_token)`).all()); }));
app.post('/api/tokens/generate', auth(['admin']), ah(async (req, res) => {
    const { modul_kode, jumlah, mode, aktivasi, expired, izinkan_review, grub_token, batas_keluar } = req.body;
    const izinReview = izinkan_review ? 1 : 0;
    const grubToken = (grub_token && String(grub_token).trim()) ? String(grub_token).trim() : null;
    // batas_keluar: null/undefined = perlindungan keluar DIMATIKAN. Angka = batas maksimal
    // pelanggaran (keluar dari ujian) yang ditoleransi sebelum ujian otomatis diselesaikan.
    const batasKeluar = (batas_keluar === null || batas_keluar === undefined || batas_keluar === '') ? null : Math.max(1, parseInt(batas_keluar) || 3);
    let akt = null, exp = null; const now = new Date();
    if (mode === 'hari_ini') { akt = now.toISOString(); const e = new Date(now); e.setHours(23, 59, 59, 0); exp = e.toISOString(); }
    else if (mode === 'custom' && aktivasi && expired) { akt = new Date(aktivasi).toISOString(); exp = new Date(expired).toISOString(); }
    try {
        const tokens = await transaction(async (tdb) => {
            const insert = tdb.prepare('INSERT INTO tokens (kode,modul_kode,aktivasi,expired,izinkan_review,grub_token,batas_keluar) VALUES (?,?,?,?,?,?,?)');
            const checkExist = tdb.prepare('SELECT id FROM tokens WHERE kode=?');
            const count = Math.min(jumlah, 200); const result = [];
            for (let i = 0; i < count; i++) {
                let kode, tries = 0; do { kode = genTokenKode(); tries++; } while ((await checkExist.get(kode)) && tries < 10);
                await insert.run(kode, modul_kode, akt, exp, izinReview, grubToken, batasKeluar); result.push({ kode, modul_kode, aktivasi: akt, expired: exp, izinkan_review: izinReview, grub_token: grubToken, batas_keluar: batasKeluar });
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

app.post('/api/exam/validate-token', auth(['user','admin','review']), ah(async (req, res) => {
    const { kode } = req.body;
    if (!kode) return res.status(400).json({ error: 'Kode token diperlukan' });
    const token = await db.prepare('SELECT * FROM tokens WHERE kode=?').get(kode.trim().toUpperCase());
    if (!token)          return res.status(404).json({ error: 'Token tidak ditemukan' });
    if (token.digunakan) return res.status(400).json({ error: 'Token sudah digunakan' });
    const now = new Date();
    if (token.aktivasi && new Date(token.aktivasi) > now) return res.status(400).json({ error: `Token belum aktif. Aktif mulai ${new Date(token.aktivasi).toLocaleString('id-ID')}` });
    if (token.expired && new Date(token.expired) < now) return res.status(400).json({ error: 'Token sudah expired' });
    const modul = await db.prepare('SELECT * FROM modul WHERE kode=?').get(token.modul_kode);
    if (!modul) return res.status(404).json({ error: 'Modul tidak ditemukan' });
    const soalDetail = await buildSoalDetail(modul);
    if (!soalDetail.length) return res.status(400).json({ error: 'Modul tidak memiliki soal' });
    res.json({ token: { kode: token.kode, aktivasi: token.aktivasi, expired: token.expired, batas_keluar: token.batas_keluar }, modul: { kode: modul.kode, nama: modul.nama, mode_bebas: !!modul.mode_bebas, timer_utama_jam: modul.timer_utama_jam || 0, timer_utama_menit: modul.timer_utama_menit || 0, timer_utama_detik: modul.timer_utama_detik || 0 }, soal: soalDetail });
}));

app.post('/api/exam/submit', auth(['user','admin','review']), ah(async (req, res) => {
    const { token_kode, modul_kode, waktu_pengerjaan, jawaban, skor_detail, urutan_tampil } = req.body;
    const user_kode = req.user.kode;
    const token = await db.prepare('SELECT * FROM tokens WHERE kode=?').get(token_kode);
    if (!token)          return res.status(404).json({ error: 'Token tidak ditemukan' });
    if (token.digunakan) return res.status(400).json({ error: 'Token sudah digunakan' });

    let skor = 0;
    try { skor = await hitungSkorUjianServer(modul_kode, jawaban); } 
    catch (e) { try { if (skor_detail && typeof skor_detail === 'object') { const v = Object.values(skor_detail); if (v.length) skor = Math.round(v.reduce((a,b) => a+b, 0)); } } catch (e2) {} }

    const kode = await genKode('LAP', 'laporan');
    const tgl_selesai = new Date().toISOString().slice(0, 10);
    const izinReview = token.izinkan_review ? 1 : 0;
    await transaction(async (tdb) => {
        await tdb.prepare('INSERT INTO laporan (kode,token_kode,user_kode,modul_kode,tgl_selesai,waktu_pengerjaan,skor,jawaban,urutan_tampil,izinkan_review) VALUES (?,?,?,?,?,?,?,?,?,?)')
            .run(kode, token_kode, user_kode, modul_kode, tgl_selesai, waktu_pengerjaan, skor, JSON.stringify(jawaban), urutan_tampil ? JSON.stringify(urutan_tampil) : null, izinReview);
        await tdb.prepare('UPDATE tokens SET digunakan=1,digunakan_oleh=? WHERE kode=?').run(user_kode, token_kode);
    });

    let soalDenganKunci = [];
    try { const modul = await db.prepare('SELECT * FROM modul WHERE kode=?').get(modul_kode); if (modul) soalDenganKunci = await buildSoalDetail(modul, { withKunci: true }); } catch (e) {}
    res.json({ kode, skor, soal: soalDenganKunci, message: 'Ujian berhasil disimpan' });
}));

app.get('/api/notifikasi/expired-soon', auth(['admin']), ah(async (req, res) => { res.json(await db.prepare(`SELECT u.kode, u.nama, u.email, u.langganan_akhir, (u.langganan_akhir::date - CURRENT_DATE) as sisa_hari FROM users u WHERE u.role='user' AND u.langganan_akhir IS NOT NULL AND u.langganan_akhir::date >= CURRENT_DATE AND (u.langganan_akhir::date - CURRENT_DATE) <= 7 ORDER BY sisa_hari ASC`).all()); }));
app.get('/api/landing', ah(async (req, res) => { const row = await db.prepare('SELECT data FROM landing WHERE id=1').get(); res.json(row ? JSON.parse(row.data) : {}); }));
app.put('/api/landing', auth(['admin']), ah(async (req, res) => { const existing = await db.prepare('SELECT data FROM landing WHERE id=1').get(); const merged = { ...(existing ? JSON.parse(existing.data) : {}), ...req.body }; await db.prepare('INSERT INTO landing (id,data) VALUES (1,?) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data').run(JSON.stringify(merged)); res.json({ message: 'Berhasil' }); }));
app.put('/api/me', auth(['admin','review','user']), ah(async (req, res) => { await db.prepare('UPDATE users SET nama=?,email=? WHERE kode=?').run(req.body.nama, req.body.email, req.user.kode); res.json({ message: 'OK' }); }));
app.get('/api/review/users', auth(['review','admin']), ah(async (req, res) => res.json(await db.prepare("SELECT id,kode,nama,email,grub,status FROM users WHERE role='user' ORDER BY id").all())));
app.get('/api/review/laporan/:user_kode', auth(['review','admin']), ah(async (req, res) => { const rows = await db.prepare('SELECT * FROM laporan WHERE user_kode=? ORDER BY created_at DESC').all(req.params.user_kode); rows.forEach(r => { if (r.jawaban) try { r.jawaban = JSON.parse(r.jawaban); } catch (e) {} }); res.json(rows); }));
app.get('/api/user/riwayat', auth(['user','admin','review']), ah(async (req, res) => { const rows = await db.prepare('SELECT l.*,m.nama as modul_nama FROM laporan l LEFT JOIN modul m ON l.modul_kode=m.kode WHERE l.user_kode=? ORDER BY l.created_at DESC').all(req.user.kode); rows.forEach(r => { if (r.jawaban) try { r.jawaban = JSON.parse(r.jawaban); } catch (e) {} }); if (req.user.role === 'user' && rows.some(r => !r.izinkan_review) && await userPunyaReviewOverride(req.user.kode)) { rows.forEach(r => { r.izinkan_review = 1; }); } res.json(rows); }));
app.get('/api/user/riwayat/:kode', auth(['user','admin','review']), ah(async (req, res) => { const lap = await db.prepare('SELECT * FROM laporan WHERE kode=?').get(req.params.kode); if (!lap) return res.status(404).json({ error: 'Laporan tidak ditemukan' }); if (req.user.role === 'user') { if (lap.user_kode !== req.user.kode) return res.status(403).json({ error: 'Forbidden' }); if (!lap.izinkan_review && !(await userPunyaReviewOverride(req.user.kode))) return res.status(403).json({ error: 'Review untuk kode ini belum diizinkan' }); } if (lap.jawaban) try { lap.jawaban = JSON.parse(lap.jawaban); } catch (e) {} if (lap.urutan_tampil) try { lap.urutan_tampil = JSON.parse(lap.urutan_tampil); } catch (e) { lap.urutan_tampil = null; } const modul = lap.modul_kode ? await db.prepare('SELECT * FROM modul WHERE kode=?').get(lap.modul_kode) : null; if (modul) delete modul.nama_internal; let soalDetail = []; if (modul) { let soal_list = []; try { soal_list = JSON.parse(modul.soal_list || '[]'); } catch (e) {} for (const sl of soal_list) { const s = await db.prepare('SELECT * FROM soal WHERE kode=?').get(sl.soal_kode); if (s) { let data = null; try { data = JSON.parse(s.data || 'null'); } catch (e) {} data = expandSikapKerja(s.type, data); delete s.nama_internal; soalDetail.push({...s, data}); } } } res.json({ laporan: lap, modul, soal: soalDetail }); }));
app.get('/api/user/jadwal', auth(['user','admin','review']), ah(async (req, res) => { const me = await db.prepare('SELECT grub FROM users WHERE kode=?').get(req.user.kode); const rows = await db.prepare(`SELECT t.kode as token_kode, t.modul_kode, t.aktivasi as waktu_mulai, t.expired as waktu_selesai, t.digunakan, t.digunakan_oleh, m.nama as modul_nama, m.nama as nama FROM tokens t LEFT JOIN modul m ON t.modul_kode = m.kode WHERE t.digunakan_oleh = ? OR (t.grub_token IS NOT NULL AND t.grub_token = ? AND t.digunakan = 0) ORDER BY t.aktivasi DESC NULLS LAST, t.created_at DESC`).all(req.user.kode, me?.grub || null); res.json(rows); }));
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

app.use(express.static(__dirname));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js',  express.static(path.join(__dirname, 'js')));
app.get('/login.html', (req, res) => res.redirect('/masuk.html'));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.use((req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));
app.use((err, req, res, next) => {
    console.error('[SERVER ERROR]', err.message);
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