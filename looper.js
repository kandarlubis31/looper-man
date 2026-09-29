#!/usr/bin/env node
/**
 *  ▓▓▓▓  LOOPER-MAN v3.0  ▓▓▓▓
 *  Loop CLI tool — nge-loop Freebuff buat ngerjain task banyak secara otomatis
 *
 *  NEW v3.0:
 *    - Context chaining: auto-pass konteks dari task selesai ke task berikutnya
 *    - Progress tracking: looper-progress.json buat track status tiap task
 *    - Resume mode: --resume buat lanjut dari task terakhir
 *    - Phase support: ## Phase: Nama di task file
 *    - Rich Terminal UI: multi-line ANSI progress display
 *
 *  Usage:
 *    node looper.js --file full-plan.txt
 *    node looper.js --file full-plan.txt -v --resume
 *    node looper.js --file full-plan.txt --no-context
 *    node looper.js --interactive
 */

import { spawn, execSync } from 'node:child_process';
import {
  readFileSync, writeFileSync, appendFileSync,
  mkdirSync, existsSync, statSync, readdirSync
} from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { platform } from 'node:os';

// ─── CONFIG ───────────────────────────────────────────────
const CFG = {
  taskFile: 'tasks.txt',
  delay: 3,
  retry: 1,
  timeout: 600,
  idleTimeout: 60,
  logDir: './looper-logs',
  progressFile: './looper-progress.json',
  freebuffPath: null,
  model: null,
  noPty: false,
  verbose: false,
  dryRun: false,
  force: false,
  context: true,
  resume: false,
};

// ─── ARG PARSER ───────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {
    file: null, delay: null, retry: null, timeout: null,
    idleTimeout: null, logDir: null, freebuffPath: null, model: null,
    verbose: false, dryRun: false, interactive: false, force: false,
    context: null, resume: false, noContext: false, noPty: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    switch (arg) {
      case '-f': case '--file':           flags.file = next; i++; break;
      case '-d': case '--delay':          flags.delay = parseFloat(next); i++; break;
      case '-r': case '--retry':          flags.retry = parseInt(next); i++; break;
      case '-t': case '--timeout':        flags.timeout = parseInt(next); i++; break;
      case '--idle-timeout':              flags.idleTimeout = parseInt(next); i++; break;
      case '-l': case '--log-dir':        flags.logDir = next; i++; break;
      case '--freebuff-path':             flags.freebuffPath = next; i++; break;
      case '-m': case '--model':          flags.model = next; i++; break;
      case '-v': case '--verbose':        flags.verbose = true; break;
      case '--dry-run':                   flags.dryRun = true; break;
      case '--no-pty':                    flags.noPty = true; break;
      case '-i': case '--interactive':    flags.interactive = true; break;
      case '--force':                     flags.force = true; break;
      case '--resume':                    flags.resume = true; break;
      case '--no-context':                flags.noContext = true; break;
      case '--context':                   flags.context = true; break;
      case '-h': case '--help':           showHelp(); process.exit(0);
      default:
        // Positional argument — treat as task file if not consumed as flag value
        if (!arg.startsWith('-') && !flags.file) flags.file = arg;
    }
  }
  return flags;
}

