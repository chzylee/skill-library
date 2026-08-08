# Analysis — Topic Knowledge

**Class:** informational search + light analysis. **Status:** v0.2, development mode — schema is
not locked, every run is followed by a retro.

**v0.2 changes, all from the v0.1 retro** (run `kafka-api-contract-governance-2026-08-06`):
merge-and-tier moved out of the orchestrator into its own stage; one topic per run; schema cut
from 19 fields to 14; `duplicate` defined; per-row depth self-check added; two-channel contract
narrowed to the stages where it is not vacuous. Rows written under v0.1 remain readable —
`schema_version` is what makes that true.

This analysis takes a **topic** and produces **structured knowledge rows** about it. It ends
there. It does not know who is reading the rows or what they will be used for, and it must not
be written as though it does. A consumer (the `study` skill, or any other) reads the rows and
derives its own deliverable.

Designing this template up front is a deliberate exception to the usual extract-from-a-run rule:
this is open-ended informational search, not a thorough analysis toward a specified conclusion,
so there is no run-specific purpose to read the schema off of.

---

## Section ownership

You were dispatched as one stage of this analysis. **Read only your own section plus the shared
sections.** The others are not your brief.

| Section | Who reads it |
|---|---|
| Shared: Row schema · Depth levels · Enums · Prohibitions | everyone |
| Stage 1A — Canon | the canon harvester |
| Stage 1B — Failure and Practice | the failure/practice harvester |
| Stage 2 — Merge and tier | the merge agent |
| Stage 3 — Audit | the auditor |

Do not edit the run's job file or ledger. Ledger-write authority belongs to the orchestrator
alone. Return your rows; the orchestrator files them.

**One topic per run.** A compound request ("X + Y") becomes two runs, not one run with double the
agents. Compound runs in v0.1 doubled cost, made the telemetry unattributable to either topic, and
produced a guide too large to read.

---

## Row schema (shared)

One JSON object per line. Field names exactly as below. 14 fields.

```json
{
  "id": "K-001",
  "run": "kafka-consumer-groups-2026-08-06",
  "topic": "Kafka consumer groups",
  "subject": "Rebalance protocol",
  "type": "concept",
  "description": "Full form. Enough to study from without opening the source. This is the only prose field — there is no separate summary.",
  "origin": "https://kafka.apache.org/documentation/",
  "evidence": "re-opened",
  "depth": "operation",
  "depth_check": "operation, not orientation — you can describe a consumer group without this, but you cannot configure one correctly.",
  "time_estimate_min": 8,
  "lineage": "harvest-canon",
  "grade": "viable",
  "populated_at": "2026-08-06",
  "schema_version": "0.2"
}
```

`id`, `run`, `populated_at`, `schema_version` are machine-filled by the orchestrator. Harvest
agents leave them out; Stage 2 assigns `id` and nothing renumbers after that.

**Prohibited fields.** No importance, relevance, priority, or confidence-of-fit field may exist
on a row. Those are extrinsic — computed by whoever consumes the rows, never stored. `depth` is
not a priority score: it describes what a reader's understanding loses without the item, which is
a property of the knowledge itself.

**Removed in v0.2, and why** — each was measured over 120 rows:
`summary` (never rendered by the consumer, and two rows shipped a summary contradicting their own
description — a second prose field is a defect surface with no reader) · `claim_label` and
`source_status` (near-perfectly correlated; merged into `evidence`) · `extra_sources` (empty on
essentially every row) · `tested_by` (filled uniformly with one value, so it carried no
information; reinstate it if a second challenge stage is ever added) · `date` (identical to
`populated_at` on every row).

---

## Depth levels (shared)

Four levels, anchored by **failure signature** — what specifically goes wrong without the item.
Assign the level whose failure signature actually matches. Do not assign by how advanced the item
sounds.

| `depth` | Without it | When the error surfaces |
|---|---|---|
| `orientation` | you cannot form a correct mental model of what the thing is | immediately — you cannot start |
| `operation` | you cannot use it correctly in the normal case | immediately and visibly — it breaks |
| `judgment` | you use it correctly but *choose* wrongly | late — at scale, or during an incident |
| `mechanism` | you cannot predict behavior you have not already seen | never operationally; only in novel situations |

Worked example, relational databases: *tables, relations, a query language* is `orientation`;
*writing joins, indexes exist, transactions* is `operation`; *row-level security versus
application-layer authorization, isolation level choice* is `judgment`; *how the planner picks an
index, how RLS policies evaluate per row* is `mechanism`.

