// admin/analisa/analisa-grafik.js
// Halaman ANALISA > GRAFIK. Dibuka lewat tombol "Analisa" di bawah legenda
// grafik "Sikap Kerja — Median & Sebaran, Per Kolom" pada
// admin/analisa/analisa-token-detail.js (lihat _atdGoToGrafikDetail() di
// sana). Konteksnya (grup asal + jenis grafik yg diklik) dititip di
// window._analisaGrafikDetail* sebelum navigateTo('analisa-grafik')
// dipanggil — pola sama persis dgn analisa-soal.js/_atdGoToSoalDetail().
//
// Tombol panah kembali di atas: balik ke halaman detail grup token yang
// tadi dibuka (analisa-token-detail), atau ke daftar grup (analisa-token)
// kalau entah kenapa dibuka tanpa konteks grup.
//
// ── ISI HALAMAN ──────────────────────────────────────────────────────────
// Sengaja dipakai ULANG data dummy + fungsi pembangun grafik yg SAMA PERSIS
// dgn admin/analisa/analisa-token-detail.js (_ATD_DUMMY_SIKAP_RAW,
// _atdDistFromRaw, _atdBuildSikapMedianChart, _atdSikapLegendHtml,
// _atdBindChartEvents, dst) — BUKAN disalin ulang — supaya grafiknya benar2
// identik dan otomatis ikut berubah kalau data dummy di sana diganti nanti.
// Aman dipanggil krn halaman ini cuma bisa dibuka lewat tombol "Analisa" yg
// ada di halaman analisa-token-detail, jadi js-nya sudah pasti sudah
// dimuat browser duluan.
//
// Tombol "Analisa" bawaan grafik (yg ada di halaman asal) DIMATIKAN di sini
// (opts.hideAnalisaBtn) supaya tidak ada tombol "Analisa" di dalam halaman
// Analisa itu sendiri.
//
// ── INTERAKSI BOLA SEBARAN (fitur tambahan, KHUSUS halaman ini) ──────────
// Beda dgn halaman asal (Analisa Token, cuma bisa hover/klik SATU KOLOM utk
// lihat popup median+rentang — lihat _atdRenderSikapStatPopup), di sini tiap
// BOLA sebaran (1 bola = 1 kombinasi kolom+kategori+nilai) BISA DIKLIK
// SENDIRI-SENDIRI:
//
//  1) Klik 1 bola -> popup BARU (bukan popup median biasa) muncul dekat
//     kursor/titik sentuh, isinya DAFTAR NAMA akun yg jatuh di bola itu
//     (lihat _agMembersForBubble, ambil dari _ATD_DUMMY_SIKAP_RAW yg tiap
//     barisnya kini py field `nama`). Popup ini SENGAJA TIDAK auto-tertutup
//     kalau mouse pindah / diklik di luar (beda dgn popup median biasa) —
//     cuma tertutup kalau: (a) bola yg sama diklik lagi, (b) tombol "x" di
//     popup diklik, atau (c) salah satu nama di dalamnya diklik.
//  2) Klik salah satu nama di popup itu -> popup ditutup, lalu grafik
//     digambar ULANG dgn tambahan OVERLAY garis putus-putus utk 1 orang itu
//     — KETIGA kategorinya sekaligus (Benar/Salah/Jumlah Dijawab), bukan
//     cuma kategori bola yg diklik — TANPA menghilangkan garis median
//     "utama" grup (median grup tetap ikut digambar bareng).
//  3) Begitu ada overlay 1 orang, muncul panel switch on/off (di SEBELAH
//     #ag-content utk layar lebar/desktop, ditumpuk di bawahnya utk layar
//     sempit/mobile — lihat css/chart.css .ag-layout/.ag-switches) isinya 2
//     saklar: "Utama" (nyala/matikan bola+median grup) & nama orang yg
//     dipilih (nyala/matikan overlay dia) — KEDUANYA default NYALA.
//
// Data member per bola & overlay per-orang MASIH DUMMY (ambil dari
// _ATD_DUMMY_SIKAP_RAW di analisa-token-detail.js) — nanti tinggal diganti
// hasil agregasi jawaban asli per akun.

