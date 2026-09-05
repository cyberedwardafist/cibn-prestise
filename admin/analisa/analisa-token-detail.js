// admin/analisa/analisa-token-detail.js
// Halaman detail Analisa untuk 1 GRUP TOKEN — dibuka dari admin/analisa/analisa-token.js
// lewat openAnalisaTokenDetail(namaGrup). File ini SENGAJA dipisah dari analisa-token.js
// dan TIDAK didaftarkan sebagai item di SIDE_DOCK_GROUPS.analisa (lihat
// admin/index_admin.html): begitu halaman ini aktif, panel slide-dock ANALISA
// otomatis tertutup (groupForPage() tidak menemukan grupnya), dan tombol panah
// kembali di atas yang membawa balik ke page-analisa-token — yang otomatis
// membuka lagi panel slide-dock-nya.
//
// window._analisaTokenDetailGrup = nama grup yang diklik.
// window._analisaTokenDetailItems = seluruh token mentah dalam grup itu (siap
// dipakai untuk analisa lebih lanjut per modul/per akun, dst).
//
// ── GRAFIK PER SOAL (bagian baru, MASIH DATA DUMMY — belum ditarik dari
// jawaban asli) ──────────────────────────────────────────────────────────
// Prototipe grafik GARIS (line chart), murni SVG + CSS sendiri (css/chart.css),
// tanpa library chart eksternal apapun:
//
//  1) Tipe "Benar/Salah" (soal dinilai otomatis, mis. pilihan ganda):
//     x = nomor urut soal (urutan asli dibuat admin, BUKAN urutan acak saat
//     ujian — jadi soal no.3 di sini selalu soal yg sama walau saat ujian
//     tampil di posisi acak berbeda utk tiap peserta), y = jumlah jawaban,
//     2 garis per soal: hijau = Benar, merah = Salah.
//
//  2) Tipe "Nilai/Skor Sendiri" (soal dinilai reviewer, mis. uraian/essay
//     dgn skala nilai 0-5): x = nomor urut soal, y = jumlah jawaban (jumlah
//     orang), 1 garis berwarna per nilai yang muncul — warna
//     dipetakan tetap per nilai (legenda di bawah grafik), TINGGI titik garis =
//     banyaknya orang yang dapat nilai itu di tiap soal.
//
//  3) Tipe "Sikap Kerja" (kolom forced-choice, 4 dari 5 item ditampilkan, 1
//     "kunci" tersembunyi tiap soal — lihat admin/soal/soal.js generateKolomSoal
//     & ujian/hasil.js hitungHasil): grafik individual per-peserta untuk tipe
//     ini SUDAH ADA di hasil.js (per kolom K1-K10: Dijawab/Benar/Salah, 1
//     peserta). Di ANALISA GRUP ini datanya beda tujuan: bukan 1 peserta, tapi
//     SEBARAN nilai SELURUH PESERTA dalam grup token itu per kolom — bukan 1
//     angka agregat spt versi lama, tapi per kombinasi (kolom, nilai) berapa
//     ORANG yang dapat nilai itu (mis. di kolom 1 ada 4 orang dapat Benar=10).
//     Tiap kombinasi digambar sbg bola kecil berlabel jumlah orang, lalu
//     ditarik garis MEDIAN (bukan rata-rata — supaya tahan thd nilai ekstrem/
//     outlier, mis. 1 orang jatuh jauh di 1 kolom tidak menyeret garis turun
//     jauh spt rata-rata) yang menyambung tiap kolom per kategori. 3 kategori:
//     hijau = Benar, merah = Salah, biru = Jumlah Dijawab (Benar+Salah orang
//     itu di kolom tsb) — pola makin ke kolom belakang makin turun/berat ke
//     Salah jadi indikasi kelelahan/attention-drop kolektif grup.
//
// Interaksi: arahkan kursor (desktop) / sentuh (mobile) ke kolom soal mana
// pun -> muncul popup dekat kursor/titik sentuh. Utk tipe Benar/Salah & Nilai/
// Skor: diagram lingkaran (persen tiap kategori). Utk tipe Sikap Kerja: panel
// ringkas median + rentang + jumlah orang per kategori (bukan pie, krn di sini
// datanya sebaran per kategori, bukan proporsi dari 1 total yang sama).
// Sentuh/klik di luar popup menutupnya.
//
// Data & pemetaan warna di bawah ini 100% dummy untuk contoh visual — saat
// nanti disambung ke data asli, cukup ganti _ATD_DUMMY_BINARY / _ATD_DUMMY_SKOR
// / _ATD_DUMMY_SIKAP_RAW dengan hasil agregasi jawaban sungguhan per grup.

function renderAnalisaTokenDetail() {
    const grup = window._analisaTokenDetailGrup || null;
    const items = window._analisaTokenDetailItems || [];
    const sub = document.getElementById('atd-kode-sub');
    if (sub) sub.textContent = grup ? `Grup: ${grup} (${items.length} token)` : '-';
    _atdRenderRingkasan(grup, items);
    _atdRenderPeserta(grup, items);
    _atdRenderDummyCharts();
}

function _atdEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }

