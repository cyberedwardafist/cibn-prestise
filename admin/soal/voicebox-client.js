/* =============================================================================
   voicebox-client.js — klien BROWSER (bukan server.js) untuk server voicebox
   yang jalan LOKAL di komputer admin (default http://127.0.0.1:17493, lihat
   voicebox/voicebox/backend). Dipakai sebagai sumber suara ke-2 (di samping
   Edge TTS gratis yang sudah ada di lib/edge-tts.js) untuk fitur
   "🎙️ Generate Suara" di soal.js — engine VoxCPM2 (voicebox/VoxCPM), yang
   didaftarkan sebagai engine baru "voxcpm" di backend voicebox (lihat
   backends/voxcpm_backend.py).

   KENAPA DIPANGGIL LANGSUNG DARI BROWSER, BUKAN LEWAT server.js (spt Edge
   TTS)? Karena server.js kita deploy di Vercel (serverless, tanpa GPU, tanpa
   proses yang hidup lama) — model TTS neural sekelas VoxCPM2 (2B parameter)
   TIDAK BISA jalan di sana. Jadi generation-nya jalan di server voicebox
   LOKAL milik admin (browser admin -> http://127.0.0.1:xxxxx langsung),
   TAPI hasil akhirnya (file MP3/WAV) tetap di-upload lewat jalur upload yang
   SAMA PERSIS dengan upload manual/Edge TTS (apiUploadAudio -> /api/upload-init
   -> Supabase Storage), jadi asetnya tetap "ada di" backend yang sama dengan
   sisa aplikasi, walau proses generate-nya jalan di mesin admin.

   Server voicebox WAJIB jalan dengan CORS mengizinkan origin situs ini, mis.:
     VOICEBOX_CORS_ORIGINS=https://nama-domain-vercel-kamu.vercel.app \
       python -m backend.main --host 127.0.0.1 --port 17493
   (voicebox/voicebox/backend/app.py juga sudah dipatch supaya otomatis
   membalas header Private-Network-Access yang diwajibkan Chrome saat situs
   HTTPS memanggil alamat lokal/loopback seperti 127.0.0.1.)
   ============================================================================= */

