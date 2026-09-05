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
//     AGREGAT SELURUH PESERTA dalam grup token itu, supaya kelihatan pola
//     pengerjaan kolektifnya — mis. kolom mana yang paling banyak DILEWATI
//     (bukan cuma salah) di seluruh grup, indikasi kelelahan/attention-drop
//     makin ke kolom belakang (pola klasik tes ber-kolom banyak spt ini).
//     x = nomor kolom (K1..K10, urutan tetap sesuai desain admin), y = jumlah
//     kesempatan-jawab digabung semua peserta, 3 garis per kolom: hijau =
//     Benar, merah = Salah, abu-abu = Tidak Dijawab (di-skip).
//
// Interaksi: arahkan kursor (desktop) / sentuh (mobile) ke kolom soal mana
// pun -> muncul popup diagram lingkaran (persen Benar/Salah, atau persen
// per nilai) dekat kursor/titik sentuh. Sentuh/klik di luar popup menutupnya.
//
// Data & pemetaan warna di bawah ini 100% dummy untuk contoh visual — saat
// nanti disambung ke data asli, cukup ganti _ATD_DUMMY_BINARY /
// _ATD_DUMMY_SKOR dengan hasil agregasi jawaban sungguhan per soal per grup.

function renderAnalisaTokenDetail() {
    const grup = window._analisaTokenDetailGrup || null;
    const items = window._analisaTokenDetailItems || [];
    const sub = document.getElementById('atd-kode-sub');
    if (sub) sub.textContent = grup ? `Grup: ${grup} (${items.length} token)` : '-';
    // TODO: render ringkasan analisa asli grup ini (skor rata-rata, sebaran
    // peserta, dst) di #atd-content menyusul instruksi berikutnya.
    _atdRenderDummyCharts();
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
    { nomor: 1, breakdown: { 5:5, 4:7, 3:4, 2:2, 1:1, 0:1 } },
    { nomor: 2, breakdown: { 5:2, 4:3, 3:8, 2:5, 1:1, 0:1 } },
    { nomor: 3, breakdown: { 5:9, 4:6, 3:3, 2:1, 1:1, 0:0 } },
    { nomor: 4, breakdown: { 5:1, 4:2, 3:5, 2:6, 1:4, 0:2 } },
    { nomor: 5, breakdown: { 5:6, 4:5, 3:4, 2:3, 1:1, 0:1 } }
];

const _ATD_SKOR_PALETTE = ['#2666b8','#dc2626','#d97706','#16a34a','#9333ea','#0891b2','#db2777','#64748b'];
let _atdSkorColorMap = {};

// Dummy: 10 kolom, agregat 20 peserta dalam grup, sengaja dipola makin ke
// kolom belakang makin banyak Salah & Tidak Dijawab (demo pola kelelahan).
const _ATD_DUMMY_SIKAP = [
    { kolom: 1,  benar: 165, salah: 30, tidak: 5 },
    { kolom: 2,  benar: 160, salah: 35, tidak: 5 },
    { kolom: 3,  benar: 150, salah: 40, tidak: 10 },
    { kolom: 4,  benar: 140, salah: 45, tidak: 15 },
    { kolom: 5,  benar: 130, salah: 50, tidak: 20 },
    { kolom: 6,  benar: 120, salah: 55, tidak: 25 },
    { kolom: 7,  benar: 100, salah: 60, tidak: 40 },
    { kolom: 8,  benar: 90,  salah: 65, tidak: 45 },
    { kolom: 9,  benar: 80,  salah: 70, tidak: 50 },
    { kolom: 10, benar: 70,  salah: 75, tidak: 55 }
];

// ── HELPERS ──────────────────────────────────────────────────────────────
function _atdNiceMax(v) { if (!isFinite(v) || v <= 5) return 5; return Math.ceil(v / 5) * 5; }

