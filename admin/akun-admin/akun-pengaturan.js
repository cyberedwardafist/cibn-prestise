// admin/akun-admin/akun-pengaturan.js
// Modul AKUN SAYA > PENGATURAN (ganti nama/email) — lazy-load saat tab
// akun-pengaturan dibuka. Bergantung pada helper global dari js/app.js
// (Auth, MeAPI, showToast, setDirty/clearDirty) yang sudah dimuat lebih dulu.
// Pecahan dari admin/akun-admin/akun-admin.js versi lama (dulu jadi satu
// dgn ganti password & tombol Keluar di 1 halaman/1 file).

function renderAkunPengaturan() {
    const user = Auth.getUser(); if (!user) return;
    const ni = document.getElementById('ap-nama'), ei = document.getElementById('ap-email');
    if (ni) ni.value = user.nama || '';
    if (ei) ei.value = user.email || '';
}

async function submitAkunPengaturan() {
    const nama = document.getElementById('ap-nama')?.value.trim();
    const email = document.getElementById('ap-email')?.value.trim();
    if (!nama || !email) { showToast('Nama dan email wajib', 'danger'); return; }
    try {
        await MeAPI.update({ nama, email });
        const u = Auth.getUser();
        Auth.setSession(Auth.getToken(), { ...u, nama, email });
        clearDirty();
        // Refresh hero nama/email di halaman menu Akun Saya juga, kalau elemennya
        // sempat ke-render sebelumnya (lihat renderAkunAdmin di akun-admin.js).
        const heroN = document.getElementById('akun-admin-nama'), heroE = document.getElementById('akun-admin-email');
        if (heroN) heroN.textContent = nama;
        if (heroE) heroE.textContent = email;
        showToast('Profil diperbarui!', 'success');
    } catch (e) { showToast('Gagal: ' + e.message, 'danger'); }
}

// PLACEHOLDER: tombol "Ajukan" diminta ada duluan, fungsinya menyusul nanti
// (spesifikasi belum ada) — sengaja cuma kasih toast info, bukan error, biar
// jelas ini memang belum diimplementasi, bukan bug.
function ajukanPengaturan() {
    showToast('Fitur Ajukan belum tersedia');
}
