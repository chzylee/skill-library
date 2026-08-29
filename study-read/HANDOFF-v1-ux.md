# Handoff — /study v1, consolidated and ready for the author's retest

Rewritten 2026-08-16 at the end of the consolidation session. The previous version of this
file was written mid-refine and predates nine commits: the description reflow, the run-strip
split, the facet relabels, SC8 and its evidence file, PRODUCT.md, dark mode being verified,
and the chip tap-target fix. All of that is folded in below; what was no longer true was cut
rather than corrected in place.

Nothing here needs the prior conversation.

---

## The frame — settled, and it drove everything since

**The artifact is a reader.** Not the person — a *reader* in the editorial sense, as in
`A Graphic Design Reader`: a curated collection of primary sources, selected and ordered to
teach a subject, with short editorial text introducing each section and saying why its
pieces sit together. The learning happens in the sources. *Course pack* is the plainer
synonym.

**Claude's role: researcher → curator → editor. "Not too opinionated beyond structure."**

| Opinions that are the job | Opinions that are out of bounds |
|---|---|
| what is worth including, and what is not | which framework or tool is better |
| what groups with what, and why | what the reader should do |
| what order to meet things in | how important something is to *this* reader |
| what to notice about an item | any claim about the world without a source |

The right column is covered by committed constraints (§4.1 consumer-agnostic, §4.3 no
unstated rationale, §4.6 no priority field). The left column is the editorial apparatus.

**"Never render with the model"** means there is no model path to HTML. It governs who
generates markup, not who writes sentences.

### The apparatus, and where each piece stands

| Piece | Field | Status |
|---|---|---|
| **General introduction** | `guide-meta.json` `scopes[topic]` | Renders as the boundary line under the title. |
| **Chapter headnote** | `because` | Opens the chapter it introduces. It was moved off the collapsed contents line, which now carries the title alone. |
| **Per-item note** | `notes[row_id]` on the chapter | Optional, 15–30 words, 188 written across the 47 existing chapters. A hinge, never a summary. |

### The bar

`/study <topic>` must beat **both** googling it yourself and asking a chat model. **The
outcome is that the reader learns.** That cannot be measured here — no learners, no control,
no post-test — so the checkable form is **Success Criterion 8** (`DESIGN-v1.md` §14, added
2026-08-15 as a recorded amendment): every presentation decision names the finding behind it
or says plainly that it is craft. `design/EVIDENCE-presentation.md` is the record — seven
evidence-backed decisions with sources, five marked as craft, and the case *against* the
whole approach kept where it can be seen. SC8 does not claim the artifact teaches; nothing
in that file was measured on this artifact, and it says so before the table.

---

## 1 · Read these, in this order

| File | What it is |
|---|---|
| this file | current state, what was done, and what it taught |
| `PRODUCT.md` (repo root) | scope, register, users, principles, accessibility commitments. Scoped to this surface only |
| `study-read/DESIGN-v1.md` §6, §8, §11, §14 | the spec. Schema, display, approach, success criteria (SC8 is the newest) |
| `study-read/design/EVIDENCE-presentation.md` | the evidence behind each presentation decision, and the case against it |
| `study-read/validation/VERDICT.md` | what Phase 0 proved, cost, and explicitly did NOT establish |

`study-read/design/topic-view-prototype.html` was the visual target and is now **partly
superseded** — it draws `because` on the contents line, which is exactly what was removed. It
also carries its own inline copy of the tokens, so it drifts; trust `index.css`.

**Only slice 1 is committed.** Slices 2 and 3 are designed and deliberately uncommitted. Do
not build them, and do not let their schema (`kind`, `binding`, `binding_warrant`,
`supersedes`) leak into anything.

## 2 · State, and how to verify it

Branch `study-v1-phase0-20260814`, nothing pushed. Both skills are symlinked into
`~/.claude/skills/` and load. Working tree clean apart from `.dev-build.conf`, which is a
local modification that stays uncommitted.

```bash
python3 study-read/references/gates_test.py    # 26 tests
python3 study-read/references/build_test.py    # 54 tests
python3 ~/.claude/skills/study-read/references/build_index.py --root ~/.claude/study
```

Expect: 3 topics, 238 rows, 47 chapters, 4 topic/run units all `ok`, 7 fragmentation
warnings, ~706 KB. Every command the two SKILL.md files hand a user was verified as written
on 2026-08-16 — paths, flags, the stage-5 filter one-liner, the store layout, the
`guide-meta.json` and `self-check.json` formats.

To look at it: copy the built file into `/private/tmp` and open it with
`~/.claude/skills/gstack/browse/dist/browse`. Screenshot at 1280x900 and 390x844 and
**read the screenshots** — every display defect in this project's history was found that
way. **Reload after copying**: the browser holds a stale render of a replaced `file://`
page, and if what you see contradicts the source you are looking at a stale page. Topic
hash routes come from `browse js "STUDY_DATA.units.map(u => u.slug).join()"`.

