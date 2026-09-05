/* =============================================
   EDITOR.JS - Rich Text Editor (Pure JS)
   Word-like editor: bold, italic, underline,
   font, size, color, align, list, image upload
   ============================================= */

class RichEditor {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.getElementById(container) : container;
        this.options = {
            placeholder: options.placeholder || 'Tulis di sini...',
            onchange: options.onchange || null,
            minHeight: options.minHeight || 120,
            uploadFn: options.uploadFn || null,
        };
        this._build();
    }

    _build() {
        this.container.innerHTML = '';
        this.container.className = 'rich-editor-wrap';

        // Toolbar
        this.toolbar = document.createElement('div');
        this.toolbar.className = 'rich-toolbar';
        this.toolbar.innerHTML = this._toolbarHTML();
        this.container.appendChild(this.toolbar);

        // Editable area
        this.editor = document.createElement('div');
        this.editor.className = 'rich-content';
        this.editor.contentEditable = true;
        this.editor.style.minHeight = this.options.minHeight + 'px';
        this.editor.setAttribute('data-placeholder', this.options.placeholder);
        this.container.appendChild(this.editor);

        this._bindEvents();
        this._bindToolbar();
    }

    _toolbarHTML() {
        return `
        <div class="rich-toolbar-row">
            <!-- Font family -->
            <select class="rtb-select" data-cmd="fontName" title="Font">
                <option value="DM Sans">DM Sans</option>
                <option value="Arial">Arial</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
                <option value="Georgia">Georgia</option>
                <option value="Verdana">Verdana</option>
            </select>
            <!-- Font size -->
            <select class="rtb-select rtb-select-sm" data-cmd="fontSize" title="Ukuran">
                <option value="1">8</option>
                <option value="2">10</option>
                <option value="3" selected>12</option>
                <option value="4">14</option>
                <option value="5">18</option>
                <option value="6">24</option>
                <option value="7">36</option>
            </select>
            <div class="rtb-sep"></div>
            <!-- Text style -->
            <button class="rtb-btn" data-cmd="bold" title="Bold (Ctrl+B)"><b>B</b></button>
            <button class="rtb-btn" data-cmd="italic" title="Italic (Ctrl+I)"><i>I</i></button>
            <button class="rtb-btn" data-cmd="underline" title="Underline (Ctrl+U)"><u>U</u></button>
            <button class="rtb-btn" data-cmd="strikeThrough" title="Coret"><s>S</s></button>
            <div class="rtb-sep"></div>
            <!-- Color -->
            <label class="rtb-btn rtb-color-wrap" title="Warna Teks">
                <span style="font-weight:700;font-size:13px;border-bottom:3px solid #e53e3e;line-height:1.2">A</span>
                <input type="color" class="rtb-color-input" data-cmd="foreColor" value="#133259">
            </label>
            <label class="rtb-btn rtb-color-wrap" title="Sorot Teks">
                <span style="font-weight:700;font-size:11px;background:#ffd600;padding:0 2px">HL</span>
                <input type="color" class="rtb-color-input" data-cmd="backColor" value="#ffd600">
            </label>
            <div class="rtb-sep"></div>
            <!-- Align -->
            <button class="rtb-btn" data-cmd="justifyLeft" title="Rata Kiri">
                <svg viewBox="0 0 16 16" width="14" height="14"><line x1="1" y1="3" x2="15" y2="3" stroke="currentColor" stroke-width="1.5"/><line x1="1" y1="7" x2="10" y2="7" stroke="currentColor" stroke-width="1.5"/><line x1="1" y1="11" x2="15" y2="11" stroke="currentColor" stroke-width="1.5"/><line x1="1" y1="15" x2="8" y2="15" stroke="currentColor" stroke-width="1.5"/></svg>
            </button>
            <button class="rtb-btn" data-cmd="justifyCenter" title="Tengah">
                <svg viewBox="0 0 16 16" width="14" height="14"><line x1="1" y1="3" x2="15" y2="3" stroke="currentColor" stroke-width="1.5"/><line x1="4" y1="7" x2="12" y2="7" stroke="currentColor" stroke-width="1.5"/><line x1="1" y1="11" x2="15" y2="11" stroke="currentColor" stroke-width="1.5"/><line x1="4" y1="15" x2="12" y2="15" stroke="currentColor" stroke-width="1.5"/></svg>
            </button>
            <button class="rtb-btn" data-cmd="justifyRight" title="Rata Kanan">
                <svg viewBox="0 0 16 16" width="14" height="14"><line x1="1" y1="3" x2="15" y2="3" stroke="currentColor" stroke-width="1.5"/><line x1="6" y1="7" x2="15" y2="7" stroke="currentColor" stroke-width="1.5"/><line x1="1" y1="11" x2="15" y2="11" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="15" x2="15" y2="15" stroke="currentColor" stroke-width="1.5"/></svg>
            </button>
            <button class="rtb-btn" data-cmd="justifyFull" title="Rata Kiri-Kanan">
                <svg viewBox="0 0 16 16" width="14" height="14"><line x1="1" y1="3" x2="15" y2="3" stroke="currentColor" stroke-width="1.5"/><line x1="1" y1="7" x2="15" y2="7" stroke="currentColor" stroke-width="1.5"/><line x1="1" y1="11" x2="15" y2="11" stroke="currentColor" stroke-width="1.5"/><line x1="1" y1="15" x2="15" y2="15" stroke="currentColor" stroke-width="1.5"/></svg>
            </button>
            <div class="rtb-sep"></div>
            <!-- Lists -->
            <button class="rtb-btn" data-cmd="insertUnorderedList" title="Bullet List">
                <svg viewBox="0 0 16 16" width="14" height="14"><circle cx="2" cy="4" r="1.2" fill="currentColor"/><line x1="5" y1="4" x2="15" y2="4" stroke="currentColor" stroke-width="1.5"/><circle cx="2" cy="9" r="1.2" fill="currentColor"/><line x1="5" y1="9" x2="15" y2="9" stroke="currentColor" stroke-width="1.5"/><circle cx="2" cy="14" r="1.2" fill="currentColor"/><line x1="5" y1="14" x2="15" y2="14" stroke="currentColor" stroke-width="1.5"/></svg>
            </button>
            <button class="rtb-btn" data-cmd="insertOrderedList" title="Numbered List">
                <svg viewBox="0 0 16 16" width="14" height="14"><text x="0" y="5" font-size="5" fill="currentColor">1.</text><line x1="5" y1="4" x2="15" y2="4" stroke="currentColor" stroke-width="1.5"/><text x="0" y="10" font-size="5" fill="currentColor">2.</text><line x1="5" y1="9" x2="15" y2="9" stroke="currentColor" stroke-width="1.5"/><text x="0" y="15" font-size="5" fill="currentColor">3.</text><line x1="5" y1="14" x2="15" y2="14" stroke="currentColor" stroke-width="1.5"/></svg>
            </button>
            <div class="rtb-sep"></div>
            <!-- Indent -->
            <button class="rtb-btn" data-cmd="indent" title="Indent">
                <svg viewBox="0 0 16 16" width="14" height="14"><line x1="1" y1="3" x2="15" y2="3" stroke="currentColor" stroke-width="1.5"/><polyline points="4,7 8,9.5 4,12" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="9" y1="7" x2="15" y2="7" stroke="currentColor" stroke-width="1.5"/><line x1="9" y1="12" x2="15" y2="12" stroke="currentColor" stroke-width="1.5"/><line x1="1" y1="15" x2="15" y2="15" stroke="currentColor" stroke-width="1.5"/></svg>
            </button>
            <button class="rtb-btn" data-cmd="outdent" title="Outdent">
                <svg viewBox="0 0 16 16" width="14" height="14"><line x1="1" y1="3" x2="15" y2="3" stroke="currentColor" stroke-width="1.5"/><polyline points="8,7 4,9.5 8,12" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="9" y1="7" x2="15" y2="7" stroke="currentColor" stroke-width="1.5"/><line x1="9" y1="12" x2="15" y2="12" stroke="currentColor" stroke-width="1.5"/><line x1="1" y1="15" x2="15" y2="15" stroke="currentColor" stroke-width="1.5"/></svg>
            </button>
            <div class="rtb-sep"></div>
            <!-- Superscript / Subscript -->
            <button class="rtb-btn" data-cmd="superscript" title="Superscript" style="font-size:11px">X<sup>2</sup></button>
            <button class="rtb-btn" data-cmd="subscript" title="Subscript" style="font-size:11px">X<sub>2</sub></button>
            <div class="rtb-sep"></div>
            <!-- Link -->
            <button class="rtb-btn rtb-link-btn" title="Insert Link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            </button>
            <!-- Image -->
            <label class="rtb-btn rtb-img-label" title="Upload Gambar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <input type="file" class="rtb-img-input" accept="image/*" style="display:none">
            </label>
            <!-- Image from URL -->
            <button class="rtb-btn rtb-imgurl-btn" title="Gambar dari URL">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </button>
            <div class="rtb-sep"></div>
            <!-- Table -->
            <div class="rtb-table-wrap">
                <button class="rtb-btn rtb-table-btn" title="Sisipkan Tabel">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                </button>
                <div class="rtb-table-grid-pop"></div>
            </div>
            <!-- Math equation -->
            <button class="rtb-btn rtb-math-btn" title="Sisipkan Rumus Matematika (pecahan, akar, pangkat, dll)" style="font-weight:700;font-size:12px;font-style:italic">√x</button>
            <div class="rtb-sep"></div>
            <!-- Undo / Redo -->
            <button class="rtb-btn" data-cmd="undo" title="Undo (Ctrl+Z)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.65"/></svg>
            </button>
            <button class="rtb-btn" data-cmd="redo" title="Redo (Ctrl+Y)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-4.65"/></svg>
            </button>
            <div class="rtb-sep"></div>
            <!-- Remove format -->
            <button class="rtb-btn" data-cmd="removeFormat" title="Hapus Format">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M6 6l12 12M6 18l5-5"/><path d="M19 6l-7.5 7.5"/></svg>
            </button>
        </div>
        <!-- Image resize controls (hidden until image selected) -->
        <div class="rtb-img-controls" style="display:none">
            <span style="font-size:11px;color:var(--text-sub)">Gambar dipilih:</span>
            <label style="font-size:11px;color:var(--text-sub)">L:
                <input type="number" class="rtb-dim-w" style="width:60px" placeholder="px/%">
            </label>
            <label style="font-size:11px;color:var(--text-sub)">T:
                <input type="number" class="rtb-dim-h" style="width:60px" placeholder="auto">
            </label>
            <select class="rtb-select rtb-select-sm rtb-img-align">
                <option value="">Posisi</option>
                <option value="left">Float Kiri</option>
                <option value="right">Float Kanan</option>
                <option value="center">Tengah</option>
                <option value="none">Normal</option>
            </select>
            <button class="rtb-btn rtb-img-apply" style="font-size:11px;padding:3px 8px">Terapkan</button>
            <button class="rtb-btn rtb-img-remove" style="font-size:11px;padding:3px 8px;color:var(--danger)">Hapus</button>
        </div>
        <!-- Table cell controls (hidden until cursor is inside a table) -->
        <div class="rtb-tbl-controls" style="display:none">
            <span style="font-size:11px;color:var(--text-sub)">Tabel:</span>
            <button class="rtb-btn rtb-tbl-row-add" style="font-size:11px;padding:3px 8px">+ Baris</button>
            <button class="rtb-btn rtb-tbl-col-add" style="font-size:11px;padding:3px 8px">+ Kolom</button>
            <button class="rtb-btn rtb-tbl-row-del" style="font-size:11px;padding:3px 8px;color:var(--danger)">− Baris</button>
            <button class="rtb-btn rtb-tbl-col-del" style="font-size:11px;padding:3px 8px;color:var(--danger)">− Kolom</button>
            <button class="rtb-btn rtb-tbl-del" style="font-size:11px;padding:3px 8px;color:var(--danger)">Hapus Tabel</button>
        </div>
        `;
    }

    _bindEvents() {
        // Placeholder behavior
        this.editor.addEventListener('focus', () => this.editor.classList.add('focused'));
        this.editor.addEventListener('blur', () => this.editor.classList.remove('focused'));

        // On input
        this.editor.addEventListener('input', () => {
            if (this.options.onchange) this.options.onchange(this.getHTML());
        });

        // Keyboard shortcuts
        this.editor.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key.toLowerCase()) {
                    case 'b': e.preventDefault(); document.execCommand('bold'); break;
                    case 'i': e.preventDefault(); document.execCommand('italic'); break;
                    case 'u': e.preventDefault(); document.execCommand('underline'); break;
                }
            }
        });

        // Tab key → indent
        this.editor.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                document.execCommand('insertText', false, '\u00a0\u00a0\u00a0\u00a0');
            }
        });

        // Image selection → show controls
        this.editor.addEventListener('click', (e) => {
            if (e.target.tagName === 'IMG') {
                this._selectImg(e.target);
            } else {
                this._deselectImg();
            }
        });

        // Double-click rumus matematika (hasil dari math editor) → buka lagi untuk diedit
        this.editor.addEventListener('dblclick', (e) => {
            if (e.target.tagName === 'IMG' && e.target.dataset.editorMath === '1') {
                e.preventDefault();
                let latex = '';
                try { latex = decodeURIComponent(e.target.dataset.latex || ''); } catch (err) { latex = e.target.dataset.latex || ''; }
                openMathEditor(this, latex, e.target);
            }
        });

        // Cursor masuk/keluar sel tabel → tampilkan/sembunyikan kontrol baris-kolom
        this.editor.addEventListener('mouseup', () => this._updateTableControls());
        this.editor.addEventListener('keyup', () => this._updateTableControls());

        this.editor.addEventListener('paste', (e) => {
            // Cek dulu apakah yang ditempel adalah gambar (screenshot, copy dari file explorer, dll)
            const items = e.clipboardData?.items || [];
            for (const item of items) {
                if (item.kind === 'file' && item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) this._insertImageFile(file);
                    return; // langsung berhenti, tidak perlu proses teks
                }
            }

            e.preventDefault();
            // Prioritaskan mengambil plain text untuk menghindari format blok yang aneh
            const text = e.clipboardData.getData('text/plain');
            
            // Bersihkan teks dari spasi/enter berlebih
            const cleanText = text.trim().replace(/\n\s*\n/g, '\n');
            
            // Masukkan ke editor
            document.execCommand('insertText', false, cleanText);
        });
    }

    _bindToolbar() {
        // Exec commands
        this.toolbar.querySelectorAll('[data-cmd]').forEach(btn => {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const cmd = btn.dataset.cmd;
                if (cmd === 'fontName') {
                    document.execCommand('fontName', false, btn.value);
                } else if (cmd === 'fontSize') {
                    document.execCommand('fontSize', false, btn.value);
                } else if (cmd === 'foreColor' || cmd === 'backColor') {
                    // handled by color input
                } else {
                    document.execCommand(cmd, false, null);
                }
                this._updateActiveState();
                if (this.options.onchange) this.options.onchange(this.getHTML());
            });
        });

        // Select (font/size)
        this.toolbar.querySelectorAll('select[data-cmd]').forEach(sel => {
            sel.addEventListener('change', () => {
                this.editor.focus();
                document.execCommand(sel.dataset.cmd, false, sel.value);
                if (this.options.onchange) this.options.onchange(this.getHTML());
            });
        });

        // Color inputs
        this.toolbar.querySelectorAll('.rtb-color-input').forEach(input => {
            input.addEventListener('input', () => {
                this.editor.focus();
                document.execCommand(input.dataset.cmd, false, input.value);
                if (this.options.onchange) this.options.onchange(this.getHTML());
            });
        });

        // Link button
        this.toolbar.querySelector('.rtb-link-btn')?.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const url = prompt('Masukkan URL:');
            if (url) {
                this.editor.focus();
                document.execCommand('createLink', false, url);
            }
        });

        // Image upload
        const imgInput = this.toolbar.querySelector('.rtb-img-input');
        if (imgInput) {
            imgInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                await this._insertImageFile(file);
                imgInput.value = '';
            });
        }

        // Image from URL
        this.toolbar.querySelector('.rtb-imgurl-btn')?.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const url = prompt('URL Gambar:');
            if (url) {
                this.editor.focus();
                document.execCommand('insertHTML', false,
                    `<img src="${url}" style="max-width:100%;height:auto;display:block;margin:4px 0" data-editor-img="1">`);
                if (this.options.onchange) this.options.onchange(this.getHTML());
            }
        });

        // Image controls
        const imgControls = this.toolbar.querySelector('.rtb-img-controls');
        const dimW = imgControls?.querySelector('.rtb-dim-w');
        const dimH = imgControls?.querySelector('.rtb-dim-h');
        const imgAlign = imgControls?.querySelector('.rtb-img-align');
        const imgApply = imgControls?.querySelector('.rtb-img-apply');
        const imgRemove = imgControls?.querySelector('.rtb-img-remove');

        if (imgApply) {
            imgApply.addEventListener('click', () => {
                if (!this._selectedImg) return;
                const w = dimW.value;
                const h = dimH.value;
                const align = imgAlign.value;
                if (w) this._selectedImg.style.width = isNaN(w) ? w : w + 'px';
                if (h) this._selectedImg.style.height = isNaN(h) ? h : h + 'px';
                if (align === 'left') { this._selectedImg.style.float = 'left'; this._selectedImg.style.margin = '4px 12px 4px 0'; this._selectedImg.style.display = ''; }
                else if (align === 'right') { this._selectedImg.style.float = 'right'; this._selectedImg.style.margin = '4px 0 4px 12px'; this._selectedImg.style.display = ''; }
                else if (align === 'center') { this._selectedImg.style.float = ''; this._selectedImg.style.display = 'block'; this._selectedImg.style.margin = '4px auto'; }
                else if (align === 'none') { this._selectedImg.style.float = ''; this._selectedImg.style.display = 'inline'; this._selectedImg.style.margin = '4px'; }
                if (this.options.onchange) this.options.onchange(this.getHTML());
            });
        }
        if (imgRemove) {
            imgRemove.addEventListener('click', () => {
                if (this._selectedImg) { this._selectedImg.remove(); this._deselectImg(); if (this.options.onchange) this.options.onchange(this.getHTML()); }
            });
        }

        // ── Table: grid-picker popover ──
        this._buildTableGridPopover();
        const tableBtn = this.toolbar.querySelector('.rtb-table-btn');
        if (tableBtn) {
            tableBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const pop = this._tableGridPop;
                if (!pop) return;
                const wasOpen = pop.classList.contains('open');
                document.querySelectorAll('.rtb-table-grid-pop.open').forEach(p => p.classList.remove('open'));
                if (!wasOpen) {
                    this._tableInsertRange = this._getCurrentRange();
                    this._openTableGridPop(tableBtn);
                }
            });
        }

        // ── Table: row/column controls ──
        this.toolbar.querySelector('.rtb-tbl-row-add')?.addEventListener('mousedown', (e) => { e.preventDefault(); this._tblAddRow(); });
        this.toolbar.querySelector('.rtb-tbl-col-add')?.addEventListener('mousedown', (e) => { e.preventDefault(); this._tblAddCol(); });
        this.toolbar.querySelector('.rtb-tbl-row-del')?.addEventListener('mousedown', (e) => { e.preventDefault(); this._tblDelRow(); });
        this.toolbar.querySelector('.rtb-tbl-col-del')?.addEventListener('mousedown', (e) => { e.preventDefault(); this._tblDelCol(); });
        this.toolbar.querySelector('.rtb-tbl-del')?.addEventListener('mousedown', (e) => { e.preventDefault(); this._tblDelTable(); });

        // ── Math equation button ──
        this.toolbar.querySelector('.rtb-math-btn')?.addEventListener('mousedown', (e) => {
            e.preventDefault();
            openMathEditor(this, '', null);
        });
    }

    // ══════════════ TABEL ══════════════
    _getCurrentRange() {
        const sel = document.getSelection();
        if (sel && sel.rangeCount && this.editor.contains(sel.anchorNode)) return sel.getRangeAt(0).cloneRange();
        const r = document.createRange();
        r.selectNodeContents(this.editor);
        r.collapse(false);
        return r;
    }

    _buildTableGridPopover() {
        const pop = this.toolbar.querySelector('.rtb-table-grid-pop');
        if (!pop) return;
        this._tableGridPop = pop; // simpan referensi: elemen ini akan dipindah ke <body> saat dibuka
        const MAXR = 8, MAXC = 8;
        let html = '<div class="rtb-grid-label">Pilih ukuran tabel</div><div class="rtb-grid-cells">';
        for (let r = 1; r <= MAXR; r++) {
            for (let c = 1; c <= MAXC; c++) html += `<div class="rtb-grid-cell" data-r="${r}" data-c="${c}"></div>`;
        }
        html += '</div><div class="rtb-grid-size-label">1 x 1</div>';
        pop.innerHTML = html;
        const cells = pop.querySelectorAll('.rtb-grid-cell');
        const sizeLabel = pop.querySelector('.rtb-grid-size-label');
        cells.forEach(cell => {
            const r = +cell.dataset.r, c = +cell.dataset.c;
            cell.addEventListener('mouseenter', () => {
                cells.forEach(cc => cc.classList.toggle('active', +cc.dataset.r <= r && +cc.dataset.c <= c));
                sizeLabel.textContent = `${r} x ${c}`;
            });
            cell.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this._insertTable(r, c);
                pop.classList.remove('open');
            });
        });
    }

    // Popover grid tabel sebelumnya diposisikan `position:absolute` di dalam
    // `.rich-editor-wrap`, sedangkan wrap itu punya `overflow:hidden` — jadi
    // separuh grid kepotong kalau tombol tabelnya dekat tepi bawah/kanan area
    // editor (lihat laporan bug). Solusinya: pindahkan popover ke <body> dan
    // pakai `position:fixed` dengan koordinat dihitung dari posisi tombol,
    // supaya lolos dari elemen induk manapun yang overflow-nya hidden/auto
    // (termasuk modal itu sendiri).
    _openTableGridPop(btn) {
        const pop = this._tableGridPop;
        if (!pop || !btn) return;
        if (pop.parentElement !== document.body) document.body.appendChild(pop);
        pop.classList.add('open');
        const r = btn.getBoundingClientRect();
        const popRect = pop.getBoundingClientRect();
        let top = r.bottom + 6;
        let left = r.left;
        // Jaga supaya tidak keluar dari tepi kanan layar
        if (left + popRect.width > window.innerWidth - 8) {
            left = Math.max(8, window.innerWidth - popRect.width - 8);
        }
        // Kalau tidak cukup ruang di bawah tombol, tampilkan di atas tombol
        if (top + popRect.height > window.innerHeight - 8) {
            top = Math.max(8, r.top - popRect.height - 6);
        }
        pop.style.top = top + 'px';
        pop.style.left = left + 'px';
    }

    _insertTable(rows, cols) {
        this.editor.focus();
        const sel = document.getSelection();
        if (this._tableInsertRange) { sel.removeAllRanges(); sel.addRange(this._tableInsertRange); }
        let html = '<table class="soal-editor-table" data-editor-table="1" style="border-collapse:collapse;width:100%;margin:8px 0"><tbody>';
        for (let r = 0; r < rows; r++) {
            html += '<tr>';
            for (let c = 0; c < cols; c++) html += '<td style="border:1px solid rgba(19,50,89,0.3);padding:7px 10px;min-width:36px;vertical-align:top">&nbsp;</td>';
            html += '</tr>';
        }
        html += '</tbody></table><p><br></p>';
        document.execCommand('insertHTML', false, html);
        if (this.options.onchange) this.options.onchange(this.getHTML());
    }

    _updateTableControls() {
        const controls = this.toolbar.querySelector('.rtb-tbl-controls');
        if (!controls) return;
        const sel = document.getSelection();
        let cell = null;
        if (sel && sel.rangeCount) {
            let node = sel.anchorNode;
            if (node && node.nodeType === 3) node = node.parentElement;
            cell = node && node.closest ? node.closest('td,th') : null;
            if (cell && !this.editor.contains(cell)) cell = null;
        }
        this._activeCell = cell;
        controls.style.display = cell ? 'flex' : 'none';
    }

    _tblAddRow() {
        const cell = this._activeCell; if (!cell) return;
        const row = cell.closest('tr'), table = cell.closest('table');
        if (!row || !table) return;
        const newRow = row.cloneNode(true);
        Array.from(newRow.children).forEach(td => td.innerHTML = '&nbsp;');
        row.after(newRow);
        if (this.options.onchange) this.options.onchange(this.getHTML());
    }
    _tblAddCol() {
        const cell = this._activeCell; if (!cell) return;
        const table = cell.closest('table'); if (!table) return;
        const idx = cell.cellIndex;
        table.querySelectorAll('tr').forEach(tr => {
            const ref = tr.children[idx];
            if (!ref) return;
            const nc = ref.cloneNode(true);
            nc.innerHTML = '&nbsp;';
            ref.after(nc);
        });
        if (this.options.onchange) this.options.onchange(this.getHTML());
    }
    _tblDelRow() {
        const cell = this._activeCell; if (!cell) return;
        const row = cell.closest('tr'), table = cell.closest('table');
        if (!row || !table) return;
        if (table.querySelectorAll('tr').length <= 1) { this._tblDelTable(); return; }
        row.remove();
        this._activeCell = null; this._updateTableControls();
        if (this.options.onchange) this.options.onchange(this.getHTML());
    }
    _tblDelCol() {
        const cell = this._activeCell; if (!cell) return;
        const table = cell.closest('table'); if (!table) return;
        const idx = cell.cellIndex;
        const firstRow = table.querySelector('tr');
        if (firstRow && firstRow.children.length <= 1) { this._tblDelTable(); return; }
        table.querySelectorAll('tr').forEach(tr => { if (tr.children[idx]) tr.children[idx].remove(); });
        this._activeCell = null; this._updateTableControls();
        if (this.options.onchange) this.options.onchange(this.getHTML());
    }
    _tblDelTable() {
        const cell = this._activeCell; if (!cell) return;
        const table = cell.closest('table');
        if (table) table.remove();
        this._activeCell = null; this._updateTableControls();
        if (this.options.onchange) this.options.onchange(this.getHTML());
    }

    _selectImg(img) {
        this._deselectImg();
        this._selectedImg = img;
        img.style.outline = '2px solid var(--accent)';
        const controls = this.toolbar.querySelector('.rtb-img-controls');
        if (controls) controls.style.display = 'flex';
        const dimW = controls?.querySelector('.rtb-dim-w');
        const dimH = controls?.querySelector('.rtb-dim-h');
        if (dimW) dimW.value = img.style.width ? parseInt(img.style.width) : img.naturalWidth || '';
        if (dimH) dimH.value = img.style.height ? parseInt(img.style.height) : '';
    }

    _deselectImg() {
        if (this._selectedImg) { this._selectedImg.style.outline = ''; this._selectedImg = null; }
        const controls = this.toolbar.querySelector('.rtb-img-controls');
        if (controls) controls.style.display = 'none';
    }

    _updateActiveState() {
        const cmds = ['bold', 'italic', 'underline', 'strikeThrough'];
        cmds.forEach(cmd => {
            const btn = this.toolbar.querySelector(`[data-cmd="${cmd}"]`);
            if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
        });
    }

    // Batas ukuran untuk fallback base64 (kalau upload ke server gagal karena offline/error jaringan).
    // Di atas ini, base64 akan bikin konten soal jadi sangat besar di database, jadi lebih baik ditolak.
    static MAX_BASE64_FALLBACK_SIZE = 5 * 1024 * 1024; // 5MB

    // Dipakai bersama oleh: tombol upload gambar (file input) dan paste gambar (Ctrl+V).
    // Alur: coba upload ke server dulu -> kalau server menolak (tipe salah/kebesaran) tampilkan
    // error dan berhenti -> kalau server tidak terjangkau (offline dll) fallback ke base64.
    async _insertImageFile(file) {
        if (!file || !file.type || !file.type.startsWith('image/')) {
            if (typeof showToast === 'function') showToast('File yang ditempel/dipilih bukan gambar', 'danger');
            return;
        }

        let url = null;

        if (this.options.uploadFn) {
            const res = await this.options.uploadFn(file);

            if (res && res.url) {
                url = res.url;
            } else if (res && res.rejected) {
                // Server dengan sengaja menolak file ini (tipe tidak didukung / ukuran > 10MB) —
                // jangan fallback ke base64, karena itu akan menyisipkan file yang memang tidak valid.
                if (typeof showToast === 'function') showToast(res.error || 'Upload gambar ditolak server', 'danger');
                return;
            } else {
                // Server tidak terjangkau (offline / koneksi gagal) -> fallback ke base64 sementara
                if (file.size > RichEditor.MAX_BASE64_FALLBACK_SIZE) {
                    if (typeof showToast === 'function') showToast('Upload gagal (offline) dan file terlalu besar untuk disisipkan sementara (maks 5MB)', 'danger');
                    return;
                }
                if (typeof showToast === 'function') showToast('Upload ke server gagal, gambar disisipkan sementara', 'danger');
                url = await this._fileToBase64(file);
            }
        } else {
            url = await this._fileToBase64(file);
        }

        if (url) {
            this.editor.focus();
            document.execCommand('insertHTML', false,
                `<img src="${url}" style="max-width:100%;height:auto;display:block;margin:4px 0" data-editor-img="1">`);
            if (this.options.onchange) this.options.onchange(this.getHTML());
        }
    }

    _fileToBase64(file) {
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = ev => resolve(ev.target.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });
    }

    _sanitizePaste(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        
        // Hapus elemen berbahaya
        div.querySelectorAll('script, style, link, meta').forEach(el => el.remove());
        
        // Ambil kontennya
        let cleanHTML = div.innerHTML;

        // Bersihkan enter yang berlebihan di awal dan akhir
        cleanHTML = cleanHTML.replace(/^(<br>|\s|&nbsp;)+/g, ''); // Hapus di awal
        cleanHTML = cleanHTML.replace(/(<br>|\s|&nbsp;)+$/g, ''); // Hapus di akhir
        
        return cleanHTML;
    }

    // ── PUBLIC API ──
    getHTML() { return this.editor.innerHTML; }
    getText() { return this.editor.innerText; }
    setHTML(html) { this.editor.innerHTML = html || ''; }
    clear() { this.editor.innerHTML = ''; }
    focus() { this.editor.focus(); }
    disable() { this.editor.contentEditable = false; this.toolbar.style.opacity = '0.4'; this.toolbar.style.pointerEvents = 'none'; }
    enable() { this.editor.contentEditable = true; this.toolbar.style.opacity = ''; this.toolbar.style.pointerEvents = ''; }

    // ── STATIC: Create with label ──
    static create(parentEl, id, placeholder = '', options = {}) {
        let wrap = document.getElementById(id);
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.id = id;
            parentEl.appendChild(wrap);
        }
        return new RichEditor(wrap, { placeholder, ...options });
    }
}

