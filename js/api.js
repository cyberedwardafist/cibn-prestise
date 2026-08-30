/* =============================================
   API.JS - HTTP Client ke Backend
   Semua komunikasi dengan server.js
   ============================================= */

const API_BASE = window.location.origin + '/api';

// ── AUTH TOKEN ──
const Auth = {
    getToken: () => localStorage.getItem('cbn_token'),
    getUser: () => { try { return JSON.parse(localStorage.getItem('cbn_user')); } catch(e) { return null; } },
    setSession(token, user) { localStorage.setItem('cbn_token', token); localStorage.setItem('cbn_user', JSON.stringify(user)); },
    clearSession() { localStorage.removeItem('cbn_token'); localStorage.removeItem('cbn_user'); },
    isLoggedIn: () => !!localStorage.getItem('cbn_token')
};

// ── FETCH HELPER ──
// Catatan penting:
// - SEMUA kegagalan (baik gagal terhubung ke server/jaringan putus, maupun error
//   400/401/403/404/500 dst dari server) sekarang SELALU dilempar sebagai Error (throw).
//   Sebelumnya kegagalan jaringan diam-diam di-"return null" dan dianggap "offline",
//   lalu kode pemanggil punya fallback ke localStorage yang membuat tombol simpan/
//   hapus/dsb terlihat "Berhasil ✅" padahal data sesungguhnya TIDAK pernah sampai ke
//   database server — hanya nyangkut di localStorage browser admin yang bersangkutan
//   (tidak terlihat admin lain/Review/siswa, dan hilang kalau cache dibersihkan).
//   Ini adalah akar masalah utama dari kasus "notifikasi berhasil tapi DB tidak berubah".
// - Sekarang: kalau koneksi ke server benar-benar gagal, apiFetch throw Error dengan
//   pesan yang jelas, supaya kode pemanggil (yang sudah punya try/catch) menampilkan
//   pesan GAGAL yang jujur ke user — bukan pura-pura berhasil.
async function apiFetch(path, options = {}) {
    const token = Auth.getToken();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res;
    try {
        res = await fetch(API_BASE + path, { ...options, headers });
    } catch (networkErr) {
        // Gagal total menghubungi server (mati/offline/tidak terjangkau) → JANGAN pura-pura
        // sukses. Lempar error yang jelas supaya caller menampilkan pesan gagal ke user.
        console.error('[API] Gagal terhubung ke server:', networkErr.message);
        throw new Error('Tidak bisa terhubung ke server. Periksa koneksi internet Anda dan coba lagi.');
    }

    let data = null;
    try { data = await res.json(); } catch (parseErr) { /* body kosong / bukan JSON */ }

    if (!res.ok) {
        // Sesi tidak valid/kadaluarsa → bersihkan session & arahkan ke halaman login
        // supaya user tahu kenapa data tiba-tiba kosong / tombol tidak merespons.
        if (res.status === 401) {
            Auth.clearSession();
            if (!location.pathname.endsWith('login.html')) {
                showToastSafe('Sesi berakhir, silakan login kembali', 'danger');
                setTimeout(() => { location.href = 'login.html'; }, 1200);
            }
        }
        throw new Error((data && data.error) || `HTTP ${res.status}`);
    }
    return data;
}

// showToast mungkin belum ter-load di semua halaman (mis. ujian.html) — helper aman.
function showToastSafe(msg, type) {
    if (typeof showToast === 'function') { try { showToast(msg, type); } catch (e) {} }
}

async function apiPost(path, body) { return apiFetch(path, { method: 'POST', body: JSON.stringify(body) }); }
async function apiPut(path, body) { return apiFetch(path, { method: 'PUT', body: JSON.stringify(body) }); }
async function apiDel(path) { return apiFetch(path, { method: 'DELETE' }); }
async function apiGet(path) { return apiFetch(path); }

// ── UPLOAD IMAGE ──
// Mengembalikan salah satu dari:
//   { url }             -> sukses
//   { error, rejected }  -> server menolak (tipe file salah / ukuran > limit) -> JANGAN fallback ke base64
//   { networkError }    -> gagal terhubung ke server (offline dll) -> caller boleh fallback ke base64
async function apiUploadImage(file) {
    const token = Auth.getToken();
    const form = new FormData();
    form.append('image', file);
    let res;
    try {
        res = await fetch(API_BASE + '/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: form
        });
    } catch (e) {
        return { networkError: true };
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* ignore */ }
    if (!res.ok) {
        return { error: (data && data.error) || `HTTP ${res.status}`, rejected: true };
    }
    return data || { networkError: true };
}

