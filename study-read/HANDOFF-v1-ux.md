# Handoff — /study v1, after the editorial-apparatus pass

Rewritten 2026-08-15 at the end of the refine session. The previous version of this file
opened *"/study v1 is built and reads badly"* and diagnosed why. That diagnosis was acted
on; this records what changed, what it taught, and the one finding that is **not** acted on
because it is the author's call.

Nothing here needs the prior conversation.

---

## The frame — settled, and it drove the refine

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
unstated rationale, §4.6 no priority field). The left column is the editorial apparatus,
and it is what this session built.

**"Never render with the model"** means there is no model path to HTML. It governs who
generates markup, not who writes sentences.

### The apparatus, and where each piece stands now

| Piece | Field | Status |
|---|---|---|
| **General introduction** | `guide-meta.json` `scopes[topic]` | Was already there. Renders as the boundary line under the title. Unchanged. |
| **Chapter headnote** | `because` | **Moved.** Was crammed onto the collapsed contents line; now opens the chapter it introduces. |
| **Per-item note** | `notes[row_id]` on the chapter | **Built.** Optional, 15–30 words, 188 written across the 47 existing chapters. |

### The bar

`/study <topic>` must beat **both** googling it yourself and asking a chat model. **The
outcome is that the reader learns.** §14's criteria measure organization, structure size,
traceability and cost; none measures whether anyone learned. That gap is still open.

---

## 1 · Read these, in this order

| File | What it is |
|---|---|
| this file | what was done and what it taught |
| `study-read/DESIGN-v1.md` §6, §8, §11 | the spec. Sections 6 (schema), 8 (display), 11 (approach) are live |
| `study-read/design/topic-view-prototype.html` | the visual target. **Now partly superseded** — see §3a; it draws `because` on the contents line and that is exactly what was removed |
| `study-read/validation/VERDICT.md` | what Phase 0 proved, cost, and explicitly did NOT establish |

**Only slice 1 is committed.** Slices 2 and 3 are designed and deliberately uncommitted. Do
not build them, and do not let their schema (`kind`, `binding`, `binding_warrant`,
`supersedes`) leak into anything.

## 2 · State

Branch `study-v1-phase0-20260814`, nothing pushed. Both skills are symlinked into
`~/.claude/skills/` and load. `/study` is wired but **has still never been run end to end on
the v1 pipeline** — stage 5 remains untested against a live run, and it now writes one more
thing than it ever has.

```bash
python3 study-read/references/gates_test.py    # 26 tests
python3 study-read/references/build_test.py    # 35 tests
python3 ~/.claude/skills/study-read/references/build_index.py --root ~/.claude/study
```

Expect: 3 topics, 238 rows, 47 chapters, 4 topic/run units all `ok`, 7 fragmentation
warnings, ~697 KB.

To look at it: copy the built file into `/private/tmp` and open it with
`~/.claude/skills/gstack/browse/dist/browse`. Screenshot at 1280x900 and 390x844 and
**read the screenshots** — every defect in the previous handoff was found that way, plus one
it missed. **Reload after copying**; the browser holds a stale render of a replaced
`file://` page and it will cost you twenty minutes.

## 3 · What was wrong, and what was done

The original diagnosis holds and is worth keeping: **the prototype was designed against text
roughly three times shorter than the store holds.** A fit problem between design and data,
not a taste problem.

| Element | Prototype (max of 5) | Real median | Real p90 | Real max |
|---|---|---|---|---|
| Chapter title — `principle` | 66 chars | 105 | 202 | **292** |
| Chapter warrant — `because` | 173 chars | 476 | 559 | **674** |
| Item title — `subject` | 109 chars | 56 | 80 | 110 |
| Item body — `description` | *not drawn* | 634 | 1089 | **2352** |
| Per-item note — `notes` | *did not exist* | 22 words | — | 27 words |

### 3a · The contents view — FIXED (display, content cause)

`because` came off the collapsed chapter row and became the chapter's headnote, read once
you open it. The title carries the contents line alone, which is design rule 5's own test —
these are claim sentences, not category labels, so they can. Eight to nine chapters now fit
on one screen where three and a half did.

The 292-character titles were **not** rewritten. They are still too long and the brief now
asks for under ~120 characters going forward, but rewriting 47 existing titles would be
re-chaptering and Phase 0 validated what is there.

### 3b · Item titles were labels, not claims — FIXED, but not the way the old handoff framed it

The old handoff offered three options: render the first clause of `description`, have a
stage write a claim-shaped title, or accept labels and change the layout. **All three were
wrong, and the research says why.**

`subject` is a scanning label and that is fine — in a reader, a source keeps its own title.
What was missing was the editor's line *underneath* it. So `subject` was left alone and
`notes` was added. One field fixed 3b and supplied the missing apparatus piece at once.

### 3c · Internal bookkeeping in the prose — FIXED (both sides)

35 live descriptions ended in `[AUDIT viable->wounded: …]`, `[ABSENCE: …]` or `[VERIFY: …]`,
and one opened with `[MERGED FROM A-040]`.

**The pipeline stopped writing it.** The instruction that caused it was the spec's "a killed
row stays in the file with its reason in `description`" plus SKILL.md's "record every change
on the row", naming no field. Every one of those verdicts was **already** in the run's
`audit-verdicts.jsonl`, so the append was a duplicate as well as a defect. No new row field
was needed and none was added.

