---
name: ratify
description: 'The ratification protocol for blocking stops in any pipeline stage: turns "OK" clicks into demonstrated judgment via prediction-before-reveal. The human states their expectation BEFORE seeing the recommendation; the gap between the two is the discussion; every decision is logged as predicted / surprised / no-opinion — with who authored it and what kind of gap it exposed — producing a measurable ownership record and a blind-spot reading list — plus a sanitized, append-only telemetry corpus that compounds across builds into presentable proof. Invoked by other pipeline skills at their STOP gates, or standalone on any decision list ("ratify this spec", "ratify TEST_SPEC.md", "walk me through ratifying these", "run the ratification protocol"). Done when every judgment item has a logged outcome — not when the doc is approved.'
---

# Ratify

Every dialogue-driven pipeline stage ends its phases in blocking stops so the human decides
instead of the model. This skill is **the human side of those stops**. Phase skills define what
the AI must produce; this one defines what the human must *do* for their yes to mean anything.

The failure it exists to kill: **rubber-stamping at ratification speed.** A recommendation that
"seems like it makes sense" gets OK'd, the details fly over the human's head, and the stop gate —
the whole point of the dialogue — becomes theater. "AI recommends, users decide" only holds if
deciding is an act. An approval that costs nothing proves nothing.

The mechanism is teach-back, borrowed from medicine: informed consent isn't a signature, it's the
patient restating the plan in their own words. Here, it's the human stating what they *expect*
before the recommendation is revealed. You cannot rubber-stamp a question you had to answer first.

## The decision contract — establish this before walking items

Every phase that invokes this protocol has (or gets) a three-field contract. If the invoking
skill declares these, use them; otherwise derive them and confirm in one line before starting.

