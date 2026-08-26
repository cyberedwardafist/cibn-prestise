// admin/shared-export.js
// Helper hitung skor + export laporan ke Word/Excel (adminHitungSkor,
// adminDoDownloadExcel, adminDoDownloadWord, dst). Dipakai bersama oleh modul
// LAPORAN dan REVIEW — di-lazy-load berbarengan dengan salah satu dari keduanya
// (LazyLoader men-dedup otomatis kalau sudah dimuat lewat yang satu, jadi kalau
// user buka Laporan lalu Review, file ini tidak di-fetch dua kali).
// Butuh XLSX (cdnjs) yang sudah dimuat eager di shell.

/* ══════════════════════════════════════════════════
   ADMIN — Enhanced Download Functions (Word + Excel)
   Sinkronisasi dengan logika index_review.html
══════════════════════════════════════════════════ */

function adminHitungSkor(soalList, jawabanUser) {
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

function adminFixImgPaths(htmlStr) {
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

// Sama seperti adminFixImgPaths tapi untuk satu string src mentah (dipakai di
// item sikap_kerja yang nyimpan src gambar langsung, bukan sebagai tag <img>
// di dalam HTML). Tanpa ini, path relatif (mis. "/uploads/soal/x.jpg") lolos
// apa adanya ke file .doc dan jadi broken image saat dibuka di luar browser.
function adminFixSrc(src) {
  if (!src) return src;
  if (src.startsWith('http') || src.startsWith('data:')) return src;
  try { return new URL(src, window.location.href).href; } catch(e) { return src; }
}

function adminCreateChartImage(details) {
  const canvas = document.createElement('canvas');
  const W = 600, H = 250; 
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
  const pad = {t:30, r:20, b:50, l:40};
  const pw = W-pad.l-pad.r, ph = H-pad.t-pad.b;
  const n = details.length;
  
  const allV = details.flatMap(k => [k.total || 0, k.benar || 0, k.salah || 0]);
  const maxV = Math.max(...allV, 1);
  const stepX = pw/(n-1||1);

  ctx.strokeStyle='rgba(19,50,89,0.06)'; ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y = pad.t+ph-(i/4)*ph;
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+pw,y); ctx.stroke();
    ctx.fillStyle='rgba(19,50,89,0.5)'; ctx.font='10px Arial'; ctx.textAlign='right';
    ctx.fillText(Math.round(maxV*i/4), pad.l-8, y+3);
  }

  [['total','#1a5aa0'],['benar','#16a34a'],['salah','#dc2626']].forEach(([k,c])=>{
    ctx.beginPath(); ctx.strokeStyle=c; ctx.lineWidth=2; ctx.lineJoin='round';
    details.forEach((kl,i)=>{
      const val = kl[k] || 0; 
      const x = pad.l+i*stepX, y = pad.t+ph-(val/maxV)*ph;
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.stroke();
    
    details.forEach((kl,i)=>{
      const val = kl[k] || 0;
      const x = pad.l+i*stepX, y = pad.t+ph-(val/maxV)*ph;
      ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fillStyle=c; ctx.fill();
    });
  });

  ctx.textAlign='center';
  details.forEach((k,i)=>{
    const x = pad.l+i*stepX;
    ctx.fillStyle='#1e293b'; ctx.font='bold 11px Arial';
    ctx.fillText(`K${i+1}`, x, H-30);
    
    const dijawab = (k.benar || 0) + (k.salah || 0);
    const acc = dijawab > 0 ? Math.round(((k.benar||0)/dijawab)*100) : 0;
    
    ctx.fillStyle='#16a34a'; ctx.font='bold 10px Arial';
    ctx.fillText(`${acc}%`, x, H-15);
  });

  let lx = pad.l;
  [['Dijawab','#1a5aa0'],['Benar','#16a34a'],['Salah','#dc2626']].forEach(([lb,c])=>{
    ctx.fillStyle=c; ctx.fillRect(lx, 10, 14, 3);
    ctx.fillStyle='rgba(19,50,89,0.6)'; ctx.font='10px Arial'; ctx.textAlign='left';
    ctx.fillText(lb, lx+18, 14);
    lx += 70;
  });

  return canvas.toDataURL('image/png');
}

function adminDoDownloadExcel(lap, soalTampil, jawaban) {
  if (typeof XLSX === 'undefined') { if(typeof showToast==='function') showToast('Library XLSX tidak termuat', 'danger'); return; }
  const wb = adminBuildExcelWorkbook(lap, soalTampil, jawaban);
  const tgl = new Date().toLocaleDateString('id-ID').replace(/\//g,'-');
  XLSX.writeFile(wb, `Laporan_${lap.user_nama||lap.user_kode||'Peserta'}_${lap.modul_nama||'Ujian'}_${tgl}.xlsx`);
  if(typeof showToast === 'function') showToast('File Excel berhasil diunduh', 'success');
}

/* ── Membangun workbook Excel (dipakai untuk unduh 1 laporan maupun tiap file di dalam ZIP laporan grup) ── */
function adminBuildExcelWorkbook(lap, soalTampil, jawaban) {
  const soalAll = lap.soal_detail || [];
  const { perSoal: psArr, skData } = adminHitungSkor(soalAll, jawaban);
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
    ['Tanggal', typeof formatDateTime === 'function' ? formatDateTime(lap.tgl_selesai || lap.created_at) : (lap.tgl_selesai || lap.created_at)],
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

  // Sheet Detail per Soal
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
        const jArr = q.jawaban || [];
        const kunci = q.kunci || [];
        const kunciArr = Array.isArray(kunci) ? kunci.map(String) : [String(kunci??'')];

        let ua = jawaban[`${soal.kode}_${qi}`];
        if (ua == null && q.id != null) ua = jawaban[String(q.id)];

        const uaId = ua != null ? (Array.isArray(ua) ? ua[0] : String(ua)) : null;
        const isBenar = uaId != null && kunciArr.includes(uaId);

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

function adminDoDownloadWord(lap, soalTampil, jawaban) {
  const html = adminBuildLaporanWordHtml(lap, soalTampil, jawaban);
  const tgl = new Date().toLocaleDateString('id-ID').replace(/\//g,'-');
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Laporan_${(lap.user_nama||lap.user_kode||'Peserta')}_${(lap.modul_nama||'Ujian')}_${tgl}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  if (typeof showToast === 'function') showToast('File Word berhasil diunduh', 'success');
}

/* ── Membangun HTML laporan (dipakai untuk unduh 1 laporan maupun tiap file di dalam ZIP laporan grup) ── */
function adminBuildLaporanWordHtml(lap, soalTampil, jawaban) {
  const soalAll = lap.soal_detail || [];
  const { perSoal: psArr, skData } = adminHitungSkor(soalAll, jawaban);
  const mcArr = psArr.filter(s => s.type !== 'sikap_kerja');
  const totalB = mcArr.reduce((a,s)=>a+s.benar,0);
  const totalS = mcArr.reduce((a,s)=>a+(s.dijawab-s.benar),0);
  const totalT = mcArr.reduce((a,s)=>a+s.total,0);
  const tidakDijawab = totalT - mcArr.reduce((a,s)=>a+s.dijawab,0);
  const skorAkhir = Math.round(lap.skor||0) || (totalT ? Math.round(totalB/totalT*100) : 0);
  const fmtDT = typeof formatDateTime === 'function' ? formatDateTime : (s => s ? new Date(s).toLocaleString('id-ID') : '-');

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
  .opt.dijawab{border-color:#1a5aa0;background:rgba(26,90,160,0.07);}
  .opt-letter{width:24px;height:24px;border-radius:6px;background:#e8eef6;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;flex-shrink:0;}
  .opt.benar .opt-letter{background:#16a34a;color:#fff;}
  .opt.salah .opt-letter{background:#dc2626;color:#fff;}
  .opt.kunci-saja .opt-letter{background:#d97706;color:#fff;}
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
  <strong>Tanggal:</strong> ${fmtDT(lap.tgl_selesai||lap.created_at)} &nbsp;|&nbsp;
  <strong>Token:</strong> ${lap.token_kode||'-'}
</div>
<div class="skor-big">${skorAkhir}</div>
<div class="skor-lbl">Skor Akhir</div>
<div class="stat-row">
  <div class="stat-box"><div class="stat-val">${totalB}</div><div class="stat-lbl">Jawaban Benar</div></div>
  <div class="stat-box"><div class="stat-val">${totalS}</div><div class="stat-lbl">Jawaban Salah</div></div>
  <div class="stat-box"><div class="stat-val">${tidakDijawab}</div><div class="stat-lbl">Tidak Dijawab</div></div>
</div>`;

  if (mcArr.length > 1) {
    html += `<div class="sec-ttl">Nilai Per Subtes</div><div class="per-soal-grid">`;
    mcArr.forEach(s => {
      html += `<div class="ps-card"><div class="ps-nm">${s.nama}</div><div class="ps-skor ${s.skor>=60?'ok':'no'}">${s.skor}</div><div style="font-size:10px;color:#5a7a9a">${s.benar}/${s.total} benar</div></div>`;
    });
    html += `</div>`;
  }

  html += `<div class="legend-row">
    <div class="leg"><div class="leg-dot" style="background:#16a34a"></div>Benar (jawaban user & kunci)</div>
    <div class="leg"><div class="leg-dot" style="background:#dc2626"></div>Salah (jawaban user)</div>
    <div class="leg"><div class="leg-dot" style="background:#d97706"></div>Kunci (tidak dipilih user)</div>
  </div>`;

  soalTampil.forEach(soal => {
    const rawData = typeof soal.data === 'string' ? JSON.parse(soal.data) : (soal.data || []);
    html += `<div class="sec-ttl">${soal.nama} <span style="font-size:11px;font-weight:500;color:#5a7a9a">(${soal.type})</span></div>`;

    if (soal.type === 'sikap_kerja') {
      const sk = skData[soal.kode];
      if (sk && sk.kolom.length) {
        const chartImg = adminCreateChartImage(sk.kolom);
        html += `<div style="text-align:center;margin:10px 0"><img src="${chartImg}" width="500" style="border-radius:8px;border:1px solid #e0e8f0;"/></div>`;
        html += `<table class="data-table"><thead><tr><th>Kolom</th><th>Benar</th><th>Salah</th><th>Soal Terjawab</th><th>Akurasi</th></tr></thead><tbody>`;
        sk.kolom.forEach((col, ci) => {
          const terjawab = col.total || 0; 
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
            html+=`<div style="text-align:center"><div class="sk-lbl">${String.fromCharCode(65+i)}</div><div class="sk-item">${img?`<img src="${adminFixSrc(sv)}" style="max-height:30px;max-width:100%;">`:(sv||'?')}</div></div>`;
          });
          html+=`</div>`;
          const tampil=q.tampil||q.soal_item||[];
          html+=`<div style="font-size:10px;font-weight:700;color:#5a7a9a;margin:6px 0 4px;text-align:center">SOAL (4 Item)</div><div class="sk-q-row">`;
          tampil.forEach(v=>{const sv=String(v||'');const img=sv.startsWith('data:')||sv.startsWith('/')||sv.startsWith('http');html+=`<div class="sk-q-item">${img?`<img src="${adminFixSrc(sv)}" style="max-height:28px;max-width:100%;">`:(sv||'')}</div>`;});
          html+=`</div><div class="sk-choices">`;
          (kolom.items||[]).forEach((it,i)=>{
            const letter=String.fromCharCode(65+i);
            const v=it.nilai??it.value??it;const sv=String(v||'');
            const img=sv.startsWith('data:')||sv.startsWith('/')||sv.startsWith('http');
            const picked=userAns===letter;const isKey=(q.kunci_huruf||q.kunci)===letter;
            let cls='sk-choice';if(picked&&isKey)cls+=' benar';else if(picked&&!isKey)cls+=' salah';else if(!picked&&isKey)cls+=' kunci';
            html+=`<div class="${cls}"><div class="sk-ch-ltr">${letter}</div><div style="font-size:11px">${img?`<img src="${adminFixSrc(sv)}" style="max-height:22px;max-width:100%;">`:(sv||'?')}</div></div>`;
          });
          html+=`</div></div>`;
        });
        html+=`</div>`;
      });
    } else {
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
        const jArr = q.jawaban || [];
        const kunci = q.kunci || [];
        const kunciArr = Array.isArray(kunci) ? kunci.map(String) : [String(kunci??'')];

        const validJids = jArr.map((j, i) => j.id != null ? String(j.id) : String(i));
        let uaArr = [];
        allUserAns.forEach(ansId => { if (validJids.includes(String(ansId))) uaArr.push(String(ansId)); });
        
        if (uaArr.length === 0) {
            let fallback = jawaban[`${soal.kode}_${qi}`];
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
          <div class="q-teks">${adminFixImgPaths(q.soal)||'<em>Kosong</em>'}</div>`;
          
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

          html+=`<div class="${cls}"><div class="opt-letter">${letter}</div><div style="flex:1">${adminFixImgPaths(j.teks||j.text||'')||''} ${poinBadge}</div></div>`;
        });
        
        if(q.pembahasan) html+=`<div class="pembahasan"><strong>💡 Pembahasan:</strong><br>${adminFixImgPaths(q.pembahasan)}</div>`;
        html+=`</div>`;
      });
    }
  });

  html+=`</div></body></html>`;

  return html;
}
