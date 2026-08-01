#!/usr/bin/env node
// config-form — a generic, schema-driven configuration form.
//
// Domain-agnostic ON PURPOSE: it knows nothing about any particular skill. It renders a
// form from a schema, collects values + which tasks the user asked to run, writes the
// values to a config file, and hands the requested task ids back to the caller. Anything
// that needs credentials or tools (creating pages, registering cron) is NOT done here — the
// calling skill does that. This file is the reusable piece; the schema is what varies.
//
// Node stdlib only — no dependencies, so it can be vendored into any repo as one file.
//
// Usage:
//   node config-form.mjs --schema <path> [--values <path>] [--status <path>]
//                        --out <path> [--tasks-out <path>]
//                        [--title <str>] [--port 0] [--timeout 600] [--open]
//
// Contract (stdout markers the caller parses):
//   CONFIG_FORM_URL=<url>            printed once the server is listening
//   CONFIG_FORM_SAVED out=<p> tasks=<p>   printed after the user submits
//   CONFIG_FORM_TIMEOUT              printed if no submit before --timeout seconds

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';

// ---- args ----------------------------------------------------------------
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) {
    const key = a.slice(2);
    const next = process.argv[i + 1];
    if (next && !next.startsWith('--')) { args[key] = next; i++; } else { args[key] = true; }
  }
}
const expand = (p) => (typeof p === 'string' && p.startsWith('~') ? homedir() + p.slice(1) : p);
const readJson = (p, fallback) => { try { return JSON.parse(readFileSync(expand(p), 'utf8')); } catch { return fallback; } };

if (!args.schema || !args.out) {
  process.stderr.write('config-form: --schema and --out are required\n');
  process.exit(2);
}
const schema = readJson(args.schema, null);
if (!schema) { process.stderr.write('config-form: could not read schema\n'); process.exit(2); }
const values = readJson(args.values, {});
const status = readJson(args.status, {}); // { taskId: { done: bool, detail: str } }
const title = args.title || schema.title || 'Configuration';
const outPath = expand(args.out);
const tasksOutPath = args['tasks-out'] ? expand(args['tasks-out']) : null;
const timeoutSec = Number(args.timeout || 600);

// ---- render --------------------------------------------------------------
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const val = (k, d) => (k in values ? values[k] : (d != null ? d : ''));
const settingDefaults = {};
for (const g of (schema.groups || [])) for (const s of (g.settings || [])) settingDefaults[s.key] = s.default;

function cellHtml(c, cellVal) {
  if (c.type === 'select') {
    const cur = cellVal == null ? '' : cellVal;
    const opts = (c.options || []).map((o) => `<option ${String(o) === String(cur) ? 'selected' : ''}>${esc(o)}</option>`).join('');
    return `<select data-col="${esc(c.key)}" onchange="syncCols(this)"><option value=""></option>${opts}</select>`;
  }
  return `<input data-col="${esc(c.key)}" type="${c.type === 'url' ? 'url' : 'text'}" value="${esc(cellVal)}">`;
}

function renderSetting(s) {
  const v = val(s.key, s.default);
  const common = `data-key="${esc(s.key)}" data-type="${esc(s.type)}" id="f_${esc(s.key)}"`;
  const help = s.help ? `<div class="help">${esc(s.help)}</div>` : '';
  const req = s.required ? '<span class="req">required</span>' : '';
  let field = '';
  switch (s.type) {
    case 'number':
      field = `<input type="number" ${common} value="${esc(v)}">`; break;
    case 'toggle':
      field = `<label class="tog"><input type="checkbox" ${common} ${v ? 'checked' : ''}> ${esc(s.on || 'on')}</label>`; break;
    case 'secret':
      field = `<input type="password" ${common} value="${esc(v)}" autocomplete="off">`; break;
    case 'textarea':
      field = `<textarea ${common} rows="6">${esc(v)}</textarea>`; break;
    case 'select': {
      const opts = (s.options || []).map((o) => `<option ${String(o) === String(v) ? 'selected' : ''}>${esc(o)}</option>`).join('');
      field = `<select ${common}>${opts}</select>`; break;
    }
    case 'table': {
      const cols = s.columns || [];
      const rows = Array.isArray(v) ? v : [];
      const head = cols.map((c) => `<th>${esc(c.label || c.key)}</th>`).join('') + '<th></th>';
      const bodyRow = (row) => `<tr data-row>${cols.map((c) => `<td>${cellHtml(c, row && row[c.key])}</td>`).join('')}<td><button type="button" class="rm" onclick="rmRow(this)">×</button></td></tr>`;
      const body = (rows.length ? rows : [{}]).map(bodyRow).join('');
      field = `<div class="tbl" data-key="${esc(s.key)}" data-type="table" data-columns='${esc(JSON.stringify(cols))}'>
        <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
        <button type="button" class="add" onclick="addRow(this)">+ add row</button></div>`;
      break;
    }
    default: // text, url
      field = `<input type="${s.type === 'url' ? 'url' : 'text'}" ${common} value="${esc(v)}">`;
  }
  return `<div class="field"><label for="f_${esc(s.key)}">${esc(s.label || s.key)} ${req}</label>${field}${help}</div>`;
}