function showHelp() {
  console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║           ▓▓ LOOPER-MAN v3.0 ▓▓                       ║
  ║       Loop CLI buat Freebuff auto-pilot                ║
  ╚══════════════════════════════════════════════════════════╝

  Usage:
    node looper.js --file <tasks.txt> [options]

  Options:
    -f, --file <path>       File berisi daftar task (satu per baris)
    -d, --delay <n>         Jeda detik antar task (default: 3)
    -r, --retry <n>         Max retry kalo gagal (default: 1)
    -t, --timeout <n>       Timeout detik per task (default: 600)
    --idle-timeout <n>      Detik idle sebelum anggap task selesai (default: 60)
    -m, --model <model>     Pilih model AI (contoh: flash, sonnet, gpt-4o)
    --freebuff-path <path>  Path eksplisit ke executable Freebuff
    -l, --log-dir <dir>     Direktori log (default: ./looper-logs)
    -v, --verbose           Tampilkan output detail (nonaktifkan rich UI)
    --dry-run               Simulasi aja, gak beneran execute
    --force                 Paksa jalan meski terdeteksi di dalem Freebuff
    --no-pty                Skip PTY mode — pake pipe mode langsung (disarankan di Windows)
    --resume                Lanjut dari task terakhir yg belum selesai
    --no-context            Matikan context-chaining antar task
    -i, --interactive       Input task langsung dari terminal
    -h, --help              Tampilkan bantuan ini

  Task File Format (v3 — dengan Phase):
    ## Phase: Setup & Foundation
    Inisialisasi project Next.js dengan TypeScript
    Setup Tailwind CSS dan PostCSS
    
    ## Phase: Authentication
    Implementasi login dengan NextAuth.js
    Bikin halaman register
    
    # ini komentar, baris kosong diabaikan

  Context Chaining (default ON):
    Setelah tiap task selesai, Looper-Man auto-capture file apa aja
    yang berubah (via git atau filesystem scan), terus ngasih tau
    Freebuff di task berikutnya: "Ini lho struktur project sekarang..."

    Matikan dengan --no-context kalo task-nya independen.

  Resume:
    node looper.js -f plan.txt --resume
    → Lanjut dari task terakhir yg belum selesai di looper-progress.json

  Contoh:
    node looper.js plan-calculator.txt                    # positional arg juga bisa!
    node looper.js -f full-plan.txt -m flash              # pake model flash
    node looper.js -f full-plan.txt --no-pty              # pipe mode (lebih stabil di Windows)
    node looper.js -f full-plan.txt --idle-timeout 120
    node looper.js -f full-plan.txt --resume
    node looper.js -f full-plan.txt -v     # verbose mode (nonaktifkan rich UI)
    node looper.js --interactive -t 300
  `);
}

// ─── FREEBUFF PATH DETECTION ─────────────────────────────
function detectFreebuffPath() {
  try {
    const npmRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim();
    const fbPath = join(npmRoot, 'freebuff', 'index.js');
    if (existsSync(fbPath)) return fbPath;
  } catch {}

  const commonPaths = platform() === 'win32'
    ? [
        join(process.env.APPDATA || '', 'npm', 'node_modules', 'freebuff', 'index.js'),
        'C:/Users/' + (process.env.USERNAME || '') + '/AppData/Roaming/npm/node_modules/freebuff/index.js',
      ]
    : [
        '/usr/local/lib/node_modules/freebuff/index.js',
        '/usr/lib/node_modules/freebuff/index.js',
        join(process.env.HOME || '/root', '.nvm/versions/node', process.version.slice(1), 'lib/node_modules/freebuff/index.js'),
      ];

  for (const p of commonPaths) {
    if (existsSync(p)) return p;
  }
  return null;
}

function getFreebuffEntry() {
  if (CFG.freebuffPath) return CFG.freebuffPath;
  const detected = detectFreebuffPath();
  if (detected) {
    CFG.freebuffPath = detected;
    return detected;
  }
  try {
    execSync('freebuff --version', { stdio: 'ignore' });
    return 'freebuff';
  } catch {
    console.error('❌ Gak bisa nemu Freebuff!');
    console.error('   Pastikan udah: npm install -g freebuff');
    process.exit(1);
  }
}

// ─── FREEBUFF SESSION DETECTION ──────────────────────────
function isInsideFreebuffSession() {
  const fbEnvVars = ['FREEBUFF_SESSION', 'FREEBUFF_HOME', 'CODEBUFF_SESSION'];
  for (const v of fbEnvVars) {
    if (process.env[v]) return true;
  }
  try {
    if (platform() === 'win32') {
      const ppid = process.ppid;
      const out = execSync(`wmic process where ProcessId=${ppid} get Name /format:value`, {
        encoding: 'utf-8', timeout: 3000,
      });
      const parentName = out.split('=')[1]?.trim()?.toLowerCase() || '';
      if (parentName.includes('node') || parentName.includes('cmd') || parentName.includes('powershell')) {
        const gpidOut = execSync(`wmic process where ProcessId=${ppid} get ParentProcessId /format:value`, {
          encoding: 'utf-8', timeout: 3000,
        });
        const gpid = gpidOut.split('=')[1]?.trim();
        if (gpid) {
          const gpOut = execSync(`wmic process where ProcessId=${gpid} get Name,CommandLine /format:value`, {
            encoding: 'utf-8', timeout: 3000,
          });
          if (gpOut.toLowerCase().includes('freebuff') || gpOut.toLowerCase().includes('codebuff')) return true;
        }
      }
      if (parentName.includes('freebuff') || parentName.includes('codebuff')) return true;
    } else {
      const ppid = process.ppid;
      const out = execSync(`ps -o comm= -p ${ppid} 2>/dev/null || echo ''`, {
        encoding: 'utf-8', timeout: 3000,
      });
      if (out.toLowerCase().includes('freebuff') || out.toLowerCase().includes('codebuff')) return true;
    }
  } catch {}
  return false;
}

function checkAndWarnFreebuffSession() {
  if (CFG.force) return;
  if (isInsideFreebuffSession()) {
    console.error(`
╔══════════════════════════════════════════════════════════╗
║  ⚠️  WARNING: Looper-Man terdeteksi jalan di DALEM     ║
║     sesi Freebuff! Ini bisa bikin sesi lo MATI!        ║
║                                                        ║
║  ✅ BENER:  Buka terminal BARU → node looper.js -f ... ║
║  ❌ SALAH:  Ketik node looper.js di dalem Freebuff     ║
║                                                        ║
║  Pake --force kalo lo tetap maksa (not recommended)    ║
╚══════════════════════════════════════════════════════════╝
`);
    process.exit(1);
  }
}

// ─── TASK READER (v3 — Phase Support) ────────────────────
function readTasks(filePath) {
  if (!existsSync(filePath)) {
    console.error(`❌ File gak ditemukan: ${filePath}`);
    process.exit(1);
  }
  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n');
  const tasks = [];
  let currentPhase = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    const phaseMatch = trimmed.match(/^##\s+Phase\s*:\s*(.+)/i);
    if (phaseMatch) {
      currentPhase = phaseMatch[1].trim();
      continue;
    }

    if (trimmed.startsWith('#')) continue;

    tasks.push({
      task: trimmed,
      phase: currentPhase,
      status: 'pending',
      attempts: 0,
      duration: null,
      timestamp: null,
      filesChanged: [],
      error: null,
      output: null,
    });
  }

  return tasks;
}

// ─── PROGRESS STATE ──────────────────────────────────────
function loadProgress() {
  if (!existsSync(CFG.progressFile)) return null;
  try { return JSON.parse(readFileSync(CFG.progressFile, 'utf-8')); } catch { return null; }
}

function saveProgress(session) {
  session.updatedAt = new Date().toISOString();
  const tmpFile = CFG.progressFile + '.tmp';
  writeFileSync(tmpFile, JSON.stringify(session, null, 2));
  try { require('fs').renameSync(tmpFile, CFG.progressFile); } catch {
    writeFileSync(CFG.progressFile, JSON.stringify(session, null, 2));
    try { require('fs').unlinkSync(tmpFile); } catch {}
  }
}

function initProgress(tasks, taskFile) {
  const session = {
    version: '1.0',
    sessionId: new Date().toISOString().replace(/[:.]/g, '-'),
    taskFile,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    config: { delay: CFG.delay, retry: CFG.retry, timeout: CFG.timeout, idleTimeout: CFG.idleTimeout, context: CFG.context },
    phases: buildPhaseSummary(tasks),
    tasks: tasks.map((t, i) => ({
      index: i, phase: t.phase, task: t.task,
      status: t.status || 'pending', attempts: t.attempts || 0,
      duration: t.duration, timestamp: t.timestamp,
      filesChanged: t.filesChanged || [], error: t.error,
    })),
  };
  saveProgress(session);
  return session;
}

function buildPhaseSummary(tasks) {
  const phases = [];
  const phaseMap = new Map();
  for (const t of tasks) {
    const name = t.phase || '(no phase)';
    if (!phaseMap.has(name)) {
      phaseMap.set(name, { name, total: 0, completed: 0, failed: 0 });
      phases.push(phaseMap.get(name));
    }
    phaseMap.get(name).total++;
  }
  return phases;
}

function updateProgressTask(session, taskIndex, updates) {
  const t = session.tasks[taskIndex];
  if (!t) return;
  Object.assign(t, updates);
  t.updatedAt = new Date().toISOString();
  const phaseName = t.phase || '(no phase)';
  const phase = session.phases.find(p => p.name === phaseName);
  if (phase) {
    if (updates.status === 'completed') phase.completed++;
    if (updates.status === 'failed') phase.failed++;
  }
  saveProgress(session);
}

function getResumeIndex(session) {
  for (let i = 0; i < session.tasks.length; i++) {
    if (session.tasks[i].status === 'pending' || session.tasks[i].status === 'failed') return i;
  }
  return session.tasks.length;
}

// ─── CONTEXT BUILDER ─────────────────────────────────────
function getProjectChanges(sinceTime) {
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    if (gitRoot) {
      const changed = execSync('git diff --name-only', {
        encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      const untracked = execSync('git ls-files --others --exclude-standard', {
        encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      const all = [...changed.split('\n'), ...untracked.split('\n')]
        .map(f => f.trim()).filter(f => f.length > 0);
      if (all.length > 0) return { method: 'git', files: all };
    }
  } catch {}

  try {
    const files = scanProjectFiles(process.cwd(), sinceTime);
    if (files.length > 0) return { method: 'fs', files };
  } catch {}

  return { method: 'none', files: [] };
}

function scanProjectFiles(rootDir, sinceTime, maxFiles = 50) {
  const results = [];
  const ignore = new Set(['node_modules', '.git', 'looper-logs', 'looper-progress.json', '.next', 'dist', 'build', '.cache']);

  function walk(dir) {
    if (results.length >= maxFiles) return;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (results.length >= maxFiles) return;
        if (ignore.has(e.name)) continue;
        if (e.name === '.git') continue;
        const fullPath = join(dir, e.name);
        if (e.isDirectory()) { walk(fullPath); }
        else {
          try {
            const st = statSync(fullPath);
            if (sinceTime && st.mtimeMs < sinceTime) continue;
            results.push(relative(rootDir, fullPath));
          } catch {}
        }
      }
    } catch {}
  }

  walk(rootDir);
  return results;
}

function getProjectStats() {
  try {
    const files = execSync('git ls-files', {
      encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    return files ? String(files.split('\n').length) : '?';
  } catch { return '?'; }
}

function buildContextBlock(session, currentTaskIndex) {
  if (!CFG.context) return '';
  const completedTasks = session.tasks.slice(0, currentTaskIndex).filter(t => t.status === 'completed');
  if (completedTasks.length === 0) return '';

  const lines = [];
  lines.push('', '='.repeat(60), '📋 KONTEKS PROGRESS — Task sebelumnya yang udah selesai:', '='.repeat(60));

  for (const t of completedTasks.slice(-5)) {
    const dur = t.duration ? ` (${t.duration.toFixed(0)}s)` : '';
    const phaseLabel = t.phase ? `[${t.phase}] ` : '';
    lines.push(`  ✅ #${t.index + 1} ${phaseLabel}"${t.task.slice(0, 80)}"${dur}`);
  }

  const lastTask = completedTasks[completedTasks.length - 1];
  if (lastTask?.filesChanged?.length > 0) {
    lines.push('', `📁 File yang terakhir diubah (task #${lastTask.index + 1}):`);
    const maxShow = 15;
    for (const f of lastTask.filesChanged.slice(0, maxShow)) lines.push(`   • ${f}`);
    if (lastTask.filesChanged.length > maxShow) lines.push(`   ... dan ${lastTask.filesChanged.length - maxShow} file lainnya`);
  }

  if (completedTasks.length > 0) {
    const totalFiles = getProjectStats();
    lines.push('', `📊 Progress: ${completedTasks.length}/${session.tasks.length} task selesai | ~${totalFiles} file di project`);
  }

  lines.push('='.repeat(60));
  lines.push('⚠️  SEBELUM MULAI: BACA file project yang udah ada sebelum ngerjain task di atas!');
  lines.push('    Jangan bikin ulang file yang udah ada. Lanjutin aja dari yang udah jadi.', '');
  return lines.join('\n');
}

