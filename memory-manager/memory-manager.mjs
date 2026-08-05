#!/usr/bin/env node
// memory-manager — view and manage Claude Code auto-memory across every store on the machine.
//
// Usage:
//   node memory-manager.mjs [--root <dir>] [--port 0] [--timeout 1800] [--open|--no-open]
//
// --root defaults to ~/.claude/projects. Point it at a fixture copy to develop safely.
//
// Contract (stdout markers the caller parses):
//   MEMORY_MANAGER_URL=<url>       printed once the server is listening
//   MEMORY_MANAGER_SUMMARY ... MEMORY_MANAGER_DONE   printed on finish, then exit 0
//   MEMORY_MANAGER_TIMEOUT         printed if nobody finished in time, then exit 3
//
// Node stdlib only. The server owns every write; the browser only sends intent.

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  existsSync, readdirSync, readFileSync, writeFileSync, statSync, mkdirSync, renameSync,
  realpathSync, copyFileSync, cpSync, constants as fsConstants,
} from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

// ---------------------------------------------------------------- args

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) continue;
  const key = a.slice(2);
  const next = argv[i + 1];
  if (next && !next.startsWith('--')) { args[key] = next; i++; } else { args[key] = true; }
}

const ROOT = args.root ? String(args.root) : join(homedir(), '.claude', 'projects');
// `--timeout` with no value parses as `true` → Number(true) = 1; guard against that and NaN.
const TIMEOUT_SEC = (() => { const n = Number(args.timeout); return Number.isFinite(n) && n > 0 ? n : 1800; })();
const SHOULD_OPEN = args['no-open'] ? false : true;
const TOKEN = randomBytes(12).toString('hex');

// MEMORY.md budget: only the index loads at session start, capped at whichever comes first.
const CAP_LINES = 200;
const CAP_BYTES = 25 * 1024;

if (IS_MAIN && !existsSync(ROOT)) {
  process.stdout.write(`MEMORY_MANAGER_ERROR root not found: ${ROOT}\n`);
  process.exit(2);
}

// ---------------------------------------------------------------- store path decoding
//
// A store directory encodes the project cwd: `-Users-noahlee-Desktop-Projects-dia`.
// The encoding is lossy — every non-alphanumeric character becomes `-`, so a separator,
// a space (`Claude Projects`) and a literal hyphen (`tf-module-ecs-alb-api-service`) are
// indistinguishable in the name alone. Recover the truth by walking the real filesystem
// and matching each directory against its own encoded form, longest match first. When a
// project directory no longer exists, stop and say so rather than guessing silently.

const encodeSeg = (s) => s.replace(/[^a-zA-Z0-9]/g, '-');

function decodeStorePath(dirName) {
  const win = /^([a-zA-Z])--/.exec(dirName);
  if (win) {
    const segs = dirName.slice(win[0].length).split('-');
    return { path: `${win[1].toUpperCase()}:\\${segs.join('\\')}`, resolved: false };
  }
  const segs = (dirName.startsWith('-') ? dirName.slice(1) : dirName).split('-');
  let cur = '';
  let i = 0;
  while (i < segs.length) {
    let entries = [];
    try { entries = readdirSync(cur || '/'); } catch { break; }
    let best = null;
    for (const e of entries) {
      const enc = encodeSeg(e);
      const n = enc.split('-').length;
      if (segs.slice(i, i + n).join('-') === enc && (!best || n > best.n)) best = { e, n };
    }
    if (!best) break;
    cur = `${cur}/${best.e}`;
    i += best.n;
  }
  if (i >= segs.length) return { path: cur, resolved: true };
  // Keep the resolved prefix; a hyphen in the unresolved tail is far likelier to be
  // part of a name than a separator, so preserve it rather than splitting on it.
  const tail = segs.slice(i).join('-');
  return { path: `${cur}/${tail}`, resolved: false, prefix: cur, tail };
}

// An unresolved store usually means the project was renamed or moved, and the likely
// new home is a sibling of where the path stopped resolving. Rank siblings by how much
// of the unresolved tail they share, so the user picks from real candidates instead of
// retyping a path. Suggestion only — nothing acts on this without a click.
function suggestHomes(decoded) {
  if (decoded.resolved || !decoded.prefix || !decoded.tail) return [];
  let entries;
  try { entries = readdirSync(decoded.prefix, { withFileTypes: true }); } catch { return []; }
  const want = decoded.tail.toLowerCase().split('-').filter(Boolean);
  if (!want.length) return [];
  const scored = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('.')) continue;
    const enc = encodeSeg(e.name).toLowerCase().split('-').filter(Boolean);
    const have = new Set(enc);
    const hit = want.filter((t) => have.has(t)).length;
    if (!hit) continue;
    const score = hit / Math.max(want.length, enc.length);
    if (score >= 0.5) scored.push({ path: join(decoded.prefix, e.name), score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 5).map((s) => s.path);
}

