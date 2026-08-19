// The strict posture from §6.4 — no dials, so every gate must actually gate.
import test from 'node:test';
import assert from 'node:assert/strict';
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
