/* =============================================================================
   lib/toefl.js — Util & mesin skor untuk soal bertipe 'toefl'
   =============================================================================
   Dipakai oleh server.js (skor OTORITATIF saat submit/riwayat/analisa) dan
   dijadikan acuan port manual di ujian/hasil.js (client, browser tidak bisa
   require() file Node biasa — sudah jadi pola lama di project ini, lihat
   hitungSkorUjianServer() vs hitungHasil() di ujian/hasil.js).

   ── STRUKTUR DATA soal.data KHUSUS type === 'toefl' ──
   Berbeda dari multiple_choice/linier (array pertanyaan flat) maupun
   sikap_kerja (array kolom), TOEFL disimpan sebagai OBJECT 3 section:

   {
     listening: {
       audio_maks_putar: 2,            // legacy per-soal (lihat catatan modul di bawah)
       // Listening dibagi 3 PART (field `part` di tiap soal; tanpa field = 'A' utk data lama):
       //   A = Percakapan Singkat  (Short Dialogues)      — 1 soal = 1 audio (q.audio_url)
       //   B = Percakapan Panjang  (Long Conversations)   — 1 SUARA dipakai beberapa soal
       //   C = Ceramah / Monolog   (Talks)                — 1 SUARA dipakai beberapa soal
       // Part B/C: soal menunjuk suaranya lewat q.audio_id -> listening.audios[] (seperti passage_id di
       // Reading). Batas putar audio (modul.toefl_maks_putar) dihitung PER SUARA utk B/C, per soal utk A.
       // Urutan tampil ujian TETAP A -> B -> C (lalu Structure -> Reading) dan tidak bisa dibalik.
       // Semua soal Part A/B/C tetap 1 array `soal` — key jawaban & skor tetap
       // toeflAnswerKey(kode,'listening',idxDiArrayIni), jadi mesin skor di bawah TIDAK berubah.
       audios: [
         { id, part:'B'|'C', judul, audio_url }
       ],
       soal: [
         { id, part:'A', audio_url, pertanyaan, jawaban:[{id,teks}], kunci:['A'] },
         { id, part:'B'|'C', audio_id, pertanyaan, jawaban:[...], kunci:[...] }
       ]
     },
     structure: {
       soal: [
         // subtipe WAJIB salah satu: 'rumpang' (melengkapi kalimat) atau
         // 'salah' (cari kesalahan struktur) — dipakai utk shuffle per-blok
         { id, subtipe:'rumpang', pertanyaan, jawaban:[...], kunci:[...] },
         { id, subtipe:'salah',   pertanyaan, jawaban:[...], kunci:[...] }
       ]
     },
     reading: {
       soal: [
         // passage_id optional: kelompokkan soal yg berasal dari 1 bacaan yg
         // sama, supaya urutan antar-soal-1-bacaan tidak pernah teracak lepas
         // dari bacaannya walau "acak soal" dinyalakan di modul.
         { id, passage_id, passage, pertanyaan, jawaban:[...], kunci:[...] }
       ]
     }
   }

   Catatan setting "izin putar ulang audio Listening": SESUAI KEPUTUSAN PRODUK,
   ini diatur SATU kali di level MODUL (kolom modul.toefl_maks_putar — lihat
   db/schema.sql & routes /api/modul di server.js), berlaku sama untuk semua
   soal Listening yang ada di modul itu. Field audio_maks_putar per-soal di
   atas TIDAK dipakai oleh mesin ujian — hanya disiapkan sebagai kolom cadangan
   kalau suatu saat produk berubah pikiran mau override per-soal.
   ============================================================================= */

/* ─────────────────────────────────────────────────────────────────────────
   TABEL KONVERSI RAW → SCALED SCORE (TOEFL ITP, estimasi standar yang umum
   dipakai lembaga-lembaga kursus/prep center di Indonesia — BUKAN tabel
   rahasia resmi ETS, yang memang tidak pernah dipublikasikan dan berbeda
   tipis antar bentuk soal/form karena proses "score equating"). Sumber:
   tabel konversi TOEFL ITP yang dipublikasikan TITC Indonesia (Authorized
   TOEFL Test Center of ETS) — https://titc.or.id/cara-menghitung-skor-toefl-itp-dan-pbt/

   Index array = raw score (jumlah jawaban benar). Listening & Reading: index
   0..50. Structure: index 0..40 (soalnya cuma 40 butir).
   ───────────────────────────────────────────────────────────────────────── */