// ---------------------------------------------------------------- frontmatter
//
// Parsed for display, but NEVER re-serialized wholesale. Saving does targeted line
// replacement so unknown keys (originSessionId, node_type, anything Anthropic adds
// later) survive byte-for-byte.

function splitDoc(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!m) return { fm: null, fmRaw: '', body: raw };
  return { fmRaw: m[1], body: raw.slice(m[0].length) };
}

function unquote(v) {
  const s = v.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1).replace(/\\"/g, '"');
  }
  return s;
}

const isBlockScalar = (val) => /^[>|][+-]?$/.test(val.trim());

function parseFm(fmRaw) {
  const out = { _nested: {} };
  const lines = fmRaw.split(/\r?\n/);
  let nest = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const indented = /^\s+/.test(line);
    const kv = /^(\s*)([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, , key, val] = kv;
    if (!indented) {
      if (isBlockScalar(val)) {
        // Block scalar (`description: >-`): join the indented continuation for display.
        const parts = [];
        let j = i + 1;
        while (j < lines.length && (!lines[j].trim() || /^\s+/.test(lines[j]))) {
          if (lines[j].trim()) parts.push(lines[j].trim());
          j++;
        }
        out[key] = parts.join(' ');
        nest = null;
        i = j - 1;
      } else if (val.trim() === '') { nest = key; out._nested[key] = {}; }
      else { nest = null; out[key] = unquote(val); }
    } else if (nest) {
      out._nested[nest][key] = unquote(val);
    }
  }
  return out;
}

// A frontmatter value written back must stay a single, unambiguous YAML scalar.
function fmScalar(value) {
  const v = String(value).replace(/\r?\n/g, ' '); // a newline here would corrupt the block
  const needsQuote = v === ''
    || /[:#]/.test(v)          // mapping / comment introducers
    || /^\s|\s$/.test(v)       // leading/trailing space is lost unquoted
    || /^["'>|]/.test(v)       // would read as quote or block-scalar indicator
    || /^-\s/.test(v) || v === '-'; // would read as a list item
  return needsQuote ? `"${v.replace(/"/g, '\\"')}"` : v;
}

// If the line at `at` holds a block scalar, its indented continuation lines belong to it
// and must be replaced along with it — otherwise the edit strands them as invalid YAML.
function scalarEnd(lines, at) {
  const m = /^(\s*)[A-Za-z0-9_-]+:\s*(.*)$/.exec(lines[at]);
  if (!m || !isBlockScalar(m[2])) return at + 1;
  const depth = m[1].length;
  let j = at + 1;
  while (j < lines.length && (!lines[j].trim() || /^(\s*)/.exec(lines[j])[1].length > depth)) j++;
  return j;
}

// Replace `key:` at top level, or `parent.key:` one level in. Insert if absent.
// Joins with the caller's EOL so CRLF files stay CRLF.
function setFmField(fmRaw, key, value, parent = null, eol = '\n') {
  const lines = fmRaw.split(/\r?\n/);
  const quoted = fmScalar(value);
  if (!parent) {
    const at = lines.findIndex((l) => new RegExp(`^${key}:`).test(l));
    if (at >= 0) {
      lines.splice(at, scalarEnd(lines, at) - at, `${key}: ${quoted}`);
      return lines.join(eol);
    }
    // Insert before the first nested block, so a new top-level key doesn't trail
    // after someone else's indented children and read as though it belongs to them.
    const firstNested = lines.findIndex((l) => /^[A-Za-z0-9_-]+:\s*$/.test(l));
    if (firstNested >= 0) lines.splice(firstNested, 0, `${key}: ${quoted}`);
    else lines.push(`${key}: ${quoted}`);
    return lines.join(eol);
  }
  const pAt = lines.findIndex((l) => new RegExp(`^${parent}:\\s*$`).test(l.replace(/\s+$/, '')));
  if (pAt < 0) return setFmField(fmRaw, key, value, null, eol); // no such parent — write at top level
  let end = pAt + 1;
  while (end < lines.length && (/^\s+\S/.test(lines[end]) || lines[end].trim() === '')) end++;
  const at = lines.slice(pAt + 1, end).findIndex((l) => new RegExp(`^\\s+${key}:`).test(l));
  const indent = /^(\s+)/.exec(lines[pAt + 1] || '  x')?.[1] || '  ';
  if (at >= 0) {
    const abs = pAt + 1 + at;
    lines.splice(abs, scalarEnd(lines, abs) - abs, `${indent}${key}: ${quoted}`);
  } else lines.splice(end, 0, `${indent}${key}: ${quoted}`);
  return lines.join(eol);
}

// ---------------------------------------------------------------- MEMORY.md index

const INDEX_RE = /^\s*(?:[-*]|\d+[.)])\s*\[([^\]]*)\]\(([^)]+)\)\s*(?:—|–|--)?\s*(.*)$/;