Dark mode cannot be toggled from JS (`prefers-color-scheme` is not scriptable): copy the
built page and append a `<style>` block before `</head>` redefining the dark token values on
a bare `:root`. Inspection only; never commit that copy.

**`/study` has still never been run end to end on the v1 pipeline.** Stage 5 has never
written `notes` against a live run — the 188 existing notes came from a one-off backfill.
That retest is the author's next move, and it is the author's because it costs real money.

## 3 · What was wrong, and what was done

The founding diagnosis holds and is worth keeping: **the prototype was designed against text
roughly three times shorter than the store holds.** A fit problem between design and data,
not a taste problem.

| Element | Prototype (max of 5) | Real median | Real p90 | Real max |
|---|---|---|---|---|
| Chapter title — `principle` | 66 chars | 105 | 202 | **292** |
| Chapter warrant — `because` | 173 chars | 476 | 559 | **674** |
| Item title — `subject` | 109 chars | 56 | 80 | 110 |
| Item body — `description` | *not drawn* | 634 | 1089 | **2352** |
| Per-item note — `notes` | *did not exist* | 22 words | — | 27 words |

### 3a · The apparatus pass (commits `678615c` → `74d1593`)

- **Contents view:** `because` came off the collapsed chapter row and became the headnote
  read on opening. Eight to nine chapters fit on one screen where three and a half did. The
  292-character titles were **not** rewritten — that would be re-chaptering, and Phase 0
  validated what is there. The brief asks for under ~120 characters going forward.
- **Item titles:** `subject` is a scanning label and stays one — in a reader, a source keeps
  its own title. The missing piece was the editor's line underneath: `notes`, optional,
  15–30 words, on the chapter record.
- **Pipeline bookkeeping left the prose:** 35 descriptions ended in `[AUDIT …]` /
  `[ABSENCE: …]` appendages. The pipeline stopped writing them (the verdict was already in
  `audit-verdicts.jsonl`); `split_ledger()` in `build_index.py` renders the ones already
  stored as their own collapsed disclosure, and `grade` became visible for the first time.
  `rows.jsonl` untouched.
- **Absence consolidated:** no-quote / no-tier-reason / no-practicum are run-scoped facts,
  stated once in the run strip and counted, not repeated 178 times on rows.

### 3b · The display pass (commits `b52db0e` → `3426b7f`)

- **Descriptions reflowed into paragraphs** at sentence boundaries. Zero of 230 stored
  descriptions contain a line break; 53 rendered as 13+ unbroken lines. The build ships `d`
  as a list of paragraphs; rejoining returns the input with whitespace collapsed, asserted
  on every fixture and on all 230 real rows (a lookbehind bug that ate closing quotes on 25
  real rows was caught exactly that way, so the real-store check is now a test). Not one
  word changes. The harvest spec now tells agents to write paragraph breaks.
- **The run strip split by audience.** Provenance (when researched, sources opened, what the
  run did not store) stays where the reader is; build state (schema version, gate warnings
  like "ch-02: only 2 members") nests one expansion deeper under "How this page was built".
  Fragmentation warnings in particular invite a conclusion Phase 0's own data contradicts.
  A gate FAILURE still banners above the chapters.
- **The strip's open policy moved into the build** (`stripFlag` / `stripOpen` on the unit),
  so it is testable without a browser. An unopened source colours the strip and leads its
  collapsed line but no longer auto-opens it — that trigger was never one of DESIGN §8's
  decided ones, and effectively every real run has one unchecked source, so the
  shape-without-scrolling promise was failing by default.
- **The facets speak the badge's words, not the pipeline's.** `EV_LABEL` and `WHEN_LABEL`
  ship from the build under one contract: the enum stays the stored value and the filter
  key; only the spoken word changes. Evidence chips say "source checked" / "not opened"
  under the group heading "source"; depth chips say "what it is / using it / judgment call /
  how it works" under "how deep". No label may claim a level (no "beginner", "advanced",
  "first" — a test bans the vocabulary), because a tier comes from a failure signature, not
  difficulty, and reading order lives in chapters.
- **The legend stopped claiming sources disagreed** — that is slice 2's `choice` tier, whose
  data does not exist. Reworded to the failure-signature definition; a test bans the
  disagreement claim. Corollary learned twice now: inlined JS means a comment quoting a
  banned phrase IS the phrase reaching the page — paraphrase in comments near guards.
- **Print:** `details { open: open }` was not CSS and silently did nothing. Now
  `details::details-content { content-visibility: visible }` expands everything at print
  time; browsers that don't know the pseudo-element keep today's behaviour. No test — print
  output is not observable from the build, which is why the defect survived.

