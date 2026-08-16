# Product

**Scope: the study library reading surface** (`study-read/`, built by `study/`). This repo
holds ~30 skills and several have their own UI — `memory-manager`, `ratify-configure`,
`docs/`. They were not designed together and this document does not speak for them. It
describes the one surface in this repo with a written design rationale behind it, so that
`/impeccable` and any future agent work from the real thing rather than an inferred one.

Companion documents, both load-bearing and both more specific than this file:
`study-read/DESIGN-v1.md` (the spec, §8 is the visual system) and
`study-read/design/EVIDENCE-presentation.md` (the evidence behind each presentation
decision, and the case against it).

## Register

brand

*Genuinely split, and decided rather than defaulted. The primary surface is a topic page
read start to finish — long-form content, where the design IS the product. The rail,
search and facets around it are product-register chrome serving that page. When the two
conflict, the reading page wins.*

## Users

One reader at a time, sitting down to learn a technical subject they do not yet know —
consumer groups, contract versioning, infrastructure state — the way they would read a good
page they found by searching for it.

**The analysis never knows who they are.** That is a committed constraint (`DESIGN-v1.md`
§4.1): the scope interview may ask how much work to do and what the topic is, never what you
want the knowledge for. The consequence is that the same research serves any reader, which
is what makes the artifact shareable rather than personal. Two people searching the same
topic could correctly land on the same page.

The job: learn the subject well enough to work in it, and be able to check any single claim
against the page it came from without leaving the reading.

## Product Purpose

You search to learn something and you get links. You read them, you lose them, and next time
you start over. `/study` replaces that: research a topic once, keep the result as a chaptered
reading path through primary sources, and have it stay queryable beside every other topic you
have ever run.

**Success is that the reader learns**, and the bar is that it must beat *both* googling it
yourself *and* asking a chat model. Googling, because someone already searched, discarded the
junk, ordered what survived and said why each thing is there. A chat model, because you get
the same orientation plus the page it came from — fluency is the part you cannot verify, the
citation is the part you can.

Learning cannot be measured here without learners, a control and a post-test, so the checkable
form of this is Success Criterion 8: every presentation decision names the evidence behind it
or is marked as craft.

## Brand Personality

**Quiet, durable, trustworthy.**

Quiet: the page never performs. Nothing animates to be noticed, nothing is emphasized for
emphasis' sake, and the single accent colour is spent only on links that leave for a source.

Durable: this is a library built over years, not a session. It should look the same in five
years and still open from a file with no server.

Trustworthy: it says what it does not know. Absences are stated, unverified sources are
labelled, and the tool's own uncertainty is on the page rather than behind it.

**Voice is the editor's, not the author's.** An editor writes headnotes, not exposition. The
model already writes the chapter warrant, the per-item note and the honest-limits prose;
what it may never do is explain the subject in place of the source.

## Anti-references

- **The AI answer engine.** A fluent synthesis you cannot verify. This artifact exists
  because that shape is unverifiable, and evidence suggests a summary suppresses
  source-opening even with the link one click away (`EVIDENCE-presentation.md`, case 3).
- **The awesome-list / link dump.** Ordered by nothing, justified by nothing.
- **The dashboard.** Counts, tiles, and metrics as the main event. The run strip is one
  quiet line precisely so this page never opens on statistics.
- **The knowledge-base app.** Sidebar-heavy, chrome-first, built for filing rather than
  reading.
- Banned outright by `DESIGN-v1.md` §8, and these are visual rather than strategic: card
  grids, icons in circles, centered layouts, decorative shadows, rounded corners above 4px
  on anything that is not a pill, and any ordering by subject.

## Design Principles

1. **The tool never has the final word.** Every path a reader takes ends at a firsthand
   source. This is the product, not a feature of it.
2. **No claim without a traceable cause** — extended past content to presentation. Claims
   about the world trace to a source; decisions by an agent trace to a stated reason; and
   decisions about the page trace to a finding or are marked as craft.
3. **Traceable does not mean visible.** It means reachable in a known number of clicks.
   Every warrant, verdict and absence exists and is one expansion away; none of them clutter
   the page.
4. **Apparatus motivates arrival at the source; it never substitutes for it.** Anything long
   enough to be read *instead of* the thing it introduces has broken the product, however
   well written. This is why the per-item note is capped rather than encouraged.
5. **Absence is stated, and stated once.** Never blank, never mislabelled — and never
   repeated 178 times. Where something is missing for a whole run, the run says it.

## Accessibility & Inclusion

- **Contrast floor 4.5:1 on all text**, including metadata, badges and placeholders — not
  just body copy. The first prototype failed this at roughly 3.3:1 on exactly those
  elements, so it is checked rather than assumed.
- **Every disclosure is a native `<details>`.** Keyboard and screen-reader behaviour come
  free; a JS reimplementation loses both. This is a hard rule, not a preference.
- **Minimum 44px tap targets** (`--tap`), and mobile is a structural change rather than a
  stack — the rail becomes a horizontal shelf so the topic you came to read is not pushed
  ~450px down the page.
- **`prefers-reduced-motion` is honoured** in `shared/tokens.css` for every transition.
- **Dark mode is inherited** from shared tokens and has never been rendered or checked. A
  known gap, recorded rather than claimed (`DESIGN-v1.md` Open Question 8).
- **The page requires JavaScript.** The topic view is rendered by `index.js` into an empty
  `<main>`, so with JS off there is no content. The original prototype worked without it;
  the real app does not. Recorded here rather than quietly dropped.