function renderAnalisaGrafik() {
    const grup = window._analisaGrafikDetailGrup || null;
    const kind = window._analisaGrafikDetailKind || null;
    const sub = document.getElementById('ag-sub');
    if (sub) {
        // `_analisaGrafikDetailSoalNama` (kalau ada — dititip _atdGoToGrafikDetail
        // di analisa-token-detail.js) = nama soal Sikap Kerja spesifik yg
        // tombol "Analisa"-nya diklik, dipakai murni utk perjelas subjudul
        // saja (modul boleh py >1 soal Sikap Kerja terpisah).
        const soalNama = window._analisaGrafikDetailSoalNama || null;
        sub.textContent = grup
            ? `Grup: ${grup}${kind ? ' · Grafik: ' + (kind === 'sikap' ? 'Sikap Kerja — Median & Sebaran' + (soalNama ? ' (' + soalNama + ')' : '') : kind) : ''}`
            : '-';
    }
    // Reset state interaksi (popup bola & overlay orang terpilih) tiap kali
    // halaman ini dibuka ulang dari tombol "Analisa" di halaman asal, biar
    // tidak kebawa selection dari kunjungan sebelumnya.
    _agHideBubblePop();
    _agSelectedUserId = null;
    _agSelectedUserNama = null;
    _agShowUtama = { benar: true, salah: true, dijawab: true };
    _agShowUser = { benar: true, salah: true, dijawab: true };
    _agRenderContent(grup, kind);
}

function _agBack() {
    navigateTo(window._analisaGrafikDetailGrup ? 'analisa-token-detail' : 'analisa-token');
}

function _agRenderContent(grup, kind) {
    const el = document.getElementById('ag-content');
    if (!el) return;
    if (!grup || !kind) {
        el.innerHTML = '<div class="card"><div class="empty-state"><p>Analisa grafik akan segera hadir</p></div></div>';
        _agShowSwitchesPanel(false);
        return;
    }
    if (kind === 'sikap') {
        _agRenderSikap(el);
        return;
    }
    el.innerHTML = '<div class="card"><div class="empty-state"><p>Analisa grafik ini belum tersedia</p></div></div>';
    _agShowSwitchesPanel(false);
}

function _agRenderSikap(el) {
    if (typeof _atdBuildSikapMedianChart !== 'function' || typeof _ATD_DUMMY_SIKAP_RAW === 'undefined' || !_ATD_DUMMY_SIKAP_RAW.length) {
        el.innerHTML = '<div class="card"><div class="empty-state"><p>Data grafik belum tersedia</p></div></div>';
        _agShowSwitchesPanel(false);
        return;
    }
    el.innerHTML = '<div class="card atd-chart-card" id="ag-chart-sikap"></div>';

    // Hitung ulang sebaran dari sumber dummy yg sama (_ATD_DUMMY_SIKAP_RAW) —
    // bukan dari state global _atdSikapDist/_atdSikapCats, biar halaman ini
    // tetap benar walau dibuka lewat urutan apapun.
    const distBenar = _atdDistFromRaw(_ATD_DUMMY_SIKAP_RAW, r => r.benar);
    const distSalah = _atdDistFromRaw(_ATD_DUMMY_SIKAP_RAW, r => r.salah);
    const distDijawab = _atdDistFromRaw(_ATD_DUMMY_SIKAP_RAW, r => r.benar + r.salah);
    const cats = _ATD_DUMMY_SIKAP_RAW.map((_, i) => 'K' + (i + 1));
    const catData = [
        { label: 'Benar', color: '#16a34a', key: 'benar', dist: distBenar },
        { label: 'Salah', color: '#dc2626', key: 'salah', dist: distSalah },
        { label: 'Jumlah Dijawab', color: '#2666b8', key: 'dijawab', dist: distDijawab }
    ];

    // Isi juga state global _atdSikapCats/_atdSikapDist (dideklarasikan di
    // analisa-token-detail.js) krn dipakai _atdRenderSikapStatPopup() saat
    // hover/klik kolom grafik — sama persis mekanismenya dgn di halaman asal.
    _atdSikapCats = cats;
    _atdSikapDist = catData;

    const userOverlay = _agSelectedUserId ? { nama: _agSelectedUserNama, series: _agUserSeries(_agSelectedUserId) } : null;

    _atdBuildSikapMedianChart('ag-chart-sikap', {
        title: 'Grafik Sikap Kerja — Median & Sebaran, Per Kolom',
        sub: 'Tiap bola = jumlah orang yang dapat nilai itu; garis = median (bukan rata-rata) tiap kategori per kolom',
        categories: cats, catData, kind: 'sikap',
        hideAnalisaBtn: true,
        userOverlay,
        showUtamaCats: _agShowUtama,
        showUserCats: _agShowUser
    });
    const leg = document.getElementById('ag-chart-sikap-legend');
    if (leg) leg.innerHTML = _atdSikapLegendHtml() + (userOverlay ? _agUserLegendHtml(_agSelectedUserNama) : '');

    // Popup median/rentang biasa (hover/klik 1 kolom) — perilaku SAMA persis
    // dgn halaman asal, tidak diubah.
    _atdBindChartEvents('ag-chart-sikap', 'sikap');
    // Klik per-BOLA — fitur tambahan KHUSUS halaman ini (lihat komentar di
    // atas file).
    _agBindBubbleEvents('ag-chart-sikap');
    _agRenderSwitches();
}

