#!/usr/bin/env python3
"""Render a study guide from Topic Knowledge rows.

    python3 render.py <run-id> [--minutes N] [--out PATH]

Reads  ~/.claude/study/runs/<run-id>/data/{final.jsonl,self-check.json,guide-meta.json}
Writes ~/.claude/study/runs/<run-id>/guide[-Nm].html — one self-contained file, no external
requests. Styles live in guide.css next to this script and are inlined at build time.

This is the processing layer. It never touches rows: --minutes filters what is *rendered*, and a
second rendering at a different budget costs zero agents. Schema v0.2 (`evidence`, no `summary`).

Flow: load -> filter (grades, optional time budget) -> assemble sections -> write.
"""
import argparse
import html
import json
import os
import urllib.parse
from collections import defaultdict

DEPTH_ORDER = {"orientation": 0, "operation": 1, "judgment": 2, "mechanism": 3}
SECTIONS = [
    ("fundamentals", "Fundamentals", ""),
    ("senior", "Senior edge", "decisions whose cost surfaces late"),
    ("traps", "Traps", "commonly believed and wrong"),
    ("depth", "Extra depth", "cut this first when time-boxed"),
    ("exercise", "Practice — ready-made", "verified to exist"),
    ("drill", "Practice — drills", "build these yourself"),
]
HERE = os.path.dirname(os.path.abspath(__file__))

e = lambda s: html.escape(str(s), quote=True)


# ---------------------------------------------------------------- helpers

def host(url):
    """Compact display form of a source URL: host + trailing path segment."""
    try:
        p = urllib.parse.urlparse(url)
        seg = [s for s in p.path.split("/") if s]
        tail = urllib.parse.unquote(seg[-1])[:38] if seg else ""
        bare = p.netloc.replace("www.", "")
        return f"{bare}/{tail}" if tail else bare
    except Exception:
        return url[:44]


def mins(rows):
    return sum(r.get("time_estimate_min", 0) for r in rows)


def slug(topic):
    return "".join(c if c.isalnum() else "-" for c in topic.lower())[:24].strip("-")


# ---------------------------------------------------------------- load / filter

def load_run(run_dir):
    dat = os.path.join(run_dir, "data")
    rows = [json.loads(l) for l in open(os.path.join(dat, "final.jsonl")) if l.strip()]
    checks = json.load(open(os.path.join(dat, "self-check.json")))
    meta = json.load(open(os.path.join(dat, "guide-meta.json")))
    return rows, checks, meta


def sect(live, topic, name):
    """Rows of one section of one topic, in reading order."""
    t = [r for r in live if r["topic"] == topic]
    key = lambda r: (DEPTH_ORDER.get(r["depth"], 9), r["subject"])
    if name == "fundamentals":
        return sorted([r for r in t if r["type"] == "concept"
                       and r["depth"] in ("orientation", "operation")], key=key)
    if name == "senior":
        return sorted([r for r in t if r["type"] == "concept" and r["depth"] == "judgment"], key=key)
    if name == "traps":
        return sorted([r for r in t if r["type"] == "trap"], key=key)
    if name == "depth":
        return sorted([r for r in t if r["type"] == "concept" and r["depth"] == "mechanism"], key=key)
    if name in ("exercise", "drill"):
        return sorted([r for r in t if r["type"] == name],
                      key=lambda r: r.get("time_estimate_min", 0))
    return []


def budget_filter(live, minutes):
    """Keep reading rows (concept/trap) within budget, per topic. Practice is listed, never counted.

    Traps first — cheapest per minute and the highest-yield material under time pressure — then by
    depth. Returns (kept, dropped). Nothing is hidden: the caller reports what was dropped.
    """
    kept, dropped = [], []
    for topic in dict.fromkeys(r["topic"] for r in live):
        t = [r for r in live if r["topic"] == topic]
        practice = [r for r in t if r["type"] in ("exercise", "drill")]
        reading = [r for r in t if r["type"] in ("concept", "trap")]
        reading.sort(key=lambda r: (0 if r["type"] == "trap" else 1,
                                    DEPTH_ORDER.get(r["depth"], 9),
                                    r.get("time_estimate_min", 0)))
        spent = 0
        for r in reading:
            cost = r.get("time_estimate_min", 0)
            if spent + cost <= minutes:
                kept.append(r)
                spent += cost
            else:
                dropped.append(r)
        kept.extend(practice)
    return kept, dropped


