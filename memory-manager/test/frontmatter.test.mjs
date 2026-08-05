import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitDoc, parseFm, setFmField, fmScalar, safeName, safeStore } from '../memory-manager.mjs';

const FM = [
  'name: some-slug',
  'description: "one line"',
  'metadata:',
  '  node_type: memory',
  '  type: user',
  '  originSessionId: 123e4567-e89b-12d3-a456-426614174000',
].join('\n');

test('setFmField replaces one line and leaves every other byte alone', () => {
  const out = setFmField(FM, 'description', 'new text');
  const before = FM.split('\n');
  const after = out.split('\n');
  assert.equal(after.length, before.length);
  before.forEach((l, i) => {
    if (l.startsWith('description:')) assert.equal(after[i], 'description: new text');
    else assert.equal(after[i], l);
  });
});

test('unknown keys survive a full edit pass byte-for-byte', () => {
  let fm = FM;
  fm = setFmField(fm, 'name', 'renamed');
  fm = setFmField(fm, 'description', 'changed');
  fm = setFmField(fm, 'type', 'project', 'metadata');
  fm = setFmField(fm, 'modified', '2026-08-05');
  assert.ok(fm.includes('  node_type: memory'));
  assert.ok(fm.includes('  originSessionId: 123e4567-e89b-12d3-a456-426614174000'));
  assert.ok(fm.includes('  type: project'));
  assert.ok(!fm.includes('type: user'));
});

test('a key present both top-level and nested: only the addressed one changes', () => {
  const fm = ['type: top-value', 'metadata:', '  type: nested-value'].join('\n');
  const nested = setFmField(fm, 'type', 'X', 'metadata');
  assert.ok(nested.includes('type: top-value'));
  assert.ok(nested.includes('  type: X'));
  const top = setFmField(fm, 'type', 'Y');
  assert.ok(top.includes('type: Y'));
  assert.ok(top.includes('  type: nested-value'));
});

test('missing parent falls back to a top-level write', () => {
  const out = setFmField('name: x', 'type', 'user', 'metadata');
  assert.ok(out.includes('type: user'));
});

test('new top-level key is inserted before the first nested block', () => {
  const out = setFmField(FM, 'modified', '2026-08-05');
  const lines = out.split('\n');
  const modAt = lines.findIndex((l) => l.startsWith('modified:'));
  const metaAt = lines.findIndex((l) => l === 'metadata:');
  assert.ok(modAt >= 0 && modAt < metaAt, 'modified: must precede metadata: block');
});

test('CRLF frontmatter stays CRLF when the caller passes its EOL', () => {
  const fm = FM.split('\n').join('\r\n');
  const out = setFmField(fm, 'description', 'new', null, '\r\n');
  assert.ok(!/(^|[^\r])\n/.test(out), 'no bare LF may appear');
  assert.ok(out.includes('description: new'));
});

test('a value containing a newline cannot break the frontmatter block', () => {
  const out = setFmField(FM, 'description', 'line one\nline two');
  assert.equal(out.split('\n').length, FM.split('\n').length);
  assert.ok(out.includes('line one line two'));
});

test('colon, hash, quote-leading, empty, and dash values are quoted safely', () => {
  for (const [v, mustQuote] of [
    ['at 10:30 sharp', true],
    ['#1 fact', true],
    ['"already quoted"', true],
    ['', true],
    ['- looks like a list', true],
    ['>- looks like a block', true],
    ['plain value', false],
  ]) {
    const s = fmScalar(v);
    assert.equal(s.startsWith('"'), mustQuote, `fmScalar(${JSON.stringify(v)}) → ${s}`);
    // Round trip through the parser.
    const parsed = parseFm(`description: ${s}`);
    assert.equal(parsed.description, v.replace(/\r?\n/g, ' '));
  }
});

test('replacing a block scalar removes its continuation lines (no stranded YAML)', () => {
  const fm = [
    'name: x',
    'description: >-',
    '  first folded line',
    '  second folded line',
    'metadata:',
    '  type: user',
  ].join('\n');
  const out = setFmField(fm, 'description', 'flat now');
  assert.ok(out.includes('description: flat now'));
  assert.ok(!out.includes('folded line'), 'continuation lines must go with the scalar');
  assert.ok(out.includes('metadata:'));
  assert.ok(out.includes('  type: user'));
});

test('replacing a NESTED block scalar spares its siblings', () => {
  const fm = [
    'metadata:',
    '  type: |',
    '    old a',
    '    old b',
    '  originSessionId: keep-me',
  ].join('\n');
  const out = setFmField(fm, 'type', 'user', 'metadata');
  assert.ok(out.includes('  type: user'));
  assert.ok(!out.includes('old a'));
  assert.ok(out.includes('  originSessionId: keep-me'));
});

test('parseFm joins block scalars for display instead of showing ">-"', () => {
  const fm = parseFm('description: >-\n  one line\n  two line');
  assert.equal(fm.description, 'one line two line');
});

test('a file with no frontmatter at all: body preserved, fields addable', () => {
  const { fmRaw, body } = splitDoc('just a body\nwith two lines\n');
  assert.equal(fmRaw, '');
  assert.equal(body, 'just a body\nwith two lines\n');
  const fm = setFmField('', 'name', 'fresh');
  assert.ok(fm.includes('name: fresh'));
});

test('safeName rejects traversal, hidden files, and the index itself', () => {
  assert.throws(() => safeName('../evil.md'));
  assert.throws(() => safeName('a/b.md'));
  assert.throws(() => safeName('a\\b.md'));
  assert.throws(() => safeName('.hidden.md'));
  assert.throws(() => safeName('MEMORY.md'));
  assert.throws(() => safeName('memory.md'), /unsafe/); // case-insensitive filesystems
  assert.throws(() => safeName('notes.txt'));
  assert.equal(safeName('fine.md'), 'fine.md');
});

test('safeStore rejects separators and traversal', () => {
  assert.throws(() => safeStore('../outside'));
  assert.throws(() => safeStore('a/b'));
  assert.throws(() => safeStore('a\\b'));
  assert.throws(() => safeStore('..'));
  assert.throws(() => safeStore(''));
  assert.throws(() => safeStore('.hidden'));
  assert.equal(safeStore('-Users-x-proj'), '-Users-x-proj');
});
