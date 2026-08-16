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

    def test_the_legend_does_not_claim_sources_disagreed(self):
        """"Sources disagree" is how slice 2's `choice` tier will be assigned — by an
        observed disagreement. The legacy `judgment` rows the "judgment call" label
        speaks for were assigned by failure signature, so a legend defining them by
        disagreement names a cause the data does not record."""
        page, _ = self._one_row()
        self.assertNotIn("Sources disagree", page,
                         "the legend claims a tier was assigned by source "
                         "disagreement; nothing in the store records one")

    def test_evidence_is_spoken_in_the_badge_vocabulary(self):
        """The search chips and hit tags filter on the stored enum but must not SHOW
        it: `re-opened` on a chip and `source checked` on the badge it filters is the
        same fact wearing two names, one of them pipeline vocabulary. The map ships
        from the build so a new evidence value cannot arrive unlabelled."""
        page, _ = self._one_row()
        data = page_data(page)
        self.assertEqual(set(data["evLabel"]), set(data["filters"]["ev"]),
                         "every evidence value must carry a reader-facing label")
        self.assertEqual(data["evLabel"],
                         {"re-opened": "source checked", "asserted": "not opened",
                          "authored": "authored"},
                         "the filter must speak the same words as the badge it filters")

    def test_a_missing_quote_is_carried_as_empty_not_invented(self):
        _, r = self._one_row(quote=None)
        self.assertEqual(r["quote"], "")
        self.assertEqual(r["ev"], "re-opened",
                         "a row with no quote must not be relabelled as authored")

    def test_full_description_survives_untruncated(self):
        """`d` is now a LIST of paragraphs rather than a string — the build reflows long
        prose at sentence boundaries. The guarantee this test exists for is unchanged:
        joining the paragraphs must return every character that was stored."""
        long = "x" * 2000
        _, r = self._one_row(description=long)
        self.assertEqual(" ".join(r["d"]), long,
                         "descriptions must not be re-truncated to 300")

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


class ApparatusPlacement(StoreCase):
    """Where the editorial text sits, and where absence is stated.

    The contents view has one job — show the shape of a whole topic — and it lost that
    job to its own apparatus. A median 476-character warrant under a median 105-character
    title made every chapter row ~220px, so a 13-chapter topic ran several screens. The
    warrant is a headnote and belongs at the top of the chapter it introduces, not on the
    line you scan to choose one.

    Absence moved the same way. 178 of 230 rows have no quote and 117 no tier reason, so
    "this is missing" was the most repeated text in the product. It is also a run-scoped
    fact — one run stored 0 of 117 quotes, another 52 of 58 — so it is stated once per
    topic and counted here.
    """

    def _store(self, **rowkw):
        rows = [row(f"R-{i:03d}", "Topic", "run-a", **rowkw) for i in range(6)]
        write_store(self.root, "run-a", rows,
                    [chapter("ch-01", "Topic", [r["id"] for r in rows], 1)])
        return build(self.root)[1]

    def test_the_warrant_is_not_on_the_collapsed_contents_line(self):
        """Asserted against emittable markup, like the dead-link guard above."""
        page = self._store()
        self.assertNotIn('class="ch-b"', page,
                         "the chapter warrant is back on the contents line; that is the "
                         "wall DESIGN §2 exists to prevent")
        self.assertIn('class="ch-head"', page,
                      "the warrant must still render — as the chapter's headnote")

    def test_absence_is_never_stated_on_a_row(self):
        """Matches reader-facing prose, so the source comments explaining this change
        must not quote these sentences verbatim — the inlined assets are part of the
        page. Same hazard as the dead-link guard, which is why that one matches markup
        instead. Here the exact sentences are the thing being banned, so prose it is."""
        page = self._store(quote=None, depth_check=None)
        for banned in ("No quote captured for this row",
                       "did not record why it sits at that tier",
                       "No practice was authored for this chapter"):
            self.assertNotIn(banned, page,
                             f"{banned!r} is emitted per row or per chapter; absence is "
                             f"stated once per topic in the run strip")

    def test_the_run_strip_counts_what_the_run_did_not_store(self):
        """Dropping the per-row line may not drop the fact. It is carried as a count."""
        rows = ([row(f"Q-{i:03d}", "Topic", "run-a", quote="the source sentence",
                     depth_check="operation, not orientation") for i in range(2)]
                + [row(f"R-{i:03d}", "Topic", "run-a", quote=None, depth_check=None)
                   for i in range(4)]
                + [row("D-001", "Topic", "run-a", type="drill", evidence="authored",
                       origin="model inference")])
        write_store(self.root, "run-a", rows,
                    [chapter("ch-01", "Topic", [r["id"] for r in rows], 1)])
        u = page_data(build(self.root)[1])["units"][0]
        self.assertEqual(u["n"], 7)
        self.assertEqual(u["quoted"], 2, "quotes are counted once for the unit")
        self.assertEqual(u["tiered"], 2, "tier reasons are counted once for the unit")
        self.assertEqual(u["prac"], 1, "drills and exercises are counted for the unit")

    def test_a_quote_still_renders_where_one_exists(self):
        """Consolidating the absence must not consolidate away the presence."""
        page = self._store(quote="the exact supporting sentence")
        self.assertIn("the exact supporting sentence", page)


