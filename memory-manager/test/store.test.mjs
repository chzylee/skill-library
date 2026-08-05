// Whole-store actions: re-homing an orphaned store and removing one.
// Fixtures are synthetic temp dirs; nothing here touches ~/.claude/projects.
import { test } from 'node:test';
import assert from 'node:assert';
import {
  mkdirSync, existsSync, readFileSync, readdirSync, realpathSync, symlinkSync, chmodSync, writeFileSync,
} from 'node:fs';
import { join, basename } from 'node:path';
import { makeTmp, write, cleanup, startServer, api } from './helpers.mjs';

const enc = (s) => s.replace(/[^a-zA-Z0-9]/g, '-');

const MEM = (name, body = 'body') =>
  `---\nname: ${name}\ndescription: "${name} description"\nmetadata:\n  node_type: memory\n  type: project\n---\n${body}\n`;

// A project that was renamed: `<base>/proj-old-api-service` is gone, `<base>/proj-service`
// is the live one. The store still carries the old encoded path, so it can't resolve.
function fixture({ withDest = false } = {}) {
  // Claude Code keys stores by the physical cwd, so the fixture must too —
  // macOS tmpdir is reached through the /var → /private/var symlink.
  const base = realpathSync(makeTmp('mm-store-'));
  const root = join(base, 'projects');
  mkdirSync(root, { recursive: true });

  const livePath = join(base, 'proj-service');
  mkdirSync(livePath, { recursive: true });
  const deadPath = join(base, 'proj-old-api-service'); // never created on disk

  const orphan = enc(deadPath);
  write(root, join(orphan, 'memory', 'MEMORY.md'),
    '# Memory Index\n\n- [Alpha](alpha.md) — first hook\n- [Beta](beta.md) — second hook\n');
  write(root, join(orphan, 'memory', 'alpha.md'), MEM('alpha'));
  write(root, join(orphan, 'memory', 'beta.md'), MEM('beta'));

  const dest = enc(livePath);
  if (withDest) {
    write(root, join(dest, 'memory', 'MEMORY.md'), '# Memory Index\n\n- [Beta](beta.md) — incumbent beta\n');
    write(root, join(dest, 'memory', 'beta.md'), MEM('beta', 'INCUMBENT'));
  }
  return { base, root, orphan, dest, livePath, deadPath };
}

test('an orphaned store is flagged unresolved and suggests the renamed directory', async (t) => {
  const f = fixture();
  const srv = await startServer(f.root);
  t.after(() => { srv.child.kill(); cleanup(f.base); });

  const { body } = await api(srv, '/list');
  const s = body.stores.find((x) => x.store === f.orphan);
  assert.equal(s.pathResolved, false, 'store should not resolve');
  assert.ok(s.suggestions.includes(f.livePath), `expected ${f.livePath} in ${JSON.stringify(s.suggestions)}`);
});

test('re-home moves the whole store when nothing is at the destination', async (t) => {
  const f = fixture();
  const srv = await startServer(f.root);
  t.after(() => { srv.child.kill(); cleanup(f.base); });

  const r = await api(srv, `/store/${encodeURIComponent(f.orphan)}`, {
    method: 'POST', body: JSON.stringify({ action: 'rehome-store', targetPath: f.livePath }),
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.moved, 'all');

  assert.ok(!existsSync(join(f.root, f.orphan)), 'source store should be gone');
  const destMem = join(f.root, f.dest, 'memory');
  assert.ok(existsSync(join(destMem, 'alpha.md')));
  assert.ok(existsSync(join(destMem, 'beta.md')));
  assert.match(readFileSync(join(destMem, 'MEMORY.md'), 'utf8'), /\[Alpha\]\(alpha\.md\) — first hook/);

  const { body } = await api(srv, '/list');
  const s = body.stores.find((x) => x.store === f.dest);
  assert.equal(s.pathResolved, true, 're-homed store should now resolve');
  assert.equal(s.records.length, 2);
});

test('re-home merges into an existing store and skips name collisions', async (t) => {
  const f = fixture({ withDest: true });
  const srv = await startServer(f.root);
  t.after(() => { srv.child.kill(); cleanup(f.base); });

  const r = await api(srv, `/store/${encodeURIComponent(f.orphan)}`, {
    method: 'POST', body: JSON.stringify({ action: 'rehome-store', targetPath: f.livePath }),
  });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.moved, ['alpha.md']);
  assert.deepEqual(r.body.skipped, ['beta.md']);

  const destMem = join(f.root, f.dest, 'memory');
  // The incumbent file must survive untouched — a merge never overwrites.
  assert.match(readFileSync(join(destMem, 'beta.md'), 'utf8'), /INCUMBENT/);
  const idx = readFileSync(join(destMem, 'MEMORY.md'), 'utf8');
  assert.match(idx, /\[Alpha\]\(alpha\.md\) — first hook/, 'carried line keeps its hook');
  assert.match(idx, /\[Beta\]\(beta\.md\) — incumbent beta/, "incumbent's line is kept");
  assert.equal((idx.match(/beta\.md/g) || []).length, 1, 'no duplicate line for the collision');

  // The emptied source is trashed, not left behind as a second orphan.
  assert.ok(!existsSync(join(f.root, f.orphan)));
  assert.ok(existsSync(join(f.root, '.trash', f.orphan)));
});

