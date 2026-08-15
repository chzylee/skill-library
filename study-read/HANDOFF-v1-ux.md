# Handoff — /study v1 is built and reads badly

Written 2026-08-15 at the end of the build session, for a cold session that will refine the
reading experience. Nothing here needs the prior conversation.

**The verdict from the author, verbatim:** *"the visibility is good, but the layout and text
displayed make it functionally unusable as is."*

Read that carefully, because it splits the work. The **disclosure model works** — provenance,
source states, the adaptive run strip, honest absences. Do not redesign those. What fails is
**layout and what text gets put on the page.**

---

## The frame — settled with the author this session, and it should drive the refine

DESIGN-v1 never names what kind of thing the output is. It says *"a textbook you can't get any
other way"* and then immediately *"Not authored prose"*, and that unresolved contradiction is
upstream of the defects in §3: a textbook explains, this refuses to explain, and what shipped
explains nothing and reads as an index.

**The artifact is a reader.** Not the person — a *reader* in the editorial sense, as in
`A Graphic Design Reader`: a curated collection of primary sources, selected and ordered to teach
a subject, with short editorial text introducing each section and saying why its pieces sit
together. The learning happens in the sources. *Course pack* is the plainer synonym for the same
object if "reader" is too academic for a product surface.

That word resolves the contradiction. **An editor writes headnotes, not exposition.** So teaching
material and "not authored prose" were never actually in conflict — the ordering and the
headnotes *are* the teaching.

**Claude's role, in the author's words: researcher → curator → editor. "Not too opinionated
beyond structure."** That is a testable line, and it is narrower than it first sounds:

| Opinions that are the job | Opinions that are out of bounds |
|---|---|
| what is worth including, and what is not | which framework or tool is better |
| what groups with what, and why | what the reader should do |
| what order to meet things in | how important something is to *this* reader |
| what to notice about an item | any claim about the world without a source |

The right-hand column is already covered by committed constraints — consumer-agnostic analysis
(§4.1), no rationale the source does not state (§4.3), no priority or importance field on a row
(§4.6). The left-hand column is the editorial apparatus, and it is the thing that is missing.

**Note the constraint that appears to forbid this and does not.** "Never render with the model"
means *there is no model path to HTML* — see §3 and §12b of DESIGN-v1. It governs who generates
markup, not who writes sentences. The model already authors `principle`, `because`, the drill
rows, and the honest-limits prose. Editorial connective text breaks nothing.

### The apparatus, and where each piece already stands

| Piece | Status |
|---|---|
| **General introduction** — what this topic is, its boundary, where to start | Exists. `guide-meta.json` `scopes[topic]` renders as the boundary line. |
| **Chapter headnote** — what this section is, why these belong together, what to notice | Exists as `because`, median 476 chars, but it is framed as a *warrant* aimed at the Phase 0 checker and crammed onto a collapsed contents line. See §3a — the problem is placement, not length. |
| **Per-item note** — why this is here and what it does in the sequence | **Missing.** `description` is a faithful summary of the source; `depth_check` explains the tier. Neither says why the item earned its place. This is the gap behind §3b. |

Two of three already exist in the data. One is missing. That is a much smaller job than "improve
the UX," and it is the job.

### The bar

The author's benchmark, and it is worth adopting as a success criterion because §14 has nothing
like it. `/study graphic design` must beat **both**:

- **Googling it yourself** — someone already searched, discarded the junk, ordered what survived,
  and said why each thing is here. And it persists and stays searchable beside every other topic.
- **Asking a chat model** — you get the same orientation *plus* the page it came from. Fluency is
  the part you cannot verify; the citation is the part you can.

**The outcome is that the reader learns.** §14's criteria measure organization, structure size,
traceability and cost. None of them measures whether anyone learned anything. That gap is worth
closing before another display cycle.

---

## 1 · Read these, in this order

| File | What it is |
|---|---|
| this file | what is broken, measured |
| `study-read/DESIGN-v1.md` §6, §8, §11 | the spec. Sections 6 (schema), 8 (display), 11 (approach) are live |
| `study-read/design/topic-view-prototype.html` | the agreed visual target — **and the source of the problem, see §3** |
| `study-read/validation/VERDICT.md` | what Phase 0 proved, cost, and explicitly did NOT establish |

**Only slice 1 is committed.** Slices 2 and 3 are designed and deliberately uncommitted. Do not
build them, and do not let their schema (`kind`, `binding`, `binding_warrant`, `supersedes`) leak
into anything.

## 2 · State — what works right now

Branch `study-v1-phase0-20260814`, 6 commits, nothing pushed. Both skills are symlinked into
`~/.claude/skills/` and load. `/study-read` has been run end to end. `/study` is wired but has
never been run against the v1 pipeline.

