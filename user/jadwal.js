// user/jadwal.js
// Modul JADWAL — lazy-load saat tab Jadwal dibuka.
// Bergantung pada helper global dari shell index_user.html (showToast, Auth, apiFetch,
// formatDate, goPage, dst) yang sudah dimuat lebih dulu.

/* ══════════════════════════════════════════
   JADWAL PAGE
   ══════════════════════════════════════════ */
async function loadJadwal() {
    const wrap = document.getElementById('jadwal-list-wrap');
    wrap.innerHTML = `<div class="jadwal-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><p>Memuat jadwal...</p><small>Mohon tunggu sebentar</small></div>`;
    try {
        const data = await apiFetch('/user/jadwal');
        if (!data || data.length === 0) {
            wrap.innerHTML = `<div class="jadwal-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><p>Tidak ada jadwal</p><small>Belum ada ujian yang dijadwalkan untuk Anda</small></div>`;
            return;
        }
        const now = new Date();
        wrap.innerHTML = data.map(j => {
            const mulai = j.waktu_mulai ? new Date(j.waktu_mulai) : null;
            const selesai = j.waktu_selesai ? new Date(j.waktu_selesai) : null;
            let status = 'akan', badgeLabel = 'Akan Datang';
            if (mulai && selesai) {
                if (now >= mulai && now <= selesai) { status = 'aktif'; badgeLabel = 'Berlangsung'; }
                else if (now > selesai) { status = 'selesai'; badgeLabel = 'Selesai'; }
            }
            const fmtDate = d => d ? d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '-';
            const fmtTime = d => d ? d.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' }) : '-';
            return `<div class="glass jadwal-item">
                <div class="jadwal-item-header">
                    <div class="jadwal-item-nama">${j.nama || j.modul_nama || 'Ujian'}</div>
                    <div class="jadwal-item-badge ${status}">${badgeLabel}</div>
                </div>
                <div class="jadwal-item-meta">
                    <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${fmtDate(mulai)}</span>
                    <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${fmtTime(mulai)} – ${fmtTime(selesai)}</span>
                    ${j.modul_nama ? `<span>📦 ${j.modul_nama}</span>` : ''}
                </div>
            </div>`;
        }).join('');
    } catch(e) {
        wrap.innerHTML = `<div class="jadwal-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><p>Gagal memuat jadwal</p><small>${e.message}</small></div>`;
    }
}

/* ══════════════════════════════════════════
   TOKEN & EXAM START
   ══════════════════════════════════════════ */
let _validatedExam = null; // stores { token, modul, soal }
