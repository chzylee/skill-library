#!/usr/bin/env node
// local-ui — the supervised-subprocess engine for skill UIs.
// version: 0.1.0  (vendor stamp — /skill-dev-rig writes this file into consuming skills;
//                  later `rig status` / `rig upgrade` tooling keys off this header)
//
// A consuming skill calls serveUI() with its page and routes; the engine owns
// everything an agent-faced local UI keeps getting wrong when hand-rolled:
//
//   - loopback bind, Host-header check (DNS rebinding), per-run token on EVERY
//     route including `/`, cross-origin rejection on API routes
//   - close detection: ping injected before </body>, watchdog armed only after
//     the FIRST ping (a slow browser launch can never kill the server)
//   - three independent end-conditions (enders: done / close / clock) funneling
//     into ONE serialized shutdown that drains in-flight requests, calls
//     onSummary exactly once, writes the run record, prints the fence, exits
//   - stdout markers the calling agent parses, derived from the CONSUMING
//     skill's name:  <NAME>_URL= <NAME>_RESULT= <NAME>_SUMMARY…<NAME>_DONE
//     <NAME>_CLOSED <NAME>_TIMEOUT <NAME>_ERROR   (errors go to stdout — the
//     agent parses one stream; an error where the parser isn't looking is
//     worse than an error on the "wrong" stream)
//
// Exit codes: 0 normal or closed · 2 bad args / precondition · 3 timeout.
// Node stdlib only — vendorable as one file. See UI-CONTRACT.md for the why
// behind every rule here, including the ~10-minute blocking-Bash ceiling that
// makes 540 the default clock.

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export const LOCAL_UI_VERSION = '0.1.0';

const out = (s) => process.stdout.write(s);
const iso = () => new Date().toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The lifetime is NOT a mode enum. It is a set of independent end-conditions.
// `watch` / `oneshot` / `viewer` are presets /skill-dev-rig writes, not engine concepts.
// clock: absent/invalid -> 540 (the blocking-Bash ceiling holds for a consumer
// that reads no docs); explicit 0 -> disabled (a deliberate opt-out for
// backgrounded long sessions).
export function normalizeEnders(enders) {
  const e = enders || {};
  let clock = 540;
  if (e.clock === 0) clock = 0;
  else if (typeof e.clock === 'number' && Number.isFinite(e.clock) && e.clock > 0) clock = e.clock;
  return { done: Boolean(e.done), close: Boolean(e.close), clock };
}

// Inject the keepalive ping before the LAST </body> (a page may quote the tag
// in escaped form only; the last literal occurrence is the real one). The ping
// fires immediately on load and again on pageshow/visibilitychange so a
// machine waking from sleep re-announces the tab before the watchdog can call
// it closed. The token placeholder is substituted with everything else.
export function injectPing(html, pingMs) {
  const script = `<script>(function(){var q='/api/ping?token=__TOKEN__';`
    + `var p=function(){try{fetch(q,{method:'POST'}).catch(function(){})}catch(e){}};`
    + `p();setInterval(p,${Number(pingMs) || 3000});`
    + `addEventListener('pageshow',p);`
    + `document.addEventListener('visibilitychange',function(){if(!document.hidden)p()})`
    + `})()</script>`;
  const at = html.lastIndexOf('</body>');
  if (at < 0) return html + script;
  return html.slice(0, at) + script + html.slice(at);
}

function send(res, code, obj) {
  try {
    const b = Buffer.from(JSON.stringify(obj));
    res.writeHead(code, { 'content-type': 'application/json', 'content-length': b.length });
    res.end(b);
  } catch { /* client went away — nothing to do */ }
}

