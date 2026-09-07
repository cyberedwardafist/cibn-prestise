// admin/analisa/analisa-soal-detail.js
// Halaman detail 1 soal, dibuka dari daftar Analisa > Soal (klik salah satu
// kartu soal di admin/analisa/analisa-soal.js -> _aslOpenDetail()). Kode soal
// yang diklik dititip di window._analisaSoalListDetailKode sebelum
// navigateTo('analisa-soal-detail') dipanggil (lihat juga _persistAnalisaCtx/
// _restoreAnalisaCtx di js/app.js utk kasus refresh).
//
// Isi halaman:
//   1) Kartu Ringkasan (asd-content): Nama, Waktu (timer pengerjaan soal),
//      Tipe, Kelompok — data mentah langsung dari SoalAPI.getOne(kode).
//   2) Kartu "Modul" (asd-modul-card): daftar modul yang memuat soal ini
//      (dicari dari ModulAPI.getAll(), soal_list[].soal_kode === kode) —
//      gaya kartunya SAMA seperti kartu "Peserta" di analisa-token-detail.js
//      (header bisa diklik utk buka/tutup daftar ke bawah), cuma isinya
//      modul, bukan akun peserta.
//   3) Kartu "Sampel" (asd-sampel-card): tester yang DIPILIH MANUAL oleh
//      admin (bukan otomatis dari grup token seperti di analisa-token-detail)
//      utk dijadikan sumber data analisa soal ini. Kosong di awal -> tampil
//      2 tombol "+ Tester Individu" / "+ Tester Grup" yang membuka halaman
//      terpisah admin/analisa/analisa-soal-sampel.html/.js (lihat komentar
//      di file itu utk alur pemilihannya). Begitu ada data, tombolnya
//      berubah jadi "Ubah" dan ringkasan pilihan tampil di sini.
//   SEMENTARA sampel disimpan di localStorage per kode soal (_asdLoadSampel/
//   _asdSaveSampel) — BELUM dikirim ke server & BELUM dipakai menghitung
//   analisa asli (beda dgn alur token yg datanya dari grub_id token yg
//   dipilih, lihat komentar penutup di analisa-soal-sampel.js) — penarikan
//   data jawaban asli dari sampel ini menyusul di instruksi berikutnya.

let _asdKode = null, _asdSoal = null, _asdKelompokList = [], _asdModulList = [];

async function renderAnalisaSoalDetail() {
    _asdKode = window._analisaSoalListDetailKode || null;
    const sub = document.getElementById('asd-kode-sub');
    if (sub) sub.textContent = _asdKode ? `Kode: ${_asdKode}` : '-';

    if (!_asdKode) {
        _asdRenderRingkasan(null);
        _asdRenderModul(null);
        _asdRenderSampel();
        return;
    }

    let soal = null;
    try {
        [soal, _asdKelompokList, _asdModulList] = await Promise.all([
            SoalAPI.getOne(_asdKode),
            SoalKelompokAPI.getAll().catch(() => []),
            ModulAPI.getAll().catch(() => [])
        ]);
    } catch (e) {
        console.error('Gagal memuat detail soal:', e);
        if (typeof showToast === 'function') showToast('Gagal memuat detail soal', 'danger');
    }
    _asdSoal = soal;
    if (soal && sub) sub.textContent = `${soal.nama_internal ? soal.nama + ' | ' + soal.nama_internal : soal.nama} · ${_asdKode}`;

    _asdRenderRingkasan(soal);
    _asdRenderModul(soal);
    _asdRenderSampel();
}

function _asdEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

const _asdTypeLabel = { multiple_choice: 'Multiple Choice', linier: 'Linier', sikap_kerja: 'Sikap Kerja' };

function _asdKelompokNama(kode) {
    if (!kode) return null;
    const k = _asdKelompokList.find(x => x.kode === kode);
    return k ? k.nama : null;
}

function _asdWaktuTampil(s) {
    const j = s.timer_jam || 0, m = s.timer_menit || 0, d = s.timer_detik || 0;
    if (!j && !m && !d) return 'Tanpa batas waktu';
    const parts = [];
    if (j) parts.push(`${j} jam`);
    if (m) parts.push(`${m} menit`);
    if (d) parts.push(`${d} detik`);
    return parts.join(' ');
}

// Jumlah butir pertanyaan dalam 1 soal — SAMA PERSIS logikanya dgn
// _analisaSoalButir() di server.js: tipe sikap_kerja dihitung dari total
// pertanyaan di SELURUH kolom (kol.soal.length dijumlah per kolom), tipe
// lain (multiple_choice/linier) tinggal jumlah elemen array `data`.
function _asdJumlahButir(soal) {
    const data = soal.data;
    if (!Array.isArray(data)) return 0;
    if (soal.type === 'sikap_kerja') return data.reduce((a, kol) => a + ((kol && Array.isArray(kol.soal)) ? kol.soal.length : 0), 0);
    return data.length;
}