const TOEFL_CONVERSION = {
    listening: [
        24, 25, 26, 27, 28, 29, 30, 31, 32, 32, // 0-9
        33, 35, 37, 38, 39, 41, 41, 42, 43, 44, // 10-19
        45, 45, 46, 47, 47, 48, 48, 49, 49, 50, // 20-29
        51, 51, 52, 52, 53, 54, 54, 55, 56, 57, // 30-39
        57, 58, 59, 60, 61, 62, 63, 65, 66, 67, // 40-49
        68                                       // 50
    ],
    structure: [
        20, 20, 21, 22, 23, 25, 26, 27, 29, 31, // 0-9
        33, 35, 36, 37, 38, 40, 40, 41, 42, 43, // 10-19
        44, 45, 46, 47, 48, 49, 50, 51, 52, 53, // 20-29
        54, 55, 56, 57, 58, 60, 61, 63, 65, 67, // 30-39
        68                                       // 40
    ],
    reading: [
        21, 22, 23, 23, 24, 25, 26, 27, 28, 28, // 0-9
        29, 30, 31, 32, 34, 35, 36, 37, 38, 39, // 10-19
        40, 41, 42, 43, 43, 44, 45, 46, 46, 47, // 20-29
        48, 48, 49, 50, 51, 52, 52, 53, 54, 54, // 30-39
        55, 56, 57, 58, 59, 60, 61, 63, 65, 66, // 40-49
        67                                       // 50
    ]
};

const TOEFL_MAX_RAW = { listening: 50, structure: 40, reading: 50 };

/** Raw score (jumlah benar) → scaled score section (31-68 / 31-67), dgn
 *  pembatas aman kalau jumlah soal aktual di modul != 50/40/50 standar
 *  (admin bebas isi kurang dari itu — raw score tetap dipetakan ke skala
 *  yang sama, cuma dianggap skala prorata dari tabel resmi). */
function toeflScaledScore(section, benar, totalSoalSection) {
    const table = TOEFL_CONVERSION[section];
    if (!table) return 0;
    const maxRaw = TOEFL_MAX_RAW[section];
    // Kalau jumlah soal section di modul ini tidak persis 50/40/50 (admin isi
    // sebagian), proyeksikan raw score ke skala standar dulu supaya tetap
    // bisa dipetakan ke tabel konversi resmi.
    const total = totalSoalSection > 0 ? totalSoalSection : maxRaw;
    const rawProyeksi = Math.round((benar / total) * maxRaw);
    const idx = Math.max(0, Math.min(maxRaw, rawProyeksi));
    return table[idx];
}

/** Total skor TOEFL ITP resmi: rata-rata 3 scaled score dikali 10 (skala
 *  310-677). Dibulatkan ke bilangan bulat. */
function toeflTotalScore(scaledListening, scaledStructure, scaledReading) {
    return Math.round(((scaledListening + scaledStructure + scaledReading) / 3) * 10);
}

const TOEFL_CEFR_TABLE = [
    { min: 627, level: 'C1', label: 'Advanced (Mahir)' },
    { min: 543, level: 'B2', label: 'Upper Intermediate' },
    { min: 433, level: 'B1', label: 'Intermediate' },
    { min: 343, level: 'A2', label: 'Elementary' },
    { min: 0,   level: '-',  label: 'Below A2 / Beginner' }
];
function toeflCefrLevel(total) {
    for (const row of TOEFL_CEFR_TABLE) if (total >= row.min) return row;
    return TOEFL_CEFR_TABLE[TOEFL_CEFR_TABLE.length - 1];
}