function _agUserLegendHtml(nama) {
    return `<div class="atd-legend-item"><span class="atd-legend-dot" style="background:#fff;border:2px dashed #64748b"></span>${_atdEsc(nama)} (garis putus-putus)</div>`;
}

// ── STATE interaksi (khusus halaman ini) ───────────────────────────────────
let _agActiveBubbleKey = null;  // "kolom|kategori|nilai" bola yg lagi buka popup-nya
let _agActiveBubbleEl = null;   // elemen <g class="atd-bubble-hit"> yg lagi aktif
// PENTING: overlay 1 orang diidentifikasi lewat `id` (kode laporan = 1
// pengerjaan/token), BUKAN `nama` — 1 akun bisa mengerjakan lebih dari 1
// token/pengerjaan, jadi nama yg sama bisa muncul lebih dari sekali di
// daftar member sebuah bola (masing2 pengerjaan beda, boleh jatuh di
// bola/kolom yg beda pula). Kalau overlay dicocokkan cuma lewat nama, klik
// salah satu kemunculan nama itu akan selalu mengambil pengerjaan PERTAMA
// yg ketemu (lewat .find()) di tiap kolom — bukan pengerjaan spesifik yg
// bolanya diklik. `_agSelectedUserNama` cuma dipakai utk LABEL (legend,
// judul panel switch), pencarian data selalu lewat `_agSelectedUserId`.
let _agSelectedUserId = null;
let _agSelectedUserNama = null;
// Status switch PER KATEGORI (Benar/Salah/Jumlah Dijawab), masing2 utk grup
// "Utama" & grup "nama user" — BUKAN lagi 1 toggle besar per grup.
let _agShowUtama = { benar: true, salah: true, dijawab: true };
let _agShowUser = { benar: true, salah: true, dijawab: true };

const _AG_CAT_META = {
    benar: { label: 'Benar', color: '#16a34a' },
    salah: { label: 'Salah', color: '#dc2626' },
    dijawab: { label: 'Jumlah Dijawab', color: '#2666b8' }
};

// ── KLIK PER-BOLA ───────────────────────────────────────────────────────────
// Bola sebaran (".atd-bubble-hit", dibangun di _atdBuildSikapMedianChart)
// default pointer-events:none (lihat komentar di sana) — di halaman ini
// sengaja diaktifkan jadi "auto" supaya tiap bola bisa jadi target klik
// SENDIRI-SENDIRI (bukan cuma 1 kolom penuh spt popup median biasa).
//
// BUG (sudah diperbaiki): dulu cuma `<g class="atd-bubble-hit">`-nya yg
// di-set pointer-events:auto lewat style inline. Tapi circle-nya sendiri
// (.atd-bubble) dan teks di dalamnya (.atd-bubble-label) punya rule CSS
// SENDIRI di css/chart.css yg nembak pointer-events:none LANGSUNG ke
// elemen itu (bukan cuma warisan dari induk). pointer-events memang
// inherited, tapi rule yg nempel langsung ke elemen (class selector)
// selalu menang dibanding nilai warisan dari <g> pembungkusnya — jadi
// "auto" di <g> percuma, circle/teks tetap dianggap non-target, dan
// klik nembus ke rect kolom di bawahnya (bukan ke handler bola).
// Fix: paksa pointer-events:auto juga LANGSUNG (inline style, menang
// atas class apa pun urutan CSS-nya) ke tiap circle & teks anak <g> ini.
function _agBindBubbleEvents(containerId) {
    document.querySelectorAll(`#${containerId} .atd-bubble-hit`).forEach(g => {
        g.style.pointerEvents = 'auto';
        g.style.cursor = 'pointer';
        g.querySelectorAll('.atd-bubble, .atd-bubble-label').forEach(child => {
            child.style.pointerEvents = 'auto';
        });
        g.addEventListener('click', e => {
            e.stopPropagation(); // jangan sampai ketangkep juga sama .atd-chart-group / document
            const col = +g.dataset.col, catKey = g.dataset.cat, val = +g.dataset.val, count = +g.dataset.count;
            const key = col + '|' + catKey + '|' + val;
            // Klik bola yg SAMA yg popup-nya lagi kebuka -> tutup (toggle).
            if (_agActiveBubbleKey === key) { _agHideBubblePop(); return; }
            _agShowBubblePop(e, g, col, catKey, val, count);
        });
    });
}

