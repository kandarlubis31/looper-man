# looper-man — Project Context

## Ringkasan

Auto-pilot CLI untuk Freebuff: beri satu berkas rencana berisi daftar tugas, dan Looper-Man
menjalankannya satu per satu otomatis, membawa konteks dari tugas sebelumnya, mencatat progres, dan
bisa dilanjutkan setelah terhenti.

## Cara kerja

Dua mode eksekusi:

- **PTY (default)** — memakai `node-pty` supaya agen menerima TTY seperti terminal asli.
- **Pipe (`--no-pty`)** — memakai `child_process.spawn` biasa. Disarankan di Windows karena PTY di
  sana sering rewel.

Setiap tugas: diambil dari berkas plan (`-f plan.txt`), dijalankan bersama konteks tugas sebelumnya,
keluarannya dicatat ke `looper-logs/`, lalu progres ditulis ke `looper-progress.json`. Penulisan
progres memakai berkas sementara lalu di-rename agar tidak korup bila proses mati di tengah jalan.
Menjalankan ulang melanjutkan dari tugas yang belum selesai, bukan dari awal.

Opsi lain: `--dry-run` (simulasi tanpa eksekusi), `--freebuff-path <path>` (lokasi executable
Freebuff bila tidak terdeteksi), serta tampilan progres ANSI multi-baris di terminal.

`fb-probe.mjs` memeriksa kesiapan lingkungan (Freebuff terpasang dan bisa dijalankan) sebelum loop
dimulai. `plan-calculator.txt` membantu memperkirakan pembagian tugas.

## Struktur

```
looper.js               Inti: parsing argumen, antrean, PTY/pipe, chaining konteks, progres, resume
fb-probe.mjs            Pemeriksaan kesiapan lingkungan
looper-progress.json    Progres (dibuat saat berjalan)
looper-logs/            Log per tugas
tasks.example.txt       Contoh berkas plan
USAGE.md                Panduan pemakaian
```

## Menjalankan

```bash
pnpm install
node looper.js -f tasks.example.txt --no-pty
```

Butuh Node >= 18 dan Freebuff yang sudah terpasang serta login.

## Catatan

- `node-pty` modul native; kalau Node di-upgrade, `pnpm rebuild node-pty` mungkin diperlukan (atau
  pakai `--no-pty`).
- Jangan menyunting `looper-progress.json` saat loop berjalan.
- Satu tugas = satu sesi agen; tugas terlalu besar sebaiknya dipecah agar konteks tidak meluap.
