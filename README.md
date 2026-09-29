# 🦸 Looper-Man v3.0

> **Auto-pilot CLI buat Freebuff** — lo tinggal bikin file plan, Looper-Man yang ngejalanin semua task satu per satu otomatis.

<p align="center">
  <img src="https://img.shields.io/badge/version-3.0.0-blue?style=flat-square" alt="Version 3.0.0">
  <img src="https://img.shields.io/badge/node-%3E%3D18-green?style=flat-square" alt="Node >= 18">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Mac%20%7C%20Linux-lightgrey?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/license-MIT-yellow?style=flat-square" alt="License MIT">
</p>

---

## 🤔 Apa itu Looper-Man?

Looper-Man adalah CLI tool yang nge-loop Freebuff (AI coding agent) buat ngerjain **banyak task secara otomatis dan berurutan**.

**Problem:** Lo punya 20+ task buat bikin full-stack app. Gak mungkin lo nungguin satu per satu di depan laptop — tiap task bisa makan 5-15 menit.

**Solution:** Lo bikin satu file plan, jalanin Looper-Man, terus lo tinggal ngopi. Looper-Man bakal:
1. Spawn Freebuff buat tiap task
2. Auto-detect kalo task udah selesai (idle detection)
3. Capture file yang berubah (context chaining)
4. Passing context ke task berikutnya
5. Track progress + estimasi waktu selesai (ETA)
6. Support resume kalo keputus di tengah

---

## ✨ Key Features

| Fitur | Kenapa Penting |
|-------|----------------|
| 🖥️ **Rich Terminal UI** | Multi-line ANSI display — progress bar, per-phase status, elapsed timer, real-time ETA |
| 🕐 **ETA Estimation** | Estimasi kapan semua task selesai berdasarkan rata-rata durasi task sebelumnya |
| 🔗 **Context Chaining** | Freebuff di task #5 tau struktur project yang udah dibuat di task #1-#4 |
| 📊 **Progress Tracking** | `looper-progress.json` — lo bisa cek status kapan aja |
| 🔄 **Resume Mode** | Kalo crash/disconnect, tinggal `--resume` — lanjut dari yang terakhir |
| 📂 **Phase Support** | Organize task per fase: Setup → Auth → API → Deploy |
| 🛡️ **Session Guard** | Auto-detect & block kalo lo jalanin dari dalem Freebuff (biar gak crash) |
| ⏱️ **Idle Detection** | Auto `/exit` kalo Freebuff udah 60 detik gak ada output |
| 📝 **Verbose Logging** | Semua output Freebuff di-save ke file log |

---

## 🚀 30-Second Quick Start

```bash
# 1. Buka terminal BARU (PowerShell / CMD / bash) — JANGAN dari dalem Freebuff!

# 2. Install (kalo belum)
git clone <repo-url> looper-man
cd looper-man
npm install

# 3. Dry-run dulu buat cek
node looper.js --file tasks.example.txt --dry-run

# 4. JALANIN!
node looper.js --file tasks.example.txt
```

**Rich UI yang bakal lo liat (non-verbose mode):**
```
╔══════════════════════ LOOPER-MAN v3.0 ══════════════════════╗
║ 📊 Overall:  [████████░░░░░░░░░░░░░░]  8/21 (38%)  ⏱ 12m 34s  ║
║ 🕐 ETA: 45m remaining (avg 185s/task)                         ║
╟────────────────────────────────────────────────────────────╢
║     ✅ Setup & Foundation      ████████████████░░░░░░  4/4   ║
║     🔄 Authentication          ████████░░░░░░░░░░░░  2/4   ║
║     ⏳ Database & API          ░░░░░░░░░░░░░░░░░░░░  0/4   ║
╟────────────────────────────────────────────────────────────╢
║ 🚀 Task 9/21 [Authentication]
║ 📝 "Implementasi login dengan NextAuth.js + GitHub..."
║ ⏱  Running... 45s        |  ⏰ Timeout: 600s              ║
╚════════════════════════════════════════════════════════════╝
 📄 Log: ./looper-logs/looper-2026-08-05T....log
 📊 Progress: ./looper-progress.json
```

---

## 📖 Dokumentasi Lengkap

👉 **[USAGE.md](./USAGE.md)** — Panduan praktis lengkap:
- Instalasi (Windows, Mac, Linux)
- Format file task (phase, komentar, best practices)
- Semua opsi CLI dengan contoh
- Rich UI mode vs Verbose mode
- ETA Estimation — cara kerja
- Context Chaining — kapan dimatiin
- Progress tracking & resume
- Troubleshooting umum

---

## 📝 Task File Format

```txt
## Phase: Setup
Inisialisasi project Next.js dengan TypeScript
Setup Tailwind CSS

## Phase: Auth
Implementasi login dengan NextAuth.js

# Baris dengan # = komentar (diabaikan)
# Baris kosong = diabaikan
# "## Phase: Nama" = section header (bukan task)
```

---

## ⚙️ Semua Opsi CLI

| Flag | Default | Keterangan |
|------|---------|------------|
| `-f, --file <path>` | `tasks.txt` | File task |
| `-v, --verbose` | `false` | Tampilin output Freebuff (nonaktifkan Rich UI) |
| `--resume` | `false` | Lanjut dari progress terakhir |
| `--no-context` | `false` | Matikan context chaining |
| `-d, --delay <n>` | `3` | Jeda (detik) antar task |
| `-t, --timeout <n>` | `600` | Timeout (detik) per task |
| `--idle-timeout <n>` | `60` | Detik idle sebelum auto `/exit` |
| `-r, --retry <n>` | `1` | Max retry kalo task gagal |
| `--dry-run` | `false` | Simulasi tanpa eksekusi |
| `-i, --interactive` | `false` | Ketik task manual di terminal |
| `--freebuff-path <path>` | auto | Path ke executable Freebuff |
| `-l, --log-dir <dir>` | `./looper-logs` | Folder buat log |
| `--force` | `false` | Skip session guard |

---

## 🗂️ Project Files

```
looper-man/
├── looper.js              # Main script v3.0
├── package.json           # v3.0.0
├── README.md              # Lo lagi baca ini
├── USAGE.md               # Panduan praktis lengkap
├── tasks.example.txt      # Template: Next.js full-stack (21 task, 5 phase)
├── plan-calculator.txt    # Template: Python calculator (13 task, 4 phase)
├── test-task.txt          # File task kecil buat testing
├── looper-progress.json   # Auto-generated — progress tracking
└── looper-logs/           # Auto-generated — log tiap session
```

---

## ⚠️ PENTING!

> ### 🚫 JANGAN jalanin `node looper.js` dari DALEM sesi Freebuff!
>
> **✅ BENER:** Buka terminal BARU → `cd looper-man` → `node looper.js -f plan.txt`
>
> **❌ SALAH:** Ketik `node looper.js` di chat Freebuff yang lagi lo pake.

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| **"Freebuff gak ketemu"** | `npm install -g freebuff` |
| **node-pty error** | `npm install node-pty` (atau biarin fallback) |
| **Session Freebuff mati** | Jalanin dari terminal BARU, bukan dari Freebuff! |
| **Context gak akurat** | `git init` di project lo |
| **Task ke-skip pas --resume** | Task udah marked `completed` di progress file |
| **Rich UI gak muncul** | Pastiin jalan di terminal beneran (bukan pipe) + tanpa `-v` |

---

## 📄 License

MIT — feel free to use, modify, and distribute.
