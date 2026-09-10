// admin/analisa/analisa-token-detail.js
// Halaman detail Analisa untuk 1 GRUP TOKEN — dibuka dari admin/analisa/analisa-token.js
// lewat openAnalisaTokenDetail(namaGrup). File ini SENGAJA dipisah dari analisa-token.js
// dan TIDAK didaftarkan sebagai item di SIDE_DOCK_GROUPS.analisa (lihat
// admin/index_admin.html): begitu halaman ini aktif, panel slide-dock ANALISA
// otomatis tertutup (groupForPage() tidak menemukan grupnya), dan tombol panah
// kembali di atas yang membawa balik ke page-analisa-token — yang otomatis
// membuka lagi panel slide-dock-nya.
//
// window._analisaTokenDetailGrup = KUNCI grup yang diklik (grub_id, atau
// "legacy:<nama>" utk token lama — lihat _atGrupKey() di analisa-token.js).
// window._analisaTokenDetailGrupNama = NAMA tampilan grup itu (grub_token,
// boleh sama dgn grup lain) — dipakai di subjudul & badge, terpisah dari
// kunci di atas supaya 2 grup senama tidak pernah ketuker datanya.
// window._analisaTokenDetailItems = seluruh token mentah dalam grup itu (siap
// dipakai untuk analisa lebih lanjut per modul/per akun, dst).
//
// ── GRAFIK PER SOAL — datanya diambil dari GET /api/analisa/grup/:grubToken
// (agregasi jawaban asli, dihitung di server.js/computeAnalisaGrupAggregate)
// ──────────────────────────────────────────────────────────────────────────
// Prototipe grafik GARIS (line chart), murni SVG + CSS sendiri (css/chart.css),
// tanpa library chart eksternal apapun:
//
//  1) Tipe "Benar/Salah" (soal dinilai otomatis, mis. pilihan ganda):
//     x = nomor urut soal (urutan asli dibuat admin, BUKAN urutan acak saat
//     ujian — jadi soal no.3 di sini selalu soal yg sama walau saat ujian
//     tampil di posisi acak berbeda utk tiap peserta), y = jumlah jawaban,
//     2 garis per soal: hijau = Benar, merah = Salah.
//
//  2) Tipe "Nilai/Skor Sendiri" (soal dinilai reviewer, mis. uraian/essay
//     dgn skala nilai 0-5): x = nomor urut soal, y = jumlah jawaban (jumlah
//     orang), 1 garis berwarna per nilai yang muncul — warna
//     dipetakan tetap per nilai (legenda di bawah grafik), TINGGI titik garis =
//     banyaknya orang yang dapat nilai itu di tiap soal.
//
//  3) Tipe "Sikap Kerja" (kolom forced-choice, 4 dari 5 item ditampilkan, 1
//     "kunci" tersembunyi tiap soal — lihat admin/soal/soal.js generateKolomSoal
//     & ujian/hasil.js hitungHasil): grafik individual per-peserta untuk tipe
//     ini SUDAH ADA di hasil.js (per kolom K1-K10: Dijawab/Benar/Salah, 1
//     peserta). Di ANALISA GRUP ini datanya beda tujuan: bukan 1 peserta, tapi
//     SEBARAN nilai SELURUH PESERTA dalam grup token itu per kolom — bukan 1
//     angka agregat spt versi lama, tapi per kombinasi (kolom, nilai) berapa
//     ORANG yang dapat nilai itu (mis. di kolom 1 ada 4 orang dapat Benar=10).
//     Tiap kombinasi digambar sbg bola kecil berlabel jumlah orang, lalu
//     ditarik garis MEDIAN (bukan rata-rata — supaya tahan thd nilai ekstrem/
//     outlier, mis. 1 orang jatuh jauh di 1 kolom tidak menyeret garis turun
//     jauh spt rata-rata) yang menyambung tiap kolom per kategori. 3 kategori:
//     hijau = Benar, merah = Salah, biru = Jumlah Dijawab (Benar+Salah orang
//     itu di kolom tsb) — pola makin ke kolom belakang makin turun/berat ke
//     Salah jadi indikasi kelelahan/attention-drop kolektif grup.
//
// Interaksi: arahkan kursor (desktop) / sentuh (mobile) ke kolom soal mana
// pun -> muncul popup dekat kursor/titik sentuh. Utk tipe Benar/Salah & Nilai/
// Skor: diagram lingkaran (persen tiap kategori). Utk tipe Sikap Kerja: panel
// ringkas median + rentang + jumlah orang per kategori (bukan pie, krn di sini
// datanya sebaran per kategori, bukan proporsi dari 1 total yang sama).
// Sentuh/klik di luar popup menutupnya.
//
// _ATD_DUMMY_BINARY / _ATD_DUMMY_SKOR / _ATD_DUMMY_SIKAP_RAW (nama variabel
// dipertahankan sengaja, lihat komentar di dekat deklarasinya) sekarang diisi
// dari respons AnalisaAPI.getGrup() tiap kali grup dibuka — lihat _atdRenderCharts().
//
// UPDATE: kartu "Grafik Per Soal" di halaman ini SEKARANG 1 KARTU PER SOAL
// BERNAMA dlm modul (urut sesuai modul.soal_list), BUKAN LAGI cuma 3 kartu
// tetap yg menggabung SELURUH soal se-tipe jadi 1 sumbu-X (itu yg bikin
// modul dgn banyak soal — mis. SKD: TWK+TIU+TKP — numpuk jadi 1 grafik
// dgn sumbu 1..110 yg labelnya tidak terbaca). Ketiga TEMPLATE grafiknya
// (line chart Benar/Salah, line chart Nilai/Skor Sendiri, median-chart
// Sikap Kerja) TETAP SAMA, cuma sekarang dipanggil SEKALI PER SOAL (bukan
// sekali per tipe utk seluruh modul), sumbu-X-nya nomor LOKAL soal itu saja.
// Sumbernya agg.per_soal (lihat computeAnalisaGrupAggregate di server.js) —
// _ATD_DUMMY_BINARY/_ATD_DUMMY_SKOR/_ATD_DUMMY_SIKAP_RAW (nomor GLOBAL,
// digabung se-modul) TETAP diisi krn masih dipakai analisa-soal.js (lookup
// 1 butir soal by nomor global) & tombol Ekstrak/analisa-export.js (sheet
// Excel gabungan) — lihat komentar lengkap di _atdRenderCharts().