// ── RINGKASAN GRUP: jumlah token dibuat/terpakai/hangus + modul & soal yang
// dipakai grup ini — ditaruh di #atd-content. "Hangus" = token yang TIDAK
// pernah dipakai (t._dipakai falsy) TAPI sudah lewat tanggal expired-nya
// (sama seperti definisi status "Kadaluarsa" di daftar grup / analisa-token.js).
async function _atdRenderRingkasan(grup, items) {
    const el = document.getElementById('atd-content');
    if (!el) return;
    if (!grup || !items.length) { el.innerHTML = '<div class="empty-state"><p>Analisa untuk grup ini akan segera hadir</p></div>'; return; }

    const now = Date.now();
    const total = items.length;
    const used = items.filter(t => t._dipakai).length;
    const hangus = items.filter(t => !t._dipakai && t.expired && new Date(t.expired).getTime() < now).length;

    // Modul yang dipakai grup ini (bisa lebih dari 1 kalau token digenerate dari
    // modul berbeda-beda dalam 1 grup) — dikumpulkan dari modul_kode/modul_nama
    // yang menempel di tiap token.
    const modulMap = {};
    items.forEach(t => {
        const kode = t.modul_kode; if (!kode) return;
        if (!modulMap[kode]) modulMap[kode] = t.modul_nama || t.modul_kode;
    });
    const modulKodes = Object.keys(modulMap);

    let modulSoalHtml = '<div class="empty-state" style="padding:16px"><p>Belum ada modul yang tertaut ke token grup ini</p></div>';
    if (modulKodes.length) {
        const [modulList, soalList] = await Promise.all([
            ModulAPI.getAll().catch(() => []),
            SoalAPI.getAll().catch(() => [])
        ]);
        const soalByKode = {};
        (soalList || []).forEach(s => { soalByKode[s.kode] = s.nama || s.kode; });
        const modulByKode = {};
        (modulList || []).forEach(m => { modulByKode[m.kode] = m; });

        modulSoalHtml = modulKodes.map(kode => {
            const m = modulByKode[kode];
            const namaModul = _atdEsc(modulMap[kode] || kode);
            const soalRows = (m && Array.isArray(m.soal_list) && m.soal_list.length)
                ? m.soal_list.map((sl, i) => `<div class="atd-soal-row">${i + 1}. ${_atdEsc(soalByKode[sl.soal_kode] || sl.soal_kode)}</div>`).join('')
                : '<div class="atd-soal-row" style="opacity:.6">Modul ini belum berisi soal, atau modulnya sudah dihapus</div>';
            return `<div class="atd-modul-block">
                <div class="atd-modul-title">${namaModul} <span style="font-weight:400;color:var(--text-sub);font-size:11px">(${(m && m.soal_list ? m.soal_list.length : 0)} soal)</span></div>
                <div class="atd-soal-list">${soalRows}</div>
            </div>`;
        }).join('');
    }

    el.innerHTML = `
        <div class="section-title" style="font-size:16px;margin-bottom:14px">Ringkasan Grup</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin-bottom:18px">
            <div class="stat-card" style="cursor:default">
                <div class="stat-icon accent"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
                <div class="stat-num">${total}</div>
                <div class="stat-label">Token Dibuat</div>
            </div>
            <div class="stat-card" style="cursor:default">
                <div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polyline points="20 6 9 17 4 12"/></svg></div>
                <div class="stat-num">${used}</div>
                <div class="stat-label">Token Terpakai</div>
            </div>
            <div class="stat-card" style="cursor:default">
                <div class="stat-icon" style="background:rgba(220,38,38,.12);color:#dc2626"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
                <div class="stat-num">${hangus}</div>
                <div class="stat-label">Token Hangus</div>
            </div>
        </div>
        <div style="font-size:13px;font-weight:700;color:var(--blue);margin-bottom:8px">Modul &amp; Soal yang Digunakan</div>
        <div class="atd-modul-wrap">${modulSoalHtml}</div>
    `;
}

// ── PESERTA: daftar akun yang memakai token di grup ini. Kartu ini bisa
// diklik (header) untuk buka/tutup daftarnya ke bawah — tiap baris
// menampilkan nama akun + grup asal tokennya (di halaman ini semua peserta
// otomatis dari grup yang sama, karena "items" sudah difilter per grup sejak
// openAnalisaTokenDetail() di analisa-token.js).
function _atdRenderPeserta(grup, items) {
    const el = document.getElementById('atd-peserta-card');
    if (!el) return;
    if (!grup) { el.innerHTML = '<div class="empty-state"><p>Data peserta akan segera hadir</p></div>'; return; }

    const peserta = items.filter(t => t._dipakai).map(t => ({
        nama: t.user_nama || t.digunakan_oleh || 'Akun tidak diketahui',
        grup: grup,
        skor: (t.skor === null || t.skor === undefined) ? null : t.skor,
        selesai: t.tgl_selesai || null
    }));

    const rows = peserta.length
        ? peserta.map(p => `<div class="atd-peserta-row">
                <div class="atd-peserta-nama">${_atdEsc(p.nama)}</div>
                <div class="atd-peserta-grup"><span class="history-badge" style="background:rgba(19,50,89,.08);color:var(--text-sub)">${_atdEsc(p.grup)}</span></div>
                <div class="atd-peserta-skor">${p.skor !== null ? 'Skor ' + p.skor : '-'}</div>
            </div>`).join('')
        : '<div class="empty-state" style="padding:16px"><p>Belum ada akun yang memakai token grup ini</p></div>';

    el.innerHTML = `
        <div class="atd-peserta-header" onclick="_atdTogglePeserta()">
            <div>
                <div class="section-title" style="font-size:16px;margin-bottom:2px">Peserta</div>
                <div class="section-sub" style="margin-bottom:0">${peserta.length} akun menggunakan token grup ini</div>
            </div>
            <svg class="atd-peserta-chevron" id="atd-peserta-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="transition:transform .2s"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="atd-peserta-list" id="atd-peserta-list" style="display:none">${rows}</div>
    `;
}

function _atdTogglePeserta() {
    const list = document.getElementById('atd-peserta-list');
    const chev = document.getElementById('atd-peserta-chevron');
    if (!list) return;
    const willOpen = list.style.display === 'none';
    list.style.display = willOpen ? 'block' : 'none';
    if (chev) chev.style.transform = willOpen ? 'rotate(180deg)' : '';
}