**The renderer handles the rows already written that way.** `split_ledger()` in
`build_index.py` separates prose from verdict; the verdict renders as its own collapsed
disclosure below the source line, alongside the `grade` — which was invisible until now, so
23 wounded rows read exactly like the 207 viable ones. `rows.jsonl` untouched.

### 3d · Absence chrome outnumbered content — FIXED (display, content cause)

178 of 230 rows have no quote, 117 no tier reason, and no chapter anywhere has a practicum.
Each line was individually correct; together they were the most repeated text in the
product.

They are also **run-scoped facts, not item-scoped ones** — one run stored 0 of 117 quotes,
another 52 of 58 — so the run strip states each once and counts it, and the row says
nothing. Which kind of absence a row has was always readable off the source-state badge the
row already carries.

### 3e · Connective tissue — PARTLY FIXED

`notes` is the connective tissue at the item level and it does move a reader through a
chapter. Between chapters there is still nothing, and **no practicum exists in v1** — that is
now stated once per topic instead of once per chapter.

### 3f · Horizontal overflow at 390px — FIXED (was not in the old handoff)

The page laid out 449px inside a 390px screen, clipping every line of body text mid-word.
`1fr` is min-content-floored, so the widest rail pill set the track width. Two one-line CSS
fixes. Invisible in the source; found by reading a screenshot.

## 4 · What the research established

Eight agents, in two instruments. Findings, not theory — DESIGN §9 already scanned the
pedagogy literature and re-running it returns the same names.

**Four exemplar agents** read working teaching resources and extracted structure: Norton
Anthology of Theory and Criticism, The Morning Paper, Crafting Interpreters, Beej's Guide,
teachyourselfcs.com, Bret Victor's Links, Stanford Encyclopedia of Philosophy, MDN.

1. **The per-item line is a hinge, not a summary.** Colyer opens each paper with *"second of
   three… yesterday we saw X… today, the harder problem"*; Norton's headnotes *"position the
   authors in relation to other figures… not a string of isolated pearls but a mosaic"*;
   Nystrom's sections open *"now that we're comfortable with longer lexemes"*; Beej's open
   *"once you have a socket"*. Every one is relational.
2. **Summarising is the rarest job a curator does with that line** — about 6% across two
   annotated reading lists, against ~38% for positioning against alternatives and ~27% for
   saying what to notice. The obvious move is the one they avoid.
3. **Order is argued, not assumed.** Both technical exemplars state why a unit sits where it
   sits, and name dependencies at the item's opening.
4. **Two channels, one privileged.** Nystrom's margin asides, Beej's footnoted RFCs, SEP's
   exiled bibliography: authority lives offstage and the main column keeps moving. This is
   the pattern 3c and 3d now follow.
5. **The named failure mode is substitution.** Norton's own protocol specified 750–2,000-word
   headnotes and shipped an average of ~2,200; the critical literature reports students
   *settling for the headnote and never arriving at the selection*. That is why the note is
   capped at 15–30 words, and the cap is the point rather than a style preference.

**Four `/landscape-search` agents** ran a prior-art pass. Layer 2 sources are in the session
transcript. The load-bearing one is in §6 below.

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
- **New: `notes` lives on the chapter, not the row.** `rows.jsonl` cannot be backfilled,
  `chapters.jsonl` can, and a note describes the *(chapter, row)* pairing rather than the row
  — a re-run that groups differently needs a different note. Do not move it.

## 6 · The open finding — the author's call, not a bug to fix

**This is recorded, not acted on.** It proposes changing the character of a committed field
and that is a decision, not a refinement.

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
decision this session made pushed that way for the same reason arrived at independently.
`description` is the one field nobody has touched.

**The honest counter**, from the same landscape pass: novices lack the prior knowledge to
contextualize raw sources, so unscaffolded curation produces confusion rather than
expertise. Shortening `description` trades one failure mode for another, and nothing here
says where the line is.

## 7 · Known gaps, recorded not fixed

- `self-check.json` is written by `/study` and rendered by nothing.
- `practicum` is designed and not built. Stated once per topic now.
- `EMBED_CAP` governs markdown only; row data is uncapped. The real fix is slice 3.
- No steady-state chapter audit, and now no audit of note quality either. The 188 notes were
  validated mechanically (length, membership, banned constructions) and read in sample, not
  scored by an independent checker the way Phase 0 scored warrants.
- **Apparatus scales with chapter size, which nothing in the design predicted.** All five of
  terraform-v02's noteless chapters are two-member chapters whose `because` already states
  the relation between its two members. A note there paraphrases the headnote two lines
  above it.
- **Better rows need fewer notes.** terraform-v03 came in lowest at 37 of 58 because that
  harvest did real synthesis — rows cite each other by id and state their chapter's binding
  idea outright. VERDICT.md §4 found the same tension from the other side. This is the benign
  form: a note is optional and a warrant is not.
- The one-off backfill script (agent writes `{chapter_id: {row_id: note}}`, a merge script
  writes only the `notes` key) is not committed. DESIGN §6 names restructure-only as the
  upgrade path for a legacy topic and this is half of it.
- `/study` has never been run end to end on the v1 pipeline.

## 8 · Do not

- Do not re-run Phase 0.
- Do not re-chapter to fix a note. The grouping is validated; the apparatus is not the
  grouping.
- Do not migrate the 238 legacy rows.
- Do not add a fourth source state, a hard fragmentation floor, or a dependency.
- Do not make `notes` required, or draw anything where a note is absent. Omitting one is a
  legal result and 42 of 230 members correctly have none.
