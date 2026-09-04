// admin/paket-daterange.js
// Widget kalender custom (kiri = tanggal mulai, kanan = tanggal selesai) buat
// dropdown "Durasi / Periode" = Custom di form Paket. Dipisah dari
// admin/paket-form.js supaya logic kalendernya nggak numpuk di file form.
// Murni dibangun sendiri (markup + CSS di css/daterange.css) — TIDAK memakai
// <input type="date"> bawaan browser sama sekali.
//
// State disimpan di objek global PaketCalState. Tanggal yang sudah dipilih
// ditulis ke 2 hidden input (#pf-periode-start / #pf-periode-end, format ISO
// yyyy-mm-dd) yang dibaca admin/paket-form.js saat submitPaket().

const PAKET_CAL_BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const PAKET_CAL_HARI = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

let PaketCalState = null; // diisi oleh initPaketDateRange()

function _paketCalToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function _paketCalISO(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function _paketCalFromISO(s) { if (!s) return null; const [y,m,d] = s.split('-').map(Number); const dt = new Date(y, m-1, d); dt.setHours(0,0,0,0); return dt; }
function _paketCalSameDay(a,b) { return a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function _paketCalFmt(d) { return d ? (d.getDate() + ' ' + PAKET_CAL_BULAN[d.getMonth()].slice(0,3) + ' ' + d.getFullYear()) : '-'; }

// Dipanggil dari onchange dropdown #pf-periode
function onPaketPeriodeChange(val) {
    const wrap = document.getElementById('pf-periode-daterange');
    if (!wrap) return;
    if (val === 'custom') {
        wrap.style.display = 'block';
        if (!PaketCalState) initPaketDateRange(); // default kalau belum ada state (mode Tambah)
        else _paketCalRenderBoth();
    } else {
        wrap.style.display = 'none';
    }
    setDirty('paket');
}

// startISO/endISO opsional (dipanggil dari openEditPaket utk prefill).
// Default: hari ini s/d +30 hari.
function initPaketDateRange(startISO, endISO) {
    const start = _paketCalFromISO(startISO) || _paketCalToday();
    const end = _paketCalFromISO(endISO) || (function(){ const d = new Date(start); d.setDate(d.getDate()+30); return d; })();
    PaketCalState = {
        start, end,
        viewStart: { y: start.getFullYear(), m: start.getMonth() },
        viewEnd: { y: end.getFullYear(), m: end.getMonth() }
    };
    _paketCalWriteHidden();
    _paketCalRenderBoth();
}

function _paketCalWriteHidden() {
    if (!PaketCalState) return;
    const s = document.getElementById('pf-periode-start');
    const e = document.getElementById('pf-periode-end');
    if (s) s.value = _paketCalISO(PaketCalState.start);
    if (e) e.value = _paketCalISO(PaketCalState.end);
    _paketCalUpdateSummary();
}

function _paketCalUpdateSummary() {
    const el = document.getElementById('pf-periode-summary');
    if (!el || !PaketCalState) return;
    const diff = paketPeriodeDiffDays();
    if (PaketCalState.end < PaketCalState.start) {
        el.textContent = 'Tanggal selesai tidak boleh sebelum tanggal mulai';
        el.classList.add('cal-summary-warn');
    } else {
        el.textContent = `${_paketCalFmt(PaketCalState.start)}  →  ${_paketCalFmt(PaketCalState.end)}  (${diff} hari)`;
        el.classList.remove('cal-summary-warn');
    }
}

// Dipakai admin/paket-form.js saat submit
function paketPeriodeDiffDays() {
    if (!PaketCalState) return 30;
    const diff = Math.round((PaketCalState.end - PaketCalState.start) / 86400000) + 1;
    return diff > 0 ? diff : 1;
}

function paketCalNav(which, dir) {
    if (!PaketCalState) return;
    const v = which === 'start' ? PaketCalState.viewStart : PaketCalState.viewEnd;
    v.m += dir;
    if (v.m < 0) { v.m = 11; v.y--; }
    if (v.m > 11) { v.m = 0; v.y++; }
    _paketCalRenderOne(which);
}

function paketCalPick(which, y, m, d) {
    if (!PaketCalState) return;
    const picked = new Date(y, m, d); picked.setHours(0,0,0,0);
    if (which === 'start') PaketCalState.start = picked;
    else PaketCalState.end = picked;
    _paketCalWriteHidden();
    _paketCalRenderBoth(); // render ulang keduanya biar highlight rentang ikut update
}

function _paketCalRenderBoth() { _paketCalRenderOne('start'); _paketCalRenderOne('end'); }

function _paketCalRenderOne(which) {
    const container = document.getElementById(which === 'start' ? 'pf-cal-start' : 'pf-cal-end');
    if (!container || !PaketCalState) return;
    const view = which === 'start' ? PaketCalState.viewStart : PaketCalState.viewEnd;
    const selected = which === 'start' ? PaketCalState.start : PaketCalState.end;
    const other = which === 'start' ? PaketCalState.end : PaketCalState.start;

    const firstOfMonth = new Date(view.y, view.m, 1);
    const startWeekday = firstOfMonth.getDay(); // 0=Min
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const today = _paketCalToday();

    let cells = '';
    for (let i = 0; i < startWeekday; i++) cells += '<div class="cal-day cal-day-empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
        const cellDate = new Date(view.y, view.m, d); cellDate.setHours(0,0,0,0);
        const isSelected = _paketCalSameDay(cellDate, selected);
        const isToday = _paketCalSameDay(cellDate, today);
        // Batasi: kalender "selesai" nggak bisa pilih tanggal sebelum "mulai", dan sebaliknya
        const disabled = which === 'start' ? (cellDate > other) : (cellDate < other);
        const cls = ['cal-day'];
        if (isSelected) cls.push('cal-day-selected');
        else if (isToday) cls.push('cal-day-today');
        if (disabled) cls.push('cal-day-disabled');
        cells += `<button type="button" class="${cls.join(' ')}" ${disabled ? 'disabled' : `onclick="paketCalPick('${which}',${view.y},${view.m},${d})"`}>${d}</button>`;
    }

    container.innerHTML = `
        <div class="cal-widget-label">${which === 'start' ? '📅 Tanggal Mulai' : '🏁 Tanggal Selesai'}</div>
        <div class="cal-header">
            <button type="button" class="cal-nav" onclick="paketCalNav('${which}',-1)">‹</button>
            <div class="cal-title">${PAKET_CAL_BULAN[view.m]} ${view.y}</div>
            <button type="button" class="cal-nav" onclick="paketCalNav('${which}',1)">›</button>
        </div>
        <div class="cal-weekdays">${PAKET_CAL_HARI.map(h=>`<span>${h}</span>`).join('')}</div>
        <div class="cal-grid">${cells}</div>`;
}
