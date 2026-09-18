// ═══════════════════════════════════════════════════════════════════════════
// lib/edge-tts.js — Text-to-Speech GRATIS & TANPA API KEY, dipakai fitur
// "🎙️ Generate Suara" di form soal Listening TOEFL (admin/soal/soal.js).
//
// Cara kerja: pakai layanan yang sama dipakai fitur "Read Aloud" bawaan
// Microsoft Edge (bukan produk berbayar Azure Cognitive Services — ini
// endpoint publik gratis tanpa API key/kuota resmi, cuma dibatasi wajar
// oleh Microsoft utk mencegah penyalahgunaan). Ini protokol TIDAK RESMI
// (reverse-engineered, dipakai juga oleh proyek open-source populer spt
// `edge-tts` di Python & `msedge-tts` di Node) — kalau suatu saat Microsoft
// mengubah protokolnya, hanya file ini yang perlu disesuaikan; kode
// pemanggil (server.js, admin/soal/soal.js) tidak perlu ikut berubah.
//
// KATALOG SUARA — HARUS SAMA (nilai `id`) dgn TTS_VOICES di
// admin/soal/soal.js (dipakai buat validasi di server; render pilihan tetap
// dari daftar di sisi client). Minimal 5 suara (3 pria + 2 wanita) sesuai
// permintaan; disediakan 7 (4 pria + 3 wanita) biar admin lebih leluasa
// milih & ada cadangan kalau salah satu suara "ditarik" Microsoft.
// ═══════════════════════════════════════════════════════════════════════════
const WebSocket = require('ws');
const crypto = require('crypto');

const VOICE_CATALOG = [
    { id: 'en-US-GuyNeural',   label: 'Guy (Pria, US)',    gender: 'male' },
    { id: 'en-US-DavisNeural', label: 'Davis (Pria, US)',  gender: 'male' },
    { id: 'en-US-TonyNeural',  label: 'Tony (Pria, US)',   gender: 'male' },
    { id: 'en-GB-RyanNeural',  label: 'Ryan (Pria, UK)',   gender: 'male' },
    { id: 'en-US-JennyNeural', label: 'Jenny (Wanita, US)', gender: 'female' },
    { id: 'en-US-AriaNeural',  label: 'Aria (Wanita, US)',  gender: 'female' },
    { id: 'en-GB-SoniaNeural', label: 'Sonia (Wanita, UK)', gender: 'female' },
];
const VOICE_IDS = new Set(VOICE_CATALOG.map(v => v.id));
const ALLOWED_RATES = new Set(['-20%', '0%', '20%']);

// Token publik yang dipakai Microsoft Edge sendiri (bukan rahasia/API key
// pribadi siapa pun — sama utk semua orang, tertanam di binari Edge).
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WIN_EPOCH_OFFSET_SEC = 11644473600; // selisih epoch Windows FILETIME (1601) <-> Unix (1970)

// Microsoft mewajibkan header "Sec-MS-GEC" (hash yg berubah tiap 5 menit)
// sejak pertengahan 2024 utk memblokir klien non-Edge yang naif. Rumus ini
// hasil reverse-engineering komunitas (dipakai jg oleh `edge-tts` Python) —
// KALAU MICROSOFT MENGUBAH RUMUS INI DI MASA DEPAN, generate suara akan
// mulai gagal dgn error koneksi/403 dari sini, dan rumus di bawah perlu
// diperbarui sesuai versi terbaru proyek edge-tts komunitas.
function _generateSecMsGec() {
    let ticks = Math.floor(Date.now() / 1000) + WIN_EPOCH_OFFSET_SEC;
    ticks -= ticks % 300; // bulatkan ke bawah ke kelipatan 5 menit
    const winTicks = BigInt(ticks) * 10000000n; // detik -> satuan 100-ns (Windows ticks)
    const strToHash = winTicks.toString() + TRUSTED_CLIENT_TOKEN;
    return crypto.createHash('sha256').update(strToHash, 'utf8').digest('hex').toUpperCase();
}

