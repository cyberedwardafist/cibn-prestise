// admin/analisa/analisa-soal.js
// Halaman ANALISA > SOAL. Dibuka dari 2 arah:
//   1) Lewat panel slide-dock ANALISA (tombol "SOAL") — langsung, tanpa konteks
//      grup/soal tertentu -> tampil empty-state (tidak tahu soal mana yg mau
//      dianalisa).
//   2) Lewat klik nomor soal (sumbu-X) di grafik "Benar/Salah" atau "Nilai/
//      Skor Sendiri" pada admin/analisa/analisa-token-detail.js — lihat
//      _atdGoToSoalDetail() di sana. Konteksnya (grup asal + nomor + tipe
//      grafik yg diklik) dititip di window._analisaSoalDetail* sebelum
//      navigateTo('analisa-soal') dipanggil.
//
// Tombol panah kembali di atas: kalau dibuka dari grafik, balik ke halaman
// detail grup token yang tadi dibuka (analisa-token-detail). Kalau dibuka
// langsung dari slide-dock, balik ke daftar grup (analisa-token).
//
// ── ISI HALAMAN (MASIH DATA DUMMY, sama pola-nya dgn _ATD_DUMMY_* di
// analisa-token-detail.js — nanti tinggal diganti hasil fetch pertanyaan +
// jawaban asli per soal dari server) ────────────────────────────────────────
//   - Teks pertanyaan + daftar pilihan jawaban A-E.
//   - Tipe "Benar/Salah": pilihan yg jadi kunci ditandai badge hijau "Kunci
//     Jawaban"; tiap pilihan menampilkan jumlah peserta yg memilihnya di
//     kanan. Sebaran salah per soal ditarik dari _ATD_DUMMY_BINARY (yg cuma
//     simpan total benar/salah) lalu dipecah ke 4 opsi selain kunci dgn pola
//     tetap (lihat _asBuildOpsiData) — murni supaya ada 5 opsi utk didemokan,
//     BUKAN pecahan asli per opsi (itu baru ada kalau sudah nyambung ke data
//     jawaban sungguhan).
//   - Tipe "Nilai/Skor Sendiri": nilai tiap opsi diambil langsung dari
//     _ATD_DUMMY_SKOR (posisi array opsi = urutan A-E), lalu di sebelahnya
//     ditampilkan jumlah peserta yg memilih opsi itu. Opsi bernilai (nilai>0)
//     ditandai serupa "kunci" (hijau) sbg penanda visual opsi yg dapat poin.
//   - Setelah "Pembahasan": daftar peserta dikelompokkan per opsi A-E. Warna
//     kotak nama: hijau kalau opsi itu kunci/bernilai, merah kalau bukan.
//   - Klik salah satu baris opsi di atas -> daftar peserta di bawah/kanan
//     terfilter cuma opsi itu. Klik opsi yg sama lagi -> filter mati (tampil
//     semua lagi).
//   - Layout: mobile (≤768px) daftar peserta ditumpuk di BAWAH (lihat urutan
//     DOM as-col-main lalu as-col-side); desktop (>768px) daftar peserta
//     pindah ke KANAN lewat flex-direction:row (lihat css/chart.css).

function renderAnalisaSoal() {
    const grup = window._analisaSoalDetailGrup || null;
    const nomor = window._analisaSoalDetailNomor || null;
    const kind = window._analisaSoalDetailKind || null;
    const sub = document.getElementById('as-sub');
    if (sub) {
        sub.textContent = (grup && nomor)
            ? `Soal No. ${nomor} · Grup: ${grup}${kind ? ' · Tipe: ' + (kind === 'skor' ? 'Nilai/Skor Sendiri' : 'Benar/Salah') : ''}`
            : '-';
    }
    _asActiveFilter = null; // reset filter tiap kali halaman ini dibuka ulang dari luar (klik grafik baru / kembali lalu masuk lagi)
    _asRenderContent(grup, nomor, kind);
}

function _asBack() {
    navigateTo(window._analisaSoalDetailGrup ? 'analisa-token-detail' : 'analisa-token');
}

function _asEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }

// ── DATA DUMMY: pertanyaan, pembahasan & teks opsi per nomor ───────────────
// Huruf opsi TIDAK dipatok A-E: sama seperti admin/soal/soal.js (jawaban
// minimal 2 pilihan, jumlahnya bebas — huruf cuma hasil String.fromCharCode
// dari posisi asli array jawaban, bukan array label tetap).
function _asHuruf(idx) { return String.fromCharCode(65 + idx); }

