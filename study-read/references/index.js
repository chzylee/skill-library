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
    var html = '<p class="shelf">All topics · A–Z</p>';
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

  /* The quote block. A missing quote is stated, never left blank and never dressed
     up as an authored row: 56 of 238 rows carry one, so absence is the common case
     and the page has to say which kind of absence it is. */
  function quoteBlock(r) {
    if (r.quote) return "<blockquote>“" + esc(r.quote) + "”</blockquote>";
    if (r.ev === "authored") {
      return '<p class="absent">Authored for this run, so there is no source sentence to quote.</p>';
    }
    return '<p class="absent">No quote captured for this row. ' +
      (r.ev === "asserted"
        ? "The source was named but never opened, so nothing has been checked against it."
        : "The source was opened and the claim checked against it, but this run did not " +
          "store the supporting sentence.") + "</p>";
  }

  function classifLine(r) {
    var kind = r.type || "item";
    var when = r.when || "unclassified";
    var s = '<p class="classif">A <b>' + esc(kind) + "</b>, tagged <b>" + esc(when) + "</b>. " +
      (r.why ? esc(r.why)
             : "This run did not record why it sits at that tier.") + "</p>";
    return s;
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

  function itemHtml(r, openRow) {
    var open = openRow === r.id ? " open" : "";
    return '<details class="it" id="row-' + esc(r.id) + '"' + open + ">" +
      "<summary>" + MARK + "<span>" +
      '<h3 class="it-t">' + esc(r.subject) + "</h3>" +
      '<span class="it-tags"><span class="when">' + esc(r.when || "unclassified") + "</span>" +
      srcState(r) + "</span></span></summary>" +
      '<div class="it-body">' +
      "<p>" + esc(r.d) + "</p>" +
      quoteBlock(r) + classifLine(r) + sourceLine(r) +
      "</div></details>";
  }

  /* One quiet line per chapter, never an empty panel. The `practicum` record type is
     designed but not built in this version, so no chapter has one. Where a chapter
     holds drill or exercise rows, those ARE its practice under this schema and the
     line says so rather than claiming there is none. */
  function practiceLine(rows) {
    var n = rows.filter(function (r) { return r.type === "drill" || r.type === "exercise"; }).length;
    if (n) {
      return '<p class="prac-none">Practice for this chapter is the ' +
        plural(n, "drill or exercise item") + " listed above. " +
        "The separate practicum record is designed but not built in this version.</p>";
    }
    return '<p class="prac-none">No practice was authored for this chapter. ' +
      "The pipeline does not produce practicum yet.</p>";
  }

  function chapterHtml(c, n, u, openCh, openRow) {
    var rows = c.members.map(function (m) { return ROW_BY[u.run + "\t" + m]; }).filter(Boolean);
    var open = openCh === c.id ? " open" : "";
    var meta = (c.kind === "reference" ? "reference · " : "") +
      plural(rows.length, "item") + (c.mins ? " · " + c.mins + "m" : "");
    return '<details class="ch" id="ch-' + esc(c.id) + '"' + open + ">" +
      "<summary>" + MARK +
      '<span class="ch-n">' + n + "</span><span>" +
      '<h2 class="ch-t">' + esc(c.principle) + "</h2>" +
      '<span class="ch-b">' + esc(c.because) + "</span></span>" +
      '<span class="ch-m">' + esc(meta) + "</span></summary>" +
      '<div class="items">' + rows.map(function (r) { return itemHtml(r, openRow); }).join("") +
      "</div>" + practiceLine(rows) + "</details>";
  }

  /* The run-quality strip. Quiet when the run is healthy, open when it is not: a
     complete run gets out of the way, an incomplete one cannot hide. */
  function runStrip(u) {
    var empty = u.tiers.filter(function (t) { return !t.n; });
    var flagged = u.state !== "ok" || u.unver > 0 || empty.length > 0;
    var head;
    if (u.state === "legacy") head = "this run predates chaptering";
    else if (u.state === "degraded") head = "chapter structure did not pass its gates";
    else if (empty.length) head = "one tier came back empty";
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
      " · schema v" + esc(u.sv) + ".</p>";
    if (u.warnings.length) {
      notes += "<p>Build gates warned, and warnings never block: " +
        u.warnings.map(esc).join("; ") + ".</p>";
    }

    return '<details class="run' + (flagged ? " flag" : "") + '"' + (flagged ? " open" : "") + ">" +
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
      "<p>" + highlight(r.d.length > 240 ? r.d.slice(0, 240) + "…" : r.d, t) + "</p>" +
      '<div class="hmeta"><span class="tag">' + esc(r.type) + "</span>" +
      '<span class="tag">' + esc(r.when || r.depth) + "</span>" +
      (r.ev !== "re-opened" ? '<span class="tag w">' + esc(r.ev) + "</span>" : "") +
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

    var notes = "";
    if (DATA.capNote) notes += '<p class="banner">' + esc(DATA.capNote) + "</p>";
    if (DATA.unreadable.length) {
      notes += '<div class="banner"><b>' + plural(DATA.unreadable.length, "file") +
        " could not be read</b>, and are named here rather than dropped:<ul>" +
        DATA.unreadable.map(function (x) {
          return "<li><code>" + esc(x.path) + "</code> — " + esc(x.why) + "</li>";
        }).join("") + "</ul></div>";
    }

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
      chipHtml += '<span class="lbl">' + (k === "ev" ? "evidence" : k) + "</span>";
      FILTERS[k].forEach(function (v) {
        chipHtml += '<button class="chip" data-k="' + k + '" data-v="' + esc(v) +
          '" aria-pressed="' + active[k].has(v) + '">' + esc(v) + "</button>";
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
      return (r.subject + " " + r.d + " " + r.topic).toLowerCase().indexOf(t) >= 0;
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
