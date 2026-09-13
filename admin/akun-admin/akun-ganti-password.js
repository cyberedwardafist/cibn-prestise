// admin/akun-admin/akun-ganti-password.js
// Modul AKUN SAYA > GANTI PASSWORD — lazy-load saat tab akun-ganti-password
// dibuka. Bergantung pada helper global dari js/app.js (MeAPI, showToast,
// setDirty/clearDirty, togglePwVis) yang sudah dimuat lebih dulu.
// Pecahan dari admin/akun-admin/akun-admin.js versi lama (dulu jadi satu
// dgn ganti nama/email di 1 halaman/1 file).

function renderAkunGantiPassword() {
    const pw = document.getElementById('agp-pw'), pwk = document.getElementById('agp-pwk');
    if (pw) pw.value = '';
    if (pwk) pwk.value = '';
}

async function submitAkunGantiPassword() {
    const pw = document.getElementById('agp-pw')?.value;
    const pwk = document.getElementById('agp-pwk')?.value;
    if (!pw) { showToast('Password baru wajib diisi', 'danger'); return; }
    if (pw.length < 6) { showToast('Password minimal 6 karakter', 'danger'); return; }
    if (pw !== pwk) { showToast('Konfirmasi password tidak cocok', 'danger'); return; }
    try {
        await MeAPI.updatePassword(pw);
        clearDirty();
        renderAkunGantiPassword();
        showToast('Password berhasil diubah!', 'success');
    } catch (e) { showToast('Gagal: ' + e.message, 'danger'); }
}