// Dipanggil sekali di awal renderAnalisaTokenDetail(): kalau nama grup sudah
// ada (baik dari klik normal di analisa-token.js MAUPUN hasil dipulihkan
// _restoreAnalisaCtx() setelah refresh/reload) tapi window._analisaTokenDetailItems
// belum keisi (khusus kasus refresh — lihat komentar _persistAnalisaCtx() di
// js/app.js, item mentahnya SENGAJA tidak ikut disimpan ke localStorage),
// ambil ulang seluruh token dari API lalu saring per grup itu — PERSIS logika
// gabung token aktif+terpakai yg sama dgn renderAnalisaToken() di
// analisa-token.js, supaya hasilnya identik walau file itu tidak ikut ke-load
// (halaman ini bisa dibuka lazy SENDIRIAN tanpa analisa-token.js).
async function _atdEnsureItemsLoaded(grup) {
    if (!grup) return [];
    if (window._analisaTokenDetailItems && window._analisaTokenDetailItems.length) return window._analisaTokenDetailItems;
    const [tokens, used] = await Promise.all([
        TokensAPI.getAll().catch(() => []),
        TokensAPI.getUsed().catch(() => [])
    ]);
    const map = {};
    (tokens || []).forEach(t => { map[t.kode] = t; });
    (used || []).forEach(t => { map[t.kode] = Object.assign({}, map[t.kode] || {}, t, { _dipakai: true }); });
    // `grup` di sini adalah KUNCI GRUP (grub_id, atau "legacy:<nama>" utk data
    // lama) — lihat _atGrupKey() di analisa-token.js. Fungsi yg sama dipakai
    // di sini (bukan cuma filter t.grub_token === grup) supaya halaman ini
    // tetap benar walau dibuka lazy sendirian (tanpa analisa-token.js ke-load).
    const items = Object.values(map).filter(t => (t.grub_id ? t.grub_id : `legacy:${t.grub_token}`) === grup);
    window._analisaTokenDetailItems = items;
    return items;
}

