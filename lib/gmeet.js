// lib/gmeet.js — Integrasi Google Meet ASLI (OAuth2 + Google Calendar API) untuk
// fitur Jadwal (user/jadwal/jadwal.js & review/jadwal/jadwal.js). Menggantikan
// link dummy (`_jdwEntryGmeetLink` pseudo-random di kedua file itu) dengan room
// Google Meet SUNGGUHAN: 1 jadwal_sesi yang masuk status "berlangsung" -> 1
// event Google Calendar baru dibuat lewat API -> Google sendiri yang
// membikinkan link meet.google.com unik utk event itu (field `hangoutLink`).
// Karena tiap baris jadwal_sesi = 1 pasangan tentor+murid+jam yang berbeda,
// tiap sesi otomatis dapat link BERBEDA walau tanggal/jam-nya sama persis
// dgn sesi pasangan lain (persis kebutuhan: guru A+murid A jam 09.45 pakai
// link X, guru B+murid B jam 09.45 yang sama pakai link Y).
//
// Kredensial (client_id/client_secret/calendar_id/durasi_default + refresh_token
// hasil consent) disimpan di tabel `pengaturan_integrasi` kolom JSON `data.gmeet`
// — pola sama persis dgn `data.resend` di lib/mailer.js. Alur OAuth (consent
// screen -> callback -> tukar code jadi refresh_token) ada di server.js
// (GET /api/gmeet/oauth/url & GET /api/gmeet/oauth/callback), lib ini murni
// helper: baca config, bangun URL consent, tukar code, refresh access token
// (dgn cache in-memory spy expiry biar tidak minta token baru tiap panggil),
// dan bikin event+room Meet lewat Calendar API.
//
// SENGAJA best-effort di titik pemanggilan (lihat generateMeetLinkSaatBerlangsung
// di server.js): kalau integrasi belum terhubung / token kadaluarsa & gagal
// refresh / Google API down, meet_link dibiarkan kosong & sesi TETAP boleh
// lanjut masuk "berlangsung" — jangan sampai gangguan pihak ketiga memblokir
// murid/tentor buka kelas. Error-nya cuma dicatat (console.error) di pemanggil.

const { db } = require('../db/pool');

const GOOGLE_AUTH_URL  = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CAL_API   = 'https://www.googleapis.com/calendar/v3';
const GMEET_SCOPE      = 'https://www.googleapis.com/auth/calendar.events';

async function getGmeetConfig() {
    const row = await db.prepare('SELECT data FROM pengaturan_integrasi WHERE id=1').get();
    const data = row ? JSON.parse(row.data) : {};
    return data.gmeet || {};
}

// Merge-save PERSIS pola PUT /api/pengaturan/integrasi di server.js (baca ->
// spread di atas data lama -> simpan lagi) — dipakai di sini supaya callback
// OAuth (yang jalan TANPA lewat endpoint admin biasa, lihat server.js) bisa
// menulis refresh_token/status hasil consent ke kolom `data.gmeet` yang sama,
// tanpa menimpa field lain (resend dkk) yang mungkin sudah tersimpan duluan.
async function _saveGmeetConfig(patch) {
    const row = await db.prepare('SELECT data FROM pengaturan_integrasi WHERE id=1').get();
    const data = row ? JSON.parse(row.data) : {};
    const gmeet = Object.assign({}, data.gmeet || {}, patch);
    const merged = Object.assign({}, data, { gmeet });
    await db.prepare('INSERT INTO pengaturan_integrasi (id,data) VALUES (1,?) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data').run(JSON.stringify(merged));
    _accessTokenCache = null; // kredensial/refresh_token baru -> access token lama (kalau ada) tidak lagi relevan
    return gmeet;
}

// Cache access_token in-memory (bukan di DB — access token cuma berumur ~1 jam
// & tidak perlu tahan restart server, beda dgn refresh_token yg memang harus
// persisten). Direset (di-null-kan) tiap kredensial gmeet berubah lewat
// invalidateGmeetTokenCache()/_saveGmeetConfig() supaya tidak kepakai token
// lama dari client_id/secret sebelumnya.
let _accessTokenCache = null; // { token, expiresAt(ms) }
function invalidateGmeetTokenCache() { _accessTokenCache = null; }

