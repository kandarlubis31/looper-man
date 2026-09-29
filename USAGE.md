# 📖 Looper-Man Usage Guide

> Panduan praktis lengkap: dari instalasi sampe workflow real-world.

---

## Daftar Isi

1. [Installation](#-installation)
2. [Your First Plan](#-your-first-plan)
3. [Task File Format](#-task-file-format)
4. [Rich Terminal UI](#-rich-terminal-ui)
5. [ETA Estimation](#-eta-estimation)
6. [How It Works](#-how-it-works)
7. [CLI Options Deep Dive](#-cli-options-deep-dive)
8. [Workflows](#-workflows)
9. [Context Chaining](#-context-chaining)
10. [Progress Tracking & Resume](#-progress-tracking--resume)
11. [Interactive Mode](#-interactive-mode)
12. [Troubleshooting](#-troubleshooting)
13. [Real-World Examples](#-real-world-examples)

---

## 💿 Installation

### Prerequisites

- **Node.js >= 18** — [Download](https://nodejs.org)
- **Freebuff** — `npm install -g freebuff`
- **Git** (recommended, buat context tracking)

### Setup

```bash
git clone <repo-url> looper-man
cd looper-man
npm install
```

### Optional: node-pty (better PTY mode)

```bash
npm install node-pty
```

> **Note:** `node-pty` butuh native compilation. Kalo gagal install, gak masalah — Looper-Man bakal auto-fallback ke pipe mode.

### Verify

```bash
node looper.js --help
node looper.js --file tasks.example.txt --dry-run
```

---

## 📝 Your First Plan

### Step 1: Bikin Task File

```txt
## Phase: Setup
Inisialisasi project Next.js dengan TypeScript, App Router, dan Tailwind CSS
Bikin folder structure: src/components, src/lib, src/app
Setup ESLint dan Prettier

## Phase: Auth
Implementasi login dengan NextAuth.js + Google provider
Bikin halaman /login dan /register dengan Tailwind form
Proteksi route /dashboard/* dengan middleware

## Phase: Dashboard
Bikin halaman dashboard dengan user stats
Bikin sidebar navigasi
Tambah dark mode toggle
```

### Step 2: Jalanin

> ⚠️ **BUKA TERMINAL BARU.** Jangan dari dalem Freebuff!

```bash
cd looper-man

# Dry-run dulu
node looper.js --file my-plan.txt --dry-run

# Jalanin beneran (Rich UI mode - default)
node looper.js --file my-plan.txt

# Atau verbose mode (liat output Freebuff)
node looper.js --file my-plan.txt -v
```

### Step 3: Pantau Progress

```bash
cat looper-progress.json
cat looper-progress.json | jq '.tasks[] | {task, status, duration}'
```

### Step 4: Resume (kalo perlu)

```bash
node looper.js --file my-plan.txt --resume
```

---

## 📝 Task File Format

### Basic Rules

```
📌 SETIAP BARIS YANG BUKAN KOMENTAR/KOSONG = 1 TASK

✅ BENAR:
Bikin halaman login dengan form email dan password
Tambah validasi Zod di endpoint POST /api/users

❌ SALAH:
# ini komentar — diabaikan
                      # baris kosong — diabaikan
Bikin halaman login    # ini dibaca sebagai: "Bikin halaman login"

📌 JANGAN pake bullet points (-, *, 1.) — tiap baris udah dianggap 1 task
```

### Phase Headers

```txt
## Phase: Setup & Foundation
Inisialisasi project Next.js
Setup Tailwind CSS

## Phase: Core Features
Bikin halaman dashboard
Bikin API endpoints

## Phase: Deploy
Setup Vercel
Tambah CI/CD
```

**Rules:**
- `## Phase: <nama>` — bikin section baru. BUKAN task.
- Task setelah phase header otomatis masuk ke phase itu
- Kalo gak ada phase header, task masuk ke `(no phase)`

### Komentar & Best Practices

```txt
# Ini komentar — diabaikan total
## Phase: Auth
# ============================================
# TODO: Ganti Google provider jadi GitHub nanti
# ============================================
Implementasi login dengan NextAuth.js
```

```txt
# JANGAN: task terlalu umum
Bikin backend

# TAPI: task spesifik & actionable
Inisialisasi project Next.js dengan TypeScript, App Router, dan Tailwind CSS

# JANGAN: task terlalu kecil
Install react-hook-form

# TAPI: gabungin jadi task bermakna
Bikin halaman /login dengan form email+password, validasi Zod, dan error handling
```

---

## 🖥️ Rich Terminal UI

Looper-Man punya dua mode tampilan:

### Rich UI Mode (default, tanpa `-v`)

Multi-line ANSI display yang real-time update:

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
 📄 Log: ./looper-logs/looper-....log
 📊 Progress: ./looper-progress.json
```

**Fitur UI:**
- **Overall bar** — progress + counter + persentase + elapsed timer
- **ETA line** — estimasi waktu selesai (muncul setelah ≥1 task selesai)
- **Per-phase bars** — ikon status: ✅ done, 🔄 running, ⏳ pending, ❌ failed
- **Current task** — task number, phase badge, task preview
- **Running timer** — auto-update setiap 2 detik
- **Flash messages** — notifikasi singkat di bawah UI ("🚀 Freebuff starting...")
- **Warna dinamis** — hijau (all done), kuning (done + fails), cyan (running)

### Verbose Mode (`-v`)

Output Freebuff di-echo ke terminal, tanpa Rich UI. Cocok buat debugging.

```bash
node looper.js -f plan.txt -v
```

### Kapan Pake Mode Apa

| Mode | Kapan |
|------|-------|
| **Rich UI** (default) | Normal run — lo mau pantau progress tanpa noise |
| **Verbose** (`-v`) | Debugging — lo mau liat apa yang Freebuff kerjain |

---

## 🕐 ETA Estimation

Setelah ≥1 task selesai, Looper-Man ngasih estimasi kapan semua task bakal kelar.

### Cara Kerja

```
ETA = (rata-rata durasi task selesai + jeda antar task) × sisa task
```

### Contoh

| Kondisi | ETA |
|---------|-----|
| Belum ada task selesai | Gak muncul |
| 1 task selesai (45s), 20 task sisa | `🕐 ETA: 16m remaining (avg 45s/task)` |
| 5 task selesai (avg 120s), 16 sisa | `🕐 ETA: 33m remaining (avg 120s/task)` |
| Semua selesai | Gak muncul (ganti ALL DONE) |

Makin banyak task selesai → makin akurat estimasi.

### Resume + ETA

Kalo lo pake `--resume`, durasi dari task yang udah selesai di session sebelumnya otomatis ke-load, jadi ETA langsung muncul.

---

## 🔧 How It Works

### Lifecycle per Task

```
1. [Spawn]     Looper-Man spawn Freebuff baru via PTY (atau pipe)
2. [Wait]      Nunggu 4 detik biar Freebuff siap
3. [Context]   (Optional) Prepend context block dari task sebelumnya
4. [Send]      Kirim task + context ke Freebuff via stdin
5. [Monitor]   Cek idle — kalo 60 detik gak ada output → anggap selesai
6. [Exit]      Kirim /exit + tunggu 15 detik
7. [Analyze]   Capture file yang berubah via git / filesystem scan
8. [Save]      Update looper-progress.json
9. [ETA]       Update estimasi waktu selesai
10.[Delay]     Jeda antar task (default 3 detik)
11.[Next]      Lanjut ke task berikutnya
```

---

## ⚙️ CLI Options Deep Dive

### `-f, --file <path>`
```bash
node looper.js -f my-plan.txt
node looper.js --file ../plans/sprint-1.txt
```

### `-v, --verbose`
Tampilin output Freebuff. Nonaktifkan Rich UI.

```bash
node looper.js -f plan.txt -v
```

### `--resume`
Lanjut dari progress terakhir.

```bash
node looper.js -f plan.txt --resume
```

### `--no-context`
Matikan context chaining (task independen).

```bash
node looper.js -f plan.txt --no-context
```

### `-d, --delay <n>`
Jeda detik antar task (default: 3).

### `-t, --timeout <n>`
Timeout detik per task (default: 600).

### `--idle-timeout <n>`
Detik idle sebelum auto `/exit` (default: 60).

### `-r, --retry <n>`
Max retry kalo gagal (default: 1).

### `--dry-run`
Simulasi tanpa spawn Freebuff.

```bash
node looper.js -f plan.txt --dry-run
```

### `-i, --interactive`
Ketik task manual di terminal.

### `--freebuff-path <path>`
Path eksplisit ke Freebuff executable.

### `-l, --log-dir <dir>`
Folder log (default: `./looper-logs`).

### `--force`
Skip session guard.

---

## 🔄 Workflows

### 1: Full Plan (paling umum)

```bash
node looper.js -f full-plan.txt --dry-run    # cek dulu
node looper.js -f full-plan.txt              # eksekusi
node looper.js -f full-plan.txt --resume     # resume kalo keputus
```

### 2: Plan Bertahap

```bash
node looper.js -f sprint-1-setup.txt
node looper.js -f sprint-2-features.txt
node looper.js -f sprint-3-deploy.txt
```

### 3: Interactive Quick Tasks

```bash
node looper.js -i
```

---

## 🔗 Context Chaining

Tiap task dijalankan di **Freebuff session berbeda**. Tanpa context chaining, task #5 gak tau file yang udah dibuat task #1-#4.

### Context Block

```
============================================================
📋 KONTEKS PROGRESS — Task sebelumnya yang udah selesai:
============================================================
  ✅ #1 [Setup] "Inisialisasi project Next.js" (45s)
  ✅ #2 [Setup] "Setup Tailwind CSS dan PostCSS" (32s)

📁 File yang terakhir diubah (task #2):
   • tailwind.config.ts, postcss.config.js, src/app/globals.css

📊 Progress: 2/15 task selesai | ~12 file di project
============================================================
⚠️  Jangan bikin ulang file yang udah ada. Lanjutin aja.
────────────────────────────────────────
📌 TASK SEKARANG: Bikin layout utama dengan navbar dan footer
```

### Kapan Matiin

```bash
node looper.js -f plan.txt --no-context
# Buat task independen: update deps, fix linting, refactor, dll
```

---

## 📊 Progress Tracking & Resume

File `looper-progress.json` auto-generated.

```bash
# Cek status
cat looper-progress.json

# Resume
node looper.js -f plan.txt --resume

# Reset
rm looper-progress.json
```

---

## 💬 Interactive Mode

```bash
node looper.js -i
```

```
📝 task> Fix TypeScript errors di src/
   [+] Task #1 ditambahkan
📝 task> Update dependencies
   [+] Task #2 ditambahkan
📝 task> /done
📋 2 task siap.
```

---

## 🐛 Troubleshooting

| Masalah | Solusi |
|---------|--------|
| **"Freebuff gak ketemu"** | `npm install -g freebuff` |
| **node-pty error** | `npm install node-pty` atau biarin fallback |
| **Session Freebuff mati** | Buka terminal BARU, jangan dari Freebuff! |
| **Context gak akurat** | `git init` di project |
| **Task ke-skip pas --resume** | Task udah marked `completed` |
| **Rich UI gak muncul** | Jalanin di terminal beneran + tanpa `-v` |
| **Timeout tapi belom selesai** | Naikin `-t 1200 --idle-timeout 180` |

---

## 🌍 Real-World Examples

### Example 1: Next.js Full-Stack App (21 task, 5 phase)

Lihat `tasks.example.txt`:

```bash
node looper.js -f tasks.example.txt --idle-timeout 90 -t 900
```

### Example 2: Python Calculator (13 task, 4 phase)

Lihat `plan-calculator.txt`:

```bash
# Dry-run
node looper.js -f plan-calculator.txt --dry-run

# Eksekusi
node looper.js -f plan-calculator.txt -t 300
```

### Example 3: Quick Fixes (Interactive)

```bash
node looper.js -i -d 0 --idle-timeout 45
```

---

## 💡 Tips & Tricks

1. **Selalu `git init` dulu** — context detection paling akurat
2. **Mulai dengan dry-run** — cek task ke-load bener
3. **Task spesifik > task umum** — "Inisialisasi Next.js + TypeScript + Tailwind" lebih baik dari "Bikin frontend"
4. **Phase buat organisasi** — gak nge-pause eksekusi, cuma label
5. **Timeout disesuain** — task kecil 120s, task gede 900s
6. **Pisahin plan gede** — 3 file @ 7 task > 1 file @ 21 task
7. **`--no-context` buat maintenance** — update deps, fix lint
