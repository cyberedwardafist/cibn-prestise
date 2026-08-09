// landing/exam-demo.js
// Modul DEMO UJIAN (5 soal coba-coba tanpa daftar) — lazy-load saat tombol "Coba Ujian Gratis" pertama kali diklik.
// Bergantung pada helper global dari shell landing.html yang sudah dimuat lebih dulu.

// Soal default (fallback jika server belum dikonfigurasi)
const _defaultQuestions = [
  {q:'Apa kepanjangan dari OJK dalam sistem keuangan Indonesia?', opts:['Otoritas Jasa Keuangan','Organisasi Jasa Keuangan','Otoritas Jaminan Keuangan','Operasional Jasa Keuangan'], ans:0},
  {q:'Rasio kecukupan modal minimum yang wajib dipenuhi bank umum menurut regulasi Basel III adalah…', opts:['6%','8%','10%','12%'], ans:1},
  {q:'Manakah yang termasuk instrumen pasar uang?', opts:['Obligasi jangka panjang','Sertifikat Bank Indonesia (SBI)','Saham biasa','Reksadana saham'], ans:1},
  {q:"Prinsip 'Know Your Customer' (KYC) terutama bertujuan untuk…", opts:['Meningkatkan profit bank','Mencegah pencucian uang dan pendanaan terorisme','Mempercepat layanan nasabah','Mengurangi biaya operasional'], ans:1},
  {q:'Value at Risk (VaR) digunakan untuk mengukur…', opts:['Profitabilitas portofolio','Potensi kerugian maksimum pada tingkat kepercayaan tertentu','Kecepatan perputaran aset','Rasio likuiditas jangka pendek'], ans:1},
];
// Fungsi helper — ambil soal dari server jika ada, fallback ke default
function getQuestions() { return (window._customSoal && window._customSoal.length) ? window._customSoal : _defaultQuestions; }
let curQ = 0, score = 0, answered = false;

function openExam() {
  curQ = 0; score = 0; answered = false;
  document.getElementById('examOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
  renderExamQ();
}
function closeExam() {
  document.getElementById('examOverlay').classList.remove('show');
  document.body.style.overflow = '';
}
function renderExamQ() {
  const qs = getQuestions();
  const q = qs[curQ];
  const pct = (curQ / qs.length) * 100;
  document.getElementById('examBar').style.width = pct + '%';
  const letters = ['A','B','C','D','E'];
  document.getElementById('examContent').innerHTML =
    '<div class="exam-q-num">Soal ' + (curQ+1) + ' dari ' + qs.length + '</div>' +
    '<div class="exam-q-text">' + q.q + '</div>' +
    '<div class="exam-options">' +
    q.opts.map((o,i) => '<div class="exam-opt" onclick="selectOpt('+i+')" id="opt'+i+'"><div class="exam-opt-letter">'+letters[i]+'</div>'+o+'</div>').join('') +
    '</div>' +
    '<div class="exam-nav"><div></div><button class="btn-primary" onclick="nextQ()" style="padding:.7rem 1.6rem;font-size:.88rem">' +
    (curQ === qs.length-1 ? 'Lihat Hasil →' : 'Lanjut →') + '</button></div>';
}
function selectOpt(i) {
  if (answered) return;
  answered = true;
  document.querySelectorAll('.exam-opt').forEach((o, j) => {
    const qs2 = getQuestions();
  if (j === qs2[curQ].ans) o.classList.add('correct');
    else if (j === i && i !== qs2[curQ].ans) o.classList.add('wrong');
    else o.style.opacity = '.4';
    if (j === i) o.classList.add('selected');
  });
  if (i === qs2[curQ].ans) score++;
}
function nextQ() {
  if (!answered) { alert('Pilih jawaban terlebih dahulu!'); return; }
  curQ++;
  const qs3 = getQuestions();
  if (curQ < qs3.length) {
    answered = false;
    renderExamQ();
  } else {
    document.getElementById('examBar').style.width = '100%';
    const pct = Math.round(score / qs3.length * 100);
    const msg = pct >= 80 ? 'Luar biasa! Kamu sangat siap!' : pct >= 60 ? 'Bagus! Sedikit lagi sempurna.' : 'Terus berlatih, kamu pasti bisa!';
    document.getElementById('examContent').innerHTML =
      '<div class="exam-score">' +
      '<div class="exam-score-num">' + pct + '<span style="font-size:2rem">%</span></div>' +
      '<div class="exam-score-label">' + score + ' dari ' + qs3.length + ' soal benar</div>' +
      '<div class="exam-score-msg">' + msg + '</div>' +
      '</div>' +
      '<div style="text-align:center;margin-top:2rem">' +
      '<button class="btn-primary" onclick="openExam()" style="margin-right:.8rem">Coba Lagi</button>' +
      '<button class="btn-outline" onclick="closeExam();openSignup(\'Professional\',\'Rp299K/bulan\')" style="padding:.8rem 1.6rem">Mulai Berlangganan</button>' +
      '</div>';
  }
}
