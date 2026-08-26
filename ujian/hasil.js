// ujian/hasil.js
// ─────────────────────────────────────────────────────────────────────────
// Modul HASIL UJIAN — di-lazy-load oleh ujian.html HANYA saat siswa menekan
// tombol "Selesai" (lihat ensureHasilModule() di ujian.html). Berisi kirim
// jawaban ke server, hitung skor, render halaman hasil, dan grafik canvas.
// Bergantung pada variabel global dari ujian.html (st, API, getJWT, showToast,
// buildFlat) yang sudah dimuat lebih dulu sebelum file ini dieksekusi.
// ─────────────────────────────────────────────────────────────────────────

// Tampilkan halaman hasil dalam status "menunggu" (spinner) — dipanggil begitu
// siswa klik Selesai, SEBELUM ada respons server sama sekali.
function showHasilPending(){
  document.getElementById('app').style.display='none';
  document.getElementById('hasil-page').classList.add('active');
  document.getElementById('h-loading').style.display='block';
  document.getElementById('h-result-body').style.display='none';
}

// Kirim hasil ujian ke server dengan percobaan ulang otomatis. Mengembalikan body
// JSON respons server (berisi skor otoritatif + soal lengkap dengan kunci) kalau
// sukses, atau null kalau gagal setelah beberapa percobaan (lalu tampilkan tombol
// "Coba Kirim Ulang" — progress lokal baru dihapus setelah benar-benar sukses,
// supaya jawaban peserta tidak hilang kalau koneksi bermasalah).
async function kirimHasilUjian(token, payload, attempt=1){
  try{
    const res=await fetch(API+'/exam/submit',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+getJWT()},
      body:JSON.stringify(payload)
    });
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data=await res.json();
    // Sukses — baru sekarang aman menghapus progress lokal. cibn_flat_data_ dihapus
    // belakangan oleh finalizeHasil(), setelah dipakai sekali lagi untuk merekonstruksi
    // urutan tampil soal/jawaban yang sama persis dengan yang dilihat peserta.
    localStorage.removeItem('cbn_progress_jawaban_' + token);
    localStorage.removeItem('cbn_progress_idx_' + token);
    localStorage.removeItem('cbn_timers_' + token);
    localStorage.removeItem('cbn_maintimer_' + token);
    localStorage.removeItem('cbn_sk_timer_' + token);
    localStorage.removeItem('cbn_pending_submit_' + token);
    localStorage.removeItem('cbn_leavecount_' + token);
    const warn=document.getElementById('h-submit-warning'); if(warn) warn.style.display='none';
    await CBN_DB.clear();
    return data;
  }catch(e){
    console.warn('Submit gagal (percobaan '+attempt+'):',e);
    if(attempt<3){
      await new Promise(r=>setTimeout(r,1500));
      return kirimHasilUjian(token, payload, attempt+1);
    }
    // Gagal setelah beberapa percobaan: simpan payload supaya tidak hilang, dan
    // beri tahu peserta secara jelas (bukan hanya log di console). Halaman tetap di
    // status "menunggu" (bukan skor) sampai submit benar-benar sukses.
    try{ localStorage.setItem('cbn_pending_submit_' + token, JSON.stringify(payload)); }catch(err){}
    const loadTxt=document.querySelector('#h-loading .h-loading-txt');
    if(loadTxt) loadTxt.textContent='Menunggu koneksi untuk mengirim hasil ujian...';
    const warn=document.getElementById('h-submit-warning');
    if(warn){
      warn.style.display='block';
      warn.innerHTML='⚠️ Hasil ujian ini <strong>belum berhasil terkirim</strong> ke server (kemungkinan koneksi bermasalah). Jangan tutup halaman ini — skor belum bisa dihitung sebelum tersimpan di server. <button class="btn-nav btn-nav-pri" style="padding:6px 14px;font-size:12px;margin-left:6px" onclick="retryKirimHasil(\''+token+'\')">Coba Kirim Ulang</button>';
    } else {
      showToast('Hasil ujian belum berhasil terkirim, silakan coba lagi','danger');
    }
    return null;
  }
}