test('remove store moves the whole folder to .trash and it stops being scanned', async (t) => {
  const f = fixture();
  const srv = await startServer(f.root);
  t.after(() => { srv.child.kill(); cleanup(f.base); });

  const r = await api(srv, `/store/${encodeURIComponent(f.orphan)}`, {
    method: 'POST', body: JSON.stringify({ action: 'trash-store' }),
  });
  assert.equal(r.status, 200);

  assert.ok(!existsSync(join(f.root, f.orphan)), 'store dir gone from root');
  const trashed = join(f.root, '.trash', f.orphan, 'memory');
  assert.ok(existsSync(join(trashed, 'alpha.md')), 'memories preserved, never unlinked');
  assert.ok(existsSync(join(trashed, 'MEMORY.md')), 'index preserved');

  const { body } = await api(srv, '/list');
  assert.equal(body.stores.length, 0, '.trash must not appear as a store');
});

test('re-home rejects bad targets and traversal', async (t) => {
  const f = fixture();
  const srv = await startServer(f.root);
  t.after(() => { srv.child.kill(); cleanup(f.base); });

  const bad = async (payload) => (await api(srv, `/store/${encodeURIComponent(f.orphan)}`, {
    method: 'POST', body: JSON.stringify({ action: 'rehome-store', ...payload }),
  })).status;

  assert.equal(await bad({ targetPath: 'relative/path' }), 400, 'relative path rejected');
  assert.equal(await bad({ targetPath: join(f.base, 'does-not-exist') }), 400, 'missing dir rejected');
  assert.equal(await bad({ targetPath: join(f.base, 'proj-service', 'nope') }), 400, 'missing subdir rejected');
  assert.equal(await bad({ targetPath: f.deadPath }), 400, 'the store\'s own dead path rejected');
  assert.equal(await bad({}), 400, 'missing target rejected');

  // A file, not a directory, is not a valid home.
  write(f.base, 'afile.txt', 'x');
  assert.equal(await bad({ targetPath: join(f.base, 'afile.txt') }), 400, 'file rejected');

  // Store-segment traversal must not escape ROOT on either action.
  for (const action of ['trash-store', 'rehome-store']) {
    const res = await api(srv, `/store/${encodeURIComponent('../../etc')}`, {
      method: 'POST', body: JSON.stringify({ action, targetPath: f.livePath }),
    });
    assert.equal(res.status, 400, `${action} traversal rejected`);
    assert.match(res.body.error, /unsafe store name/);
  }
  assert.ok(existsSync(join(f.root, f.orphan)), 'nothing was moved by the rejected calls');
  assert.equal((await api(srv, `/store/${encodeURIComponent(f.orphan)}`, {
    method: 'POST', body: JSON.stringify({ action: 'nonsense' }),
  })).status, 400, 'unknown action rejected');
});

test('store actions are itemized in the close summary', async (t) => {
  const f = fixture();
  const srv = await startServer(f.root);
  t.after(() => { cleanup(f.base); });

  await api(srv, `/store/${encodeURIComponent(f.orphan)}`, {
    method: 'POST', body: JSON.stringify({ action: 'rehome-store', targetPath: f.livePath }),
  });
  await api(srv, `/store/${encodeURIComponent(f.dest)}`, {
    method: 'POST', body: JSON.stringify({ action: 'trash-store' }),
  });
  await api(srv, '/done', { method: 'POST' });

  assert.equal(await srv.exited, 0);
  const out = srv.stdout();
  assert.match(out, /MEMORY_MANAGER_SUMMARY/);
  assert.match(out, /store re-homed/);
  assert.match(out, /store removed/);
  assert.match(out, /MEMORY_MANAGER_DONE/);
});