async function buildGmeetAuthUrl(redirectUri, state) {
    const cfg = await getGmeetConfig();
    if (!cfg.client_id) throw new Error('Google Client ID belum diisi. Simpan dulu Client ID & Client Secret sebelum menghubungkan akun.');
    const params = new URLSearchParams({
        client_id: cfg.client_id,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: GMEET_SCOPE,
        access_type: 'offline',
        prompt: 'consent', // paksa Google selalu balikin refresh_token baru tiap consent ulang (default-nya cuma dikirim consent PERTAMA kali)
        state,
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

// Tukar authorization code (dari redirect callback Google) jadi access_token +
// refresh_token, lalu LANGSUNG simpan refresh_token-nya ke pengaturan_integrasi
// (status jadi 'terhubung') supaya pemanggil (GET /api/gmeet/oauth/callback di
// server.js) tinggal redirect balik ke panel admin tanpa perlu simpan manual lagi.
async function exchangeGmeetCode(code, redirectUri) {
    const cfg = await getGmeetConfig();
    if (!cfg.client_id || !cfg.client_secret) throw new Error('Client ID/Client Secret Gmeet belum diisi');
    const params = new URLSearchParams({
        code,
        client_id: cfg.client_id,
        client_secret: cfg.client_secret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
    });
    const r = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) {
        throw new Error(j.error_description || j.error || 'Gagal menukar authorization code ke Google');
    }
    // Google cuma mengirim refresh_token pada consent PERTAMA kali (prompt=consent
    // di atas memaksa ini selalu terjadi tiap admin klik "Hubungkan" ulang) — kalau
    // suatu saat memang tidak ada (kasus langka), pertahankan refresh_token lama
    // supaya koneksi yang sudah ada sebelumnya tidak tiba-tiba putus.
    const patch = { status: 'terhubung', connected_at: new Date().toISOString() };
    if (j.refresh_token) patch.refresh_token = j.refresh_token;
    const saved = await _saveGmeetConfig(patch);
    if (!saved.refresh_token) throw new Error('Google tidak mengirim refresh token. Coba putuskan akses aplikasi ini di myaccount.google.com/permissions lalu hubungkan ulang.');
    return saved;
}

async function disconnectGmeet() {
    return _saveGmeetConfig({ status: 'belum_terhubung', refresh_token: null });
}

// Access token valid ~3600 detik — refresh 60 detik lebih awal biar tidak
// kepepet kadaluarsa persis pas dipakai bikin event (network latency dst).
async function _getAccessToken() {
    if (_accessTokenCache && _accessTokenCache.expiresAt > Date.now() + 60000) {
        return _accessTokenCache.token;
    }
    const cfg = await getGmeetConfig();
    if (!cfg.refresh_token) throw new Error('Akun Google belum terhubung (belum ada refresh token). Hubungkan dulu lewat Management > GMEET.');
    if (!cfg.client_id || !cfg.client_secret) throw new Error('Client ID/Client Secret Gmeet belum diisi');
    const params = new URLSearchParams({
        refresh_token: cfg.refresh_token,
        client_id: cfg.client_id,
        client_secret: cfg.client_secret,
        grant_type: 'refresh_token',
    });
    const r = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) {
        // invalid_grant lazim terjadi kalau refresh_token dicabut manual oleh
        // pemilik akun Google (myaccount.google.com/permissions) — tandai putus
        // di DB juga supaya badge status di panel admin ikut jujur menunjukkan
        // "Belum Terhubung", bukan diam2 tetap "Terhubung" padahal sudah mati.
        if (j.error === 'invalid_grant') await _saveGmeetConfig({ status: 'terputus' });
        throw new Error(j.error_description || j.error || 'Gagal memperbarui akses token Google');
    }
    _accessTokenCache = { token: j.access_token, expiresAt: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
    return j.access_token;
}

// Bikin 1 event Google Calendar baru berisi room Google Meet ASLI (conferenceData
// requestId unik per panggilan -> Google selalu bikinkan room baru, tidak pernah
// dipakai bareng event lain). `mulaiISO` bertipe "YYYY-MM-DDTHH:mm:ss" (tanpa
// offset zona, persis format kolom waktu_mulai di jadwal_sesi) — dikirim apa
// adanya ke Google dgn timeZone eksplisit 'Asia/Jakarta' (WIB, zona operasional
// CIBN Prestise) supaya Google yang mengurus konversinya, bukan server ini.
async function createMeetEvent({ summary, description, mulaiISO, durasiMenit }) {
    if (!mulaiISO) throw new Error('Waktu mulai sesi tidak valid');
    const cfg = await getGmeetConfig();
    const calendarId = encodeURIComponent(cfg.calendar_id || 'primary');
    const durasi = Number(durasiMenit) > 0 ? Number(durasiMenit) : (Number(cfg.durasi_default) || 60);
    const mulai = new Date(mulaiISO);
    if (isNaN(mulai.getTime())) throw new Error('Waktu mulai sesi tidak valid');
    const selesai = new Date(mulai.getTime() + durasi * 60000);
    const toLocalIso = (d) => d.toISOString().replace('Z', ''); // buang 'Z' -> dikombinasikan dgn timeZone eksplisit di bawah
    const requestId = 'jds-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    const accessToken = await _getAccessToken();
    const r = await fetch(`${GOOGLE_CAL_API}/calendars/${calendarId}/events?conferenceDataVersion=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
            summary: summary || 'Sesi Mentoring — CIBN Prestise',
            description: description || undefined,
            start: { dateTime: toLocalIso(mulai), timeZone: 'Asia/Jakarta' },
            end: { dateTime: toLocalIso(selesai), timeZone: 'Asia/Jakarta' },
            conferenceData: { createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
        }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error?.message || 'Gagal membuat event/room Google Meet');
    const meetLink = j.hangoutLink
        || (Array.isArray(j.conferenceData?.entryPoints) ? j.conferenceData.entryPoints.find(e => e.entryPointType === 'video')?.uri : null);
    if (!meetLink) throw new Error('Google tidak mengembalikan link Meet untuk event ini');
    return { meetLink, eventId: j.id };
}

module.exports = {
    getGmeetConfig,
    buildGmeetAuthUrl,
    exchangeGmeetCode,
    disconnectGmeet,
    invalidateGmeetTokenCache,
    createMeetEvent,
};
