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
      try {
        if (wantHtml) {
          const html = await fetchText(basePath + '/' + name + '.html');
          containerEl.innerHTML = html;
        }
        if (wantJs) {
          await injectScript(basePath + '/' + name + '.js');
        }
        loadedKeys.add(key);
        return true;
      } finally {
        // Selalu bersihkan penanda "sedang dimuat" baik sukses maupun gagal,
        // supaya kalau gagal (mis. jaringan putus) user bisa retry (pindah tab
        // lagi) tanpa halaman ini permanen macet dalam status "loading".
        delete inFlight[key];
      }
    })();

    return inFlight[key];
  }

  function isLoaded(basePath, name) {
    return loadedKeys.has(basePath + '/' + name);
  }

  // ── loadMany: untuk kasus 1 halaman butuh beberapa asset sekaligus, atau
  // beberapa halaman berbagi 1 file JS yang sama (mis. 3 tab e-book pakai
  // js/ebook.js yang sama, tapi masing-masing punya fragmen HTML sendiri). ──
  // assets: array of { url, container?, append? } — kalau container diisi ->
  // fragmen HTML: default innerHTML (ganti isi container), atau kalau
  // append:true -> insertAdjacentHTML beforeend (tambah ke container tanpa
  // menghapus isi sebelumnya — dipakai buat slot modal bersama yang diisi oleh
  // beberapa tab berbeda). Tanpa container -> dianggap file <script> biasa.
  // Setiap url hanya benar-benar di-fetch sekali walau dipanggil berkali-kali
  // dari halaman berbeda atau navigasi bolak-balik (di-cache per URL).
  function loadMany(assets) {
    return Promise.all(assets.map((a) => {
      const key = 'url::' + a.url;
      if (loadedKeys.has(key)) return Promise.resolve();
      if (inFlight[key]) return inFlight[key];
      inFlight[key] = (async () => {
        try {
          if (a.container) {
            const html = await fetchText(a.url);
            if (a.append) a.container.insertAdjacentHTML('beforeend', html);
            else a.container.innerHTML = html;
          } else {
            await injectScript(a.url);
          }
          loadedKeys.add(key);
        } finally {
          delete inFlight[key];
        }
      })();
      return inFlight[key];
    }));
  }

  return { load, isLoaded, loadMany };
})();