// ── DATA DUMMY ──────────────────────────────────────────────────────────
const _ATD_DUMMY_BINARY = [
    { nomor: 1, benar: 15, salah: 5 },
    { nomor: 2, benar: 8,  salah: 12 },
    { nomor: 3, benar: 18, salah: 2 },
    { nomor: 4, benar: 10, salah: 10 },
    { nomor: 5, benar: 4,  salah: 16 },
    { nomor: 6, benar: 13, salah: 7 }
];

const _ATD_DUMMY_SKOR = [
    // Tiap soal: 5 pilihan (A-E), TIAP OPSI py nilai & jumlah pemilihnya sendiri.
    // Skenario nyata: cuma 1 opsi yg bernilai (mis. 5), 4 opsi lain nilainya 0 —
    // posisi opsi yg bernilai sengaja beda-beda tiap soal (spt soal asli, kunci
    // jawaban tdk selalu di huruf yg sama).
    { nomor: 1, opsi: [ {nilai:0,jumlah:3}, {nilai:0,jumlah:2}, {nilai:5,jumlah:8}, {nilai:0,jumlah:1}, {nilai:0,jumlah:1} ] },
    { nomor: 2, opsi: [ {nilai:5,jumlah:5}, {nilai:0,jumlah:6}, {nilai:0,jumlah:2}, {nilai:0,jumlah:1}, {nilai:0,jumlah:1} ] },
    { nomor: 3, opsi: [ {nilai:0,jumlah:2}, {nilai:5,jumlah:11}, {nilai:0,jumlah:1}, {nilai:0,jumlah:1}, {nilai:0,jumlah:0} ] },
    { nomor: 4, opsi: [ {nilai:0,jumlah:4}, {nilai:0,jumlah:3}, {nilai:0,jumlah:2}, {nilai:5,jumlah:4}, {nilai:0,jumlah:2} ] },
    { nomor: 5, opsi: [ {nilai:5,jumlah:9}, {nilai:0,jumlah:2}, {nilai:0,jumlah:2}, {nilai:0,jumlah:1}, {nilai:0,jumlah:1} ] }
];

// Warna "keluarga nilai 0" — dipakai bergantian saat lebih dari 1 opsi sama2
// bernilai 0 di posisi (slot) berbeda, supaya opsi2 itu TETAP kebeda walau
// labelnya sama2 "Nilai 0" (bukan digabung jadi 1 garis/1 warna).
const _ATD_SKOR_ZERO_PALETTE = ['#dc2626','#f97316','#eab308','#a855f7','#0891b2','#db2777','#64748b'];
const _ATD_SKOR_NONZERO_PALETTE = ['#2666b8','#16a34a','#9333ea','#0891b2','#d97706'];
let _atdSkorSeriesMeta = [];      // [{label,color}] per slot, urut sesuai series grafik
let _atdSkorSortedPerSoal = [];   // per soal: opsi diurutkan sesuai slot yg sama dgn series (utk popup)

// Dummy: 10 kolom x 15 "peserta", per peserta { benar, salah } (dijawab =
// benar+salah). Deterministic (seed tetap, bukan Math.random()) supaya hasil
// sama tiap reload — cuma demo visual, BUKAN data acak sungguhan. Dipola makin
// ke kolom belakang makin banyak Salah (rasio benar turun) — demo pola
// kelelahan kolektif grup.
function _atdGenSikapRaw() {
    const N_PESERTA = 15, N_KOLOM = 10, ITEM_PER_KOLOM = 12; // skala nilai 0–12 per kolom
    let seed = 7;
    const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
    const raw = [];
    for (let k = 0; k < N_KOLOM; k++) {
        const fatigue = k / (N_KOLOM - 1); // 0 (kolom awal) → 1 (kolom akhir)
        const benarRatioBase = 0.9 - fatigue * 0.5; // makin belakang makin banyak salah
        const dijawabBase = ITEM_PER_KOLOM - Math.round(fatigue * 2); // sedikit makin jarang dijawab penuh
        const rows = [];
        for (let p = 0; p < N_PESERTA; p++) {
            const dijawab = Math.max(4, dijawabBase - Math.round(rnd() * 3));
            const ratio = Math.min(1, Math.max(0, benarRatioBase + (rnd() - 0.5) * 0.35));
            const benar = Math.round(dijawab * ratio);
            rows.push({ benar, salah: dijawab - benar });
        }
        raw.push(rows);
    }
    // Kolom 8 (indeks 7): suntik 1 outlier rendah — contoh "median tahan
    // outlier" (kebanyakan peserta lain tetap tinggi, 1 orang jatuh jauh,
    // garis median tidak ikut terseret turun spt kalau pakai rata-rata).
    raw[7][0] = { benar: 2, salah: 8 };
    return raw;
}
const _ATD_DUMMY_SIKAP_RAW = _atdGenSikapRaw();

function _atdDistFromRaw(raw, pick) {
    return raw.map(rows => {
        const dist = {};
        rows.forEach(row => { const v = pick(row); dist[v] = (dist[v] || 0) + 1; });
        return dist;
    });
}

// Median tertimbang dari peta {nilai: jumlah_orang}. Kalau total orang genap,
// median = rata-rata 2 nilai tengah (definisi median standar) — BUKAN
// rata-rata SEMUA nilai, jadi tetap tahan thd outlier di ujung sebaran.
function _atdWeightedMedian(dist) {
    const entries = Object.entries(dist).map(([v, c]) => [Number(v), c]).filter(([, c]) => c > 0).sort((a, b) => a[0] - b[0]);
    const total = entries.reduce((s, [, c]) => s + c, 0);
    if (!total) return 0;
    const targetLow = Math.ceil(total / 2);
    const targetHigh = Math.floor(total / 2) + 1;
    let cum = 0, low = null, high = null;
    for (const [v, c] of entries) {
        cum += c;
        if (low === null && cum >= targetLow) low = v;
        if (high === null && cum >= targetHigh) high = v;
    }
    return (low + high) / 2;
}

