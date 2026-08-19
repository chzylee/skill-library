#!/usr/bin/env node
// oneshot fixture — the config-form-shaped consumer: save once, end from inside
// the save handler via ctx.end('done'), never wait for a second request.
import { writeFileSync } from 'node:fs';
import { serveUI } from '../local-ui.mjs';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

const out = opt('--out', null);
let saved = null;

await serveUI({
  name: 'ONESHOT',
  html: '<html><body><form>oneshot __TOKEN__</form></body></html>',
  routes: {
    'POST /api/save': (body, ctx) => {
      saved = body.values || {};
      if (out) writeFileSync(out, JSON.stringify(saved, null, 2) + '\n');
      ctx.end('done'); // the save IS the ender — no second fetch to lose
      return { ok: true };
    },
  },
  enders: {
    done: true,
    close: false,
    clock: opt('--clock', undefined) === undefined ? undefined : Number(opt('--clock')),
  },
  onSummary: () => ({ lines: [`saved${out ? ` out=${out}` : ''}`], data: { saved, out } }),
  resultFile: opt('--result', undefined),
  open: false,
});
