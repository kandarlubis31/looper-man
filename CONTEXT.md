# looper-man — Project Context

## Ringkasan
Auto-pilot CLI buat Freebuff — lo tinggal bikin file plan, Looper-Man yang ngejalanin semua task satu per satu otomatis. = 18"

> *Context ini dibuat otomatis oleh `catalog/generate_contexts.py`. Isi ulang
> bagian ringkasan / arsitektur secara manual jika butuh detail lebih dalam.*

## Tech Stack
Node.js; deps: node-pty

## Struktur Utama
```
looper-logs/
.gitignore
CONTEXT.md
fb-probe.mjs
looper-progress.json
looper-progress.json.tmp
looper.js
package-lock.json
package.json
plan-calculator.txt
README.md
tasks.example.txt
test-task.txt
USAGE.md
```

## Cara Menjalankan
- `npm run start`

---

*Generated: 2026-08-08 · Path: nodeJS\looper-man*