function _atdBuildNilaiColorMap(skorData) {
    const set = new Set();
    skorData.forEach(s => Object.entries(s.breakdown).forEach(([nilai, v]) => { if (v > 0) set.add(Number(nilai)); }));
    const sorted = Array.from(set).sort((a, b) => b - a); // nilai tertinggi dapat warna pertama (biru)
    const map = {};
    sorted.forEach((n, i) => { map[n] = _ATD_SKOR_PALETTE[i % _ATD_SKOR_PALETTE.length]; });
    return map;
}

function _atdBinaryLegendHtml() {
    return `<div class="atd-legend-item"><span class="atd-legend-dot" style="background:#16a34a"></span>Benar</div>
            <div class="atd-legend-item"><span class="atd-legend-dot" style="background:#dc2626"></span>Salah</div>`;
}

function _atdSkorLegendHtml(colorMap) {
    return Object.keys(colorMap).sort((a, b) => b - a)
        .map(n => `<div class="atd-legend-item"><span class="atd-legend-dot" style="background:${colorMap[n]}"></span>Nilai ${n}</div>`)
        .join('');
}

function _atdSikapLegendHtml() {
    return `<div class="atd-legend-item"><span class="atd-legend-dot" style="background:#16a34a"></span>Benar</div>
            <div class="atd-legend-item"><span class="atd-legend-dot" style="background:#dc2626"></span>Salah</div>
            <div class="atd-legend-item"><span class="atd-legend-dot" style="background:#94a3b8"></span>Tidak Dijawab</div>`;
}

// ── RENDER GRAFIK GARIS (SVG murni) ────────────────────────────────────────
function _atdBuildLineChart(containerId, opts) {
    const { title, sub, categories, series, yMax, kind } = opts;
    const width = 680, height = 300, left = 34, right = 16, top = 16, bottom = 40;
    const plotW = width - left - right, plotH = height - top - bottom;
    const N = categories.length;
    const slotW = plotW / N;
    const cx = i => left + i * slotW + slotW / 2;
    const cy = v => top + plotH - (yMax > 0 ? (v / yMax) * plotH : 0);

    let svgParts = '';
    const steps = 4;
    for (let s = 0; s <= steps; s++) {
        const val = Math.round(yMax * s / steps);
        const y = top + plotH - (plotH * s / steps);
        svgParts += `<line class="atd-grid-line" x1="${left}" y1="${y}" x2="${left + plotW}" y2="${y}"></line>`;
        svgParts += `<text class="atd-axis-label" x="${left - 6}" y="${y + 3}" text-anchor="end">${val}</text>`;
    }
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

// ── POPUP DIAGRAM LINGKARAN (donut, teknik stroke-dasharray) ────────────
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
    if (kind === 'sikap') {
        const s = _ATD_DUMMY_SIKAP[idx];
        const total = s.benar + s.salah + s.tidak;
        return {
            title: `Kolom ${s.kolom} · ${total} kesempatan jawab`,
            slices: [
                { label: 'Benar', value: s.benar, pct: total ? Math.round(s.benar / total * 100) : 0, color: '#16a34a' },
                { label: 'Salah', value: s.salah, pct: total ? Math.round(s.salah / total * 100) : 0, color: '#dc2626' },
                { label: 'Tidak Dijawab', value: s.tidak, pct: total ? Math.round(s.tidak / total * 100) : 0, color: '#94a3b8' }
            ]
        };
    }
    const s = _ATD_DUMMY_SKOR[idx];
    const entries = Object.entries(s.breakdown).filter(([, v]) => v > 0).sort((a, b) => b[0] - a[0]);
    const total = entries.reduce((sum, [, v]) => sum + v, 0);
    return {
        title: `Soal No. ${s.nomor} · ${total} jawaban`,
        slices: entries.map(([nilai, v]) => ({ label: `Nilai ${nilai}`, value: v, pct: total ? Math.round(v / total * 100) : 0, color: _atdSkorColorMap[nilai] }))
    };
}

function _atdRenderPiePopup(title, slices) {
    const legend = slices.map(s => `<div class="atd-pie-pop-row"><span class="atd-legend-dot" style="background:${s.color}"></span><span>${s.label}</span><b>${s.pct}%</b></div>`).join('');
    const pop = document.getElementById('atd-pie-pop');
    if (!pop) return;
    pop.innerHTML = `<div class="atd-pie-pop-title">${title}</div><div class="atd-pie-pop-body">${_atdPieSvg(slices)}<div class="atd-pie-pop-legend">${legend}</div></div>`;
}

