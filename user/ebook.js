// user/ebook.js
// Modul E-BOOK (EbookLib + EbookReader, baca e-book dengan anti-screenshot). Lazy-load saat tab E-book dibuka.
// Bergantung pada helper global dari shell index_user.html yang sudah dimuat lebih dulu.

/* ══════════════════════════════════════════
   E-BOOK — Library + Reader (sweep/scroll, terproteksi)
   ══════════════════════════════════════════ */
function _ebkEsc(s){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function _ebkBookIcon(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="30" height="30"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>'; }
function _ebkPdfIcon(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'; }
async function ebookApiFetch(path) {
    const token = localStorage.getItem('cbn_token');
    const res = await fetch(window.location.origin + '/api' + path, { headers: { 'Authorization': 'Bearer ' + token } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memuat data');
    return data;
}
let _pdfJsLoadPromise = null;
function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve();
    if (_pdfJsLoadPromise) return _pdfJsLoadPromise;
    _pdfJsLoadPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        s.onload = () => {
            try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; resolve(); }
            catch (e) { reject(e); }
        };
        s.onerror = () => reject(new Error('Gagal memuat modul pembaca PDF. Cek koneksi internet.'));
        document.head.appendChild(s);
    });
    return _pdfJsLoadPromise;
}

const EbookLib = {
    books: [], kelompok: [], _search: '', _kelompokFilter: 'all',
    async load() {
        const grid = document.getElementById('ebook-library-grid');
        if (grid) grid.innerHTML = '<div class="jadwal-empty"><p>Memuat buku...</p></div>';
        try {
            const [books, kelompok] = await Promise.all([
                ebookApiFetch('/ebook'),
                ebookApiFetch('/ebook-kelompok').catch(() => [])
            ]);
            this.books = Array.isArray(books) ? books : [];
            this.kelompok = Array.isArray(kelompok) ? kelompok : [];
            this._populateKelompokSelect();
            this._render();
        } catch (e) {
            if (grid) grid.innerHTML = '<div class="jadwal-empty"><p>Gagal memuat library</p><small>' + _ebkEsc(e.message || '') + '</small></div>';
        }
    },
    _populateKelompokSelect() {
        const sel = document.getElementById('ebook-kelompok-filter-select'); if (!sel) return;
        const cur = sel.value || 'all';
        sel.innerHTML = '<option value="all">Semua Kelompok</option>' + this.kelompok.map(k => `<option value="${k.kode}">${_ebkEsc(k.nama)}</option>`).join('');
        sel.value = [...sel.options].some(o => o.value === cur) ? cur : 'all';
    },
    search(v) { this._search = v; this._toggleClearBtn(); this._render(); },
    clearSearch() {
        const input = document.getElementById('ebook-search-input');
        if (input) input.value = '';
        this._search = '';
        this._toggleClearBtn();
        this._render();
    },
    _toggleClearBtn() {
        const btn = document.getElementById('ebook-search-clear');
        if (btn) btn.classList.toggle('show', !!(this._search || '').trim());
    },
    filterKelompok(v) { this._kelompokFilter = v; this._render(); },
    _kelompokNama(kode) { const k = this.kelompok.find(x => x.kode === kode); return k ? k.nama : ''; },
    _spineColor(kode) {
        if (!kode) return 'var(--accent)';
        let h = 0; for (let i = 0; i < kode.length; i++) h = (h * 31 + kode.charCodeAt(i)) % 360;
        return `hsl(${h}deg 55% 45%)`;
    },
    _updateCount() {
        const el = document.getElementById('ebook-count'); if (!el) return;
        const n = this.books.length;
        el.textContent = n ? `${n} buku` : '';
    },
    _render() {
        const grid = document.getElementById('ebook-library-grid'); if (!grid) return;
        this._updateCount();
        let data = this.books;
        if (this._kelompokFilter !== 'all') data = data.filter(b => (b.kelompok || '') === this._kelompokFilter);
        const q = (this._search || '').trim().toLowerCase();
        if (q) data = data.filter(b => (b.nama || '').toLowerCase().includes(q) || this._kelompokNama(b.kelompok).toLowerCase().includes(q));
        if (!data.length) {
            if (this.books.length && (q || this._kelompokFilter !== 'all')) {
                grid.innerHTML = '<div class="jadwal-empty"><p>Tidak ditemukan</p><small>Coba kata kunci lain atau ganti kelompok</small><div class="ebk-empty-actions"><button type="button" class="ebk-clear-filter" onclick="EbookLib.clearSearch();document.getElementById(\'ebook-kelompok-filter-select\').value=\'all\';EbookLib.filterKelompok(\'all\')">Hapus filter</button></div></div>';
            } else {
                grid.innerHTML = '<div class="jadwal-empty"><p>Belum ada buku</p><small>Buku yang ditambahkan admin akan muncul di sini</small></div>';
            }
            return;
        }
        grid.innerHTML = data.map(b => `
          <div class="ebook-card" style="--ebk-spine:${this._spineColor(b.kelompok)}" onclick="EbookReader.open('${b.kode}')">
            <div class="ebook-poster">${b.poster ? `<img src="${b.poster}" alt="">` : _ebkBookIcon()}</div>
            <div class="ebook-card-body">
              <div class="ebook-card-nama">${_ebkEsc(b.nama)}</div>
              ${this._kelompokNama(b.kelompok) ? `<div class="ebook-card-kelompok">${_ebkEsc(this._kelompokNama(b.kelompok))}</div>` : ''}
              <div class="ebook-card-meta">${_ebkPdfIcon()} ${b.jumlah_halaman ? b.jumlah_halaman + ' lembar' : 'PDF'}</div>
            </div>
          </div>`).join('');
    }
};

// Saat resize/rotasi tablet selesai (event dari js/viewport-stabilize.js), paksa
// halaman ebook yang sedang tampil render ulang di ukuran kontainer yang baru —
// tanpa ini, halaman ebook tetap di ukuran lama & terlihat glitch setelah diputar.
document.addEventListener('vp:settled', function () {
  if (typeof EbookReader !== 'undefined' && EbookReader.doc) {
    [EbookReader.curPage - 1, EbookReader.curPage, EbookReader.curPage + 1].forEach(function (n) {
      EbookReader._renderSwipeSlide(n);
    });
  }
});
const EbookReader = {
    kode: null, doc: null, totalPages: 0, curPage: 1, zoom: 1,
    _renderedSwipe: {}, _protectionBound: false,
    ZOOM_MIN: 0.5, ZOOM_MAX: 3, ZOOM_STEP: 0.25,

    async open(kode) {
        const book = EbookLib.books.find(b => b.kode === kode);
        this.kode = kode; this.curPage = 1; this.doc = null; this.totalPages = 0;
        this._renderedSwipe = {}; this.zoom = 1;
        document.getElementById('ebook-reader-title').textContent = book ? book.nama : 'Buku';
        document.getElementById('ebook-reader-page-ind').textContent = '-/-';
        const progFill = document.getElementById('ebook-reader-progress-fill'); if (progFill) progFill.style.width = '0%';
        this._updateZoomUI();
        const overlay = document.getElementById('ebook-reader-overlay');
        overlay.classList.add('open');
        const loading = document.getElementById('ebook-reader-loading');
        loading.style.display = 'flex'; loading.innerHTML = '<div class="ebk-spinner"></div><div>Memuat buku...</div>';
        const swipeEl = document.getElementById('ebook-reader-swipe');
        swipeEl.style.display = 'none'; document.getElementById('ebook-swipe-track').innerHTML = '';
        this._bindProtection();
        try {
            await loadPdfJs();
            const token = localStorage.getItem('cbn_token');
            const res = await fetch(window.location.origin + '/api/ebook/' + kode + '/file', { headers: { 'Authorization': 'Bearer ' + token } });
            if (!res.ok) throw new Error('Gagal mengambil file buku (' + res.status + ')');
            const buf = await res.arrayBuffer();
            this.doc = await window.pdfjsLib.getDocument({ data: buf }).promise;
            this.totalPages = this.doc.numPages;
            loading.style.display = 'none';
            this._renderSwipeMode();
        } catch (e) {
            loading.innerHTML = '<div>Gagal memuat buku</div><small>' + _ebkEsc(e.message || '') + '</small>';
        }
    },
    close() {
        document.getElementById('ebook-reader-overlay').classList.remove('open');
        if (this.doc) { try { this.doc.destroy(); } catch (e) {} }
        this.doc = null;
        document.getElementById('ebook-swipe-track').innerHTML = '';
        document.getElementById('ebook-reader-body').classList.remove('ebk-blurred');
    },
    _pageIndText() { return this.totalPages ? this.curPage + '/' + this.totalPages : '-/-'; },
    _updateProgress() {
        document.getElementById('ebook-reader-page-ind').textContent = this._pageIndText();
        const fill = document.getElementById('ebook-reader-progress-fill');
        if (fill) fill.style.width = (this.totalPages ? (this.curPage / this.totalPages * 100) : 0) + '%';
    },

    zoomIn() { this._setZoom(this.zoom + this.ZOOM_STEP); },
    zoomOut() { this._setZoom(this.zoom - this.ZOOM_STEP); },
    _setZoom(z) {
        z = Math.max(this.ZOOM_MIN, Math.min(this.ZOOM_MAX, Math.round(z * 100) / 100));
        if (z === this.zoom) return;
        this.zoom = z;
        this._updateZoomUI();
        if (!this.doc) return;
        // Force the visible page(s) to re-render at the new zoom level.
        [this.curPage - 1, this.curPage, this.curPage + 1].forEach(n => this._renderSwipeSlide(n));
    },
    _updateZoomUI() {
        const label = document.getElementById('ebook-zoom-label'); if (label) label.textContent = Math.round(this.zoom * 100) + '%';
        const out = document.getElementById('ebook-zoom-out'); if (out) out.disabled = this.zoom <= this.ZOOM_MIN;
        const inn = document.getElementById('ebook-zoom-in'); if (inn) inn.disabled = this.zoom >= this.ZOOM_MAX;
        const wrap = document.getElementById('ebook-reader-swipe'); if (wrap) wrap.classList.toggle('ebk-zoomed', this.zoom !== 1);
    },

    _renderSwipeMode() {
        const wrap = document.getElementById('ebook-reader-swipe');
        wrap.style.display = 'block';
        const track = document.getElementById('ebook-swipe-track');
        track.innerHTML = '';
        for (let i = 1; i <= this.totalPages; i++) {
            const slide = document.createElement('div');
            slide.className = 'ebook-swipe-page'; slide.dataset.pageNum = i;
            slide.innerHTML = '<div class="ebook-page-placeholder">Halaman ' + i + '</div>';
            track.appendChild(slide);
        }
        this._goToSwipePage(this.curPage || 1, false);
        this._bindSwipeGestures();
    },
    _goToSwipePage(num, animate) {
        num = Math.max(1, Math.min(this.totalPages, num));
        this.curPage = num;
        const track = document.getElementById('ebook-swipe-track');
        if (animate === false) track.style.transition = 'none';
        track.style.transform = `translateX(-${(num - 1) * 100}%)`;
        if (animate === false) { void track.offsetWidth; track.style.transition = ''; }
        this._updateProgress();
        document.getElementById('ebook-swipe-prev').disabled = num <= 1;
        document.getElementById('ebook-swipe-next').disabled = num >= this.totalPages;
        [num - 1, num, num + 1].forEach(n => this._renderSwipeSlide(n));
    },
    async _renderSwipeSlide(num) {
        if (num < 1 || num > this.totalPages) return;
        const host = document.getElementById('ebook-reader-swipe');
        // Kunci cache render mengikutkan ukuran kontainer, bukan cuma zoom — supaya
        // saat tablet diputar (lebar/tinggi kontainer berubah tapi zoom tetap sama)
        // halaman TIDAK dianggap "sudah dirender" dan ikut render ulang di ukuran baru.
        // Ini yang sebelumnya bikin halaman ebook nyangkut di ukuran lama setelah rotasi.
        const renderKey = this.zoom + ':' + (host ? host.clientWidth : 0) + 'x' + (host ? host.clientHeight : 0);
        if (this._renderedSwipe[num] === renderKey) return; // already rendered at this exact zoom+size
        const renderZoom = this.zoom;
        this._renderedSwipe[num] = renderKey;
        const slide = document.querySelector(`#ebook-swipe-track .ebook-swipe-page[data-page-num="${num}"]`);
        if (!slide) return;
        try {
            const page = await this.doc.getPage(num);
            if (this._renderedSwipe[num] !== renderKey) return; // superseded by a newer zoom/size change
            const baseViewport = page.getViewport({ scale: 1 });
            const availW = Math.max((host.clientWidth || 500) - 20, 50);
            const availH = Math.max((host.clientHeight || 700) - 20, 50);
            // Fit-inside scale so the whole page is visible at 100% zoom, then apply the
            // user's zoom level on top of that fitted size.
            const fitScale = Math.max(Math.min(availW / baseViewport.width, availH / baseViewport.height), 0.1);
            const scale = fitScale * renderZoom;
            const targetWidth = Math.round(baseViewport.width * scale);
            const targetHeight = Math.round(baseViewport.height * scale);

            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const viewport = page.getViewport({ scale: scale * dpr });
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(viewport.width);
            canvas.height = Math.round(viewport.height);
            canvas.style.width = targetWidth + 'px';
            canvas.style.height = targetHeight + 'px';
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;
            if (this._renderedSwipe[num] !== renderKey) return; // zoom/size changed again while rendering
            this._drawWatermark(canvas, ctx);
            canvas.draggable = false; canvas.oncontextmenu = () => false;
            const cwrap = document.createElement('div');
            cwrap.className = 'ebook-page-canvas-wrap';
            cwrap.style.width = targetWidth + 'px';
            cwrap.style.height = targetHeight + 'px';
            cwrap.appendChild(canvas);
            slide.innerHTML = ''; slide.appendChild(cwrap);
        } catch (e) { slide.innerHTML = '<div class="ebook-page-placeholder">Gagal memuat</div>'; }
    },
    nextPage() { this._goToSwipePage(this.curPage + 1); },
    prevPage() { this._goToSwipePage(this.curPage - 1); },
    _bindSwipeGestures() {
        const wrap = document.getElementById('ebook-reader-swipe');
        if (wrap._ebkBound) return; wrap._ebkBound = true;
        const track = document.getElementById('ebook-swipe-track');
        let startX = 0, startY = 0, dx = 0, dragging = false, decided = false, isHoriz = false;
        const onStart = (x, y) => { startX = x; startY = y; dx = 0; dragging = true; decided = false; track.style.transition = 'none'; };
        const onMove = (x, y) => {
            if (!dragging) return;
            dx = x - startX; const dy = y - startY;
            if (!decided) { if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; decided = true; isHoriz = Math.abs(dx) > Math.abs(dy); }
            if (!isHoriz) return;
            const base = -(this.curPage - 1) * wrap.clientWidth;
            track.style.transform = `translateX(${base + dx}px)`;
        };
        const onEnd = () => {
            if (!dragging) return; dragging = false; track.style.transition = '';
            if (isHoriz && Math.abs(dx) > wrap.clientWidth * 0.18) { if (dx < 0) this.nextPage(); else this.prevPage(); }
            else this._goToSwipePage(this.curPage);
        };
        // While zoomed in, a drag on the page should pan the zoomed content (native scroll on
        // the slide, which has overflow:auto), not turn the page — so skip the swipe gesture.
        wrap.addEventListener('touchstart', e => { if (this.zoom !== 1) return; onStart(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
        wrap.addEventListener('touchmove', e => { if (this.zoom !== 1) return; onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
        wrap.addEventListener('touchend', () => { if (this.zoom !== 1) return; onEnd(); });
        wrap.addEventListener('mousedown', e => { if (this.zoom !== 1) return; onStart(e.clientX, e.clientY); e.preventDefault(); });
        window.addEventListener('mousemove', e => { if (dragging) onMove(e.clientX, e.clientY); });
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('keydown', (e) => {
            if (!document.getElementById('ebook-reader-overlay').classList.contains('open')) return;
            if (e.key === 'ArrowRight') this.nextPage();
            if (e.key === 'ArrowLeft') this.prevPage();
            if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); this.zoomIn(); }
            if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); this.zoomOut(); }
        });
    },
    _drawWatermark(canvas, ctx) {
        let user = null; try { user = JSON.parse(localStorage.getItem('cbn_user') || 'null'); } catch (e) {}
        const label = ((user && (user.nama || user.email)) || 'CIBN PRESTISE') + '  ·  ' + new Date().toLocaleString('id-ID');
        ctx.save();
        ctx.globalAlpha = 0.08; ctx.fillStyle = '#133259';
        ctx.font = Math.max(12, Math.round(canvas.width / 32)) + 'px sans-serif';
        ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(-Math.PI / 6);
        const stepX = ctx.measureText(label).width + 60, stepY = 90;
        for (let y = -canvas.height; y < canvas.height; y += stepY) {
            for (let x = -canvas.width; x < canvas.width; x += stepX) ctx.fillText(label, x, y);
        }
        ctx.restore();
    },
    _bindProtection() {
        if (this._protectionBound) return; this._protectionBound = true;
        const overlay = document.getElementById('ebook-reader-overlay');
        overlay.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('keydown', (e) => {
            if (!overlay.classList.contains('open')) return;
            const k = (e.key || '').toLowerCase(); const ctrlOrCmd = e.ctrlKey || e.metaKey;
            if ((ctrlOrCmd && ['p', 's', 'c', 'u'].includes(k)) || e.key === 'PrintScreen' || (ctrlOrCmd && e.shiftKey && ['i', 'j', 'c'].includes(k)) || e.key === 'F12') {
                e.preventDefault(); e.stopPropagation();
                if (e.key === 'PrintScreen') this._flashBlur();
            }
        }, true);
        window.addEventListener('blur', () => { if (overlay.classList.contains('open')) document.getElementById('ebook-reader-body').classList.add('ebk-blurred'); });
        window.addEventListener('focus', () => document.getElementById('ebook-reader-body').classList.remove('ebk-blurred'));
        document.addEventListener('visibilitychange', () => {
            if (!overlay.classList.contains('open')) return;
            document.getElementById('ebook-reader-body').classList.toggle('ebk-blurred', document.hidden);
        });
    },
    _flashBlur() {
        const body = document.getElementById('ebook-reader-body');
        body.classList.add('ebk-blurred');
        setTimeout(() => body.classList.remove('ebk-blurred'), 1200);
    }
};