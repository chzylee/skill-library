# Phase 0 verdict — chaptering validation

**Result: PASS.** 82.2% of real chapters rated `principle` by a blind checker, no topic
below 50%, and all 8 void-triggering controls correctly rejected. Phase 1 is unblocked.

Run 2026-08-14. Rule pre-registered in [PRE-REGISTRATION.md](PRE-REGISTRATION.md) before any
score was seen. Reproduce with:

```
python3 study-read/validation/score.py \
  --verdicts study-read/validation/scored/verdicts.jsonl \
  --key      study-read/validation/scored/scored-set-KEY.json
```

---

## 1. Void check — did the instrument work?

Eight shuffled controls: a real chapter's warrant kept verbatim, members replaced at random
from the same topic. These cannot be valid principles under any reading.

**All 8 rejected.** The checker's reasons name specific members rather than gesturing:

> "The warrant is about CLI workspaces sharing one backend, but not one member mentions
> workspaces at all."

It also found them by a route nobody designed: it noticed six warrants appearing **verbatim
twice** across the set and worked out which copy had the wrong members. That is a real
detection, but it means a shuffled control is easier to spot when the whole set is scored at
once than it would be in isolation. Recorded as a limitation of this control type.

## 2. The calibration result — the strongest evidence here

The eight surface controls were each assessed and written down **before** scoring. The blind
checker matched that assessment **8 out of 8**.

| Control | Pre-registered | Checker |
|---|---|---|
| kafka `partition` | accidentally valid | principle |
| kafka `commit` | accidentally valid | principle |
| tf-v02 `drift` | accidentally valid | principle |
| tf-v02 `locking` | accidentally valid | principle |
| api `contract` | weak, either defensible | restatement |
| tf-v03 `modules` | weak, either defensible | restatement |
| api `change` | usable control | restatement |
| tf-v03 `provider` | usable control | surface |

Two independent judgments — one human-directed and written in advance, one blind — converged
completely. This is better evidence that the checker discriminates than the void check gives,
and it cost nothing.

## 3. Scores

| Topic | principle | restatement | surface | % |
|---|---|---|---|---|
| API contract governance | 8 | 0 | 0 | **100%** |
| Kafka consumer mechanics | 11 | 2 | 0 | **91.7%** |
| Terraform at team scale | 18 | 7 | 1 | **72.0%** |
| **overall** | **37** | **9** | **1** | **82.2%** |

2 `reference` chapters excluded from the denominator — they declare they are not principles.
9 of 45 real chapters were scored low-confidence.

### Cross-arm comparison, and it inverted the prediction

| Arm | principle | % |
|---|---|---|
| terraform-v02 | 11/14 | **78.6%** |
| terraform-v03 | 7/11 | **63.6%** |

The qualitative read before scoring predicted v03 would win: it unified into cleaner
principles, produced no thin chapters, and collapsed three v02 chapters into one cause
("a plan is a captured, time-bound authorization, not a preview"). It scored 15 points lower.

**The two arms still converged on seven of the same governing principles** — locking's
boundary, graph over source order, blast radius, module-as-interface, drift, workspaces,
credentials — from different sources and different briefs. That convergence is real evidence
that chaptering finds structure in the subject rather than inventing it from whichever rows
are present. Nothing here tests whether both agents simply share a model's priors about
Terraform; that remains unmeasured.

## 4. The finding that matters most

**Seven of the eight real-chapter failures are the same shape: a member row already states
the chapter's principle outright.**

> "The whole warrant, including the re-fire path and the replay-vs-silent-skip framing, is
> already spelled out inside member 2's description. Nothing emerges from pairing them."

That is not a chaptering defect. It is the emergence test colliding with row quality. The
v03 producer reported upfront that its harvest "had already done real synthesis" — rows
citing each other by ID, rows naming themselves as the reason another cannot be skipped.
Those are better rows. And a better row makes its chapter score worse, because if the row
already carries the binding idea, the chapter cannot be what surfaces it.

**Improving the harvest degrades the chaptering score.** The two quality measures are in
tension and nothing in the design anticipated it. Consequences worth deciding before Phase 2:

- The 70% threshold is not stable across harvest generations. A future run on better rows
  should be expected to score lower for a good reason.
- The rubric may be measuring the wrong thing. "Does the chapter add something no member
  has" is a fine test of a *warrant*; it is a poor test of whether a *grouping* is correct.
  A chapter can group perfectly and score `restatement` because one member is articulate.
- The `depth_check`-style meta-rows the audit stage adds are the main carriers of this. They
  exist to record a synthesis, which is exactly what makes the chapter around them redundant.

## 5. What this run does not establish

- **That the checker can tell a principled grouping from a plausible one over genuinely
  related rows.** The surface controls turned out not to test this: in a documented technical
  domain, shared domain nouns often *name* mechanisms, so grouping by them can land on a real
  principle. Four of eight did. See PRE-REGISTRATION.md for the third control type that would
  close this — correct grouping with a deliberately wrong stated cause.
- **That chaptering works outside software infrastructure.** All three topics are technical.
  The v0.2 spec already carried this limitation and it is unchanged.
- **Independence from the experimenter.** The pre-registration, the rubric, the control
  design, and this document all come from the session that ran the experiment.

## 6. Granularity is unresolved and needs a gate

Given the identical brief, chapter size varied a lot:

| Arm | chapters | rows | avg members | ≤2-member chapters |
|---|---|---|---|---|
| API | 8 | 59 | 7.4 | 0 |
| Kafka | 13 | 58 | 4.5 | 1 |
| terraform-v02 | 14 | 55 | 3.9 | **6** |
| terraform-v03 | 12 | 58 | 4.8 | 0 |

The build gate caps chapters at 12 members and requires ≥3 chapters for a topic of 15+ rows.
It sets **no floor**, so a topic can fragment into many two-member chapters and pass. That is
a wall of a different shape. Notably v02 fragmented most and still scored highest, so
fragmentation is not straightforwardly bad — but it is currently ungoverned.

## 7. Artifacts

Everything Phase 1 needs is in the repo. A cold session needs no other context.

**The spec and the visual target**

```
study-read/DESIGN-v1.md                       the design spec
study-read/design/topic-view-prototype.html   the topic reading view — the literal
                                              markup the generator must emit
study-read/design/library-prototype.html      the library browse view
study-read/validation/TEST-PLAN.md            the gates and edge cases Phase 1 must cover
```

**This validation**

```
study/references/structure-legacy.md          the producer brief
study-read/validation/input/                  per-topic row splits given to producers
study-read/validation/out/                    47 chapters across 4 arms
study-read/validation/controls/               16 controls, 8 surface + 8 shuffled
study-read/validation/scored/scored-set.jsonl 63 chapters, opaque ids, no provenance
study-read/validation/scored/verdicts.jsonl   the blind checker's scores
study-read/validation/scored/scored-set-KEY.json  the key (never shown to the checker)
study-read/validation/make_controls.py        control generator
study-read/validation/score.py                the pre-registered rule, implemented
study-read/validation/PRE-REGISTRATION.md     the rule, written before scoring
```

The first four files were previously only in `~/.gstack/projects/chzylee-skill-library/`,
where the office-hours and design-review skills write by default. That is the right home for
an artifact that outlives its branch, but these four are build inputs — the prototype is the
template the renderer is written from, the spec is what the code implements — so the repo is
now their canonical home. The durable copy lives in the Notion project wiki.

Six agents used against a budget of eight: four producers, one control writer, one checker.
