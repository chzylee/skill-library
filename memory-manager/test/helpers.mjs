// Shared test helpers. Fixtures are built from scratch in a temp dir per test —
// nothing here ever touches ~/.claude/projects.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const SERVER = fileURLToPath(new URL('../memory-manager.mjs', import.meta.url));

export function tmpBase() {
  return process.env.MM_TEST_TMP || tmpdir();
}

export function makeTmp(prefix = 'mm-test-') {
  return mkdtempSync(join(tmpBase(), prefix));
}

export function write(root, rel, content) {
  const full = join(root, rel);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content, 'utf8');
  return full;
}

export function cleanup(dir) {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

// Spawn the real server against a fixture root; resolve with url/port/child once listening.
export function startServer(root, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER, '--root', root, '--no-open', '--port', '0', '--timeout', '120', ...extraArgs], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`server never listened. stdout:\n${out}\nstderr:\n${err}`)); }, 10000);
    child.stdout.on('data', (c) => {
      out += c;
      const m = /MEMORY_MANAGER_URL=(\S+)/.exec(out);
      if (m) {
        clearTimeout(timer);
        const url = new URL(m[1]);
        resolve({
          child,
          origin: url.origin,
          token: url.searchParams.get('token'),
          stdout: () => out,
          exited: new Promise((res) => child.on('exit', (code) => res(code))),
        });
      }
    });
    child.stderr.on('data', (c) => { err += c; });
    child.on('exit', () => { clearTimeout(timer); });
    child.on('error', reject);
  });
}

export async function api(srv, path, opt = {}) {
  const res = await fetch(`${srv.origin}/api${path}`, {
    ...opt,
    headers: { 'content-type': 'application/json', 'x-mm-token': srv.token, ...(opt.headers || {}) },
  });
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body };
}
