# Listening TOEFL — Part A / B / C

Listening sekarang dibagi 3 bagian, urutan tampil ujian TETAP:
**Listening Part A → Part B → Part C → Structure → Reading** (satu arah, tidak bisa dibalik).

| Part | Isi | Audio | Batas putar |
|------|-----|-------|-------------|
| A | Percakapan singkat | 1 soal = 1 audio, tampil di atas pertanyaan + pilihan jawaban | per soal |
| B | Percakapan panjang | 1 suara dipakai beberapa soal (seperti bacaan di Reading) | per suara |
| C | Ceramah / monolog | sama seperti Part B | per suara |

Batas putar tetap satu pengaturan di level modul (`toefl_maks_putar`).

## Struktur data (`soal.data.listening`)
- `soal[]` tetap satu array; tiap soal punya `part` ('A' | 'B' | 'C'). Data lama tanpa `part` = Part A.
- `audios[]` (baru): `{ id, part: 'B'|'C', judul, audio_url }`.
- Soal Part B/C menunjuk suaranya lewat `audio_id`.
- Kunci jawaban tidak berubah (`<kode>_toefl_listening_<idx>`), jadi skor / riwayat / analisa tetap jalan.

## File yang diubah
- `ujian/ujian.html` — mesin ujian: tahap A/B/C, audio bersama untuk B/C, acak soal per part, resume progres.
- `admin/soal/soal.js` — builder: tab Part A/B/C, kelola "Suara" untuk B/C (upload / link / generate suara), template & import Excel (sheet baru `Suara`, kolom `Part` & `No Suara`).
- `admin/soal/soal-modals.html` — keterangan pengaturan putar ulang.
- `lib/toefl.js`, `server.js` — dokumentasi struktur, helper part/audio, label analisa per butir.
- `user/riwayat/riwayat.js`, `review/riwayat/riwayat.js` — review menampilkan audio & label Part yang benar.

## Aturan tambahan Listening (khusus TOEFL)
Di Listening Part A/B/C peserta tidak bisa lanjut ke nomor berikutnya (tombol Lanjut, tombol Selesai Bagian, maupun klik nomor di grid navigasi) selama soal yang sedang dibuka belum dijawab. Kembali ke nomor sebelumnya tetap bebas. Structure dan Reading tidak terpengaruh.

## Timer per section (mode Full)
Di builder, mode TOEFL **Full (Real Test)** punya pengaturan timer per section: Listening 35m, Structure 25m, Reading 55m (nilai awal = durasi resmi, boleh diubah; ada tombol "Kembalikan ke standar"). Timer total soal (`timer_jam/menit/detik`) otomatis = jumlah ketiganya (default 1j 55m) dan field-nya jadi read-only di mode Full.
- Disimpan di `soal.data.timers = { listening, structure, reading }` (detik) — tanpa perubahan skema DB. Soal Full lama tanpa `timers` tetap jalan (1 timer total).
- Bisa diatur saat buat soal maupun lewat "Edit Info". Excel: template Full punya baris `Timer Listening/Structure/Reading (menit)` di sheet Info (kosong/tidak valid = standar).
- **Mesin ujian (`ujian/ujian.html`) belum memakai timer per section** — masih 1 timer total. Langkah berikutnya: pecah jadi timer per tahap (Listening A/B/C berbagi timer Listening).
- Perbaikan kecil terkait: timer dengan menit = 0 (mis. total tepat 2 jam) sebelumnya diam-diam jadi 30 menit di server (`POST/PUT /api/soal`) dan di `ujian.html` (`buildFlat`) — sekarang 0 dihormati.

## Nama tipe: "TOEFL ITP"
Tipe soal `toefl` sekarang tampil sebagai **TOEFL ITP** (sebelumnya "TOEFL (Listening · Structure · Reading)"), karena nanti akan ada tipe terpisah untuk **TOEFL iBT**. Yang berubah hanya LABEL tampilan (dropdown Tipe Soal, filter tipe, kartu library, picker modul, badge Analisa Soal, header builder, judul petunjuk template Excel) lewat helper `soalTypeLabel()` di `js/app.js`. Value tipe di database / kode tetap `'toefl'` — jangan diganti, dipakai skor, riwayat, analisa, dan Excel (`Tipe Soal = toefl`). Tipe iBT nanti pakai value sendiri (mis. `toefl_ibt`).
