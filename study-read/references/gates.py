#!/usr/bin/env python3
"""Structural gates on chapter records.

Scoped to ONE TOPIC. A topic that fails its gates renders flat under a banner; every
other topic still builds and the build still succeeds. A single degenerate warrant must
never lock you out of a library of forty topics.

Two severities, and the split is deliberate:

  FAILURE   the chapter structure is not trustworthy, so the topic renders flat.
  WARNING   reported, never blocks. These are shapes we suspect are bad but have no
            evidence for. Phase 0 measured chapter granularity across four arms and the
            most fragmented arm scored HIGHEST (terraform-v02, 6 two-member chapters,
            78.6% principle, against v03's 0 and 63.6%). Failing a topic for
            fragmentation would have rejected the better arm. So fragmentation warns.

What no gate can check: whether a `because` names a real binding idea or a fluent
restatement. Phase 0 established that only a reader settles that. These gates prove a
chapter structure EXISTS, is NON-DEGENERATE, and is REASONABLY SIZED. Nothing here
claims it is good.
"""
import re

MIN_BECAUSE_CHARS = 80
MAX_MEMBERS = 12
MIN_CHAPTERS = 3
MIN_ROWS_FOR_MIN_CHAPTERS = 15
MAX_SUBJECT_OVERLAP = 0.60
MAX_REFERENCE_SHARE = 0.20
THIN_CHAPTER = 2
# A per-member note is a hinge — where the item sits, what it assumes, what to notice.
# 30 words is the brief's ceiling; this is the slack-adjusted byte form of it. WARNING
# only, and deliberately: a note long enough to be read INSTEAD of its item is the failure
# (anthology editing's own name for it is readers settling for the headnote and never
# reaching the selection), but a long note is still a note, and failing a whole topic over
# one wordy sentence would render 12 good chapters flat. Absence is not checked at all —
# omitting a note is a legal result and every chapter written before notes existed has none.
MAX_NOTE_CHARS = 220

STOP = {
    "the", "a", "an", "and", "or", "of", "to", "in", "for", "on", "with", "is", "are",
    "was", "were", "be", "been", "by", "as", "at", "it", "its", "that", "this", "from",
    "how", "what", "when", "why", "which", "you", "your", "not", "but", "can", "will",
    "does", "do", "if", "than", "then", "into", "over", "per", "via", "vs",
}


def _toks(s):
    return {w for w in re.findall(r"[a-z0-9_.]+", (s or "").lower())
            if w not in STOP and len(w) > 2}


def subject_overlap(because, member_subjects):
    """Share of the warrant's content words that come from its own members' subjects.

    The mechanical proxy for "this warrant is just the list restated". It cannot catch a
    fluent restatement that uses different words, which is the common case — but it does
    catch the laziest form for free.
    """
    b = _toks(because)
    if not b:
        return 1.0
    s = set()
    for subj in member_subjects:
        s |= _toks(subj)
    return len(b & s) / len(b)


class Result:
    def __init__(self, topic):
        self.topic = topic
        self.failures = []
        self.warnings = []
        self.stats = {}

    @property
    def ok(self):
        return not self.failures

    @property
    def degraded(self):
        """True when the topic must render flat rather than chaptered."""
        return bool(self.failures)

    def __repr__(self):
        return (f"<Result {self.topic!r} "
                f"{'OK' if self.ok else 'DEGRADED'} "
                f"{len(self.failures)}F/{len(self.warnings)}W>")


