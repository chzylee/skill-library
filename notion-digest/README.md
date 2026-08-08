# notion-digest

A **sub-agent reads the Notion page so you don't have to.** You ask a question, a
disposable side-context does the fetching, and **only the answer comes back** — the raw
page never enters your conversation. So a page that would blow your context (or already
has) costs you a paragraph instead of a chapter.

```
have a sub-agent read the Q3 roadmap page and tell me what shipped
check the "Onboarding" page for anything about SSO
dig into this Notion page for pricing details
```

## Install

### Claude Code — paste this prompt (recommended)

Paste this into any Claude Code session and it does the whole install — no git commands,
works on any OS:

```text
Install one skill from https://github.com/chzylee/skill-library for me:

1. Fetch ONLY the folder named notion-digest from that repo (shallow clone or
   GitHub API — your choice).
2. Copy that folder to ~/.claude/skills/notion-digest, creating directories as
   needed. Change nothing else on my machine, and remove any temporary clone.
3. Read the skill's description back to me so I can confirm it's what I wanted.
```

Then restart Claude Code (or start a new session). There's no extra setup — but *using*
the skill requires a Notion MCP connector in the session (see
[Requirements](#requirements)).

### Claude Code — manual fallback

```bash
git clone https://github.com/chzylee/skill-library.git
cp -r skill-library/notion-digest ~/.claude/skills/notion-digest
```

Windows (PowerShell):

```powershell
git clone https://github.com/chzylee/skill-library.git
Copy-Item -Recurse skill-library\notion-digest "$HOME\.claude\skills\notion-digest"
```

Restart Claude Code (or start a new session). Project-scoped instead? Copy the
`notion-digest` folder into that project's `.claude/skills/`.

### Claude desktop

Upload `dist/notion-digest.skill` via **Settings → Customize → Skills**, or present it
in a claude.ai chat and click **Save skill**. (The bundle isn't built yet — see
[Status](#status).)

## What it does

1. **Pins down the real question** — not "summarize this page," but what you actually
   need to know or decide. A vague ask buys a vague summary.
2. **Resolves the page(s)** — a link or ID as-is; a name goes to the sub-agent to search
   for, so even the search results stay out of your context.
3. **Dispatches one sub-agent per question** (in parallel if you asked several), with an
   output budget of ~1–2k tokens per page and a concision pass before it returns.
4. **Hands back only the synthesis** — plus the title and URL of what it actually read,
   so you can check its work without loading the page.

## Why not just fetch the page

A single big Notion page can blow past a per-call token limit on its own — you don't need
a multi-page job to hit it. Routing the read through a sub-agent contains that: it can
chunk, retry, or search *within* the page, and either way the dump lands in a context you
throw away.

The tradeoff is real, so use it deliberately: **you get an answer, not the material.** If
you'll keep referencing the page for the rest of a long conversation, fetch it directly
instead — a summary is the wrong shape for standing background.

It's **read-only**. It never writes to Notion.

## When it can't answer cleanly

It says so instead of bluffing. A page name matching three plausible pages comes back as a
shortlist to pick from, not a confident answer about the wrong one. Pages that turn out to
have nothing to do with each other get answered separately, with that stated plainly.

## Requirements

- **A Notion MCP connector** (`notion-search` / `notion-fetch` or equivalent) available in
  the session. This is a hard requirement — without it the skill says so and stops.
- **Optional:**
  [`writing-clearly-and-concisely`](https://github.com/softaworks/agent-toolkit/blob/main/skills/writing-clearly-and-concisely)
  — if installed, the sub-agent runs its draft through it before answering, so the token
  budget buys signal instead of padding. Absent, it applies the same rules inline.

## Status

Promoted to `main` 2026-08-06. Built the same day and run once on a real lookup (the
Persona Library page) before promotion — still early, so treat the first few runs as a
shakedown. The `dist/` bundle isn't built yet (no packager available at promotion time);
install by copying the folder.

## License

MIT — see [LICENSE](../LICENSE).
