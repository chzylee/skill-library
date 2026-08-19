// Shared test helpers for the local-ui engine suite.
// Layout follows memory-manager/test: helpers.mjs + per-concern *.test.mjs files.
// Fixtures are spawned as real processes and asserted black-box through their
// stdout markers, HTTP surface, and run records — the same way an agent sees them.
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));
export const ENGINE = fileURLToPath(new URL('./local-ui.mjs', import.meta.url));
export const CONFIG_FORM = fileURLToPath(new URL('./config-form.mjs', import.meta.url));

export function makeTmp(prefix = 'local-ui-test-') {
  return mkdtempSync(join(process.env.LOCAL_UI_TEST_TMP || tmpdir(), prefix));
}

export function cleanup(dir) {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Spawn a script and resolve once `<PREFIX>_URL=` appears on stdout.
// Resolves { child, origin, token, resultFile, stdout(), exited } like
// memory-manager's startServer, plus the run-record path from `<PREFIX>_RESULT=`.
export function start(script, prefix, args = [], env = null) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      ...(env ? { env: { ...process.env, ...env } } : {}),
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`server never listened. stdout:\n${out}\nstderr:\n${err}`));
    }, 10000);
    const exited = new Promise((res) => child.on('exit', (code) => res(code)));
    let resolved = false;
    child.stdout.on('data', (c) => {
      out += c;
      if (resolved) return;
      const m = new RegExp(`${prefix}_URL=(\\S+)`).exec(out);
      const r = new RegExp(`${prefix}_RESULT=(\\S+)`).exec(out);
      if (m && r) { // both markers print together at listen; wait for both
        resolved = true;
        clearTimeout(timer);
        const url = new URL(m[1]);
        resolve({
          child,
          origin: url.origin,
          port: Number(url.port),
          token: url.searchParams.get('token'),
          resultFile: r[1],
          stdout: () => out,
          exited,
        });
      }
    });
    child.stderr.on('data', (c) => { err += c; });
    child.on('exit', () => clearTimeout(timer));
    child.on('error', reject);
  });
}

// Spawn a script expected to fail before listening; resolve { code, stdout, stderr }.
export function startExpectingExit(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { err += c; });
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`never exited. stdout:\n${out}`)); }, 10000);
    child.on('exit', (code) => { clearTimeout(timer); resolve({ code, stdout: out, stderr: err }); });
    child.on('error', reject);
  });
}

export async function api(srv, path, opt = {}) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${srv.origin}${path}${sep}token=${srv.token}`, {
    headers: { 'content-type': 'application/json', ...(opt.headers || {}) },
    ...opt,
  });
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body };
}

// Raw fetch with full control (for security tests that must NOT send the token).
export async function raw(srv, path, opt = {}) {
  const res = await fetch(`${srv.origin}${path}`, opt);
  let text = '';
  try { text = await res.text(); } catch { /* ignore */ }
  return { status: res.status, text };
}

export function readRecord(path) {
  if (!path || !existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

export function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}
