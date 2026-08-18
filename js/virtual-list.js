/* =============================================
   VIRTUAL-LIST.JS — Windowed rendering ala game FPS
   =============================================
   Konsepnya: server/browser cuma me-render baris yang KELIHATAN di layar
   + "buffer" (1 layar lagi disiapkan di atas & di bawah), sisanya diwakili
   1 elemen spacer kosong (biar tinggi scrollbar tetap akurat & posisi
   scroll ga loncat-loncat). Begitu discroll, window-nya geser dan baris
   baru dirender saat itu juga — baris lama yang udah lewat dibuang dari DOM.

   Data TETAP di-fetch penuh dari server seperti biasa (getByRole dsb) —
   yang dihemat cuma jumlah elemen DOM yang dibikin, karena itu yang bikin
   berat kalau datanya ribuan baris.

   PEMAKAIAN (ganti pola lama):
     tb.innerHTML = list.map((item,i)=>rowHtml(item,i)).join('') || emptyHtml;

   jadi:
     VirtualList.render(tb, {
       items: list,
       rowHeight: 52,              // estimasi tinggi 1 baris/kartu (px)
       renderItem: (item,i)=>rowHtml(item,i),
       emptyHtml,                  // opsional, tampil kalau list kosong
       tag: 'tr',                  // 'tr' untuk <tbody>, 'div' untuk card list
       colSpan: 12,                // dipakai kalau tag:'tr' (spacer <td colspan>)
       buffer: 1,                  // kelipatan layar yang disiapkan di atas+bawah
       onRendered: ()=>{ ... }     // opsional, dipanggil tiap window baru dirender
                                   // (dipakai buat SwipeCards.bindSwipeList dsb)
     });

   tb boleh <tbody> ATAU div card-list, sama-sama didukung. Kalau elemen
   scroll-nya bukan `.page` terdekat, pass scrollParent secara eksplisit.
   ============================================= */
