# Structure stage — restructure only

**Class:** organization over rows that already exist. **Status:** slice 1 of the v1
redesign. This stage does no research and adds no schema.

You have been given the live rows of **one topic** that was harvested earlier. Your job is
to find the ideas that bind them together and emit **chapter records**. You are not
evaluating the rows, correcting them, adding to them, or looking anything up.

The reason this stage exists: 120 correct, sourced, disconnected rows are a bad thing to
study from. What makes material expert-grade is how it is organized, not how much of it
there is. Novices sort by surface features, experts sort by deep structure. This stage is
where that difference gets made.

---

## Input

One JSON object per line. Only these fields are yours to read:

| Field | Use |
|---|---|
| `id` | The row's identifier. Chapters reference rows by `id` and nothing else. |
| `subject` | Short label. Useful for scanning, **misleading for grouping** — see below. |
| `description` | The actual claim. This is what you group on. |
| `depth` | `orientation` · `operation` · `judgment` · `mechanism`. Context only. |
| `type` | `concept` · `trap` · `exercise` · `drill`. Context only. |
| `origin` | Where the claim came from. Useful signal: rows from one source often, but not always, share a principle. |
| `evidence` | `re-opened` · `asserted` · `authored`. Context only. |

Rows where `grade` is `killed` or `merged` are **not live**. They are not given to you and
must not appear in any chapter.

**Fields that do not exist yet and must not appear in your output:** `kind`, `binding`,
`binding_warrant`. Those belong to a later slice. If you find yourself wanting them, you are
doing the wrong job.

## Output

One JSON object per line, written to the path you are given.

```json
{
  "chapter_id": "ch-03",
  "topic": "Kafka consumer mechanics and delivery semantics",
  "principle": "Everything that follows from committing offsets after processing",
  "because": "All five are consequences of one ordering choice: the offset is written after the handler returns, not before. The redelivery window, the duplicate-handling burden, and the entire exactly-once discussion fall out of that single decision.",
  "members": ["K-014", "K-031", "K-008", "K-052", "K-019"],
  "notes": {
    "K-014": "Start here: the commit point is the one fact the other four are consequences of.",
    "K-031": "The interval turns that commit point into a measurable window of redone work.",
    "K-008": "Same window, seen from the other side — what a rebalance does to work already in flight.",
    "K-052": "Where the two previous items stop being a tuning question and become a delivery guarantee."
  },
  "order": 3,
  "kind": "principle"
}
```

- `chapter_id` — `ch-NN`, unique within the topic.
- `principle` — the chapter's name. A sentence fragment naming the binding idea, not a
  category label. **Aim under 120 characters.** It has to work as a contents line read on
  its own; past about 200 it stops being a title and starts being a paragraph.
- `because` — the warrant, and also the chapter's **headnote**: it is what a reader sees
  first on opening the chapter. See the test below. Minimum 80 characters.
- `members` — row `id`s **in reading order**. Order matters: earlier members should be
  assumed by later ones where any such relationship exists.
- `notes` — **optional**, and the subject of the next section. One short line per member,
  keyed by row id. Omit the key for any member you have nothing real to say about; omit
  the whole field rather than filling it.
- `order` — where this chapter sits in the topic. Chapters are read in this order.
- `kind` — `principle` for a real chapter, `reference` for the one permitted exception
  below.

---

## `notes` — the one line that makes a chapter read as teaching

Without this, an opened chapter is a list of labels. `subject` is a scanning label
("Purpose of Terraform state", "commitSync vs commitAsync") and `description` is a
faithful summary of the source. Neither says why the item is *here*, in *this* chapter,
at *this* point in the order. That sentence is the whole difference between a taught
section and an index, and you are the only stage that can write it: you are the one
holding every row of the topic at once and choosing the sequence.

**A note is a hinge, not a summary.** It relates the item to what came before it, to the
chapter's principle, or to what the reader should be watching for in it. It never
restates what the item says — `description` already does that, sits right underneath, and
is longer than anything you would write.

Each note does **one** of exactly three jobs:

| Job | What it says | Shape |
|---|---|---|
| **Place it in the sequence** | why it comes here, what the previous item set up | *"Once the commit point is fixed, this is what the interval does to it."* |
| **Name what it depends on** | what has to be true or understood first | *"Assumes the graph from the item above; without it the parallelism claim reads as arbitrary."* |
| **Say what to notice** | the thing in the item that is easy to read past | *"The word doing the work here is 'binding' — it is a record of what was, not a statement of what should be."* |

**15 to 30 words. One sentence.** This is a hard ceiling, not a target, and the reason is
specific: an annotation long enough to stand in for the item gets read *instead of* it.
That failure has a name in anthology editing — readers settle for the headnote and never
reach the selection — and it is the exact failure this whole tool exists to avoid, since
the premise is that every path bottoms out at a firsthand source. A note that could
replace its item has broken the product, however well written it is.

### Prohibited in a note

1. **No summary of the item.** If the note would still make sense with the item deleted,
   it is a summary. Rewrite it as a relation.
