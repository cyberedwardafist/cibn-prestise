// review/laporan/laporan.js
// Dock LAPORAN — list sesi mentoring yang sudah "selesai" (JadwalStore),
// tiap kartu ditap buka overlay isi Laporan Pembelajaran (resume jadwal +
// textarea + tombol Simpan yang minta konfirmasi dulu). Bergantung pada
// JadwalStore/JDW_SLOTS/JDW_MATERI/_jdw* (dari review/jadwal/jadwal.js) dan
// SwipeCards (js/swipe.js, dimuat eager di shell) — lihat
// REVIEW_PAGE_MODULES.laporan di review/index_review.html.
//
// CATATAN: sama seperti fitur Jadwal/Bahas, ini MASIH dummy (field
// laporanDone/laporanText/laporanFilledAt disimpan langsung di entri
// JadwalStore di localStorage) — begitu ada backend beneran tinggal ganti
// JadwalStore.update di _doSave() jadi apiFetch PUT ke server tanpa ubah
// alur UI di atasnya.

const LaporanPage = {
    _activeId: null,

    load() {
        this.render();
    },

    render() {
        if (typeof _jdwAutoExpirePending === 'function') _jdwAutoExpirePending();
        if (typeof _jdwAutoAdvanceStatus === 'function') _jdwAutoAdvanceStatus();
        const list = document.getElementById('lap-list');
        const empty = document.getElementById('lap-empty');
        if (!list) return;
        const entries = JadwalStore.all()
            .filter(e => e.status === 'selesai')
            .sort((a, b) => (a.tanggal !== b.tanggal) ? (b.tanggal < a.tanggal ? -1 : 1) : (_jdwSlotIndex(b.slotId) - _jdwSlotIndex(a.slotId)));
        if (!entries.length) {
            if (empty) empty.style.display = '';
            list.innerHTML = '';
            return;
        }
        if (empty) empty.style.display = 'none';
        // Kelompokkan per tanggal (urutan tanggal ikut urutan entries yg
        // sudah disortir di atas -> tanggal terbaru duluan) supaya guru
        // gampang nyari "tanggal X jam berapa aja" tanpa harus baca ulang
        // tanggal di tiap kartu satu-satu.
        const order = [];
        const byDate = {};
        entries.forEach(e => {
            if (!byDate[e.tanggal]) { byDate[e.tanggal] = []; order.push(e.tanggal); }
            byDate[e.tanggal].push(e);
        });
        list.innerHTML = order.map(tanggal => `
            <div class="lap-date-group">
                <div class="lap-date-header">${_jdwFmtDateLong(tanggal)}</div>
                <div class="lap-date-cards">${byDate[tanggal].map(e => this._cardHtml(e)).join('')}</div>
            </div>
        `).join('');
        if (typeof SwipeCards !== 'undefined') SwipeCards.bindSwipeList(list);
    },

    _cardHtml(e) {
        const slot = JDW_SLOTS.find(s => s.id === e.slotId);
        const materi = JDW_MATERI.find(m => m.id === e.materiId);
        const done = !!e.laporanDone;
        // Tanggal SUDAH jadi header grup (lihat render()), jadi di sini
        // cukup materi + jam saja.
        const subParts = [materi ? materi.label : '-', slot ? slot.label : null].filter(Boolean);
        return SwipeCards.buildSwipeCardHtml({
            title: e.nama || 'Murid',
            sub: subParts.join(' · '),
            sideHtml: `<span class="jdw-status-badge ${done ? 'selesai' : 'pending'}">${done ? 'Sudah Diisi' : 'Belum Diisi'}</span>`,
            kode: e.id,
            onTapAttr: `onclick="LaporanPage.openForm('${String(e.id).replace(/'/g, "\\'")}')"`,
        });
    },

    /* Kebuka baik utk yang belum diisi (form kosong) maupun yang sudah
       diisi (textarea langsung terisi teks lama, boleh diedit & disimpan
       ulang — lihat jawaban "tetap kelihatan, bisa dibuka/diedit lagi"). */
    openForm(entryId) {
        const e = JadwalStore.get(entryId);
        if (!e) return;
        this._activeId = entryId;
        const slot = JDW_SLOTS.find(s => s.id === e.slotId);
        const materi = JDW_MATERI.find(m => m.id === e.materiId);
        document.getElementById('lap-form-title').textContent = e.nama || 'Murid';
        document.getElementById('lap-form-nama').textContent = e.nama || 'Murid';
        document.getElementById('lap-form-tanggal').textContent = _jdwFmtDateLong(e.tanggal);
        document.getElementById('lap-form-slot').textContent = slot ? slot.label : '-';
        document.getElementById('lap-form-materi').textContent = materi ? materi.label : '-';
        document.getElementById('lap-form-textarea').value = e.laporanText || '';
        document.getElementById('lap-form-overlay').classList.add('open');
    },

    closeForm() {
        document.getElementById('lap-form-overlay').classList.remove('open');
        this._activeId = null;
    },

    // Tombol "SIMPAN" -> tampilkan konfirmasi dulu ("Apakah Anda yakin akan
    // menyimpan laporan atas nama '<nama>' untuk materi '<materi>'?"). Klik
    // "Ya, Simpan" -> _doSave() beneran nyimpen & nutup overlay. Klik
    // "Batal" -> cuma nutup popup konfirmasinya saja (default showConfirm,
    // tanpa noCb), form Laporan tetap terbuka apa adanya, TIDAK disimpan.
    confirmSave() {
        const e = JadwalStore.get(this._activeId);
        if (!e) return;
        const text = document.getElementById('lap-form-textarea').value.trim();
        if (!text) { showToast('Isi laporan dulu sebelum disimpan', 'danger'); return; }
        const materi = JDW_MATERI.find(m => m.id === e.materiId);
        showConfirm(
            'Simpan Laporan?',
            `Apakah Anda yakin akan menyimpan laporan atas nama "${e.nama || 'Murid'}" untuk materi "${materi ? materi.label : '-'}"?`,
            'warning',
            () => this._doSave(),
            { yesLabel: 'Ya, Simpan' }
        );
    },

    _doSave() {
        const id = this._activeId;
        const e = JadwalStore.get(id);
        if (!e) return;
        const text = document.getElementById('lap-form-textarea').value.trim();
        JadwalStore.update(id, { laporanDone: true, laporanText: text, laporanFilledAt: Date.now() });
        showToast('✓ Laporan berhasil disimpan');
        this.closeForm();
        this.render();
    },
};

function loadLaporan() { LaporanPage.load(); }
