/* ==============================================================
   VIEWPORT-STABILIZE.JS
   Mengatasi "glitch" tampilan saat tablet/HP diputar (portrait <-> landscape)
   atau saat window resize melewati beberapa @media breakpoint sekaligus.

   MASALAH YANG DIPERBAIKI:
   1) Saat lebar layar berubah cepat (rotasi), banyak elemen dgn CSS
      `transition` (padding, transform, dsb.) ikut animasi bersamaan →
      terlihat "loncat"/kedip sesaat sebelum layout settle.
   2) Beberapa komponen (drawer navigasi, offset sidebar, kanvas ebook)
      dihitung SEKALI saat elemen dibuka/di-render, dan tidak pernah
      dihitung ulang saat orientasi berubah → tampilan nyangkut/salah ukuran.

   CARA PAKAI:
   - Cukup include <script src="js/viewport-stabilize.js"></script>
   - Selama resize berlangsung, <html> dapat class `vp-resizing` yang
     mematikan semua transition/animation (lihat CSS terkait).
   - Setelah resize/rotasi selesai (settle ~180ms), event custom
     `vp:settled` di-dispatch ke `document` — halaman lain bisa dengar
     event ini utk recalculate ulang (tutup drawer, render ulang kanvas, dst).
   ============================================================== */
(function () {
  var docEl = document.documentElement;
  var settleTimer = null;
  var SETTLE_DELAY = 180;

  function onResizeTick() {
    docEl.classList.add('vp-resizing');
    clearTimeout(settleTimer);
    settleTimer = setTimeout(function () {
      docEl.classList.remove('vp-resizing');
      document.dispatchEvent(new CustomEvent('vp:settled', {
        detail: { width: window.innerWidth, height: window.innerHeight }
      }));
    }, SETTLE_DELAY);
  }

  window.addEventListener('resize', onResizeTick, { passive: true });
  window.addEventListener('orientationchange', onResizeTick, { passive: true });
})();
