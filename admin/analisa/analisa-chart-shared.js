// admin/analisa/analisa-chart-shared.js
// Kode grafik SVG murni (line chart + median/sebaran chart Sikap Kerja) yang
// SEBELUMNYA hidup di admin/analisa/analisa-token-detail.js — DIPINDAH ke
// file terpisah ini supaya bisa dipakai ULANG oleh admin/analisa/
// analisa-soal-detail.js (kartu "Grafik" di halaman ITEM DATA 1 soal) tanpa
// harus memuat seluruh analisa-token-detail.js (yang isinya banyak logika
// KHUSUS grup token: Ringkasan, Peserta, ekspor .xlsx, dst — tidak relevan
// sama sekali di halaman item-data soal).
//
// SEMUA fungsi/variabel di sini tetap pakai prefix `_atd` yang sama seperti
// asalnya (bukan diganti nama) supaya kode yang MEMANGGILNYA di
// analisa-token-detail.js & analisa-grafik.js tidak perlu diubah sama sekali.
//
// Didaftarkan di js/app.js sebagai dependency js kedua halaman itu:
//   'analisa-token-detail': js: [..., 'admin/analisa/analisa-chart-shared.js', 'admin/analisa/analisa-token-detail.js']
//   'analisa-soal-detail':  js: [..., 'admin/analisa/analisa-chart-shared.js', 'admin/analisa/analisa-soal-detail.js']
// (LazyLoader.loadMany dedup per-URL, jadi kalau admin sempat buka kedua
// halaman itu di sesi yang sama, file ini cuma benar-benar di-fetch sekali.)
//
// PERUBAHAN kecil dari versi asli: _atdBuildLineChart sekarang menerima opsi
// tambahan `xClickFn` (nama fungsi global, string) — kalau diisi, label
// sumbu-X tiap kategori jadi bisa diklik (onclick="`${xClickFn}`(...)"),
// SAMA PERSIS perilaku lama yang selalu memanggil _atdGoToSoalDetail(). Kalau
// TIDAK diisi (dibiarkan kosong), label sumbu-X jadi teks biasa saja, tidak
// bisa diklik — dipakai di analisa-soal-detail.js karena di sana cuma ada 1
// soal per grafik, tidak ada "soal lain" utk di-drill-down ke halamannya.
// analisa-token-detail.js sendiri TETAP mengirim xClickFn:'_atdGoToSoalDetail'
// (fungsi itu masih didefinisikan di analisa-token-detail.js, bukan di sini
// — murni khusus alur token) supaya perilakunya 100% sama seperti sebelumnya.