async function retryKirimHasil(token){
  let payload=null;
  try{ payload=JSON.parse(localStorage.getItem('cbn_pending_submit_' + token)||'null'); }catch(e){}
  if(!payload){ showToast('Tidak ada data tersimpan untuk dikirim ulang','danger'); return; }
  showToast('Mengirim ulang...','');
  const loadTxt=document.querySelector('#h-loading .h-loading-txt');
  if(loadTxt) loadTxt.textContent='Mengirim & menghitung hasil ujian...';
  const result=await kirimHasilUjian(token, payload, 1);
  if(result) await finalizeHasil(token, result);
}

// Dipanggil HANYA setelah server konfirmasi submit sukses (token sudah terkunci).
// result.soal sekarang berisi kunci jawaban lengkap — aman dipakai karena ujian
// sudah resmi selesai. Susun ulang st.flat memakai buildFlat() supaya urutan
// tampil soal/jawaban acak tetap identik dengan yang dilihat peserta saat mengerjakan
// (buildFlat membaca skeleton ringan di localStorage 'cibn_flat_data_'+token untuk itu).
async function finalizeHasil(token, result){
  st.examData.soal = result.soal || st.examData.soal;
  buildFlat();
  localStorage.removeItem('cibn_flat_data_' + token);
  const h=hitungHasil();
  document.getElementById('h-loading').style.display='none';
  document.getElementById('h-result-body').style.display='block';
  tampilHasil(h);
}

function hitungHasil(){
  const perSoal={},skData={};
  for(const item of st.flat){
    if(!perSoal[item.soalKode]){
      perSoal[item.soalKode]={
        nama:item.soalNama,type:item.type,skor_type:item.skor_type||'benar_salah',
        persen:(item.persen!=null?item.persen:100),
        benar:0,total:0,
        // khusus nilai_sendiri
        nilaiDapat:0,nilaiMaks:0
      };
    }
    if(item.type==='sikap_kerja'){
      if(!skData[item.soalKode]){
        skData[item.soalKode]={nama:item.soalNama,kolom:[]};
        (item.kolom||[]).forEach((kol,ki)=>{
          const sk=`${item.soalKode}_${ki}`;
          let b=0,sl=0,dij=0;
          (kol.soal||[]).forEach((_q,qi)=>{
            const ans=st.jawaban[`${sk}_${qi}`];
            if(ans){dij++;const k=_q.kunci_huruf||_q.kunci;if(ans===k)b++;else sl++;}
          });
          skData[item.soalKode].kolom.push({total:dij,benar:b,salah:sl,totalSoal:(kol.soal||[]).length});
        });
        const sk2=skData[item.soalKode];
        perSoal[item.soalKode].benar=sk2.kolom.reduce((a,c)=>a+c.benar,0);
        perSoal[item.soalKode].total=sk2.kolom.reduce((a,c)=>a+c.totalSoal,0);
      }
    } else if(item.skor_type==='nilai_sendiri'){
      // ── NILAI PER JAWABAN ──
      const key=`${item.soalKode}_${item.qIdx}`;
      const ans=st.jawaban[key]; // bisa string id atau array of id
      const jawaban=item.q.jawaban||[];
      perSoal[item.soalKode].total++;

      // Hitung nilai maksimum soal ini: ambil top-N nilai terbesar (N = opsi_jawaban)
      const opsi=item.opsi||1;
      const sortedNilai=[...jawaban].map(j=>parseFloat(j.nilai)||0).sort((a,b)=>b-a);
      const maks=sortedNilai.slice(0,opsi).reduce((s,v)=>s+v,0);
      perSoal[item.soalKode].nilaiMaks+=maks;

      // Hitung nilai yang didapat
      if(ans){
        const pilihanIds=Array.isArray(ans)?ans:[ans];
        const dapat=pilihanIds.reduce((s,pid)=>{
          const j=jawaban.find(jj=>jj.id===pid);
          return s+(parseFloat(j?.nilai)||0);
        },0);
        perSoal[item.soalKode].nilaiDapat+=dapat;
        // Anggap "benar" jika dapat nilai > 0 (untuk stat grid)
        if(dapat>0) perSoal[item.soalKode].benar++;
      }
    } else {
      // ── BENAR / SALAH ──
      const key=`${item.soalKode}_${item.qIdx}`,ans=st.jawaban[key];
      const kunci=item.q.kunci||[];
      perSoal[item.soalKode].total++;
      if(ans){
        let isBenar=false;
        if(Array.isArray(ans)){isBenar=ans.length===kunci.length&&ans.every(a=>kunci.includes(a));}
        else{isBenar=Array.isArray(kunci)?kunci.includes(ans):ans===kunci;}
        if(isBenar) perSoal[item.soalKode].benar++;
      }
    }
  }

  // Hitung skor per soal
  const arr=Object.entries(perSoal).map(([k,v])=>{
    let skor;
    if(v.skor_type==='nilai_sendiri'){
      skor=v.nilaiMaks>0?Math.round(v.nilaiDapat/v.nilaiMaks*100):0;
    } else {
      skor=v.total>0?Math.round(v.benar/v.total*100):0;
    }
    return{soalKode:k,...v,skor};
  });

  // Total keseluruhan: gabungkan semua soal MC/Linier
  // BUG YANG DIPERBAIKI: skor akhir SEBELUMNYA hanya menjumlah benar/total (atau
  // nilaiDapat/nilaiMaks) MENTAH dari semua soal secara rata, sehingga pengaturan
  // "Bobot (%)" per soal di Manajemen Modul (mis. TWK 30%, TIU 35%, TKP 35%) terlihat
  // bisa diatur tapi TIDAK PERNAH benar-benar memengaruhi nilai akhir peserta — modul
  // dengan 3 kelompok soal berbobot berbeda tetap dihitung seolah semua soal bernilai
  // sama rata. Sekarang skor akhir adalah RATA-RATA TERBOBOT per kelompok soal
  // (bobot = field "persen" per soal, default 100 kalau tidak diatur admin), memakai
  // rumus yang identik dengan perhitungan ulang otoritatif di server (server.js,
  // hitungSkorUjianServer) — supaya angka yang ditampilkan ke siswa sama persis
  // dengan yang tersimpan sebagai skor resmi di database.
  let totalBobot=0, totalTerbobot=0;
  arr.filter(s=>s.type!=='sikap_kerja').forEach(s=>{
    const bobot = s.persen!=null ? s.persen : 100;
    totalBobot += bobot;
    totalTerbobot += s.skor * bobot;
  });
  const skorAkhir = totalBobot>0 ? Math.round(totalTerbobot/totalBobot) : 0;

  // Statistik mentah (jumlah benar/salah, nilai didapat/maks) tetap dihitung TANPA
  // bobot — ini murni untuk kartu statistik ("X Jawaban Benar", dst), bukan skor akhir.
  let totNilaiDapat=0,totNilaiMaks=0,totB=0,totT=0;
  arr.filter(s=>s.type!=='sikap_kerja').forEach(s=>{
    if(s.skor_type==='nilai_sendiri'){totNilaiDapat+=s.nilaiDapat;totNilaiMaks+=s.nilaiMaks;}
    else{totB+=s.benar;totT+=s.total;}
  });

  return{perSoal:arr,skData,skorAkhir,totalBenar:totB,totalSoal:totT,totNilaiDapat,totNilaiMaks};
}

