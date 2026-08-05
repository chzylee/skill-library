import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIndex, replaceIndexLine, indexLineFor } from '../memory-manager.mjs';

test('parseIndex handles -, *, and numbered bullets, sections, and dash separators', () => {
  const text = [
    '# Memory Index',
    '',
    '## Section A',
    '- [Plain](a.md) — hook a',
    '* [Star](b.md) -- hook b',
    '2. [Numbered](c.md) – hook c',
    'not an entry',
  ].join('\n');
  const { entries } = parseIndex(text);
  assert.equal(entries.length, 3);
  assert.deepEqual(entries.map((e) => e.target), ['a.md', 'b.md', 'c.md']);
  assert.deepEqual(entries.map((e) => e.hook), ['hook a', 'hook b', 'hook c']);
  assert.equal(entries[0].section, 'Section A');
});

test('parseIndex: title may contain parentheses; target keeps working', () => {
  const { entries } = parseIndex('- [Rally (the app)](rally.md) — note');
  assert.equal(entries[0].title, 'Rally (the app)');
  assert.equal(entries[0].target, 'rally.md');
});

test('parseIndex decodes %-escapes and strips ./ and #anchors from targets', () => {
  const { entries } = parseIndex([
    '- [Spaced](my%20file.md)',
    '- [Rel](./rel.md)',
    '- [Anchored](notes.md#section-2)',
  ].join('\n'));
  assert.deepEqual(entries.map((e) => e.target), ['my file.md', 'rel.md', 'notes.md']);
});

test('a malformed %-escape in one line does not throw (would kill the whole scan)', () => {
  const { entries } = parseIndex('- [Bad](file%2.md)\n- [Good](ok.md)');
  assert.equal(entries.length, 2);
  assert.equal(entries[0].target, 'file%2.md'); // kept raw
  assert.equal(entries[1].target, 'ok.md');
});

test('replaceIndexLine preserves CRLF and the trailing newline', () => {
  const text = '# Memory Index\r\n\r\n- [A](a.md) — old\r\n';
  const out = replaceIndexLine(text, 'a.md', indexLineFor('A', 'a.md', 'new'));
  assert.ok(out.includes('- [A](a.md) — new'));
  assert.ok(!/(^|[^\r])\n/.test(out), 'no bare LF may appear in a CRLF file');
  assert.ok(out.endsWith('\r\n'), 'trailing newline preserved');
});

test('replace touches the first matching line only', () => {
  const text = '- [A](a.md) — one\n- [A dup](a.md) — two\n';
  const out = replaceIndexLine(text, 'a.md', '- [A](a.md) — edited');
  assert.ok(out.includes('— edited'));
  assert.ok(out.includes('— two'), 'duplicate stays for the user to rule on');
});

test('delete removes EVERY line pointing at the target', () => {
  const text = '- [A](a.md) — one\n- [B](b.md)\n- [A dup](a.md) — two\n';
  const out = replaceIndexLine(text, 'a.md', null);
  assert.ok(!out.includes('a.md'));
  assert.ok(out.includes('b.md'));
});

test('append lands after the last existing entry, not in a section it invents', () => {
  const text = '# Memory Index\n\n- [A](a.md)\n\nTrailing prose.\n';
  const out = replaceIndexLine(text, 'b.md', '- [B](b.md)');
  const lines = out.split('\n');
  assert.equal(lines[lines.indexOf('- [A](a.md)') + 1], '- [B](b.md)');
});

test('append to a bare header creates a clean block with a final newline', () => {
  const out = replaceIndexLine('# Memory Index\n', 'a.md', '- [A](a.md)');
  assert.equal(out, '# Memory Index\n\n- [A](a.md)\n');
});

test('deleting a target with no line is a no-op', () => {
  const text = '- [A](a.md)\n';
  assert.equal(replaceIndexLine(text, 'zzz.md', null), text);
});
