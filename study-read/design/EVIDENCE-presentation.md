# The evidence behind how this library presents information

Written 2026-08-15. The record behind Success Criterion 8 in `DESIGN-v1.md`.

## Why this file exists

The bar for `/study` is **that the reader learns**, and §14's original seven criteria measure
organization, structure size, traceability and cost — none of them measures learning. That
gap was recorded twice and closed neither time, because measuring it directly needs learners,
a control, and a post-test, which this project does not have and is not going to build.

**So the claim is made one level down, where it can actually be checked.** The design's
governing principle is *no claim should be made without a traceable cause*. That principle
was written for claims about the world: every row traces to a source. This file extends the
same discipline to claims about **presentation**: every decision about how the material is
put on the page names the finding behind it, or is marked plainly as craft judgment.

That is a weaker claim than "this teaches", and saying so is the point. It is also a
falsifiable one: you can audit whether a decision has evidence behind it, and you can check
whether the evidence says what the decision claims it says.

**The honest limit, stated before the table rather than after it:** nothing below was
measured on *this* artifact. Every finding is about resources that demonstrably teach, or
about how comparable artifacts fail. That the same moves work here is an inference, not a
result.

---

## The decisions, and what each rests on

### Evidence-backed

| Decision | The finding | Source |
|---|---|---|
| The chapter warrant (`because`) opens the chapter it introduces, rather than sitting on the collapsed contents line | Documentary-editing practice splits two objects that were being conflated. A **section introduction** is required wherever material is topically grouped and must state "the criteria for selection and the scheme of organization"; a **source note** is per-item and mechanical, where "there is no room for creativity." Our `because` is the first, and was in the second's position. | <https://gde.upress.virginia.edu/07-gde.html> |
| The per-item note is a **hinge**, never a summary | Every working exemplar spends the item's first apparatus sentence on adjacency, not description. Colyer: *"This is the second of three papers… Yesterday we saw the Statecall Policy Language… Today we look at the harder problem."* Norton's stated protocol: headnotes *"position the authors in relation to other figures in the anthology, picturing the history of theory not as a string of isolated pearls but as a mosaic."* Nystrom: *"Now that we're comfortable with longer lexemes, we're ready to tackle literals."* Beej: *"Once you have a socket, you might have to associate that socket with a port."* | <https://blog.acolyer.org/2015/03/30/end-of-term-and-how-i-read-a-paper/> · Norton preface, <https://epdf.pub/the-norton-anthology-of-theory-and-criticism-5ea806ce63784.html> · <https://craftinginterpreters.com/scanning.html> · <https://beej.us/guide/bgnet/html/> |
| A note may **not** summarise the item | Across two annotated reading lists, summarising the source is the **rarest** job a curator does with the per-item line — roughly 6%, against ~38% for positioning against alternatives and ~27% for saying what to notice. The obvious move is the one practitioners avoid. Bret Victor's lines describe the *domain*, not the book: *"Design as cognitive science."* | <https://teachyourselfcs.com/> · <https://worrydream.com/Links/> |
| A note is capped at **15–30 words** | The named failure mode is substitution. The Norton anthology's own "Protocols for Headnotes" specified 750–2,000 words and shipped an average of about 2,200; the critical literature on the same volumes reports that the apparatus can "short-circuit entry into the critical conversation by seeming sufficient," with students settling for the headnote and never arriving at the selection. A cap is the only structural defence. | <https://muse.jhu.edu/article/32390/summary> · <https://doi.org/10.57709/1059563> · <https://geraldgraff.com/wp-content/uploads/2021/12/Anthologies.pdf> |
| A note may not warn, advise, rank importance, or compare tools | Two independent constraints converge. The editorial one: an unwritten rider on the Norton protocol kept critique in proportion to explanation, because a headnote weighted toward complaint "disinclines students to continue on to the reading" — the apparatus's job is to motivate arrival at the source. The annotation literature adds that its goal is explicitly not to display erudition or lock down a single interpretation. The project's own constraints (§4.1, §4.6) forbid the same things for different reasons. | <https://muse.jhu.edu/article/32390/summary> · <https://lemdo.uvic.ca/lemdo/learn_annotationsChapter.html> |
| Audit verdicts and build state get their **own channel**, one expansion in, rather than sitting in the reader's prose | "Two channels, one privileged" is the shared move across every technical exemplar. Nystrom's margin asides carry etymology, alternatives and regrets and are declared skippable; Beej footnotes the RFCs and exiles an abridged man-page chapter that disclaims itself; SEP pushes editions and secondary literature into a per-figure bibliography and back matter. In all three the main column keeps moving and authority lives offstage. | <https://craftinginterpreters.com/scanning.html> · <https://beej.us/guide/bgnet/html/> · <https://plato.stanford.edu/guidelines.html> |
| The reading order is **argued**, not merely asserted | Both technical exemplars state why a unit sits where it sits and name dependencies at the item's opening. Beej: *"I've tried to lay out the system calls in the following sections in exactly (approximately) the same order that you'll need to call them in your programs"* — and names the rival source's limit, *"In that, the man pages are no use."* | <https://beej.us/guide/bgnet/html/> · <https://craftinginterpreters.com/scanning.html> |

