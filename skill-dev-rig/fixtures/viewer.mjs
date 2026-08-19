#!/usr/bin/env node
// viewer fixture — the life-ledger-view-shaped consumer: read-only, close-only.
// No routes, no writes; the lifetime is "the tab is open".
import { serveUI } from '../local-ui.mjs';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

await serveUI({
  name: 'VIEWER',
  html: '<html><body><main>viewer</main></body></html>',
  enders: {
    done: false,
    close: true,
    clock: opt('--clock', undefined) === undefined ? undefined : Number(opt('--clock')),
  },
  onSummary: () => ({ lines: ['viewed'], data: {} }),
  resultFile: opt('--result', undefined),
  open: false,
  timings: {
    pingMs: Number(opt('--ping-ms', 3000)),
    deadMs: Number(opt('--dead-ms', 12000)),
  },
});