const VoiceboxClient = (() => {
    const STORAGE_KEY = 'cbn_voicebox_url';
    const DEFAULT_URL = 'http://127.0.0.1:17493';
    const POLL_INTERVAL_MS = 1200;
    const POLL_TIMEOUT_MS = 5 * 60 * 1000; // model besar + CPU bisa lama, kasih 5 menit

    function getBaseUrl() {
        return (localStorage.getItem(STORAGE_KEY) || DEFAULT_URL).replace(/\/+$/, '');
    }
    function setBaseUrl(url) {
        localStorage.setItem(STORAGE_KEY, String(url || '').trim().replace(/\/+$/, '') || DEFAULT_URL);
    }

    async function _fetchJson(path, opts) {
        let res;
        try {
            res = await fetch(getBaseUrl() + path, opts);
        } catch (e) {
            throw new Error(
                'Tidak bisa terhubung ke server voicebox lokal di ' + getBaseUrl() +
                ' — pastikan server sudah dijalankan (python -m backend.main) dan CORS-nya mengizinkan situs ini.'
            );
        }
        if (!res.ok) {
            let msg = `Server voicebox membalas error (HTTP ${res.status})`;
            try { const j = await res.json(); if (j && j.detail) msg = j.detail; } catch (e) {}
            throw new Error(msg);
        }
        return res.json();
    }

    async function testConnection() {
        const data = await _fetchJson('/health', { method: 'GET' });
        return data;
    }

    // Daftar voice profile yang sudah dibuat admin di aplikasi voicebox
    // (cloning dari rekaman singkat, ATAU "voice design" dari deskripsi teks —
    // dua-duanya dikelola lewat UI voicebox sendiri, bukan dari sini).
    // Filter engine opsional (mis. 'voxcpm').
    async function listProfiles(engineFilter) {
        const list = await _fetchJson('/profiles', { method: 'GET' });
        if (!Array.isArray(list)) return [];
        if (!engineFilter) return list;
        return list.filter(p => {
            if (p.voice_type === 'preset') return p.preset_engine === engineFilter;
            if (p.voice_type === 'designed') return true; // designed profile bebas dipakai engine mana saja
            return p.default_engine ? p.default_engine === engineFilter : true;
        });
    }

    function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // Minta generate 1 segmen teks -> tunggu sampai selesai -> balikin Blob audio.
    // opts: { profileId, text, engine ('voxcpm'), instruct, seed, language ('en') }
    async function generateAndWait(opts) {
        const body = {
            profile_id: opts.profileId,
            text: opts.text,
            engine: opts.engine || 'voxcpm',
            language: opts.language || 'en',
        };
        if (opts.instruct) body.instruct = opts.instruct;
        if (opts.seed != null) body.seed = opts.seed;

        const gen = await _fetchJson('/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const genId = gen.id;
        const startedAt = Date.now();
        while (true) {
            if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
                throw new Error('Generate suara lokal timeout (>5 menit) — model mungkin masih loading pertama kali, coba lagi.');
            }
            await _sleep(POLL_INTERVAL_MS);
            const status = await _fetchJson('/history/' + encodeURIComponent(genId), { method: 'GET' });
            if (status.status === 'completed') break;
            if (status.status === 'failed') throw new Error(status.error || 'Generate suara gagal di server voicebox');
            // status lain (generating/loading_model/queued dsb) -> lanjut poll
        }

        const audioRes = await fetch(getBaseUrl() + '/audio/' + encodeURIComponent(genId));
        if (!audioRes.ok) throw new Error('Gagal mengambil hasil audio dari server voicebox (HTTP ' + audioRes.status + ')');
        return audioRes.blob();
    }

    // ── Modal pengaturan sederhana (alamat server + tombol tes koneksi) ──────
    function openSettingsModal() {
        const existing = document.getElementById('voicebox-settings-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'voicebox-settings-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(19,50,89,0.35);display:flex;align-items:center;justify-content:center;padding:16px';
        overlay.innerHTML = `
        <div class="card" style="max-width:420px;width:100%;padding:20px">
            <div style="font-weight:700;font-size:15px;margin-bottom:4px">⚙️ Server Voicebox Lokal</div>
            <div style="font-size:12px;color:var(--text-sub);margin-bottom:12px">
                Alamat server voicebox yang jalan di komputer ini (python -m backend.main).
                Generate suara VoxCPM2 dipanggil langsung dari browser ke alamat ini,
                hasilnya baru diupload ke server aplikasi seperti biasa.
            </div>
            <input id="voicebox-url-input" class="form-input" type="text" style="margin-bottom:10px" value="${getBaseUrl()}" placeholder="http://127.0.0.1:17493">
            <div id="voicebox-test-result" style="font-size:12px;margin-bottom:10px;min-height:16px"></div>
            <div style="display:flex;gap:8px;justify-content:flex-end">
                <button class="btn btn-secondary btn-sm" onclick="document.getElementById('voicebox-settings-overlay').remove()">Batal</button>
                <button class="btn btn-secondary btn-sm" id="voicebox-test-btn">Tes Koneksi</button>
                <button class="btn btn-primary btn-sm" id="voicebox-save-btn">Simpan</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);

        document.getElementById('voicebox-test-btn').onclick = async () => {
            const el = document.getElementById('voicebox-test-result');
            const url = document.getElementById('voicebox-url-input').value.trim();
            setBaseUrl(url);
            el.textContent = 'Menghubungi server...';
            el.style.color = 'var(--text-sub)';
            try {
                await testConnection();
                el.textContent = '✓ Terhubung ke server voicebox';
                el.style.color = 'var(--green, #1a8a4a)';
            } catch (e) {
                el.textContent = '✕ ' + (e.message || 'Gagal terhubung');
                el.style.color = 'var(--red, #c0392b)';
            }
        };
        document.getElementById('voicebox-save-btn').onclick = () => {
            setBaseUrl(document.getElementById('voicebox-url-input').value.trim());
            overlay.remove();
            if (typeof showToast === 'function') showToast('Alamat server voicebox disimpan', 'success');
        };
    }

    return { getBaseUrl, setBaseUrl, testConnection, listProfiles, generateAndWait, openSettingsModal };
})();