### Craft judgment, not evidence — marked so the distinction stays real

| Decision | Why it was made |
|---|---|
| Absence (no quote, no tier reason, no practicum) stated once per topic rather than once per row | Pure volume arithmetic: 178 + 117 + 47 repetitions made "this is missing" the most repeated text in the product. No finding required and none claimed. |
| Descriptions reflowed into paragraphs at sentence boundaries | Adjacent support only — SEP's standing-in-the-literature paragraphs run 100–170 words and MDN's Description block is broken up rather than continuous. That a 35-line unbroken block is worse is typographic common sense, not a measured result. |
| Facet vocabulary matches the badge vocabulary; no stored enum reaches the reader | Internal consistency. One fact should not wear two names on one page. |
| The run strip is collapsed unless something structural is wrong | `DESIGN-v1.md` §8's own decision, taken before this research. |
| The depth facet reads plain-to-deep without claiming a level | Follows from §9's existing citation against reading a taxonomy as a sequence — so it is evidence-constrained rather than evidence-derived. |

---

## The case against this whole approach, kept where it can be seen

An evidence file that only cites support is advocacy. These came back from the same searches
and are not resolved.

1. **Apparatus can defeat the source it introduces.** A short intro answering who, what, when
   and why "gives just enough information to overshadow the source itself in classroom
   discussion," and pairing a source with a synthesis leaves the source as "superfluous
   illustration." This is the strongest argument against the headnote *as such*, not merely
   against long ones. <https://medium.com/new-american-history/getting-primaried-da15006486e5>

2. **Curation without scaffolding produces confusion, not expertise.** Sets of primary
   sources are reported to work only when deliberately paired with secondary-source
   paragraphs and in-text definitions, because learners lack the prior knowledge to construct
   meaning from primary sources alone; decontextualized excerpts produce "sourcework for
   sourcework's sake." This cuts directly against shortening `description`.
   <http://thenhier.ca/en/content/using-primary-sources-more-effectively-sets-primary-sources.html>

3. **A synthesis suppresses source-opening even when the source is one click away.** Seven
   experiments, >10,000 participants: learners given LLM syntheses developed shallower
   knowledge than those navigating ordinary search links, and an arm offering real-time
   source links *alongside* the synthesis did not close the gap.
   <https://realkm.com/2026/03/26/learning-with-ai-falls-short-compared-to-old-fashioned-web-search/>
   **Evidence chain, stated honestly:** a research agent read a search-engine highlight of a
   secondary write-up. The underlying paper has not been opened by anyone on this project.
   Treat the direction as sourced and the magnitude as unverified. This is the open finding
   in `HANDOFF-v1-ux.md` §6 and it is the author's call, not a defect to fix.

4. **The field building things like this has largely not measured whether they teach.** A
   critical review screened 1,223 articles to 16 qualifying studies and found 82% evaluated
   on technical or user-perception metrics, with a near-absence of measured learning
   outcomes — named as "the evaluation gap." Which is exactly the gap SC8 works around rather
   than closes.
   <https://www.journalofcomputereducation.info/ojs/index.php/jce/article/view/41>

5. **An accumulating library tends not to get read.** Saving fires the completion reflex that
   reading was supposed to earn; in a controlled retrieval study only 16% of bookmarked
   targets were retrieved via the bookmark facility, and bookmarked sites were retrieved no
   better than non-bookmarked ones. Nothing in this design addresses return-and-read.
   <https://zettelkasten.de/posts/collectors-fallacy/> ·
   <https://journals.sagepub.com/doi/10.1177/0961000620949652>

---

## How this was gathered, and how much to trust it

Eight research agents, 2026-08-15, in two instruments.

**Four exemplar agents** read working teaching resources and extracted structure rather than
theory, quoting verbatim: Norton Anthology of Theory and Criticism, The Morning Paper,
Crafting Interpreters, Beej's Guide to Network Programming, teachyourselfcs.com, Bret
Victor's Links, the Stanford Encyclopedia of Philosophy, MDN. These read primary material
directly and are the stronger half.

**Four `/landscape-search` agents** ran a prior-art pass on the problem space under the
skill's privacy gate. These read search highlights and secondary write-ups, and are the
weaker half. Two specific caveats carried forward from their returns: the
recommender-system prerequisite figures (81%/83%) come from a self-published write-up of the
author's own experiment and are not peer-reviewed; and several vendor pages carry the
sharpest versions of the collector's-fallacy claim while selling the remedy, so their
headline statistics were treated as marketing.

**Deliberately not re-run:** the pedagogy literature in `DESIGN-v1.md` §9 (Chi, Bloom, Webb,
Spiro, Meyer & Land). It was already scanned and re-running it returns the same names. What
was missing was one level down — structure, not theory — and that is what the exemplar pass
went after.

## When to re-run this

When a presentation decision is proposed that no row above covers, and it is not honestly
marked as craft. That is the trigger, and it is the only one.