// Tutup popover grid tabel kalau klik di luar tombolnya ATAU di luar popovernya
// sendiri (popover sekarang bisa dipindah ke <body>, jadi dua-duanya dicek).
document.addEventListener('mousedown', (e) => {
    if (!e.target.closest) return;
    if (!e.target.closest('.rtb-table-wrap') && !e.target.closest('.rtb-table-grid-pop')) {
        document.querySelectorAll('.rtb-table-grid-pop.open').forEach(p => p.classList.remove('open'));
    }
});
// Tutup juga kalau ada scroll (di window atau di dalam modal yang scrollable) —
// posisinya fixed berdasarkan koordinat saat dibuka, jadi tidak ikut mengikuti
// scroll; daripada salah posisi, popovernya ditutup saja.
document.addEventListener('scroll', () => {
    document.querySelectorAll('.rtb-table-grid-pop.open').forEach(p => p.classList.remove('open'));
}, true);

/* =============================================
   MATH EQUATION EDITOR
   Papan rumus VISUAL (MathQuill) — klik tombol,
   isi angka langsung di kotak yang muncul, panah
   kiri/kanan/atas/bawah untuk pindah antar bagian
   (pembilang/penyebut, dalam akar, dst). Tidak
   perlu mengetik kode LaTeX sama sekali.
   Hasil akhirnya dirender ulang dengan MathJax
   (SVG) lalu disisipkan sebagai <img> mandiri
   (data-URI) — jadi tetap tampil benar di
   ujian/review/hasil tanpa perlu load library
   tambahan di halaman-halaman itu. data-latex
   disimpan di img supaya bisa diedit lagi nanti
   (dobel-klik gambar rumus untuk buka lagi).
   ============================================= */
