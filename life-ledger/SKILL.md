---
name: life-ledger
description: 'Populate a Life Ledger — a structured, opinion-free personal profile for deducing identity patterns (identity is a compression of a corpus). Local-first: facts and patterns live in append-only JSONL under ~/.claude/life-ledger/ with a self-contained HTML viewer regenerated on every write — no external dependencies. Two modes: from-scratch (bootstrap the store, then interview from zero) and from-what-exists (read the ledger, fill gaps the data exposes, ask further from genuine reader curiosity). Open Q&A by turns, never multiple-choice about a life; episode questions over summary questions; neutral fact wording with sensitive facts anonymized by default; ability claims become claimed Pattern rows, not facts; batches read back for sign-off before writing. Trigger on "populate my life ledger", "life ledger interview", "interview me for my profile", "add to my life ledger", "start a life ledger", or /life-ledger. To just view the ledger, use the life-ledger-view skill.'
---

# Life Ledger

Turn an unstructured life into structured data that reveals what a person could build
an identity around. The ledger is a **simulated logical cold-read**: records of what
might be observable about the subject to a theoretical generic person. Identity is
treated as a **compression of the corpus, not a prerequisite for it** — so the job is
never "define who you are"; it is to grow a corpus facts-first until patterns earn
their way out of it.

The schema must generalize to any subject; the data is maximally personal. Both are by
design. Overspecifying the schema to one person is the failure mode; deeply personal
data is the point.

## Storage (local-first, no dependencies)

All data lives under `~/.claude/life-ledger/`:

```
~/.claude/life-ledger/
  subjects/<subject>/          # default subject: the user's first name, lowercase
    facts.jsonl                # append-only fact store
    patterns.jsonl             # append-only pattern store
  viewer/index.html            # self-contained viewer, regenerated after every write
```

**Append-only with supersede semantics.** Never edit or delete a line. A correction is
a new line with the same `id`; the last occurrence of an `id` is its current state.
Retire a row by appending its current state plus `"retired": true`. This makes the
"never rewrite a fact" grammar structural and preserves full history for free.

Fact line:

```json
{"id":"f042","statement":"Ran a monthly tournament series","type":"creation","origin":"chosen","domains":["FGC","events"],"era":"2024–ongoing","precision":"year","artifacts":["https://..."],"source":"public-artifact","parent":null,"recorded_at":"2026-08-10"}
```

Pattern line:

```json
{"id":"p003","name":"Infrastructure-builder","claim":"Responds to community problems by building reusable infrastructure rather than one-off participation.","tier":"universal","claimed":false,"evidence":["f020","f005"],"recorded_at":"2026-08-10"}
```

Field rules (the schema — identical for every subject):

