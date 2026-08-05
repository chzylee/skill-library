// End-to-end: spawn the real server against a synthetic fixture and drive the HTTP API.
// Never touches ~/.claude/projects.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import http from 'node:http';
import { makeTmp, cleanup, startServer, api } from './helpers.mjs';

let base; let root; let srv;
const A = 'storeA'; const memA = () => join(root, A, 'memory');

function buildFixture() {
  base = makeTmp('mm-e2e-');
  root = join(base, 'root');

  const mem = join(root, A, 'memory');
  mkdirSync(mem, { recursive: true });
  writeFileSync(join(mem, 'MEMORY.md'), [
    '# Memory Index',
    '',
    '- [Good memory](good.md) — the healthy one',
    '- [Ghost](gone.md) — file was deleted',
    '- [Sub](notes/sub.md) — lives in a subdir that is gone',
    '- [Dup](dup.md) — first line',
    '- [Dup again](dup.md) — second line',
    '- [Dup2](dup2.md) — first',
    '- [Dup2 again](dup2.md) — second',
    '- [Diverged](diverged.md) — name mismatch',
    '- [CRLF](crlf.md) — windows endings',
    '- [Block](blockscalar.md) — folded description',
    '',
  ].join('\n'));

  const doc = (name, extra = '') => [
    '---',
    `name: ${name}`,
    'description: "one line"',
    'metadata:',
    '  node_type: memory',
    '  type: user',
    '  originSessionId: abc-123',
    '---',
    '',
    `Body of ${name}.`,
    '',
  ].join('\n') + extra;

  writeFileSync(join(mem, 'good.md'), doc('good'));
  writeFileSync(join(mem, 'dup.md'), doc('dup'));
  writeFileSync(join(mem, 'dup2.md'), doc('dup2'));
  writeFileSync(join(mem, 'unindexed.md'), doc('unindexed'));
  writeFileSync(join(mem, 'diverged.md'), [
    '---', 'name: totally-other-name', 'description: "diverged"', '---', '', 'Original body line.', '',
  ].join('\n'));
  writeFileSync(join(mem, 'crlf.md'), [
    '---', 'name: crlf', 'description: "windows file"', 'metadata:', '  type: user', '---', '', 'CRLF body.', '',
  ].join('\r\n'));
  writeFileSync(join(mem, 'blockscalar.md'), [
    '---', 'name: blockscalar', 'description: >-', '  folded one', '  folded two',
    'metadata:', '  node_type: memory', '  type: user', '---', '', 'Block body.', '',
  ].join('\n'));

  // Store with files but no index at all.
  const memB = join(root, 'storeB', 'memory');
  mkdirSync(memB, { recursive: true });
  writeFileSync(join(memB, 'lonely.md'), doc('lonely'));

  // Store whose MEMORY.md is prose, not an index.
  const memC = join(root, 'storeC', 'memory');
  mkdirSync(memC, { recursive: true });
  writeFileSync(join(memC, 'MEMORY.md'), 'This is a scratch note.\nIt has prose in it.\nNo index lines at all.\n');

  // Traversal target OUTSIDE the root — must never be reachable.
  const outside = join(base, 'outside', 'memory');
  mkdirSync(outside, { recursive: true });
  writeFileSync(join(outside, 'victim.md'), doc('victim'));
  writeFileSync(join(outside, 'MEMORY.md'), '# Memory Index\n\n- [Victim](victim.md)\n');
}

before(async () => {
  buildFixture();
  srv = await startServer(root);
});

after(async () => {
  try { srv.child.kill(); } catch { /* already gone */ }
  cleanup(base);
});

// ---------------------------------------------------------------- read side

test('list: stores, flags, orphans, duplicates, non-index detection', async () => {
  const { status, body } = await api(srv, '/list');
  assert.equal(status, 200);
  assert.equal(body.root, root);
  const a = body.stores.find((s) => s.store === A);
  const b = body.stores.find((s) => s.store === 'storeB');
  const c = body.stores.find((s) => s.store === 'storeC');

  assert.equal(a.indexKind, 'index');
  assert.deepEqual(a.orphans.map((o) => o.target).sort(), ['gone.md', 'notes/sub.md']);
  assert.deepEqual(a.duplicates.map((d) => d.target).sort(), ['dup.md', 'dup2.md']);

  const rec = (f) => a.records.find((r) => r.file === f);
  assert.ok(!rec('good.md').flags.includes('unindexed'));
  assert.ok(rec('unindexed.md').flags.includes('unindexed'));
  assert.ok(rec('diverged.md').flags.includes('name-divergence'));
  assert.equal(rec('blockscalar.md').description, 'folded one folded two', 'block scalar joined for display');

  assert.equal(b.indexKind, 'missing');
  assert.ok(b.records[0].flags.includes('unindexed'));
  assert.equal(c.indexKind, 'non-index');
});

