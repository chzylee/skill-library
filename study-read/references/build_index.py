#!/usr/bin/env python3
"""Build the study library — one page to read everything in the store.

    python3 build_index.py [--root ~/.claude/study] [--open]

Layout it expects:
    <root>/*.md                     cross-run reports, visible at root
    <root>/data/rows.jsonl          append-only store
    <root>/runs/<id>/guide*.html    per-run guides
    <root>/runs/<id>/*.md           per-run reports
    <root>/runs/<id>/data/*.jsonl   per-run data

Writes <root>/index.html: a sidebar of every readable document, a reading pane that renders
markdown inline (index.js) and loads guides in a frame, and search across every row of every run.
The page is assembled from index.css and index.js, which sit next to this script and are inlined
at build time — the output stays one self-contained file, no server, no external requests.

Flow: load (discover documents, rows, runs) -> assemble (inline assets + data) -> write.
"""
import argparse
import datetime
import glob
import json
import os
import re
import subprocess
import sys

DEPTHS = ["orientation", "operation", "judgment", "mechanism"]
TYPES = ["concept", "trap", "exercise", "drill"]
EVIDENCE = ["re-opened", "asserted", "authored"]
EMBED_CAP = 2_000_000  # total markdown bytes embedded before we start linking instead

HERE = os.path.dirname(os.path.abspath(__file__))


# ---------------------------------------------------------------- load

def normalize(row):
    """v0.1/v0.2/v0.3 rows coexist in the store; present them uniformly."""
    ev = row.get("evidence") or {"re-opened": "re-opened", "asserted-only": "asserted",
                                 "none": "authored"}.get(row.get("source_status", ""), "asserted")
    return {"id": row.get("id", ""), "run": row.get("run", ""), "topic": row.get("topic", ""),
            "subject": row.get("subject", ""), "type": row.get("type", "concept"),
            "d": (row.get("description") or "")[:300], "ev": ev,
            "depth": row.get("depth", ""), "t": row.get("time_estimate_min", 0),
            "grade": row.get("grade", "viable"), "sv": row.get("schema_version", "?")}


def label_for(filename):
    """'COMPARISON-v02-v03-2026-08-07.md' -> 'Comparison v02 v03 — 2026-08-07'."""
    stem = filename.rsplit(".", 1)[0]
    date = ""
    m = re.search(r"[-_](\d{4}-\d{2}-\d{2})$", stem)
    if m:
        date, stem = m.group(1), stem[:m.start()]
    label = (stem.replace("-", " ").replace("_", " ")
             .replace("COMPARISON", "Comparison").replace("HANDOFF", "Handoff").strip())
    return f"{label} — {date}" if date else label


def group_label(topics, run_id, taken):
    """Group heading for a run's documents; disambiguated by the run-id tokens
    (e.g. 'v02') that the topic name and date do not already carry."""
    base = " · ".join(topics)[:46]
    if base not in taken:
        return base
    seen = set(re.split(r"[^a-z0-9]+", " ".join(topics).lower()))
    extra = [tok for tok in run_id.split("-")
             if tok.lower() not in seen and not re.fullmatch(r"\d{2,4}", tok)]
    suffix = "-".join(extra) or run_id[-10:]
    return f"{base} ({suffix})"


