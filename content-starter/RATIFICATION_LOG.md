# Ratification Log — content-starter design

Records the human-side ratification of content-starter's design decisions (prediction-before-reveal).
Artifact: `SKILL.md`. Append-only; each sitting adds a section, never clobbers prior ones.

## Sitting 1 — 2026-07-16 · standalone · baseline: partial

Decision contract — **Human function:** Noah can assert how content-starter works, the calls that
shape it, and why, enough to defend and evolve it. **Evidence:** each design decision stated in
domain language, judged against the SKILL.md. **Baseline:** partial (an affirmed 5-point spec
informed the artifact; three implementation calls emerged in reconciliation).

| # | item | expectation stated | pre-conf | outcome | origin | gap | decision | reading |
|---|---|---|---|---|---|---|---|---|
| 1 | what a beat contains | form/structure tied to brand; not a platitude, not an AI-written example | high | predicted | human+ai | — | amend | none |
| 2 | how a turn feels | conversation with the strategist; terse but "ask for more"; note mode-switch | high | predicted | human+ai | — | amend | none |
| 3 | what "grounded" means | rooted in research — trending/successful/examples; platform + audience + similar + adjacent | high | predicted | human+ai | — | amend | none |
| 4 | steps & sign-off gates | preface/mode → input → shape (sign-off) → outline (revise, sign-off) → close | high | predicted | human+ai | — | amend | none |
| 5 | shape vs skeleton | shape = the funnel flow (hook/draw-in/hold/close) | high | predicted | human+ai | — | amend | none (diction reconciled: archetype = confirmed input, shape = funnel) |
| 6 | research cost | real research every run, cost accepted as core | high | predicted | human+ai | — | build | none |
| 7 | baked worked-example | keep it for grounding — med: unsure how examples influence model behavior | med | surprised | human+ai | missing-info | amend | none (fact supplied in-session, not homework) |
| 8 | per-platform templates | no baked templates; funnel is a default, research fits the platform | high | predicted | human+ai | — | amend | none |

**Summary:** 8 judgment items — **7 predicted, 1 surprised, 0 no-opinion**; 7 amend, 1 build.
Foresight high across the board; the single surprise (Item 7) was `missing-info` (model-behavior
mechanism the AI supplied), not a blind spot. **No `judgment` gaps → no reading owed.** Every
decision was human or human+ai origin — active authorship, not rubber-stamping.

### Amendments ratified this sitting (to apply to SKILL.md)
1. Beat form-line carries the strategic relationship (like Noah's example); run `/humanizer` (or the norm) on any illustrative example so it can't read AI-written.
2. At session open, a one-liner to the user: kept tight by default → ask for more depth anytime; mode is switchable anytime.
3. Broaden research scope: what's trending/working **and what fails**, for the platform + audience + similar creators/strategies + audience-general + adjacent-platform strategies. Real pass every run; standing knowledge is only the no-tool fallback.
4. Make "get the seed / basic context if not given" an explicit step right after the mode ask.
5. Name the two concepts distinctly: **archetype/lane** (research input the strategist surfaces & confirms — it drives the deliverable) vs **shape** (the funnel flow). Drop the "skeleton" label.
6. (build) Research cost accepted — no change beyond making "real pass every run" unambiguous (covered by #3).
7. Replace the baked worked-example (Noah's real gstack post) with a concrete-but-neutral, different-domain example, labeled "format demo, not a template."
8. State the funnel is a general default; the platform-specific shape is research-derived and may depart from the funnel entirely (e.g. Substack Notes).
