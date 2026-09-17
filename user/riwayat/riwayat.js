// user/riwayat.js
// Modul RIWAYAT — daftar riwayat ujian, detail per-laporan, filter tanggal, grafik. Lazy-load saat tab Riwayat dibuka.
// Bergantung pada helper global dari shell index_user.html (showToast, Auth, apiFetch,
// formatDate, goPage, dst) yang sudah dimuat lebih dulu.

// ── TOEFL: tabel konversi & fungsi skor (duplikat ringkas dari lib/toefl.js,
// PERSIS sama isinya — lihat file itu utk penjelasan lengkap & sumber tabel.
// Browser tidak bisa require() file Node, jadi angka ini WAJIB tetap disinkron
// manual kalau lib/toefl.js direvisi). ──
const _TOEFL_CONV = {
    listening: [24,25,26,27,28,29,30,31,32,32,33,35,37,38,39,41,41,42,43,44,45,45,46,47,47,48,48,49,49,50,51,51,52,52,53,54,54,55,56,57,57,58,59,60,61,62,63,65,66,67,68],
    structure: [20,20,21,22,23,25,26,27,29,31,33,35,36,37,38,40,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,60,61,63,65,67,68],
    reading:   [21,22,23,23,24,25,26,27,28,28,29,30,31,32,34,35,36,37,38,39,40,41,42,43,43,44,45,46,46,47,48,48,49,50,51,52,52,53,54,54,55,56,57,58,59,60,61,63,65,66,67]
};
const _TOEFL_MAXRAW = { listening: 50, structure: 40, reading: 50 };
function _toeflScaled(section, benar, totalSection) {
    const table = _TOEFL_CONV[section]; if (!table) return 0;
    const maxRaw = _TOEFL_MAXRAW[section];
    const total = totalSection > 0 ? totalSection : maxRaw;
    const idx = Math.max(0, Math.min(maxRaw, Math.round((benar / total) * maxRaw)));
    return table[idx];
}
const _TOEFL_CEFR = [
    { min: 627, level: 'C1', label: 'Advanced (Mahir)' },
    { min: 543, level: 'B2', label: 'Upper Intermediate' },
    { min: 433, level: 'B1', label: 'Intermediate' },
    { min: 343, level: 'A2', label: 'Elementary' },
    { min: 0,   level: '-',  label: 'Below A2 / Beginner' }
];
function _toeflCefr(total) { for (const row of _TOEFL_CEFR) if (total >= row.min) return row; return _TOEFL_CEFR[_TOEFL_CEFR.length-1]; }

