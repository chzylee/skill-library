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

# Reader-facing label derived from legacy `depth`. Derived at build time, never stored:
# `depth` stays the schema's field and this is only how it is spoken to a reader.
# "edge case" has no legacy source — the tier did not exist when these rows were
# written — so it will not appear until rows are harvested under the new briefs. That
# absence is correct rather than lossy.
WHEN_LABEL = {
    "orientation": "every time",
    "operation": "every time",
    "judgment": "judgment call",
    "mechanism": "how it works",
}

HERE = os.path.dirname(os.path.abspath(__file__))


# ---------------------------------------------------------------- load

def normalize(row, chapter_of=None):
    """v0.1/v0.2/v0.3 rows coexist in the store; present them uniformly.

    This is the full row, not a search-index projection. It previously truncated
    `description` at 300 characters and dropped `origin` entirely, which was fine when
    the only consumer was a search list and fatal once the topic view renders from it:
    the reader needs the whole description and the link out.
    """
    ev = row.get("evidence") or {"re-opened": "re-opened", "asserted-only": "asserted",
                                 "none": "authored"}.get(row.get("source_status", ""), "asserted")
    rid = row.get("id", "")
    depth = row.get("depth", "")
    return {"id": rid, "run": row.get("run", ""), "topic": row.get("topic", ""),
            "subject": row.get("subject", ""), "type": row.get("type", "concept"),
            "d": row.get("description") or "",
            "quote": row.get("quote") or "",
            "origin": row.get("origin") or "",
            "ev": ev,
            "depth": depth,
            "when": WHEN_LABEL.get(depth, ""),
            "why": row.get("depth_check") or "",
            "ch": (chapter_of or {}).get(rid, ""),
            "t": row.get("time_estimate_min", 0),
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
    """Walk the store; return (docs, groups, rows, runs, chapters, linked_only, unreadable)."""
    docs, groups, rows, runs, chapters = [], [], [], [], []
    linked_only = []
    unreadable = []
    embedded = 0

    def add_md(path, group):
        nonlocal embedded
        try:
            with open(path, encoding="utf-8") as fh:
                raw = fh.read()
        except Exception as exc:
            # Hard rule 7, no silent caps: a file we could not read is named, not
            # dropped. Previously a bare `except: return` made an unreadable document
            # vanish from the library with no trace anywhere.
            unreadable.append((os.path.relpath(path, root), f"{type(exc).__name__}: {exc}"))
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

        # Chapters are optional. A run without them is a legacy run and renders flat;
        # that is a supported state, not a missing file.
        chap_path = os.path.join(run_dir, "data", "chapters.jsonl")
        run_chapters = []
        if os.path.exists(chap_path):
            try:
                with open(chap_path, encoding="utf-8") as fh:
                    run_chapters = [json.loads(l) for l in fh if l.strip()]
            except Exception as exc:
                unreadable.append((os.path.relpath(chap_path, root),
                                   f"{type(exc).__name__}: {exc}"))
        for c in run_chapters:
            c["run"] = run_id
        chapters += run_chapters
        chapter_of = {m: c.get("chapter_id", "")
                      for c in run_chapters for m in (c.get("members") or [])}

        run_rows = []
        if os.path.exists(final):
            try:
                with open(final, encoding="utf-8") as fh:
                    run_rows = [normalize(json.loads(l), chapter_of)
                                for l in fh if l.strip()]
            except Exception as exc:
                unreadable.append((os.path.relpath(final, root),
                                   f"{type(exc).__name__}: {exc}"))
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
        unver = sum(1 for r in live if r["ev"] == "asserted")
        runs.append({"id": run_id, "g": group, "topics": topics,
                     "n": len(live), "total": len(run_rows),
                     "mins": sum(r["t"] for r in reading),
                     "date": max(r.get("populated_at") or "" for r in
                                 [json.loads(l) for l in open(final)]) if run_rows else "—",
                     "sv": run_rows[0]["sv"] if run_rows else "?",
                     "wounded": sum(1 for r in run_rows if r["grade"] == "wounded"),
                     "shelved": sum(1 for r in run_rows if r["grade"] in ("killed", "merged")),
                     "unver": unver,
                     # The browse facet needs a share, not a count: 2 unverified rows
                     # means something different in a 12-row topic than a 200-row one.
                     "trust": round(1.0 - unver / len(live), 3) if live else 0.0,
                     "chapters": len(run_chapters),
                     "guide": os.path.relpath(guide, root) if os.path.exists(guide) else ""})

    return docs, groups, rows, runs, chapters, linked_only, unreadable


# ------------------------------------------------------------ assemble

def asset(name):
    """Inline a sibling asset. shared/tokens.css is optional and precedes index.css."""
    path = os.path.join(HERE, name)
    if not os.path.exists(path):
        return ""
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def gate_topics(rows, chapters):
    """Run the chapter gates per (run, topic). Returns {"run\\ttopic": {...}}.

    Keyed on run AND topic, not topic alone. Chapters are produced by one structure
    stage from one run's rows, so a chapter set is only coherent within its run. The
    same topic studied twice — as Terraform was, deliberately, as an A/B test — yields
    two independent chapter structures over two different row sets. Merging them and
    gating the union passes only when the two runs happen not to share row ids, which
    is luck rather than a property anything guarantees.

    A degraded topic renders flat under a banner. The build still succeeds — that is
    the whole reason these gates are scoped below the build.
    """
    try:
        import gates
    except ImportError:
        return {}
    live = [r for r in rows if r.get("grade") not in ("killed", "merged")]
    rows_by, chaps_by = {}, {}
    for r in live:
        rows_by.setdefault((r.get("run", ""), r["topic"]), []).append(r)
    for c in chapters:
        chaps_by.setdefault((c.get("run", ""), c.get("topic", "")), []).append(c)

    out = {}
    for key, trows in rows_by.items():
        run, topic = key
        chs = chaps_by.get(key, [])
        k = f"{run}\t{topic}"
        if not chs:
            # No chapters at all is legacy, not a failure. It predates chaptering.
            out[k] = {"run": run, "topic": topic, "state": "legacy",
                      "failures": [], "warnings": [],
                      "stats": {"live_rows": len(trows), "chapters": 0}}
            continue
        res = gates.check_topic(topic, trows, chs)
        out[k] = {"run": run, "topic": topic,
                  "state": "degraded" if res.degraded else "ok",
                  "failures": res.failures, "warnings": res.warnings,
                  "stats": res.stats}
    return out


def build_page(docs, groups, rows, runs, chapters, linked_only, unreadable, topics):
    def jsdata(obj):
        # `</` would end the surrounding <script> tag if a body contains it.
        return (json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
                .replace("</", "<\\/"))

    data = {
        "docs": docs, "rows": rows, "runs": runs, "groups": groups,
        "chapters": chapters, "topics": topics,
        "filters": {"type": TYPES, "depth": DEPTHS, "ev": EVIDENCE},
        "built": datetime.date.today().isoformat(),
        "capNote": (f"{len(linked_only)} document(s) exceeded the embed cap and are "
                    f"linked rather than inlined: {', '.join(linked_only)}."
                    if linked_only else ""),
        # Never a silent drop: whatever could not be read is carried into the page.
        "unreadable": [{"path": p, "why": w} for p, w in unreadable],
    }
    n_runs, n_rows, n_docs = len(runs), len(rows), len(docs)
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Study library</title>
<style>
{asset(os.path.join("..", "..", "shared", "tokens.css"))}
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

    docs, groups, rows, runs, chapters, linked_only, unreadable = load_library(root)
    topics = gate_topics(rows, chapters)

    # An empty store is a legal state, not an error. Previously this exited 1 without
    # writing anything, so a brand-new user's first experience of the library was a
    # console message and no file. The page itself now carries the first-run state.
    if not docs:
        print(f"Nothing found under {root} — writing an empty library.")

    with open(out, "w", encoding="utf-8") as fh:
        fh.write(build_page(docs, groups, rows, runs, chapters,
                            linked_only, unreadable, topics))

    n_ch = len(chapters)
    print(f"{len(runs)} run(s), {len(rows)} rows, {n_ch} chapters, "
          f"{len(docs)} documents -> {out}")
    for r in runs:
        ch = f"{r['chapters']:>3} ch" if r["chapters"] else "  legacy"
        print(f"  {r['date']}  {r['n']:>4} items  {r['mins']:>4}m  {ch}  "
              f"{' · '.join(r['topics'])[:44]}")

    if topics:
        print("\n  topic gates (per run + topic):")
        for k, t in sorted(topics.items()):
            s = t["stats"]
            print(f"    {t['topic'][:38]:40} {t['run'][-18:]:20} {t['state']:9}"
                  f" {s.get('chapters', 0):>2} ch / {s.get('live_rows', 0):>3} rows")
            for f in t["failures"]:
                print(f"        FAIL  {f}")
            for w in t["warnings"]:
                print(f"        warn  {w}")
        bad = [t for t in topics.values() if t["state"] == "degraded"]
        if bad:
            print(f"\n  {len(bad)} topic(s) render flat; the build still succeeded.")

    if linked_only:
        print(f"  NOT embedded (over cap): {', '.join(linked_only)}")
    if unreadable:
        print(f"\n  COULD NOT READ {len(unreadable)} file(s) — named, not dropped:")
        for p, why in unreadable:
            print(f"    {p}  ({why})")
    if a.open:
        subprocess.run(["open" if sys.platform == "darwin" else "xdg-open", out], check=False)


if __name__ == "__main__":
    main()
