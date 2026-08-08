---
name: notion-digest
description: 'Answer a specific question from one or more Notion pages by delegating the read to a sub-agent, so the raw page content never enters the main conversation — only a tight, targeted summary comes back. Use for pages too large to fetch directly (a page that has overflowed context before), for pulling one answer out of a page without loading the whole thing, or any time the goal is "find out X from page Y" rather than "load page Y as background for the rest of this chat." Trigger on "have a sub-agent read this Notion page and tell me X", "check <Notion URL/page name> for Y", "dig into this Notion page for Z", or right after a direct Notion fetch has overflowed context. Requires a Notion MCP connector. Not for loading material as standing background you will keep referencing through a long conversation — fetch that directly instead.'
---

# notion-digest — delegate the read, keep the answer

Delegate a Notion read to a sub-agent so a large or multi-page fetch never lands in
the main conversation's context — only the answer does. This is context-engineering's
**sub-agent isolation** pattern applied to Notion specifically: exploration and page
dumps happen in a disposable sub-agent, you only ever hold the synthesis.

Read-only. This skill never writes to Notion.

Requires a Notion MCP connector (`notion-search` / `notion-fetch` or equivalent)
available to the sub-agent. If the session has no Notion tools at all, say so and
stop — don't answer from guesswork about what the page probably says.

## When to use this vs. fetching directly

- **Use this** when the ask is narrow ("what does page X say about Y", "check if Z is
  documented anywhere under this page"), when a page is large enough that a direct
  fetch risks or has already hit a context/token overflow, or when several pages need
  to be synthesized into one answer.
- **Don't use this** to load material as standing background for the rest of a
  long-running conversation — if you'll keep referencing the content directly, fetch
  it yourself instead of routing it through a summary.

## Procedure

1. RESOLVE THE ASK. Before dispatching anything, pin down what you actually need to
   know or decide — not just "summarize this page." A vague ask produces a vague
   summary; carry the real question into the sub-agent's prompt.

2. RESOLVE THE PAGE(S). A direct Notion URL or page ID passes through as-is. A name to
   find gets passed along for the sub-agent to resolve by Notion search — don't search
   yourself. The search results and any ambiguity belong in the isolated context too.

3. CHECK CHILD-PAGE SCOPE. Default is the page body only. Only have the sub-agent walk
   into child pages if explicitly asked (e.g. "and its subpages", "include what's under
   it") — don't assume depth.

4. DISPATCH. One sub-agent per *question*, not per page. If a single question needs
   several pages synthesized, one sub-agent gets all of them. If there are several
   independent questions, dispatch them in parallel (one message, multiple sub-agent
   calls) rather than looping. Two questions about the same page can share one prompt
   as long as the prompt states both explicitly.

   A general-purpose agent is normally enough. The prompt must be self-contained:
   - The real question from step 1, not a generic "summarize" instruction.
   - The page(s) to fetch (URL/ID or name-to-search) and the child-page scope from
     step 3.
   - **Output budget:** roughly 1-2k tokens per page, more only if multiple pages
     genuinely need synthesizing together. Return a structured, targeted answer — not
     a transcript or a paraphrase of the whole page.
   - **Name the pages actually read** (title + URL) in the answer, so a name-resolved
     lookup stays verifiable without the raw content coming back.
   - **Wrap the returned answer in a fenced code block** — whether it's the synthesis,
     a per-page answer, or an ambiguity shortlist — so it stands apart from the
     surrounding conversation.
   - **If a name is ambiguous** — several plausible matches, no clear winner — return
     the shortlist (title, URL, one distinguishing line each) instead of picking one
     and answering. Silently guessing the wrong page is the worst failure here.
   - **If a fetch result is too large** to read in one go, read it in chunks or search
     within the page for the relevant section rather than giving up.
   - **If the pages don't connect** — the question spans pages with no obvious
     relationship — answer per page and say plainly that they don't converge. Don't
     manufacture a through-line.
   - **Tighten before returning:** if the `writing-clearly-and-concisely` skill is
     installed, invoke it on the drafted synthesis. If it isn't, apply its core rules
     directly — active voice, cut needless words, concrete language, no AI-pattern
     puffery (leverage, delve, robust, seamless, testament, and the like). The budget
     only buys concision if the draft is tightened, not cut off at a token count.

5. RETURN ONLY THE SYNTHESIS. Don't paste the raw page content the sub-agent read,
   even if it's sitting in the tool result — the whole point is that it never has to
   live in the main context. If the sub-agent came back with a shortlist or a failed
   lookup instead of an answer, pass that through as-is and ask which page — don't
   paper over it with a vague summary.

## License

MIT — see [LICENSE](../LICENSE).