class RunStrip(StoreCase):
    """When the run-quality strip opens itself, and when it only changes colour.

    DESIGN §8's decided triggers for auto-expansion are structural — gates failed,
    legacy, an empty tier. An unopened source is deliberately NOT one: it colours the
    strip and leads its collapsed line, but auto-opening on it meant a run with one
    asserted source among 58 checked ones paid its entire first screen for a fact the
    collapsed line already states, against §2's shape-without-scrolling promise.
    The policy lives in the build (stripFlag / stripOpen) so it is testable here.
    """

    def _unit(self, rows, chapters):
        write_store(self.root, "run-a", rows, chapters)
        return page_data(build(self.root)[1])["units"][0]

    def _rows(self, **kw):
        # Every depth present, so no tier is empty unless a test empties one.
        return [row(f"R-{i:03d}", "Topic", "run-a",
                    depth=["orientation", "operation", "judgment", "mechanism"][i % 4],
                    **kw) for i in range(8)]

    def test_a_healthy_run_is_quiet(self):
        rows = self._rows()
        u = self._unit(rows, [chapter("ch-01", "Topic", [r["id"] for r in rows], 1)])
        self.assertFalse(u["stripFlag"])
        self.assertFalse(u["stripOpen"])

    def test_an_unopened_source_colours_the_strip_but_does_not_open_it(self):
        rows = self._rows()
        rows[0]["evidence"] = "asserted"
        u = self._unit(rows, [chapter("ch-01", "Topic", [r["id"] for r in rows], 1)])
        self.assertTrue(u["stripFlag"], "an incomplete run must not look healthy")
        self.assertFalse(u["stripOpen"],
                         "one unopened source must not spend the reader's first screen")

    def test_an_empty_tier_opens_the_strip(self):
        rows = [row(f"R-{i:03d}", "Topic", "run-a", depth="operation") for i in range(8)]
        u = self._unit(rows, [chapter("ch-01", "Topic", [r["id"] for r in rows], 1)])
        self.assertTrue(u["stripOpen"], "an empty tier is a structural gap; it cannot hide")

    def test_legacy_and_degraded_open_the_strip(self):
        u = self._unit(self._rows(), None)                       # no chapters: legacy
        self.assertTrue(u["stripOpen"])
        rows = self._rows()
        bad = chapter("ch-01", "Topic", [r["id"] for r in rows], 1, because="short")
        u = self._unit(rows, [bad])                              # gates fail: degraded
        self.assertTrue(u["stripOpen"])


