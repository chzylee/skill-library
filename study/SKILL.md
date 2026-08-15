---
name: study
description: 'Research any topic and add it to your study library as a reading path: chapters named for the idea that binds them, items in reading order inside them, every item one click from the source it came from. Dispatches research sub-agents across canonical sources, practitioner failure literature, and exercise platforms; writes structured rows to a local JSONL store; groups them into chapters; then a script rebuilds the library page. Trigger on "study X", "what should I study about X", "brief me on X", "make me a study guide for X", "what do I need to know about X", or /study. Takes a topic and nothing else by design — no use case, so the same research serves any reader. Not for studying a specific repo or codebase, and not a live tutoring or mock-interview session.'
---

# study — topic in, a chaptered reading path out

Two layers, kept separate on purpose:

- **The analysis** ([references/analysis-topic-knowledge.md](references/analysis-topic-knowledge.md))
  searches a topic and produces structured knowledge rows. It does not know who is reading them.
- **This skill** is the consumer. It runs the analysis, then groups the rows into chapters and
  hands them to `/study-read` to draw.

The separation is the point. Rows accumulate across every topic you ever run and stay queryable
independently of any rendering. A second consumer — a shorter cut, an onboarding doc — reads the
same rows without re-running a single agent. So never write a document first and extract rows
after; the rows are the analysis output and every page is a view over them.

**What organizes the rows is a chapter, not a sort.** Forty correct, sourced, disconnected rows
are a bad thing to study from, and no ordering of them fixes that. Stage 5 is where the difference
gets made, and it is the stage most likely to be skipped because the run looks finished without it.

**Development mode.** Schema v0.2, not locked; slice 1 of the v1 redesign adds the `chapter`
record and nothing else. Every run ends with a short retro. Treat a schema problem as a finding to
record, not a thing to silently work around mid-run.

## Two rules that cost nothing and save the most

**Run this in a fresh session.** Orchestrator context is the largest single cost in this pipeline —
in the v0.1 run it was 58% of the total, more than every sub-agent combined, because a long
conversation gets re-read on every turn. Starting cold is free and beats every other optimization
available.

**Never render with the model.** The library page is hundreds of KB of HTML. Emitting it as model
output costs tens of thousands of tokens; `study-read`'s
[build_index.py](../study-read/references/build_index.py) costs none. The model authors the
chapter warrants and the honest-limits prose. The script does the rest.

## Store

Reports sit where you can see them; data lives one level down in a `data/` folder.

```
~/.claude/study/
├── index.html                  ← the whole library, built by /study-read
├── COMPARISON-*.md             ← cross-run reports, visible at root
├── data/rows.jsonl             ← every row, every topic, append-only
├── _archive/                   ← retired v0 build artifacts; nothing reads them
└── runs/<run-id>/
    ├── audit.md · retro.md · harvest-*.md
    └── data/
        ├── final.jsonl         ← the post-audit row set
        ├── chapters.jsonl      ← what stage 5 writes; without it the topic is flat
        ├── guide-meta.json · self-check.json
        └── merged.jsonl · audit-verdicts.jsonl · harvest-*.jsonl
```

There is no per-run `guide.html` any more. One page renders every topic from the store, so a
separately rendered per-run document was a second rendering system that shared nothing with the
first. Guides from earlier runs were moved to `_archive/`, not deleted; they are build artifacts,
not data.

Append-only is doing real work: you never rewrite `rows.jsonl`, so a killed row stays in the file
and every page is a filter over a preserved whole. Query across topics with DuckDB, no setup:

```bash
duckdb -c "select topic, subject, origin from read_json_auto('~/.claude/study/data/rows.jsonl') where evidence = 'asserted'"
```

Run `/study-read` after any run to rebuild the library page.

## Procedure

**Paths in this file are relative to the folder holding it**, which is normally
`~/.claude/skills/study/`. A skill runs in whatever directory the user is working in, not in its
own folder, so write every command and every spec path absolutely. The examples below use the
default install location; if this skill lives somewhere else, substitute that.

**0 · Scope.** Restate the topic precisely and write four things: the boundary, the
excluded-adjacent list (near topics deliberately out of scope), the reference class (a protocol, a
tool, a body of theory — this determines which sources exist), and a `run-id` of
`<topic-slug>-<date>`. Show the scope before dispatching. A wrong boundary wastes both harvesters.

