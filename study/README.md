# study

**Topic in, study guide out.** Name any topic. It researches, then hands you a depth-tiered
reading list where every item carries a linked source, the traps people actually fall into, real
exercises that exist, and drills you can build yourself.

```text
/study Kafka consumer groups
```

The guide opens with a triage line — *minimum viable pass: 25m · full pass: 70m* — because a
reading list you cannot fit into the time you have is a reading list you will not read.

## What makes it different from asking for a reading list

**Every claim carries a source, and the guide tells you which sources were actually opened.** A
plausible-looking dead link is the failure mode that makes an AI-generated study guide worthless,
so a source that was cited but not read is marked `asserted-only` in the ledger rather than
quietly presented as verified. When no real exercises exist for a topic, it says so instead of
inventing some.

**Depth is tiered by failure signature, not by vibes.** Four levels, each defined by what
specifically goes wrong without it:

| Level | Without it | Error surfaces |
|---|---|---|
| Orientation | you cannot form a correct mental model | immediately — you cannot start |
| Operation | you cannot use it correctly in the normal case | immediately — it breaks |
| Judgment | you use it correctly but *choose* wrongly | late — at scale, or in an incident |
| Mechanism | you cannot predict behavior you have not seen | only in novel situations |

Judgment is the level most guides miss, because its absence is invisible while everything works.

**The research and the guide are separate artifacts.** The analysis writes structured rows to a
local file and stops there; the guide is rendered from those rows afterward. So the research
accumulates across every topic you run, stays queryable on its own, and can be re-rendered into
something else without spending a single agent again.

## Install

Paste into a [Claude Code](https://claude.com/claude-code) session:

```text
Install one skill from https://github.com/chzylee/skill-library for me:

1. Fetch ONLY the folder named study from that repo (shallow clone or GitHub API —
   your choice).
2. Copy that folder to ~/.claude/skills/study, creating directories as needed.
3. Remove any temporary clone. Change nothing else on my machine.
4. Read the skill's description back to me so I can confirm it's what I wanted.
```

## Invoke

- `/study <topic>`
- "study Kafka consumer groups"
- "what should I study about Terraform at team scale"
- "brief me on row-level security"

It takes a topic and nothing else, deliberately — no "for an interview," no "for work." The
research stays consumer-agnostic so the same rows serve any reader; the *guide* is one rendering
of them.

Not for studying a specific repo or codebase, and not a live tutoring or mock-interview session.

## Requirements

Web search. No account, no API key, no database. Everything is written under `~/.claude/study/`
and nothing is transmitted anywhere.

Optionally, if `OPENROUTER_API_KEY` or `GEMINI_API_KEY` is present in `~/.secrets/llm.env`, the
audit pass routes to a different model — a genuinely independent check rather than the same model
grading its own homework.

## Where things land

```
~/.claude/study/
├── rows.jsonl              ← every row, every topic, append-only
├── runs/<run-id>/          ← raw sub-agent returns + the run retro
└── guides/<run-id>.html    ← the guide: one self-contained file, works offline
```

`rows.jsonl` is append-only, so nothing is ever destroyed — a row the audit killed stays in the
file with its reason, and the guide is a filter over the whole. Query across every topic you have
ever studied with [DuckDB](https://duckdb.org), no setup required:

```bash
duckdb -c "select topic, subject from read_json_auto('~/.claude/study/rows.jsonl') where depth = 'judgment'"
```

## Status

**v0.1 — development mode.** The row schema is not locked, and every run ends with a short retro
recording what the schema could not hold and whether the audit pass earned its cost. Expect the
schema to change; `schema_version` is on every row so old rows stay readable.

Untested on non-technical topics. Curated exercise pools are thin outside software and
infrastructure, so the ready-made Practice section will often be empty there — by design, rather
than filled with invention.

## License

MIT — see [LICENSE](../LICENSE).