// Tipe penilaian (skor_type) HANYA berlaku utk multiple_choice/linier (radio
// "Benar/Salah" vs "Nilai per Jawaban" di admin/soal/soal.js) — soal tipe
// sikap_kerja tidak punya field ini sama sekali (dinilai lewat kunci per
// kolom, bukan skor_type), jadi baris ini disembunyikan total kalau tipenya
// sikap_kerja (bukan ditampilkan "-").
function _asdSkorTypeLabel(soal) {
    if (soal.type === 'sikap_kerja') return null;
    return soal.skor_type === 'nilai_sendiri' ? 'Nilai Sendiri' : 'Benar/Salah';
}

// ── RINGKASAN: Nama, Waktu, Tipe, Jumlah Soal, Tipe Penilaian (kalau ada),
// Kelompok — blok label/nilai, pola sama seperti detail token-copy-overlay/
// token-used-data-overlay (admin/cat/token-modals.html), cuma di sini
// datanya soal, bukan token.
function _asdRenderRingkasan(soal) {
    const el = document.getElementById('asd-content');
    if (!el) return;
    if (!_asdKode) { el.innerHTML = '<div class="empty-state"><p>Soal tidak ditemukan</p></div>'; return; }
    if (!soal) { el.innerHTML = '<div class="empty-state"><p>Gagal memuat data soal, silakan coba lagi</p></div>'; return; }

    const skorTypeLabel = _asdSkorTypeLabel(soal);
    const fields = [
        ['Nama', _asdEsc(soal.nama_internal ? `${soal.nama} (${soal.nama_internal})` : soal.nama)],
        ['Waktu', _asdEsc(_asdWaktuTampil(soal))],
        ['Tipe', _asdEsc(_asdTypeLabel[soal.type] || soal.type || '-')],
        ['Jumlah Soal', `${_asdJumlahButir(soal)} nomor`],
        ...(skorTypeLabel ? [['Tipe Penilaian', _asdEsc(skorTypeLabel)]] : []),
        ['Kelompok', _asdEsc(_asdKelompokNama(soal.kelompok) || 'Tanpa Kelompok')]
    ];
    el.innerHTML = `
        <div class="section-title" style="font-size:16px;margin-bottom:14px">Ringkasan Soal</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px">
            ${fields.map(([label, val]) => `
                <div>
                    <div style="font-size:11px;color:var(--text-sub);margin-bottom:2px">${label}</div>
                    <div style="font-size:14px;font-weight:600;color:var(--blue)">${val}</div>
                </div>`).join('')}
        </div>`;
}

// ── MODUL: daftar modul yang memuat soal ini. Kartu bisa diklik (header)
// utk buka/tutup daftarnya, pola sama persis dgn _atdRenderPeserta() di
// analisa-token-detail.js (cuma isinya modul, bukan akun peserta).
function _asdRenderModul(soal) {
    const el = document.getElementById('asd-modul-card');
    if (!el) return;
    if (!_asdKode || !soal) { el.innerHTML = ''; return; }

    const modulTerkait = (_asdModulList || []).filter(m => (m.soal_list || []).some(sl => sl.soal_kode === _asdKode));

    const rows = modulTerkait.length
        ? modulTerkait.map(m => `<div class="atd-peserta-row">
                <div class="atd-peserta-nama">${_asdEsc(m.nama_internal ? `${m.nama} | ${m.nama_internal}` : m.nama)}</div>
                <div class="atd-peserta-grup"><span class="history-badge" style="background:rgba(19,50,89,.08);color:var(--text-sub)">${_asdEsc(m.kode || m.id)}</span></div>
            </div>`).join('')
        : '<div class="empty-state" style="padding:16px"><p>Soal ini belum terhubung ke modul manapun</p></div>';

    el.innerHTML = `
        <div class="atd-peserta-header" onclick="_asdToggleModul()">
            <div>
                <div class="section-title" style="font-size:16px;margin-bottom:2px">Modul</div>
                <div class="section-sub" style="margin-bottom:0">Soal ini terhubung ke ${modulTerkait.length} modul</div>
            </div>
            <svg class="atd-peserta-chevron" id="asd-modul-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="transition:transform .2s"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="atd-peserta-list" id="asd-modul-list" style="display:none">${rows}</div>`;
}

function _asdToggleModul() {
    const list = document.getElementById('asd-modul-list');
    const chev = document.getElementById('asd-modul-chevron');
    if (!list) return;
    const willOpen = list.style.display === 'none';
    list.style.display = willOpen ? 'block' : 'none';
    if (chev) chev.style.transform = willOpen ? 'rotate(180deg)' : '';
}

