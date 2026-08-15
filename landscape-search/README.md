# landscape-search

**Find out what the world already thinks about a problem — then find out where it's wrong
for yours.** A sub-agent runs the searches and brings back what everyone knows and what the
current discourse says, sources attached. Your session — the one that actually heard the
conversation — makes the call the search can't: *is the standard answer right here?*

```
what does the world already think about this problem?
has anyone solved this already, and where do they go wrong?
search the prior art on this — is the conventional approach right for us?
```

Nothing is searched until you approve the exact strings that would leave your machine.

## Install

### Claude Code — paste this prompt (recommended)

Paste this into any Claude Code session and it does the whole install — no git commands,
works on any OS:

```text
Install one skill from https://github.com/chzylee/skill-library for me:

1. Fetch ONLY the folder named landscape-search from that repo (shallow clone
   or GitHub API — your choice).
2. Copy that folder to ~/.claude/skills/landscape-search, creating directories
   as needed. Change nothing else on my machine, and remove any temporary clone.
3. Read the skill's description back to me so I can confirm it's what I wanted.
```

Then restart Claude Code (or start a new session). No extra setup — but see
[Requirements](#requirements) for what makes it good rather than merely functional.

### Claude Code — manual fallback

```bash
git clone https://github.com/chzylee/skill-library.git
cp -r skill-library/landscape-search ~/.claude/skills/landscape-search
```

Windows (PowerShell):

```powershell
git clone https://github.com/chzylee/skill-library.git
Copy-Item -Recurse skill-library\landscape-search "$HOME\.claude\skills\landscape-search"
```

Restart Claude Code (or start a new session). Project-scoped instead? Copy the
`landscape-search` folder into that project's `.claude/skills/`.

### Claude desktop

Upload `dist/landscape-search.skill` via **Settings → Customize → Skills**, or present it
in a claude.ai chat and click **Save skill**. Note that the sub-agent dispatch this skill
relies on is a Claude Code affordance — outside it, the search collapses into the main
context and you lose the isolation, though the method still holds.

## What it does

1. **Frames the hypotheses.** Not "search this topic" — what specific belief is being
   tested? Usually your diagnosis, your proposed fix, and whatever assumption sits under
   them. One query per hypothesis, because a topic search returns a topic. Invoked cold
   with nothing to go on, it asks once rather than inventing a premise.
2. **Generalizes, then asks.** Rewrites each hypothesis into category terms, shows you the
   literal strings and the number of searches, and waits. Decline and it continues on model
   knowledge alone, labeled as such.
3. **Dispatches the search in parallel.** One sub-agent per hypothesis. Exa first (it's
   embedding-based, so queries are written as descriptions of the ideal page), falling back
   to WebSearch — and it tells you which one it actually used.
4. **Reasons in three layers.** What everyone knows (labeled as model knowledge) · what the
   current discourse says (with URLs) · and then, in your session, whether any of it is
   wrong *for your case*.
5. **Rules on it.** Either a named eureka — the assumption everyone makes, the evidence
   from your conversation that breaks it, the implication — or "conventional wisdom seems
   sound here," said plainly and stopped.

## Why not just search

Three reasons a raw search is worse than this:

**The interesting layer isn't in the results.** Search tells you what people believe. It
can't tell you whether that belief holds for the thing you're building, because it's never
heard about the thing you're building. That reasoning step is the product; the search is
the input.

**Your idea shouldn't be the query.** Typing your actual concept into a search box sends it
off your machine. This generalizes first, shows you exactly what would go, and waits for a
yes. The sub-agent only ever receives the generalized terms — so the privacy line and the
delegation line are the same line, enforced by the shape rather than by remembering.

**No result is a result.** It's built to return "the standard approach is fine, here's why"
without treating that as a failed run. A tool that always finds an insight is a tool that
manufactures them.

## What it isn't

- **Not competitive research.** It looks at problem spaces, not at named companies,
  products, or pricing pages.
- **Not a debugger.** "Why is this error happening" is a different job.
- **Not a decision.** It hands you a finding to rule on. It doesn't act on it.

## Requirements

- **Sub-agent dispatch** — the skill delegates the searching. It discloses the number of
  searches at the privacy gate, before spending anything.
- **Optional but recommended: an [Exa](https://exa.ai) MCP connector.** Exa's embedding
  search fits this job much better than keyword search, and its long excerpt highlights
  usually answer the question without a second fetch. Without it, the skill falls back to
  WebFetch/WebSearch and says so — results get noticeably thinner, not broken.

## Status

First version. Written and promoted to `main` 2026-08-15, reviewed by a second model
against its source — but **not yet run end to end**. Promoted early on purpose, because
the method it encodes has been exercised inside `office-hours`; what's untested is this
packaging of it. Treat the first few runs as a shakedown.

Extracted from Phase 2.75 ("Landscape Awareness") of gstack's `office-hours` skill, where
the capability worked well but was welded to one workflow. The standalone version changes
three things: Exa-first instead of WebSearch, the search delegated to a sub-agent so
excerpts stay out of your context, and the privacy gate showing you the literal strings
rather than describing them.

## License

MIT — see [LICENSE](../LICENSE).
