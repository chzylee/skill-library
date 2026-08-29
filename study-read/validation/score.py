#!/usr/bin/env python3
"""Apply the pre-registered pass condition to the checker's verdicts.

Written before the verdicts were read, so the rule cannot bend to the result.
The rule itself is in PRE-REGISTRATION.md; this is only its implementation.

Order matters and is deliberate: the void check runs and prints FIRST, before any
real-chapter score is computed or shown. If the instrument is broken, the scores it
produced are not evidence and should not be looked at.

    python3 score.py --verdicts F --key F [--set F]
"""
import argparse
import json
import sys
from collections import Counter, defaultdict

BAD = ("restatement", "surface")   # what a control must be rated


def load_jsonl(p):
    with open(p) as fh:
        return [json.loads(l) for l in fh if l.strip()]


def rule(pct, per_topic):
    """PASS / BORDERLINE / FAIL. Thresholds from DESIGN-v1.md §11, unchanged."""
    lowest = min(per_topic.values()) if per_topic else 0.0
    if pct >= 70.0 and lowest >= 50.0:
        return "PASS"
    if pct >= 50.0 or 40.0 <= lowest < 50.0:
        return "BORDERLINE"
    return "FAIL"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--verdicts", required=True)
    ap.add_argument("--key", required=True)
    ap.add_argument("--set", dest="scored_set")
    a = ap.parse_args()

    key = json.load(open(a.key))
    verdicts = {v["id"]: v for v in load_jsonl(a.verdicts)}

    missing = sorted(set(key) - set(verdicts))
    extra = sorted(set(verdicts) - set(key))
    if missing:
        print(f"!! {len(missing)} chapters were not scored: {missing[:12]}")
        print("   An unscored set cannot be evaluated. Fix and re-run.\n")
    if extra:
        print(f"!! {len(extra)} verdicts for ids not in the key: {extra[:12]}\n")

    groups = defaultdict(list)
    for cid, meta in key.items():
        v = verdicts.get(cid)
        if v:
            groups[meta["control"]].append((cid, meta, v))

    # ---------------------------------------------------------- void check
    print("=" * 74)
    print("VOID CHECK — shuffled controls (real warrant, random members)")
    print("=" * 74)
    shuffled = groups.get("shuffled", [])
    void = []
    for cid, meta, v in sorted(shuffled, key=lambda x: x[0]):
        ok = v["verdict"] in BAD
        if not ok:
            void.append(cid)
        print(f"  {cid}  {v['verdict']:12} {'ok' if ok else '<<< RATED PRINCIPLE'}"
              f"   [{meta.get('topic','')[:34]}]")
        print(f"        {v.get('reason','')[:150]}")
    print()
    if not shuffled:
        sys.exit("no shuffled controls found — the run is unfalsifiable. Aborting.")
    if void:
        print(f"RESULT: VOID — {len(void)}/{len(shuffled)} shuffled controls rated principle.")
        print("The checker is not reading the members. Its scores are not evidence.")
        print("Do not read the real-chapter scores. Fix checker isolation and re-run.")
        sys.exit(2)
    print(f"RESULT: checker rejected all {len(shuffled)} shuffled controls. Not void.\n")

    # ------------------------------------------- surface controls (soft signal)
    print("=" * 74)
    print("SURFACE CONTROLS — soft signal only, does NOT void (see PRE-REGISTRATION.md)")
    print("=" * 74)
    for cid, meta, v in sorted(groups.get("surface", []), key=lambda x: x[0]):
        print(f"  {cid}  {v['verdict']:12} [{meta.get('topic','')[:34]}]")
        print(f"        {v.get('reason','')[:150]}")
    sc = Counter(v["verdict"] for _, _, v in groups.get("surface", []))
    print(f"\n  {dict(sc)}")
    print("  Four of these were pre-registered as accidentally valid; a `principle`")
    print("  verdict on those is the checker being right, not wrong.\n")

    # ------------------------------------------------------- real chapters
    print("=" * 74)
    print("REAL CHAPTERS")
    print("=" * 74)
    real = groups.get("none", [])
    by_topic = defaultdict(list)
    for cid, meta, v in real:
        by_topic[meta.get("topic", "?")].append(v)

    per_topic_pct = {}
    for topic, vs in sorted(by_topic.items()):
        c = Counter(x["verdict"] for x in vs)
        # `reference` chapters declare they are not principles; exclude them from
        # the denominator rather than counting them as failures.
        refs = sum(1 for cid, meta, v in real
                   if meta.get("topic") == topic and meta.get("declared_kind") == "reference")
        denom = len(vs) - refs
        pct = 100.0 * c["principle"] / denom if denom else 0.0
        per_topic_pct[topic] = pct
        print(f"  {topic[:44]:46} {c['principle']:>2}/{denom:<3} {pct:5.1f}%   "
              f"rest {c['restatement']} · surf {c['surface']}"
              + (f" · {refs} reference excluded" if refs else ""))

    total_ref = sum(1 for cid, meta, v in real if meta.get("declared_kind") == "reference")
    denom = len(real) - total_ref
    prin = sum(1 for _, meta, v in real
               if v["verdict"] == "principle" and meta.get("declared_kind") != "reference")
    pct = 100.0 * prin / denom if denom else 0.0
    low = sum(1 for _, _, v in real if v.get("confidence") == "low")

    print(f"\n  overall {prin}/{denom} = {pct:.1f}% principle "
          f"({total_ref} reference chapters excluded, {low} low-confidence)")

    verdict = rule(pct, per_topic_pct)
    print("\n" + "=" * 74)
    print(f"VERDICT: {verdict}")
    print("=" * 74)
    if verdict == "PASS":
        print("  >=70% overall and no topic below 50%. Phase 1 is unblocked.")
    elif verdict == "BORDERLINE":
        print("  This is the band where a human read changes the answer. STOP.")
        print("  Per the design: borderline means stop, not round up.")
    else:
        print("  Chaptering did not work well enough to build on as specified.")
        print("  Fallback per the design: human-assisted chaptering, agent proposes.")


if __name__ == "__main__":
    main()
