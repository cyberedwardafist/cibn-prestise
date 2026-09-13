// admin/akun-admin/akun-admin.js
// Modul AKUN-KU (menu profil admin) — lazy-load saat tab Akun-ku dibuka.
// Sekarang HANYA berisi hero (nama/email/badge) + 4 tombol menu (Pengaturan/
// Management/Ganti Password/Log Out) — form ganti nama/email pindah ke
// admin/akun-admin/akun-pengaturan.js, form ganti password pindah ke
// admin/akun-admin/akun-ganti-password.js (masing2 halaman/file sendiri).
// (handleLogout TIDAK dipindah ke sini — dipakai dari eager shell index_admin.html)
// Bergantung pada helper global dari js/app.js yang sudah dimuat lebih dulu.

function renderAkunAdmin(){
    const user=Auth.getUser();if(!user)return;
    const n=document.getElementById('akun-admin-nama'),e=document.getElementById('akun-admin-email');
    if(n)n.textContent=user.nama||'-';if(e)e.textContent=user.email||'-';
}