// window._analisaTokenDetailAgg = hasil terakhir GET /api/analisa/grup/:grubToken
// utk grup yg lagi dibuka — disimpan di window (bukan cuma variabel lokal)
// supaya halaman lain yg dibuka dari sini (analisa-soal.js, analisa-grafik.js)
// yang membaca _ATD_DUMMY_BINARY/_ATD_DUMMY_SKOR/_ATD_DUMMY_SIKAP_RAW tetap
// dapat data yg sama persis tanpa perlu fetch ulang.
async function renderAnalisaTokenDetail() {
    const grup = window._analisaTokenDetailGrup || null;
    const items = await _atdEnsureItemsLoaded(grup);
    // Nama tampilan (grub_token) — beda dari `grup` (kunci/grub_id) di atas.
    // Kalau belum keisi (mis. dibuka lewat _restoreAnalisaCtx setelah refresh,
    // nama sempat tidak ikut disimpan), turunkan dari item pertama yang baru
    // dimuat — fallback terakhir baru pakai `grup` mentah apa adanya.
    if (!window._analisaTokenDetailGrupNama && items.length) window._analisaTokenDetailGrupNama = items[0].grub_token || grup;
    const grupNama = window._analisaTokenDetailGrupNama || grup;
    const sub = document.getElementById('atd-kode-sub');
    if (sub) sub.textContent = grup ? `Grup: ${grupNama} (${items.length} token)` : '-';

    if (!grup) {
        _atdRenderRingkasan(grup, items, null);
        _atdRenderPeserta(grup, items, null);
        _atdRenderCharts(null);
        return;
    }

    let agg = null;
    try { agg = await AnalisaAPI.getGrup(grup); }
    catch (e) {
        console.error('Gagal memuat analisa grup:', e);
        if (typeof showToast === 'function') showToast('Gagal memuat data analisa grup', 'danger');
    }
    window._analisaTokenDetailAgg = agg;
    // Kalau server balikin nama (mis. akses langsung via context tersimpan
    // tanpa `items` sama sekali), pakai itu supaya subjudul tetap akurat.
    if (agg && agg.grub_token && !window._analisaTokenDetailGrupNama) {
        window._analisaTokenDetailGrupNama = agg.grub_token;
        if (sub) sub.textContent = `Grup: ${agg.grub_token} (${items.length} token)`;
    }

    _atdRenderRingkasan(grup, items, agg);
    _atdRenderPeserta(grup, items, agg);
    _atdRenderCharts(agg);
}

function _atdEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }

