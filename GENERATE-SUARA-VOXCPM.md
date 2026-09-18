# Generate Suara (VoxCPM2 via voicebox) — Panduan Setup

Fitur "🎙️ Generate Suara" di form soal Listening TOEFL (`admin/soal/soal.js`)
sekarang punya 2 sumber suara:

1. **Edge TTS (gratis)** — sudah ada dari awal, jalan otomatis di server
   Vercel (`lib/edge-tts.js`). Tidak perlu setup apa-apa.
2. **Voicebox Lokal (VoxCPM2)** — BARU. Kualitas lebih tinggi, bisa voice
   cloning & voice design, tapi modelnya (VoxCPM2, 2B parameter) TIDAK BISA
   jalan di Vercel (serverless, tanpa GPU, tanpa proses hidup lama). Jadi
   server-nya dijalankan LOKAL di komputer admin, dan dipanggil LANGSUNG
   dari browser admin saat generate — hasil akhirnya (file audio) tetap
   diupload ke Supabase Storage lewat jalur upload yang sama seperti biasa,
   jadi asetnya tetap ada di backend aplikasi ini.

Kode integrasi VoxCPM2 sebagai engine baru ("voxcpm") ada di
`voicebox/voicebox/backend/backends/voxcpm_backend.py` (repo `voicebox`
terpisah, bukan bagian dari deploy Vercel ini).

## 1. Jalankan server voicebox lokal (sekali per komputer admin)

```bash
cd voicebox/voicebox
pip install -r requirements.txt          # sekali saja, termasuk paket `voxcpm`
pip install -r requirements-mlx.txt      # HANYA di Mac Apple Silicon

# Wajib set CORS ke domain Vercel kamu, supaya admin panel (HTTPS) boleh
# memanggil server lokal ini (HTTP, loopback):
export VOICEBOX_CORS_ORIGINS="https://nama-domain-kamu.vercel.app"

python -m backend.main --host 127.0.0.1 --port 17493
```

Biarkan terminal ini tetap terbuka selama admin mau pakai fitur Generate
Suara VoxCPM2. Model VoxCPM2 (~4GB) otomatis didownload dari HuggingFace
saat generate pertama kali dipanggil — proses pertama akan lama.

> Kalau GPU CUDA tersedia dipakai otomatis; kalau tidak, jalan di CPU (jauh
> lebih lambat untuk model 2B ini — realistis untuk pemakaian sesekali,
> bukan produksi masal).

## 2. Buat voice profile di aplikasi voicebox

Buka aplikasi voicebox (desktop app dari `voicebox/voicebox`, atau lewat
`http://127.0.0.1:17493` kalau frontend web-nya ikut ter-build) lalu buat
profile suara dengan engine **VoxCPM2**, dengan salah satu cara:

- **Cloning**: upload 1 rekaman singkat (5–15 detik) + transkrip teksnya.
- **Voice Design**: tanpa rekaman sama sekali, cukup isi deskripsi suara
  di kolom "Design Prompt", mis. `"Pria dewasa, suara jelas dan tegas,
  aksen Amerika, nada formal"` — VoxCPM akan mengarang suara sesuai
  deskripsi itu.

Buat beberapa profile sesuai kebutuhan (mis. 1 pria + 1 wanita, atau lebih)
— semuanya akan otomatis muncul di dropdown "Pilih Profile" pada form soal
Listening TOEFL, tidak perlu edit kode lagi tiap kali menambah suara baru.

## 3. Pakai di form soal

Di form soal Listening TOEFL: klik **🎙️ Generate Suara** → pilih tab
**"Voicebox Lokal (VoxCPM2)"** → isi teks per bagian → pilih voice
profile-nya dari dropdown (klik ⚙️ di sebelahnya kalau perlu ganti alamat
server, default `http://127.0.0.1:17493`) → Play untuk preview → Simpan
soal seperti biasa (audio otomatis digabung & diupload).

## Catatan

- Kalau server lokal mati/tidak terjangkau, dropdown profile akan
  menampilkan pesan error — admin tinggal pindah kembali ke tab "Edge TTS"
  sebagai fallback, tidak ada yang perlu diubah di kode.
- Field "Gaya bicara (opsional)" mengirim instruksi tambahan ke VoxCPM
  sebagai prefiks `(instruksi)` di depan teks, mis. `"agak cepat, nada
  ceria"` — sama seperti fitur "Controllable Cloning" di dokumentasi
  VoxCPM.