# ---------------------------------------------------------------- assemble

def item_html(r, trap=False):
    tags = [f'<span class="tag">{e(r["depth"])}</span>']
    if r.get("evidence") == "authored":
        tags.append('<span class="tag">authored</span>')
    if r.get("grade", "viable") != "viable":
        tags.append(f'<span class="tag warnt">{e(r["grade"])}</span>')
    origin = r.get("origin", "")
    if origin.startswith("http"):
        warn = "" if r.get("evidence") == "re-opened" else ' <span class="unverified">not opened</span>'
        link = f'<a href="{e(origin)}">{e(host(origin))}</a>{warn}'
    else:
        link = f'<span class="tag">{e(origin)}</span>'
    quote = f'<p class="q">{e(r["quote"])}</p>' if r.get("quote") else ""
    counter = (f'<p class="q"><em>When this does not apply:</em> {e(r["counter_case"])}</p>'
               if trap and r.get("counter_case") else "")
    return (f'    <div class="item{" trap" if trap else ""}" id="{e(r["id"])}">\n'
            f'      <h4>{e(r["subject"])}</h4>\n      <p>{e(r["description"])}</p>{quote}{counter}\n'
            f'      <div class="meta"><span class="rid">{e(r["id"])}</span>{"".join(tags)}'
            f'<span>{r.get("time_estimate_min", 0)}m</span>{link}</div>\n    </div>')


def topic_html(live, topic, scope, empty_notes, dropped, minutes):
    rows = [r for r in live if r["topic"] == topic]
    if not rows:
        return []
    sl = slug(topic)
    fund, traps = sect(live, topic, "fundamentals"), sect(live, topic, "traps")
    out = [f'<section class="topic" id="{sl}">',
           f'  <h2 class="topic-h">{e(topic)}</h2>']
    if scope:
        out.append(f'  <p class="scope">{e(scope)}</p>')
    out.append(f'  <div class="triage"><div><b>{mins(fund) + mins(traps)}m</b>'
               f'<span>minimum viable pass</span></div>'
               f'<div><b>{mins(rows)}m</b><span>full pass</span></div>'
               f'<div><b>{len(rows)}</b><span>items</span></div></div>')
    for key, title, note in SECTIONS:
        rs = sect(live, topic, key)
        if not rs:
            # An empty section under a time budget is usually *cut*, not absent —
            # never let "None found." claim otherwise.
            cut = sect(dropped, topic, key) if minutes else []
            msg = (f"Omitted, not absent: {len(cut)} item{'s' if len(cut) != 1 else ''} "
                   f"({mins(cut)}m) cut by the {minutes}-minute budget. "
                   f"They are in the full render (guide.html)."
                   if cut else empty_notes.get(f"{sl}-{key}", "None found."))
            out.append(f'  <h3 class="sec">{e(title)}</h3>\n  <p class="empty">{e(msg)}</p>')
            continue
        n = f'<span class="note">{e(note)}{" · " if note else ""}{mins(rs)}m</span>'
        out.append(f'  <h3 class="sec">{e(title)} {n}</h3>')
        out += [item_html(r, trap=(key == "traps")) for r in rs]
    out.append("</section>")
    return out


def budget_note_html(minutes, dropped):
    """The omitted-items disclosure for a time-boxed render. Load-bearing: never soften."""
    by_topic = defaultdict(list)
    for r in dropped:
        by_topic[r["topic"]].append(r)
    detail = "; ".join(f"{e(k)}: {len(v)} items, {mins(v)}m" for k, v in by_topic.items()) or "nothing"
    return (f'<p class="budget"><strong>Time-boxed rendering — {minutes} minutes per topic.</strong> '
            f'This is a filter over the full row set, not a different analysis. '
            f'Omitted: {detail}. Traps were kept first, then material by depth. '
            f'Re-render at any budget without re-running anything.</p>')


def ledger_html(rows):
    """One line per distinct source, with whether it was actually re-opened."""
    led = defaultdict(lambda: {"rows": [], "ev": set()})
    for r in rows:
        if r.get("origin", "").startswith("http"):
            led[r["origin"]]["rows"].append(r["id"])
            led[r["origin"]]["ev"].add(r.get("evidence", "?"))
    out = []
    for u in sorted(led, key=lambda u: (-len(led[u]["rows"]), u)):
        ev = led[u]["ev"]
        badge = ('<span class="verified">re-opened</span>' if ev == {"re-opened"}
                 else f'<span class="unverified">{e("/".join(sorted(ev)))}</span>')
        ids = ", ".join(led[u]["rows"][:6]) + (f" +{len(led[u]['rows']) - 6}"
                                               if len(led[u]["rows"]) > 6 else "")
        out.append(f'    <li><a href="{e(u)}">{e(host(u))}</a> {badge} '
                   f'<span class="rid">{e(ids)}</span></li>')
    return out


