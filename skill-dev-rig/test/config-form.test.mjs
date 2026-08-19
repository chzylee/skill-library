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
