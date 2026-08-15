# study

**Topic in, a reading path out.** Name any topic. It researches, then adds the topic to your
study library as chapters — each named for the idea that binds its items together, in an order
where each chapter assumes the one before it, and every item one click from the source it came
from.

```text
/study Kafka consumer groups
```

Read it with [study-read](../study-read/README.md), which draws every topic you have ever run
into one page.

## What makes it different from asking for a reading list

**It is organized by principle, not by category.** Forty correct, sourced, disconnected rows are
a bad thing to study from, and no sorting of them fixes that — what makes material expert-grade
is how it is organized, not how much of it there is. So a stage of the pipeline exists only to
find the ideas that bind the rows and name them, and a chapter's warrant has to pass a real test:

> Does it name a mechanism, constraint, or shared cause that is **not fully visible in any single
> member row**?

"These rows all cover offset commits and delivery guarantees" fails that test even though it is
true. Truth is not the bar; emergence is.

**Every claim carries a source, and the page tells you which sources were actually opened.** A
plausible-looking dead link is the failure mode that makes an AI-generated study guide worthless,
so a source that was cited but never read is marked `not opened` rather than quietly presented as
verified, and a row with no stored quote says so instead of showing a blank. When no real
exercises exist for a topic, it says so instead of inventing some.

**Depth is tiered by failure signature, not by vibes.** Four levels, each defined by what
specifically goes wrong without it:

| Level | Without it | Error surfaces |
|---|---|---|
| Orientation | you cannot form a correct mental model | immediately — you cannot start |
| Operation | you cannot use it correctly in the normal case | immediately — it breaks |
| Judgment | you use it correctly but *choose* wrongly | late — at scale, or in an incident |
| Mechanism | you cannot predict behavior you have not seen | only in novel situations |

Judgment is the level most guides miss, because its absence is invisible while everything works.

**The research and the reading path are separate artifacts.** The analysis writes structured rows
to a local file and stops there; chapters are a second record over those rows, and the page is
rendered from both by a script. So the research accumulates across every topic you run, stays
queryable on its own, and can be re-organized without spending a single research agent again.

## Install

Paste into a [Claude Code](https://claude.com/claude-code) session:

```text
Install two skills from https://github.com/chzylee/skill-library for me:

1. Fetch ONLY the folders named study and study-read from that repo (shallow clone
   or GitHub API — your choice), plus the folder named shared.
2. Copy them to ~/.claude/skills/study, ~/.claude/skills/study-read, and
   ~/.claude/skills/shared, creating directories as needed.
3. Remove any temporary clone. Change nothing else on my machine.
4. Read each skill's description back to me so I can confirm they're what I wanted.
```

They are a pair: `/study` researches, `/study-read` draws. `shared/tokens.css` is inlined by the
build and the build fails loudly without it.

## Invoke

- `/study <topic>`
- "study Kafka consumer groups"
- "what should I study about Terraform at team scale"
- "brief me on row-level security"

It takes a topic and nothing else, deliberately — no "for an interview," no "for work." The
research stays consumer-agnostic so the same rows serve any reader; the *page* is one rendering
of them.

Not for studying a specific repo or codebase, and not a live tutoring or mock-interview session.

## Requirements

Web search, and Python 3 with no packages. No account, no API key, no database. Everything is
written under `~/.claude/study/` and nothing is transmitted anywhere.

Optionally, if `OPENROUTER_API_KEY` or `GEMINI_API_KEY` is present in `~/.secrets/llm.env`, the
audit pass routes to a different model — a genuinely independent check rather than the same model
grading its own homework.

## Where things land

```
~/.claude/study/
├── index.html                  ← the library, built by /study-read
├── data/rows.jsonl             ← every row, every topic, append-only
└── runs/<run-id>/
    ├── audit.md · retro.md · harvest-*.md
    └── data/
        ├── final.jsonl         ← the post-audit row set
        └── chapters.jsonl      ← the chapters over it
```

`rows.jsonl` is append-only, so nothing is ever destroyed — a row the audit killed stays in the
file with its reason, and every page is a filter over the whole. Query across every topic you have
ever studied with [DuckDB](https://duckdb.org), no setup required:

```bash
duckdb -c "select topic, subject from read_json_auto('~/.claude/study/data/rows.jsonl') where depth = 'judgment'"
```

## Status

**v1 slice 1 — chapters.** Rows are grouped into chapters and drawn as a contents view. The
chaptering bet was validated before it was built: a blind checker scored 47 real chapters against
the warrant test and rated 82% of them genuine principles, rejecting all 8 deliberately-broken
controls mixed into the set. The method, the pre-registered pass condition, and what the run
explicitly did *not* establish are in
[../study-read/validation/VERDICT.md](../study-read/validation/VERDICT.md).

Row schema is v0.2 and not locked; every run ends with a short retro. Two further slices — a
two-axis schema, and a served viewer with per-reader progress — are designed in
[../study-read/DESIGN-v1.md](../study-read/DESIGN-v1.md) and deliberately **not committed**, to be
judged from a working artifact rather than a design document.

Untested on non-technical topics; all three validated topics were software infrastructure. Curated
exercise pools are thin outside software, so the ready-made practice material will often be empty
there — by design, rather than filled with invention.

## License

MIT — see [LICENSE](../LICENSE).