function renderTask(t) {
  const st = status[t.id] || {};
  const provides = t.provides ? ` data-provides="${esc(t.provides)}"` : '';
  const hasField = t.provides && (t.provides in settingDefaults);
  const hasVal = t.provides && String(val(t.provides, settingDefaults[t.provides]) || '') !== '';
  const done = st.done || hasVal;
  const badge = done ? '<span class="badge ok">done</span>' : '<span class="badge todo">to set up</span>';
  const opt = t.optional ? '<span class="opt">optional</span>' : '';
  const detail = st.detail ? `<div class="help">${esc(st.detail)}</div>` : '';
  const help = t.help ? `<div class="help">${esc(t.help)}</div>` : '';
  // No paired field → binary: a "set up now" checkbox until done, then nothing. Field-paired →
  // offer "create a new one instead" when done (greyed by mutual-exclusivity if the field has a value).
  let runBox = '';
  if (!done) runBox = `<label class="tog"><input type="checkbox" data-task="${esc(t.id)}"${provides} onchange="onTaskToggle(this)" checked> set up now</label>`;
  else if (hasField) runBox = `<label class="tog"><input type="checkbox" data-task="${esc(t.id)}"${provides} onchange="onTaskToggle(this)"> create a new one instead</label>`;
  return `<div class="task"><b>${esc(t.label || t.id)}</b> ${badge} ${opt}${help}${detail}${runBox}</div>`;
}

function renderGroup(g) {
  const groupTasks = g.tasks || [];
  // A task that `provides` a VISIBLE field renders right under that field (paste-a-link and
  // create-it-for-me stay together). A task that provides a config key with no field (e.g. a
  // machine-managed value that can't be pasted) still renders — at the group bottom.
  const settingKeys = new Set((g.settings || []).map((s) => s.key));
  const providedBy = {};
  for (const t of groupTasks) if (t.provides && settingKeys.has(t.provides)) providedBy[t.provides] = t;
  const inlineIds = new Set(Object.values(providedBy).map((t) => t.id));
  const settings = (g.settings || []).map((s) => {
    const inlineTask = providedBy[s.key] ? `<div class="tasks inline">${renderTask(providedBy[s.key])}</div>` : '';
    return renderSetting(s) + inlineTask;
  }).join('');
  const tasks = groupTasks.filter((t) => !inlineIds.has(t.id)).map(renderTask).join('');
  const help = g.help ? `<p class="ghelp">${esc(g.help)}</p>` : '';
  return `<section><h2>${esc(g.name)}</h2>${help}${settings}${tasks ? `<div class="tasks">${tasks}</div>` : ''}</section>`;
}

