---
name: study-read
description: 'Open the study library — one page to read everything you have researched with the study skill: a sidebar of every guide, retro, and audit report, a reading pane that renders them inline, and search across every structured row at once. Rebuilds the index from the local store and opens it in the browser. Trigger on "open my study library", "study-read", "show me my study guides", "what have I studied", "search my study notes", "find X in my study guides", or /study-read. Companion to the study skill; reads its store and writes nothing but the index page. Not for researching a new topic — that is /study.'
---

# study-read — the study library

`/study` leaves behind a folder per run: a guide, a retro, an audit report, and rows of structured
data. That is a store, not a library. This builds the front door — one page that lists every
document, renders it in place, and searches every row you have ever collected.

Read-only over the store. It writes exactly one file, `~/.claude/study/index.html`.

## Procedure

1. **Build and open:**

   ```bash
   python3 references/build_index.py --open
   ```

   `--root` points at a different store; drop `--open` to build without launching a browser. The
   script loads its sibling `index.css` and `index.js` and inlines them, so the output stays a
   single self-contained file — but all three must travel together.

2. **Report what it found** — run count, row count, document count, and anything notable in the
   output: runs with unverified sources, runs with no rendered guide, documents that exceeded the
   embed cap. Do not just say "done."

3. **If there are no runs**, say so and point at `/study <topic>`. Do not build an empty index.

## What the page does

- **Sidebar of every document**, grouped by run: guides (including time-boxed cuts), retros, audit
  reports, harvest summaries, and any cross-run report sitting at the store root.
- **Reading pane.** Markdown renders inline — headings, tables, nested lists, code, quotes — so a
  retro is readable in place rather than downloading as plain text. Guides load in a frame with an
  open-full-page escape.
- **Search across every row of every run**, filtered by type, depth, and evidence. This is the
  payoff of storing rows rather than documents: *"every trap I have ever collected"* or
  *"everything at judgment depth about rebalancing"* is one query spanning topics researched weeks
  apart. Each hit deep-links into its guide at that item.

## Store layout it expects

```
~/.claude/study/
├── index.html              ← what this builds
├── *.md                    ← cross-run reports, read from the root
├── data/rows.jsonl
└── runs/<run-id>/
    ├── guide*.html
    ├── *.md                ← retro, audit, harvest summaries
    └── data/final.jsonl    ← the row set this indexes
```

It reads each run's `data/final.jsonl` — the post-audit row set — not the append-only
`data/rows.jsonl`, so a row appears once rather than once per append.

## Notes

- **Re-run after any new `/study` run.** The index is a build artifact, not live.
- **Mixed schema versions are handled.** v0.1 (`source_status`/`claim_label`), v0.2 and v0.3
  (`evidence`) rows coexist in the store by design; the index normalizes them for display and shows
  each run's version on its card.
- **Markdown is embedded**, so the page works from `file://` with no server and no external
  requests. Past a 2MB total the remaining documents are linked rather than inlined, and the page
  names which ones — a visible cap, never a silent one.

## License

MIT — see [LICENSE](../LICENSE).
