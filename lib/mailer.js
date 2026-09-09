// lib/mailer.js — Pengirim email nyata lewat Gmail (nodemailer), dipakai untuk
// OTP lupa kata sandi & notifikasi kelas (H-1 / kelas dimulai).
//
// Sumber kredensial: tabel `pengaturan_integrasi` (kolom JSON `data.gmail`),
// diisi lewat admin/management/management.js (dock GMAIL). Transporter
// di-cache di memori supaya tidak bikin koneksi SMTP baru di setiap kirim —
// cache otomatis dibuang (invalidateMailerCache) begitu admin menyimpan ulang
// pengaturan Gmail lewat PUT /api/pengaturan/integrasi, jadi kredensial baru
// langsung dipakai tanpa perlu restart server.

const nodemailer = require('nodemailer');
const { db } = require('../db/pool');

let _transporter = null;
let _cachedKey = null;

async function _getGmailConfig() {
    const row = await db.prepare('SELECT data FROM pengaturan_integrasi WHERE id=1').get();
    const data = row ? JSON.parse(row.data) : {};
    return data.gmail || null;
}

// Mengembalikan { transporter, from, gmail } kalau Gmail sudah diisi & diaktifkan,
// atau null kalau belum siap (belum diisi / checkbox "Aktifkan" belum dicentang).
async function getMailContext() {
    const g = await _getGmailConfig();
    if (!g || !g.aktif || !g.email || !g.app_password) return null;

    const key = g.email + '|' + g.app_password;
    if (!_transporter || _cachedKey !== key) {
        _transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: g.email, pass: g.app_password },
        });
        _cachedKey = key;
    }
    const from = g.nama_pengirim ? `"${g.nama_pengirim}" <${g.email}>` : g.email;
    return { transporter: _transporter, from, gmail: g };
}

// Dipanggil dari server.js setelah PUT /api/pengaturan/integrasi menyimpan
// perubahan `gmail` — supaya transporter lama (kredensial lama) tidak dipakai lagi.
function invalidateMailerCache() {
    _transporter = null;
    _cachedKey = null;
}

// Kirim satu email. Selalu mengembalikan { sent: boolean, reason?: string } —
// TIDAK pernah throw, supaya alur pemanggil (mis. forgot-password) tetap jalan
// normal walau pengiriman email gagal/gagal dikonfigurasi.
async function kirimEmail({ to, subject, html, text }) {
    const ctx = await getMailContext();
    if (!ctx) {
        console.log(`[MAIL] Gmail belum diatur/diaktifkan di admin > Management — email ke ${to} ("${subject}") TIDAK dikirim.`);
        return { sent: false, reason: 'not_configured' };
    }
    try {
        await ctx.transporter.sendMail({ from: ctx.from, to, subject, html, text: text || undefined });
        return { sent: true };
    } catch (e) {
        console.error('[MAIL] Gagal mengirim email:', e.message);
        return { sent: false, reason: e.message };
    }
}

// Verifikasi koneksi SMTP (dipakai tombol "Tes Koneksi & Kirim Email Percobaan"
// di admin/management). Berbeda dari kirimEmail: di sini kita SENGAJA melempar
// error yang jelas kalau gagal, supaya endpoint bisa membalas pesan yang jujur.
async function verifikasiDanKirimTes(tujuanEmail) {
    const ctx = await getMailContext();
    if (!ctx) {
        const e = new Error('Lengkapi alamat email, App Password, lalu centang "Aktifkan pengiriman" terlebih dahulu.');
        e.code = 'NOT_CONFIGURED';
        throw e;
    }
    await ctx.transporter.verify();
    await ctx.transporter.sendMail({
        from: ctx.from,
        to: tujuanEmail || ctx.gmail.email,
        subject: 'Email Percobaan — Pengaturan Gmail CIBN PRESTISE',
        html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">
            <p>Email ini dikirim otomatis untuk menguji pengaturan Gmail di dashboard admin CIBN PRESTISE.</p>
            <p>Kalau kamu menerima email ini, artinya pengiriman OTP &amp; notifikasi kelas lewat alamat <b>${ctx.gmail.email}</b> sudah siap dipakai.</p>
        </div>`,
    });
    return true;
}

module.exports = { kirimEmail, getMailContext, invalidateMailerCache, verifikasiDanKirimTes };