const _AS_DUMMY_PERTANYAAN = {
    1: 'Manakah kata yang paling tepat menjadi SINONIM dari kata "cermat"?',
    2: 'Deret angka: 2, 6, 12, 20, 30, ... Angka selanjutnya adalah?',
    3: 'AIR : HAUS = MAKANAN : ...?',
    4: 'Jika 3x + 7 = 22, maka nilai x adalah?',
    5: 'Berdasarkan bacaan di atas, gagasan utama paragraf kedua adalah?',
    6: 'Manakah kata yang paling tepat menjadi ANTONIM dari kata "optimis"?'
};

const _AS_DUMMY_PEMBAHASAN = {
    1: 'Kata "cermat" berarti teliti dan penuh perhatian dalam melakukan sesuatu, sehingga jawaban yang tepat adalah opsi yang bermakna paling dekat dengan itu.',
    2: 'Selisih antar suku bertambah 2 setiap langkah (4, 6, 8, 10, ...), sehingga suku berikutnya = 30 + 12 = 42.',
    3: 'Pola hubungan sebab-akibat: rasa haus diatasi dengan AIR, maka rasa lapar diatasi dengan MAKANAN.',
    4: 'Dari 3x + 7 = 22, maka 3x = 15, sehingga x = 5.',
    5: 'Gagasan utama biasanya terletak pada kalimat topik di awal atau akhir paragraf.',
    6: 'Antonim dari "optimis" (penuh harapan/yakin) adalah kata yang bermakna berkebalikan, yaitu pesimis.'
};

function _asOpsiTextFor(nomor, idx) {
    return `Pilihan jawaban ${_asHuruf(idx)} untuk soal No. ${nomor}`;
}

// ── DATA DUMMY: nama peserta per opsi — deterministik (seed tetap) supaya
// hasil sama tiap reload/toggle filter, BUKAN data akun asli. Nanti tinggal
// diganti daftar akun sungguhan yg jawabannya = opsi tsb.
const _AS_NAME_POOL = [
    'Ahmad Fauzi', 'Siti Nurhaliza', 'Budi Santoso', 'Dewi Lestari', 'Rizky Ramadhan',
    'Putri Anggraini', 'Andi Wijaya', 'Rina Marlina', 'Fajar Nugroho', 'Indah Permata',
    'Yusuf Hidayat', 'Nur Aisyah', 'Bayu Saputra', 'Melati Sari', 'Hendra Gunawan',
    'Wulan Suci', 'Agus Setiawan', 'Lestari Ningsih', 'Dian Purnama', 'Eko Prasetyo',
    'Ratna Sari', 'Taufik Hidayat', 'Sri Wahyuni', 'Arif Rahman', 'Nova Anggraeni',
    'Iman Santoso', 'Yuni Astuti', 'Doni Kurniawan', 'Sari Handayani', 'Rudi Hartono'
];

function _asSeededShuffle(seed, arr) {
    let s = seed || 1;
    const rnd = () => { s = (s * 48271) % 2147483647; return s / 2147483647; };
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
}

function _asPickNames(seedBase, count) {
    if (!count) return [];
    const shuffled = _asSeededShuffle(seedBase, _AS_NAME_POOL);
    const names = [];
    for (let i = 0; i < count; i++) {
        const base = shuffled[i % shuffled.length];
        const round = Math.floor(i / shuffled.length);
        names.push(round > 0 ? `${base} (${round + 1})` : base);
    }
    return names;
}

function _asNamesForOption(nomor, kind, optIdx, count) {
    const seed = nomor * 97 + optIdx * 13 + (kind === 'skor' ? 500 : 0) + 3;
    return _asPickNames(seed, count);
}

// Jumlah opsi & posisi kunci per nomor (tipe Benar/Salah) — DIISI EKSPLISIT
// per soal (bukan rumus/rotasi otomatis), sama spt data asli di admin/soal
// (q.jawaban = array bebas panjangnya, minimal 2 pilihan; q.kunci = id salah
// satu elemen array itu, ditentukan langsung, bukan dihitung dari nomor
// soal). Jumlah opsi SENGAJA dibuat variatif (3-5) supaya konsisten dgn
// aturan asli "Kolom Pilihan C, D, E boleh dikosongkan jika soal hanya
// punya 2-3 pilihan" — bukan semua soal pasti 5 opsi A-E.
const _AS_DUMMY_BINARY_DETAIL = {
    1: { jumlahOpsi: 4, kunciIdx: 2 },   // A B [C=kunci] D
    2: { jumlahOpsi: 5, kunciIdx: 0 },   // [A=kunci] B C D E
    3: { jumlahOpsi: 3, kunciIdx: 1 },   // A [B=kunci] C
    4: { jumlahOpsi: 5, kunciIdx: 3 },   // A B C [D=kunci] E
    5: { jumlahOpsi: 4, kunciIdx: 0 },   // [A=kunci] B C D
    6: { jumlahOpsi: 5, kunciIdx: 4 }    // A B C D [E=kunci]
};

