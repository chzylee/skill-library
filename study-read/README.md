# study-read

**The front door for everything you have studied.** Companion to
[study](../study/README.md) — that skill researches a topic and writes a guide; this one makes the
accumulated set browsable.

```text
/study-read
```

Builds `~/.claude/study/index.html` and opens it.

## What you get

**A sidebar of every document** — guides (including time-boxed cuts), retros, audit reports,
harvest summaries, and any cross-run report. Markdown renders inline in the reading pane, so a
retro is readable in place instead of downloading as plain text; guides load in a frame. Run cards
carry honest flags: unverified sources, wounded rows, shelved rows.

**Search across every row of every run at once.** This is the part a folder of HTML files cannot
do. Because `/study` stores structured rows rather than documents, *"every trap I have ever
collected"* or *"everything at judgment depth about rebalancing"* is one query — across topics you
researched weeks apart. Filter by type (concept, trap, exercise, drill), by depth (orientation,
operation, judgment, mechanism), and by evidence (re-opened, asserted, authored). Every result
deep-links into its guide at the exact item.

The page embeds its data, so it works offline, needs no server, and makes no external requests.
Past 2MB of embedded text the remaining documents are linked rather than inlined, and the page says
which ones.

## Install

Paste into a [Claude Code](https://claude.com/claude-code) session:

```text
Install one skill from https://github.com/chzylee/skill-library for me:

1. Fetch ONLY the folder named study-read from that repo (shallow clone or GitHub
   API — your choice).
2. Copy that folder to ~/.claude/skills/study-read, creating directories as needed.
3. Remove any temporary clone. Change nothing else on my machine.
4. Read the skill's description back to me so I can confirm it's what I wanted.
```

## Invoke

- `/study-read`
- "open my study library"
- "what have I studied"
- "find exactly-once in my study guides"

## Requirements

The [study](../study/README.md) skill, and at least one run in `~/.claude/study/runs/`. Python 3,
no packages. Reads the store and writes exactly one file — `~/.claude/study/index.html`. Nothing is
transmitted anywhere.

`build_index.py` inlines its sibling `index.css` and `index.js` at build time, so the output is a
single self-contained file while the source stays real CSS and JS. All three ship in this folder
and must travel together.

## Notes

Re-run after any new `/study` run; the index is a build artifact, not live. Rows written under
different schema versions coexist in the store by design, and the index normalizes them for display
while showing each run's version on its card.

## License

MIT — see [LICENSE](../LICENSE).
