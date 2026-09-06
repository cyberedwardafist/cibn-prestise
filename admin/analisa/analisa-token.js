// admin/analisa/analisa-token.js
// Halaman ANALISA > TOKEN — menampilkan daftar GRUP TOKEN (token tanpa
// grub_token disembunyikan), dengan search nama grup dan filter jangka waktu
// (Hari Ini / Minggu Ini / Bulan Ini / Custom) berdasarkan tanggal dibuatnya
// token. List DIRINGKAS per grup (bukan per token satu-satu) — tiap baris
// grup menampilkan: nama grup, jumlah token digenerate, jumlah token
// terpakai, masa aktivasi (tanggal awal - tanggal akhir), modul, dan status
// grup. Sumber datanya digabung (token aktif + token terpakai) lalu
// dikelompokkan per KUNCI GRUP SESUNGGUHNYA (_atGrupKey — grub_id), BUKAN per
// nama tampilan (grub_token) — 2 batch beda yang kebetulan diberi nama sama
// (mis. "SMA1" dibuat lagi bulan depan utk angkatan lain) tetap jadi 2
// baris/kartu terpisah, tidak pernah tercampur. Lihat komentar _atGrupKey().
//
// Klik salah satu grup akan pindah ke halaman detail
// (admin/analisa/analisa-token-detail.js) — file terpisah, isinya masih
// kosong (menyusul), sekarang membawa NAMA GRUP (bukan kode token tunggal).

let _atData = [];
let _atSearch = '';
let _atRange = 'semua';
let _atCalFrom = null, _atCalTo = null;
let _atCalViewFrom = null, _atCalViewTo = null;

const AT_CAL_BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const AT_CAL_HARI = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

