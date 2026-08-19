// Unit-level contract checks: defaults, ender normalization, ping injection.
// These import the engine as a library — no processes spawned.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEnders, injectPing, LOCAL_UI_VERSION } from '../local-ui.mjs';

test('clock defaults to 540 when absent — the blocking-Bash ceiling holds unread', () => {
  assert.equal(normalizeEnders({}).clock, 540);
  assert.equal(normalizeEnders({ done: true }).clock, 540);
  assert.equal(normalizeEnders(undefined).clock, 540);
});

test('clock: 0 is a deliberate opt-out; other values pass through', () => {
  assert.equal(normalizeEnders({ clock: 0 }).clock, 0);
  assert.equal(normalizeEnders({ clock: 1800 }).clock, 1800);
  assert.equal(normalizeEnders({ clock: 1.5 }).clock, 1.5);
});

test('invalid clock values fall back to the default, never to disabled', () => {
  assert.equal(normalizeEnders({ clock: 'soon' }).clock, 540);
  assert.equal(normalizeEnders({ clock: -5 }).clock, 540);
});

test('done/close normalize to booleans, default off', () => {
  const e = normalizeEnders({});
  assert.equal(e.done, false);
  assert.equal(e.close, false);
  assert.equal(normalizeEnders({ done: 1, close: 'yes' }).done, true);
});

test('ping script is injected before the LAST </body> and carries the token placeholder', () => {
  const html = '<html><body><code>&lt;/body&gt; sample</code></body></html>';
  const out = injectPing(html, 3000);
  assert.match(out, /__TOKEN__/);
  assert.ok(out.lastIndexOf('</body>') > out.indexOf('/api/ping'), 'script sits inside body');
  assert.equal(out.split('/api/ping').length - 1, 1, 'injected exactly once');
});

test('html with no </body> still gets the ping (appended)', () => {
  const out = injectPing('<p>bare fragment</p>', 3000);
  assert.match(out, /\/api\/ping/);
});

test('version stamp exists for later /skill-dev-rig status tooling (P5)', () => {
  assert.match(LOCAL_UI_VERSION, /^\d+\.\d+\.\d+$/);
});