// Pecah total benar/salah dari _ATD_DUMMY_BINARY (analisa-token-detail.js)
// ke opsi-opsi di _AS_DUMMY_BINARY_DETAIL: kunci dapat semua "benar", opsi
// lain berbagi "salah" dgn pola tetap MENURUN sesuai urutan aslinya (opsi
// yg lebih dekat ke kunci dapat porsi lebih besar) — bukan diacak, urutan
// opsi persis urutan aslinya (index 0..n-1 = A..seterusnya).
function _asBuildOpsiData(nomor, kind) {
    if (kind === 'binary') {
        const src = (typeof _ATD_DUMMY_BINARY !== 'undefined') ? _ATD_DUMMY_BINARY.find(s => s.nomor === nomor) : null;
        if (!src) return null;
        const detail = _AS_DUMMY_BINARY_DETAIL[nomor] || { jumlahOpsi: 4, kunciIdx: 0 };
        const n = Math.max(2, detail.jumlahOpsi);
        const kunciIdx = Math.min(Math.max(0, detail.kunciIdx), n - 1);
        const others = [];
        for (let i = 0; i < n; i++) if (i !== kunciIdx) others.push(i);
        const weights = others.map((_, i) => others.length - i); // menurun tetap: n-1, n-2, ..., 1 — TIDAK acak
        const totalW = weights.reduce((a, b) => a + b, 0);
        let remaining = src.salah;
        const counts = new Array(n).fill(0);
        counts[kunciIdx] = src.benar;
        others.forEach((optIdx, i) => {
            const isLast = i === others.length - 1;
            let share = isLast ? remaining : Math.round(src.salah * weights[i] / totalW);
            share = Math.max(0, Math.min(remaining, share));
            counts[optIdx] = share;
            remaining -= share;
        });
        const options = counts.map((count, idx) => ({
            huruf: _asHuruf(idx), idx,
            text: _asOpsiTextFor(nomor, idx),
            count,
            isKunci: idx === kunciIdx,
            names: _asNamesForOption(nomor, kind, idx, count)
        }));
        return {
            pertanyaan: _AS_DUMMY_PERTANYAAN[nomor] || `Contoh teks soal nomor ${nomor} (dummy, belum ditarik dari data asli).`,
            pembahasan: _AS_DUMMY_PEMBAHASAN[nomor] || 'Pembahasan untuk soal ini akan ditampilkan di sini (dummy).',
            options
        };
    }

    // kind === 'skor' — jumlah opsi & urutannya ikut persis panjang/urutan
    // array `opsi` di _ATD_DUMMY_SKOR (analisa-token-detail.js), TIDAK
    // dipatok 5 dan TIDAK diacak.
    const src = (typeof _ATD_DUMMY_SKOR !== 'undefined') ? _ATD_DUMMY_SKOR.find(s => s.nomor === nomor) : null;
    if (!src) return null;
    const options = src.opsi.map((o, idx) => ({
        huruf: _asHuruf(idx), idx,
        text: _asOpsiTextFor(nomor, idx),
        count: o.jumlah,
        nilai: o.nilai,
        isKunci: o.nilai > 0,
        names: _asNamesForOption(nomor, kind, idx, o.jumlah)
    }));
    return {
        pertanyaan: _AS_DUMMY_PERTANYAAN[nomor] || `Contoh teks soal nomor ${nomor} (dummy, belum ditarik dari data asli).`,
        pembahasan: _AS_DUMMY_PEMBAHASAN[nomor] || 'Pembahasan untuk soal ini akan ditampilkan di sini (dummy).',
        options
    };
}

// ── STATE FILTER ────────────────────────────────────────────────────────────
let _asActiveFilter = null; // index opsi yg sedang difilter di daftar peserta (0..jumlahOpsi-1), null = tampil semua

function _asToggleFilter(idx) {
    _asActiveFilter = (_asActiveFilter === idx) ? null : idx;
    _asRenderContent(window._analisaSoalDetailGrup || null, window._analisaSoalDetailNomor || null, window._analisaSoalDetailKind || null);
}