### 3c · The audit pass (commits `92abc94`, `c3dcb69`)

- **SC8 + `EVIDENCE-presentation.md`** — see "The bar" above.
- **PRODUCT.md written** (repo root, scoped to this surface). Register: brand. Personality:
  quiet, durable, trustworthy. The brand playbook's pushes (imagery, ambitious motion) were
  audited and rejected for reasons the playbook itself states.
- **Dark mode verified for the first time in the project's life** (Open Question 8, closed).
  Every text pair clears 4.5:1 in both themes — tightest is `--muted` on `--chip`, 4.84:1
  light / 5.68:1 dark — and every light token is redefined for dark.
  `build_test.py::Contrast` now asserts both facts, because the tokens file used to state
  its ratios in a comment and nothing checked them.
- **Filter chips 44px on touch.** They were 26px — the only interactive elements below the
  floor `--tap` defines and PRODUCT.md commits to. Genuinely tall on mobile rather than a
  hit-overlay, because the chips wrap onto rows 5px apart and overlays would collide.
  Desktop unchanged.

### 3d · The consolidation pass (2026-08-16, this session)

- **Every user-facing command in both SKILL.md files verified as written.** Two doc defects:
  the DuckDB query example ran on a tool that is not installed AND filtered on a value no
  stored row carries (`evidence = 'asserted'`; v0.1 rows spell it
  `source_status: asserted-only`). Replaced with a verified stdlib one-liner that handles
  both spellings, with the double failure kept as a warning. And `study-read/SKILL.md`
  still described the facets as "type, depth, and evidence" — pipeline vocabulary the page
  no longer speaks.
- **PRODUCT.md's dark-mode bullet was born stale** — written in the very commit that
  verified dark mode. Corrected.
- **The type-token inconsistency resolved** — see §5, "the type-size split".

## 4 · What the research established

Eight agents, 2026-08-15, in two instruments. Findings, not theory — DESIGN §9 already
scanned the pedagogy literature and re-running it returns the same names. The full record
with sources and provenance grading is `design/EVIDENCE-presentation.md`; the short form:

1. **The per-item line is a hinge, not a summary.** Colyer, Norton, Nystrom, Beej — every
   working exemplar spends the item's first apparatus sentence on adjacency.
2. **Summarising is the rarest job a curator does with that line** — ~6% across two
   annotated reading lists, against ~38% positioning and ~27% what-to-notice.
3. **Order is argued, not assumed.**
4. **Two channels, one privileged** — authority lives offstage and the main column keeps
   moving. This is the pattern the ledger and the run strip follow.
5. **The named failure mode is substitution** — Norton's students settling for the headnote
   and never arriving at the selection. That is why the note is capped at 15–30 words, and
   the cap is the point.

Provenance is graded honestly in the evidence file: the four exemplar agents read primary
material and are the stronger half; the four landscape agents read search highlights and are
the weaker half, with two figures flagged as self-published or vendor marketing.

## 5 · Settled. Do not re-open.

- The schema, the two axes, the chaptering premise, the display architecture — DESIGN-v1.
- Chaptering itself. Phase 0: 82.2% of 47 real chapters rated genuine principles by a blind
  checker, all 8 void controls rejected, pre-registration matched 8/8. `VERDICT.md`.
- **Fragmentation warns and never fails.** Phase 0's most fragmented arm scored highest.
- **There is no dead-link state.** Exactly three source states render. A test enforces this.
- **Topics are the index**; a unit is one run of one topic and owns chapters.
- **One self-contained HTML file, `file://`, no server, no external requests.**
- Python 3 stdlib only. Never render HTML with a model. `rows.jsonl` is append-only and
  irreplaceable; `chapters.jsonl` is safe to regenerate.
- Never weaken or delete a test to make it pass.
- **`notes` lives on the chapter, not the row.** `rows.jsonl` cannot be backfilled,
  `chapters.jsonl` can, and a note describes the *(chapter, row)* pairing — a re-run that
  groups differently needs a different note. Do not move it.
- **The label contract.** Stored enums are filter keys and data attributes; readers see only
  `EV_LABEL` / `WHEN_LABEL` words. Tests hold the vocabularies equal and force any future
  enum to arrive labelled. Do not print a raw enum at a reader; do not change a stored
  value to match a label.
- **The run strip's open policy is the build's** (`stripFlag` / `stripOpen`), and only a
  structural problem (gates failed, legacy, an empty tier) auto-opens it. Four tests pin it.
- **SC8 discipline:** a new presentation decision either lands in the evidence table with a
  finding, or in the craft table saying so. `EVIDENCE-presentation.md` states its own
  re-run trigger, and it is the only one.
