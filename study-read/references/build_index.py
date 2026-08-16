#!/usr/bin/env python3
"""Build the study library — one page to read everything in the store.

    python3 build_index.py [--root ~/.claude/study] [--open]

Layout it expects:
    <root>/*.md                     cross-run reports, visible at root
    <root>/data/rows.jsonl          append-only store
    <root>/runs/<id>/*.md           per-run reports
    <root>/runs/<id>/data/*.jsonl   per-run rows, chapters, and the run's scope record

Writes <root>/index.html: a rail of every topic you have studied, a topic reading view that
renders chapters and items from data, the store's markdown reports, and search across every
row of every run. The page is assembled from index.css and index.js, which sit next to this
script and are inlined at build time — the output stays one self-contained file, no server,
no external requests.

Flow: load (documents, rows, runs, chapters, run metadata)
   -> unitize (one reading unit per run+topic, gated)
   -> assemble (inline assets + data)
   -> write.
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

# Reader-facing label for `evidence`, and it must match the source-state badge the
# topic view draws (`source checked` / `not opened` / `authored`). The search chips
# and hit tags used to show the raw enum — `re-opened`, `asserted` — so the same fact
# wore two names on one page, and the name on the filter was pipeline vocabulary a
# stranger has no way to parse. The enum stays the stored value and the filter key;
# this is only how it is spoken, same contract as WHEN_LABEL above.
EV_LABEL = {"re-opened": "source checked", "asserted": "not opened", "authored": "authored"}

# Reader-facing label for `depth`, on the same contract: the enum stays the stored value
# and the filter key, this is only how the facet speaks. `orientation`/`operation`/
# `judgment`/`mechanism` are the harvest brief's vocabulary and mean nothing to someone
# who landed on this page.
#
# These name the KIND of understanding, never a level. That distinction is load-bearing:
# DESIGN §9 cites the evidence against reading a taxonomy as a sequence, and the harvest
# brief says in as many words "do not assign by how advanced the item sounds" — a tier
# comes from a failure signature visible in the source. Read in store order these do run
# from plain to deep, which is what makes the facet legible, but no label claims a
# difficulty, a prerequisite, or a reading order. Reading order lives in chapters.
#
# Two of the four are the words the row's own badge uses. The other two are the pair
# WHEN_LABEL collapses into "every time" — the facet can separate them and the badge
# cannot, which is a real difference between the two questions rather than a second
# vocabulary for one fact.
DEPTH_LABEL = {
    "orientation": "what it is",
    "operation": "using it",
    "judgment": "judgment call",
    "mechanism": "how it works",
}

HERE = os.path.dirname(os.path.abspath(__file__))
# The skill is commonly installed as a symlink into ~/.claude/skills, so the sibling
# assets sit next to the REAL file while `__file__` reports the link. Both roots are
# searched: the link's directory first (a copied install has only that), then the
# resolved one (a symlinked install finds shared/tokens.css back in the repo).
ROOTS = list(dict.fromkeys([HERE, os.path.dirname(os.path.realpath(__file__))]))
TOKENS = os.path.join("..", "..", "shared", "tokens.css")


# ---------------------------------------------------------------- load

# Pipeline bookkeeping that stage 3 wrote into the reader's prose. 35 live descriptions
# end in a bracketed verdict — `[AUDIT viable->wounded: …]`, `[ABSENCE: …]`, `[VERIFY: …]`
# — and one opens with `[MERGED FROM A-040]`. Every one of those verdicts is ALSO in the
# run's `audit-verdicts.jsonl`, so the append was a duplicate as well as a defect.
#
# Split here rather than in the renderer so it is testable without a browser, and because
# `normalize()` is already where schema variation between v0.1/v0.2/v0.3 rows is absorbed.
# Nothing is rewritten on disk: `rows.jsonl` is append-only and untouched, and both halves
# ship to the page. The note is reachable one expansion in, per DESIGN §2.
LEDGER_RE = re.compile(r"\[(AUDIT|VERIFY|ABSENCE|MERGE[A-Z]*)\b\s*:?\s*")


def split_ledger(text):
    """('reader prose', 'AUDIT', 'the verdict text') — or (text, '', '') if there is none.

    Every block in the store either runs to the end of the description or closes at the
    first `]`. The terminal reading is only taken when the text actually ends there, so a
    leading `[MERGED FROM X] prose…` keeps its prose instead of swallowing it.
    """
    text = text or ""
    m = LEDGER_RE.search(text)
    if not m:
        return text, "", ""
    body_at = m.end()
    stripped = text.rstrip()
    if stripped.endswith("]"):
        end = len(stripped) - 1
    else:
        rel = text.find("]", body_at)
        if rel < 0:
            return text, "", ""          # unbalanced: leave the row exactly as written
        end = rel
    if end <= m.start():
        return text, "", ""
    note = text[body_at:end].strip()
    prose = " ".join((text[:m.start()] + " " + text[end + 1:]).split())
    return prose, m.group(1), note


# Reflowing a description into paragraphs. Not one word is changed and no sentence is
# ever broken — this only decides where a paragraph ends.
#
# Zero of 230 stored descriptions contain a single line break, and 53 render as 13 or more
# unbroken lines, the longest at 35. A wall that size is the difference between a page
# somebody reads and a page somebody bounces off, and it is purely typographic: the
# harvest wrote one paragraph because nothing ever told it not to (the spec now does).
#
# A paragraph break asserts only "these sentences group", which is why the rule closes a
# paragraph at a sentence boundary and never inside one. Where a single sentence runs 835
# characters — one does — nothing here helps, and that is the honest limit rather than a
# reason to cut mid-sentence.
PARA_TARGET = 350        # close a paragraph once it has reached about this much
PARA_MIN_TOTAL = 700     # below this a single paragraph is ~10 lines and reads fine
PARA_ORPHAN = 120        # a shorter tail joins the paragraph above instead of dangling

# Periods that do not end a sentence. `max.poll.interval.ms` is safe without listing —
# the split requires whitespace after the period — but "e.g. when" is not.
ABBREV = {"e.g", "i.e", "vs", "cf", "etc", "al", "fig", "approx", "ca", "no"}
# The closing quote or bracket is part of the sentence, not part of the separator. A
# lookbehind that matched only the period silently ate it — 25 of 230 real descriptions
# lost a character that way, none of them in the synthetic fixtures.
_SPLIT_AT = re.compile(r'[.!?]["\'’”)\]]?\s+')


def _sentences(text):
    """Split on sentence boundaries, skipping abbreviations and initials."""
    out, start = [], 0
    for m in _SPLIT_AT.finditer(text):
        head = text[start:m.end()].strip()          # punctuation and closer included
        word = re.split(r"[\s(]", text[start:m.start()])[-1].lower().rstrip(".")
        nxt = text[m.end():m.end() + 1]
        # A real boundary: not an abbreviation, not an initial, and what follows opens
        # like a new sentence rather than continuing the old one.
        if word in ABBREV or len(word) == 1:
            continue
        if nxt and not (nxt.isupper() or nxt.isdigit() or nxt in "\"'“("):
            continue
        out.append(head)
        start = m.end()
    tail = text[start:].strip()
    if tail:
        out.append(tail)
    return [s for s in out if s]


def paragraphs(text):
    """['para', 'para', ...]. Always non-empty; joining with ' ' restores the input."""
    text = (text or "").strip()
    if not text:
        return [""]
    if len(text) <= PARA_MIN_TOTAL:
        return [text]
    sents = _sentences(text)
    if len(sents) < 2:
        return [text]                    # one enormous sentence stays one paragraph
    out, cur = [], ""
    for s in sents:
        cur = f"{cur} {s}" if cur else s
        if len(cur) >= PARA_TARGET:
            out.append(cur)
            cur = ""
    if cur:
        if out and len(cur) < PARA_ORPHAN:
            out[-1] += " " + cur
        else:
            out.append(cur)
    return out or [text]


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
    prose, note_tag, note = split_ledger(row.get("description") or "")
    return {"id": rid, "run": row.get("run", ""), "topic": row.get("topic", ""),
            "subject": row.get("subject", ""), "type": row.get("type", "concept"),
            # A LIST of paragraphs, not a string. Joining with a space restores the
            # stored text exactly; nothing is added, removed, or reordered.
            "d": paragraphs(prose),
            "note": note, "noteTag": note_tag,
            "quote": row.get("quote") or "",
            "origin": row.get("origin") or "",
            "ev": ev,
            "depth": depth,
            "when": WHEN_LABEL.get(depth, ""),
            "why": row.get("depth_check") or "",
            "ch": (chapter_of or {}).get(rid, ""),
            "at": row.get("populated_at") or "",
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


def slugify(s):
    """Stable, readable URL fragment. Used for topic and unit anchors."""
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", (s or "").lower())).strip("-") or "topic"


def run_tag(topic, run_id):
    """The token in a run id that the topic name and the date do not already carry.

    'terraform-team-scale-v02-2026-08-07' under topic 'Terraform at team scale' -> 'v02'.
    Only used to disambiguate a topic studied more than once; a topic with one run never
    shows a tag.
    """
    seen = set(re.split(r"[^a-z0-9]+", (topic or "").lower()))
    extra = [t for t in run_id.split("-")
             if t.lower() not in seen and not re.fullmatch(r"\d{2,4}", t)]
    return "-".join(extra) or run_id[-10:]


def load_library(root):
    """Walk the store; return (docs, groups, rows, runs, chapters, metas, linked_only,
    unreadable, notices, embedded).

    Two disclosure channels, kept apart because they mean different things: `unreadable`
    is a file the build could not read, `notices` is something the build noticed and
    worked around. Filing the second under the first would misreport it.
    """
    docs, groups, rows, runs, chapters = [], [], [], [], []
    metas = {}
    linked_only = []
    unreadable = []
    notices = []
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

    # per-run reports, rows, and chapters
    for run_dir in sorted(glob.glob(os.path.join(root, "runs", "*")), reverse=True):
        if not os.path.isdir(run_dir):
            continue
        run_id = os.path.basename(run_dir)
        final = os.path.join(run_dir, "data", "final.jsonl")

        # The run's own scope record. `scopes[topic]` is the boundary line the topic page
        # prints under its title; runs that predate it fall back to `sub`. Optional, and
        # an unreadable one is named rather than swallowed.
        meta_path = os.path.join(run_dir, "data", "guide-meta.json")
        meta = None
        if os.path.exists(meta_path):
            try:
                with open(meta_path, encoding="utf-8") as fh:
                    meta = json.load(fh)
            except Exception as exc:
                unreadable.append((os.path.relpath(meta_path, root),
                                   f"{type(exc).__name__}: {exc}"))

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
        raw_rows = []
        if os.path.exists(final):
            try:
                with open(final, encoding="utf-8") as fh:
                    raw_rows = [json.loads(l) for l in fh if l.strip()]
            except Exception as exc:
                unreadable.append((os.path.relpath(final, root),
                                   f"{type(exc).__name__}: {exc}"))

        # Chapters have no run field of their own, so one is attached here — and it has to
        # be the value the ROWS carry, not the directory name. Gating keys on (run, topic)
        # from both sides, so if a run directory is ever renamed or copied the two keys
        # stop matching and every chaptered topic in it silently reports as legacy. Rows
        # are the authority; a disagreement is named rather than absorbed.
        row_run = next((r.get("run") for r in raw_rows if r.get("run")), run_id)
        if row_run != run_id:
            notices.append((os.path.relpath(run_dir, root),
                            f"rows here declare run {row_run!r}, not the directory name "
                            f"{run_id!r}. Chapters were keyed to the rows, which are the "
                            f"authority; the directory was probably renamed or copied."))
        for c in run_chapters:
            c["run"] = row_run
        chapters += run_chapters
        if meta is not None:
            metas[row_run] = meta          # keyed the same way units look it up
        chapter_of = {m: c.get("chapter_id", "")
                      for c in run_chapters for m in (c.get("members") or [])}

        run_rows = [normalize(r, chapter_of) for r in raw_rows]
        rows += run_rows

        live = [r for r in run_rows if r["grade"] not in ("killed", "merged")]
        reading = [r for r in live if r["type"] in ("concept", "trap")]
        topics = list(dict.fromkeys(r["topic"] for r in run_rows)) or [run_id]
        group = group_label(topics, run_id, groups)
        groups.append(group)

        # Per-run guide*.html files are NOT listed. The separately rendered guide is
        # superseded by the topic view, which draws the same rows from the same store
        # with chapters the guide never had. The files stay on disk — they are past
        # build artifacts, not data — they just no longer have a door in the library.
        for f in sorted(glob.glob(os.path.join(run_dir, "*.md"))):
            add_md(f, group)

        unver = sum(1 for r in live if r["ev"] == "asserted")
        runs.append({"id": run_id, "g": group, "topics": topics,
                     "n": len(live), "total": len(run_rows),
                     "mins": sum(r["t"] for r in reading),
                     "date": max(r["at"] for r in run_rows) if run_rows else "—",
                     "sv": run_rows[0]["sv"] if run_rows else "?",
                     "wounded": sum(1 for r in run_rows if r["grade"] == "wounded"),
                     "shelved": sum(1 for r in run_rows if r["grade"] in ("killed", "merged")),
                     "unver": unver,
                     # The browse facet needs a share, not a count: 2 unverified rows
                     # means something different in a 12-row topic than a 200-row one.
                     "trust": round(1.0 - unver / len(live), 3) if live else 0.0,
                     "chapters": len(run_chapters)})

    return (docs, groups, rows, runs, chapters, metas,
            linked_only, unreadable, notices, embedded)


# ------------------------------------------------------------ assemble

def asset(name):
    """Inline a sibling asset, or fail the build naming what is missing.

    This used to return "" for a missing file. `shared/tokens.css` is untracked-prone and
    carries every colour in the page, so a fresh clone silently built an unstyled library
    and nothing said so. A stylesheet the page cannot render without is a build input, not
    an optional extra: absence is an error.
    """
    tried = [os.path.join(r, name) for r in ROOTS]
    path = next((p for p in tried if os.path.exists(p)), None)
    if path is None:
        raise SystemExit(
            "build_index.py: required asset missing: " + name + "\n  Looked in:\n"
            + "".join(f"    {p}\n" for p in tried)
            + "  The page cannot be built without it. It ships beside this script in the\n"
              "  repo (shared/tokens.css lives at the repo root); restore it and build again.")
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    # A <style> or <script> element ends at the first literal "</style" / "</script"
    # in its text — inside a comment or a string just as much as in live code. A
    # documentation comment in shared/tokens.css spelled one out and silently
    # truncated the stylesheet of every page that inlined it. Neutralised here so
    # no asset can do that again; the backslash is inert in both languages.
    return (re.sub(r"</(?=style)", r"<\\/", text, flags=re.I)
            if name.endswith(".css")
            else re.sub(r"</(?=script)", r"<\\/", text, flags=re.I))


def unit_tiers(urows):
    """Reader-facing `when` composition for one unit, plus what its schema could not say.

    `edge case` has no legacy source — the tier did not exist when these rows were
    written — so it is reported as absent-by-schema rather than counted as an empty tier
    the run failed to fill. Calling it empty would flag every legacy topic for a gap that
    is a property of the schema, not of the research.
    """
    counts = {}
    for r in urows:
        label = r["when"] or "unclassified"
        counts[label] = counts.get(label, 0) + 1
    reachable = list(dict.fromkeys(WHEN_LABEL.values()))
    tiers = [{"label": lb, "n": counts.get(lb, 0)} for lb in reachable]
    if counts.get("unclassified"):
        tiers.append({"label": "unclassified", "n": counts["unclassified"]})
    absent = [lb for lb in ("edge case",) if lb not in reachable]
    return tiers, absent


def build_units(rows, chapters, topic_gates, metas):
    """One reading unit per (run, topic) — the same key the gates use.

    A unit, not a topic, is what has chapters: chapters come from one structure stage over
    one run's rows, so two runs of the same topic are two independent structures over two
    different row sets. Topics are the index; a topic that was studied twice lists both of
    its units and opens the newest.
    """
    live = [r for r in rows if r["grade"] not in ("killed", "merged")]
    by_key = {}
    for r in live:
        by_key.setdefault((r["run"], r["topic"]), []).append(r)

    chaps_by = {}
    for c in chapters:
        chaps_by.setdefault((c.get("run", ""), c.get("topic", "")), []).append(c)

    # A topic name is the index entry; the units under it are its runs.
    runs_per_topic = {}
    for run, topic in by_key:
        runs_per_topic.setdefault(topic, []).append(run)

    units = []
    for (run, topic), urows in by_key.items():
        gate = topic_gates.get(f"{run}\t{topic}", {})
        meta = metas.get(run, {})
        boundary = (meta.get("scopes") or {}).get(topic) or ""
        if not boundary and len(set(r["topic"] for r in rows if r["run"] == run)) == 1:
            # A single-topic run's `sub` describes that topic; a multi-topic run's does
            # not, so it is only borrowed when it can only mean this topic.
            boundary = meta.get("sub") or ""

        chs = sorted(chaps_by.get((run, topic), []), key=lambda c: c.get("order", 0))
        state = gate.get("state", "legacy")
        by_id = {r["id"]: r for r in urows}
        out_chs = []
        for c in chs:
            members = [m for m in (c.get("members") or []) if m in by_id]
            # Per-member editorial notes, optional. They live on the CHAPTER rather than
            # on the row for three reasons: `rows.jsonl` is append-only and cannot be
            # backfilled, `chapters.jsonl` is safe to regenerate, and the note is a
            # property of the (chapter, row) pairing rather than of the row — a re-run
            # that groups differently needs a different note, so storing it on the row
            # would be wrong even if the store were writable.
            raw_notes = c.get("notes")
            notes = {m: raw_notes[m] for m in members
                     if isinstance(raw_notes, dict) and raw_notes.get(m)}
            out_chs.append({
                "id": c.get("chapter_id", ""),
                "principle": c.get("principle", ""),
                "because": c.get("because", ""),
                "kind": c.get("kind", "principle"),
                "members": members,
                "notes": notes,
                "mins": sum(by_id[m]["t"] for m in members),
            })

        tiers, absent = unit_tiers(urows)
        # The run strip's two states, decided here rather than in the renderer so they
        # are testable without a browser (same reason split_ledger lives here).
        #
        # FLAG (warn colour) and OPEN (expanded on load) are separate on purpose.
        # DESIGN §8's decided triggers for auto-expansion are structural: a declined or
        # empty tier, gates failed, legacy. An unopened source is not one of them — and
        # treating it as one meant a run with 1 asserted source among 58 checked ones
        # paid its entire first screen for a fact the collapsed line already states,
        # which is exactly the "shape of the whole topic without scrolling" promise
        # (§2) the contents view exists to keep. So unopened sources still colour the
        # strip and still lead its collapsed line — an incomplete run cannot hide —
        # but only a structural problem opens it.
        unver = sum(1 for r in urows if r["ev"] == "asserted")
        strip_open = state != "ok" or any(not t["n"] for t in tiers)
        multi = len(runs_per_topic.get(topic, [])) > 1
        slug = slugify(topic) + ("-" + slugify(run_tag(topic, run)) if multi else "")
        units.append({
            "key": f"{run}\t{topic}", "slug": slug, "run": run, "topic": topic,
            "date": max((r["at"] for r in urows), default=""),
            "boundary": boundary,
            "state": state,
            "failures": gate.get("failures", []), "warnings": gate.get("warnings", []),
            "n": len(urows), "mins": sum(r["t"] for r in urows),
            "chapters": out_chs,
            "tiers": tiers, "absentTiers": absent,
            "stripOpen": strip_open,
            "stripFlag": strip_open or unver > 0,
            "checked": sum(1 for r in urows if r["ev"] == "re-opened"),
            "unver": unver,
            "authored": sum(1 for r in urows if r["ev"] == "authored"),
            # Absence counted once per unit rather than stated once per row. These three
            # are near-uniform WITHIN a run and vary wildly between runs — one run stored
            # 0 of 117 quotes, another 52 of 58 — so they are a property of the run, and
            # repeating them on every item made the commonest text in the product a
            # sentence about what is missing. The run strip says it once; the row says
            # nothing. Nothing is hidden: the counts are the same facts, summed.
            "quoted": sum(1 for r in urows if r["quote"]),
            "tiered": sum(1 for r in urows if r["why"]),
            "prac": sum(1 for r in urows if r["type"] in ("drill", "exercise")),
            "sv": urows[0]["sv"],
            "runTag": run_tag(topic, run) if multi else "",
        })

    units.sort(key=lambda u: (u["topic"].lower(), u["date"]), reverse=False)
    topics_index = []
    for topic in sorted(runs_per_topic, key=str.lower):
        mine = [u for u in units if u["topic"] == topic]
        # Newest first, with the run id as a tiebreak. Two runs of one topic on the same
        # day is exactly the case this has to handle — Terraform's A/B arms both landed on
        # 2026-08-07 — and without the second key "newest" is whatever order the store
        # happened to be walked in, so which run a topic opens to would drift per machine.
        mine.sort(key=lambda u: (u["date"], u["run"]), reverse=True)
        topics_index.append({"name": topic, "slug": slugify(topic),
                             "units": [u["slug"] for u in mine]})
    return units, topics_index


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


def build_page(docs, groups, rows, runs, chapters, linked_only, unreadable, notices,
               gates_by_key, units, topics_index):
    def jsdata(obj):
        # `</` would end the surrounding <script> tag if a body contains it.
        return (json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
                .replace("</", "<\\/"))

    # `runs` is deliberately not shipped: the page indexes by topic, and a unit already
    # carries everything the old run cards showed. It stays in Python for the build log.
    data = {
        "docs": docs, "rows": rows, "groups": groups,
        "gates": gates_by_key, "units": units, "topicIndex": topics_index,
        "filters": {"type": TYPES, "depth": DEPTHS, "ev": EVIDENCE},
        "evLabel": EV_LABEL, "depthLabel": DEPTH_LABEL,
        "built": datetime.date.today().isoformat(),
        "capNote": (f"{len(linked_only)} document(s) exceeded the embed cap and are "
                    f"linked rather than inlined: {', '.join(linked_only)}."
                    if linked_only else ""),
        # Never a silent drop: whatever could not be read, and whatever the build had to
        # work around, are both carried into the page rather than left in a terminal.
        "unreadable": [{"path": p, "why": w} for p, w in unreadable],
        "notices": [{"path": p, "why": w} for p, w in notices],
    }
    n_topics, n_rows = len(topics_index), len(rows)
    hint = (f"Searches all {n_topics} topic{'s' if n_topics != 1 else ''} · {n_rows} rows, "
            f"not just this one." if n_topics else "Nothing to search yet.")
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Study library</title>
<style>
{asset(TOKENS)}
{asset("index.css")}
</style></head><body><div class="wrap">
<aside>
  <p class="rail-h">Study library</p>
  <label class="vh" for="q">Search every topic</label>
  <input class="search" id="q" type="search" placeholder="Search every topic&#8230;" autocomplete="off">
  <p class="search-hint">{hint}</p>
  <nav class="rail-strip" id="nav" aria-label="Topics and reports"></nav>
</aside>
<main id="main" tabindex="-1"></main></div>
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

    (docs, groups, rows, runs, chapters, metas,
     linked_only, unreadable, notices, embedded) = load_library(root)
    topics = gate_topics(rows, chapters)
    units, topics_index = build_units(rows, chapters, topics, metas)

    # An empty store is a legal state, not an error. Previously this exited 1 without
    # writing anything, so a brand-new user's first experience of the library was a
    # console message and no file. The page itself now carries the first-run state.
    if not docs:
        print(f"Nothing found under {root} — writing an empty library.")

    page = build_page(docs, groups, rows, runs, chapters, linked_only, unreadable,
                      notices, topics, units, topics_index)
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(page)

    n_ch = len(chapters)
    print(f"{len(runs)} run(s), {len(rows)} rows, {n_ch} chapters, "
          f"{len(topics_index)} topic(s), {len(docs)} documents -> {out}")
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

    # Size accounting. EMBED_CAP governs markdown only; row data has never been capped,
    # and slice 1 widened rows from a 300-char projection to full text. So the number that
    # actually grows is printed every build rather than discovered at the wall. The fix
    # (fetch a topic on demand instead of baking every one into the file) lives in slice 3
    # and is not committed, so visibility is the whole mitigation — say so.
    rowbytes = len(json.dumps(rows, ensure_ascii=False, separators=(",", ":")))
    print(f"\n  page {len(page):,} bytes  =  rows {rowbytes:,} + markdown {embedded:,} "
          f"+ assets/chrome {max(0, len(page) - rowbytes - embedded):,}")
    print(f"  markdown embed cap {EMBED_CAP:,} bytes · {embedded / EMBED_CAP:.0%} used"
          + (f" · {len(linked_only)} document(s) linked instead" if linked_only else ""))
    if units:
        per = rowbytes / len(units)
        print(f"  rows cost ~{per:,.0f} bytes per topic-run; "
              f"{len(units)} here. No cap governs this — a single file is slice 1's shape.")
    if len(page) > EMBED_CAP:
        print(f"  NOTE: the page is now larger than EMBED_CAP itself. Nothing breaks, but "
              f"one file is carrying the whole library.")
    if linked_only:
        print(f"  NOT embedded (over cap): {', '.join(linked_only)}")
    if unreadable:
        print(f"\n  COULD NOT READ {len(unreadable)} file(s) — named, not dropped:")
        for p, why in unreadable:
            print(f"    {p}  ({why})")
    if notices:
        print(f"\n  NOTICED {len(notices)} thing(s) the build worked around:")
        for p, why in notices:
            print(f"    {p}\n      {why}")
    if a.open:
        subprocess.run(["open" if sys.platform == "darwin" else "xdg-open", out], check=False)


if __name__ == "__main__":
    main()