// ── TOMBOL "EKSTRAK" — unduh data+grafik grup ini sbg file Excel ──────────
// Logika bangun workbook + suntik grafik native ada di admin/analisa/
// analisa-export.js (lazy-load bareng file ini — lihat ADMIN_PAGE_MODULES di
// js/app.js). Dipakai ulang window._analisaTokenDetailAgg yg sudah dimuat
// renderAnalisaTokenDetail() (via AnalisaAPI.getGrup()), jadi tombol ini
// TIDAK fetch API lagi — cukup olah data yg sudah ada di browser.
async function _atdHandleEkstrak() {
    const agg = window._analisaTokenDetailAgg;
    if (!agg) { if (typeof showToast === 'function') showToast('Data belum termuat, coba lagi', 'danger'); return; }
    if (typeof AnalisaExport === 'undefined') { if (typeof showToast === 'function') showToast('Modul ekspor belum termuat, coba lagi', 'danger'); return; }
    const btn = document.getElementById('atd-btn-ekstrak');
    if (btn) btn.disabled = true;
    if (typeof showToast === 'function') showToast('Menyiapkan file Excel…', '');
    try {
        const grupNama = window._analisaTokenDetailGrupNama || agg.grub_token || window._analisaTokenDetailGrup || 'Grup';
        const blob = await AnalisaExport.build(agg, grupNama);
        AnalisaExport.downloadBlob(blob, `Analisa_${AnalisaExport.sanitizeFilename(grupNama)}.xlsx`);
        if (typeof showToast === 'function') showToast('File Excel berhasil diunduh', 'success');
    } catch (e) {
        console.error('Gagal ekstrak Excel analisa:', e);
        if (typeof showToast === 'function') showToast('Gagal membuat file Excel: ' + e.message, 'danger');
    } finally {
        if (btn) btn.disabled = false;
    }
}

// ── RINGKASAN GRUP: jumlah token dibuat/terpakai/hangus + modul & soal yang
// dipakai grup ini — ditaruh di #atd-content. Dihitung sungguhan lewat
// GET /api/analisa/grup/:grubToken (lihat AnalisaAPI.getGrup) — server yang
// filter & agregasi, bukan browser admin narik semua laporan lalu filter sendiri.
function _atdRenderRingkasan(grup, items, agg) {
    const el = document.getElementById('atd-content');
    if (!el) return;
    if (!grup) { el.innerHTML = '<div class="empty-state"><p>Analisa untuk grup ini akan segera hadir</p></div>'; return; }
    if (!agg) { el.innerHTML = '<div class="empty-state"><p>Gagal memuat ringkasan grup, silakan coba lagi</p></div>'; return; }

    const { total, used, hangus, modul } = agg.ringkasan;
    const multiModulNote = agg.multi_modul
        ? `<div class="section-sub" style="margin-bottom:14px;color:#d97706">⚠️ Grup ini berisi token dari lebih dari 1 modul (${(agg.modul_list||[]).map(m=>_atdEsc(m.nama)).join(', ')}). Grafik di bawah hanya menghitung modul yang paling banyak dipakai (<b>${_atdEsc(modul ? modul.nama : '-')}</b>).</div>`
        : '';

    const modulSoalHtml = modul
        ? (() => {
            const soalRows = modul.soal.length
                ? modul.soal.map((s, i) => `<div class="atd-soal-row">${i + 1}. ${_atdEsc(s.nama)} <span style="color:var(--text-sub)">(${s.butir} pertanyaan)</span></div>`).join('')
                : '<div class="atd-soal-row" style="opacity:.6">Modul ini belum berisi soal</div>';
            return `<div class="atd-modul-block">
                <div class="atd-modul-title">${_atdEsc(modul.nama)}</div>
                <div class="atd-soal-list">${soalRows}</div>
            </div>`;
        })()
        : '<div class="empty-state" style="padding:16px"><p>Belum ada modul yang tertaut ke token grup ini</p></div>';

    el.innerHTML = `
        <div class="section-title" style="font-size:16px;margin-bottom:2px">Ringkasan Grup</div>
        ${multiModulNote}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin-bottom:18px">
            <div class="stat-card" style="cursor:default">
                <div class="stat-icon accent"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
                <div class="stat-num">${total}</div>
                <div class="stat-label">Token Dibuat</div>
            </div>
            <div class="stat-card" style="cursor:default">
                <div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polyline points="20 6 9 17 4 12"/></svg></div>
                <div class="stat-num">${used}</div>
                <div class="stat-label">Token Terpakai</div>
            </div>
            <div class="stat-card" style="cursor:default">
                <div class="stat-icon" style="background:rgba(220,38,38,.12);color:#dc2626"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
                <div class="stat-num">${hangus}</div>
                <div class="stat-label">Token Hangus</div>
            </div>
        </div>
        <div style="font-size:13px;font-weight:700;color:var(--blue);margin-bottom:8px">Modul &amp; Soal yang Digunakan</div>
        <div class="atd-modul-wrap">${modulSoalHtml}</div>
    `;
}