window._mathEd = { editor: null, savedRange: null, editingImg: null, _jaxReadyPromise: null, _mqReadyPromise: null, mq: null, mathField: null };

function _ensureMathJaxLoaded() {
    if (window.MathJax && window.MathJax.tex2svgPromise) return Promise.resolve();
    if (window._mathEd._jaxReadyPromise) return window._mathEd._jaxReadyPromise;
    const promise = new Promise((resolve, reject) => {
        const existing = document.getElementById('mathjax-svg-script');
        if (existing) {
            if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
                window.MathJax.startup.promise.then(resolve);
            } else {
                existing.addEventListener('load', () => {
                    (window.MathJax?.startup?.promise || Promise.resolve()).then(resolve);
                });
                existing.addEventListener('error', () => reject(new Error('Gagal memuat MathJax')));
            }
            return;
        }
        const script = document.createElement('script');
        script.id = 'mathjax-svg-script';
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.js';
        script.onload = () => {
            (window.MathJax?.startup?.promise || Promise.resolve()).then(resolve);
        };
        script.onerror = () => reject(new Error('Gagal memuat MathJax'));
        document.head.appendChild(script);
    });
    // PENTING: kalau gagal (mis. koneksi putus sesaat), JANGAN simpan Promise yang
    // sudah reject ini selamanya — sebelumnya ini menyebabkan fitur rumus mati
    // total untuk sisa sesi begitu sekali gagal load, meski koneksi sudah pulih.
    // Bersihkan cache + tag script yang gagal supaya percobaan berikutnya benar-benar
    // mengambil ulang dari CDN.
    promise.catch(() => {
        window._mathEd._jaxReadyPromise = null;
        document.getElementById('mathjax-svg-script')?.remove();
    });
    window._mathEd._jaxReadyPromise = promise;
    return promise;
}

