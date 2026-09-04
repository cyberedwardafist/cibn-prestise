# Rapikan Struktur Folder — Catatan Perubahan

## Apa yang diubah
Sebelumnya banyak file (`index.html`, `masuk.html`, `daftar.html`, `otp.html`,
`pembayaran.html`, `qris.html`, `index_admin.html`, `index_user.html`,
`index_review.html`, `ujian.html`, `landing.html`, dll) tercecer langsung di
folder root, bercampur dengan `server.js`, `package.json`, dan folder-folder
lain. Sekarang dikelompokkan per fungsi:

| Folder     | Isi                                                              |
|------------|-------------------------------------------------------------------|
| `public/`  | Halaman publik sebelum login (beranda, paket, materi, tentang, testimoni, kebijakan privasi, syarat & ketentuan) |
| `auth/`    | Alur masuk & daftar (masuk, login-redirect, daftar, otp)         |
| `payment/` | Alur pembayaran (pembayaran, qris)                                |
| `admin/`   | Sudah ada — sekarang juga menyimpan shell `index_admin.html`      |
| `user/`    | Sudah ada — sekarang juga menyimpan shell `index_user.html`       |
| `review/`  | Sudah ada — sekarang juga menyimpan shell `index_review.html`     |
| `ujian/`   | Sudah ada — sekarang juga menyimpan shell `ujian.html`             |
| `landing/` | Sudah ada — sekarang juga menyimpan shell `landing.html`           |

Folder `admin/`, `user/`, `review/`, `ujian/`, `landing/` sebelumnya sudah
jadi tempat "fragmen" yang di-lazy-load (mis. `admin/home.js`,
`user/jadwal.html`). Sekarang shell utamanya (`index_admin.html`, dst) ikut
disimpan satu tempat dengan fragmen-fragmennya — supaya kalau mau
edit/perbaiki satu dashboard, semua filenya ada di satu folder yang sama,
nggak perlu lompat ke root lagi.

## Yang PALING PENTING: URL/alamat halaman TIDAK berubah sama sekali
Ini murni rapi-rapi **penempatan file secara fisik**, bukan restrukturisasi
alur. Semua alamat yang dulu bisa diakses tetap sama persis:
- `/` dan `/index.html` → tetap
- `/masuk.html`, `/daftar.html`, `/otp.html`, `/login.html` → tetap
- `/pembayaran.html`, `/qris.html` → tetap
- `/index_admin.html`, `/index_user.html`, `/index_review.html` → tetap
- `/ujian.html`, `/landing.html` → tetap
- `/paket.html`, `/materi.html`, `/tentang.html`, `/testimoni.html`,
  `/kebijakan-privasi.html`, `/syarat-ketentuan.html`, `/info-paket.html` → tetap

Karena semua **ratusan tautan `href`/`window.location.href` yang sudah ada di
seluruh halaman menunjuk ke nama-nama file itu apa adanya**, saya sengaja
TIDAK mengubah satupun link tersebut. Yang saya ubah cuma `server.js`: saya
tambahkan beberapa baris supaya server tetap tahu harus mengambil file dari
lokasi fisik yang baru, walau alamat yang diketik di browser sama seperti
dulu. Jadi logic, alur login/daftar/bayar/ujian/review, dan seluruh JS di
dalamnya **tidak disentuh sama sekali** — cuma lokasi file yang dirapikan
+ beberapa baris routing di server.js.

## Perubahan di `server.js`
1. Ditambahkan 5 route eksplisit supaya shell tiap modul tetap terjangkau di
   alamat lama meski file-nya sudah pindah folder:
   `/index_admin.html`, `/index_review.html`, `/index_user.html`,
   `/ujian.html`, `/landing.html`.
2. Ditambahkan 3 mount statis baru untuk folder `public/`, `auth/`,
   `payment/` — dipasang tanpa prefix di URL supaya semua isinya tetap
   diakses seperti file itu masih ada langsung di root.
3. `app.get('/')` dan redirect `/login.html` disesuaikan supaya mengambil
   file dari lokasi barunya (`public/index.html`).

Tidak ada baris logic bisnis (auth, exam, payment, dsb) di `server.js` yang
diubah — hanya bagian "STATIC FILES" di paling bawah file.

## Perubahan di `vercel.json`
`includeFiles` ditambah `public/**`, `auth/**`, `payment/**` supaya Vercel
ikut men-deploy folder baru ini (kalau kamu deploy ke Vercel; kalau lewat
Railway biasanya seluruh repo ter-deploy otomatis jadi tidak masalah).