// ── PESERTA: daftar akun yang memakai token di grup ini. Kartu ini bisa
// diklik (header) untuk buka/tutup daftarnya ke bawah — tiap baris
// menampilkan nama akun + grup asal tokennya. Sumber: agg.peserta (dari
// GET /api/analisa/grup/:grubToken), dihitung dari laporan token grup ini.
function _atdRenderPeserta(grup, items, agg) {
    const el = document.getElementById('atd-peserta-card');
    if (!el) return;
    if (!grup) { el.innerHTML = '<div class="empty-state"><p>Data peserta akan segera hadir</p></div>'; return; }
    if (!agg) { el.innerHTML = '<div class="empty-state"><p>Gagal memuat data peserta, silakan coba lagi</p></div>'; return; }

    // Badge "grup asal token" per baris pakai NAMA tampilan (grub_token),
    // bukan `grup` yang sekarang isinya kunci grub_id — lihat komentar
    // _atGrupKey() di analisa-token.js soal kenapa keduanya sengaja dipisah.
    const grupNama = window._analisaTokenDetailGrupNama || agg.grub_token || grup;
    const peserta = (agg.peserta || []).map(p => Object.assign({ grup: grupNama }, p));

    const rows = peserta.length
        ? peserta.map(p => `<div class="atd-peserta-row">
                <div class="atd-peserta-nama">${_atdEsc(p.nama)}</div>
                <div class="atd-peserta-grup"><span class="history-badge" style="background:rgba(19,50,89,.08);color:var(--text-sub)">${_atdEsc(p.grup)}</span></div>
                <div class="atd-peserta-skor">${p.skor !== null && p.skor !== undefined ? 'Skor ' + p.skor : '-'}</div>
            </div>`).join('')
        : '<div class="empty-state" style="padding:16px"><p>Belum ada akun yang memakai token grup ini</p></div>';

    el.innerHTML = `
        <div class="atd-peserta-header" onclick="_atdTogglePeserta()">
            <div>
                <div class="section-title" style="font-size:16px;margin-bottom:2px">Peserta</div>
                <div class="section-sub" style="margin-bottom:0">${peserta.length} akun menggunakan token grup ini</div>
            </div>
            <svg class="atd-peserta-chevron" id="atd-peserta-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="transition:transform .2s"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="atd-peserta-list" id="atd-peserta-list" style="display:none">${rows}</div>
    `;
}

function _atdTogglePeserta() {
    const list = document.getElementById('atd-peserta-list');
    const chev = document.getElementById('atd-peserta-chevron');
    if (!list) return;
    const willOpen = list.style.display === 'none';
    list.style.display = willOpen ? 'block' : 'none';
    if (chev) chev.style.transform = willOpen ? 'rotate(180deg)' : '';
}