def check_topic(topic, live_rows, chapters):
    """Gate one topic.

    live_rows  list of row dicts (grade already filtered to live), each with id, subject
    chapters   list of chapter dicts: chapter_id, principle, because, members, kind

    Returns a Result. Never raises on bad data — malformed input is a failure, not a
    crash, because a build must not die on one bad topic.
    """
    r = Result(topic)
    ids = {row.get("id") for row in live_rows}
    subj = {row.get("id"): row.get("subject", "") for row in live_rows}

    if not chapters:
        r.failures.append("no chapter records for this topic")
        r.stats = {"live_rows": len(ids), "chapters": 0}
        return r

    seen = {}
    for c in chapters:
        cid = c.get("chapter_id") or "<no chapter_id>"
        kind = c.get("kind", "principle")
        members = c.get("members") or []
        because = c.get("because") or ""

        if not c.get("principle"):
            r.failures.append(f"{cid}: empty principle")
        if not because:
            r.failures.append(f"{cid}: empty because")
        elif len(because) < MIN_BECAUSE_CHARS:
            r.failures.append(
                f"{cid}: because is {len(because)} chars, minimum {MIN_BECAUSE_CHARS}")

        if not members:
            r.failures.append(f"{cid}: no members")

        # The reference chapter is exempt from the size cap and the overlap test: it
        # openly declares it is not a principle, so it is not claiming to be one.
        if kind != "reference":
            if len(members) > MAX_MEMBERS:
                r.failures.append(
                    f"{cid}: {len(members)} members, maximum {MAX_MEMBERS}")
            if because and members:
                ov = subject_overlap(because, [subj.get(m, "") for m in members])
                if ov > MAX_SUBJECT_OVERLAP:
                    r.failures.append(
                        f"{cid}: because is {ov:.0%} its own members' subjects, "
                        f"maximum {MAX_SUBJECT_OVERLAP:.0%}")
            if len(members) <= THIN_CHAPTER:
                r.warnings.append(f"{cid}: only {len(members)} members")

        for m in members:
            if m not in ids:
                r.failures.append(f"{cid}: member {m} is not a live row of this topic")
            if m in seen:
                r.failures.append(f"{cid}: member {m} already in {seen[m]}")
            else:
                seen[m] = cid

        # Notes are optional and keyed by member. A note on a row that is not a member of
        # this chapter is a real mistake — it would never render and nothing else would
        # say so — but it is still not worth rendering 12 chapters flat over, so it warns.
        notes = c.get("notes") or {}
        if isinstance(notes, dict):
            for rid, text in notes.items():
                if rid not in members:
                    r.warnings.append(f"{cid}: note for {rid}, which is not a member")
                elif len(text or "") > MAX_NOTE_CHARS:
                    r.warnings.append(
                        f"{cid}: note for {rid} is {len(text)} chars, over the "
                        f"{MAX_NOTE_CHARS} guideline — long enough to be read instead "
                        f"of the item")
        elif notes:
            r.warnings.append(f"{cid}: notes is not an object keyed by row id")

    orphans = sorted(ids - set(seen))
    if orphans:
        shown = ", ".join(orphans[:8]) + (f" +{len(orphans)-8}" if len(orphans) > 8 else "")
        r.failures.append(f"{len(orphans)} live rows in no chapter: {shown}")

    principle_chapters = [c for c in chapters if c.get("kind", "principle") != "reference"]
    if len(ids) >= MIN_ROWS_FOR_MIN_CHAPTERS and len(principle_chapters) < MIN_CHAPTERS:
        r.failures.append(
            f"{len(ids)} live rows produced only {len(principle_chapters)} chapters, "
            f"minimum {MIN_CHAPTERS}")

    refs = [c for c in chapters if c.get("kind") == "reference"]
    if len(refs) > 1:
        r.failures.append(f"{len(refs)} reference chapters, maximum 1")
    if refs and ids:
        share = sum(len(c.get("members") or []) for c in refs) / len(ids)
        if share > MAX_REFERENCE_SHARE:
            r.warnings.append(
                f"reference chapter holds {share:.0%} of rows, over the "
                f"{MAX_REFERENCE_SHARE:.0%} guideline — the grouping may be the problem")

    thin = sum(1 for c in principle_chapters
               if len(c.get("members") or []) <= THIN_CHAPTER)
    if principle_chapters and thin / len(principle_chapters) > 0.40:
        r.warnings.append(
            f"{thin} of {len(principle_chapters)} chapters have "
            f"{THIN_CHAPTER} or fewer members — fragmented, but Phase 0 found "
            f"fragmentation did not predict quality")

    r.stats = {
        "live_rows": len(ids),
        "chapters": len(chapters),
        "principle_chapters": len(principle_chapters),
        "reference_chapters": len(refs),
        "thin_chapters": thin,
        "avg_members": round(len(seen) / len(principle_chapters), 1)
                       if principle_chapters else 0,
    }
    return r


def check_all(rows_by_topic, chapters_by_topic):
    """Gate every topic. Returns {topic: Result}. Never raises."""
    out = {}
    for topic, rows in rows_by_topic.items():
        out[topic] = check_topic(topic, rows, chapters_by_topic.get(topic, []))
    return out


def report(results, verbose=True):
    """Human-readable summary. Returns the number of degraded topics."""
    degraded = 0
    for topic, r in sorted(results.items()):
        if r.degraded:
            degraded += 1
        state = "DEGRADED" if r.degraded else "ok"
        s = r.stats
        print(f"  {topic[:44]:46} {state:9} "
              f"{s.get('chapters', 0):>2} ch / {s.get('live_rows', 0):>3} rows")
        if verbose:
            for f in r.failures:
                print(f"      FAIL  {f}")
            for w in r.warnings:
                print(f"      warn  {w}")
    return degraded
