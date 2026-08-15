# study-read

**The front door for everything you have studied.** Companion to
[study](../study/README.md) — that skill researches a topic and chapters it; this one draws every
topic you have ever run into one page.

```text
/study-read
```

Builds `~/.claude/study/index.html` and opens it.

## What you get

**A topic is a contents view, not a list.** Numbered chapters, each named for the idea that binds
its rows and carrying one line on why they belong together, so you see the shape of the whole
topic without scrolling. A chapter expands to its items in reading order; an item expands in place
to its full description, the sentence the claim came from, what kind of thing it is, and the link
out. Click depth is 1 to a chapter, 2 to an item, 3 to leave for the source.

**The page never has the final word.** Every path ends at a firsthand source. Nothing is explained
to you by a model — the tool finds, orders and describes faithfully, and the learning happens in
the source.

**It says what it does not know.** Exactly three source states render — `source checked`,
`not opened`, `authored` — and there is no dead-link state, because nothing in the store records a
link check and inventing one would be a claim with no cause behind it. A row with no stored quote
says so, and says which kind of absence it is. A run-quality strip sits quiet on a healthy run and
opens itself when a tier came back empty, a source was never opened, or a topic's chapters failed
their build gates.

**Search across every row of every run at once.** This is the part a folder of HTML files cannot
do. Because `/study` stores structured rows rather than documents, *"every trap I have ever
collected"* or *"everything at judgment depth about rebalancing"* is one query — across topics you
researched weeks apart. Filter by type, depth, and evidence. A hit opens that item, expanded,
inside its chapter.

**Reports still render inline** — retros, audits, harvest summaries, cross-run comparisons — with
headings, tables, nested lists, code and quotes.

The page embeds its data, so it works offline from `file://`, needs no server, and makes no
external requests. Past 2MB of embedded markdown the remaining documents are linked rather than
inlined and the page names which ones; row data is not capped, and every build prints what it
costs so the growth is watched rather than discovered.

## Install

Paste into a [Claude Code](https://claude.com/claude-code) session:

```text
Install two skills from https://github.com/chzylee/skill-library for me:

1. Fetch ONLY the folders named study-read and study from that repo (shallow clone
   or GitHub API — your choice), plus the folder named shared.
2. Copy them to ~/.claude/skills/study-read, ~/.claude/skills/study, and
   ~/.claude/skills/shared, creating directories as needed.
3. Remove any temporary clone. Change nothing else on my machine.
4. Read each skill's description back to me so I can confirm they're what I wanted.
```

## Invoke

- `/study-read`
- "open my study library"
- "what have I studied"
- "find exactly-once in my study notes"

## Requirements

The [study](../study/README.md) skill, and at least one run in `~/.claude/study/runs/`. Python 3,
no packages. Reads the store and writes exactly one file — `~/.claude/study/index.html`. Nothing
is transmitted anywhere.

`build_index.py` inlines its sibling `index.css` and `index.js` plus the repo's
`shared/tokens.css`, so the output is a single self-contained file while the source stays real CSS
and JS. All four must travel together; a missing one fails the build by name rather than quietly
producing an unstyled page.

## Notes

Re-run after any new `/study` run; the page is a build artifact, not live.

A run without `chapters.jsonl` predates chaptering and renders flat under a banner. That is what
"the existing rows survive" means — queryable and readable in a labelled unchaptered view, not
retrofitted. A topic whose chapters fail their gates also renders flat, under a banner naming what
failed, and every other topic still builds: one degenerate warrant must never lock you out of a
library of forty topics.

Rows written under different schema versions coexist in the store by design, and the page
normalizes them for display while stating each run's version.

## License

MIT — see [LICENSE](../LICENSE).