// Daftar member (nama + id pengerjaan) yg jatuh persis di kombinasi (kolom,
// kategori, nilai) tertentu — diambil dari _ATD_DUMMY_SIKAP_RAW
// (analisa-token-detail.js), yg tiap baris pesertanya kini py field `nama`
// DAN `id` (kode laporan / 1 pengerjaan). `id` WAJIB dibawa (bukan cuma
// nama) supaya kalau 1 akun ada di bola ini lebih dari sekali (mengerjakan
// token ini/kolom ini beberapa kali dgn hasil sama persis), tiap baris tetap
// bisa dibedakan & diklik sendiri2 — dan supaya klik salah satu nama nanti
// (_agSelectUser) mengambil grafik pengerjaan yg BENAR, bukan sekadar
// pengerjaan pertama yg namanya cocok.
function _agMembersForBubble(colIdx, catKey, val) {
    const rows = (typeof _ATD_DUMMY_SIKAP_RAW !== 'undefined' && _ATD_DUMMY_SIKAP_RAW[colIdx]) || [];
    return rows.filter(r => {
        const v = catKey === 'benar' ? r.benar : catKey === 'salah' ? r.salah : (r.benar + r.salah);
        return v === val;
    }).map(r => ({ nama: r.nama || 'Tanpa nama', id: r.id }));
}

// #ag-bubble-pop dibuat on-demand & dipindah ke <body> (sama alasannya dgn
// #atd-pie-pop di analisa-token-detail.js — .page pakai CSS "transform" jadi
// containing-block baru utk "position:fixed", jadi kalau dibiarkan di dalam
// .page popup-nya ikut acuan kotak scroll .page, bukan viewport).
function _agGetBubblePopEl() {
    let pop = document.getElementById('ag-bubble-pop');
    if (!pop) {
        pop = document.createElement('div');
        pop.id = 'ag-bubble-pop';
        pop.className = 'ag-bubble-pop';
        pop.style.display = 'none';
        document.body.appendChild(pop);
    }
    if (pop.parentElement !== document.body) document.body.appendChild(pop);
    return pop;
}

function _agPositionBubblePop(evt) {
    const pop = _agGetBubblePopEl();
    const pt = (evt && evt.touches && evt.touches[0]) ? evt.touches[0] : evt;
    const x = (pt && pt.clientX != null) ? pt.clientX : window.innerWidth / 2;
    const y = (pt && pt.clientY != null) ? pt.clientY : 120;
    const popW = 230, popH = 240;
    let left = x + 16, top = y + 16;
    if (left + popW > window.innerWidth - 8) left = x - popW - 16;
    if (top + popH > window.innerHeight - 8) top = y - popH - 16;
    pop.style.left = Math.max(8, left) + 'px';
    pop.style.top = Math.max(8, top) + 'px';
}

