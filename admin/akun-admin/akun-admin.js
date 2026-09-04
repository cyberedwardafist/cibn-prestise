// admin/akun-admin.js
// Modul AKUN-KU (profil admin sendiri) — lazy-load saat tab Akun-ku dibuka.
// (handleLogout TIDAK dipindah ke sini — dipakai dari eager shell index_admin.html)
// Bergantung pada helper global dari js/app.js yang sudah dimuat lebih dulu.

function renderAkunAdmin(){
    const user=Auth.getUser();if(!user)return;
    const n=document.getElementById('akun-admin-nama'),e=document.getElementById('akun-admin-email');
    if(n)n.textContent=user.nama||'-';if(e)e.textContent=user.email||'-';
    const ni=document.getElementById('aa-nama'),ei=document.getElementById('aa-email');
    if(ni)ni.value=user.nama||'';if(ei)ei.value=user.email||'';
}
async function submitAkunAdmin(){
    const nama=document.getElementById('aa-nama')?.value.trim(),email=document.getElementById('aa-email')?.value.trim();
    const pw=document.getElementById('aa-pw')?.value,pwk=document.getElementById('aa-pwk')?.value;
    if(!nama||!email){showToast('Nama dan email wajib','danger');return;}
    if(pw&&pw!==pwk){showToast('Konfirmasi password tidak cocok','danger');return;}
    if(pw&&pw.length<6){showToast('Password minimal 6 karakter','danger');return;}
    try{const data={nama,email};if(pw)data.password=pw;await MeAPI.update(data);const u=Auth.getUser();Auth.setSession(Auth.getToken(),{...u,nama,email});clearDirty();renderAkunAdmin();showToast('Profil diperbarui!','success');if(document.getElementById('aa-pw'))document.getElementById('aa-pw').value='';if(document.getElementById('aa-pwk'))document.getElementById('aa-pwk').value='';}catch(e){showToast('Gagal: '+e.message,'danger');}
}