// Klik nomor soal (sumbu-X) di grafik "Benar/Salah" atau "Nilai/Skor Sendiri"
// (kind: 'binary' | 'skor') -> pindah ke halaman admin/analisa/analisa-soal.js
// (SENGAJA masih kosong, cuma ada tombol kembali — isinya menyusul). Konteks
// (grup asal + nomor soal + tipe grafik) dititip lewat window var, sama
// polanya dgn openAnalisaTokenDetail() di analisa-token.js.
function _atdGoToSoalDetail(evt, kind, nomor) {
    if (evt) evt.stopPropagation();
    window._analisaSoalDetailGrup = window._analisaTokenDetailGrup || null;
    window._analisaSoalDetailNomor = nomor;
    window._analisaSoalDetailKind = kind;
    // Bersihkan sisa konteks alur "klik grafik di Analisa > Soal" (kalau ada
    // dari kunjungan sebelumnya) — lihat _asdGoToButirDetail() di
    // analisa-soal-detail.js — supaya tombol kembali di analisa-soal.js
    // (_asBack()) tidak salah balik ke halaman detail soal itu.
    window._analisaSoalDetailBackKode = null;
    if (typeof _persistAnalisaCtx === 'function') _persistAnalisaCtx();
    navigateTo('analisa-soal');
}

// Tombol "Analisa" di bawah legenda grafik "Sikap Kerja — Median & Sebaran,
// Per Kolom" -> pindah ke halaman admin/analisa/analisa-grafik.js (SENGAJA
// masih kosong, cuma ada tombol kembali — isinya menyusul instruksi
// berikutnya). Konteks (grup asal + jenis grafik) dititip lewat window var,
// sama polanya dgn _atdGoToSoalDetail() di atas.
function _atdGoToGrafikDetail(evt, kind, soalKode) {
    if (evt) evt.stopPropagation();
    window._analisaGrafikDetailGrup = window._analisaTokenDetailGrup || null;
    window._analisaGrafikDetailKind = kind;
    window._analisaGrafikDetailSoalNama = null;
    // Sejak kartu Sikap Kerja dipecah per-SOAL (1 modul boleh py >1 soal
    // Sikap Kerja terpisah — lihat _atdRenderCharts), tombol "Analisa" di
    // tiap kartu itu sekarang titip `soalKode` miliknya sendiri. analisa-
    // grafik.js TIDAK diubah sama sekali (tetap "pakai ulang" _ATD_DUMMY_
    // SIKAP_RAW/_atdSikapCats/_atdSikapDist apa adanya, sesuai desain lama
    // yg tertulis di komentar file itu) — jadi di sinilah, SEBELUM
    // navigateTo(), variabel global itu ditimpa dulu supaya isinya data
    // grup soal yg TOMBOLNYA diklik, bukan grup soal Sikap Kerja lain yg
    // kebetulan juga ada di modul yg sama.
    if (soalKode && window._atdSikapGroupsByKode && window._atdSikapGroupsByKode[soalKode]) {
        const grp = window._atdSikapGroupsByKode[soalKode];
        _ATD_DUMMY_SIKAP_RAW = grp.raw;
        _atdSikapCats = grp.categories;
        _atdSikapDist = grp.catData;
        window._analisaGrafikDetailSoalNama = grp.soal_nama;
    }
    if (typeof _persistAnalisaCtx === 'function') _persistAnalisaCtx();
    navigateTo('analisa-grafik');
}



