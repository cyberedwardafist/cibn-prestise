// admin/landing.js
// Modul LANDING PAGE EDITOR — lazy-load saat tab Landing dibuka. Ini modul terbesar (~570 baris) jadi paling besar dampaknya buat initial load.
// Bergantung pada helper global dari js/app.js (showToast, openModal, navigateTo, dst)
// yang sudah dimuat lebih dulu lewat shell index_admin.html.

function renderLanding() {
    // Panel navigasi landing (vertikal) tampil di samping — main-dock TIDAK disembunyikan,
    // jadi keluar dari mode landing cukup klik menu lain di main-dock.
    const ldWrap = document.getElementById('landing-dock-wrap');
    if (ldWrap) ldWrap.classList.add('open');

    // Sembunyikan page-container scroll
    const pc = document.querySelector('.page-container');
    if (pc) pc.style.overflow = 'hidden';

    // Init editor hanya sekali. _ldEditorInitialized tidak pernah dideklarasikan
    // dengan let/var, jadi baca langsung (!_ldEditorInitialized) di percobaan
    // PERTAMA akan ReferenceError — pakai typeof supaya aman.
    if (typeof _ldEditorInitialized === 'undefined' || !_ldEditorInitialized) {
        _ldEditorInitialized = true;
        ldInitAllData();
    }

    // Aktifkan panel pertama (Hero) dan update dock
    ldShowPanel('hero');
}

function landingNav(panel) {
    ldShowPanel(panel);
    document.querySelectorAll('.landing-nav-btn').forEach(b =>
        b.classList.toggle('active-tab', b.dataset.panel === panel));
}

// ── AUTO-SAVE: setiap perubahan di editor landing langsung tersimpan ke server ──
// (tidak ada lagi tombol UPDATE manual — dipanggil dari listener input/change
// di ld-editor-main, dari tiap ldRender*(), dan dari upload/reset avatar)
let _ldDataReady = false;
let _ldAutoSaveTimer = null;
function ldQueueAutoSave() {
    if (!_ldDataReady) return; // jangan simpan saat data awal masih dimuat/dirender
    clearTimeout(_ldAutoSaveTimer);
    _ldAutoSaveTimer = setTimeout(() => ldExportHTML(true), 900);
}