- `statement` — one factual sentence, **no quality adjectives** ("ran monthly
  tournaments", never "successfully ran"). Wording discipline is the anti-inflation
  mechanism; provenance is not a gate.
- `type` — `role | event | creation | practice | credential | circumstance |
  relationship | commitment`. "Skill" is deliberately absent: ability claims are
  compressions and belong in patterns.
- `origin` — `given | chosen | ambiguous` (the dealt hand vs. the play).
- `domains` — open vocabulary, per subject. Never impose a fixed list.
- `era` + `precision` (`exact | year | life-stage`) — honest imprecision is welcome;
  "childhood" is a valid era. Record guesses as guesses ("~2023 (guessed)").
- `source` — `public-artifact | third-party | recorded | self-reported`, ordered by
  external verifiability (`recorded` = contemporaneous private capture: logs,
  telemetry, dated journals). Metadata, never an admission gate: claims are admitted
  on say-so.
- `parent` — nesting mechanism: new detail = child fact, never a rewrite of the parent.
- Proof gaps are not a standing concern: proof matters only when a claim affects
  outcomes or multiple people (the blast-radius rule). The "what needs an artifact"
  list is an on-demand filter (`source = self-reported`), never a foregrounded view.
- Pattern `claim` — one **person-neutral** sentence, so patterns are comparable across
  subjects.
- Pattern `tier` — **earned, not declared**: start `personal`; promote to `universal`
  when linked evidence spans 2+ domains and includes at least one public-artifact or
  recorded source. Review promotions by hand when maintaining evidence.
- Pattern `claimed` — `true` = the subject asserts the presented evidence is sufficient
  to demonstrate the pattern for now; `false` = observer-derived, awaiting endorsement.
- **Anonymize sensitive facts by default**, at the granularity the subject would share
  person-to-person ("difficult mental health incident", not specifics). Full detail
  stays with the subject.

Reach (distinct domains across a pattern's evidence) is **computed by the viewer**,
never stored.

## Mode selection

Check for an existing store: `ls ~/.claude/life-ledger/subjects/`. Existing subject →
**from-what-exists**. Nothing there → offer **from-scratch**. An explicit user request
for a mode always wins. Both modes serve one goal: populating the profile.

### From scratch

1. Create the directory structure and empty `facts.jsonl` / `patterns.jsonl`.
2. Explain the deal in two sentences: facts are opinion-free and yours; patterns are
   interpretations that must earn their tier; everything stays on this machine.
3. Interview from zero (rules below). Open with territory the subject chooses, then
   walk eras chronologically. First session target is coverage of the major eras, not
   completeness — the ledger is grown, not filled in one sitting.

### From what exists

1. Read `facts.jsonl` and `patterns.jsonl` (current state = last line per id).
2. Interview with two question sources, interleaved:
   - **Coverage** — gaps the data itself exposes: eras marked guessed, thin
     load-bearing rows, domains with one row, `self-reported` rows that likely have
     artifacts.
   - **Curiosity** — read the ledger as a genuinely interested reader and ask what it
     makes you want to know. The top layer's governing question is *what might someone
     be interested in this person for?* — every reader's real curiosity is a data
     point, so an informed reader and a cold reader are different samples, not
     redundant runs.

## Interview rules (both modes)

- **Open Q&A by turns.** Ask, listen, follow up. One thread at a time; go deeper
  before wider.
- **Never multiple-choice about a life.** The subject must not pick from a menu about
  themselves. Discrete options only for discrete facts ("was that 2022 or 2023?").
- **Episode questions over summary questions.** "Tell me about a specific time you…"
  beats "how would you describe your…". Episodes produce facts; summaries produce
  self-assessments.
- When the subject makes an ability claim mid-story, don't challenge or inflate it —
  note it for a claimed personal-tier pattern and steer back to what happened.
- Honest imprecision over fake precision, always.

## Writing

- **Interview capture:** batch rows, read them back compactly (statement, type, era,
  source), get sign-off, then append. Write after each confirmed batch, not at the
  end — a dead session should lose minutes, not the interview. Flag any sensitive row
  and its anonymization explicitly during sign-off.
- **Document ingestion** (a resume, a bio page, anything the subject authored): may
  write directly without per-row sign-off — the source is already their words — but
  report what was written and flag imprecise claims as recorded ("thousands a month"
  stays flagged imprecise).
- **Maintenance pass after every write:** check whether new facts strengthen existing
  patterns (append updated pattern lines with expanded `evidence`), apply the earned-
  tier promotion rule, and surface new pattern candidates — as `claimed` if the subject
  asserted them, else unclaimed for endorsement.
- **Regenerate the viewer after every write session** by running the bundled script:
  `python3 scripts/build_viewer.py <subject>` (from this skill's directory). The viewer
  is part of the product — transparency into the data is the app. To open it for the
  user and wait while they browse, use the sibling `life-ledger-view` skill.

## Notion / external stores

None required, ever. If the subject wants the ledger visible elsewhere ("write this to
a Notion table so I can read it on my phone"), export a clearly dated **one-way
snapshot** on request and say it is one; never treat any external copy as a write
surface — the JSONL store is the single source of truth.

## Closing a session

Report: rows appended (facts and pattern updates), corrections superseded, sensitive
rows anonymized, gaps still visible, and the viewer path. No analysis beyond that —
compression work (deducing identity, strategy, "what might someone want me for") is a
separate activity with its own gate, not part of this skill.