// Disimpan supaya popup (_atdRenderSikapStatPopup) bisa baca ulang tanpa
// hitung ulang dari _ATD_DUMMY_SIKAP_RAW tiap hover.
let _atdSikapDist = [];  // [{label,color,dist:[{nilai:jumlahOrang} per kolom]}]
let _atdSikapCats = [];  // ['K1','K2',...]

// ── HELPERS ──────────────────────────────────────────────────────────────
// Hitung tick sumbu-Y yg "rapi" (kelipatan 1/2/5/10 dst, menyesuaikan skala
// data) DAN posisinya persis di nilai aslinya — bukan dibagi rata jadi N
// bagian lalu labelnya dibulatkan (itu bikin garis yg dilabeli "7" misalnya
// bisa aja sebenarnya ada di nilai 7.5, jadi meleset kalau dibandingkan sama
// titik data yg beneran di nilai 7). targetCount = kira-kira berapa garis
// bantu yg diinginkan (bukan jumlah pasti, krn ikut dibulatkan ke kelipatan rapi).
// Hitung skala sumbu Y yg "rapi" (kelipatan 1/2/5/10 dst, BUKAN angka
// sembarang kayak 7.3) secara OTOMATIS menyesuaikan besar data — tidak
// dipatok ke jumlah garis tertentu. Aturannya: mulai dari step sekecil
// mungkin (1), lalu step dinaikkan ke kelipatan rapi berikutnya (1→2→5→10→
// 20→50→...) SELAMA jumlah garis yg dihasilkan masih lebih banyak dari
// MAX_TICKS. Jadi utk data kecil (mis. maxVal 12) tiap angka dpt garis
// sendiri (step 1), sedangkan utk data besar (mis. maxVal 300) step ikut
// membesar otomatis supaya sumbu Y tidak penuh sesak — jaraknya selalu
// menyesuaikan, bukan jumlah tick yg tetap.
function _atdNiceTicks(maxVal) {
    if (!isFinite(maxVal) || maxVal <= 0) maxVal = 1;
    const MAX_TICKS = 12; // batas atas garis bantu biar tetap enak dibaca
    let step = 1;
    while (maxVal / step > MAX_TICKS) {
        const mag = Math.pow(10, Math.floor(Math.log10(step)));
        const norm = step / mag;
        if (norm < 2) step = 2 * mag;
        else if (norm < 5) step = 5 * mag;
        else step = 10 * mag;
    }
    const niceMax = Math.ceil(maxVal / step) * step;
    const ticks = [];
    for (let v = 0; v <= niceMax + step * 0.001; v += step) ticks.push(Math.round(v * 100) / 100);
    return { max: niceMax, ticks };
}

// Bangun SERIES grafik per SLOT OPSI (bukan per nilai unik). Tiap soal
// diurutkan dulu dari nilai TERTINGGI ke TERENDAH (nilai sama -> jumlah
// pemilih lebih banyak duluan), lalu posisi urutan (slot) itulah yg jadi 1
// garis tetap di grafik. Efeknya: kalau 4 dari 5 opsi sama2 bernilai 0,
// TETAP jadi 4 garis terpisah (bukan digabung/dijumlah jadi 1 garis "Nilai
// 0"), masing2 warna beda — walau labelnya sama2 "Nilai 0", supaya dari
// grafik tetap kebaca itu opsi yg berbeda-beda.
function _atdBuildOpsiSeries(skorData) {
    const maxSlot = Math.max.apply(null, skorData.map(s => s.opsi.length));
    const sortedPerSoal = skorData.map(s => s.opsi.slice().sort((a, b) => b.nilai - a.nilai || b.jumlah - a.jumlah));
    let zeroIdx = 0, nonZeroIdx = 0;
    const series = [];
    for (let slot = 0; slot < maxSlot; slot++) {
        // Label slot ini pakai nilai yg paling sering muncul di slot tsb
        // (dummy: konsisten sama di semua soal, jadi cukup ambil salah satu).
        const nilaiCounts = {};
        sortedPerSoal.forEach(arr => { if (arr[slot]) nilaiCounts[arr[slot].nilai] = (nilaiCounts[arr[slot].nilai] || 0) + 1; });
        const nilaiLabel = Object.keys(nilaiCounts).sort((a, b) => nilaiCounts[b] - nilaiCounts[a])[0];
        const isZero = Number(nilaiLabel) === 0;
        const color = isZero
            ? _ATD_SKOR_ZERO_PALETTE[zeroIdx++ % _ATD_SKOR_ZERO_PALETTE.length]
            : _ATD_SKOR_NONZERO_PALETTE[nonZeroIdx++ % _ATD_SKOR_NONZERO_PALETTE.length];
        series.push({
            label: `Nilai ${nilaiLabel}`,
            color,
            values: sortedPerSoal.map(arr => arr[slot] ? arr[slot].jumlah : 0)
        });
    }
    return { series, sortedPerSoal };
}

function _atdBinaryLegendHtml() {
    return `<div class="atd-legend-item"><span class="atd-legend-dot" style="background:#16a34a"></span>Benar</div>
            <div class="atd-legend-item"><span class="atd-legend-dot" style="background:#dc2626"></span>Salah</div>`;
}

function _atdSkorLegendHtml(seriesList) {
    return seriesList.map(s => `<div class="atd-legend-item"><span class="atd-legend-dot" style="background:${s.color}"></span>${s.label}</div>`).join('');
}