const VirtualList = (function () {
  // Satu scroll-listener per elemen scroll (mis. per `.page`), dipakai bareng
  // oleh semua list virtual yang ada di halaman itu — supaya ga numpuk listener
  // tiap kali renderXxxList() dipanggil ulang (search, ganti tab, dst).
  const _scrollGroups = new WeakMap(); // scrollEl -> Set<updateFn>
  let _resizeBound = false;
  const _allUpdateFns = new Set();

  function _registerResizeOnce() {
    if (_resizeBound) return;
    _resizeBound = true;
    let raf = null;
    window.addEventListener('resize', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        _allUpdateFns.forEach((fn) => fn());
      });
    }, { passive: true });
  }

  function _registerScrollGroup(scrollEl, updateFn) {
    let set = _scrollGroups.get(scrollEl);
    if (!set) {
      set = new Set();
      _scrollGroups.set(scrollEl, set);
      let ticking = false;
      scrollEl.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          // Baris yang elemennya udah lepas dari DOM (tab lain, dsb) otomatis
          // dibuang dari grup supaya ga jadi memory leak.
          set.forEach((fn) => {
            if (!fn.__container.isConnected) { set.delete(fn); _allUpdateFns.delete(fn); }
            else fn();
          });
        });
      }, { passive: true });
    }
    set.add(updateFn);
    _allUpdateFns.add(updateFn);
    _registerResizeOnce();
  }

  function _makeSpacer(tag, heightPx, colSpan) {
    if (heightPx <= 0) return '';
    if (tag === 'tr') {
      return `<tr class="vlist-spacer" style="height:${heightPx}px;padding:0;border:0"><td colspan="${colSpan}" style="padding:0;border:0"></td></tr>`;
    }
    return `<div class="vlist-spacer" style="height:${heightPx}px"></div>`;
  }

  function render(container, opts) {
    if (!container) return;
    const state = {
      items: opts.items || [],
      renderItem: opts.renderItem,
      rowHeight: opts.rowHeight || 52,
      emptyHtml: opts.emptyHtml || '',
      tag: opts.tag || 'tr',
      colSpan: opts.colSpan || 12,
      buffer: opts.buffer != null ? opts.buffer : 1,
      onRendered: opts.onRendered || null,
      scrollEl: opts.scrollParent || container.closest('.page') || window
    };
    container.__vlistState = state; // state selalu di-refresh tiap kali render() dipanggil ulang (search/filter/dll)

    let updateFn = container.__vlistUpdate;
    if (!updateFn) {
      updateFn = function () {
        const st = container.__vlistState;
        if (!st) return;
        // Kalau elemen sedang disembunyikan (mis. tabel desktop di-hide pas mobile,
        // atau tab lain lagi aktif), ga usah dihitung — hemat kerja sia-sia.
        if (container.offsetParent === null && st.scrollEl !== window) return;

        const list = st.items;
        if (!list.length) {
          container.innerHTML = st.emptyHtml;
          return;
        }

        const scrollEl = st.scrollEl;
        const viewportH = scrollEl === window ? window.innerHeight : scrollEl.clientHeight;
        const scrollTop = scrollEl === window ? window.scrollY : scrollEl.scrollTop;
        const scrollRectTop = scrollEl === window ? 0 : scrollEl.getBoundingClientRect().top;
        const containerRectTop = container.getBoundingClientRect().top;
        // Posisi elemen container relatif terhadap area scroll (bukan viewport layar).
        const offsetTop = (containerRectTop - scrollRectTop) + scrollTop;

        const rowH = st.rowHeight;
        const relScroll = Math.max(0, scrollTop - offsetTop);
        const visibleCount = Math.ceil(viewportH / rowH) + 1;
        const bufferCount = Math.max(visibleCount * st.buffer, 5);

        const centerIndex = Math.floor(relScroll / rowH);
        const startIndex = Math.max(0, centerIndex - bufferCount);
        const endIndex = Math.min(list.length, centerIndex + visibleCount + bufferCount);

        const topSpacerH = startIndex * rowH;
        const bottomSpacerH = (list.length - endIndex) * rowH;

        let html = _makeSpacer(st.tag, topSpacerH, st.colSpan);
        for (let i = startIndex; i < endIndex; i++) html += st.renderItem(list[i], i);
        html += _makeSpacer(st.tag, bottomSpacerH, st.colSpan);

        container.innerHTML = html;
        if (st.onRendered) st.onRendered(startIndex, endIndex);
      };
      updateFn.__container = container;
      container.__vlistUpdate = updateFn;
      _registerScrollGroup(state.scrollEl, updateFn);
    }
    updateFn(); // render langsung window pertama (ga nunggu event scroll)
  }

  function _lowerBound(sortedArr, target) {
    let lo = 0, hi = sortedArr.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sortedArr[mid] < target) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  // renderGroups — sama seperti render(), tapi buat list yang di-KELOMPOKKAN
  // (mis. token dikelompokkan per hari) di mana tiap grup punya tinggi beda-beda
  // (grup hari sepi cuma 2 token, grup hari ramai bisa 100 token). Windowing-nya
  // dihitung per-GRUP pakai estimasi tinggi tiap grup (bukan per-baris kayak render()),
  // jadi tetap "1 layar disiapkan di depan/belakang" walau isi tiap grup gak seragam.
  function renderGroups(container, opts) {
    if (!container) return;
    const state = {
      items: opts.items || [], // array of group object, urutan sesuai tampilan
      renderItem: opts.renderItem, // (group, idx) => html lengkap 1 grup (header+tabel+swipe-list)
      estimateHeight: opts.estimateHeight || (() => 120), // (group, idx) => estimasi px tinggi grup
      emptyHtml: opts.emptyHtml || '',
      buffer: opts.buffer != null ? opts.buffer : 1,
      onRendered: opts.onRendered || null,
      scrollEl: opts.scrollParent || container.closest('.page') || window
    };
    container.__vlistState = state;

    let updateFn = container.__vlistUpdate;
    if (!updateFn) {
      updateFn = function () {
        const st = container.__vlistState;
        if (!st) return;
        if (container.offsetParent === null && st.scrollEl !== window) return;

        const list = st.items;
        if (!list.length) { container.innerHTML = st.emptyHtml; return; }

        const heights = list.map((it, i) => st.estimateHeight(it, i));
        const prefix = [0];
        for (let i = 0; i < heights.length; i++) prefix.push(prefix[i] + heights[i]);
        const totalHeight = prefix[prefix.length - 1];

        const scrollEl = st.scrollEl;
        const viewportH = scrollEl === window ? window.innerHeight : scrollEl.clientHeight;
        const scrollTop = scrollEl === window ? window.scrollY : scrollEl.scrollTop;
        const scrollRectTop = scrollEl === window ? 0 : scrollEl.getBoundingClientRect().top;
        const containerRectTop = container.getBoundingClientRect().top;
        const offsetTop = (containerRectTop - scrollRectTop) + scrollTop;
        const relScroll = Math.max(0, scrollTop - offsetTop);
        const relEnd = relScroll + viewportH;
        const bufferPx = Math.max(viewportH * st.buffer, 300);

        const lo = Math.max(0, relScroll - bufferPx);
        const hi = relEnd + bufferPx;
        let startIndex = _lowerBound(prefix, lo);
        let endIndex = _lowerBound(prefix, hi);
        startIndex = Math.max(0, Math.min(startIndex, list.length - 1));
        endIndex = Math.max(startIndex + 1, Math.min(endIndex, list.length));

        const topSpacerH = prefix[startIndex];
        const bottomSpacerH = totalHeight - prefix[endIndex];

        let html = topSpacerH > 0 ? `<div class="vlist-spacer" style="height:${topSpacerH}px"></div>` : '';
        for (let i = startIndex; i < endIndex; i++) html += st.renderItem(list[i], i);
        html += bottomSpacerH > 0 ? `<div class="vlist-spacer" style="height:${bottomSpacerH}px"></div>` : '';

        container.innerHTML = html;
        if (st.onRendered) st.onRendered(startIndex, endIndex);
      };
      updateFn.__container = container;
      container.__vlistUpdate = updateFn;
      _registerScrollGroup(state.scrollEl, updateFn);
    }
    updateFn();
  }

  return { render, renderGroups };
})();