def load_library(root):
    """Walk the store; return (docs, groups, rows, runs, linked_only)."""
    docs, groups, rows, runs = [], [], [], []
    linked_only = []
    embedded = 0

    def add_md(path, group):
        nonlocal embedded
        try:
            raw = open(path, encoding="utf-8").read()
        except Exception:
            return
        kind, body = "md", raw
        if embedded + len(raw) > EMBED_CAP:
            linked_only.append(os.path.relpath(path, root))
            kind, body = "link", ""
        else:
            embedded += len(raw)
        docs.append({"i": len(docs), "g": group, "kind": kind,
                     "label": label_for(os.path.basename(path)),
                     "path": os.path.relpath(path, root), "body": body})

    # cross-run reports at root
    root_md = sorted(glob.glob(os.path.join(root, "*.md")))
    if root_md:
        groups.append("Library")
        for f in root_md:
            add_md(f, "Library")

    # per-run guides, reports, and rows
    for run_dir in sorted(glob.glob(os.path.join(root, "runs", "*")), reverse=True):
        if not os.path.isdir(run_dir):
            continue
        run_id = os.path.basename(run_dir)
        final = os.path.join(run_dir, "data", "final.jsonl")
        run_rows = ([normalize(json.loads(l)) for l in open(final) if l.strip()]
                    if os.path.exists(final) else [])
        rows += run_rows

        live = [r for r in run_rows if r["grade"] not in ("killed", "merged")]
        reading = [r for r in live if r["type"] in ("concept", "trap")]
        topics = list(dict.fromkeys(r["topic"] for r in run_rows)) or [run_id]
        group = group_label(topics, run_id, groups)
        groups.append(group)

        for g in sorted(glob.glob(os.path.join(run_dir, "guide*.html"))):
            base = os.path.basename(g)[:-5]
            docs.append({"i": len(docs), "g": group,
                         "label": "Guide" if base == "guide" else f"Guide — {base[6:]}",
                         "kind": "html", "path": os.path.relpath(g, root), "body": ""})
        for f in sorted(glob.glob(os.path.join(run_dir, "*.md"))):
            add_md(f, group)

        guide = os.path.join(run_dir, "guide.html")
        runs.append({"id": run_id, "g": group, "topics": topics,
                     "n": len(live), "total": len(run_rows),
                     "mins": sum(r["t"] for r in reading),
                     "date": max((json.loads(l).get("populated_at") or "")
                                 for l in open(final)) if run_rows else "—",
                     "sv": run_rows[0]["sv"] if run_rows else "?",
                     "wounded": sum(1 for r in run_rows if r["grade"] == "wounded"),
                     "shelved": sum(1 for r in run_rows if r["grade"] in ("killed", "merged")),
                     "unver": sum(1 for r in live if r["ev"] == "asserted"),
                     "guide": os.path.relpath(guide, root) if os.path.exists(guide) else ""})

    return docs, groups, rows, runs, linked_only


# ------------------------------------------------------------ assemble

def asset(name):
    return open(os.path.join(HERE, name), encoding="utf-8").read()


def build_page(docs, groups, rows, runs, linked_only):
    def jsdata(obj):
        # `</` would end the surrounding <script> tag if a body contains it.
        return (json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
                .replace("</", "<\\/"))

    data = {
        "docs": docs, "rows": rows, "runs": runs, "groups": groups,
        "filters": {"type": TYPES, "depth": DEPTHS, "ev": EVIDENCE},
        "built": datetime.date.today().isoformat(),
        "capNote": (f"{len(linked_only)} document(s) exceeded the embed cap and are "
                    f"linked rather than inlined: {', '.join(linked_only)}."
                    if linked_only else ""),
    }
    n_runs, n_rows, n_docs = len(runs), len(rows), len(docs)
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Study library</title>
<style>
{asset("index.css")}
</style></head><body><div class="wrap">
<aside>
  <h1>Study library</h1>
  <p class="sub">{n_runs} run{"s" if n_runs != 1 else ""} · {n_rows} rows · {n_docs} documents</p>
  <nav aria-label="Documents">
    <button class="dl" id="home" aria-current="true">Overview &amp; search</button>
    <div id="nav"></div>
  </nav>
</aside>
<main id="main"></main></div>
<script>window.STUDY_DATA={jsdata(data)}</script>
<script>
{asset("index.js")}
</script></body></html>
"""


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="~/.claude/study")
    ap.add_argument("--open", action="store_true")
    a = ap.parse_args()
    root = os.path.expanduser(a.root)
    out = os.path.join(root, "index.html")

    docs, groups, rows, runs, linked_only = load_library(root)
    if not docs:
        print(f"Nothing found under {root}. Run /study on a topic first.")
        sys.exit(1)

    open(out, "w").write(build_page(docs, groups, rows, runs, linked_only))

    print(f"{len(runs)} run(s), {len(rows)} rows, {len(docs)} documents -> {out}")
    for r in runs:
        print(f"  {r['date']}  {r['n']:>4} items  {r['mins']:>4}m  {' · '.join(r['topics'])[:50]}")
    if linked_only:
        print(f"  NOT embedded (over cap): {', '.join(linked_only)}")
    if a.open:
        subprocess.run(["open" if sys.platform == "darwin" else "xdg-open", out], check=False)


if __name__ == "__main__":
    main()