function _atdSikapLegendHtml() {
    return `<div class="atd-legend-item"><span class="atd-legend-dot" style="background:#16a34a"></span>Benar (median)</div>
            <div class="atd-legend-item"><span class="atd-legend-dot" style="background:#dc2626"></span>Salah (median)</div>
            <div class="atd-legend-item"><span class="atd-legend-dot" style="background:#2666b8"></span>Jumlah Dijawab (median)</div>
            <div class="atd-legend-item"><span class="atd-legend-dot" style="background:#94a3b8;border-radius:50%"></span>Bola = jumlah orang per nilai</div>`;
}

// ── RENDER GRAFIK GARIS (SVG murni) ────────────────────────────────────────
function _atdBuildLineChart(containerId, opts) {
    const { title, sub, categories, series, maxVal, kind } = opts;
    const width = 680, height = 300, left = 34, right = 16, top = 16, bottom = 40;
    const plotW = width - left - right, plotH = height - top - bottom;
    const N = categories.length;
    const slotW = plotW / N;
    const cx = i => left + i * slotW + slotW / 2;
    const { max: yMax, ticks } = _atdNiceTicks(maxVal);
    const cy = v => top + plotH - (yMax > 0 ? (v / yMax) * plotH : 0);

    let svgParts = '';
    // Tick pendek + label seragam di tiap angka sumbu Y (sama gayanya dgn
    // grafik Sikap Kerja, biar konsisten se-halaman Analisa).
    ticks.forEach(val => {
        const y = cy(val);
        svgParts += `<line class="atd-grid-line" x1="${left}" y1="${y}" x2="${left + plotW}" y2="${y}"></line>`;
        svgParts += `<line class="atd-data-tick" x1="${(left - 4).toFixed(1)}" y1="${y.toFixed(1)}" x2="${left}" y2="${y.toFixed(1)}"></line>`;
        svgParts += `<text class="atd-axis-label" x="${left - 6}" y="${y + 3}" text-anchor="end">${val}</text>`;
    });
    svgParts += `<line class="atd-axis-line" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}"></line>`;
    svgParts += `<line class="atd-axis-line" x1="${left}" y1="${top + plotH}" x2="${left + plotW}" y2="${top + plotH}"></line>`;

    // Garis per seri (di bawah titik & area sentuh)
    series.forEach(s => {
        const pts = s.values.map((v, i) => `${cx(i).toFixed(1)},${cy(v).toFixed(1)}`).join(' ');
        svgParts += `<polyline class="atd-line" points="${pts}" stroke="${s.color}" fill="none"></polyline>`;
    });

    // Titik + area sentuh per kategori (grup tetap dipakai utk popup persentase)
    categories.forEach((cat, i) => {
        let dotsSvg = '';
        series.forEach(s => {
            dotsSvg += `<circle class="atd-dot" cx="${cx(i).toFixed(1)}" cy="${cy(s.values[i]).toFixed(1)}" r="3.5" fill="${s.color}"></circle>`;
        });
        svgParts += `<g class="atd-chart-group" data-idx="${i}" data-kind="${kind}">
            <rect class="atd-hit" x="${(left + i * slotW).toFixed(1)}" y="${top}" width="${slotW.toFixed(1)}" height="${plotH}"></rect>
            ${dotsSvg}
            <text class="atd-x-label" x="${cx(i).toFixed(1)}" y="${top + plotH + 18}">${cat}</text>
        </g>`;
    });

    const svg = `<svg class="atd-chart-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${svgParts}</svg>`;
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `
        <div class="atd-chart-head">
            <div><div class="atd-chart-title">${title}</div><div class="atd-chart-sub">${sub}</div></div>
            <div class="atd-chart-hint">Sentuh / arahkan kursor ke tiap soal untuk lihat persentase</div>
        </div>
        <div class="atd-chart-svg-wrap">${svg}</div>
        <div class="atd-legend" id="${containerId}-legend"></div>`;
}