// The link target names a file: decode %-escapes (tolerating malformed ones — one bad
// line must not kill the scan), drop a `./` prefix and any `#anchor`.
function normalizeTarget(rawTarget) {
  let t = rawTarget.trim();
  try { t = decodeURIComponent(t); } catch { /* keep the raw form */ }
  return t.replace(/^\.\//, '').split('#')[0];
}

function parseIndex(text) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  let section = null;
  lines.forEach((line, i) => {
    const h = /^##+\s+(.*)$/.exec(line);
    if (h) { section = h[1].trim(); return; }
    const m = INDEX_RE.exec(line);
    if (!m) return;
    entries.push({ title: m[1], target: normalizeTarget(m[2]), hook: m[3].trim(), section, lineNo: i, raw: line });
  });
  return { entries, lines };
}

function indexLineFor(title, target, hook) {
  return `- [${title}](${target})${hook ? ` — ${hook}` : ''}`;
}

// ---------------------------------------------------------------- scan

function scan() {
  const stores = [];
  for (const dirName of readdirSync(ROOT).sort()) {
    // Dot-entries are never stores (an encoded absolute path can't start with `.`),
    // and this is what guarantees `.trash` never scans — even if something inside it
    // happens to be shaped like `<entry>/memory`.
    if (dirName.startsWith('.')) continue;
    try {
      scanStore(stores, dirName);
    } catch (e) {
      // One unreadable store must not blank the whole view.
      stores.push({
        store: dirName,
        projectPath: decodeStorePath(dirName).path,
        pathResolved: false,
        memDir: join(ROOT, dirName, 'memory'),
        indexKind: 'missing',
        indexLines: 0,
        indexBytes: 0,
        entryCount: 0,
        budget: { lines: 0, bytes: 0, capLines: CAP_LINES, capBytes: CAP_BYTES, over: false, warn: false },
        orphans: [],
        duplicates: [],
        records: [],
        error: String(e.message || e),
      });
    }
  }
  return stores;
}

