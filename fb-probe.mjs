#!/usr/bin/env node
/**
 * fb-probe.mjs — Probe Freebuff's startup screens via node-pty.
 * Captures what the TUI shows at each step and tries key sequences
 * to get from the landing screen into the chat input.
 */
import { platform } from 'node:os';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const pty = (await import('node-pty')).default;

const fbEntry = 'C:/Users/KandarLubis/AppData/Roaming/npm/node_modules/freebuff/index.js';
const isWin = platform() === 'win32';
const cmd = isWin ? process.execPath : fbEntry;
const args = isWin ? [fbEntry] : [];

// Optional argv (extra CLI args to test, e.g. --continue)
const extraArgs = JSON.parse(process.env.PROBE_ARGS || '[]');

const term = pty.spawn(cmd, [...args, ...extraArgs], {
  name: 'xterm-256color',
  cols: 120,
  rows: 40,
  cwd: process.cwd(),
  env: {
    ...process.env,
    TERM: 'xterm-256color',
    NO_COLOR: '1',
  },
});

function stripANSI(s) {
  return s
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\x1b[()][0-9A-Z]/g, '')
    .replace(/\x1b\[[0-9;]*[MHF]/g, '')
    .replace(/\r/g, '');
}

let raw = '';
term.onData((d) => { raw += d; });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function snapshot(label) {
  const text = stripANSI(raw).split('\n').map((l) => l.replace(/\s+$/g, ''));
  const nonEmpty = text.filter((l) => l.trim().length > 0);
  const tail = nonEmpty.slice(-35);
  console.log(`\n${'='.repeat(70)}\n[SNAPSHOT ${label}] t=${(Date.now() - t0) / 1000}s — ${tail.length} visible lines\n${'='.repeat(70)}`);
  for (const l of tail) console.log('| ' + l.slice(0, 115));
  console.log('');
}

const t0 = Date.now();

// Phase 1: initial startup
await sleep(7000);
snapshot('A-after-7s-startup');

// Phase 2: try Enter (select recommended / start)
term.write('\r');
await sleep(2500);
snapshot('B-after-enter');

// Phase 3: if a folder picker, try tab or start-here key
term.write('\t');
await sleep(1500);
snapshot('C-after-tab');

term.write('\r');
await sleep(2000);
snapshot('D-after-enter-2');

// Phase 4: type a test prompt
term.write('test probe prompt 12345\r');
await sleep(3000);
snapshot('E-after-typed-prompt');

// Phase 5: try to exit cleanly
term.write('/exit\r');
await sleep(1500);
snapshot('F-after-exit');

try { term.kill(); } catch {}
process.exit(0);