def build_page(run_id, minutes, rows, live, dropped, shelved, checks, meta):
    topics = list(dict.fromkeys(r["topic"] for r in rows))
    scopes = meta.get("scopes", {})
    empty_notes = meta.get("empty", {})

    body = []
    for topic in topics:
        body += topic_html(live, topic, scopes.get(topic), empty_notes, dropped, minutes)

    budget_note = budget_note_html(minutes, dropped) if minutes else ""
    navlinks = "".join(f'<a href="#{slug(t)}">{e(t[:28])}</a>' for t in topics)
    css = open(os.path.join(HERE, "guide.css"), encoding="utf-8").read()
    nl = "\n"

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(meta['title'])}</title><style>
{css}
</style></head><body><main>
<nav aria-label="Guide sections">{navlinks}<a href="#selfcheck">Self-check</a><a href="#limits">Limits</a><a href="#sources">Sources</a></nav>
<h1>{e(meta['title'])}</h1>
<p class="sub">{e(meta['sub'])}</p>
{budget_note}
{nl.join(body)}

<section id="selfcheck">
<h2 class="topic-h">Self-check</h2>
<p class="scope">Answer out loud before opening the answers. A question you can only recognize, not produce, is not learned.</p>
<ol class="checks">
{nl.join(f'    <li>{e(q["q"])} <span class="rid">{e(q.get("ref", ""))}</span></li>' for q in checks)}
</ol>
<details><summary>Answers</summary><ol class="checks">
{nl.join(f'    <li>{e(q["a"])}</li>' for q in checks)}
</ol></details>
</section>

<section id="limits">
<h2 class="topic-h">Honest limits</h2>
<div class="limits">
{meta['limits']}
</div>
</section>

<section id="sources">
<h2 class="topic-h">Sources</h2>
<p class="scope">Every distinct source, with whether it was actually opened and checked against the claim citing it.</p>
<ul class="ledger">
{nl.join(ledger_html(rows))}
</ul>
<details><summary>Killed and merged rows ({len(shelved)}) — preserved, not deleted</summary><ul class="ledger">
{nl.join(f'    <li><span class="rid">{e(r["id"])}</span> {e(r["subject"])} — {e(r["description"][:200])}</li>' for r in shelved) or "    <li>None.</li>"}
</ul></details>
</section>

<footer>Run <code>{e(run_id)}</code> · schema v{e(rows[0].get('schema_version', '?'))} · {len(live)} of {len(rows)} rows rendered{f" · {minutes}m budget" if minutes else ""} · generated by the <code>study</code> skill.</footer>
</main></body></html>
"""


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("run_id")
    ap.add_argument("--minutes", type=int, default=0, help="per-topic reading budget; 0 = everything")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()

    run_dir = os.path.expanduser(f"~/.claude/study/runs/{a.run_id}")
    suffix = f"-{a.minutes}m" if a.minutes else ""
    out = a.out or os.path.join(run_dir, f"guide{suffix}.html")

    rows, checks, meta = load_run(run_dir)
    live = [r for r in rows if r.get("grade") not in ("killed", "merged")]
    shelved = [r for r in rows if r.get("grade") in ("killed", "merged")]
    dropped = []
    if a.minutes:
        live, dropped = budget_filter(live, a.minutes)

    page = build_page(a.run_id, a.minutes, rows, live, dropped, shelved, checks, meta)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w").write(page)

    print(f"rendered {len(live)} of {len(rows)} rows" + (f", omitted {len(dropped)}" if dropped else ""))
    for t in dict.fromkeys(r["topic"] for r in rows):
        topic_rows = [r for r in live if r["topic"] == t]
        if topic_rows:
            fund, traps = sect(live, t, "fundamentals"), sect(live, t, "traps")
            print(f"  {t[:40]}: min-viable {mins(fund) + mins(traps)}m / "
                  f"full {mins(topic_rows)}m / {len(topic_rows)} items")
    print("written:", out)


if __name__ == "__main__":
    main()
