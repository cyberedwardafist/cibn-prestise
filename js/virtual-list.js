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
  //
  // KOREKSI TINGGI (measure & correct): estimateHeight cuma tebakan kasar
  // (mis. "60 + jumlahItem*56"). Tinggi ASLI di layar bisa jauh beda karena teks
  // yang wrap 2 baris, dst — kalau dibiarkan cuma pakai tebakan, spacer kosong
  // yang mewakili grup-grup yang belum pernah dirender jadi salah ukuran, dan
  // pas discroll lewat situ tampilannya jadi ada jarak kosong jauh (isi seakan
  // hilang). Makanya di sini, tiap grup yang BENAR-BENAR dirender ke DOM, tinggi
  // aslinya diukur lalu disimpan ke cache per key-grup (nempel di elemen
  // container, jadi tahan lintas render() ulang selama key grupnya sama). Cache
  // ini dipakai gantiin tebakan begitu sebuah grup pernah kelihatan. Kalau hasil
  // ukur ternyata beda jauh dari tebakan yang baru dipakai menghitung spacer,
  // langsung render ulang SEKALI lagi seketika (bukan nunggu scroll berikutnya)
  // supaya jarak kosongnya lenyap instan.
  function renderGroups(container, opts) {
    if (!container) return;
    const state = {
      items: opts.items || [], // array of group object, urutan sesuai tampilan
      renderItem: opts.renderItem, // (group, idx) => html lengkap 1 grup (header+tabel+swipe-list)
      estimateHeight: opts.estimateHeight || (() => 120), // (group, idx) => estimasi px tinggi grup (dipakai sebelum grup pernah diukur)
      emptyHtml: opts.emptyHtml || '',
      buffer: opts.buffer != null ? opts.buffer : 1,
      onRendered: opts.onRendered || null,
      scrollEl: opts.scrollParent || container.closest('.page') || window
    };
    container.__vlistState = state;

    // key grup -> {h: tinggi asli px hasil ukur, n: jumlah item saat diukur}.
    // Disimpan per-container (bukan per-state) supaya bertahan lintas
    // render()/renderGroups() ulang (search/filter/refresh data).
    if (!container.__vgHeightCache) container.__vgHeightCache = new Map();
    const heightCache = container.__vgHeightCache;

    function groupKey(g, i) { return (g && g.key != null) ? String(g.key) : ('idx:' + i); }
    function groupCount(g) { return (g && g.items && g.items.length) || 0; }
    function heightOf(g, i) {
      const cached = heightCache.get(groupKey(g, i));
      // Cache cuma valid kalau jumlah item grupnya sama seperti saat diukur —
      // kalau berubah (token/soal baru ditambah/dihapus), pakai tebakan dulu
      // sampai grup itu kerender & keukur ulang.
      if (cached && cached.n === groupCount(g)) return cached.h;
      return state.estimateHeight(g, i);
    }

    // UKUR-DULUAN (pre-measure): estimateHeight cuma tebakan kasar, dan kalau
    // tebakannya jauh meleset, spacer yang dihitung dari tebakan itu bikin
    // "gap" kosong gede pas discroll (isi keliatan hilang sebentar) sebelum
    // akhirnya dikoreksi. Daripada nunggu tiap grup kerender-lewat-scroll dulu
    // baru keukur satu-satu, di sini SEMUA grup yang belum (atau sudah gak
    // valid) ada di cache langsung dirender sekali ke elemen "probe" yang
    // disembunyikan di luar layar (visibility:hidden, bukan display:none —
    // biar tetap ke-layout & bisa diukur), diukur tinggi aslinya, baru
    // dibuang dari DOM. Jadi total tinggi (dan posisi tiap grup) udah akurat
    // SEBELUM windowing pertama dihitung — ga ada lagi gap dari tebakan yang
    // meleset. Grup yang sudah pernah keukur & jumlah itemnya belum berubah
    // di-skip (biar tetap murah dipanggil ulang tiap search/filter).
    function _premeasureMissing(list) {
      const probeWidth = container.clientWidth || container.getBoundingClientRect().width || 800;
      // Kalau lebar container berubah (resize, rotate, zoom, sidebar buka/tutup),
      // tinggi yang udah ke-cache di lebar LAMA bisa salah (teks yang tadinya
      // muat 1 baris jadi wrap 2 baris, dst) — cache-nya cuma dikunci dari
      // jumlah item, bukan lebar, jadi kalau dibiarkan gap yang sama bisa
      // muncul lagi abis resize. Makanya kalau lebar berubah, buang semua
      // cache sekali biar semua grup keukur ulang dari nol di lebar baru.
      if (container.__vgCacheWidth !== probeWidth) {
        heightCache.clear();
        container.__vgCacheWidth = probeWidth;
      }

      const missing = [];
      list.forEach((g, i) => {
        const key = groupKey(g, i);
        const cached = heightCache.get(key);
        if (!cached || cached.n !== groupCount(g)) missing.push({ g, i, key });
      });
      if (!missing.length) return false;

      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;top:0;left:-99999px;visibility:hidden;pointer-events:none;width:' + probeWidth + 'px;';
      let html = '';
      missing.forEach(({ g, i, key }) => {
        html += `<div class="vlist-gmark" data-vg-key="${key}">${state.renderItem(g, i)}</div>`;
      });
      probe.innerHTML = html;
      document.body.appendChild(probe);
      probe.querySelectorAll(':scope > .vlist-gmark').forEach((el) => {
        const key = el.dataset.vgKey;
        const found = missing.find((m) => m.key === key);
        heightCache.set(key, { h: el.offsetHeight, n: groupCount(found.g) });
      });
      document.body.removeChild(probe);
      return true;
    }

    let updateFn = container.__vlistUpdate;
    if (!updateFn) {
      updateFn = function (skipReflow) {
        const st = container.__vlistState;
        if (!st) return;
        if (container.offsetParent === null && st.scrollEl !== window) return;

        const list = st.items;
        if (!list.length) { container.innerHTML = st.emptyHtml; return; }

        _premeasureMissing(list);

        const heights = list.map((it, i) => heightOf(it, i));
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
        for (let i = startIndex; i < endIndex; i++) {
          const g = list[i];
          html += `<div class="vlist-gmark" data-vg-key="${groupKey(g, i)}" data-vg-n="${groupCount(g)}">${st.renderItem(g, i)}</div>`;
        }
        html += bottomSpacerH > 0 ? `<div class="vlist-spacer" style="height:${bottomSpacerH}px"></div>` : '';

        container.innerHTML = html;

        // Ukur tinggi asli grup yang baru dirender & update cache.
        let changed = false;
        container.querySelectorAll(':scope > .vlist-gmark').forEach((el) => {
          const key = el.dataset.vgKey;
          const n = parseInt(el.dataset.vgN, 10) || 0;
          const measured = el.offsetHeight;
          const prev = heightCache.get(key);
          if (!prev || prev.n !== n || Math.abs(prev.h - measured) > 1) {
            heightCache.set(key, { h: measured, n });
            changed = true;
          }
        });

        if (st.onRendered) st.onRendered(startIndex, endIndex);

        // Kalau tebakan yang dipakai barusan ternyata meleset, langsung render
        // ulang sekali (pakai angka yang udah keukur) biar spacer-nya lurus
        // seketika. Di-guard skipReflow supaya cuma 1x re-render korektif per
        // update (ga infinite loop).
        if (changed && !skipReflow) updateFn(true);
      };
      updateFn.__container = container;
      container.__vlistUpdate = updateFn;
      _registerScrollGroup(state.scrollEl, updateFn);
    }
    updateFn();
  }

  return { render, renderGroups };
})();
