/* Study library — index.html behavior.
   Inlined into the output by build_index.py; expects `window.STUDY_DATA` to be
   defined by an earlier <script> tag. No globals are exported.

   The topic view is the product: a topic is a numbered contents view of chapters,
   a chapter expands to its items in reading order, an item expands in place to its
   description, quote, classification and the link out to the firsthand source. The
   markup is the one in study-read/design/topic-view-prototype.html; every repeated
   block below emits exactly that shape from one record.

   Every disclosure is a native <details>, so keyboard and screen-reader behaviour
   come free and a JS reimplementation cannot lose them.

   Units, in order: utilities → markdown renderer → indexes → routing → rail →
   topic view → document view → home + search → boot. */
(function () {
  "use strict";

  var DATA = window.STUDY_DATA;
  var DOCS = DATA.docs, ROWS = DATA.rows, GROUPS = DATA.groups;
  var UNITS = DATA.units, TOPIC_INDEX = DATA.topicIndex;
  var FILTERS = DATA.filters; // { type: [...], depth: [...], ev: [...] }
  /* Evidence spoken in the badge's words. The chips and hit tags filter on the raw
     enum but must not SHOW it: "re-opened" on the chip and "source checked" on the
     badge it filters is the same fact wearing two names, and only one of them is a
     name a stranger can parse. The map ships from the build (EV_LABEL) so a new
     evidence value cannot arrive unlabelled — a test holds the two vocabularies equal. */
  var EV_LABEL = DATA.evLabel || {};
  function evLabel(v) { return EV_LABEL[v] || v; }

  /* ---------- utilities ---------- */

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function plural(n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); }

  /* '2026-08-06T…' -> '6 Aug 2026'. Store dates are ISO; anything else passes through. */
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function niceDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
    if (!m) return s || "";
    return +m[3] + " " + MONTHS[+m[2] - 1] + " " + m[1];
  }

  /* Readable link text for a bare URL — there are no stored source titles, so the
     URL itself is the honest label. Long paths keep the host and the last segment. */
  function linkText(url) {
    var s = String(url || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (s.length <= 62) return s;
    var parts = s.split("/");
    return parts.length > 2 ? parts[0] + "/…/" + parts[parts.length - 1] : s.slice(0, 61) + "…";
  }
  function host(url) {
    var m = /^https?:\/\/([^/]+)/.exec(String(url || ""));
    return m ? m[1] : "";
  }

  /* The disclosure marker, shared by every <details> on the page. */
  var MARK = '<svg class="mark" viewBox="0 0 8 10" aria-hidden="true">' +
    '<path d="M1 1l5 4-5 4" fill="none" stroke="currentColor" stroke-width="1.6" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ---------- markdown renderer ----------
     Block rules, tried in order per line: fenced code, table, ATX heading,
     horizontal rule, list (with nesting + wrapped continuation lines),
     blockquote, paragraph (consecutive plain lines merged). */

  var Markdown = (function () {
    var LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
    var HR_RE = /^\s*([-*_])(\s*\1){2,}\s*$/;
    // Lines that terminate a paragraph or a list-item continuation.
    var BLOCK_RE = /^\s*(#{1,6}\s|```|>|\||[-*+]\s|\d+[.)]\s)/;

    function inline(s) {
      return esc(s)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+(?:\*[^*]+)*)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
    }

    /* Collect one whole list block into flat item records:
       {indent, ordered, num, text}. Wrapped lines are folded into the item
       they continue; a blank line ends the list unless more items follow. */
    function collectItems(L, i) {
      var items = [], last = null;
      while (i < L.length) {
        var l = L[i];
        if (!l.trim()) {
          var j = i + 1;
          while (j < L.length && !L[j].trim()) j++;
          if (j < L.length && LIST_RE.test(L[j])) { i = j; continue; }
          break;
        }
        var m = l.match(LIST_RE);
        if (m) {
          last = { indent: m[1].length, ordered: /^\d/.test(m[2]),
                   num: parseInt(m[2], 10) || 1, text: m[3] };
          items.push(last);
          i++;
          continue;
        }
        if (last && !BLOCK_RE.test(l) && !HR_RE.test(l)) { // wrapped continuation
          last.text += " " + l.trim();
          i++;
          continue;
        }
        break;
      }
      return { items: items, next: i };
    }

    /* Render item records into (possibly nested) lists. Deeper indent nests
       inside the previous item; ordered lists that resume keep their number. */
    function renderItems(items, pos, indent) {
      var first = items[pos];
      var tag = first.ordered ? "ol" : "ul";
      var html = "<" + tag +
        (first.ordered && first.num > 1 ? ' start="' + first.num + '"' : "") + ">";
      var k = pos, open = false;
      while (k < items.length && items[k].indent >= indent) {
        if (items[k].indent > indent && open) {
          var sub = renderItems(items, k, items[k].indent);
          html += sub.html;
          k = sub.next;
          continue;
        }
        if (items[k].ordered !== first.ordered && items[k].indent === indent) break;
        if (open) html += "</li>";
        html += "<li>" + inline(items[k].text);
        open = true;
        k++;
      }
      if (open) html += "</li>";
      return { html: html + "</" + tag + ">", next: k };
    }

    function render(src) {
      var L = src.split("\n"), out = [], i = 0, m;
      while (i < L.length) {
        var l = L[i];
        if (!l.trim()) { i++; continue; }

        if (/^```/.test(l)) {                                    // fenced code
          var code = []; i++;
          while (i < L.length && !/^```/.test(L[i])) code.push(L[i++]);
          i++;
          out.push("<pre><code>" + esc(code.join("\n")) + "</code></pre>");
          continue;
        }
        if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < L.length &&      // table
            /^\s*\|[\s:|-]+\|\s*$/.test(L[i + 1])) {
          var cells = function (r) {
            return r.trim().replace(/^\||\|$/g, "").split("|")
              .map(function (c) { return c.trim(); });
          };
          var head = cells(l), body = [];
          i += 2;
          while (i < L.length && /^\s*\|.*\|\s*$/.test(L[i])) body.push(cells(L[i++]));
          out.push('<div class="table-wrap"><table><thead><tr>' +
            head.map(function (h) { return '<th scope="col">' + inline(h) + "</th>"; }).join("") +
            "</tr></thead><tbody>" +
            body.map(function (r) {
              return "<tr>" + r.map(function (c) { return "<td>" + inline(c) + "</td>"; }).join("") + "</tr>";
            }).join("") + "</tbody></table></div>");
          continue;
        }
        if ((m = l.match(/^(#{1,6})\s+(.*)$/))) {                // heading
          out.push("<h" + m[1].length + ">" + inline(m[2]) + "</h" + m[1].length + ">");
          i++;
          continue;
        }
        if (HR_RE.test(l)) { out.push("<hr>"); i++; continue; }  // rule
        if (LIST_RE.test(l)) {                                   // list
          var block = collectItems(L, i);
          i = block.next;
          var pos = 0;
          while (pos < block.items.length) {
            var r = renderItems(block.items, pos, block.items[pos].indent);
            out.push(r.html);
            pos = r.next;
          }
          continue;
        }
        if ((m = l.match(/^>\s?(.*)$/))) {                       // blockquote
          var q = [m[1]]; i++;
          while (i < L.length && /^>\s?/.test(L[i])) q.push(L[i++].replace(/^>\s?/, ""));
          out.push("<blockquote>" + render(q.join("\n")) + "</blockquote>");
          continue;
        }
        var p = [l]; i++;                                        // paragraph
        while (i < L.length && L[i].trim() && !BLOCK_RE.test(L[i]) && !HR_RE.test(L[i]))
          p.push(L[i++]);
        out.push("<p>" + inline(p.join(" ")) + "</p>");
      }
      return out.join("\n");
    }

    return { render: render };
  })();

  /* ---------- indexes ----------
     Row ids are unique within a topic, not globally, so every lookup keys on the
     run as well. Two runs of the same topic genuinely reuse id shapes. */

  var LIVE = ROWS.filter(function (r) { return r.grade !== "killed" && r.grade !== "merged"; });
  var ROW_BY = {};
  LIVE.forEach(function (r) { ROW_BY[r.run + "\t" + r.id] = r; });

  var UNIT_BY_SLUG = {}, UNIT_BY_KEY = {};
  UNITS.forEach(function (u) { UNIT_BY_SLUG[u.slug] = u; UNIT_BY_KEY[u.key] = u; });

  var UNIT_ROWS = {};                       // unit slug -> its live rows, store order
  LIVE.forEach(function (r) {
    var u = UNIT_BY_KEY[r.run + "\t" + r.topic];
    if (!u) return;
    (UNIT_ROWS[u.slug] = UNIT_ROWS[u.slug] || []).push(r);
  });

  function unitOfRow(r) { return UNIT_BY_KEY[r.run + "\t" + r.topic]; }
  function unitsOfTopic(t) {
    return t.units.map(function (s) { return UNIT_BY_SLUG[s]; }).filter(Boolean);
  }

  /* ---------- routing ----------
     #/home · #/doc/<i> · #/t/<unitSlug>[/<chapterId>[/<rowId>]]
     The chapter and row segments are what a search hit deep-links to; "_" stands
     for "this row is in no chapter", which is legal for a legacy run. */

  function topicHref(slug, ch, row) {
    var h = "#/t/" + encodeURIComponent(slug);
    if (ch || row) h += "/" + encodeURIComponent(ch || "_");
    if (row) h += "/" + encodeURIComponent(row);
    return h;
  }

  function parseHash() {
    var parts = (location.hash || "").replace(/^#\/?/, "").split("/").map(decodeURIComponent);
    if (parts[0] === "t" && parts[1]) {
      return { view: "topic", slug: parts[1], ch: parts[2] || "", row: parts[3] || "" };
    }
    if (parts[0] === "doc" && parts[1] !== undefined) return { view: "doc", i: +parts[1] };
    return { view: "home" };
  }

  var main = document.getElementById("main");
  var nav = document.getElementById("nav");
  var q = document.getElementById("q");

  /* ---------- rail ---------- */

  function buildRail() {
    var html = TOPIC_INDEX.length ? '<p class="shelf">All topics · A–Z</p>' : "";
    TOPIC_INDEX.forEach(function (t) {
      var us = unitsOfTopic(t);
      if (!us.length) return;
      var first = us[0];                                  // newest run of this topic
      var sub = niceDate(first.date) + " · " + plural(first.n, "item") +
        (us.length > 1 ? " · " + plural(us.length, "run") : "");
      html += '<a class="rail-item" data-slug="' + esc(first.slug) + '" href="' +
        topicHref(first.slug) + '">' + esc(t.name) +
        '<span class="sub">' + esc(sub) + "</span></a>";
    });

    var withDocs = GROUPS.filter(function (g) {
      return DOCS.some(function (d) { return d.g === g; });
    });
    if (withDocs.length) {
      html += '<p class="shelf">Reports</p>';
      withDocs.forEach(function (g) {
        DOCS.filter(function (d) { return d.g === g; }).forEach(function (d) {
          html += '<a class="rail-item" data-doc="' + d.i + '" href="#/doc/' + d.i + '">' +
            esc(d.label) + '<span class="sub">' + esc(g) + "</span></a>";
        });
      });
    }
    nav.innerHTML = html;
  }

  function markRail(pred) {
    nav.querySelectorAll(".rail-item").forEach(function (a) {
      if (pred(a)) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  /* ---------- topic view ---------- */

  /* Exactly three source states exist in this data, and no other state may be drawn.
     Nothing in the store records a link check or a 404, so there is no dead-link
     state to render — inventing one would be a claim with no cause behind it. */
  function srcState(r) {
    if (r.ev === "authored") return '<span class="srcstate authored"><span class="g"></span>authored</span>';
    if (r.ev === "asserted") return '<span class="srcstate unopened"><span class="g"></span>not opened</span>';
    return '<span class="srcstate"><span class="g"></span>source checked</span>';
  }

  /* The quote block, drawn only when there is a quote.
     A stated absence was the right rule and the wrong volume: 178 of 230 live rows
     carry no quote, so the line announcing that was the single most repeated sentence
     in the product, three items in every four. The absence is also near-uniform
     WITHIN a run (one run stored 0 of 117, another 52 of 58), which makes it a fact about
     the run, not about the item. It moves to the run strip, stated once. Nothing is
     concealed: which kind of absence it is was always readable off the source-state badge
     already on the row — `not opened` and `authored` say it themselves. */
  function quoteBlock(r) {
    return r.quote ? "<blockquote>“" + esc(r.quote) + "”</blockquote>" : "";
  }

  /* Same rule for the tier reason: 117 of 230 rows have none, and where one run recorded
     all 58 another recorded none of 117. The classification itself always renders; only
     the sentence announcing its absence moves to the run strip. */
  function classifLine(r) {
    var kind = r.type || "item";
    var when = r.when || "unclassified";
    return '<p class="classif">A <b>' + esc(kind) + "</b>, tagged <b>" + esc(when) + "</b>." +
      (r.why ? " " + esc(r.why) : "") + "</p>";
  }

  function sourceLine(r) {
    if (r.ev === "authored") {
      return '<p class="src">Authored for this study run · no external source · ' +
        esc(r.origin || "model inference") + "</p>";
    }
    if (!r.origin) {
      return '<p class="src">No source recorded for this row.</p>';
    }
    var tail = r.ev === "asserted"
      ? ' · <span class="flagged">named, never opened</span>'
      : " · opened and confirmed " + esc(niceDate(r.at));
    var text = linkText(r.origin), h = host(r.origin);
    return '<p class="src">From <a href="' + esc(r.origin) + '" target="_blank" ' +
      'rel="noopener noreferrer">' + esc(text) + "</a>" +
      // the link text is the URL, so it already leads with the host unless it was
      // elided; only name the domain separately when the text does not show it
      (h && text.indexOf(h) !== 0 ? " · " + esc(h) : "") + tail + "</p>";
  }

  /* Pipeline bookkeeping, pulled back out of the reader's prose.
     35 live descriptions end in a bracketed block — `[AUDIT viable->wounded: …]`,
     `[ABSENCE: …]`, `[VERIFY: …]` — and one opens with `[MERGED FROM A-040]`. Those are
     the audit stage's verdict on the row, and the same verdict is already recorded in
     the run's `audit-verdicts.jsonl`. Writing it into `description` as well put stage
     state in the middle of the sentence a reader is trying to read.

     This is a presentation fix over unmigrated data: `rows.jsonl` is append-only and is
     not touched. The note is not dropped either — DESIGN §2's rule is that traceable
     means reachable in a known number of clicks, not visible by default, so it becomes
     its own disclosure on the item. The pipeline stops writing it into the prose going
     forward; see study/references/analysis-topic-knowledge.md.

     The split itself is done by `split_ledger()` in build_index.py, so `r.d` arrives here
     as reader prose and `r.note` / `r.noteTag` carry the verdict. It lives there rather
     than here because it is testable without a browser. */
  var LEDGER_LABEL = { AUDIT: "Audit note", VERIFY: "Verification note",
                       ABSENCE: "Absence note", MERGE: "Merge note",
                       MERGED: "Merge note" };

  function ledgerBlock(r) {
    var parts = [];
    if (r.grade && r.grade !== "viable") {
      parts.push("<p>This row is graded <b>" + esc(r.grade) + "</b> by the audit stage, " +
        "which re-opened its source independently of the harvest that wrote it.</p>");
    }
    if (r.note) {
      parts.push("<p>" + esc(r.note) + "</p>");
    }
    if (!parts.length) return "";
    var label = LEDGER_LABEL[r.noteTag] || "Audit note";
    return '<details class="ledger"><summary>' + MARK + esc(label) + "</summary>" +
      '<div class="ledger-body">' + parts.join("") + "</div></details>";
  }

  /* The item, and the editorial line that makes a chapter read as taught.
     `subject` is a scanning label — 137 of 230 are short noun phrases like "Purpose of
     Terraform state" — and `description` is a faithful summary of the source. Neither
     says why the item is here, in this chapter, at this point in the order. Without that
     line an opened chapter is an index with correct entries.

     `note` is a hinge: it relates the item to what came before it, to the chapter's
     principle, or to what is easy to read past in it. Never a summary — the summary is
     one expansion below and is longer. It sits on the scannable row rather than in the
     expanded body because the row is where the index reads as an index.

     Absent on every chapter written before the field existed, and nothing renders where
     there is none. Omitting one is a legal result, so there is no absent-state line
     here — that lesson is §3d, one commit ago. */
  function itemHtml(r, openRow, note) {
    var open = openRow === r.id ? " open" : "";
    return '<details class="it" id="row-' + esc(r.id) + '"' + open + ">" +
      "<summary>" + MARK + "<span>" +
      '<h3 class="it-t">' + esc(r.subject) + "</h3>" +
      (note ? '<span class="it-note">' + esc(note) + "</span>" : "") +
      '<span class="it-tags"><span class="when">' + esc(r.when || "unclassified") + "</span>" +
      srcState(r) + "</span></span></summary>" +
      '<div class="it-body">' +
      // `d` is a list of paragraphs; the build reflowed it at sentence boundaries and
      // changed no word. Joining with a space restores the stored text exactly.
      r.d.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") +
      quoteBlock(r) + classifLine(r) + sourceLine(r) + ledgerBlock(r) +
      "</div></details>";
  }

  /* Practice, drawn only where there is some. 19 of 47 chapters hold no drill or
     exercise row, and the `practicum` record type is designed but not built at all, so
     the "none was authored" line was on every chapter of a topic that has no practicum
     anywhere. That is a fact about the pipeline, and it is stated once in the run strip.
     Where a chapter DOES hold drill or exercise rows, those are its practice under this
     schema and saying so is worth a line. */
  function practiceLine(rows) {
    var n = rows.filter(function (r) { return r.type === "drill" || r.type === "exercise"; }).length;
    if (!n) return "";
    return '<p class="prac">Practice for this chapter is the ' +
      plural(n, "drill or exercise item") + " listed above.</p>";
  }

  /* The chapter, and the one placement decision this view turns on.
     `because` is the chapter's HEADNOTE — the editorial paragraph that says why these
     items sit together and what to notice — and it belongs where an editor puts a
     headnote: at the top of the section it introduces, read once you have opened it.
     It was on the collapsed contents line, where a median 476 characters of warrant
     under a median 105-character title made every chapter ~220px tall and put the shape
     of a 13-chapter topic several screens deep. DESIGN §2 promises "the shape of the
     whole topic without scrolling" and the contents view could not deliver it.
     The title still carries the contents line alone, which is design rule 5's own test:
     these are claim sentences, not category labels, so they can. */
  function chapterHtml(c, n, u, openCh, openRow) {
    var rows = c.members.map(function (m) { return ROW_BY[u.run + "\t" + m]; }).filter(Boolean);
    var open = openCh === c.id ? " open" : "";
    var meta = (c.kind === "reference" ? "reference · " : "") +
      plural(rows.length, "item") + (c.mins ? " · " + c.mins + "m" : "");
    return '<details class="ch" id="ch-' + esc(c.id) + '"' + open + ">" +
      "<summary>" + MARK +
      '<span class="ch-n">' + n + "</span>" +
      '<h2 class="ch-t">' + esc(c.principle) + "</h2>" +
      '<span class="ch-m">' + esc(meta) + "</span></summary>" +
      (c.because ? '<p class="ch-head">' + esc(c.because) + "</p>" : "") +
      '<div class="items">' + rows.map(function (r) {
        return itemHtml(r, openRow, (c.notes || {})[r.id]);
      }).join("") +
      "</div>" + practiceLine(rows) + "</details>";
  }

  /* The run-quality strip. Quiet when the run is healthy, open when it is not: a
     complete run gets out of the way, an incomplete one cannot hide.

     FLAG and OPEN are decided by the build (u.stripFlag / u.stripOpen), not here, so
     the policy is testable without a browser. They differ on unopened sources: those
     colour the strip and lead its collapsed line, but only a structural problem —
     gates failed, legacy, an empty tier — expands it. Auto-opening on one asserted
     source among 58 checked ones spent the whole first screen restating what the
     collapsed line already says, against §2's shape-without-scrolling promise. */
  function runStrip(u) {
    var empty = u.tiers.filter(function (t) { return !t.n; });
    var head;
    if (u.state === "legacy") head = "this run predates chaptering";
    else if (u.state === "degraded") head = "chapter structure did not pass its gates";
    else if (empty.length) head = (empty.length === 1 ? "one tier" : empty.length + " tiers") +
      " came back empty";
    else if (u.unver) head = plural(u.unver, "source") + " named but never opened";
    else head = "every source opened and checked";

    var tiers = u.tiers.map(function (t) {
      return '<li' + (t.n ? "" : ' class="empty"') + "><b>" + t.n + "</b> " + esc(t.label) +
        (t.n ? "" : " — nothing was filed here") + "</li>";
    }).join("");

    var notes = "";
    if (u.absentTiers.length) {
      notes += "<p>No <b>" + esc(u.absentTiers.join("</b>, <b>")) + "</b> tier: it did not " +
        "exist in schema v" + esc(u.sv) + ", the schema these rows were written under. " +
        "That is an absence in the vocabulary, not a gap in the research.</p>";
    }
    notes += "<p>Researched " + esc(niceDate(u.date)) + " · " + u.checked + " of " + u.n +
      " rows carry a source that was opened and checked" +
      (u.unver ? " · " + u.unver + " name a source nobody opened" : "") +
      (u.authored ? " · " + u.authored + " are authored here with no external source" : "") +
      ".</p>";

    /* What this run did not store, said once for the whole topic instead of on every
       item. These three were per-row lines and between them were the most repeated text
       in the product: 178 of 230 rows had no quote, 117 had no tier reason, and no
       chapter anywhere has a practicum. The rule that produced them — never blank, never
       mislabelled — is right, and the volume was the defect. They are also run-scoped
       facts rather than item-scoped ones: one run stored 0 of 117 quotes and another 52
       of 58, so the honest place to say it is here. */
    notes += "<p>" + (
      u.quoted === 0
        ? "No row in this run stored the sentence its claim came from, so no item shows a " +
          "quote. What each row says was checked against its source; the supporting " +
          "sentence itself was not kept."
        : u.quoted === u.n
          ? "Every row stored the sentence its claim came from."
          : u.quoted + " of " + u.n + " rows stored the sentence the claim came from; the " +
            "rest record the claim and its source without it."
    ) + " " + (
      u.tiered === 0
        ? "No row recorded why it sits at its tier."
        : u.tiered === u.n
          ? "Every row recorded why it sits at its tier."
          : u.tiered + " recorded why they sit at their tier."
    ) + "</p>";

    notes += "<p>" + (u.prac
      ? plural(u.prac, "row") + " here " + (u.prac === 1 ? "is a drill or exercise" :
        "are drills or exercises") + ", listed inside the chapter each one practises. "
      : "Nothing in this run is a drill or an exercise. ") +
      "The separate <b>practicum</b> record is designed and not built, so no chapter " +
      "carries practice of its own.</p>";
    /* Build state, one expansion further in than provenance — because it is a different
       audience. Everything above is what a reader needs to judge a claim: when it was
       researched, how many sources were opened, what was not stored. What follows is
       what the build thought of its own output: the schema these rows were written
       under, and gate warnings like "ch-02: only 2 members".

       That last one is worse than noise on a reader's page. Fragmentation warns rather
       than fails precisely because Phase 0 measured it and the MOST fragmented arm
       scored HIGHEST, so it is a shape the project suspects and has no evidence for.
       Telling a reader about it invites a conclusion the project's own data does not
       support. Nothing is hidden — a gate FAILURE still renders as a banner above the
       chapters, because that one changes what the reader is looking at. */
    var build = "<p>Rows written under schema v" + esc(u.sv) + ".</p>";
    if (u.warnings.length) {
      build += "<p>Gates warned, and a warning never blocks a build: " +
        u.warnings.map(esc).join("; ") + ".</p>";
    }
    notes += '<details class="build"><summary>' + MARK + "How this page was built</summary>" +
      '<div class="build-body">' + build + "</div></details>";

    return '<details class="run' + (u.stripFlag ? " flag" : "") + '"' + (u.stripOpen ? " open" : "") + ">" +
      "<summary>" + MARK + "<span><b>" + plural(u.n, "item") + "</b>" +
      (u.chapters.length ? " in " + plural(u.chapters.length, "chapter") : "") +
      " · " + esc(head) + "</span></summary>" +
      '<div class="runbody"><ul class="tiers">' + tiers + "</ul>" + notes + "</div></details>";
  }

  function legendHtml(u) {
    var labels = {};
    (UNIT_ROWS[u.slug] || []).forEach(function (r) { labels[r.when || "unclassified"] = 1; });
    var DEF = {
      "every time": "You cannot use the thing correctly without this.",
      "edge case": "Fine until a specific condition fires, then it bites.",
      "judgment call": "Sources disagree. There is no single right answer, so you have to choose.",
      "how it works": "Internals. Only needed to predict behaviour nobody documented.",
      "unclassified": "This row carries no tier."
    };
    var dl = Object.keys(DEF).filter(function (k) { return labels[k]; }).map(function (k) {
      return "<dt><span class=\"when\">" + esc(k) + "</span></dt><dd>" + esc(DEF[k]) + "</dd>";
    }).join("");

    return '<details class="legend"><summary>' + MARK + "How to read this page</summary>" +
      '<div class="legend-body">' +
      "<p>Each item is tagged with <em>when you need it</em>, because that is what decides " +
      "whether you can skip it:</p><dl>" + dl + "</dl>" +
      "<p>Every item also shows whether its source was actually checked: " +
      '<span class="srcstate"><span class="g"></span>source checked</span>, ' +
      '<span class="srcstate unopened"><span class="g"></span>not opened</span>, or ' +
      '<span class="srcstate authored"><span class="g"></span>authored</span>. ' +
      "Nothing here is written from memory: open any item and you get its full description, " +
      "the sentence the claim came from where one was stored, and a link to the page it " +
      "came from.</p></div></details>";
  }

  function bannerHtml(u) {
    if (u.state === "legacy") {
      return '<div class="banner"><b>This run predates chaptering.</b> Its ' +
        plural(u.n, "item") + " render as one flat list in store order, which is the only " +
        "order that exists for them. Re-running the structure stage over these rows would " +
        "chapter them without any new search.</div>";
    }
    if (u.state === "degraded") {
      return '<div class="banner"><b>This topic\'s chapter structure did not pass the build ' +
        "gates, so it renders flat.</b> Every other topic still built. What failed:<ul>" +
        u.failures.map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") +
        "</ul></div>";
    }
    return "";
  }

  function runSwitcher(u, sibs) {
    if (sibs.length < 2) return "";
    return '<p class="runs">Studied ' + (sibs.length === 2 ? "twice" : sibs.length + " times") +
      ", and each run chaptered its own rows independently: " +
      sibs.map(function (s) {
        var label = niceDate(s.date) + (s.runTag ? " · " + s.runTag : "");
        return s.slug === u.slug
          ? '<b aria-current="page">' + esc(label) + "</b>"
          : '<a href="' + topicHref(s.slug) + '">' + esc(label) + "</a>";
      }).join(" · ") + "</p>";
  }

  function showTopic(slug, openCh, openRow) {
    var u = UNIT_BY_SLUG[slug];
    if (!u) { showHome(); return; }
    var topic = TOPIC_INDEX.filter(function (t) { return t.name === u.topic; })[0];
    var sibs = topic ? unitsOfTopic(topic) : [u];
    var rows = UNIT_ROWS[u.slug] || [];
    var chaptered = u.state === "ok" && u.chapters.length;

    var body;
    if (chaptered) {
      body = '<div class="chapters">' + u.chapters.map(function (c, i) {
        return chapterHtml(c, i + 1, u, openCh, openRow);
      }).join("") + "</div>";
    } else {
      body = '<div class="chapters flat"><div class="items">' +
        rows.map(function (r) { return itemHtml(r, openRow); }).join("") + "</div></div>";
    }

    markRail(function (a) { return sibs.some(function (s) { return a.dataset.slug === s.slug; }); });
    main.innerHTML =
      '<nav class="crumb" aria-label="Breadcrumb"><a href="#/home">All topics</a> › ' +
      esc(u.topic) + "</nav>" +
      "<h1>" + esc(u.topic) + "</h1>" +
      (u.boundary ? '<p class="boundary">' + esc(u.boundary) + "</p>" : "") +
      runSwitcher(u, sibs) +
      '<p class="framing">' + (chaptered
        ? "Grouped into chapters by the idea that binds them, not by category. Read top to " +
          "bottom; each chapter assumes the one before it. Every item opens to the exact " +
          "source it came from."
        : "This topic has no chapters, so there is no reading order to follow. Every item " +
          "still opens to the exact source it came from.") + "</p>" +
      runStrip(u) + legendHtml(u) + bannerHtml(u) + body +
      '<footer>Built ' + esc(DATA.built) + " from <code>~/.claude/study</code> · run " +
      "<code>" + esc(u.run) + "</code> · re-run <code>/study-read</code> after any new run." +
      "</footer>";

    var target = openRow ? document.getElementById("row-" + openRow)
                         : (openCh ? document.getElementById("ch-" + openCh) : null);
    if (target) target.scrollIntoView({ block: "center" });
    else window.scrollTo(0, 0);
  }

  /* ---------- document view ---------- */

  function showDoc(i) {
    var d = DOCS[i];
    if (!d) { showHome(); return; }
    markRail(function (a) { return +a.dataset.doc === i; });
    window.scrollTo(0, 0);
    if (d.kind === "link") {
      main.innerHTML = '<nav class="crumb"><a href="#/home">All topics</a> › ' + esc(d.label) +
        "</nav><h1>" + esc(d.label) + "</h1>" +
        '<p class="banner">Too large to inline, so it is linked rather than embedded. ' +
        '<a href="' + esc(d.path) + '">Open ' + esc(d.path) + "</a></p>";
    } else {
      main.innerHTML = '<nav class="crumb"><a href="#/home">All topics</a> › ' + esc(d.label) +
        "</nav><h1>" + esc(d.label) + '</h1><p class="boundary">' + esc(d.path) + "</p>" +
        '<article class="md">' + Markdown.render(d.body) + "</article>";
    }
  }

  /* ---------- home + search ---------- */

  var active = { type: new Set(), depth: new Set(), ev: new Set() };

  function highlight(s, t) {
    if (!t) return esc(s);
    var i = s.toLowerCase().indexOf(t);
    if (i < 0) return esc(s);
    return esc(s.slice(0, i)) + "<mark>" + esc(s.slice(i, i + t.length)) + "</mark>" +
      esc(s.slice(i + t.length));
  }

  /* A hit deep-links to the item, expanded, inside its chapter — not to a separate
     document. That is the whole reason the guide iframe went away. */
  function hitHtml(r, t) {
    var u = unitOfRow(r);
    var href = u ? topicHref(u.slug, r.ch, r.id) : "";
    return '<div class="hit">' +
      (href ? '<a href="' + href + '">' + highlight(r.subject, t) + "</a>"
            : '<span class="subject">' + highlight(r.subject, t) + "</span>") +
      // search reads the whole description as one run of text, paragraphs rejoined
      "<p>" + highlight(function (d) {
        return d.length > 240 ? d.slice(0, 240) + "…" : d;
      }(r.d.join(" ")), t) + "</p>" +
      '<div class="hmeta"><span class="tag">' + esc(r.type) + "</span>" +
      '<span class="tag">' + esc(r.when || r.depth) + "</span>" +
      (r.ev !== "re-opened" ? '<span class="tag w">' + esc(evLabel(r.ev)) + "</span>" : "") +
      (r.grade !== "viable" ? '<span class="tag w">' + esc(r.grade) + "</span>" : "") +
      '<span class="muted">' + esc(r.topic) + "</span></div></div>";
  }

  function topicRow(t) {
    var us = unitsOfTopic(t);
    if (!us.length) return "";
    var u = us[0];
    var flags = [];
    if (us.length > 1) flags.push(plural(us.length, "run"));
    if (u.state === "legacy") flags.push("unchaptered");
    if (u.state === "degraded") flags.push("gates failed");
    if (u.unver) flags.push(plural(u.unver, "unopened source"));
    return '<a class="trow" href="' + topicHref(u.slug) + '">' +
      '<span class="tname">' + esc(t.name) + "</span>" +
      '<span class="tmeta">' + esc(niceDate(u.date)) + " · " + plural(u.n, "item") +
      (u.chapters.length ? " · " + plural(u.chapters.length, "chapter") : "") +
      (flags.length ? " · " + esc(flags.join(" · ")) : "") + "</span>" +
      (u.boundary ? '<span class="tbound">' + esc(u.boundary) + "</span>" : "") + "</a>";
  }

  function emptyStateHtml() {
    return "<h1>Nothing studied yet</h1>" +
      '<p class="boundary">This page is built from <code>~/.claude/study</code>, and that ' +
      "store is empty. Nothing is seeded here on purpose: a fabricated example topic would " +
      "look researched without being researched, which is the one thing this tool is for.</p>" +
      '<p class="framing">Run a topic and this becomes a contents view — chapters named for ' +
      "the idea that binds them, items in reading order, and every item one click from the " +
      "page its claim came from.</p>" +
      '<p class="banner">Start with <code>/study &lt;topic&gt;</code>, then rebuild this page ' +
      "with <code>/study-read</code>.</p>";
  }

  function showHome() {
    markRail(function () { return false; });
    window.scrollTo(0, 0);
    if (!UNITS.length && !DOCS.length) { main.innerHTML = emptyStateHtml(); return; }

    function disclose(list, lead) {
      if (!list.length) return "";
      return '<div class="banner"><b>' + lead + "</b><ul>" + list.map(function (x) {
        return "<li><code>" + esc(x.path) + "</code> — " + esc(x.why) + "</li>";
      }).join("") + "</ul></div>";
    }
    var notes = "";
    if (DATA.capNote) notes += '<p class="banner">' + esc(DATA.capNote) + "</p>";
    notes += disclose(DATA.unreadable, plural(DATA.unreadable.length, "file") +
      " could not be read, and are named here rather than dropped:");
    notes += disclose(DATA.notices, "The build worked around " +
      plural(DATA.notices.length, "thing") + ", and says so rather than absorbing it:");

    main.innerHTML =
      "<h1>Study library</h1>" +
      '<p class="boundary">' + plural(TOPIC_INDEX.length, "topic") + " · " +
      plural(LIVE.length, "live row") + " · " + plural(DOCS.length, "report") + ".</p>" +
      '<p class="framing">Every topic is a reading path into firsthand sources. Search below ' +
      "to land inside any item of any topic, or open a topic to read it in order.</p>" +
      '<div class="chips" id="chips"></div><div id="results"></div>' +
      '<h2 class="h-list">Topics</h2><div class="tlist">' +
      TOPIC_INDEX.map(topicRow).join("") + "</div>" + notes +
      '<footer>Built ' + esc(DATA.built) + " from <code>~/.claude/study</code>. " +
      "Re-run <code>/study-read</code> after any new run.</footer>";

    var chips = document.getElementById("chips");
    var chipHtml = "";
    Object.keys(FILTERS).forEach(function (k) {
      chipHtml += '<span class="lbl">' + (k === "ev" ? "source" : k) + "</span>";
      FILTERS[k].forEach(function (v) {
        // data-v stays the stored enum — it is the filter key; only the text is spoken
        chipHtml += '<button class="chip" data-k="' + k + '" data-v="' + esc(v) +
          '" aria-pressed="' + active[k].has(v) + '">' +
          esc(k === "ev" ? evLabel(v) : v) + "</button>";
      });
    });
    chips.innerHTML = chipHtml;
    chips.addEventListener("click", function (ev) {
      var b = ev.target.closest(".chip");
      if (!b) return;
      var k = b.dataset.k, v = b.dataset.v;
      active[k].has(v) ? active[k].delete(v) : active[k].add(v);
      b.setAttribute("aria-pressed", active[k].has(v));
      search();
    });
    search();
  }

  function search() {
    var results = document.getElementById("results");
    if (!results) return;
    var t = q.value.trim().toLowerCase();
    var hits = LIVE;
    ["type", "depth", "ev"].forEach(function (k) {
      if (active[k].size) hits = hits.filter(function (r) { return active[k].has(r[k]); });
    });
    if (t) hits = hits.filter(function (r) {
      return (r.subject + " " + r.d.join(" ") + " " + r.topic).toLowerCase().indexOf(t) >= 0;
    });
    if (!t && !active.type.size && !active.depth.size && !active.ev.size) {
      results.innerHTML = "";
      return;
    }
    if (!hits.length) {
      results.innerHTML = '<h2 class="h-list">No matches</h2>' +
        '<p class="framing">Searched every row of all ' + plural(TOPIC_INDEX.length, "topic") +
        ". Clear the filters above, or try a shorter word.</p>";
      return;
    }
    results.innerHTML =
      '<h2 class="h-list">' + hits.length + " match" + (hits.length === 1 ? "" : "es") +
      "</h2>" + hits.slice(0, 150).map(function (r) { return hitHtml(r, t); }).join("") +
      (hits.length > 150
        ? '<p class="framing">Showing the first 150 of ' + hits.length + ".</p>"
        : "");
  }

  /* ---------- boot ---------- */

  function route() {
    var r = parseHash();
    if (r.view === "topic") showTopic(r.slug, r.ch === "_" ? "" : r.ch, r.row);
    else if (r.view === "doc") showDoc(r.i);
    else showHome();
  }

  buildRail();
  q.addEventListener("input", function () {
    if (parseHash().view !== "home") { location.hash = "#/home"; return; }
    search();
  });
  window.addEventListener("hashchange", route);
  route();
})();
