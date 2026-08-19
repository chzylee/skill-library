// Markers, exit codes, and the run record — the agent-facing half of the contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import {
  FIXTURES, ENGINE, makeTmp, cleanup, start, api, readRecord, startExpectingExit,
} from '../helpers.mjs';

const WRITER = join(FIXTURES, 'writer.mjs');

test('URL and RESULT markers print at listen; URL carries the token', async () => {
  const tmp = makeTmp();
  const result = join(tmp, 'run.json');
  const srv = await start(WRITER, 'WRITER', ['--result', result]);
  try {
    assert.match(srv.stdout(), /WRITER_URL=http:\/\/127\.0\.0\.1:\d+\/\?token=[0-9a-f]+/);
    assert.equal(srv.resultFile, result, 'RESULT marker names the run record path');
    assert.ok(srv.token && srv.token.length >= 16, 'per-run token present');
    // initial record: written at listen so a crashed run is distinguishable
    const rec = readRecord(result);
    assert.equal(rec.reason, 'running');
    assert.equal(rec.pid, srv.child.pid);
    await api(srv, '/api/done', { method: 'POST' });
    await srv.exited;
  } finally { srv.child.kill('SIGKILL'); cleanup(tmp); }
});

test('RESULT defaults to a tmpdir path when the consumer passes none', async () => {
  const srv = await start(WRITER, 'WRITER', []);
  try {
    assert.ok(srv.resultFile, 'a default result path is always printed');
    assert.match(srv.resultFile, /writer-run-.*\.json$/);
    await api(srv, '/api/done', { method: 'POST' });
    assert.equal(await srv.exited, 0);
    assert.equal(readRecord(srv.resultFile).reason, 'done');
  } finally { srv.child.kill('SIGKILL'); }
});

test('run record shape matches UI-CONTRACT.md "The run record"', async () => {
  const tmp = makeTmp();
  const result = join(tmp, 'run.json');
  const srv = await start(WRITER, 'WRITER', ['--result', result]);
  try {
    await api(srv, '/api/done', { method: 'POST' });
    assert.equal(await srv.exited, 0);
    const rec = readRecord(result);
    assert.equal(rec.name, 'WRITER');
    assert.equal(rec.reason, 'done');
    assert.equal(rec.exitCode, 0);
    assert.match(rec.startedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(rec.endedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(typeof rec.summary, 'object');
  } finally { srv.child.kill('SIGKILL'); cleanup(tmp); }
});

test('_ERROR goes to STDOUT (not stderr) and exits 2 on bad args', async () => {
  const tmp = makeTmp();
  // A consumer with an invalid marker name: the engine must refuse before listening.
  const bad = join(tmp, 'bad.mjs');
  writeFileSync(bad, `import { serveUI } from ${JSON.stringify(ENGINE)};
await serveUI({ name: 'lower case!', html: '<html></html>' });
`);
  const r = await startExpectingExit(bad);
  assert.equal(r.code, 2);
  assert.match(r.stdout, /_ERROR /, 'error marker on stdout — the stream the parser watches');
  assert.doesNotMatch(r.stderr, /_ERROR /);
  cleanup(tmp);
});

test('missing html is a precondition failure: _ERROR + exit 2', async () => {
  const tmp = makeTmp();
  const bad = join(tmp, 'bad2.mjs');
  writeFileSync(bad, `import { serveUI } from ${JSON.stringify(ENGINE)};
await serveUI({ name: 'GOOD_NAME' });
`);
  const r = await startExpectingExit(bad);
  assert.equal(r.code, 2);
  assert.match(r.stdout, /GOOD_NAME_ERROR /);
  cleanup(tmp);
});

test('consumer routes may not shadow engine-owned routes', async () => {
  const tmp = makeTmp();
  const bad = join(tmp, 'bad3.mjs');
  writeFileSync(bad, `import { serveUI } from ${JSON.stringify(ENGINE)};
await serveUI({ name: 'SHADOW', html: '<html></html>', routes: { 'POST /api/done': () => ({}) } });
`);
  const r = await startExpectingExit(bad);
  assert.equal(r.code, 2);
  assert.match(r.stdout, /SHADOW_ERROR /);
  cleanup(tmp);
});