- **The type-size split** (resolved 2026-08-16, either way was legal): `shared/tokens.css`
  published a seven-step scale the topic view does not use — the view sets ~11 sizes per
  element in `index.css`, and `--fs-s` was consumed by nothing anywhere. Resolved by
  correcting the token file rather than forcing consumption, because full consumption means
  either changing rendered sizes or mirroring one stylesheet's bespoke values into the
  shared file. `--fs-s` is deleted; `--fs-h3 = --fs-r` is documented as deliberate; both
  files now state which surface each step feeds. Rendered sizes unchanged. Do not "fix"
  `--fs-h3` apart from `--fs-r`, and do not reintroduce a step nothing consumes.

## 6 · The open finding — the author's call, not a bug to fix

**This is recorded, not acted on.** It proposes changing the character of a committed field
and that is a decision, not a refinement. It is also case 3 in
`EVIDENCE-presentation.md`'s case-against section.

A controlled result surfaced by the landscape pass: across seven experiments and >10,000
participants, learners given LLM syntheses developed **shallower** knowledge than those
navigating ordinary search links — and an arm that offered real-time source links *alongside*
the synthesis **did not close the gap**. Once people had the summary they were not motivated
to open the sources.
<https://realkm.com/2026/03/26/learning-with-ai-falls-short-compared-to-old-fashioned-web-search/>

**Chain of evidence, stated honestly:** an agent read an Exa highlight of a secondary
write-up. The underlying paper has not been opened. Treat the direction as sourced and the
magnitude as unverified.

Why it matters here. DESIGN §2 states the premise: *"The tool never has the final word.
Every path a reader takes ends at a firsthand source."* The mechanism assumed for that is
reachability — one click from the page it came from. This evidence says reachability is not
the binding constraint; **sufficiency** is. `description` is median 634 characters, p90 1089,
max 2352, and it is the largest thing on an expanded item with the source link beneath it.
That is precisely the configuration the experiments tested.

The same failure appears independently in anthology editing, where it has a name: readers
settle for the apparatus and never reach the selection.

**If it holds, the lever is `description` length, not link placement.** Every apparatus
decision this project made pushed that way for the same reason arrived at independently.
`description` is the one field nobody has touched.

**The honest counter**, from the same landscape pass: novices lack the prior knowledge to
contextualize raw sources, so unscaffolded curation produces confusion rather than
expertise. Shortening `description` trades one failure mode for another, and nothing here
says where the line is.

## 7 · Known gaps, recorded not fixed

- `/study` has never been run end to end on the v1 pipeline, and stage 5 has never written
  `notes` live. This is the biggest untested surface and the author's retest covers it.
- `self-check.json` is written by `/study` and rendered by nothing. Both SKILL.md files say
  so, so nobody promises a reader the questions are waiting somewhere.
- `practicum` is designed and not built. Stated once per topic in the run strip.
- `EMBED_CAP` governs markdown only; row data is uncapped and the build prints what it
  costs. The real fix is slice 3.
- No steady-state chapter audit, and no audit of note quality. The 188 notes were validated
  mechanically and read in sample, not scored by an independent checker the way Phase 0
  scored warrants.
- **Apparatus scales with chapter size, which nothing in the design predicted.** All five of
  terraform-v02's noteless chapters are two-member chapters whose `because` already states
  the relation between its two members.
- **Better rows need fewer notes.** terraform-v03 came in lowest at 37 of 58 because that
  harvest did real synthesis. VERDICT.md §4 found the same tension from the other side. This
  is the benign form: a note is optional and a warrant is not.
- The one-off notes-backfill script (agent writes `{chapter_id: {row_id: note}}`, a merge
  script writes only the `notes` key) is not committed. DESIGN §6 names restructure-only as
  the upgrade path for a legacy topic and this is half of it.
- No test covers print output — it is not observable from the build.
- Five interaction states remain undrawn (DESIGN Open Question 7).

## 8 · Do not

- Do not re-run Phase 0.
- Do not re-chapter to fix a note. The grouping is validated; the apparatus is not the
  grouping.
- Do not migrate the 238 legacy rows.
- Do not add a fourth source state, a hard fragmentation floor, or a dependency.
- Do not make `notes` required, or draw anything where a note is absent. Omitting one is a
  legal result and 42 of 230 members correctly have none.
- Do not run `/study` on the author's behalf. It dispatches paid research agents; the retest
  is theirs.

## 9 · What to do next

1. **The author reruns `/study <topic>` end to end** — the first live exercise of the v1
   pipeline, and the first time stage 5 writes `notes` against a real run. Watch: the
   structure agent's 300-word return (the only pre-reader signal), whether harvest agents
   now write paragraph breaks and sub-120-char titles as the briefs ask, and whether any
   slice-2 vocabulary leaks.
2. **Then `/study-read`**, and read the page the way §2 says — screenshots, both widths,
   reload after copy.
3. If both hold, the open decisions are §6 (description length) and DESIGN's Open
   Questions — in that order of consequence.
