// review/riwayat.js
// Modul RIWAYAT — fitur utama: lihat riwayat ujian user, buka laporan, review per-soal,
// review-ujian (tampilan mirip ujian.html), dan unduh laporan (Word/Excel/ZIP grup).
// Semua digabung 1 bundel JS karena saling panggil fungsi satu sama lain.
// Bergantung pada helper global dari shell index_review.html yang sudah dimuat lebih dulu.

async function openRiwayatUser(userKode, nama) {
  _currentUserKode = userKode;
  document.getElementById('rwu-title').textContent = `Riwayat — ${nama}`;
  document.getElementById('rwu-body').innerHTML = '<div class="empty-state"><div class="spinner" style="width:24px;height:24px;margin:0 auto 8px;border-width:2px"></div><p>Memuat...</p></div>';
  openModal('riwayat-user-overlay');
  try {
    const laporan = await apiFetch(`/review/laporan/${userKode}`).catch(() => []);
    if (!laporan.length) {
      document.getElementById('rwu-body').innerHTML = '<div class="empty-state"><p>Belum ada riwayat ujian</p></div>';
      return;
    }
    document.getElementById('rwu-body').innerHTML = laporan.map((l, i) => `
      <div class="lap-soal-item" style="animation:fadeUp 0.2s ${i*0.04}s both">
        <div onclick="openLaporan('${l.kode||l.id}','${(l.modul_nama||l.modul_kode||'Ujian').replace(/'/g,'\\\'')}')" style="flex:1;cursor:pointer">
          <div class="lap-soal-name">${l.modul_nama || l.modul_kode || 'Modul'}</div>
          <div style="font-size:11px;color:var(--text-sub)">${formatDateTime(l.tgl_selesai || l.created_at)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="lap-soal-skor ${(l.skor||0)>=60?'ok':'no'}">${Math.round(l.skor||0)}</div>
          <button class="btn btn-primary btn-sm" onclick="openReviewUjian('${l.kode||l.id}','${(l.modul_nama||l.modul_kode||'Ujian').replace(/'/g,'\\\'').replace(/"/g,'&quot;')}','${(_currentUserKode||'User').replace(/'/g,'\\\'')}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Review
          </button>
          <button class="btn btn-secondary btn-sm" onclick="openLaporan('${l.kode||l.id}','${(l.modul_nama||l.modul_kode||'Ujian').replace(/'/g,'\\\'')}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><polyline points="9 18 15 12 9 6"/></svg>
            Laporan
          </button>
        </div>
      </div>`).join('');
  } catch (e) {
    document.getElementById('rwu-body').innerHTML = '<div class="empty-state"><p>Gagal memuat riwayat</p></div>';
  }
}

/* ── LAPORAN DETAIL ── */
let _currentLaporan = null;
async function openLaporan(laporanKode, modulNama) {
  document.getElementById('lap-title').textContent = modulNama;
  document.getElementById('lap-body').innerHTML = '<div class="empty-state"><div class="spinner" style="width:24px;height:24px;margin:0 auto 8px;border-width:2px"></div><p>Memuat laporan...</p></div>';
  openModal('laporan-overlay');
  try {
    const lap = await apiFetch(`/laporan/${laporanKode}`).catch(() => null);
    if (!lap) { document.getElementById('lap-body').innerHTML = '<div class="empty-state"><p>Data tidak ditemukan</p></div>'; return; }
    _currentLaporan = lap;
    renderLaporanDetail(lap);
  } catch (e) {
    document.getElementById('lap-body').innerHTML = '<div class="empty-state"><p>Gagal memuat</p></div>';
  }
}

function renderLaporanDetail(lap) {
  const jawaban = typeof lap.jawaban === 'string' ? JSON.parse(lap.jawaban) : (lap.jawaban || {});
  const soalList = lap.soal_detail || []; 
  
  const { perSoal, skData } = hitungSkorFromLap(soalList, jawaban);
  
  const mcArr = perSoal.filter(s => s.type !== 'sikap_kerja');
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
          totSalah_BS += (s.dijawab - s.benar);
      }
  });

  const totalSoal_All = totSoal_BS + totSoal_NS;
  const tidakDijawab_All = totalSoal_All - totDijawab_All;

  // Skor Akhir Fallback (jika di DB nilainya NaN/Null)
  let computedSkor = 0;
  if(totSoal_BS > 0 && totMaks_NS > 0) computedSkor = Math.round(((totBenar_BS / totSoal_BS * 100) + (totNilai_NS / totMaks_NS * 100)) / 2);
  else if(totSoal_BS > 0) computedSkor = Math.round(totBenar_BS / totSoal_BS * 100);
  else if(totMaks_NS > 0) computedSkor = Math.round(totNilai_NS / totMaks_NS * 100);

  const skor = (lap.skor == null || isNaN(lap.skor)) ? computedSkor : Math.round(lap.skor);

  let html = `
    <div class="lap-skor-big">${skor}</div>
    <div class="lap-skor-sub">Skor Akhir · ${formatDateTime(lap.tgl_selesai || lap.created_at)}</div>
    <div class="lap-cards" style="grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));">`;
    
  if (totSoal_BS > 0) {
      html += `<div class="lap-card"><div class="lap-card-val">${totBenar_BS}</div><div class="lap-card-label">Benar</div></div>`;
      html += `<div class="lap-card"><div class="lap-card-val">${totSalah_BS}</div><div class="lap-card-label">Salah</div></div>`;
  }
  if (totSoal_NS > 0) {
      html += `<div class="lap-card"><div class="lap-card-val" style="font-size:18px">${totNilai_NS.toFixed(1)}</div><div class="lap-card-label">Nilai Didapat</div></div>`;
      html += `<div class="lap-card"><div class="lap-card-val" style="font-size:18px">${totMaks_NS.toFixed(1)}</div><div class="lap-card-label">Nilai Maks</div></div>`;
  }
  html += `<div class="lap-card"><div class="lap-card-val">${tidakDijawab_All}</div><div class="lap-card-label">Tidak Dijawab</div></div>`;
  html += `<div class="lap-card"><div class="lap-card-val">${totalSoal_All}</div><div class="lap-card-label">Total Soal</div></div>`;
  html += `</div>`;

  // Per soal
  if (mcArr.length > 0) {
    html += '<div style="font-size:12px;font-weight:700;color:var(--text-sub);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Nilai Per Bagian</div>';
    html += '<div class="lap-soal-list">' + mcArr.map(s => {
        const isNS = s.skor_type === 'nilai_sendiri';
        const badge = isNS ? `<span style="font-size:9px;font-weight:700;color:var(--accent);background:rgba(26,90,160,.1);padding:2px 6px;border-radius:6px;margin-left:6px;">Nilai/Jawaban</span>` : '';
        const sub = isNS ? `${s.nilaiDapat.toFixed(1)} / ${s.nilaiMaks.toFixed(1)} nilai` : `${s.benar}/${s.total} benar`;
      
        return `
      <div class="lap-soal-item" onclick="openReviewSoal('${s.soalKode}', '${s.nama.replace(/'/g,"&apos;")}', '${lap.kode||lap.id}')">
        <div>
          <div class="lap-soal-name">${s.nama} ${badge}</div>
          <div style="font-size:11px;color:var(--text-sub)">${sub} · ${s.type}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="lap-soal-skor ${s.skor>=60?'ok':'no'}">${s.skor}</div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" style="color:var(--text-sub)"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>`;
    }).join('') + '</div>';
  }

  // Sikap kerja chart
  if (Object.keys(skData).length) {
    Object.entries(skData).forEach(([kode, sk]) => {
      const kols = sk.kolom;
      const maxD=Math.max(...kols.map(k=>k.total)), maxB=Math.max(...kols.map(k=>k.benar)), maxS=Math.max(...kols.map(k=>k.salah));
      const avgD=Math.round(kols.reduce((a,c)=>a+c.total,0)/kols.length);
      const avgB=Math.round(kols.reduce((a,c)=>a+c.benar,0)/kols.length);
      const avgS=Math.round(kols.reduce((a,c)=>a+c.salah,0)/kols.length);
      html += `
        <div style="font-size:12px;font-weight:700;color:var(--text-sub);text-transform:uppercase;letter-spacing:0.06em;margin:16px 0 8px">Grafik Sikap Kerja — ${sk.nama}</div>
        <div class="chart-wrap"><canvas id="lapch-${kode}" width="600" height="200" style="width:100%;max-height:200px;"></canvas></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:16px">
          <div class="lap-card"><div class="lap-card-val">${maxD}</div><div class="lap-card-label">Dijawab Terbanyak</div></div>
          <div class="lap-card"><div class="lap-card-val">${avgD}</div><div class="lap-card-label">Rata-rata Dijawab</div></div>
          <div class="lap-card" style="border-color:rgba(22,163,74,0.2)"><div class="lap-card-val" style="color:var(--success)">${maxB}</div><div class="lap-card-label">Benar Terbanyak</div></div>
          <div class="lap-card" style="border-color:rgba(22,163,74,0.2)"><div class="lap-card-val" style="color:var(--success)">${avgB}</div><div class="lap-card-label">Rata-rata Benar</div></div>
          <div class="lap-card" style="border-color:rgba(220,38,38,0.2)"><div class="lap-card-val" style="color:var(--danger)">${maxS}</div><div class="lap-card-label">Salah Terbanyak</div></div>
          <div class="lap-card" style="border-color:rgba(220,38,38,0.2)"><div class="lap-card-val" style="color:var(--danger)">${avgS}</div><div class="lap-card-label">Rata-rata Salah</div></div>
        </div>`;
    });
  }

  document.getElementById('lap-body').innerHTML = html;
  setTimeout(() => {
    Object.entries(skData).forEach(([kode, sk]) => drawChart(`lapch-${kode}`, sk.kolom));
  }, 100);
}

/* ── REVIEW SOAL (readonly ujian view) ── */
let _rvState = { soalData: [], jawaban: {}, currentIdx: 0 };

// Terapkan urutan tampil (acak soal & acak jawaban) yang tersimpan dari sesi ujian peserta,
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

