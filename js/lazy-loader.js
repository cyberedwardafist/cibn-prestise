// js/lazy-loader.js
// ─────────────────────────────────────────────────────────────────────────
// Utility generik untuk lazy-load fragmen HTML + JS per "view"/"page" dari
// server, dipakai bersama oleh semua modul (ujian, admin, review, user).
// Setiap view di-fetch HANYA saat pertama kali dibutuhkan, lalu di-cache di
// memori (tidak fetch ulang) supaya pindah-pindah tab/state selanjutnya
// instan tanpa request tambahan.
//
// Cara pakai:
//   await LazyLoader.load('/ujian', 'hasil', document.getElementById('hasil-page'));
//   // -> fetch /ujian/hasil.html, taruh ke innerHTML container,
//   //    lalu fetch+eksekusi /ujian/hasil.js (sekali saja).
//
// Kalau containerEl tidak diisi (null), hanya JS-nya saja yang dimuat
// (dipakai kalau sebuah view cuma perlu tambahan fungsi tanpa fragmen HTML).
// ─────────────────────────────────────────────────────────────────────────
const LazyLoader = (function () {
  const loadedKeys = new Set();
  const inFlight = {};

  function fetchText(url) {
    return fetch(url, { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error('Gagal memuat fragmen: ' + url + ' (HTTP ' + r.status + ')');
      return r.text();
    });
  }

  function injectScript(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.dataset.lazyModule = url;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Gagal memuat script: ' + url));
      document.body.appendChild(s);
    });
  }

  /**
   * @param {string} basePath - contoh '/ujian', '/admin'
   * @param {string} name - nama view, contoh 'hasil', 'home'
   * @param {HTMLElement|null} containerEl - elemen tujuan innerHTML fragmen HTML (opsional)
   * @param {{ html?: boolean, js?: boolean }} opts - default keduanya true
   */
  function load(basePath, name, containerEl, opts) {
    opts = opts || {};
    const wantHtml = opts.html !== false && !!containerEl;
    const wantJs = opts.js !== false;
    const key = basePath + '/' + name;

    if (loadedKeys.has(key)) return Promise.resolve(true);
    if (inFlight[key]) return inFlight[key];

    inFlight[key] = (async () => {
      if (wantHtml) {
        const html = await fetchText(basePath + '/' + name + '.html');
        containerEl.innerHTML = html;
      }
      if (wantJs) {
        await injectScript(basePath + '/' + name + '.js');
      }
      loadedKeys.add(key);
      delete inFlight[key];
      return true;
    })();

    return inFlight[key];
  }

  function isLoaded(basePath, name) {
    return loadedKeys.has(basePath + '/' + name);
  }

  return { load, isLoaded };
})();