**`depth_check` is a required field.** One sentence naming the level you chose and why not the
adjacent one. This exists because in v0.1 two harvesters given the identical table diverged: one
held `judgment` and `mechanism` apart cleanly, the other used `judgment` as a general "not
beginner material" bucket and produced 26 judgment rows against 1 mechanism row. Same schema, same
run — so the taxonomy was sound and the execution was not. Forcing the distinction to be stated is
the cheapest available fix.

`judgment` is the level most often missed, because its absence is invisible in normal operation.
If a harvest returns few `judgment` rows, that is a signal the search was too shallow. If it
returns almost nothing *but* `judgment`, that is the bucket failure above.

## Enums (shared)

- `type` — `concept` · `trap` · `exercise` · `drill`
  - `concept`: a thing that is true about the topic.
  - `trap`: a belief that is commonly held and wrong, or an approach that looks right and fails.
  - `exercise`: a **real, existing** exercise, lab, tutorial, or kata that someone else built.
  - `drill`: a practice rep a reader can construct themselves. Authored, not discovered.
- `evidence` — `re-opened` (you opened the source this turn and confirmed it says what the row
  claims) · `asserted` (a source is named but you did not open it) · `authored` (no external
  source; a drill or an inference, and `origin` is `model inference`).
- `grade` — `viable` · `wounded` · `killed` · `merged` · `deferred`. Rows are **never deleted**. A
  killed row stays in the file with its reason in `description`; the reading view is a filter over
  a preserved whole. `merged` is new in v0.2: v0.1 had to record an absorbed row as `killed`,
  which misstated what happened.

---

## Prohibitions (shared)

1. **Never cite a source you did not open.** If you name a URL as backing for a claim, report what
   that page actually says in the same turn. A citation you cannot describe is `asserted`, not
   `re-opened`. Fabricated or guessed URLs are the worst failure this analysis has — a
   plausible-looking dead exercise link is worse than an empty Practice section.
2. **Do not attach a rationale the source does not state.** In v0.1 this was the single most common
   defect: a real normative rule quoted correctly, then a plausible engineering *reason for it*
   invented and labeled as cited. If the source gives the rule but not the why, give the rule.
3. **An empty result is a legal result.** If a topic has no real ready-made exercises, return
   `none, because <reason>`. Do not invent exercises to fill the section.
4. **Read past the first sentence of a source.** Two v0.1 rows misstated a config by reading only
   the opening line of its documentation entry.
5. **Do not blend goals in one pass.** Harvest searches and summarizes. Merge identifies patterns.
   Audit validates and kills.

---

## Stage 1A — Canon

**First, look for a spine that already exists.** A recognized syllabus, an `awesome-*` list, a
vendor's own tutorial index, an official curriculum. One good spine replaces a dozen searches and
is more honest than a bibliography you assemble. Say which you used, or that none existed.

Then search the topic's **authoritative and firsthand** sources: official documentation, the
specification, the reference implementation's docs, the standard text, the original paper.

Return rows of `type: concept`. Expect most to be `orientation` and `operation`, but canon carries
`mechanism` too — internals sections, design docs, and "how it works" chapters. In v0.1 mechanism
came in thin because canon documents *how to use* rather than *how it works*; look specifically
for the internals material rather than accepting its absence.

Open every source you cite. Set `evidence` honestly.

**Output budget: 20–30 rows.** Reduced from v0.1's 25–40. That run produced a guide with a
587-minute reading time, which is worse for a reader than a shorter one, and cost proportionally.
Discovery channel only — you are the first stage and have nothing to render a verdict on.
Executive summary of 400 words or fewer first, then the rows.

## Stage 1B — Failure and Practice

Two search spaces, one agent.

**Failure literature.** Official documentation never says "people get this wrong," so traps have
their own sources: highest-voted Stack Overflow questions, "gotchas" and "lessons learned"
writeups, incident and postmortem reports, the FAQ and troubleshooting sections of the docs,
recurring GitHub issues. Return `type: trap` rows, and `type: concept` rows at `depth: judgment`
where the source describes a decision people get wrong rather than a misconception.

**Practice.** Find **real, existing** exercises: exercise platforms, official hands-on tutorials
and labs, katas, certification practice material. Open each one and confirm it exists and covers
what you claim. Return `type: exercise` rows with the URL in `origin` and `evidence: re-opened`.
If none exist, return `none, because <reason>` — that is a true and useful result, and coverage is
genuinely thin outside software and infrastructure.

**Output budget: 12–20 rows**, at least half of them traps. Discovery channel only. Executive
summary of 400 words or fewer first.

## Stage 2 — Merge and tier