**One topic per run.** A compound request ("X + Y") is two runs. Running both at once doubles the
agents, makes the telemetry unattributable to either topic, and produces a guide too big to read.

**1 · Harvest — two sub-agents, in parallel, blind to each other.** One takes Stage 1A (Canon),
one takes Stage 1B (Failure and Practice). Independence by construction, not instruction.

Each prompt must be self-contained and must:
- Give the **absolute path** to the analysis spec —
  `~/.claude/skills/study/references/analysis-topic-knowledge.md` — and instruct the agent to
  read it as its first action. Pass the spec by path, never by paste. Name which section is
  theirs and state that the others are not their brief.
- State the topic, boundary, excluded-adjacent list, and reference class from step 0.
- Require rows in the v0.2 schema, executive summary of 400 words or fewer first.
- Repeat the rules that matter most: open every source you cite and report what it says in the
  same turn; do not attach a rationale the source does not state; return `none, because <reason>`
  rather than inventing anything.

Write each agent's raw return to `~/.claude/study/runs/<run-id>/` **before** using it (prose
reports at the run root, `.jsonl` under `~/.claude/study/runs/<run-id>/data/`). If a return file
already exists for a stage, that agent already ran — read the file, do not re-dispatch.

**2 · Merge and tier — one sub-agent.** Not you. In v0.1 the orchestrator did this inline and it
became the single largest cost in the run. Give it both harvest files by path; it writes
`merged.jsonl` and returns 300 words or fewer. Follow Stage 2 in the spec: merge only true
duplicates (same subject AND same depth AND same claim), assign IDs, verify depth against the
failure-signature table, author the drill rows, fill lineage.

**3 · Audit — one sub-agent.** Follow Stage 3. Prefer a different model where a key is available
(`OPENROUTER_API_KEY` or `GEMINI_API_KEY` in `~/.secrets/llm.env`); same model with a fresh brief
is the weakest form of independence, and a tier contrast is the fallback. Give it the merged rows
by path. It writes `audit-verdicts.jsonl`.

Apply its verdicts as grade changes — never by deleting rows. **The change is recorded by the
verdict record and the new `grade`, not by editing `description`.** The row's prose is what a
reader reads; appending `[AUDIT viable->wounded: …]` to it puts pipeline state mid-sentence, and
`audit-verdicts.jsonl` already holds that text. `/study-read` renders the grade and the verdict as
their own disclosure on the item.

**4 · Commit the rows.** Append every row to `~/.claude/study/data/rows.jsonl` in one batched
write, killed rows
included. Clean HTML entities (`&lt;` `&gt;` `&amp;`) on the way in — they arrive in agent returns
and will otherwise ship inside your numbers.

**5 · Structure — one sub-agent per topic.** This is the stage that produces chapters, and
without it the run lands as a flat list, which is the defect the whole v1 redesign exists to fix.
It runs **after** the audit, because a chapter's members must all be live rows of the final set —
chapter a killed row and the build gate rejects the topic.

Give the agent the **absolute path** to the structure brief —
`~/.claude/skills/study/references/structure-legacy.md` — and instruct it to read that as its
first action. Pass the spec by path, never by paste. Write it one input file holding only that
topic's live rows:

```bash
RUN=~/.claude/study/runs/<run-id>/data
python3 -c "
import json,sys
src,dst,topic=sys.argv[1:4]
rows=[json.loads(l) for l in open(src) if l.strip()]
live=[r for r in rows if r.get('topic')==topic and r.get('grade') not in ('killed','merged')]
open(dst,'w').write(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in live))
print(len(live),'live rows')
" "$RUN/final.jsonl" "$RUN/structure-input.jsonl" "<topic>"
```

Tell it to write chapter records to `$RUN/chapters.jsonl` — again as an absolute path.

It appends its chapter records to `~/.claude/study/runs/<run-id>/data/chapters.jsonl` and returns 300 words or
fewer, including the two chapters it is least confident about. Read that return — it is the only
signal you get before a reader sees the page, and the chapter warrants are the one thing in this
pipeline no script can check.

**This stage writes three pieces of editorial apparatus, and they are the teaching.** The rows are
the sources; what makes them a reader rather than an index is what this stage puts around them.

