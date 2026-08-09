// landing/doc-modal.js
// Modul MODAL Syarat&Ketentuan / Kebijakan Privasi — lazy-load saat pertama kali dibuka.
// Bergantung pada helper global dari shell landing.html yang sudah dimuat lebih dulu.

const _defaultDocData = {
  sk: { title: 'Syarat & Ketentuan', content: '(Belum dikonfigurasi oleh admin)' },
  kp: { title: 'Kebijakan Privasi', content: '(Belum dikonfigurasi oleh admin)' }
};
function openDocModal(type) {
  const fromServer = type === 'sk' ? window._docData_sk : window._docData_kp;
  const d = fromServer || _defaultDocData[type];
  if (!d) return;
  document.getElementById('docModalTitle').textContent = d.title;
  document.getElementById('docModalBody').textContent = d.content;
  document.getElementById('docModalOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeDocModal() {
  document.getElementById('docModalOverlay').classList.remove('show');
  document.body.style.overflow = '';
}

// ── CANVAS PARTICLE ──
/* ── CANVAS PARTICLE ── */