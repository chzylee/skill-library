# /ratify

**The ratification protocol for blocking stops — prediction before reveal.**

Pipeline stages end their phases in blocking stops so the human decides. But a stop only works
if deciding is an act: the observed failure mode is OK-ing recommendations that "seem like they
make sense" at a pace where the details fly past — rubber-stamping with extra steps. `/ratify`
makes each yes cost something small and real: the human states their expectation **before** the
recommendation is revealed, the gap between the two becomes the discussion, and every decision
is logged as `predicted` / `surprised` / `no-opinion`.

What that buys:

- **Structural anti-rubber-stamp** — you cannot passively approve a question you had to answer
  first (teach-back, borrowed from informed-consent practice in medicine).
- **A self-assembling reading list** — `no-opinion` and `surprised` items each log a concrete
  pointer (code path, design section). You read your actual blind spots, not everything.
- **Ownership as a measurement** — `RATIFICATION_LOG.md` records prediction accuracy per
  sitting. "9/12 predicted" is evidence the fast yeses were legitimate; the surprises feed
  `/own-your-code` as the study guide.
- **Data that compounds** — alongside the human log, each item appends one sanitized JSON line
  (`pre_confidence` · `prediction_outcome` · `decision_type`) to a plugin-owned, user-global
  corpus at `~/.claude/ship-pipeline/sends.jsonl`. Across builds it aggregates into presentable
  proof — calibration, authorship rate, blind-spot-to-mastery trend. Spec:
  [`telemetry/README.md`](telemetry/README.md).

## Use

- Invoked by other pipeline skills at their STOP gates (`/test-spec` v0.2+ runs it on Judgment
  and User-challenge items).
- Standalone: `ratify TEST_SPEC.md`, "walk me through ratifying these decisions" — including
  **re-ratifying** a doc you approved too fast, which is a first-class use.

## The pattern underneath (why this is a separate skill)

Every dialogue-driven skill in this pipeline implicitly has a **decision contract** — the three
fields that define the *human's* function in that stage:

1. **Assert** — what must the human be able to state, in domain language, when the stage closes?
2. **Evidence** — what artifact do they judge (claim / diff / red-then-green test / rendered
   output / trace)? Never prose reassurance.
3. **Pace** — chunk size and batch cap that keep each yes real.

The AI persona of a stage derives from this contract as its complement: where the human is the
oracle, the AI is the examiner. `/ratify` is that contract's enforcement, factored out so every
stage gets it without re-implementing it — and so new skills can be *defined* by writing their
decision contract first. Treat the contract as part of a skill's documentation, like a class
declaring its interface.
