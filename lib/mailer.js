// lib/mailer.js — Pengirim email nyata lewat Resend (REST API), dipakai untuk
// OTP (konfirmasi pendaftaran & lupa kata sandi) & notifikasi kelas (H-1 /
// kelas dimulai).
//
// Kenapa Resend (bukan lagi Gmail/nodemailer): Gmail App Password mengharuskan
// 2-Step Verification aktif, dan di banyak akun Google halaman "App
// Passwords"-nya sama sekali tidak muncul (akun Workspace yang dikunci admin,
// Advanced Protection, dll) — bikin admin kesulitan sekadar mencari halamannya.
// Resend cukup 1 API Key dari resend.com, tanpa login/2FA Google sama sekali.
//
// Sumber kredensial: tabel `pengaturan_integrasi` (kolom JSON `data.resend`),
// diisi lewat admin/management_API/management_API.js (dock EMAIL). Beda dari SMTP
// (nodemailer) yang butuh koneksi persisten, Resend murni REST API biasa —
// tidak ada transporter/koneksi yang perlu di-cache di memori.

const { db } = require('../db/pool');

async function _getResendConfig() {
    const row = await db.prepare('SELECT data FROM pengaturan_integrasi WHERE id=1').get();
    const data = row ? JSON.parse(row.data) : {};
    return data.resend || null;
}

// Mengembalikan { api_key, from, resend } kalau Resend sudah diisi & diaktifkan,
// atau null kalau belum siap (belum diisi / checkbox "Aktifkan" belum dicentang).
async function getMailContext() {
    const r = await _getResendConfig();
    if (!r || !r.aktif || !r.api_key || !r.from_email) return null;
    const from = r.nama_pengirim ? `${r.nama_pengirim} <${r.from_email}>` : r.from_email;
    return { api_key: r.api_key, from, resend: r };
}

// Dipertahankan supaya pemanggil lama (PUT /api/pengaturan/integrasi di
// server.js) tidak perlu diubah — dulu fungsi ini membuang transporter SMTP
// yang di-cache di memori. Resend tidak punya koneksi yang di-cache (setiap
// kirim baca ulang kredensial dari DB lewat getMailContext), jadi di sini
// sengaja dibiarkan kosong.
function invalidateMailerCache() {}

async function _resendSend({ api_key, from, to, subject, html, text }) {
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
        body: JSON.stringify({ from, to, subject, html, text: text || undefined }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.message || `Resend membalas status ${res.status}`);
    return body;
}

// Kirim satu email. Selalu mengembalikan { sent: boolean, reason?: string } —
// TIDAK pernah throw, supaya alur pemanggil (mis. OTP pendaftaran/lupa
// password) tetap jalan normal walau pengiriman email gagal/gagal dikonfigurasi.
async function kirimEmail({ to, subject, html, text }) {
    const ctx = await getMailContext();
    if (!ctx) {
        console.log(`[MAIL] Resend belum diatur/diaktifkan di admin > Akun Saya > API — email ke ${to} ("${subject}") TIDAK dikirim.`);
        return { sent: false, reason: 'not_configured' };
    }
    try {
        await _resendSend({ api_key: ctx.api_key, from: ctx.from, to, subject, html, text });
        return { sent: true };
    } catch (e) {
        console.error('[MAIL] Gagal mengirim email lewat Resend:', e.message);
        return { sent: false, reason: e.message };
    }
}

// Verifikasi kredensial (dipakai tombol "Tes Koneksi & Kirim Email Percobaan"
// di admin/management_API). Berbeda dari kirimEmail: di sini kita SENGAJA melempar
// error yang jelas kalau gagal, supaya endpoint bisa membalas pesan yang jujur.
async function verifikasiDanKirimTes(tujuanEmail) {
    const ctx = await getMailContext();
    if (!ctx) {
        const e = new Error('Lengkapi Alamat Email Pengirim & API Key Resend, lalu centang "Aktifkan pengiriman" terlebih dahulu.');
        e.code = 'NOT_CONFIGURED';
        throw e;
    }
    const to = tujuanEmail || ctx.resend.from_email;
    await _resendSend({
        api_key: ctx.api_key,
        from: ctx.from,
        to,
        subject: 'Email Percobaan — Pengaturan Resend CIBN PRESTISE',
        html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">
            <p>Email ini dikirim otomatis untuk menguji pengaturan Resend di dashboard admin CIBN PRESTISE.</p>
            <p>Kalau kamu menerima email ini, artinya pengiriman OTP &amp; notifikasi kelas lewat alamat <b>${ctx.resend.from_email}</b> sudah siap dipakai.</p>
        </div>`,
    });
    return true;
}

module.exports = { kirimEmail, getMailContext, invalidateMailerCache, verifikasiDanKirimTes };
