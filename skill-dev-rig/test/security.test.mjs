// The strict posture from §6.4 — no dials, so every gate must actually gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURES, makeTmp, cleanup, start, api, raw } from '../helpers.mjs';

const WRITER = join(FIXTURES, 'writer.mjs');

async function withWriter(fn) {
  const tmp = makeTmp();
  const srv = await start(WRITER, 'WRITER', ['--log', join(tmp, 'log.jsonl')]);
  try { await fn(srv); } finally { srv.child.kill('SIGKILL'); cleanup(tmp); }
}

test('/ without a token is 403 — nothing without the token can bootstrap', async () => {
  await withWriter(async (srv) => {
    assert.equal((await raw(srv, '/')).status, 403);
    assert.equal((await raw(srv, '/?token=wrong')).status, 403);
    const ok = await raw(srv, `/?token=${srv.token}`);
    assert.equal(ok.status, 200);
    assert.doesNotMatch(ok.text, /__TOKEN__/, 'token substitution is replace-all');
    assert.equal(ok.text.split(srv.token).length - 1 >= 2, true, 'both placeholders substituted');
  });
});

test('API without / with wrong token is 403; ping included', async () => {
  await withWriter(async (srv) => {
    assert.equal((await raw(srv, '/api/append', { method: 'POST', body: '{}' })).status, 403);
    assert.equal((await raw(srv, '/api/ping?token=nope', { method: 'POST' })).status, 403);
    assert.equal((await api(srv, '/api/ping', { method: 'POST' })).status, 200);
  });
});

test('non-loopback Host is rejected (DNS rebinding)', async () => {
  // fetch/undici refuses to forge the Host header, which is exactly the attack
  // shape — so speak raw HTTP to the loopback socket with a lying Host.
  const { request } = await import('node:http');
  await withWriter(async (srv) => {
    const status = await new Promise((resolve, reject) => {
      const req = request({
        host: '127.0.0.1',
        port: srv.port,
        path: `/?token=${srv.token}`,
        headers: { host: 'evil.example.com' },
      }, (res) => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject);
      req.end();
    });
    assert.equal(status, 403);
  });
});

test('cross-origin callers are rejected on API routes', async () => {
  await withWriter(async (srv) => {
    const res = await fetch(`${srv.origin}/api/append?token=${srv.token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example.com' },
      body: '{}',
    });
    assert.equal(res.status, 403);
    const okRes = await fetch(`${srv.origin}/api/append?token=${srv.token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: srv.origin },
      body: '{"n":1}',
    });
    assert.equal(okRes.status, 200, 'loopback origin passes');
  });
});

test('bodies over the 5MB cap are rejected without killing the process', async () => {
  await withWriter(async (srv) => {
    const big = JSON.stringify({ pad: 'x'.repeat(5_500_000) });
    const res = await fetch(`${srv.origin}/api/append?token=${srv.token}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: big,
    }).catch(() => ({ status: 400 })); // some stacks reset the socket at the cap — equally a rejection
    assert.ok(res.status >= 400, `oversized body rejected (got ${res.status})`);
    assert.equal(srv.child.exitCode, null, 'server survived');
    const after = await api(srv, '/api/append', { method: 'POST', body: '{"n":2}' });
    assert.equal(after.status, 200, 'still serving after the oversized body');
  });
});

test('malformed JSON is a 400, not a crash', async () => {
  await withWriter(async (srv) => {
    const res = await fetch(`${srv.origin}/api/append?token=${srv.token}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope',
    });
    assert.equal(res.status, 400);
    assert.equal(srv.child.exitCode, null);
  });
});

test('unknown paths 403 without a token, 404 with one', async () => {
  await withWriter(async (srv) => {
    assert.equal((await raw(srv, '/does-not-exist')).status, 403);
    assert.equal((await raw(srv, `/does-not-exist?token=${srv.token}`)).status, 404);
  });
});

// A multibyte character straddling a stream-chunk boundary used to decode to two
// replacement characters — and because U+FFFD is valid JSON, the save "succeeded"
// while writing mojibake to the user's file. Silent corruption, 200 OK.
test('a large non-ASCII body survives chunk boundaries intact', async () => {
  const tmp = makeTmp();
  const log = join(tmp, 'store.jsonl');
  const srv = await start(FIXTURES + 'writer.mjs', 'WRITER', ['--log', log]);
  try {
    // Comfortably past the ~64KB chunk size, with 4-byte, 2-byte and 3-byte characters.
    const text = '😀é中'.repeat(40000);
    const res = await api(srv, '/api/append', { method: 'POST', body: JSON.stringify({ text }) });
    assert.equal(res.status, 200);
    const written = readFileSync(log, 'utf8').trim().split('\n').pop();
    assert.equal(JSON.parse(written).text, text, 'round-trips byte-for-byte');
    assert.doesNotMatch(written, /�/, 'no replacement characters');
  } finally { srv.child.kill('SIGKILL'); cleanup(tmp); }
});

// spawn ENOENT arrives as an async 'error' event, so the try/catch around the
// browser launch never saw it. Unhandled, it killed the server AFTER it had
// already printed its URL — every run on a headless box, since --open is the default.
test('a machine with no browser opener still serves and shuts down cleanly', async () => {
  const tmp = makeTmp();
  const log = join(tmp, 'store.jsonl');
  // PATH='' makes `open`/`xdg-open`/`cmd` unresolvable, exactly like a bare container.
  const srv = await start(FIXTURES + 'writer.mjs', 'WRITER', ['--log', log, '--open'], { PATH: '' });
  try {
    const res = await api(srv, '/api/append', { method: 'POST', body: JSON.stringify({ text: 'still alive' }) });
    assert.equal(res.status, 200, 'server survived the failed browser launch');
    await api(srv, '/api/done', { method: 'POST', body: '{}' });
    assert.equal(await srv.exited, 0, 'clean exit, not a crash');
    assert.match(srv.stdout(), /WRITER_SUMMARY/, 'the fence still printed');
  } finally { srv.child.kill('SIGKILL'); cleanup(tmp); }
});
