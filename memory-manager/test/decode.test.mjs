import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { decodeStorePath, encodeSeg } from '../memory-manager.mjs';
import { makeTmp, cleanup } from './helpers.mjs';

// Encode an absolute path the way Claude Code encodes a project cwd:
// every non-alphanumeric character becomes '-', including the separators.
const encodePath = (p) => p.split('/').filter(Boolean).map(encodeSeg).map((s) => `-${s}`).join('');

test('decodeStorePath recovers dirs with spaces and literal hyphens', (t) => {
  const base = makeTmp('mm-decode-');
  t.after(() => cleanup(base));
  const spaced = join(base, 'My Cool Project');
  const hyphened = join(base, 'tf-module-ecs-alb');
  mkdirSync(spaced, { recursive: true });
  mkdirSync(hyphened, { recursive: true });

  for (const real of [spaced, hyphened]) {
    const { path, resolved } = decodeStorePath(encodePath(real));
    assert.equal(resolved, true, `should fully resolve ${real}`);
    assert.equal(path, real);
  }
});

test('an unresolved tail keeps its hyphens instead of guessing separators', (t) => {
  const base = makeTmp('mm-decode-');
  t.after(() => cleanup(base));
  const dirName = `${encodePath(base)}-no-such-dir-here`;
  const { path, resolved } = decodeStorePath(dirName);
  assert.equal(resolved, false);
  assert.ok(path.endsWith('/no-such-dir-here'), `tail must keep hyphens, got: ${path}`);
  assert.ok(path.startsWith(base), 'resolved prefix must be kept');
});

test('windows-style store names decode to a drive path, marked unresolved', () => {
  const { path, resolved } = decodeStorePath('C--Users-noah-project');
  assert.equal(resolved, false);
  assert.equal(path, 'C:\\Users\\noah\\project');
});

test('a totally fictional path never resolves but never throws', () => {
  const { resolved } = decodeStorePath('-zz-does-not-exist-anywhere-at-all');
  assert.equal(resolved, false);
});