// ── RENDER GRAFIK MEDIAN + SEBARAN (SVG murni) ─────────────────────────────
// Dipakai khusus utk Sikap Kerja: tiap kategori (Benar/Salah/Jumlah Dijawab)
// per kolom BUKAN 1 angka, tapi sebaran nilai antar peserta. catData:
// [{label,color,dist:[{nilai:jumlahOrang} per kolom, urut sesuai categories]}].
// Tiap (kolom,nilai) dgn jumlahOrang>0 digambar sbg bola kecil berlabel angka,
// lalu ditarik garis MEDIAN per kategori yg menyambung tiap kolom — garis inilah
// yang jadi fokus utama (digambar di atas bola2 sebaran) supaya pola/tren
// kolektifnya langsung terlihat jelas tanpa tertarik outlier.
function _atdBuildSikapMedianChart(containerId, opts) {
    const { title, sub, categories, catData, kind } = opts;
    const width = 680, height = 300, left = 34, right = 16, top = 16, bottom = 40;
    const plotW = width - left - right, plotH = height - top - bottom;
    const N = categories.length;
    const slotW = plotW / N;
    const cx = i => left + i * slotW + slotW / 2;

    let maxVal = 0;
    const dataValsSet = new Set();
    catData.forEach(c => c.dist.forEach(d => Object.keys(d).forEach(v => {
        if (d[v] > 0) { const n = Number(v); maxVal = Math.max(maxVal, n); dataValsSet.add(n); }
    })));
    const { max: yMax, ticks } = _atdNiceTicks(maxVal);
    const cy = v => top + plotH - (yMax > 0 ? (v / yMax) * plotH : 0);

    let svgParts = '';
    // Garis + label utama (skala rapi, kelipatan tetap) — jaraknya TIDAK diubah.
    // Tiap label utama juga dikasih tick pendek (garis putus2 kecil) persis di
    // sebelah angkanya, sama kayak label data tambahan di bawah — biar semua
    // angka di sumbu Y seragam gayanya, bukan cuma sebagian yg ada tick-nya.
    ticks.forEach(val => {
        const y = cy(val);
        svgParts += `<line class="atd-grid-line" x1="${left}" y1="${y}" x2="${left + plotW}" y2="${y}"></line>`;
        svgParts += `<line class="atd-data-tick" x1="${(left - 4).toFixed(1)}" y1="${y.toFixed(1)}" x2="${left}" y2="${y.toFixed(1)}"></line>`;
        svgParts += `<text class="atd-axis-label" x="${left - 6}" y="${y + 3}" text-anchor="end">${val}</text>`;
    });
    // Label TAMBAHAN persis di tiap nilai yg beneran ada datanya (mis. 7 di
    // antara garis rapi 5 & 8) — supaya nggak "ilang" cuma keliatan mepet ke
    // garis terdekat. Kecil (7px) & jadi tick pendek sendiri (bukan garis
    // penuh selebar plot, biar nggak numpuk sama garis rapi di atas), tapi
    // warnanya tetap jelas/kontras, bukan pudar sampai susah dibaca.
    const niceSet = new Set(ticks);
    Array.from(dataValsSet).sort((a, b) => a - b).forEach(val => {
        if (niceSet.has(val)) return; // sudah kebagian label utama, jangan dobel
        const y = cy(val);
        svgParts += `<line class="atd-data-tick" x1="${(left - 4).toFixed(1)}" y1="${y.toFixed(1)}" x2="${left}" y2="${y.toFixed(1)}"></line>`;
        svgParts += `<text class="atd-data-tick-label" x="${(left - 6).toFixed(1)}" y="${(y + 2.5).toFixed(1)}" text-anchor="end">${val}</text>`;
    });
    svgParts += `<line class="atd-axis-line" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}"></line>`;
    svgParts += `<line class="atd-axis-line" x1="${left}" y1="${top + plotH}" x2="${left + plotW}" y2="${top + plotH}"></line>`;

    // Geser kecil per kategori supaya bola 3 kategori di kolom yg sama tidak
    // numpuk persis — sengaja kecil (±8px) biar tetap "cuma kelihatan aja",
    // tidak mencolok, sesuai permintaan.
    const mid = (catData.length - 1) / 2;
    const offsets = catData.map((_, k) => (k - mid) * 8);

    // 1) Bola sebaran — digambar dulu, jadi lapisan bawah
    catData.forEach((c, k) => {
        c.dist.forEach((d, i) => {
            Object.entries(d).forEach(([val, count]) => {
                if (!count) return;
                const r = Math.min(9, 2.6 + Math.sqrt(count) * 1.6);
                const px = cx(i) + offsets[k];
                const py = cy(Number(val));
                svgParts += `<circle class="atd-bubble" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r.toFixed(1)}" fill="${c.color}"></circle>`;
                svgParts += `<text class="atd-bubble-label" x="${px.toFixed(1)}" y="${(py + 2.5).toFixed(1)}">${count}</text>`;
            });
        });
    });

    // 2) Garis median per kategori — digambar di atas bola, jadi fokus utama
    const medians = catData.map(c => c.dist.map(d => _atdWeightedMedian(d)));
    catData.forEach((c, k) => {
        const pts = medians[k].map((m, i) => `${(cx(i) + offsets[k]).toFixed(1)},${cy(m).toFixed(1)}`).join(' ');
        svgParts += `<polyline class="atd-median-line" points="${pts}" stroke="${c.color}" fill="none"></polyline>`;
        medians[k].forEach((m, i) => {
            svgParts += `<circle class="atd-median-dot" cx="${(cx(i) + offsets[k]).toFixed(1)}" cy="${cy(m).toFixed(1)}" r="4" fill="#fff" stroke="${c.color}"></circle>`;
        });
    });

    // 3) Garis bantu + area sentuh per kolom (grup tetap dipakai utk popup median)
    categories.forEach((cat, i) => {
        svgParts += `<g class="atd-chart-group" data-idx="${i}" data-kind="${kind}">
            <rect class="atd-hit" x="${(left + i * slotW).toFixed(1)}" y="${top}" width="${slotW.toFixed(1)}" height="${plotH}"></rect>
            <line class="atd-hover-guide" x1="${cx(i).toFixed(1)}" y1="${top}" x2="${cx(i).toFixed(1)}" y2="${top + plotH}"></line>
            <text class="atd-x-label" x="${cx(i).toFixed(1)}" y="${top + plotH + 18}">${cat}</text>
        </g>`;
    });

    const svg = `<svg class="atd-chart-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${svgParts}</svg>`;
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `
        <div class="atd-chart-head">
            <div><div class="atd-chart-title">${title}</div><div class="atd-chart-sub">${sub}</div></div>
            <div class="atd-chart-hint">Sentuh / arahkan kursor ke tiap kolom untuk lihat median & sebarannya</div>
        </div>
        <div class="atd-chart-svg-wrap">${svg}</div>
        <div class="atd-legend" id="${containerId}-legend"></div>`;
}

// ── POPUP DIAGRAM LINGKARAN (donut, teknik stroke-dasharray) ────────────
// Dipakai utk tipe Benar/Salah & Nilai/Skor (data komposisi/proporsi dari 1
// total yang sama per kolom, jadi cocok jadi persen di pie).
function _atdPieSvg(slices) {
    const r = 15.9155;
    let cum = 0;
    const circles = slices.map(s => {
        const dash = `${s.pct} ${100 - s.pct}`;
        const offset = 25 - cum;
        cum += s.pct;
        return `<circle cx="18" cy="18" r="${r}" fill="transparent" stroke="${s.color}" stroke-width="7" stroke-dasharray="${dash}" stroke-dashoffset="${offset}"></circle>`;
    }).join('');
    return `<svg viewBox="0 0 36 36" width="72" height="72">${circles}</svg>`;
}

