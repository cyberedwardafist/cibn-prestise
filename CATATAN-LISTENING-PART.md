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