// MathQuill butuh jQuery dimuat lebih dulu, baru mathquill.js + CSS-nya.
//
// RIWAYAT MASALAH — dua penyebab berbeda yang sudah pernah bikin ini gagal:
// 1) UMD/AMD conflict: mathquill.min.js & jquery.min.js dibungkus format UMD —
//    kalau halaman ini kebetulan sudah punya AMD loader aktif (mis. RequireJS,
//    atau library lain yang mendaftarkan `window.define.amd`), UMD akan
//    mendaftar library itu sebagai *module AMD*, BUKAN menempel ke variabel
//    global `window.MathQuill` / `window.jQuery`. Solusinya: matikan sementara
//    penanda AMD selama kedua script ini dimuat (lihat `_withAmdDisabled`).
// 2) VERSI SALAH (penyebab sebenarnya laporan "MathQuill is not defined" yang
//    terakhir): sebelumnya dipakai mathquill 0.9.1 dari CDN, padahal versi
//    itu API-nya masih gaya lama (`$(elemen).mathquill(...)`) dan TIDAK
//    PUNYA `MathQuill.getInterface()` sama sekali — sudah dicek langsung ke
//    source build 0.9.1, fungsi itu memang tidak ada di file-nya. API
//    `MathQuill.getInterface(2)` yang dipakai kode di bawah baru ada mulai
//    versi 0.10.x. Jadi walau script berhasil 100% dimuat, `window.MathQuill`
//    tetap ada tapi tidak punya method yang dibutuhkan → error terus.
//    Sekarang MathQuill (0.10.1) & jQuery (3.7.1) di-vendor lokal di folder
//    ini (bukan CDN lagi), supaya (a) versinya pasti benar, dan (b) fitur ini
//    tidak lagi bergantung sama sekali ke koneksi internet/CDN pihak ketiga.
function _withAmdDisabled(scriptEl, onDone) {
    const hadAmdLoader = !!(window.define && window.define.amd);
    const amdBackup = window.define;
    if (hadAmdLoader) window.define = undefined;
    const restore = () => { if (hadAmdLoader) window.define = amdBackup; };
    scriptEl.addEventListener('load', () => { restore(); onDone(true); }, { once: true });
    scriptEl.addEventListener('error', () => { restore(); onDone(false); }, { once: true });
}