async function loadRiwayat() {
    const grid = document.getElementById('history-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="empty-riwayat" style="grid-column:1/-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p>Memuat riwayat...</p></div>';
    try {
        _riwayatAll = await apiFetch('/user/riwayat');
        renderRiwayat();
    } catch(e) {
        grid.innerHTML = '<div class="empty-riwayat" style="grid-column:1/-1"><p>Gagal memuat: ' + e.message + '</p></div>';
    }
}

function renderRiwayat() {
    const grid = document.getElementById('history-grid');
    if (!grid) return;

    let data = [..._riwayatAll];
    const now = new Date();

    if (_filterMode === 'hari-ini') {
        const today = now.toISOString().slice(0, 10);
        data = data.filter(r => r.tgl_selesai === today);
    } else if (_filterMode === 'minggu') {
        const weekAgo = new Date(now - 7 * 86400000).toISOString().slice(0, 10);
        data = data.filter(r => r.tgl_selesai >= weekAgo);
    } else if (_filterMode === 'bulan') {
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().slice(0, 10);
        data = data.filter(r => r.tgl_selesai >= monthAgo);
    } else if (_filterMode === 'range' && _filterFrom && _filterTo) {
        data = data.filter(r => r.tgl_selesai >= _filterFrom && r.tgl_selesai <= _filterTo);
    }

    if (!data.length) {
        grid.innerHTML = '<div class="empty-riwayat" style="grid-column:1/-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p>Belum ada riwayat ujian</p></div>';
        return;
    }

    grid.innerHTML = data.map(r => {
        // PERBAIKAN: Tangani nilai null atau isNaN
        let valSkor = r.skor;
        if (valSkor == null || isNaN(valSkor)) valSkor = 0;
        else valSkor = Math.round(valSkor);

        const skorColor = valSkor >= 80 ? '#16a34a' : valSkor >= 60 ? '#d97706' : '#dc2626';
        return `
        <div class="glass history-box" style="cursor:default">
            <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px">
                <div style="flex:1;min-width:0">
                    <div class="history-box-title">${r.modul_nama || r.modul_kode}</div>
                    <div class="history-box-meta">
                        <span>${formatDate(r.tgl_selesai)}</span>
                        <span>·</span>
                        <span>⏱ ${r.waktu_pengerjaan}</span>
                    </div>
                </div>
                <div class="skor-circle" style="background:linear-gradient(135deg,${skorColor},${skorColor}cc)">${valSkor}</div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:space-between">
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                    <span class="history-badge">${r.token_kode}</span>
                    <span class="history-badge" style="background:${valSkor >= 60 ? 'rgba(22,163,74,.12)' : 'rgba(220,38,38,.1)'};color:${valSkor >= 60 ? '#16a34a' : '#dc2626'}">${valSkor >= 60 ? '✓ Lulus' : '✗ Tidak Lulus'}</span>
                </div>
                ${r.izinkan_review
                    ? `<button class="hasil-btn" onclick="loadRiwayatDetail('${r.kode}')">Lihat Hasil</button>`
                    : `<span class="history-badge" style="background:rgba(19,50,89,.06);color:var(--text-sub)">Review tidak diizinkan</span>`}
            </div>
        </div>`;
    }).join('');
}

function formatDate(s) {
    if (!s) return '-';
    const d = new Date(s);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function loadRiwayatDetail(kode) {
    try {
        const data = await apiFetch('/user/riwayat/' + kode);
        openRiwayatDetail(data);
    } catch(e) { showToast(e.message || 'Gagal memuat detail'); }
}

function openRiwayatDetail(data) {
    const { laporan, modul, soal } = data;
    const body = document.getElementById('riwayat-detail-body');
    const overlay = document.getElementById('riwayat-detail-overlay');

    const nilaiMin = modul?.nilai_minimum ?? null;

    // ── Hitung statistik detail dari data soal ──
    const jawabanUser = laporan.jawaban || {};
    let perSoal = {};
    let skData   = {};
    let toeflData = {};

    if (soal && soal.length > 0) {
        soal.forEach(s => {
            const kode = s.kode || s.id || s.nama;
            if (!perSoal[kode]) perSoal[kode] = { nama: s.nama, type: s.type, skor_type: s.skor_type || 'benar_salah', benar: 0, total: 0, nilaiDapat: 0, nilaiMaks: 0, dijawab: 0 };
            const data_soal = s.data || [];

            if (s.type === 'toefl') {
                if (!toeflData[kode]) {
                    const out = { nama: s.nama };
                    const src = (s.data && typeof s.data === 'object') ? s.data : {};
                    for (const section of ['listening', 'structure', 'reading']) {
                        const arr = (src[section] && Array.isArray(src[section].soal)) ? src[section].soal : [];
                        let benar = 0, dijawab = 0;
                        arr.forEach((q, i) => {
                            const ans = jawabanUser[`${kode}_toefl_${section}_${i}`];
                            if (ans == null || ans === '') return;
                            dijawab++;
                            const kunci = Array.isArray(q.kunci) ? q.kunci.map(String) : (q.kunci != null ? [String(q.kunci)] : []);
                            if (kunci.includes(String(ans))) benar++;
                        });
                        out[section] = { benar, dijawab, total: arr.length, scaled: arr.length > 0 ? _toeflScaled(section, benar, arr.length) : 0 };
                    }
                    const anyIsi = out.listening.total || out.structure.total || out.reading.total;
                    out.total = anyIsi ? Math.round(((out.listening.scaled + out.structure.scaled + out.reading.scaled) / 3) * 10) : 0;
                    out.cefr = anyIsi ? _toeflCefr(out.total) : null;
                    toeflData[kode] = out;
                }
                perSoal[kode].benar = ['listening','structure','reading'].reduce((a,sec)=>a+(toeflData[kode][sec]?.benar||0),0);
                perSoal[kode].total = ['listening','structure','reading'].reduce((a,sec)=>a+(toeflData[kode][sec]?.total||0),0);
                perSoal[kode].dijawab = ['listening','structure','reading'].reduce((a,sec)=>a+(toeflData[kode][sec]?.dijawab||0),0);
            } else if (s.type === 'sikap_kerja') {
                if (!skData[kode]) {
                    skData[kode] = { nama: s.nama, kolom: [] };
                    data_soal.forEach((kol, ki) => {
                        const stk = kode + '_' + ki;
                        let b = 0, sl = 0, dij = 0;
                        (kol.soal || []).forEach((_q, qi) => {
                            const ans = jawabanUser[stk + '_' + qi];
                            if (ans) { dij++; const k = _q.kunci_huruf || _q.kunci; if (ans === k) b++; else sl++; }
                        });
                        skData[kode].kolom.push({ total: dij, benar: b, salah: sl, totalSoal: (kol.soal || []).length });
                    });
                    perSoal[kode].benar = skData[kode].kolom.reduce((a, c) => a + c.benar, 0);
                    perSoal[kode].total = skData[kode].kolom.reduce((a, c) => a + c.totalSoal, 0);
                }
            } else {
                // MC & Linier
                const opsi = s.opsi_jawaban || 1;
                
                // Kumpulkan semua jawaban user untuk soalKode ini agar aman dari fitur acak_soal
                let allUserAns = [];
                Object.keys(jawabanUser).forEach(key => {
                    if (key.startsWith(kode + '_')) {
                        let ans = jawabanUser[key];
                        if (Array.isArray(ans)) allUserAns.push(...ans);
                        else if (ans != null) allUserAns.push(ans);
                    }
                });

                data_soal.forEach((q, qi) => {
                    let ans = null;
                    const jawaban = q.jawaban || [];
                    
                    if (jawabanUser[q.id]) {
                        ans = jawabanUser[q.id];
                    } else {
                        // Cocokkan ID jawaban unik untuk menemukan soal aslinya, tidak peduli urutannya diacak
                        let matchedAns = allUserAns.filter(ansId => jawaban.some(j => (j.id != null ? String(j.id) : null) === String(ansId)));
                        if (matchedAns.length > 0) {
                            ans = matchedAns.length === 1 ? matchedAns[0] : matchedAns;
                        } else {
                            ans = jawabanUser[kode + '_' + qi];
                        }
                    }

                    perSoal[kode].total++;

                    if (s.skor_type === 'nilai_sendiri') {
                        const maks = [...jawaban].map(j => parseFloat(j.nilai) || 0).sort((a,b) => b-a).slice(0, opsi).reduce((a,v) => a+v, 0);
                        perSoal[kode].nilaiMaks += maks;
                        
                        if (ans) {
                            perSoal[kode].dijawab++;
                            const ids = Array.isArray(ans) ? ans : [ans];
                            const dapat = ids.reduce((s2, pid) => { 
                                const j = jawaban.find((jj, idx) => (jj.id != null ? String(jj.id) : String(idx)) === String(pid));
                                return s2 + (parseFloat(j?.nilai) || 0); 
                            }, 0);
                            perSoal[kode].nilaiDapat += dapat;
                            if (dapat > 0) perSoal[kode].benar++;
                        }
                    } else {
                        const kunci = q.kunci || [];
                        if (ans) {
                            perSoal[kode].dijawab++;
                            const a = Array.isArray(ans) ? ans : [ans];
                            const benar = Array.isArray(kunci) ? (kunci.every(k => a.includes(String(k))) && a.length === kunci.length) : a.includes(String(kunci));
                            if (benar) perSoal[kode].benar++;
                        }
                    }
                });
            }
        });
    }

    // Hitung skor per modul (per kelompok)
    const perSoalArr = Object.entries(perSoal).map(([k, v]) => {
        let sk = v.skor_type === 'nilai_sendiri'
            ? (v.nilaiMaks > 0 ? Math.round(v.nilaiDapat / v.nilaiMaks * 100) : 0)
            : (v.total > 0 ? Math.round(v.benar / v.total * 100) : 0);
        return { ...v, soalKode: k, skor: sk };
    });

    // ── Pisahkan dan Rapihkan Stat Tabel ──
    const mcArr = perSoalArr.filter(s => s.type !== 'sikap_kerja' && s.type !== 'toefl');
    let totBenar_BS = 0, totSalah_BS = 0, totSoal_BS = 0;
    let totNilai_NS = 0, totMaks_NS = 0, totSoal_NS = 0;
    let totDijawab_All = 0;

    mcArr.forEach(s => {
        totDijawab_All += s.dijawab;
        if (s.skor_type === 'nilai_sendiri') {
            totNilai_NS += s.nilaiDapat;
            totMaks_NS += s.nilaiMaks;
            totSoal_NS += s.total;
        } else {
            totBenar_BS += s.benar;
            totSoal_BS += s.total;
            totSalah_BS += (s.dijawab - s.benar); // "Salah" hanya dihitung dari soal yang DIJAWAB tetapi keliru
        }
    });

    const totalSoal_All = totSoal_BS + totSoal_NS;
    const tidakDijawab_All = totalSoal_All - totDijawab_All;

    // Fallback total soal/dijawab kalau modul HANYA berisi TOEFL (mcArr kosong,
    // sama pola dgn hasil.js — lihat toeflTotalSoal/toeflTotalDijawab di sana).
    let toeflTotSoal = 0, toeflTotDijawab = 0;
    Object.values(toeflData).forEach(t => {
        ['listening','structure','reading'].forEach(sec => { toeflTotSoal += t[sec].total; toeflTotDijawab += t[sec].dijawab; });
    });
    const totalSoalTampil = totalSoal_All > 0 ? totalSoal_All : toeflTotSoal;
    const tidakDijawabTampil = totalSoal_All > 0 ? tidakDijawab_All : (toeflTotSoal - toeflTotDijawab);

    // Kalkulasi skor akhir backup
    let computedSkor = 0;
    if(totSoal_BS > 0 && totMaks_NS > 0) computedSkor = Math.round(((totBenar_BS / totSoal_BS * 100) + (totNilai_NS / totMaks_NS * 100)) / 2);
    else if(totSoal_BS > 0) computedSkor = Math.round(totBenar_BS / totSoal_BS * 100);
    else if(totMaks_NS > 0) computedSkor = Math.round(totNilai_NS / totMaks_NS * 100);

    const skor = (laporan.skor == null || isNaN(laporan.skor)) ? computedSkor : Math.round(laporan.skor);
    const lulus = nilaiMin != null ? skor >= nilaiMin : skor >= 60;
    const lulusTxt = lulus ? '✓ LULUS' : '✗ TIDAK LULUS';
    const lulusColor = lulus ? 'rgba(22,163,74,.25)' : 'rgba(220,38,38,.25)';
    const lulusTextColor = lulus ? '#4ade80' : '#f87171';
    // Modul TANPA soal MC/Linier/nilai_sendiri sama sekali (murni TOEFL dan/atau
    // Sikap Kerja): skor 0-100 di atas tidak relevan (skala TOEFL beda total,
    // Sikap Kerja tidak ada konsep skor tunggal) — sembunyikan hero besar &
    // badge lulus/tidak-lulus supaya tidak menampilkan angka 0 yang menyesatkan
    // (lihat pola yang sama di ujian/hasil.js:tampilHasil > adaSoalScored).
    const adaSoalScored = mcArr.length > 0;
    const skorBigHtml = adaSoalScored
        ? `<div class="rd-skor-big" style="color:${skor >= 80 ? '#4ade80' : skor >= 60 ? '#fbbf24' : '#f87171'}">${skor}</div>
           <div class="rd-skor-lbl">Skor Akhir</div>`
        : '';
    const lulusChipHtml = adaSoalScored
        ? `<div><span class="rd-lulus-chip" style="background:${lulusColor};color:${lulusTextColor};border:1px solid ${lulusTextColor}40">${lulusTxt}${nilaiMin != null ? ' · KKM ' + nilaiMin : ''}</span></div>`
        : '';

    // ── BUILD HTML ──
    let html = `<div class="rd-hero" style="position:relative">
        <button class="rd-close-btn" onclick="document.getElementById('riwayat-detail-overlay').classList.remove('open')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        ${skorBigHtml}
        <div class="rd-modul-nm">${modul?.nama || laporan.modul_kode || '-'}</div>
        <div class="rd-meta">
            <span>📅 ${formatDate(laporan.tgl_selesai)}</span>
            <span>⏱ ${laporan.waktu_pengerjaan || '-'}</span>
            ${laporan.token_kode ? `<span>🎫 ${laporan.token_kode}</span>` : ''}
        </div>
        ${lulusChipHtml}
    </div>
    <div class="rd-body">`;

    // Render Stat Grid secara spesifik tergantung tipe soal
    let statHtml = '';
    if (totSoal_BS > 0) {
        statHtml += `<div class="rd-stat-card"><div class="rd-stat-val">${totBenar_BS}</div><div class="rd-stat-lbl">Jawaban Benar</div></div>`;
        statHtml += `<div class="rd-stat-card"><div class="rd-stat-val">${totSalah_BS}</div><div class="rd-stat-lbl">Jawaban Salah</div></div>`;
    }
    if (totSoal_NS > 0) {
        statHtml += `<div class="rd-stat-card"><div class="rd-stat-val" style="font-size:18px">${totNilai_NS.toFixed(1)}</div><div class="rd-stat-lbl">Nilai Didapat</div></div>`;
        statHtml += `<div class="rd-stat-card"><div class="rd-stat-val" style="font-size:18px">${totMaks_NS.toFixed(1)}</div><div class="rd-stat-lbl">Nilai Maks</div></div>`;
    }
    statHtml += `<div class="rd-stat-card"><div class="rd-stat-val">${tidakDijawabTampil}</div><div class="rd-stat-lbl">Tidak Dijawab</div></div>`;
    statHtml += `<div class="rd-stat-card"><div class="rd-stat-val">${totalSoalTampil}</div><div class="rd-stat-lbl">Total Soal</div></div>`;
    
    html += `<div class="rd-stat-grid">${statHtml}</div>`;

    // Nilai Per Bagian (MC/Linier)
    if (mcArr.length > 0) {
        html += `<div class="rd-sec-ttl">Nilai Per Bagian</div><div class="rd-soal-grid">`;
        mcArr.forEach(s => {
            const isNS = s.skor_type === 'nilai_sendiri';
            const badge = isNS ? `<div style="font-size:9px;font-weight:700;color:var(--accent);background:rgba(26,90,160,.1);padding:2px 7px;border-radius:10px;margin-bottom:4px;display:inline-block">Nilai per Jawaban</div>` : '';
            const sub = isNS
                ? `<div style="font-size:11px;color:var(--text-sub);margin-top:2px">${s.nilaiDapat.toFixed(1)} / ${s.nilaiMaks.toFixed(1)} nilai</div>`
                : `<div style="font-size:11px;color:var(--text-sub);margin-top:2px">${s.benar}/${s.total} benar</div>`;
            html += `<div class="rd-soal-card">${badge}<div class="rd-soal-nm">${s.nama}</div><div class="rd-soal-sk ${s.skor >= 60 ? 'ok' : 'no'}">${s.skor}<span style="font-size:13px;font-weight:500">/100</span></div>${sub}</div>`;
        });
        html += `</div>`;
    }

    // Kartu Skor TOEFL — skala resmi ITP (310-677), per section + level CEFR
    const toeflEntries = Object.entries(toeflData);
    if (toeflEntries.length > 0) {
        const secLbl = { listening: 'Listening', structure: 'Structure', reading: 'Reading' };
        toeflEntries.forEach(([kode, t]) => {
            html += `<div class="rd-sec-ttl" style="margin-top:18px">Skor TOEFL — ${t.nama}</div>
            <div style="text-align:center;margin:14px 0">
                <div style="font-size:38px;font-weight:800;color:var(--accent);font-family:var(--font-head)">${t.total}</div>
                <div style="font-size:11px;color:var(--text-sub);margin-top:2px">Skor Total (skala 310–677)${t.cefr ? ` &nbsp;·&nbsp; Level ${t.cefr.level} (${t.cefr.label})` : ''}</div>
            </div>
            <div class="rd-soal-grid">
                ${['listening','structure','reading'].map(sec => `
                    <div class="rd-soal-card">
                        <div class="rd-soal-nm">${secLbl[sec]}</div>
                        <div class="rd-soal-sk ok">${t[sec].scaled}</div>
                        <div style="font-size:11px;color:var(--text-sub);margin-top:2px">${t[sec].benar}/${t[sec].total} benar</div>
                    </div>`).join('')}
            </div>`;
        });
    }

    // Grafik Sikap Kerja
    const skEntries = Object.entries(skData);
    if (skEntries.length > 0) {
        skEntries.forEach(([kode, sk]) => {
            const kols = sk.kolom;
            const n = kols.length || 1;
            const maxD = Math.max(...kols.map(k => k.total), 0), maxB = Math.max(...kols.map(k => k.benar), 0), maxSl = Math.max(...kols.map(k => k.salah), 0);
            const avgD  = Math.round(kols.reduce((a, c) => a + c.total, 0) / n), avgB  = Math.round(kols.reduce((a, c) => a + c.benar, 0) / n), avgSl = Math.round(kols.reduce((a, c) => a + c.salah, 0) / n);

            html += `<div class="rd-sec-ttl" style="margin-top:18px">Grafik Sikap Kerja — ${sk.nama}</div>`;
            html += `<div class="rd-chart-wrap"><canvas id="rd-skc-${kode}" style="width:100%;max-height:200px;display:block"></canvas></div>`;
            html += `<div class="rd-sk-stats">
                <div class="rd-sk-stat"><div class="rd-sk-stat-val">${maxD}</div><div class="rd-sk-stat-lbl">Dijawab Terbanyak</div></div>
                <div class="rd-sk-stat"><div class="rd-sk-stat-val">${avgD}</div><div class="rd-sk-stat-lbl">Rata-rata Dijawab</div></div>
                <div class="rd-sk-stat"><div class="rd-sk-stat-val" style="color:var(--success)">${maxB}</div><div class="rd-sk-stat-lbl">Benar Terbanyak</div></div>
                <div class="rd-sk-stat"><div class="rd-sk-stat-val" style="color:var(--success)">${avgB}</div><div class="rd-sk-stat-lbl">Rata-rata Benar</div></div>
                <div class="rd-sk-stat"><div class="rd-sk-stat-val" style="color:var(--danger)">${maxSl}</div><div class="rd-sk-stat-lbl">Salah Terbanyak</div></div>
                <div class="rd-sk-stat"><div class="rd-sk-stat-val" style="color:var(--danger)">${avgSl}</div><div class="rd-sk-stat-lbl">Rata-rata Salah</div></div>
            </div>`;
        });
    }

    // ── Detail Review Per Soal (pertanyaan, opsi+kunci/nilai, jawaban saya, pembahasan) ──
    const mcSoalDetail = (soal || []).filter(s => s.type !== 'sikap_kerja' && s.type !== 'toefl');
    if (mcSoalDetail.length > 0) {
        html += `<div class="rd-sec-ttl" style="margin-top:18px">Detail Review Jawaban</div>`;
        mcSoalDetail.forEach(s => { html += _buildRiwayatSoalBlock(s, jawabanUser, laporan.urutan_tampil); });
    }

    // Detail Review khusus TOEFL (per section, dgn audio & bacaan)
    const toeflSoalDetail = (soal || []).filter(s => s.type === 'toefl');
    if (toeflSoalDetail.length > 0) {
        html += `<div class="rd-sec-ttl" style="margin-top:18px">Detail Review TOEFL</div>`;
        toeflSoalDetail.forEach(s => { html += _buildRiwayatToeflBlock(s, jawabanUser, laporan.urutan_tampil); });
    }

    html += `</div>`; 

    body.innerHTML = html;
    overlay.classList.add('open');

    // Rendering grafik Canvas jika ada Sikap Kerja
    if (skEntries.length > 0) {
        setTimeout(() => {
            skEntries.forEach(([kode, sk]) => rdDrawChart('rd-skc-' + kode, sk.kolom));
        }, 80);
    }
}

// Terapkan urutan tampil (acak soal & acak jawaban) tersimpan dari sesi ujian,
// supaya tampilan review persis sama seperti yang dilihat peserta saat ujian.
function _applyUrutanTampil(dataSoal, ord) {
    const list = dataSoal || [];
    if (!ord || !Array.isArray(ord.qOrder) || !ord.qOrder.length) {
        return list.map((q, i) => ({ ...q, __qIdx: i }));
    }
    return ord.qOrder.filter(qi => list[qi]).map(qi => {
        const orig = list[qi];
        const optKey = orig.jawaban ? 'jawaban' : (orig.opsi ? 'opsi' : null);
        const q = { ...orig, __qIdx: qi };
        const jo = ord.jawOrder && ord.jawOrder[qi];
        if (optKey && Array.isArray(jo) && jo.length) {
            const opts = orig[optKey] || [];
            const ordered = jo.map(ref => opts.find((o, oi) => (o.id != null ? o.id : oi) === ref)).filter(Boolean);
            opts.forEach(o => { if (!ordered.includes(o)) ordered.push(o); }); // jaring pengaman
            q[optKey] = ordered;
        }
        return q;
    });
}

// Bangun blok HTML review 1 paket soal untuk peserta: pertanyaan, opsi jawaban + kunci/nilai,
// jawaban saya, dan pembahasan.
function _buildRiwayatSoalBlock(s, jawabanUser, urutanTampil) {
    const kode = s.kode || s.id || s.nama;
    const dataSoalRaw = typeof s.data === 'string' ? (JSON.parse(s.data || '[]') || []) : (s.data || []);
    const isNS = s.skor_type === 'nilai_sendiri';
    const ord = urutanTampil && urutanTampil[kode];
    const dataSoal = _applyUrutanTampil(dataSoalRaw, ord);

    let allUserAns = [];
    Object.keys(jawabanUser || {}).forEach(key => {
        if (key.startsWith(kode + '_')) {
            const a = jawabanUser[key];
            if (Array.isArray(a)) allUserAns.push(...a); else if (a != null) allUserAns.push(a);
        }
    });

    const qHtml = dataSoal.map((q, displayIdx) => {
        const qi = q.__qIdx;
        const qText = q.soal || q.pertanyaan || '';
        const opsi = q.jawaban || q.opsi || [];
        const validJids = opsi.map((j, i) => j.id != null ? String(j.id) : String(i));

        let userAns = [];
        if (jawabanUser[q.id]) {
            const a = jawabanUser[q.id];
            userAns = Array.isArray(a) ? a.map(String) : [String(a)];
        } else {
            userAns = allUserAns.map(String).filter(a => validJids.includes(a));
            if (!userAns.length && jawabanUser[kode + '_' + qi] != null) {
                const fb = jawabanUser[kode + '_' + qi];
                userAns = Array.isArray(fb) ? fb.map(String) : [String(fb)];
            }
        }

        const kunci = Array.isArray(q.kunci) ? q.kunci.map(String) : (q.kunci != null ? [String(q.kunci)] : []);

        const optHtml = opsi.map((j, i) => {
            const letter = String.fromCharCode(65 + i);
            const jid = j.id != null ? String(j.id) : String(i);
            const picked = userAns.includes(jid);
            let border = 'rgba(19,50,89,0.12)', bg = 'transparent', badge = '';
            if (isNS) {
                const nilai = j.nilai || 0;
                if (picked) { border = 'var(--accent)'; bg = 'rgba(26,90,160,0.07)'; badge = `<span style="margin-left:auto;font-size:10px;font-weight:700;color:var(--accent)">Jawaban saya · ${nilai} poin</span>`; }
                else badge = `<span style="margin-left:auto;font-size:10px;color:var(--text-sub)">${nilai} poin</span>`;
            } else {
                const isKey = kunci.includes(jid);
                if (picked && isKey) { border = 'var(--success)'; bg = 'rgba(22,163,74,0.08)'; badge = '<span style="margin-left:auto;font-size:10px;font-weight:700;color:var(--success)">✓ Jawaban saya (Benar)</span>'; }
                else if (picked && !isKey) { border = 'var(--danger)'; bg = 'rgba(220,38,38,0.07)'; badge = '<span style="margin-left:auto;font-size:10px;font-weight:700;color:var(--danger)">✗ Jawaban saya (Salah)</span>'; }
                else if (!picked && isKey) { border = '#d97706'; bg = 'rgba(217,119,6,0.07)'; badge = '<span style="margin-left:auto;font-size:10px;font-weight:700;color:#d97706">Kunci Jawaban</span>'; }
            }
            return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1.5px solid ${border};background:${bg};border-radius:8px;margin-bottom:5px">
                <span style="font-weight:700;font-size:12px;color:var(--blue)">${letter}.</span>
                <span style="font-size:13px;flex:1;min-width:0;overflow-wrap:break-word">${j.teks || j.value || '-'}</span>
                ${badge}
            </div>`;
        }).join('');

        const pembahasan = q.pembahasan ? `<div style="background:rgba(26,90,160,0.05);border:1.5px solid rgba(26,90,160,0.12);border-radius:8px;padding:10px;margin-top:6px">
            <div style="font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;margin-bottom:4px">💡 Pembahasan</div>
            <div style="font-size:12px;line-height:1.6">${q.pembahasan}</div>
        </div>` : '';

        return `<div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid rgba(19,50,89,0.06)">
            <div style="font-size:13px;font-weight:600;margin-bottom:8px">${displayIdx + 1}. ${qText}</div>
            ${optHtml}
            ${pembahasan}
        </div>`;
    }).join('');

    return `<div class="rd-soal-card" style="text-align:left;margin-bottom:12px">
        <div style="font-weight:700;color:var(--blue);margin-bottom:10px">${s.nama}${isNS ? ' <span style="font-size:9px;font-weight:700;color:var(--accent);background:rgba(26,90,160,.1);padding:2px 7px;border-radius:10px;margin-left:6px">Nilai per Jawaban</span>' : ''}</div>
        ${qHtml || '<div style="font-size:12px;color:var(--text-sub)">Tidak ada soal.</div>'}
    </div>`;
}

// Bangun blok HTML review 1 paket soal TOEFL untuk peserta: 3 section
// (Listening/Structure/Reading), masing2 dgn pertanyaan, kunci, jawaban
// peserta, plus audio player (Listening) & bacaan (Reading). Urutan tampil
// direkonstruksi dari laporan.urutan_tampil (lihat buildUrutanTampil() &
// toeflAnswerKey() di ujian/ujian.html) supaya identik dgn yg dilihat peserta.
function _buildRiwayatToeflBlock(s, jawabanUser, urutanTampil) {
    const kode = s.kode || s.id || s.nama;
    const src = (s.data && typeof s.data === 'object') ? s.data : {};
    const ord = (urutanTampil && urutanTampil[kode] && urutanTampil[kode].toefl) || null;
    const secLbl = { listening: '🎧 Listening', structure: '📝 Structure', reading: '📖 Reading' };

    const sectionsHtml = ['listening','structure','reading'].map(section => {
        const rawArr = (src[section] && Array.isArray(src[section].soal)) ? src[section].soal : [];
        if (!rawArr.length) return '';
        const order = (ord && Array.isArray(ord[section]) && ord[section].length) ? ord[section] : rawArr.map((_,i)=>i);
        const passages = (src.reading && Array.isArray(src.reading.passages)) ? src.reading.passages : [];

        const qHtml = order.map((origIdx, displayIdx) => {
            const q = rawArr[origIdx]; if (!q) return '';
            const ans = jawabanUser[`${kode}_toefl_${section}_${origIdx}`];
            const kunci = Array.isArray(q.kunci) ? q.kunci.map(String) : (q.kunci != null ? [String(q.kunci)] : []);

            const audioHtml = (section === 'listening' && q.audio_url)
                ? `<audio controls src="${String(q.audio_url).replace(/"/g,'&quot;')}" style="width:100%;margin-bottom:8px"></audio>` : '';
            let passageHtml = '';
            if (section === 'reading' && q.passage_id) {
                const p = passages.find(x => x.id === q.passage_id);
                if (p) passageHtml = `<div style="background:rgba(19,50,89,0.04);border-radius:8px;padding:10px;margin-bottom:8px;font-size:12px;line-height:1.6"><div style="font-weight:700;margin-bottom:4px">${(p.judul||'').replace(/</g,'&lt;')}</div>${(p.teks||'').replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div>`;
            }
            const subtipeLbl = section === 'structure' ? (q.subtipe === 'salah' ? ' <span style="font-size:9px;color:var(--text-sub)">(Cari Kesalahan)</span>' : ' <span style="font-size:9px;color:var(--text-sub)">(Melengkapi Kalimat)</span>') : '';

            const optHtml = (q.jawaban || []).map((j, i) => {
                const letter = String.fromCharCode(65 + i);
                const jid = j.id != null ? String(j.id) : String(i);
                const picked = ans != null && String(ans) === jid;
                const isKey = kunci.includes(jid);
                let border = 'rgba(19,50,89,0.12)', bg = 'transparent', badge = '';
                if (picked && isKey) { border = 'var(--success)'; bg = 'rgba(22,163,74,0.08)'; badge = '<span style="margin-left:auto;font-size:10px;font-weight:700;color:var(--success)">✓ Jawaban saya (Benar)</span>'; }
                else if (picked && !isKey) { border = 'var(--danger)'; bg = 'rgba(220,38,38,0.07)'; badge = '<span style="margin-left:auto;font-size:10px;font-weight:700;color:var(--danger)">✗ Jawaban saya (Salah)</span>'; }
                else if (!picked && isKey) { border = '#d97706'; bg = 'rgba(217,119,6,0.07)'; badge = '<span style="margin-left:auto;font-size:10px;font-weight:700;color:#d97706">Kunci Jawaban</span>'; }
                return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1.5px solid ${border};background:${bg};border-radius:8px;margin-bottom:5px">
                    <span style="font-weight:700;font-size:12px;color:var(--blue)">${letter}.</span>
                    <span style="font-size:13px;flex:1;min-width:0;overflow-wrap:break-word">${j.teks || '-'}</span>
                    ${badge}
                </div>`;
            }).join('');

            return `<div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid rgba(19,50,89,0.06)">
                <div style="font-size:13px;font-weight:600;margin-bottom:8px">${displayIdx + 1}. ${(q.pertanyaan||'').replace(/</g,'&lt;')}${subtipeLbl}</div>
                ${audioHtml}${passageHtml}${optHtml}
            </div>`;
        }).join('');

        return `<div style="margin-bottom:16px">
            <div style="font-weight:700;color:var(--blue);margin-bottom:8px;font-size:13px">${secLbl[section]}</div>
            ${qHtml}
        </div>`;
    }).join('');

    return `<div class="rd-soal-card" style="text-align:left;margin-bottom:12px">
        <div style="font-weight:700;color:var(--blue);margin-bottom:10px">${s.nama}</div>
        ${sectionsHtml || '<div style="font-size:12px;color:var(--text-sub)">Tidak ada soal.</div>'}
    </div>`;
}

function rdDrawChart(id, kolom) {
    const c = document.getElementById(id); if (!c) return;
    const ctx = c.getContext('2d'), W = c.offsetWidth || 560, H = 200;
    c.width = W; c.height = H;
    const pad = { t: 16, r: 14, b: 30, l: 30 };
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b, n = kolom.length;
    const all = kolom.flatMap(k => [k.total, k.benar, k.salah]);
    const maxV = Math.max(...all, 1);
    const sx = pw / (n - 1 || 1);
    ctx.clearRect(0, 0, W, H);
    // Grid lines
    for (let i = 0; i <= 4; i++) {
        const y = pad.t + ph - (i / 4) * ph;
        ctx.strokeStyle = 'rgba(19,50,89,.06)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke();
        ctx.fillStyle = 'rgba(19,50,89,.35)'; ctx.font = '9px DM Sans';
        ctx.fillText(Math.round(maxV * i / 4), 2, y + 3);
    }
    // Lines
    [['total', '#1a5aa0', 'Dijawab'], ['benar', '#16a34a', 'Benar'], ['salah', '#dc2626', 'Salah']].forEach(([k, col]) => {
        ctx.beginPath(); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
        kolom.forEach((kl, i) => { const x = pad.l + i * sx, y = pad.t + ph - (kl[k] / maxV) * ph; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
        ctx.stroke();
        kolom.forEach((kl, i) => { const x = pad.l + i * sx, y = pad.t + ph - (kl[k] / maxV) * ph; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); });
    });
    // X labels
    ctx.fillStyle = 'rgba(19,50,89,.45)'; ctx.font = '9px DM Sans'; ctx.textAlign = 'center';
    kolom.forEach((_, i) => ctx.fillText('K' + (i + 1), pad.l + i * sx, H - 6));
    // Legend
    let lx = pad.l;
    [['Dijawab', '#1a5aa0'], ['Benar', '#16a34a'], ['Salah', '#dc2626']].forEach(([lb, col]) => {
        ctx.fillStyle = col; ctx.fillRect(lx, 4, 14, 2.5);
        ctx.fillStyle = 'rgba(19,50,89,.5)'; ctx.font = '9px DM Sans'; ctx.textAlign = 'left';
        ctx.fillText(lb, lx + 17, 10); lx += 72;
    });
}

/* ─── FILTER ─── */
function toggleFilter() {
    document.getElementById('filter-dropdown').classList.toggle('open');
    document.addEventListener('click', function close(e) {
        if (!e.target.closest('.filter-btn') && !e.target.closest('.filter-dropdown')) {
            document.getElementById('filter-dropdown').classList.remove('open');
            document.removeEventListener('click', close);
        }
    }, { once: false });
}

function applyFilter(mode, el) {
    _filterMode = mode;
    document.querySelectorAll('.filter-opt').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('filter-dropdown').classList.remove('open');
    renderRiwayat();
}

function openDateRange()  { document.getElementById('daterange-overlay').classList.add('open'); document.getElementById('filter-dropdown').classList.remove('open'); }
function closeDateRange() { document.getElementById('daterange-overlay').classList.remove('open'); }

function applyDateRange() {
    _filterFrom = document.getElementById('date-from').value;
    _filterTo   = document.getElementById('date-to').value;
    if (!_filterFrom || !_filterTo) { showToast('Pilih tanggal dari dan sampai'); return; }
    _filterMode = 'range';
    closeDateRange();
    renderRiwayat();
}

/* ── RESPONSIVE DOCK OVERFLOW (sama seperti admin) ── */