function scanStore(stores, dirName) {
  const memDir = join(ROOT, dirName, 'memory');
  if (!existsSync(memDir) || !statSync(memDir).isDirectory()) return;

  {
    const decoded = decodeStorePath(dirName);
    const indexPath = join(memDir, 'MEMORY.md');
    const hasIndex = existsSync(indexPath);
    const indexText = hasIndex ? readFileSync(indexPath, 'utf8') : '';
    const { entries } = parseIndex(indexText);

    const files = readdirSync(memDir)
      .filter((f) => f.endsWith('.md') && f !== 'MEMORY.md')
      .sort();

    // First line wins — it's the one save maintains; extras are surfaced as duplicates.
    const byTarget = new Map();
    const counts = new Map();
    for (const e of entries) {
      if (!byTarget.has(e.target)) byTarget.set(e.target, e);
      counts.set(e.target, (counts.get(e.target) || 0) + 1);
    }
    const duplicates = [...counts].filter(([, c]) => c > 1).map(([target, count]) => ({ target, count }));

    const records = files.map((file) => {
      const full = join(memDir, file);
      let raw;
      let st;
      try {
        raw = readFileSync(full, 'utf8');
        st = statSync(full);
      } catch (e) {
        // Surface the file instead of killing the scan.
        return {
          store: dirName, file, name: '', description: '', type: '', nodeType: '',
          originSessionId: '', modified: '', mtime: '', bytes: 0, body: '',
          indexTitle: '', indexHook: '', indexSection: null, indexLine: '',
          flags: ['unreadable'], error: String(e.message || e),
        };
      }
      const { fmRaw, body } = splitDoc(raw);
      const fm = parseFm(fmRaw || '');
      const meta = fm._nested.metadata || {};
      const stem = file.replace(/\.md$/, '');
      const entry = byTarget.get(file) || null;
      const flags = [];
      if (!entry) flags.push('unindexed');
      if (fm.name && fm.name !== stem) flags.push('name-divergence');
      if (!fm.name) flags.push('no-name');
      if (!fm.description) flags.push('no-description');
      if (!fm.modified) flags.push('undated');
      if (!meta.type) flags.push('no-type');
      return {
        store: dirName,
        file,
        name: fm.name || '',
        description: fm.description || '',
        type: meta.type || '',
        nodeType: meta.node_type || '',
        originSessionId: meta.originSessionId || '',
        modified: fm.modified || '',
        mtime: st.mtime.toISOString(),
        bytes: st.size,
        body: body.replace(/^\n+/, ''),
        indexTitle: entry ? entry.title : '',
        indexHook: entry ? entry.hook : '',
        indexSection: entry ? entry.section : null,
        indexLine: entry ? entry.raw.trim() : '',
        flags,
      };
    });

    const present = new Set(files);
    const orphans = entries.filter((e) => !present.has(e.target));

    // A MEMORY.md that isn't an index at all: no parseable lines, but real prose in it.
    // This is the quiet killer — the store's memory system is dead and nothing says so.
    const meaningful = indexText.split(/\r?\n/).filter((l) => l.trim() && !/^#\s*Memory Index/i.test(l)).length;
    let indexKind = 'index';
    if (!hasIndex) indexKind = 'missing';
    else if (entries.length === 0 && meaningful >= 3) indexKind = 'non-index';

    const indexBytes = Buffer.byteLength(indexText, 'utf8');
    const indexLines = hasIndex ? indexText.split(/\r?\n/).length : 0;

    stores.push({
      store: dirName,
      projectPath: decoded.path,
      pathResolved: decoded.resolved,
      suggestions: suggestHomes(decoded),
      memDir,
      indexKind,
      indexLines,
      indexBytes,
      entryCount: entries.length,
      budget: {
        lines: indexLines,
        bytes: indexBytes,
        capLines: CAP_LINES,
        capBytes: CAP_BYTES,
        over: indexLines > CAP_LINES || indexBytes > CAP_BYTES,
        warn: indexLines > CAP_LINES * 0.8 || indexBytes > CAP_BYTES * 0.8,
      },
      orphans: orphans.map((o) => ({ title: o.title, target: o.target, hook: o.hook, raw: o.raw.trim() })),
      duplicates,
      records,
    });
  }
}

// ---------------------------------------------------------------- writes
//
// Every operation is two parts — the file and its index line. Both new contents are
// computed before either is written, so a malformed input fails before anything lands.

const ops = [];

// The store name is a single directory entry under ROOT, nothing else. It arrives
// URL-decoded, so `%2F` traversal would otherwise reach join() as a real separator.
function safeStore(store) {
  if (!store || store.includes('/') || store.includes('\\') || store.includes('..') || store.startsWith('.')) {
    throw new Error(`unsafe store name: ${store}`);
  }
  return store;
}

function storeOf(store) {
  const memDir = join(ROOT, safeStore(store), 'memory');
  if (!existsSync(memDir) || !statSync(memDir).isDirectory()) throw new Error(`no such store: ${store}`);
  return memDir;
}

function safeName(file) {
  if (!file || file.includes('/') || file.includes('\\') || file.includes('..')
    || file.startsWith('.') || !file.endsWith('.md')
    // The index is not a record; on case-insensitive filesystems `memory.md` IS MEMORY.md.
    || file.toLowerCase() === 'memory.md') {
    throw new Error(`unsafe filename: ${file}`);
  }
  return file;
}

function readIndex(memDir) {
  const p = join(memDir, 'MEMORY.md');
  return { path: p, text: existsSync(p) ? readFileSync(p, 'utf8') : '# Memory Index\n' };
}

function replaceIndexLine(text, target, newLine) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const { entries, lines } = parseIndex(text);
  const hits = entries.filter((x) => x.target === target);
  if (hits.length) {
    if (newLine === null) {
      // Deleting a record removes every line that points at it — leaving a duplicate
      // behind would manufacture a guaranteed orphan.
      for (let k = hits.length - 1; k >= 0; k--) lines.splice(hits[k].lineNo, 1);
    } else {
      lines[hits[0].lineNo] = newLine;
    }
    return lines.join(eol);
  }
  if (newLine === null) return text;
  // Append after the last existing entry, else at the end — never invent a section.
  if (entries.length) {
    lines.splice(entries[entries.length - 1].lineNo + 1, 0, newLine);
    return lines.join(eol);
  }
  const out = text.replace(/(\r?\n)+$/, '');
  return `${out}${eol}${eol}${newLine}${eol}`;
}