function _ensureMathQuillLoaded() {
    if (window.MathQuill) return Promise.resolve();
    if (window._mathEd._mqReadyPromise) return window._mathEd._mqReadyPromise;
    const promise = new Promise((resolve, reject) => {
        const loadMathQuill = () => {
            if (!document.getElementById('mathquill-css')) {
                const link = document.createElement('link');
                link.id = 'mathquill-css';
                link.rel = 'stylesheet';
                link.href = '/admin/soal/vendor/mathquill/mathquill.css';
                document.head.appendChild(link);
            }
            if (window.MathQuill) { resolve(); return; }
            const mqScript = document.createElement('script');
            mqScript.id = 'mathquill-js';
            mqScript.src = '/admin/soal/vendor/mathquill/mathquill.min.js';
            _withAmdDisabled(mqScript, (ok) => {
                if (!ok) { reject(new Error('Gagal memuat papan rumus')); return; }
                if (window.MathQuill && typeof window.MathQuill.getInterface === 'function') resolve();
                else reject(new Error('MathQuill dimuat tapi API getInterface tidak ada (versi berkas lokal tidak sesuai)'));
            });
            document.head.appendChild(mqScript);
        };
        if (window.jQuery) { loadMathQuill(); return; }
        const existingJq = document.getElementById('mathquill-jquery');
        if (existingJq) {
            existingJq.addEventListener('load', loadMathQuill);
            existingJq.addEventListener('error', () => reject(new Error('Gagal memuat jQuery untuk papan rumus')));
            return;
        }
        const jq = document.createElement('script');
        jq.id = 'mathquill-jquery';
        jq.src = '/admin/soal/vendor/jquery/jquery.min.js';
        _withAmdDisabled(jq, (ok) => {
            if (!ok) { reject(new Error('Gagal memuat jQuery untuk papan rumus')); return; }
            if (window.jQuery) loadMathQuill();
            else reject(new Error('jQuery dimuat tapi window.jQuery tidak terbentuk (kemungkinan konflik AMD/RequireJS di halaman ini)'));
        });
        document.head.appendChild(jq);
    });
    // Sama seperti MathJax di atas: jangan simpan Promise gagal secara permanen,
    // supaya user bisa buka-tutup lagi modalnya dan sistem coba ambil ulang.
    promise.catch(() => {
        window._mathEd._mqReadyPromise = null;
        document.getElementById('mathquill-jquery')?.remove();
        document.getElementById('mathquill-js')?.remove();
    });
    window._mathEd._mqReadyPromise = promise;
    return promise;
}