/* ─────────────────────────────────────────────────────────────────────────
   KUNCI JAWABAN — konvensi key di object `jawaban` peserta (dipakai baik di
   ujian/ujian.html saat submit, hitungSkorUjianServer-style di server.js,
   maupun ujian/hasil.js saat re-hitung di browser):
     `${soal_kode}_toefl_${section}_${idxDalamSection}`
   (numerik biasa "_${qIdx}" dipakai type lain, "_${kolomIdx}_${qIdxDalamKolom}"
   dipakai sikap_kerja — pola literal string key ini konsisten dgn keduanya,
   cuma section-nya string bukan angka).
   ───────────────────────────────────────────────────────────────────────── */
function toeflAnswerKey(soalKode, section, idx) {
    return `${soalKode}_toefl_${section}_${idx}`;
}

/** Hitung breakdown skor TOEFL 1 soal (yg berisi 3 section) dari jawaban
 *  peserta. `data` = soal.data (sudah di-JSON.parse), `jawaban` = object
 *  jawaban lengkap 1 laporan/peserta, `soalKode` = kode row `soal`.
 *  Return: { listening:{benar,total,scaled}, structure:{...}, reading:{...}, total, cefr } */
function hitungSkorToefl(data, jawaban, soalKode) {
    jawaban = jawaban || {};
    const out = {};
    for (const section of ['listening', 'structure', 'reading']) {
        const items = (data && data[section] && Array.isArray(data[section].soal)) ? data[section].soal : [];
        let benar = 0;
        items.forEach((q, idx) => {
            const ans = jawaban[toeflAnswerKey(soalKode, section, idx)];
            if (ans == null || ans === '') return;
            const kunciRaw = q.kunci;
            const kunci = Array.isArray(kunciRaw) ? kunciRaw.map(String) : (kunciRaw != null ? [String(kunciRaw)] : []);
            const isBenar = Array.isArray(ans)
                ? (ans.length === kunci.length && ans.every(a => kunci.includes(String(a))))
                : kunci.includes(String(ans));
            if (isBenar) benar++;
        });
        const total = items.length;
        out[section] = { benar, total, scaled: total > 0 ? toeflScaledScore(section, benar, total) : 0 };
    }
    const anyIsi = out.listening.total || out.structure.total || out.reading.total;
    out.total = anyIsi ? toeflTotalScore(out.listening.scaled, out.structure.scaled, out.reading.scaled) : 0;
    out.cefr = anyIsi ? toeflCefrLevel(out.total) : null;
    return out;
}

/* ─────────────────────────────────────────────────────────────────────────
   ACAK SOAL YANG "MENJAGA BLOK" — dipakai utk section Structure (blok
   subtipe 'rumpang' vs 'salah' TIDAK pernah diselang-seling; masing2 blok
   diacak sendiri2 di dalamnya) dan section Reading (blok per passage_id
   TIDAK pernah dipecah/diselang walau "acak soal" dinyalakan admin —
   urutan antar-blok bisa ikut diacak, tapi soal dalam 1 bacaan yg sama
   selalu tetap berurutan & berdekatan).
   groupKeyFn(item) → key pengelompokan (mis. q => q.subtipe atau
   q => q.passage_id || q.id). Urutan blok pertama-kali-muncul di array asli
   DIPERTAHANKAN (tidak diacak) supaya, mis., Structure selalu tampil blok
   "rumpang" dulu baru "salah" sesuai urutan admin susun di builder — persis
   format resmi TOEFL ITP (soal melengkapi kalimat no.1-15, cari kesalahan
   no.16-40). Kalau suatu saat perlu urutan blok ikut diacak juga, tinggal
   shuffle `groupOrder` sebelum divisi ini dipakai.
   ───────────────────────────────────────────────────────────────────────── */
