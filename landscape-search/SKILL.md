---
name: landscape-search
description: 'Go find out what the world already thinks about a problem space — then say where it is wrong for THIS case. A prior-art pass, not competitive research: it establishes conventional wisdom so you can evaluate it, and the most valuable outcome is a named reason the conventional approach fails here. A sub-agent runs the searches and returns what everyone knows and what the current discourse says, each claim carrying a URL; the session that holds your actual conversation makes the final call, because that call needs context a sub-agent does not have. Privacy-gated — generalized category terms leave the machine, never your product name, proprietary concept, or stealth idea. "Conventional wisdom is sound here" is a legal, expected outcome; it never manufactures an insight. Triggers on "what does the world think about X", "has anyone solved this already", "search the landscape / prior art for this", "is the standard approach right here", "what am I missing about this problem space", or /landscape-search. Not for competitive/product research on named companies, and not for debugging a specific error.'
---

# landscape-search — what the world thinks, and where it's wrong

Search the problem space, establish what everyone already believes, then apply
first-principles reasoning to that belief **for the specific case in front of you**. The
prize is not a solution to copy. It's a named reason the conventional approach is wrong
here — or an honest confirmation that it isn't.

**This is prior art on a problem space.** It is not competitive research on named
companies and products, and it is not error-cause debugging. If the ask is "who else
sells this" or "why is this stack trace happening," this is the wrong skill.

## How a run must go — the hard rules

1. **The privacy gate is blocking.** Nothing is searched before the human says yes. What
   leaves the machine is generalized category terms only — never their product name,
   proprietary concept, or stealth idea.
2. **Every claim is sourced or labeled.** A Layer 2 claim carries a URL. A Layer 1 claim
   is labeled as model knowledge, unverified. Never dress in-distribution knowledge as a
   finding, and never fabricate a citation.