function tampilHasil(h){
  document.getElementById('app').style.display='none';
  document.getElementById('hasil-page').classList.add('active');

  // Pisahkan data: hanya MC dan Linier (bukan sikap_kerja)
  const perSoalMCLin=h.perSoal.filter(s=>s.type!=='sikap_kerja');

  // Statistik mentah (untuk kartu "Jawaban Benar/Salah" & "Nilai Didapat/Maks") —
  // tidak terbobot, murni jumlah apa adanya.
  let totNDapat=0,totNMaks=0,totBs=0,totTs=0;
  perSoalMCLin.forEach(s=>{
    if(s.skor_type==='nilai_sendiri'){totNDapat+=s.nilaiDapat;totNMaks+=s.nilaiMaks;}
    else{totBs+=s.benar;totTs+=s.total;}
  });

  // BUG YANG DIPERBAIKI: skor besar yang ditampilkan ke siswa SEBELUMNYA dihitung ULANG
  // di sini secara terpisah dari hitungHasil() — dua rumus berbeda yang bisa saling tidak
  // konsisten, dan keduanya SAMA-SAMA mengabaikan Bobot (%) per soal. Sekarang memakai
  // h.skorAkhir langsung (satu-satunya sumber kebenaran, sudah terbobot dengan benar,
  // dan angka yang sama persis yang dikirim ke server saat submit).
  const skorMCLin=h.skorAkhir;

  document.getElementById('h-skor-big').textContent=skorMCLin;
  // Info KKM (nilai minimum lulus)
  const nilaiMin=st.examData.modul?.nilai_minimum!=null?st.examData.modul.nilai_minimum:null;
  const kkm=document.getElementById('h-skor-big');
  if(nilaiMin!=null){
    const lulus=skorMCLin>=nilaiMin;
    kkm.style.color=lulus?'var(--success)':'var(--danger)';
    const hasilSkorLbl=document.querySelector('.hasil-skor-lbl');
    if(hasilSkorLbl)hasilSkorLbl.innerHTML=`Skor Akhir &nbsp;·&nbsp; KKM: ${nilaiMin} &nbsp;<span style="font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;background:${lulus?'rgba(22,163,74,0.12)':'rgba(220,38,38,0.12)'};color:${lulus?'var(--success)':'var(--danger)'}">${lulus?'✓ LULUS':'✗ TIDAK LULUS'}</span>`;
  }

  // Stat grid — pisahkan benar/salah (hanya benar_salah) dan nilai (nilai_sendiri)
  const totalMCFlat=st.flat.filter(f=>f.type!=='sikap_kerja').length;
  const totalDijawab=st.flat.filter(f=>f.type!=='sikap_kerja'&&!!st.jawaban[`${f.soalKode}_${f.qIdx}`]).length;
  const adaNilaiSendiri=perSoalMCLin.some(s=>s.skor_type==='nilai_sendiri');
  const adaBenarSalah=perSoalMCLin.some(s=>s.skor_type!=='nilai_sendiri');

  let statHtml='';
  if(adaBenarSalah){
    statHtml+=`
      <div class="hasil-stat"><div class="hasil-stat-val">${totBs}</div><div class="hasil-stat-lbl">Jawaban Benar</div></div>
      <div class="hasil-stat"><div class="hasil-stat-val">${totTs-totBs}</div><div class="hasil-stat-lbl">Jawaban Salah</div></div>`;
  }
  if(adaNilaiSendiri){
    statHtml+=`
      <div class="hasil-stat"><div class="hasil-stat-val" style="font-size:20px">${totNDapat.toFixed(1)}</div><div class="hasil-stat-lbl">Nilai Didapat</div></div>
      <div class="hasil-stat"><div class="hasil-stat-val" style="font-size:20px">${totNMaks.toFixed(1)}</div><div class="hasil-stat-lbl">Nilai Maksimum</div></div>`;
  }
  statHtml+=`
    <div class="hasil-stat"><div class="hasil-stat-val">${totalMCFlat-totalDijawab}</div><div class="hasil-stat-lbl">Tidak Dijawab</div></div>
    <div class="hasil-stat"><div class="hasil-stat-val">${totalMCFlat}</div><div class="hasil-stat-lbl">Total Soal</div></div>`;
  document.getElementById('h-stat-grid').innerHTML=statHtml;

  // Kartu Nilai Per Bagian — tampilkan info sesuai skor_type
  const perBagianHtml=perSoalMCLin.length
    ? `<div class="hasil-sec-ttl">Nilai Per Bagian</div><div class="hasil-soal-grid">${perSoalMCLin.map(s=>{
        const isNS=s.skor_type==='nilai_sendiri';
        const subInfo=isNS
          ? `<div style="font-size:11px;color:var(--text-sub);margin-top:2px">${s.nilaiDapat.toFixed(1)} / ${s.nilaiMaks.toFixed(1)} nilai</div>`
          : `<div style="font-size:11px;color:var(--text-sub);margin-top:2px">${s.benar}/${s.total} benar</div>`;
        const badge=isNS?`<div style="font-size:9px;font-weight:700;color:var(--accent);background:rgba(26,90,160,0.1);padding:2px 7px;border-radius:10px;margin-bottom:4px;display:inline-block">Nilai per Jawaban</div>`:'';
        return`<div class="hasil-soal-card">${badge}<div class="hasil-soal-nm">${s.nama}</div><div class="hasil-soal-sk ${s.skor>=60?'ok':'no'}">${s.skor}<span style="font-size:13px;font-weight:500">/100</span></div>${subInfo}</div>`;
      }).join('')}</div>`
    : '';
  document.getElementById('h-per-soal').innerHTML=perBagianHtml;
  if(Object.keys(h.skData).length){
    let skHtml='';
    Object.entries(h.skData).forEach(([kode,sk])=>{
      const kols=sk.kolom;
      const maxD=Math.max(...kols.map(k=>k.total),0),maxB=Math.max(...kols.map(k=>k.benar),0),maxSl=Math.max(...kols.map(k=>k.salah),0);
      const n=kols.length||1;
      const avgD=Math.round(kols.reduce((a,c)=>a+c.total,0)/n),avgB=Math.round(kols.reduce((a,c)=>a+c.benar,0)/n),avgSl=Math.round(kols.reduce((a,c)=>a+c.salah,0)/n);
      skHtml+=`<div class="hasil-sec-ttl" style="margin-top:16px">Grafik Sikap Kerja — ${sk.nama}</div>
        <div class="chart-wrap"><canvas id="skc-${kode}" style="width:100%;max-height:200px;"></canvas></div>
        <div class="sk-stats-grid">
          <div class="sk-stat"><div class="sk-stat-val">${maxD}</div><div class="sk-stat-lbl">Dijawab Terbanyak</div></div>
          <div class="sk-stat"><div class="sk-stat-val">${avgD}</div><div class="sk-stat-lbl">Rata-rata Dijawab</div></div>
          <div class="sk-stat"><div class="sk-stat-val" style="color:var(--success)">${maxB}</div><div class="sk-stat-lbl">Benar Terbanyak</div></div>
          <div class="sk-stat"><div class="sk-stat-val" style="color:var(--success)">${avgB}</div><div class="sk-stat-lbl">Rata-rata Benar</div></div>
          <div class="sk-stat"><div class="sk-stat-val" style="color:var(--danger)">${maxSl}</div><div class="sk-stat-lbl">Salah Terbanyak</div></div>
          <div class="sk-stat"><div class="sk-stat-val" style="color:var(--danger)">${avgSl}</div><div class="sk-stat-lbl">Rata-rata Salah</div></div>
        </div>`;
    });
    document.getElementById('h-sk-section').innerHTML=skHtml;
    setTimeout(()=>Object.entries(h.skData).forEach(([kode,sk])=>drawChart('skc-'+kode,sk.kolom)),120);
  }
}

