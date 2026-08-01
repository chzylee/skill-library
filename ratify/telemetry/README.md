# Ship Pipeline — Telemetry Corpus (`sends.jsonl`)

> **What this is.** A plugin-owned, user-global, append-only event log that ship-pipeline skills
> write to as you build. `/ratify` is its first writer: one JSON line per ratified judgment item.
> The per-project `RATIFICATION_LOG.md` is the human record of a single build; this corpus is the
> **machine record across every build**, sanitized by construction so it is fit to present.
> Sourcing convention: this document specifies the format; the emitting behavior is defined in
> [`SKILL.md`](../SKILL.md).

## Why it exists

The pipeline's claim is that you can build at LLM speed **and own the result**. `/ratify` is where
that claim is tested — you predict before the reveal, and the gap is the proof of understanding.
A single `RATIFICATION_LOG.md` shows that for one project. This corpus turns a scattered pile of
per-project logs into **one body of evidence** you can aggregate and show: *across N sittings on M
projects, here is how often I predicted correctly, how well-calibrated I was, and how often I
actively steered the design instead of approving it.*

That is the presentable artifact behind "quickly generated, genuinely owned."

## Where it lives

| | |
|---|---|
| **Corpus** | `~/.claude/ship-pipeline/sends.jsonl` |
| **Identity** | `~/.claude/ship-pipeline/install.json` — `install_id`, `install_salt`, `sitting_seq` counter |
| **Resolution** | `$HOME` resolved at runtime — never a hardcoded absolute path. Honor `$SHIP_PIPELINE_DATA_DIR` if set (default `~/.claude/ship-pipeline`). |
| **Ownership** | The ship-pipeline skillset owns this directory. Future skills append their own event types to the same file (disambiguated by `source_skill`). |
| **Not in any repo** | User-global, so it aggregates across projects — and so it survives `git pull` / `claude plugin update`, which would clobber anything written into the plugin's own install dir. Never commit it to a project repo. |

Standard app-data pattern: mutable, user-scoped state lives under the app's config home
(`~/.claude/…`), not in the distributed source tree.

**Local-first.** Recording is on by default and needs no opt-in, because a local-only corpus that
never leaves the machine is not "collection" in the privacy sense — the consent gate is on
**transmission**, not recording. The one exception is an explicit `telemetry: "off"`, which records
nothing. So the corpus is useful to its owner whether or not it is ever shared, and nothing leaves
the machine without an explicit send opt-in. The setting is managed by `/ratify-configure`; a
first-run notice discloses local recording the first time `/ratify` runs unconfigured.

## The record — schema v3

One JSON object per line, one line per judgment item:

```json
{"schema_version":3,"source_skill":"ratify","skill_version":"0.4.0","timestamp":"2026-07-20T18:44:17Z","install_id":"9f3c1a7e4b0d2856","sitting_id":"c2d81f60a5934e17","record_id":"7b40e9c3d1f8a562","item_index":4,"project_id":"proj-7c2e91b4","sitting_seq":12,"sitting_planned":6,"subject_type":"non-code","baseline":"partial","cold":true,"pre_confidence":"high","prediction_outcome":"surprised","decision_origin":"human","gap":"authored","decision_type":"amend"}
```

### Stamps

| Field | Type | Values | Role |
|-------|------|--------|------|
| `schema_version` | int | `3` | The version of *this record format*, so older records still parse after the schema grows. Unrelated to your build's version. |
| `source_skill` | string | `"ratify"` | Which ship-pipeline skill emitted the row. |
| `skill_version` | string | e.g. `"0.4.0"` | The emitting skill's own version. **Distinct from `schema_version`:** one says how to *parse* a record, the other says what its fields *mean*. A protocol change that redefines a value without changing the shape is invisible without this. |
| `timestamp` | string | ISO-8601 UTC | When the item was ratified. |

### Identity

| Field | Type | Grain | Role |
|-------|------|-------|------|
| `install_id` | string | person/machine | The unit of analysis. Without it, one heavy user silently becomes the finding. Pseudonymous: random, never tied to an account. |
| `sitting_id` | string | one run | Groups the decisions of a single sitting. Decisions within a sitting share context and are **not** independent observations. |
| `record_id` | string | one decision | Identity, and the dedup key if the record is ever transmitted. Client-generated, which is what makes re-sending safe. |
| `item_index` | int | position in sitting | 1..N. Deterministic ordering, and `max(item_index)` is where sitting size lives. |