**A dispatched agent, not the orchestrator.** In v0.1 the orchestrator did this inline and
consumed 58% of the run — more than every subagent combined. Read both harvest files from disk by
path, write `merged.jsonl`, and return **300 words or fewer**: counts by type and depth, the merge
log, and anything the audit should look at. Do not return the rows themselves.

1. **Merge true duplicates only.** A duplicate is **same subject AND same depth AND same claim.**
   Same subject at two depths is *not* a duplicate — it is what the depth model exists to express,
   and collapsing those pairs destroys the judgment tier while appearing to do the job. In v0.1,
   five pairs looked like duplicates by subject and only one was. Merge logs cite the exact IDs on
   both sides; the absorbed row is graded `merged`, never deleted.
2. **Assign `id`.** This stage owns it. Later stages adopt IDs and never renumber.
3. **Check every `depth` against the failure-signature table**, including the harvester's
   `depth_check` sentence. Where the two harvests disagree on the same item, keep the lower level
   and note it — a reader who over-learns a fundamental loses less than one who skips it.
4. **Author `type: drill` rows**, one per cluster of related concepts, including for the largest
   clusters. In v0.1 the two biggest clusters had no drill. Drills are consumer-agnostic: a drill
   exercises an idea, and the idea does not know who is studying it. `evidence: authored`.
5. Fill `lineage` on every row.

Drills are authored here, upstream of the audit, so that authored rows still pass a quality gate.
Nothing may be generated after Stage 3.

Both channels required — VERDICT (merges, depth corrections) and DISCOVERY (drills). Only legal
empty state is `none, because <reason>`.

## Stage 3 — Audit

One agent, independent of the harvest. Route to a different model where one is available — same
model with a fresh brief is the weakest rung of the independence ladder, and v0.1 could only
manage a tier contrast, which it recorded as a limitation.

Two standing briefs:

1. **Look for absence, not only for error.** Write your own list of the three to five things
   anyone studying this topic obviously must know **before reading the rows**, then check it
   against them. Confirm each is present (cite the row ID) or genuinely outside the declared
   boundary. Anything missing is a DISCOVERY finding — write the row yourself in full schema. In
   v0.1 this brief produced the run's best finding: every "additive changes are safe" claim was
   silently conditional on a principle that was never harvested, from a file the harvest had
   opened twice. A pipeline briefed only to verify what is present cannot notice what is missing.
2. **Re-open every cited source** and confirm the page actually supports the claim. Correct
   `evidence` where it was overstated. A row whose source does not say what the row says is
   `killed` with the reason recorded — not quietly fixed. Prioritize: all `exercise` rows first, then
   any numeric claim, then anything whose URL looks templated or unpinned, then the rest. **Report
   coverage as a fraction and name what you did not check.** Do not silently sample.

Also check: prohibited fields; `depth` assignments inconsistent with the table or with their own
`depth_check` sentence; whether `judgment` is being used as a general "advanced" bucket; whether
the drills actually exercise what they claim.

Both channels required. Append your verdicts to `audit-verdicts.jsonl` as one record per changed
or added row; the orchestrator applies them.

---

## Declined substrate patterns

Recorded as decisions, not omissions.

- **DFN-2, counter-case required per entry — declined at row level.** "No entry survives without
  one" was written for candidates competing in a scored set. A topic fundamental competes with
  nothing, and forcing a counter-case onto it produces filler. Counter-cases belong to the
  consumer: a study guide renders "when this does not apply" for a trap, where it means something.
- **MSR-3, falsification by date — declined.** No entry here predicts an outcome, so there is no
  observation that would show it dead by a date.
- **Two-channel contract at Stage 1 — declined.** Both v0.1 harvesters correctly returned
  `none, because this is the first stage`. A contract that can only be satisfied vacuously is
  overhead. It binds at Stages 2 and 3, where prior rows exist.

## Open in v0.2

- `type` is a closed enum with no escape hatch. If a run needs a fifth kind, that is a retro
  finding, not something a stage invents mid-run.
- Whether the `depth_check` field actually fixes the judgment/mechanism blur, or whether
  harvesters will write a confident sentence for a wrong assignment, is untested. n=0 runs at v0.2.
- Exercise coverage outside software and infrastructure is expected to be thin and has still never
  been tested on a non-technical topic.
- Whether a **time budget** belongs as an input is unresolved. It is arguably not a use case — it
  constrains how much a reader can consume, not what they need it for — but it would change what
  the analysis returns, and the analysis is meant to be consumer-agnostic. See
  [v0.3-efficiency-proposal.md](v0.3-efficiency-proposal.md).