test('a store whose project directory exists is never offered these actions', async (t) => {
  const base = makeTmp('mm-store-ok-');
  const root = join(base, 'projects');
  const live = join(base, 'real-project');
  mkdirSync(root, { recursive: true });
  mkdirSync(live, { recursive: true });
  write(root, join(enc(live), 'memory', 'MEMORY.md'), '# Memory Index\n\n- [A](a.md) — hook\n');
  write(root, join(enc(live), 'memory', 'a.md'), MEM('a'));

  const srv = await startServer(root);
  t.after(() => { srv.child.kill(); cleanup(base); });

  const { body } = await api(srv, '/list');
  assert.equal(body.stores[0].pathResolved, true);
  assert.deepEqual(body.stores[0].suggestions, [], 'resolved stores get no suggestions');
  assert.ok(readdirSync(join(root, enc(live), 'memory')).includes('a.md'));
});

// ---------------------------------------------------------------- hardening regressions

test('encoding matches Claude Code: spaces and every non-alphanumeric become hyphens, case kept', async () => {
  const { encodeSeg } = await import('../memory-manager.mjs');
  // Verified against a real store on disk: /Users/x/Desktop/Projects/Claude Projects
  // lives at -Users-x-Desktop-Projects-Claude-Projects.
  assert.equal(encodeSeg('/Users/x/Desktop/Projects/Claude Projects'), '-Users-x-Desktop-Projects-Claude-Projects');
  assert.equal(encodeSeg('/a/prøjet ünï'), '-a-pr-jet--n-', 'non-ASCII maps to hyphens');
});

test('re-home normalizes the target: trailing slash, /., .. segments, and symlinks all land in the canonical store', async (t) => {
  const rehome = async (f, srv, targetPath) => api(srv, `/store/${encodeURIComponent(f.orphan)}`, {
    method: 'POST', body: JSON.stringify({ action: 'rehome-store', targetPath }),
  });

  for (const spell of [
    (f) => f.livePath + '/',
    (f) => f.livePath + '/.',
    (f) => `${f.livePath}/../${basename(f.livePath)}`, // built by hand so join() can't pre-normalize it
  ]) {
    const f = fixture();
    const srv = await startServer(f.root);
    const r = await rehome(f, srv, spell(f));
    assert.equal(r.status, 200, `spelling ${spell(f)} accepted`);
    assert.equal(r.body.into, f.dest, `spelling ${spell(f)} must land in the canonical store name`);
    assert.ok(existsSync(join(f.root, f.dest, 'memory', 'alpha.md')));
    srv.child.kill(); cleanup(f.base);
  }

  // A symlinked spelling encodes the physical path — the one process.cwd() reports.
  const f = fixture();
  const srv = await startServer(f.root);
  t.after(() => { srv.child.kill(); cleanup(f.base); });
  const link = join(f.base, 'a-link');
  symlinkSync(f.livePath, link);
  const r = await rehome(f, srv, link);
  assert.equal(r.status, 200);
  assert.equal(r.body.into, f.dest, 'symlink resolves to the physical home');
});

test('re-home into the same directory under a different spelling is rejected, never self-merged-and-trashed', async (t) => {
  // The store is already at its correct home; re-homing it "to" that home via a symlink
  // used to fall into the merge path, skip every file as a collision, then trash the store.
  const base = realpathSync(makeTmp('mm-store-self-'));
  const root = join(base, 'projects');
  const live = join(base, 'proj-service');
  mkdirSync(root, { recursive: true });
  mkdirSync(live, { recursive: true });
  const store = enc(live);
  write(root, join(store, 'memory', 'MEMORY.md'), '# Memory Index\n\n- [A](a.md) — hook\n');
  write(root, join(store, 'memory', 'a.md'), MEM('a'));
  const link = join(base, 'another-name');
  symlinkSync(live, link);

  const srv = await startServer(root);
  t.after(() => { srv.child.kill(); cleanup(base); });

  for (const spelling of [live, link, join(base, 'PROJ-SERVICE')]) {
    const r = await api(srv, `/store/${encodeURIComponent(store)}`, {
      method: 'POST', body: JSON.stringify({ action: 'rehome-store', targetPath: spelling }),
    });
    // Case-insensitive filesystems resolve PROJ-SERVICE to the same dir (rejected as
    // self); case-sensitive ones don't have it at all (rejected as missing). Either
    // way it must be a refusal, and the store must be untouched.
    assert.equal(r.status, 400, `${spelling} must be rejected`);
  }
  assert.ok(existsSync(join(root, store, 'memory', 'a.md')), 'store untouched');
  assert.ok(!existsSync(join(root, '.trash')), 'nothing was trashed');
});

