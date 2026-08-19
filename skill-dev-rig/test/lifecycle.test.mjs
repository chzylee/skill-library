// The three enders, the single shutdown path, and the races it designs out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FIXTURES, makeTmp, cleanup, start, api, sleep, readRecord, countOccurrences,
} from '../helpers.mjs';

const WRITER = join(FIXTURES, 'writer.mjs');
const ONESHOT = join(FIXTURES, 'oneshot.mjs');
const VIEWER = join(FIXTURES, 'viewer.mjs');

test('done ender: summary fence once, exit 0, run record reason done', async () => {
  const tmp = makeTmp();
  const result = join(tmp, 'run.json');
  const log = join(tmp, 'log.jsonl');
  const srv = await start(WRITER, 'WRITER', ['--log', log, '--result', result]);
  try {
    await api(srv, '/api/append', { method: 'POST', body: JSON.stringify({ n: 1 }) });
    await api(srv, '/api/append', { method: 'POST', body: JSON.stringify({ n: 2 }) });
    const done = await api(srv, '/api/done', { method: 'POST' });
    assert.equal(done.status, 200);
    assert.equal(await srv.exited, 0);
    const out = srv.stdout();
    assert.equal(countOccurrences(out, 'WRITER_SUMMARY'), 1, 'exactly one summary fence');
    assert.equal(countOccurrences(out, 'WRITER_DONE'), 1);
    assert.match(out, /2 append\(s\)/);
    const rec = readRecord(result);
    assert.equal(rec.reason, 'done');
    assert.equal(rec.exitCode, 0);
    assert.equal(rec.summary.appends, 2);
    assert.ok(rec.startedAt && rec.endedAt);
    // append-only: both lines present, in order (the slice-3 shape)
    const lines = readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(lines.map((l) => l.n), [1, 2]);
  } finally { srv.child.kill('SIGKILL'); cleanup(tmp); }
});

test('clock ender: TIMEOUT marker, exit 3, reason timeout', async () => {
  const tmp = makeTmp();
  const result = join(tmp, 'run.json');
  const srv = await start(WRITER, 'WRITER', ['--clock', '1', '--result', result]);
  try {
    assert.equal(await srv.exited, 3);
    const out = srv.stdout();
    assert.match(out, /WRITER_TIMEOUT/);
    assert.equal(countOccurrences(out, 'WRITER_SUMMARY'), 1, 'summary printed on timeout too');
    assert.equal(readRecord(result).reason, 'timeout');
  } finally { srv.child.kill('SIGKILL'); cleanup(tmp); }
});

test('close ender: pings stop -> CLOSED, exit 0, reason closed', async () => {
  const tmp = makeTmp();
  const result = join(tmp, 'run.json');
  const srv = await start(VIEWER, 'VIEWER', ['--result', result, '--ping-ms', '100', '--dead-ms', '400']);
  try {
    // ping a few times, then stop — the tab "closed"
    for (let i = 0; i < 4; i++) { await api(srv, '/api/ping', { method: 'POST' }); await sleep(100); }
    assert.equal(await srv.exited, 0);
    const out = srv.stdout();
    assert.match(out, /VIEWER_CLOSED/);
    assert.equal(countOccurrences(out, 'VIEWER_SUMMARY'), 1);
    assert.equal(readRecord(result).reason, 'closed');
  } finally { srv.child.kill('SIGKILL'); cleanup(tmp); }
});

test('watchdog is NOT armed before the first ping (slow browser launch survives)', async () => {
  const tmp = makeTmp();
  const srv = await start(VIEWER, 'VIEWER', ['--ping-ms', '50', '--dead-ms', '200', '--clock', '30']);
  try {
    // Far longer than deadMs with zero pings: a slow browser must not be killed.
    await sleep(800);
    assert.equal(srv.child.exitCode, null, 'process must still be alive before first ping');
    // Now the "tab" arrives, pings once, and closes — watchdog arms and fires.
    await api(srv, '/api/ping', { method: 'POST' });
    assert.equal(await srv.exited, 0);
    assert.match(srv.stdout(), /VIEWER_CLOSED/);
  } finally { srv.child.kill('SIGKILL'); cleanup(tmp); }
});