// ---------------------------------------------------------------- security

test('bad token is rejected on API and on the HTML page', async () => {
  const r1 = await fetch(`${srv.origin}/api/list`, { headers: { 'x-mm-token': 'wrong' } });
  assert.equal(r1.status, 403);
  const r2 = await fetch(`${srv.origin}/`);
  assert.equal(r2.status, 403, 'the page embeds the token, so serving it must be gated');
  const r3 = await fetch(`${srv.origin}/?token=${srv.token}`);
  assert.equal(r3.status, 200);
  const html = await r3.text();
  assert.ok(!html.includes('__TOKEN__'), 'token placeholder replaced');
});

test('cross-origin writes are rejected', async () => {
  const { status } = await api(srv, `/memory/${A}/good.md`, {
    method: 'POST', headers: { origin: 'http://evil.example' }, body: JSON.stringify({ description: 'x' }),
  });
  assert.equal(status, 403);
});

test('non-loopback Host header is rejected (DNS rebinding)', async () => {
  const port = Number(new URL(srv.origin).port);
  const status = await new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: `/?token=${srv.token}`, headers: { Host: 'evil.example' } },
      (res) => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject);
    req.end();
  });
  assert.equal(status, 403);
});

test('path traversal in the STORE segment cannot reach outside the root', async () => {
  for (const evil of ['..%2Foutside', '..%2F..%2Foutside', '%2E%2E%2Foutside']) {
    const res = await fetch(`${srv.origin}/api/memory/${evil}/victim.md?token=${srv.token}`, { method: 'DELETE' });
    assert.equal(res.status, 400, `store=${evil} must be rejected`);
  }
  assert.ok(existsSync(join(base, 'outside', 'memory', 'victim.md')), 'victim untouched');
  const fix = await fetch(`${srv.origin}/api/index/..%2Foutside?token=${srv.token}`, {
    method: 'POST', body: JSON.stringify({ action: 'drop-orphan', target: 'victim.md' }),
  });
  assert.equal(fix.status, 400);
});

test('path traversal / index tampering in the FILE segment is rejected', async () => {
  for (const evil of ['..%2FMEMORY.md', 'MEMORY.md', 'memory.md', '.hidden.md', 'notes%2Fsub.md']) {
    const res = await fetch(`${srv.origin}/api/memory/${A}/${evil}?token=${srv.token}`, { method: 'DELETE' });
    assert.equal(res.status, 400, `file=${evil} must be rejected`);
  }
  assert.ok(existsSync(join(memA(), 'MEMORY.md')));
});

test('oversized body returns 400 instead of hanging or crashing', async () => {
  const { status, body } = await api(srv, `/memory/${A}/good.md`, {
    method: 'POST', body: JSON.stringify({ body: 'x'.repeat(6 * 1024 * 1024) }),
  });
  assert.equal(status, 400);
  assert.match(body.error, /too large/);
});

// ---------------------------------------------------------------- writes

test('save: field edit + index line, unknown keys byte-preserved, modified stamped', async () => {
  const { status } = await api(srv, `/memory/${A}/good.md`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'good', description: 'meet at 10:30', type: 'project',
      body: 'Edited body.', indexTitle: 'Good memory', indexHook: 'now edited',
    }),
  });
  assert.equal(status, 200);

  const raw = readFileSync(join(memA(), 'good.md'), 'utf8');
  assert.ok(raw.includes('  originSessionId: abc-123'), 'unknown key survives');
  assert.ok(raw.includes('  node_type: memory'), 'unknown key survives');
  assert.ok(raw.includes('description: "meet at 10:30"'), 'colon value quoted');
  assert.ok(raw.includes('  type: project'));
  assert.match(raw, /modified: \d{4}-\d{2}-\d{2}/);
  assert.ok(raw.includes('Edited body.'));

  const idx = readFileSync(join(memA(), 'MEMORY.md'), 'utf8');
  assert.ok(idx.includes('- [Good memory](good.md) — now edited'));

  // Round trip: the parsed value comes back unquoted.
  const { body } = await api(srv, '/list');
  const rec = body.stores.find((s) => s.store === A).records.find((r) => r.file === 'good.md');
  assert.equal(rec.description, 'meet at 10:30');
});

test('save keeps a CRLF file CRLF throughout', async () => {
  const { status } = await api(srv, `/memory/${A}/crlf.md`, {
    method: 'POST',
    body: JSON.stringify({ description: 'still windows', body: 'New body line.\nSecond line.' }),
  });
  assert.equal(status, 200);
  const raw = readFileSync(join(memA(), 'crlf.md'), 'utf8');
  assert.ok(raw.includes('\r\n'));
  assert.ok(!/[^\r]\n/.test(raw), `no bare LF may appear, got: ${JSON.stringify(raw)}`);
});

