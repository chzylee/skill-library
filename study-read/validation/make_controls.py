#!/usr/bin/env python3
"""Blind controls for the chaptering validation.

The checker only ever sees a finished chapter: its `because` text and its members. It
never sees how the grouping was reached. An agent asked to write a `because` will produce
principle-sounding language whether the grouping came from causal reasoning or from
keyword co-occurrence with a story attached afterward. So a checker that rubber-stamps
everything scores 100% and the run teaches nothing.

These are the planted failures that make the experiment falsifiable.

    SURFACE  — rows grouped by a shared word in `subject`, which is the exact defect the
               structure brief forbids. A fluent `because` is written over the top by an
               agent in a separate step, so the control fails on grouping rather than on
               obviously mechanical prose.
    SHUFFLED — a real chapter's `because` kept verbatim, its members replaced at random
               from the same topic. Tests whether the checker reads the members at all or
               just grades the prose.

Both must be rated `restatement` or `surface` by the checker. If either is rated
`principle`, the checker cannot discriminate and the run is void.

Usage:
    python3 make_controls.py build    --rows F --chapters F --topic T --outdir D [--n 2] [--size 5]
    python3 make_controls.py assemble --chapters F... --controls F... --rows F... --outdir D

Stdlib only. Seeded from the topic name, so a rerun reproduces the same controls.
"""
import argparse
import hashlib
import json
import os
import random
import re
import sys
from collections import Counter, defaultdict

STOP = {
    "the", "a", "an", "and", "or", "of", "to", "in", "for", "on", "with", "is", "are",
    "was", "were", "be", "been", "by", "as", "at", "it", "its", "that", "this", "from",
    "how", "what", "when", "why", "which", "you", "your", "not", "but", "can", "will",
    "does", "do", "if", "than", "then", "into", "over", "per", "via", "vs",
}
PENDING = "__PENDING_BECAUSE__"


def toks(s):
    return [w for w in re.findall(r"[a-z0-9_.]+", (s or "").lower())
            if w not in STOP and len(w) > 2]


def load_rows(paths, topic):
    """Live rows for one topic, across however many run files it spans."""
    out = []
    for p in paths:
        with open(os.path.expanduser(p)) as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                r = json.loads(line)
                if r.get("topic") != topic:
                    continue
                if r.get("grade") in ("killed", "merged"):
                    continue
                out.append(r)
    return out


def load_chapters(paths, topic):
    out = []
    for p in paths:
        if not os.path.exists(os.path.expanduser(p)):
            continue
        with open(os.path.expanduser(p)) as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                c = json.loads(line)
                if c.get("topic") == topic:
                    out.append(c)
    return out


def rng_for(topic):
    seed = int(hashlib.sha256(topic.encode()).hexdigest()[:8], 16)
    return random.Random(seed)


# ------------------------------------------------------------------ build

def _heterogeneity(rs):
    """How structurally incoherent a candidate cluster is.

    A surface cluster picked purely on word frequency can come out accidentally coherent
    — 'group' on the Kafka rows pulls rebalances, the coordinator, and the protocol RPCs,
    which is arguably a real chapter. A control that might genuinely be a principle is a
    bad control: the checker rating it `principle` would void the run for the wrong
    reason.

    So prefer candidates that span several `type` and `depth` values. A set mixing a
    concept, an exercise, and a drill across orientation and mechanism is very unlikely
    to share a governing idea no matter how the `because` is written.
    """
    return (len({r.get("type") for r in rs}), len({r.get("depth") for r in rs}))


def surface_clusters(rows, n, size, rnd):
    """Group by a shared word in `subject`. The defect the brief forbids, on purpose.

    Deliberately never looks at `description` — that is what makes it a surface grouping
    rather than an accidental real one.
    """
    by_word = defaultdict(list)
    for r in rows:
        for w in set(toks(r.get("subject"))):
            by_word[w].append(r)

    candidates = []
    for word, rs in by_word.items():
        if len(rs) < 3:
            continue
        picks = sorted(rs, key=lambda r: r["id"])[:size]
        t, d = _heterogeneity(picks)
        candidates.append((t, d, len(picks), word, picks))

    # Most heterogeneous first; word name last so ties resolve deterministically.
    candidates.sort(key=lambda c: (-c[0], -c[1], -c[2], c[3]))

    out, used = [], set()
    for t, d, _, word, picks in candidates:
        picks = [r for r in picks if r["id"] not in used]
        if len(picks) < 3:
            continue
        used.update(r["id"] for r in picks)
        out.append({"word": word, "rows": picks, "types": t, "depths": d})
        if len(out) == n:
            break
    return out


def shuffled_controls(rows, chapters, n, rnd):
    """Keep a real `because`, replace the members at random from the same topic."""
    real = [c for c in chapters if c.get("kind", "principle") == "principle"]
    if not real:
        return []
    pool = [r["id"] for r in rows]
    picks = rnd.sample(real, min(n, len(real)))
    out = []
    for c in picks:
        k = len(c.get("members", [])) or 5
        members = rnd.sample(pool, min(k, len(pool)))
        # A shuffle that reproduces the original is not a control.
        if members == list(c.get("members", [])):
            rnd.shuffle(members)
        out.append({
            "topic": c["topic"],
            "principle": c["principle"],
            "because": c["because"],          # verbatim, unchanged
            "members": members,               # unrelated
            "_control": "shuffled",
            "_derived_from": c.get("chapter_id"),
        })
    return out