```bash
python3 study-read/references/gates_test.py    # 26 tests
python3 study-read/references/build_test.py    # 19 tests
python3 ~/.claude/skills/study-read/references/build_index.py --open
```

Expect: 3 topics, 238 rows, 47 chapters, 4 topic/run units all `ok`, ~656 KB written to
`~/.claude/study/index.html`.

To look at it: copy the built file into `/private/tmp` and open it with
`~/.claude/skills/gstack/browse/dist/browse` (sandboxed to `/private/tmp` and this repo).
Screenshot at 1280x900 and 390x844 and **read the screenshots** — every defect in §3 was found
that way and none of them is visible in the HTML source.

## 3 · The diagnosis, measured

**The prototype was designed against text roughly three times shorter than the store holds.**
This is a fit problem between the design and the data, not a taste problem, which is why it reads
as "functionally unusable" rather than "a bit off."

| Element | Prototype (max of 5 samples) | Real median | Real p90 | Real max |
|---|---|---|---|---|
| Chapter title — `principle` | 66 chars | 105 | 202 | **292** |
| Chapter warrant — `because` | 173 chars | 476 | 559 | **674** |
| Item title — `subject` | 109 chars | 56 | 80 | 110 |
| Item body — `description` | *not drawn* | 634 | 1089 | **2352** |

Reproduce both halves of that table:

```bash
python3 - <<'EOF'
import json,glob,os,statistics as st
rows=[json.loads(l) for d in glob.glob(os.path.expanduser('~/.claude/study/runs/*'))
      for l in open(os.path.join(d,'data','final.jsonl')) if l.strip()]
live=[r for r in rows if r.get('grade') not in ('killed','merged')]
ch=[json.loads(l) for d in glob.glob(os.path.expanduser('~/.claude/study/runs/*'))
    if os.path.exists(os.path.join(d,'data','chapters.jsonl'))
    for l in open(os.path.join(d,'data','chapters.jsonl')) if l.strip()]
f=lambda xs:(min(xs),int(st.median(xs)),sorted(xs)[int(len(xs)*.9)],max(xs))
print('subject    ',f([len(r['subject']) for r in live]))
print('description',f([len(r['description']) for r in live]))
print('principle  ',f([len(c['principle']) for c in ch]))
print('because    ',f([len(c['because']) for c in ch]))
EOF
```

### 3a · The contents view does not do its job

DESIGN-v1 §2 promises: *"You see the shape of the whole topic without scrolling."* You cannot.
Each chapter row is a ~105-char title plus a ~476-char warrant, so five chapters is a wall of
prose and thirteen (Kafka) is several screens. The one thing the contents view exists to deliver
is the first thing lost.

The warrant is load-bearing for the *design* — it is what the Phase 0 checker scored — but it is
not obviously what a **reader** needs on a contents line. Worth questioning whether `because`
belongs on the collapsed row at all, or one expansion in.

Design rule 5 in §8 is the test: *"If you cannot understand the shape of the subject by reading
only the chapter titles, the chaptering failed, not the styling."* Read the 47 titles alone and
judge honestly which side of that line they fall on. Some are 292 characters and are not titles.

### 3b · Item titles are labels, not claims

Length is fine; **shape** is wrong. The prototype's item titles are claim sentences:

> "Offsets commit after processing, so a crash before commit reprocesses the batch"

The store's `subject` fields are glossary labels — "Purpose of Terraform state", "commitSync vs
commitAsync", "ConsumerRebalanceListener callbacks". 137 of 230 are short noun phrases. So an
expanded chapter reads as an index, not as teaching. The structure brief
(`study/references/structure-legacy.md`) already warns that `subject` is *"useful for scanning,
misleading for grouping"* — the renderer took it as a title anyway.

The honest options are (a) render the first clause of `description` as the scannable line,
(b) have a stage write a claim-shaped title, or (c) accept labels and change the layout to suit
an index. Do not silently truncate a description and call it a title.

### 3c · Internal bookkeeping is on the reader's page

**36 of 230 live descriptions contain an audit annotation** that was never meant for a reader:

> "… 'none' (throw if no committed offset) is the fail-loud option and the direct remedy for the
> K-041 trap. Incomplete against its own source at operation depth. Default 'latest' is confirmed
> correct.]"

Bracketed blocks like `[AUDIT viable->wounded: …]` are pipeline state. They belong in the ledger
and on the grade, not in the prose. Four prefixes are in use — 27 `AUDIT`, 5 `ABSENCE`,
3 `VERIFY`, 1 `MERGE` — so grepping for `[AUDIT` alone undercounts:

