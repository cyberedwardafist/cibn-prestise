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
    `;
    document.head.appendChild(style);
})();
