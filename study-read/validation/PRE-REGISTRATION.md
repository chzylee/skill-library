# Pre-registration — chaptering validation

Written **before** the checker ran. Its purpose is to stop the experimenter from
rationalising the void condition after seeing the scores.

Run date: 2026-08-14. Author: the orchestrating session, not an independent party.

---

## What changed from the design, and why

`DESIGN-v1.md` §11 specifies two kinds of blind control and treats any control rated
`principle` as voiding the run. On inspecting the generated controls, that rule is wrong
for one of the two kinds.

**The surface controls are not reliably invalid.** They group rows that share a word in
`subject`. The assumption was that a shared word is a surface feature. In a well-harvested
technical topic that assumption fails often: domain nouns like *drift*, *locking*, and
*partition* **name mechanisms**, so grouping by them can land on a genuine governing
principle. Surface grouping and principle grouping converge wherever the vocabulary is
good.

The heterogeneity filter in `make_controls.py` selects clusters spanning several `type` and
`depth` values. That measures structural spread, not whether the shared word is itself a
cause. It cannot catch this.

**This is a finding about the premise, not only about the instrument.** The design rests on
Chi's expert/novice result — experts organise by deep structure, novices by surface
features. That distinction is sharper in physics problems, where surface features are cover
stories, than in a documented technical domain, where the vocabulary was built to name the
mechanisms. The gap between a surface grouping and a principled one is genuinely narrower
here than the design assumed.

## Revised void condition

- **Void trigger: the 8 SHUFFLED controls only.** A real chapter's `because` kept verbatim
  over members drawn at random from the same topic cannot be a valid principle under any
  reading. If the checker rates any shuffled control `principle`, it is not reading the
  members, and the run is void.
- **The 8 SURFACE controls are a soft signal.** They stay in the scored set. Their verdicts
  are reported but do not void the run.

## Pre-registered assessment of each surface control

My judgment, recorded before any score was seen.

| Control | Assessment | Reasoning |
|---|---|---|
| kafka `partition` | accidentally valid | "The partition, not the topic, is the atomic unit of ordering, isolation, sequencing." Every member genuinely exemplifies it. A `principle` verdict here is CORRECT. |
| kafka `commit` | accidentally valid | "The commit is the one true checkpoint; every guarantee falls out of when it fires." Real claim, members fit. A `principle` verdict is CORRECT. |
| tf-v02 `drift` | accidentally valid | Restates v02's own real ch-13 almost exactly. A `principle` verdict is CORRECT. |
| tf-v02 `locking` | accidentally valid | Restates v02's own real ch-02 almost exactly. A `principle` verdict is CORRECT. |
| api `contract` | weak control | A genuine principle about consumer-driven contracts, but two members are the same workshop in two languages. Either verdict is defensible. |
| tf-v03 `modules` | weak control | Coherent except for one clear intruder, a broad exam-prep index resource. Either verdict is defensible. |
| api `change` | usable control | A topic bucket ("things about breaking changes") dressed up as a gate. Should score restatement or surface. |
| tf-v03 `provider` | usable control | The lock-file and credential-rotation rows are not consequences of provider config being global. Should score restatement or surface. |

**So the surface controls yield at most 2 genuinely diagnostic items.** That is too few to
carry a void decision, which is why the shuffled controls now carry it alone.

## What this costs the experiment

The void check is weaker than designed. It now proves only that the checker reads the
members, not that it can tell a principled grouping from a plausible one over related rows.
That second property is the one the design most wanted evidence for, and this run will not
produce it.

A future run wanting that evidence needs a third control type: **rows that genuinely share a
mechanism, grouped correctly, with a `because` that names the wrong cause.** That isolates
the warrant from the grouping. Not built here; recorded as the gap.

## Pass condition, unchanged from the design

- All 8 shuffled controls rated `restatement` or `surface`, else VOID.
- Then: at least 70% of real chapters rated `principle`, and no single topic below 50%.
- 50-69%, or any topic at 40-49%, is BORDERLINE and stops for a human.