function analyzeTaskResult(taskIndex, startTime, result, logger) {
  if (!CFG.context) return { filesChanged: [] };
  const sinceTime = startTime - 2000;
  const changes = getProjectChanges(sinceTime);
  if (changes.files.length > 0) {
    logger.log('INFO', `   📁 File berubah (${changes.method}): ${changes.files.length} file`);
    for (const f of changes.files.slice(0, 10)) logger.log('INFO', `      • ${f}`);
  }
  return { filesChanged: changes.files };
}

// ─── LOGGER ──────────────────────────────────────────────
function setupLogger() {
  if (!existsSync(CFG.logDir)) mkdirSync(CFG.logDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = resolve(CFG.logDir, `looper-${ts}.log`);
  return {
    file: logFile,
    silent: false,
    log(level, msg) {
      const line = `[${new Date().toISOString()}] [${level}] ${msg}`;
      appendFileSync(logFile, line + '\n');
      if (!this.silent) console.log(msg);
    },
    logRaw(msg) { appendFileSync(logFile, msg); }
  };
}

// ╔══════════════════════════════════════════════════════════╗
// ║              ▓▓ RICH TERMINAL UI ▓▓                    ║
// ╚══════════════════════════════════════════════════════════╝

class TerminalUI {
  constructor(total, phases, logFile) {
    this.total = total;
    this.phases = phases.map(p => ({ ...p })); // clone biar gak ngerubah session
    this.logFile = logFile;
    this.startTime = Date.now();
    this.taskStartTime = null;
    this.currentIndex = -1;
    this.currentTask = '';
    this.currentPhase = null;
    this.running = false;
    this.completed = 0;
    this.failed = 0;
    this.durations = [];  // durasi task selesai (detik) — buat kalkulasi ETA
    this.lines = 0;
    this.tty = process.stdout.isTTY && !CFG.verbose;
  }

  // ─── ANSI helpers ──────────────────────────────────
  get c() { return this.tty; }
  _(code) { return this.c ? `\x1b[${code}m` : ''; }
  R() { return this._(0); }
  B() { return this._(1); }
  dim() { return this._(2); }
  green() { return this._(32); }
  yellow() { return this._(33); }
  red() { return this._(31); }
  cyan() { return this._(36); }
  magenta() { return this._(35); }
  gray() { return this._(90); }
  greenBg() { return this._(42); }
  redBg() { return this._(41); }

  eta() {
    const remaining = this.total - (this.completed + this.failed);
    if (remaining <= 0) return null;
    if (this.durations.length === 0) return null;
    const avg = this.durations.reduce((a, b) => a + b, 0) / this.durations.length;
    // Include jeda antar task dalam estimasi
    const etaSec = Math.round((avg + CFG.delay) * remaining);
    if (etaSec < 60) return `${etaSec}s`;
    const m = Math.floor(etaSec / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    return `${m}m`;
  }

  // ─── Drawing primitives ────────────────────────────
  bar(current, total, width = 22) {
    if (total === 0) total = 1;
    const filled = Math.round((current / total) * width);
    const empty = width - filled;
    if (filled === width) return `${this.green()}${'█'.repeat(filled)}${this.R()}`;
    return `${this.green()}${'█'.repeat(filled)}${this.dim()}${'░'.repeat(empty)}${this.R()}`;
  }

  elapsed() {
    const sec = Math.floor((Date.now() - this.startTime) / 1000);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
  }

  taskElapsed() {
    if (!this.taskStartTime) return '0s';
    const sec = Math.floor((Date.now() - this.taskStartTime) / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
  }

  phaseIcon(name) {
    const p = this.phases.find(ph => ph.name === name);
    if (!p) return `${this.dim()}⏳${this.R()}`;
    if (p.completed === p.total) return `${this.green()}✅${this.R()}`;
    const curPhase = this.currentPhase || '(no phase)';
    if (this.running && curPhase === name) return `${this.cyan()}🔄${this.R()}`;
    if (p.failed > 0 && p.completed + p.failed === p.total) return `${this.red()}❌${this.R()}`;
    return `${this.dim()}⏳${this.R()}`;
  }

  // ─── Render ────────────────────────────────────────
  render() {
    if (!this.tty) return;

    const R = this.R();
    const B = this.B();
    const lines = [];
    const overall = this.completed + this.failed;
    const pct = this.total > 0 ? Math.round((overall / this.total) * 100) : 0;
    const allDone = overall >= this.total;

    // Header
    const headerColor = allDone ? (this.failed === 0 ? this.green() : this.yellow()) : this.cyan();
    lines.push(`${headerColor}${B}╔══════════════════════ LOOPER-MAN v3.0 ══════════════════════╗${R}`);

    // Overall progress
    const statusIcon = allDone ? (this.failed === 0 ? '🎉' : '⚠️') : '📊';
    const statusLabel = allDone
      ? (this.failed === 0 ? `${this.green()}ALL DONE!${R}` : `${this.yellow()}DONE (${this.failed} failed)${R}`)
      : `${overall}/${this.total} (${pct}%)`;
    lines.push(`${headerColor}║${R} ${statusIcon} Overall:  ${this.bar(overall, this.total)}  ${B}${statusLabel}${R}  ${this.dim()}⏱ ${this.elapsed()}${R}${' '.repeat(2)}${headerColor}║${R}`);

    // ETA
    const etaText = this.eta();
    if (etaText && !allDone) {
      lines.push(`${headerColor}║${R} ${this.dim()}🕐 ETA: ${etaText} remaining (avg ${this.durations.length > 0 ? (this.durations.reduce((a,b)=>a+b,0)/this.durations.length).toFixed(0) : '?'}s/task)${R}${' '.repeat(3)}${headerColor}║${R}`);
    }

    // Phases
    if (this.phases.length > 1) {
      lines.push(`${headerColor}╟${R}${this.dim()}${'─'.repeat(60)}${R}${headerColor}╢${R}`);
      for (const p of this.phases) {
        const icon = this.phaseIcon(p.name);
        const label = p.name.slice(0, 24).padEnd(24);
        const cnt = `${String(p.completed).padStart(2)}/${String(p.total).padStart(2)}`;
        lines.push(`${headerColor}║${R}     ${icon} ${label} ${this.bar(p.completed, p.total, 16)}  ${cnt}  ${headerColor}║${R}`);
      }
    }

    lines.push(`${headerColor}╟${R}${this.dim()}${'─'.repeat(60)}${R}${headerColor}╢${R}`);

    // Current task
    if (this.running && this.currentTask) {
      const taskPreview = this.currentTask.slice(0, 52);
      const suffix = this.currentTask.length > 52 ? '...' : '';
      const phaseLabel = this.currentPhase ? ` ${this.cyan()}[${this.currentPhase}]${R}` : '';
      lines.push(`${headerColor}║${R} ${this.yellow()}🚀${R} ${B}Task ${this.currentIndex + 1}/${this.total}${R}${phaseLabel}`);
      lines.push(`${headerColor}║${R} 📝 "${taskPreview}${suffix}"`);
      const elapsed = this.taskElapsed().padEnd(10);
      lines.push(`${headerColor}║${R} ${this.yellow()}⏱  Running... ${elapsed}${R} ${this.dim()}|  ⏰ Timeout: ${CFG.timeout}s${R} ${' '.repeat(2)}${headerColor}║${R}`);
    } else if (allDone) {
      const icon = this.failed === 0 ? `${this.green()}🎉${R}` : `${this.yellow()}⚠️${R}`;
      const msg = this.failed === 0
        ? `${this.green()}Semua task selesai! Project lo siap deploy.${R}`
        : `${this.yellow()}Selesai dengan ${this.failed} task gagal. Cek log.${R}`;
      lines.push(`${headerColor}║${R} ${icon} ${msg}${' '.repeat(10)}${headerColor}║${R}`);
      lines.push(`${headerColor}║${R} ${this.dim()}Total time: ${this.elapsed()}${R}${' '.repeat(39)}${headerColor}║${R}`);
    } else {
      lines.push(`${headerColor}║${R} ${this.dim()}Menunggu task berikutnya...${R}${' '.repeat(27)}${headerColor}║${R}`);
    }

    // Bottom bar
    lines.push(`${headerColor}╚${R}${this.dim()}${'═'.repeat(60)}${R}${headerColor}╝${R}`);
    lines.push(` ${this.dim()}📄 Log: ${this.logFile}${R}`);
    lines.push(` ${this.dim()}📊 Progress: ${CFG.progressFile}${R}`);

    this.lines = lines.length;
    process.stdout.write(lines.join('\n') + '\n');
  }

  rerender() {
    if (!this.tty) return;
    if (this.lines > 0) {
      // Move up, clear from cursor to end of screen
      process.stdout.write(`\x1b[${this.lines}A\x1b[J`);
    }
    this.render();
  }

  // ─── State updates ─────────────────────────────────
  setRunning(index, phase, task) {
    this.running = true;
    this.currentIndex = index;
    this.currentPhase = phase;
    this.currentTask = task;
    this.taskStartTime = Date.now();
    this.rerender();
  }

  setDone(index, phase, duration) {
    this.completed++;
    this.running = false;
    if (duration && duration > 0) this.durations.push(duration);
    if (phase) {
      const p = this.phases.find(ph => ph.name === phase);
      if (p) p.completed++;
    }
    this.rerender();
  }

  setFailed(index, phase) {
    this.failed++;
    this.running = false;
    if (phase) {
      const p = this.phases.find(ph => ph.name === phase);
      if (p) p.failed++;
    }
    this.rerender();
  }

  tick() {
    if (!this.tty || !this.running) return;
    this.rerender();
  }

  // Flash a status line below the UI
  flash(icon, msg) {
    if (!this.tty) {
      console.log(`${icon} ${msg}`);
      return;
    }
    // Save cursor, print flash below UI, restore cursor
    process.stdout.write(`\x1b[s\n  ${icon} ${msg}\n\x1b[u`);
  }

  destroy() {
    this.running = false;
    this.rerender();
  }
}

// ─── SPAWN FREEBUFF VIA NODE-PTY ─────────────────────────
async function spawnFreebuffPTY(taskText, logger, ui) {
  let pty;
  try {
    pty = (await import('node-pty')).default;
  } catch {
    return { success: false, error: 'node-pty belum keinstall. Jalankan: npm install node-pty', output: '', duration: 0 };
  }

  // Safety timeout — guarantee resolve even if PTY hangs (timeout + 30s grace)
  const safetyTimeoutMs = (CFG.timeout + 30) * 1000;

  const ptyPromise = new Promise((resolve) => {
    const startTime = Date.now();
    let output = '';
    let lastOutputTime = Date.now();
    let taskSent = false;
    let exitSent = false;
    let termClosed = false;

    const isWin = platform() === 'win32';
    const fbEntry = getFreebuffEntry();
    const isDirect = fbEntry.endsWith('.js');
    let cmd, args;

    if (isWin && isDirect) {
      cmd = process.execPath; args = [fbEntry];
    } else if (isWin && fbEntry === 'freebuff') {
      try {
        const where = execSync('where freebuff 2>nul', { encoding: 'utf-8', timeout: 3000 }).trim().split('\n')[0];
        cmd = where || 'freebuff.cmd'; args = [];
      } catch { cmd = 'freebuff.cmd'; args = []; }
    } else {
      cmd = isDirect ? process.execPath : fbEntry;
      args = isDirect ? [fbEntry] : [];
    }

    logger.log('INFO', `🚀 Spawning PTY: ${cmd} ${args.join(' ')}`);
    logger.log('INFO', `🆔 Idle timeout: ${CFG.idleTimeout}s | OS: ${platform()}`);

    if (ui) ui.flash('🚀', 'Freebuff starting...');

    const ptyOpts = {
      name: isWin ? 'xterm-256color' : 'xterm-256color',
      cols: 120, rows: 40, cwd: process.cwd(),
      env: {
        ...process.env,
        FREEBUFF_LOOPER: '1',
        TERM: isWin ? 'xterm-256color' : (process.env.TERM || 'xterm-256color'),
        NO_COLOR: CFG.verbose ? '0' : '1',
        // FREEBUFF_MODEL sebagai hint — user tetap pilih manual
        ...(CFG.model ? { FREEBUFF_MODEL: CFG.model } : {}),
      },
    };

    const term = pty.spawn(cmd, args, ptyOpts);

    term.onData((data) => {
      output += data;
      lastOutputTime = Date.now();
      if (CFG.verbose) process.stdout.write(data);
      logger.logRaw(data);
    });

    // Track startup timeout IDs biar bisa di-clear di safeKill
    const startupTimers = [];

    const safeKill = () => {
      if (termClosed) return;
      termClosed = true;
      clearInterval(idleChecker);
      clearTimeout(hardTimeout);
      for (const t of startupTimers) clearTimeout(t);
      startupTimers.length = 0;
      try { term.kill(); } catch {}
    };

    term.onExit(({ exitCode, signal }) => {
      safeKill();
      const duration = (Date.now() - startTime) / 1000;
      resolve({ success: exitCode === 0 || !!signal, error: exitCode !== 0 && !signal ? `Exit code: ${exitCode}` : null, output, duration });
    });

    // ─── Startup navigation sequence ─────────────────────
    // Freebuff TUI startup: splash → model picker (USER PILIH MANUAL) → folder picker → chat
    const runStartupSequence = () => {
      // Step 1: Tunggu 7s buat loading + model picker muncul
      startupTimers.push(setTimeout(() => {
        if (exitSent || termClosed) return;

        // User pilih model sendiri — kasih waktu 10 detik
        logger.log('INFO', '👆 Model picker muncul — user punya 10 detik buat pilih model sendiri!');
        if (ui) ui.flash('👆', 'Pilih model sekarang! Looper-Man lanjut otomatis dalam 10s...');

        // Step 2: Tunggu 10s (user milih model manual), lalu Enter + lanjut
        startupTimers.push(setTimeout(() => {
          if (exitSent || termClosed) return;

          term.write('\r'); // Enter — konfirmasi model (gak ngefek kalo udah dipilih)
          logger.log('INFO', '⏩ Waktu pilih model habis. Lanjut ke folder picker...');
          if (ui) ui.flash('⏩', 'Lanjut otomatis...');

          // Step 3: Tunggu 2.5s, tekan Tab buat folder picker
          startupTimers.push(setTimeout(() => {
            if (exitSent || termClosed) return;
            term.write('\t'); // Tab — ke folder picker

            // Step 4: Tunggu 1.5s, tekan Enter buat konfirmasi folder
            startupTimers.push(setTimeout(() => {
              if (exitSent || termClosed) return;
              term.write('\r'); // Enter — konfirmasi folder / start chat
              if (ui) ui.flash('📂', 'Folder confirmed');

              // Step 5: Tunggu 2s, KIRIM TASK
              startupTimers.push(setTimeout(() => {
                if (exitSent || termClosed) return;

                const preview = taskText.slice(0, 80).replace(/\n/g, '↵');
                logger.log('INFO', `📤 Kirim task: "${preview}${taskText.length > 80 ? '...' : ''}"`);
                term.write(taskText + '\r');
                taskSent = true;
                lastOutputTime = Date.now(); // Reset idle timer — mulai hitung dari sini
                if (ui) ui.flash('📤', 'Task dikirim ke Freebuff');
              }, 2000));
            }, 1500));
          }, 2500));
        }, 10000));
      }, 7000));
    };

    // Kick off the startup sequence
    runStartupSequence();

    const idleChecker = setInterval(() => {
      if (!taskSent || exitSent || termClosed) return;
      const idleTime = (Date.now() - lastOutputTime) / 1000;
      if (idleTime >= CFG.idleTimeout) {
        exitSent = true;
        logger.log('INFO', `🛑 Output idle ${idleTime.toFixed(0)}s — kirim /exit`);
        try { term.write('\r'); } catch {}
        setTimeout(() => { try { term.write('/exit\r'); } catch {} }, 1000);
        setTimeout(() => { safeKill(); }, 15000);
      }
    }, 5000);

    const hardTimeout = setTimeout(() => {
      if (!exitSent && !termClosed) {
        exitSent = true;
        logger.log('WARN', `⏰ Hard timeout ${CFG.timeout}s — force kill`);
        try { term.write('/exit\r'); } catch {}
        setTimeout(() => { safeKill(); }, 5000);
      }
    }, CFG.timeout * 1000);
  });

  // Race PTY promise against safety timeout — prevent hanging forever
  const safetyPromise = new Promise((resolve) => {
    setTimeout(() => {
      logger.log('WARN', `🛡️  Safety timeout ${safetyTimeoutMs / 1000}s — force resolve`);
      resolve({
        success: false,
        error: `PTY safety timeout setelah ${safetyTimeoutMs / 1000}s`,
        output: '', duration: safetyTimeoutMs / 1000,
      });
    }, safetyTimeoutMs);
  });

  return Promise.race([ptyPromise, safetyPromise]);
}

function spawnFreebuffSimple(task, logger, ui) {
  const safetyTimeoutMs = (CFG.timeout + 30) * 1000;

  const pipePromise = new Promise((resolve) => {
    const startTime = Date.now();
    let output = '';
    const isWin = platform() === 'win32';
    logger.log('INFO', `🚀 Spawning (simple): freebuff | OS: ${platform()}`);

    if (ui) ui.flash('🚀', 'Freebuff starting (pipe mode)...');

    const child = spawn('freebuff', [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true, detached: true, windowsHide: true,
      env: {
        ...process.env, FREEBUFF_LOOPER: '1', TERM: 'dumb', NO_COLOR: '1',
        ...(CFG.model ? { FREEBUFF_MODEL: CFG.model } : {}),
      },
      cwd: process.cwd(),
    });

    child.on('error', (err) => {
      resolve({
        success: false,
        error: err.code === 'ENOENT' ? 'Freebuff gak ditemukan. npm install -g freebuff' : err.message,
        output: '', duration: (Date.now() - startTime) / 1000
      });
    });

    child.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      if (CFG.verbose) process.stdout.write(text);
      logger.logRaw(text);
    });

    child.stderr.on('data', (data) => { logger.logRaw(data.toString()); });
    child.unref();

    setTimeout(() => {
      if (!child.killed && child.stdin.writable) {
        child.stdin.write(task + '\n');
        const preview = task.slice(0, 80).replace(/\n/g, '↵');
        logger.log('INFO', `📤 Task: "${preview}..."`);
        if (ui) ui.flash('📤', 'Task dikirim ke Freebuff');
      }
    }, 2000);

    const timeout = setTimeout(() => {
      logger.log('WARN', `⏰ Timeout ${CFG.timeout}s`);
      try {
        if (isWin) { execSync(`taskkill /pid ${child.pid} /T /F 2>nul`, { stdio: 'ignore' }); }
        else {
          child.kill('SIGTERM');
          setTimeout(() => { if (!child.killed) child.kill('SIGKILL'); }, 3000);
        }
      } catch {}
    }, CFG.timeout * 1000);

    child.on('close', (code) => {
      clearTimeout(timeout);
      const duration = (Date.now() - startTime) / 1000;
      resolve({ success: code === 0 || code === null, error: code !== 0 ? `Exit: ${code}` : null, output, duration });
    });
  });

  // Race pipe promise against safety timeout
  const safetyPromise = new Promise((resolve) => {
    setTimeout(() => {
      logger.log('WARN', `🛡️  Pipe safety timeout ${safetyTimeoutMs / 1000}s — force resolve`);
      resolve({
        success: false,
        error: `Pipe safety timeout setelah ${safetyTimeoutMs / 1000}s`,
        output: '', duration: safetyTimeoutMs / 1000,
      });
    }, safetyTimeoutMs);
  });

  return Promise.race([pipePromise, safetyPromise]);
}

// ─── CORE LOOPER (v3 — rich terminal UI) ──────────────────
async function runLooper(taskItems, logger) {
  const total = taskItems.length;
  let completed = 0;
  let failed = 0;

  let session;
  let startIndex = 0;

  if (CFG.resume) {
    session = loadProgress();
    if (!session) {
      logger.log('WARN', '⚠️  Gak ada progress file buat di-resume. Mulai dari awal.');
      session = initProgress(taskItems, CFG.taskFile);
    } else if (session.tasks.length !== total) {
      logger.log('WARN', '╔══════════════════════════════════════════════════╗');
      logger.log('WARN', '║  ⚠️  TASK FILE BERUBAH!                         ║');
      logger.log('WARN', `║  Progress: ${session.tasks.length} task | File sekarang: ${total} task      ║`);
      logger.log('WARN', '║  Progress lama di-reset. Mulai dari awal.       ║');
      logger.log('WARN', '╚══════════════════════════════════════════════════╝');
      session = initProgress(taskItems, CFG.taskFile);
    } else {
      startIndex = getResumeIndex(session);
      if (startIndex >= total) {
        logger.log('INFO', '✅ Semua task udah selesai! Gak ada yang perlu di-resume.');
        return { total, completed: total, failed: 0, results: [], session };
      }
      for (let i = 0; i < startIndex; i++) {
        if (session.tasks[i].status === 'completed') completed++;
        else if (session.tasks[i].status === 'failed') failed++;
        taskItems[i].status = session.tasks[i].status;
        taskItems[i].duration = session.tasks[i].duration;
        taskItems[i].filesChanged = session.tasks[i].filesChanged;
        taskItems[i].error = session.tasks[i].error;
      }
      logger.log('INFO', `🔄 Resume dari task #${startIndex + 1}/${total}`);
      logger.log('INFO', `   Sudah: ${completed} ✅ | ${failed} ❌ | ${total - startIndex} tersisa`);
    }
  } else {
    session = initProgress(taskItems, CFG.taskFile);
  }

  logger.log('INFO', `\n═══ LOOPER START ═══`);
  logger.log('INFO', `Total: ${total} | Delay: ${CFG.delay}s | Retry: ${CFG.retry}x | Timeout: ${CFG.timeout}s | Idle: ${CFG.idleTimeout}s`);
  logger.log('INFO', `Context: ${CFG.context ? 'ON' : 'OFF'} | Resume: ${CFG.resume ? `dari #${startIndex + 1}` : 'dari awal'}`);
  logger.log('INFO', `Log: ${logger.file}`);
  logger.log('INFO', `Progress: ${CFG.progressFile}`);

  // ─── Setup Terminal UI ─────────────────────────────
  const ui = new TerminalUI(total, session.phases, logger.file);

  // Sync completed/failed dari session ke UI (buat resume)
  for (const p of session.phases) {
    const uiPhase = ui.phases.find(up => up.name === p.name);
    if (uiPhase) { uiPhase.completed = p.completed; uiPhase.failed = p.failed; }
  }
  ui.completed = completed;
  ui.failed = failed;

  // Sync durations dari session (buat resume)
  for (let i = 0; i < startIndex; i++) {
    const t = session.tasks[i];
    if (t.status === 'completed' && t.duration > 0) ui.durations.push(t.duration);
  }

  // Suppress logger console output — UI handles display
  logger.silent = !CFG.verbose;

  // Initial render
  ui.render();

  // ─── Task loop ────────────────────────────────────
  for (let i = startIndex; i < total; i++) {
    const taskItem = taskItems[i];
    const taskNum = i + 1;

    // Build full prompt with context
    let fullPrompt = taskItem.task;
    if (CFG.context && i > 0) {
      const contextBlock = buildContextBlock(session, i);
      if (contextBlock) {
        fullPrompt = contextBlock + '\n' + '─'.repeat(40) + '\n📌 TASK SEKARANG: ' + taskItem.task;
      }
    }

    if (CFG.dryRun) {
      logger.log('DRYRUN', `[SIMULASI] ${taskNum}. ${taskItem.task}`);
      completed++;
      taskItem.status = 'completed';
      updateProgressTask(session, i, { status: 'completed', duration: 0, timestamp: new Date().toISOString() });
      ui.setDone(i, taskItem.phase, 0);
      continue;
    }

    // Show running state in UI
    ui.setRunning(i, taskItem.phase, taskItem.task);

    // Start tick interval — update elapsed time every 2 detik
    const tickInterval = setInterval(() => ui.tick(), 2000);

    // Execute dengan retry
    let result = null;
    let currentAttempt = 1;
    const taskStartTime = Date.now();

    try {
      for (let attempt = 1; attempt <= CFG.retry + 1; attempt++) {
        currentAttempt = attempt;
        if (attempt > 1) {
          const retryPreview = taskItem.task.slice(0, 60);
          logger.log('RETRY', `🔄 Retry ${attempt - 1}/${CFG.retry}: "${retryPreview}..."`);
          ui.flash('🔄', `Retry ${attempt - 1}/${CFG.retry}...`);
        }

        // Choose spawn method based on --no-pty flag
        if (CFG.noPty) {
          result = await spawnFreebuffSimple(fullPrompt, logger, ui);
        } else {
          result = await spawnFreebuffPTY(fullPrompt, logger, ui);

          if (!result.success && result.error?.includes('node-pty belum')) {
            logger.log('WARN', '⚠️  node-pty gak tersedia, fallback ke pipe mode');
            result = await spawnFreebuffSimple(fullPrompt, logger, ui);
          }
        }

        if (result.success) break;
      }
    } finally {
      // Stop tick — always cleanup
      clearInterval(tickInterval);
    }

    // Post-task analysis
    const analysis = analyzeTaskResult(i, taskStartTime, result, logger);

    // Update state
    taskItem.status = result.success ? 'completed' : 'failed';
    taskItem.duration = result.duration;
    taskItem.attempts = currentAttempt;
    taskItem.error = result.error;
    taskItem.output = result.output?.slice(-500);

    const dur = result.duration?.toFixed(1) || '?';

    if (result.success) {
      completed++;
      logger.log('OK', `✅ [${taskNum}/${total}] Done — ${dur}s`);
      ui.setDone(i, taskItem.phase, result.duration);
      ui.flash('✅', `Task ${taskNum} selesai — ${dur}s`);
      updateProgressTask(session, i, {
        status: 'completed', duration: result.duration,
        timestamp: new Date().toISOString(), filesChanged: analysis.filesChanged, error: null,
      });
    } else {
      failed++;
      logger.log('FAIL', `❌ [${taskNum}/${total}] ${result.error?.slice(0, 200)}`);
      ui.setFailed(i, taskItem.phase);
      ui.flash('❌', `Task ${taskNum} gagal — ${result.error?.slice(0, 80)}`);
      updateProgressTask(session, i, {
        status: 'failed', duration: result.duration,
        timestamp: new Date().toISOString(), error: result.error,
      });
    }

    // Jeda antar task
    if (i < total - 1 && CFG.delay > 0) {
      logger.log('INFO', `⏳ Jeda ${CFG.delay}s...`);
      await sleep(CFG.delay * 1000);
    }
  }

  // Finalize
  session.completedAt = new Date().toISOString();
  saveProgress(session);

  ui.destroy();

  // Restore logger console
  logger.silent = false;

  logger.log('INFO', `\n═══ LOOPER SELESAI ═══`);
  logger.log('INFO', `✅ Berhasil: ${completed}/${total}`);
  if (failed > 0) logger.log('INFO', `❌ Gagal:     ${failed}/${total}`);
  logger.log('INFO', `📄 Log:      ${logger.file}`);
  logger.log('INFO', `📊 Progress: ${CFG.progressFile}`);

  return { total, completed, failed, results: [], session };
}

// ─── INTERACTIVE MODE ────────────────────────────────────
async function interactiveMode(logger) {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║     ▓▓ LOOPER-MAN - Interactive Mode ▓▓      ║
  ║  Ketik task satu per satu.                   ║
  ║  /done = selesai input, mulai eksekusi       ║
  ║  /exit = keluar                              ║
  ╚══════════════════════════════════════════════╝
  `);

  const taskItems = [];
  const readline = (await import('node:readline')).default;
  const rl = readline.createInterface({
    input: process.stdin, output: process.stdout, prompt: '📝 task> ',
  });

  rl.prompt();

  for await (const line of rl) {
    const t = line.trim();
    if (t === '/done' || t === '/exit') break;
    if (t.length > 0 && !t.startsWith('#')) {
      taskItems.push({ task: t, phase: null, status: 'pending', attempts: 0 });
      console.log(`   [+] Task #${taskItems.length} ditambahkan`);
    }
    rl.prompt();
  }
  rl.close();

  if (taskItems.length === 0) {
    console.log('⚠️  Gak ada task. Exit.');
    process.exit(0);
  }

  console.log(`\n📋 ${taskItems.length} task siap.\n`);
  return runLooper(taskItems, logger);
}