// "%" adalah karakter komentar di LaTeX — escape otomatis biar orang tidak
// perlu tahu soal itu, baik saat ketik manual maupun dari papan rumus.
function _mathEscapePercent(latex) {
    // Pakai negative lookbehind supaya "%" beruntun (mis. "%%") ikut ter-escape
    // semua — versi lama (konsumsi 1 karakter sebelum "%") melewatkan "%" kedua
    // pada kasus seperti itu.
    return latex.replace(/(?<!\\)%/g, '\\%');
}

async function openMathEditor(editorInstance, existingLatex, existingImg) {
    // Token unik per-panggilan: kalau modal ini keburu ditutup / dibuka ulang
    // sebelum proses loading (async) selesai, hasil loading yang "basi" itu
    // tidak akan menimpa state atau merebut fokus secara tidak terduga.
    const token = {};
    window._mathEd._openToken = token;
    window._mathEd.editor = editorInstance;
    window._mathEd.editingImg = existingImg || null;
    const sel = document.getSelection();
    window._mathEd.savedRange = (sel && sel.rangeCount) ? sel.getRangeAt(0).cloneRange() : null;
    if (typeof openModal === 'function') openModal('math-editor-overlay');
    const box = document.getElementById('math-visual-field');
    if (box) box.innerHTML = '<span style="color:var(--text-sub);font-size:12px">Memuat papan rumus...</span>';
    const advWrap = document.getElementById('math-advanced-wrap');
    if (advWrap) advWrap.style.display = 'none';
    const ta = document.getElementById('math-latex-advanced');
    if (ta) ta.value = '';
    try {
        await _ensureMathQuillLoaded();
    } catch (e) {
        if (window._mathEd._openToken !== token) return;
        if (box) box.innerHTML = '<span style="color:var(--danger);font-size:12px">Gagal memuat papan rumus (berkas vendor/mathquill tidak ditemukan di server). Tutup lalu buka lagi untuk coba ulang.</span>';
        return;
    }
    if (window._mathEd._openToken !== token) return; // modal sudah ditutup/diganti sebelum loading selesai
    // Inisialisasi MathQuill dibungkus try/catch: sebelumnya kalau ini melempar
    // error (mis. bentrok dengan versi jQuery lain yang sudah dipakai halaman
    // admin ini untuk keperluan lain), errornya diam-diam tidak tertangkap —
    // box jadi kosong tanpa kotak input sama sekali, makanya kelihatan
    // seperti "tidak bisa nulis apa pun" padahal sebenarnya papan rumusnya
    // gagal terbentuk. Sekarang errornya ditangkap dan user diarahkan ke
    // "Mode Lanjutan" (ketik kode LaTeX manual) sebagai jalur cadangan yang
    // tidak butuh MathQuill sama sekali.
    try {
        if (!window._mathEd.mq) window._mathEd.mq = MathQuill.getInterface(2);
        if (box) {
            box.innerHTML = '';
            window._mathEd.mathField = window._mathEd.mq.MathField(box, {
                spaceBehavesLikeTab: true,
                handlers: { edit: () => _syncMathAdvancedInput() }
            });
        }
    } catch (err) {
        console.error('[math-editor] gagal inisialisasi MathQuill:', err);
        window._mathEd.mathField = null;
        if (box) box.innerHTML = '<span style="color:var(--danger);font-size:12px">Papan rumus visual gagal dimuat (kemungkinan bentrok dengan komponen lain di halaman ini). Gunakan "⚙ Mode Lanjutan" di bawah untuk mengetik kode LaTeX secara manual.</span>';
        if (advWrap) advWrap.style.display = 'block';
        if (ta) ta.value = existingLatex || '';
        return;
    }
    const mf = window._mathEd.mathField;
    if (mf) {
        mf.latex(existingLatex || '');
        // Klik di mana pun di dalam kotak papan rumus akan memfokuskan field-nya —
        // jaga-jaga kalau klik tidak selalu tepat kena textarea internal MathQuill.
        if (box && !box._mathClickBound) {
            box._mathClickBound = true;
            box.addEventListener('mousedown', () => setTimeout(() => window._mathEd.mathField?.focus(), 0));
        }
        // Coba fokuskan beberapa kali (bukan cuma sekali di 150ms) — modal butuh
        // waktu animasi untuk muncul, dan kalau sistem modal punya focus-trap
        // sendiri yang jalan belakangan, fokus ke papan rumus bisa "direbut
        // balik" sehingga user tidak bisa langsung mengetik angka.
        const tryFocus = (n) => {
            if (window._mathEd._openToken !== token) return;
            mf.focus();
            if (n > 0) setTimeout(() => tryFocus(n - 1), 120);
        };
        tryFocus(6);
    }
    _syncMathAdvancedInput();
}

