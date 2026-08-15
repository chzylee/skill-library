---
name: study-read
description: 'Open the study library — one page to read everything you have researched with the study skill. Each topic is a contents view: chapters named for the idea that binds them, items in reading order inside them, and every item one expansion from the firsthand source it came from. Plus every retro and audit report, and search across every structured row at once. Rebuilds the page from the local store and opens it in the browser. Trigger on "open my study library", "study-read", "show me what I have studied", "what have I studied", "search my study notes", "find X in my study notes", or /study-read. Companion to the study skill; reads its store and writes nothing but the library page. Not for researching a new topic — that is /study.'
---

# study-read — the study library

`/study` leaves behind a folder per run: rows of structured data, the chapters that group them,
a retro, an audit report. That is a store, not a library. This builds the front door — one page
where every topic you have studied is a reading path into firsthand sources, and every row you
have ever collected is searchable at once.

Read-only over the store. It writes exactly one file, `~/.claude/study/index.html`.

## Procedure

1. **Build and open:**

   ```bash
   python3 ~/.claude/skills/study-read/references/build_index.py --open
   ```

   **Paths here are absolute on purpose.** A skill runs in whatever directory the user is
   working in, not in its own folder, so `python3 references/build_index.py` fails. If this
   skill is installed somewhere other than `~/.claude/skills/study-read`, use that location —
   every path below is relative to the folder holding this file, never to the working directory.

   `--root` points at a different store; drop `--open` to build without launching a browser. The
   script inlines its sibling `index.css` and `index.js` and the repo's `shared/tokens.css`, so the
   output stays a single self-contained file — but all four must travel together. A missing one
   fails the build by name rather than quietly producing an unstyled page.

2. **Report what it found** — topic count, row count, chapter count, and anything notable in the
   output: a topic whose gates failed and renders flat, a run with no chapters, unverified sources,
   files that could not be read, documents past the embed cap, and the size accounting. Do not just
   say "done."

3. **If the store is empty**, the build still writes the page and exits 0. The page carries the
   first-run state and the command to run. Say so and point at `/study <topic>`.

## What the page does

- **Topics are the index.** The rail lists every topic A–Z. A topic studied more than once shows a
  run switcher and opens the newest run; the runs are not merged, because two structure passes over
  two different row sets are two structures, not one.
- **A topic is a contents view.** Numbered chapters, each named for the idea that binds its rows
  and carrying one line on why they belong together. You see the shape of the whole topic without
  scrolling. A chapter expands to its items in reading order; an item expands in place to its full
  description, the sentence the claim came from, its classification, and the link out. Click depth
  is 1 to a chapter, 2 to an item, 3 to leave for the source.
- **The run-quality strip is adaptive.** One quiet line when the run is healthy; it opens itself
  when the topic is unchaptered, when its gates failed, when a tier came back empty, or when a
  source was named and never opened. A complete run gets out of the way; an incomplete one cannot
  hide.
- **Three source states, and only three:** `source checked`, `not opened`, `authored`. Nothing in
  the store records a link check, so the page has no dead-link state and does not invent one. A row
  with no stored quote says so, and says which kind of absence it is.
- **Search across every row of every run**, filtered by type, depth, and evidence. This is the
  payoff of storing rows rather than documents: *"every trap I have ever collected"* or
  *"everything at judgment depth about rebalancing"* is one query spanning topics researched weeks
  apart. A hit opens that item, expanded, inside its chapter.
- **Reports still render inline** — retros, audits, harvest summaries, cross-run comparisons —
  with headings, tables, nested lists, code and quotes.

## Store layout it expects

```
~/.claude/study/
├── index.html              ← what this builds
├── *.md                    ← cross-run reports, read from the root
├── data/rows.jsonl
└── runs/<run-id>/
    ├── *.md                ← retro, audit, harvest summaries
    └── data/
        ├── final.jsonl     ← the row set this indexes
        ├── chapters.jsonl  ← the chapter structure, optional
        └── guide-meta.json ← scopes[topic] is the topic's boundary line
```

It reads each run's `data/final.jsonl` — the post-audit row set — not the append-only
`data/rows.jsonl`, so a row appears once rather than once per append.

Per-run `guide*.html` files are no longer listed. The old separately rendered guide was a second
rendering system that shared nothing with this one, which is why expansions inside it were awkward
and library search could not land in it. The topic view draws the same rows with chapters the guide
never had. Existing guide files stay on disk untouched; they are build artifacts, not data.

## Notes

- **Re-run after any new `/study` run.** The page is a build artifact, not live.
- **Chapters are optional.** A run without `chapters.jsonl` predates chaptering and renders flat
  under a banner. All 238 legacy rows render this way unmigrated, which is what "the existing rows
  survive" means: queryable and readable in a labelled unchaptered view, not retrofitted.
- **Gate failures are scoped to the topic, never the build.** A topic whose chapter structure fails
  its gates renders flat under a banner naming what failed. Every other topic still builds. One
  degenerate warrant must not lock you out of a library of forty topics.
- **Mixed schema versions are handled.** v0.1 (`source_status`/`claim_label`), v0.2 and v0.3
  (`evidence`) rows coexist in the store by design; the page normalizes them for display and states
  each run's version.
- **Everything is embedded**, so the page works from `file://` with no server and no external
  requests. Past 2MB of markdown the remaining documents are linked rather than inlined, and the
  page names which ones — a visible cap, never a silent one. Row data is not capped, and every
  build prints what it costs so the growth is watched rather than discovered.
- **`self-check.json` is written by `/study` and rendered by nothing.** The old guide folded its
  answers; the topic view does not draw it. Recorded here so the gap is visible rather than assumed
  handled.

## License

MIT — see [LICENSE](../LICENSE).