// ── UPLOAD LANDING MEDIA (Editor Landing: Logo Hero, Video Hero, Video Promo) ──
// kind  : 'image' (logo) atau 'video' (video latar)
// slot  : nama slot ('heroLogo' | 'heroVideo' | 'videoPromo') — dipakai sbg nama file di Supabase
// oldUrl: URL file lama (kalau ada) supaya server sekalian menghapusnya dari Supabase Storage
async function apiUploadLandingMedia(file, kind, slot, oldUrl) {
    const token = Auth.getToken();
    const form = new FormData();
    form.append('file', file);
    const qs = new URLSearchParams({ kind: kind === 'video' ? 'video' : 'image', slot: slot || 'media' });
    if (oldUrl) qs.set('oldUrl', oldUrl);
    let res;
    try {
        res = await fetch(API_BASE + '/upload-landing?' + qs.toString(), {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: form
        });
    } catch (e) {
        return { networkError: true };
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* ignore */ }
    if (!res.ok) {
        return { error: (data && data.error) || `HTTP ${res.status}`, rejected: true };
    }
    return data || { networkError: true };
}

// ── AUTH API ──
const AuthAPI = {
    async login(email, password) { return apiPost('/login', { email, password }); },
    async signup(nama, email, password) { return apiPost('/signup', { nama, email, password }); }
};

// ── USERS API ──
const UsersAPI = {
    async getByRole(role) { return await apiGet(`/users/${role}`); },
    async create(data) { return await apiPost('/users', data); },
    async update(kode, data) { return await apiPut(`/users/${kode}`, data); },
    async bulkUpdate(kodes, data) { return apiPut('/users/bulk', { kodes, data }); },
    async bulkDelete(kodes) { return apiFetch('/users/bulk', { method: 'DELETE', body: JSON.stringify({ kodes }) }); },
    async delete(kode) { return await apiDel(`/users/${kode}`); },
    async getSignupRequests() { return await apiGet('/signup-requests') || []; },
    async approveSignup(id) { return await apiPost(`/signup-requests/${id}/approve`, {}); },
    async rejectSignup(id) { return await apiDel(`/signup-requests/${id}`); }
};

// ── PAKET REQUESTS API (aktivasi paket landing baru — akun sudah aktif,
//    tinggal paketnya yang menunggu verifikasi pembayaran oleh admin) ──
const PaketRequestsAPI = {
    async getAll() { return await apiGet('/paket-requests') || []; },
    async approve(kode) { return await apiPost(`/paket-requests/${kode}/approve`, {}); },
    async reject(kode) { return await apiDel(`/paket-requests/${kode}`); }
};

// ── GRUBS API ──
const GrubsAPI = {
    async getAll() { return await apiGet('/grubs'); },
    async create(nama) { return await apiPost('/grubs', { nama }); },
    async update(kode, nama) { return await apiPut(`/grubs/${kode}`, { nama }); },
    async delete(kode) { return await apiDel(`/grubs/${kode}`); }
};

// ── PAKET TEMPLATE API ──
const PaketAPI = {
    async getAll() { return await apiGet('/pakets'); },
    async getOne(kode) { return await apiGet(`/pakets/${kode}`); },
    async create(data) { return await apiPost('/pakets', data); },
    async update(kode, data) { return await apiPut(`/pakets/${kode}`, data); },
    async delete(kode) { return await apiDel(`/pakets/${kode}`); }
};

// ── USER PAKET API (assign paket ke user) ──
const UserPaketAPI = {
    // Ambil semua paket milik user
    async getByUser(user_kode) { return await apiGet(`/users/${user_kode}/pakets`) || []; },
    // Beli / assign paket ke user
    // data: { paket_kode } atau { paket_nama_custom, periode_tipe, periode_custom_hari }
    async assign(user_kode, data) { return await apiPost(`/users/${user_kode}/pakets`, data); },
    // Hapus satu entri paket user
    async delete(user_kode, up_kode) { return await apiDel(`/users/${user_kode}/pakets/${up_kode}`); }
};

// ── NOTIFIKASI API ──
const NotifikasiAPI = {
    async getExpiredSoon() { return await apiGet('/notifikasi/expired-soon') || []; }
};

// ── SOAL API ──
const SoalAPI = {
    async getAll() { return await apiGet('/soal'); },
    async getOne(kode) { return await apiGet(`/soal/${kode}`); },
    async create(data) { return await apiPost('/soal', data); },
    async update(kode, data) { return await apiPut(`/soal/${kode}`, data); },
    async delete(kode) { return await apiDel(`/soal/${kode}`); }
};

// ── SOAL KELOMPOK API (dikelola di Buat Soal / Library — opsional) ──
const SoalKelompokAPI = {
    async getAll() { return await apiGet('/soal-kelompok') || []; },
    async create(data) { return await apiPost('/soal-kelompok', data); },
    async update(kode, data) { return await apiPut(`/soal-kelompok/${kode}`, data); },
    async delete(kode) { return await apiDel(`/soal-kelompok/${kode}`); }
};

// ── MODUL API ──
const ModulAPI = {
    async getAll() { return await apiGet('/modul'); },
    async create(data) { return await apiPost('/modul', data); },
    async update(kode, data) { return await apiPut(`/modul/${kode}`, data); },
    async delete(kode) { return await apiDel(`/modul/${kode}`); }
};

