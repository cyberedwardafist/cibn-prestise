// admin/paket-form.js
// Form Tambah/Edit Paket (fullscreen) — dipisah dari admin/keuangan.js supaya
// file keuangan.js tetap ringan; ini isinya cuma logic buka/isi/submit form.
// Markup-nya ada di admin/paket-form.html (dimuat bareng sebagai 'modals'
// lewat ADMIN_PAGE_MODULES.keuangan di js/app.js).
// Butuh _paketData & _ldPaketCache (dideklarasikan di admin/keuangan.js) serta
// helper global dari js/app.js (showToast, openModal, closeModal, dst).

let _editPaketKode = null;

async function openAddPaket() {
    _editPaketKode = null;
    document.getElementById('paket-form-title').textContent = 'Tambah Paket';
    document.getElementById('pf-id').value = '';
    document.getElementById('pf-nama').value = '';
    document.getElementById('pf-icon').value = '📦';
    document.getElementById('pf-harga').value = '';
    document.getElementById('pf-periode').value = '/bulan';
    document.getElementById('pf-desc').value = '';
    document.getElementById('pf-fitur').value = '';
    document.getElementById('pf-warna').value = 'blue';
    document.getElementById('pf-popular').checked = false;
    var _ci = document.getElementById('pf-periode-custom'); if(_ci){_ci.style.display='none';_ci.value='';}
    document.querySelectorAll('input[name="pf-hak"]').forEach(cb=>cb.checked=false);
    document.querySelectorAll('input[name="pf-aturan"]').forEach(cb=>cb.checked=false);
    document.querySelectorAll('.hak-sub').forEach(s=>{s.style.display='none';});
    document.querySelectorAll('.hak-chevron').forEach(c=>{c.style.transform='';});
    var mn=document.getElementById('pf-maks-ujian');if(mn)mn.value='';
    var dh=document.getElementById('pf-durasi-hari');if(dh)dh.value='';
    var hn=document.getElementById('pf-hak-notes');if(hn)hn.value='';
    await _populateLinkLandingDropdown('');
    openModal('paket-form-overlay');
}

async function openEditPaket(kode) {
    const p = _paketData.find(x => (x.kode||x.id) == kode);
    if (!p) return;
    _editPaketKode = kode;
    document.getElementById('paket-form-title').textContent = 'Edit Paket';
    document.getElementById('pf-id').value = kode;
    document.getElementById('pf-nama').value = p.nama || '';
    document.getElementById('pf-icon').value = p.icon || '📦';
    document.getElementById('pf-harga').value = p.harga || '';
    var _pOpts = ['/bulan','/tahun','/hari','sekali bayar'];
    var _pVal = p.periode || (p.periode_tipe ? '/'+p.periode_tipe : '/bulan');
    var _pEl = document.getElementById('pf-periode');
    var _cEl = document.getElementById('pf-periode-custom');
    if(_pOpts.includes(_pVal)){if(_pEl)_pEl.value=_pVal;if(_cEl){_cEl.style.display='none';_cEl.value='';}}
    else{if(_pEl)_pEl.value='custom';if(_cEl){_cEl.style.display='block';_cEl.value=_pVal;}}
    document.getElementById('pf-desc').value = p.deskripsi || p.desc || '';
    document.getElementById('pf-fitur').value = Array.isArray(p.fitur) ? p.fitur.join('\n') : (p.fitur || '');
    document.getElementById('pf-warna').value = p.warna || 'blue';
    document.getElementById('pf-popular').checked = !!p.popular;
    const hakArr = Array.isArray(p.hak_akses) ? p.hak_akses : (p.hak_akses ? (() => { try { return JSON.parse(p.hak_akses); } catch(e) { return []; } })() : []);
    const aturanArr = Array.isArray(p.aturan_akses) ? p.aturan_akses : (p.aturan_akses ? (() => { try { return JSON.parse(p.aturan_akses); } catch(e) { return []; } })() : []);
    document.querySelectorAll('input[name="pf-hak"]').forEach(cb=>{cb.checked=hakArr.includes(cb.value);});
    document.querySelectorAll('input[name="pf-aturan"]').forEach(cb=>{cb.checked=aturanArr.includes(cb.value);});
    document.querySelectorAll('.hak-sub').forEach(s=>{s.style.display='none';});
    document.querySelectorAll('.hak-chevron').forEach(c=>{c.style.transform='';});
    var mn=document.getElementById('pf-maks-ujian');if(mn)mn.value=p.maks_ujian||'';
    var dh=document.getElementById('pf-durasi-hari');if(dh)dh.value=p.durasi_hari||'';
    var hn=document.getElementById('pf-hak-notes');if(hn)hn.value=p.hak_notes||'';
    await _populateLinkLandingDropdown(p.link_landing || '');
    openModal('paket-form-overlay');
}