// ─── HELPERS ──────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── MAIN ─────────────────────────────────────────────────
async function main() {
  const flags = parseArgs();

  if (flags.file)            CFG.taskFile = flags.file;
  if (flags.delay !== null)  CFG.delay = flags.delay;
  if (flags.retry !== null)  CFG.retry = flags.retry;
  if (flags.timeout !== null) CFG.timeout = flags.timeout;
  if (flags.idleTimeout !== null) CFG.idleTimeout = flags.idleTimeout;
  if (flags.logDir)          CFG.logDir = flags.logDir;
  if (flags.freebuffPath)    CFG.freebuffPath = flags.freebuffPath;
  if (flags.model)           CFG.model = flags.model;
  if (flags.noPty)           CFG.noPty = true;
  if (flags.verbose)         CFG.verbose = true;
  if (flags.dryRun)          CFG.dryRun = true;
  if (flags.force)           CFG.force = true;
  if (flags.resume)          CFG.resume = true;
  if (flags.noContext)       CFG.context = false;
  if (flags.context === true) CFG.context = true;

  checkAndWarnFreebuffSession();

  if (!CFG.dryRun) {
    const fbPath = getFreebuffEntry();
    if (!fbPath) {
      console.error('⚠️  Freebuff gak ketemu. Install: npm install -g freebuff');
      console.error('   Atau: --dry-run buat simulasi');
      process.exit(1);
    }
    console.log(`🔍 Freebuff: ${fbPath}`);
  }

  console.log(`🔗 Context: ${CFG.context ? 'ON' : 'OFF'}`);
  if (CFG.model) console.log(`🧠 Model: ${CFG.model}`);
  if (CFG.noPty) console.log('📡 Mode: Pipe (--no-pty)');
  if (CFG.resume) console.log('🔄 Resume mode: ON');
  if (!CFG.verbose) console.log('🖥  Rich UI mode (pake -v buat verbose)');
  console.log('');

  const logger = setupLogger();

  if (flags.interactive) {
    await interactiveMode(logger);
    return;
  }

  if (!flags.file) {
    console.error('❌ Harap tentukan --file <tasks.txt> atau --interactive');
    console.error('   --help buat bantuan');
    process.exit(1);
  }

  const taskItems = readTasks(CFG.taskFile);
  if (taskItems.length === 0) {
    console.error('⚠️  File task kosong.');
    process.exit(1);
  }

  // Summary
  console.log(`📋 ${taskItems.length} tasks dari "${CFG.taskFile}"`);
  const phases = new Map();
  for (const t of taskItems) {
    const name = t.phase || '(no phase)';
    if (!phases.has(name)) phases.set(name, []);
    phases.get(name).push(t);
  }
  if (phases.size > 1) {
    console.log(`📂 ${phases.size} phases:`);
    for (const [name, tasks] of phases) {
      console.log(`   ▸ ${name}: ${tasks.length} task`);
    }
  }
  console.log('\n' + '─'.repeat(50) + '\n');

  await runLooper(taskItems, logger);
}

main().catch(err => {
  console.error('💥 Fatal:', err);
  process.exit(1);
});