2. **No judgment of importance.** Not "the most important item here", not "essential", not
   "you can skip this". How much something matters depends on who is reading, and this
   stage does not know that. It is a prohibited field on a row and it is prohibited here.
3. **No advice.** Not "make sure you", not "always", not "be careful to". You are placing
   the item, not instructing the reader.
4. **No comparison of tools or frameworks.** Not "better than", not "the modern way".
5. **No claim about the world that is not already in the member rows.** A note reasons
   over rows you were given. It is not a place to add knowledge, and you have opened no
   sources.
6. **No second person.** Write about the material, not to the reader.

### When to omit

**Omitting a note is a legal, expected result** and is better than writing a filler one.
Leave the key out when the item's place in the order is obvious, or when the honest answer
is "it is also true and it goes somewhere." A chapter with three notes on five members is
a better chapter than one with five notes of which two are padding. If you find you can
write nothing for most of a chapter's members, say so in your summary — that is real
evidence the grouping is weaker than its `because` claims.

Notes are optional in the schema, and every chapter written before this section existed
has none. Nothing renders where there is no note; no build gate requires one.

---

## The test that decides whether you did this correctly

> **Does `because` name a mechanism, constraint, or shared cause that is NOT fully visible
> in any single member row?**

A real principle is **emergent**. You cannot read it off any one member, which is precisely
why grouping them is worth doing. A restatement is not emergent, and it will read as a
summary of the list.

| Verdict | Example |
|---|---|
| **Principle** | "All four follow from offsets being committed after processing rather than before, so every one of them is a consequence of the same ordering choice." |
| **Restatement** | "These rows all cover offset commits, auto-commit settings, and delivery guarantees." |
| **Surface grouping** | "Everything about consumers." |

The second and third are failures even though both are true sentences. Truth is not the bar.

### Group on `description`, not on `subject`

`subject` fields are short labels written by a harvester, and things with similar labels are
often governed by different mechanisms while things with dissimilar labels are often
governed by the same one. Grouping by shared words in `subject` is **exactly the surface
grouping this stage exists to avoid.** If your `because` could have been written from the
member subjects alone, you grouped on the wrong field.

### Do not force a principle that is not there

If a set of rows genuinely shares no binding idea, saying so is the correct result. See the
`reference` exception.

---

## Constraints

1. **Every live row appears in exactly one chapter.** No row is left out, none appears twice.
2. **No chapter holds more than 12 members.** A chapter of 20 is a category, not an idea.
3. **A topic with 15 or more live rows produces at least 3 chapters.** One giant chapter
   passes every text check and still leaves the reader facing a wall.
4. **`because` is at least 80 characters** and must not be mostly the concatenated subjects
   of its own members.
5. **Chapters are ordered.** If chapter B assumes something established in chapter A, A comes
   first. Where no dependency exists, order by what a reader should meet first.
6. **A note is at most 30 words** and belongs to one member of one chapter. The build
   warns above roughly 220 characters; it never fails on a note.

### The `reference` exception, and its limits

Some rows will not belong to any principle you can honestly name. Rather than inventing a
chapter for them or padding a real chapter to absorb them, emit **at most one** chapter per
topic with `"kind": "reference"`, placed last.

Its `because` must state plainly that these rows did not resolve into a principle — for
example: *"These did not group under any binding idea I could name. They are individually
correct and collectively unrelated, kept here as lookup rather than reading."*

This chapter is honest, and honesty is the point. But it is also an escape hatch, so:

- **It may not exceed 20% of the topic's live rows.** If more than a fifth of a topic will
  not group, the failure is the grouping, not the rows. Say so in your summary rather than
  emitting a huge reference chapter.
- It is exempt from the ≤12 member cap and from the principle test, because it is not
  claiming to be a principle.
- Emitting no `reference` chapter at all is a better result than emitting one.

---

## What to return

Write the chapter records to the output path you are given. Then return **300 words or
fewer**:

- How many chapters, and the member count of each.
- Any topic-level observation about how the rows did or did not want to group.
- If you emitted a `reference` chapter: how many rows, and why they resisted.
- **How many members got a note, out of how many members** — and if a chapter got few,
  which one and why. A low note count is information about the grouping, not a failure.
- The two chapters you are **least** confident about, named, with one line each on why.

That last item is not optional and it is not a formality. A stage that reports uniform
confidence has told the reader nothing, and this stage's output is about to be checked by
someone who did not see your reasoning.

Do not return the chapter records themselves. They are on disk.

---

## Prohibitions

1. **Add nothing.** No new rows, no corrections, no research, no opening of sources. If a row
   looks wrong, that is not your job this stage; note it in your summary.
2. **Never move a row between topics.** Topic boundaries were set at scope time.
3. **Do not write a `because` you could have written without reading the descriptions.**
   That is the whole defect this stage is guarding against.
4. **An honest failure is a legal result.** "These rows do not group well, and here is what I
   tried" is more useful than a set of fluent chapters that do not survive a reader.