### Subject

| Field | Type | Values | Role |
|-------|------|--------|------|
| `project_id` | string | `hash(install_salt + project name)` | **Always present**; the grouping key. Salted per install so two users' identically-named repos never merge, and so the hash is not reversible by dictionary attack. |
| `project` | string | real repo/dir name | *Optional.* The human-readable name, logged only when the user allows it. The one field where free text can enter — which is why it is the redaction decision. |

### Sitting context — set at the open, inherited by every item

| Field | Type | Values | Role |
|-------|------|--------|------|
| `sitting_seq` | int | per-install counter | "Over time" **per person**. Counts every sitting, including untransmitted ones. |
| `sitting_planned` | int | items queued for *this* sitting | Already capped — not the whole backlog. What makes completion measurable. |
| `subject_type` | enum | `code` · `non-code` | What is under analysis. Also disentangles subject from `baseline`, which otherwise confounds it (`emergent` is the native regime of most non-code work). |
| `baseline` | enum | `documented` · `emergent` · `partial` | The regime the prediction was graded in — a spec of the design existed (`documented`), was articulated in-session (`emergent`), or *informed* but did not *specify* it (`partial`). This is what licenses a `judgment` verdict. |

### The measurement

| Field | Type | Values | Role |
|-------|------|--------|------|
| `cold` | bool | `true` · `false` | Whether the expectation formed **without** the priming sub-step. Fixed pre-reveal, so un-gameable. A `predicted` that needed priming is weaker evidence than one called cold. |
| `pre_confidence` | enum | `low` · `med` · `high` | Strength of the expectation, stated **before** the reveal. |
| `prediction_outcome` | enum | `predicted` · `surprised` · `no-opinion` | Was that expectation right — the foresight grade. |
| `decision_origin` | enum | `human` · `ai` · `human+ai` | Who originated the decision's substance — the authorship axis. |
| `gap` | enum | `authored` · `missing-info` · `judgment` · `none` | On a divergence, its *nature* (not a human-deficiency label). Only `judgment` is a true blind spot. |
| `decision_type` | enum | `build` · `demote` · `amend` | What you decided to *do*: accept as-is / drop or defer / accept with changes. |

### Provenance

| Field | Type | Role |
|-------|------|------|
| `backfilled` | bool | Present and `true` only on records reconstructed from a `RATIFICATION_LOG.md` rather than recorded live. Backfilled rows contain inferred values (notably `cold`) and must never be silently mixed with natively-recorded ones. |

## Invariants

A validator — and any analysis — can rely on these:

- `gap ∈ {authored, missing-info, judgment}` **⟺** `prediction_outcome = surprised`; `none` otherwise
- `prediction_outcome = no-opinion` **⟹** `cold = false` — structural, since the protocol mandates
  priming on a blank, so a `no-opinion` is by definition one that survived it
- `item_index` unique within `sitting_id`, running 1..N
- `sitting_seq` monotonic per `install_id`
- Sitting **completed** ⟺ `max(item_index) >= sitting_planned`; **abandoned** otherwise
- Every enum drawn from a closed allowlist; unknown fields are rejected, not ignored

**`gap` is only interpretable conditioned on `prediction_outcome`.** `none` means "no divergence"
on a `predicted` item and "no prediction to diverge from" on a `no-opinion` one — opposite quality
signals sharing a value. Never chart `gap` alone.

## Identifiers — how they are generated

`install_id`, `sitting_id`, and `record_id` are **random**; `project_id` is **derived**. They fail
in different ways, so they are made differently.

- **Random ids come from the OS, never from a model.** A model asked for a "random" id produces
  patterned, context-correlated output that is neither uniform nor collision-safe. Shell out:
  `uuidgen`, or `python -c "import uuid; print(uuid.uuid4().hex[:16])"`.
- **`install_id` and `install_salt` are generated once** and persisted to `install.json`; every
  later sitting reads them. Deleting that file resets identity — a free "forget me."
