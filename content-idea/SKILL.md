---
name: content-idea
description: 'Evaluate a content idea against the owner''s brand before any shaping work: run it through the brand lens (the canonical brand.md tests), report how the idea reads relative to the brand — where it aligns, where it diverges — and return a verdict: ON-BRAND (ship it to shaping), RESHAPEABLE (the one failed test doing the most damage + the move that fixes it), or OFF-BRAND (route to another platform or drop). Triage, not shaping: it decides whether a seed is worth outlining; /content-starter does the outlining after. Read-only. Triggers on "content-idea", "run content-idea on X", "brand-check this idea", "is this idea on-brand", "does this fit my brand", or /content-idea.'
---

# Content Idea — brand triage

Evaluate one content idea against the owner's brand, before any shaping investment.
This is the triage gate at the front of the content pipeline: **content-idea decides
whether and how a seed fits the brand; /content-starter shapes it into an outline
afterward.** Never write the piece, never produce the outline — diagnose.

## The brand file

The lens lives in one canonical file per subject:
`~/.claude/life-ledger/subjects/<subject>/brand.md`
(single subject on the machine → use it; several → ask which).

It contains: Identity (stance, promise, voice, platform lenses), the numbered tests,
disqualifiers, and the verdict protocol. **The file is the authority** — do not
substitute your own taste for its tests, and do not soften a disqualifier. If no
brand.md exists, stop and say so: the brand lens is produced by the owner's strategy
work (for its schema, see any existing brand.md or the skill docs) — do not invent
one ad hoc.

## Procedure

1. **Take the idea as given.** From the invocation or conversation. If the goal of the
   piece is unstated, ask for it in one question ("what should the reader get?") —
   the reader-facing goal is load-bearing for the evaluation, and guessing it wrong
   invalidates the verdict.
2. **Read brand.md.** Fresh each run — rulings change.
3. **Run every test, in order.** For each, write one line: the test, and *how the idea
   reads against it* — not pass/fail alone, but the observed difference between what
   the idea currently is and what the brand expects ("goal as stated leads with the
   how-to; brand expects the observation first"). This differences-read is the
   product; the verdict is its summary.
4. **Check disqualifiers.** Any hit → OFF-BRAND regardless of test performance, with
   the routing suggestion (which platform, or drop).
5. **Verdict, per the file's protocol:**
   - **ON-BRAND** — ship to shaping. Note anything worth preserving ("the episode is
     the X moment — don't lose it in outlining").
   - **RESHAPEABLE** — name the ONE failed test doing the most damage and the single
     move that fixes it. One test, one move — a list of fixes is a dodge.
   - **OFF-BRAND** — say where it belongs instead (another platform lens, or nowhere).
6. **Hand off.** If ON-BRAND or reshaped-by-the-move, suggest `/content-starter` with
   the corrected seed. If the idea revealed a gap in the brand file itself (a test
   that misfires on a legitimate idea), flag it to the owner — the lens is downstream
   of the strategy and only the owner changes it.

## Register

Diagnosis in the older-sibling register the brand itself specifies: direct, warm,
specific. No scores, no rubric tables in the output — a short read of how the idea
sits against the brand, the verdict, and the move.