function _atdSlicesFor(kind, idx) {
    if (kind === 'binary') {
        const s = _ATD_DUMMY_BINARY[idx];
        const total = s.benar + s.salah;
        return {
            title: `Soal No. ${s.nomor} · ${total} jawaban`,
            slices: [
                { label: 'Benar', value: s.benar, pct: total ? Math.round(s.benar / total * 100) : 0, color: '#16a34a' },
                { label: 'Salah', value: s.salah, pct: total ? Math.round(s.salah / total * 100) : 0, color: '#dc2626' }
            ]
        };
    }
    const sorted = _atdSkorSortedPerSoal[idx]; // opsi diurutkan sesuai slot yg sama dgn series (jadi warna/label match)
    const total = sorted.reduce((sum, o) => sum + (o ? o.jumlah : 0), 0);
    return {
        title: `Soal No. ${_ATD_DUMMY_SKOR[idx].nomor} · ${total} jawaban`,
        slices: sorted.map((o, slot) => {
            const meta = _atdSkorSeriesMeta[slot] || {};
            return { label: meta.label, value: o.jumlah, pct: total ? Math.round(o.jumlah / total * 100) : 0, color: meta.color };
        }).filter(sl => sl.value > 0)
    };
}

function _atdRenderPiePopup(title, slices) {
    const legend = slices.map(s => `<div class="atd-pie-pop-row"><span class="atd-legend-dot" style="background:${s.color}"></span><span>${s.label}</span><b>${s.value} <span class="atd-pie-pop-pct">(${s.pct}%)</span></b></div>`).join('');
    const pop = _atdGetPiePopEl();
    if (!pop) return;
    pop.innerHTML = `<div class="atd-pie-pop-title">${title}</div><div class="atd-pie-pop-body">${_atdPieSvg(slices)}<div class="atd-pie-pop-legend">${legend}</div></div>`;
}

// ── POPUP STAT (median/rentang/jumlah orang) — khusus Sikap Kerja ─────────
// Bukan pie krn di sini tiap kategori punya sebaran & skala sendiri2, bukan
// proporsi dari 1 total yang sama, jadi disajikan sbg ringkasan per kategori.
function _atdRenderSikapStatPopup(idx) {
    const kolomLabel = _atdSikapCats[idx] || `#${idx + 1}`;
    const rows = _atdSikapDist.map(c => {
        const dist = c.dist[idx] || {};
        const entries = Object.entries(dist).map(([v, cnt]) => [Number(v), cnt]).filter(([, cnt]) => cnt > 0).sort((a, b) => a[0] - b[0]);
        const n = entries.reduce((s, [, cnt]) => s + cnt, 0);
        const min = entries.length ? entries[0][0] : 0;
        const max = entries.length ? entries[entries.length - 1][0] : 0;
        const median = _atdWeightedMedian(dist);
        return `<div class="atd-pie-pop-row"><span class="atd-legend-dot" style="background:${c.color}"></span><span>${c.label}</span><b>Median ${median}</b></div>
                <div class="atd-pie-pop-sub">Rentang ${min}–${max} · n=${n} orang</div>`;
    }).join('');
    const pop = _atdGetPiePopEl();
    if (!pop) return;
    pop.innerHTML = `<div class="atd-pie-pop-title">Kolom ${kolomLabel}</div><div class="atd-pie-pop-body atd-pie-pop-body-stat">${rows}</div>`;
}

// #atd-pie-pop dipindah ke <body> (bukan dibiarkan di dalam .page) karena
// .page punya CSS "transform" (lihat css/base.css .page/.page.active) — dan
// elemen manapun dengan "transform" otomatis jadi containing-block baru utk
// descendant "position:fixed", jadi posisi popup ikut acuan kotak .page yg
// scrollable itu, BUKAN acuan viewport. Efeknya waktu halaman di-scroll jauh
// ke bawah (grafiknya kan di bawah), popup fixed tsb melenceng jauh dari
// posisi kursor/sentuhan sebenarnya. Pindah ke <body> membuat fixed-nya
// kembali relatif ke viewport, jadi selalu tepat di dekat kursor.
function _atdGetPiePopEl() {
    const pop = document.getElementById('atd-pie-pop');
    if (pop && pop.parentElement !== document.body) document.body.appendChild(pop);
    return pop;
}

function _atdPositionPiePopup(evt) {
    const pop = _atdGetPiePopEl();
    if (!pop) return;
    const pt = (evt.touches && evt.touches[0]) ? evt.touches[0] : evt;
    const x = pt.clientX != null ? pt.clientX : window.innerWidth / 2;
    const y = pt.clientY != null ? pt.clientY : 120;
    const popW = 210, popH = 170;
    let left = x + 16, top = y + 16;
    if (left + popW > window.innerWidth - 8) left = x - popW - 16;
    if (top + popH > window.innerHeight - 8) top = y - popH - 16;
    pop.style.left = Math.max(8, left) + 'px';
    pop.style.top = Math.max(8, top) + 'px';
}

let _atdActiveGroup = null;
function _atdShowPie(evt, groupEl, kind, idx) {
    if (kind === 'sikap') {
        _atdRenderSikapStatPopup(idx);
    } else {
        const { title, slices } = _atdSlicesFor(kind, idx);
        _atdRenderPiePopup(title, slices);
    }
    _atdPositionPiePopup(evt);
    const pop = document.getElementById('atd-pie-pop');
    if (pop) pop.style.display = 'block';
    if (_atdActiveGroup && _atdActiveGroup !== groupEl) _atdActiveGroup.classList.remove('atd-active');
    groupEl.classList.add('atd-active');
    _atdActiveGroup = groupEl;
}