test('finding-7 race: clock fires while done is draining -> reason done, exit 0', async () => {
  // Deterministic construction: a slow in-flight request holds the drain open,
  // done arrives well before the clock, the clock fires MID-DRAIN and must no-op.
  const tmp = makeTmp();
  const result = join(tmp, 'run.json');
  const log = join(tmp, 'log.jsonl');
  const srv = await start(WRITER, 'WRITER', ['--log', log, '--clock', '1', '--result', result]);
  try {
    const slow = api(srv, '/api/slow', { method: 'POST', body: JSON.stringify({ ms: 1600 }) });
    await sleep(100);
    const done = await api(srv, '/api/done', { method: 'POST' }); // t≈0.1s; clock at t=1s lands mid-drain
    assert.equal(done.status, 200);
    const slowRes = await slow;
    assert.equal(slowRes.status, 200, 'in-flight request drained, not dropped');
    const code = await srv.exited;
    const out = srv.stdout();
    assert.equal(code, 0, `user clicked Done; must NOT be reported as timeout. stdout:\n${out}`);
    assert.doesNotMatch(out, /WRITER_TIMEOUT/);
    assert.equal(countOccurrences(out, 'WRITER_SUMMARY'), 1, 'first ender wins; later ones are no-ops');
    assert.equal(readRecord(result).reason, 'done');
  } finally { srv.child.kill('SIGKILL'); cleanup(tmp); }
});

test('ctx.end from a route handler is the same serialized shutdown (no second fetch)', async () => {
  const tmp = makeTmp();
  const out = join(tmp, 'values.json');
  const result = join(tmp, 'run.json');
  const srv = await start(ONESHOT, 'ONESHOT', ['--out', out, '--result', result]);
  try {
    const res = await api(srv, '/api/save', {
      method: 'POST', body: JSON.stringify({ values: { a: 1, b: 'two' } }),
    });
    assert.equal(res.status, 200, 'response flushed before shutdown');
    assert.equal(await srv.exited, 0);
    assert.equal(countOccurrences(srv.stdout(), 'ONESHOT_SUMMARY'), 1);
    assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')), { a: 1, b: 'two' });
    assert.equal(readRecord(result).reason, 'done');
  } finally { srv.child.kill('SIGKILL'); cleanup(tmp); }
});

test('clock: 0 disables the clock entirely', async () => {
  const tmp = makeTmp();
  const srv = await start(WRITER, 'WRITER', ['--clock', '0']);
  try {
    await sleep(1500);
    assert.equal(srv.child.exitCode, null, 'no clock, still alive');
    await api(srv, '/api/done', { method: 'POST' });
    assert.equal(await srv.exited, 0);
  } finally { srv.child.kill('SIGKILL'); cleanup(tmp); }
});

test('async onSummary is awaited before the record is written', async () => {
  const tmp = makeTmp();
  const result = join(tmp, 'run.json');
  const srv = await start(WRITER, 'WRITER', ['--slow-summary', '--result', result]);
  try {
    const t0 = Date.now();
    await api(srv, '/api/done', { method: 'POST' });
    assert.equal(await srv.exited, 0);
    assert.ok(Date.now() - t0 >= 350, 'exit waited for the async summary');
    const rec = readRecord(result);
    assert.equal(rec.reason, 'done');
    assert.ok(rec.summary, 'summary data made it into the record');
  } finally { srv.child.kill('SIGKILL'); cleanup(tmp); }
});

test('SIGTERM routes through the serialized shutdown: record finalized, exit 2', async () => {
  const tmp = makeTmp();
  const result = join(tmp, 'run.json');
  const srv = await start(WRITER, 'WRITER', ['--result', result]);
  try {
    srv.child.kill('SIGTERM');
    assert.equal(await srv.exited, 2);
    assert.match(srv.stdout(), /WRITER_ERROR/);
    assert.equal(readRecord(result).reason, 'error');
  } finally { srv.child.kill('SIGKILL'); cleanup(tmp); }
});
