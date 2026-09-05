// admin/analisa/analisa-token.js
// Halaman ANALISA > TOKEN — menampilkan daftar TOKEN YANG TERGABUNG DALAM GRUP
// SAJA (token tanpa grub_token disembunyikan), dengan search nama grup, filter
// jangka waktu (Hari Ini / Minggu Ini / Bulan Ini / Custom), dan list yang
// dipisah per tanggal — pola & markup-nya sama seperti "Token Terpakai" di CAT
// (lihat admin/cat/token.js -> _tuGroupHtml/_renderTokenUsed), cuma sumber
// datanya digabung (token aktif + token terpakai) lalu difilter grub_token saja.
//
// Klik salah satu token akan pindah ke halaman detail (admin/analisa/analisa-token-detail.js)
// — file terpisah, isinya masih kosong (menyusul).

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
    _atRange = range;
    document.querySelectorAll('#page-analisa-token [data-range]').forEach(b => b.classList.toggle('active', b.dataset.range === range));
    const w = document.getElementById('at-custom-wrap');
    if (w) w.style.display = range === 'custom' ? 'block' : 'none';
    if (range === 'custom') _atCalRenderBoth();
    _renderAnalisaTokenList();
}

function _atGroupHtml(group) {
    const items = group.items;
    const label = group.key === '0000-00-00' ? 'Tanggal Tidak Diketahui' : new Date(group.key).toLocaleDateString('id-ID', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
    const rows = items.map((tk, i) => `<tr style="cursor:pointer" onclick="openAnalisaTokenDetail('${tk.kode}')">
        <td>${i+1}</td>
        <td><code style="font-family:monospace;font-weight:700;color:var(--blue);font-size:12px">${tk.kode}</code></td>
        <td style="font-size:12px">${tk.grub_token}</td>
        <td class="hide-mobile" style="font-size:12px">${tk.modul_nama || tk.modul_kode || '-'}</td>
        <td><span class="history-badge" style="${tk._dipakai ? 'background:rgba(22,163,74,.12);color:#16a34a' : 'background:rgba(19,50,89,.08);color:var(--text-sub)'}">${tk._dipakai ? 'Terpakai' : 'Belum'}</span></td>
    </tr>`).join('');
    const cards = items.map(tk => SwipeCards.buildSwipeCardHtml({
        title: tk.kode,
        sub: `${tk.grub_token} · ${tk.modul_nama || tk.modul_kode || '-'}`,
        sideHtml: tk._dipakai ? '<span class="history-badge" style="background:rgba(22,163,74,.12);color:#16a34a">Terpakai</span>' : '<span class="history-badge" style="background:rgba(19,50,89,.08);color:var(--text-sub)">Belum</span>',
        onTapAttr: `onclick="openAnalisaTokenDetail('${tk.kode}')"`
    })).join('');
    return `<div class="section-sub" style="font-weight:700;color:var(--blue);text-transform:none;margin:18px 0 8px">${label} <span style="font-weight:500;color:var(--text-sub);font-size:11px">(${items.length} token)</span></div>
    <div class="card" style="padding:0;overflow:hidden"><div class="table-wrap"><table><thead><tr><th>#</th><th>Kode Token</th><th>Grup</th><th class="hide-mobile">Modul</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div><div class="swipe-list">${cards}</div></div>`;
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

    const groups = {};
    data.forEach(t => { const k = _atDateKey(t); (groups[k] = groups[k] || []).push(t); });
    const dayKeys = Object.keys(groups).sort((a,b) => b.localeCompare(a));

    wrap.innerHTML = dayKeys.map(k => _atGroupHtml({ key: k, items: groups[k] })).join('');
    wrap.querySelectorAll('.swipe-list').forEach(el => { if (window.SwipeCards) SwipeCards.bindSwipeList(el); });
}

function openAnalisaTokenDetail(kode) {
    window._analisaTokenDetailKode = kode;
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