class PerItemNotes(StoreCase):
    """The editorial hinge under an item's label — optional, and silent when absent.

    Stored on the chapter, not the row, and that is the load-bearing choice: rows.jsonl is
    append-only so it cannot be backfilled, chapters.jsonl is safe to regenerate, and a
    note describes the (chapter, row) pairing rather than the row — a re-run that groups
    differently needs a different note.
    """

    def _build(self, notes, members=None):
        rows = [row(f"R-{i:03d}", "Topic", "run-a") for i in range(6)]
        ch = chapter("ch-01", "Topic", members or [r["id"] for r in rows], 1, notes=notes)
        write_store(self.root, "run-a", rows, [ch])
        return build(self.root)

    def test_a_note_reaches_the_page_keyed_to_its_member(self):
        out, page = self._build({"R-002": "Once the commit point is fixed, this is what "
                                          "the interval does to it."})
        u = page_data(page)["units"][0]
        self.assertEqual(u["chapters"][0]["notes"],
                         {"R-002": "Once the commit point is fixed, this is what the "
                                   "interval does to it."})
        self.assertNotIn("warn", out.lower().replace("warnings", ""))

    def test_a_chapter_with_no_notes_carries_an_empty_map_not_a_placeholder(self):
        _, page = self._build(None)
        self.assertEqual(page_data(page)["units"][0]["chapters"][0]["notes"], {})

    def test_absence_draws_nothing(self):
        """§3d's lesson, applied before it can be repeated: no 'no note recorded' line."""
        _, page = self._build({"R-000": "A note on the first item only."})
        for banned in ("no note", "No note", "not annotated", "nothing was noted"):
            self.assertNotIn(banned, page)

    def test_a_note_for_a_non_member_warns_and_never_renders(self):
        out, page = self._build({"R-999": "keyed to a row that is not in this chapter"})
        self.assertEqual(page_data(page)["units"][0]["chapters"][0]["notes"], {},
                         "a note must not render against a row that is not a member")
        self.assertEqual(page_data(page)["units"][0]["state"], "ok",
                         "a misfiled note may not render a whole topic flat")
        self.assertIn("not a member", out)

    def test_a_note_long_enough_to_replace_its_item_warns_and_still_renders(self):
        """The failure is substitution — a reader settling for the note. It warns rather
        than fails, because one wordy sentence must not flatten 12 good chapters."""
        long_note = "This item " + "and a great deal more besides " * 12
        out, page = self._build({"R-001": long_note})
        u = page_data(page)["units"][0]
        self.assertEqual(u["state"], "ok")
        self.assertEqual(u["chapters"][0]["notes"]["R-001"], long_note)
        self.assertIn("over the", out)

    def test_a_malformed_notes_field_warns_and_does_not_crash_the_build(self):
        out, page = self._build(["not", "an", "object"])
        self.assertEqual(page_data(page)["units"][0]["chapters"][0]["notes"], {})
        self.assertIn("not an object keyed by row id", out)


class Reflow(unittest.TestCase):
    """Long descriptions become paragraphs. No word changes and no sentence is split.

    Zero of 230 stored descriptions contain a line break and 53 render as 13+ unbroken
    lines, the longest at 35. The reflow is typographic only, so the binding property is
    that joining the output returns the input — asserted on every case below.
    """

    def setUp(self):
        sys.path.insert(0, HERE)
        import build_index
        self.paras = build_index.paragraphs

    def _roundtrip(self, text):
        """The invariant, stated exactly: rejoining the paragraphs returns every
        character of the input, with runs of whitespace collapsed to one space. That is
        what typographic reflow means, and it is the only thing this may do. An earlier
        version failed it on 25 of 230 real rows by eating the closing quote at a
        sentence boundary — a character no synthetic fixture happened to contain."""
        out = self.paras(text)
        self.assertEqual(" ".join(out), " ".join(text.split()),
                         "reflow changed the text; it may only decide where paragraphs end")
        return out

    def test_short_prose_stays_one_paragraph(self):
        text = "One sentence. Then a second one. And a third to finish it off."
        self.assertEqual(self._roundtrip(text), [text])

    def test_long_prose_breaks_at_sentence_boundaries(self):
        s = ("The coordinator waits for a heartbeat before declaring a member dead and "
             "starting a rebalance across the whole group. ")
        out = self._roundtrip((s * 6).strip())
        self.assertGreater(len(out), 1, "a six-sentence wall must not stay one paragraph")
        for p in out:
            self.assertTrue(p.endswith("."), f"paragraph ends mid-sentence: {p[-40:]!r}")

    def test_one_enormous_sentence_is_left_alone(self):
        """A single 900-character sentence exists in the real store. Nothing can help it,
        and cutting mid-sentence would be worse than the wall."""
        text = "This clause runs on and on " * 40
        self.assertEqual(len(self.paras(text)), 1)

    def test_an_abbreviation_does_not_end_a_paragraph(self):
        text = ("Consumers may lag behind the log end, e.g. when a handler blocks on a "
                "slow downstream call for longer than the poll interval allows. " * 4)
        for p in self._roundtrip(text.strip()):
            self.assertFalse(p.endswith("e.g."), "split after an abbreviation")

    def test_a_dotted_config_key_is_never_a_boundary(self):
        text = ("Setting max.poll.interval.ms above the handler's worst case keeps the "
                "member alive while it works through a slow batch of records. " * 5)
        for p in self._roundtrip(text.strip()):
            self.assertNotIn("max.poll.interval.\n", p)
            self.assertFalse(p.rstrip().endswith("max.poll.interval.ms above the"))

    def test_a_short_tail_joins_the_paragraph_above_rather_than_dangling(self):
        body = ("The group coordinator tracks every member of the consumer group and "
                "revokes partitions when one of them stops sending heartbeats. " * 5)
        out = self._roundtrip((body + "It stops there.").strip())
        self.assertNotEqual(out[-1], "It stops there.",
                            "a 16-character orphan paragraph should have been absorbed")

    def test_a_closing_quote_at_a_boundary_is_not_eaten(self):
        """The real-data bug. Every quote mark that went in must come out."""
        text = ('The page states only that state exists to "keep track of metadata." '
                'The row attributes a mechanism the source never gives, so the clause '
                'is an unsourced rationale under prohibition two. ') * 3
        out = self._roundtrip(text.strip())
        self.assertEqual(sum(p.count('"') for p in out), text.count('"'))

    def test_empty_description_is_one_empty_paragraph(self):
        self.assertEqual(self.paras(""), [""])
        self.assertEqual(self.paras(None), [""])

    def test_every_row_in_the_real_store_survives_reflow(self):
        """The synthetic fixtures above missed a defect that 230 real rows caught."""
        store = os.path.expanduser("~/.claude/study/runs")
        if not os.path.isdir(store):
            self.skipTest("no local study store on this machine")
        sys.path.insert(0, HERE)
        import build_index
        checked = 0
        for run in os.listdir(store):
            final = os.path.join(store, run, "data", "final.jsonl")
            if not os.path.exists(final):
                continue
            with open(final, encoding="utf-8") as fh:
                for line in fh:
                    if not line.strip():
                        continue
                    r = json.loads(line)
                    if r.get("grade") in ("killed", "merged"):
                        continue
                    prose = build_index.split_ledger(r.get("description") or "")[0]
                    self.assertEqual(" ".join(build_index.paragraphs(prose)),
                                     " ".join(prose.split()),
                                     f"row {r.get('id')} lost or gained text in reflow")
                    checked += 1
        self.assertGreater(checked, 0)