| Piece | Field | What it does |
|---|---|---|
| chapter title | `principle` | names the binding idea. Under ~120 characters — it has to work as a contents line read alone |
| chapter headnote | `because` | the first thing seen on opening a chapter: why these belong together, what to notice |
| per-item note | `notes[row_id]` | **optional.** One 15–30 word hinge: where the item sits in the order, what it assumes, or what is easy to read past in it |

A note is never a summary — `description` already is one, and it renders directly beneath. Omitting
a note is a legal result and better than padding; a chapter where few members earn one is evidence
about the grouping. The full brief, including what a note may not say, is the `notes` section of
[structure-legacy.md](references/structure-legacy.md). The build warns on an over-long note or one
keyed to a non-member, and never fails on either.

**One agent per topic, never one for the run.** Chapters are only coherent within a topic, and a
run that covered two topics needs two independent passes writing to the same file.

**The gates run at build time, not here.** A topic whose chapters fail renders flat under a banner
naming what failed, and every other topic still builds. So a bad structure pass costs you one
topic's organization, not the run — but it is visible in step 6's output and you should say so
rather than let it pass as a successful build.

**6 · Write the run's scope record, then build.** Now, and only now.

- `~/.claude/study/runs/<run-id>/data/guide-meta.json` — `{"title", "sub", "scopes": {topic: text}, "empty": {},
  "limits": "<p>…</p>"}`. Honest limits must name what the search came up empty on, any source that
  could not be verified, and any way the method itself was weakened on this run. `scopes[topic]` is
  the boundary line printed under the topic's title, so write it for the reader.
- `~/.claude/study/runs/<run-id>/data/self-check.json` — 8–12 questions as `{"q", "a", "ref"}`. Produce-level, not
  recognize-level. **Nothing renders this yet.** The old guide folded the answers; the topic view
  does not draw self-check at all. Keep writing the file — it is cheap and it is data — but do not
  tell a reader the questions are waiting for them somewhere.

Then rebuild the library:

```bash
python3 ~/.claude/skills/study-read/references/build_index.py --root ~/.claude/study --open
```

It renders every topic in the store as a contents view: chapters in reading order, items inside
them, each item one expansion from its firsthand source. Chapters come from
`~/.claude/study/runs/<run-id>/data/chapters.jsonl`; a run without that file renders flat under a banner saying it
predates chaptering.

The old per-topic reading budget (`--minutes N`) is gone with the renderer. Reading order now comes
from chapters, which is a stated structure rather than a depth-ranked filter over one.

**7 · Retro.** Append to `~/.claude/study/runs/<run-id>/retro.md`: what the schema could not hold, which stage
produced the least value for its cost, whether the audit changed anything or just agreed, and the
token cost per stage. Development mode — the retro is the instrument, and skipping it is what
makes a prototype run worthless.

## Hard rules

1. **No fabricated sources.** A plausible-looking dead exercise link is worse than an empty
   Practice section. If it was not opened, it is `asserted` and the ledger says so.
2. **No rationale the source does not state.** Quoting a rule correctly and inventing its reason
   was the most common defect in v0.1.
3. **Rows before document.** Always. A guide written first and back-filled into rows is not this
   skill.
4. **Ledger, not deletion.** Killed and merged rows stay in the file with their reason.
5. **No priority or confidence field on a row.** How much an item matters depends on who is
   reading, and the analysis does not know that.
6. **Empty is a legal answer.** `none, because <reason>` beats invention, in every section.
7. **No silent caps.** If a stage samples, truncates, or skips, it says what it skipped.

## Next iteration

**Slice 1 (chapters) is what is built.** Slices 2 and 3 are designed, recorded in
[../study-read/DESIGN-v1.md](../study-read/DESIGN-v1.md), and deliberately **not committed** — the
decision to build them is re-taken after living with chapters on real topics. Do not let their
schema (`kind`, `binding`, `binding_warrant`, `supersedes`) leak into a row or a chapter.

| Slice | Would add | Status |
|---|---|---|
| 2 · Schema | the two axes, stored reference class, scope interview, cost dials | designed, uncommitted |
| 3 · Viewer | a served viewer, per-reader progress, notes, tags, the browse facets | designed, uncommitted |

## License

MIT — see [LICENSE](../LICENSE).