// ── SAMPEL: tester manual (individu/grup) — lihat catatan penyimpanan di
// header file ini. Struktur: { individu:[{kode,nama}], grup:[{grub_kode,
// grub_nama, members:[{kode,nama,included}]}] }.
function _asdSampelStorageKey(kode) { return `cbn_soal_sampel_${kode}`; }
function _asdLoadSampel(kode) {
    try { return JSON.parse(localStorage.getItem(_asdSampelStorageKey(kode)) || 'null') || { individu: [], grup: [] }; }
    catch (e) { return { individu: [], grup: [] }; }
}
function _asdSaveSampel(kode, data) {
    try { localStorage.setItem(_asdSampelStorageKey(kode), JSON.stringify(data)); } catch (e) {}
}

function _asdHapusIndividu(idx) {
    if (!_asdKode) return;
    const sampel = _asdLoadSampel(_asdKode);
    sampel.individu.splice(idx, 1);
    _asdSaveSampel(_asdKode, sampel);
    _asdRenderSampel();
}
function _asdHapusGrup(idx) {
    if (!_asdKode) return;
    const sampel = _asdLoadSampel(_asdKode);
    sampel.grup.splice(idx, 1);
    _asdSaveSampel(_asdKode, sampel);
    _asdRenderSampel();
}

function _asdRenderSampel() {
    const el = document.getElementById('asd-sampel-card');
    if (!el) return;
    if (!_asdKode) { el.innerHTML = ''; return; }

    const sampel = _asdLoadSampel(_asdKode);
    const adaData = (sampel.individu && sampel.individu.length) || (sampel.grup && sampel.grup.length);

    const tombolAksi = `
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:${adaData ? '14px' : '0'}">
            <button class="btn btn-secondary" onclick="_asdOpenSampel('individu')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                ${sampel.individu.length ? 'Ubah' : '+'} Tester Individu
            </button>
            <button class="btn btn-secondary" onclick="_asdOpenSampel('grup')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                ${sampel.grup.length ? 'Ubah' : '+'} Tester Grup
            </button>
        </div>`;

    if (!adaData) {
        el.innerHTML = `
            <div class="section-title" style="font-size:16px;margin-bottom:2px">Sampel</div>
            <div class="section-sub" style="margin-bottom:0">Belum ada tester manual yang dipilih untuk soal ini</div>
            ${tombolAksi}`;
        return;
    }

    const individuRows = (sampel.individu || []).map((u, i) => `
        <div class="atd-peserta-row">
            <div class="atd-peserta-nama">${_asdEsc(u.nama)}</div>
            <button class="btn-icon danger" style="width:26px;height:26px" onclick="_asdHapusIndividu(${i})" title="Hapus dari sampel">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>`).join('');

    const grupBlocks = (sampel.grup || []).map((g, i) => {
        const included = (g.members || []).filter(m => m.included);
        const memberRows = (g.members || []).map(m => `
            <div class="atd-peserta-row" style="${m.included ? '' : 'opacity:.5'}">
                <div class="atd-peserta-nama">${_asdEsc(m.nama)}</div>
                <div class="atd-peserta-skor">${m.included ? 'Diikutkan' : 'Dikeluarkan'}</div>
            </div>`).join('');
        return `
        <div class="atd-modul-block" style="margin-bottom:10px">
            <div class="atd-modul-title" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                <span>${_asdEsc(g.grub_nama)} <span style="font-weight:500;color:var(--text-sub);font-size:11px">(${included.length}/${(g.members || []).length} orang)</span></span>
                <button class="btn-icon danger" style="width:26px;height:26px" onclick="_asdHapusGrup(${i})" title="Hapus grup ini dari sampel">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <div class="atd-soal-list">${memberRows}</div>
        </div>`;
    }).join('');

    el.innerHTML = `
        <div class="section-title" style="font-size:16px;margin-bottom:2px">Sampel</div>
        <div class="section-sub" style="margin-bottom:12px">Tester manual yang dipakai untuk analisa soal ini</div>
        ${sampel.individu.length ? `<div style="font-size:13px;font-weight:700;color:var(--blue);margin-bottom:8px">Tester Individu (${sampel.individu.length})</div><div style="margin-bottom:14px">${individuRows}</div>` : ''}
        ${sampel.grup.length ? `<div style="font-size:13px;font-weight:700;color:var(--blue);margin-bottom:8px">Tester Grup</div>${grupBlocks}` : ''}
        ${tombolAksi}`;
}

// Pindah ke halaman pemilihan tester (file baru, lihat admin/analisa/
// analisa-soal-sampel.html/.js). `mode` menentukan tampilan awal di sana:
// 'individu' -> checklist per akun user; 'grup' -> checklist per grup (grub)
// + switch per anggota. Konteks dititip lewat window var, pola sama dgn
// window._analisaSoalListDetailKode di analisa-soal.js.
function _asdOpenSampel(mode) {
    window._analisaSoalSampelKode = _asdKode;
    window._analisaSoalSampelMode = mode;
    if (typeof _persistAnalisaCtx === 'function') _persistAnalisaCtx();
    navigateTo('analisa-soal-sampel');
}