test('save replaces a block-scalar description without stranding its lines', async () => {
  const { status } = await api(srv, `/memory/${A}/blockscalar.md`, {
    method: 'POST', body: JSON.stringify({ description: 'flattened now' }),
  });
  assert.equal(status, 200);
  const raw = readFileSync(join(memA(), 'blockscalar.md'), 'utf8');
  assert.ok(raw.includes('description: flattened now'));
  assert.ok(!raw.includes('folded one'), 'continuation lines removed with the scalar');
  assert.ok(raw.includes('  node_type: memory'));
  assert.ok(raw.includes('Block body.'));
});

test('drop-duplicate keeps the first line and removes the rest', async () => {
  const { status } = await api(srv, `/index/${A}`, {
    method: 'POST', body: JSON.stringify({ action: 'drop-duplicate', target: 'dup.md' }),
  });
  assert.equal(status, 200);
  const idx = readFileSync(join(memA(), 'MEMORY.md'), 'utf8');
  const hits = idx.split('\n').filter((l) => l.includes('(dup.md)'));
  assert.equal(hits.length, 1);
  assert.ok(hits[0].includes('first line'));
});

test('delete moves to .trash/ and removes EVERY index line for the file', async () => {
  const { status } = await api(srv, `/memory/${A}/dup2.md`, { method: 'DELETE' });
  assert.equal(status, 200);
  assert.ok(!existsSync(join(memA(), 'dup2.md')));
  const trashed = readdirSync(join(memA(), '.trash'));
  assert.ok(trashed.some((f) => f.startsWith('dup2')), `expected dup2 in .trash, got ${trashed}`);
  const idx = readFileSync(join(memA(), 'MEMORY.md'), 'utf8');
  assert.ok(!idx.includes('dup2.md'), 'both lines gone — no manufactured orphan');
});

test('drop-orphan works even when the target contains a slash', async () => {
  const { status } = await api(srv, `/index/${A}`, {
    method: 'POST', body: JSON.stringify({ action: 'drop-orphan', target: 'notes/sub.md' }),
  });
  assert.equal(status, 200);
  const idx = readFileSync(join(memA(), 'MEMORY.md'), 'utf8');
  assert.ok(!idx.includes('notes/sub.md'));
});

test('add-index appends after the last entry', async () => {
  const { status } = await api(srv, `/index/${A}`, {
    method: 'POST', body: JSON.stringify({ action: 'add-index', target: 'unindexed.md', title: 'Found it', hook: 'now indexed' }),
  });
  assert.equal(status, 200);
  const idx = readFileSync(join(memA(), 'MEMORY.md'), 'utf8');
  assert.ok(idx.includes('- [Found it](unindexed.md) — now indexed'));
  const { body } = await api(srv, '/list');
  const rec = body.stores.find((s) => s.store === A).records.find((r) => r.file === 'unindexed.md');
  assert.ok(!rec.flags.includes('unindexed'));
});

test('align-name rewrites name: to the filename stem and preserves the body', async () => {
  const { status } = await api(srv, `/index/${A}`, {
    method: 'POST', body: JSON.stringify({ action: 'align-name', target: 'diverged.md' }),
  });
  assert.equal(status, 200);
  const raw = readFileSync(join(memA(), 'diverged.md'), 'utf8');
  assert.ok(raw.includes('name: diverged'));
  assert.ok(!raw.includes('totally-other-name'));
  assert.ok(raw.includes('Original body line.'), 'body preserved');
});

test('unknown fix action is rejected', async () => {
  const { status } = await api(srv, `/index/${A}`, {
    method: 'POST', body: JSON.stringify({ action: 'regenerate-index' }),
  });
  assert.equal(status, 400);
});

// ---------------------------------------------------------------- shutdown contract

test('done: summary block with markers, itemized ops, exit 0', async () => {
  const { status, body } = await api(srv, '/done', { method: 'POST' });
  assert.equal(status, 200);
  assert.ok(body.ops.length >= 7, `expected the ops ledger, got ${body.ops.length}`);

  const code = await srv.exited;
  assert.equal(code, 0);
  const out = srv.stdout();
  assert.ok(out.includes('MEMORY_MANAGER_SUMMARY'));
  assert.ok(out.includes('MEMORY_MANAGER_DONE'));
  assert.ok(out.indexOf('MEMORY_MANAGER_SUMMARY') < out.indexOf('MEMORY_MANAGER_DONE'));
  assert.match(out, /\d+ edited/);
  assert.match(out, /\d+ deleted/);
  assert.match(out, /\d+ index fixed/);
  assert.ok(out.includes('moved to .trash/'), 'delete notes where the file went');
  assert.ok(out.includes('stale'), 'warns the calling session its index is stale');
});