function _atdHidePie() {
    const pop = document.getElementById('atd-pie-pop');
    if (pop) pop.style.display = 'none';
    if (_atdActiveGroup) { _atdActiveGroup.classList.remove('atd-active'); _atdActiveGroup = null; }
}

function _atdBindChartEvents(containerId, kind) {
    document.querySelectorAll(`#${containerId} .atd-chart-group`).forEach(g => {
        const idx = +g.dataset.idx;
        g.addEventListener('mouseenter', e => _atdShowPie(e, g, kind, idx));
        g.addEventListener('mousemove', e => _atdPositionPiePopup(e));
        g.addEventListener('mouseleave', () => { if (_atdActiveGroup === g) _atdHidePie(); });
        g.addEventListener('click', e => {
            e.stopPropagation();
            if (_atdActiveGroup === g) { _atdHidePie(); return; }
            _atdShowPie(e, g, kind, idx);
        });
        g.addEventListener('touchstart', e => {
            e.stopPropagation();
            if (_atdActiveGroup === g) { _atdHidePie(); return; }
            _atdShowPie(e, g, kind, idx);
        }, { passive: true });
    });
    if (!window._atdDocCloseBound) {
        document.addEventListener('click', _atdHidePie);
        window._atdDocCloseBound = true;
    }
}

// ── ENTRY: bangun ketiga contoh grafik dummy ──────────────────────────────
function _atdRenderDummyCharts() {
    // 1) Tipe Benar/Salah
    const catsB = _ATD_DUMMY_BINARY.map(s => s.nomor);
    const seriesB = [
        { label: 'Benar', color: '#16a34a', values: _ATD_DUMMY_BINARY.map(s => s.benar) },
        { label: 'Salah', color: '#dc2626', values: _ATD_DUMMY_BINARY.map(s => s.salah) }
    ];
    const maxValB = Math.max.apply(null, _ATD_DUMMY_BINARY.flatMap(s => [s.benar, s.salah]));
    _atdBuildLineChart('atd-chart-binary', {
        title: 'Grafik Per Soal — Tipe Benar/Salah (dummy)',
        sub: 'Contoh: soal pilihan ganda, dinilai otomatis benar/salah',
        categories: catsB, series: seriesB, maxVal: maxValB, kind: 'binary'
    });
    const legB = document.getElementById('atd-chart-binary-legend');
    if (legB) legB.innerHTML = _atdBinaryLegendHtml();
    _atdBindChartEvents('atd-chart-binary', 'binary');

    // 2) Tipe Nilai/Skor Sendiri — 1 garis per OPSI JAWABAN (bukan per nilai
    // gabungan). Kalau beberapa opsi kebetulan sama2 bernilai 0, tetap jadi
    // garis terpisah (lihat _atdBuildOpsiSeries), cuma labelnya sama2 "Nilai 0"
    // dgn warna beda2 supaya kebedanya jelas.
    const { series: seriesS, sortedPerSoal: sortedS } = _atdBuildOpsiSeries(_ATD_DUMMY_SKOR);
    _atdSkorSeriesMeta = seriesS;
    _atdSkorSortedPerSoal = sortedS;
    const catsS = _ATD_DUMMY_SKOR.map(s => s.nomor);
    const maxValS = Math.max.apply(null, _ATD_DUMMY_SKOR.flatMap(s => s.opsi.map(o => o.jumlah)));
    _atdBuildLineChart('atd-chart-skor', {
        title: 'Grafik Per Soal — Tipe Nilai/Skor Sendiri (dummy)',
        sub: 'Contoh: soal pilihan A–E dgn nilai per opsi — opsi sesama nilai 0 tetap dipisah, bukan digabung',
        categories: catsS, series: seriesS, maxVal: maxValS, kind: 'skor'
    });
    const legS = document.getElementById('atd-chart-skor-legend');
    if (legS) legS.innerHTML = _atdSkorLegendHtml(seriesS);
    _atdBindChartEvents('atd-chart-skor', 'skor');

    // 3) Tipe Sikap Kerja — sebaran nilai antar peserta per kolom (Benar/
    // Salah/Jumlah Dijawab), digambar sbg bola kecil + garis median per
    // kategori (lihat komentar _atdBuildSikapMedianChart).
    const distBenar = _atdDistFromRaw(_ATD_DUMMY_SIKAP_RAW, r => r.benar);
    const distSalah = _atdDistFromRaw(_ATD_DUMMY_SIKAP_RAW, r => r.salah);
    const distDijawab = _atdDistFromRaw(_ATD_DUMMY_SIKAP_RAW, r => r.benar + r.salah);
    _atdSikapCats = _ATD_DUMMY_SIKAP_RAW.map((_, i) => 'K' + (i + 1));
    _atdSikapDist = [
        { label: 'Benar', color: '#16a34a', dist: distBenar },
        { label: 'Salah', color: '#dc2626', dist: distSalah },
        { label: 'Jumlah Dijawab', color: '#2666b8', dist: distDijawab }
    ];
    _atdBuildSikapMedianChart('atd-chart-sikap', {
        title: 'Grafik Sikap Kerja — Median & Sebaran, Per Kolom (dummy)',
        sub: 'Tiap bola = jumlah orang yang dapat nilai itu; garis = median (bukan rata-rata) tiap kategori per kolom',
        categories: _atdSikapCats, catData: _atdSikapDist, kind: 'sikap'
    });
    const legK = document.getElementById('atd-chart-sikap-legend');
    if (legK) legK.innerHTML = _atdSikapLegendHtml();
    _atdBindChartEvents('atd-chart-sikap', 'sikap');
}
