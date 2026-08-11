#!/usr/bin/env python3
"""Build the self-contained Life Ledger viewer from a subject's JSONL store.

Usage: python3 build_viewer.py [subject]   (default: first subject found)
Writes ~/.claude/life-ledger/viewer/index.html
"""
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path.home() / ".claude" / "life-ledger"


def load_current(path: Path):
    """Last line per id wins; retired rows dropped."""
    rows = {}
    if not path.exists():
        return []
    with path.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            rows[row["id"]] = row
    return [r for r in rows.values() if not r.get("retired")]


def main():
    subjects_dir = ROOT / "subjects"
    subjects = sorted(p.name for p in subjects_dir.iterdir() if p.is_dir()) if subjects_dir.exists() else []
    if not subjects:
        sys.exit("no subjects found under " + str(subjects_dir))
    subject = sys.argv[1] if len(sys.argv) > 1 else subjects[0]
    sdir = subjects_dir / subject

    facts = load_current(sdir / "facts.jsonl")
    patterns = load_current(sdir / "patterns.jsonl")

    # computed: reach per pattern = distinct domains across evidence facts
    fact_by_id = {f["id"]: f for f in facts}
    for p in patterns:
        domains = set()
        for fid in p.get("evidence", []):
            for d in fact_by_id.get(fid, {}).get("domains", []):
                domains.add(d)
        p["reach"] = len(domains)

    data = json.dumps({"subject": subject, "built": date.today().isoformat(),
                       "facts": facts, "patterns": patterns}, ensure_ascii=False)

    html = VIEWER_TEMPLATE.replace("/*__DATA__*/null", data)
    out = ROOT / "viewer" / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"viewer: {out}  ({len(facts)} facts, {len(patterns)} patterns)")


VIEWER_TEMPLATE = r"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Life Ledger</title>
<style>
:root{--bg:#fbfaf7;--fg:#1d1c1a;--mut:#6f6a61;--card:#fff;--line:#e5e1d8;--acc:#7a5d3f;--chip:#f0ece3;--claim:#3d6b4f}
@media(prefers-color-scheme:dark){:root{--bg:#171614;--fg:#e8e5df;--mut:#95908a;--card:#201f1c;--line:#33312c;--acc:#c9a97f;--chip:#2b2925;--claim:#8fc2a4}}
*{box-sizing:border-box;margin:0}
body{background:var(--bg);color:var(--fg);font:15px/1.55 -apple-system,'Segoe UI',sans-serif;padding:2rem 1rem 4rem;max-width:960px;margin:0 auto}
h1{font-size:1.5rem;margin-bottom:.2rem} .sub{color:var(--mut);font-size:.85rem;margin-bottom:1.4rem}
nav{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem}
nav button{border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:99px;padding:.35rem .9rem;cursor:pointer;font-size:.85rem}
nav button.on{background:var(--acc);border-color:var(--acc);color:var(--bg)}
input[type=search]{width:100%;padding:.5rem .8rem;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--fg);margin-bottom:.8rem;font-size:.9rem}
.filters{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:1.2rem}
.filters span{background:var(--chip);border-radius:99px;padding:.15rem .7rem;font-size:.78rem;cursor:pointer;border:1px solid transparent}
.filters span.on{border-color:var(--acc);color:var(--acc)}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:.8rem 1rem;margin-bottom:.6rem}
.card .meta{color:var(--mut);font-size:.76rem;margin-top:.3rem;display:flex;gap:.8rem;flex-wrap:wrap}
.card.child{margin-left:1.6rem}
.tag{display:inline-block;background:var(--chip);border-radius:4px;padding:0 .4rem;margin-right:.25rem;font-size:.74rem}
.claim{color:var(--claim);font-weight:600}
.tier-universal{color:var(--acc);font-weight:600}
.pat .ev{margin-top:.4rem;font-size:.8rem;color:var(--mut)}
.pat .ev li{margin-left:1.1rem}
.count{color:var(--mut);font-size:.8rem;margin:.6rem 0 1rem}
a{color:var(--acc)}
</style></head><body>
<h1>Life Ledger</h1><div class="sub" id="sub"></div>
<nav>
<button data-v="facts" class="on">Facts</button>
<button data-v="patterns">Patterns</button>
<button data-v="gaps">Proof gaps</button>
</nav>
<input type="search" id="q" placeholder="search statements…">
<div class="filters" id="domf"></div>
<div class="count" id="count"></div>
<div id="list"></div>
<script>
const DATA=/*__DATA__*/null;
const $=s=>document.querySelector(s);
let view='facts',qs='',domSel=new Set();
$('#sub').textContent=`subject: ${DATA.subject} · built ${DATA.built} · ${DATA.facts.length} facts · ${DATA.patterns.length} patterns`;
const doms=[...new Set(DATA.facts.flatMap(f=>f.domains||[]))].sort();
$('#domf').innerHTML=doms.map(d=>`<span data-d="${d}">${d}</span>`).join('');
$('#domf').onclick=e=>{const d=e.target.dataset.d;if(!d)return;domSel.has(d)?domSel.delete(d):domSel.add(d);e.target.classList.toggle('on');render()};
document.querySelector('nav').onclick=e=>{const v=e.target.dataset.v;if(!v)return;view=v;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));render()};
$('#q').oninput=e=>{qs=e.target.value.toLowerCase();render()};
const fmap=Object.fromEntries(DATA.facts.map(f=>[f.id,f]));
function factCard(f,child){return `<div class="card${child?' child':''}"><div>${f.statement}</div>
<div class="meta"><span class="tag">${f.type}</span><span class="tag">${f.origin}</span>
${(f.domains||[]).map(d=>`<span class="tag">${d}</span>`).join('')}
<span>${f.era||''}</span><span>${f.source}</span>${(f.artifacts&&f.artifacts.length)?'<span>📎</span>':''}</div></div>`}
function matches(f){if(qs&&!f.statement.toLowerCase().includes(qs))return false;
if(domSel.size&&![...(f.domains||[])].some(d=>domSel.has(d)))return false;return true}
function render(){let h='',n=0;
if(view==='facts'){const roots=DATA.facts.filter(f=>!f.parent),kids={};
DATA.facts.filter(f=>f.parent).forEach(f=>(kids[f.parent]=kids[f.parent]||[]).push(f));
roots.forEach(f=>{const ks=(kids[f.id]||[]).filter(matches),self=matches(f);
if(!self&&!ks.length)return;n+=self?1:0;n+=ks.length;
h+=factCard(f);ks.forEach(k=>h+=factCard(k,true))});
// orphaned children whose parent didn't render but match
}else if(view==='patterns'){DATA.patterns.forEach(p=>{
if(qs&&!(p.name+' '+p.claim).toLowerCase().includes(qs))return;n++;
h+=`<div class="card pat"><div><b>${p.name}</b>
<span class="tier-${p.tier}">· ${p.tier}</span>
${p.claimed?'<span class="claim"> · claimed</span>':''}
<span class="tag" style="float:right">reach ${p.reach}</span></div>
<div style="margin-top:.25rem">${p.claim}</div>
<div class="ev">evidence:<ul>${(p.evidence||[]).map(id=>`<li>${fmap[id]?fmap[id].statement:id}</li>`).join('')}</ul></div></div>`})
}else{DATA.facts.filter(f=>f.source==='self-reported').filter(matches).forEach(f=>{n++;h+=factCard(f)})}
$('#count').textContent=n+' shown';$('#list').innerHTML=h}
render();
</script></body></html>
"""

if __name__ == "__main__":
    main()
