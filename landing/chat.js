// landing/chat.js
// Modul CHATBOT widget — lazy-load saat tombol chat pertama kali diklik.
// Bergantung pada helper global dari shell landing.html yang sudah dimuat lebih dulu.

// ── CHATBOT ──
// Data chatbot diambil dari server lewat applyData(). Ini fallback jika server belum dikonfigurasi.
const _defaultChatQuickReplies = {
  '💎 info paket': 'Kami memiliki 3 paket: Starter (Rp149K/bln), Professional (Rp299K/bln), dan Enterprise (custom). Paket Professional paling populer!',
  '📝 cara daftar': 'Daftar sangat mudah! Klik tombol "Masuk" lalu pilih "Daftar Sekarang". Prosesnya hanya 2 menit.',
  '📚 materi': 'Kami punya 200+ modul mencakup Akuntansi, SDM, IT, Hukum, Perbankan, dan banyak lagi!',
  '▶ coba ujian gratis': 'Klik tombol "Coba Ujian Gratis" di halaman ini untuk mencoba 5 soal demo tanpa perlu daftar!',
};
const _defaultChatKeywords = [
  {keyword:'harga', reply:'Paket kami mulai dari Rp149K/bulan. Lihat detail lengkap di bagian Paket Harga di halaman ini!'},
  {keyword:'sertifikat', reply:'Sertifikat kami diakui berbagai institusi keuangan dan perusahaan di Indonesia, dilengkapi teknologi blockchain untuk verifikasi keaslian.'},
  {keyword:'diskon', reply:'Kami menawarkan diskon hingga 30% untuk paket tahunan. Hubungi tim kami untuk info promo terkini!'},
  {keyword:'daftar', reply:'Klik tombol "Masuk" di pojok kanan atas, lalu pilih "Daftar Sekarang". Hanya butuh 2 menit!'},
  {keyword:'bayar', reply:'Kami menerima transfer bank, kartu kredit, e-wallet (GoPay, OVO, Dana), dan QRIS.'},
];
const _defaultChatReply = 'Terima kasih atas pertanyaannya! Tim kami siap membantu. Hubungi kami langsung untuk info lebih lanjut.';
// Helper — pakai data dari server jika tersedia
function getChatQuickReplies() { return (window._chatQuickMap && Object.keys(window._chatQuickMap).length) ? window._chatQuickMap : _defaultChatQuickReplies; }
function getChatKeywords() { return (window._chatKeywords && window._chatKeywords.length) ? window._chatKeywords : _defaultChatKeywords; }
function getChatDefaultReply() { return window._chatDefaultReply || _defaultChatReply; }

function toggleChat() {
  const b = document.getElementById('chatBox');
  b.classList.toggle('show');
  if (b.classList.contains('show')) {
    document.getElementById('chatToggle').querySelector('.notif').style.display = 'none';
  }
}
function sendChat() {
  const inp = document.getElementById('chatInput');
  const msg = inp.value.trim();
  if (!msg) return;
  const msgs = document.getElementById('chatMessages');
  const um = document.createElement('div');
  um.className = 'chat-msg user';
  um.textContent = msg;
  msgs.appendChild(um);
  inp.value = '';
  msgs.scrollTop = msgs.scrollHeight;
  setTimeout(() => {
    const bm = document.createElement('div');
    bm.className = 'chat-msg bot';
    const msgLow = msg.toLowerCase();
    let answer = getChatQuickReplies()[msgLow];
    if (!answer) {
      const matched = getChatKeywords().filter(k => k.keyword && msgLow.includes(k.keyword));
      if (matched.length) {
        const best = matched.reduce((a, b) => b.keyword.length > a.keyword.length ? b : a);
        answer = best.reply;
      }
    }
    if (!answer) answer = getChatDefaultReply();
    bm.textContent = answer;
    msgs.appendChild(bm);
    msgs.scrollTop = msgs.scrollHeight;
  }, 800);
}
function quickReply(t) {
  document.getElementById('chatInput').value = t;
  sendChat();
}

// ── LOGIN / REGISTER ──