async function openReviewSoal(soalKode, soalNama, laporanKode) {
  document.getElementById('rsv-title').textContent = soalNama;
  document.getElementById('rsv-body').innerHTML = '<div class="empty-state"><div class="spinner" style="width:24px;height:24px;margin:0 auto 8px;border-width:2px"></div><p>Memuat soal...</p></div>';
  openModal('review-soal-overlay');
  try {
    const [soal, lap] = await Promise.all([
      apiFetch(`/soal/${soalKode}`).catch(()=>null),
      apiFetch(`/laporan/${laporanKode}`).catch(()=>null)
    ]);
    if (!soal) { document.getElementById('rsv-body').innerHTML = '<div class="empty-state"><p>Data soal tidak ditemukan</p></div>'; return; }
    const jawaban = typeof lap?.jawaban === 'string' ? JSON.parse(lap.jawaban) : (lap?.jawaban || {});
    let rawData = typeof soal.data === 'string' ? JSON.parse(soal.data) : soal.data;
    if (soal.type !== 'sikap_kerja') {
      const ord = lap && lap.urutan_tampil ? lap.urutan_tampil[soalKode] : null;
      rawData = _applyUrutanTampil(rawData, ord);
    }
    _rvState = { soal, jawaban, currentIdx: 0, type: soal.type, rawData };
    renderReviewSoalContent();
  } catch(e) {
    document.getElementById('rsv-body').innerHTML = '<div class="empty-state"><p>Gagal memuat</p></div>';
  }
}

function renderReviewSoalContent() {
  const { soal, jawaban, currentIdx, type, rawData } = _rvState;
  document.getElementById('rsv-sub').textContent = `${type} · ${type === 'sikap_kerja' ? '' : (rawData?.length || 0) + ' soal'}`;

  if (type === 'sikap_kerja') {
    renderReviewSikapKerja(rawData, jawaban);
  } else {
    renderReviewMC(rawData, jawaban, currentIdx);
  }
}

function renderReviewMC(qs, jawaban, idx) {
  const q = qs[idx];
  if (!q) return;
  const soalKode = _rvState.soal.kode;

  // Identifikasi tipe skor (Benar/Salah vs Nilai per Jawaban)
  const isNS = _rvState.soal.skor_type === 'nilai_sendiri';

  // ── LOGIKA PENCARIAN JAWABAN (ANTI-ACAK SOAL) ──
  let allUserAns = [];
  Object.keys(jawaban).forEach(k => {
      if (k.startsWith(soalKode + '_') || k === String(q.id)) {
          let ans = jawaban[k];
          if (Array.isArray(ans)) allUserAns.push(...ans);
          else if (ans != null) allUserAns.push(ans);
      }
  });

  const validJids = (q.jawaban || []).map((j, i) => j.id != null ? String(j.id) : String(i));
  let userAns = [];
  allUserAns.forEach(ansId => {
      if (validJids.includes(String(ansId))) userAns.push(String(ansId));
  });
  
  // Fallback index (Jika soal lama tanpa ID yang jelas)
  if (userAns.length === 0 && jawaban[`${soalKode}_${q.__qIdx}`]) {
      let fb = jawaban[`${soalKode}_${q.__qIdx}`];
      userAns = Array.isArray(fb) ? fb.map(String) : [String(fb)];
  }

  // ── Render Navigasi Grid ──
  const navHtml = qs.map((qi, i) => {
    const vJids = (qi.jawaban || []).map((j, ji) => j.id != null ? String(j.id) : String(ji));
    let iAns = [];
    allUserAns.forEach(ansId => { if (vJids.includes(String(ansId))) iAns.push(String(ansId)); });
    if (iAns.length === 0 && jawaban[`${soalKode}_${qi.__qIdx}`]) {
        let fb = jawaban[`${soalKode}_${qi.__qIdx}`];
        iAns = Array.isArray(fb) ? fb.map(String) : [String(fb)];
    }

    let cls = 'rv-nav-btn';
    let extraStyle = '';
    
    if (i === idx) {
        cls += ' current';
    } else if (iAns.length === 0) {
        cls += ' empty';
    } else {
        if (isNS) {
            // Untuk "Nilai per Jawaban", warna jadi Biru
            cls += ' answered';
            extraStyle = 'background:rgba(26,90,160,0.15); border-color:var(--accent); color:var(--accent);';
        } else {
            const kList = Array.isArray(qi.kunci) ? qi.kunci.map(String) : (qi.kunci != null ? [String(qi.kunci)] : []);
            const isBenar = kList.length > 0 && kList.every(kx => iAns.includes(kx)) && iAns.length === kList.length;
            if (isBenar) cls += ' correct';
            else cls += ' wrong';
        }
    }
    return `<button class="${cls}" style="${extraStyle}" onclick="rvGoTo(${i})">${i+1}</button>`;
  }).join('');

  // ── Render Opsi Pilihan Jawaban ──
  const aHtml = (q.jawaban || []).map((j, i) => {
    const letter = String.fromCharCode(65+i);
    const jid = j.id != null ? String(j.id) : String(i);
    const picked = userAns.includes(jid);
    
    let borderColor = 'rgba(19,50,89,0.09)', bgColor = 'rgba(255,255,255,0.5)', letterBg = 'rgba(19,50,89,0.07)', letterColor = 'var(--text-sub)';
    let badge = '';

    if (isNS) {
        // [ MODE: NILAI PER JAWABAN ]
        const nilai = j.nilai || 0;
        if (picked) {
            borderColor = 'var(--accent)';
            bgColor = 'rgba(26,90,160,0.08)';
            letterBg = 'var(--accent)';
            letterColor = '#fff';
            badge = `<div style="display:flex;align-items:center;gap:8px;margin-left:auto">
                <span style="font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.05em">Pilihan Peserta</span>
                <span style="font-size:11px;font-weight:800;color:var(--accent);background:rgba(26,90,160,0.15);padding:4px 8px;border-radius:6px;">Poin: ${nilai}</span>
            </div>`;
        } else {
            badge = `<span style="font-size:11px;font-weight:700;color:var(--text-sub);background:rgba(19,50,89,0.06);padding:3px 8px;border-radius:6px;margin-left:auto;">Poin: ${nilai}</span>`;
        }
    } else {
        // [ MODE: BENAR / SALAH ]
        const kList = Array.isArray(q.kunci) ? q.kunci.map(String) : (q.kunci != null ? [String(q.kunci)] : []);
        const isKey = kList.includes(jid);
        
        if (picked && isKey) { 
            borderColor='var(--success)'; bgColor='rgba(22,163,74,0.08)'; letterBg='var(--success)'; letterColor='#fff'; 
            badge='<span style="font-size:10px;color:var(--success);margin-left:auto;font-weight:700;">✓ Benar</span>'; 
        } else if (picked && !isKey) { 
            borderColor='var(--danger)'; bgColor='rgba(220,38,38,0.07)'; letterBg='var(--danger)'; letterColor='#fff'; 
            badge='<span style="font-size:10px;color:var(--danger);margin-left:auto;font-weight:700;">✗ Salah</span>'; 
        } else if (!picked && isKey) { 
            borderColor='#d97706'; bgColor='rgba(217,119,6,0.07)'; letterBg='#d97706'; letterColor='#fff'; 
            badge='<span style="font-size:10px;color:#d97706;margin-left:auto;font-weight:700;">Kunci Jawaban</span>'; 
        }
    }

    return `<div style="display:flex;align-items:center;gap:13px;padding:12px 16px;border-radius:12px;border:1.5px solid ${borderColor};background:${bgColor};min-height:52px;margin-bottom:8px;">
      <div style="width:32px;height:32px;flex-shrink:0;border-radius:8px;border:1.5px solid rgba(19,50,89,0.05);background:${letterBg};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:${letterColor};">${letter}</div>
      <div style="flex:1;font-size:14px;line-height:1.5;color:var(--text-main);">${j.teks||j.value||j.opsi||'-'}</div>
      ${badge}
    </div>`;
  }).join('');

  // ── Render Pembahasan (jika ada) ──
  const pembHtml = q.pembahasan ? `<div style="background:rgba(26,90,160,0.05);border:1.5px solid rgba(26,90,160,0.12);border-radius:12px;padding:14px;margin-top:8px;">
    <div style="font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px;">💡 Pembahasan</div>
    <div style="font-size:13px;line-height:1.7;color:var(--text-main);">${q.pembahasan}</div>
  </div>` : '';

  // ── Render Tampilan Akhir ──
  document.getElementById('rsv-body').innerHTML = `
    <div class="rv-layout">
      <div class="rv-left">
        <div class="rv-q-box" style="margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;color:var(--text-sub);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.06em">Soal ${idx+1} dari ${qs.length}</div>
          <div style="font-size:15px;line-height:1.75;color:var(--text-main)">${q.soal||'<em>Kosong</em>'}</div>
        </div>
        <div class="rv-a-box">${aHtml}</div>
        ${pembHtml}
        <div style="display:flex;gap:10px;padding-top:10px;margin-top:auto;">
          <button class="btn btn-secondary btn-sm" ${idx===0?'disabled':''} onclick="rvGoTo(${idx-1})">← Sebelumnya</button>
          <button class="btn btn-primary btn-sm" ${idx>=qs.length-1?'disabled':''} onclick="rvGoTo(${idx+1})">Selanjutnya →</button>
        </div>
      </div>
      <div class="rv-right">
        <div style="font-size:11px;font-weight:700;color:var(--text-sub);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Navigasi</div>
        <div class="rv-nav-grid">${navHtml}</div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:12px;padding-top:12px;border-top:1px solid rgba(19,50,89,0.07)">
          <div style="font-size:10px;font-weight:800;color:var(--blue);text-transform:uppercase;margin-bottom:2px;">Legenda</div>
          ${isNS ? `
            <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-sub)"><div style="width:10px;height:10px;border-radius:3px;background:var(--accent)"></div>Sudah Dijawab</div>
          ` : `
            <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-sub)"><div style="width:10px;height:10px;border-radius:3px;background:var(--success)"></div>Benar</div>
            <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-sub)"><div style="width:10px;height:10px;border-radius:3px;background:var(--danger)"></div>Salah</div>
          `}
          <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-sub)"><div style="width:10px;height:10px;border-radius:3px;background:rgba(19,50,89,0.15)"></div>Tidak dijawab</div>
        </div>
      </div>
    </div>`;
}

function rvGoTo(idx) {
  _rvState.currentIdx = idx;
  renderReviewMC(_rvState.rawData, _rvState.jawaban, idx);
}

