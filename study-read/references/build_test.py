#!/usr/bin/env python3
"""Smoke tests for the library build.

    python3 build_test.py

Stdlib only, same shape as gates_test.py. These do not test whether the page looks
good — only that it is a page at all, and that the states the real store cannot
exercise still render. Every assertion here exists because something actually broke:

  * The <style> element was silently truncated by a literal "</style>" inside a
    comment in shared/tokens.css. Tokens loaded, every rule after them rendered as
    body text, and nothing anywhere said so. Guarded by test_stylesheet_survives_*.
  * Chapters were keyed to the run DIRECTORY name while rows carry their own `run`,
    so a renamed directory silently downgraded every chaptered topic to "legacy".
    Guarded by test_run_key_comes_from_rows.
  * The real store has no legacy, degraded, or empty topic, so all three render
    paths were unexercised until a scratch store was built by hand.

The one thing the page must never do is claim something the store does not record:
there is no dead-link state anywhere in the data, so there must be none in the output.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build_index.py")


def row(rid, topic, run, **kw):
    r = {"id": rid, "topic": topic, "run": run, "subject": f"subject {rid}",
         "description": f"description of {rid}", "depth": "operation", "type": "concept",
         "origin": "https://example.org/docs/thing", "evidence": "re-opened",
         "grade": "viable", "populated_at": "2026-08-06", "schema_version": "0.2",
         "time_estimate_min": 3}
    r.update(kw)
    return r


def chapter(cid, topic, members, order, **kw):
    c = {"chapter_id": cid, "topic": topic, "members": members, "order": order,
         "kind": "principle",
         "principle": f"The idea binding {cid}",
         "because": ("These belong together because one shared mechanism produces every "
                     "one of them, and that mechanism is visible in none of them alone.")}
    c.update(kw)
    return c


def write_store(root, run_id, rows, chapters, meta=None):
    d = os.path.join(root, "runs", run_id, "data")
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "final.jsonl"), "w", encoding="utf-8") as fh:
        fh.write("".join(json.dumps(r) + "\n" for r in rows))
    if chapters is not None:
        with open(os.path.join(d, "chapters.jsonl"), "w", encoding="utf-8") as fh:
            fh.write("".join(json.dumps(c) + "\n" for c in chapters))
    if meta is not None:
        with open(os.path.join(d, "guide-meta.json"), "w", encoding="utf-8") as fh:
            json.dump(meta, fh)


def build(root):
    """Run the real build script and return (stdout, page text)."""
    p = subprocess.run([sys.executable, BUILD, "--root", root],
                       capture_output=True, text=True)
    if p.returncode != 0:
        raise AssertionError(f"build failed ({p.returncode}):\n{p.stdout}\n{p.stderr}")
    with open(os.path.join(root, "index.html"), encoding="utf-8") as fh:
        return p.stdout, fh.read()


def page_data(page):
    """The STUDY_DATA payload, parsed back out of the built page."""
    start = page.index("window.STUDY_DATA=") + len("window.STUDY_DATA=")
    end = page.index("</script>", start)
    return json.loads(page[start:end].replace("<\\/", "</"))


class StoreCase(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp(prefix="study-build-test-")
        self.addCleanup(shutil.rmtree, self.root, ignore_errors=True)


class Stylesheet(StoreCase):
    """A truncated <style> is invisible in every check except this one."""

    def _build_small(self):
        rows = [row(f"R-{i:03d}", "Topic", "run-a") for i in range(6)]
        write_store(self.root, "run-a", rows,
                    [chapter("ch-01", "Topic", [r["id"] for r in rows], 1)])
        return build(self.root)[1]

    def test_stylesheet_survives_to_the_end(self):
        page = self._build_small()
        head = page[:page.index("</head>")]
        self.assertIn("--accent:", head, "tokens did not reach the page")
        self.assertIn(".ch-t", head,
                      "index.css did not survive into <head> — the <style> element was "
                      "closed early, almost certainly by a literal '</style' in an asset")

    def test_stylesheet_has_exactly_one_terminator(self):
        page = self._build_small()
        self.assertEqual(page.lower().count("</style"), 1,
                         "an inlined asset contains '</style', which ends the element "
                         "wherever it appears — including inside a CSS comment")

    def test_script_has_exactly_one_terminator(self):
        page = self._build_small()
        self.assertEqual(page.lower().count("</script"), 2,   # data block + behaviour block
                         "an inlined asset contains '</script', which ends the element")

    def test_missing_asset_fails_loudly(self):
        """Returning "" for a missing stylesheet silently shipped an unstyled page."""
        p = subprocess.run([sys.executable, BUILD, "--root", self.root],
                           capture_output=True, text=True,
                           env={**os.environ, "PYTHONPATH": ""})
        self.assertEqual(p.returncode, 0)  # baseline: assets present, build succeeds
        with tempfile.TemporaryDirectory() as bare:
            shutil.copy(BUILD, os.path.join(bare, "build_index.py"))
            q = subprocess.run([sys.executable, os.path.join(bare, "build_index.py"),
                                "--root", self.root], capture_output=True, text=True)
            self.assertNotEqual(q.returncode, 0, "a build with no index.css must fail")
            self.assertIn("required asset missing", q.stdout + q.stderr)


class Units(StoreCase):
    def test_run_key_comes_from_rows_not_the_directory(self):
        """A renamed run directory must not silently downgrade a topic to legacy."""
        rows = [row(f"R-{i:03d}", "Topic", "the-real-run-id") for i in range(6)]
        write_store(self.root, "some-other-directory-name", rows,
                    [chapter("ch-01", "Topic", [r["id"] for r in rows], 1)])
        out, page = build(self.root)
        unit = page_data(page)["units"][0]
        self.assertEqual(unit["state"], "ok",
                         "chapters were keyed to the directory, not to the rows")
        self.assertEqual(len(unit["chapters"]), 1)
        self.assertIn("NOTICED", out, "the mismatch must be disclosed, not absorbed")

    def test_two_runs_of_one_topic_are_two_units_under_one_index_entry(self):
        for tag in ("v01", "v02"):
            rows = [row(f"{tag}-{i:03d}", "Topic", f"topic-{tag}-2026-08-07")
                    for i in range(6)]
            write_store(self.root, f"topic-{tag}-2026-08-07", rows,
                        [chapter("ch-01", "Topic", [r["id"] for r in rows], 1)])
        data = page_data(build(self.root)[1])
        self.assertEqual(len(data["topicIndex"]), 1, "topics are the index, not runs")
        self.assertEqual(len(data["units"]), 2, "each run keeps its own structure")
        self.assertEqual(len(set(u["slug"] for u in data["units"])), 2,
                         "two units of one topic need distinguishable anchors")

    def test_same_day_runs_order_deterministically(self):
        """Both Terraform arms landed on one date; 'newest' must not be arbitrary."""
        for tag in ("v01", "v02"):
            rows = [row(f"{tag}-{i:03d}", "Topic", f"topic-{tag}-2026-08-07",
                        populated_at="2026-08-07") for i in range(6)]
            write_store(self.root, f"topic-{tag}-2026-08-07", rows,
                        [chapter("ch-01", "Topic", [r["id"] for r in rows], 1)])
        first = page_data(build(self.root)[1])["topicIndex"][0]["units"]
        for _ in range(3):
            self.assertEqual(page_data(build(self.root)[1])["topicIndex"][0]["units"],
                             first)


class RenderStates(StoreCase):
    """The real store has none of these. They were unexercised until now."""

    def test_legacy_run_has_no_chapters_and_still_builds(self):
        rows = [row(f"R-{i:03d}", "Topic", "run-a") for i in range(20)]
        write_store(self.root, "run-a", rows, None)          # no chapters.jsonl
        out, page = build(self.root)
        unit = page_data(page)["units"][0]
        self.assertEqual(unit["state"], "legacy")
        self.assertEqual(unit["n"], 20, "every legacy row must still be carried")

    def test_degraded_topic_renders_flat_and_the_build_still_succeeds(self):
        rows = [row(f"R-{i:03d}", "Topic", "run-a") for i in range(20)]
        bad = chapter("ch-01", "Topic", [r["id"] for r in rows[:10]], 1, because="short")
        ok = chapter("ch-02", "Topic", [r["id"] for r in rows[10:]], 2)
        write_store(self.root, "run-a", rows, [bad, ok])
        out, page = build(self.root)
        unit = page_data(page)["units"][0]
        self.assertEqual(unit["state"], "degraded")
        self.assertTrue(unit["failures"], "a degraded topic must name what failed")
        self.assertIn("render flat", out)

    def test_one_bad_topic_never_blocks_a_good_one(self):
        good = [row(f"G-{i:03d}", "Good topic", "run-a") for i in range(6)]
        bad = [row(f"B-{i:03d}", "Bad topic", "run-a") for i in range(20)]
        write_store(self.root, "run-a", good + bad, [
            chapter("ch-01", "Good topic", [r["id"] for r in good], 1),
            chapter("ch-02", "Bad topic", [r["id"] for r in bad], 1, because="short"),
        ])
        states = {u["topic"]: u["state"] for u in page_data(build(self.root)[1])["units"]}
        self.assertEqual(states["Good topic"], "ok")
        self.assertEqual(states["Bad topic"], "degraded")

    def test_empty_store_writes_a_page_and_exits_zero(self):
        out, page = build(self.root)
        self.assertIn("Nothing found", out)
        self.assertEqual(page_data(page)["units"], [])
        self.assertIn("STUDY_DATA", page)


class WhatThePageMayNotClaim(StoreCase):
    def _one_row(self, **kw):
        r = row("R-001", "Topic", "run-a", **kw)
        rows = [r] + [row(f"R-{i:03d}", "Topic", "run-a") for i in range(2, 7)]
        write_store(self.root, "run-a", rows,
                    [chapter("ch-01", "Topic", [x["id"] for x in rows], 1)])
        return build(self.root)[1], page_data(build(self.root)[1])["rows"][0]

    def test_nothing_can_draw_a_dead_link_state(self):
        """Nothing in the store records a link check, so nothing may draw one.

        Asserted against emittable markup — the class the renderer would write and the
        rule that would style it — not against prose. The source comments explain at
        length why this state is absent, and a substring match on "dead link" would
        flag that explanation as the defect it exists to prevent.
        """
        page, _ = self._one_row()
        for banned in ('srcstate dead', '.deadbox', '>dead link<', 'srcstate.dead'):
            self.assertNotIn(banned, page,
                             f"{banned!r} is in the page: the dead-link state is "
                             f"reachable, and the data cannot support it")

    def test_only_three_source_states_are_reachable(self):
        """Exactly three `srcstate` variants may exist, and no others."""
        page, _ = self._one_row()
        # class attributes the renderer writes, not CSS selectors that style them
        variants = {v.strip() for v in re.findall(r'class="srcstate([^"]*)"', page)} - {""}
        self.assertEqual(variants, {"unopened", "authored"},
                         "an unexpected source state exists; the bare class is "
                         "`source checked` and only two modifiers are legal")
        for label in ("source checked", "not opened", "authored"):
            self.assertIn(label, page, f"the {label!r} state is not reachable")

    def test_a_missing_quote_is_carried_as_empty_not_invented(self):
        _, r = self._one_row(quote=None)
        self.assertEqual(r["quote"], "")
        self.assertEqual(r["ev"], "re-opened",
                         "a row with no quote must not be relabelled as authored")

    def test_full_description_survives_untruncated(self):
        long = "x" * 2000
        _, r = self._one_row(description=long)
        self.assertEqual(r["d"], long, "descriptions must not be re-truncated to 300")

    def test_authored_rows_keep_their_non_url_origin(self):
        _, r = self._one_row(evidence="authored", origin="model inference")
        self.assertEqual(r["ev"], "authored")
        self.assertEqual(r["origin"], "model inference")

    def test_killed_and_merged_rows_stay_out_of_units(self):
        rows = ([row(f"R-{i:03d}", "Topic", "run-a") for i in range(6)]
                + [row("K-001", "Topic", "run-a", grade="killed"),
                   row("M-001", "Topic", "run-a", grade="merged")])
        write_store(self.root, "run-a", rows,
                    [chapter("ch-01", "Topic", [f"R-{i:03d}" for i in range(6)], 1)])
        page = build(self.root)[1]
        data = page_data(page)
        self.assertEqual(data["units"][0]["n"], 6)
        self.assertEqual(len(data["rows"]), 8, "the ledger keeps them; the unit does not")


class Disclosure(StoreCase):
    def test_an_unreadable_file_is_named_not_dropped(self):
        rows = [row(f"R-{i:03d}", "Topic", "run-a") for i in range(6)]
        write_store(self.root, "run-a", rows,
                    [chapter("ch-01", "Topic", [r["id"] for r in rows], 1)])
        with open(os.path.join(self.root, "runs", "run-a", "data", "guide-meta.json"),
                  "w", encoding="utf-8") as fh:
            fh.write("{ not json")
        out, page = build(self.root)
        self.assertIn("COULD NOT READ", out)
        self.assertTrue(page_data(page)["unreadable"])

    def test_size_accounting_is_always_printed(self):
        rows = [row(f"R-{i:03d}", "Topic", "run-a") for i in range(6)]
        write_store(self.root, "run-a", rows,
                    [chapter("ch-01", "Topic", [r["id"] for r in rows], 1)])
        out, _ = build(self.root)
        self.assertIn("embed cap", out)
        self.assertIn("bytes", out)


if __name__ == "__main__":
    unittest.main(verbosity=2)