- **Neither leaves the machine until opt-in.** An identifier that never transmits is not tracking.
- **`project_id` is deterministic on purpose** — the same project must map to the same id across
  sittings. The salt is what stops determinism from becoming a collision: without it, every user's
  `portfolio` repo hashes identically and merges in a pooled corpus, and the digest is reversible
  by hashing common repo names.

No coordination and no server assignment is required — the same pattern as Stripe idempotency
keys, Segment `messageId`, and OpenTelemetry trace/span ids. Because `record_id` is
client-generated, **re-sending any range of the corpus is idempotent**, which is what allows
transmission to be built long after recording begins.

## What the data proves

The proof is not any single field — it is the cross-tabs a reader takes off the corpus:

- **`pre_confidence:high` × `prediction_outcome:predicted` × `cold:true`** — you knew what was
  coming before you saw it, with no priming. The strongest single row in the corpus.
- **`decision_type` in `{amend, demote}`** — you steered the design rather than approving it.
  Authorship, not consent.
- **`surprised` × `decision_type` in `{amend, demote}`** — the counterfactual: you didn't see it
  coming *and* you changed the artifact. This is the effect the protocol claims to produce, and
  the closest thing to a direct effectiveness measure.
- **`pre_confidence` × `prediction_outcome`** — calibration: not just whether you were right, but
  whether you *knew when you knew*. Read as a reliability diagram; summarize as calibration error.
- **`surprised` × `decision_origin:human` × `gap:authored`** — you were "surprised" only because
  you overrode the recommendation and authored the better call.