```bash
python3 - <<'EOF'
import json,glob,os,re
rows=[json.loads(l) for d in glob.glob(os.path.expanduser('~/.claude/study/runs/*'))
      for l in open(os.path.join(d,'data','final.jsonl')) if l.strip()]
live=[r for r in rows if r.get('grade') not in ('killed','merged')]
pat=re.compile(r'\[(AUDIT|VERIFY|ABSENCE|MERGE)')
print(len([r for r in live if pat.search(r['description'])]), 'of', len(live))
EOF
```

Note this is a **`/study` pipeline** defect, not a renderer one — stage 3 writes these into
`description` instead of alongside it. Whatever the fix, it cannot rewrite `rows.jsonl`.

### 3d · Absence chrome outnumbers content

- **178 of 230 rows have no `quote`** (77%), so "No quote captured for this row…" is on three of
  every four items.
- **117 of 230 have no `depth_check`** (51%), so "This run did not record why it sits at that
  tier" is on half.

Each line is individually correct and was deliberate — never blank, never mislabelled. Together
they are the most repeated text in the product. The rule that generated them is right; the
volume is a UX problem the rule did not anticipate. Consider stating the absence once per topic
in the run strip and dropping it from the row, rather than repeating it 178 times.

### 3e · No connective tissue

Chapters assert an order and nothing carries a reader across it. There are no transitions, no
"now that you have X, here is why Y bites." A teaching resource moves you; this presents you with
correctly-grouped records. Also: **no practicum exists in v1**, so every chapter ends with a line
saying so.

## 4 · Settled. Do not re-open.

Re-litigating these burns a session and the reasoning is already written down.

- The schema, the two axes, the chaptering premise, the display architecture — DESIGN-v1.
- Chaptering itself. Phase 0 validated it: 82.2% of 47 real chapters rated genuine principles by
  a blind checker, all 8 void controls rejected, pre-registration matched 8/8. `VERDICT.md`.
- **Fragmentation warns and never fails.** Phase 0's most fragmented arm scored highest. There is
  a comment saying so in `gates.py`; do not "fix" it into a hard floor.
- **There is no dead-link state.** Nothing in the store records a link check or a 404. Exactly
  three source states render: `source checked` / `not opened` / `authored`. A test enforces this.
- **Topics are the index**; a unit is one run of one topic and is what owns chapters. Terraform
  was studied twice and gets a run switcher, not a merge.
- **One self-contained HTML file, opens from `file://`, no server, no external requests.** DESIGN
  §8 argues for a served viewer — that is slice 3 and is not committed.
- Python 3 stdlib only. Never render HTML with a model. `~/.claude/study/data/rows.jsonl` is
  append-only and irreplaceable; `chapters.jsonl` is safe to regenerate.
- Never weaken or delete a test to make it pass.

## 5 · Known gaps, recorded not fixed

- `self-check.json` is written by `/study` and rendered by nothing. The old guide folded its
  answers; the topic view does not draw it.
- `practicum` is designed and not built. Every chapter renders the absent state.
- `EMBED_CAP` governs markdown only; row data is uncapped and slice 1 widened rows to full text.
  Every build prints its size accounting. The real fix is slice 3.
- No steady-state chapter audit. The independent checker existed only in the Phase 0 validation,
  against `MSR-6`.
- `/study` has never been run end to end on the v1 pipeline. Stage 5 (structure) was wired this
  session and is untested against a live run.

## 6 · Suggested first moves

0. **Start from the frame above, not from the CSS.** The job is the editorial apparatus: one
   piece missing, one misplaced, one already working. That is the spine of the refine.
1. **Look before theorising.** Build, screenshot at both widths, read them. Then read the 47
   chapter titles alone against design rule 5.
2. **Decide content-vs-display for each defect in §3 before touching CSS.** 3b and 3c are content
   problems that no stylesheet fixes; 3a and 3d are layout problems with content causes. Getting
   this split wrong costs a cycle.
3. **Then, exemplar research — with a real brief.** DESIGN-v1 §9 already scanned the pedagogy
   literature (Chi, Bloom, Webb, Spiro, Meyer & Land); re-running that returns the same names and
   teaches nothing new. What is missing is one level down: take 6–8 teaching resources that
   demonstrably work and extract **structure**, not theory — what one unit of content looks like,
   how a section opens, how sourcing is carried without drowning the page, what they do that a
   list of facts does not. The author's framing is the target: *"like if someone went and did a
   bunch of searching on the internet to teach me something and logged it neatly for me."*
4. `/impeccable` is the named tool for the visual pass (DESIGN §8), after the content questions
   are settled.

## 7 · Do not

- Do not re-run Phase 0.
- Do not start with CSS. The measurements in §3 say the layout is drawing text it was never sized
  for; restyling without deciding what text goes on the page will produce a prettier index.
- Do not migrate the 238 legacy rows. "Survive" means queryable and readable in a labelled
  unchaptered view, not retrofitted — DESIGN §6.
- Do not add a fourth source state, a hard fragmentation floor, or a dependency.