3. **Layer 3 stays in this session.** The sub-agent never makes the "is the conventional
   answer wrong here" call — it doesn't have the conversation that makes that call worth
   anything. See [Why the split](#why-the-split-is-where-it-is).
4. **An empty result is a real result.** "Conventional wisdom is sound here" is a correct,
   expected ending. Manufacturing an insight to have something to show is the failure mode
   this rule exists to stop.

## Step 1 — Frame the hypotheses

Before any query, write down **what is actually being tested** — one line each, usually
two to four:

- The diagnosis. *What the human believes is wrong / why the problem exists.*
- The fix. *What they propose doing about it.*
- Any load-bearing assumption underneath either.

One query per hypothesis. If you can't state the hypothesis, you can't write the query —
searching a topic returns a topic; searching a hypothesis returns evidence.

**If the invocation doesn't carry enough to fill this in** — a bare technology question
with no established problem behind it, like *"should I use a job queue for this?"* — then
**ask, once, before going further:** what's the problem this is meant to solve, and what
makes you think it's the fix? Do not invent a plausible-sounding diagnosis to complete the
template. A fabricated hypothesis produces a generic search and a Layer 3 with nothing
real underneath it, which is worse than the extra question. (Inside a longer conversation
this step is usually already answered — read up before you ask.)

## Step 2 — Generalize, then gate

Rewrite each hypothesis into **category terms**: "task management app landscape," not
"SuperTodo, the AI-powered task killer." Strip the product name, the internal concept
name, anything that identifies an unshipped idea.

Then stop and ask, showing your work:

> I'd like to search what the world thinks about this space. **These exact strings would
> leave the machine:** `<generalized query 1>`, `<generalized query 2>`… That's **N
> sub-agent searches**. OK to run, or keep this session private?

Showing the literal strings is the point — the human can see the generalization worked
before it ships, not after. Stating N is the spend disclosure; it belongs here rather than
as a second interruption.

**If they decline:** skip the search entirely and continue on model knowledge only, said
out loud and labeled as such. A declined gate is not a failed run.

## Step 3 — Write queries that describe the ideal page

Exa is embedding-based. It matches the *shape* of a page, so write the query as a
one-line description of the page you wish existed:

- ✅ "blog post arguing that background job queues are overkill for small apps"
- ✅ "postmortem from a team that migrated off microservices and regretted it"
- ❌ "job queue overkill small apps" *(keyword habit — wrong tool)*

A search tool that isn't embedding-based (WebSearch) wants the opposite. Rewrite for
whichever one you end up on rather than sending the same string to both.

## Step 4 — Dispatch the search

Send **one sub-agent per hypothesis, all in one message** so they run in parallel. A
general-purpose agent is normally enough. Each prompt must be self-contained and carries
these instructions:

- **The generalized query only.** The sub-agent gets the category terms, never the
  specific idea. The privacy boundary and the delegation boundary are the same boundary —
  which is why this shape is safe by construction, not by discipline.
- **Exa first.** Use the Exa MCP search tool if the session has one (the name typically
  ends in `web_search_exa`). Fall back to WebFetch/WebSearch if it doesn't — Exa is an
  MCP server and can be absent in headless or scheduled runs. **State which tool was
  actually used** in the returned answer. This applies to the sub-agent, not just you.
- **Read the highlights before fetching.** Exa returns long excerpt chunks; top results
  are often readable without a follow-up fetch. Spend a fetch only when a highlight is
  load-bearing for a claim and cut off mid-thought.
- **Return Layers 1 and 2 only** (defined in [Step 5](#step-5--the-three-layers) — paste
  those two definitions into the prompt; the sub-agent can't read this file). No
  recommendations, no "you should."
- **A fixed return shape**, so parallel returns line up instead of each inventing a
  format. Give the sub-agent exactly this:

  ```
  QUERY RUN: <the query string, verbatim>
  TOOL USED: <exa | websearch | webfetch>
  LAYER 1 — what's standard here: <2-4 bullets, labeled model knowledge>
  LAYER 2 — what the discourse says: <2-4 bullets, each ending with its URL>
  DRY HOLE: <yes/no — yes if nothing relevant came back>
  ```
- **Every Layer 2 claim carries its URL.** A claim that can't be sourced gets dropped or
  labeled as model knowledge, never quietly promoted.
- **Report a dry hole as a dry hole.** Nothing relevant found is a returnable answer.
  Padding with adjacent-but-irrelevant results is worse than an empty hand.
- **Output budget:** roughly 400–800 tokens per hypothesis. Structured, not a transcript.

## Step 5 — The three layers

**Layer 1 — Tried and true.** What does everyone already know about this space? Standard
patterns, the battle-tested default. This is mostly in-distribution model knowledge, so
**label it as such** — it's the baseline, not a finding. The risk here isn't ignorance,
it's assuming the obvious answer is right.

**Layer 2 — New and popular.** What is the current discourse saying? Blog posts, ecosystem
trends, recent best practice. This is what the search buys. Scrutinize it: crowds get new
things wrong as easily as old ones. Search results are inputs to reasoning, not answers.

**Layer 3 — First principles.** *Given what we know from this specific conversation* — is
there a reason the conventional approach is wrong **here**? This is the one that matters
and the one only this session can run.

Present Layers 1 and 2 compactly, with sources. Then reason Layer 3 out loud, in the open,
naming which specifics from the conversation are doing the work.

## Step 6 — Rule on it

One of two endings, stated plainly:

**Eureka.** Name it in the shape that makes it checkable:

> **EUREKA:** Everyone does X because they assume *[assumption]*. But *[specific evidence
> from this conversation]* suggests that's wrong here. Which means *[implication]*.

An insight that can't name the assumption it breaks and the evidence that breaks it isn't
one yet — say what's missing instead of rounding up.

**No eureka.** *"The conventional wisdom seems sound here."* Say it and stop. This is a
clean result: you now know the default is defensible for a reason, which raises the bar
for anything that contradicts it later.

## Why the split is where it is

Layers 1 and 2 are lookups — anyone can run them, and running them elsewhere keeps a pile
of search excerpts out of your context. Layer 3 is a judgment that depends entirely on
what was said in *this* conversation: the constraint mentioned in passing, the thing
already tried, the reason the obvious fix doesn't fit. A sub-agent handed the generalized
query has none of that, and a sub-agent handed all of that would breach the privacy gate.

So the split isn't a performance tradeoff. It's the same line drawn twice.

## Output

The three-layer synthesis in the conversation, with sources, and a stated verdict. Nothing
is written to disk — this feeds the next move in a discussion. If a run is worth keeping,
that's a separate, deliberate write.

## Notes and limits

- **It reads the landscape; it does not decide.** The verdict is a finding for the human
  to rule on, not a direction to act on.
- **It can only see what's published.** A quiet space returns thin results — which is
  information, but not proof nobody has been there.
- **Composes freely.** Run it before a design decision, mid-conversation when a premise
  starts wobbling, or as a standalone check. It neither requires nor blocks anything else.

## License

MIT — see [LICENSE](../LICENSE).