class LedgerSplit(unittest.TestCase):
    """Stage bookkeeping must leave the reader's prose and land in its own channel.

    35 live descriptions in the real store end in a bracketed audit verdict and one opens
    with a merge tag. The same verdicts are already in `audit-verdicts.jsonl`, so the
    append was a duplicate as well as a defect — but nothing may be dropped on the way
    out, so the split returns both halves and the page renders both.
    """

    def setUp(self):
        sys.path.insert(0, HERE)
        import build_index
        self.split = build_index.split_ledger

    def test_a_terminal_audit_block_leaves_the_prose(self):
        prose, tag, note = self.split(
            "The setting only activates when there is no committed offset. "
            "[AUDIT viable->wounded: the cited page documents FOUR values; the row "
            "presents only two.]")
        self.assertEqual(prose,
                         "The setting only activates when there is no committed offset.")
        self.assertEqual(tag, "AUDIT")
        self.assertIn("documents FOUR values", note)

    def test_a_leading_merge_tag_does_not_swallow_the_prose(self):
        """`[MERGED FROM A-040] real prose…` — the one non-terminal shape in the store."""
        prose, tag, note = self.split("[MERGED FROM A-040] The underlying reason is that "
                                      "a Streams application reads two topics.")
        self.assertEqual(prose, "The underlying reason is that a Streams application "
                                "reads two topics.")
        self.assertEqual(tag, "MERGED")
        self.assertEqual(note, "FROM A-040")

    def test_every_tag_in_the_store_is_recognised(self):
        for tag in ("AUDIT", "VERIFY", "ABSENCE", "MERGE"):
            prose, got, note = self.split(f"Reader prose. [{tag}: the verdict text.]")
            self.assertEqual(prose, "Reader prose.", f"{tag} was not split off")
            self.assertEqual(got, tag)

    def test_a_row_with_no_annotation_is_returned_untouched(self):
        text = "A plain description with [brackets] that are not a stage tag."
        self.assertEqual(self.split(text), (text, "", ""))

    def test_an_unbalanced_block_is_left_exactly_as_written(self):
        """Better to show one ugly row than to guess where a malformed block ends."""
        text = "Prose here. [AUDIT: someone forgot the closing bracket"
        self.assertEqual(self.split(text), (text, "", ""))

    def test_the_note_is_carried_to_the_page_not_discarded(self):
        root = tempfile.mkdtemp(prefix="study-ledger-test-")
        self.addCleanup(shutil.rmtree, root, ignore_errors=True)
        rows = [row(f"R-{i:03d}", "Topic", "run-a") for i in range(6)]
        rows[0]["description"] = "Reader prose. [AUDIT: the verdict text.]"
        write_store(root, "run-a", rows,
                    [chapter("ch-01", "Topic", [r["id"] for r in rows], 1)])
        r = page_data(build(root)[1])["rows"][0]
        self.assertEqual(r["d"], ["Reader prose."])   # `d` is a list of paragraphs
        self.assertEqual(r["note"], "the verdict text.")
        self.assertEqual(r["noteTag"], "AUDIT")


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
