/* Study library — index.html behavior.
   Inlined into the output by build_index.py; expects `window.STUDY_DATA` to be
   defined by an earlier <script> tag. No globals are exported.

   Units, in order: utilities → markdown renderer → sidebar → views → boot. */
(function () {
  "use strict";

  var DATA = window.STUDY_DATA;
  var DOCS = DATA.docs, ROWS = DATA.rows, RUNS = DATA.runs, GROUPS = DATA.groups;
  var FILTERS = DATA.filters; // { type: [...], depth: [...], ev: [...] }

  /* ---------- utilities ---------- */

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

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

  /* ---------- state ---------- */

  var active = { type: new Set(), depth: new Set(), ev: new Set() };

  /* ---------- sidebar ---------- */

  var nav = document.getElementById("nav");
  var main = document.getElementById("main");

  function buildSidebar() {
    var html = "";
    GROUPS.forEach(function (g) {
      var ds = DOCS.filter(function (d) { return d.g === g; });
      if (!ds.length) return;
      html += '<div class="gh">' + esc(g) + "</div>";
      ds.forEach(function (d) {
        html += '<button class="dl" data-i="' + d.i + '">' + esc(d.label) + "</button>";
      });
    });
    nav.innerHTML = html;
  }

  function markCurrent(i) {
    document.querySelectorAll(".dl").forEach(function (b) {
      var current = b.dataset.i !== undefined
        ? +b.dataset.i === i
        : (i === null && b.id === "home");
      b.setAttribute("aria-current", current ? "true" : "false");
    });
  }

  /* ---------- views ---------- */

  function showDoc(i) {
    var d = DOCS[i];
    markCurrent(i);
    window.scrollTo(0, 0);
    if (d.kind === "html") {
      main.innerHTML =
        '<div class="bar"><h2>' + esc(d.label) + "</h2>" +
        '<a class="btn" href="' + esc(d.path) + '" target="_blank">Open full page</a></div>' +
        '<iframe src="' + esc(d.path) + '" title="' + esc(d.label) + '"></iframe>';
    } else if (d.kind === "link") {
      main.innerHTML =
        '<div class="bar"><h2>' + esc(d.label) + "</h2></div>" +
        '<p class="note">Too large to inline. <a href="' + esc(d.path) + '">Open ' +
        esc(d.path) + "</a></p>";
    } else {
      main.innerHTML =
        '<div class="bar"><h2>' + esc(d.label) + '</h2><span class="path">' +
        esc(d.path) + "</span></div>" +
        '<article class="md">' + Markdown.render(d.body) + "</article>";
    }
  }

  function runCard(r) {
    var tag = (r.g.match(/\(([^)]+)\)$/) || [])[1]; // disambiguator, e.g. "v02"
    return '<article class="card"><h3>' + esc(r.topics.join(" · ") + (tag ? " (" + tag + ")" : "")) + "</h3>" +
      '<div class="cmeta"><span>' + esc(r.date) + "</span><span>" + r.n + " items</span>" +
      "<span>" + r.mins + "m reading</span>" +
      '<span class="muted">schema v' + esc(r.sv) + "</span></div>" +
      '<div class="flags">' +
      (r.unver ? '<span class="flag warn">' + r.unver + " unverified source" + (r.unver === 1 ? "" : "s") + "</span>" : "") +
      (r.wounded ? '<span class="flag warn">' + r.wounded + " wounded</span>" : "") +
      (r.shelved ? '<span class="flag">' + r.shelved + " shelved</span>" : "") +
      "</div></article>";
  }

  function highlight(s, t) {
    if (!t) return esc(s);
    var i = s.toLowerCase().indexOf(t);
    if (i < 0) return esc(s);
    return esc(s.slice(0, i)) + "<mark>" + esc(s.slice(i, i + t.length)) + "</mark>" +
      esc(s.slice(i + t.length));
  }

  function hitHtml(r, t) {
    var run = RUNS.find(function (x) { return x.id === r.run; });
    var title = run && run.guide
      ? '<a href="' + esc(run.guide) + "#" + esc(r.id) + '" target="_blank">' + highlight(r.subject, t) + "</a>"
      : '<span class="subject">' + highlight(r.subject, t) + "</span>";
    return '<div class="hit">' + title +
      "<p>" + highlight(r.d, t) + "</p>" +
      '<div class="hmeta"><span class="tag">' + r.type + "</span>" +
      '<span class="tag">' + r.depth + "</span>" +
      (r.ev !== "re-opened" ? '<span class="tag w">' + r.ev + "</span>" : "") +
      (r.grade !== "viable" ? '<span class="tag w">' + r.grade + "</span>" : "") +
      "<span>" + r.t + 'm</span><span class="muted">' + esc(r.topic) + "</span></div></div>";
  }

  function showOverview() {
    markCurrent(null);
    main.innerHTML =
      '<input id="q" type="search" placeholder="Search every row — try: rebalance, drift, exactly-once" autocomplete="off">' +
      '<div class="chips" id="chips"></div><div id="results"></div>' +
      '<h2 class="h-list">Runs</h2>' +
      '<div class="grid">' + RUNS.map(runCard).join("") + "</div>" +
      (DATA.capNote
        ? '<p class="note">' + DATA.capNote + "</p>"
        : "") +
      '<p class="muted" style="font-size:.78rem;margin-top:2rem">Built ' + esc(DATA.built) +
      " from <code>~/.claude/study</code>. Re-run <code>/study-read</code> after any new run.</p>";

    var chips = document.getElementById("chips");
    var results = document.getElementById("results");
    var q = document.getElementById("q");

    var chipHtml = "";
    Object.keys(FILTERS).forEach(function (k) {
      chipHtml += '<span class="lbl">' + (k === "ev" ? "evidence" : k) + "</span>";
      FILTERS[k].forEach(function (v) {
        chipHtml += '<button class="chip" data-k="' + k + '" data-v="' + esc(v) +
          '" aria-pressed="' + active[k].has(v) + '">' + esc(v) + "</button>";
      });
    });
    chips.innerHTML = chipHtml;

    function search() {
      var t = q.value.trim().toLowerCase();
      var hits = ROWS.filter(function (r) { return r.grade !== "killed" && r.grade !== "merged"; });
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
      results.innerHTML =
        '<h2 class="h-list" style="margin-top:1rem">' + hits.length +
        " match" + (hits.length === 1 ? "" : "es") + "</h2>" +
        hits.slice(0, 150).map(function (r) { return hitHtml(r, t); }).join("") +
        (hits.length > 150 ? '<p class="muted">Showing first 150.</p>' : "");
    }

    chips.addEventListener("click", function (ev) {
      var b = ev.target.closest(".chip");
      if (!b) return;
      var k = b.dataset.k, v = b.dataset.v;
      active[k].has(v) ? active[k].delete(v) : active[k].add(v);
      b.setAttribute("aria-pressed", active[k].has(v));
      search();
    });
    q.addEventListener("input", search);
  }

  /* ---------- boot ---------- */

  buildSidebar();
  nav.addEventListener("click", function (ev) {
    var b = ev.target.closest(".dl");
    if (b && b.dataset.i !== undefined) showDoc(+b.dataset.i);
  });
  document.getElementById("home").addEventListener("click", showOverview);
  showOverview();
})();
