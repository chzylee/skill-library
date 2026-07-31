---
name: legible
description: 'A logical first-time reader sits down, walks the core parts of a piece of writing in order, and signs off on its legibility — or says exactly where it does not read clearly. A readability-and-ownership pass: it first validates the structure (does a clear outline come through?), then goes element by element to VERIFY each part does its job for a reader and VALIDATE the wording where a reader stumbles — you rule change-or-keep on each, so the writing is one you own and a reader can follow start to finish. Three modes by reader rigor: light (element pass only), standard (structure + elements, a Sonnet reader), rigorous (adds a naturally pickier Haiku reader as a clarity stress test). It verifies and validates — it is not a rewriter, and it does not judge voice or style (a known limit). Triggers on "make this legible", "readability pass on X", "is this clear / does it read well", "have a reader check X for clarity", "sign off on X", or /legible.'
---

# legible — a logical reader signs off

Sit a **logical first-time reader** down with a piece of writing, walk its core parts in order, and
have them **sign off that it reads clearly** — or say exactly where it doesn't. Two principles run
through it:

- **It verifies as much as it fixes.** Half the value is confirming a part *does* its job for a
  reader — not only hunting for flaws.
- **The human owns every call.** It surfaces a reader's experience and may propose a clearer option,
  but the human rules each change and re-authors in their own voice. It never silently rewrites the
  piece into AI prose.

Works on any writing; it's sharpest on writing whose job is to be understood — docs, posts,
artifacts, newsletters. It checks **legibility, not voice or style** (a known limit, stated, not
enforced).

## How a run must go — the hard rules

A run is invalid if it skips any of these. They exist because the failure mode is collapsing the
walk back into an AI summary — which recreates the exact problem the skill is meant to solve.

1. **Show the words, never a summary.** At every finding, quote the **actual text from the piece** —
   the reader stumbled *there*, on *those words*, and the human can only fix what they can see. A
   description of the problem ("this is dense," "a wall of jargon") is **not** a substitute for
   showing the sentence. Like a code tool shows you the code, this shows you the text.
2. **One item at a time, then stop.** Present **one** element — and **one** stumble within it — then
   **stop and wait for the human's ruling.** Never batch findings into a single list or table;
   batching *is* the failure.
3. **The human rules; you never auto-apply.** Surface the reader's experience and optionally propose a
   fix. The human rules change-or-keep. **Apply only what they ruled, after they rule it.** "I can't
   find it" means *show them where it is* — never a cue to fix it yourself.
4. **Always sign off.** The final fresh read is a step, not an extra. Never skip it.

## Setup — a short interview (two questions)

1. **Who is the reader, and where are they arriving from?** The audience *and their entry point* —
   landing cold, arriving from a hub/page that already defined the terms, or mid-document. Both shape
   what counts as a stumble (a term the entry point already defined is not a stumble). Every check is
   run *as that reader, from that entry point*.
2. **Which mode?** light · standard *(default)* · rigorous — see [Modes](#modes).

Confirm both in one line, then begin.

## The reader

The "reader" is a **sub-agent that reads cold, as the named audience, and reports its experience** —
where it perceives the structure, whether each part delivers its job and where, where it re-reads or
loses the thread, a term it didn't get, the question it's left with. It reports experience; **it does
not rewrite, and it does not praise.**

- **Standard reader** — a **Sonnet** sub-agent: an attentive, capable reader.
- **Stress reader** (rigorous mode) — also a **Haiku** sub-agent: a naturally pickier, harder-to-
  satisfy reader. Where it loses the thread but the Sonnet reader doesn't, the writing is leaning on
  the reader being sharp. Surface its catches as candidates; the **human rules** which are real.

## Part 1 — Validate the structure  *(standard + rigorous; skipped in light)*

A clear piece has a clear outline underneath, even when it's never shown. This is a quick **check**,
not an authoring task — **never ask the human to write out each part's job.**

1. **Show the perceived outline.** A reader gives back the outline it *actually perceives* — the parts
   in order, each with a few words on what it seems to do. Present that as one compact list.
2. **The human reacts, lightly.** Does this structure make sense? A one-word *"yes, proceed"* is a
   valid answer. Or they flag what's off — an order that doesn't build, a part that doesn't pull its
   weight, something buried or missing, a part that reads as a different job than intended.
3. **Rule any change** (reorder / cut / merge / add), then move to the elements. Ownership here is
   *ruling on the structure you're shown* — not pre-describing it.

## Part 2 — Walk the elements  *(the whole skill in light mode)*

For each structural element, **in order and one at a time**, two checks — **verify, then validate:**

1. **Verify function.** Run a reader on the element and report **whether it receives the part's job,
   and where.** (If the opener is meant to say "what this is," does a cold reader come away knowing
   what it is, and find it there?) Confirm what works or flag a function miss — verify the part does
   its job, not only find fault.
2. **Validate choice.** Then surface **where the reader stumbles — one stumble at a time, quoting the
   exact text** (a term it didn't get, a sentence it re-read, a lost thread, an unanswered question).
   **Show the words**, propose a clearer option if you have one, then **stop for the human's
   change-or-keep ruling.** Apply only what they rule; move to the next stumble only after they've
   ruled this one. (Offer help freely — withholding a suggestion to force authoring only adds friction
   on writing.)

## Modes

| Mode | What runs | Reader(s) |
|---|---|---|
| **light** | Part 2 only | Sonnet |
| **standard** *(default)* | Part 1 + Part 2 | Sonnet |
| **rigorous** | Part 1 + Part 2 | Sonnet + Haiku (stress reader) |

## The sign-off

After the rulings are applied, a **fresh Sonnet reader reads the whole piece once more — this step
always runs, never skipped.** If it follows start to finish with nothing unresolved: **"Reads clean —
good to share."**

If more edits happen after that, offer one more read — but say it should be good, and to watch for
over-verifying. Keep that nudge **positive** ("this reads clean; another pass is optional"), never a
checklist of faults. There is **no automatic loop** — another pass is the human's call, not the
skill's.

## Output

The improved, owned writing, and the good-to-share sign-off. **No log, no telemetry** — a piece a
reader can follow is the whole proof.

## Notes

- **Verify, don't just fix.** Say what lands, not only what breaks — confirming what works is half
  the job.
- **The human owns every call.** Surface the reader's experience and propose; the human rules. Never
  rewrite the piece wholesale.
- **It knows one thing — legibility.** It checks whether the writing works for a reader, not voice or
  style. That gap is a stated limit, not a rule that refuses other writing.
- **Composes with anything.** If the user wants another editing pass — de-slop, tone, whatever —
  before, after, or mid-run, that's their call. This skill neither requires nor blocks it.
