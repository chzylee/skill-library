# ratify — design doc (v2)

> The rationale behind the ratify protocol and its v2 telemetry schema. `SKILL.md` is the *what*
> (the instructions the examiner runs); this is the *why* (the decisions those instructions
> encode, and the arguments underneath them). It exists so a future re-ratification runs against a
> `documented` baseline instead of an `emergent` one — this doc is the design that was missing when
> the skill was first built. Ratified 2026-07-15; see [`RATIFICATION_LOG.md`](RATIFICATION_LOG.md).

## The thesis: an un-black-boxing instrument

`/ratify` makes the human's *actual epistemic relationship* to each delegated decision legible and
typed. It separates two things that produce an identical artifact and are indistinguishable after
the fact:

> "the human **evaluated** the AI's output" and "the human **accepted** the AI's output"

That separation is the whole product. Agentic speed quietly swaps evaluation for acceptance while
leaving no trace; the prediction-before-reveal stop forces the distinction into the open and logs
it. The academic anchor is Chenhao Tan's *Mirage of Autonomous AI Scientists* — "humans shift to
evaluation and selection," systems must "maintain clear accountability for decisions" — and his
delegation line (Task Delegability, Conditional Delegation), which is where the `decision_origin`
axis comes from. Claim discipline borrowed from the same place: **instrument / log, never
"study/findings"; existence proof, never generalize from N.**

Code ownership is the *first* application, not the boundary. The instrument applies to any
delegated deliverable — an analysis, a design, a research job. Un-black-boxing a large agent job is
the general case; owning AI-written code is one instance of it.

## What v1 got right, and the one thing it conflated

v1 logged **foresight** — `predicted` / `surprised` / `no-opinion` — and that core is correct and
untouched. Its flaw surfaced the moment the instrument ran on non-code work with no design doc: a
single `surprised` value was doing three incompatible jobs.

- The human **out-designed / overrode** the AI (authorship — a *positive* divergence).
- The human **lacked a fact** that wasn't derivable pre-reveal (a question, not a fault).
- The human **missed a judgment** the design already contained (the real blind spot).

Booking all three as "surprised" made authorship and fact-lookups read as deficits. On the first
three non-code systems, **0 of 5 surprises were real judgment misses** — and the single
highest-confidence "surprise" was a case where the human overrode the AI on an information
advantage (the AI, not the human, lacked the fact). v1 mislabeled the strongest ownership moment in
the corpus as a whiff. v2 exists to fix exactly that.

## The v2 axes

Foresight is kept and joined by two axes that separate *evaluated* from *accepted*, plus a
sitting-level regime marker.

| axis | field | values | grain | when |
|---|---|---|---|---|
| foresight *(kept)* | `prediction_outcome` | predicted · surprised · no-opinion | item | always — **locked pre-reveal, un-gameable** |
| authorship | `decision_origin` | human · ai · human+ai | item | always (predicted items included) |
| gap nature | `gap` | authored · missing-info · judgment | item | only when `≠ predicted` |
| action *(kept)* | `decision_type` | build · amend · demote | item | always |
| regime | `baseline` | documented · emergent · partial | sitting → item | stamped each record |

### Why `gap` and `decision_origin` are both kept (not collapsed)

They correlate on divergences but are not the same axis. `decision_origin` applies to **every**
item — a `predicted` call can still be AI-originated. `gap` characterizes **only** a divergence.
The tempting collapse (treat `authored` as just `decision_origin: human`) fails because `authored`
crosses with the *other* origins and the cross-product is the signal:

| `decision_origin` | with `gap: authored` reads as |
|---|---|
| human | you overrode / authored what the AI wholly missed — clean ownership |
| human+ai | you compensated for a partial miss — a *possible* hole |
| ai | you authored against an AI-originated call — a *likelier* hole |

Collapsing would erase the middle and bottom rows. `gap` is defined as **the nature of the
divergence from the prediction — not a deficiency taxonomy of the human.** That definition is what
makes `authored` coherent as a gap (a positive divergence) rather than a contradiction, and it is
what lets the cross-tabs become qualitative reads over time: ownership at one end, "frequent design
holes, especially in code" at the other.

### The derivability test — `missing-info` vs `judgment`

The split is adjudicated, not self-reported. After the reveal: **was the missed piece connectable
from what already existed?**

- **Not derivable** (no more could be revealed without the human predicting first) → `missing-info`.
  Not a fault; the dots weren't on the table.
- **Derivable** (a documented design held the dots and the human didn't connect them) → `judgment`.
  The real blind spot.

This is a two-party check — the human's self-report plus the examiner asking "were the dots there?"
— which hardens the anti-gaming floor: you can't charitably label everything `missing-info`, and
`judgment` is the default that a downgrade must argue against (with the reason in the log row).
Only `judgment` (and a `no-opinion` that survives priming) feeds the reading list.

### `baseline` licenses the judgment verdict

A `judgment` miss is only fair when there were dots to connect. `baseline` records the regime:

- **`documented`** — an external spec of the design predates the prediction (typical of code:
  test-spec, finish-build). Judgment verdicts are fully in play.
- **`emergent`** — the design is articulated in-session, first externalized by the predictions
  themselves. The *native mode of non-code work*, not a deficiency. Misses here are usually
  `missing-info`; a `judgment` verdict is rarely fair (no dots were laid out).
- **`partial`** — documented material *informs* the artifact but does not *specify* it ("initial /
  inspirational docs, with the real spec still to be made"). Here the derivability test runs
  **per-dot**: was *this* missed dot in the informing material? Yes → judgment; no → missing-info.

`baseline` is per-item but sitting-inherited: inferred at the open, carried forward, changed
mid-sitting only by an explicit, declared state change — never silent drift (the same "transitions
are explicit events" discipline the Recording Standard uses one level up). It is **orthogonal to
`development_stage`**: a `standalone` re-ratify of a doc written last week is `documented`; a
`test-spec` run with no design doc is `emergent`. Don't infer one from the other.

## The no-opinion priming sub-step

A blank is not a failed exam question — **ratify should not always feel like an exam.** When no
expectation forms, the examiner surfaces a bounded amount of *factual, readable* context (never the
recommendation — that breaks the order) and re-elicits once. The result *is* the diagnostic: if an
opinion now forms, the gap was `missing-info`; if the blank survives priming, it is a genuine
`no-opinion` and a finding. This converts an inconclusive state toward a conclusive one instead of
defaulting.

## Design values carried through

- **Order is the mechanism** — elicit before reveal, always. The two new fields are assigned
  *after* the reveal, so `judgment` is the default and any downgrade carries its reason in the log.
- **Presentation-safe by construction** — enums and scalars only, no free text; the alias-or-real
  `project` name stays the sole redaction decision.
- **Additive migration** — v1 records keep `schema_version:1` and parse unchanged; v2 fields are
  absent on them. Metrics are computed at read time, so history is never rewritten.
- **Flexibility over strict enforcement, user sovereignty over baked-in defaults** — per-item
  `baseline` over per-sitting lock-in; the same spine that runs through the persona library's
  "no guardrails ingrained" and the Recording Standard's dropped maintainer-flag.

## The emergent → documented arc

This doc is itself the proof of the mechanism it describes. The v2 schema was ratified at
`baseline: partial` — no full design doc existed, only a locked schema with open forks. Producing
this document is what flips a future re-ratification to `documented`. **Emergent → documented is
the direction of un-black-boxing**, and the skill just walked its own path.