function shuffleArr(a) {
    const arr = [...a];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function groupPreservingShuffle(items, groupKeyFn) {
    const groupOrder = [];
    const groups = new Map();
    items.forEach(item => {
        const key = groupKeyFn(item) ?? '__default__';
        if (!groups.has(key)) { groups.set(key, []); groupOrder.push(key); }
        groups.get(key).push(item);
    });
    const out = [];
    for (const key of groupOrder) out.push(...shuffleArr(groups.get(key)));
    return out;
}

/** Acak urutan tampil soal Structure: blok subtipe dipertahankan, isi tiap
 *  blok diacak. items = data.structure.soal ASLI (dgn index asli masih bisa
 *  ditelusuri lewat _origIdx yg disisipkan supaya key jawaban tetap merujuk
 *  index ASLI di array data.structure.soal, bukan posisi tampil). */
function shuffleStructureSoal(items) {
    const withIdx = items.map((q, i) => ({ ...q, _origIdx: i }));
    return groupPreservingShuffle(withIdx, q => q.subtipe || 'lain');
}

/** Part Listening 1 soal: 'A' | 'B' | 'C'. Data lama (tanpa field part) = 'A'. */
function toeflListeningPart(q) {
    return (q && (q.part === 'B' || q.part === 'C')) ? q.part : 'A';
}

/** Audio yg dipakai 1 soal Listening -> { url, judul, shared } atau null.
 *  Part A: audio milik soal itu sendiri (q.audio_url). Part B/C: audio "suara" (data.listening.audios[q.audio_id]),
 *  fallback ke q.audio_url bila soal belum dihubungkan ke suara mana pun. */
function toeflListeningAudio(data, q) {
    if (!q) return null;
    if (toeflListeningPart(q) !== 'A' && q.audio_id) {
        const list = (data && data.listening && Array.isArray(data.listening.audios)) ? data.listening.audios : [];
        const a = list.find(x => x.id === q.audio_id);
        if (a) return { url: a.audio_url || '', judul: a.judul || '', shared: true };
    }
    return { url: q.audio_url || '', judul: '', shared: false };
}

/** Acak urutan tampil soal Listening: Part A -> B -> C SELALU berurutan (tidak pernah diacak lintas part).
 *  Part A: diacak bebas. Part B/C: blok per audio_id dipertahankan utuh (soal 1 suara selalu berdekatan),
 *  urutan antar-blok & isi tiap blok diacak — sama persis dgn shuffleReadingSoal utk bacaan. */
function shuffleListeningSoal(items) {
    const withIdx = items.map((q, i) => ({ ...q, _origIdx: i }));
    const part = p => withIdx.filter(q => toeflListeningPart(q) === p);
    const blocks = list => {
        const order = [], groups = new Map();
        list.forEach(q => {
            const key = q.audio_id ? `a_${q.audio_id}` : `single_${q._origIdx}`;
            if (!groups.has(key)) { groups.set(key, []); order.push(key); }
            groups.get(key).push(q);
        });
        const out = [];
        for (const key of shuffleArr(order)) out.push(...shuffleArr(groups.get(key)));
        return out;
    };
    return [...shuffleArr(part('A')), ...blocks(part('B')), ...blocks(part('C'))];
}

/** Acak urutan tampil soal Reading: blok per passage_id dipertahankan utuh
 *  (soal 1 bacaan selalu berdekatan), urutan ANTAR blok bacaan diacak, dan
 *  urutan soal DI DALAM tiap bacaan juga diacak (peserta lain bisa dapat urutan bacaan berbeda), dan urutan blok
 *  TANPA passage_id (soal reading lepas, tanpa bacaan bersama) diacak bebas
 *  sebagai kelompok masing2 1 soal. */
function shuffleReadingSoal(items) {
    const withIdx = items.map((q, i) => ({ ...q, _origIdx: i }));
    const groupOrder = [];
    const groups = new Map();
    withIdx.forEach(item => {
        const key = item.passage_id ? `p_${item.passage_id}` : `single_${item._origIdx}`;
        if (!groups.has(key)) { groups.set(key, []); groupOrder.push(key); }
        groups.get(key).push(item);
    });
    const shuffledGroupOrder = shuffleArr(groupOrder);
    const out = [];
    for (const key of shuffledGroupOrder) out.push(...shuffleArr(groups.get(key))); // soal DALAM 1 bacaan ikut diacak, tapi tetap 1 blok utuh
    return out;
}

module.exports = {
    TOEFL_CONVERSION, TOEFL_MAX_RAW, TOEFL_CEFR_TABLE,
    toeflScaledScore, toeflTotalScore, toeflCefrLevel,
    toeflAnswerKey, hitungSkorToefl,
    shuffleArr, groupPreservingShuffle, shuffleStructureSoal, shuffleReadingSoal,
    toeflListeningPart, toeflListeningAudio, shuffleListeningSoal
};