function saveRecord(store, file, payload) {
  const memDir = storeOf(store);
  const target = safeName(file);
  const full = join(memDir, target);
  if (!existsSync(full)) throw new Error(`no such memory: ${target}`);

  const raw = readFileSync(full, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const { fmRaw, body } = splitDoc(raw);
  let fm = fmRaw || '';

  if (typeof payload.name === 'string') fm = setFmField(fm, 'name', payload.name, null, eol);
  if (typeof payload.description === 'string') fm = setFmField(fm, 'description', payload.description, null, eol);
  if (typeof payload.type === 'string' && payload.type) fm = setFmField(fm, 'type', payload.type, 'metadata', eol);
  // A record that has been edited now has a real, declared date. Stamp it.
  fm = setFmField(fm, 'modified', new Date().toISOString().slice(0, 10), null, eol);

  // The textarea normalizes to LF; restore the file's own endings on the way back in.
  const newBody = (typeof payload.body === 'string' ? payload.body : body).replace(/\r?\n/g, eol);
  const fileText = `---${eol}${fm.replace(/^(\r?\n)+|(\r?\n)+$/g, '')}${eol}---${eol}${eol}${newBody.replace(/^(\r?\n)+/, '').replace(/(\r?\n)*$/, eol)}`;

  const idx = readIndex(memDir);
  let indexText = idx.text;
  if (typeof payload.indexTitle === 'string' || typeof payload.indexHook === 'string') {
    const line = indexLineFor(
      payload.indexTitle || payload.name || target.replace(/\.md$/, ''),
      target,
      payload.indexHook || '',
    );
    indexText = replaceIndexLine(indexText, target, line);
  }

  writeFileSync(full, fileText, 'utf8');
  if (indexText !== idx.text) writeFileSync(idx.path, indexText, 'utf8');

  ops.push({ op: 'edited', store, file: target });
  return { ok: true };
}

function trashRecord(store, file) {
  const memDir = storeOf(store);
  const target = safeName(file);
  const full = join(memDir, target);
  if (!existsSync(full)) throw new Error(`no such memory: ${target}`);

  const trash = join(memDir, '.trash');
  if (!existsSync(trash)) mkdirSync(trash, { recursive: true });
  let dest = join(trash, target);
  if (existsSync(dest)) dest = join(trash, `${target.replace(/\.md$/, '')}.${Date.now()}.md`);

  const idx = readIndex(memDir);
  const indexText = replaceIndexLine(idx.text, target, null);

  renameSync(full, dest);
  if (indexText !== idx.text) writeFileSync(idx.path, indexText, 'utf8');

  ops.push({ op: 'deleted', store, file: target, note: `moved to .trash/${basename(dest)}` });
  return { ok: true };
}

// Reconciliation fixes are one-click but never automatic — the user rules on each.
function fixIndex(store, action, payload) {
  const memDir = storeOf(store);
  const idx = readIndex(memDir);
  let text = idx.text;

  if (action === 'drop-orphan') {
    // Text-only edit: the target never touches the filesystem, and an orphan line may
    // legitimately point somewhere safeName would reject (`notes/foo.md`). No path check.
    const target = String(payload.target || '');
    if (!target) throw new Error('missing target');
    text = replaceIndexLine(text, target, null);
    ops.push({ op: 'index fixed', store, file: target, note: 'removed orphan index line' });
  } else if (action === 'drop-duplicate') {
    // Keep the first line — the one save maintains — and remove the rest.
    const target = String(payload.target || '');
    if (!target) throw new Error('missing target');
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const { entries, lines } = parseIndex(text);
    const hits = entries.filter((x) => x.target === target);
    if (hits.length < 2) throw new Error(`no duplicate lines for: ${target}`);
    for (let k = hits.length - 1; k >= 1; k--) lines.splice(hits[k].lineNo, 1);
    text = lines.join(eol);
    ops.push({ op: 'index fixed', store, file: target, note: `removed ${hits.length - 1} duplicate index line(s)` });
  } else if (action === 'add-index') {
    const target = safeName(payload.target);
    const title = (typeof payload.title === 'string' && payload.title) ? payload.title : target.replace(/\.md$/, '');
    text = replaceIndexLine(text, target, indexLineFor(title, target, payload.hook || ''));
    ops.push({ op: 'index fixed', store, file: target, note: 'added missing index line' });
  } else if (action === 'align-name') {
    // Filename is the index link target, so the frontmatter name yields to it.
    const target = safeName(payload.target);
    const full = join(memDir, target);
    const raw = readFileSync(full, 'utf8');
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    const { fmRaw, body } = splitDoc(raw);
    const fm = setFmField(fmRaw || '', 'name', target.replace(/\.md$/, ''), null, eol);
    writeFileSync(full, `---${eol}${fm.replace(/^(\r?\n)+|(\r?\n)+$/g, '')}${eol}---${eol}${eol}${body.replace(/^(\r?\n)+/, '')}`, 'utf8');
    ops.push({ op: 'index fixed', store, file: target, note: 'aligned name: to filename' });
    return { ok: true };
  } else {
    throw new Error(`unknown action: ${action}`);
  }

  writeFileSync(idx.path, text, 'utf8');
  return { ok: true };
}

// ---------------------------------------------------------------- whole-store actions
//
// Renaming or moving a project directory orphans its store permanently: the store keeps
// the old encoded name, the renamed project starts an empty one, and every memory inside
// becomes unreachable with nothing to say so. These two actions are the way out — send it
// to the right home, or get rid of it. Both are reversible; neither unlinks.

function trashStore(store) {
  const dir = join(ROOT, safeStore(store));
  if (!existsSync(dir)) throw new Error(`no such store: ${store}`);

  // A sibling of the stores, not inside one. The scan skips dot-entries outright,
  // so nothing under `.trash` can ever surface as a store.
  const trash = join(ROOT, '.trash');
  if (!existsSync(trash)) mkdirSync(trash, { recursive: true });
  else if (!statSync(trash).isDirectory()) throw new Error(`${trash} exists but is not a directory — move it aside first`);
  let dest = join(trash, store);
  if (existsSync(dest)) dest = `${dest}.${Date.now()}`;

  renameSync(dir, dest);
  ops.push({ op: 'store removed', store, file: '(whole store)', note: `moved to .trash/${basename(dest)}` });
  return { ok: true, trashed: basename(dest) };
}

function realpathOrNull(p) {
  try { return realpathSync.native(p); } catch { try { return realpathSync(p); } catch { return null; } }
}

// Move one memory file. On EXDEV (the store dir is a symlink or mount onto another
// filesystem) fall back to copy — and the original moves into the source's own
// .trash rather than being unlinked. Never unlink.
function moveMemoryFile(src, dest, srcMem) {
  try { renameSync(src, dest); return; } catch (e) { if (e.code !== 'EXDEV') throw e; }
  copyFileSync(src, dest, fsConstants.COPYFILE_EXCL);
  const trash = join(srcMem, '.trash');
  if (!existsSync(trash)) mkdirSync(trash, { recursive: true });
  let t = join(trash, basename(src));
  if (existsSync(t)) t = join(trash, `${basename(src).replace(/\.md$/, '')}.${Date.now()}.md`);
  renameSync(src, t);
}

function rehomeStore(store, targetPath) {
  const srcDir = join(ROOT, safeStore(store));
  const srcMem = join(srcDir, 'memory');
  if (!existsSync(srcMem)) throw new Error(`no such store: ${store}`);

  let target = String(targetPath || '').trim().replace(/\/+$/, '');
  if (!target || !target.startsWith('/')) throw new Error('target must be an absolute path');
  if (!existsSync(target) || !statSync(target).isDirectory()) throw new Error(`no such directory: ${target}`);
  // Claude Code keys a store by process.cwd(), which the OS reports symlink-resolved,
  // normalized, and in on-disk case (`/tmp/x` is really `/private/tmp/x` on macOS).
  // Encode that same physical form, or the re-homed store never loads.
  target = (realpathOrNull(target) || target).replace(/\/+$/, '');
  if (!target || target === '/') throw new Error('refusing to use the filesystem root as a project home');

  const destName = encodeSeg(target);
  const destDir = join(ROOT, destName);
  // The same place under any spelling — different case on a case-insensitive
  // filesystem, a symlink, `..` segments — must not "merge" a store into itself,
  // skip everything as collisions, and then trash it.
  if (destName === store
    || (existsSync(destDir) && realpathOrNull(destDir) === realpathOrNull(srcDir))) {
    throw new Error('this store already points there');
  }

  // Nothing there yet: the whole store just moves, index and all.
  if (!existsSync(destDir)) {
    let note = 'moved intact';
    try {
      renameSync(srcDir, destDir);
    } catch (e) {
      if (e.code !== 'EXDEV') throw e;
      cpSync(srcDir, destDir, { recursive: true, force: false, errorOnExist: true });
      note = 'copied across filesystems; original moved to .trash';
    }
    ops.push({ op: 'store re-homed', store, file: `→ ${target}`, note });
    if (note !== 'moved intact') trashStore(store);
    return { ok: true, moved: 'all', into: destName };
  }

  // The destination already has its own memories, so merge rather than overwrite:
  // carry each file that doesn't collide, along with the index line that described it.
  const destMem = join(destDir, 'memory');
  mkdirSync(destMem, { recursive: true });
  const srcEntries = parseIndex(readIndex(srcMem).text).entries;
  const idx = readIndex(destMem);
  let text = idx.text;
  const moved = [];
  const skipped = [];
  let moveErr = null;

  for (const d of readdirSync(srcMem, { withFileTypes: true })) {
    const f = d.name;
    if (!f.endsWith('.md') || f === 'MEMORY.md') continue;
    // A directory named `x.md` is not a memory; moving it would smuggle a whole tree.
    if (!d.isFile() && !d.isSymbolicLink()) continue;
    if (existsSync(join(destMem, f))) { skipped.push(f); continue; }
    try { moveMemoryFile(join(srcMem, f), join(destMem, f), srcMem); } catch (e) { moveErr = e; break; }
    moved.push(f);
  }
  // Carry only lines that exist — a file the user never indexed stays unindexed, and
  // reconciliation surfaces it at the destination for them to rule on. Index lines for
  // whatever made it across are written even when the loop died midway, so a partial
  // failure never lands moved files silently unindexed.
  for (const f of moved) {
    const e = srcEntries.find((x) => x.target === f);
    if (e) text = replaceIndexLine(text, f, e.raw.trim());
  }
  if (text !== idx.text) writeFileSync(idx.path, text, 'utf8');

  if (moveErr) {
    ops.push({
      op: 'store re-homed', store, file: `→ ${target}`,
      note: `PARTIAL: ${moved.length} moved before a failure (${moveErr.message}); source store kept`,
    });
    throw new Error(`merge incomplete: ${moved.length} memor${moved.length === 1 ? 'y' : 'ies'} moved, `
      + `then: ${moveErr.message}. The source store was kept; nothing was lost.`);
  }

  ops.push({
    op: 'store re-homed',
    store,
    file: `→ ${target}`,
    note: `merged ${moved.length} memor${moved.length === 1 ? 'y' : 'ies'}`
      + (skipped.length ? `, skipped ${skipped.length} name collision(s): ${skipped.join(', ')}` : ''),
  });
  trashStore(store);
  return { ok: true, moved, skipped, into: destName };
}

// ---------------------------------------------------------------- summary

function printSummary() {
  const counts = ops.reduce((m, o) => ({ ...m, [o.op]: (m[o.op] || 0) + 1 }), {});
  const storesTouched = new Set(ops.map((o) => o.store)).size;
  const headline = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ') || 'no changes';

  process.stdout.write('\nMEMORY_MANAGER_SUMMARY\n');
  process.stdout.write(`${headline}${storesTouched ? `, across ${storesTouched} store${storesTouched === 1 ? '' : 's'}` : ''}\n`);
  for (const o of ops) {
    const store = decodeStorePath(o.store);
    process.stdout.write(`  ${o.op.padEnd(12)} ${store.path} :: ${o.file}${o.note ? ` (${o.note})` : ''}\n`);
  }
  if (ops.length) {
    process.stdout.write('NOTE: the MEMORY.md loaded into this session is now stale. Report this summary to the user.\n');
  }
  process.stdout.write('MEMORY_MANAGER_DONE\n');
}

// ---------------------------------------------------------------- server

function send(res, code, obj) {
  try {
    const b = Buffer.from(JSON.stringify(obj));
    res.writeHead(code, { 'content-type': 'application/json', 'content-length': b.length });
    res.end(b);
  } catch { /* client went away — nothing to do */ }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    let failed = false;
    req.on('data', (c) => {
      if (failed) return;                      // stop accumulating past the cap
      s += c;
      if (s.length > 5e6) { failed = true; s = ''; }
    });
    req.on('end', () => {
      if (failed) return reject(new Error('body too large'));
      try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

let finishing = false;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const p = url.pathname;

  // Bound to loopback, but this process deletes files. Reject any request whose Host
  // isn't loopback — that closes DNS-rebinding (evil.com resolving to 127.0.0.1 would
  // otherwise read the token off `/` as a same-origin fetch).
  const host = String(req.headers.host || '').toLowerCase();
  if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host)) {
    return send(res, 403, { error: 'bad host' });
  }

  // Gate the API on a per-run token and reject cross-origin callers outright.
  if (p.startsWith('/api/')) {
    const tok = url.searchParams.get('token') || req.headers['x-mm-token'];
    if (tok !== TOKEN) return send(res, 403, { error: 'bad token' });
    const origin = req.headers.origin;
    if (origin && !/^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):/.test(origin)) {
      return send(res, 403, { error: 'bad origin' });
    }
  }

  try {
    if (p === '/' || p === '/index.html') {
      // The page embeds the token, so serving it is itself token-gated: the launcher's
      // URL carries ?token=, and nothing without it may bootstrap a session.
      if (url.searchParams.get('token') !== TOKEN) return send(res, 403, { error: 'bad token' });
      const html = readFileSync(join(HERE, 'ui.html'), 'utf8').replace('__TOKEN__', TOKEN);
      const b = Buffer.from(html);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': b.length });
      return res.end(b);
    }

    if (p === '/api/list' && req.method === 'GET') {
      return send(res, 200, { root: ROOT, stores: scan(), ops });
    }

    const rec = /^\/api\/memory\/([^/]+)\/([^/]+)$/.exec(p);
    if (rec) {
      const store = decodeURIComponent(rec[1]);
      const file = decodeURIComponent(rec[2]);
      if (req.method === 'POST') return send(res, 200, saveRecord(store, file, await readBody(req)));
      if (req.method === 'DELETE') return send(res, 200, trashRecord(store, file));
    }

    const fix = /^\/api\/index\/([^/]+)$/.exec(p);
    if (fix && req.method === 'POST') {
      const body = await readBody(req);
      return send(res, 200, fixIndex(decodeURIComponent(fix[1]), body.action, body));
    }

    const st = /^\/api\/store\/([^/]+)$/.exec(p);
    if (st && req.method === 'POST') {
      const body = await readBody(req);
      const s = decodeURIComponent(st[1]);
      if (body.action === 'trash-store') return send(res, 200, trashStore(s));
      if (body.action === 'rehome-store') return send(res, 200, rehomeStore(s, body.targetPath));
      throw new Error(`unknown action: ${body.action}`);
    }

    if (p === '/api/done' && req.method === 'POST') {
      send(res, 200, { ok: true, ops });
      if (finishing) return;
      finishing = true;
      return setTimeout(() => { printSummary(); server.close(); process.exit(0); }, 60);
    }

    return send(res, 404, { error: 'not found' });
  } catch (e) {
    return send(res, 400, { error: String(e.message || e) });
  }
});

if (IS_MAIN) {
  server.listen(Number(args.port || 0), '127.0.0.1', () => {
    const url = `http://127.0.0.1:${server.address().port}/?token=${TOKEN}`;
    process.stdout.write(`MEMORY_MANAGER_URL=${url}\n`);
    process.stdout.write(`MEMORY_MANAGER_ROOT=${ROOT}\n`);
    if (SHOULD_OPEN) {
      const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      try {
        spawn(cmd, [url], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' }).unref();
      } catch { /* the URL is on stdout regardless */ }
    }
  });

  setTimeout(() => {
    process.stdout.write('\nMEMORY_MANAGER_TIMEOUT\n');
    printSummary();
    server.close();
    process.exit(3);
  }, TIMEOUT_SEC * 1000).unref();
}

// Exported for the test suite only; running as a script starts the server above.
export {
  encodeSeg, decodeStorePath, splitDoc, parseFm, setFmField, fmScalar,
  parseIndex, replaceIndexLine, indexLineFor, safeName, safeStore,
};
