// =============================================
// CUSTOM-SELECT.JS — Citta Bhakti Nirbaya
// Otomatis "upgrade" semua elemen <select> di halaman (termasuk yang
// baru muncul belakangan lewat fetch fragment / diisi ulang lewat JS)
// jadi dropdown dengan list ber-CSS sendiri, bukan bawaan browser.
//
// <select> aslinya TETAP ada di DOM (cuma disembunyikan) supaya semua
// kode lama yang pakai document.getElementById(id).value / .innerHTML /
// .disabled / onchange="..." tetap jalan tanpa perlu diubah sama sekali.
// =============================================
(function () {
    'use strict';

    var _csPanelEl = null;
    var _csOpenSel = null;
    var _csHighlightIdx = -1;
    var _csTypeBuf = '';
    var _csTypeTimer = null;

    var _valueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');

    function _csEnsurePanel() {
        if (_csPanelEl) return _csPanelEl;
        _csPanelEl = document.createElement('div');
        _csPanelEl.className = 'cs-panel';
        _csPanelEl.setAttribute('role', 'listbox');
        document.body.appendChild(_csPanelEl);
        return _csPanelEl;
    }

    function _csSyncLabel(sel) {
        var trig = sel._csTrigger; if (!trig) return;
        var labelEl = trig.querySelector('.cs-trigger-label');
        var opt = sel.options[sel.selectedIndex];
        if (labelEl) {
            if (opt) {
                labelEl.textContent = opt.textContent;
                labelEl.classList.remove('cs-placeholder');
            } else {
                labelEl.textContent = '';
                labelEl.classList.add('cs-placeholder');
            }
        }
        trig.disabled = !!sel.disabled;
        trig.classList.toggle('cs-disabled', !!sel.disabled);
        // Kalau select ini lagi kebuka & isinya berubah (mis. diisi ulang via innerHTML),
        // render ulang panelnya juga biar list-nya ikut update real-time.
        if (_csOpenSel === sel) {
            _csRenderPanel(sel);
            _csHighlightIdx = sel.selectedIndex;
            _csApplyHighlight(sel);
        }
    }

    function _csHookProps(sel) {
        try {
            Object.defineProperty(sel, 'value', {
                configurable: true,
                enumerable: true,
                get: function () { return _valueDesc.get.call(sel); },
                set: function (v) { _valueDesc.set.call(sel, v); _csSyncLabel(sel); }
            });
        } catch (e) { /* browser lama tanpa defineProperty di instance — biarin native */ }
    }

    function _csRenderPanel(sel) {
        var panel = _csEnsurePanel();
        panel.innerHTML = '';
        var opts = sel.options;
        if (!opts.length) {
            var empty = document.createElement('div');
            empty.className = 'cs-empty';
            empty.textContent = 'Tidak ada pilihan';
            panel.appendChild(empty);
            return;
        }
        for (var i = 0; i < opts.length; i++) {
            (function (opt, idx) {
                var item = document.createElement('div');
                item.className = 'cs-item' + (opt.selected ? ' cs-selected' : '') + (opt.disabled ? ' cs-disabled' : '');
                item.setAttribute('role', 'option');
                item.dataset.idx = idx;
                var label = document.createElement('span');
                label.className = 'cs-item-text';
                label.textContent = opt.textContent;
                item.appendChild(label);
                if (opt.selected) {
                    item.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>');
                }
                if (!opt.disabled) {
                    item.addEventListener('mousedown', function (e) { e.preventDefault(); }); // biar gak nge-blur trigger duluan
                    item.addEventListener('click', function () { _csChoose(sel, idx); });
                    item.addEventListener('mouseenter', function () { _csHighlightIdx = idx; _csApplyHighlight(sel); });
                }
                panel.appendChild(item);
            })(opts[i], i);
        }
    }

    function _csApplyHighlight(sel) {
        if (!_csPanelEl) return;
        var items = _csPanelEl.querySelectorAll('.cs-item');
        items.forEach(function (it) {
            var on = Number(it.dataset.idx) === _csHighlightIdx;
            it.classList.toggle('cs-highlight', on);
            if (on) { try { it.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
        });
    }

    function _csChoose(sel, idx) {
        var opt = sel.options[idx];
        if (!opt || opt.disabled) return;
        sel.value = opt.value; // lewat setter yang udah di-hook -> label ikut sinkron
        sel.dispatchEvent(new Event('input', { bubbles: true }));
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        _csClose();
        if (sel._csTrigger) sel._csTrigger.focus();
    }

    function _csOpen(sel, trig) {
        if (sel.disabled) return;
        if (_csOpenSel && _csOpenSel !== sel) _csClose();
        var panel = _csEnsurePanel();
        _csOpenSel = sel;
        _csRenderPanel(sel);
        trig.classList.add('cs-open');
        trig.setAttribute('aria-expanded', 'true');

        panel.style.display = 'block';
        panel.style.visibility = 'hidden';
        panel.classList.add('cs-show');
        var rect = trig.getBoundingClientRect();
        panel.style.minWidth = Math.max(rect.width, 140) + 'px';
        panel.style.left = '0px';
        panel.style.top = '0px';
        var pw = panel.offsetWidth;
        var panelH = Math.min(panel.scrollHeight, 280);
        var top = rect.bottom + 6;
        if (top + panelH > window.innerHeight - 8) top = Math.max(8, rect.top - 6 - panelH);
        var left = rect.left;
        if (left + pw > window.innerWidth - 8) left = Math.max(8, window.innerWidth - pw - 8);
        panel.style.top = top + 'px';
        panel.style.left = left + 'px';
        panel.style.visibility = 'visible';

        _csHighlightIdx = sel.selectedIndex;
        _csApplyHighlight(sel);
    }

    function _csClose() {
        if (!_csOpenSel) return;
        var trig = _csOpenSel._csTrigger;
        if (trig) { trig.classList.remove('cs-open'); trig.setAttribute('aria-expanded', 'false'); }
        if (_csPanelEl) { _csPanelEl.style.display = 'none'; _csPanelEl.classList.remove('cs-show'); }
        _csOpenSel = null;
        _csHighlightIdx = -1;
    }

    function _csFirstEnabled(sel) {
        for (var i = 0; i < sel.options.length; i++) if (!sel.options[i].disabled) return i;
        return -1;
    }
    function _csLastEnabled(sel) {
        for (var i = sel.options.length - 1; i >= 0; i--) if (!sel.options[i].disabled) return i;
        return -1;
    }
    function _csStep(sel, from, dir) {
        var n = sel.options.length; if (!n) return -1;
        var i = from;
        for (var c = 0; c < n; c++) {
            i += dir;
            if (i < 0 || i >= n) return from === -1 ? (dir > 0 ? _csFirstEnabled(sel) : _csLastEnabled(sel)) : from;
            if (!sel.options[i].disabled) return i;
        }
        return from;
    }

    function _csTypeahead(sel, ch) {
        clearTimeout(_csTypeTimer);
        _csTypeBuf += ch.toLowerCase();
        _csTypeTimer = setTimeout(function () { _csTypeBuf = ''; }, 700);
        var opts = sel.options;
        var start = (_csHighlightIdx > -1 ? _csHighlightIdx : sel.selectedIndex) + 1;
        for (var c = 0; c < opts.length; c++) {
            var idx = (start + c) % opts.length;
            var o = opts[idx];
            if (!o.disabled && o.textContent.trim().toLowerCase().indexOf(_csTypeBuf) === 0) {
                _csHighlightIdx = idx;
                _csApplyHighlight(sel);
                return;
            }
        }
    }

    function _csTriggerKeydown(e, sel, trig) {
        var key = e.key;
        if (key === 'Escape') {
            if (_csOpenSel === sel) { e.preventDefault(); _csClose(); }
            return;
        }
        if (key === 'Tab') { _csClose(); return; }
        if (key === 'Enter' || key === ' ') {
            e.preventDefault();
            if (_csOpenSel === sel) { if (_csHighlightIdx > -1) _csChoose(sel, _csHighlightIdx); else _csClose(); }
            else _csOpen(sel, trig);
            return;
        }
        if (key === 'ArrowDown' || key === 'ArrowUp') {
            e.preventDefault();
            if (_csOpenSel !== sel) { _csOpen(sel, trig); return; }
            _csHighlightIdx = _csStep(sel, _csHighlightIdx, key === 'ArrowDown' ? 1 : -1);
            _csApplyHighlight(sel);
            return;
        }
        if (key === 'Home') { if (_csOpenSel === sel) { e.preventDefault(); _csHighlightIdx = _csFirstEnabled(sel); _csApplyHighlight(sel); } return; }
        if (key === 'End') { if (_csOpenSel === sel) { e.preventDefault(); _csHighlightIdx = _csLastEnabled(sel); _csApplyHighlight(sel); } return; }
        if (key.length === 1 && /[a-z0-9]/i.test(key)) {
            if (_csOpenSel !== sel) _csOpen(sel, trig);
            _csTypeahead(sel, key);
        }
    }

    function _csEnhance(sel) {
        if (sel.dataset.csEnhanced || sel.multiple) return;
        sel.dataset.csEnhanced = '1';

        var trig = document.createElement('button');
        trig.type = 'button';
        trig.className = (sel.className ? sel.className + ' ' : '') + 'cs-trigger';
        var styleAttr = sel.getAttribute('style');
        if (styleAttr) trig.setAttribute('style', styleAttr);
        trig.setAttribute('aria-haspopup', 'listbox');
        trig.setAttribute('aria-expanded', 'false');
        trig.innerHTML = '<span class="cs-trigger-label"></span>' +
            '<svg class="cs-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';

        sel.classList.add('cs-native');
        sel.removeAttribute('style');
        sel.parentNode.insertBefore(trig, sel.nextSibling);

        sel._csTrigger = trig;
        trig._csSelect = sel;

        trig.addEventListener('click', function (e) {
            e.stopPropagation();
            if (_csOpenSel === sel) _csClose(); else _csOpen(sel, trig);
        });
        trig.addEventListener('keydown', function (e) { _csTriggerKeydown(e, sel, trig); });

        _csHookProps(sel);
        _csSyncLabel(sel);

        var mo = new MutationObserver(function () { _csSyncLabel(sel); });
        mo.observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    }

    function _csEnhanceAll(root) {
        var list = root.querySelectorAll ? root.querySelectorAll('select') : [];
        for (var i = 0; i < list.length; i++) _csEnhance(list[i]);
    }

    document.addEventListener('click', function (e) {
        if (_csOpenSel && !e.target.closest('.cs-trigger') && !e.target.closest('.cs-panel')) _csClose();
    });
    window.addEventListener('resize', _csClose);
    document.addEventListener('scroll', function (e) {
        if (_csOpenSel && (!e.target.closest || !e.target.closest('.cs-panel'))) _csClose();
    }, true);

    var _bodyObserver = new MutationObserver(function (records) {
        if (_csOpenSel && !document.contains(_csOpenSel)) _csClose();
        for (var r = 0; r < records.length; r++) {
            var added = records[r].addedNodes;
            for (var i = 0; i < added.length; i++) {
                var node = added[i];
                if (node.nodeType !== 1) continue;
                if (node.tagName === 'SELECT') _csEnhance(node);
                else _csEnhanceAll(node);
            }
        }
    });

    function _init() {
        _csEnhanceAll(document);
        _bodyObserver.observe(document.body, { childList: true, subtree: true });
    }

    if (document.body) _init();
    else document.addEventListener('DOMContentLoaded', _init);
})();