// ── MODUL KELOMPOK API (dikelola di Manajemen Modul — opsional) ──
const ModulKelompokAPI = {
    async getAll() { return await apiGet('/modul-kelompok') || []; },
    async create(data) { return await apiPost('/modul-kelompok', data); },
    async update(kode, data) { return await apiPut(`/modul-kelompok/${kode}`, data); },
    async delete(kode) { return await apiDel(`/modul-kelompok/${kode}`); }
};

// ── EBOOK UPLOAD HELPER (multipart: poster gambar + file pdf) ──
// Beda dari apiFetch biasa karena body-nya FormData, bukan JSON.
// Mengembalikan: data hasil (sukses) | throw Error (gagal terhubung ATAU ditolak server).
// Fitur e-book butuh koneksi server (file PDF tidak realistis disimpan lokal), jadi
// kegagalan jaringan di sini juga selalu dilempar sebagai error, bukan diam-diam gagal.
async function apiEbookSubmit(method, path, formData) {
    const token = Auth.getToken();
    let res;
    try {
        res = await fetch(API_BASE + path, { method, headers: { 'Authorization': `Bearer ${token}` }, body: formData });
    } catch (e) {
        throw new Error('Tidak bisa terhubung ke server. Periksa koneksi internet Anda dan coba lagi.');
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* body kosong */ }
    if (!res.ok) {
        if (res.status === 401) {
            Auth.clearSession();
            if (!location.pathname.endsWith('login.html')) {
                showToastSafe('Sesi berakhir, silakan login kembali', 'danger');
                setTimeout(() => { location.href = 'login.html'; }, 1200);
            }
        }
        throw new Error((data && data.error) || `HTTP ${res.status}`);
    }
    return data;
}

// ── EBOOK KELOMPOK API (dikelola di Library, opsional) ──
const EbookKelompokAPI = {
    async getAll() { return await apiGet('/ebook-kelompok') || []; },
    async create(data) { return await apiPost('/ebook-kelompok', data); },
    async update(kode, data) { return await apiPut(`/ebook-kelompok/${kode}`, data); },
    async delete(kode) { return await apiDel(`/ebook-kelompok/${kode}`); }
};

// ── EBOOK API ──
const EbookAPI = {
    async getAll() { return await apiGet('/ebook') || []; },
    async create(formData) { return await apiEbookSubmit('POST', '/ebook', formData); },
    async update(kode, formData) { return await apiEbookSubmit('PUT', `/ebook/${kode}`, formData); },
    async delete(kode) { return await apiDel(`/ebook/${kode}`); }
};

// ── EBOOK MODUL API (paket buku) ──
const EbookModulAPI = {
    async getAll() { return await apiGet('/ebook-modul') || []; },
    async create(formData) { return await apiEbookSubmit('POST', '/ebook-modul', formData); },
    async update(kode, formData) { return await apiEbookSubmit('PUT', `/ebook-modul/${kode}`, formData); },
    async delete(kode) { return await apiDel(`/ebook-modul/${kode}`); }
};

// ── EBOOK MODUL KELOMPOK API (dikelola di Modul E-Book — opsional) ──
const EbookModulKelompokAPI = {
    async getAll() { return await apiGet('/ebook-modul-kelompok') || []; },
    async create(data) { return await apiPost('/ebook-modul-kelompok', data); },
    async update(kode, data) { return await apiPut(`/ebook-modul-kelompok/${kode}`, data); },
    async delete(kode) { return await apiDel(`/ebook-modul-kelompok/${kode}`); }
};

// ── TOKENS API ──
const TokensAPI = {
    async getAll() { return await apiGet('/tokens'); },
    async getUsed() { return await apiGet('/tokens/used'); },
    async generate(data) { const res = await apiPost('/tokens/generate', data); return res || []; },
    async delete(kode) { return await apiDel(`/tokens/${kode}`); },
    async getGrubList() { return await apiGet('/tokens/grub-list') || []; }
};

// ── LAPORAN API ──
const LaporanAPI = {
    async getAll() { return await apiGet('/laporan'); },
    async getByUser(user_kode) { return await apiGet(`/review/laporan/${user_kode}`) || []; },
    async create(data) { return await apiPost('/laporan', data); }
};

// ── LANDING API ──
const LandingAPI = {
    async get() { return await apiGet('/landing'); },
    async save(data) { return await apiPut('/landing', data); }
};

// ── EXAM API ──
const ExamAPI = {
    async validateToken(kode) { return await apiFetch('/exam/validate-token', { method:'POST', body: JSON.stringify({kode}) }); },
    async submit(data) { return await apiFetch('/exam/submit', { method:'POST', body: JSON.stringify(data) }); },
    async getRiwayat() { return await apiGet('/user/riwayat') || []; },
    async getRiwayatDetail(kode) { return await apiGet('/user/riwayat/'+kode) || null; }
};

// ── ME API ──
const MeAPI = {
    async update(data) { return await apiPut('/me', data); }
};

// ── REVIEW API ──
const ReviewAPI = {
    async getUsers() { return await apiGet('/review/users'); },
    async getLaporanUser(kode) { return await apiGet(`/review/laporan/${kode}`) || []; }
};