test('merge carries only real index lines — an unindexed memory stays unindexed for the user to rule on', async (t) => {
  const f = fixture({ withDest: true });
  write(f.root, join(f.orphan, 'memory', 'gamma.md'), MEM('gamma')); // no index line
  const srv = await startServer(f.root);
  t.after(() => { srv.child.kill(); cleanup(f.base); });

  const r = await api(srv, `/store/${encodeURIComponent(f.orphan)}`, {
    method: 'POST', body: JSON.stringify({ action: 'rehome-store', targetPath: f.livePath }),
  });
  assert.equal(r.status, 200);
  assert.ok(r.body.moved.includes('gamma.md'));

  const destMem = join(f.root, f.dest, 'memory');
  assert.ok(existsSync(join(destMem, 'gamma.md')), 'file moved');
  assert.doesNotMatch(readFileSync(join(destMem, 'MEMORY.md'), 'utf8'), /gamma/, 'no invented index line');
  const { body } = await api(srv, '/list');
  const rec = body.stores.find((s) => s.store === f.dest).records.find((x) => x.file === 'gamma.md');
  assert.ok(rec.flags.includes('unindexed'), 'reconciliation surfaces it at the destination');
});

test('a directory named like a memory file is not moved by the merge', async (t) => {
  const f = fixture({ withDest: true });
  mkdirSync(join(f.root, f.orphan, 'memory', 'not-a-file.md'), { recursive: true });
  const srv = await startServer(f.root);
  t.after(() => { srv.child.kill(); cleanup(f.base); });

  const r = await api(srv, `/store/${encodeURIComponent(f.orphan)}`, {
    method: 'POST', body: JSON.stringify({ action: 'rehome-store', targetPath: f.livePath }),
  });
  assert.equal(r.status, 200);
  assert.ok(!r.body.moved.includes('not-a-file.md'));
  assert.ok(!existsSync(join(f.root, f.dest, 'memory', 'not-a-file.md')), 'directory not smuggled across');
  assert.ok(existsSync(join(f.root, '.trash', f.orphan, 'memory', 'not-a-file.md')), 'it went to .trash with the source');
});

test('a failing merge reports the failure, keeps the source store, and trashes nothing', async (t) => {
  const f = fixture({ withDest: true });
  const destMem = join(f.root, f.dest, 'memory');
  chmodSync(destMem, 0o555); // no writes into the destination — every rename fails
  const srv = await startServer(f.root);
  t.after(() => { chmodSync(destMem, 0o755); srv.child.kill(); cleanup(f.base); });

  const r = await api(srv, `/store/${encodeURIComponent(f.orphan)}`, {
    method: 'POST', body: JSON.stringify({ action: 'rehome-store', targetPath: f.livePath }),
  });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /kept/, 'the error says the source survives');
  assert.ok(existsSync(join(f.root, f.orphan, 'memory', 'alpha.md')), 'source intact');
  assert.ok(!existsSync(join(f.root, '.trash', f.orphan)), 'source not trashed after a failure');
});

test('merge into a store whose MEMORY.md is prose appends without destroying the prose', async (t) => {
  const f = fixture({ withDest: true });
  const destIdx = join(f.root, f.dest, 'memory', 'MEMORY.md');
  writeFileSync(destIdx, 'These are my notes.\nThey are not an index.\nThird meaningful line.\n', 'utf8');
  const srv = await startServer(f.root);
  t.after(() => { srv.child.kill(); cleanup(f.base); });

  const r = await api(srv, `/store/${encodeURIComponent(f.orphan)}`, {
    method: 'POST', body: JSON.stringify({ action: 'rehome-store', targetPath: f.livePath }),
  });
  assert.equal(r.status, 200);
  const idx = readFileSync(destIdx, 'utf8');
  assert.match(idx, /These are my notes\./, 'prose kept');
  assert.match(idx, /\[Alpha\]\(alpha\.md\) — first hook/, 'carried line appended');
});

