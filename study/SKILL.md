---
name: study
description: 'Research any topic and produce a study guide: a depth-tiered reading list where every item carries a linked source, plus real exercises and self-made drills. Dispatches research sub-agents across canonical sources, practitioner failure literature, and exercise platforms; writes structured rows to a local JSONL store; then renders a self-contained HTML guide from those rows. Trigger on "study X", "what should I study about X", "brief me on X", "make me a study guide for X", "what do I need to know about X", or /study. Takes a topic and nothing else by design — no use case, so the same research serves any reader. Not for studying a specific repo or codebase, and not a live tutoring or mock-interview session.'
---

# study — topic in, study guide out

Two layers, kept separate on purpose:

- **The analysis** ([references/analysis-topic-knowledge.md](references/analysis-topic-knowledge.md))
  searches a topic and produces structured knowledge rows. It does not know who is reading them.
- **This skill** is the consumer. It runs the analysis, then derives a study guide from the rows.

The separation is the point. Rows accumulate across every topic you ever run and stay queryable
independently of any guide. A second consumer — a different rendering, a shorter cut, an
onboarding doc — reads the same rows without re-running a single agent. So never write the guide
first and extract rows after; the rows are the analysis output and the guide is a view over them.

**Development mode.** Schema v0.2, not locked. Every run ends with a short retro. Treat a schema
problem as a finding to record, not a thing to silently work around mid-run.

## Two rules that cost nothing and save the most

**Run this in a fresh session.** Orchestrator context is the largest single cost in this pipeline —
in the v0.1 run it was 58% of the total, more than every sub-agent combined, because a long
conversation gets re-read on every turn. Starting cold is free and beats every other optimization
available.

**Never render with the model.** The guide is ~160KB of HTML. Emitting it as model output costs
tens of thousands of tokens; [references/render.py](references/render.py) costs none. The model
authors only the self-check questions and the honest-limits prose. The script does the rest.

## Store

Reports sit where you can see them; data lives one level down in a `data/` folder.

```
~/.claude/study/
├── index.html                  ← the navigator, built by /study-read
├── COMPARISON-*.md             ← cross-run reports, visible at root
├── data/rows.jsonl             ← every row, every topic, append-only
└── runs/<run-id>/
    ├── guide.html              ← the reports, immediately visible
    ├── guide-60m.html
    ├── audit.md · retro.md · harvest-*.md
    └── data/                   ← *.jsonl, plus guide-meta.json and self-check.json
```

Append-only is doing real work: you never rewrite `rows.jsonl`, so a killed row stays in the file
and the guide is a filter over a preserved whole. Query across topics with DuckDB, no setup:

```bash
duckdb -c "select topic, subject, origin from read_json_auto('~/.claude/study/data/rows.jsonl') where evidence = 'asserted'"
```

Run `/study-read` after any run to rebuild the navigator.

## Procedure

**0 · Scope.** Restate the topic precisely and write four things: the boundary, the
excluded-adjacent list (near topics deliberately out of scope), the reference class (a protocol, a
tool, a body of theory — this determines which sources exist), and a `run-id` of
`<topic-slug>-<date>`. Show the scope before dispatching. A wrong boundary wastes both harvesters.

**One topic per run.** A compound request ("X + Y") is two runs. Running both at once doubles the
agents, makes the telemetry unattributable to either topic, and produces a guide too big to read.

**1 · Harvest — two sub-agents, in parallel, blind to each other.** One takes Stage 1A (Canon),
one takes Stage 1B (Failure and Practice). Independence by construction, not instruction.

Each prompt must be self-contained and must:
- Give the **absolute path** to `references/analysis-topic-knowledge.md` and instruct the agent to
  read it as its first action — pass the spec by path, never by paste. Name which section is
  theirs and state that the others are not their brief.
- State the topic, boundary, excluded-adjacent list, and reference class from step 0.
- Require rows in the v0.2 schema, executive summary of 400 words or fewer first.
- Repeat the rules that matter most: open every source you cite and report what it says in the
  same turn; do not attach a rationale the source does not state; return `none, because <reason>`
  rather than inventing anything.

Write each agent's raw return to `runs/<run-id>/` **before** using it (prose reports at the run
root, `.jsonl` under `runs/<run-id>/data/`). If a return file already
exists for a stage, that agent already ran — read the file, do not re-dispatch.

**2 · Merge and tier — one sub-agent.** Not you. In v0.1 the orchestrator did this inline and it
became the single largest cost in the run. Give it both harvest files by path; it writes
`merged.jsonl` and returns 300 words or fewer. Follow Stage 2 in the spec: merge only true
duplicates (same subject AND same depth AND same claim), assign IDs, verify depth against the
failure-signature table, author the drill rows, fill lineage.

**3 · Audit — one sub-agent.** Follow Stage 3. Prefer a different model where a key is available
(`OPENROUTER_API_KEY` or `GEMINI_API_KEY` in `~/.secrets/llm.env`); same model with a fresh brief
is the weakest form of independence, and a tier contrast is the fallback. Give it the merged rows
by path. It writes `audit-verdicts.jsonl`.

Apply its verdicts as grade changes — never by deleting rows. Record every change on the row.

**4 · Commit the rows.** Append every row to `rows.jsonl` in one batched write, killed rows
included. Clean HTML entities (`&lt;` `&gt;` `&amp;`) on the way in — they arrive in agent returns
and will otherwise ship inside your numbers.

**5 · Process into the guide.** Now, and only now. Write two small files:

- `runs/<run-id>/data/self-check.json` — 8–12 questions as `{"q", "a", "ref"}`. Produce-level, not
  recognize-level. Answers render folded so the reader cannot pass by eye.
- `runs/<run-id>/data/guide-meta.json` — `{"title", "sub", "scopes": {topic: text}, "empty": {},
  "limits": "<p>…</p>"}`. Honest limits must name what the search came up empty on, any source that
  could not be verified, and any way the method itself was weakened on this run.

Then run the renderer:

```bash
python3 references/render.py <run-id>
```

It maps depth to reader-facing sections — `orientation`+`operation` → Fundamentals, `judgment` →
Senior edge, `mechanism` → Extra depth (labeled *cut this first when time-boxed*), traps and
practice to their own sections — computes the triage line, and emits one self-contained file to `runs/<run-id>/guide.html`.

**Time-boxed cut.** `--minutes N` renders a per-topic reading budget. It is a filter over the same
rows, not a different analysis, so it costs zero agents and can be re-run at any budget. It keeps
traps first, then material by depth, and states exactly what it omitted.

```bash
python3 references/render.py <run-id> --minutes 60
```

**6 · Retro.** Append to `runs/<run-id>/retro.md`: what the schema could not hold, which stage
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

[references/v0.3-efficiency-proposal.md](references/v0.3-efficiency-proposal.md) — proposed and
unratified. Targets latency (the audit's source re-fetching) rather than cost. Do not adopt it
until v0.2 has produced at least one run, or the two changes confound each other.

## License

MIT — see [LICENSE](../LICENSE).