// Body parsing with a hard cap (memory-manager's 5MB), accumulation stops at
// the cap rather than after it.
function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    let failed = false;
    req.on('data', (c) => {
      if (failed) return;
      s += c;
      if (s.length > 5e6) { failed = true; s = ''; }
    });
    req.on('end', () => {
      if (failed) return reject(Object.assign(new Error('body too large'), { statusCode: 413 }));
      try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(Object.assign(e, { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

// Browser launch in stdlib. No shell:true anywhere: the win32 path spawns cmd
// with an argv array (start needs cmd because it is a builtin, and the empty
// '' is the title slot so the URL is never read as one). The URL is entirely
// engine-constructed — loopback host, numeric port, hex token, no '&' — so no
// cmd metacharacter can appear in it. This fixes the quoting hazard of
// memory-manager.mjs:870 without leaving stdlib.
function openBrowser(url) {
  try {
    if (process.platform === 'darwin') {
      spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
    } else if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true }).unref();
    } else {
      spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
    }
  } catch { /* the URL is on stdout regardless */ }
}

export async function serveUI(opts = {}) {
  const rawName = typeof opts.name === 'string' ? opts.name : '';
  const name = /^[A-Z][A-Z0-9_]*$/.test(rawName) ? rawName : null;
  const prefix = name || 'UI';
  const fail = (msg) => { out(`${prefix}_ERROR ${msg}\n`); process.exit(2); };

  if (!name) fail(`invalid name: ${JSON.stringify(rawName)} — need /^[A-Z][A-Z0-9_]*$/ (the marker prefix)`);
  if (typeof opts.html !== 'string' || !opts.html) fail('html is required (a non-empty string)');

  const routes = opts.routes || {};
  for (const key of Object.keys(routes)) {
    if (!/^(GET|POST|PUT|PATCH|DELETE) \/api\//.test(key)) {
      fail(`route ${JSON.stringify(key)} must be "METHOD /api/..." — API routes are what the token and origin gates cover`);
    }
    if (/ \/api\/(ping|done)$/.test(key)) fail(`route ${JSON.stringify(key)} shadows an engine-owned route`);
    if (typeof routes[key] !== 'function') fail(`route ${JSON.stringify(key)} handler must be a function`);
  }

  const enders = normalizeEnders(opts.enders);
  const onSummary = typeof opts.onSummary === 'function' ? opts.onSummary : () => ({ lines: [], data: {} });
  const timings = {
    pingMs: Number(opts.timings?.pingMs) || 3000,   // contract values; overridable for tests only
    deadMs: Number(opts.timings?.deadMs) || 12000,
    drainMs: Number(opts.timings?.drainMs) || 5000,
  };
  const TOKEN = randomBytes(12).toString('hex');
  const startedAt = iso();
  const resultFile = typeof opts.resultFile === 'string' && opts.resultFile
    ? opts.resultFile
    : join(tmpdir(), `${name.toLowerCase().replace(/_/g, '-')}-run-${Date.now()}-${process.pid}.json`);

  const record = { name, reason: 'running', pid: process.pid, startedAt };
  const writeRecord = () => writeFileSync(resultFile, JSON.stringify(record, null, 2) + '\n');
  try { writeRecord(); } catch (e) { fail(`cannot write result file ${resultFile}: ${e.message}`); }

  // ---- lifetime state -----------------------------------------------------
  let finishing = false;
  let inFlight = 0;
  let lastPing = 0;
  let watchdog = null;   // armed only after the first ping
  let clockTimer = null;

  function armWatchdog() {
    if (watchdog || !enders.close) return;
    watchdog = setInterval(() => {
      if (finishing || Date.now() - lastPing <= timings.deadMs) return;
      shutdown('closed', 0);
    }, Math.min(timings.pingMs, timings.deadMs));
  }

  // ONE serialized shutdown path. All three enders (and signals) enter here;
  // the first one wins, later ones are no-ops — which designs out the
  // done-vs-clock race that made memory-manager report a finished session as
  // a TIMEOUT (design doc finding 7).
  async function shutdown(reason, code, note) {
    if (finishing) return;
    finishing = true;
    if (watchdog) clearInterval(watchdog);
    if (clockTimer) clearTimeout(clockTimer);
    try { server.close(); } catch { /* already closing */ }

    const deadline = Date.now() + timings.drainMs;               // bounded drain:
    while (inFlight > 0 && Date.now() < deadline) await sleep(25); // a wedged request
                                                                  // cannot outlive the run
    let summary = { lines: [], data: {} };
    try {
      summary = (await onSummary()) || summary;                  // may be async
    } catch (e) {
      summary = { lines: [`onSummary failed: ${e.message || e}`], data: { error: String(e.message || e) } };
    }

    if (reason === 'closed') out(`\n${name}_CLOSED\n`);
    else if (reason === 'timeout') out(`\n${name}_TIMEOUT\n`);
    else if (reason === 'error') out(`\n${name}_ERROR ${note || 'terminated'}\n`);
    out(`\n${name}_SUMMARY\n`);
    for (const line of summary.lines || []) out(`${line}\n`);
    out(`${name}_DONE\n`);

    record.reason = reason;
    record.exitCode = code;
    record.endedAt = iso();
    record.summary = summary.data ?? {};
    try { writeRecord(); } catch { /* the fence already told the agent */ }
    try { server.closeAllConnections?.(); } catch { /* best effort */ }
    process.exit(code);
  }

  // ---- server -------------------------------------------------------------
  const server = createServer((req, res) => {
    inFlight += 1;
    res.on('close', () => { inFlight -= 1; });
    handle(req, res).catch((e) => send(res, e.statusCode || 400, { error: String(e.message || e) }));
  });

  async function handle(req, res) {
    if (finishing) return send(res, 503, { error: 'shutting down' });
    const url = new URL(req.url, 'http://127.0.0.1');
    const p = url.pathname;

    // Reject any request whose Host is not loopback — closes DNS rebinding
    // (evil.com resolving to 127.0.0.1 would otherwise read the token off `/`
    // as a same-origin fetch). Lifted from memory-manager.mjs:779-782.
    const host = String(req.headers.host || '').toLowerCase();
    if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host)) {
      return send(res, 403, { error: 'bad host' });
    }

    // Per-run token on EVERY route, including `/` — nothing without it can
    // bootstrap a session.
    const tok = url.searchParams.get('token') || req.headers['x-ui-token'];
    if (tok !== TOKEN) return send(res, 403, { error: 'bad token' });

    // Reject cross-origin callers outright on API routes.
    if (p.startsWith('/api/')) {
      const origin = req.headers.origin;
      if (origin && !/^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):/.test(origin)) {
        return send(res, 403, { error: 'bad origin' });
      }
    }

    if ((p === '/' || p === '/index.html') && req.method === 'GET') {
      let page = opts.html;
      if (enders.close) page = injectPing(page, timings.pingMs);
      page = page.replaceAll('__TOKEN__', TOKEN);
      const b = Buffer.from(page);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': b.length });
      return res.end(b);
    }

    if (p === '/api/ping' && req.method === 'POST') {
      lastPing = Date.now();
      armWatchdog();
      return send(res, 200, { ok: true });
    }

    if (p === '/api/done' && req.method === 'POST') {
      if (!enders.done) return send(res, 404, { error: 'done ender not enabled' });
      send(res, 200, { ok: true });
      return shutdown('done', 0);
    }

    const handler = routes[`${req.method} ${p}`];
    if (handler) {
      const body = await readBody(req);
      let endRequest = null;
      const ctx = {
        req, res, url,
        // Fire-once, nothing to pair or forget: a route handler may end the
        // run itself (config-form's save IS its ender), entering the same
        // serialized shutdown after the response flushes.
        end: (reason = 'done') => { endRequest = reason === 'timeout' ? ['timeout', 3] : [reason === 'closed' ? 'closed' : 'done', 0]; },
      };
      try {
        const result = await handler(body, ctx);
        if (!res.writableEnded) send(res, 200, result ?? { ok: true });
      } catch (e) {
        if (!res.writableEnded) send(res, e.statusCode || 400, { error: String(e.message || e) });
        return;
      }
      if (endRequest) return shutdown(endRequest[0], endRequest[1]);
      return;
    }

    return send(res, 404, { error: 'not found' });
  }

  // Signals route through the same serialized path so a terminated run still
  // finalizes its record — a backgrounded reader can then tell "died" from
  // "still running" (record.reason stays 'running' only on a hard kill).
  process.on('SIGINT', () => { shutdown('error', 2, 'terminated by SIGINT'); });
  process.on('SIGTERM', () => { shutdown('error', 2, 'terminated by SIGTERM'); });

  await new Promise((resolve) => {
    server.listen(Number(opts.port || 0), '127.0.0.1', resolve);
  });
  const url = `http://127.0.0.1:${server.address().port}/?token=${TOKEN}`;
  out(`${name}_URL=${url}\n`);
  out(`${name}_RESULT=${resultFile}\n`);
  if (opts.open !== false) openBrowser(url);

  if (enders.clock > 0) {
    clockTimer = setTimeout(() => shutdown('timeout', 3), enders.clock * 1000);
    clockTimer.unref();
  }

  // The promise never resolves: the run ends only through shutdown().
  return new Promise(() => {});
}
