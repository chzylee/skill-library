# Ratification Log — ratify skill

> The human record of ratifying `/ratify`'s own design. Append-only, one section per sitting;
> never clobbered. Machine mirror: enums-only records in the Ship Pipeline telemetry corpus
> (`~/.claude/ship-pipeline/sends.jsonl`, `source_skill:ratify`). The skill eats its own dogfood —
> it is ratified by the protocol it defines.

## Sitting 1 — 2026-07-15 · v2 schema (standalone · `baseline: partial`)

**What was ratified:** the v2 telemetry schema + the protocol additions it required — the
`decision_origin` and `gap` axes, the `baseline` regime marker, and the no-opinion priming
sub-step. See [`DESIGN.md`](DESIGN.md) for the full rationale.

**Decision contract**
- **Human function** — Noah can state what each v2 field means, why it exists, and why the axes
  are shaped this way, well enough to run the protocol on another artifact unaided.
- **Evidence** — the schema definitions themselves, tested against the reclassified 20-item
  non-code corpus (does the structure re-describe the real data?). Not prose reassurance.
- **Pace** — the genuinely-open forks only, prediction-first; settled points not re-litigated.
- **Baseline** — `partial`: entered with a locked schema that named its open forks. The design
  *informed* these decisions without *specifying* them (they were the open questions). The
  inaugural v2 records carry the very value invented in the sitting.

| item | expectation stated (pre-reveal) | pre-conf | outcome | origin | gap | decision | reading assigned |
|---|---|---|---|---|---|---|---|
| 1 · does `authored` earn its own `gap` slot? | keep both — the fields are orthogonal; the cross-product (`authored` × `ai`/`human+ai`) is a signal collapse would destroy | high | surprised | human | authored | amend | none (authored ≠ a knowledge deficit) |
| 2 · `gap`/`origin` on a `no-opinion`? | keep both fields open; don't force one meaning | med | predicted | human+ai | — | amend | none |
| 3 · `baseline` grain — per-sitting or per-item? | per-item, sitting-inherited, changed only on an explicit declared state change | high | predicted | human+ai | — | amend | none |

**Mechanical pass (plain confirm, no prediction):** `schema_version → 2`; `decision_origin` = 3
values (human/ai/human+ai); `gap` fires only on non-`predicted` items; this sitting's records
logged in v2 format.

**Authored deltas (what the three amends changed):**
1. `gap` redefined as the *nature of the divergence from the prediction*, not a human-deficiency
   taxonomy — which is what lets `authored` be a coherent (positive) gap.
2. A new Elicit sub-step: on a blank, surface bounded *facts only* (never the recommendation) and
   re-elicit — plus the **derivability test** (was the missed dot connectable from what existed?
   no → `missing-info`, yes → `judgment`) as the global `missing-info` vs `judgment` classifier.
3. `baseline` gains a third value, `partial` (informs-but-doesn't-specify), turning the
   derivability test from a regime-presumption into a per-dot check.

**Summary:** 3 judgment items — **2 predicted, 1 surprised, 0 no-opinion · 3 amend · 2 human+ai,
1 human.** The lone surprise (item 1) was `decision_origin: human` / `gap: authored` — Noah
overrode the AI's collapse lean and authored the winning distinction. Under v1 that row reads
"high-confidence whiff"; under v2 it reads "authored override." The schema correctly describing
its own ratification is the anti-theater proof, live.

**Feed-forward:** no reading owed (no `judgment` gap, no surviving `no-opinion`). The design doc
this sitting produced becomes the `documented` baseline any future re-ratification runs against —
the emergent → documented arc, made concrete.
