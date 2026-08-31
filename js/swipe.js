/* swipe.js — engine kartu swipe-to-reveal untuk daftar "Aksi" di mobile.
   Geser kartu ke KIRI -> aksi di sisi kanan (mis. Edit) kebuka.
   Geser kartu ke KANAN -> aksi di sisi kiri (mis. Hapus) kebuka.
   Kalau satu sisi punya >1 aksi, semua aksi di sisi itu nongol berdampingan
   supaya user tinggal pilih. Aksi baru benar-benar jalan saat ikonnya DITAP
   (bukan otomatis saat swipe selesai) — jadi tetap aman dari kegeser tanpa sengaja.
   Kartu tanpa aksi sama sekali langsung bisa ditap di mana saja (mode "tappable").

   MODE PILIH MASSAL (mis. Manajemen Akun) — ala galeri foto:
   tahan lama 1 kartu -> masuk mode pilih (kartu dapet border biru), abis itu
   tinggal TAP kartu lain buat ikut milih/batal milih. Swipe drag dimatikan
   sementara selama mode pilih aktif biar gak ketimpang aksi Edit/Hapus. */
(function (global) {
    let _openCard = null; // { bodyEl, close }

    function closeOpenCard() {
        if (_openCard) { _openCard.close(); _openCard = null; }
    }

    function iconSvg(name) {
        const icons = {
            edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
            trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>',
            check: '<polyline points="20 6 9 17 4 12"/>',
            cross: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
            qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
            eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
            doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
            copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
            download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
            refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>'
        };
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icons[name] || icons.edit}</svg>`;
    }

    /**
     * Bangun satu kartu swipe.
     * @param {Object} opt
     *   title, sub: teks utama & sub kartu
     *   sideHtml: HTML kecil di ujung kanan kartu (badge/skor/dll), opsional
     *   kode: identifier kartu ini, dipakai untuk mode pilih massal (long-press)
     *   selected: true kalau kartu ini sedang terpilih (kasih border biru)
     *   leftActions: array aksi yang nongol saat digeser ke KIRI (muncul dari kanan)
     *   rightActions: array aksi yang nongol saat digeser ke KANAN (muncul dari kiri)
     *     tiap aksi: { icon:'edit', label:'Edit', cls:'act-edit', onClick:'jsFnCall(...)' }
     *   onTapAttr: string onclick langsung kalau kartu tidak punya aksi sama sekali (mode tap-langsung)
     */
    function buildSwipeCardHtml(opt) {
        const { title, sub, sideHtml = '', leftActions = [], rightActions = [], onTapAttr = '', kode = '', selected = false } = opt;
        const hasActions = leftActions.length || rightActions.length;
        const actionBtn = (a) => `<button type="button" class="swipe-card-action ${a.cls || ''}" onclick="event.stopPropagation();${a.onClick}"><span>${iconSvg(a.icon)}</span>${a.label}</button>`;
        const leftHtml = leftActions.length ? `<div class="swipe-card-actions sw-left">${leftActions.map(actionBtn).join('')}</div>` : '';
        const rightHtml = rightActions.length ? `<div class="swipe-card-actions sw-right">${rightActions.map(actionBtn).join('')}</div>` : '';
        return `<div class="swipe-card" data-kode="${kode}" data-left-w="${leftActions.length * 64}" data-right-w="${rightActions.length * 64}">
            ${leftHtml}${rightHtml}
            <div class="swipe-card-body${hasActions ? '' : ' tappable'}${selected ? ' selected' : ''}" ${hasActions ? '' : onTapAttr}>
                <div class="swipe-card-main"><div class="swipe-card-title">${title}</div><div class="swipe-card-sub">${sub}</div></div>
                <div class="swipe-card-side">${sideHtml}${hasActions ? '<span class="swipe-card-hint"></span>' : ''}</div>
            </div>
        </div>`;
    }

    /**
     * Pasang gesture swipe ke semua .swipe-card di dalam containerEl. Panggil setelah innerHTML diisi.
     * @param {Object} opts (opsional) — buat aktifin mode pilih massal ala galeri foto:
     *   selectable: true -> aktifkan long-press-to-select di list ini
     *   isSelectMode: () => bool — lagi dalam mode pilih atau belum
     *   onLongPress: (kode, cardEl) => void — dipanggil saat 1 kartu ditahan lama (masuk mode pilih)
     *   onTapSelect: (kode, cardEl) => void — dipanggil saat kartu ditap selagi mode pilih aktif
     */
    function bindSwipeList(containerEl, opts = {}) {
        if (!containerEl) return;
        const { selectable = false, isSelectMode = () => false, onLongPress = null, onTapSelect = null } = opts;
        const LONG_PRESS_MS = 480;
        containerEl.querySelectorAll('.swipe-card').forEach((card) => {
            const body = card.querySelector('.swipe-card-body');
            const kode = card.dataset.kode || '';
            const leftW = parseFloat(card.dataset.leftW) || 0;
            const rightW = parseFloat(card.dataset.rightW) || 0;
            if (!leftW && !rightW && !selectable) return; // kartu tap-langsung, tidak perlu drag/select
            let startX = 0, startY = 0, curDx = 0, dragging = false, axisLocked = null, openState = 0;
            let longPressTimer = null, longPressFired = false, moved = false;

            function setX(px, animate) {
                body.style.transition = animate ? 'transform .22s cubic-bezier(.4,0,.2,1)' : 'none';
                body.style.transform = `translateX(${px}px)`;
            }
            function close(animate = true) { setX(0, animate); openState = 0; }
            function openLeft(animate = true) { setX(-leftW, animate); openState = -1; }
            function openRight(animate = true) { setX(rightW, animate); openState = 1; }
            function openThis(dir, animate) {
                if (_openCard && _openCard.close !== close) closeOpenCard();
                if (dir === 'left') openLeft(animate); else openRight(animate);
                _openCard = { close };
            }
            function clearLongPress() { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } }

            function start(x, y) {
                startX = x; startY = y; curDx = 0; dragging = true; axisLocked = null; moved = false; longPressFired = false;
                body.style.transition = 'none';
                if (selectable && !isSelectMode()) {
                    clearLongPress();
                    longPressTimer = setTimeout(() => {
                        if (!moved) { longPressFired = true; if (onLongPress) onLongPress(kode, card); }
                    }, LONG_PRESS_MS);
                }
            }
            function move(x, y) {
                if (!dragging) return;
                const dx = x - startX, dy = y - startY;
                if (!moved && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) { moved = true; clearLongPress(); }
                if (selectable && isSelectMode()) return; // mode pilih aktif -> drag/swipe dimatikan
                if (axisLocked === null) {
                    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) axisLocked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
                }
                if (axisLocked !== 'x') return;
                curDx = dx;
                const base = openState === -1 ? -leftW : openState === 1 ? rightW : 0;
                let nx = base + dx;
                nx = Math.max(-leftW, Math.min(rightW, nx));
                setX(nx, false);
            }
            function end() {
                clearLongPress();
                if (!dragging) return; dragging = false;
                if (longPressFired) { axisLocked = null; return; } // udah ditangani onLongPress, jangan diapa2in lagi
                if (selectable && isSelectMode()) { axisLocked = null; return; } // tap-select ditangani di listener 'click'
                if (axisLocked !== 'x') { axisLocked = null; return; }
                const threshold = 34;
                if (curDx < -threshold && leftW) openThis('left');
                else if (curDx > threshold && rightW) openThis('right');
                else close();
                axisLocked = null;
            }

            body.addEventListener('touchstart', (e) => start(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
            body.addEventListener('touchmove', (e) => move(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
            body.addEventListener('touchend', end);

            body.addEventListener('click', (e) => {
                if (longPressFired) { longPressFired = false; e.stopPropagation(); return; } // buang "ghost click" abis long-press
                if (selectable && isSelectMode()) { e.stopPropagation(); if (onTapSelect) onTapSelect(kode, card); return; }
                // Tap di kartu yang lagi kebuka -> tutup lagi (bukan trigger aksi)
                if (openState !== 0) { e.stopPropagation(); close(); _openCard = null; }
            });
        });
    }

    // Tap di luar kartu manapun -> tutup kartu yang lagi kebuka
    document.addEventListener('touchstart', (e) => {
        if (_openCard && !e.target.closest('.swipe-card')) closeOpenCard();
    }, { passive: true });

    global.SwipeCards = { buildSwipeCardHtml, bindSwipeList };
})(window);