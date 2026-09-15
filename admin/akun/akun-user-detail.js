// ── AKUN > USER > DETAIL AKUN (admin/akun/akun-user-detail.html) ──
// renderAkunUserDetail() dipanggil oleh renderPage() lewat
// map['akun-user-detail'] = 'renderAkunUserDetail' (js/app.js).
// window._akunUserDetailKode diisi kode akun oleh pemanggil (tombol Aksi di
// daftar Akun > User — lihat openUserDetailPage() di akun.js).
// Bagian Paket & Langganan (#uf-langganan-list, #uf-paket-pilih-edit) memakai
// ULANG helper & fungsi yang sudah ada di akun.js (_ufKode, _ufPaketList,
// _ufLoadPaketList, _ufPaketOptionsHtml, _ufRenderLanggananList,
// _ufTambahPaket, _ufHapusPaket) — file ini cuma menyiapkan datanya lalu
// memanggil fungsi2 itu, tidak menulis ulang logic paketnya.

let _audCurrentUser = null;
let _audGrubList = [];

async function renderAkunUserDetail() {
    const kode = window._akunUserDetailKode;
    const [users, grubs] = await Promise.all([
        UsersAPI.getByRole('user').catch(() => []),
        GrubsAPI.getAll().catch(() => [])
    ]);
    _audGrubList = grubs;
    const u = users.find(x => (x.kode || x.id) == kode);

    if (!u) {
        document.getElementById('aud-title').textContent = 'Akun tidak ditemukan';
        document.getElementById('aud-subtitle').textContent = '-';
        document.getElementById('aud-body').style.display = 'none';
        document.getElementById('aud-delete-btn').style.display = 'none';
        document.getElementById('aud-notfound').style.display = 'block';
        return;
    }
    document.getElementById('aud-body').style.display = 'block';
    document.getElementById('aud-delete-btn').style.display = '';
    document.getElementById('aud-notfound').style.display = 'none';
    _audCurrentUser = u;
    _ufKode = kode; // dipakai bareng oleh _ufTambahPaket/_ufHapusPaket/_ufRenderLanggananList di akun.js
    _ufRole = 'user';

    document.getElementById('aud-title').textContent = u.nama || '-';
    document.getElementById('aud-subtitle').textContent = `${u.email || '-'} · ${kode}`;

    document.getElementById('aud-grub').innerHTML = `<option value="">-- Tanpa Grup --</option>${grubs.map(g => `<option value="${g.kode || g.id}" ${u.grub === (g.kode || g.id) ? 'selected' : ''}>${g.nama}</option>`).join('')}`;
    document.getElementById('aud-nama').value = u.nama || '';
    document.getElementById('aud-email').value = u.email || '';
    document.getElementById('aud-status').value = u.status || 'aktif';
    document.getElementById('aud-password').value = '';
    document.getElementById('aud-konfirm').value = '';

    await _ufLoadPaketList();
    document.getElementById('uf-paket-pilih-edit').innerHTML = _ufPaketOptionsHtml();
    // _ufRenderLanggananList (akun.js) mengisi #uf-langganan-list DAN
    // #aud-paket-count sekaligus (lihat komentar di fungsi itu).
    await _ufRenderLanggananList();
}

async function _audSimpan() {
    if (!_audCurrentUser) return;
    const kode = _audCurrentUser.kode || _audCurrentUser.id;
    const nama = document.getElementById('aud-nama').value.trim();
    const email = document.getElementById('aud-email').value.trim();
    const grub = document.getElementById('aud-grub').value || null;
    const status = document.getElementById('aud-status').value;
    const pw = document.getElementById('aud-password').value;
    const pwk = document.getElementById('aud-konfirm').value;
    if (!nama || !email) { showToast('Nama dan email wajib', 'danger'); return; }
    if (pw && pw !== pwk) { showToast('Konfirmasi password tidak cocok', 'danger'); return; }
    if (pw && pw.length < 6) { showToast('Password minimal 6 karakter', 'danger'); return; }
    try {
        const d = { nama, email, role: 'user', grub, status };
        if (pw) d.password = pw;
        await UsersAPI.update(kode, d);
        showToast('Perubahan disimpan', 'success');
        document.getElementById('aud-password').value = '';
        document.getElementById('aud-konfirm').value = '';
        document.getElementById('aud-title').textContent = nama;
        document.getElementById('aud-subtitle').textContent = `${email} · ${kode}`;
    } catch (e) { showToast('Gagal: ' + e.message, 'danger'); }
}

function _audDelete() {
    if (!_audCurrentUser) return;
    const kode = _audCurrentUser.kode || _audCurrentUser.id;
    const nama = _audCurrentUser.nama || '';
    showConfirm('Hapus Akun', `Yakin hapus akun "${nama}"? Seluruh langganan paket akun ini juga akan ikut terhapus. Tindakan ini tidak bisa dibatalkan.`, 'danger', async () => {
        await UsersAPI.delete(kode);
        showToast('Akun dihapus', 'danger');
        navigateTo('akun');
    });
}