function _asClearFilter() {
    _asActiveFilter = null;
    _asRenderContent(window._analisaSoalDetailGrup || null, window._analisaSoalDetailNomor || null, window._analisaSoalDetailKind || null);
}

// ── RENDER ──────────────────────────────────────────────────────────────────
function _asRenderContent(grup, nomor, kind) {
    const el = document.getElementById('as-content');
    if (!el) return;
    if (!grup || !nomor || !kind) {
        el.innerHTML = '<div class="card"><div class="empty-state"><p>Analisa per-soal akan segera hadir</p></div></div>';
        return;
    }
    const data = _asBuildOpsiData(nomor, kind);
    if (!data) {
        el.innerHTML = '<div class="card"><div class="empty-state"><p>Data soal ini belum tersedia</p></div></div>';
        return;
    }
    el.innerHTML = _asLayoutHtml(nomor, kind, data);
}

function _asOpsiRowHtml(o, kind) {
    const activeCls = _asActiveFilter === o.idx ? ' as-active' : '';
    const kunciCls = o.isKunci ? ' as-kunci' : '';
    const kunciBadge = kind === 'binary' && o.isKunci ? '<span class="as-kunci-badge">Kunci Jawaban</span>' : '';
    const nilaiBadge = kind === 'skor' ? `<span class="as-nilai-badge${o.isKunci ? ' as-nilai-badge-top' : ''}">Nilai ${o.nilai}</span>` : '';
    return `
    <div class="as-opsi-row${kunciCls}${activeCls}" onclick="_asToggleFilter(${o.idx})" title="Klik untuk memfilter daftar peserta yang memilih opsi ${o.huruf}">
        <div class="as-opsi-huruf">${o.huruf}</div>
        <div class="as-opsi-body">
            <div class="as-opsi-teks">${_asEsc(o.text)}</div>
            ${kunciBadge}${nilaiBadge}
        </div>
        <div class="as-opsi-count">${o.count}<span>orang</span></div>
    </div>`;
}

function _asUserGroupHtml(o) {
    const hiddenCls = (_asActiveFilter !== null && _asActiveFilter !== o.idx) ? ' as-hidden' : '';
    const chipCls = o.isKunci ? ' correct' : ' wrong';
    const chips = o.names.length
        ? o.names.map(n => `<div class="as-user-chip${chipCls}">${_asEsc(n)}</div>`).join('')
        : '<div class="as-user-empty">Belum ada peserta yang memilih opsi ini</div>';
    return `
    <div class="as-user-group${hiddenCls}" data-opt="${o.idx}">
        <div class="as-user-group-head">
            <span class="as-opsi-huruf small${o.isKunci ? ' as-kunci' : ''}">${o.huruf}</span>
            <span class="as-user-group-count">${o.count} orang</span>
        </div>
        <div class="as-user-group-list">${chips}</div>
    </div>`;
}

function _asLayoutHtml(nomor, kind, data) {
    const opsiRows = data.options.map(o => _asOpsiRowHtml(o, kind)).join('');
    const userGroups = data.options.map(o => _asUserGroupHtml(o)).join('');
    const filterActive = _asActiveFilter !== null;
    const clearBtn = filterActive
        ? `<button class="as-clear-filter" onclick="_asClearFilter()">Tampilkan semua &times;</button>`
        : '';
    const userSub = filterActive
        ? `Menampilkan peserta yang memilih opsi <b>${_asHuruf(_asActiveFilter)}</b> saja`
        : 'Semua peserta, dikelompokkan per pilihan jawaban';

    return `
    <div class="as-layout">
      <div class="as-col-main">
        <div class="card as-soal-card">
          <div class="as-soal-label">Soal No. ${nomor}</div>
          <div class="as-soal-text">${_asEsc(data.pertanyaan)}</div>
          <div class="as-opsi-list">${opsiRows}</div>
          <div class="as-opsi-hint">Klik salah satu pilihan untuk memfilter daftar peserta; klik lagi untuk menampilkan semua</div>
        </div>
        <div class="card as-pembahasan-card">
          <div class="as-pembahasan-title">Pembahasan</div>
          <div class="as-pembahasan-text">${_asEsc(data.pembahasan)}</div>
        </div>
      </div>
      <div class="as-col-side">
        <div class="card as-user-card">
          <div class="as-user-head">
            <div class="section-title" style="font-size:15px;margin-bottom:2px">Daftar Jawaban Peserta</div>
            ${clearBtn}
          </div>
          <div class="section-sub" style="margin-bottom:12px">${userSub}</div>
          <div class="as-user-groups">${userGroups}</div>
        </div>
      </div>
    </div>`;
}