// Popup daftar nama — BEDA dgn popup median/rentang biasa (_atdShowPie):
// TIDAK auto-tertutup lewat mouseleave/klik-di-luar. Cuma tertutup lewat
// _agHideBubblePop() yg dipanggil dari: klik bola yg sama lagi (toggle di
// _agBindBubbleEvents), tombol "x" (di HTML popup ini), atau klik nama
// (_agSelectUser).
function _agShowBubblePop(evt, groupEl, col, catKey, val, count) {
    _atdHidePie(); // sembunyikan dulu popup median/rentang biasa biar tidak tumpuk barengan
    const meta = _AG_CAT_META[catKey] || { label: catKey, color: '#64748b' };
    const members = _agMembersForBubble(col, catKey, val);
    const kolomLabel = _atdSikapCats[col] || ('#' + (col + 1));
    // BUG (sudah diperbaiki): JSON.stringify(n) menghasilkan string yg
    // dibungkus DOUBLE QUOTE (mis. "Ahmad Fauzi"), lalu ditempel apa adanya
    // ke dalam atribut onclick="..." yg JUGA dibungkus double quote ->
    // HTML-nya jadi onclick="_agSelectUser(event,"Ahmad Fauzi")" dan
    // browser berhenti mem-parse atribut itu tepat di kutip pertama setelah
    // "event,". Sisa JS-nya ("Ahmad Fauzi")) kebuang jadi teks biasa di luar
    // tag, jadi pas diklik browser cuma dapat potongan
    // "_agSelectUser(event," -> SyntaxError: Unexpected end of input.
    // Fix: escape dulu tiap karakter yg bisa mecahin attribute HTML (", ',
    // <, >, &) sebelum ditempel ke onclick, jadi JSON string-nya aman apa
    // pun isi namanya.
    const _agAttrEsc = s => String(s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    // Dikirim ke _agSelectUser(): `id` (kunci pencarian data, WAJIB unik per
    // pengerjaan) DAN `nama` (cuma label tampilan) — bukan nama saja, supaya
    // 2 baris dgn nama sama (akun yg sama, pengerjaan/token berbeda) tetap
    // bisa diklik terpisah dan masing2 menampilkan grafik pengerjaannya
    // sendiri, bukan selalu jatuh ke pengerjaan pertama yg namanya cocok.
    const rows = members.length
        ? members.map(m => `<div class="ag-bubble-pop-name" onclick="_agSelectUser(event,${_agAttrEsc(JSON.stringify(m.id))},${_agAttrEsc(JSON.stringify(m.nama))})">${_atdEsc(m.nama)}</div>`).join('')
        : '<div class="ag-bubble-pop-empty">Tidak ada data</div>';
    const pop = _agGetBubblePopEl();
    pop.innerHTML = `
        <button class="ag-bubble-pop-close" onclick="_agHideBubblePop()" title="Tutup">&times;</button>
        <div class="atd-pie-pop-title"><span class="atd-legend-dot" style="background:${meta.color}"></span>Kolom ${_atdEsc(kolomLabel)} · ${_atdEsc(meta.label)} = ${val}</div>
        <div class="ag-bubble-pop-sub">${count} orang · klik nama utk lihat grafik orang itu</div>
        <div class="ag-bubble-pop-list">${rows}</div>
    `;
    pop.style.display = 'block';
    _agPositionBubblePop(evt);
    if (_agActiveBubbleEl && _agActiveBubbleEl !== groupEl) _agActiveBubbleEl.classList.remove('atd-bubble-active');
    groupEl.classList.add('atd-bubble-active');
    _agActiveBubbleEl = groupEl;
    _agActiveBubbleKey = col + '|' + catKey + '|' + val;
}

function _agHideBubblePop() {
    const pop = document.getElementById('ag-bubble-pop');
    if (pop) pop.style.display = 'none';
    if (_agActiveBubbleEl) { _agActiveBubbleEl.classList.remove('atd-bubble-active'); _agActiveBubbleEl = null; }
    _agActiveBubbleKey = null;
}

// ── KLIK NAMA -> overlay grafik 1 orang + panel switch ─────────────────────
// Ambil Benar/Salah/Jumlah-Dijawab utk SATU PENGERJAAN SPESIFIK (dicari lewat
// `id` = kode laporan, BUKAN `nama`) di SEMUA kolom — dipakai sbg garis
// overlay putus-putus. `id` dipakai (bukan nama) krn 1 akun bisa mengerjakan
// lebih dari 1 token; kalau dicari lewat nama, .find() akan selalu berhenti
// di pengerjaan PERTAMA yg namanya cocok di tiap kolom, walau yg diklik di
// popup bola adalah pengerjaan yg lain. Kolom yg pengerjaan ini tidak ada
// datanya (mis. skenario data nyata nanti org itu belum sampai kolom itu)
// -> null, dilompati saat digambar (lihat _atdBuildSikapMedianChart).
function _agUserSeries(id) {
    const pick = key => _ATD_DUMMY_SIKAP_RAW.map(rows => {
        const r = rows.find(x => x.id === id);
        if (!r) return null;
        return key === 'benar' ? r.benar : key === 'salah' ? r.salah : (r.benar + r.salah);
    });
    return { benar: pick('benar'), salah: pick('salah'), dijawab: pick('dijawab') };
}

function _agSelectUser(evt, id, nama) {
    if (evt) evt.stopPropagation();
    _agHideBubblePop();
    _agSelectedUserId = id;
    _agSelectedUserNama = nama;
    // Sesuai permintaan: begitu 1 nama dipilih, SEMUA switch ("Utama" & nama
    // org itu, ketiga kategorinya) otomatis nyala — grafik yg tampil =
    // median grup + SELURUH kategori org itu, bukan cuma kategori bola yg
    // tadi diklik.
    _agShowUtama = { benar: true, salah: true, dijawab: true };
    _agShowUser = { benar: true, salah: true, dijawab: true };
    const el = document.getElementById('ag-content');
    if (el) _agRenderSikap(el);
}

// Tombol "x" di sebelah nama user di panel switch (.ag-switch-group-title) —
// menutup/menghapus overlay org itu dari grafik sepenuhnya (beda dgn switch
// per-kategori yg cuma sembunyikan sementara): grup switch-nya ikut hilang
// dari panel, dan kalau nanti user itu diklik lagi dari popup bola, switch-
// nya kebentuk ulang dgn status default (nyala semua) lewat _agSelectUser.
function _agRemoveUserOverlay(evt) {
    if (evt) evt.stopPropagation();
    _agSelectedUserId = null;
    _agSelectedUserNama = null;
    const el = document.getElementById('ag-content');
    if (el) _agRenderSikap(el);
}

// ── PANEL SWITCH "Utama" / nama user ───────────────────────────────────────
// Tiap grup (Utama / nama user) sekarang py 3 switch SENDIRI2, satu per
// kategori (Benar/Salah/Jumlah Dijawab) — bukan lagi 1 toggle besar yg
// nyalain/matiin seluruh grup sekaligus. `which` = 'utama' | 'user',
// `catKey` = 'benar' | 'salah' | 'dijawab'.
function _agToggleGroup(which, catKey, checked) {
    const store = which === 'utama' ? _agShowUtama : _agShowUser;
    store[catKey] = checked;
    const g = document.getElementById('ag-chart-sikap-g-' + which + '-' + catKey);
    if (g) g.style.display = checked ? 'block' : 'none';
}

// Urutan & label kategori dipakai bareng utk grup "Utama" maupun grup nama
// user (sama persis dgn _AG_CAT_META) — 1 baris switch per kategori.
function _agCatSwitchRowsHtml(which, state) {
    return ['benar', 'salah', 'dijawab'].map(catKey => {
        const meta = _AG_CAT_META[catKey];
        return `<div class="ag-switch-row">
            <label class="ag-switch"><input type="checkbox" ${state[catKey] ? 'checked' : ''} onchange="_agToggleGroup('${which}','${catKey}', this.checked)"><span class="ag-switch-slider"></span></label>
            <span>${_atdEsc(meta.label)}</span>
        </div>`;
    }).join('');
}

function _agRenderSwitches() {
    let panel = document.getElementById('ag-switches');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'ag-switches';
        panel.className = 'ag-switches';
        const content = document.getElementById('ag-content');
        if (content && content.parentElement) {
            // Bungkus #ag-content + panel switch dlm 1 wrapper flex (lihat
            // css/chart.css .ag-layout) kalau belum dibungkus, supaya di
            // layar lebar/desktop panel-nya bisa tampil BERDAMPINGAN
            // (sebelah #ag-content), bukan menumpuk ke bawah.
            if (!content.parentElement.classList.contains('ag-layout')) {
                const wrap = document.createElement('div');
                wrap.className = 'ag-layout';
                content.parentElement.insertBefore(wrap, content);
                wrap.appendChild(content);
                content.classList.add('ag-main');
                wrap.appendChild(panel);
            } else {
                content.parentElement.appendChild(panel);
            }
        }
    }
    panel.innerHTML = `
        <div class="ag-switches-title">Tampilkan</div>
        <div class="ag-switch-group">
            <div class="ag-switch-group-title">Utama</div>
            ${_agCatSwitchRowsHtml('utama', _agShowUtama)}
        </div>
        ${_agSelectedUserId ? `<div class="ag-switch-group">
            <div class="ag-switch-group-title">
                <span>${_atdEsc(_agSelectedUserNama)}</span>
                <button type="button" class="ag-switch-group-close" onclick="_agRemoveUserOverlay(event)" title="Tutup data user ini">&times;</button>
            </div>
            ${_agCatSwitchRowsHtml('user', _agShowUser)}
        </div>` : ''}
    `;
    panel.style.display = 'flex';
}

function _agShowSwitchesPanel(show) {
    const panel = document.getElementById('ag-switches');
    if (panel) panel.style.display = show ? 'flex' : 'none';
}