- **`gap:judgment` rate** — the *true* blind-spot rate, isolated from `missing-info` (facts you
  couldn't have had) and `authored` (calls you drove). This, not the raw `surprised` count, is the
  number that should trend down as you master a domain.
- **`gap:judgment` × `baseline`** — a `judgment` miss is only fairly charged when the dots existed
  to connect (`documented` / `partial`).
- **`subject_type`** — whether mastery develops differently on code and non-code work, which
  `baseline` alone cannot tell you.

### Reading a population honestly

Three rules keep an aggregate defensible once the corpus spans more than one person:

1. **Report n at every level** — *K decisions across M sittings by N installs on P projects.* A
   single number without its grain hides whether it describes a population or an enthusiast.
2. **Macro-average, don't pool.** Compute per-`install_id` rates and average *those*. Pooling lets
   one heavy user's decisions become the finding.
3. **Plot learning against `sitting_seq`, never against `timestamp`.** Calendar time mixes
   newcomers with veterans: as adoption grows, the pooled surprise rate rises even while every
   individual improves. The honest version is the within-person slope — fit each install's own
   trend, then average the slopes.

Reading examples — `jq` shown for brevity, but the corpus is plain JSON Lines that any language
reads; nothing here is a dependency of the pipeline:

```bash
CORPUS=~/.claude/ship-pipeline/sends.jsonl

# Cold prediction accuracy on high-confidence calls
jq -s '[.[]|select(.pre_confidence=="high" and .cold)] | (map(select(.prediction_outcome=="predicted"))|length) as $hit
        | "\($hit)/\(length) high-confidence cold calls predicted"' "$CORPUS"

# Authorship rate — how often the design was steered
jq -s '(map(select(.decision_type!="build"))|length) as $steered
        | "\($steered)/\(length) decisions amended or demoted"' "$CORPUS"

# Grain of the dataset, before quoting any rate
jq -s '{decisions:length, sittings:(map(.sitting_id)|unique|length),
        installs:(map(.install_id)|unique|length), projects:(map(.project_id)|unique|length)}' "$CORPUS"

# Learning curve: surprise rate by per-person sitting number
jq -s 'group_by(.sitting_seq)[] | {seq:.[0].sitting_seq, n:length,
        surprised:(map(select(.prediction_outcome=="surprised"))|length)}' "$CORPUS"
```

Metrics are computed at read time from raw facts — the corpus never stores a derived accuracy, so
you can change how you measure without rewriting history.

**Facts, not verdicts.** The corpus records what happened, not why. Some cells are deliberately
ambiguous: `high` confidence + `surprised`, for instance, could mean too much was left to the
agent *or* that the design was weak upstream — the data alone cannot tell which. Read the
cross-tabs as evidence a human interprets, never as an automated conclusion.

## The sensitivity call

Once per sitting, before appending: *is the project's identity something you'd rather not have in
a shareable corpus?*

- **Default** — log the real `project` name alongside `project_id`.
- **If yes** — omit `project` entirely. `project_id` is a salted hash and is always present, so
  every measurement still aggregates; only the readable name is withheld.

Because the record **structurally holds no free text** — the item label and the reading pointer
live only in `RATIFICATION_LOG.md` — this is the *only* redaction decision. That is what makes
automatic capture safe: there is nowhere in a record for sensitive content to land, so the corpus
is presentation-fit by construction, not by per-item review.

The one honest exception: `project` is a user-chosen string, so on the tier that includes it the
"no free text" guarantee is a policy rather than a structural fact. Say so plainly rather than
over-claiming.

## Two logs, two masters

| | `RATIFICATION_LOG.md` | `sends.jsonl` |
|---|---|---|
| **Lives** | in the project repo, beside the artifact | `~/.claude/ship-pipeline/` (user-global) |
| **Audience** | a dev/team auditing *this* build — a commit history of the human decisions | you, aggregating *across* builds for evidence |
| **Holds** | full record incl. item label + assigned reading (free text) | enums + scalars only — no free text |
| **Grain** | one row per judgment item + a per-sitting summary | one line per judgment item |

## Rules

- **Append-only.** One line per item; never rewrite a past line. Re-ratifying a doc appends fresh
  records (a new sitting) — it does not edit old ones. The corpus is a history, like the human log.
- **Recording is on by default; only `telemetry: "off"` disables it.** Transmission is separately
  gated and no version does it yet. Managed by `/ratify-configure`.
- **Version inside every record.** When the schema grows, bump `schema_version`; old records keep
  their number and still parse.
- **No free text.** Anything a viewer shouldn't see has no field to live in.
- **`gap` always present.** `none` when there was no divergence to characterize.
- **Sitting-scoped fields are set once at the open** and stamped on each record; `baseline` changes
  mid-sitting only on an explicit, declared state change, never silent drift.
- **Backfilled records are marked.** Inferred values never masquerade as recorded ones.

## Schema changelog

- **v1** (2026-07-11) — initial: `schema_version`, `source_skill`, `timestamp`, `project`,
  `development_stage`, `pre_confidence`, `prediction_outcome`, `decision_type`.
- **v2** (2026-07-15) — additive: `baseline` (documented/emergent/partial), `decision_origin`
  (human/ai/human+ai), `gap` (authored/missing-info/judgment, omitted when `predicted`). v1 records
  keep `schema_version:1` and still parse. Adds the axes that separate *foresight* (was I right)
  from *authorship* (who drove it) and *gap nature* (a fact I lacked vs a judgment I should have
  had) — so a `surprised` that was really an override stops reading as a miss. Ratified via
  `/ratify`; see the skill's `RATIFICATION_LOG.md`.
- **v3** (2026-07-20) — the first **non-additive** revision; makes the corpus analyzable across
  more than one person.
  - **Added, identity:** `install_id`, `sitting_id`, `record_id`, `item_index`. Without these an
    aggregate cannot report its own grain, cannot avoid one user dominating it, and cannot be
    transmitted idempotently.
  - **Added, context:** `sitting_seq` (learning measured per person, not per calendar),
    `sitting_planned` (completion vs. abandonment), `subject_type` (code/non-code, which
    `baseline` otherwise confounds), `project_id` (salted — fixes cross-user collision *and* the
    reversibility of an unsalted name hash), `skill_version` (so a protocol change is segmentable).
  - **Added, measurement:** `cold` — whether the expectation formed before the priming sub-step.
    The published "predicted cold" figure was previously not derivable from the corpus at all.
  - **Added, provenance:** `backfilled`.
  - **Changed:** `gap` is now always present, taking `none` in place of omission — including on
    `no-opinion`, which v2 left ambiguous (the rule said to set it, the definition said there was
    nothing to characterize).
  - **Removed:** `development_stage`. Every v2 record carries `standalone`, and the field could
    only be inferred rather than known outside a pipeline invocation, which risked false positives.
    It returns — caller-supplied, never inferred — when more stages invoke `/ratify`.