function page() {
  const groups = (schema.groups || []).map(renderGroup).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — config</title><style>
:root{color-scheme:light dark}
body{font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:720px;margin:0 auto;padding:32px 20px 80px}
h1{font-size:22px;margin:0 0 4px} .sub{color:#888;margin:0 0 24px}
section{border:1px solid #8883;border-radius:10px;padding:16px 18px;margin:0 0 18px}
h2{font-size:16px;margin:0 0 4px} .ghelp{color:#888;margin:0 0 14px;font-size:13px}
.field{margin:0 0 14px} label{display:block;font-weight:600;margin:0 0 4px}
input,select,textarea{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #8886;border-radius:7px;background:transparent;color:inherit;font:inherit}
textarea{resize:vertical;min-height:120px}
input[type=checkbox]{width:auto} .tog{font-weight:400;display:inline-flex;gap:6px;align-items:center}
.help{color:#888;font-size:12.5px;margin-top:4px} .req{color:#c66;font-size:11px;font-weight:400}
.opt{color:#888;font-size:11px;border:1px solid #8886;border-radius:4px;padding:1px 5px;margin-left:4px}
.tbl table{width:100%;border-collapse:collapse;margin-bottom:8px} .tbl th{text-align:left;font-size:12px;color:#888;padding:2px 4px}
.tbl td{padding:2px 4px} .rm{background:none;border:none;color:#c66;cursor:pointer;font-size:16px} .add{background:none;border:1px dashed #8886;border-radius:6px;padding:4px 10px;cursor:pointer;color:inherit}
.tasks{margin-top:10px;border-top:1px solid #8882;padding-top:10px} .tasks.inline{margin-top:-4px;border-top:0;padding-top:0} .task{margin:0 0 12px}
.badge{font-size:11px;border-radius:5px;padding:1px 7px;font-weight:600} .badge.ok{background:#2b8a3e22;color:#2b8a3e} .badge.todo{background:#e0793722;color:#e07937}
button.save{position:fixed;bottom:0;left:0;right:0;padding:16px;border:0;background:#2b6cb0;color:#fff;font:600 16px/1 inherit;cursor:pointer}
#done{position:fixed;inset:0;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;text-align:center;padding:20px}
#done.show{display:flex;background:#000a} #done .card{background:#111;color:#fff;border-radius:12px;padding:28px 32px;max-width:420px}
</style></head><body>
<h1>${esc(title)}</h1><p class="sub">Fill what you need, check the setup steps to run, then save. You can reopen this any time.</p>
<form id="cfg" onsubmit="return save(event)">${groups}<button type="submit" class="save">Save and close</button></form>
<div id="done"><div class="card"><h2>Saved ✓</h2><p class="help">Your configuration was saved. You can close this tab — the assistant continues automatically.</p></div></div>
<script>
function cellHtml(c,val){val=val==null?'':val;if(c.type==='select'){var opts=(c.options||[]).map(function(o){return '<option'+(String(o)===String(val)?' selected':'')+'>'+o+'</option>';}).join('');return '<select data-col="'+c.key+'" onchange="syncCols(this)"><option value=""></option>'+opts+'</select>';}return '<input data-col="'+c.key+'" type="'+(c.type==='url'?'url':'text')+'" value="'+String(val).replace(/"/g,'&quot;')+'">';}
function addRow(btn){var tbl=btn.closest('.tbl');var cols=JSON.parse(tbl.dataset.columns);var tb=tbl.querySelector('tbody');var tr=document.createElement('tr');tr.setAttribute('data-row','');tr.innerHTML=cols.map(function(c){return '<td>'+cellHtml(c)+'</td>';}).join('')+'<td><button type="button" class="rm" onclick="rmRow(this)">×</button></td>';tb.appendChild(tr);syncAll(tbl);}
function rmRow(btn){var tbl=btn.closest('.tbl');btn.closest('tr').remove();syncAll(tbl);}
function syncCols(sel){syncAll(sel.closest('.tbl'));}
function syncAll(tbl){if(!tbl)return;var selects=tbl.querySelectorAll('select[data-col]');var used={};selects.forEach(function(s){if(s.value)used[s.value]=true;});selects.forEach(function(s){Array.prototype.forEach.call(s.options,function(o){if(!o.value)return;o.disabled=(o.value!==s.value&&!!used[o.value]);});});}
function collect(){var values={},tasks=[];
document.querySelectorAll('[data-key]').forEach(function(el){if(el.dataset.type==='table')return;var k=el.dataset.key,t=el.dataset.type;if(t==='toggle')values[k]=el.checked;else if(t==='number')values[k]=el.value===''?null:Number(el.value);else values[k]=el.value;});
document.querySelectorAll('.tbl[data-type=table]').forEach(function(tbl){var k=tbl.dataset.key,cols=JSON.parse(tbl.dataset.columns),rows=[];tbl.querySelectorAll('tr[data-row]').forEach(function(tr){var row={},any=false;cols.forEach(function(c){var inp=tr.querySelector('[data-col="'+c.key+'"]');var v=inp?inp.value:'';row[c.key]=v;if(v!=='')any=true;});if(any)rows.push(row);});values[k]=rows;});
document.querySelectorAll('[data-task]').forEach(function(el){if(el.checked)tasks.push(el.dataset.task);});
return{values:values,tasks:tasks};}
function save(e){e.preventDefault();fetch('/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(collect())}).then(function(r){return r.json();}).then(function(){document.getElementById('done').classList.add('show');}).catch(function(){alert('Save failed — is the terminal process still running?');});return false;}
function onTaskToggle(cb){syncProvides();}
function syncProvides(){document.querySelectorAll('[data-task][data-provides]').forEach(function(cb){var key=cb.getAttribute('data-provides');var field=document.getElementById('f_'+key);if(!field)return;var fw=field.closest('.field'),cw=cb.closest('.task');var hasVal=(field.value||'').trim()!=='';if(hasVal){cb.checked=false;cb.disabled=true;if(cw)cw.style.opacity='0.4';}else{cb.disabled=false;if(cw)cw.style.opacity='';}field.disabled=cb.checked;if(fw)fw.style.opacity=cb.checked?'0.4':'';});}
document.querySelectorAll('.tbl').forEach(syncAll);
document.querySelectorAll('[data-task][data-provides]').forEach(function(cb){var f=document.getElementById('f_'+cb.getAttribute('data-provides'));if(f)f.addEventListener('input',syncProvides);});
syncProvides();
</script></body></html>`;
}

// ---- server --------------------------------------------------------------
function writeConfig(payload) {
  const merged = { ...values, ...(payload.values || {}) };
  writeFileSync(outPath, JSON.stringify(merged, null, 2) + '\n');
  if (tasksOutPath) writeFileSync(tasksOutPath, JSON.stringify(payload.tasks || [], null, 2) + '\n');
  return merged;
}

// Single instance: a new launch (same --lock) kills the previous form, so old tabs go stale.
if (args.lock) {
  const lockPath = expand(args.lock);
  try {
    if (existsSync(lockPath)) {
      const old = parseInt(readFileSync(lockPath, 'utf8').trim(), 10);
      if (old && old !== process.pid) { try { process.kill(old); } catch {} }
    }
  } catch {}
  try { writeFileSync(lockPath, String(process.pid)); } catch {}
  process.on('exit', () => { try { if (existsSync(lockPath) && readFileSync(lockPath, 'utf8').trim() === String(process.pid)) unlinkSync(lockPath); } catch {} });
}

const server = createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page());
    return;
  }
  if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let payload;
      try { payload = JSON.parse(body || '{}'); } catch { res.writeHead(400); res.end('{}'); return; }
      try {
        writeConfig(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        process.stdout.write(`\nCONFIG_FORM_SAVED out=${outPath}${tasksOutPath ? ` tasks=${tasksOutPath}` : ''}\n`);
        setTimeout(() => { server.close(); process.exit(0); }, 150);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(err) }));
      }
    });
    return;
  }
  res.writeHead(404); res.end('not found');
});

server.listen(Number(args.port || 0), '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}`;
  process.stdout.write(`CONFIG_FORM_URL=${url}\n`);
  if (args['url-file']) { try { writeFileSync(expand(args['url-file']), url + '\n'); } catch {} }
  if (args.open) {
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    try { spawn(cmd, [url], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' }).unref(); } catch {}
  }
});

setTimeout(() => { process.stdout.write('\nCONFIG_FORM_TIMEOUT\n'); server.close(); process.exit(3); }, timeoutSec * 1000).unref();