// Populate dropdown link ke paket landing (membaca dari server)
async function _populateLinkLandingDropdown(currentVal) {
    const sel = document.getElementById('pf-link-landing');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Tidak dihubungkan / berdiri sendiri --</option>';
    // Muat paket landing dari server jika belum ada
    if (!_ldPaketCache.length) {
        try {
            const ld = await LandingAPI.get().catch(() => ({}));
            _ldPaketCache = (ld && ld.paket && ld.paket.list) ? ld.paket.list : [];
        } catch(e) { _ldPaketCache = []; }
    }
    if (_ldPaketCache.length) {
        _ldPaketCache.forEach((p, i) => {
            const val = p.kode || ('ldp_' + i);
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = (p.name || 'Paket ' + (i+1)) + (p.price ? ' · ' + p.price : '');
            if (currentVal && currentVal === val) opt.selected = true;
            sel.appendChild(opt);
        });
    } else {
        const opt = document.createElement('option');
        opt.disabled = true;
        opt.textContent = '(Belum ada paket di Landing Page Editor)';
        sel.appendChild(opt);
    }
}

async function submitPaket() {
    const nama = document.getElementById('pf-nama').value.trim();
    if (!nama) { showToast('Nama paket wajib diisi', 'danger'); return; }
    const hak_akses = [...document.querySelectorAll('input[name="pf-hak"]:checked')].map(cb=>cb.value);
    const aturan_akses = [...document.querySelectorAll('input[name="pf-aturan"]:checked')].map(cb=>cb.value);
    const periodeVal = (function(){
        var sel = document.getElementById('pf-periode').value;
        if (sel === 'custom') { var c = document.getElementById('pf-periode-custom'); return (c && c.value.trim()) ? c.value.trim() : '/bulan'; }
        return sel;
    })();
    // Hitung periode_hari dari periodeVal
    const periodeToHari = {'/hari':1,'/minggu':7,'/bulan':30,'/tahun':365,'sekali bayar':36500};
    const periode_hari = periodeToHari[periodeVal] || 30;
    const paket = {
        nama,
        deskripsi: document.getElementById('pf-desc').value.trim(),
        icon: document.getElementById('pf-icon').value.trim() || '📦',
        harga: parseInt(document.getElementById('pf-harga').value || '0'),
        periode: periodeVal,
        periode_tipe: periodeVal.replace('/','').split(' ')[0] || 'bulan',
        periode_hari,
        fitur: document.getElementById('pf-fitur').value.trim(),
        warna: document.getElementById('pf-warna').value,
        popular: document.getElementById('pf-popular').checked,
        status: 'aktif',
        link_landing: (document.getElementById('pf-link-landing')?.value || ''),
        hak_akses: JSON.stringify(hak_akses),
        aturan_akses: JSON.stringify(aturan_akses),
        maks_ujian: document.getElementById('pf-maks-ujian')?.value || '',
        durasi_hari: document.getElementById('pf-durasi-hari')?.value || '',
        hak_notes: document.getElementById('pf-hak-notes')?.value?.trim() || ''
    };
    const btn = document.querySelector('#paket-form-overlay .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
    try {
        if (_editPaketKode) {
            await PaketAPI.update(_editPaketKode, paket);
            showToast('Paket diperbarui!', 'success');
        } else {
            await PaketAPI.create(paket);
            showToast('Paket ditambahkan!', 'success');
        }
        clearDirty();
        closeModal('paket-form-overlay');
        await renderPaketGrid();
    } catch(e) {
        showToast('Gagal: ' + e.message, 'danger');
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Simpan Paket'; }
}

function deletePaket(kode, nama) {
    showConfirm('Hapus Paket', `Yakin hapus paket "${nama}"?`, 'danger', async () => {
        try {
            await PaketAPI.delete(kode);
            showToast('Paket dihapus', 'danger');
            await renderPaketGrid();
        } catch(e) { showToast('Gagal hapus: ' + e.message, 'danger'); }
    });
}