function _atToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function _atISO(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function _atLocalDateStr(v) { const x = new Date(v); if (isNaN(x)) return null; return _atISO(x); }
function _atSameDay(a,b) { return a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function _atFmt(d) { return d ? (d.getDate() + ' ' + AT_CAL_BULAN[d.getMonth()].slice(0,3) + ' ' + d.getFullYear()) : '-'; }
function _atDateKey(t) { return _atLocalDateStr(t.created_at || t.token_created_at) || '0000-00-00'; }

async function renderAnalisaToken() {
    const [tokens, used] = await Promise.all([
        TokensAPI.getAll().catch(() => []),
        TokensAPI.getUsed().catch(() => [])
    ]);
    // Gabungkan token aktif + token terpakai (dedup by kode; versi "used" menang
    // karena datanya lebih lengkap: skor, digunakan_oleh, tgl_selesai, dst).
    const map = {};
    (tokens || []).forEach(t => { map[t.kode] = t; });
    (used || []).forEach(t => { map[t.kode] = Object.assign({}, map[t.kode] || {}, t, { _dipakai: true }); });
    _atData = Object.values(map).filter(t => t.grub_token && String(t.grub_token).trim());

    if (!_atCalFrom) {
        const today = _atToday();
        _atCalTo = new Date(today);
        _atCalFrom = new Date(today); _atCalFrom.setDate(today.getDate() - 7);
        _atCalViewFrom = { y: _atCalFrom.getFullYear(), m: _atCalFrom.getMonth() };
        _atCalViewTo = { y: _atCalTo.getFullYear(), m: _atCalTo.getMonth() };
    }
    _renderAnalisaTokenList();
}

function _setAtRange(range) {
    // Klik "Custom" padahal Custom SUDAH aktif (filter custom-nya sudah
    // jalan, kalendernya lagi kebuka) -> ini toggle TUTUP/BUKA tampilan
    // kalender doang, JANGAN ubah _atRange atau render ulang list. Kalau
    // sampai _atRange direset atau list di-render ulang di sini, filter
    // custom yang sudah dipilih user ikut hilang/ke-reset padahal user cuma
    // mau nyembunyiin kalendernya, bukan batalin filternya.
    if (range === 'custom' && _atRange === 'custom') {
        const w = document.getElementById('at-custom-wrap');
        if (w) w.style.display = (w.style.display === 'none') ? 'block' : 'none';
        return;
    }
    _atRange = range;
    document.querySelectorAll('#page-analisa-token [data-range]').forEach(b => b.classList.toggle('active', b.dataset.range === range));
    const w = document.getElementById('at-custom-wrap');
    if (w) w.style.display = range === 'custom' ? 'block' : 'none';
    if (range === 'custom') _atCalRenderBoth();
    _renderAnalisaTokenList();
}

// Status ringkas 1 grup berdasarkan gabungan seluruh token di dalamnya —
// TIDAK menampilkan token satu-satu, cukup 1 label yang mewakili kondisi grup.
function _atStatusBadge(items) {
    const total = items.length;
    const used = items.filter(t => t._dipakai).length;
    const now = Date.now();
    const allExpired = total > 0 && items.every(t => t.expired && new Date(t.expired).getTime() < now);
    if (total > 0 && used === total) return { label: 'Habis Terpakai', style: 'background:rgba(19,50,89,.08);color:var(--text-sub)' };
    if (allExpired) return { label: 'Kadaluarsa', style: 'background:rgba(220,38,38,.12);color:#dc2626' };
    if (used === 0) return { label: 'Belum Digunakan', style: 'background:rgba(19,50,89,.08);color:var(--text-sub)' };
    return { label: 'Berjalan', style: 'background:rgba(37,99,235,.12);color:#2563eb' };
}

// Masa aktivasi grup = rentang tanggal aktivasi paling awal s/d expired paling akhir
// dari seluruh token dalam grup itu (bukan per-token, cukup 1 rentang mewakili grup).
function _atMasaAktivasi(items) {
    const akts = items.map(t => t.aktivasi).filter(Boolean).map(v => new Date(v)).filter(d => !isNaN(d));
    const exps = items.map(t => t.expired).filter(Boolean).map(v => new Date(v)).filter(d => !isNaN(d));
    if (!akts.length && !exps.length) return '-';
    const minA = akts.length ? new Date(Math.min.apply(null, akts.map(d => d.getTime()))) : null;
    const maxE = exps.length ? new Date(Math.max.apply(null, exps.map(d => d.getTime()))) : null;
    return `${_atFmt(minA)} – ${_atFmt(maxE)}`;
}

function _atModulLabel(items) {
    const set = new Set(items.map(t => t.modul_nama || t.modul_kode).filter(Boolean));
    return set.size ? Array.from(set).join(', ') : '-';
}

function _atEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

// Kunci pengelompokan grup yang SESUNGGUHNYA — HARUS sama persis dgn
// grupKeyOf() versi server (server.js). grub_token (nama) BOLEH diulang antar
// batch berbeda (mis. "SMA1" dibuat lagi bulan depan) — itu cuma label, BUKAN
// identitas grup. grub_id (dibuat server tiap kali generate token dgn Grup
// Token aktif) yang menjamin 2 batch senama TIDAK PERNAH dianggap 1 grup yang
// sama, walau modul & peserta yang mengerjakan kebetulan sama. Token lama
// (dibuat sebelum kolom grub_id ada) fallback ke "legacy:<nama>" — masih
// dikelompokkan by nama spt sebelumnya (satu2nya cara yg tersedia utk data lama).
function _atGrupKey(t) { return t.grub_id ? t.grub_id : `legacy:${t.grub_token}`; }

// 1 grup = 1 baris/kartu ringkasan: nama grup, jumlah digenerate, jumlah
// terpakai, masa aktivasi, modul, status — bukan daftar semua token di grup itu.
// `key` (bukan `name`) yang dipakai utk klik-buka detail (lihat _atGrupKey) —
// `name` cuma label tampilan, BISA sama antar baris (2 grup beda tapi
// kebetulan dinamai sama) — makanya `dibuat` (tanggal batch ini dibuat)
// ditampilkan sbg sub-teks kecil di bawah nama, supaya admin tetap bisa
// bedakan sekilas tanpa perlu buka detail dulu.
function _atGroupSummary(key, items) {
    const total = items.length;
    const used = items.filter(t => t._dipakai).length;
    const st = _atStatusBadge(items);
    const createdTimes = items.map(t => new Date(t.created_at || t.token_created_at || 0).getTime()).filter(n => n);
    const dibuat = createdTimes.length ? _atFmt(new Date(Math.min.apply(null, createdTimes))) : '-';
    return {
        key, name: items[0].grub_token, total, used, dibuat,
        masa: _atMasaAktivasi(items),
        modul: _atModulLabel(items),
        badge: `<span class="history-badge" style="${st.style}">${st.label}</span>`
    };
}

function _renderAnalisaTokenList() {
    let data = _atData;
    if (_atSearch) { const q = _atSearch.toLowerCase(); data = data.filter(t => (t.grub_token || '').toLowerCase().includes(q)); }

    const today = _atToday();
    if (_atRange === 'hari_ini') {
        const k = _atISO(today);
        data = data.filter(t => _atDateKey(t) === k);
    } else if (_atRange === 'minggu_ini') {
        const start = new Date(today); start.setDate(today.getDate() - today.getDay());
        const startK = _atISO(start), endK = _atISO(today);
        data = data.filter(t => { const k = _atDateKey(t); return k >= startK && k <= endK; });
    } else if (_atRange === 'bulan_ini') {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const startK = _atISO(start), endK = _atISO(today);
        data = data.filter(t => { const k = _atDateKey(t); return k >= startK && k <= endK; });
    } else if (_atRange === 'custom' && _atCalFrom && _atCalTo) {
        const startK = _atISO(_atCalFrom), endK = _atISO(_atCalTo);
        data = data.filter(t => { const k = _atDateKey(t); return k >= startK && k <= endK; });
    }

    const wrap = document.getElementById('analisa-token-groups');
    if (!wrap) return;
    if (!data.length) { wrap.innerHTML = '<div class="empty-state"><p>Tidak ada token bergrup ditemukan</p></div>'; return; }

    // Kelompokkan berdasarkan KUNCI GRUP SESUNGGUHNYA (_atGrupKey — grub_id,
    // BUKAN nama) — 2 grup boleh senama tampilannya, tetap jadi 2
    // baris/kartu terpisah kalau grub_id-nya beda (lihat komentar _atGrupKey).
    const groupsMap = {};
    data.forEach(t => { const k = _atGrupKey(t); (groupsMap[k] = groupsMap[k] || []).push(t); });
    const latestOf = items => Math.max.apply(null, items.map(t => new Date(t.created_at || t.token_created_at || 0).getTime() || 0));
    const groupKeys = Object.keys(groupsMap).sort((a, b) => latestOf(groupsMap[b]) - latestOf(groupsMap[a]));

    const summaries = groupKeys.map(key => _atGroupSummary(key, groupsMap[key]));

    // Nama yang muncul di >1 grup (beda grub_id) — cuma baris2 ini yang perlu
    // tampilkan tanggal dibuat sbg sub-teks pembeda; kalau namanya unik,
    // tanggal tidak perlu ditampilkan (bikin ramai tanpa guna).
    const nameCount = {};
    summaries.forEach(g => { nameCount[g.name] = (nameCount[g.name] || 0) + 1; });

    const rows = summaries.map((g, i) => `<tr style="cursor:pointer" onclick="openAnalisaTokenDetail('${_atEsc(g.key)}','${_atEsc(g.name)}')">
        <td>${i+1}</td>
        <td style="font-size:12px;font-weight:700;color:var(--blue)">${g.name}${nameCount[g.name] > 1 ? `<div style="font-size:10px;font-weight:500;color:var(--text-sub)">dibuat ${g.dibuat}</div>` : ''}</td>
        <td style="font-size:12px">${g.total}</td>
        <td style="font-size:12px">${g.used}</td>
        <td class="hide-mobile" style="font-size:11px">${g.masa}</td>
        <td class="hide-mobile" style="font-size:12px">${g.modul}</td>
        <td>${g.badge}</td>
    </tr>`).join('');

    const cards = summaries.map(g => SwipeCards.buildSwipeCardHtml({
        title: nameCount[g.name] > 1 ? `${g.name} · ${g.dibuat}` : g.name,
        sub: `${g.used}/${g.total} terpakai · ${g.modul} · ${g.masa}`,
        sideHtml: g.badge,
        onTapAttr: `onclick="openAnalisaTokenDetail('${_atEsc(g.key)}','${_atEsc(g.name)}')"`
    })).join('');

    wrap.innerHTML = `<div class="card" style="padding:0;overflow:hidden"><div class="table-wrap aksi-swipe-wrap"><table><thead><tr><th>#</th><th>Nama Grup</th><th>Digenerate</th><th>Terpakai</th><th class="hide-mobile">Masa Aktivasi</th><th class="hide-mobile">Modul</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div><div class="swipe-list">${cards}</div></div>`;
    wrap.querySelectorAll('.swipe-list').forEach(el => { if (window.SwipeCards) SwipeCards.bindSwipeList(el); });
}

function openAnalisaTokenDetail(grupKey, grupNama) {
    window._analisaTokenDetailGrup = grupKey;
    window._analisaTokenDetailGrupNama = grupNama || grupKey;
    window._analisaTokenDetailItems = (_atData || []).filter(t => _atGrupKey(t) === grupKey);
    if (typeof _persistAnalisaCtx === 'function') _persistAnalisaCtx();
    navigateTo('analisa-token-detail');
}

// ── KALENDER CUSTOM (Dari Tanggal / Sampai Tanggal) ──
// Murni markup + CSS sendiri (css/daterange.css, dipakai bareng dgn modul Paket) —
// TIDAK memakai <input type="date"> bawaan browser sama sekali.
function _atCalNav(which, dir) {
    const v = which === 'from' ? _atCalViewFrom : _atCalViewTo;
    v.m += dir;
    if (v.m < 0) { v.m = 11; v.y--; }
    if (v.m > 11) { v.m = 0; v.y++; }
    _atCalRenderOne(which);
}

function _atCalPick(which, y, m, d) {
    const picked = new Date(y, m, d); picked.setHours(0,0,0,0);
    if (which === 'from') _atCalFrom = picked; else _atCalTo = picked;
    _atCalRenderBoth();
    _renderAnalisaTokenList();
}

function _atCalRenderBoth() { _atCalRenderOne('from'); _atCalRenderOne('to'); _atCalUpdateSummary(); }

function _atCalUpdateSummary() {
    const el = document.getElementById('at-cal-summary'); if (!el) return;
    if (_atCalTo < _atCalFrom) {
        el.textContent = 'Tanggal akhir tidak boleh sebelum tanggal awal';
        el.classList.add('cal-summary-warn');
    } else {
        el.textContent = `${_atFmt(_atCalFrom)}  →  ${_atFmt(_atCalTo)}`;
        el.classList.remove('cal-summary-warn');
    }
}

function _atCalRenderOne(which) {
    const container = document.getElementById(which === 'from' ? 'at-cal-from' : 'at-cal-to');
    if (!container) return;
    const view = which === 'from' ? _atCalViewFrom : _atCalViewTo;
    const selected = which === 'from' ? _atCalFrom : _atCalTo;
    const other = which === 'from' ? _atCalTo : _atCalFrom;

    const firstOfMonth = new Date(view.y, view.m, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const today = _atToday();

    let cells = '';
    for (let i = 0; i < startWeekday; i++) cells += '<div class="cal-day cal-day-empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
        const cellDate = new Date(view.y, view.m, d); cellDate.setHours(0,0,0,0);
        const isSelected = _atSameDay(cellDate, selected);
        const isToday = _atSameDay(cellDate, today);
        const disabled = which === 'from' ? (cellDate > other) : (cellDate < other);
        const cls = ['cal-day'];
        if (isSelected) cls.push('cal-day-selected');
        else if (isToday) cls.push('cal-day-today');
        if (disabled) cls.push('cal-day-disabled');
        cells += `<button type="button" class="${cls.join(' ')}" ${disabled ? 'disabled' : `onclick="_atCalPick('${which}',${view.y},${view.m},${d})"`}>${d}</button>`;
    }

    container.innerHTML = `
        <div class="cal-widget-label">${which === 'from' ? '📅 Dari Tanggal' : '🏁 Sampai Tanggal'}</div>
        <div class="cal-header">
            <button type="button" class="cal-nav" onclick="_atCalNav('${which}',-1)">‹</button>
            <div class="cal-title">${AT_CAL_BULAN[view.m]} ${view.y}</div>
            <button type="button" class="cal-nav" onclick="_atCalNav('${which}',1)">›</button>
        </div>
        <div class="cal-weekdays">${AT_CAL_HARI.map(h => `<span>${h}</span>`).join('')}</div>
        <div class="cal-grid">${cells}</div>`;
}