function renderReviewSikapKerja(kolom, jawaban) {
  const soalKode = _rvState.soal.kode;
  let html = '';
  kolom.forEach((kol, ki) => {
    const stateKey = `${soalKode}_${ki}`;
    html += `<div style="margin-bottom:20px">
      <div style="font-size:12px;font-weight:700;color:var(--text-sub);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">Kolom ${ki+1}</div>`;
    kol.soal.forEach((q, qi) => {
      const userAns = jawaban[`${stateKey}_${qi}`];
      const isCorrect = userAns === q.kunci_huruf;
      html += `<div style="background:rgba(${isCorrect?'22,163,74':'220,38,38'},0.04);border:1.5px solid rgba(${isCorrect?'22,163,74':'220,38,38'},0.12);border-radius:12px;padding:12px;margin-bottom:8px">
        <div style="font-size:11px;font-weight:600;color:var(--text-sub);margin-bottom:8px">Soal ${qi+1} ${userAns?`· Jawaban: <strong>${userAns}</strong> ${isCorrect?'✓':'✗'}`:'· Tidak dijawab'}</div>
        <div class="rv-sk-items" style="margin-bottom:6px">
          ${kol.items.map((it,i)=>{const v=it.nilai||'';const c=v.startsWith('data:')||v.startsWith('/')||v.startsWith('http')?`<img src="${v}" style="max-height:32px;border-radius:4px;">`:`<span style="font-size:15px">${v||'?'}</span>`;return `<div style="text-align:center"><div style="font-size:9px;font-weight:700;color:var(--text-sub);margin-bottom:3px">${String.fromCharCode(65+i)}</div><div class="rv-sk-item">${c}</div></div>`}).join('')}
        </div>
        <div style="font-size:10px;font-weight:700;color:var(--text-sub);margin-bottom:6px;text-align:center">SOAL (4 item)</div>
        <div class="rv-sk-q" style="margin-bottom:10px">
          ${q.tampil.map(v=>{const c=v&&(v.startsWith('data:')||v.startsWith('/')||v.startsWith('http'))?`<img src="${v}" style="max-height:32px;border-radius:4px;">`:`<span style="font-size:14px">${v||''}</span>`;return`<div class="rv-sk-q-item">${c}</div>`}).join('')}
        </div>
        <div class="rv-sk-choices">
          ${kol.items.map((it,i)=>{const v=it.nilai||'';const letter=String.fromCharCode(65+i);const picked=userAns===letter;const isKey=q.kunci_huruf===letter;let cls='rv-sk-choice';if(picked&&isKey)cls+=' correct';else if(picked&&!isKey)cls+=' wrong';else if(!picked&&isKey)cls+=' key';const c=v.startsWith('data:')||v.startsWith('/')||v.startsWith('http')?`<img src="${v}" style="max-height:24px;border-radius:3px;">`:`<span style="font-size:12px">${v||'?'}</span>`;return`<div class="${cls}"><div class="rv-sk-letter">${letter}</div>${c}</div>`}).join('')}
        </div>
      </div>`;
    });
    html += '</div>';
  });
  document.getElementById('rsv-body').innerHTML = html;
}

/* ── RIWAYAT PAGE ── */
let _riwayatData = [], _rwSearch = '', _rwPage = 1, _rwGrubFilter = '';
async function renderRiwayat() {
  try {
    _riwayatData = await apiFetch('/laporan').catch(() => []);
    _rwPage = 1;
    _populateRiwayatGrubFilter();
    renderRiwayatTable();
  } catch(e) {}
}

// Isi dropdown filter grup token dari nilai grub_token unik yang ada pada data laporan
// yang sudah dimuat (grub_token berasal dari kelompok token yang dibuat admin saat generate token).
function _populateRiwayatGrubFilter() {
  const sel = document.getElementById('riwayat-grub-filter');
  if (!sel) return;
  const grubs = [...new Set(_riwayatData.map(l => l.grub_token).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));
  const cur = sel.value;
  sel.innerHTML = '<option value="">Semua Grup Token</option>' + grubs.map(g => `<option value="${String(g).replace(/"/g,'&quot;')}">${g}</option>`).join('');
  if (grubs.includes(cur)) sel.value = cur;
  else _rwGrubFilter = '';
}

function filterRiwayat(val) { _rwSearch = val; _rwPage = 1; renderRiwayatTable(); }

function filterRiwayatGrub(val) {
  _rwGrubFilter = val !== undefined ? val : (document.getElementById('riwayat-grub-filter')?.value || '');
  _rwPage = 1;
  renderRiwayatTable();
}

function renderRiwayatTable() {
  let data = _riwayatData;
  if (_rwSearch) {
    const q = _rwSearch.toLowerCase();
    data = data.filter(l => (l.user_nama||l.user_kode||'').toLowerCase().includes(q) || (l.modul_nama||l.modul_kode||'').toLowerCase().includes(q));
  }
  if (_rwGrubFilter) data = data.filter(l => l.grub_token === _rwGrubFilter);

  const dlBar = document.getElementById('riwayat-grub-dl-bar');
  if (dlBar) {
    if (_rwGrubFilter) {
      dlBar.style.display = 'flex';
      const cntEl = document.getElementById('riwayat-grub-dl-count');
      if (cntEl) cntEl.textContent = `${data.length} laporan pada grup "${_rwGrubFilter}"`;
    } else {
      dlBar.style.display = 'none';
    }
  }

  const PER = 20, total = data.length, totalPg = Math.max(1, Math.ceil(total/PER));
  if (_rwPage > totalPg) _rwPage = 1;
  const slice = data.slice((_rwPage-1)*PER, _rwPage*PER);
  
  const tb = document.getElementById('riwayat-tbody');
  tb.innerHTML = slice.map((l, i) => `
    <tr style="animation:fadeUp 0.15s ${i*0.02}s both">
      <td>${(_rwPage-1)*PER+i+1}</td>
      <td><strong>${l.user_nama || l.user_kode}</strong></td>
      <td>${l.modul_nama || l.modul_kode || '-'}</td>
      <td class="hide-mobile" style="font-size:12px">${formatDateTime(l.tgl_selesai || l.created_at)}</td>
      <td><span style="font-family:var(--font-head);font-size:16px;font-weight:800;color:${(l.skor||0)>=60?'var(--success)':'var(--danger)'}">${Math.round(l.skor||0)}</span></td>
      <td><button class="btn btn-secondary btn-sm" onclick="openLaporan('${l.kode||l.id}','${(l.modul_nama||'Ujian').replace(/'/g,'\\\'')}')">Laporan</button></td>
    </tr>`).join('');

  const pg = document.getElementById('riwayat-pagination');
  pg.innerHTML = totalPg > 1 ? '<div class="pagination">' + Array.from({length:totalPg},(_,i)=>`<button class="page-btn ${i+1===_rwPage?'active':''}" onclick="_rwPage=${i+1};renderRiwayatTable()">${i+1}</button>`).join('') + '</div>' : '';
}

/* ── AKUN SAYA ── */

