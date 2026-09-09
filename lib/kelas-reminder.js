// lib/kelas-reminder.js — Notifikasi email kelas (dock Jadwal): H-1 sebelum
// kelas berlangsung, dan begitu kelas mulai pada jam jadwal.
//
// CATATAN PENTING (baca ini sebelum menyambungkan ke fitur Jadwal yang sudah
// ada): halaman user/jadwal/jadwal.js & review/jadwal/jadwal.js SAAT INI masih
// 100% dummy — semua data pengajuan/jadwal tersimpan di localStorage browser
// masing-masing (lihat JadwalStore di file itu), BUKAN di server. Karena
// pengingat email ini WAJIB jalan sendiri di server (terlepas dari browser
// user terbuka atau tidak), pengingat ini butuh sumber data jadwal yang nyata
// di database — makanya dibuatkan tabel `jadwal_sesi` (lihat db/schema.sql)
// + endpoint CRUD dasarnya di server.js (bagian "JADWAL SESI KELAS").
//
// Tabel & scheduler di file ini SUDAH BERFUNGSI PENUH begitu ada baris di
// `jadwal_sesi` dengan status 'acc'. Yang BELUM disambungkan adalah UI
// Jadwal user/review yang sekarang masih localStorage — itu langkah
// migrasi terpisah (mengganti isi JadwalStore supaya manggil endpoint
// /api/jadwal-sesi alih-alih localStorage) yang sengaja belum disentuh di
// sini supaya perubahan gmail/OTP tidak tercampur dengan perombakan besar
// tampilan Jadwal yang sudah ada.

const { db } = require('../db/pool');
const { kirimEmail } = require('./mailer');

function formatTanggalIndo(d) {
    return new Date(d).toLocaleString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
    }) + ' WIB';
}

function templateH1(sesi) {
    return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">
        <p>Halo ${sesi.user_nama || ''},</p>
        <p>Ini pengingat kalau kamu punya kelas <b>${sesi.materi_nama || sesi.materi_id || ''}</b>
        besok bersama tentor <b>${sesi.tentor_nama || sesi.tentor_id || ''}</b>.</p>
        <p>🗓️ ${formatTanggalIndo(sesi.waktu_mulai)}</p>
        ${sesi.meet_link ? `<p>Link kelas: <a href="${sesi.meet_link}">${sesi.meet_link}</a></p>` : ''}
        <p>Sampai jumpa di kelas!</p>
    </div>`;
}

function templateMulai(sesi) {
    return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">
        <p>Halo ${sesi.user_nama || ''},</p>
        <p>Kelas <b>${sesi.materi_nama || sesi.materi_id || ''}</b> bersama tentor
        <b>${sesi.tentor_nama || sesi.tentor_id || ''}</b> sudah dimulai sekarang.</p>
        ${sesi.meet_link ? `<p>Gabung lewat: <a href="${sesi.meet_link}">${sesi.meet_link}</a></p>` : '<p>Silakan buka aplikasi untuk masuk ke kelas.</p>'}
    </div>`;
}

// Dipanggil berkala (setiap 5 menit lewat setInterval, atau manual lewat
// POST /api/cron/jadwal-reminder kalau server dijalankan sbg serverless
// (Vercel) di mana setInterval tidak bisa diandalkan — tinggal jadwalkan
// cron eksternal (mis. cron-job.org / Vercel Cron) memanggil endpoint itu.
async function jalankanCekReminder() {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    let terkirimH1 = 0, terkirimMulai = 0;

    try {
        // ── H-1: sesi acc yang mulainya dalam 24 jam ke depan, belum pernah dikirimi pengingat ──
        const h1Rows = await db.prepare(`
            SELECT js.*, u.email AS user_email, u.nama AS user_nama
            FROM jadwal_sesi js JOIN users u ON u.kode = js.user_kode
            WHERE js.status = 'acc' AND js.reminder_h1_sent = false
              AND js.waktu_mulai > ? AND js.waktu_mulai <= ?
        `).all(now.toISOString(), in24h.toISOString());

        for (const sesi of h1Rows) {
            const hasil = await kirimEmail({
                to: sesi.user_email,
                subject: `Pengingat: Kelas ${sesi.materi_nama || sesi.materi_id || ''} besok`,
                html: templateH1({ ...sesi, user_nama: sesi.user_nama }),
            });
            if (hasil.sent) {
                await db.prepare('UPDATE jadwal_sesi SET reminder_h1_sent = true, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(sesi.id);
                terkirimH1++;
            }
        }

        // ── Kelas mulai: sesi acc/berlangsung yang jam mulainya sudah lewat, belum dikirimi notif mulai ──
        const mulaiRows = await db.prepare(`
            SELECT js.*, u.email AS user_email, u.nama AS user_nama
            FROM jadwal_sesi js JOIN users u ON u.kode = js.user_kode
            WHERE js.status IN ('acc', 'berlangsung') AND js.reminder_mulai_sent = false
              AND js.waktu_mulai <= ?
        `).all(now.toISOString());

        for (const sesi of mulaiRows) {
            const hasil = await kirimEmail({
                to: sesi.user_email,
                subject: `Kelas ${sesi.materi_nama || sesi.materi_id || ''} sudah dimulai`,
                html: templateMulai({ ...sesi, user_nama: sesi.user_nama }),
            });
            if (hasil.sent) {
                await db.prepare('UPDATE jadwal_sesi SET reminder_mulai_sent = true, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(sesi.id);
                terkirimMulai++;
            }
        }
    } catch (e) {
        console.error('[kelas-reminder] Gagal cek jadwal:', e.message);
    }
    return { terkirimH1, terkirimMulai };
}

function mulaiScheduler() {
    // Jalan sekali saat start, lalu tiap 5 menit. Cukup rapat untuk pengingat
    // H-1 (toleransi jam bergerak), dan untuk notif "kelas dimulai" idealnya
    // dipercepat (mis. tiap 1 menit) kalau ketepatan waktu penting — 5 menit
    // dipilih dulu sebagai default aman, gampang diubah di sini.
    jalankanCekReminder().catch(() => {});
    setInterval(() => { jalankanCekReminder().catch(() => {}); }, 5 * 60 * 1000);
}

module.exports = { mulaiScheduler, jalankanCekReminder };