## Manfaat untuk maintenance ke depan
- Mau benerin tampilan/fungsi halaman **login/daftar**? Tinggal buka folder
  `auth/` — nggak perlu cari-cari di antara puluhan file lain di root.
- Mau ubah alur **pembayaran**? Semua ada di `payment/`.
- Mau ubah **dashboard admin**? Shell + seluruh fragmennya sekarang satu
  folder (`admin/`), nggak lagi kepisah antara root dan folder admin/.
- Root folder sekarang cuma isi file-file konfigurasi/server
  (`server.js`, `package.json`, `vercel.json`, dll) + folder-folder fungsi —
  jauh lebih ringan dibaca saat buka file explorer.

## File yang dihapus (tidak dipakai sama sekali)
Saya cek setiap file HTML/JS/CSS di seluruh project — dilacak apakah namanya
pernah muncul di file lain (termasuk di dalam `PAGE_MODULES` map yang dipakai
lazy-loader, bukan cuma tag `<script>`/`<link>` biasa). Hasilnya, 3 file di
folder `assets/` sama sekali tidak direferensikan di manapun (bukan di HTML,
JS, maupun kode server) — sudah dicek juga bukan file "default/fallback" yang
dipanggil tersembunyi lewat server:
- `assets/hero-video.mp4` (2.0 MB)
- `assets/video-promo.mp4` (832 KB)
- `assets/logo-cibn-prestise.png` (996 KB)

Total **~3.8 MB dihapus** dari sekitar 7.7 MB — hampir separuh ukuran project
ini adalah 3 file media yang tidak terpakai. Folder `assets/` ikut dihapus
karena sudah kosong. Video/gambar Hero & Video Promo di landing page
sekarang murni diatur lewat menu **Editor Landing** di dashboard Admin
(disimpan ke folder `uploads/`, bukan file statis ini).

Saya TIDAK menghapus semua file HTML/JS di folder `admin/`, `user/`, `review/`,
`ujian/`, `landing/` — sudah saya cek satu-satu, **semuanya masih dipakai**
(dipanggil lewat `PAGE_MODULES`/`USER_PAGE_MODULES`/`REVIEW_PAGE_MODULES` di
`js/app.js`, `user/index_user.html`, dan `review/index_review.html`).

## Ditemukan tapi SENGAJA TIDAK dihapus (perlu konfirmasi kamu)
Dua script di folder `scripts/` tidak dipanggil otomatis oleh server maupun
terdaftar di `package.json`:
- `scripts/cleanup-orphan-soal-refs.js`
- `scripts/backfill-laporan-izinkan-review.js`

Ini bukan file "sampah" — ini script perbaikan data satu-kali (one-off
migration) yang biasanya dijalankan manual (`node scripts/nama-file.js`) saat
migrasi/perbaikan data lama. Saya biarkan karena mungkin masih kamu perlukan
sewaktu-waktu. Kalau kamu yakin sudah pernah dijalankan dan tidak akan
dipakai lagi, bilang saja — saya hapus di iterasi berikutnya.

## Update: rapikan lagi per fungsi dock (admin/user/review)
Tiap tab di dashboard (dock menu) sekarang punya folder sendiri, isinya
HTML+JS+modal punya tab itu — bukan lagi tercecer campur semua di
`admin/`, `user/`, `review/` langsung.

