#!/usr/bin/env python3
"""Tests for the chapter gates. Stdlib only.

    python3 study-read/references/gates_test.py

Cases come from study-read/validation/TEST-PLAN.md plus the real Phase 0 output, which
is the only chapter data that exists. Every gate is tested from BOTH sides: a case that
must fail and a case that must pass. A gate only tested from the failing side can be
satisfied by a function that always fails.
"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gates  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
VAL = os.path.join(REPO, "study-read", "validation")

LONG = ("All of these follow from one ordering decision made in the protocol itself, "
        "which is why they cannot be understood separately from each other at all.")


def rows(*pairs):
    return [{"id": i, "subject": s} for i, s in pairs]


def chapter(cid="ch-01", principle="P", because=LONG, members=("r1",), kind="principle"):
    return {"chapter_id": cid, "principle": principle, "because": because,
            "members": list(members), "kind": kind}


class Orphans(unittest.TestCase):
    def test_row_in_no_chapter_fails(self):
        r = gates.check_topic("t", rows(("r1", "a"), ("r2", "b")),
                              [chapter(members=["r1"])])
        self.assertTrue(r.degraded)
        self.assertTrue(any("no chapter" in f for f in r.failures))

    def test_all_rows_placed_passes(self):
        r = gates.check_topic("t", rows(("r1", "a"), ("r2", "b")),
                              [chapter(members=["r1", "r2"])])
        self.assertFalse(r.degraded, r.failures)

    def test_member_not_a_live_row_fails(self):
        r = gates.check_topic("t", rows(("r1", "a")),
                              [chapter(members=["r1", "ghost"])])
        self.assertTrue(any("not a live row" in f for f in r.failures))

    def test_duplicate_membership_fails(self):
        r = gates.check_topic("t", rows(("r1", "a"), ("r2", "b")), [
            chapter("ch-01", members=["r1", "r2"]),
            chapter("ch-02", members=["r2"]),
        ])
        self.assertTrue(any("already in" in f for f in r.failures))


class Because(unittest.TestCase):
    def test_short_because_fails(self):
        r = gates.check_topic("t", rows(("r1", "a")),
                              [chapter(because="Too short.")])
        self.assertTrue(any("minimum 80" in f for f in r.failures))

    def test_empty_because_fails(self):
        r = gates.check_topic("t", rows(("r1", "a")), [chapter(because="")])
        self.assertTrue(any("empty because" in f for f in r.failures))

    def test_exactly_at_minimum_passes(self):
        because = "x" * gates.MIN_BECAUSE_CHARS
        r = gates.check_topic("t", rows(("r1", "a")), [chapter(because=because)])
        self.assertFalse(any("minimum" in f for f in r.failures), r.failures)

    def test_empty_principle_fails(self):
        r = gates.check_topic("t", rows(("r1", "a")), [chapter(principle="")])
        self.assertTrue(any("empty principle" in f for f in r.failures))


class SubjectOverlap(unittest.TestCase):
    def test_because_that_is_just_the_subjects_fails(self):
        # The warrant is literally the member subjects concatenated.
        r = gates.check_topic("t", rows(
            ("r1", "consumer group membership"),
            ("r2", "partition assignment strategy"),
        ), [chapter(
            because=("These cover consumer group membership and partition assignment "
                     "strategy, consumer group membership and partition assignment."),
            members=["r1", "r2"])])
        self.assertTrue(any("subjects" in f for f in r.failures), r.failures)

    def test_because_naming_a_cause_passes(self):
        r = gates.check_topic("t", rows(
            ("r1", "consumer group membership"),
            ("r2", "partition assignment strategy"),
        ), [chapter(
            because=("Both fall out of the broker never tracking which client holds "
                     "what: ownership is leased by the coordinator and revoked "
                     "wholesale, so neither can be reasoned about alone."),
            members=["r1", "r2"])])
        self.assertFalse(r.degraded, r.failures)

    def test_overlap_is_a_fraction_of_the_warrant_not_the_subjects(self):
        # A long warrant that happens to contain the subjects is not a restatement.
        ov = gates.subject_overlap(
            "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda",
            ["alpha beta"])
        self.assertLess(ov, 0.30)

    def test_empty_because_scores_max_overlap(self):
        self.assertEqual(gates.subject_overlap("", ["anything"]), 1.0)


class Size(unittest.TestCase):
    def test_oversized_chapter_fails(self):
        ids = [(f"r{i}", f"s{i}") for i in range(gates.MAX_MEMBERS + 1)]
        r = gates.check_topic("t", rows(*ids),
                              [chapter(members=[i for i, _ in ids])])
        self.assertTrue(any("maximum 12" in f for f in r.failures))

    def test_exactly_max_members_passes(self):
        ids = [(f"r{i}", f"s{i}") for i in range(gates.MAX_MEMBERS)]
        r = gates.check_topic("t", rows(*ids),
                              [chapter(members=[i for i, _ in ids])])
        self.assertFalse(any("maximum" in f for f in r.failures), r.failures)

    def test_too_few_chapters_for_a_big_topic_fails(self):
        ids = [(f"r{i}", f"s{i}") for i in range(gates.MIN_ROWS_FOR_MIN_CHAPTERS)]
        chs = [chapter("ch-01", members=[i for i, _ in ids[:8]]),
               chapter("ch-02", members=[i for i, _ in ids[8:]])]
        r = gates.check_topic("t", rows(*ids), chs)
        self.assertTrue(any("minimum 3" in f for f in r.failures))

    def test_small_topic_may_have_two_chapters(self):
        ids = [(f"r{i}", f"s{i}") for i in range(6)]
        chs = [chapter("ch-01", members=[i for i, _ in ids[:3]]),
               chapter("ch-02", members=[i for i, _ in ids[3:]])]
        r = gates.check_topic("t", rows(*ids), chs)
        self.assertFalse(r.degraded, r.failures)

    def test_thin_chapter_warns_but_does_not_fail(self):
        """Phase 0: the most fragmented arm scored highest. Fragmentation must not fail."""
        ids = [(f"r{i}", f"s{i}") for i in range(6)]
        chs = [chapter("ch-01", members=["r0", "r1"]),
               chapter("ch-02", members=["r2", "r3"]),
               chapter("ch-03", members=["r4", "r5"])]
        r = gates.check_topic("t", rows(*ids), chs)
        self.assertFalse(r.degraded, r.failures)
        self.assertTrue(r.warnings)


class Reference(unittest.TestCase):
    def test_reference_chapter_is_exempt_from_size_cap(self):
        ids = [(f"r{i}", f"s{i}") for i in range(20)]
        chs = [chapter("ch-01", members=[i for i, _ in ids[:4]]),
               chapter("ch-02", members=[i for i, _ in ids[4:8]]),
               chapter("ch-03", members=[i for i, _ in ids[8:12]]),
               chapter("ch-99", members=[i for i, _ in ids[12:]], kind="reference")]
        r = gates.check_topic("t", rows(*ids), chs)
        self.assertFalse(any("maximum 12" in f for f in r.failures), r.failures)

    def test_oversized_reference_warns_not_fails(self):
        ids = [(f"r{i}", f"s{i}") for i in range(20)]
        chs = [chapter("ch-01", members=[i for i, _ in ids[:4]]),
               chapter("ch-02", members=[i for i, _ in ids[4:8]]),
               chapter("ch-03", members=[i for i, _ in ids[8:12]]),
               chapter("ch-99", members=[i for i, _ in ids[12:]], kind="reference")]
        r = gates.check_topic("t", rows(*ids), chs)
        self.assertFalse(r.degraded, r.failures)
        self.assertTrue(any("reference chapter holds" in w for w in r.warnings))

    def test_two_reference_chapters_fails(self):
        ids = [("r1", "a"), ("r2", "b")]
        chs = [chapter("ch-01", members=["r1"], kind="reference"),
               chapter("ch-02", members=["r2"], kind="reference")]
        r = gates.check_topic("t", rows(*ids), chs)
        self.assertTrue(any("maximum 1" in f for f in r.failures))


class Degradation(unittest.TestCase):
    def test_no_chapters_at_all_degrades_rather_than_crashing(self):
        r = gates.check_topic("t", rows(("r1", "a")), [])
        self.assertTrue(r.degraded)
        self.assertEqual(r.stats["chapters"], 0)

    def test_malformed_chapter_does_not_raise(self):
        r = gates.check_topic("t", rows(("r1", "a")), [{}])
        self.assertTrue(r.degraded)

    def test_one_bad_topic_does_not_affect_another(self):
        """The whole point of per-topic scoping."""
        res = gates.check_all(
            {"good": rows(("r1", "a")), "bad": rows(("r9", "z"))},
            {"good": [chapter(members=["r1"])], "bad": []},
        )
        self.assertFalse(res["good"].degraded, res["good"].failures)
        self.assertTrue(res["bad"].degraded)


class RealPhase0Output(unittest.TestCase):
    """The gates must pass the 47 chapters Phase 0 actually produced.

    A gate that rejects the data the validation approved is wrong about something.
    """

    def _arm(self, slug):
        rp = os.path.join(VAL, "input", f"rows-{slug}.jsonl")
        cp = os.path.join(VAL, "out", f"chapters-{slug}.jsonl")
        if not (os.path.exists(rp) and os.path.exists(cp)):
            self.skipTest(f"Phase 0 output not present for {slug}")
        with open(rp) as fh:
            rws = [json.loads(l) for l in fh if l.strip()]
        with open(cp) as fh:
            chs = [json.loads(l) for l in fh if l.strip()]
        return rws, chs

    def test_all_four_arms_pass_their_gates(self):
        for slug in ("kafka", "api", "terraform-v02", "terraform-v03"):
            with self.subTest(arm=slug):
                rws, chs = self._arm(slug)
                r = gates.check_topic(slug, rws, chs)
                self.assertFalse(r.degraded, f"{slug}: {r.failures}")

    def test_terraform_v02_warns_about_fragmentation(self):
        """v02 produced 6 thin chapters and still scored highest. Warn, never fail."""
        rws, chs = self._arm("terraform-v02")
        r = gates.check_topic("terraform-v02", rws, chs)
        self.assertFalse(r.degraded, r.failures)
        self.assertTrue(any("fewer members" in w or "fragmented" in w
                            for w in r.warnings), r.warnings)

    def test_removing_a_row_from_a_chapter_is_caught(self):
        """Mutate real data into a known-bad state; the gate must notice."""
        rws, chs = self._arm("api")
        chs[0] = dict(chs[0], members=chs[0]["members"][:-1])
        r = gates.check_topic("api", rws, chs)
        self.assertTrue(r.degraded)
        self.assertTrue(any("no chapter" in f for f in r.failures))


if __name__ == "__main__":
    unittest.main(verbosity=2)