function closeMathEditor() {
    if (typeof closeModal === 'function') closeModal('math-editor-overlay');
    window._mathEd._openToken = null;
    window._mathEd.editor = null;
    window._mathEd.editingImg = null;
    window._mathEd.savedRange = null;
    window._mathEd.mathField = null;
}

// Jaring pengaman: kalau modal math-editor ditutup lewat cara lain (klik area
// gelap di luar kotak modal, atau tombol Escape) dan bukan lewat tombol
// Batal/Sisipkan, pastikan state di atas tetap ke-reset — supaya sesi buka
// berikutnya tidak salah target (mis. malah mengedit rumus lama) atau nyangkut.
document.addEventListener('mousedown', (e) => {
    const ov = document.getElementById('math-editor-overlay');
    if (ov && e.target === ov) closeMathEditor();
});
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const ov = document.getElementById('math-editor-overlay');
    if (ov && getComputedStyle(ov).display !== 'none') closeMathEditor();
});

// Dipanggil oleh tombol-tombol simbol di modal. mode='write' untuk simbol
// yang langsung ditulis apa adanya (mis. \times), tanpa mode berarti '\cmd'
// yang membuat struktur dengan kotak isian (mis. pecahan, akar, pangkat).
function mathCmd(latexCmd, mode) {
    const mf = window._mathEd.mathField;
    if (!mf) {
        // Sebelumnya diam saja kalau papan rumus belum/gagal siap — dari sisi
        // user kelihatannya seperti tombol rusak. Kasih tahu supaya jelas.
        if (typeof showToast === 'function') showToast('Papan rumus belum siap, tunggu sebentar lalu coba lagi', 'warning');
        return;
    }
    if (mode === 'write') mf.write(latexCmd); else mf.cmd(latexCmd);
    mf.focus();
    _syncMathAdvancedInput();
}

// ── Mode lanjutan (opsional): ketik/lihat kode LaTeX langsung, untuk yang
// sudah terbiasa atau butuh pola rumit berulang (mis. akar bersarang panjang).
function toggleMathAdvanced() {
    const wrap = document.getElementById('math-advanced-wrap');
    if (!wrap) return;
    const willShow = wrap.style.display === 'none' || !wrap.style.display;
    wrap.style.display = willShow ? 'block' : 'none';
    if (willShow) _syncMathAdvancedInput();
}
function _syncMathAdvancedInput() {
    const ta = document.getElementById('math-latex-advanced');
    if (ta && window._mathEd.mathField) ta.value = window._mathEd.mathField.latex();
}
function applyMathAdvancedInput() {
    const ta = document.getElementById('math-latex-advanced');
    if (ta && window._mathEd.mathField) window._mathEd.mathField.latex(ta.value);
}

async function mathEditorInsert() {
    const mf = window._mathEd.mathField;
    // Kalau papan rumus visual gagal terbentuk (lihat catatan di openMathEditor),
    // tetap coba ambil rumus dari textarea "Mode Lanjutan" kalau user mengisinya
    // di situ — supaya insert rumus tidak 100% bergantung ke MathQuill.
    const advTa = document.getElementById('math-latex-advanced');
    const latex = (mf ? mf.latex() : (advTa ? advTa.value : '')).trim();
    if (!mf && !latex) {
        if (typeof showToast === 'function') showToast('Papan rumus belum siap / gagal dimuat, tutup lalu buka lagi', 'danger');
        return;
    }
    if (!latex) { if (typeof showToast === 'function') showToast('Rumus masih kosong', 'danger'); return; }
    let svgEl;
    try {
        await _ensureMathJaxLoaded();
        const node = await window.MathJax.tex2svgPromise(_mathEscapePercent(latex), { display: false });
        svgEl = node.querySelector('svg');
    } catch (e) {
        if (typeof showToast === 'function') showToast('Rumus tidak valid, periksa kembali', 'danger');
        return;
    }
    if (!svgEl) return;
    svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const svgStr = new XMLSerializer().serializeToString(svgEl);
    const dataUri = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
    const encLatex = encodeURIComponent(latex);
    const imgHtml = `<img src="${dataUri}" data-editor-math="1" data-latex="${encLatex}" alt="rumus matematika" style="vertical-align:middle;display:inline-block;max-width:100%">`;

    const st = window._mathEd;
    if (st.editingImg && st.editingImg.isConnected) {
        st.editingImg.outerHTML = imgHtml;
        if (st.editor && st.editor.options.onchange) st.editor.options.onchange(st.editor.getHTML());
    } else if (st.editor) {
        st.editor.editor.focus();
        const sel = document.getSelection();
        if (st.savedRange) { sel.removeAllRanges(); sel.addRange(st.savedRange); }
        document.execCommand('insertHTML', false, imgHtml);
        if (st.editor.options.onchange) st.editor.options.onchange(st.editor.getHTML());
    }
    closeMathEditor();
}

