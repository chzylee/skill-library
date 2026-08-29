// Criterion 8: config-form runs ON the engine and still writes values and task
// ids correctly against examples/recording-standard.schema.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONFIG_FORM, makeTmp, cleanup, start, api, raw, readRecord, countOccurrences,
} from '../helpers.mjs';

const SCHEMA = fileURLToPath(new URL('../examples/recording-standard.schema.json', import.meta.url));
const STATUS = fileURLToPath(new URL('../examples/task-status.example.json', import.meta.url));

function launch(tmp, extra = []) {
  const out = join(tmp, 'config.json');
  const tasksOut = join(tmp, 'tasks.json');
  const result = join(tmp, 'run.json');
  return {
    out,
    tasksOut,
    result,
    srv: start(CONFIG_FORM, 'CONFIG_FORM', [
      '--schema', SCHEMA, '--status', STATUS,
      '--out', out, '--tasks-out', tasksOut, '--result', result, ...extra,
    ]),
  };
}

test('save writes merged values and requested task ids; exits 0 with one summary', async () => {
  const tmp = makeTmp();
  const prior = join(tmp, 'values.json');
  writeFileSync(prior, JSON.stringify({ cadence_days: 7, miscellaneous_home: 'https://notion.so/old' }));
  const { out, tasksOut, result, srv: srvP } = launch(tmp, ['--values', prior]);
  const srv = await srvP;
  try {
    const page = await raw(srv, `/?token=${srv.token}`);
    assert.equal(page.status, 200);
    assert.match(page.text, /recording-standard/, 'schema title rendered');
    assert.doesNotMatch(page.text, /__TOKEN__/, 'token substituted into the page');

    const res = await api(srv, '/api/save', {
      method: 'POST',
      body: JSON.stringify({
        values: { miscellaneous_home: 'https://notion.so/new', scope: 'full' },
        tasks: ['create-audit-results', 'register-audit-job'],
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(await srv.exited, 0);

    const saved = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(saved.miscellaneous_home, 'https://notion.so/new', 'new value wins');
    assert.equal(saved.cadence_days, 7, 'untouched prior value survives the merge');
    assert.equal(saved.scope, 'full');
    assert.deepEqual(JSON.parse(readFileSync(tasksOut, 'utf8')), ['create-audit-results', 'register-audit-job']);

    const stdout = srv.stdout();
    assert.equal(countOccurrences(stdout, 'CONFIG_FORM_SUMMARY'), 1);
    assert.match(stdout, /CONFIG_FORM_SAVED out=/, 'legacy SAVED line kept inside the fence');
    assert.equal(readRecord(result).reason, 'done');
  } finally { srv.child.kill('SIGKILL'); cleanup(tmp); }
});

test('timeout still exits 3 with the TIMEOUT marker (old contract preserved)', async () => {
  const tmp = makeTmp();
  const { srv: srvP } = launch(tmp, ['--timeout', '1']);
  const srv = await srvP;
  try {
    assert.equal(await srv.exited, 3);
    assert.match(srv.stdout(), /CONFIG_FORM_TIMEOUT/);
  } finally { srv.child.kill('SIGKILL'); cleanup(tmp); }
});

test('missing --schema/--out is a precondition failure: _ERROR on stdout, exit 2', async () => {
  const tmp = makeTmp();
  const { spawn } = await import('node:child_process');
  const child = spawn(process.execPath, [CONFIG_FORM], { stdio: ['ignore', 'pipe', 'pipe'] });
  let outS = '';
  child.stdout.on('data', (c) => { outS += c; });
  const code = await new Promise((r) => child.on('exit', r));
  assert.equal(code, 2);
  assert.match(outS, /CONFIG_FORM_ERROR /);
  cleanup(tmp);
});

// A bare `--timeout` parses as boolean true, and Number(true) === 1 — a silent
// one-second clock that killed the form before the browser even opened. Same
// family: a non-numeric value, and a path flag with no value.
test('malformed flags fail loudly at the door, never as a 1-second clock', async () => {
  const { startExpectingExit } = await import('../helpers.mjs');
  const base = ['--schema', SCHEMA, '--out', '/dev/null'];
  for (const bad of [
    [...base, '--timeout'],           // bare flag -> true -> Number(true) === 1
    [...base, '--timeout', 'soon'],   // NaN
    [...base, '--timeout', '-5'],     // negative
    [...base, '--port'],              // bare numeric flag
    ['--schema', SCHEMA, '--out'],    // bare path flag
  ]) {
    const { code, stdout } = await startExpectingExit(CONFIG_FORM, bad);
    assert.equal(code, 2, `${bad.join(' ')} must exit 2`);
    assert.match(stdout, /CONFIG_FORM_ERROR /, `${bad.join(' ')} must print _ERROR on stdout`);
  }
});

test('--timeout 0 is the deliberate clock opt-out, not an error', async () => {
  const tmp = makeTmp();
  const { srv: srvP } = launch(tmp, ['--timeout', '0']);
  const srv = await srvP;
  try {
    await new Promise((r) => setTimeout(r, 1500));
    assert.equal(srv.child.exitCode, null, 'no clock: still alive well past a 1s misparse');
  } finally { srv.child.kill('SIGKILL'); cleanup(tmp); }
});

// `provides` pairs a task with the setting it would fill in. SCHEMA.md documents it;
// nothing pinned it until now, so a rewrite of renderTask could silently drop the
// pairing and every test would still pass.
test('provides renders a task inline under the visible field it fills, and still renders when there is no such field', async () => {
  const tmp = makeTmp();
  const { srv: srvP } = launch(tmp);
  const srv = await srvP;
  try {
    const page = await raw(srv, `/?token=${srv.token}`);
    assert.equal(page.status, 200);

    // create-audit-results provides audit_results_url, which IS a visible setting in its
    // group: the checkbox carries the pairing and an inline task block exists.
    assert.match(page.text, /data-provides="audit_results_url"/, 'paired task carries data-provides');
    assert.match(page.text, /class="tasks inline"/, 'paired task renders inline under its field');

    // install-standard provides registry_url, which is NOT a visible setting, AND the
    // status fixture marks it done. It must still RENDER — the task, its label and its
    // badge — even though a done+unpaired task offers no checkbox and therefore carries
    // no data-provides attribute. Assert the task, not the attribute: this assertion
    // used to check data-provides and passed only because the status fixture's key
    // (`install-block`) did not match the schema's id, so the task looked not-done.
    // Fixing that drift is what exposed the assertion as testing the wrong marker.
    assert.match(page.text, /Install the standard on this machine/, 'unpaired task still renders');
    assert.match(page.text, /badge ok">done/, 'and shows its done badge from the status file');

    // create-audit-results has no value yet and is not done, so it still offers to run.
    assert.match(page.text, /set up now/);
    assert.doesNotMatch(page.text, /create a new one instead/);
  } finally { srv.child.kill('SIGKILL'); cleanup(tmp); }
});

test('a paired field that already holds a value flips its task to "create a new one instead"', async () => {
  const tmp = makeTmp();
  const prior = join(tmp, 'values.json');
  writeFileSync(prior, JSON.stringify({ audit_results_url: 'https://notion.so/already-have-one' }));
  const { srv: srvP } = launch(tmp, ['--values', prior]);
  const srv = await srvP;
  try {
    const page = await raw(srv, `/?token=${srv.token}`);
    assert.equal(page.status, 200);
    // The user already pasted a link, so the task stops offering to do it for them and
    // offers the deliberate override instead. This is the mutual-exclusivity SCHEMA.md promises.
    assert.match(page.text, /create a new one instead/, 'filled field flips the offer');
    assert.match(page.text, /data-provides="audit_results_url"/, 'pairing survives the flip');
  } finally { srv.child.kill('SIGKILL'); cleanup(tmp); }
});