1. **Human function** — what must the human be able to assert, in domain language, when this
   phase closes? (For a test spec: "I know what must be true, what we deliberately don't test,
   and where the risk concentrates.")
2. **Evidence format** — what artifact does the human judge? A claim in domain language, a diff,
   a red-then-green test, a rendered output, a running trace. **Never prose reassurance.**
3. **Pace** — chunk size and batch cap (defaults below).

Also set the sitting's **`baseline`** at the open — the regime the predictions are graded in:
`documented` (an external spec of the design exists), `emergent` (the design is being articulated
in-session; the native mode of most non-code work), or `partial` (documented material *informs*
the artifact but does not *specify* it). Infer it at the start, carry it forward per item, and
change it mid-sitting only by an explicit, declared state change — never silent drift. Baseline is
what licenses a `judgment` verdict: without dots laid out (`emergent`), a miss is usually
`missing-info`, not judgment.

The AI's role derives from the contract as its complement: where the human is the oracle
(domain knowledge, intent, taste), the AI is the **examiner** — its job is to extract and verify
the human's judgment, not to collect approvals.

## The protocol — prediction before reveal

Run per item, threaded into conversation (see Chunking). The order is the mechanism —
**never reveal the recommendation before the elicitation.**

1. **Set the scene.** A short conversational preface in *domain language, not code language*:
   the situation, why it matters, what's at stake. ("DOL publishes quarterly files
   cumulatively — Q2 contains Q1's filings. Someone drops both into the data folder.") Give
   everything needed to have an opinion; give nothing that telegraphs the answer.
2. **Elicit.** Ask what the user expects or wants to happen. Open question, their words. This is
   a conversation, not a quiz — tangents and "wait, how does X work?" are the process working,
   not interruptions. Answer questions about the *situation* freely; hold the recommendation back.
   Before revealing, get a one-word confidence read on their stated expectation — **low / med /
   high**. This is `pre_confidence`: captured pre-reveal so it measures foresight honestly, and it
   pairs with the outcome to show calibration. Keep it light — one word, not a discussion.
   - **On a blank (no expectation forms):** ratify is not an exam. Surface a bounded amount of
     *factual, readable* context — never the recommendation (that would telegraph the answer and
     break the order) — and re-elicit once. Whether the priming lets an opinion form is itself the
     diagnostic that classifies the gap in step 4: an opinion now → the gap was `missing-info`; a
     blank that survives priming → a real `no-opinion`, which is a finding.
3. **Reveal and diff.** Show the recommendation. The delta between their stated expectation and
   the proposal *is* the discussion. Match → confirm fast and move on; the speed is earned.
   Divergence → work it: one of the two is wrong, and finding out which is the entire value of
   the stop.
4. **Ratify, decide, and grade.** Record these for the item:
   - **`decision_type`** — what they decided to *do* with the recommendation: `build` (accept as
     is), `amend` (accept with changes), `demote` (drop or defer it). `amend` and `demote` are
     active authorship — the record of where the human steered the design rather than approving it.
   - **`prediction_outcome`** — the foresight grade on their pre-reveal expectation:
     - `predicted` — expectation matched the recommendation. A fast, legitimate yes.
     - `surprised` — they had an expectation and the reveal contradicted it (or exposed something
       they hadn't considered). The decision may still ratify as recommended — the grade tracks
       *foresight*, not correctness of the final call.
     - `no-opinion` — they couldn't form an expectation. Not a failure — a **finding**: it is the
       precise, automatically-generated signal for what to go read.
   - **`pre_confidence`** — the `low` / `med` / `high` they gave before the reveal (step 2).
   - **`decision_origin`** — who originated the *substance* of the decision: `human` (you drove or
     overrode it), `ai` (the recommendation stood), `human+ai` (jointly shaped). Present on every
     item, `predicted` ones included — a fast yes can still be AI-originated. The authorship axis,
     separate from the foresight grade.
   - **`gap`** — only when `prediction_outcome ≠ predicted`: the *nature of the divergence from the
     prediction*, not a deficiency taxonomy of the human. One of:
     - `authored` — the divergence is your addition or override; you supplied what the prediction
       didn't. A positive gap — ownership; owes no reading.
     - `missing-info` — you lacked a fact that was not derivable pre-reveal; once surfaced, you
       decided. A question answered, not a fault.
     - `judgment` — the dots *were* connectable (chiefly: a documented baseline held them) and you
       didn't connect them. The real blind spot — the only `gap` that feeds the reading list.
     When aligned (`predicted`), `gap` has no value. **The derivability test** sorts missing-info
     from judgment: after the reveal, was the missed piece connectable from what already existed
     (the design baseline)? No → `missing-info`; yes → `judgment`. `judgment` is the default; any
     downgrade must carry its reason in the log row.
5. **Assign reading.** Reading is owed only where there was a real blind spot: a `gap: judgment`
   or a `no-opinion` that survived priming. Each gets a concrete pointer logged with it — the code
   path, design-doc section, or data source that would have produced the opinion. A `gap:
   missing-info` is a note, not homework; a `gap: authored` owes nothing. The blind spots assemble
   the reading list; nothing is read out of guilt.

## Chunking — conversation threads, not an atomized quiz, not bulk approval

- **Thread = one coherent risk area or component** ("employer normalization," "the manual-input
  files"), prefaced with its scene-setting narrative. Items inside a thread flow as one
  conversation — the preface does double duty for all of them.
- **Mechanical items** (obviously correct, cleanly traced, no real fork) are grouped and
  confirmed in one pass. The protocol spends its cost exactly where the human is the oracle;
  everywhere else, compress.
- **Batch cap:** default **~10 judgment items per sitting**, MUST-tier first while attention is
  fresh. At the cap, offer to stop and resume — say so plainly: a stale yes is worse than a slow
  one. Multiple sittings are the norm for a real spec, not a failure to finish.
- **The balance rule:** the AI works in large chunks; the human engages at chunk boundaries.
  Item-by-item atomization of the mechanical burns the human's attention before it reaches the
  judgment calls; whole-spec-at-once is the rubber stamp. The chunk boundary — one risk area —
  is where intentional dialogue lives.

## The log — ownership made measurable

Write `RATIFICATION_LOG.md` beside the ratified artifact (append per sitting; never clobber —
the log is a record, like the spec it accompanies). Per judgment item:

```
| item | expectation stated | pre-conf | outcome | origin | gap | decision | reading assigned |
```

Plus a summary line per sitting: **prediction accuracy over judgment items** — "9/12 predicted,
2 surprised, 1 no-opinion." High accuracy means the fast yeses were legitimate and the human owns
this system. Low accuracy means the green light was under-informed — and the log says exactly
where, which is worth more than the score.

**Feed-forward:** the `surprised` / `no-opinion` list is direct input to the ownership stage
(`/own-your-code`): the surprises are the study guide. What a teammate (or the future you)
inherits is not "approved" but *"anticipated correctly here, surprised there — read the
surprised ones first."*

## The machine corpus — data that compounds

The `RATIFICATION_LOG.md` is the human record of one build. Alongside it, append **one JSON line
per judgment item** to the Ship Pipeline telemetry corpus — the machine record across *every*
build. This is what turns scattered per-project logs into one presentable body of evidence that
owned code is being produced at agentic speed. Full spec:
[`telemetry/README.md`](telemetry/README.md).

**Where:** `~/.claude/ship-pipeline/sends.jsonl` — resolve `$HOME` at runtime (never hardcode an
absolute path; honor `$SHIP_PIPELINE_DATA_DIR` if set). Plugin-owned, user-global, append-only,
**never committed to a project repo**. Create the directory if absent.

**The telemetry setting gates recording, and (later) sending.** At the sitting's open, read
`~/.claude/ship-pipeline/config.json`:

- **absent (never configured)** — record locally, and **once**, show the first-run notice below.
  Recording local-first before opt-in is safe because nothing transmits and the notice discloses it
  immediately; the setting's job is to gate *sending*, which no version does yet.
- **`telemetry: "local"`** — record locally; the user has acknowledged it. Never transmit.
- **`telemetry: "off"`** — record nothing this sitting. Skip the whole corpus block.

Managed by [`/ratify-configure`](../ratify-configure/SKILL.md) — never hand-edit `config.json` here.

**First-run notice** (show once, when `config.json` is absent — plain, not a consent gate since
nothing leaves the machine):

> 📊 Ratify records one enums-only line per decision to `~/.claude/ship-pipeline/sends.jsonl` on
> this machine — no code, paths, prompts, or item text, so it's safe to read and, later, to share.
> It's local and never sent anywhere. Run `/ratify-configure` to see your own numbers, keep it as
> is, or turn it off.

**One record per judgment item** (schema v3):

```json
{"schema_version":3,"source_skill":"ratify","skill_version":"<x.y.z>","timestamp":"<ISO-8601 UTC>","install_id":"<id>","sitting_id":"<id>","record_id":"<id>","item_index":1,"project_id":"proj-<hash>","sitting_seq":1,"sitting_planned":6,"subject_type":"code|non-code","baseline":"documented|emergent|partial","cold":true,"pre_confidence":"low|med|high","prediction_outcome":"predicted|surprised|no-opinion","decision_origin":"human|ai|human+ai","gap":"authored|missing-info|judgment|none","decision_type":"build|demote|amend"}
```

**At the sitting's open** — establish once, then stamp on every record from the sitting:

- `install_id` / `install_salt` — read from `~/.claude/ship-pipeline/install.json`; create on
  first run. **Never author an id yourself** — model-generated "random" strings are patterned and
  collide. Shell out: `uuidgen`, or `python -c "import uuid; print(uuid.uuid4().hex[:16])"`.
- `sitting_id` — one OS-generated id for the sitting.
- `sitting_seq` — increment the per-install counter in `install.json`. Counts *every* sitting,
  including untransmitted ones, so the experience axis survives partial sends.
- `sitting_planned` — judgment items queued **for this sitting**, already capped. Not the whole
  backlog: a sitting that legitimately stops at the batch cap must not read as abandoned.
- `subject_type` — `code` · `non-code`. What is under analysis, not the artifact's file type.
- `project_id` — `hash(install_salt + project name)`; always present, the grouping key.
- `skill_version` — this skill's `VERSION`. Distinct from `schema_version`: one says how to parse
  a record, the other says what its fields *mean*. A protocol change that redefines a value must
  be segmentable after the fact.

**Per item:**

- `record_id` — one OS-generated id. Identity, and the dedup key if the record is ever transmitted.
- `item_index` — 1..N within the sitting. `max(item_index)` against `sitting_planned` is how a
  completed sitting is told from an abandoned one.
- `cold` — `true` when the expectation formed **without** the priming sub-step; `false` when a
  blank was primed first. Fixed pre-reveal, so it stays un-gameable. A `predicted` that needed
  priming is not the same evidence as one called cold.
- `baseline`, `pre_confidence`, `prediction_outcome`, `decision_origin`, `decision_type` — exactly
  as graded in the protocol above.
- `gap` — `authored` · `missing-info` · `judgment` on a `surprised` item, `none` otherwise.
  **Always present.** Only interpretable *conditioned on `prediction_outcome`*: `none` means "no
  divergence" on a `predicted` item and "no prediction to diverge from" on a `no-opinion` one.
  Never chart `gap` alone.
- **No free text ever.** The item label and the assigned reading live only in
  `RATIFICATION_LOG.md`. The corpus carries enums and scalars, so it is presentation-safe by
  construction — showable on a screen without leaking a build.

**The sensitivity call** — once per sitting, before appending: is the project's *identity*
something the user would rather not have in a shareable corpus? `project_id` is always logged and
is already a salted hash, so this decides only whether the human-readable `project` name rides
along. Default logs it; if the user says no, omit the field entirely. Because a record structurally
holds no free text, this is the only redaction decision — ask it once, not per item.

**Append-only.** One line per item, never rewrite a past line. Re-ratifying a doc appends fresh
records (a new sitting); it does not edit old ones — the corpus is a history, like the human log
it mirrors.

## When to run full protocol vs. compress

Stakes-based, by the decision contract's first field:

- **Full protocol** where the human is the oracle: test-spec ratification, acceptance criteria,
  SKIP lists, scope cuts, anything where their domain knowledge is the only source of truth.
- **Plain confirm** where they aren't: mechanical trace-throughs, decisions the design doc
  already made, implementation details below the contract line.

This is also the concurrency rule for running many builds in parallel: the ratification stop is
the **human serialization point** — the one place work must wait for a person. Everything else
can parallelize; guard this bottleneck by keeping it small (judgment items only) and real
(prediction-first), not by skipping it.

## Notes

- **Order is the mechanism.** Elicit before reveal, always. A reveal-first stop is a different
  (weaker) protocol, even with the same questions.
- **Read-only** except `RATIFICATION_LOG.md` and the append-only telemetry corpus
  (`~/.claude/ship-pipeline/sends.jsonl` — see [The machine corpus](#the-machine-corpus--data-that-compounds)).
- **`no-opinion` is a finding, not a failure** — say this to the user the first time it happens.
- **Composes, doesn't replace.** Invoked by a phase skill (e.g. `/test-spec`'s Judgment and
  User-challenge stops), it runs inside that skill's dialogue and inherits its item
  classification. Standalone, it can walk any decision list or re-ratify an existing doc —
  re-ratifying a spec you OK'd too fast is a first-class use.
- **Done = every judgment item has a logged outcome.** A ratified doc with no log means the
  protocol didn't run.