test('merge into a CRLF destination index keeps CRLF', async (t) => {
  const f = fixture({ withDest: true });
  const destIdx = join(f.root, f.dest, 'memory', 'MEMORY.md');
  writeFileSync(destIdx, '# Memory Index\r\n\r\n- [Beta](beta.md) — incumbent beta\r\n', 'utf8');
  const srv = await startServer(f.root);
  t.after(() => { srv.child.kill(); cleanup(f.base); });

  await api(srv, `/store/${encodeURIComponent(f.orphan)}`, {
    method: 'POST', body: JSON.stringify({ action: 'rehome-store', targetPath: f.livePath }),
  });
  const idx = readFileSync(destIdx, 'utf8');
  assert.ok(!idx.replace(/\r\n/g, '').includes('\n'), 'no bare LF introduced');
  assert.match(idx, /\[Alpha\]\(alpha\.md\) — first hook/, 'carried line present');
});

test('merge creates the destination index when memory/ exists but MEMORY.md does not', async (t) => {
  const f = fixture({ withDest: true });
  const destMem = join(f.root, f.dest, 'memory');
  // Destination has files but no index at all.
  const { rmSync } = await import('node:fs');
  rmSync(join(destMem, 'MEMORY.md'));
  const srv = await startServer(f.root);
  t.after(() => { srv.child.kill(); cleanup(f.base); });

  const r = await api(srv, `/store/${encodeURIComponent(f.orphan)}`, {
    method: 'POST', body: JSON.stringify({ action: 'rehome-store', targetPath: f.livePath }),
  });
  assert.equal(r.status, 200);
  const idx = readFileSync(join(destMem, 'MEMORY.md'), 'utf8');
  assert.match(idx, /# Memory Index/);
  assert.match(idx, /\[Alpha\]\(alpha\.md\) — first hook/);
});

test('re-home to a unicode directory produces a store the scanner resolves back', async (t) => {
  const f = fixture();
  const uni = join(f.base, 'prøjet ünï');
  mkdirSync(uni, { recursive: true });
  const srv = await startServer(f.root);
  t.after(() => { srv.child.kill(); cleanup(f.base); });

  const r = await api(srv, `/store/${encodeURIComponent(f.orphan)}`, {
    method: 'POST', body: JSON.stringify({ action: 'rehome-store', targetPath: uni }),
  });
  assert.equal(r.status, 200);
  const { body } = await api(srv, '/list');
  const s = body.stores.find((x) => x.store === r.body.into);
  assert.ok(s, 'store exists under the encoded name');
  assert.equal(s.pathResolved, true, 'round-trips through decode');
  assert.equal(s.projectPath, uni);
});

test('nothing under .trash ever scans, even a memory-shaped tree; a .trash FILE fails trash-store cleanly', async (t) => {
  const f = fixture();
  // Adversarial: .trash contains something shaped exactly like <entry>/memory.
  write(f.root, join('.trash', 'memory', 'MEMORY.md'), '# Memory Index\n\n- [X](x.md) — hook\n');
  write(f.root, join('.trash', 'memory', 'x.md'), MEM('x'));
  const srv = await startServer(f.root);
  t.after(() => { srv.child.kill(); cleanup(f.base); });

  const { body } = await api(srv, '/list');
  assert.deepEqual(body.stores.map((s) => s.store), [f.orphan], '.trash never appears as a store');

  // Now the pathological case: .trash exists as a file. The action must fail loudly
  // and move nothing, not rename the store onto a file path.
  const g = fixture();
  writeFileSync(join(g.root, '.trash'), 'i am a file', 'utf8');
  const srv2 = await startServer(g.root);
  t.after(() => { srv2.child.kill(); cleanup(g.base); });
  const r = await api(srv2, `/store/${encodeURIComponent(g.orphan)}`, {
    method: 'POST', body: JSON.stringify({ action: 'trash-store' }),
  });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /not a directory/);
  assert.ok(existsSync(join(g.root, g.orphan, 'memory', 'alpha.md')), 'store untouched');
});
