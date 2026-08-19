#!/usr/bin/env node
// writer fixture — the memory-manager-shaped consumer: done + close + clock, and
// append-only JSONL writes (the study-read slice-3 shape P6 demands be provable).
// ~35 lines of consumer code is the point: this is what a rigged skill writes.
import { appendFileSync } from 'node:fs';
import { serveUI } from '../local-ui.mjs';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const flag = (n) => argv.includes(n);

const log = opt('--log', null);
let appends = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await serveUI({
  name: 'WRITER',
  html: '<html><body><h1>writer __TOKEN__</h1><p>__TOKEN__</p></body></html>',
  routes: {
    'POST /api/append': (body) => {
      if (log) appendFileSync(log, JSON.stringify(body) + '\n');
      appends += 1;
      return { ok: true, appends };
    },
    'POST /api/slow': async (body) => {
      await sleep(Number(body.ms || 500));
      if (log) appendFileSync(log, JSON.stringify({ slow: true }) + '\n');
      appends += 1;
      return { ok: true, slow: true };
    },
  },
  enders: {
    done: true,
    close: flag('--close'),
    clock: opt('--clock', undefined) === undefined ? undefined : Number(opt('--clock')),
  },
  onSummary: async () => {
    if (flag('--slow-summary')) await sleep(400);
    return { lines: [`${appends} append(s)${log ? ` to ${log}` : ''}`], data: { appends, log } };
  },
  resultFile: opt('--result', undefined),
  open: false,
  timings: {
    pingMs: Number(opt('--ping-ms', 3000)),
    deadMs: Number(opt('--dead-ms', 12000)),
  },
});