function hitungSkorFromLap(soalList, jawabanUser) {
  let perSoal = {};
  let skData   = {};

  (soalList || []).forEach(s => {
      const kode = s.kode || s.id || s.nama;
      if (!perSoal[kode]) perSoal[kode] = { nama: s.nama, type: s.type, skor_type: s.skor_type || 'benar_salah', benar: 0, total: 0, nilaiDapat: 0, nilaiMaks: 0, dijawab: 0 };
      const data_soal = typeof s.data === 'string' ? JSON.parse(s.data) : (s.data || []);

      if (s.type === 'sikap_kerja') {
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
          const opsi = s.opsi_jawaban || 1;
          
          // Kumpulkan jawaban untuk bypass fitur acak soal
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

  return {
    perSoal: Object.entries(perSoal).map(([k, v]) => {
      let sk = v.skor_type === 'nilai_sendiri'
          ? (v.nilaiMaks > 0 ? Math.round(v.nilaiDapat / v.nilaiMaks * 100) : 0)
          : (v.total > 0 ? Math.round(v.benar / v.total * 100) : 0);
      return { ...v, soalKode: k, skor: sk };
    }),
    skData
  };
}

function drawChart(canvasId, kolom) {
  const canvas = document.getElementById(canvasId); if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 600, H = 200;
  canvas.width = W; canvas.height = H;
  const pad = {t:18,r:16,b:36,l:32};
  const pw = W-pad.l-pad.r, ph = H-pad.t-pad.b;
  const n = kolom.length;
  const allV = kolom.flatMap(k=>[k.total,k.benar,k.salah]);
  const maxV = Math.max(...allV, 1);
  const stepX = pw/(n-1||1);
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle='rgba(19,50,89,0.06)'; ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const y=pad.t+ph-(i/4)*ph;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+pw,y);ctx.stroke();ctx.fillStyle='rgba(19,50,89,0.35)';ctx.font='9px DM Sans';ctx.fillText(Math.round(maxV*i/4),2,y+3);}
  [['total','#1a5aa0'],['benar','#16a34a'],['salah','#dc2626']].forEach(([k,c])=>{
    ctx.beginPath();ctx.strokeStyle=c;ctx.lineWidth=2;ctx.lineJoin='round';
    kolom.forEach((kl,i)=>{const x=pad.l+i*stepX,y=pad.t+ph-(kl[k]/maxV)*ph;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
    ctx.stroke();
    kolom.forEach((kl,i)=>{const x=pad.l+i*stepX,y=pad.t+ph-(kl[k]/maxV)*ph;ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fillStyle=c;ctx.fill();});
  });
  ctx.fillStyle='rgba(19,50,89,0.45)';ctx.font='9px DM Sans';ctx.textAlign='center';
  kolom.forEach((k,i)=>{ctx.fillText(`K${i+1}`,pad.l+i*stepX,H-8);});
  let lx=pad.l;[['Dijawab','#1a5aa0'],['Benar','#16a34a'],['Salah','#dc2626']].forEach(([lb,c])=>{ctx.fillStyle=c;ctx.fillRect(lx,5,14,2.5);ctx.fillStyle='rgba(19,50,89,0.5)';ctx.font='9px DM Sans';ctx.textAlign='left';ctx.fillText(lb,lx+17,10);lx+=70;});
}


function downloadLaporan() {
  if (!_currentLaporan) { showToast('Tidak ada data laporan', 'danger'); return; }
  const soalList = _currentLaporan?.soal_detail || [];
  
  // Bangun list per soal
  const perSoalButtons = soalList.map(s =>
    `<div style="display:flex;gap:6px;align-items:center">
      <span style="flex:1;font-size:12px;font-weight:600;color:var(--blue)">${s.nama}</span>
      <button class="btn btn-secondary btn-sm" onclick="doDownload('${s.kode}','word')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
        Word
      </button>
      <button class="btn btn-secondary btn-sm" onclick="doDownload('${s.kode}','excel')" style="border-color:rgba(22,163,74,0.3);color:var(--success)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
        Excel
      </button>
    </div>`).join('');

  document.getElementById('dl-per-soal-list').innerHTML = perSoalButtons;
  
  openModal('download-overlay');
}

function doDownload(which, format = 'word') {
  closeModal('download-overlay');
  if (!_currentLaporan) { showToast('Data tidak tersedia', 'danger'); return; }
  const lap = _currentLaporan;
  const jawaban = typeof lap.jawaban === 'string' ? JSON.parse(lap.jawaban) : (lap.jawaban || {});
  const soalAll = lap.soal_detail || [];
  const soalTampil = which === 'all' ? soalAll : soalAll.filter(s => s.kode === which);
  if (!soalTampil.length) { showToast('Data soal tidak ditemukan', 'danger'); return; }

  if (format === 'excel') {
    doDownloadExcel(lap, soalTampil, jawaban, soalAll);
  } else {
    doDownloadWord(lap, soalTampil, jawaban, soalAll);
  }
}

/* ── DOWNLOAD EXCEL (SheetJS) — Fixed: pakai logika admin ── */
function doDownloadExcel(lap, soalTampil, jawaban, soalAll) {
  if (typeof XLSX === 'undefined') { showToast('Library XLSX tidak termuat', 'danger'); return; }
  const wb = buildLaporanExcelWorkbook(lap, soalTampil, jawaban, soalAll);
  const tgl = new Date().toLocaleDateString('id-ID').replace(/\//g,'-');
  XLSX.writeFile(wb, `Laporan_${lap.user_nama||lap.user_kode||'Peserta'}_${lap.modul_nama||'Ujian'}_${tgl}.xlsx`);
  showToast('File Excel berhasil diunduh', 'success');
}

/* ── Membangun workbook Excel (dipakai untuk unduh 1 laporan maupun tiap file di dalam ZIP laporan grup) ── */
function buildLaporanExcelWorkbook(lap, soalTampil, jawaban, soalAll) {
  const { perSoal: psArr, skData } = hitungSkorFromLap(soalAll, jawaban);
  const cleanT = t => t ? t.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').trim() : '';

  const totalB = psArr.reduce((a,s)=>a+s.benar,0);
  const totalS = psArr.reduce((a,s)=>a+(s.dijawab-s.benar),0);
  const totalT = psArr.reduce((a,s)=>a+s.total,0);
  const skorAkhir = Math.round(lap.skor||0) || (totalT ? Math.round(totalB/totalT*100) : 0);

  const wb = XLSX.utils.book_new();

  // Sheet Ringkasan
  const summaryRows = [
    ['LAPORAN HASIL UJIAN'],
    ['Peserta', lap.user_nama || lap.user_kode || '-'],
    ['Modul', lap.modul_nama || lap.modul_kode || '-'],
    ['Tanggal', formatDateTime(lap.tgl_selesai || lap.created_at)],
    ['Token', lap.token_kode || '-'],
    ['Waktu Pengerjaan', lap.waktu_pengerjaan || '-'],
    ['Skor Akhir', skorAkhir],
    [],
    ['Ringkasan Per Soal'],
    ['No', 'Nama Soal', 'Tipe', 'Benar', 'Salah', 'Kosong', 'Total', 'Skor (%)']
  ];
  psArr.forEach((s, i) => {
    const salah = s.dijawab - s.benar;
    const kosong = s.total - s.dijawab;
    summaryRows.push([i+1, s.nama, s.type, s.benar, salah, kosong, s.total, s.skor]);
  });
  summaryRows.push([]);
  summaryRows.push(['TOTAL','','',totalB,totalS,totalT-totalB-totalS,totalT,skorAkhir]);
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{wch:5},{wch:30},{wch:15},{wch:8},{wch:8},{wch:8},{wch:8},{wch:10}];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

  // Sheet per Soal — pakai jawaban lookup yang benar (sama seperti admin)
  soalTampil.forEach((soal, idx) => {
    const rawData = typeof soal.data === 'string' ? JSON.parse(soal.data) : (soal.data || []);
    const sheetName = (soal.nama || ('Soal'+(idx+1))).substring(0, 31);
    const rows = [
      [`DETAIL: ${soal.nama}`],
      ['Tipe', soal.type],
      []
    ];

    if (soal.type === 'sikap_kerja') {
      rows.push(['Kolom', 'No', 'Jawaban User', 'Kunci', 'Status']);
      (rawData||[]).forEach((kolom, ki) => {
        (kolom.soal||[]).forEach((q, qi) => {
          const userAns = jawaban[`${soal.kode}_${ki}_${qi}`];
          const kunci = q.kunci_huruf || q.kunci || '-';
          rows.push([`Kolom ${ki+1}`, qi+1, userAns||'-', kunci, userAns?(userAns===kunci?'BENAR':'SALAH'):'Tidak dijawab']);
        });
      });
    } else {
      rows.push(['No', 'Pertanyaan', 'Jawaban User (ID)', 'Jawaban User (Huruf)', 'Kunci (Huruf)', 'Status', 'Pembahasan']);
      (rawData||[]).forEach((q, qi) => {
        // Lookup jawaban: prioritas soalKode_qi → q.id (tanpa pooling global)
        const jArr = q.jawaban || [];
        const kunci = q.kunci || [];
        const kunciArr = Array.isArray(kunci) ? kunci.map(String) : [String(kunci??'')];

        // Cari jawaban user: cek key soalKode_qi dulu, fallback ke q.id
        let ua = jawaban[`${soal.kode}_${qi}`];
        if (ua == null && q.id != null) ua = jawaban[String(q.id)];

        const uaId = ua != null ? (Array.isArray(ua) ? ua[0] : String(ua)) : null;
        const isBenar = uaId != null && kunciArr.includes(uaId);

        // Konversi ID → huruf
        const idToHuruf = id => { const i = jArr.findIndex(j => (j.id != null ? String(j.id) : null) === String(id)); return i >= 0 ? String.fromCharCode(65+i) : String(id); };
        const uaHuruf = uaId != null ? idToHuruf(uaId) : '-';
        const kunciHuruf = kunciArr.map(k => { const i = jArr.findIndex(j => (j.id != null ? String(j.id) : null) === String(k)); return i >= 0 ? String.fromCharCode(65+i) : k; }).join(',');

        rows.push([
          qi+1,
          cleanT(q.soal||'').substring(0,150),
          uaId ?? '-',
          uaHuruf,
          kunciHuruf,
          uaId != null ? (isBenar ? 'BENAR' : 'SALAH') : 'Tidak dijawab',
          cleanT(q.pembahasan||'').substring(0,200)
        ]);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{wch:5},{wch:8},{wch:40},{wch:15},{wch:15},{wch:12},{wch:15},{wch:35}];
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  return wb;
}

/* ── HELPER: Fix path gambar untuk Word export ── */
function fixImgPathsRv(htmlStr) {
  if (!htmlStr) return '';
  const div = document.createElement('div');
  div.innerHTML = htmlStr;
  div.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src');
    if (src && !src.startsWith('http') && !src.startsWith('data:')) {
      try { img.src = new URL(src, window.location.href).href; } catch(e) {}
    }
  });
  return div.innerHTML;
}

/* ── HELPER: Buat grafik kecermatan Canvas → Base64 ── */
function createChartImageRv(details) {
  const canvas = document.createElement('canvas');
  const W = 600, H = 250; 
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
  const pad = {t:30, r:20, b:50, l:40};
  const pw = W-pad.l-pad.r, ph = H-pad.t-pad.b;
  const n = details.length;
  
  // GUNAKAN 'total' (jumlah soal yg dijawab), bukan 'totalSoal'
  const allV = details.flatMap(k => [k.total || 0, k.benar || 0, k.salah || 0]);
  const maxV = Math.max(...allV, 1);
  const stepX = pw/(n-1||1);

  // Garis horizontal (Grid)
  ctx.strokeStyle='rgba(19,50,89,0.06)'; ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y = pad.t+ph-(i/4)*ph;
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+pw,y); ctx.stroke();
    ctx.fillStyle='rgba(19,50,89,0.5)'; ctx.font='10px Arial'; ctx.textAlign='right';
    ctx.fillText(Math.round(maxV*i/4), pad.l-8, y+3);
  }

  // Gambar Garis Data (Dijawab, Benar, Salah)
  [['total','#1a5aa0'],['benar','#16a34a'],['salah','#dc2626']].forEach(([k,c])=>{
    ctx.beginPath(); ctx.strokeStyle=c; ctx.lineWidth=2; ctx.lineJoin='round';
    details.forEach((kl,i)=>{
      const val = kl[k] || 0; // kl.total adalah soal yg dijawab
      const x = pad.l+i*stepX, y = pad.t+ph-(val/maxV)*ph;
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.stroke();
    
    // Gambar Titik (Dots)
    details.forEach((kl,i)=>{
      const val = kl[k] || 0;
      const x = pad.l+i*stepX, y = pad.t+ph-(val/maxV)*ph;
      ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fillStyle=c; ctx.fill();
    });
  });

  // Label Sumbu X (K1, K2, dst) & Akurasi (%)
  ctx.textAlign='center';
  details.forEach((k,i)=>{
    const x = pad.l+i*stepX;
    ctx.fillStyle='#1e293b'; ctx.font='bold 11px Arial';
    ctx.fillText(`K${i+1}`, x, H-30);
    
    // Kalkulasi akurasi HANYA dari soal yang dijawab
    const dijawab = (k.benar || 0) + (k.salah || 0);
    const acc = dijawab > 0 ? Math.round(((k.benar||0)/dijawab)*100) : 0;
    
    ctx.fillStyle='#16a34a'; ctx.font='bold 10px Arial';
    ctx.fillText(`${acc}%`, x, H-15);
  });

  // Legenda di bagian atas
  let lx = pad.l;
  [['Dijawab','#1a5aa0'],['Benar','#16a34a'],['Salah','#dc2626']].forEach(([lb,c])=>{
    ctx.fillStyle=c; ctx.fillRect(lx, 10, 14, 3);
    ctx.fillStyle='rgba(19,50,89,0.6)'; ctx.font='10px Arial'; ctx.textAlign='left';
    ctx.fillText(lb, lx+18, 14);
    lx += 70;
  });

  return canvas.toDataURL('image/png');
}

/* ── DOWNLOAD WORD — Fixed: pakai logika lookup jawaban yang benar ── */
// buildLaporanWordHtml membangun HTML laporan (dipakai baik untuk unduh 1 laporan maupun
// untuk membangun tiap file di dalam ZIP laporan grup). useAcak=true akan mengembalikan
// urutan soal & posisi pilihan jawaban persis seperti yang dilihat peserta saat ujian
// (memakai lap.urutan_tampil), sedangkan default (false) memakai urutan asli bank soal.
function buildLaporanWordHtml(lap, soalTampil, jawaban, soalAll, useAcak) {
  const { perSoal: psArr, skData } = hitungSkorFromLap(soalAll, jawaban);
  // Hanya hitung dari soal MC/linier (bukan sikap_kerja)
  const mcArr = psArr.filter(s => s.type !== 'sikap_kerja');
  const totalB = mcArr.reduce((a,s)=>a+s.benar,0);
  const totalS = mcArr.reduce((a,s)=>a+(s.dijawab-s.benar),0);
  const totalT = mcArr.reduce((a,s)=>a+s.total,0);
  const tidakDijawab = totalT - mcArr.reduce((a,s)=>a+s.dijawab,0);
  const skorAkhir = Math.round(lap.skor||0) || (totalT ? Math.round(totalB/totalT*100) : 0);
  const cleanT = t => t ? t.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').trim() : '';

  let html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
<title>Laporan Ujian — ${lap.modul_nama||lap.modul_kode}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f7fa;color:#1a2a3a;padding:24px;}
  .page-wrap{max-width:860px;margin:0 auto;}
  h1{font-size:22px;font-weight:800;color:#133259;margin-bottom:4px;}
  .sub{font-size:13px;color:#5a7a9a;margin-bottom:20px;}
  .skor-big{font-size:60px;font-weight:800;color:#133259;text-align:center;line-height:1;margin:16px 0 4px;}
  .skor-lbl{text-align:center;font-size:12px;color:#5a7a9a;margin-bottom:20px;}
  .stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;}
  .stat-box{background:#fff;border-radius:10px;padding:12px;text-align:center;border:1px solid #e0e8f0;}
  .stat-val{font-size:22px;font-weight:800;color:#133259;}
  .stat-lbl{font-size:11px;color:#5a7a9a;}
  .sec-ttl{font-size:14px;font-weight:800;color:#133259;margin:16px 0 8px;padding-bottom:5px;border-bottom:2px solid #e0e8f0;}
  .soal-block{background:#fff;border:1px solid #e0e8f0;border-radius:12px;padding:16px;margin-bottom:12px;page-break-inside:avoid;}
  .soal-hdr{font-size:12px;font-weight:700;color:#133259;margin-bottom:8px;}
  .q-teks{font-size:14px;line-height:1.7;color:#1a2a3a;margin-bottom:10px;}
  .opt{display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-radius:8px;border:1.5px solid #e0e8f0;background:#fafbfc;margin-bottom:5px;font-size:13px;}
  .opt.benar{border-color:#16a34a;background:rgba(22,163,74,0.07);}
  .opt.salah{border-color:#dc2626;background:rgba(220,38,38,0.06);}
  .opt.kunci-saja{border-color:#d97706;background:rgba(217,119,6,0.07);}
  .opt-letter{width:24px;height:24px;border-radius:6px;background:#e8eef6;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;flex-shrink:0;}
  .opt.benar .opt-letter{background:#16a34a;color:#fff;}
  .opt.salah .opt-letter{background:#dc2626;color:#fff;}
  .opt.kunci-saja .opt-letter{background:#d97706;color:#fff;}
  .opt.dijawab{border-color:#1a5aa0;background:rgba(26,90,160,0.07);}
  .opt.dijawab .opt-letter{background:#1a5aa0;color:#fff;}
  .badge-poin{float:right;font-size:10px;font-weight:700;color:#1a5aa0;background:rgba(26,90,160,0.15);padding:2px 6px;border-radius:4px;}
  .pembahasan{background:rgba(26,90,160,0.06);border:1px solid rgba(26,90,160,0.15);border-radius:8px;padding:10px;margin-top:8px;font-size:12px;color:#1a5aa0;}
  .pembahasan strong{font-size:11px;text-transform:uppercase;letter-spacing:0.05em;}
  .sk-block{background:#fff;border:1px solid #e0e8f0;border-radius:12px;padding:14px;margin-bottom:10px;page-break-inside:avoid;}
  .sk-items-row{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:6px;}
  .sk-item{border:1px solid #e0e8f0;border-radius:7px;padding:6px;text-align:center;min-height:40px;display:flex;align-items:center;justify-content:center;font-size:14px;}
  .sk-lbl{font-size:10px;font-weight:700;color:#5a7a9a;text-align:center;margin-bottom:4px;}
  .sk-q-row{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px;}
  .sk-q-item{border:1px solid #e0e8f0;border-radius:7px;padding:6px;text-align:center;min-height:40px;display:flex;align-items:center;justify-content:center;font-size:13px;}
  .sk-choices{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;}
  .sk-choice{border:1.5px solid #e0e8f0;border-radius:8px;padding:6px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;}
  .sk-choice.benar{border-color:#16a34a;background:rgba(22,163,74,0.07);}
  .sk-choice.salah{border-color:#dc2626;background:rgba(220,38,38,0.06);}
  .sk-choice.kunci{border-color:#d97706;background:rgba(217,119,6,0.07);}
  .sk-ch-ltr{width:22px;height:22px;border-radius:5px;background:#e8eef6;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;}
  .sk-choice.benar .sk-ch-ltr{background:#16a34a;color:#fff;}
  .sk-choice.salah .sk-ch-ltr{background:#dc2626;color:#fff;}
  .sk-choice.kunci .sk-ch-ltr{background:#d97706;color:#fff;}
  .legend-row{display:flex;gap:12px;flex-wrap:wrap;margin:8px 0 12px;font-size:11px;}
  .leg{display:flex;align-items:center;gap:4px;}
  .leg-dot{width:10px;height:10px;border-radius:3px;}
  .per-soal-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:16px;}
  .ps-card{background:#fff;border:1px solid #e0e8f0;border-radius:10px;padding:12px;text-align:center;}
  .ps-skor{font-size:22px;font-weight:800;}
  .ps-skor.ok{color:#16a34a;}.ps-skor.no{color:#dc2626;}
  .ps-nm{font-size:11px;font-weight:700;color:#133259;margin-bottom:4px;}
  .data-table{width:100%;border-collapse:collapse;margin-top:10px;border:1px solid #ccc;}
  .data-table th,.data-table td{border:1px solid #ccc;padding:5px;text-align:center;font-size:11px;}
  .data-table th{background:#f3f4f6;}
  @media print{body{background:#fff;padding:0;}.no-print{display:none;}}
</style>
</head><body><div class="page-wrap">
<div class="no-print" style="margin-bottom:16px;display:flex;gap:8px;">
  <button onclick="window.print()" style="padding:8px 16px;border-radius:8px;border:none;background:#133259;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">🖨 Cetak / Simpan PDF</button>
  <button onclick="window.close()" style="padding:8px 16px;border-radius:8px;border:1.5px solid #dde;background:#fff;font-size:13px;cursor:pointer;">✕ Tutup</button>
</div>
<h1>Laporan Ujian — ${lap.modul_nama||lap.modul_kode||'Modul'}</h1>
<div class="sub">
  <strong>Peserta:</strong> ${lap.user_nama||lap.user_kode||'-'} &nbsp;|&nbsp;
  <strong>Tanggal:</strong> ${formatDateTime(lap.tgl_selesai||lap.created_at)} &nbsp;|&nbsp;
  <strong>Token:</strong> ${lap.token_kode||'-'}
</div>
<div class="skor-big">${skorAkhir}</div>
<div class="skor-lbl">Skor Akhir</div>
<div class="stat-row">
  <div class="stat-box"><div class="stat-val">${totalB}</div><div class="stat-lbl">Jawaban Benar</div></div>
  <div class="stat-box"><div class="stat-val">${totalS}</div><div class="stat-lbl">Jawaban Salah</div></div>
  <div class="stat-box"><div class="stat-val">${tidakDijawab}</div><div class="stat-lbl">Tidak Dijawab</div></div>
</div>`;

  // Per soal summary — hanya tampilkan MC/linier, skip sikap_kerja
  const mcSummary = psArr.filter(s => s.type !== 'sikap_kerja');
  if (mcSummary.length > 1) {
    html += `<div class="sec-ttl">Nilai Per Subtes</div><div class="per-soal-grid">`;
    mcSummary.forEach(s => {
      html += `<div class="ps-card"><div class="ps-nm">${s.nama}</div><div class="ps-skor ${s.skor>=60?'ok':'no'}">${s.skor}</div><div style="font-size:10px;color:#5a7a9a">${s.benar}/${s.total} benar</div></div>`;
    });
    html += `</div>`;
  }

  // Legend
  html += `<div class="legend-row">
    <div class="leg"><div class="leg-dot" style="background:#16a34a"></div>Benar (jawaban user & kunci)</div>
    <div class="leg"><div class="leg-dot" style="background:#dc2626"></div>Salah (jawaban user)</div>
    <div class="leg"><div class="leg-dot" style="background:#d97706"></div>Kunci (tidak dipilih user)</div>
  </div>`;

  // Detail per soal
  soalTampil.forEach(soal => {
    let rawData = typeof soal.data === 'string' ? JSON.parse(soal.data) : (soal.data || []);
    if (useAcak && soal.type !== 'sikap_kerja') {
      const ord = lap && lap.urutan_tampil ? lap.urutan_tampil[soal.kode] : null;
      rawData = _applyUrutanTampil(rawData, ord);
    }
    html += `<div class="sec-ttl">${soal.nama} <span style="font-size:11px;font-weight:500;color:#5a7a9a">(${soal.type})</span></div>`;

    if (soal.type === 'sikap_kerja') {
      // Sikap Kerja: tampilkan grafik + tabel
      const sk = skData[soal.kode];
      if (sk && sk.kolom.length) {
        const chartImg = createChartImageRv(sk.kolom);
        html += `<div style="text-align:center;margin:10px 0"><img src="${chartImg}" width="500" style="border-radius:8px;border:1px solid #e0e8f0;"/></div>`;
        html += `<table class="data-table"><thead><tr><th>Kolom</th><th>Benar</th><th>Salah</th><th>Soal Terjawab</th><th>Akurasi</th></tr></thead><tbody>`;
        sk.kolom.forEach((col, ci) => {
          // col.total sudah menyimpan jumlah soal yang dijawab user (benar + salah)
          const terjawab = col.total || 0; 
          
          // Akurasi: (Benar / Soal Terjawab) * 100
          const acc = terjawab > 0 ? ((col.benar / terjawab) * 100).toFixed(0) : 0;
          
          html += `<tr>
            <td>K${ci+1}</td>
            <td style="color:#16a34a">${col.benar}</td>
            <td style="color:#dc2626">${col.salah}</td>
            <td>${terjawab}</td>
            <td>${acc}%</td>
          </tr>`;
        });
        html += `</tbody></table><br>`;
      }
      (rawData||[]).forEach((kolom, ki) => {
        const stk = `${soal.kode}_${ki}`;
        html += `<div class="sk-block"><div style="font-size:11px;font-weight:700;color:#5a7a9a;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em">Kolom ${ki+1}</div>`;
        (kolom.soal||[]).forEach((q, qi) => {
          const userAns = jawaban[`${stk}_${qi}`];
          const isBenar = userAns && userAns === (q.kunci_huruf||q.kunci);
          html += `<div style="margin-bottom:12px;padding:10px;border:1px solid #eee;border-radius:8px;background:${userAns?(isBenar?'rgba(22,163,74,0.04)':'rgba(220,38,38,0.03)'):'#fff'}">
            <div style="font-size:11px;font-weight:700;color:#5a7a9a;margin-bottom:6px">Soal ${qi+1} · Jawaban: <strong>${userAns||'Tidak dijawab'}</strong> ${userAns?(isBenar?'<span style="color:#16a34a">✓ Benar</span>':'<span style="color:#dc2626">✗ Salah</span>'):''}</div>
            <div class="sk-items-row">`;
          (kolom.items||[]).forEach((it,i)=>{
            const v=it.nilai??it.value??it;const sv=String(v||'');
            const img=sv.startsWith('data:')||sv.startsWith('/')||sv.startsWith('http');
            html+=`<div style="text-align:center"><div class="sk-lbl">${String.fromCharCode(65+i)}</div><div class="sk-item">${img?`<img src="${sv}" style="max-height:30px;max-width:100%;">`:(sv||'?')}</div></div>`;
          });
          html+=`</div>`;
          const tampil=q.tampil||q.soal_item||[];
          html+=`<div style="font-size:10px;font-weight:700;color:#5a7a9a;margin:6px 0 4px;text-align:center">SOAL (4 Item)</div><div class="sk-q-row">`;
          tampil.forEach(v=>{const sv=String(v||'');const img=sv.startsWith('data:')||sv.startsWith('/')||sv.startsWith('http');html+=`<div class="sk-q-item">${img?`<img src="${sv}" style="max-height:28px;max-width:100%;">`:(sv||'')}</div>`;});
          html+=`</div><div class="sk-choices">`;
          (kolom.items||[]).forEach((it,i)=>{
            const letter=String.fromCharCode(65+i);
            const v=it.nilai??it.value??it;const sv=String(v||'');
            const img=sv.startsWith('data:')||sv.startsWith('/')||sv.startsWith('http');
            const picked=userAns===letter;const isKey=(q.kunci_huruf||q.kunci)===letter;
            let cls='sk-choice';if(picked&&isKey)cls+=' benar';else if(picked&&!isKey)cls+=' salah';else if(!picked&&isKey)cls+=' kunci';
            html+=`<div class="${cls}"><div class="sk-ch-ltr">${letter}</div><div style="font-size:11px">${img?`<img src="${sv}" style="max-height:22px;max-width:100%;">`:(sv||'?')}</div></div>`;
          });
          html+=`</div></div>`;
        });
        html+=`</div>`;
      });
    } else {
      // MC / Linier — Ambil semua jawaban untuk bypass soal acak (Sama seperti UI)
      let allUserAns = [];
      Object.keys(jawaban).forEach(k => {
          if (k.startsWith(soal.kode + '_')) {
              let ans = jawaban[k];
              if (Array.isArray(ans)) allUserAns.push(...ans);
              else if (ans != null) allUserAns.push(ans);
          }
      });
      
      const isNS = soal.skor_type === 'nilai_sendiri';

      (rawData||[]).forEach((q, qi) => {
        // q.__qIdx (jika ada, diisi oleh _applyUrutanTampil saat useAcak aktif) adalah index
        // ASLI soal ini di bank soal — dipakai untuk lookup jawaban tersimpan, karena jawaban
        // disimpan berdasarkan index asli, bukan posisi tampilan setelah diacak.
        const origIdx = q.__qIdx != null ? q.__qIdx : qi;
        const jArr = q.jawaban || [];
        const kunci = q.kunci || [];
        const kunciArr = Array.isArray(kunci) ? kunci.map(String) : [String(kunci??'')];

        // Pencarian jawaban user yang akurat
        const validJids = jArr.map((j, i) => j.id != null ? String(j.id) : String(i));
        let uaArr = [];
        allUserAns.forEach(ansId => { if (validJids.includes(String(ansId))) uaArr.push(String(ansId)); });
        
        // Fallback jika tidak ketemu
        if (uaArr.length === 0) {
            let fallback = jawaban[`${soal.kode}_${origIdx}`];
            if (fallback == null && q.id != null) fallback = jawaban[String(q.id)];
            if (fallback != null) uaArr = Array.isArray(fallback) ? fallback.map(String) : [String(fallback)];
        }

        let statusHtml = '';
        if (isNS) {
            statusHtml = uaArr.length > 0 ? '<span style="color:#1a5aa0">✓ Telah Dijawab</span>' : '<span style="color:#5a7a9a">Tidak dijawab</span>';
        } else {
            const isBenar = uaArr.length > 0 && kunciArr.every(k => uaArr.includes(k)) && uaArr.length === kunciArr.length;
            statusHtml = uaArr.length > 0 ? (isBenar ? '<span style="color:#16a34a">✓ Benar</span>' : '<span style="color:#dc2626">✗ Salah</span>') : '<span style="color:#5a7a9a">Tidak dijawab</span>';
        }

        html+=`<div class="soal-block">
          <div class="soal-hdr">Soal ${qi+1} · ${statusHtml}</div>
          <div class="q-teks">${fixImgPathsRv(q.soal)||'<em>Kosong</em>'}</div>`;
          
        jArr.forEach((j,i)=>{
          const letter = String.fromCharCode(65+i);
          const jid = j.id != null ? String(j.id) : String(i);
          const picked = uaArr.includes(jid);
          
          let cls = 'opt';
          let poinBadge = '';

          if (isNS) {
              const poin = parseFloat(j.nilai) || 0;
              if (picked) cls += ' dijawab';
              poinBadge = `<span class="badge-poin">Poin: ${poin}</span>`;
          } else {
              const isKey = kunciArr.includes(jid);
              if (picked && isKey) cls += ' benar'; 
              else if (picked && !isKey) cls += ' salah'; 
              else if (!picked && isKey) cls += ' kunci-saja';
          }

          html+=`<div class="${cls}"><div class="opt-letter">${letter}</div><div style="flex:1">${fixImgPathsRv(j.teks||j.text||'')||''} ${poinBadge}</div></div>`;
        });
        
        if(q.pembahasan) html+=`<div class="pembahasan"><strong>💡 Pembahasan:</strong><br>${fixImgPathsRv(q.pembahasan)}</div>`;
        html+=`</div>`;
      });
    }
  });

  html+=`</div></body></html>`;

  return html;
}

// Wrapper unduh 1 laporan (perilaku sama seperti sebelumnya — urutan default/bank soal).
function doDownloadWord(lap, soalTampil, jawaban, soalAll) {
  const html = buildLaporanWordHtml(lap, soalTampil, jawaban, soalAll, false);
  // PERBAIKAN: sebelumnya hanya membuka tab print-preview (tidak benar-benar
  // mengunduh file apapun walau tombolnya berlabel "Word"). Sekarang file .doc
  // sungguhan diunduh ke perangkat (bisa dibuka di Word/LibreOffice/Google Docs).
  const tgl2 = new Date().toLocaleDateString('id-ID').replace(/\//g,'-');
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Laporan_${(lap.user_nama||lap.user_kode||'Peserta')}_${(lap.modul_nama||'Ujian')}_${tgl2}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  if (typeof showToast === 'function') showToast('File Word berhasil diunduh', 'success');
}

/* ── UNDUH LAPORAN GRUP (ZIP berisi 1 file Word per peserta dalam grup token terpilih) ── */
let _grubDlMode = 'default';
let _grubDlFormat = 'word';

function openUnduhLaporanGrup() {
  if (!_rwGrubFilter) { showToast('Pilih grup token terlebih dahulu', 'danger'); return; }
  const data = _riwayatData.filter(l => l.grub_token === _rwGrubFilter);
  if (!data.length) { showToast('Tidak ada laporan pada grup ini', 'danger'); return; }
  document.getElementById('grub-dl-nama').textContent = _rwGrubFilter;
  document.getElementById('grub-dl-count').textContent = `${data.length} laporan peserta`;
  _setGrubDlMode('default');
  _setGrubDlFormat('word');
  const prog = document.getElementById('grub-dl-progress');
  prog.style.display = 'none'; prog.textContent = '';
  const btn = document.getElementById('grub-dl-btn'); if (btn) btn.disabled = false;
  openModal('grub-dl-overlay');
}

function _setGrubDlMode(mode) {
  _grubDlMode = mode;
  document.getElementById('grub-dl-mode-default')?.classList.toggle('active', mode === 'default');
  document.getElementById('grub-dl-mode-acak')?.classList.toggle('active', mode === 'acak');
  const desc = document.getElementById('grub-dl-mode-desc');
  if (desc) desc.textContent = mode === 'acak'
    ? 'Nomor soal & posisi pilihan jawaban mengikuti urutan acak persis seperti yang dilihat peserta saat mengerjakan ujian.'
    : 'Nomor soal & pilihan jawaban dikembalikan ke posisi asli di bank soal (soal nomor 1 tetap nomor 1, pilihan A tetap A).';
}

function _setGrubDlFormat(format) {
  _grubDlFormat = format;
  document.getElementById('grub-dl-format-word')?.classList.toggle('active', format === 'word');
  document.getElementById('grub-dl-format-excel')?.classList.toggle('active', format === 'excel');
  const desc = document.getElementById('grub-dl-format-desc');
  if (desc) desc.textContent = format === 'excel'
    ? 'Setiap laporan peserta akan disimpan sebagai file Excel (.xlsx) di dalam ZIP.'
    : 'Setiap laporan peserta akan disimpan sebagai file Word (.doc) di dalam ZIP.';
}

async function prosesUnduhLaporanGrup() {
  const grubNama = _rwGrubFilter;
  const list = _riwayatData.filter(l => l.grub_token === grubNama);
  if (!list.length) { showToast('Tidak ada laporan pada grup ini', 'danger'); return; }
  if (typeof JSZip === 'undefined') { showToast('Gagal memuat pustaka ZIP, cek koneksi internet lalu coba lagi', 'danger'); return; }
  if (_grubDlFormat === 'excel' && typeof XLSX === 'undefined') { showToast('Gagal memuat pustaka Excel, cek koneksi internet lalu coba lagi', 'danger'); return; }

  const btn = document.getElementById('grub-dl-btn');
  const prog = document.getElementById('grub-dl-progress');
  if (btn) btn.disabled = true;
  if (prog) prog.style.display = 'block';

  try {
    const zip = new JSZip();
    const usedNames = {};
    const ext = _grubDlFormat === 'excel' ? 'xlsx' : 'doc';
    let sukses = 0;
    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      const namaPeserta = row.user_nama || row.user_kode || 'Peserta';
      if (prog) prog.textContent = `Memproses ${i+1}/${list.length}: ${namaPeserta}...`;

      const lap = await apiFetch(`/laporan/${row.kode || row.id}`).catch(() => null);
      if (!lap || !lap.soal_detail || !lap.soal_detail.length) continue;
      const jawaban = typeof lap.jawaban === 'string' ? JSON.parse(lap.jawaban) : (lap.jawaban || {});
      const soalAll = lap.soal_detail || [];

      let baseName = `${(lap.user_nama||lap.user_kode||'Peserta')}_${(lap.modul_nama||'Ujian')}`.replace(/[\\/:*?"<>|]/g, '-').trim() || 'Peserta';
      let fname = `${baseName}.${ext}`, n = 1;
      while (usedNames[fname]) { n++; fname = `${baseName} (${n}).${ext}`; }
      usedNames[fname] = true;

      if (_grubDlFormat === 'excel') {
        const wb = buildLaporanExcelWorkbook(lap, soalAll, jawaban, soalAll);
        const arrBuf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        zip.file(fname, arrBuf);
      } else {
        const html = buildLaporanWordHtml(lap, soalAll, jawaban, soalAll, _grubDlMode === 'acak');
        zip.file(fname, '\ufeff' + html);
      }
      sukses++;
    }

    if (!sukses) { showToast('Tidak ada laporan yang berhasil diproses', 'danger'); return; }

    if (prog) prog.textContent = 'Menyusun file ZIP...';
    const blob = await zip.generateAsync({ type: 'blob' });
    const tgl = new Date().toLocaleDateString('id-ID').replace(/\//g,'-');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Grup_${String(grubNama).replace(/[\\/:*?"<>|]/g,'-')}_${tgl}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);

    showToast(`Laporan grup berhasil diunduh (${sukses}/${list.length} peserta)`, 'success');
    closeModal('grub-dl-overlay');
  } catch (e) {
    console.error(e);
    showToast('Gagal membuat file ZIP: ' + e.message, 'danger');
  } finally {
    if (btn) btn.disabled = false;
    if (prog) prog.style.display = 'none';
  }
}

let _ruvState = {
  laporan: null,
  subResults: [],
  currentSubIdx: 0,
  questions: [],
  currentQIdx: 0,
  jawaban: {}
};

async function openReviewUjian(laporanKode, modulNama, userNama) {
  document.getElementById('ruv-title').textContent = `${userNama} — ${modulNama}`;
  document.getElementById('ruv-content').innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;gap:12px;"><div style="width:28px;height:28px;border:3px solid rgba(19,50,89,0.1);border-top-color:var(--accent);border-radius:50%;animation:spin 0.7s linear infinite;"></div><p style="font-size:13px;color:var(--text-sub);">Memuat data...</p></div>';
  openModal('review-ujian-overlay');
  try {
    const lap = await apiFetch(`/laporan/${laporanKode}`).catch(()=>null);
    if (!lap) { document.getElementById('ruv-content').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-sub)">Data tidak ditemukan</div>'; return; }
    _ruvState.laporan = lap;
    _ruvState.jawaban = typeof lap.jawaban === 'string' ? JSON.parse(lap.jawaban) : (lap.jawaban||{});
    _ruvState.subResults = lap.soal_detail || [];
    _ruvState.currentSubIdx = 0;
    _ruvState.currentQIdx = 0;
    renderRuvSubTabs();
    loadRuvSub(0);
  } catch(e) {
    document.getElementById('ruv-content').innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger)">Gagal memuat data</div>';
  }
}

function renderRuvSubTabs() {
  const tabs = document.getElementById('ruv-sub-tabs');
  tabs.innerHTML = _ruvState.subResults.map((s, i) => `
    <button onclick="loadRuvSub(${i})" id="ruv-tab-${i}"
      style="padding:6px 14px;border-radius:8px;border:1.5px solid rgba(19,50,89,0.12);background:${i===0?'var(--blue)':'rgba(255,255,255,0.7)'};color:${i===0?'#fff':'var(--text-sub)'};font-family:var(--font-body);font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all 0.18s;">
      ${s.nama || `Sub ${i+1}`}
    </button>`).join('');
}

function loadRuvSub(idx) {
  _ruvState.currentSubIdx = idx;
  _ruvState.currentQIdx = 0;
  // Update tab styling
  _ruvState.subResults.forEach((_, i) => {
    const t = document.getElementById(`ruv-tab-${i}`);
    if (t) { t.style.background = i===idx?'var(--blue)':'rgba(255,255,255,0.7)'; t.style.color = i===idx?'#fff':'var(--text-sub)'; }
  });
  const sub = _ruvState.subResults[idx];
  if (!sub) return;
  let rawData = typeof sub.data === 'string' ? JSON.parse(sub.data) : (sub.data||[]);
  if (sub.type !== 'sikap_kerja') {
    const ord = _ruvState.laporan && _ruvState.laporan.urutan_tampil ? _ruvState.laporan.urutan_tampil[sub.kode] : null;
    rawData = _applyUrutanTampil(rawData, ord);
  }
  
  // Hitung skor sub
  const { perSoal } = hitungSkorFromLap([sub], _ruvState.jawaban);
  const subSkor = perSoal[0]?.skor ?? 0;
  document.getElementById('ruv-sub-score').textContent = subSkor;

  if (sub.type === 'sikap_kerja') {
    renderRuvSikapKerja(rawData, sub);
    document.getElementById('ruv-nav-btns').innerHTML = '';
    document.getElementById('ruv-nav-grid').innerHTML = '';
    document.getElementById('ruv-q-counter').textContent = '-';
    // Legenda untuk sikap kerja
    document.getElementById('ruv-legend').innerHTML = `
      <div style="display:flex;align-items:center;gap:5px;font-size:9px;color:var(--text-sub);font-weight:600;"><div style="width:8px;height:8px;border-radius:2px;background:var(--success)"></div>Benar</div>
      <div style="display:flex;align-items:center;gap:5px;font-size:9px;color:var(--text-sub);font-weight:600;"><div style="width:8px;height:8px;border-radius:2px;background:var(--danger)"></div>Salah</div>`;
  } else {
    _ruvState.questions = rawData || [];
    const isNS = sub.skor_type === 'nilai_sendiri';
    // Update legenda sesuai mode
    document.getElementById('ruv-legend').innerHTML = isNS ? `
      <div style="display:flex;align-items:center;gap:5px;font-size:9px;color:var(--text-sub);font-weight:600;"><div style="width:8px;height:8px;border-radius:2px;background:var(--accent)"></div>Sudah dijawab</div>
      <div style="display:flex;align-items:center;gap:5px;font-size:9px;color:var(--text-sub);font-weight:600;"><div style="width:8px;height:8px;border-radius:2px;background:rgba(19,50,89,0.15)"></div>Tidak dijawab</div>
      <div style="display:flex;align-items:center;gap:5px;font-size:9px;color:var(--text-sub);font-weight:600;"><div style="width:8px;height:8px;border-radius:2px;background:var(--blue)"></div>Sedang dilihat</div>` : `
      <div style="display:flex;align-items:center;gap:5px;font-size:9px;color:var(--text-sub);font-weight:600;"><div style="width:8px;height:8px;border-radius:2px;background:var(--success)"></div>Benar</div>
      <div style="display:flex;align-items:center;gap:5px;font-size:9px;color:var(--text-sub);font-weight:600;"><div style="width:8px;height:8px;border-radius:2px;background:var(--danger)"></div>Salah</div>
      <div style="display:flex;align-items:center;gap:5px;font-size:9px;color:var(--text-sub);font-weight:600;"><div style="width:8px;height:8px;border-radius:2px;background:rgba(19,50,89,0.15)"></div>Tidak dijawab</div>
      <div style="display:flex;align-items:center;gap:5px;font-size:9px;color:var(--text-sub);font-weight:600;"><div style="width:8px;height:8px;border-radius:2px;background:var(--blue)"></div>Sedang dilihat</div>`;
    renderRuvMC(sub);
  }
}

function renderRuvMC(sub) {
  const qs = _ruvState.questions;
  const idx = _ruvState.currentQIdx;
  const q = qs[idx];
  if (!q) { document.getElementById('ruv-content').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-sub)">Tidak ada soal</div>'; return; }
  const soalKode = sub.kode;
  const isNS = sub.skor_type === 'nilai_sendiri';

  // ── LOGIKA PENCARIAN JAWABAN (support acak soal via ID) ──
  let allUserAns = [];
  Object.keys(_ruvState.jawaban).forEach(k => {
    if (k.startsWith(soalKode + '_')) {
      let ans = _ruvState.jawaban[k];
      if (Array.isArray(ans)) allUserAns.push(...ans);
      else if (ans != null) allUserAns.push(ans);
    }
  });

  const validJids = (q.jawaban || []).map((j, i) => j.id != null ? String(j.id) : String(i));
  let userAns = [];
  allUserAns.forEach(ansId => {
    if (validJids.includes(String(ansId))) userAns.push(String(ansId));
  });
  // Fallback: coba key langsung (soalKode_idx atau q.id)
  if (userAns.length === 0) {
    let fb = _ruvState.jawaban[`${soalKode}_${idx}`] ?? _ruvState.jawaban[String(q.id)];
    if (fb != null) userAns = Array.isArray(fb) ? fb.map(String) : [String(fb)];
  }

  const kunci = q.kunci || [];

  // ── Nav Grid ──
  const navGrid = document.getElementById('ruv-nav-grid');
  navGrid.innerHTML = qs.map((qi, i) => {
    // Cari jawaban untuk soal i
    const vJids = (qi.jawaban || []).map((j, ji) => j.id != null ? String(j.id) : String(ji));
    let iAns = allUserAns.filter(ansId => vJids.includes(String(ansId)));
    if (iAns.length === 0) {
      let fb2 = _ruvState.jawaban[`${soalKode}_${i}`] ?? _ruvState.jawaban[String(qi.id)];
      if (fb2 != null) iAns = Array.isArray(fb2) ? fb2.map(String) : [String(fb2)];
    }

    let bg = 'rgba(255,255,255,0.65)', color='var(--text-sub)', border='rgba(19,50,89,0.12)';
    if (i === idx) { bg='var(--blue)'; color='#fff'; border='var(--blue)'; }
    else if (iAns.length === 0) { bg='rgba(19,50,89,0.05)'; color='rgba(19,50,89,0.3)'; }
    else if (isNS) { bg='rgba(26,90,160,0.15)'; color='var(--accent)'; border='var(--accent)'; }
    else {
      const kList = Array.isArray(qi.kunci) ? qi.kunci.map(String) : (qi.kunci != null ? [String(qi.kunci)] : []);
      const benar = kList.length > 0 && kList.every(kx => iAns.includes(kx)) && iAns.length === kList.length;
      if (benar) { bg='rgba(22,163,74,0.15)'; color='var(--success)'; border='var(--success)'; }
      else { bg='rgba(220,38,38,0.12)'; color='var(--danger)'; border='var(--danger)'; }
    }
    return `<button onclick="_ruvGoTo(${i})" style="width:32px;height:32px;border-radius:7px;border:1.5px solid ${border};background:${bg};font-size:11px;font-weight:700;color:${color};cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s;">${i+1}</button>`;
  }).join('');
  document.getElementById('ruv-q-counter').textContent = `${idx+1}/${qs.length}`;

  // ── Render Pilihan Jawaban ──
  const aHtml = (q.jawaban||[]).map((j, i) => {
    const letter = String.fromCharCode(65+i);
    const jid = j.id != null ? String(j.id) : String(i);
    const picked = userAns.includes(jid);
    let borderColor = 'rgba(19,50,89,0.09)', bgColor = 'rgba(255,255,255,0.5)', letterBg = 'rgba(255,255,255,0.8)', letterColor = 'var(--text-sub)';
    let badge = '';

    if (isNS) {
      // Mode: Nilai per Jawaban — tampilkan poin setiap pilihan, biru jika dipilih user
      const nilai = parseFloat(j.nilai) || 0;
      if (picked) {
        borderColor = 'var(--accent)';
        bgColor = 'rgba(26,90,160,0.08)';
        letterBg = 'var(--accent)';
        letterColor = '#fff';
        badge = `<div style="display:flex;align-items:center;gap:6px;margin-left:auto;flex-shrink:0;">
          <span style="font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;">Pilihan Peserta</span>
          <span style="font-size:11px;font-weight:800;color:var(--accent);background:rgba(26,90,160,0.15);padding:3px 8px;border-radius:6px;white-space:nowrap;">Poin: ${nilai}</span>
        </div>`;
      } else {
        badge = `<span style="font-size:11px;font-weight:700;color:var(--text-sub);background:rgba(19,50,89,0.06);padding:3px 8px;border-radius:6px;margin-left:auto;white-space:nowrap;flex-shrink:0;">Poin: ${nilai}</span>`;
      }
    } else {
      // Mode: Benar / Salah
      const kList = Array.isArray(kunci) ? kunci.map(String) : (kunci != null ? [String(kunci)] : []);
      const isKey = kList.includes(jid);
      if (picked && isKey) {
        borderColor='var(--success)'; bgColor='rgba(22,163,74,0.08)'; letterBg='var(--success)'; letterColor='#fff';
        badge='<span style="font-size:10px;color:var(--success);margin-left:auto;font-weight:700;white-space:nowrap;">✓ Benar</span>';
      } else if (picked && !isKey) {
        borderColor='var(--danger)'; bgColor='rgba(220,38,38,0.07)'; letterBg='var(--danger)'; letterColor='#fff';
        badge='<span style="font-size:10px;color:var(--danger);margin-left:auto;font-weight:700;white-space:nowrap;">✗ Salah</span>';
      } else if (!picked && isKey) {
        borderColor='#d97706'; bgColor='rgba(217,119,6,0.07)'; letterBg='#d97706'; letterColor='#fff';
        badge='<span style="font-size:10px;color:#d97706;margin-left:auto;font-weight:700;white-space:nowrap;">Kunci</span>';
      }
    }

    return `<div style="display:flex;align-items:center;gap:13px;padding:14px 16px;border-radius:12px;border:1.5px solid ${borderColor};background:${bgColor};min-height:52px;">
      <div style="width:36px;height:36px;flex-shrink:0;border-radius:9px;border:1.5px solid rgba(19,50,89,0.12);background:${letterBg};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:${letterColor};">${letter}</div>
      <div style="flex:1;font-size:15px;line-height:1.5;color:var(--text-main);">${j.teks||j.value||j.opsi||'-'}</div>
      ${badge}
    </div>`;
  }).join('');

  const pembHtml = q.pembahasan ? `<div style="background:rgba(26,90,160,0.06);border:1.5px solid rgba(26,90,160,0.12);border-radius:12px;padding:14px;">
    <div style="font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px;">💡 Pembahasan</div>
    <div style="font-size:14px;line-height:1.7;color:var(--text-main);">${q.pembahasan}</div>
  </div>` : '';

  document.getElementById('ruv-content').innerHTML = `
    <div style="background:rgba(255,255,255,0.72);border:1.5px solid rgba(255,255,255,0.9);border-radius:16px;padding:22px 24px;box-shadow:0 4px 16px rgba(19,50,89,0.06);flex-shrink:0;">
      <div style="font-size:11px;font-weight:700;color:var(--text-sub);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Soal ${idx+1} dari ${qs.length}</div>
      <div style="font-size:16px;line-height:1.8;color:var(--text-main);">${q.soal||'<em>Kosong</em>'}</div>
    </div>
    <div style="background:rgba(255,255,255,0.6);border:1.5px solid rgba(255,255,255,0.85);border-radius:16px;padding:18px 20px;box-shadow:0 4px 14px rgba(19,50,89,0.05);display:flex;flex-direction:column;gap:9px;flex-shrink:0;">${aHtml}</div>
    ${pembHtml}`;

  // Nav buttons
  document.getElementById('ruv-nav-btns').innerHTML = `
    <button onclick="_ruvGoTo(${idx-1})" ${idx===0?'disabled':''} style="display:inline-flex;align-items:center;gap:6px;padding:11px 20px;border-radius:12px;border:none;font-family:var(--font-body);font-size:13px;font-weight:600;cursor:pointer;background:rgba(19,50,89,0.07);color:var(--blue);border:1.5px solid rgba(19,50,89,0.12);${idx===0?'opacity:0.3;cursor:not-allowed':''}">
      ← Sebelumnya
    </button>
    <span style="font-size:12px;color:var(--text-sub);font-weight:600;">${idx+1} / ${qs.length}</span>
    <button onclick="_ruvGoTo(${idx+1})" ${idx>=qs.length-1?'disabled':''} style="display:inline-flex;align-items:center;gap:6px;padding:11px 20px;border-radius:12px;border:none;font-family:var(--font-body);font-size:13px;font-weight:600;cursor:pointer;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;box-shadow:0 4px 14px rgba(26,90,160,0.28);${idx>=qs.length-1?'opacity:0.3;cursor:not-allowed':''}">
      Selanjutnya →
    </button>`;
}

function _ruvGoTo(idx) {
  if (idx < 0 || idx >= _ruvState.questions.length) return;
  _ruvState.currentQIdx = idx;
  const sub = _ruvState.subResults[_ruvState.currentSubIdx];
  renderRuvMC(sub);
}

function renderRuvSikapKerja(rawData, sub) {
  const soalKode = sub.kode;
  let html = '<div style="display:flex;flex-direction:column;gap:16px;">';
  (rawData||[]).forEach((kol, ki) => {
    const stk = `${soalKode}_${ki}`;
    html += `<div style="background:rgba(255,255,255,0.72);border:1.5px solid rgba(255,255,255,0.9);border-radius:16px;padding:18px;box-shadow:0 4px 16px rgba(19,50,89,0.06);">
      <div style="font-size:12px;font-weight:700;color:var(--text-sub);text-transform:uppercase;letter-spacing:0.07em;text-align:center;margin-bottom:14px;">Kolom ${ki+1}</div>
      <!-- Kunci Referensi -->
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:10px;">`;
    (kol.items||[]).forEach((it, i) => {
      const v = it.nilai||it.value||it||'';
      const sv = String(v);
      const isImg = sv.startsWith('data:')||sv.startsWith('/')||sv.startsWith('http');
      html += `<div style="text-align:center;"><div style="font-size:9px;font-weight:700;color:var(--text-sub);margin-bottom:3px;">${String.fromCharCode(65+i)}</div>
        <div style="background:rgba(19,50,89,0.05);border:1.5px solid rgba(19,50,89,0.09);border-radius:11px;min-height:64px;display:flex;align-items:center;justify-content:center;font-size:16px;padding:4px;text-align:center;">
          ${isImg?`<img src="${sv}" style="max-height:52px;max-width:100%;object-fit:contain;">`:`<span>${sv||'?'}</span>`}
        </div></div>`;
    });
    html += `</div>`;
    // Soal
    (kol.soal||[]).forEach((q, qi) => {
      const userAns = _ruvState.jawaban[`${stk}_${qi}`];
      const isBenar = userAns && userAns === (q.kunci_huruf||q.kunci);
      html += `<div style="padding:10px;border:1.5px solid rgba(${isBenar?'22,163,74':'220,38,38'},0.2);border-radius:10px;background:rgba(${isBenar?'22,163,74':'220,38,38'},0.04);margin-bottom:6px;">
        <div style="font-size:11px;font-weight:600;color:var(--text-sub);margin-bottom:6px;">Soal ${qi+1} · Jawaban: <strong>${userAns||'Tidak dijawab'}</strong> ${userAns?(isBenar?'<span style="color:var(--success)">✓</span>':'<span style="color:var(--danger)">✗</span>'):''}</div>
      </div>`;
    });
    html += `</div>`;
  });
  html += '</div>';
  document.getElementById('ruv-content').innerHTML = html;
  document.getElementById('ruv-nav-btns').innerHTML = '';
  document.getElementById('ruv-nav-grid').innerHTML = '<div style="font-size:10px;color:var(--text-sub);font-style:italic;padding:4px;">Kecermatan</div>';
}

function downloadFromReviewUjian() {
  if (!_ruvState.laporan) { showToast('Tidak ada data', 'danger'); return; }
  _currentLaporan = _ruvState.laporan;
  downloadLaporan();
}

window.addEventListener('DOMContentLoaded', () => {
  const user = getMe();
  const token = localStorage.getItem('cbn_token');
  if (!user || !token || user.role !== 'review') {
    window.location.href = 'landing.html';
    return;
  }
  let lastPage = 'home';
  try {
    const saved = localStorage.getItem('cbn_review_lastpage');
    if (saved && document.getElementById('page-' + saved)) lastPage = saved;
  } catch(e) {}
  navigateTo(lastPage);
});

// Handle overlay click close
document.addEventListener('click', e => {
  if (e.target.classList.contains('overlay')) closeModal(e.target.id);
});

/* ── RESPONSIVE DOCK OVERFLOW (sama seperti admin) ── */