/* ── EDITOR CSS (injected) ── */
(function injectEditorCSS() {
    if (document.getElementById('rich-editor-css')) return;
    const style = document.createElement('style');
    style.id = 'rich-editor-css';
    style.textContent = `
    .rich-editor-wrap {
        border: 1.5px solid rgba(19,50,89,0.14);
        border-radius: 14px;
        overflow: hidden;
        background: rgba(255,255,255,0.85);
        transition: border-color 0.2s, box-shadow 0.2s;
    }
    .rich-editor-wrap:focus-within {
        border-color: var(--blue, #133259);
        box-shadow: 0 0 0 3px rgba(19,50,89,0.08);
    }
    .rich-toolbar {
        background: rgba(245,248,253,0.98);
        border-bottom: 1px solid rgba(19,50,89,0.08);
        padding: 4px 8px;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .rich-toolbar-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 1px;
    }
    .rtb-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        height: 28px;
        padding: 0 5px;
        border: none;
        background: transparent;
        border-radius: 6px;
        cursor: pointer;
        color: #334;
        font-family: inherit;
        font-size: 13px;
        transition: background 0.15s, color 0.15s;
        white-space: nowrap;
    }
    .rtb-btn:hover { background: rgba(19,50,89,0.08); color: #133259; }
    .rtb-btn.active { background: rgba(19,50,89,0.14); color: #133259; }
    .rtb-select {
        height: 28px;
        padding: 0 6px;
        border: 1px solid rgba(19,50,89,0.12);
        border-radius: 6px;
        background: white;
        font-family: inherit;
        font-size: 12px;
        color: #334;
        cursor: pointer;
        max-width: 120px;
    }
    .rtb-select-sm { max-width: 64px; }
    .rtb-sep {
        width: 1px;
        height: 20px;
        background: rgba(19,50,89,0.1);
        margin: 0 3px;
        flex-shrink: 0;
    }
    .rtb-color-wrap {
        position: relative;
        cursor: pointer;
    }
    .rtb-color-input {
        position: absolute;
        opacity: 0;
        width: 1px;
        height: 1px;
        pointer-events: none;
    }
    .rtb-img-label { cursor: pointer; }
    .rtb-img-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 4px 2px;
        flex-wrap: wrap;
        border-top: 1px solid rgba(19,50,89,0.06);
    }
    .rich-content {
        padding: 14px 16px;
        font-family: 'DM Sans', sans-serif;
        font-size: 14px;
        color: #133259;
        line-height: 1.7;
        outline: none;
        min-height: 120px;
        white-space: normal;
        overflow-y: auto;
        max-height: 400px;
    }
    .rich-content:empty::before {
        content: attr(data-placeholder);
        color: rgba(19,50,89,0.3);
        pointer-events: none;
    }
    .rich-content img {
        max-width: 100%;
        height: auto;
        cursor: pointer;
        border-radius: 6px;
        transition: outline 0.15s;
    }
    .rich-content a { color: #1a5aa0; text-decoration: underline; }
    .rich-content ul, .rich-content ol { padding-left: 24px; }
    .rich-content blockquote { border-left: 3px solid rgba(19,50,89,0.2); margin: 0; padding-left: 12px; color: rgba(19,50,89,0.6); }
    .rich-content table { border-collapse: collapse; }
    .rich-content table td, .rich-content table th { border: 1px solid rgba(19,50,89,0.3); padding: 7px 10px; min-width: 24px; }
    .rich-content img[data-editor-math="1"] { cursor: pointer; border-radius: 4px; transition: outline 0.15s, background 0.15s; }
    .rich-content img[data-editor-math="1"]:hover { outline: 2px dashed rgba(19,50,89,0.35); background: rgba(19,50,89,0.04); }

    /* Table grid-picker popover */
    .rtb-table-wrap { position: relative; display: inline-flex; }
    .rtb-table-grid-pop {
        display: none;
        position: fixed;
        z-index: 4000;
        background: rgba(255,255,255,0.98);
        border: 1.5px solid rgba(19,50,89,0.14);
        border-radius: 10px;
        box-shadow: 0 10px 28px rgba(19,50,89,0.18);
        padding: 10px;
        width: max-content;
    }
    .rtb-table-grid-pop.open { display: block; }
    .rtb-grid-label { font-size: 11px; color: var(--text-sub); margin-bottom: 6px; font-weight: 600; }
    .rtb-grid-cells { display: grid; grid-template-columns: repeat(8, 16px); grid-template-rows: repeat(8, 16px); gap: 2px; }
    .rtb-grid-cell { width: 16px; height: 16px; border: 1px solid rgba(19,50,89,0.25); border-radius: 2px; background: rgba(19,50,89,0.03); cursor: pointer; }
    .rtb-grid-cell.active { background: rgba(19,50,89,0.55); border-color: var(--blue, #133259); }
    .rtb-grid-size-label { margin-top: 6px; font-size: 11px; font-weight: 700; color: var(--blue); text-align: center; }

    /* Math quick-symbol picker (inside modal) */
    .math-symbol-grid { display: flex; flex-wrap: wrap; gap: 6px; }
    .math-sym-btn {
        min-width: 38px; height: 34px; padding: 0 8px;
        border: 1.5px solid rgba(19,50,89,0.14);
        border-radius: 8px;
        background: rgba(19,50,89,0.03);
        color: var(--blue, #133259);
        font-size: 14px; font-weight: 600;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
    }
    .math-sym-btn:hover { background: rgba(19,50,89,0.1); border-color: rgba(19,50,89,0.3); }

    /* MathQuill visual field */
    .math-visual-field { min-height: 30px; }
    .math-visual-field .mq-editable-field { font-size: 22px; min-width: 100%; border: none !important; box-shadow: none !important; padding: 4px !important; }
    .math-visual-field .mq-editable-field.mq-focused { box-shadow: none !important; }
    `;
    document.head.appendChild(style);
})();