function _atdEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ── DATA GRAFIK — global (dibaca ulang oleh popup & halaman lain yang
// membuka overlay per-orang, spt admin/analisa/analisa-grafik.js) — diisi
// ulang tiap kali _atdRenderCharts() (token) atau _asdRenderCharts() (soal)
// dipanggil dengan data barunya sendiri.
let _ATD_DUMMY_BINARY = [];
let _ATD_DUMMY_SKOR = [];
let _ATD_DUMMY_SIKAP_RAW = [];

const _ATD_SKOR_ZERO_PALETTE = ['#dc2626','#f97316','#eab308','#a855f7','#0891b2','#db2777','#64748b'];
const _ATD_SKOR_NONZERO_PALETTE = ['#2666b8','#16a34a','#9333ea','#0891b2','#d97706'];
let _atdSkorSeriesMeta = [];      // [{label,color}] per slot, urut sesuai series grafik
let _atdSkorSortedPerSoal = [];   // per soal: opsi diurutkan sesuai slot yg sama dgn series (utk popup)
let _atdSikapDist = [];  // [{label,color,dist:[{nilai:jumlahOrang} per kolom]}]
let _atdSikapCats = [];  // ['K1','K2',...]

// ── POPUP DATA PER-CONTAINER (khusus kartu "Grafik Per Soal" YANG BARU di
// analisa-token-detail.js, dari sekarang bisa lebih dari 1 kartu binary/skor/
// sikap sekaligus di 1 halaman — 1 kartu per SOAL bernama, bukan lagi 1
// kartu gabungan utk seluruh modul) ─────────────────────────────────────────
// Popup hover/klik (_atdSlicesFor, _atdRenderSikapStatPopup) SEBELUMNYA
// selalu baca dari variabel GLOBAL TUNGGAL di atas (_ATD_DUMMY_BINARY dkk) —
// itu cukup selama cuma ADA 1 grafik per jenis per halaman (analisa-soal-
// detail.js, analisa-grafik.js: memang begitu desainnya). Begitu 1 halaman
// bisa punya BEBERAPA kartu binary/skor/sikap sekaligus (1 per soal), popup
// perlu tahu kartu MANA yg lagi di-hover supaya tidak salah ambil data soal
// lain. `_atdSetChartPopupData(containerId, data)` dipanggil pemanggil BARU
// (analisa-token-detail.js) tepat sebelum _atdBindChartEvents utk kartu itu;
// _atdSlicesFor/_atdRenderSikapStatPopup PRIORITASKAN data di sini kalau ada,
// baru fallback ke variabel global lama kalau containerId ini tidak
// terdaftar — jadi pemanggil LAMA (analisa-soal-detail.js, analisa-grafik.js,
// yg tidak pernah memanggil _atdSetChartPopupData) tetap jalan PERSIS spt
// sebelumnya, tidak ada perubahan perilaku sama sekali utk mereka.
const _atdChartPopupStore = {};
function _atdSetChartPopupData(containerId, data) { _atdChartPopupStore[containerId] = data; }
function _atdClearChartPopupData(containerId) { delete _atdChartPopupStore[containerId]; }

function _atdDistFromRaw(raw, pick) {
    return raw.map(rows => {
        const dist = {};
        rows.forEach(row => { const v = pick(row); dist[v] = (dist[v] || 0) + 1; });
        return dist;
    });
}

// Median tertimbang dari peta {nilai: jumlah_orang}.
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

// Varian & standar deviasi POPULASI (bagi n, bukan n-1).
function _atdWeightedStdDev(dist) {
    const entries = Object.entries(dist).map(([v, cnt]) => [Number(v), cnt]).filter(([, cnt]) => cnt > 0);
    const n = entries.reduce((s, [, cnt]) => s + cnt, 0);
    if (!n) return 0;
    const mean = entries.reduce((s, [v, cnt]) => s + v * cnt, 0) / n;
    const variance = entries.reduce((s, [v, cnt]) => s + cnt * Math.pow(v - mean, 2), 0) / n;
    return Math.sqrt(variance);
}

// Tick sumbu-Y "rapi" (kelipatan 1/2/5/10 dst) yg menyesuaikan skala data.
function _atdNiceTicks(maxVal) {
    if (!isFinite(maxVal) || maxVal <= 0) maxVal = 1;
    const MAX_TICKS = 12;
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

// Bangun SERIES grafik Nilai/Skor Sendiri per SLOT OPSI (bukan per nilai unik).
function _atdBuildOpsiSeries(skorData) {
    const maxSlot = Math.max.apply(null, skorData.map(s => s.opsi.length));
    const sortedPerSoal = skorData.map(s => s.opsi.slice().sort((a, b) => b.nilai - a.nilai || b.jumlah - a.jumlah));
    let zeroIdx = 0, nonZeroIdx = 0;
    const series = [];
    for (let slot = 0; slot < maxSlot; slot++) {
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
    // `clickValues` (opsional): nilai yg dikirim ke xClickFn saat label sumbu-X
    // diklik, kalau BEDA dari yg ditampilkan di `categories` (dipakai kartu
    // "Grafik Per Soal" versi baru di analisa-token-detail.js: `categories`
    // diisi nomor LOKAL soal itu saja, biar sumbu-X tidak numpuk sampai >100
    // kalau modul digabung banyak soal — tapi drill-down klik tetap harus
    // kirim nomor GLOBAL spy lookup di analisa-soal.js tetap tepat sasaran).
    // Kalau tidak diisi, fallback ke `categories` spt sebelumnya (perilaku
    // lama, dipakai pemanggil yg cuma py 1 soal per grafik).
    const { title, sub, categories, series, maxVal, kind, xClickFn, clickValues } = opts;
    const width = 680, height = 300, left = 34, right = 16, top = 16, bottom = 40;
    const plotW = width - left - right, plotH = height - top - bottom;
    const N = categories.length;
    const slotW = plotW / N;
    const cx = i => left + i * slotW + slotW / 2;
    const { max: yMax, ticks } = _atdNiceTicks(maxVal);
    const cy = v => top + plotH - (yMax > 0 ? (v / yMax) * plotH : 0);

    let svgParts = '';
    ticks.forEach(val => {
        const y = cy(val);
        svgParts += `<line class="atd-grid-line" x1="${left}" y1="${y}" x2="${left + plotW}" y2="${y}"></line>`;
        svgParts += `<line class="atd-data-tick" x1="${(left - 4).toFixed(1)}" y1="${y.toFixed(1)}" x2="${left}" y2="${y.toFixed(1)}"></line>`;
        svgParts += `<text class="atd-axis-label" x="${left - 6}" y="${y + 3}" text-anchor="end">${val}</text>`;
    });
    svgParts += `<line class="atd-axis-line" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}"></line>`;
    svgParts += `<line class="atd-axis-line" x1="${left}" y1="${top + plotH}" x2="${left + plotW}" y2="${top + plotH}"></line>`;

    series.forEach(s => {
        const pts = s.values.map((v, i) => `${cx(i).toFixed(1)},${cy(v).toFixed(1)}`).join(' ');
        svgParts += `<polyline class="atd-line" points="${pts}" stroke="${s.color}" fill="none"></polyline>`;
    });

    categories.forEach((cat, i) => {
        let dotsSvg = '';
        series.forEach(s => {
            dotsSvg += `<circle class="atd-dot" cx="${cx(i).toFixed(1)}" cy="${cy(s.values[i]).toFixed(1)}" r="3.5" fill="${s.color}"></circle>`;
        });
        const xLabelCls = xClickFn ? 'atd-x-label atd-x-label-clickable' : 'atd-x-label';
        const clickVal = clickValues ? clickValues[i] : cat;
        const xLabelClick = xClickFn ? ` onclick="${xClickFn}(event,'${kind}',${JSON.stringify(clickVal)})"` : '';
        svgParts += `<g class="atd-chart-group" data-idx="${i}" data-kind="${kind}">
            <rect class="atd-hit" x="${(left + i * slotW).toFixed(1)}" y="${top}" width="${slotW.toFixed(1)}" height="${plotH}"></rect>
            ${dotsSvg}
            <text class="${xLabelCls}" x="${cx(i).toFixed(1)}" y="${top + plotH + 18}"${xLabelClick}>${cat}</text>
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

// ── RENDER GRAFIK MEDIAN + SEBARAN (SVG murni) — khusus Sikap Kerja ────────
function _atdBuildSikapMedianChart(containerId, opts) {
    const { title, sub, categories, catData, kind, hideAnalisaBtn, userOverlay, showUtamaCats, showUserCats, analisaBtnSoalKode } = opts;
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
    if (userOverlay && userOverlay.series) {
        Object.values(userOverlay.series).forEach(arr => arr.forEach(v => { if (v != null) maxVal = Math.max(maxVal, v); }));
    }
    const { max: yMax, ticks } = _atdNiceTicks(maxVal);
    const cy = v => top + plotH - (yMax > 0 ? (v / yMax) * plotH : 0);

    let svgParts = '';
    ticks.forEach(val => {
        const y = cy(val);
        svgParts += `<line class="atd-grid-line" x1="${left}" y1="${y}" x2="${left + plotW}" y2="${y}"></line>`;
        svgParts += `<line class="atd-data-tick" x1="${(left - 4).toFixed(1)}" y1="${y.toFixed(1)}" x2="${left}" y2="${y.toFixed(1)}"></line>`;
        svgParts += `<text class="atd-axis-label" x="${left - 6}" y="${y + 3}" text-anchor="end">${val}</text>`;
    });
    const niceSet = new Set(ticks);
    Array.from(dataValsSet).sort((a, b) => a - b).forEach(val => {
        if (niceSet.has(val)) return;
        const y = cy(val);
        svgParts += `<line class="atd-data-tick" x1="${(left - 4).toFixed(1)}" y1="${y.toFixed(1)}" x2="${left}" y2="${y.toFixed(1)}"></line>`;
        svgParts += `<text class="atd-data-tick-label" x="${(left - 6).toFixed(1)}" y="${(y + 2.5).toFixed(1)}" text-anchor="end">${val}</text>`;
    });
    svgParts += `<line class="atd-axis-line" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}"></line>`;
    svgParts += `<line class="atd-axis-line" x1="${left}" y1="${top + plotH}" x2="${left + plotW}" y2="${top + plotH}"></line>`;

    const mid = (catData.length - 1) / 2;
    const offsets = catData.map((_, k) => (k - mid) * 8);

    categories.forEach((cat, i) => {
        svgParts += `<g class="atd-chart-group" data-idx="${i}" data-kind="${kind}">
            <rect class="atd-hit" x="${(left + i * slotW).toFixed(1)}" y="${top}" width="${slotW.toFixed(1)}" height="${plotH}"></rect>
            <line class="atd-hover-guide" x1="${cx(i).toFixed(1)}" y1="${top}" x2="${cx(i).toFixed(1)}" y2="${top + plotH}"></line>
            <text class="atd-x-label" x="${cx(i).toFixed(1)}" y="${top + plotH + 18}">${cat}</text>
        </g>`;
    });

    const medians = catData.map(c => c.dist.map(d => _atdWeightedMedian(d)));
    catData.forEach((c, k) => {
        const catKey = c.key || c.label;
        let catSvg = '';
        c.dist.forEach((d, i) => {
            Object.entries(d).forEach(([val, count]) => {
                if (!count) return;
                const r = Math.min(9, 2.6 + Math.sqrt(count) * 1.6);
                const px = cx(i) + offsets[k];
                const py = cy(Number(val));
                catSvg += `<g class="atd-bubble-hit" data-col="${i}" data-cat="${catKey}" data-val="${val}" data-count="${count}" style="pointer-events:none">
                    <circle class="atd-bubble" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r.toFixed(1)}" fill="${c.color}"></circle>
                    <text class="atd-bubble-label" x="${px.toFixed(1)}" y="${(py + 2.5).toFixed(1)}">${count}</text>
                </g>`;
            });
        });
        const pts = medians[k].map((m, i) => `${(cx(i) + offsets[k]).toFixed(1)},${cy(m).toFixed(1)}`).join(' ');
        catSvg += `<polyline class="atd-median-line" points="${pts}" stroke="${c.color}" fill="none"></polyline>`;
        medians[k].forEach((m, i) => {
            catSvg += `<circle class="atd-median-dot" cx="${(cx(i) + offsets[k]).toFixed(1)}" cy="${cy(m).toFixed(1)}" r="4" fill="#fff" stroke="${c.color}"></circle>`;
        });
        const visible = !(showUtamaCats && showUtamaCats[catKey] === false);
        svgParts += `<g id="${containerId}-g-utama-${catKey}" style="display:${visible ? 'block' : 'none'}">${catSvg}</g>`;
    });

    if (userOverlay && userOverlay.series) {
        const colorMap = { benar: '#16a34a', salah: '#dc2626', dijawab: '#2666b8' };
        ['benar', 'salah', 'dijawab'].forEach(k => {
            const vals = userOverlay.series[k] || [];
            let userSvg = '';
            const ptsArr = [];
            vals.forEach((v, i) => { if (v != null) ptsArr.push(`${cx(i).toFixed(1)},${cy(v).toFixed(1)}`); });
            if (ptsArr.length) userSvg += `<polyline class="atd-user-line" points="${ptsArr.join(' ')}" stroke="${colorMap[k]}" fill="none"></polyline>`;
            vals.forEach((v, i) => {
                if (v == null) return;
                const px = cx(i), py = cy(v);
                userSvg += `<rect class="atd-user-dot" x="${(px - 3.5).toFixed(1)}" y="${(py - 3.5).toFixed(1)}" width="7" height="7" fill="#fff" stroke="${colorMap[k]}"></rect>`;
            });
            const visible = !(showUserCats && showUserCats[k] === false);
            svgParts += `<g id="${containerId}-g-user-${k}" style="display:${visible ? 'block' : 'none'}">${userSvg}</g>`;
        });
    }

    const svg = `<svg class="atd-chart-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${svgParts}</svg>`;
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `
        <div class="atd-chart-head">
            <div><div class="atd-chart-title">${title}</div><div class="atd-chart-sub">${sub}</div></div>
            <div class="atd-chart-hint">Sentuh / arahkan kursor ke tiap kolom untuk lihat median & sebarannya</div>
        </div>
        <div class="atd-chart-svg-wrap">${svg}</div>
        <div class="atd-legend" id="${containerId}-legend"></div>
        ${hideAnalisaBtn ? '' : `<button class="atd-btn-analisa-grafik" onclick="_atdGoToGrafikDetail(event,'${kind}'${analisaBtnSoalKode ? ',' + JSON.stringify(String(analisaBtnSoalKode)) : ''})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
            Analisa
        </button>`}`;
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

function _atdSlicesFor(containerId, kind, idx) {
    // Kartu BARU (1 per soal, lihat komentar _atdChartPopupStore di atas)
    // titip datanya sendiri lewat _atdSetChartPopupData — pakai itu kalau
    // ada. Kartu LAMA (1 grafik per halaman) tidak pernah memanggil fungsi
    // itu, jadi otomatis fallback ke variabel global spt sebelumnya.
    const store = _atdChartPopupStore[containerId];
    if (kind === 'binary') {
        const s = (store && store.items) ? store.items[idx] : _ATD_DUMMY_BINARY[idx];
        const total = s.benar + s.salah;
        return {
            title: `Soal No. ${s.local != null ? s.local : s.nomor} · ${total} jawaban`,
            slices: [
                { label: 'Benar', value: s.benar, pct: total ? Math.round(s.benar / total * 100) : 0, color: '#16a34a' },
                { label: 'Salah', value: s.salah, pct: total ? Math.round(s.salah / total * 100) : 0, color: '#dc2626' }
            ]
        };
    }
    const sorted = (store && store.sortedPerSoal) ? store.sortedPerSoal[idx] : _atdSkorSortedPerSoal[idx];
    const seriesMeta = (store && store.seriesMeta) ? store.seriesMeta : _atdSkorSeriesMeta;
    const soalItem = (store && store.items) ? store.items[idx] : _ATD_DUMMY_SKOR[idx];
    const total = sorted.reduce((sum, o) => sum + (o ? o.jumlah : 0), 0);
    return {
        title: `Soal No. ${soalItem.local != null ? soalItem.local : soalItem.nomor} · ${total} jawaban`,
        slices: sorted.map((o, slot) => {
            const meta = seriesMeta[slot] || {};
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

function _atdRenderSikapStatPopup(containerId, idx) {
    const store = _atdChartPopupStore[containerId];
    const cats = (store && store.cats) ? store.cats : _atdSikapCats;
    const dist = (store && store.dist) ? store.dist : _atdSikapDist;
    const kolomLabel = cats[idx] || `#${idx + 1}`;
    const rows = dist.map(c => {
        const dist = c.dist[idx] || {};
        const entries = Object.entries(dist).map(([v, cnt]) => [Number(v), cnt]).filter(([, cnt]) => cnt > 0).sort((a, b) => a[0] - b[0]);
        const n = entries.reduce((s, [, cnt]) => s + cnt, 0);
        const min = entries.length ? entries[0][0] : 0;
        const max = entries.length ? entries[entries.length - 1][0] : 0;
        const median = _atdWeightedMedian(dist);
        const sd = _atdWeightedStdDev(dist);
        return `<div class="atd-pie-pop-row"><span class="atd-legend-dot" style="background:${c.color}"></span><span>${c.label}</span><b>Median ${median} <span class="atd-pie-pop-sd">· SD ${sd.toFixed(2)}</span></b></div>
                <div class="atd-pie-pop-sub">Rentang ${min}–${max} · n=${n} orang</div>`;
    }).join('');
    const pop = _atdGetPiePopEl();
    if (!pop) return;
    pop.innerHTML = `<div class="atd-pie-pop-title">Kolom ${kolomLabel}</div><div class="atd-pie-pop-body atd-pie-pop-body-stat">${rows}</div>`;
}

// #atd-pie-pop dipindah ke <body> (lihat komentar aslinya soal `transform`
// pada .page yg mengubah acuan `position:fixed`) — SETIAP halaman yang punya
// grafik (analisa-token-detail.html & analisa-soal-detail.html) WAJIB
// menaruh <div id="atd-pie-pop"> di markup-nya sendiri.
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
function _atdShowPie(evt, groupEl, containerId, kind, idx) {
    if (kind === 'sikap') {
        _atdRenderSikapStatPopup(containerId, idx);
    } else {
        const { title, slices } = _atdSlicesFor(containerId, kind, idx);
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
        g.addEventListener('mouseenter', e => _atdShowPie(e, g, containerId, kind, idx));
        g.addEventListener('mousemove', e => _atdPositionPiePopup(e));
        g.addEventListener('mouseleave', () => { if (_atdActiveGroup === g) _atdHidePie(); });
        g.addEventListener('click', e => {
            e.stopPropagation();
            if (_atdActiveGroup === g) { _atdHidePie(); return; }
            _atdShowPie(e, g, containerId, kind, idx);
        });
        g.addEventListener('touchstart', e => {
            e.stopPropagation();
            if (_atdActiveGroup === g) { _atdHidePie(); return; }
            _atdShowPie(e, g, containerId, kind, idx);
        }, { passive: true });
    });
    if (!window._atdDocCloseBound) {
        document.addEventListener('click', _atdHidePie);
        window._atdDocCloseBound = true;
    }
}

// ── RINGKASAN PER MATERI (baris lingkaran kecil di atas kartu "Grafik") ────
// Beda dgn _atdPieSvg/_atdSlicesFor di atas (donut POPUP hover, 1 nomor per
// grafik): ini menggabungkan SEMUA nomor yg materinya sama jadi 1 lingkaran
// ringkasan, dan KLIK-nya navigasi pindah halaman (bukan buka popup) — lihat
// pemanggilnya (_asdRenderMateriPies di analisa-soal-detail.js).
// `chartData` = charts.binary / charts.skor dari server (tiap entrinya kini
// py field `materi`, lihat computeAnalisaSoalAggregate di server.js). Soal
// yg butirnya belum ditandai materi (materi:null) DIABAIKAN (tidak dihitung,
// tidak dapat lingkaran) — sesuai desain.
function _atdComputeMateriAgg(materiList, chartData, kind) {
    const byId = {};
    (chartData || []).forEach(entry => {
        if (entry.materi == null) return;
        (byId[entry.materi] = byId[entry.materi] || []).push(entry);
    });
    return (materiList || [])
        .filter(m => byId[m.id] && byId[m.id].length)
        .map(m => {
            const entries = byId[m.id];
            if (kind === 'skor') {
                const nilaiMap = {};
                entries.forEach(e => (e.opsi || []).forEach(o => { nilaiMap[o.nilai] = (nilaiMap[o.nilai] || 0) + (o.jumlah || 0); }));
                const total = Object.values(nilaiMap).reduce((a, b) => a + b, 0);
                let zeroIdx = 0, nonZeroIdx = 0;
                const slices = Object.keys(nilaiMap).map(Number).sort((a, b) => b - a).map(nilai => {
                    const isZero = nilai === 0;
                    const color = isZero
                        ? _ATD_SKOR_ZERO_PALETTE[zeroIdx++ % _ATD_SKOR_ZERO_PALETTE.length]
                        : _ATD_SKOR_NONZERO_PALETTE[nonZeroIdx++ % _ATD_SKOR_NONZERO_PALETTE.length];
                    const value = nilaiMap[nilai];
                    return { label: `Nilai ${nilai}`, value, pct: total ? Math.round(value / total * 100) : 0, color };
                }).filter(sl => sl.value > 0);
                return { id: m.id, nama: m.nama, kind, total, jumlahSoal: entries.length, slices };
            }
            const benar = entries.reduce((a, e) => a + (e.benar || 0), 0);
            const salah = entries.reduce((a, e) => a + (e.salah || 0), 0);
            const total = benar + salah;
            const slices = [
                { label: 'Benar', value: benar, pct: total ? Math.round(benar / total * 100) : 0, color: '#16a34a' },
                { label: 'Salah', value: salah, pct: total ? Math.round(salah / total * 100) : 0, color: '#dc2626' }
            ];
            return { id: m.id, nama: m.nama, kind, total, jumlahSoal: entries.length, slices };
        });
}

// Donut kecil + label persentase kategori TERBESAR di tengah (beda dgn
// _atdPieSvg yg tanpa teks tengah, dipakai popup hover per-nomor di atas).
function _atdMateriPieSvg(slices) {
    const r = 15.9155;
    let cum = 0;
    const circles = (slices || []).map(s => {
        const dash = `${s.pct} ${100 - s.pct}`;
        const offset = 25 - cum;
        cum += s.pct;
        return `<circle cx="18" cy="18" r="${r}" fill="transparent" stroke="${s.color}" stroke-width="4.5" stroke-dasharray="${dash}" stroke-dashoffset="${offset}"></circle>`;
    }).join('');
    const top = (slices || []).slice().sort((a, b) => b.pct - a.pct)[0];
    return `<svg class="atd-materi-pie-svg" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">${circles}<text x="18" y="19.6" text-anchor="middle" class="atd-materi-pie-center">${top ? top.pct : 0}%</text></svg>`;
}

// `clickFn` = nama fungsi global (string) dipanggil dgn 1 argumen (index di
// array `materiAgg`) saat 1 lingkaran diklik — pemanggil (analisa-soal-
// detail.js) yg simpan array itu sendiri & tentukan mau navigasi ke mana.
function _atdMateriPieRowHtml(materiAgg, clickFn) {
    if (!materiAgg || !materiAgg.length) return '';
    const items = materiAgg.map((m, idx) => `
        <div class="atd-materi-pie-item" onclick="${clickFn}(${idx})" title="${_atdEsc(m.nama)}">
            ${_atdMateriPieSvg(m.slices)}
            <div class="atd-materi-pie-label">${_atdEsc(m.nama)}</div>
        </div>`).join('');
    return `<div class="atd-materi-pie-head">
            <div class="atd-chart-title">Ringkasan Per Materi</div>
            <div class="atd-chart-sub">Klik salah satu materi untuk lihat grafik per nomor materi itu</div>
        </div>
        <div class="atd-materi-pie-row">${items}</div>`;
}

function _atdEmptyChartCard(containerId, msg) {
    const el = document.getElementById(containerId);
    if (el) { el.style.display = ''; el.innerHTML = `<div class="empty-state" style="padding:24px"><p>${_atdEsc(msg)}</p></div>`; }
}

function _atdHideChartCard(containerId) {
    const el = document.getElementById(containerId);
    if (el) { el.style.display = 'none'; el.innerHTML = ''; }
}