function _escapeSsmlText(text) {
    return String(text || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// Sintesis SATU segmen teks -> Promise<Buffer> (MP3). `rate` format string
// spt "-20%"/"0%"/"20%" (dipakai apa adanya sbg atribut SSML <prosody rate>).
function synthesizeSegment({ text, voice, rate }) {
    return new Promise((resolve, reject) => {
        const cleanText = String(text || '').trim();
        if (!cleanText) return reject(new Error('Teks kosong'));
        const voiceId = VOICE_IDS.has(voice) ? voice : VOICE_CATALOG[0].id;
        const rateVal = ALLOWED_RATES.has(rate) ? rate : '0%';

        const connectId = crypto.randomUUID().replace(/-/g, '');
        const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1`
            + `?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${_generateSecMsGec()}&Sec-MS-GEC-Version=1-131.0.2903.99&ConnectionId=${connectId}`;

        const ws = new WebSocket(wsUrl, {
            headers: {
                'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
                'Pragma': 'no-cache', 'Cache-Control': 'no-cache',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
            }
        });

        const audioChunks = [];
        let settled = false;
        const done = (err, buf) => { if (settled) return; settled = true; try { ws.close(); } catch (e) {} clearTimeout(timeoutTimer); err ? reject(err) : resolve(buf); };
        const timeoutTimer = setTimeout(() => done(new Error('Timeout menghubungi layanan TTS (30 detik)')), 30000);

        ws.on('open', () => {
            const reqId = crypto.randomUUID().replace(/-/g, '');
            const now = new Date().toString();
            // Pesan 1: konfigurasi format output (MP3, 24kHz, 48kbps — cukup jernih utk listening test, ukuran file kecil).
            ws.send(
                `X-Timestamp:${now}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
                JSON.stringify({ context: { synthesis: { audio: { metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false }, outputFormat: 'audio-24khz-48kbitrate-mono-mp3' } } } })
            );
            // Pesan 2: SSML yang mau disintesis.
            const ssml = `<speak version='1.0' xml:lang='en-US'>`
                + `<voice name='${voiceId}'><prosody rate='${rateVal}'>${_escapeSsmlText(cleanText)}</prosody></voice></speak>`;
            ws.send(`X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${now}Z\r\nPath:ssml\r\n\r\n${ssml}`);
        });

        ws.on('message', (data, isBinary) => {
            if (isBinary) {
                // Frame audio biner: 2 byte pertama = panjang header teks, sisanya
                // header (path dsb) lalu payload audio mentah setelahnya.
                const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
                const headerLen = buf.readUInt16BE(0);
                audioChunks.push(buf.subarray(headerLen + 2));
            } else {
                const text = data.toString();
                if (text.includes('Path:turn.end')) done(null, Buffer.concat(audioChunks));
            }
        });
        ws.on('error', (e) => done(new Error('Gagal terhubung ke layanan TTS: ' + (e.message || 'unknown'))));
        ws.on('close', () => { if (!settled) done(new Error('Koneksi ke layanan TTS terputus sebelum selesai')); });
    });
}

// Sintesis beberapa segmen berurutan lalu digabung jadi 1 Buffer MP3.
// Concat mentah frame MPEG audio spt ini adalah teknik umum & didukung baik
// oleh browser/pemutar audio utk playback berurutan (bukan re-encode, jadi
// prosesnya cepat & tidak butuh ffmpeg).
async function synthesizeSegments(segments) {
    if (!Array.isArray(segments) || !segments.length) throw new Error('Tidak ada segmen teks utk digenerate');
    if (segments.length > 30) throw new Error('Maksimal 30 bagian teks per audio');
    const buffers = [];
    for (const seg of segments) {
        buffers.push(await synthesizeSegment(seg));
    }
    return Buffer.concat(buffers);
}

module.exports = { VOICE_CATALOG, synthesizeSegment, synthesizeSegments };