function _atdPositionPiePopup(evt) {
    const pop = document.getElementById('atd-pie-pop');
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
    const { title, slices } = _atdSlicesFor(kind, idx);
    _atdRenderPiePopup(title, slices);
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
    const yMaxB = _atdNiceMax(Math.max.apply(null, _ATD_DUMMY_BINARY.flatMap(s => [s.benar, s.salah])));
    _atdBuildLineChart('atd-chart-binary', {
        title: 'Grafik Per Soal — Tipe Benar/Salah (dummy)',
        sub: 'Contoh: soal pilihan ganda, dinilai otomatis benar/salah',
        categories: catsB, series: seriesB, yMax: yMaxB, kind: 'binary'
    });
    const legB = document.getElementById('atd-chart-binary-legend');
    if (legB) legB.innerHTML = _atdBinaryLegendHtml();
    _atdBindChartEvents('atd-chart-binary', 'binary');

    // 2) Tipe Nilai/Skor Sendiri — 1 garis per nilai, titik 0 dipakai di soal
    // yang tidak punya nilai itu supaya garis tetap menyambung antar soal.
    _atdSkorColorMap = _atdBuildNilaiColorMap(_ATD_DUMMY_SKOR);
    const catsS = _ATD_DUMMY_SKOR.map(s => s.nomor);
    const nilaiKeys = Object.keys(_atdSkorColorMap).sort((a, b) => b - a);
    const seriesS = nilaiKeys.map(nilai => ({
        label: `Nilai ${nilai}`,
        color: _atdSkorColorMap[nilai],
        values: _ATD_DUMMY_SKOR.map(s => s.breakdown[nilai] || 0)
    }));
    const yMaxS = _atdNiceMax(Math.max.apply(null, _ATD_DUMMY_SKOR.flatMap(s => Object.values(s.breakdown))));
    _atdBuildLineChart('atd-chart-skor', {
        title: 'Grafik Per Soal — Tipe Nilai/Skor Sendiri (dummy)',
        sub: 'Contoh: soal uraian/essay, dinilai reviewer skala 0–5',
        categories: catsS, series: seriesS, yMax: yMaxS, kind: 'skor'
    });
    const legS = document.getElementById('atd-chart-skor-legend');
    if (legS) legS.innerHTML = _atdSkorLegendHtml(_atdSkorColorMap);
    _atdBindChartEvents('atd-chart-skor', 'skor');

    // 3) Tipe Sikap Kerja — agregat seluruh peserta dalam grup, per kolom
    const catsK = _ATD_DUMMY_SIKAP.map(s => 'K' + s.kolom);
    const seriesK = [
        { label: 'Benar', color: '#16a34a', values: _ATD_DUMMY_SIKAP.map(s => s.benar) },
        { label: 'Salah', color: '#dc2626', values: _ATD_DUMMY_SIKAP.map(s => s.salah) },
        { label: 'Tidak Dijawab', color: '#94a3b8', values: _ATD_DUMMY_SIKAP.map(s => s.tidak) }
    ];
    const yMaxK = _atdNiceMax(Math.max.apply(null, _ATD_DUMMY_SIKAP.flatMap(s => [s.benar, s.salah, s.tidak])));
    _atdBuildLineChart('atd-chart-sikap', {
        title: 'Grafik Sikap Kerja — Agregat Grup, Per Kolom (dummy)',
        sub: 'Contoh: seluruh peserta digabung, terlihat pola makin banyak salah/dilewati di kolom belakang',
        categories: catsK, series: seriesK, yMax: yMaxK, kind: 'sikap'
    });
    const legK = document.getElementById('atd-chart-sikap-legend');
    if (legK) legK.innerHTML = _atdSikapLegendHtml();
    _atdBindChartEvents('atd-chart-sikap', 'sikap');
}