def cmd_build(a):
    rows = load_rows(a.rows, a.topic)
    if not rows:
        sys.exit(f"no live rows for topic {a.topic!r}")
    chapters = load_chapters(a.chapters, a.topic)
    rnd = rng_for(a.topic)
    os.makedirs(a.outdir, exist_ok=True)
    slug = re.sub(r"[^a-z0-9]+", "-", a.topic.lower()).strip("-")[:40]

    surf = surface_clusters(rows, a.n, a.size, rnd)
    shuf = shuffled_controls(rows, chapters, a.n, rnd)

    pending = os.path.join(a.outdir, f"controls-pending-{slug}.json")
    with open(pending, "w") as fh:
        json.dump({
            "topic": a.topic,
            "instructions": (
                "For each cluster write a fluent, confident `because` of at least 80 "
                "characters that reads like a real governing principle. Do NOT reveal "
                "that the rows were grouped by a shared word. Do NOT hedge. This text is "
                "a control and is supposed to be persuasive prose over a bad grouping."
            ),
            "clusters": [{
                "shared_word": c["word"],
                "members": [r["id"] for r in c["rows"]],
                "member_text": [
                    {"subject": r.get("subject"), "description": r.get("description")}
                    for r in c["rows"]
                ],
                "principle": PENDING,
                "because": PENDING,
            } for c in surf],
        }, fh, indent=2)

    shufp = os.path.join(a.outdir, f"controls-shuffled-{slug}.jsonl")
    with open(shufp, "w") as fh:
        for c in shuf:
            fh.write(json.dumps(c, ensure_ascii=False) + "\n")

    print(f"topic: {a.topic}")
    print(f"  live rows          {len(rows)}")
    print(f"  real chapters      {len(chapters)}")
    print(f"  surface clusters   {len(surf)} -> {pending}")
    for c in surf:
        print(f"      '{c['word']}' x{len(c['rows'])}  "
              f"({c['types']} types, {c['depths']} depths — higher is a better control)")
    print(f"  shuffled controls  {len(shuf)} -> {shufp}")
    if len(surf) < a.n or len(shuf) < a.n:
        print("  WARNING: fewer controls than requested; the void check is weaker.")


# --------------------------------------------------------------- assemble

def cmd_assemble(a):
    """Mix real chapters and controls, strip every tell, shuffle, emit scored set + key."""
    rows = {}
    for p in a.rows:
        with open(os.path.expanduser(p)) as fh:
            for line in fh:
                line = line.strip()
                if line:
                    r = json.loads(line)
                    rows[r["id"]] = r

    items = []
    for p in a.chapters:
        with open(os.path.expanduser(p)) as fh:
            for line in fh:
                line = line.strip()
                if line:
                    c = json.loads(line)
                    c["_control"] = "none"
                    items.append(c)
    for p in a.controls:
        with open(os.path.expanduser(p)) as fh:
            if p.endswith(".json"):
                blob = json.load(fh)
                for c in blob.get("clusters", []):
                    if c.get("because") == PENDING:
                        sys.exit(f"{p}: surface control still has a PENDING because. "
                                 "Fill it in before assembling.")
                    items.append({
                        "topic": blob["topic"], "principle": c["principle"],
                        "because": c["because"], "members": c["members"],
                        "_control": "surface",
                    })
            else:
                for line in fh:
                    line = line.strip()
                    if line:
                        items.append(json.loads(line))

    rnd = random.Random(20260814)
    rnd.shuffle(items)

    os.makedirs(a.outdir, exist_ok=True)
    setp = os.path.join(a.outdir, "scored-set.jsonl")
    keyp = os.path.join(a.outdir, "scored-set-KEY.json")
    key = {}
    missing = 0
    with open(setp, "w") as fh:
        for i, c in enumerate(items, 1):
            opaque = f"X{i:03d}"
            key[opaque] = {
                "control": c.get("_control", "none"),
                "topic": c.get("topic"),
                "origin_chapter_id": c.get("chapter_id") or c.get("_derived_from"),
                "declared_kind": c.get("kind", "principle"),
            }
            members = []
            for rid in c.get("members", []):
                r = rows.get(rid)
                if not r:
                    missing += 1
                    continue
                members.append({"subject": r.get("subject"),
                                "description": r.get("description")})
            # Nothing here may hint at provenance: no chapter_id, no order, no kind,
            # no control flag, no row ids.
            fh.write(json.dumps({
                "id": opaque,
                "principle": c.get("principle"),
                "because": c.get("because"),
                "members": members,
            }, ensure_ascii=False) + "\n")
    with open(keyp, "w") as fh:
        json.dump(key, fh, indent=2)

    counts = Counter(v["control"] for v in key.values())
    print(f"scored set  {setp}   {len(items)} chapters")
    print(f"key         {keyp}   (the checker must never see this)")
    print(f"  real {counts['none']} · surface {counts['surface']} · shuffled {counts['shuffled']}")
    if missing:
        print(f"  WARNING: {missing} member ids did not resolve to a row and were dropped.")
    if counts["surface"] + counts["shuffled"] == 0:
        sys.exit("no controls in the scored set — the run would be unfalsifiable. Aborting.")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("build", help="generate controls for one topic")
    b.add_argument("--rows", nargs="+", required=True)
    b.add_argument("--chapters", nargs="*", default=[])
    b.add_argument("--topic", required=True)
    b.add_argument("--outdir", required=True)
    b.add_argument("--n", type=int, default=2)
    b.add_argument("--size", type=int, default=5)
    b.set_defaults(func=cmd_build)

    s = sub.add_parser("assemble", help="mix real + controls into a blind scored set")
    s.add_argument("--chapters", nargs="+", required=True)
    s.add_argument("--controls", nargs="+", required=True)
    s.add_argument("--rows", nargs="+", required=True)
    s.add_argument("--outdir", required=True)
    s.set_defaults(func=cmd_assemble)

    a = ap.parse_args()
    a.func(a)


if __name__ == "__main__":
    main()