// ── ENTRY: bangun kartu "Grafik Per Soal" dari hasil agregasi asli
// (agg.per_soal, dari GET /api/analisa/grup/:grubToken) — lihat komentar
// perSoal di server.js (computeAnalisaGrupAggregate).
//
// BERBEDA dari versi lama (3 kartu TETAP per modul, binary/skor/sikap
// digabung jadi 1 grafik masing2 utk SELURUH modul, sumbu-X-nya nomor
// GLOBAL lintas soal — makanya modul SKD 3 soal 30+35+45 butir numpuk jadi
// 1 sumbu 1..110, label-nya numpuk tak terbaca): SEKARANG 1 KARTU PER SOAL
// BERNAMA dlm modul (urut sesuai modul.soal_list, boleh lebih dari 3 kalau
// modul py lebih dari 3 soal), tiap kartu pakai salah satu dari 3 TEMPLATE
// grafik yg sudah disiapkan (line chart Benar/Salah, line chart Nilai/Skor
// Sendiri, atau median-chart Sikap Kerja) sesuai tipe soal itu SENDIRI —
// bukan lagi tipe gabungan modul. Sumbu-X tiap kartu pakai nomor LOKAL soal
// itu saja (1..N, reset tiap ganti soal), jadi soal ke-2 dgn 30 butir tetap
// tampil 1..30, bukan lanjut dari nomor global soal pertama.
//
// Kalau modul ini benar2 tidak punya soal sama sekali (agg.per_soal kosong)
// -> 1 kartu pesan kosong. Kalau modul py soal tapi belum ada peserta yang
// selesai -> kartu tetap tampil (item digenerate per BUTIR SOAL, bukan per
// peserta, jadi tetap ada baris/titik-nya walau nilainya 0 semua).
function _atdRenderCharts(agg) {
    const wrap = document.getElementById('atd-charts-wrap');
    if (!wrap) return;

    if (!agg) {
        wrap.innerHTML = '<div class="card atd-chart-card"><div class="empty-state"><p>Gagal memuat grafik, silakan coba lagi</p></div></div>';
        return;
    }

    // TETAP diisi (nomor GLOBAL, tidak berubah) — bukan lagi dipakai
    // langsung utk membangun grafik DI HALAMAN INI (lihat per_soal di
    // bawah), tapi WAJIB tetap terisi krn 2 hal lain masih baca variabel
    // global ini apa adanya: analisa-soal.js (lookup 1 butir soal via klik
    // sumbu-X, by nomor GLOBAL) & tombol "Ekstrak" -> analisa-export.js
    // (sheet Excel gabungan se-modul).
    _ATD_DUMMY_BINARY = (agg.charts && agg.charts.binary) || [];
    _ATD_DUMMY_SKOR = (agg.charts && agg.charts.skor) || [];
    _ATD_DUMMY_SIKAP_RAW = (agg.charts && agg.charts.sikap) || [];

    const perSoal = agg.per_soal || [];
    // Dipakai _atdGoToGrafikDetail() saat tombol "Analisa" di kartu Sikap
    // Kerja SALAH SATU soal diklik — supaya analisa-grafik.js (yg pakai
    // ulang _ATD_DUMMY_SIKAP_RAW dkk apa adanya) dapat data grup SOAL yg
    // BENAR, bukan soal Sikap Kerja lain yg kebetulan juga ada di modul ini.
    window._atdSikapGroupsByKode = {};

    if (!perSoal.length) {
        wrap.innerHTML = '<div class="card atd-chart-card"><div class="empty-state"><p>Modul ini belum berisi soal</p></div></div>';
        return;
    }

    wrap.innerHTML = perSoal.map((grp, gi) => `<div class="card atd-chart-card" id="atd-chart-${gi}"></div>`).join('');

    perSoal.forEach((grp, gi) => {
        const containerId = 'atd-chart-' + gi;
        const namaSoal = _atdEsc(grp.soal_nama);

        if (grp.tipe === 'binary') {
            const items = grp.items || [];
            if (!items.length) { _atdEmptyChartCard(containerId, `${grp.soal_nama}: belum ada data`); return; }
            const cats = items.map(it => it.local);
            const clickVals = items.map(it => it.nomor);
            const series = [
                { label: 'Benar', color: '#16a34a', values: items.map(it => it.benar) },
                { label: 'Salah', color: '#dc2626', values: items.map(it => it.salah) }
            ];
            const maxVal = Math.max.apply(null, items.flatMap(it => [it.benar, it.salah]));
            _atdSetChartPopupData(containerId, { items });
            _atdBuildLineChart(containerId, {
                title: `${namaSoal} — Grafik Per Soal (Tipe Benar/Salah)`,
                sub: 'Jumlah peserta yang menjawab Benar / Salah, per nomor soal (nomor butir soal ini)',
                categories: cats, clickValues: clickVals, series, maxVal, kind: 'binary', xClickFn: '_atdGoToSoalDetail'
            });
            const leg = document.getElementById(containerId + '-legend');
            if (leg) leg.innerHTML = _atdBinaryLegendHtml();
            _atdBindChartEvents(containerId, 'binary');

        } else if (grp.tipe === 'skor') {
            // 1 garis per OPSI JAWABAN (bukan per nilai gabungan) — kalau
            // beberapa opsi kebetulan sama2 bernilai 0, tetap jadi garis
            // terpisah (lihat _atdBuildOpsiSeries), cuma labelnya sama2
            // "Nilai 0" dgn warna beda2 supaya kebedanya jelas.
            const items = grp.items || [];
            if (!items.length) { _atdEmptyChartCard(containerId, `${grp.soal_nama}: belum ada data`); return; }
            const { series, sortedPerSoal } = _atdBuildOpsiSeries(items);
            const cats = items.map(it => it.local);
            const clickVals = items.map(it => it.nomor);
            const maxVal = Math.max.apply(null, items.flatMap(it => it.opsi.map(o => o.jumlah)));
            _atdSetChartPopupData(containerId, { items, sortedPerSoal, seriesMeta: series });
            _atdBuildLineChart(containerId, {
                title: `${namaSoal} — Grafik Per Soal (Tipe Nilai/Skor Sendiri)`,
                sub: 'Jumlah peserta yang memilih tiap opsi jawaban, per nomor soal (nomor butir soal ini) — opsi sesama nilai 0 tetap dipisah, bukan digabung',
                categories: cats, clickValues: clickVals, series, maxVal, kind: 'skor', xClickFn: '_atdGoToSoalDetail'
            });
            const leg = document.getElementById(containerId + '-legend');
            if (leg) leg.innerHTML = _atdSkorLegendHtml(series);
            _atdBindChartEvents(containerId, 'skor');

        } else if (grp.tipe === 'sikap') {
            // Sebaran nilai antar peserta per kolom (Benar/Salah/Jumlah
            // Dijawab), digambar sbg bola kecil + garis median per kategori
            // (lihat komentar _atdBuildSikapMedianChart) — KOLOM di sini
            // lokal utk soal Sikap Kerja ini saja (K1, K2, ... reset tiap
            // ganti soal Sikap Kerja lain dlm modul yg sama).
            const cats = grp.categories || [];
            const catRaw = grp.catRaw || [];
            if (!cats.length) { _atdEmptyChartCard(containerId, `${grp.soal_nama}: belum ada data`); return; }
            const distBenar = _atdDistFromRaw(catRaw, r => r.benar);
            const distSalah = _atdDistFromRaw(catRaw, r => r.salah);
            const distDijawab = _atdDistFromRaw(catRaw, r => r.benar + r.salah);
            const catData = [
                { label: 'Benar', color: '#16a34a', key: 'benar', dist: distBenar },
                { label: 'Salah', color: '#dc2626', key: 'salah', dist: distSalah },
                { label: 'Jumlah Dijawab', color: '#2666b8', key: 'dijawab', dist: distDijawab }
            ];
            window._atdSikapGroupsByKode[grp.soal_kode] = { soal_nama: grp.soal_nama, categories: cats, raw: catRaw, catData };
            _atdSetChartPopupData(containerId, { cats, dist: catData });
            _atdBuildSikapMedianChart(containerId, {
                title: `${namaSoal} — Grafik Sikap Kerja (Median & Sebaran, Per Kolom)`,
                sub: 'Tiap bola = jumlah orang yang dapat nilai itu; garis = median (bukan rata-rata) tiap kategori per kolom',
                categories: cats, catData, kind: 'sikap', analisaBtnSoalKode: grp.soal_kode
            });
            const leg = document.getElementById(containerId + '-legend');
            if (leg) leg.innerHTML = _atdSikapLegendHtml();
            _atdBindChartEvents(containerId, 'sikap');
        }
    });
}