function drawChart(id,kolom){
  const c=document.getElementById(id);if(!c)return;
  const ctx=c.getContext('2d'),W=c.offsetWidth||700,H=200;c.width=W;c.height=H;
  const pad={t:16,r:14,b:30,l:30},pw=W-pad.l-pad.r,ph=H-pad.t-pad.b,n=kolom.length;
  const all=kolom.flatMap(k=>[k.total,k.benar,k.salah]),maxV=Math.max(...all,1),sx=pw/(n-1||1);
  ctx.clearRect(0,0,W,H);
  for(let i=0;i<=4;i++){const y=pad.t+ph-(i/4)*ph;ctx.strokeStyle='rgba(19,50,89,0.06)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+pw,y);ctx.stroke();ctx.fillStyle='rgba(19,50,89,0.35)';ctx.font='9px DM Sans';ctx.fillText(Math.round(maxV*i/4),2,y+3);}
  [['total','#1a5aa0','Dijawab'],['benar','#16a34a','Benar'],['salah','#dc2626','Salah']].forEach(([k,col])=>{
    ctx.beginPath();ctx.strokeStyle=col;ctx.lineWidth=2.5;ctx.lineJoin='round';
    kolom.forEach((kl,i)=>{const x=pad.l+i*sx,y=pad.t+ph-(kl[k]/maxV)*ph;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
    ctx.stroke();
    kolom.forEach((kl,i)=>{const x=pad.l+i*sx,y=pad.t+ph-(kl[k]/maxV)*ph;ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fillStyle=col;ctx.fill();});
  });
  ctx.fillStyle='rgba(19,50,89,0.45)';ctx.font='9px DM Sans';ctx.textAlign='center';
  kolom.forEach((_,i)=>ctx.fillText(`K${i+1}`,pad.l+i*sx,H-6));
  let lx=pad.l;[['Dijawab','#1a5aa0'],['Benar','#16a34a'],['Salah','#dc2626']].forEach(([lb,col])=>{ctx.fillStyle=col;ctx.fillRect(lx,4,14,2.5);ctx.fillStyle='rgba(19,50,89,0.5)';ctx.font='9px DM Sans';ctx.textAlign='left';ctx.fillText(lb,lx+17,10);lx+=72;});
}