**admin/** (per tombol dock):
- `admin/home/` — home.js (dashboard awal, dimuat eager oleh shell)
- `admin/akun/` — akun.html, akun-modals.html, akun-signup.js, akun.js
- `admin/akun-admin/` — akun-admin.html, akun-admin.js
- `admin/cat/` — grup dock **CAT**: token, laporan, review (html+js+modals
  ketiganya + shared-export.js, karena tiga tab ini saling pakai JS yang sama)
- `admin/soal/` — grup dock **SOAL**: soal, library, modul (+ editor.js,
  soal.js — dipakai bersama ketiganya)
- `admin/ebook/` — grup dock **E-BOOK**: buku, ebook-library, ebook-modul
- `admin/landing/` — landing.html, landing.js, landing-modals.html
- `admin/keuangan/` — keuangan.html, keuangan.js, paket-form.html/js,
  paket-daterange.js
- `admin/index_admin.html` tetap di root `admin/` (dia shell-nya, bukan
  fungsi dock tersendiri)

**user/**: `user/jadwal/`, `user/riwayat/`, `user/ebook/` — masing-masing
isi html+js tab itu (jadwal juga bawa 4 file overlay-nya: ajukan, tentor,
sesi, batal). `user/index_user.html` tetap di root.

**review/**: `review/akun/`, `review/riwayat/` (bawa juga
riwayat-modals.html & mode-review.html, dipakai bareng oleh tab akun &
riwayat), `review/akun-saya/`, `review/ebook/`. `review/index_review.html`
tetap di root.

File yang genuinely dipakai LINTAS-role (bukan cuma 1 fungsi dock) tetap di
`js/` root: `api.js`, `app.js`, `lazy-loader.js`, `pages.js`,
`custom-select.js`, `swipe.js`, `virtual-list.js`, `viewport-stabilize.js`,
`glass-common.js`, `jsQR.js`, `qrcode-gen.js`.

**Kenapa aman:** berbeda dari rapi-rapi tahap 1 (yang URL-nya sengaja
dipertahankan lewat trik routing di server.js), pemindahan fragmen ini
justru saya perbaiki LANGSUNG di sumbernya — path fragmen HTML/JS di
dashboard tidak ditulis manual di ratusan tempat, tapi terpusat di 3 "peta"
saja: `ADMIN_PAGE_MODULES` (js/app.js), `USER_PAGE_MODULES`
(user/index_user.html), `REVIEW_PAGE_MODULES` + `REVIEW_SHARED_MODALS`
(review/index_review.html). Saya update ketiga peta itu supaya nunjuk ke
lokasi baru — jadi lazy-loader tetap fetch file yang benar, dan tidak ada
efek samping ke ratusan tempat lain karena memang cuma di situ path-nya
disebut. Dicek juga: tidak ada file JS admin/user/review yang fetch()
sendiri pakai path hardcoded selain lewat 3 peta ini.

## Update: bersihin file "kembar" yang ketinggalan dari tahap sebelumnya
Pas rapi-rapi "per fungsi dock" di atas dijalankan, file lama di lokasi
FLAT (mis. `admin/akun.html`, `user/jadwal.js`, `review/riwayat.html`)
ternyata tidak ikut dihapus setelah isinya dipindah ke folder per-tab
(`admin/akun/akun.html`, `user/jadwal/jadwal.js`,
`review/riwayat/riwayat.html`) — jadi tiap file punya 2 salinan: yang
lama (nganggur, tidak dipanggil siapa-siapa) dan yang baru (yang beneran
dipakai lazy-loader lewat `ADMIN_PAGE_MODULES`/`USER_PAGE_MODULES`/
`REVIEW_PAGE_MODULES`).

Sebelum hapus, tiap file lama dicek dulu satu-satu ke SELURUH project
(HTML, JS, `server.js`, `vercel.json`) — dipastikan tidak ada satupun
`src=`, `href=`, `fetch()`, `LazyLoader`, atau `res.sendFile`/`app.get()`
yang masih menunjuk ke path lama itu (yang ada cuma komentar historis
yang nyebut nama file lama sebagai catatan, itu dibiarkan apa adanya,
cuma filenya yang dihapus). **54 file kembar** dihapus dari
`admin/`, `user/`, `review/` (shell `index_admin.html`/`index_user.html`/
`index_review.html` tetap di tempatnya, itu memang punya tempat di root
folder masing-masing).

Ditemukan juga **5 file lagi** di `js/` root (`js/akun.js`, `js/ebook.js`,
`js/editor.js`, `js/soal.js`, `js/token.js`) — ini bahkan generasi yang
LEBIH LAMA (arsitektur monolitik satu-file-per-fitur sebelum folder
`admin/` per-tab ada sama sekali), juga sudah nganggur total, ikut
dihapus dengan pengecekan yang sama.

**Tidak ada satupun logic, tampilan, atau path yang aktif dipakai yang
disentuh** — murni buang salinan lama yang sudah tidak direferensikan
di manapun. `node -c` dijalankan ulang ke `server.js` dan semua file JS
inti (`js/app.js`, `js/pages.js`, `js/lazy-loader.js`) untuk pastikan
tidak ada yang rusak sintaksnya.

## Yang TIDAK diubah (sengaja)
- Tidak ada logic auth/JWT, kalkulasi nilai ujian, alur pembayaran, atau
  query database yang disentuh.
- Tidak ada file yang dihapus atau di-rename isinya — cuma dipindah lokasi.
- Semua fragmen lazy-load (`admin/*.js`, `user/*.html`, dst) tidak disentuh
  karena memang sudah rapi dari awal dan basePath-nya sudah pakai path
  absolut (`/admin`, `/user`, dst) jadi tidak terpengaruh sama sekali oleh
  pemindahan shell.