// ── LD EDITOR: Panel navigation ──
function ldShowPanel(name) {
    document.querySelectorAll('.ld-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('ld-panel-' + name);
    if (panel) panel.classList.add('active');
    document.querySelectorAll('.landing-nav-btn').forEach(b =>
        b.classList.toggle('active-tab', b.dataset.panel === name));

}

// ── LD EDITOR: Data models ──
let ldFiturCards = [
    {icon:'🎯', title:'Bank Soal Adaptif', desc:'Sistem AI yang menyesuaikan tingkat kesulitan soal berdasarkan kemampuan real-time peserta.'},
    {icon:'📊', title:'Analitik Mendalam', desc:'Dashboard canggih dengan insight performa, tren belajar, dan rekomendasi peningkatan personal.'},
    {icon:'🔒', title:'Ujian Aman', desc:'Teknologi anti-kecurangan berlapis dengan pengawasan AI dan enkripsi data tingkat enterprise.'},
    {icon:'📱', title:'Multi-Platform', desc:'Belajar di mana saja – desktop, tablet, dan smartphone dengan sinkronisasi otomatis lintas perangkat.'},
    {icon:'🤖', title:'Asisten AI 24/7', desc:'Tanya jawab instan dengan AI tutor yang memahami konteks materi dan memberikan penjelasan mendalam.'},
    {icon:'🏅', title:'Sertifikat Digital', desc:'Sertifikat blockchain-verified yang dapat diverifikasi langsung oleh perusahaan dan institusi terkait.'},
];

let ldPaketData = [
    {name:'Starter', price:'Rp149K', unit:'/bulan', desc:'Cocok untuk pemula yang ingin mulai berlatih', featured:false,
     features:['Akses 50 soal per hari','5 simulasi ujian / bulan','Laporan dasar','Akses komunitas'], btnText:'Mulai Sekarang'},
    {name:'Professional', price:'Rp299K', unit:'/bulan', desc:'Solusi lengkap untuk profesional yang serius', featured:true,
     features:['Soal tanpa batas','Simulasi ujian tidak terbatas','Analitik mendalam','AI Tutor 24/7','Sertifikat digital','Mentoring 2x/bulan'], btnText:'Pilih Professional'},
    {name:'Enterprise', price:'Custom', unit:'', desc:'Untuk institusi dan perusahaan dengan kebutuhan khusus', featured:false,
     features:['Lisensi multi-pengguna','Dashboard admin khusus','Integrasi API','Pelatihan tim dedicated','SLA & dukungan prioritas'], btnText:'Hubungi Kami'},
];

let ldMateriData = [
    {title:'Akuntansi & Keuangan', desc:'PSAK, perpajakan, audit, dan manajemen keuangan', tag:'38 Modul'},
    {title:'Manajemen SDM', desc:'Rekrutmen, pelatihan, kompensasi, dan hubungan kerja', tag:'24 Modul'},
    {title:'Teknologi Informasi', desc:'Keamanan siber, cloud computing, dan tata kelola IT', tag:'42 Modul'},
    {title:'Hukum & Kepatuhan', desc:'Regulasi perbankan, pasar modal, dan hukum bisnis', tag:'30 Modul'},
    {title:'Perbankan & Fintech', desc:'Produk perbankan, digital payment, dan fintech regulation', tag:'36 Modul'},
    {title:'Manajemen Risiko', desc:'ERM, Basel III, stress testing, dan mitigasi risiko', tag:'28 Modul'},
    {title:'Kepemimpinan & Strategi', desc:'Leadership, strategic planning, dan change management', tag:'20 Modul'},
    {title:'Asuransi & Investasi', desc:'Produk asuransi, analisis investasi, dan portofolio', tag:'32 Modul'},
];

let ldTestiData = [
    {stars:5, text:'Platform yang luar biasa! Saya lulus ujian WMI dalam sekali coba setelah berlatih intensif di sini. Materinya sangat komprehensif.', initials:'AR', name:'Ahmad Rizky', role:'Wealth Manager · BRI'},
    {stars:5, text:'Analitik performanya sangat detail. Saya bisa tahu persis kelemahan saya di bagian mana dan fokus belajar di sana.', initials:'DP', name:'Dewi Puspita', role:'Compliance Officer · Mandiri'},
    {stars:5, text:'AI Tutor-nya sangat membantu! Kapanpun ada pertanyaan, langsung dijawab dengan penjelasan yang mudah dipahami.', initials:'BH', name:'Budi Hartono', role:'Risk Analyst · BNI'},
    {stars:4, text:'Soal-soalnya sangat relevan dengan ujian asli. Berasa seperti latihan sungguhan. Recommended banget untuk semua profesional.', initials:'SM', name:'Siti Mardiana', role:'Auditor · Deloitte Indonesia'},
    {stars:5, text:'Interface-nya elegan dan tidak membingungkan. Mudah digunakan bahkan untuk yang tidak terlalu melek teknologi sekalipun.', initials:'RN', name:'Rudi Nugroho', role:'Branch Manager · BCA'},
];

let ldFaqData = [
    {q:'Apakah saya bisa mencoba sebelum berlangganan?', a:'Ya! Kami menyediakan akses uji coba gratis dengan soal terbatas. Anda bisa langsung mencoba tanpa perlu mendaftar terlebih dahulu.'},
    {q:'Bagaimana sistem pembayaran berlaku?', a:'Kami menerima transfer bank, kartu kredit/debit, e-wallet (GoPay, OVO, Dana), dan QRIS. Pembayaran diproses secara aman dengan enkripsi SSL.'},
    {q:'Apakah materi selalu diperbarui?', a:'Ya, tim konten kami secara rutin memperbarui materi sesuai perkembangan regulasi dan standar industri terbaru.'},
    {q:'Apakah sertifikat dari CIBN Akademi diakui?', a:'Sertifikat kami diakui oleh berbagai institusi keuangan, perusahaan, dan lembaga pemerintah di Indonesia.'},
    {q:'Bagaimana jika tidak lulus ujian sertifikasi?', a:'Kami menawarkan program remedial gratis dan analisis mendalam tentang area yang perlu ditingkatkan.'},
    {q:'Berapa lama akses berlaku setelah berlangganan?', a:'Akses berlaku sesuai paket yang dipilih (bulanan atau tahunan). Paket tahunan mendapat diskon hingga 30%.'},
];

let ldSoalData = [
    {q:'Apa kepanjangan dari OJK dalam sistem keuangan Indonesia?', opts:['Otoritas Jasa Keuangan','Organisasi Jasa Keuangan','Otoritas Jaminan Keuangan','Operasional Jasa Keuangan'], ans:0},
    {q:'Rasio kecukupan modal minimum bank umum menurut regulasi Basel III adalah…', opts:['6%','8%','10%','12%'], ans:1},
    {q:'Manakah yang termasuk instrumen pasar uang?', opts:['Obligasi jangka panjang','Sertifikat Bank Indonesia (SBI)','Saham biasa','Reksadana saham'], ans:1},
    {q:"Prinsip 'Know Your Customer' (KYC) terutama bertujuan untuk…", opts:['Meningkatkan profit bank','Mencegah pencucian uang dan pendanaan terorisme','Mempercepat layanan nasabah','Mengurangi biaya operasional'], ans:1},
    {q:'Value at Risk (VaR) digunakan untuk mengukur…', opts:['Profitabilitas portofolio','Potensi kerugian maksimum pada tingkat kepercayaan tertentu','Kecepatan perputaran aset','Rasio likuiditas jangka pendek'], ans:1},
];

let ldFooterPlatform = [
    {text:'Fitur Unggulan',href:'#'},{text:'Bank Soal',href:'#'},{text:'Simulasi Ujian',href:'#'},{text:'AI Tutor',href:'#'},{text:'Sertifikasi',href:'#'},
];
let ldFooterPerusahaan = [
    {text:'Tentang Kami',href:'#'},{text:'Tim Pengajar',href:'#'},{text:'Blog & Artikel',href:'#'},{text:'Karir',href:'#'},{text:'Kebijakan Privasi',href:'#'},
];
let ldSocialData = [
    {label:'Instagram',short:'ig',href:'#'},{label:'LinkedIn',short:'in',href:'#'},{label:'YouTube',short:'yt',href:'#'},{label:'Twitter/X',short:'x',href:'#'},{label:'WhatsApp',short:'wa',href:'#'},
];
let ldChatQuickData = [
    {icon:'💎', text:'Info Paket', reply:'Kami memiliki 3 paket: Starter (Rp149K/bln), Professional (Rp299K/bln), dan Enterprise (custom).'},
    {icon:'📝', text:'Cara Daftar', reply:'Daftar sangat mudah! Klik tombol "Masuk" lalu pilih "Daftar Sekarang". Prosesnya hanya 2 menit.'},
    {icon:'📚', text:'Materi', reply:'Kami punya 200+ modul mencakup Akuntansi, SDM, IT, Hukum, Perbankan, dan banyak lagi!'},
    {icon:'▶', text:'Coba Ujian Gratis', reply:'Klik tombol "Coba Ujian Gratis" di halaman ini untuk mencoba 5 soal demo tanpa perlu daftar!'},
];
let ldKeywordData = [
    {keyword:'harga', reply:'Paket kami mulai dari Rp149K/bulan. Lihat detail lengkap di bagian Paket Harga!'},
    {keyword:'sertifikat', reply:'Sertifikat kami diakui berbagai institusi keuangan di Indonesia, dilengkapi teknologi blockchain.'},
    {keyword:'diskon', reply:'Kami menawarkan diskon hingga 30% untuk paket tahunan!'},
];
let ldAvatarData = null;

function ldInitAllData() {
    // Muat data dari SERVER via API /api/landing dan /api/pakets secara paralel
    Promise.all([
        fetch(window.location.origin + '/api/landing').then(r => r.json()).catch(() => null),
        PaketAPI.getAll().catch(() => [])
    ]).then(([saved, keuanganPakets]) => {
        _keuanganPaketsForLanding = keuanganPakets || [];
        _ldApplyLoadedData(saved || null);
    }).catch(() => { _ldApplyLoadedData(null); });
}

function _ldApplyLoadedData(saved) {
    try {
        if (saved && Object.keys(saved).length > 0) {
            const setV = (id, v) => { const el = document.getElementById(id); if(el && v != null) el.value = v; };
            // Nav
            if (saved.nav) {
                const n = saved.nav;
                setV('nav_brand', n.brand); setV('nav_subbrand', n.subbrand); setV('nav_cta', n.cta);
                if (n.menus && n.menus.length >= 5) {
                    setV('nav_m1_text', n.menus[0].text); setV('nav_m1_href', n.menus[0].href);
                    setV('nav_m2_text', n.menus[1].text); setV('nav_m2_href', n.menus[1].href);
                    setV('nav_m3_text', n.menus[2].text); setV('nav_m3_href', n.menus[2].href);
                    setV('nav_m4_text', n.menus[3].text); setV('nav_m4_href', n.menus[3].href);
                    setV('nav_m5_text', n.menus[4].text); setV('nav_m5_href', n.menus[4].href);
                }
            }
            if (saved.pageTitle) setV('page_title', saved.pageTitle);
            // Hero
            if (saved.hero) {
                const h = saved.hero;
                setV('hero_badge', h.badge); setV('hero_h1_1', h.h1?.[0]); setV('hero_h1_2', h.h1?.[1]); setV('hero_h1_3', h.h1?.[2]);
                setV('hero_sub', h.sub); setV('hero_btn1', h.btn1); setV('hero_btn2', h.btn2); setV('hero_btn2_href', h.btn2href);
                if (h.stats?.length >= 3) {
                    setV('stat1_num', h.stats[0].num); setV('stat1_label', h.stats[0].label);
                    setV('stat2_num', h.stats[1].num); setV('stat2_label', h.stats[1].label);
                    setV('stat3_num', h.stats[2].num); setV('stat3_label', h.stats[2].label);
                }
            }
            // Coba
            if (saved.coba) {
                const c = saved.coba;
                setV('coba_tag', c.tag); setV('coba_title', c.title); setV('coba_sub', c.sub);
                setV('coba_card_title', c.cardTitle); setV('coba_card_desc', c.cardDesc); setV('coba_btn', c.btn);
            }
            // Promo
            if (saved.promo) {
                const p = saved.promo;
                setV('promo_tag', p.tag); setV('promo_h2_1', p.h2_1); setV('promo_h2_2', p.h2_2); setV('promo_desc', p.desc);
            }
            // Mitra
            if (saved.mitra) {
                const m = saved.mitra;
                setV('mitra_tag', m.tag); setV('mitra_title', m.title); setV('mitra_sub', m.sub);
                if (m.list) setV('mitra_list', m.list.join('\n'));
            }
            // Fitur
            if (saved.fitur) {
                setV('fitur_tag', saved.fitur.tag); setV('fitur_title', saved.fitur.title); setV('fitur_sub', saved.fitur.sub);
                if (saved.fitur.cards) ldFiturCards = saved.fitur.cards;
            }
            // Paket
            if (saved.paket) {
                setV('paket_tag', saved.paket.tag); setV('paket_title', saved.paket.title); setV('paket_sub', saved.paket.sub);
                if (saved.paket.list) ldPaketData = saved.paket.list;
            }
            // Materi
            if (saved.materi) {
                setV('materi_tag', saved.materi.tag); setV('materi_title', saved.materi.title); setV('materi_sub', saved.materi.sub);
                if (saved.materi.list) ldMateriData = saved.materi.list;
            }
            // Testi
            if (saved.testi) {
                setV('testi_tag', saved.testi.tag); setV('testi_title', saved.testi.title);
                if (saved.testi.list) ldTestiData = saved.testi.list;
            }
            // FAQ
            if (saved.faq) {
                setV('faq_tag', saved.faq.tag); setV('faq_title', saved.faq.title);
                if (saved.faq.list) ldFaqData = saved.faq.list;
            }
            // Soal
            if (saved.soal) ldSoalData = saved.soal;
            // Footer
            if (saved.footer) {
                const f = saved.footer;
                setV('footer_brand_desc', f.brandDesc); setV('footer_copy', f.copy); setV('footer_reg', f.reg);
                setV('footer_phone', f.phone); setV('footer_email', f.email); setV('footer_address', f.address);
                setV('canvas_text', f.canvasText);
                if (f.platform) ldFooterPlatform = f.platform;
                if (f.perusahaan) ldFooterPerusahaan = f.perusahaan;
                if (f.social) ldSocialData = f.social;
            }
            // Chat
            if (saved.chat) {
                const c = saved.chat;
                setV('chat_name', c.name); setV('chat_status', c.status); setV('chat_greeting', c.greeting);
                setV('chat_placeholder', c.placeholder); setV('chat_default_reply', c.defaultReply);
                if (c.quickReplies) ldChatQuickData = Object.entries(c.quickReplies).map(([k,v])=>{const parts=k.split(' ');return{icon:parts[0]||'💬',text:parts.slice(1).join(' ')||k,reply:v};});
                if (c.keywords) ldKeywordData = c.keywords;
                if (c.avatar) { ldAvatarData = c.avatar; const preview = document.getElementById('avatar-preview'); if(preview) preview.innerHTML = `<img src="${c.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`; }
            }
            // SK & KP
            if (saved.sk) { setV('sk_title', saved.sk.title); setV('sk_content', saved.sk.content); }
            if (saved.kp) { setV('kp_title', saved.kp.title); setV('kp_content', saved.kp.content); }
        }
    } catch(e) { console.warn('[Landing Editor] Gagal muat data:', e); }

    ldRenderFiturCards();
    ldRenderPaket();
    ldRenderMateri();
    ldRenderTesti();
    ldRenderFaq();
    ldRenderSoal();
    ldRenderFooterLinks();
    ldRenderChatQuick();
    ldRenderKeywords();
    _ldDataReady = true;
}

// ── Fitur Cards ──
function ldRenderFiturCards() {
    const c = document.getElementById('fitur-cards-list'); if (!c) return;
    c.innerHTML = ldFiturCards.map((f, i) => `
        <div class="ld-repeat-item">
            <div class="ld-repeat-hd"><span class="ld-repeat-title">${f.icon} Kartu ${i+1}</span><button class="ld-btn-remove" onclick="ldFiturCards.splice(${i},1);ldRenderFiturCards()">Hapus</button></div>
            <div class="ld-field-group ld-cols-2">
                <div class="ld-field"><label>Ikon (emoji)</label><input type="text" value="${f.icon}" oninput="ldFiturCards[${i}].icon=this.value"></div>
                <div class="ld-field"><label>Judul</label><input type="text" value="${f.title}" oninput="ldFiturCards[${i}].title=this.value"></div>
                <div class="ld-field" style="grid-column:1/-1"><label>Deskripsi</label><textarea oninput="ldFiturCards[${i}].desc=this.value">${f.desc}</textarea></div>
            </div>
        </div>`).join('');
    ldQueueAutoSave();
}
function addFiturCard() { ldFiturCards.push({icon:'⭐',title:'Fitur Baru',desc:'Deskripsi fitur baru di sini.'}); ldRenderFiturCards(); }

// ── Paket ──
// Cache paket keuangan dari server (diisi oleh ldLoadKeuanganPakets)
let _keuanganPaketsForLanding = [];
async function ldLoadKeuanganPakets() {
    try {
        _keuanganPaketsForLanding = await PaketAPI.getAll().catch(() => []);
    } catch(e) { _keuanganPaketsForLanding = []; }
    ldRenderPaket();
}
function ldRenderPaket() {
    const c = document.getElementById('paket-list'); if (!c) return;
    // Ambil daftar paket keuangan dari server (cache)
    const keuanganPakets = _keuanganPaketsForLanding;
    c.innerHTML = ldPaketData.map((p, i) => {
        const linkVal = p.link_keuangan !== undefined ? p.link_keuangan : '';
        // Cari nama paket keuangan yang terhubung
        const linkedKeu = keuanganPakets.find(kp => (kp.kode||kp.id) === linkVal);
        const linkStatus = linkVal
            ? (linkedKeu
                ? `<div style="margin-top:6px;font-size:10px;color:#16a34a;background:rgba(22,163,74,0.08);border:1px solid rgba(22,163,74,0.2);border-radius:6px;padding:4px 8px">✅ Terhubung ke: <strong>${linkedKeu.nama}</strong> (Rp ${parseInt(linkedKeu.harga||0).toLocaleString('id-ID')})</div>`
                : `<div style="margin-top:6px;font-size:10px;color:#d97706;background:rgba(217,119,6,0.08);border:1px solid rgba(217,119,6,0.2);border-radius:6px;padding:4px 8px">⚠️ Paket keuangan tidak ditemukan</div>`)
            : '';
    return `
        <div class="ld-card">
            <div class="ld-card-hd">
                <div class="ld-sc-icon">${p.featured?'⭐':'📦'}</div>
                <div style="flex:1"><h3>Paket ${i+1}: ${p.name}${p.featured?' <span style="background:var(--blue,#133259);color:#fff;font-size:.6rem;padding:.1rem .4rem;border-radius:4px">Terpopuler</span>':''}</h3><p>Edit detail paket ini</p></div>
                ${ldPaketData.length>1?`<button class="ld-btn-remove" onclick="ldPaketData.splice(${i},1);ldRenderPaket()">🗑 Hapus</button>`:''}
            </div>
            <div class="ld-field-group">
                <!-- Link ke Paket Keuangan -->
                <div class="ld-field" style="background:rgba(26,90,160,0.05);border:1.5px solid rgba(26,90,160,0.15);border-radius:10px;padding:10px 12px">
                    <label style="display:flex;align-items:center;gap:5px">🔗 Hubungkan dengan Paket Keuangan <span style="font-size:.68rem;color:var(--text-sub);font-weight:400">(opsional)</span></label>
                    <select onchange="ldPaketData[${i}].link_keuangan=this.value;ldRenderPaket()" style="margin-top:4px">
                        <option value="" ${!linkVal?'selected':''}>-- Tidak dihubungkan --</option>
                        ${keuanganPakets.map(kp=>`<option value="${kp.kode||kp.id}" ${linkVal===(kp.kode||kp.id)?'selected':''}>${kp.nama}${kp.harga?' · Rp '+parseInt(kp.harga||0).toLocaleString('id-ID'):''}</option>`).join('')}
                        ${!keuanganPakets.length?'<option disabled>(Buat paket di menu Keuangan dulu)</option>':''}
                    </select>
                    ${linkStatus}
                    <div class="ld-hint">Pilih paket dari menu Keuangan. Harga & checkout akan terhubung otomatis.</div>
                </div>
            </div>
            <div class="ld-field-group ld-cols-2" style="margin-top:.8rem">
                <div class="ld-field"><label>Nama Paket</label><input type="text" value="${p.name}" oninput="ldPaketData[${i}].name=this.value"></div>
                <div class="ld-field"><label>Harga</label><input type="text" value="${p.price}" oninput="ldPaketData[${i}].price=this.value"></div>
                <div class="ld-field"><label>Satuan (misal: /bulan)</label><input type="text" value="${p.unit}" oninput="ldPaketData[${i}].unit=this.value"></div>
                <div class="ld-field"><label>Teks Tombol</label><input type="text" value="${p.btnText}" oninput="ldPaketData[${i}].btnText=this.value"></div>
                <div class="ld-field" style="grid-column:1/-1"><label>Deskripsi Singkat</label><input type="text" value="${p.desc}" oninput="ldPaketData[${i}].desc=this.value"></div>
                <div class="ld-field" style="grid-column:1/-1"><label>Fitur-fitur (satu per baris)</label><textarea oninput="ldPaketData[${i}].features=this.value.split('\\n').filter(x=>x.trim())">${Array.isArray(p.features)?p.features.join('\n'):p.features}</textarea></div>
                <div class="ld-field" style="grid-column:1/-1"><label>Tandai sebagai paket terpopuler?</label>
                    <select onchange="ldPaketData[${i}].featured=this.value==='ya';ldRenderPaket()">
                        <option value="tidak" ${!p.featured?'selected':''}>Tidak</option>
                        <option value="ya" ${p.featured?'selected':''}>Ya (badge Terpopuler)</option>
                    </select>
                </div>
            </div>
        </div>`}).join('') + `<div style="text-align:center;padding:.8rem 0"><button class="ld-btn-add" onclick="ldAddPaket()" style="max-width:260px">+ Tambah Paket Baru</button></div>`;
    ldQueueAutoSave();
}
function ldAddPaket() {
    ldPaketData.push({name:'Paket Baru',price:'Rp0',unit:'/bulan',desc:'Deskripsi paket baru',featured:false,features:['Fitur 1','Fitur 2','Fitur 3'],btnText:'Pilih Paket'});
    ldRenderPaket();
}

// ── Materi ──
function ldRenderMateri() {
    const c = document.getElementById('materi-list'); if (!c) return;
    c.innerHTML = ldMateriData.map((m, i) => `
        <div class="ld-repeat-item">
            <div class="ld-repeat-hd"><span class="ld-repeat-title">📖 Materi ${String(i+1).padStart(2,'0')}</span><button class="ld-btn-remove" onclick="ldMateriData.splice(${i},1);ldRenderMateri()">Hapus</button></div>
            <div class="ld-field-group ld-cols-2">
                <div class="ld-field"><label>Judul</label><input type="text" value="${m.title}" oninput="ldMateriData[${i}].title=this.value"></div>
                <div class="ld-field"><label>Tag Modul</label><input type="text" value="${m.tag}" oninput="ldMateriData[${i}].tag=this.value"></div>
                <div class="ld-field" style="grid-column:1/-1"><label>Deskripsi</label><input type="text" value="${m.desc}" oninput="ldMateriData[${i}].desc=this.value"></div>
            </div>
        </div>`).join('');
    ldQueueAutoSave();
}
function addMateri() { ldMateriData.push({title:'Materi Baru',desc:'Deskripsi materi baru',tag:'0 Modul'}); ldRenderMateri(); }

// ── Testimoni ──
function ldRenderTesti() {
    const c = document.getElementById('testi-list'); if (!c) return;
    c.innerHTML = ldTestiData.map((t, i) => `
        <div class="ld-repeat-item">
            <div class="ld-repeat-hd"><span class="ld-repeat-title">⭐ Testimoni ${i+1}</span><button class="ld-btn-remove" onclick="ldTestiData.splice(${i},1);ldRenderTesti()">Hapus</button></div>
            <div class="ld-field-group ld-cols-2">
                <div class="ld-field"><label>Nama</label><input type="text" value="${t.name}" oninput="ldTestiData[${i}].name=this.value"></div>
                <div class="ld-field"><label>Jabatan / Role</label><input type="text" value="${t.role}" oninput="ldTestiData[${i}].role=this.value"></div>
                <div class="ld-field"><label>Inisial Avatar (2 huruf)</label><input type="text" maxlength="2" value="${t.initials}" oninput="ldTestiData[${i}].initials=this.value.toUpperCase()"></div>
                <div class="ld-field"><label>Bintang (1-5)</label><input type="number" min="1" max="5" value="${t.stars}" oninput="ldTestiData[${i}].stars=parseInt(this.value)"></div>
                <div class="ld-field" style="grid-column:1/-1"><label>Teks Kutipan</label><textarea oninput="ldTestiData[${i}].text=this.value">${t.text}</textarea></div>
            </div>
        </div>`).join('');
    ldQueueAutoSave();
}
function addTesti() { ldTestiData.push({stars:5,text:'Testimoni baru di sini.',initials:'XX',name:'Nama Peserta',role:'Jabatan · Perusahaan'}); ldRenderTesti(); }

// ── FAQ ──
function ldRenderFaq() {
    const c = document.getElementById('faq-list'); if (!c) return;
    c.innerHTML = ldFaqData.map((f, i) => `
        <div class="ld-repeat-item">
            <div class="ld-repeat-hd"><span class="ld-repeat-title">❓ FAQ ${i+1}</span><button class="ld-btn-remove" onclick="ldFaqData.splice(${i},1);ldRenderFaq()">Hapus</button></div>
            <div class="ld-field-group">
                <div class="ld-field"><label>Pertanyaan</label><input type="text" value="${f.q.replace(/'/g,"&#39;")}" oninput="ldFaqData[${i}].q=this.value"></div>
                <div class="ld-field"><label>Jawaban</label><textarea oninput="ldFaqData[${i}].a=this.value">${f.a}</textarea></div>
            </div>
        </div>`).join('');
    ldQueueAutoSave();
}
function addFaq() { ldFaqData.push({q:'Pertanyaan baru?',a:'Jawaban di sini.'}); ldRenderFaq(); }

// ── Soal ──
function ldRenderSoal() {
    const c = document.getElementById('soal-list'); if (!c) return;
    const letters = ['A','B','C','D','E'];
    c.innerHTML = ldSoalData.map((s, i) => `
        <div class="ld-repeat-item">
            <div class="ld-repeat-hd"><span class="ld-repeat-title">📝 Soal ${i+1}</span><button class="ld-btn-remove" onclick="ldSoalData.splice(${i},1);ldRenderSoal()">Hapus</button></div>
            <div class="ld-field"><label>Pertanyaan</label><textarea oninput="ldSoalData[${i}].q=this.value">${s.q}</textarea></div>
            <div style="margin-top:.8rem">
                <label style="font-size:.7rem;font-weight:700;color:var(--blue,#133259);letter-spacing:.06em;text-transform:uppercase;display:block;margin-bottom:.5rem">Pilihan Jawaban (klik untuk tandai jawaban benar)</label>
                ${s.opts.map((opt, j) => `
                    <div class="ld-radio-option ${s.ans===j?'correct-ans':''}" onclick="ldSoalData[${i}].ans=${j};ldRenderSoal()">
                        <input type="radio" name="ldsoal_${i}" ${s.ans===j?'checked':''}>
                        <strong>${letters[j]||j+1}</strong>
                        <input type="text" value="${opt}" oninput="ldSoalData[${i}].opts[${j}]=this.value" style="border:none;outline:none;flex:1;font-size:.84rem;background:transparent;cursor:text" onclick="event.stopPropagation()">
                    </div>`).join('')}
                <button class="ld-btn-add" style="margin-top:.5rem;font-size:.76rem;padding:.4rem .8rem;width:auto" onclick="ldSoalData[${i}].opts.push('Pilihan baru');ldRenderSoal()">+ Tambah Pilihan</button>
            </div>
        </div>`).join('');
    ldQueueAutoSave();
}
function addSoal() { ldSoalData.push({q:'Soal baru di sini?',opts:['Pilihan A','Pilihan B','Pilihan C','Pilihan D'],ans:0}); ldRenderSoal(); }

// ── Footer Links ──
function ldRenderFooterLinks() {
    const fp = document.getElementById('footer-platform-list');
    if (fp) fp.innerHTML = ldFooterPlatform.map((l,i)=>`
        <div class="ld-repeat-item" style="padding:.7rem .9rem;margin-bottom:.45rem">
            <div class="ld-link-row">
                <div class="ld-field"><label>Teks Link</label><input type="text" value="${l.text}" oninput="ldFooterPlatform[${i}].text=this.value"></div>
                <div class="ld-field"><label>URL / Href</label><input type="text" value="${l.href}" oninput="ldFooterPlatform[${i}].href=this.value" placeholder="https:// atau #anchor"></div>
            </div>
            <button class="ld-btn-remove" style="margin-top:.4rem" onclick="ldFooterPlatform.splice(${i},1);ldRenderFooterLinks()">Hapus</button>
        </div>`).join('');
    const fe = document.getElementById('footer-perusahaan-list');
    if (fe) fe.innerHTML = ldFooterPerusahaan.map((l,i)=>`
        <div class="ld-repeat-item" style="padding:.7rem .9rem;margin-bottom:.45rem">
            <div class="ld-link-row">
                <div class="ld-field"><label>Teks Link</label><input type="text" value="${l.text}" oninput="ldFooterPerusahaan[${i}].text=this.value"></div>
                <div class="ld-field"><label>URL / Href</label><input type="text" value="${l.href}" oninput="ldFooterPerusahaan[${i}].href=this.value" placeholder="https:// atau #anchor"></div>
            </div>
            <button class="ld-btn-remove" style="margin-top:.4rem" onclick="ldFooterPerusahaan.splice(${i},1);ldRenderFooterLinks()">Hapus</button>
        </div>`).join('');
    const fs = document.getElementById('footer-social-list');
    if (fs) fs.innerHTML = ldSocialData.map((s,i)=>`
        <div class="ld-repeat-item" style="padding:.7rem .9rem;margin-bottom:.45rem">
            <div class="ld-field-group ld-cols-2">
                <div class="ld-field"><label>Label</label><input type="text" value="${s.label}" oninput="ldSocialData[${i}].label=this.value"></div>
                <div class="ld-field"><label>Singkatan (teks tombol)</label><input type="text" maxlength="3" value="${s.short}" oninput="ldSocialData[${i}].short=this.value"></div>
                <div class="ld-field" style="grid-column:1/-1"><label>URL / Link</label><input type="text" value="${s.href}" oninput="ldSocialData[${i}].href=this.value" placeholder="https://instagram.com/..."></div>
            </div>
        </div>`).join('');
    ldQueueAutoSave();
}
function addFooterLink(col) {
    if(col==='platform') ldFooterPlatform.push({text:'Link Baru',href:'#'});
    else ldFooterPerusahaan.push({text:'Link Baru',href:'#'});
    ldRenderFooterLinks();
}

// ── Chatbot ──
function ldRenderChatQuick() {
    const c = document.getElementById('chat-quick-list'); if (!c) return;
    c.innerHTML = ldChatQuickData.map((q,i)=>`
        <div class="ld-repeat-item" style="padding:.7rem .9rem;margin-bottom:.45rem">
            <div class="ld-repeat-hd"><span class="ld-repeat-title">${q.icon} Tombol ${i+1}</span>${ldChatQuickData.length>1?`<button class="ld-btn-remove" onclick="ldChatQuickData.splice(${i},1);ldRenderChatQuick()">Hapus</button>`:''}</div>
            <div class="ld-field-group ld-cols-2">
                <div class="ld-field"><label>Ikon</label><input type="text" value="${q.icon}" oninput="ldChatQuickData[${i}].icon=this.value;ldRenderChatQuick()"></div>
                <div class="ld-field"><label>Teks Tombol</label><input type="text" value="${q.text}" oninput="ldChatQuickData[${i}].text=this.value"></div>
                <div class="ld-field" style="grid-column:1/-1"><label>Jawaban Bot untuk Tombol Ini</label><textarea style="min-height:58px" oninput="ldChatQuickData[${i}].reply=this.value">${q.reply||''}</textarea></div>
            </div>
        </div>`).join('') + `<button class="ld-btn-add" onclick="ldChatQuickData.push({icon:'💬',text:'Pertanyaan Baru',reply:'Tulis jawaban bot di sini.'});ldRenderChatQuick()">+ Tambah Tombol Quick Reply</button>`;
    ldQueueAutoSave();
}

function ldRenderKeywords() {
    const c = document.getElementById('chat-keyword-list'); if (!c) return;
    c.innerHTML = ldKeywordData.map((k,i)=>`
        <div class="ld-repeat-item" style="padding:.7rem .9rem;margin-bottom:.45rem">
            <div class="ld-repeat-hd"><span class="ld-repeat-title">🔑 Kata Kunci ${i+1}</span><button class="ld-btn-remove" onclick="ldKeywordData.splice(${i},1);ldRenderKeywords()">Hapus</button></div>
            <div class="ld-field-group ld-cols-2">
                <div class="ld-field"><label>Kata Kunci</label><input type="text" value="${k.keyword}" oninput="ldKeywordData[${i}].keyword=this.value" placeholder="contoh: harga, daftar, promo"></div>
                <div class="ld-field" style="grid-column:1/-1"><label>Jawaban Bot</label><textarea style="min-height:58px" oninput="ldKeywordData[${i}].reply=this.value">${k.reply||''}</textarea></div>
            </div>
        </div>`).join('') + `<button class="ld-btn-add" onclick="ldKeywordData.push({keyword:'kata-kunci',reply:'Tulis jawaban bot di sini.'});ldRenderKeywords()">+ Tambah Kata Kunci</button>`;
    ldQueueAutoSave();
}

function handleAvatarUpload(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        ldAvatarData = e.target.result;
        const preview = document.getElementById('avatar-preview');
        if (preview) preview.innerHTML = `<img src="${ldAvatarData}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
        ldQueueAutoSave();
    };
    reader.readAsDataURL(file);
}
function resetAvatar() {
    ldAvatarData = null;
    const preview = document.getElementById('avatar-preview');
    if (preview) preview.innerHTML = '🤖';
    const up = document.getElementById('chat_avatar_upload');
    if (up) up.value = '';
    ldQueueAutoSave();
}

// ── Export HTML (sama persis dengan logic dari editor asli) ──
function ldG(id) { return document.getElementById(id)?.value || ''; }
function ldEsc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function ldExportHTML(auto=false) {
    // Kumpulkan semua data dari form editor
    const promoCards = Array.from(document.querySelectorAll('#promo-cards-list .ld-repeat-item')).map(item=>({
        icon: item.querySelector('.pc-icon')?.value||'',
        title: item.querySelector('.pc-title')?.value||'',
        desc: item.querySelector('.pc-desc')?.value||''
    }));
    const landingPayload = {
        nav: { brand:ldG('nav_brand'), subbrand:ldG('nav_subbrand'), cta:ldG('nav_cta'), menus:[
            {text:ldG('nav_m1_text'),href:ldG('nav_m1_href')},{text:ldG('nav_m2_text'),href:ldG('nav_m2_href')},
            {text:ldG('nav_m3_text'),href:ldG('nav_m3_href')},{text:ldG('nav_m4_text'),href:ldG('nav_m4_href')},{text:ldG('nav_m5_text'),href:ldG('nav_m5_href')}
        ]},
        pageTitle: ldG('page_title'),
        hero: { badge:ldG('hero_badge'), h1:[ldG('hero_h1_1'),ldG('hero_h1_2'),ldG('hero_h1_3')], sub:ldG('hero_sub'), btn1:ldG('hero_btn1'), btn2:ldG('hero_btn2'), btn2href:ldG('hero_btn2_href'), stats:[{num:ldG('stat1_num'),label:ldG('stat1_label')},{num:ldG('stat2_num'),label:ldG('stat2_label')},{num:ldG('stat3_num'),label:ldG('stat3_label')}] },
        coba: { tag:ldG('coba_tag'), title:ldG('coba_title'), sub:ldG('coba_sub'), cardTitle:ldG('coba_card_title'), cardDesc:ldG('coba_card_desc'), btn:ldG('coba_btn') },
        promo: { tag:ldG('promo_tag'), h2_1:ldG('promo_h2_1'), h2_2:ldG('promo_h2_2'), desc:ldG('promo_desc'), cards:promoCards },
        mitra: { tag:ldG('mitra_tag'), title:ldG('mitra_title'), sub:ldG('mitra_sub'), list:ldG('mitra_list').split('\n').filter(x=>x.trim()) },
        fitur: { tag:ldG('fitur_tag'), title:ldG('fitur_title'), sub:ldG('fitur_sub'), cards:ldFiturCards },
        paket: { tag:ldG('paket_tag'), title:ldG('paket_title'), sub:ldG('paket_sub'), list:ldPaketData },
        materi: { tag:ldG('materi_tag'), title:ldG('materi_title'), sub:ldG('materi_sub'), list:ldMateriData },
        testi: { tag:ldG('testi_tag'), title:ldG('testi_title'), list:ldTestiData },
        faq: { tag:ldG('faq_tag'), title:ldG('faq_title'), list:ldFaqData },
        soal: ldSoalData,
        footer: { 
            brandDesc: ldG('footer_brand_desc'), 
            copy: ldG('footer_copy'), 
            reg: ldG('footer_reg'), 
            phone: ldG('footer_phone'), 
            email: ldG('footer_email'), 
            address: ldG('footer_address'), 
            platform: ldFooterPlatform, 
            perusahaan: ldFooterPerusahaan, 
            social: ldSocialData,
            canvasText: ldG('canvas_text') // <-- TAMBAHKAN INI
        },
        chat: { name:ldG('chat_name'), status:ldG('chat_status'), greeting:ldG('chat_greeting'), placeholder:ldG('chat_placeholder'), quickReplies:Object.fromEntries(ldChatQuickData.map(c=>[(c.icon+' '+c.text).toLowerCase().trim(),c.reply||''])), keywords:ldKeywordData.map(k=>({keyword:k.keyword.toLowerCase().trim(),reply:k.reply||''})), defaultReply:ldG('chat_default_reply'), avatar:ldAvatarData },
        sk: { title:ldG('sk_title'), content:document.getElementById('sk_content')?.value||'' },
        kp: { title:ldG('kp_title'), content:document.getElementById('kp_content')?.value||'' },
    };

    // Simpan ke SERVER via API (bukan localStorage)
    const token = localStorage.getItem('cbn_token');
    fetch(window.location.origin + '/api/landing', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(landingPayload)
    })
    .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    })
    .then(() => {
        showToast(auto ? '💾 Tersimpan otomatis' : '✅ Data landing page tersimpan ke database! Landing page akan otomatis menampilkan konten terbaru.', 'success', auto ? 1400 : 2600);
    })
    .catch(err => {
        showToast('❌ Gagal menyimpan otomatis: ' + err.message, 'danger');
    });
}

function ldUpdateTaksabar() {
    const skTitle = document.getElementById('sk_title')?.value || '';
    const skContent = document.getElementById('sk_content')?.value || '';
    const kpTitle = document.getElementById('kp_title')?.value || '';
    const kpContent = document.getElementById('kp_content')?.value || '';
    const token = localStorage.getItem('cbn_token');
    fetch(window.location.origin + '/api/landing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ sk: { title: skTitle, content: skContent }, kp: { title: kpTitle, content: kpContent } })
    })
    .then(r => r.ok ? r.json() : Promise.reject('HTTP ' + r.status))
    .then(() => showToast('Syarat & Privasi diperbarui ke server!', 'success'))
    .catch(e => showToast('Gagal menyimpan: ' + e, 'danger'));
}


// ── KEUANGAN ──
let _paketData = [], _keuanganSub = 'paket';
// Cache paket landing (dari /api/landing) untuk dropdown link
let _ldPaketCache = [];